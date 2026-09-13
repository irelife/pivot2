/* ============================================================
 *  store.js  v3  ―  第1段-D（Firestore を「正」にする）
 *
 *  これまで：スプレッドシートが正。保存のたびに全データをまるごと上書き。
 *            → 古いコピーを持った端末が保存すると、他の人の修正が消えた。
 *
 *  ここから：Firestore が正。保存は「変わった物件だけ」。
 *            さらに保存の直前に「他の人が先に保存していないか」を確かめ、
 *            先を越されていたら保存を止める（黙って上書きしない）。
 *
 *  ・PIVOT 本体（core.js）には手を入れていません。
 *    データの出入口 postToGas を包むだけです。
 *  ・スプレッドシートにも今までどおり書き続けます（戻せるようにするため）。
 *    ただし送る中身は Firestore から読み直したものなので、両者は必ず一致します。
 *  ・元に戻すには index.html の store.js の行を消すだけです。
 *
 *  置き場所： 物件 → pivot2/data/buildings/{物件ID}
 *            区画は「番号をキーにした一覧」で持ちます  spots:{ "1":{...}, "2":{...} }
 *            rev（版番号）が保存のたびに1つ増えます。これで追い越しを見つけます。
 * ============================================================ */
(function(){
  'use strict';

  var ok = false;
  try{ ok = !!(window.firebase && firebase.firestore && firebase.auth); }catch(e){ ok = false; }
  if(!ok){
    /* ★★ v26）Firebase そのものが読み込めていないときは、保存をぜんぶ止めます
     *
     *  ここから下は、まるごと動きません。
     *  つまり postToGas は包まれないまま、素通しになります。
     *  クラウド（Firestore）を1度も見ないで、控えのスプレッドシートへ
     *  直接書くことになります。それが、いちばん危ない状態です。
     *
     *  読むことはできます。メールも送れます。
     *  書くことだけ、止めます。                                       */
    try{ console.error('[D] Firebase が読み込めていないので、保存を止めます'); }catch(e){}
    try{
      var _raw0 = window.postToGas;
      if(typeof _raw0 === 'function'){
        window.postToGas = function(url, body, timeoutMs){
          var act = body && body.action;
          var NG = { save:1, saveBuildings:1, saveContractsOnly:1, saveOwnersOnly:1,
                     deleteContract:1, uploadImage:1, deleteImage:1 };
          if(NG[act]){
            try{ window.alert('クラウドの安全確認ができないため、保存しませんでした。\n\n' +
                              '通信の状態を確かめて、ページを開き直してください。'); }catch(e){}
            return Promise.resolve({ ok:false, error:'firebase-unavailable',
                                     message:'クラウドを確かめられないので保存しませんでした' });
          }
          return _raw0(url, body, timeoutMs);      /* 読み込みなどは、これまでどおり */
        };
      }
    }catch(e){}
    /* 契約の削除も、ここで止めます（contracts.js から呼ばれます） */
    try{
      window.__pvCtDel = {
        mark: function(){
          try{ window.alert('クラウドの安全確認ができないため、契約を削除しませんでした。\n\n' +
                            'ページを開き直してから、もう一度お願いします。'); }catch(e){}
        },
        read: function(){ return []; },
        flush: function(){ return Promise.resolve({ ok:false, error:'firebase-unavailable' }); }
      };
    }catch(e){}
    return;
  }

  /* ---------- 共通 ---------- */
  function pfx(){ return (typeof insPrefix === 'function') ? insPrefix() : 'pivot_'; }
  var INS = pfx().replace(/_+$/, '') || 'pivot';
  function db(){ return firebase.firestore(); }
  function col(){ return db().collection(INS).doc('data').collection('buildings'); }
  function revKey(){ return pfx() + 'fs_rev';  }   /* 物件ごとの版番号 */
  function ctKey2(){ return pfx() + 'last_ct'; }   /* 最後に見た 契約／オーナー の件数 */
  function myCtKey(){ return pfx() + 'contract_kanban_v2'; }            /* この端末の契約 */
  function myOwKey(){ return pfx() + 'rent_owner_send_owners_v1'; }     /* この端末のオーナー */
  function readRaw(k, dflt){
    try{ var v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null) ? dflt : v; }
    catch(e){ return dflt; }
  }
  function sigKey(){ return pfx() + 'fs_sig';  }   /* 物件ごとの中身の指紋 */

  function me(){
    try{
      if(typeof window.pvDeviceName === 'function') return (window.pvDeviceName() || '').trim();
      return (localStorage.getItem(pfx() + 'device_name') || '').trim();
    }catch(e){ return ''; }
  }
  function readMap(k){
    try{ var o = JSON.parse(localStorage.getItem(k) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch(e){ return {}; }
  }
  function mergeMap(k, add){
    var m = readMap(k), f;
    for(f in (add || {})){ if(Object.prototype.hasOwnProperty.call(add, f)) m[f] = add[f]; }
    writeMap(k, m);
    return m;
  }

  /* ============================================================
   *  ★ v21）クラウドを何回読み書きしたかを、この端末で数えます
   *
   *  「1日に読み書きできる回数を使い切りました」と出たときに、
   *  どこで使っているのかを、あてずっぽうでなく見られるようにするためです。
   *  数えるだけです。クラウドへは送りません。
   *  コンソールで  pvUsage()  と打つと出ます。
   * ============================================================ */
  var USEK = function(){ return pfx() + 'fs_use'; };
  function useDay(){
    /* 無料枠は、日本時間の夕方4時ごろに戻ります（アメリカの午前0時）。
       同じ区切りで数えないと、数と実感が合いません。 */
    var d = new Date(Date.now() - 16 * 3600000);
    var p = function(n){ return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate());
  }
  function use(kind, n, why){
    try{
      n = Number(n) || 0;
      if(n <= 0) return;
      var u = readMap(USEK());
      if(u.day !== useDay()) u = { day:useDay(), read:0, write:0, why:{} };
      u[kind] = Number(u[kind] || 0) + n;
      if(!u.why) u.why = {};
      u.why[why] = Number(u.why[why] || 0) + n;
      writeMap(USEK(), u);
    }catch(e){}
  }
  try{
    window.pvUsage = function(){
      var u = readMap(USEK());
      if(u.day !== useDay()) u = { day:useDay(), read:0, write:0, why:{} };
      var t = ['── この端末が、きょうクラウドを使った回数 ──',
               '　日付（夕方4時区切り）： ' + u.day,
               '　読んだ回数： ' + (u.read || 0) + '　（1日の枠は 50,000）',
               '　書いた回数： ' + (u.write || 0) + '　（1日の枠は 20,000）',
               '　どこで：'];
      var w = u.why || {}, k, arr = [];
      for(k in w){ if(Object.prototype.hasOwnProperty.call(w, k)) arr.push([k, w[k]]); }
      arr.sort(function(a, b){ return b[1] - a[1]; });
      for(var i = 0; i < arr.length; i++) t.push('　　' + arr[i][0] + '： ' + arr[i][1]);
      t.push('※ ほかの端末のぶんは入っていません。');
      try{ console.log(t.join('\n')); }catch(e){}
      return u;
    };
  }catch(e){}
  function writeMap(k, o){ try{ localStorage.setItem(k, JSON.stringify(o || {})); }catch(e){} }
  /* 中身の指紋。
     項目の並び順が違うだけで「変わった」と判定しないよう、
     いつも同じ順番（名前順）に並べ替えてから文字にします。
     ここを揃えないと、何も直していないのに全物件が書き換え扱いになり、
     ほかの端末が全部「衝突」になってしまいます。 */
  function canon(x){
    if(x === null || typeof x !== 'object') return x;
    if(Array.isArray(x)){
      var a = [], i;
      for(i = 0; i < x.length; i++) a.push(canon(x[i]));
      return a;
    }
    var o = {}, ks = Object.keys(x).sort(), j;
    for(j = 0; j < ks.length; j++) o[ks[j]] = canon(x[ks[j]]);
    return o;
  }
  /* 指紋。以前は中身の文字そのものを控えていましたが、
     それだと物件・契約の「もう1部のコピー」を端末に置くのと同じで、
     iPhone の保存できる量（およそ5MB）をすぐに使い切っていました。
     いまは短い符号（20文字ほど）だけを控えます。中身は同じだけ見分けられます。 */
  function hash32(str, seed){
    var h = seed >>> 0, i;
    for(i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }
  function sig(x){
    var t;
    try{ t = JSON.stringify(canon(x)); }catch(e){ return 'r' + Math.random(); }
    if(t === undefined) t = '';
    /* 別々の数え方を2つ重ねます（たまたま同じ符号になるのを防ぐため） */
    return t.length.toString(36) + '.' +
           hash32(t, 2166136261).toString(36) + '.' +
           hash32(t, 5381).toString(36);
  }

  /* ---------- 区画：配列 ⇔ 番号キーの一覧 ---------- */
  function spotsToMap(spots){
    var m = {}, i, s, k, o, f;
    for(i = 0; i < (spots || []).length; i++){
      s = spots[i] || {};
      k = (s.no === null || s.no === undefined) ? '' : String(s.no);
      if(!k || m[k]) continue;                    /* 番号なし・二重は入れません */
      o = {};
      for(f in s){ if(Object.prototype.hasOwnProperty.call(s, f) && s[f] !== undefined) o[f] = s[f]; }
      o.no = s.no;
      o.type   = s.type   || '並';
      o.tou    = s.tou    || '';
      o.room   = (s.room === null || s.room === undefined) ? '' : s.room;
      o.user   = s.user   || '';
      o.price  = s.price  || 0;
      o.status = s.status || '空';
      o.note   = s.note   || '';
      m[k] = o;
    }
    return m;
  }
  function mapToSpots(m){
    var a = [], k;
    for(k in (m || {})){ if(Object.prototype.hasOwnProperty.call(m, k)) a.push(m[k]); }
    a.sort(function(x, y){
      var nx = parseFloat(x && x.no), ny = parseFloat(y && y.no);
      var bx = !isNaN(nx), by = !isNaN(ny);
      if(bx && by && nx !== ny) return nx - ny;
      if(bx !== by) return bx ? -1 : 1;
      return String((x && x.no) || '').localeCompare(String((y && y.no) || ''));
    });
    return a;
  }

  var META = { rev:1, updatedAt:1, updatedBy:1, migratedAt:1 };

  /* ============================================================
   *  ★★ 区画1つずつの保存（欄ごとの指紋）
   *
   *  【これまでの作り】
   *
   *  物件を1件ずつ保存する、ここまではできていました。
   *  ただ、1件のなかみは丸ごと送っていました。
   *  ナディアの20区画ぜんぶが1枚の紙に書かれていて、
   *  その紙をまるごと送り直す形です。
   *
   *  だから、Aさんが1番区画、Bさんが2番区画を触ると、
   *  同じ1枚を2人で書き替えることになり、必ずぶつかりました。
   *
   *  【これから】
   *
   *  変わった区画だけを送ります。
   *  「ナディアの3番区画を、こう変える」という指示だけです。
   *  紙を送り直しません。
   *
   *  そのために、物件ごとに「部品ごとの指紋」を控えます。
   *
   *    f:name → 物件名の指紋
   *    f:addr → 住所の指紋
   *    s:3    → 3番区画の指紋
   *    s:4    → 4番区画の指紋
   *
   *  保存のときは、手元の指紋と控えを見くらべて、
   *  変わった部品だけを送ります。
   *  ほかの人が別の部品を変えていても、こちらは触りません。
   *
   *  ★ まったく同じ部品を、同時に2人が変えたときだけ、
   *    これまでどおりお知らせします。そこは避けられません。
   * ============================================================ */
  function fprKey(){ return pfx() + 'fs_fpr'; }     /* 部品ごとの指紋の控え */
  /* Firestore に「この欄を消す」と伝える印 */
  function DEL(){
    try{ return firebase.firestore.FieldValue.delete(); }catch(e){ return null; }
  }

  /* 物件1件から、部品ごとの指紋を作ります */
  function fprOf(d){
    var m = {}, f, sp, k;
    for(f in d){
      if(!Object.prototype.hasOwnProperty.call(d, f)) continue;
      if(f === 'spots' || META[f]) continue;
      m['f:' + f] = sig(d[f]);
    }
    sp = d && d.spots;
    for(k in (sp || {})){
      if(!Object.prototype.hasOwnProperty.call(sp, k)) continue;
      m['s:' + k] = sig(sp[k]);
    }
    return m;
  }
  function fprRead(){ return readMap(fprKey()); }
  /* ★ クラウドから読んだそのままの形と、手元の形は、欄の並びや
       初期値の入れかたが違います。同じ形にそろえてから指紋を取ります。
       そろえないと、何も変わっていないのに「相手が変えた」と誤認します。 */
  function fprOfCloud(id, data){
    try{ return fprOf(toDoc(id, fromDoc(data || {}))); }catch(e){ return {}; }
  }
  function fprWriteAll(o){ writeMap(fprKey(), o || {}); }

  /* 手元と控えを見くらべて、この端末が変えた部品だけを挙げます */
  function fprDiff(now, base){
    var out = { set:[], del:[] }, k;
    now  = now  || {};
    base = base || {};
    for(k in now){
      if(!Object.prototype.hasOwnProperty.call(now, k)) continue;
      if(base[k] !== now[k]) out.set.push(k);            /* 足した・変えた */
    }
    for(k in base){
      if(!Object.prototype.hasOwnProperty.call(base, k)) continue;
      if(now[k] === undefined) out.del.push(k);          /* 消した */
    }
    return out;
  }

  /* 部品の名前から、Firestore へ送るときの場所を作ります */
  function fprPath(k){
    if(k.indexOf('s:') === 0) return 'spots.' + k.slice(2);
    return k.slice(2);
  }
  function fprValue(d, k){
    if(k.indexOf('s:') === 0) return (d.spots || {})[k.slice(2)];
    return d[k.slice(2)];
  }

  var _loaded = false;   /* この画面で Firestore から読み込めたか */

  /* ㊹ 古い画面のまま使っている端末を見つけます。
     Firestore の config/<instance> に  minStore: 12  のように書いておくと、
     それより古い版で開いている端末は、赤い帯を出して保存を止めます。
     「開き直してください」という口頭のお願いを、仕組みに変えるためのものです。 */
  var STORE_VER = 28;   /* ★ 物件も契約も、中身が空なら送らせない版 */
  var _tooOld = false;

  function toDoc(id, b){
    var d = {}, f;
    for(f in b){
      if(!Object.prototype.hasOwnProperty.call(b, f)) continue;
      if(f === 'spots' || META[f]) continue;
      if(b[f] === undefined) continue;
      d[f] = b[f];
    }
    d.id    = id;
    d.name  = b.name || '';
    d.addr  = b.addr || '';
    d.spots = spotsToMap(b.spots);
    return d;
  }
  function fromDoc(d){
    var b = {}, f;
    for(f in d){
      if(!Object.prototype.hasOwnProperty.call(d, f)) continue;
      if(f === 'spots' || META[f]) continue;
      b[f] = d[f];
    }
    b.spots = mapToSpots(d.spots);
    return b;
  }

  /* ---------- Firestore から全物件を読む ---------- */
  function readAll(why){
    return col().get().then(function(qs){
      /* ★ v24）クラウドへ届いていません（端末の中の控えから返ってきました）。
           読めなかったのと同じに扱います。ここで区別しないと、
           「0件」を「みんなが消した」と取りちがえます。 */
      if(fromCache(qs)){
        try{ console.warn('[D] クラウドへ届きませんでした（端末の控えから返ってきたので、使いません）'); }catch(e){}
        return null;
      }
      var b = {}, revs = {}, sigs = {};
      qs.forEach(function(doc){
        var d = doc.data() || {}, id = doc.id;
        b[id]    = fromDoc(d);
        revs[id] = d.rev || 0;
        sigs[id] = sig(toDoc(id, b[id]));
      });
      use('read', Math.max(qs.size || 0, 1), '物件をぜんぶ読む（' + (why || 'そのほか') + '）');
      return { buildings:b, revs:revs, sigs:sigs, partial:false, at:newest_(b, qs), cached:fromCache(qs) };
    }).catch(function(e){
      try{ console.warn('[D] Firestore を読めませんでした', e); }catch(x){}
      return null;
    });
  }

  /* いちばん新しい updatedAt を控えます（次に「そこから先」を読むため） */
  function newest_(b, qs){
    var t = '';
    try{
      qs.forEach(function(doc){
        var v = String((doc.data() || {}).updatedAt || '');
        if(v > t) t = v;
      });
    }catch(e){}
    return t;
  }

  /* ============================================================
   *  ★ v21）「直されたものだけ」を読みます
   *
   *  これまでは、様子を見にいくたびに物件を全部（およそ70件）
   *  読み直していました。ほかのタブから戻るたびにも読んでいたので、
   *  何も直していない日でも、1日の枠（50,000回）を使い切っていました。
   *
   *  物件を保存すると updatedAt（保存した日時）が入ります。
   *  そこで「前に見たときより新しいものだけ」を読みます。
   *  何も直されていなければ、読むのは1回で済みます。70回が1回です。
   *
   *  ただし「ほかの端末で消された物件」は、この読み方では分かりません。
   *  そこで、消したときに小さな目印を書いておき、
   *  その目印だけを見にいきます（読むのは1回）。変わっていたら全部を読みます。
   *  念のため、1時間に1回も全部を読みます。
   * ============================================================ */
  function lastSeenKey(){ return pfx() + 'fs_seen'; }
  function delKey(){ return pfx() + 'fs_del'; }
  /* ★ v21）物件が「消された」ことを知らせる、小さな目印。
     直された物件は updatedAt で分かりますが、消された物件は分かりません。
     そこで、消したときにここへ日時を書いておきます。
     様子見のときにこの1件だけを見て、変わっていたら全部を読み直します。
     読むのが1回増えるだけで、消したことが15分以内に伝わります。 */
  function metaRef(){ return db().collection(INS).doc('data').collection('misc').doc('meta'); }
  function readSince(since){
    if(!since) return readAll('様子見');
    return col().where('updatedAt', '>', since).get().then(function(qs){
      /* ★ v24）クラウドへ届いていません（端末の中の控えから返ってきました）。
           読めなかったのと同じに扱います。ここで区別しないと、
           「0件」を「みんなが消した」と取りちがえます。 */
      if(fromCache(qs)){
        try{ console.warn('[D] クラウドへ届きませんでした（端末の控えから返ってきたので、使いません）'); }catch(e){}
        return null;
      }
      var b = {}, revs = {}, sigs = {};
      qs.forEach(function(doc){
        var d = doc.data() || {}, id = doc.id;
        b[id]    = fromDoc(d);
        revs[id] = d.rev || 0;
        sigs[id] = sig(toDoc(id, b[id]));
      });
      /* 1件も無くても、1回ぶんは数えられます（Firestore の決まりです） */
      use('read', Math.max(qs.size || 0, 1), '直された物件だけ読む');
      var t = newest_(b, qs);
      return { buildings:b, revs:revs, sigs:sigs, partial:true, at:(t || since), cached:fromCache(qs) };
    }).catch(function(e){
      try{ console.warn('[D] 差分を読めませんでした。全部を読み直します', e); }catch(x){}
      return readAll('様子見');
    });
  }
  /* ★★ v24）「クラウドから返ってきた」のか「端末の中の控えから返ってきた」のか
   *
   *  Firebase は、サーバーに届かないとき、エラーにしません。
   *  端末の中に持っている控え（キャッシュ）から、そっと返してきます。
   *  控えが空なら「0件」が、成功として返ります。
   *
   *  ここを見ていなかったので、電波の悪いスマホで
   *  「0件」を「ほかの端末で全部消された」と取りちがえていました。
   *  9/13 に、スマホの契約が全部消えたのは、これです。
   *
   *  metadata.fromCache が true なら、クラウドは確かめられていません。 */
  function fromCache(qs){
    try{ return !!(qs && qs.metadata && qs.metadata.fromCache === true); }catch(e){ return false; }
  }

  function count(o){ var n = 0, k; for(k in (o||{})) if(Object.prototype.hasOwnProperty.call(o,k)) n++; return n; }
  function status(kind, msg){ try{ if(typeof setSyncStatus === 'function') setSyncStatus(kind, msg); }catch(e){} }

  /* ============================================================
   *  読み込み：Firestore の内容に差し替えます
   * ============================================================ */
  var _fsReadOk = null;   /* 直前の読み込みで、クラウドを読めたか（null＝まだ読んでいない） */

  /* ★★ 読み込みの控え（30秒）
   *
   *  ここがいちばん重かったところです。
   *
   *  自動保存（doAutoPush）は、送る前に必ず
   *  「クラウドの件数と手元の件数を見くらべる」ための読み込みをします。
   *  その読み込みが、ここを通ります。
   *  つまり保存のたびに、物件ぜんぶ・契約ぜんぶ・オーナーを読み直していました。
   *
   *  実測すると、物件1件を直して保存するだけで 588回 読んでいました。
   *    契約をぜんぶ読む　　　　　　 300回（100件 × 3）
   *    物件をぜんぶ読む（開いたとき）210回（70件 × 3）
   *    物件をぜんぶ読む（保存のあと） 70回
   *
   *  1日に読めるのは 50,000回です。
   *  588回なら、全員あわせて85回しか保存できません。
   *  これが「夕方4時まで保存できない」の正体です。
   *
   *  保存の前後で、同じ読み込みが3回も走っています。
   *  30秒のあいだは、いちど読んだものを使い回します。
   *  これで 588回 → 190回ほどに下がります。
   *
   *  安全について：
   *    ・保存が通ったときは、控えを捨てて必ず読み直します
   *    ・ぶつかりの見つけかたは、書類1件ずつの版番号で行っています。
   *      ここの控えとは別のしくみなので、弱くなりません。            */
  var _fsCache = null;
  var FS_CACHE_MS = 30000;
  function fsDrop(){ _fsCache = null; }
  try{ window.__pvFsDrop = fsDrop; }catch(e){}
  
  function fsTriple(){
    var now = Date.now();
    if(_fsCache && (now - _fsCache.at) < FS_CACHE_MS){
      try{ console.log('[D] 30秒以内なので、読んだものを使い回します'); }catch(e){}
      return Promise.resolve(_fsCache.v);
    }
    return Promise.all([readAll('画面を開いたとき'), readCts(), readOws()]).then(function(v){
      /* ★ v24）読めなかったものは、使い回しません。
           ここで控えてしまうと、電波が戻っても30秒は
           「読めなかった」まま答えつづけます。                */
      if(v && v[0] && v[1] && v[2]) _fsCache = { at:Date.now(), v:v };
      return v;
    });
  }

  /* ★★ 保存する前の「見くらべ」だけは、クラウドを読まずに答えます
   *
   *  自動保存は、送る前にこう確かめています。
   *    「手元の件数が、クラウドの件数の半分より少なくないか」
   *  古い内容を持った端末が、正しいクラウドを消す事故を防ぐためです。
   *
   *  この確かめのために、物件ぜんぶ・契約ぜんぶを読み直していました。
   *  けれど件数を知るだけなら、読む必要はありません。
   *  この端末は「クラウドにどの書類があるか」の控えを持っています
   *  （版番号と指紋の一覧。読み込みと保存のたびに、必ず更新しています）。
   *  それを数えれば足ります。
   *
   *  守りは弱くなりません。
   *  ぶつかりの見つけかたは、書類1件ずつの版番号で別に行っています。
   *  半分より減る保存を止めるしくみも、そのまま残っています。
   *
   *  控えを一度も作っていない端末のときだけ、ちゃんと読みに行きます。 */
  function preCheck(){
    try{ return (typeof _autoPushInFlight !== 'undefined') && !!_autoPushInFlight; }catch(e){ return false; }
  }
  function onLoadLight(P, url, body, t){
    var bs = readMap(sigKey()), cs = readMap(ctSigK());
    var nb = count(bs), nc = count(cs);
    if(nb < 1) return null;                     /* 控えが無い → ふつうに読みます */
    return Promise.resolve(P(url, body, t)).catch(function(e){
      return { ok:false, message:String(e && e.message || e) };
    }).then(function(r){
      if(!(r && r.ok && r.payload)) return r;
      var b2 = {}, c2 = {}, k;
      for(k in bs){ if(Object.prototype.hasOwnProperty.call(bs, k)) b2[k] = 1; }
      for(k in cs){ if(Object.prototype.hasOwnProperty.call(cs, k)) c2[k] = 1; }
      r.payload.buildings = b2;                 /* 件数を見るためだけの、から箱です */
      if(nc > 0) r.payload.contracts = c2;
      var ob = owBaseRead();
      if(ob && ob.length) r.payload.owners = ob;
      r.__preCheck = true;
      try{ console.log('[D] 保存前の見くらべは、控えで済ませました（物件 ' + nb + ' / 契約 ' + nc + '）'); }catch(e){}
      return r;
    });
  }

  function onLoad(P, url, body, t){
    if(preCheck()){
      var lite = onLoadLight(P, url, body, t);
      if(lite) return lite;
    }
    var gas = Promise.resolve(P(url, body, t)).catch(function(e){ return { ok:false, message:String(e && e.message || e) }; });
    return Promise.all([gas, fsTriple()]).then(function(a){
      var r = a[0], fs = a[1][0], cts = a[1][1], ows = a[1][2];
      _fsReadOk = !!(fs && count(fs.buildings) > 0);
      /* ★ v25）「読めたか」と「中身があったか」は、別のことです。
           　　fs === null   → クラウドへ届かなかった（守りが要ります）
           　　fs があって0件 → 移行前。控えの表が正しい置き場です      */
      var _fsReach = !!fs;

      /* ★★ v25）クラウドへ届かなかったときは、手元を1件も置き換えません
       *
       *  PIVOTロゴをタップすると forcePullLatest が動きます。
       *  あれは、届いた中身で手元をまるごと置き換えます。
       *  core.js の、ほかの3か所には守りが入っていますが、
       *  ロゴの1か所（core.js 824行目）だけ、素のままでした。
       *
       *  クラウドを確かめられていないとき、届くのは控えの表の中身です。
       *  控えは、クラウドに保存できたあとに送っています。
       *  途中で通信がこけると、控えだけが古いまま残ります。
       *  その古い控えで、手元の新しい内容を置き換えていました。
       *
       *  減り方が半分より小さいときだけ守っていたので、
       *  20件が12件になるような減り方は、すり抜けていました。
       *
       *  確かめられていないなら、置き換えません。1件でも減らしません。
       *  届いた中身を、手元の中身にそのまま差し替えて返します。
       *  こうすると、ロゴをタップしても何も変わりません。それが正しい。 */
      if(!_fsReach && r && r.ok && r.payload){
        try{
          var kb0 = {}, kc0 = {}, ko0 = null;
          try{ kb0 = (typeof pbLoadAll === 'function') ? (pbLoadAll() || {}) : {}; }catch(e){ kb0 = {}; }
          try{ kc0 = readRaw(myCtKey(), {}) || {}; }catch(e){ kc0 = {}; }
          try{ ko0 = readRaw(myOwKey(), null); }catch(e){ ko0 = null; }
          if(count(kb0) > 0) r.payload.buildings = kb0;
          if(count(kc0) > 0) r.payload.contracts = kc0;
          if(Array.isArray(ko0) && ko0.length) r.payload.owners = ko0;
          status('error', '⚠️ クラウドを確かめられないので、取り込みを見送りました');
          try{ console.warn('[D] クラウドへ届かないので、手元をそのまま残しました（物件' +
                            count(kb0) + '件 / 契約' + count(kc0) + '件）'); }catch(x){}
          try{ if(window.__pvUnsent && window.__pvUnsent.mark) window.__pvUnsent.mark('net'); }catch(x){}
        }catch(e){}
        return r;                       /* このあとの取りこみも、いっさいしません */
      }

      /* ★★ クラウドが読めなかったときの守り
       *
       *  このあと画面は、届いた中身で手元を丸ごと置き換えます。
       *  クラウド（Firestore）が読めていないと、届くのは
       *  控えのスプレッドシートの中身です。
       *
       *  控えは、クラウドに保存できたあとに送っています。
       *  途中で通信がこけると、控えだけが古いまま残ります。
       *  その状態で「最新を取り込む」を押すと、
       *  古い控えの中身で、手元の新しい内容が消えます。
       *
       *  実際に起きる筋道：
       *    ・1日の読み書き回数を使い切った（夕方4時まで）
       *    ・一瞬だけ通信がこけた
       *  このどちらかのあと、PIVOTロゴをタップすると起きます。
       *
       *  大きく減って届いたときは、この端末の内容をそのまま使います。 */
      if(!_fsReadOk && r && r.ok && r.payload){
        try{
          var kept0 = '';
          var lb = {};
          try{ lb = (typeof pbLoadAll === 'function') ? (pbLoadAll() || {}) : {}; }catch(e){ lb = {}; }
          var ln  = count(lb);
          var inB = (r.payload.buildings && typeof r.payload.buildings === 'object') ? count(r.payload.buildings) : -1;
          if(ln >= 3 && inB >= 0 && inB < ln * 0.5){
            r.payload.buildings = lb;
            kept0 += '　物件　　： 届いた ' + inB + ' 件 → この端末の ' + ln + ' 件を使いました\n';
          }
          var mc = {};
          try{ mc = JSON.parse(localStorage.getItem(ctLS()) || '{}') || {}; }catch(e){ mc = {}; }
          var lnc = count(mc);
          var inC = (r.payload.contracts && typeof r.payload.contracts === 'object') ? count(r.payload.contracts) : -1;
          if(lnc >= 3 && inC >= 0 && inC < lnc * 0.5){
            r.payload.contracts = mc;
            kept0 += '　契約　　： 届いた ' + inC + ' 件 → この端末の ' + lnc + ' 件を使いました\n';
          }
          var mo = owBaseRead() || [];
          var inO = Array.isArray(r.payload.owners) ? r.payload.owners.length : -1;
          if(mo.length >= 3 && inO >= 0 && inO < mo.length * 0.5){
            r.payload.owners = mo;
            kept0 += '　オーナー： 届いた ' + inO + ' 件 → この端末の ' + mo.length + ' 件を使いました\n';
          }
          if(kept0){
            status('error', '⚠️ クラウドを読めませんでした（この端末の内容を残しました）');
            try{ console.warn('[D] クラウドが読めず、届いた中身が少ないため、手元を残しました\n' + kept0); }catch(x){}
          }
        }catch(e){}
      }

      if(!fs) return r;                                   /* Firestore が読めない → 従来どおり */
      var n = count(fs.buildings);
      if(n === 0) return r;                               /* 移行前 → 従来どおり */
      if(!(r && r.ok && r.payload)) return r;             /* スプレッドシート側が失敗 → 触らない
                                                             （契約・オーナーが空で返って消えるのを防ぐ） */
      var localN = 0;
      try{ localN = count((typeof pbLoadAll === 'function') ? pbLoadAll() : {}); }catch(e){}
      if(localN >= 3 && n < localN * 0.5){                /* 安全装置：極端に少ない → 差し替えない */
        status('error', '⚠️ 安全のため取り込みを止めました');
        try{ console.warn('[D] Firestore の物件が手元より大幅に少ないため差し替えを中止 ' + n + ' < ' + localN); }catch(e){}
        return r;
      }
      var ad = adoptBlds(fs);
      r.payload.buildings = ad.out;
      r.buildingCount     = count(ad.out);
      _loaded = true;

      /* 版番号・指紋の控えを、いま決めた中身にそろえます。
         （そろえておかないと、次の保存で「全部が変わった」と誤解します） */
      writeMap(revKey(), ad.revs);
      writeMap(sigKey(), ad.sigs);
      fprWriteAll(ad.fprs);        /* ★ 部品ごとの指紋も、そろえます */

      /* ★★ ここで、手元にも同じ中身を書きます。
       *
       *  これまでは、手元に書くのを呼び出し元にまかせていました。
       *  ところが呼び出し元は3種類あり、そのうち2つは書きません。
       *    ・画面を開いたとき（core.js）　　　→ 書きます
       *    ・保存する前の確かめ（core.js）　　→ 書きません
       *    ・保存する前の確かめ（uifix.js）　 → 書きません
       *
       *  書かないほうが走ると、控えだけがクラウドの中身になり、
       *  手元は古いまま、という食い違いが残ります。
       *  そのあとの保存で、古い内容が送り返されていました。
       *  「触っていない物件が、ほかの人の直す前に戻る」のは、これです。
       *
       *  ad.out は、まだ送っていない手元の直しを残したうえで
       *  決めた中身です。ここで書いておけば、
       *  どの呼び出し元から来ても、控えと手元が必ずそろいます。      */
      try{ if(typeof pbSaveRaw === 'function') pbSaveRaw(ad.out); }catch(e){}
      /* ★ どこまで読んだかの目印も、ここで控えます。
           これが無いと、このあとの読み直しが毎回「ぜんぶ読む」になります。
           これまでは、様子見の読み直しのときだけ控えていました。 */
      try{ if(fs.at) localStorage.setItem(lastSeenKey(), fs.at); }catch(e){}

      /* ㊸ 契約・オーナーも Firestore を正にします */
      var after = [];
      try{
        var inCt = (r.payload.contracts && typeof r.payload.contracts === 'object') ? count(r.payload.contracts) : 0;
        if(cts){
          var cn = count(cts.map);
          if(cn === 0 && inCt >= 3){
            after.push(seedCts(r.payload.contracts).then(function(okk){
              if(!okk) return;
              return readCts().then(function(c2){
                if(c2){ writeMap(ctRevK(), c2.revs); writeMap(ctSigK(), c2.sigs); }
              });
            }));
          }else if(cn > 0){
            if(inCt >= 3 && cn < inCt * 0.5){
              status('error', '⚠️ 契約が少なかったので取り込みを止めました');
              try{ console.warn('[E] Firestore の契約が少ないため差し替え中止 ' + cn + ' < ' + inCt); }catch(e){}
            }else{
              var adc = adoptCts(cts);
              r.payload.contracts = adc.out;
              writeMap(ctRevK(), adc.revs); writeMap(ctSigK(), adc.sigs);
              /* ★ 物件と同じ理由で、手元にも書きます。
                   呼び出し元が書かない道（保存前の確かめ）があるためです。 */
              try{ localStorage.setItem(ctLS(), JSON.stringify(adc.out)); }catch(e){}
              try{ console.log('[E] 読み込み：Firestore から契約 ' + cn + ' 件'); }catch(e){}
            }
          }
        }
        var inOw = Array.isArray(r.payload.owners) ? r.payload.owners.length : 0;
        if(ows){
          if(!ows.list && inOw >= 3){
            after.push(seedOws(r.payload.owners).then(function(okk){
              if(okk){ writeMap(owRevK(), { rev:1, sig:sig(r.payload.owners) });
                       owBaseWrite(r.payload.owners); }
            }));
          }else if(ows.list && ows.list.length){
            if(inOw >= 3 && ows.list.length < inOw * 0.5){
              status('error', '⚠️ オーナーが少なかったので取り込みを止めました');
            }else{
              r.payload.owners = ows.list;
              writeMap(owRevK(), { rev:ows.rev, sig:sig(ows.list) });
              owBaseWrite(ows.list);
              try{ console.log('[E] 読み込み：Firestore からオーナー ' + ows.list.length + ' 件'); }catch(e){}
            }
          }
        }
      }catch(e){}

      /* ★ 読み込み側の守り。
         通信が一瞬こけて「契約0件」が返ってくることがあります。
         そのまま取り込むと、この端末の契約表示が全部消えます
         （クラウドは保存側で守っていますが、画面が空になるのは困ります）。
         大きく減って届いたときは、この端末の内容をそのまま使います。 */
      try{
        var lastN = readMap(ctKey2());
        var inCt  = (r.payload.contracts && typeof r.payload.contracts === 'object') ? count(r.payload.contracts) : -1;
        var inOw  = Array.isArray(r.payload.owners) ? r.payload.owners.length : -1;
        var kept  = '';
        if(lastN.ct >= 3 && inCt >= 0 && inCt < lastN.ct * 0.5){
          var mine = readRaw(myCtKey(), null);
          if(mine && typeof mine === 'object' && count(mine) > inCt){
            r.payload.contracts = mine;
            kept += '　契約　　： 届いた ' + inCt + ' 件 → この端末の ' + count(mine) + ' 件を使いました\n';
          }
        }
        if(lastN.ow >= 3 && inOw >= 0 && inOw < lastN.ow * 0.5){
          var mo = readRaw(myOwKey(), null);
          if(Array.isArray(mo) && mo.length > inOw){
            r.payload.owners = mo;
            kept += '　オーナー： 届いた ' + inOw + ' 件 → この端末の ' + mo.length + ' 件を使いました\n';
          }
        }
        if(kept){
          status('error', '⚠️ 届いた契約が少なかったので、この端末の内容を残しました');
          try{ console.warn('[D] 少ない契約／オーナーが届いたので取り込みを見送りました\n' + kept); }catch(e){}
        }
      }catch(e){}

      try{
        var pc = r.payload.contracts, po = r.payload.owners;
        var nc = (pc && typeof pc === 'object') ? count(pc) : -1;
        var no = Array.isArray(po) ? po.length : -1;
        if(nc >= 0 || no >= 0) writeMap(ctKey2(), { ct:nc, ow:no, at:Date.now() });
      }catch(e){}
      /* uifix.js の「両方を残す」合体を止めます。
         あれは消したものを足し戻すので、わざと消した区画が復活します。 */
      try{ window.__fsPrimary = true; }catch(e){}
      writeMap(revKey(), ad.revs);
      writeMap(sigKey(), ad.sigs);
      fprWriteAll(ad.fprs);
      try{ console.log('[D] 読み込み：Firestore から物件 ' + n + ' 件'); }catch(e){}
      if(after.length) return Promise.all(after).then(function(){ return r; }).catch(function(){ return r; });
      return r;
    });
  }

  /* ============================================================
   *  保存：変わった物件だけ。先を越されていたら止めます
   * ============================================================ */
  /* ★★ v27）中身が空になった書類を、送らないようにします
   *
   *  区画1つずつ送る形（v22）にしてから、こういう消え方ができました。
   *
   *    手元の物件が「名前も住所も区画も無い」状態になる
   *      → 送るときに「クラウドにあるものは、ぜんぶ消す」と判定される
   *      → 書類は残るが、中身だけが消える
   *      → 件数は減らないので、これまでの安全装置は反応しない
   *
   *  実際に、物件67件の中身がこうなりました（2026/09/13）。
   *  件数を見る守りでは、ぜったいに気づけません。中身を見ます。      */
  function bodyOf(d){
    try{
      if(String((d && d.name) || '').trim()) return true;
      if(String((d && d.addr) || '').trim()) return true;
      var k, sp = (d && d.spots) || {};
      for(k in sp){ if(Object.prototype.hasOwnProperty.call(sp, k)) return true; }
      return false;
    }catch(e){ return true; }        /* 見分けられないときは、ふつうに扱います */
  }

  function plan(buildings){
    var revs = readMap(revKey()), sigs = readMap(sigKey()), fprs = fprRead();
    var changed = [], removed = [], hollow = [], id, d, s;
    for(id in buildings){
      if(!Object.prototype.hasOwnProperty.call(buildings, id)) continue;
      d = toDoc(id, buildings[id]);
      s = sig(d);
      if(sigs[id] === s) continue;                    /* 変わっていません */
      /* ★ v27）中身が空になった物件は、送りません。
           送ると、クラウドの名前・住所・区画がぜんぶ消えます。
           前にクラウドで見たことがある物件だけ、守ります
           （はじめて作った空の物件は、これまでどおり通します）。 */
      if(revs[id] !== undefined && !bodyOf(d)){
        hollow.push(id);
        continue;
      }
      /* ★ この端末が変えた部品だけを挙げます（区画1つずつ） */
      var nowF = fprOf(d);
      changed.push({ id:id, doc:d, sig:s, base:(revs[id] || 0), name:(d.name || id),
                     fpr:nowF, diff:fprDiff(nowF, fprs[id]),
                     isNew:(revs[id] === undefined) });
    }
    for(id in revs){
      if(!Object.prototype.hasOwnProperty.call(revs, id)) continue;
      if(!Object.prototype.hasOwnProperty.call(buildings, id)) removed.push({ id:id, base:(revs[id] || 0), name:id });
    }
    /* ★★ ここが、いちばん気づけない不具合でした。
     *
     *  これまでは、手元の物件が「前に控えた数」の半分より少ないとき、
     *  消す判断をせずに、黙って消さないまま返していました。
     *
     *    30件のうち20件を消して保存する
     *      → 10件 < 15件 なので、消す判断を見送り
     *      → 画面には「✅ 同期済み」と出る
     *      → でも1件も消えていない
     *
     *  何も言わずに終わるので、消えていないことに気づけません。
     *  保存できたと思って、その日の作業を終えてしまいます。
     *
     *  これからは、黙って見送りません。
     *  そういう形のときは印をつけて返し、人に確かめます。
     *  「キャンセル」を選んでも、直したぶんはちゃんと保存します。 */
    var known = count(revs), here = count(buildings);
    var few = (known >= 3 && here < known * 0.5);
    if(few){ try{ console.warn('[D] 手元の物件が少ないので、消す前に確かめます ' + here + ' < ' + known); }catch(e){} }
    if(hollow.length){
      try{ console.warn('[D] 中身が空になった物件 ' + hollow.length + ' 件は送りませんでした', hollow); }catch(e){}
    }
    return { changed:changed, removed:removed, few:few, hollow:hollow };
  }

  /* 版番号の控えが無いまま保存すると、全物件が衝突扱いになってしまいます。
     そうならないよう、先に Firestore を読んで土台を作ります。 */
  function ensureBase(){
    if(count(readMap(revKey())) > 0) return Promise.resolve(true);
    return readAll('版番号の土台づくり').then(function(fs){
      if(!fs) return false;
      writeMap(revKey(), fs.revs);
      writeMap(sigKey(), fs.sigs);
      try{ console.log('[D] 版番号の土台を作りました（' + count(fs.revs) + ' 件）'); }catch(e){}
      return true;
    });
  }

  /* ★ 控えの取りこみ。
       「手元＝クラウド」のものだけ、控えを最新にそろえます。
       食い違うものは、前の控えを残します。そうしておけば
         ・この端末で直していないもの　→ 直していないと分かる（送りません）
         ・この端末で直したもの　　　　→ 版番号がずれているので、ぶつかりになります
       どちらも、黙って上書きするより安全です。                        */
  function mergeBase(fs, mine){
    try{
      var revs = readMap(revKey()), sigs = readMap(sigKey()), fprs = fprRead(), id, mySig;
      var has = function(o, k){ return o && Object.prototype.hasOwnProperty.call(o, k); };
      for(id in fs.sigs){
        if(!has(fs.sigs, id)) continue;
        if(has(mine, id) && sigs[id] !== undefined){
          try{ mySig = sig(toDoc(id, mine[id])); }catch(e){ continue; }
          if(mySig !== fs.sigs[id]) continue;        /* 手元と食い違う → 前の控えを残します */
        }
        revs[id] = fs.revs[id];
        sigs[id] = fs.sigs[id];
        try{ fprs[id] = fprOf(toDoc(id, fs.buildings[id])); }catch(e){}
      }
      writeMap(revKey(), revs);
      writeMap(sigKey(), sigs);
      fprWriteAll(fprs);
    }catch(e){}
  }

  /* ★★ 読み込んだ物件の、取りこみ方
   *
   *  これまでは、届いたクラウドの中身で、手元をまるごと置き換えていました。
   *  そして「クラウドにどの書類があるか」の控えも、まるごと書き替えていました。
   *
   *  これが事故のもとでした。
   *
   *    ・保存する前に、クラウドの件数を確かめる読み込みが走ります
   *      （core.js と uifix.js の2か所から、保存のたびに走ります）
   *    ・その読み込みが、控えだけをクラウドの中身に書き替えます
   *    ・手元は古いままなので、ほかの人が直した物件が
   *      「この端末が直したもの」に見えます
   *    ・そのあとの保存で、古い内容を送り返してしまいます
   *
   *  結果、触っていない物件が、ほかの人の直す前の内容に戻っていました。
   *
   *  これからは、物件1つずつ、こう決めます。
   *
   *    ・手元が、前に控えた内容と同じ　→ 触っていない　→ クラウドを採る
   *    ・手元が、前に控えた内容とちがう→ この端末で直した→ 手元を残す
   *    ・クラウドに無い
   *        前に控えてあった　→ ほかの端末で消された　→ 足し戻さない
   *        一度も控えていない→ まだ送っていない新しい物件→ 残す
   *
   *  控えも、それに合わせて決めます。
   *  手元を残したものは、前の控えのままにします。そうしておけば
   *  次の保存で「この端末の直し」として、正しく送られます。          */
  function adoptBlds(fs){
    var mine = {};
    try{ mine = (typeof pbLoadAll === 'function') ? (pbLoadAll() || {}) : {}; }catch(e){ mine = {}; }
    if(!mine || typeof mine !== 'object') mine = {};
    var oldR = readMap(revKey()), oldS = readMap(sigKey()), oldF = fprRead();
    var out = {}, revs = {}, sigs = {}, fprs = {}, id, mySig, kept = 0;
    var has = function(o, k){ return o && Object.prototype.hasOwnProperty.call(o, k); };

    for(id in fs.buildings){
      if(!has(fs.buildings, id)) continue;
      if(has(mine, id) && oldS[id] !== undefined){
        mySig = null;
        try{ mySig = sig(toDoc(id, mine[id])); }catch(e){ mySig = null; }
        if(mySig !== null && mySig !== oldS[id]){
          out[id]  = mine[id];                 /* まだ送っていない直し → 残します */
          revs[id] = oldR[id];
          sigs[id] = oldS[id];
          if(oldF[id]) fprs[id] = oldF[id];
          kept++;
          continue;
        }
      }
      out[id]  = fs.buildings[id];
      revs[id] = fs.revs[id];
      sigs[id] = fs.sigs[id];
      try{ fprs[id] = fprOf(toDoc(id, fs.buildings[id])); }catch(e){}
    }
    for(id in mine){
      if(!has(mine, id) || has(out, id)) continue;
      if(oldS[id] !== undefined) continue;     /* 前はクラウドにあった → 消されたので足しません */
      out[id] = mine[id];                      /* 一度も送っていない、新しい物件 */
      kept++;
    }
    if(kept){ try{ console.log('[D] まだ送っていない直し ' + kept + ' 件は、手元を残しました'); }catch(e){} }
    return { out:out, revs:revs, sigs:sigs, fprs:fprs, kept:kept };
  }

  /* 契約も、物件とまったく同じ考え方で取りこみます */
  function adoptCts(cs){
    var mine = {};
    try{ mine = JSON.parse(localStorage.getItem(ctLS()) || '{}') || {}; }catch(e){ mine = {}; }
    if(!mine || typeof mine !== 'object') mine = {};
    var oldR = readMap(ctRevK()), oldS = readMap(ctSigK());
    var out = {}, revs = {}, sigs = {}, id, mySig, kept = 0;
    var has = function(o, k){ return o && Object.prototype.hasOwnProperty.call(o, k); };

    for(id in cs.map){
      if(!has(cs.map, id)) continue;
      if(has(mine, id) && oldS[id] !== undefined){
        mySig = null;
        try{ mySig = sig(ctDoc(id, mine[id])); }catch(e){ mySig = null; }
        if(mySig !== null && mySig !== oldS[id]){
          out[id]  = mine[id];
          revs[id] = oldR[id];
          sigs[id] = oldS[id];
          kept++;
          continue;
        }
      }
      out[id]  = cs.map[id];
      revs[id] = cs.revs[id];
      sigs[id] = cs.sigs[id];
    }
    for(id in mine){
      if(!has(mine, id) || has(out, id)) continue;
      if(oldS[id] !== undefined) continue;     /* 前はクラウドにあった → 消されたので足しません */
      out[id] = mine[id];                      /* 一度も送っていない、新しい契約 */
      kept++;
    }
    if(kept){ try{ console.log('[E] まだ送っていない契約の直し ' + kept + ' 件は、手元を残しました'); }catch(e){} }
    return { out:out, revs:revs, sigs:sigs, kept:kept };
  }

  function commit(pl){
    return db().runTransaction(function(tx){
      var jobs = [], i, c, r;
      for(i = 0; i < pl.changed.length; i++){
        c = pl.changed[i];
        jobs.push({ kind:'set', id:c.id, name:c.name, base:c.base, doc:c.doc, sig:c.sig,
                    fpr:c.fpr, diff:c.diff, isNew:c.isNew, ref:col().doc(c.id) });
      }
      for(i = 0; i < pl.removed.length; i++){
        r = pl.removed[i];
        jobs.push({ kind:'del', id:r.id, name:r.name, base:r.base, ref:col().doc(r.id) });
      }
      var gets = [];
      for(i = 0; i < jobs.length; i++) gets.push(tx.get(jobs[i].ref));
      return Promise.all(gets).then(function(snaps){
        var bad = [], j, cur, d;
        var fprs0 = fprRead();
        for(j = 0; j < jobs.length; j++){
          jobs[j].prev = snaps[j].exists ? (snaps[j].data() || null) : null;   /* 履歴・ごみ箱用 */
          cur = snaps[j].exists ? ((snaps[j].data() || {}).rev || 0) : 0;

          /* ★★ 物件をまるごと消すときは、これまでどおり版番号を見ます。
                 だれかが直した直後に消すのは、確かめたいからです。      */
          if(jobs[j].kind === 'del'){
            if(cur !== jobs[j].base){
              bad.push({ kind:'b', id:jobs[j].id, name:jobs[j].name,
                         by:(snaps[j].exists ? ((snaps[j].data() || {}).updatedBy || '') : '') });
            }
            continue;
          }

          /* ★★ 直すときは、版番号ぜんたいでは見ません。
           *
           *  これまでは、物件の版番号が1つでもずれていたら
           *  ぶつかりにしていました。だから、AさんとBさんが
           *  同じ物件の「べつの区画」を触っただけで止まりました。
           *
           *  これからは、部品ごとに見ます。
           *  ぶつかりにするのは「まったく同じ部品を、同時に2人が
           *  変えたとき」だけです。                                   */
          if(!snaps[j].exists || jobs[j].isNew || !jobs[j].diff){
            jobs[j].whole = true;                       /* 新しい物件 → まるごと入れます */
            continue;
          }
          var cloudF = fprOfCloud(jobs[j].id, snaps[j].data());
          var baseF  = fprs0[jobs[j].id] || {};
          var mineD  = jobs[j].diff;
          var okSet = [], okDel = [], hit = [], kk, t;
          for(t = 0; t < mineD.set.length; t++){
            kk = mineD.set[t];
            if(cloudF[kk] !== baseF[kk]){ hit.push(kk); continue; }   /* 相手も同じ部品を変えました */
            okSet.push(kk);
          }
          for(t = 0; t < mineD.del.length; t++){
            kk = mineD.del[t];
            if(cloudF[kk] !== baseF[kk]){ hit.push(kk); continue; }
            okDel.push(kk);
          }
          jobs[j].okSet = okSet;
          jobs[j].okDel = okDel;
          jobs[j].rev0  = cur;
          if(hit.length){
            bad.push({ kind:'b', id:jobs[j].id,
                       name:jobs[j].name + '（' + hit.map(function(x){
                         return x.indexOf('s:') === 0 ? (x.slice(2) + '番区画') : x.slice(2); }).join('、') + '）',
                       by:(snaps[j].exists ? ((snaps[j].data() || {}).updatedBy || '') : '') });
          }
          if(!okSet.length && !okDel.length) jobs[j].skip = true;   /* 送るものがありません */
        }
        /* ★★ ぶつかった1件のせいで、ほかのぜんぶが保存できなくなっていました。
         *
         *   物件Aだけ版番号がずれていると、同時に直した物件Bも
         *   いっしょに止まり、Bの入力はクラウドへ届きませんでした。
         *   画面には「他の人が先に保存しました」と出るだけなので、
         *   Bが保存できていないことに気づけません。
         *
         *   これからは、ぶつかった書類だけを止めます。
         *   ぶつかった中身は上書きしないので、守りは変わりません。
         *   ぶつかったことは、これまでどおりお知らせします。          */
        var okJobs = jobs, bj;
        if(bad.length){
          okJobs = [];
          for(bj = 0; bj < jobs.length; bj++){
            cur = snaps[bj].exists ? ((snaps[bj].data() || {}).rev || 0) : 0;
            if(cur === jobs[bj].base) okJobs.push(jobs[bj]);
          }
          if(!okJobs.length){
            var e0 = new Error('conflict'); e0.__conflict = bad; throw e0;
          }
          try{ console.warn('[D] ぶつかった ' + bad.length + ' 件は止め、残り ' +
                            okJobs.length + ' 件は保存します'); }catch(x){}
        }
        jobs = okJobs;
        use('read', jobs.length, '保存のときの確かめ');
        var delN = 0;
        for(j = 0; j < jobs.length; j++){ if(jobs[j].kind === 'del') delN++; }
        if(delN){
          /* ★ v21）消したことを、ほかの端末へ知らせます。
             消された物件は「直された物件だけを読む」やり方では見つからないためです。 */
          tx.set(metaRef(), { delAt:new Date().toISOString(), delBy:(me() || '(名前なし)') },
                 { merge:true });
          use('write', 1, '消したことの目印');
        }
        var wrote = 0;
        for(j = 0; j < jobs.length; j++){
          if(jobs[j].kind === 'del'){ tx.delete(jobs[j].ref); wrote++; continue; }
          if(jobs[j].skip) continue;
          d = jobs[j].doc;
          if(jobs[j].whole){
            /* 新しい物件は、まるごと入れます */
            d.rev       = (jobs[j].base || 0) + 1;
            d.updatedAt = new Date().toISOString();
            d.updatedBy = me() || '(名前なし)';
            tx.set(jobs[j].ref, d);
            wrote++;
            continue;
          }
          /* ★ 変わった部品だけを送ります */
          var patch = {}, t2, kk2;
          for(t2 = 0; t2 < jobs[j].okSet.length; t2++){
            kk2 = jobs[j].okSet[t2];
            patch[fprPath(kk2)] = fprValue(d, kk2);
          }
          for(t2 = 0; t2 < jobs[j].okDel.length; t2++){
            kk2 = jobs[j].okDel[t2];
            patch[fprPath(kk2)] = DEL();
          }
          patch.rev       = (jobs[j].rev0 || 0) + 1;
          patch.updatedAt = new Date().toISOString();
          patch.updatedBy = me() || '(名前なし)';
          tx.update(jobs[j].ref, patch);
          wrote++;
          try{ console.log('[D] ' + jobs[j].name + '：' +
                (jobs[j].okSet.length + jobs[j].okDel.length) + ' 部品だけ送りました'); }catch(e){}
        }
        use('write', Math.max(wrote, 1), '物件の保存');
        if(bad.length){ try{ jobs.__conflict = bad; }catch(x){} }
        return jobs;
      });
    });
  }

  /* ★★ ぶつかったあとの、かたづけ
   *
   *  【これまで】
   *    「ほかの人が先に保存しました。開き直して、もう一度入力してください」
   *    と出して、画面を開き直すだけでした。
   *
   *    ところが、開き直しても直りません。
   *    この端末の入力は残す作りなので、版番号の控えも古いままです。
   *    もう一度保存すると、また同じところでぶつかります。
   *    その物件は、二度と保存できなくなっていました。
   *
   *  【これから】
   *    どちらにするか選んでいただきます。ぶつかりは、
   *    どちらかを捨てないと終わりません。何を捨てるかを、はっきり書きます。
   *
   *      ［OK］　　　 この端末の内容で上書きする
   *      ［キャンセル］相手の内容に合わせる（この端末の入力は消えます）
   *
   *    選んだとおりに、その場でかたづけます。開き直す必要はありません。   */
  function conflictFix(bad, mine){
    var jobs = [], i;
    for(i = 0; i < bad.length; i++){
      if(!bad[i] || !bad[i].id) continue;
      jobs.push({ kind:(bad[i].kind === 'c' ? 'c' : 'b'), id:bad[i].id,
                  ref:(bad[i].kind === 'c' ? ctCol() : col()).doc(bad[i].id) });
    }
    if(!jobs.length) return Promise.resolve(false);
    var gets = [], k;
    for(k = 0; k < jobs.length; k++) gets.push(jobs[k].ref.get());
    return Promise.all(gets).then(function(snaps){
      use('read', jobs.length, 'ぶつかりのかたづけ');
      var bR = readMap(revKey()),  bS = readMap(sigKey()), bF = fprRead();
      var cR = readMap(ctRevK()),  cS = readMap(ctSigK());
      var blds = null, cts = null, j, d, id;
      if(!mine){
        try{ blds = (typeof pbLoadAll === 'function') ? (pbLoadAll() || {}) : null; }catch(e){ blds = null; }
        try{ cts  = JSON.parse(localStorage.getItem(ctLS()) || '{}') || null; }catch(e){ cts = null; }
      }
      for(j = 0; j < jobs.length; j++){
        id = jobs[j].id;
        d  = snaps[j].exists ? (snaps[j].data() || {}) : null;
        if(jobs[j].kind === 'c'){
          if(mine){ cR[id] = d ? (d.rev || 0) : 0; }          /* 版番号だけ合わせて、手元を送ります */
          else if(cts){                                        /* 相手に合わせます */
            if(d){ cts[id] = ctFrom(d); cR[id] = d.rev || 0; cS[id] = sig(ctDoc(id, cts[id])); }
            else { delete cts[id]; delete cR[id]; delete cS[id]; }
          }
        }else{
          if(mine){ bR[id] = d ? (d.rev || 0) : 0; if(d) bF[id] = fprOfCloud(id, d); }
          else if(blds){
            if(d){ blds[id] = fromDoc(d); bR[id] = d.rev || 0; bS[id] = sig(toDoc(id, blds[id]));
                   bF[id] = fprOfCloud(id, d); }
            else { delete blds[id]; delete bR[id]; delete bS[id]; delete bF[id]; }
          }
        }
      }
      writeMap(revKey(), bR); writeMap(sigKey(), bS); fprWriteAll(bF);
      writeMap(ctRevK(), cR); writeMap(ctSigK(), cS);
      if(!mine){
        try{ if(blds && typeof pbSaveRaw === 'function') pbSaveRaw(blds); }catch(e){}
        try{ if(cts) localStorage.setItem(ctLS(), JSON.stringify(cts)); }catch(e){}
        try{ if(typeof requestRender === 'function') requestRender('buildings'); }catch(e){}
      }
      try{ console.log('[D] ぶつかりを ' + (mine ? 'この端末の内容' : '相手の内容') + ' でかたづけました'); }catch(e){}
      return true;
    }).catch(function(e){
      try{ console.warn('[D] ぶつかりのかたづけに失敗しました', e); }catch(x){}
      return false;
    });
  }

  function tellConflict(bad){
    var names = [], i;
    for(i = 0; i < bad.length && i < 5; i++) names.push('・' + bad[i].name + (bad[i].by ? '（' + bad[i].by + 'さんが保存）' : ''));
    status('error', '⚠️ 他の人が先に保存しました');
    var msg = 'ほかの人が先に保存したため、この内容は保存できませんでした。\n\n' +
              names.join('\n') + (bad.length > 5 ? '\n・ほか ' + (bad.length - 5) + ' 件' : '') + '\n\n' +
              'どちらかを選んでください。\n\n' +
              '［OK］　　　 この端末の内容で上書きする\n' +
              '　　　　　　 （上に出ている相手の変更は、消えます）\n\n' +
              '［キャンセル］相手の内容に合わせる\n' +
              '　　　　　　 （この端末で入れた内容は、消えます）';
    var mine = false;
    try{ mine = window.confirm(msg); }catch(e){ mine = false; }
    conflictFix(bad, mine).then(function(okk){
      if(!okk){
        status('error', '⚠️ かたづけに失敗しました。開き直してください');
        return;
      }
      if(mine){
        status('saving', '⏳ この端末の内容で保存し直します');
        try{ if(typeof window.__pushNow === 'function') setTimeout(window.__pushNow, 400); }catch(e){}
      }else{
        status('saved', '✅ 相手の内容に合わせました');
        try{ if(typeof window.__pvUnsent === 'object') window.__pvUnsent.clear(); }catch(e){}
      }
    });
  }

  function spotCount(bm){
    var n = 0, id, s;
    for(id in (bm || {})){
      if(!Object.prototype.hasOwnProperty.call(bm, id)) continue;
      s = bm[id] && bm[id].spots;
      n += Array.isArray(s) ? s.length : count(s);
    }
    return n;
  }

  /* 契約・オーナーが激減する保存を止めます。
     物件・区画は版番号で守っていますが、契約とオーナーは素通しでした。
     契約を持っていない端末が保存すると、クラウドの契約が全部消えます
     （9/5 に実際に起きました）。 */
  function keepsContracts(body){
    var last = readMap(ctKey2());
    var pay  = (body && body.payload) || {};
    var nc = (pay.contracts && typeof pay.contracts === 'object') ? count(pay.contracts) : -1;
    var no = Array.isArray(pay.owners) ? pay.owners.length : -1;
    var msg = '';
    if(last.ct >= 3 && nc >= 0 && nc < last.ct * 0.5) msg += '　契約　　： ' + last.ct + ' 件 → ' + nc + ' 件\n';
    if(last.ow >= 3 && no >= 0 && no < last.ow * 0.5) msg += '　オーナー： ' + last.ow + ' 件 → ' + no + ' 件\n';
    if(!msg) return '';
    return msg;
  }

  /* ★★ クラウドが確かめられないときは、古い経路へ逃げません
   *
   *  これまでは、Firestore が読めない・つまずいた、というときに
   *  「では従来どおり（スプレッドシートへ直接）」と流していました。
   *
   *  そこが、古い内容で上書きする最後の抜け道でした。
   *  クラウドを確かめられていないのに送ると、
   *  どちらが新しいか分からないまま書き込むことになります。
   *
   *  これからは送りません。
   *  送れなかったことは画面左下の赤い札に出て、
   *  つながったら自動で送り直します。入力は消えません。          */
  function noEscape(why){
    try{ console.warn('[D] クラウドを確かめられないので、送信を見送りました（' + why + '）'); }catch(e){}
    status('error', '⚠️ 確認できないので保存を見送りました');
    try{ if(window.__pvUnsent && window.__pvUnsent.mark) window.__pvUnsent.mark('net'); }catch(e){}
    return Promise.resolve({ ok:false, error:'no-verify', message:'クラウドを確かめられないので保存しませんでした' });
  }

  /* ★★ v23）save 以外の「書き込み」も、確かめてから通します
   *
   *  saveBuildings ／ saveContractsOnly ／ saveOwnersOnly は、
   *  控えのスプレッドシートを丸ごと作り直す用事です。
   *  ここは、これまで素通しでした。
   *
   *  つまり、クラウド（Firestore）にまだ入っていない中身でも、
   *  控えの表だけが先に書き替わります。
   *  たとえば契約を1件消したとき、クラウドではまだ消えていないのに、
   *  控えの表からは、もう行が消えている、ということが起こります。
   *
   *  この3つは、本線の保存（save）がやることの写しです。
   *  ですから「手元とクラウドが同じ」ときだけ通します。
   *  違うときは送りません。本線の保存が、確かめたうえで送ります。   */
  function sideOK(act, body){
    var pay = (body && body.payload) || {};
    try{
      if(act === 'saveBuildings'){
        if(count(readMap(sigKey())) === 0) return false;         /* 見分けられない → 送りません */
        var bl = pay.buildings;
        if(!bl || typeof bl !== 'object') return false;
        var pb = plan(bl);
        /* ★ v27）中身が空になった物件があるなら、控えの表へも送りません。
             送ると、スプレッドシートまで空で上書きされます。 */
        if(pb.hollow && pb.hollow.length) return false;
        return !pb.changed.length && !pb.removed.length;
      }
      if(act === 'saveContractsOnly'){
        if(count(readMap(ctSigK())) === 0) return false;         /* 見分けられない → 送りません */
        var m = pay.contracts;
        if(!m || typeof m !== 'object') return false;
        var pc = planCts(m);
        if(pc.hollow && pc.hollow.length) return false;     /* ★ v28）空の契約があるなら送らない */
        return !pc.changed.length && !pc.removed.length;
      }
      if(act === 'saveOwnersOnly'){
        var ob = readMap(owRevK());
        if(!ob || ob.sig === undefined) return false;            /* 見分けられない → 送りません */
        var ls = pay.owners;
        if(!Array.isArray(ls)) return false;
        return sig(ls) === ob.sig;
      }
    }catch(e){ return false; }                                   /* 見分けられないときは、送りません */
    return false;
  }

  function onSide(P, url, body, t, act){
    if(sideOK(act, body)) return P(url, body, t);
    try{ console.warn('[D] ' + act + ' は送りませんでした（クラウドとまだ違います。本線の保存にまかせます）'); }catch(e){}
    return Promise.resolve({ ok:true, skipped:true,
                             message:'控えの表への送信は、本線の保存にまかせました' });
  }

  function onSave(P, url, body, t){
    tidyAhead('保存の前');                    /* ★ ぶつかる前に片付けます */
    var bl = body && body.payload && body.payload.buildings;
    if(!bl || typeof bl !== 'object') return noEscape('保存の中身の形が違う');   /* 素通ししません */

    /* ★ 契約やオーナーが半分より減る保存は、いったん止めます。
         古い内容を持った端末が上書きする事故を防ぐためです。

         ただし、以前はここで一方的に止めていました。
         わざとまとめて消したときに、どうやっても保存できなくなります。
         （10人のうち6人を消すと、4 < 5 なので必ず止まりました）
         わざとなら通せるように、選べる形に変えました。 */
    /* ★★ v27）中身が空になった物件を抱えた端末は、保存させません
     *
     *  1件でも「名前も住所も区画も無い」物件があるなら、
     *  この端末の置き場が壊れています。そのまま送ると、
     *  クラウドの中身が、項目ごとに消されていきます。
     *  黙って一部だけ送るのではなく、はっきり止めて、人に知らせます。 */
    try{
      var mapC = (body && body.payload && body.payload.contracts) || null;
      var plC = (mapC && typeof mapC === 'object' && count(mapC)) ? planCts(mapC) : null;
      if(plC && plC.hollow && plC.hollow.length){
        status('error', '⚠️ この端末の契約が壊れています（保存しませんでした）');
        try{ console.error('[E] 中身が空の契約が ' + plC.hollow.length + ' 件あります', plC.hollow); }catch(e){}
        try{
          window.alert('この端末が持っている契約のうち ' + plC.hollow.length + ' 件が、\n' +
                       '契約者名も物件名も無い状態になっています。\n\n' +
                       'このまま保存すると、クラウドの契約が消えます。\n' +
                       '保存しませんでした。\n\n' +
                       'ページを開き直してください。それでも直らないときは、\n' +
                       'このブラウザのサイトデータを消してから、開き直してください。');
        }catch(e){}
        try{ if(window.__pvUnsent && window.__pvUnsent.mark) window.__pvUnsent.mark('not-loaded'); }catch(e){}
        return Promise.resolve({ ok:false, error:'hollow-ct',
                                 message:'この端末の契約が壊れているため、保存しませんでした' });
      }
    }catch(e){}

    try{
      var pl0 = plan(bl);
      if(pl0.hollow && pl0.hollow.length){
        status('error', '⚠️ この端末の内容が壊れています（保存しませんでした）');
        try{ console.error('[D] 中身が空の物件が ' + pl0.hollow.length + ' 件あります', pl0.hollow); }catch(e){}
        try{
          window.alert('この端末が持っている物件のうち ' + pl0.hollow.length + ' 件が、\n' +
                       '名前も住所も区画も無い状態になっています。\n\n' +
                       'このまま保存すると、クラウドの中身が消えます。\n' +
                       '保存しませんでした。\n\n' +
                       'ページを開き直してください。それでも直らないときは、\n' +
                       'このブラウザのサイトデータを消してから、開き直してください。');
        }catch(e){}
        try{ if(window.__pvUnsent && window.__pvUnsent.mark) window.__pvUnsent.mark('not-loaded'); }catch(e){}
        return Promise.resolve({ ok:false, error:'hollow',
                                 message:'この端末の内容が壊れているため、保存しませんでした' });
      }
    }catch(e){}

    var lost = keepsContracts(body);
    if(lost){
      var okDrop = false;
      try{
        okDrop = window.confirm(
          'この保存で、次のものが大きく減ります。\n\n' + lost + '\n' +
          '［OK］　　　 わざと消したので、このまま保存する\n' +
          '［キャンセル］保存しない（ページを開き直して確かめる）\n\n' +
          '心当たりがないときは、キャンセルを選んでください。\n' +
          'この端末が古い内容を持っていることがあります。');
      }catch(e){ okDrop = false; }
      if(!okDrop){
        status('error', '⚠️ 契約が大きく減る保存を止めました');
        try{ console.warn('[D] 契約／オーナーが激減する保存を止めました\n' + lost); }catch(e){}
        return Promise.resolve({ ok:false, error:'contracts-drop', message:'契約が大きく減る保存を止めました' });
      }
      try{ console.warn('[D] 大きく減る保存を、確認のうえ通しました\n' + lost); }catch(e){}
    }

    if(_loaded){
      return ensureBase().then(function(){ return saveNow(P, url, body, t, bl); })
                         .catch(function(){ return noEscape('土台づくりに失敗'); });
    }

    /* ★ まだ一度も読み込んでいない状態での保存が、いちばん危ないところです。
       古い内容を持ったままの端末が保存すると、
       　・消した区画が復活する（9/5 に実際に起きたのはこれ）
       　・他の人の修正が消える
       のどちらも起こります。増える向きも減る向きも、どちらも危険です。
       そこで「読み込む前に、中身が変わる保存」は一切通しません。 */
    return readAll('保存の前の確かめ').then(function(fs){
      /* ★ クラウドが1件も読めないとき。
           移行前（まだ1件も無い）なら、従来どおり通します。
           そうでなければ、確かめられていないので送りません。 */
      if(!fs) return noEscape('クラウドが読めない');
      if(count(fs.buildings) === 0){
        if(count(readMap(sigKey())) > 0) return noEscape('クラウドが空に見える');
        return P(url, body, t);                                   /* 移行前 */
      }
      /* ★ ここで控えをクラウドの中身で塗り替えると、
           「ほかの端末が直したもの」まで「この端末が直したもの」に見えます。
           手元は古いままなので、そのあとの保存で古い内容を送り返し、
           ほかの人の直しが消えていました。
           手元と食い違うものは、前の控えを残します。                */
      mergeBase(fs, bl);
      var pl;
      try{ pl = plan(bl); }catch(e){ pl = { changed:[], removed:[] }; }
      if(!pl.changed.length && !pl.removed.length){
        return saveNow(P, url, body, t, bl);        /* 中身が同じ → 通してよい */
      }
      var mine = spotCount(bl), cloud = spotCount(fs.buildings);
      status('error', '⚠️ 最新を読み込む前だったので、保存を止めました');
      try{ console.warn('[D] 読み込む前の保存を止めました 手元' + mine + '区画 / 最新' + cloud + '区画'); }catch(e){}
      try{
        window.alert('保存を止めました。\n\n' +
                     'この端末は、まだ最新の内容を読み込んでいません。\n' +
                     'このまま保存すると、消したはずの区画が復活したり、\n' +
                     'ほかの人の入力が消えたりします。\n\n' +
                     '（この端末 ' + mine + ' 区画 ／ 最新 ' + cloud + ' 区画）\n\n' +
                     'ページを開き直してから、もう一度入力してください。');
      }catch(e){}
      return { ok:false, error:'not-loaded', message:'最新を読み込む前の保存を止めました' };
    }).catch(function(){ return noEscape('保存前の確かめに失敗'); });
  }

  function saveNow(P, url, body, t, bl){
    var _fsDone = false;   /* クラウド（Firestore）への保存が済んだか */
    var pl;
    try{ pl = plan(bl); }catch(e){ return noEscape('組み立てに失敗'); }

    /* たくさん消えるとき、または手元が極端に少ないときは、念のため確認します。
       ★ キャンセルを選んでも、直したぶんは保存します。
         これまでは全部を取りやめていたので、いっしょに直した内容も
         保存されないままになっていました。 */
    if(pl.removed.length >= 20 || (pl.few && pl.removed.length)){
      var okDel = false;
      try{
        okDel = window.confirm(
          'この保存で、物件 ' + pl.removed.length + ' 件が消えます。\n\n' +
          (pl.few ? ('この端末の物件が、クラウドより大きく少なくなっています。\n' +
                     '読み込みが途中で止まっていると、この形になります。\n\n') : '') +
          '［OK］　　　 わざと消したので、このまま消す\n' +
          '［キャンセル］消さない（直したぶんだけ保存します）\n\n' +
          '心当たりがなければ、キャンセルを選んでください。');
      }catch(e){ okDel = false; }
      if(!okDel){
        pl.removed = [];                      /* 消すのはやめて、直しぶんは通します */
        try{ console.warn('[D] 消すのは取りやめました。直したぶんだけ保存します'); }catch(e){}
        if(!pl.changed.length){
          status('idle', '');
          return Promise.resolve({ ok:false, message:'保存を取りやめました' });
        }
      }
    }

    var work = (pl.changed.length || pl.removed.length) ? commit(pl) : Promise.resolve([]);

    return work.then(function(jobs){
      var revs = readMap(revKey()), sigs = readMap(sigKey()), fprs = fprRead(), i;
      for(i = 0; i < jobs.length; i++){
        if(jobs[i].kind === 'del'){
          delete revs[jobs[i].id]; delete sigs[jobs[i].id]; delete fprs[jobs[i].id];
        }else if(jobs[i].skip){
          /* 送るものが無かった（相手と同じ部品だった）→ 控えは変えません */
        }else {
          revs[jobs[i].id] = (jobs[i].whole ? (jobs[i].base || 0) : (jobs[i].rev0 || 0)) + 1;
          sigs[jobs[i].id] = jobs[i].sig;
          if(jobs[i].fpr) fprs[jobs[i].id] = jobs[i].fpr;
        }
      }
      writeMap(revKey(), revs); writeMap(sigKey(), sigs); fprWriteAll(fprs);
      try{
        console.log('[D] 保存：更新 ' + pl.changed.length + ' 件 / 削除 ' + pl.removed.length + ' 件');
      }catch(e){}
      /* ★ ぶつかった書類があったときは、保存できたぶんを通したうえでお知らせします。
           これまでは、ぶつかった1件のせいで全部が止まっていました。 */
      try{ if(jobs && jobs.__conflict && jobs.__conflict.length) tellConflict(jobs.__conflict); }catch(e){}
      try{ writeLog(jobs); }catch(e){}
      /* ★★ 保存のあとの読み直しを、軽くします
       *
       *  ここで読み直しているのは、控えのスプレッドシートへ
       *  クラウドとそろった中身を送るためです。
       *  これまでは、そのために物件をぜんぶ読んでいました（70件なら70回）。
       *
       *  でも、いま保存したのはこの端末です。手元＝クラウドです。
       *  ほかの端末が直したぶんだけを読み足せば足ります。
       *  1件も直っていなければ、読むのは1回です。
       *
       *  目印を持っていない端末のときだけ、ぜんぶ読みます。         */
      var afterRead = function(){
        var seen = '';
        try{ seen = String(localStorage.getItem(lastSeenKey()) || ''); }catch(e){ seen = ''; }
        return seen ? readSince(seen) : readAll('保存のあとの読み直し');
      };
      return saveCtOw(body).then(afterRead, function(e){
        if(e && (e.__conflict || e.__cancel)) throw e;
        try{ console.warn('[E] 契約・オーナーの保存でつまずきました', e); }catch(x){}
        return afterRead();
      });
    }).then(function(fs){
      /* スプレッドシートへは Firestore の内容を送ります（両者が必ず一致します） */
      /* ★★ 保存のあとの取りこみ
       *
       *  いま保存した結果を、ここで読み直しています。
       *  区画1つずつ送る形にしたので、クラウドの中身は
       *  「この端末が送った区画」＋「ほかの人が送った区画」になります。
       *
       *  これまでは、その結果で「控え」だけをそろえて、手元を
       *  合わせていませんでした。すると手元と控えが食い違ったまま残り、
       *  そのあと何度読み直しても「手元に未送信の直しがある」と誤解して、
       *  取りこまなくなります。
       *
       *  2台で使っていると、だんだん画面の内容がずれていく原因でした。
       *  ここで手元も、いっしょにそろえます。                        */
      if(fs && count(fs.buildings) > 0){
        var mine = null;
        try{ mine = (typeof pbLoadAll === 'function') ? (pbLoadAll() || {}) : null; }catch(e){ mine = null; }
        if(mine && typeof mine === 'object'){
          var outB = {}, bid, r2 = readMap(revKey()), s2 = readMap(sigKey()), f2 = fprRead(), mSig;
          for(bid in mine){ if(Object.prototype.hasOwnProperty.call(mine, bid)) outB[bid] = mine[bid]; }
          for(bid in fs.buildings){
            if(!Object.prototype.hasOwnProperty.call(fs.buildings, bid)) continue;
            /* この保存に入っていない物件で、手元に未送信の直しがあるものは触りません */
            if(Object.prototype.hasOwnProperty.call(mine, bid) && s2[bid] !== undefined){
              mSig = null;
              try{ mSig = sig(toDoc(bid, mine[bid])); }catch(e){ mSig = null; }
              if(mSig !== null && mSig !== s2[bid]) continue;
            }
            outB[bid] = fs.buildings[bid];
            r2[bid]   = fs.revs[bid];
            s2[bid]   = fs.sigs[bid];
            try{ f2[bid] = fprOf(toDoc(bid, fs.buildings[bid])); }catch(e){}
          }
          if(count(outB) > 0) body.payload.buildings = outB;
          try{ if(typeof pbSaveRaw === 'function') pbSaveRaw(outB); }catch(e){}
          writeMap(revKey(), r2); writeMap(sigKey(), s2); fprWriteAll(f2);
          try{ if(fs.at) localStorage.setItem(lastSeenKey(), fs.at); }catch(e){}
          try{ if(typeof requestRender === 'function') requestRender('buildings'); }catch(e){}
        }
      }
      _fsDone = true;      /* ここまで来ていれば、クラウド（Firestore）には入っています */
try{ if(window.__pvRealtime && typeof window.__pvRealtime.ring === 'function') window.__pvRealtime.ring(); }catch(e){}
fsDrop();
      fsDrop();            /* ★ 中身が変わったので、読んだものの使い回しをやめます */
      return Promise.resolve(P(url, body, t)).then(function(r){
        /* ★ v23）クラウドから消えたことを確かめてから、控えの表の行を消します */
        try{ flushCtDel(P, url); }catch(e){}
        return r;
      });
    }).catch(function(e){
      if(e && e.__cancel){
        status('idle', '');
        return { ok:false, message:'保存を取りやめました' };
      }
      if(e && e.__conflict){
        tellConflict(e.__conflict);
        return { ok:false, error:'conflict', message:'他の人が先に保存しました' };
      }
      /* Firestore には入っている場合。
         「保存できませんでした」と出すと、入っているのに入っていないと思わせます。
         控えのスプレッドシートだけが遅れている、と正しく伝えます。 */
      if(_fsDone){
        status('error', '⚠️ 控えの表だけ、あとまわしになりました');
        try{ console.warn('[D] クラウドには保存済み。控えの表への送信だけ失敗しました', e); }catch(x){}
        return { ok:true, warn:'sheet', message:'クラウドには保存しました（控えの表はあとで揃います）' };
      }
      status('error', '⚠️ 保存できませんでした');
      try{
        if(isCloudQuota(e)){
          status('error', '⚠️ クラウドの1日の回数を使い切りました');
          window.alert('保存できませんでした。\n\n' + cloudMsg());
        }else if(isLocalQuota(e)){
          var m = quotaMsg();
          tidy();                                   /* 消しても困らない控えを片付けます */
          window.alert('保存できませんでした。\n\n' + m);
        }else{
          window.alert('保存できませんでした。\n\n' +
                       '入力した内容はこの端末に残っています。\n' +
                       'ネットにつながっているか確認して、もう一度お試しください。\n\n' +
                       '（' + (e && e.message ? e.message : e) + '）');
        }
      }catch(x){}
      return { ok:false, error:String(e && e.message || e) };
    });
  }



  /* ============================================================
   *  ㊸ 契約・オーナーも Firestore へ（第1段-E）
   *
   *  契約　　： 1件ずつ別々に保存します（物件と同じ考え方）。
   *            版番号で追い越しを見つけ、他の人の入力を消しません。
   *  オーナー： 111件をひとまとめで1件として保存します。
   *            並び順に意味があるので、まとめて扱います。
   *
   *  はじめて動いたときに、いまスプレッドシートにある内容を
   *  そのまま Firestore へ写します（1回だけ・自動）。
   * ============================================================ */

  function ctCol(){ return db().collection(INS).doc('data').collection('contracts'); }
  function owRef(){ return db().collection(INS).doc('data').collection('misc').doc('owners'); }
  function ctRevK(){ return pfx() + 'fs_ct_rev'; }
  function ctSigK(){ return pfx() + 'fs_ct_sig'; }
  function owRevK(){ return pfx() + 'fs_ow_rev'; }
  /* ★ オーナー：前に読んだクラウドの中身を、そのまま控えておきます。
       これがないと「この端末で直したもの」と「ほかの端末で直されたもの」を
       見分けられません。見分けられないと、直しをまるごと捨てるしかなくなります。 */
  function owBaseK(){ return pfx() + 'fs_ow_base'; }
  /* 契約：どこまで読んだかの目印と、この端末の置き場 */
  function ctSeenK(){ return pfx() + 'fs_ct_seen'; }
  function ctLS(){
    try{ if(typeof ctKey === 'function') return ctKey(); }catch(e){}
    return pfx() + 'contract_kanban_v2';
  }
  /* 目印（_addedAt）は端末ごとに付け外しするので、見くらべる前に外します */
  function owNorm(o){
    var d = {}, f;
    if(!o || typeof o !== 'object') return d;
    for(f in o){
      if(!Object.prototype.hasOwnProperty.call(o, f) || f === '_addedAt') continue;
      d[f] = o[f];
    }
    return d;
  }
  function owId(o){
    var k = String((o && o.name) || '').trim();
    return k ? ('n:' + k) : ('a:' + String((o && o._addedAt) || ''));
  }
  function owBaseRead(){
    var v = null;
    try{ v = JSON.parse(localStorage.getItem(owBaseK()) || 'null'); }catch(e){ v = null; }
    return Array.isArray(v) ? v : null;
  }
  function owBaseWrite(list){
    try{
      var out = [], i;
      for(i = 0; i < (list || []).length; i++) out.push(owNorm(list[i]));
      localStorage.setItem(owBaseK(), JSON.stringify(out));
    }catch(e){}
  }

  var CMETA = { rev:1, updatedAt2:1, updatedBy2:1 };
  var _seedC = false, _seedO = false;   /* 移行を二度走らせないための印 */
  function ctDoc(id, c){
    var d = {}, f;
    for(f in c){
      if(!Object.prototype.hasOwnProperty.call(c, f) || CMETA[f] || c[f] === undefined) continue;
      d[f] = c[f];
    }
    d.id = id;
    return d;
  }
  function ctFrom(d){
    var c = {}, f;
    for(f in d){
      if(!Object.prototype.hasOwnProperty.call(d, f) || CMETA[f]) continue;
      c[f] = d[f];
    }
    return c;
  }

  function readCts(){
    try{
    return ctCol().get().then(function(qs){
      /* ★ v24）クラウドへ届いていません（端末の中の控えから返ってきました）。
           読めなかったのと同じに扱います。ここで区別しないと、
           「0件」を「みんなが消した」と取りちがえます。 */
      if(fromCache(qs)){
        try{ console.warn('[D] クラウドへ届きませんでした（端末の控えから返ってきたので、使いません）'); }catch(e){}
        return null;
      }
      var m = {}, revs = {}, sigs = {};
      qs.forEach(function(doc){
        var d = doc.data() || {}, id = doc.id;
        m[id]    = ctFrom(d);
        revs[id] = d.rev || 0;
        sigs[id] = sig(ctDoc(id, m[id]));
      });
      use('read', Math.max(qs.size || 0, 1), '契約をぜんぶ読む');
      return { map:m, revs:revs, sigs:sigs, partial:false, at:ctNewest_(qs), cached:fromCache(qs) };
    }).catch(function(){ return null; });
    }catch(e){ return Promise.resolve(null); }
  }
  /* 契約：いちばん新しい updatedAt2 を控えます（次に「そこから先」を読むため） */
  function ctNewest_(qs){
    var t = '';
    try{ qs.forEach(function(doc){
      var v = String((doc.data() || {}).updatedAt2 || '');
      if(v > t) t = v;
    }); }catch(e){}
    return t;
  }
  /* ★ 契約：直されたものだけを読みます。
       1件も直っていなくても、Firestore の決まりで1回ぶんは数えられます。
       契約が何件あっても、ふだんは1回です。 */
  function readCtsSince(since){
    if(!since) return readCts();
    try{
    return ctCol().where('updatedAt2', '>', since).get().then(function(qs){
      /* ★ v24）クラウドへ届いていません（端末の中の控えから返ってきました）。
           読めなかったのと同じに扱います。ここで区別しないと、
           「0件」を「みんなが消した」と取りちがえます。 */
      if(fromCache(qs)){
        try{ console.warn('[D] クラウドへ届きませんでした（端末の控えから返ってきたので、使いません）'); }catch(e){}
        return null;
      }
      var m = {}, revs = {}, sigs = {};
      qs.forEach(function(doc){
        var d = doc.data() || {}, id = doc.id;
        m[id]    = ctFrom(d);
        revs[id] = d.rev || 0;
        sigs[id] = sig(ctDoc(id, m[id]));
      });
      use('read', Math.max(qs.size || 0, 1), '直された契約だけ読む');
      var t = ctNewest_(qs);
      return { map:m, revs:revs, sigs:sigs, partial:true, at:(t || since), cached:fromCache(qs) };
    }).catch(function(e){
      try{ console.warn('[E] 契約の差分を読めませんでした。全部を読み直します', e); }catch(x){}
      return readCts();
    });
    }catch(e){ return readCts(); }
  }

  function readOws(){
    try{
    return owRef().get().then(function(d){
      use('read', 1, 'オーナーを読む');
      if(fromCache(d)) return null;      /* ★ v24）端末の控えから返ってきたものは、使いません */
      if(!d.exists) return { list:null, rev:0 };
      var v = d.data() || {};
      return { list:(Array.isArray(v.list) ? v.list : null), rev:(v.rev || 0) };
    }).catch(function(){ return null; });
    }catch(e){ return Promise.resolve(null); }
  }

  /* はじめの1回だけ、いまの内容を Firestore へ写します */
  function seedCts(map){
    if(_seedC) return Promise.resolve(false);
    _seedC = true;
    var ids = [], k;
    for(k in map){ if(Object.prototype.hasOwnProperty.call(map, k)) ids.push(k); }
    if(ids.length < 3) return Promise.resolve(false);
    var batch = db().batch(), at = new Date().toISOString(), i, d;
    for(i = 0; i < ids.length && i < 450; i++){
      d = ctDoc(ids[i], map[ids[i]]);
      d.rev = 1; d.updatedAt2 = at; d.updatedBy2 = (me() || '(名前なし)') + '（移行）';
      batch.set(ctCol().doc(ids[i]), d);
    }
    return batch.commit().then(function(){
      try{ console.log('[E] 契約 ' + Math.min(ids.length,450) + ' 件を Firestore に写しました'); }catch(e){}
      return true;
    }).catch(function(e){
      try{ console.warn('[E] 契約の移行に失敗', e); }catch(x){}
      return false;
    });
  }
  function seedOws(list){
    if(_seedO) return Promise.resolve(false);
    _seedO = true;
    if(!Array.isArray(list) || list.length < 3) return Promise.resolve(false);
    return owRef().set({ list:list, rev:1, updatedAt2:new Date().toISOString(),
                         updatedBy2:(me() || '(名前なし)') + '（移行）' }).then(function(){
      try{ console.log('[E] オーナー ' + list.length + ' 件を Firestore に写しました'); }catch(e){}
      owBaseWrite(list);
      return true;
    }).catch(function(){ return false; });
  }

  /* ============================================================
   *  契約を1件消すとき（★ v23）
   *
   *  これまで：
   *    画面の「削除」を押した瞬間に、contracts.js が
   *    控えのスプレッドシート（GAS）へ直接 fetch していました。
   *    クラウド（Firestore）の返事を、一切待っていません。
   *
   *    ですから、こういうことが起こりえました。
   *      ・クラウドでは、ほかの端末が先に直していて消せなかった
   *      ・なのに控えの表の行だけは、もう消えている
   *    このあと読み直すと契約が戻ってくるので、
   *    「消したのに戻る」「端末で件数が違う」に見えます。
   *
   *  これから：
   *    押したときは、消す相手の番号をここに控えるだけにします。
   *    クラウドから本当に消えたことを確かめてから、
   *    控えの表の行を消します。順番は、保存とまったく同じです。
   *
   *        クラウドから消える → 確かめる → 控えの表を消す
   *
   *    クラウドから消せていなければ、控えの表も消しません。
   *    どちらかだけ消える、ということが起きません。
   * ============================================================ */
  var _PRAW = null;                      /* 包む前の postToGas（控えの表への直通） */
  function ctDelQK(){ return pfx() + 'fs_ct_delq'; }
  function ctDelQ(){
    var a = [];
    try{ a = JSON.parse(localStorage.getItem(ctDelQK()) || '[]'); }catch(e){ a = []; }
    return Array.isArray(a) ? a : [];
  }
  function ctDelQPut(a){
    try{ localStorage.setItem(ctDelQK(), JSON.stringify(a || [])); }catch(e){}
  }
  function ctDelQAdd(id){
    if(!id) return;
    var a = ctDelQ(), i;
    for(i = 0; i < a.length; i++) if(a[i] === id) return;
    a.push(String(id));
    if(a.length > 200) a = a.slice(a.length - 200);     /* たまりすぎないように */
    ctDelQPut(a);
  }

  /* 控えの表の行を消します。クラウドから消えたものだけです。 */
  function flushCtDel(P, url){
    var a = ctDelQ();
    if(!a.length) return Promise.resolve(0);
    if(typeof P !== 'function' || !url) return Promise.resolve(0);
    var done = 0;
    function one(i){
      if(i >= a.length) return Promise.resolve(done);
      var id = a[i];
      return ctCol().doc(id).get().then(function(sn){
        use('read', 1, '契約が本当に消えたかの確かめ');
        if(sn.exists){
          /* まだクラウドにあります。控えの表は、さわりません。
             次の保存のときに、あらためて確かめます。 */
          try{ console.warn('[E] 契約 ' + id + ' はクラウドにまだあるので、控えの表は消しませんでした'); }catch(e){}
          return null;
        }
        return Promise.resolve(P(url, { action:'deleteContract', id:id }, 20000)).then(function(r){
          if(r && r.ok === false) return null;
          done++;
          var b = ctDelQ(), k, out = [];
          for(k = 0; k < b.length; k++) if(b[k] !== id) out.push(b[k]);
          ctDelQPut(out);
          return null;
        }, function(){ return null; });
      }, function(){ return null; })
      .then(function(){ return one(i + 1); });
    }
    return one(0).then(function(v){
      try{ if(done) console.log('[E] 控えの表から、契約 ' + done + ' 件ぶんの行を消しました'); }catch(e){}
      return v;
    });
  }

  /* 契約の書き込み（版番号で追い越しを見つけます） */
  function commitCts(pl){
    return db().runTransaction(function(tx){
      var jobs = [], i, c;
      for(i = 0; i < pl.changed.length; i++){
        c = pl.changed[i];
        jobs.push({ kind:'set', id:c.id, base:c.base, doc:c.doc, sig:c.sig, ref:ctCol().doc(c.id), label:c.label });
      }
      for(i = 0; i < pl.removed.length; i++){
        jobs.push({ kind:'del', id:pl.removed[i].id, base:pl.removed[i].base, ref:ctCol().doc(pl.removed[i].id), label:pl.removed[i].label });
      }
      var gets = [];
      for(i = 0; i < jobs.length; i++) gets.push(tx.get(jobs[i].ref));
      return Promise.all(gets).then(function(snaps){
        var bad = [], j, cur, d;
        for(j = 0; j < jobs.length; j++){
          jobs[j].prev = snaps[j].exists ? (snaps[j].data() || null) : null;
          cur = snaps[j].exists ? ((snaps[j].data() || {}).rev || 0) : 0;
          /* ★ 消したい契約が、もうクラウドに無いとき。
               ほかの端末が先に消しただけです。やりたかったことは済んでいます。
               これまでは「版番号が違う」として、ぶつかりの知らせを出していました。
               2台で同じ契約を消すと、あとの1台が必ず止まっていました。 */
          if(jobs[j].kind === 'del' && !snaps[j].exists){ jobs[j].skip = true; continue; }
          if(cur !== jobs[j].base) bad.push({ kind:'c', id:jobs[j].id, name:jobs[j].label,
                                              by:(jobs[j].prev && jobs[j].prev.updatedBy2) || '' });
        }
        if(bad.length){ var e = new Error('conflict'); e.__conflict = bad; throw e; }
        for(j = 0; j < jobs.length; j++){
          if(jobs[j].skip) continue;                       /* もう消えている */
          if(jobs[j].kind === 'del'){ tx.delete(jobs[j].ref); continue; }
          d = jobs[j].doc;
          d.rev = jobs[j].base + 1;
          d.updatedAt2 = new Date().toISOString();
          d.updatedBy2 = me() || '(名前なし)';
          tx.set(jobs[j].ref, d);
        }
        return jobs;
      });
    });
  }

  /* ★★ v28）契約にも、中身の守りを入れます
   *
   *  v27 では物件だけを守りました。契約には入れていませんでした。
   *  2026/09/13 に、スマホが中身の無い契約を書き込み、
   *  クラウドの契約が id と更新情報だけになりました。
   *
   *    updatedBy2: "たきスマホ"
   *    contractor / property / room …すべて消滅
   *
   *  契約は書類まるごと入れ替える作りなので、
   *  中身の無いものを送ると、そのまま空になります。            */
  function ctBody(c){
    try{
      if(!c || typeof c !== 'object') return false;
      var f, KEY = { id:1, rev:1, updatedAt2:1, updatedBy2:1, updatedAt:1, _addedAt:1 };
      for(f in c){
        if(!Object.prototype.hasOwnProperty.call(c, f)) continue;
        if(KEY[f]) continue;
        var v = c[f];
        if(v === null || v === undefined) continue;
        if(typeof v === 'string' && !v.trim()) continue;
        if(typeof v === 'object'){
          var k2, any = false;
          for(k2 in v){ if(Object.prototype.hasOwnProperty.call(v, k2)){ any = true; break; } }
          if(!any) continue;
        }
        return true;                    /* 中身のある欄が1つでもある */
      }
      return false;
    }catch(e){ return true; }           /* 見分けられないときは、ふつうに扱います */
  }

  function planCts(map){
    var revs = readMap(ctRevK()), sigs = readMap(ctSigK());
    var changed = [], removed = [], hollow = [], id, d, s;
    for(id in map){
      if(!Object.prototype.hasOwnProperty.call(map, id)) continue;
      d = ctDoc(id, map[id]); s = sig(d);
      /* ★ v28）中身が空になった契約は、送りません */
      if(revs[id] !== undefined && !ctBody(map[id])){ hollow.push(id); continue; }
      if(sigs[id] !== s){
        changed.push({ id:id, doc:d, sig:s, base:(revs[id] || 0),
                       label:((map[id] && (map[id].property || '')) + ' ' + (map[id] && (map[id].room || '')) + ' ' +
                              (map[id] && (map[id].contractor || ''))).trim() || id });
      }
    }
    var known = count(revs), here = count(map);
    if(known >= 3 && here < known * 0.5){
      try{ console.warn('[E] 手元の契約が少ないため、削除の判定を見送りました ' + here + ' < ' + known); }catch(e){}
      return { changed:changed, removed:[] };
    }
    for(id in revs){
      if(!Object.prototype.hasOwnProperty.call(revs, id)) continue;
      if(!Object.prototype.hasOwnProperty.call(map, id)) removed.push({ id:id, base:(revs[id] || 0), label:id });
    }
    if(hollow.length){
      try{ console.warn('[E] 中身が空になった契約 ' + hollow.length + ' 件は送りませんでした', hollow); }catch(e){}
    }
    return { changed:changed, removed:removed, hollow:hollow };
  }

  /* 契約の変更を履歴に残します */
  function writeCtLog(jobs){
    if(!jobs || !jobs.length) return;
    var who = me() || '(名前なし)', at = new Date().toISOString();
    var until = new Date(Date.now() + 30 * 86400000).toISOString();
    var batch = db().batch(), wrote = 0, i, j, f;
    for(i = 0; i < jobs.length && wrote < 300; i++){
      var job = jobs[i], prev = job.prev || null;
      if(job.skip) continue;                               /* もう消えていたので、履歴には残しません */
      if(job.kind === 'del'){
        batch.set(logCol().doc(), { at:at, by:who, bld:'(契約)', name:'契約　' + (job.label || job.id),
                                    kind:'契約を削除', note:'' });
        batch.set(trashCol().doc(), { at:at, by:who, until:until, kind:'contract',
                                      bld:'(契約)', name:'契約　' + (job.label || job.id),
                                      no:job.id, data:prev || {} });
        wrote += 2; continue;
      }
      if(!prev){
        batch.set(logCol().doc(), { at:at, by:who, bld:'(契約)', name:'契約　' + (job.label || job.id),
                                    kind:'契約を追加', note:'' });
        wrote++; continue;
      }
      var one = { no:job.id, was:{}, now:{} }, any = false;
      for(f in job.doc){
        if(!Object.prototype.hasOwnProperty.call(job.doc, f) || CMETA[f]) continue;
        if(sig(prev[f]) !== sig(job.doc[f])){
          one.was[f] = (typeof prev[f] === 'object') ? '（内訳）' : v0(prev[f]);
          one.now[f] = (typeof job.doc[f] === 'object') ? '（内訳）' : v0(job.doc[f]);
          any = true;
        }
      }
      for(f in prev){
        if(!Object.prototype.hasOwnProperty.call(prev, f) || CMETA[f]) continue;
        if(!Object.prototype.hasOwnProperty.call(job.doc, f)){ one.was[f] = v0(prev[f]); one.now[f] = ''; any = true; }
      }
      if(!any) continue;
      batch.set(logCol().doc(), { at:at, by:who, bld:'(契約)', name:'契約　' + (job.label || job.id),
                                  kind:'変更', changed:[one] });
      wrote++;
    }
    if(!wrote) return;
    batch.commit().then(function(){
      try{ console.log('[E] 契約の履歴を残しました（' + wrote + ' 件）'); }catch(e){}
    }).catch(function(){});
  }

  /* 契約・オーナーを保存します（物件の保存が通ったあとに呼びます） */
  function saveCtOw(body){
    try{ if(!(window.firebase && firebase.firestore)) return Promise.resolve(null); }catch(e){ return Promise.resolve(null); }
    var pay = (body && body.payload) || {};
    var map = (pay.contracts && typeof pay.contracts === 'object') ? pay.contracts : null;
    var list = Array.isArray(pay.owners) ? pay.owners : null;
    /* 契約が1件も入っていない保存では、契約には一切さわりません。
       （空で届いたときに全部消してしまうのを防ぎます） */
    if(map && count(map) === 0) map = null;
    if(list && !list.length) list = null;
    var jobs = [];

    var stepC = !map ? Promise.resolve(null) : (function(){
      var pl;
      try{ pl = planCts(map); }catch(e){ return Promise.resolve([]); }
      if(!pl.changed.length && !pl.removed.length) return Promise.resolve([]);
      if(pl.removed.length >= 20){
        var okDel = true;
        try{
          okDel = window.confirm('この保存で 契約 ' + pl.removed.length + ' 件が消えます。\n\n本当に消してよろしいですか？');
        }catch(e){ okDel = false; }
        if(!okDel){ var e2 = new Error('cancel'); e2.__cancel = true; return Promise.reject(e2); }
      }
      return commitCts(pl).then(function(js){
        try{ writeCtLog(js); }catch(e){}
        var revs = readMap(ctRevK()), sigs = readMap(ctSigK()), i;
        for(i = 0; i < js.length; i++){
          if(js[i].kind === 'del'){ delete revs[js[i].id]; delete sigs[js[i].id]; }
          else { revs[js[i].id] = js[i].base + 1; sigs[js[i].id] = js[i].sig; }
        }
        writeMap(ctRevK(), revs); writeMap(ctSigK(), sigs);
        try{ console.log('[E] 契約：更新 ' + pl.changed.length + ' 件 / 削除 ' + pl.removed.length + ' 件'); }catch(e){}
        jobs = js;
        return js;
      });
    })();

    return stepC.then(function(){
      if(!list) return null;
      var base = readMap(owRevK());
      var cur = sig(list);
      if(base.sig === cur) return null;                    /* 変わっていない */
      return db().runTransaction(function(tx){
        return tx.get(owRef()).then(function(sn){
          var now = sn.exists ? (sn.data() || {}) : null;
          var rv = now ? (now.rev || 0) : 0;
          if(base.rev !== undefined && rv !== (base.rev || 0)){
            var e = new Error('conflict'); e.__conflict = [{ name:'オーナー一覧', by:(now && now.updatedBy2) || '' }]; throw e;
          }
          tx.set(owRef(), { list:list, rev:rv + 1, updatedAt2:new Date().toISOString(),
                            updatedBy2:(me() || '(名前なし)') });
          return rv + 1;
        });
      }).then(function(rv){
        writeMap(owRevK(), { rev:rv, sig:cur });
        owBaseWrite(list);
        try{ console.log('[E] オーナー ' + list.length + ' 件を保存しました'); }catch(e){}
        return rv;
      });
    }).then(function(){ return jobs; });
  }

  /* ★ オーナー一覧だけを、その場でクラウドへ保存します。
       これまでオーナーは「物件の保存」に相乗りしていました。
       物件側が止まると（読み込み前・契約が減る・通信の失敗など）、
       オーナーも保存されず、次の読み込みで消えていました。
       ここは物件と切り離して、単独で通します。 */
  /* ★ オーナーの突き合わせ（三方向）
   *
   *  【これまでの作り】
   *    クラウドの一覧をそのまま土台にして、手元からは
   *    「新しく手で足したもの（_addedAt 付き）」だけを足していました。
   *    そのため、もともといるオーナーの住所・宛名・メールを直しても、
   *    その直しは一切引き継がれず、クラウドの古い内容が書き戻されていました。
   *    さらに、その古い内容で直した端末の画面まで上書きされていました。
   *
   *  【これから】
   *    3つを見くらべます。
   *      base  … この端末が前に読んだ、クラウドの中身
   *      mine  … いまの、この端末の中身
   *      cloud … いまの、クラウドの中身
   *
   *    オーナー1人ずつ、こう決めます。
   *      ・base と mine がちがう　→ この端末で直した　→ mine を採る
   *      ・base と mine が同じ　　→ 触っていない　　　→ cloud を採る
   *      ・cloud に無い
   *          base にある　→ ほかの端末で消された　→ 足し戻さない
   *          base にも無い→ この端末で足した　　　→ 足す
   *
   *    base が無いとき（はじめての端末）は、安全側に倒してクラウドを採り、
   *    手で足したものだけを足します。これまでと同じ動きです。            */
  function mergeOws(cloud, mine){
    var out  = Array.isArray(cloud) ? cloud.slice() : [];
    var base = owBaseRead();
    var add  = [];                                 /* 足す人は、最後にまとめて前へ */
    var mAt  = {};                                 /* 手元に、まだ居るかどうか */
    var i, o, k;

    for(i = 0; i < (mine || []).length; i++) mAt[owId(mine[i])] = 1;

    var cAt = {};                                  /* クラウドの、どこに居るか */
    for(i = 0; i < out.length; i++) cAt[owId(out[i])] = i;

    var bSig = null;                               /* 前に読んだクラウドの指紋 */
    if(base){
      bSig = {};
      for(i = 0; i < base.length; i++) bSig[owId(base[i])] = sig(owNorm(base[i]));
    }

    for(i = 0; i < (mine || []).length; i++){
      o = mine[i] || {};
      k = owId(o);

      if(Object.prototype.hasOwnProperty.call(cAt, k)){
        if(!bSig) continue;                        /* 控えが無い → クラウドを立てます */
        if(!Object.prototype.hasOwnProperty.call(bSig, k)) continue;
        if(sig(owNorm(o)) === bSig[k]) continue;   /* この端末では触っていません */
        out[cAt[k]] = o;                           /* ★ この端末の直しを活かします */
        continue;
      }

      if(bSig && Object.prototype.hasOwnProperty.call(bSig, k)) continue;  /* 他で消された */
      if(!bSig && !o._addedAt) continue;           /* 控えが無いときは、足したものだけ */
      add.push(o);                                 /* この端末で足した1人 */
    }
    /* ★ この端末で消した人を、クラウドから落とします。
         これをしないと、ほかの端末が先に保存していたときに
         「保存しました」と出るのに、消したはずの人が戻ってきます。
         ただし、ほかの端末がその人を直していたときは落としません。
         消すより、残すほうが安全だからです。 */
    if(bSig){
      var keep2 = [], ck;
      for(i = 0; i < out.length; i++){
        ck = owId(out[i]);
        if(!mAt[ck] &&
           Object.prototype.hasOwnProperty.call(bSig, ck) &&
           sig(owNorm(out[i])) === bSig[ck]) continue;     /* この端末で消した人 */
        keep2.push(out[i]);
      }
      out = keep2;
    }

    /* ★ ここで足します。途中で out.unshift すると番号がずれて、
         直しを書き込む先がひとつ後ろになり、足した人を踏みつぶします。 */
    return add.concat(out);
  }
  function saveOwsAlone(list){
    try{ if(!(window.firebase && firebase.firestore)) return Promise.resolve(null); }catch(e){ return Promise.resolve(null); }
    if(!Array.isArray(list) || !list.length) return Promise.resolve(null);
    var base = readMap(owRevK());
    var cur  = sig(list);
    if(base.sig === cur) return Promise.resolve(null);        /* 変わっていません */
    var sent = list;
    return db().runTransaction(function(tx){
      return tx.get(owRef()).then(function(sn){
        var now = sn.exists ? (sn.data() || {}) : null;
        var rv  = now ? (now.rev || 0) : 0;
        /* ほかの端末が先に保存していたら、消さないように、足りないものだけ足します */
        if(base.rev !== undefined && rv !== (base.rev || 0)){
          sent = mergeOws((now && Array.isArray(now.list)) ? now.list : [], list);
          try{ console.warn('[E] オーナー：ほかの端末が先に保存していたので、足りないぶんだけ足しました'); }catch(e){}
        }
        use('read', 1, 'オーナー保存のときの確かめ');
        tx.set(owRef(), { list:sent, rev:rv + 1, updatedAt2:new Date().toISOString(),
                          updatedBy2:(me() || '(名前なし)') });
        use('write', 1, 'オーナーの保存');
        return rv + 1;
      });
    }).then(function(rv){
      writeMap(owRevK(), { rev:rv, sig:sig(sent) });
      owBaseWrite(sent);
      try{ console.log('[E] オーナー ' + sent.length + ' 件を保存しました（単独）'); }catch(e){}
      try{ if(sent !== list && typeof window.applyCloudOwners === 'function') window.applyCloudOwners(sent); }catch(e){}
      return rv;
    });
  }
  try{ window.pvSaveOwnersToCloud = function(list){
    var r = saveOwsAlone(list);
    try{ if(r && r.then) r.then(function(){ fsDrop(); }, function(){}); }catch(e){}
    return r;
  }; }catch(e){}

  /* ============================================================
   *  ㊷ 変更履歴 と ごみ箱（30日）
   *
   *  保存が通るたびに「誰が・いつ・どこを・どう変えたか」を残します。
   *  消した区画・物件は、30日間ごみ箱に取っておきます。
   *  設定メニューの「変更履歴・ごみ箱」から見られます。
   * ============================================================ */

  function logCol(){  return db().collection(INS).doc('logs').collection('history'); }
  function trashCol(){ return db().collection(INS).doc('logs').collection('trash'); }
  var SKIP = { rev:1, updatedAt:1, updatedBy:1, migratedAt:1, spots:1 };
  var SF = ['no','type','tou','room','user','price','status','note','res_user','res_room','res_date','res_price','res_note','end_date'];
  var SJ = { no:'区画番号', type:'種別', tou:'棟', room:'号室', user:'使用者', price:'月額', status:'状況', note:'備考',
             res_user:'予約者', res_room:'予約号室', res_date:'予約日', res_price:'予約金額', res_note:'予約備考', end_date:'終了日',
             property:'物件', contractor:'契約者', stage:'進捗', applyDate:'申込日', contractDate:'契約日',
             parking:'駐車場', staff:'担当', broker:'仲介', memo:'メモ', dealStatus:'状態', type2:'区分',
             keyHandover:'鍵渡し', paymentDate:'入金日', sendDate:'送付日', returnDate:'返送日', warn:'不備' };
  function v0(x){ return (x === null || x === undefined) ? '' : String(x); }

  /* 直前の内容と、いまの内容の違いを取り出します */
  function diffDoc(prev, next){
    var d = { fields:[], added:[], removed:[], changed:[] }, k, f, i;
    for(k in next){
      if(SKIP[k] || !Object.prototype.hasOwnProperty.call(next, k)) continue;
      if(sig(next[k]) !== sig(prev ? prev[k] : undefined)) d.fields.push(k);
    }
    var ps = (prev && prev.spots) || {}, ns = (next && next.spots) || {};
    for(k in ns){
      if(!Object.prototype.hasOwnProperty.call(ns, k)) continue;
      if(!Object.prototype.hasOwnProperty.call(ps, k)){ d.added.push(k); continue; }
      if(sig(ns[k]) === sig(ps[k])) continue;
      var one = { no:k, was:{}, now:{} };
      for(i = 0; i < SF.length; i++){
        f = SF[i];
        if(v0(ps[k][f]) !== v0(ns[k][f])){ one.was[f] = v0(ps[k][f]); one.now[f] = v0(ns[k][f]); }
      }
      d.changed.push(one);
    }
    for(k in ps){ if(!Object.prototype.hasOwnProperty.call(ns, k)) d.removed.push(k); }
    return d;
  }

  /* 履歴とごみ箱を書きます（保存が通ったあと。失敗しても本体には影響しません） */
  function writeLog(jobs){
    if(!jobs || !jobs.length) return;
    var who = me() || '(名前なし)', at = new Date().toISOString();
    var until = new Date(Date.now() + 30 * 86400000).toISOString();
    var batch = db().batch(), wrote = 0, i, j, k;

    for(i = 0; i < jobs.length; i++){
      var job = jobs[i], prev = job.prev || null;

      if(job.kind === 'del'){
        batch.set(logCol().doc(), { at:at, by:who, bld:job.id, name:(prev && prev.name) || job.name || job.id,
                                    kind:'物件を削除', note:'区画 ' + count(prev && prev.spots) + ' 件ごと' });
        batch.set(trashCol().doc(), { at:at, by:who, until:until, kind:'building',
                                      bld:job.id, name:(prev && prev.name) || job.id, data:prev || {} });
        wrote += 2;
        continue;
      }

      var d = diffDoc(prev, job.doc);
      if(!prev){
        batch.set(logCol().doc(), { at:at, by:who, bld:job.id, name:job.doc.name || job.id,
                                    kind:'物件を追加', note:'区画 ' + count(job.doc.spots) + ' 件' });
        wrote++;
        continue;
      }
      if(!d.fields.length && !d.added.length && !d.removed.length && !d.changed.length) continue;

      batch.set(logCol().doc(), {
        at:at, by:who, bld:job.id, name:job.doc.name || job.id, kind:'変更',
        fields:d.fields.slice(0, 20),
        added:d.added.slice(0, 50),
        removed:d.removed.slice(0, 50),
        changed:d.changed.slice(0, 40)
      });
      wrote++;

      for(j = 0; j < d.removed.length && j < 50; j++){
        k = d.removed[j];
        batch.set(trashCol().doc(), { at:at, by:who, until:until, kind:'spot',
                                      bld:job.id, name:job.doc.name || job.id, no:k,
                                      data:(prev.spots || {})[k] || {} });
        wrote++;
      }
      if(wrote > 400) break;                 /* 一度に書きすぎないように */
    }
    if(!wrote) return;
    batch.commit().then(function(){
      try{ console.log('[D] 履歴を残しました（' + wrote + ' 件）'); }catch(e){}
    }).catch(function(e){
      try{ console.warn('[D] 履歴を残せませんでした', e); }catch(x){}
    });
  }


  /* ---------- 画面：変更履歴とごみ箱 ---------- */
  function esc(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function jtime(iso){
    try{
      var d = new Date(iso);
      var p = function(x){ return (x < 10 ? '0' : '') + x; };
      return (d.getMonth()+1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }catch(e){ return String(iso || ''); }
  }
  function overlay(html){
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);' +
                       'display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto';
    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:14px;max-width:760px;width:100%;padding:18px 20px;' +
                        'box-shadow:0 10px 40px rgba(0,0,0,.3);font-size:14px;line-height:1.7';
    box.innerHTML = html;
    ov.appendChild(box);
    document.body.appendChild(ov);
    ov.addEventListener('click', function(ev){ if(ev.target === ov) ov.remove(); });
    return ov;
  }

  function lineOf(h){
    var t = [], i, c;
    if(h.kind === '物件を削除') return '物件ごと削除（' + esc(h.note || '') + '）';
    if(h.kind === '物件を追加') return '物件を追加（' + esc(h.note || '') + '）';
    if(h.added && h.added.length)   t.push('区画を追加 ' + esc(h.added.join('・')));
    if(h.removed && h.removed.length) t.push('<b style="color:#b91c1c">区画を削除 ' + esc(h.removed.join('・')) + '</b>');
    if(h.fields && h.fields.length) t.push('物件情報（' + esc(h.fields.join('・')) + '）');
    if(h.changed && h.changed.length){
      for(i = 0; i < h.changed.length && i < 8; i++){
        c = h.changed[i];
        var fs = [], f;
        for(f in c.now){
          if(!Object.prototype.hasOwnProperty.call(c.now, f)) continue;
          fs.push((SJ[f] || f) + '：' + esc(c.was[f] || '(空欄)') + ' → ' + esc(c.now[f] || '(空欄)'));
        }
        t.push('区画' + esc(c.no) + '　' + fs.join('／'));
      }
      if(h.changed.length > 8) t.push('ほか ' + (h.changed.length - 8) + ' 区画');
    }
    return t.length ? t.join('<br>　　') : '（変化なし）';
  }

  function showHistory(){
    var ov = overlay('<div style="font-size:17px;font-weight:800;margin-bottom:10px">変更履歴</div>' +
                     '<div id="pv-h-body">読み込んでいます…</div>' +
                     '<div style="margin-top:14px;text-align:right">' +
                     '<button id="pv-h-trash" style="font:inherit;padding:9px 16px;border:2px solid #111;background:#fff;border-radius:8px;cursor:pointer;margin-right:8px">ごみ箱を見る</button>' +
                     '<button id="pv-h-close" style="font:inherit;padding:9px 16px;border:0;background:#e4e4e7;border-radius:8px;cursor:pointer">閉じる</button></div>');
    ov.querySelector('#pv-h-close').onclick = function(){ ov.remove(); };
    ov.querySelector('#pv-h-trash').onclick = function(){ ov.remove(); showTrash(); };
    logCol().orderBy('at','desc').limit(120).get().then(function(qs){
      var h = [], rows = [];
      qs.forEach(function(d){ rows.push(d.data() || {}); });
      if(!rows.length){ ov.querySelector('#pv-h-body').innerHTML = 'まだ履歴がありません。<br>次に保存したときから残りはじめます。'; return; }
      for(var i = 0; i < rows.length; i++){
        var r = rows[i];
        h.push('<div style="border-bottom:1px solid #eee;padding:8px 0">' +
               '<div style="font-size:12px;color:#71717a">' + esc(jtime(r.at)) + '　' + esc(r.by || '') + '</div>' +
               '<div><b>' + esc(r.name || r.bld) + '</b>　' + lineOf(r) + '</div></div>');
      }
      ov.querySelector('#pv-h-body').innerHTML = h.join('');
    }).catch(function(e){
      ov.querySelector('#pv-h-body').textContent = '読み込めませんでした： ' + (e && e.message ? e.message : e);
    });
  }

  function showTrash(){
    var ov = overlay('<div style="font-size:17px;font-weight:800;margin-bottom:4px">ごみ箱</div>' +
                     '<div style="font-size:12px;color:#71717a;margin-bottom:10px">消したものを30日間とっておきます。【戻す】で元に戻せます。</div>' +
                     '<div id="pv-t-body">読み込んでいます…</div>' +
                     '<div style="margin-top:14px;text-align:right">' +
                     '<button id="pv-t-hist" style="font:inherit;padding:9px 16px;border:2px solid #111;background:#fff;border-radius:8px;cursor:pointer;margin-right:8px">履歴を見る</button>' +
                     '<button id="pv-t-close" style="font:inherit;padding:9px 16px;border:0;background:#e4e4e7;border-radius:8px;cursor:pointer">閉じる</button></div>');
    ov.querySelector('#pv-t-close').onclick = function(){ ov.remove(); };
    ov.querySelector('#pv-t-hist').onclick = function(){ ov.remove(); showHistory(); };
    trashCol().orderBy('at','desc').limit(150).get().then(function(qs){
      var h = [], ids = [];
      qs.forEach(function(d){
        var r = d.data() || {};
        ids.push(d.id);
        var what = (r.kind === 'building')
          ? ('物件ごと（区画 ' + count(r.data && r.data.spots) + ' 件）')
          : ('区画 ' + esc(r.no) + '　' + esc((r.data && r.data.user) || '(空欄)') +
             '　' + esc((r.data && r.data.room) || '') + '号室');
        h.push('<div style="border-bottom:1px solid #eee;padding:8px 0;display:flex;gap:10px;align-items:center">' +
               '<div style="flex:1"><div style="font-size:12px;color:#71717a">' + esc(jtime(r.at)) + '　' + esc(r.by || '') + '</div>' +
               '<div><b>' + esc(r.name || r.bld) + '</b>　' + what + '</div></div>' +
               '<button data-id="' + esc(d.id) + '" style="font:inherit;font-weight:700;padding:7px 14px;border:2px solid #111;background:#111;color:#fff;border-radius:8px;cursor:pointer">戻す</button></div>');
      });
      var body = ov.querySelector('#pv-t-body');
      body.innerHTML = ids.length ? h.join('') : 'ごみ箱は空です。';
      body.addEventListener('click', function(ev){
        var b = ev.target.closest ? ev.target.closest('button[data-id]') : null;
        if(!b) return;
        b.disabled = true; b.textContent = '戻しています…';
        restoreTrash(b.getAttribute('data-id'));
      });
    }).catch(function(e){
      ov.querySelector('#pv-t-body').textContent = '読み込めませんでした： ' + (e && e.message ? e.message : e);
    });
  }

  function restoreTrash(id){
    var ref = trashCol().doc(id);
    ref.get().then(function(d){
      if(!d.exists) throw new Error('見つかりませんでした');
      var r = d.data() || {};
      var bref = col().doc(r.bld);
      return db().runTransaction(function(tx){
        return tx.get(bref).then(function(sn){
          var now = sn.exists ? (sn.data() || {}) : null;
          if(r.kind === 'building'){
            if(now) throw new Error('その物件はもう存在します。個別に直してください。');
            var doc = r.data || {};
            doc.rev = 1; doc.updatedAt = new Date().toISOString(); doc.updatedBy = (me() || '(名前なし)') + '（ごみ箱から復元）';
            tx.set(bref, doc);
          }else{
            if(!now) throw new Error('その物件が見つかりません。');
            if(now.spots && now.spots[r.no]) throw new Error('区画 ' + r.no + ' はすでにあります。');
            var sp = now.spots || {};
            sp[String(r.no)] = r.data || {};
            now.spots = sp;
            now.rev = (now.rev || 0) + 1;
            now.updatedAt = new Date().toISOString();
            now.updatedBy = (me() || '(名前なし)') + '（ごみ箱から復元）';
            tx.set(bref, now);
          }
        });
      }).then(function(){ return ref.delete().catch(function(){}); });
    }).then(function(){
      try{ window.alert('戻しました。ページを読み込み直します。'); }catch(e){}
      try{ location.reload(); }catch(e){}
    }).catch(function(e){
      try{ window.alert('戻せませんでした。\n\n' + (e && e.message ? e.message : e)); }catch(x){}
    });
  }

  /* 設定メニューにボタンを足します */
  function addHistoryButton(){
    try{
      var menu = document.getElementById('settings-menu');
      if(!menu || document.getElementById('btn-pv-history')) return;
      var btn = document.createElement('button');
      btn.id = 'btn-pv-history';
      btn.textContent = '変更履歴・ごみ箱';
      btn.onclick = function(){
        if(typeof closeSettingsMenu === 'function') closeSettingsMenu();
        showHistory();
      };
      menu.appendChild(btn);
    }catch(e){}
  }
  try{
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addHistoryButton);
    else addHistoryButton();
    setTimeout(addHistoryButton, 1500);
  }catch(e){}
  try{ window.__pvHistory = showHistory; window.__pvTrash = showTrash; window.__pvRestore = restoreTrash; }catch(e){}


  /* ============================================================
   *  ㊺ 他の端末の変更を、開いたまま静かに取り込みます
   *
   *  1分おきに Firestore を見て、他の端末が直した物件だけを
   *  そっと最新にします。次の場合は何もしません（じゃまをしないため）。
   *    ・入力中（どこかの欄にカーソルがある）
   *    ・編集画面（モーダル）が開いている
   *    ・まだ保存していない直しが手元にある
   *    ・画面を見ていない（別のタブ）
   * ============================================================ */
  (function(){

    function busy(){
      try{
        if(document.hidden) return true;
        var a = document.activeElement;
        if(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName || '')) return true;
        if(typeof _hasUnsavedChanges !== 'undefined' && _hasUnsavedChanges) return true;
        if(typeof _autoPushInFlight  !== 'undefined' && _autoPushInFlight)  return true;
        var m = document.querySelectorAll('.modal, .overlay, .sheet, [id*="modal"], [class*="modal"]');
        for(var i = 0; i < m.length; i++){
          if(m[i].offsetParent !== null && m[i].getBoundingClientRect().height > 40) return true;
        }
      }catch(e){ return true; }
      return false;
    }

    function toast(n){
      try{
        var id = 'pv-sync-toast', el = document.getElementById(id);
        if(!el){
          el = document.createElement('div');
          el.id = id;
          el.style.cssText =
            'position:fixed;right:10px;bottom:44px;z-index:99997;background:rgba(22,101,52,.94);' +
            'color:#fff;font-weight:700;font-size:12px;padding:7px 13px;border-radius:16px;' +
            'box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none';
          document.body.appendChild(el);
        }
        el.textContent = '🔄 ' + n + ' 件の物件を最新にしました';
        el.style.opacity = '1';
        setTimeout(function(){ try{ el.style.transition = 'opacity .6s'; el.style.opacity = '0'; }catch(e){} }, 4000);
      }catch(e){}
    }

    /* いつ「全部読み」をしたか。1時間に1回だけにします */
    var _lastFull = 0;
    var _lastSync = 0;
    var FULL_EVERY = 3600000;      /* 1時間 */
    var MIN_GAP    = 60000;        /* 続けて読まない間隔（1分） */

    function quietSync(force){
      if(!_loaded || _tooOld || busy()) return;
      /* ★ v21）短いあいだに何度も読まないようにします。
         これまでは、ほかのタブから戻るたびに全部を読み直していました。
         1日に150回タブを行き来すると、それだけで1万回を超えます。 */
      var now = Date.now();
      if(!force && (now - _lastSync) < MIN_GAP) return;
      /* ★ v20：画面を見ていないときは読みません。
         PIVOT を開いたまま帰ると、夜中もずっと読み続けてしまい、
         3台で1日 64,548回（無料枠は50,000回）を超えていました。
         裏に回っているあいだ止めれば、開けっぱなしでも
         ふつうに8時間使ったのと同じ回数で収まります。
         画面に戻ったときに読み直す仕組みは、下にすでに入っています。 */
      try{ if(document.hidden) return; }catch(e){}
      try{ if(!firebase.auth().currentUser) return; }catch(e){ return; }
      _lastSync = now;

      /* ふだんは「直されたものだけ」を読みます。
         消された物件だけは、それでは見つからないので、
         ・小さな目印が変わっていたら（誰かが消した）すぐ全部を読みます
         ・念のため、1時間に1回も全部を読みます */
      var full = (now - _lastFull) > FULL_EVERY;
      var seen = '';
      try{ seen = String(localStorage.getItem(lastSeenKey()) || ''); }catch(e){ seen = ''; }
      if(!seen) full = true;
      /* ★ v24）手元が空なら、かならず全部を読み直します（契約と同じ理由） */
      try{
        var mineB = (typeof pbLoadAll === 'function') ? (pbLoadAll() || {}) : null;
        if(!mineB || count(mineB) === 0) full = true;
      }catch(e){ full = true; }

      (full ? Promise.resolve(true) : delChanged()).then(function(needFull){
        if(needFull) full = true;
        return (full ? readAll('様子見（全部読み）') : readSince(seen));
      }).then(function(fs){
        if(!fs) return;
        if(fs.cached) return;                    /* ★ v24）端末の控えから返ってきたものは、使いません */
        if(fs.partial !== true && count(fs.buildings) === 0) return;
        if(busy()) return;                       /* 読んでいる間に触りはじめたら、やめます */
        if(fs.partial !== true) _lastFull = Date.now();
        try{ if(fs.at) localStorage.setItem(lastSeenKey(), fs.at); }catch(e){}
        if(fs.partial === true && count(fs.buildings) === 0) return;   /* 何も直されていません */

        var mine = {};
        try{ mine = (typeof pbLoadAll === 'function') ? (pbLoadAll() || {}) : {}; }catch(e){ return; }
        var base = readMap(sigKey());
        var out = {}, id, changed = 0, mySig;

        for(id in mine){ if(Object.prototype.hasOwnProperty.call(mine, id)) out[id] = mine[id]; }

        var took = {};      /* ★ どの物件を取りこんだか。控えは、これだけそろえます */
        for(id in fs.buildings){
          if(!Object.prototype.hasOwnProperty.call(fs.buildings, id)) continue;
          if(Object.prototype.hasOwnProperty.call(mine, id)){
            try{ mySig = sig(toDoc(id, mine[id])); }catch(e){ continue; }
            if(mySig !== base[id]) continue;                 /* 手元に未保存の直しがある → 触りません */
            if(mySig === fs.sigs[id]){ took[id] = 1; continue; }   /* 同じ内容 */
          }
          out[id] = fs.buildings[id];
          took[id] = 1;
          changed++;
        }
        /* ★ v21）「ほかの端末で消された」の見分けは、
           全部を読んだときだけです。直されたぶんだけを読んだときにこれをすると、
           直されていない物件を「消された」と取りちがえて、全部消してしまいます。 */
        if(fs.partial !== true){
          for(id in mine){
            if(!Object.prototype.hasOwnProperty.call(mine, id)) continue;
            if(Object.prototype.hasOwnProperty.call(fs.buildings, id)) continue;
            if(base[id] === undefined) continue;               /* 元から知らない物件 → 触りません */
            try{ mySig = sig(toDoc(id, mine[id])); }catch(e){ continue; }
            if(mySig !== base[id]) continue;                   /* 手元で直しかけ → 触りません */
            delete out[id];                                    /* 他の端末で消された */
            changed++;
          }
        }

        if(!changed) return;
        if(busy()) return;

        try{ if(typeof pbSaveRaw === 'function') pbSaveRaw(out); }catch(e){ return; }
        /* ★★ 控えは「取りこんだ物件のぶんだけ」そろえます。
         *
         *  これまでは、届いたぶんの控えを丸ごと書き写していました。
         *  手元を残した物件まで、控えだけクラウドの内容になります。
         *  すると手元と控えが永久に食い違い、そのあと何度読み直しても
         *  「手元に未保存の直しがある」と誤解して、取りこまなくなります。
         *
         *  2台で使うと、しばらくして画面の内容がずれていく原因でした。 */
        var nr = readMap(revKey()), ns = readMap(sigKey()), nf = fprRead(), fid;
        for(fid in fs.buildings){
          if(!Object.prototype.hasOwnProperty.call(fs.buildings, fid)) continue;
          if(!took[fid]) continue;                          /* 手元を残した物件は、触りません */
          nr[fid] = fs.revs[fid];
          ns[fid] = fs.sigs[fid];
          try{ nf[fid] = fprOf(toDoc(fid, fs.buildings[fid])); }catch(e){}
        }
        if(fs.partial !== true){
          /* 全部を読んだときだけ、手元に無くなった物件の控えを落とします */
          for(fid in ns){
            if(!Object.prototype.hasOwnProperty.call(ns, fid)) continue;
            if(!Object.prototype.hasOwnProperty.call(out, fid)){
              delete ns[fid]; delete nr[fid]; delete nf[fid];
            }
          }
        }
        writeMap(revKey(), nr);
        writeMap(sigKey(), ns);
        fprWriteAll(nf);
        try{ if(typeof requestRender === 'function') requestRender('buildings'); }catch(e){}
        try{ console.log('[S] 他の端末の変更を取り込みました（' + changed + ' 件）'); }catch(e){}
        toast(changed);
      }).catch(function(){});
    }

    /* 「誰かが物件を消した」の目印だけを見ます。読むのは1回です。
       変わっていたら true（＝このあと全部を読みます）。 */
    function delChanged(){
      return metaRef().get().then(function(d){
        use('read', 1, '消したことの目印を見る');
        var at = '';
        try{ at = String((d.exists && (d.data() || {}).delAt) || ''); }catch(e){ at = ''; }
        var had = '';
        try{ had = String(localStorage.getItem(delKey()) || ''); }catch(e){ had = ''; }
        /* まだ誰も消していないときは「-」を控えます。
           そうしておかないと「一度も見ていない」と「見たが空だった」を
           見分けられず、はじめの1回の削除を取りこぼします。 */
        var cur = at || '-';
        if(cur === had) return false;
        try{ localStorage.setItem(delKey(), cur); }catch(e){}
        if(!had) return false;        /* はじめの1回は、ものさしを合わせるだけ */
        try{ console.log('[S] ほかの端末で物件が消されました。全部を読み直します'); }catch(e){}
        return true;
      }).catch(function(){ return false; });
    }

    /* ★ v19：さらに 5分ごと → 15分ごとにしました。
       5分ごとだと、3台で使うと1日 64,548回になり、
       無料枠（1日50,000回）をまた超えてしまいます。
       15分ごとなら 3台でも 26,916回で、枠の54%に収まります。

       ★ v16：60秒ごと → 5分ごとにしました。
       これまでは1分ごとに全物件（67件）を読み直していました。
       1台で8時間使うと約32,000回。3台なら1日10万回近くになり、
       Firestore の無料枠（1日5万回）を大きく超えます。
       実際 2026/09/06 に「429 Too Many Requests」が出はじめました。
       5分ごとなら1台あたり1日6,400回程度で収まります。
       ほかの端末の直しに気づくのが最大5分遅れますが、
       保存のときの衝突検知は別のしくみなので、安全性は変わりません。 */
    /* ★ オーナー一覧の読み直し（ここから）
     *
     *  これまで、下の自動読み直しは「物件」だけを見ていました。
     *  オーナーを読むのは、ページを開いたときの1回きりでした。
     *  そのため
     *    ・画面を開いたままにしていると、ほかの端末で直したオーナーが
     *      いつまでも出てこない
     *    ・物件の読み込みでつまずくと、オーナーの取り込みも道連れで飛ぶ
     *  の2つが起きていました。スマホでオーナーだけ古いままだったのは、これです。
     *
     *  ここは物件と切り離して、オーナーだけを見に行きます。
     *  読むのは1回だけ（1件の書類）なので、回数はほとんど増えません。   */
    var _lastOw = 0;
    function syncOws(force){
      var now = Date.now();
      if(!force && (now - _lastOw) < MIN_GAP) return;
      if(_tooOld || busy()) return;
      try{ if(document.hidden) return; }catch(e){}
      try{ if(!firebase.auth().currentUser) return; }catch(e){ return; }
      _lastOw = now;
      readOws().then(function(ow){
        if(!ow || !Array.isArray(ow.list) || !ow.list.length) return;
        var was = readMap(owRevK());
        if(Number(was.rev || 0) === Number(ow.rev || 0)){
          /* ★ 版番号が同じでも、見くらべる土台が無ければ、ここで作ります。
               土台が無いあいだは、どれをこの端末で直したのか分からないので、
               直しを活かせず「クラウドを立てる」古い動きに戻ってしまいます。
               このファイルを入れた直後の端末が、まさにその状態です。 */
          if(!owBaseRead()) owBaseWrite(ow.list);
          return;
        }
        if(busy()) return;                       /* 触りはじめていたら、やめます */
        owBaseWrite(ow.list);                    /* 見くらべる土台を控えます */
        /* applyCloudOwners は、受け取った中身の目印（_addedAt）を外します。
           指紋は外したあとで控えないと、次の保存が毎回「変わった」になり、
           端末どうしで送り合いになってしまいます。 */
        try{ if(typeof window.applyCloudOwners === 'function') window.applyCloudOwners(ow.list); }catch(e){}
        writeMap(owRevK(), { rev:ow.rev, sig:sig(ow.list) });
        try{ console.log('[E] オーナー一覧を最新にしました（' + ow.list.length + ' 件）'); }catch(e){}
      }).catch(function(){});
    }

    /* ★ 契約の読み直し
     *
     *  オーナーと同じで、契約もページを開いたときしか読んでいませんでした。
     *  PIVOT を開きっぱなしにしていると、ほかの人が入れた契約が
     *  いつまでも画面に出ません。予約中になった区画が空きに見えるので、
     *  同じ区画を二重に案内してしまうおそれがあります。
     *
     *  ふだんは「直された契約だけ」を読みます。契約が何件あっても1回です。
     *  消された契約は差分では分からないので、1時間に1回は全部を読みます。   */
    var _lastCt = 0, _lastCtFull = 0;
    /* 契約はめったに変わらないので、ほかのアプリから戻ったときの読み直しは
       5分に1回までにします。物件やオーナーは1分に1回です。
       ここを1分にすると、行き来のたびに読むぶんだけ回数が増えてしまいます。 */
    var CT_GAP = 300000;
    function syncCts(force){
      var now = Date.now();
      if(!force && (now - _lastCt) < CT_GAP) return;
      if(_tooOld || busy()) return;
      try{ if(document.hidden) return; }catch(e){}
      try{ if(!firebase.auth().currentUser) return; }catch(e){ return; }
      _lastCt = now;

      var seen = '';
      try{ seen = String(localStorage.getItem(ctSeenK()) || ''); }catch(e){ seen = ''; }
      var full = !seen || (now - _lastCtFull) > FULL_EVERY;

      /* ★★ v24）手元が空のときは、かならず全部を読み直します。
       *
       *  差分読みは「目印より、あとで直されたもの」しか返しません。
       *  何かの拍子に手元の契約が空になっても、目印だけは残るので、
       *  差分読みでは1件も返ってきません。空のまま、固まります。
       *
       *  9/13 にスマホがこうなりました。
       *  電波が悪くて消えたあと、開き直しても戻りませんでした。      */
      try{
        var mineNow = JSON.parse(localStorage.getItem(ctLS()) || '{}');
        if(!mineNow || count(mineNow) === 0) full = true;
      }catch(e){ full = true; }

      (full ? readCts() : readCtsSince(seen)).then(function(cs){
        if(!cs || !cs.map) return;
        /* ★★ v24）ここが、9/13 にスマホの契約が全部消えた原因です。
         *
         *  クラウドへ届かないとき、Firebase はエラーを出さずに
         *  端末の中の控えから「0件」を返します。
         *  その 0件 を「ほかの端末で全部消された」と取りちがえて、
         *  この端末の契約を、ぜんぶ消していました。
         *
         *  物件のほうには、前からこの守りがありました（様子見のところ）。
         *  契約にだけ、ありませんでした。物件が無事で契約だけ消えたのは、
         *  この1行の差です。                                            */
        if(cs.cached) return;                                  /* クラウドを確かめられていません */
        if(cs.partial !== true && count(cs.map) === 0) return;  /* 0件に見えるときは、さわりません */
        if(busy()) return;                       /* 触りはじめていたら、やめます */
        if(cs.partial !== true) _lastCtFull = Date.now();
        try{ if(cs.at) localStorage.setItem(ctSeenK(), cs.at); }catch(e){}

        var mine = {};
        try{ mine = JSON.parse(localStorage.getItem(ctLS()) || '{}'); }catch(e){ return; }
        if(!mine || typeof mine !== 'object') return;
        var base = readMap(ctSigK());
        var out = {}, id, changed = 0, mySig;
        var has = function(o, k){ return Object.prototype.hasOwnProperty.call(o, k); };

        for(id in mine){ if(has(mine, id)) out[id] = mine[id]; }

        for(id in cs.map){
          if(!has(cs.map, id)) continue;
          if(has(mine, id)){
            try{ mySig = sig(ctDoc(id, mine[id])); }catch(e){ continue; }
            if(mySig !== base[id]) continue;           /* 手元に、まだ送っていない直しがあります */
            if(mySig === cs.sigs[id]) continue;        /* 同じ中身です */
          }
          out[id] = cs.map[id];
          changed++;
        }

        /* 「ほかの端末で消された」の見分けは、全部を読んだときだけです。
           直されたぶんだけを読んだときにこれをすると、
           直っていない契約を「消された」と取りちがえて、全部消してしまいます。 */
        if(cs.partial !== true){
          for(id in mine){
            if(!has(mine, id)) continue;
            if(has(cs.map, id)) continue;
            if(base[id] === undefined) continue;       /* 元から知らない契約 → 触りません */
            try{ mySig = sig(ctDoc(id, mine[id])); }catch(e){ continue; }
            if(mySig !== base[id]) continue;           /* 手元で直しかけ → 触りません */
            delete out[id];
            changed++;
          }
        }

        if(!changed) return;
        if(busy()) return;
        try{ localStorage.setItem(ctLS(), JSON.stringify(out)); }catch(e){ return; }
        if(cs.partial === true){
          mergeMap(ctRevK(), cs.revs);
          mergeMap(ctSigK(), cs.sigs);
        }else{
          writeMap(ctRevK(), cs.revs);
          writeMap(ctSigK(), cs.sigs);
        }
        /* 契約の画面は、開くたびに置き場から読み直す作りです。
           いま契約の画面を見ている人のために、描き直しておきます。 */
        try{ if(typeof renderBoard      === 'function') renderBoard(); }catch(e){}
        try{ if(typeof renderStats      === 'function') renderStats(); }catch(e){}
        try{ if(typeof drawArchiveNotice === 'function') drawArchiveNotice(); }catch(e){}
        try{ console.log('[E] ほかの端末の契約を取り込みました（' + changed + ' 件）'); }catch(e){}
      }).catch(function(){});
    }
    try{ setInterval(function(){ syncCts(true); }, 900000); }catch(e){}
    try{ document.addEventListener('visibilitychange', function(){
      if(!document.hidden) setTimeout(function(){ syncCts(false); }, 2600);
    }); }catch(e){}
    try{ firebase.auth().onAuthStateChanged(function(u){
      if(u) setTimeout(function(){ syncCts(true); }, 5000);
    }); }catch(e){}
    try{ window.__pvSyncContracts = function(){ _lastCt = 0; syncCts(true); }; }catch(e){}

    try{ setInterval(function(){ syncOws(true); }, 900000); }catch(e){}
    try{ document.addEventListener('visibilitychange', function(){
      if(!document.hidden) setTimeout(function(){ syncOws(false); }, 2000);
    }); }catch(e){}
    try{ firebase.auth().onAuthStateChanged(function(u){
      if(u) setTimeout(function(){ syncOws(true); }, 4000);
    }); }catch(e){}
    try{ window.__pvSyncOwners = function(){ _lastOw = 0; syncOws(true); }; }catch(e){}
    /* PIVOT のロゴをタップしたとき（＝最新を取り込む）にも、オーナーを読みます。
       ロゴの取り込みは物件の読み込みを通るので、そこでつまずくと
       オーナーだけ古いままになっていました。 */
    try{
      var FP0 = window.forcePullLatest;
      if(typeof FP0 === 'function'){
        window.forcePullLatest = function(){
          var r;
          /* ★ ロゴを押すのは「いま最新をください」という操作です。
               30秒の使い回しは、ここでは使いません。
               使い回すと、ほかの端末が直した直後に押しても
               前の内容が出てしまいます。                          */
          try{ fsDrop(); }catch(e){}
          try{ r = FP0.apply(this, arguments); }catch(e){ r = null; }
          try{ _lastOw = 0; setTimeout(function(){ syncOws(true); }, 1200); }catch(e){}
          try{ _lastCt = 0; setTimeout(function(){ syncCts(true); }, 1600); }catch(e){}
          /* ★ クラウドを読めていないのに「✅ 最新です」と出ると、
               古い画面を最新だと思ってしまいます。正しく伝えます。 */
          try{ setTimeout(function(){
            if(_fsReadOk === false) status('error', '⚠️ クラウドを読めませんでした（古いままです）');
          }, 2200); }catch(e){}
          return r;
        };
      }
    }catch(e){}
    /* ★ オーナー一覧の読み直し（ここまで） */

    try{ setInterval(function(){ quietSync(true); }, 900000); }catch(e){}
    /* ★ v21）ほかのタブから戻ったときは、1分に1回までにします。
       これまでは戻るたびに全部を読み直していました。 */
    try{ document.addEventListener('visibilitychange', function(){
      if(!document.hidden) setTimeout(function(){ quietSync(false); }, 1500);
    }); }catch(e){}
    try{ window.__pvSyncNow = function(){ quietSync(true);
      _lastOw = 0; syncOws(true); _lastCt = 0; syncCts(true); }; }catch(e){}
  })();

  /* ---------- 古い画面かどうかを確かめます ---------- */
  function oldBar(){
    try{
      var id = 'pv-oldver-bar', el = document.getElementById(id);
      if(!_tooOld){ if(el && el.parentNode){ el.parentNode.removeChild(el); document.body.style.paddingTop = ''; } return; }
      if(!el){
        el = document.createElement('div');
        el.id = id;
        el.style.cssText =
          'position:fixed;left:0;right:0;top:0;z-index:100001;background:#b91c1c;color:#fff;' +
          'font-weight:800;font-size:14px;padding:10px 14px;text-align:center;cursor:pointer;' +
          'box-shadow:0 2px 8px rgba(0,0,0,.3)';
        el.onclick = function(){ try{ location.reload(true); }catch(e){ location.reload(); } };
        document.body.appendChild(el);
        try{ document.body.style.paddingTop = '40px'; }catch(e){}
      }
      el.textContent = '⚠️ この画面は古い版です。保存できません。ここを押して開き直してください。';
    }catch(e){}
  }

  function checkVer(){
    try{
      if(!firebase.auth().currentUser) return;
      db().collection('config').doc(INS).get().then(function(d){
        use('read', 1, '画面の版の見張り');
        var need = 0;
        try{ need = Number((d.exists && d.data() && d.data().minStore) || 0) || 0; }catch(e){ need = 0; }
        var old = (need > 0 && STORE_VER < need);
        if(old !== _tooOld){
          _tooOld = old;
          oldBar();
          try{ console.warn('[V] この画面の版 ' + STORE_VER + ' ／ 必要な版 ' + need +
                            ' → ' + (old ? '★古いので保存を止めます' : 'OK')); }catch(e){}
        }
      }).catch(function(){});
    }catch(e){}
  }
  try{ firebase.auth().onAuthStateChanged(function(u){ if(u) setTimeout(checkVer, 1200); }); }catch(e){}
  try{ setTimeout(function(){ tidyAhead('起動のとき'); }, 4000); }catch(e){}
  try{ setTimeout(checkVer, 3000); }catch(e){}
  /* ★ v21）10分ごと → 30分ごとにしました。
     この見張りは「古い画面で保存させない」ためのもので、
     こまめに見る必要はありません。 */
  try{ setInterval(checkVer, 30 * 60 * 1000); }catch(e){}
  try{ window.__pvCheckVer = checkVer; }catch(e){}

  /* ============================================================
   *  ㊿ 未送信の見張りと、自動の送り直し
   *
   *  【なぜ作ったか】
   *
   *  いちばん怖いのは「保存できていないのに、気づかないまま帰る」ことです。
   *  これまでは、送れなかったとき「⚠️ 同期失敗」と一瞬出るだけでした。
   *  次に何か操作すると、その表示は消えます。
   *  そして、つながっても自分からは送り直しませんでした。
   *
   *  【これから】
   *
   *  ・送れていないあいだ、画面の左下に赤い札を出しっぱなしにします
   *  ・回線が戻ったとき、画面に戻ったとき、決まった間かくで、
   *    自動で送り直します
   *  ・送れたら、札が消えます。消えたら送れた合図です
   *  ・札を押すと、その場で送り直します
   *
   *  【送り直すもの・送り直さないもの】
   *
   *  送り直す　： 通信が切れた／クラウドの回数切れ／読み込み前だった
   *              → 時間がたてば直るものです
   *  送り直さない： ぶつかった／ご自身がキャンセルした／古い画面
   *              → 人が決めないと、どうにもならないものです
   *              → 札は出したままにして、何をすればよいか書きます
   *
   *  ★ PIVOT は保存のたびに全部をまとめて送る作りなので、
   *    送り直しは「もう一度 保存する」だけで足ります。
   *    送れなかった1件だけを覚えておく必要がありません。
   * ============================================================ */
  (function(){
    var UKEY  = function(){ return pfx() + 'unsent'; };
    var BADGE = 'pv-unsent-badge';
    var _tries = 0, _tm = null;

    /* 時間がたてば直るもの＝送り直します */
    var AUTO = { net:1, quota:1, 'not-loaded':1 };
    /* 人が決めないと直らないもの＝札は出しますが、送り直しません */
    var WORD = {
      net        : ['⚠️ 保存できていません', '通信を確かめています。押すと、いま送り直します'],
      quota      : ['⚠️ 保存できていません', 'クラウドの1日の回数切れです。夕方4時すぎに自動で送ります'],
      'not-loaded':['⚠️ 保存できていません', '最新を読み込んでから送ります。押すと、いま送り直します'],
      conflict   : ['⚠️ 一部が保存できていません', 'ほかの人が先に保存しました。開き直して、入れ直してください'],
      local      : ['⚠️ 保存できていません', 'この端末の置き場がいっぱいです。写真を減らしてください'],
      other      : ['⚠️ 保存できていません', '押すと、いま送り直します']
    };

    function readU(){
      try{ var v = JSON.parse(localStorage.getItem(UKEY()) || 'null');
           return (v && typeof v === 'object') ? v : null; }catch(e){ return null; }
    }
    function writeU(o){
      try{ if(o) localStorage.setItem(UKEY(), JSON.stringify(o));
           else   localStorage.removeItem(UKEY()); }catch(e){}
    }
    function mark(kind){
      var u = readU() || { from:Date.now() };
      u.kind = kind || 'other';
      u.at   = Date.now();
      writeU(u); paint(); plan_();
      try{ console.warn('[U] 送れていません（' + u.kind + '）。札を出して、送り直します'); }catch(e){}
    }
    function clear_(){
      if(!readU()) return;
      writeU(null); _tries = 0;
      if(_tm){ clearTimeout(_tm); _tm = null; }
      paint();
      try{ console.log('[U] 送れました。札を消します'); }catch(e){}
    }
    function since(u){
      var m = Math.floor((Date.now() - (u.from || u.at || Date.now())) / 60000);
      if(m < 1) return '';
      if(m < 60) return '（' + m + '分まえから）';
      return '（' + Math.floor(m / 60) + '時間' + (m % 60) + '分まえから）';
    }

    function paint(){
      try{
        var u  = readU();
        var el = document.getElementById(BADGE);
        if(!u){ if(el && el.parentNode) el.parentNode.removeChild(el); return; }
        if(!document.body) return;
        if(!el){
          el = document.createElement('div');
          el.id = BADGE;
          el.style.cssText =
            'position:fixed;left:10px;bottom:44px;z-index:99998;max-width:min(340px,86vw);' +
            'background:#b91c1c;color:#fff;font-size:12px;line-height:1.5;font-weight:700;' +
            'padding:9px 13px;border-radius:12px;box-shadow:0 3px 12px rgba(0,0,0,.32);' +
            'cursor:pointer;white-space:normal;text-align:left';
          el.onclick = function(){ _tries = 0; go(true); };
          document.body.appendChild(el);
        }
        var w = WORD[u.kind] || WORD.other;
        el.innerHTML = '';
        var a = document.createElement('div'); a.textContent = w[0] + ' ' + since(u);
        var b = document.createElement('div');
        b.style.cssText = 'font-weight:500;font-size:11px;opacity:.92;margin-top:3px';
        b.textContent = w[1];
        el.appendChild(a); el.appendChild(b);
      }catch(e){}
    }

    /* 送り直すまでの待ち時間。だんだん長くします */
    function wait_(){
      var u = readU();
      if(u && u.kind === 'quota') return 600000;              /* 10分（4時まで待ちます） */
      var w = [30000, 60000, 120000, 300000, 600000];
      return w[Math.min(_tries, w.length - 1)];
    }
    function plan_(){
      var u = readU();
      if(_tm){ clearTimeout(_tm); _tm = null; }
      if(!u || !AUTO[u.kind]) return;
      _tm = setTimeout(function(){ _tm = null; go(false); }, wait_());
    }
    function go(byHand){
      var u = readU();
      if(!u) return;
      if(!byHand && !AUTO[u.kind]) return;
      try{ if(!firebase.auth().currentUser) { plan_(); return; } }catch(e){ plan_(); return; }
      try{ if(!navigator.onLine){ plan_(); return; } }catch(e){}
      _tries++;
      try{ console.log('[U] 送り直します（' + _tries + '回目）'); }catch(e){}
      try{ if(typeof window.__pushNow === 'function') window.__pushNow(); }catch(e){}
      plan_();
    }

    /* 保存の結果を見て、札を出したり消したりします */
    function note(r){
      try{
        if(r && r.ok === true){ clear_(); return; }
        var k = String((r && r.error) || '');
        if(k === 'conflict')        return mark('conflict');
        if(k === 'not-loaded')      return mark('not-loaded');
        if(k === 'old-version')     return;               /* 赤い帯が別に出ています */
        if(k === 'contracts-drop')  return;               /* ご自身が選んだ結果です */
        if(r && /取りやめ/.test(String(r.message || ''))) return;
        mark('net');
      }catch(e){}
    }
    function noteErr(e){
      try{
        if(isCloudQuota(e)) return mark('quota');
        if(isLocalQuota(e)) return mark('local');
      }catch(x){}
      mark('net');
    }
    try{ window.__pvUnsent = { mark:mark, clear:clear_, read:readU, retry:function(){ _tries = 0; go(true); } }; }catch(e){}

    /* 回線が戻ったとき・画面に戻ったとき・ログインしたときに、送り直します */
    try{ window.addEventListener('online', function(){ _tries = 0; go(false); }); }catch(e){}
    try{ document.addEventListener('visibilitychange', function(){
      if(!document.hidden) setTimeout(function(){ go(false); }, 3000);
    }); }catch(e){}
    try{ firebase.auth().onAuthStateChanged(function(u){
      if(u) setTimeout(function(){ paint(); go(false); }, 6000);
    }); }catch(e){}
    try{
      if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
      else paint();
      setTimeout(paint, 1500);
      setTimeout(plan_, 2000);
    }catch(e){}
    /* 出しっぱなしの札が、消え残らないように見張ります */
    try{ setInterval(paint, 30000); }catch(e){}

    try{ window.__pvNoteSave = note; window.__pvNoteErr = noteErr; }catch(e){}
  })();

  /* ---------- 出入口を包みます ---------- */
  try{
    var P0 = window.postToGas;
    if(typeof P0 === 'function'){
      _PRAW = P0;
      /* ============================================================
       *  ★ v23）契約の「削除」を、保存と同じ順番にします
       *
       *  contracts.js の deleteFromCloud は、押した瞬間に
       *  控えのスプレッドシートへ直接 fetch していました。
       *  包んでいる postToGas も通らないので、どの守りも効きません。
       *
       *  ここで上書きして、直通をふさぎます。
       *  （contracts.js より、この store.js があとに読まれます）
       *
       *  押したときにすることは、2つだけです。
       *    1. 消す相手の番号を控える
       *    2. あとは、いつもの保存にまかせる
       *
       *  いつもの保存が、クラウドから契約を消します。
       *  消えたことを確かめてから、控えの表の行を消します。
       * ============================================================ */
      try{
        window.deleteFromCloud = function(id){
          if(!id) return;
          ctDelQAdd(id);
          try{ console.log('[E] 契約 ' + id + ' の削除を控えました（クラウドで消えたら、控えの表も消します）'); }catch(e){}
        };
        /* ★ contracts.js（IIFE の中）から呼ぶ入口です。
             中の deleteFromCloud は window に出ていないので、
             外から差し替えることができません。
             そこで、contracts.js 側から、この mark を呼んでもらいます。 */
        window.__pvCtDel = {
          mark: function(id){ if(id) ctDelQAdd(id); },
          read: function(){ return ctDelQ(); },
          flush: function(){
            var u = '';
            try{ u = (typeof getCloudUrl === 'function') ? getCloudUrl() : ''; }catch(e){ u = ''; }
            return flushCtDel(_PRAW, u);
          }
        };
      }catch(e){}
      window.postToGas = function(url, body, timeoutMs){
        var act = body && body.action;
        if(_tooOld && (act === 'save' || act === 'uploadImage' || act === 'deleteImage' || act === 'deleteContract')){
          status('error', '⚠️ この画面は古い版です（保存しませんでした）');
          try{
            window.alert('この画面は古い版のままです。\n\n' +
                         'そのまま保存すると、直したはずの内容が元に戻ることがあります。\n' +
                         'ページを開き直してから、もう一度お願いします。');
          }catch(e){}
          return Promise.resolve({ ok:false, error:'old-version', message:'古い画面のため保存しませんでした' });
        }
        if(act === 'saveBuildings' || act === 'saveContractsOnly' || act === 'saveOwnersOnly'){
          return onSide(P0, url, body, timeoutMs, act);
        }
        if(act === 'load'){
          return Promise.resolve(onLoad(P0, url, body, timeoutMs)).then(function(r){
            /* 前に消しそこねた契約が残っていれば、ここでも片づけます */
            try{ flushCtDel(P0, url); }catch(e){}
            return r;
          });
        }
        if(act === 'save'){
          /* ★ 保存の結果を見て、未送信の札を出したり消したりします */
          return Promise.resolve(onSave(P0, url, body, timeoutMs)).then(function(r){
            try{ if(typeof window.__pvNoteSave === 'function') window.__pvNoteSave(r); }catch(e){}
            return r;
          }, function(e){
            try{ if(typeof window.__pvNoteErr === 'function') window.__pvNoteErr(e); }catch(x){}
            throw e;
          });
        }
        return P0(url, body, timeoutMs);
      };
    }
  }catch(e){}

  /* ============================================================
   *  だれが開いているか（◯◯さんも開いています）
   * ============================================================ */
  (function(){
    var idKey = pfx() + 'device_id';
    var myId = '';
    try{
      myId = localStorage.getItem(idKey) || '';
      if(!myId){ myId = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); localStorage.setItem(idKey, myId); }
    }catch(e){ myId = 'd' + Math.random().toString(36).slice(2, 9); }

    function pcol(){ return db().collection(INS).doc('presence').collection('devices'); }

    /* ★ v21）1分ごと → 3分ごとにしました。
       この合図は、書くたびに、開いているすべての端末へ届きます。
       3台で使うと 1回の書き込みが3回の読み込みになるので、
       1分ごとだと1日あたり数千回ぶんを、ここだけで使っていました。 */
    function beat(){
      try{
        if(!firebase.auth().currentUser) return;
        if(document.hidden) return;
        pcol().doc(myId).set({ name:(me() || '(名前なし)'), at:Date.now() }).catch(function(){});
        use('write', 1, 'だれが編集中かの合図');
      }catch(e){}
    }
    /* 画面を閉じるときは、自分の合図を片づけます。
       片づけないと古い端末の分がたまり続け、開くたびに全部を読むことになります。 */
    function bye(){
      try{
        if(!firebase.auth().currentUser) return;
        pcol().doc(myId).delete().catch(function(){});
      }catch(e){}
    }

    /* 画面のじゃまをしないよう、右下に小さく出します。
       上に貼ると、ログアウトや設定のボタンに重なってしまいます。 */
    function show(list){
      try{
        var id = 'pv-others-bar', el = document.getElementById(id);
        if(!list.length){ if(el && el.parentNode) el.parentNode.removeChild(el); return; }
        if(!el){
          el = document.createElement('div');
          el.id = id;
          el.style.cssText =
            'position:fixed;right:10px;bottom:10px;z-index:99998;background:rgba(29,78,216,.92);' +
            'color:#fff;font-weight:700;font-size:12px;padding:6px 12px;border-radius:16px;' +
            'box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none;max-width:60vw;' +
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
          document.body.appendChild(el);
        }
        el.textContent = '👥 ' + list.join('・') + ' も編集中';
      }catch(e){}
    }

    function watch(){
      try{
        if(!firebase.auth().currentUser) return;
        pcol().onSnapshot(function(qs){
          var now = Date.now(), list = [];
          qs.forEach(function(d){
            if(d.id === myId) return;
            var v = d.data() || {};
            if(now - (v.at || 0) < 420000) list.push(v.name || '(名前なし)');
          });
          use('read', Math.max(qs.size || 0, 1), 'だれが編集中かを見る');
          show(list);
        }, function(){});
      }catch(e){}
    }

    try{ firebase.auth().onAuthStateChanged(function(u){ if(u){ beat(); setTimeout(watch, 600); } }); }catch(e){}
    try{ setInterval(beat, 180000); }catch(e){}
    /* 戻ってくるたびに合図を書くと、そのぶん全端末が読み直します。
       前の合図から3分たっているときだけにします。 */
    var _lastBeat = 0;
    try{ document.addEventListener('visibilitychange', function(){
      if(document.hidden){ return; }
      var n = Date.now();
      if(n - _lastBeat < 180000) return;
      _lastBeat = n; beat();
    }); }catch(e){}
    try{ window.addEventListener('pagehide', bye); }catch(e){}
  })();

  /* ============================================================
   *  ㊻ この端末の置き場（localStorage）のお掃除
   *
   *  iPhone / Safari は「この端末に残しておける量」に上限があります
   *  （おおむね 5MB）。しかも irelife.github.io の中にある
   *  PIVOT2・PIVOT3・入居チェックは、その置き場を一緒に使います。
   *  いっぱいになると保存のときに「Quota exceeded.（量が上限を超えました）」
   *  と出て、保存できません。
   *  ここでは、何がどれだけ使っているかを見られるようにし、
   *  いっぱいのときは、消しても困らない控えを片付けます。
   * ============================================================ */
  function lsList(){
    var out = [], i, k, v, tot = 0;
    try{
      for(i = 0; i < localStorage.length; i++){
        k = localStorage.key(i);
        v = localStorage.getItem(k);
        if(v === null) v = '';
        out.push({ key:k, chars:(k.length + v.length) });
        tot += (k.length + v.length);
      }
    }catch(e){}
    out.sort(function(a, b){ return b.chars - a.chars; });
    return { list:out, total:tot };
  }
  function kb(chars){ return (chars * 2 / 1024).toFixed(0) + 'KB'; }

  /* 消しても困らないもの（また作り直されるもの）を片付けます。
     物件・区画・契約・オーナーには、いっさい手を触れません。 */
  var TIDY_SUFFIX = [
    'emergency_backup',                 /* 起動のたびに作り直される控え */
    'rent_owner_send_detail_v1',        /* 家賃明細の仕分け（PDFを入れ直せば作り直せます） */
    'rent_owner_send_history_v1'        /* 送信履歴（送ったメールそのものは消えません） */
  ];
  /* 名前が日付で変わるもの。日ごとの控え（1件686KB）と、戻す前の控え。
     どちらも Firestore・ドライブ・スプレッドシートに同じものがあります。 */
  var TIDY_RE = /(_snap_\d{8}|_prerestore_backup|_fs_mirror)$/;
  function tidy(){
    var freed = 0, hit = [], r = lsList(), i, j, k;
    for(i = 0; i < r.list.length; i++){
      k = r.list[i].key;
      if(TIDY_RE.test(k)){
        try{ localStorage.removeItem(k); freed += r.list[i].chars; hit.push(k); }catch(e){}
        continue;
      }
      for(j = 0; j < TIDY_SUFFIX.length; j++){
        if(k.length >= TIDY_SUFFIX[j].length &&
           k.slice(-TIDY_SUFFIX[j].length) === TIDY_SUFFIX[j]){
          try{ localStorage.removeItem(k); freed += r.list[i].chars; hit.push(k); }catch(e){}
          break;
        }
      }
    }
    try{ if(hit.length) console.log('[F] 置き場のお掃除：' + hit.length + ' 件 / ' + kb(freed) + ' 分あけました', hit); }catch(e){}
    return { freed:freed, keys:hit };
  }

  /* ★ 先回りのお掃除
     満杯になってから「保存できませんでした」と出すのでは遅すぎます。
     仕事の途中で止まるのがいちばん困るからです。
     そこで、危なくなってきたら、ぶつかる前に自分で片付けます。

     ここで捨てるのは「起動のたびに作り直される控え」だけです。
     物件・区画・契約・オーナー、送信履歴、明細の仕分けには手を触れません。 */
  var TIDY_MARK = 1200000;                    /* 文字数。iPhone では およそ2.4MB にあたります */
  var SOFT_KEYS = ['emergency_backup'];       /* 消しても、次に開いたときに作り直されるもの */
  /* 先回りのお掃除では、日ごとの控えも対象にします（1件686KBあるため） */
  /* _fs_mirror は、いちばん最初の store.js が使っていた控えです。
     いまの版はまったく使いません（432KB＋303KB のまま残っていました）。 */
  var SOFT_RE   = /(_snap_\d{8}|_prerestore_backup|_fs_mirror)$/;

  /* いま、これだけの大きさを書き込めるか、実際に試してみます。
     上限が何MBかはブラウザによって違い、数え方（文字か、バイトか）も違います。
     数字で見積もるより、試して確かめるほうが確実です。
     書けたらすぐ消すので、置き場は増えません。 */
  /* 実際に書きこむものは、物件で 337KB、契約で 273KB あります。
     60KB で試しても「書ける」と出てしまい、本番でぶつかっていました。
     余裕をみて 500KB で試します。 */
  function canWrite(chars){
    var k = '__pv_probe', n = chars || 250000, ok2 = false;
    try{
      localStorage.setItem(k, new Array(n + 1).join('x'));
      ok2 = true;
    }catch(e){ ok2 = false; }
    try{ localStorage.removeItem(k); }catch(e){}
    return ok2;
  }

  function tidySoft(){
    var r = lsList(), freed = 0, i, j, k;
    for(i = 0; i < r.list.length; i++){
      k = r.list[i].key;
      if(SOFT_RE.test(k)){
        try{ localStorage.removeItem(k); freed += r.list[i].chars; }catch(e){}
        continue;
      }
      for(j = 0; j < SOFT_KEYS.length; j++){
        if(k.length >= SOFT_KEYS[j].length && k.slice(-SOFT_KEYS[j].length) === SOFT_KEYS[j]){
          try{ localStorage.removeItem(k); freed += r.list[i].chars; }catch(e){}
          break;
        }
      }
    }
    return freed;
  }

  /* 危なければ片付けます。戻り値は「片付けたかどうか」。 */
  function tidyAhead(where){
    try{
      var r = lsList();
      /* 「大きくなってきた」か「もう書けない」かのどちらかで動きます。
         後者があるので、上限が何MBの端末でも取りこぼしません。 */
      var big  = (r.total >= TIDY_MARK);
      var full = !canWrite();
      if(!big && !full){
        try{ console.log('[F] 置き場 ' + kb(r.total) + '（' + where + '）'); }catch(e){}
        return false;
      }
      var freed = tidySoft();
      var after = lsList();
      try{
        console.warn('[F] 置き場 ' + kb(r.total) + '（' + (full ? 'もう書けない状態' : '大きくなってきた') + '）。' +
                     kb(freed) + ' 分を先に片付けました（いま ' + kb(after.total) + '）／' + where);
      }catch(e){}
      /* 片付けても、まだ書けないときは、保存が止まる前に知らせます */
      if(!canWrite()){
        status('error', '⚠️ この端末の置き場がいっぱいです');
        try{ console.warn('[F] 片付けても足りません（' + kb(after.total) + '）。__pvStorage() で内訳を見てください'); }catch(e){}
        try{
          window.alert('この端末に残しておける量が、いっぱいになりました。\n\n' +
                       '入力した内容は消えていませんが、このままでは保存でつまずきます。\n\n' +
                       '同じ irelife.github.io の中の別のアプリ（入居チェックなど）が\n' +
                       '場所を使っていることがあります。\n' +
                       'Safari の 設定 → 履歴とWebサイトデータを消去 で空けられます。\n' +
                       '（PIVOT のデータはクラウドにあるので、消えません）');
        }catch(e){}
      }
      return true;
    }catch(e){ return false; }
  }

  /* 上限にぶつかったときの言い方 */
  /* ★ v18：ここを取り違えていました。
     Firestore が1日の無料枠を使い切ったときも「Quota exceeded」と言ってきます。
     それを「端末の置き場がいっぱい」と読み違え、
     端末を掃除しても直らない、という遠回りをしていました（2026/09/06）。
     いまは、どちらなのかをはっきり見分けます。 */

  /* Firestore 側の使いすぎ（1日の無料枠切れ・混みすぎ） */
  function isCloudQuota(e){
    var code = '';
    var name = '';
    var msg  = '';
    try{ code = String((e && e.code) || ''); }catch(x){}
    try{ name = String((e && e.name) || ''); }catch(x){}
    try{ msg  = String((e && e.message) || ''); }catch(x){}
    if(code === 'resource-exhausted') return true;
    if(/FirebaseError/i.test(name) && /quota|exhaust|429|too many/i.test(msg + code)) return true;
    return /resource-exhausted|too many requests|\b429\b/i.test(msg);
  }

  /* この端末の置き場がいっぱい（localStorage） */
  function isLocalQuota(e){
    var name = '', msg = '', code = '';
    try{ name = String((e && e.name) || ''); }catch(x){}
    try{ msg  = String((e && e.message) || ''); }catch(x){}
    try{ code = String((e && e.code) || ''); }catch(x){}
    if(isCloudQuota(e)) return false;                       /* クラウド側なら、ここでは無い */
    if(/QuotaExceededError|NS_ERROR_DOM_QUOTA/i.test(name)) return true;
    if(code === '22' || code === '1014') return true;
    /* 名前が取れないときは、実際に書けるか試して決めます */
    if(/quota|exceeded/i.test(msg)) return !canWrite();
    return false;
  }

  function cloudMsg(){
    return 'クラウド（Firestore）の、1日に読み書きできる回数を使い切りました。\n\n' +
           '端末やデータの故障ではありません。入力した内容も消えていません。\n\n' +
           '【どうなるか】\n' +
           '　・回数は毎日 夕方4時ごろ（日本時間）に元に戻ります\n' +
           '　・それまでは、この画面の保存はクラウドまで届きません\n\n' +
           '【どうすれば】\n' +
           '　・急ぎでなければ、夕方4時すぎにもう一度 保存してください\n' +
           '　・毎日この時間に出るようなら、無料枠が足りていません。\n' +
           '　　Firebase の料金プランを見直す必要があります（担当者へご連絡ください）';
  }
  /* いま何KBまでなら書けるかを、実際に試して測ります。
     上限が何MBかはブラウザによって違うので、推測ではなく実測します。 */
  function roomLeft(){
    var sizes = [1000000, 500000, 250000, 100000, 50000, 20000, 5000], i;
    for(i = 0; i < sizes.length; i++){ if(canWrite(sizes[i])) return kb(sizes[i]) + ' 以上'; }
    return '5KB 未満';
  }
  function quotaMsg(){
    var r = lsList(), top = [], i;
    for(i = 0; i < r.list.length && i < 5; i++) top.push('  ・' + r.list[i].key + '  ' + kb(r.list[i].chars));
    return 'この端末に残しておける量がいっぱいです。\n' +
           'いまの使用量は およそ ' + kb(r.total) + ' ／ あと書けるのは ' + roomLeft() + ' です。\n\n' +
           '多いものから5つ：\n' + top.join('\n') + '\n\n' +
           '入力した内容は消えていません。\n' +
           '「閉じる」を押したあと、もう一度 保存を押してください（自動で場所をあけました）。';
  }

  try{
    window.__pvStorage = function(){
      var r = lsList(), i;
      try{ console.log('置き場ぜんぶで およそ ' + kb(r.total)); }catch(e){}
      for(i = 0; i < r.list.length; i++){
        try{ console.log('  ' + kb(r.list[i].chars) + '  ' + r.list[i].key); }catch(e){}
      }
      return r;
    };
    window.__pvTidy = function(){ var t = tidy(); try{ window.alert('およそ ' + kb(t.freed) + ' 分あけました。'); }catch(e){} return t; };
  }catch(e){}

  /* ---------- 確認用 ---------- */
  try{
    window.__d1Info = function(){
      return { instance:INS, device:(me() || '(名前なし)'),
               rev:readMap(revKey()), buildings:count(readMap(revKey())) };
    };
    window.__d1Reload = function(){ try{ location.reload(); }catch(e){} };
  }catch(e){}

  try{ console.log('[D] store.js v20 起動：Firestore が正 ／ 端末 ' + (me() || '(名前なし)')); }catch(e){}
})();
