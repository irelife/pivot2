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
  if(!ok){ try{ console.warn('[D] Firestore が読み込めていないので、従来どおり動きます'); }catch(e){} return; }

  /* ---------- 共通 ---------- */
  function pfx(){ return (typeof insPrefix === 'function') ? insPrefix() : 'pivot_'; }
  var INS = pfx().replace(/_+$/, '') || 'pivot';
  function db(){ return firebase.firestore(); }
  function col(){ return db().collection(INS).doc('data').collection('buildings'); }
  function revKey(){ return pfx() + 'fs_rev';  }   /* 物件ごとの版番号 */
  function ctKey2(){ return pfx() + 'last_ct'; }   /* 最後に見た 契約／オーナー の件数 */
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
  function sig(x){
    try{ return JSON.stringify(canon(x)); }catch(e){ return String(Math.random()); }
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

  var _loaded = false;   /* この画面で Firestore から読み込めたか */

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
  function readAll(){
    return col().get().then(function(qs){
      var b = {}, revs = {}, sigs = {};
      qs.forEach(function(doc){
        var d = doc.data() || {}, id = doc.id;
        b[id]    = fromDoc(d);
        revs[id] = d.rev || 0;
        sigs[id] = sig(toDoc(id, b[id]));
      });
      return { buildings:b, revs:revs, sigs:sigs };
    }).catch(function(e){
      try{ console.warn('[D] Firestore を読めませんでした', e); }catch(x){}
      return null;
    });
  }
  function count(o){ var n = 0, k; for(k in (o||{})) if(Object.prototype.hasOwnProperty.call(o,k)) n++; return n; }
  function status(kind, msg){ try{ if(typeof setSyncStatus === 'function') setSyncStatus(kind, msg); }catch(e){} }

  /* ============================================================
   *  読み込み：Firestore の内容に差し替えます
   * ============================================================ */
  function onLoad(P, url, body, t){
    var gas = Promise.resolve(P(url, body, t)).catch(function(e){ return { ok:false, message:String(e && e.message || e) }; });
    return Promise.all([gas, readAll()]).then(function(a){
      var r = a[0], fs = a[1];
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
      r.payload.buildings = fs.buildings;
      r.buildingCount     = n;
      _loaded = true;
      try{
        var pc = r.payload.contracts, po = r.payload.owners;
        var nc = (pc && typeof pc === 'object') ? count(pc) : -1;
        var no = Array.isArray(po) ? po.length : -1;
        if(nc >= 0 || no >= 0) writeMap(ctKey2(), { ct:nc, ow:no, at:Date.now() });
      }catch(e){}
      /* uifix.js の「両方を残す」合体を止めます。
         あれは消したものを足し戻すので、わざと消した区画が復活します。 */
      try{ window.__fsPrimary = true; }catch(e){}
      writeMap(revKey(), fs.revs);
      writeMap(sigKey(), fs.sigs);
      try{ console.log('[D] 読み込み：Firestore から物件 ' + n + ' 件'); }catch(e){}
      return r;
    });
  }

  /* ============================================================
   *  保存：変わった物件だけ。先を越されていたら止めます
   * ============================================================ */
  function plan(buildings){
    var revs = readMap(revKey()), sigs = readMap(sigKey());
    var changed = [], removed = [], id, d, s;
    for(id in buildings){
      if(!Object.prototype.hasOwnProperty.call(buildings, id)) continue;
      d = toDoc(id, buildings[id]);
      s = sig(d);
      if(sigs[id] !== s) changed.push({ id:id, doc:d, sig:s, base:(revs[id] || 0), name:(d.name || id) });
    }
    var known = count(revs), here = count(buildings);
    if(known >= 3 && here < known * 0.5){
      /* 手元が極端に少ない＝読み込みが途中で止まった等。消す判断はしません。 */
      try{ console.warn('[D] 手元の物件が少ないため、削除の判定を見送りました ' + here + ' < ' + known); }catch(e){}
      return { changed:changed, removed:[] };
    }
    for(id in revs){
      if(!Object.prototype.hasOwnProperty.call(revs, id)) continue;
      if(!Object.prototype.hasOwnProperty.call(buildings, id)) removed.push({ id:id, base:(revs[id] || 0), name:id });
    }
    return { changed:changed, removed:removed };
  }

  /* 版番号の控えが無いまま保存すると、全物件が衝突扱いになってしまいます。
     そうならないよう、先に Firestore を読んで土台を作ります。 */
  function ensureBase(){
    if(count(readMap(revKey())) > 0) return Promise.resolve(true);
    return readAll().then(function(fs){
      if(!fs) return false;
      writeMap(revKey(), fs.revs);
      writeMap(sigKey(), fs.sigs);
      try{ console.log('[D] 版番号の土台を作りました（' + count(fs.revs) + ' 件）'); }catch(e){}
      return true;
    });
  }

  function commit(pl){
    return db().runTransaction(function(tx){
      var jobs = [], i, c, r;
      for(i = 0; i < pl.changed.length; i++){
        c = pl.changed[i];
        jobs.push({ kind:'set', id:c.id, name:c.name, base:c.base, doc:c.doc, sig:c.sig, ref:col().doc(c.id) });
      }
      for(i = 0; i < pl.removed.length; i++){
        r = pl.removed[i];
        jobs.push({ kind:'del', id:r.id, name:r.name, base:r.base, ref:col().doc(r.id) });
      }
      var gets = [];
      for(i = 0; i < jobs.length; i++) gets.push(tx.get(jobs[i].ref));
      return Promise.all(gets).then(function(snaps){
        var bad = [], j, cur, d;
        for(j = 0; j < jobs.length; j++){
          cur = snaps[j].exists ? ((snaps[j].data() || {}).rev || 0) : 0;
          if(cur !== jobs[j].base){
            bad.push({ name:jobs[j].name, by:(snaps[j].exists ? ((snaps[j].data() || {}).updatedBy || '') : '') });
          }
        }
        if(bad.length){
          var e = new Error('conflict'); e.__conflict = bad; throw e;
        }
        for(j = 0; j < jobs.length; j++){
          if(jobs[j].kind === 'del'){ tx.delete(jobs[j].ref); continue; }
          d = jobs[j].doc;
          d.rev       = jobs[j].base + 1;
          d.updatedAt = new Date().toISOString();
          d.updatedBy = me() || '(名前なし)';
          tx.set(jobs[j].ref, d);
        }
        return jobs;
      });
    });
  }

  function tellConflict(bad){
    var names = [], i;
    for(i = 0; i < bad.length && i < 5; i++) names.push('・' + bad[i].name + (bad[i].by ? '（' + bad[i].by + 'さんが保存）' : ''));
    status('error', '⚠️ 他の人が先に保存しました（保存していません）');
    var msg = 'ほかの人が先に保存したため、この内容は保存できませんでした。\n\n' +
              names.join('\n') + (bad.length > 5 ? '\n・ほか ' + (bad.length - 5) + ' 件' : '') + '\n\n' +
              'あなたの入力は、この端末に残っています。\n' +
              '【OK】を押すと最新を読み込みます。そのあと、もう一度入力してください。';
    var go = false;
    try{ go = window.confirm(msg); }catch(e){ go = false; }
    if(go){ try{ location.reload(); }catch(e){} }
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

  function onSave(P, url, body, t){
    var bl = body && body.payload && body.payload.buildings;
    if(!bl || typeof bl !== 'object') return P(url, body, t);   /* 形が違えば従来どおり */

    var lost = keepsContracts(body);
    if(lost){
      status('error', '⚠️ 契約が大きく減る保存を止めました');
      try{ console.warn('[D] 契約／オーナーが激減する保存を止めました\n' + lost); }catch(e){}
      try{
        window.alert('保存を止めました。\n\n' +
                     'この保存で、次のものが大きく減ります。\n\n' + lost + '\n' +
                     'この端末が古い内容を持っている可能性があります。\n' +
                     'ページを開き直して、最新を読み込んでください。');
      }catch(e){}
      return Promise.resolve({ ok:false, error:'contracts-drop', message:'契約が大きく減る保存を止めました' });
    }

    if(_loaded){
      return ensureBase().then(function(){ return saveNow(P, url, body, t, bl); })
                         .catch(function(){ return P(url, body, t); });
    }

    /* ★ まだ一度も読み込んでいない状態での保存が、いちばん危ないところです。
       古い内容を持ったままの端末が保存すると、
       　・消した区画が復活する（9/5 に実際に起きたのはこれ）
       　・他の人の修正が消える
       のどちらも起こります。増える向きも減る向きも、どちらも危険です。
       そこで「読み込む前に、中身が変わる保存」は一切通しません。 */
    return readAll().then(function(fs){
      if(!fs || count(fs.buildings) === 0) return P(url, body, t);   /* 移行前・通信不可 → 従来どおり */
      writeMap(revKey(), fs.revs);
      writeMap(sigKey(), fs.sigs);
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
    }).catch(function(){ return P(url, body, t); });
  }

  function saveNow(P, url, body, t, bl){
    var pl;
    try{ pl = plan(bl); }catch(e){ return P(url, body, t); }

    /* たくさん消えるときだけ、念のため確認します */
    if(pl.removed.length >= 20){
      var okDel = true;
      try{
        okDel = window.confirm('この保存で ' + pl.removed.length + ' 件の物件が消えます。\n\n' +
                               '本当に消してよろしいですか？\n（心当たりがなければ「キャンセル」を選んでください）');
      }catch(e){ okDel = false; }
      if(!okDel){
        status('idle', '');
        return Promise.resolve({ ok:false, message:'保存を取りやめました' });
      }
    }

    var work = (pl.changed.length || pl.removed.length) ? commit(pl) : Promise.resolve([]);

    return work.then(function(jobs){
      var revs = readMap(revKey()), sigs = readMap(sigKey()), i;
      for(i = 0; i < jobs.length; i++){
        if(jobs[i].kind === 'del'){ delete revs[jobs[i].id]; delete sigs[jobs[i].id]; }
        else { revs[jobs[i].id] = jobs[i].base + 1; sigs[jobs[i].id] = jobs[i].sig; }
      }
      writeMap(revKey(), revs); writeMap(sigKey(), sigs);
      try{
        console.log('[D] 保存：更新 ' + pl.changed.length + ' 件 / 削除 ' + pl.removed.length + ' 件');
      }catch(e){}
      return readAll();
    }).then(function(fs){
      /* スプレッドシートへは Firestore の内容を送ります（両者が必ず一致します） */
      if(fs && count(fs.buildings) > 0){
        body.payload.buildings = fs.buildings;
        writeMap(revKey(), fs.revs);
        writeMap(sigKey(), fs.sigs);
      }
      return P(url, body, t);
    }).catch(function(e){
      if(e && e.__conflict){
        tellConflict(e.__conflict);
        return { ok:false, error:'conflict', message:'他の人が先に保存しました' };
      }
      status('error', '⚠️ 保存できませんでした');
      try{
        window.alert('保存できませんでした。\n\n' +
                     '入力した内容はこの端末に残っています。\n' +
                     'ネットにつながっているか確認して、もう一度お試しください。\n\n' +
                     '（' + (e && e.message ? e.message : e) + '）');
      }catch(x){}
      return { ok:false, error:String(e && e.message || e) };
    });
  }

  /* ---------- 出入口を包みます ---------- */
  try{
    var P0 = window.postToGas;
    if(typeof P0 === 'function'){
      window.postToGas = function(url, body, timeoutMs){
        var act = body && body.action;
        if(act === 'load') return onLoad(P0, url, body, timeoutMs);
        if(act === 'save') return onSave(P0, url, body, timeoutMs);
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

    function beat(){
      try{
        if(!firebase.auth().currentUser) return;
        if(document.hidden) return;
        pcol().doc(myId).set({ name:(me() || '(名前なし)'), at:Date.now() }).catch(function(){});
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
            if(now - (v.at || 0) < 120000) list.push(v.name || '(名前なし)');
          });
          show(list);
        }, function(){});
      }catch(e){}
    }

    try{ firebase.auth().onAuthStateChanged(function(u){ if(u){ beat(); setTimeout(watch, 600); } }); }catch(e){}
    try{ setInterval(beat, 60000); }catch(e){}
    try{ document.addEventListener('visibilitychange', function(){ if(!document.hidden) beat(); }); }catch(e){}
  })();

  /* ---------- 確認用 ---------- */
  try{
    window.__d1Info = function(){
      return { instance:INS, device:(me() || '(名前なし)'),
               rev:readMap(revKey()), buildings:count(readMap(revKey())) };
    };
    window.__d1Reload = function(){ try{ location.reload(); }catch(e){} };
  }catch(e){}

  try{ console.log('[D] store.js v7 起動：Firestore が正 ／ 端末 ' + (me() || '(名前なし)')); }catch(e){}
})();
