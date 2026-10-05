/* ============================================================
 *  PIVOT2 →  オーナーマイページ  へ送る
 *
 *  ★ 既存のファイルには一切触りません。
 *    このファイルを足して、index.html に1行読み込むだけです。
 *
 *  ★ 管理キー（ADMIN_KEY）は、コードにも config.js にも書きません。
 *    pivot2 は公開リポジトリのためです。
 *    はじめて押したときに聞いて、その端末の中だけに覚えます。
 *
 *  ★ 使わせてもらうもの（ownermail.js から window.RENT で出ています）
 *      window.RENT.detail              … オーナー別にまとめた明細
 *      window.RENT.makeOwnerPdfBase64  … そのオーナーのページだけ抜いたPDF
 *    どちらも読むだけで、書き替えません。
 *
 *    ★2026/9/22 まで、ここを  detail  と直接書いていました。
 *      ownermail.js は全体が囲い（IIFE）の中にあるため外から呼べず、
 *      押しても毎回「送るものがありません」で止まり、
 *      通信を1回も始めていませんでした。明細シートが空だった原因です。
 *
 *  送るのは、オーナーメールが「すでに読み取っているもの」だけです。
 *  入力の手間は1つも増えません。
 * ============================================================ */
(function(){
  'use strict';

  var LS_URL = 'pv_mypage_url';
  var LS_KEY = 'pv_mypage_key';

  /* 一度に送る人数の目安。これを超えたら、押す前にお伝えします。
   *  20名なら 通信40回、1〜2分。結果の表も一目で読めます。 */
  var MANY = 20;
  /* Gmail の1日の送信上限（無料アカウント。2026/9/23 実測で残り98通）。
   *  ★上限そのものは Google が決めます。ここは「お伝えする目安」です。 */
  var MAIL_DAY = 80;

  /* ── 設定（はじめの1回だけ聞きます） ───────── */
  function conf(force){
    var url = '', key = '';
    try{ url = localStorage.getItem(LS_URL) || ''; key = localStorage.getItem(LS_KEY) || ''; }catch(e){}

    if(force || !url){
      url = window.prompt(
        'マイページの Apps Script ウェブアプリURL をご入力ください。\n' +
        '（https://script.google.com/macros/s/……/exec）', url || '') || '';
      if(!url) return null;
      try{ localStorage.setItem(LS_URL, url.trim()); }catch(e){}
    }
    if(force || !key){
      key = window.prompt(
        'マイページの管理キー（ADMIN_KEY）をご入力ください。\n\n' +
        '※ この端末の中だけに保存します。社外に出さないでください。', '') || '';
      if(!key) return null;
      try{ localStorage.setItem(LS_KEY, key.trim()); }catch(e){}
    }
    return { url:(url||'').trim(), key:(key||'').trim() };
  }

  /* ★2026/9/22 直し
   *  前は r.json() をそのまま呼んでいたため、マイページ側が JSON ではない
   *  ものを返したとき（デプロイの公開先が「全員」でない・URL が古い など）、
   *  「Unexpected token <」という、原因の分からない字だけが出ていました。
   *  何を確かめればよいかが分かるようにします。 */
  function post(url, body){
    return fetch(url, {
      method : 'POST',
      headers: { 'Content-Type':'text/plain;charset=utf-8' },
      body   : JSON.stringify(body)
    })
    .catch(function(){
      /* ★ここは「返事が返る前に失敗した」ときです。
           ブラウザは理由を教えてくれず「Failed to fetch」とだけ言います。
           そのまま出すと、何を確かめればよいか分かりません。 */
      throw new Error(
        'マイページ側につながりませんでした。\n\n' +
        '次の3つを、順にご確認ください。\n\n' +
        '① ［接続設定］の URL\n' +
        '　 マイページの Apps Script の URL ですか？\n' +
        '　 （「共用Drive連携URL」とは別のものです）\n' +
        '　 その URL をブラウザのアドレス欄に貼って開くと、\n' +
        '　 「オーナーマイページは こちら です。」と出るのが正常です。\n\n' +
        '② デプロイの「アクセスできるユーザー」\n' +
        '　 「全員」になっていますか？\n' +
        '　 「自分のみ」だと、ここでつながりません。\n\n' +
        '③ ブラウザの右上に「本人確認を行ってください」が出ていませんか？\n' +
        '　 出ていれば、先にそちらを済ませてください。');
    })
    .then(function(r){ return r.text(); })
    .then(function(t){
      try{ return JSON.parse(t); }
      catch(e){
        throw new Error(
          'マイページ側から、思っていない答えが返りました。\n\n' +
          '次の3つをご確認ください。\n' +
          '　・URL が「……/exec」で終わっているか\n' +
          '　・デプロイの「アクセスできるユーザー」が「全員」か\n' +
          '　・「デプロイを管理 → 鉛筆 → 新バージョン」で反映したか\n\n' +
          '（返ってきたもの： ' +
          String(t || '').replace(/\s+/g, ' ').slice(0, 80) + '）');
      }
    });
  }

  /* ── 明細の仕分け結果を受け取ります ─────────
   *  ★ここが、明細シートが空だった原因のところです（2026/9/22 直し）。
   *
   *  js/ownermail.js は全体が囲い（IIFE）の中にあるため、
   *  中の detail は、このファイルから名前では呼べません。
   *  前は  try{ list = detail; }catch(e){ list = null; }  と書いており、
   *  毎回 null になって「送るものがありません」で止まっていました。
   *  通信は1回も始まっていませんでした。
   *
   *  ① window.RENT.detail … ownermail.js が出している読み取り口。こちらが本筋
   *  ② localStorage       … ①が使えないときの逃げ道。
   *                          仕分け結果はここにも保存されています。
   *                          ただし PDF は保存されていないので、
   *                          明細PDFは付きません（送信そのものは動きます）
   */
  function pickDetail(){
    try{
      var d = window.RENT && window.RENT.detail;
      if(Array.isArray(d) && d.length) return { list:d, live:true };
    }catch(e){}

    try{
      var pre = (typeof insPrefix === 'function') ? insPrefix() : 'pivot_';
      var saved = JSON.parse(
        localStorage.getItem(pre + 'rent_owner_send_detail_v1') || 'null');
      if(saved && Array.isArray(saved.detail) && saved.detail.length){
        return { list:saved.detail, live:false };
      }
    }catch(e){}

    return { list:[], live:false };
  }

  /* ══════════════════════════════════════════════
   *  マイページの登録状況（＝招待済みかどうか）
   *
   *  ★PIVOT2 に「送ったつもり」を覚えさせません。
   *    マイページの台帳（stCheck）に、そのつど聞きます。
   *    ・別の端末から招待しても、こちらに出ます
   *    ・この端末の記憶を消しても、正しく出ます
   *    ・オーナー様の反応（ログイン）を待つ必要はありません。
   *      台帳に行があれば「招待済み」です
   * ══════════════════════════════════════════════ */
  var invMap = null;      /* アドレス（小文字）→ 台帳の1行。null は「まだ聞いていない」 */

  function invLoad(cfg){
    return post(cfg.url, { action:'stCheck', key:cfg.key })
      .then(function(r){
        if(r && r.error === 'auth'){
          throw new Error('管理キーが違います。［接続設定］でご確認ください。');
        }
        if(!r || !r.ok || !Array.isArray(r.list)){
          throw new Error((r && r.message) ? r.message :
            'マイページの登録状況を読めませんでした。\n\n' +
            'マイページ側の窓口（stCheck）が、まだ入っていないかもしれません。');
        }
        var m = {};
        r.list.forEach(function(x){
          var k = String(x.mail || '').trim().toLowerCase();
          if(k) m[k] = x;
        });
        invMap = m;
        return m;
      });
  }

  function invOf(mail){
    var k = String(mail == null ? '' : mail).trim().toLowerCase();
    return (invMap && k) ? (invMap[k] || null) : null;
  }

  /* ══════════════════════════════════════════════
   *  オーナーカードの「招待」の箱（2026/10/1）
   *
   *  ご指示： 「招待はオーナーカードに招待チェックボックスつけて
   *            チェックしたオーナーだけにする仕様に変更して。
   *            で、いちど招待したら招待済みにして。再送付もできるように」
   *
   *  改良前は、メール送信用のチェック（.rent-check）を借りていました。
   *  同じ箱が「月々のメール」と「マイページへの招待」の2つの意味を
   *  持つため、どちらのつもりで入れたのか分かりませんでした。
   *
   *  改良後は、招待専用の箱（.inv-check）をカードに足します。
   *    未招待　　　　 … ☐ 招待
   *    招待済み　　　 … 招待済み ＋ ☐ 再送付
   *    アドレス未登録 … アドレス未登録（箱は出しません）
   *  ★別管理の方のカードは一覧に出ないので、箱も出ません。
   *
   *  ★ownermail.js は1文字も触りません。あちらが描いたあとに、
   *    こちらから差し込みます。描き直されたら、また差し込みます。
   * ══════════════════════════════════════════════ */

  function invCell(i, d){
    var mail = String((d && d.email) || '').trim();
    var wrap = document.createElement('span');
    wrap.className = 'inv-wrap';
    wrap.style.cssText =
      'display:inline-flex;align-items:center;gap:5px;flex-shrink:0;' +
      'margin-left:8px;font-size:12px;line-height:1.2';
    /* ★印の意味は data-kind で分けます（2026/10/1）
     *     inv … 招待する（はじめての方）
     *     mon … 今月の明細（ご利用中の方。毎月これを使います）
     *     re  … ご案内の再送付（パスワードを作り直します）
     *   名前ではなく、この印で何が起きるかが決まります。 */

    if(!mail){
      /* ★オーナー一覧の札と、同じ見え方にそろえます（2026/10/1）。
           同じ意味のものが2つの画面でちがう色だと、見分けの手がかりに
           なりません。 */
      wrap.innerHTML = '<span class="inv-nomail" style="font-size:11px;' +
                       'font-weight:800;line-height:1.2;padding:2px 7px;' +
                       'border-radius:999px;white-space:nowrap;' +
                       'color:#17171a;background:#ffcc00">アドレス未登録</span>';
      return wrap;
    }

    var rec = invOf(mail);
    var know = (invMap !== null);

    if(know && rec){
      /* ★再送付のときは、メールアドレスを入れ直せるようにします（2026/10/1）。
       *
       *  ご指示： 「再送付時にはメールアドレス入力できるようにしてほしい」
       *           入れ直したアドレスは、登録アドレスとして置き換わります（①＝1）。
       *
       *  ★ログインIDが変わります。ですので
       *      ・はじめは「いまの登録アドレス」を入れておきます
       *      ・印を入れるまで、欄は押せません（うっかり直すのを防ぐため）
       *      ・押す前の確認で、変更前 → 変更後 をお見せします
       *    打ち間違えたまま送ると、オーナー様はログインできなくなり、
       *    明細もよその方に届きます。いちばん気をつけるところです。 */
      /* ★2026/10/1 … 「今月の明細」の印を足しました。
       *
       *  【改良前】 招待済みの方のカードには ☐ 再送付 しかありませんでした。
       *            毎月の明細をマイページに入れるには、それを押すしか
       *            なく、押すと**初回パスワードが作り直されます**。
       *            つまり、毎月の明細を安全に入れる道がありませんでした。
       *
       *  【改良後】 ☑ 今月の明細 を足し、はじめから入れておきます。
       *            毎月の手順は「明細PDFを取り込む →［マイページへ送る］」
       *            の2つだけになります。パスワードは変わりません。
       *
       *  ★再送付と同時には入れられません。再送付は明細も一緒に入るため、
       *    両方入れると同じことを2回することになります。 */
      wrap.innerHTML =
        '<span class="inv-done" style="color:#2c6ea1;font-weight:800">招待済み</span>' +
        '<label style="display:inline-flex;align-items:center;gap:4px;' +
        'cursor:pointer;color:#2c6ea1;font-weight:700" ' +
        'title="今月の明細をマイページに入れ、入ったことをお知らせします。パスワードは変わりません">' +
        '<input type="checkbox" class="inv-check" data-kind="mon" value="' + i + '"' +
        ' checked style="width:16px;height:16px;cursor:pointer">今月の明細</label>' +
        '<label style="display:inline-flex;align-items:center;gap:4px;' +
        'cursor:pointer;color:#666" ' +
        'title="開設のご案内をもう一度お送りします。パスワードは新しいものに変わります">' +
        '<input type="checkbox" class="inv-check" data-kind="re" value="' + i + '"' +
        ' style="width:16px;height:16px;cursor:pointer">再送付</label>' +
        '<input type="email" class="inv-mail" data-for="' + i + '"' +
        ' value="' + mail.replace(/"/g, '&quot;') + '" disabled' +
        ' title="再送付するときだけ、ここでアドレスを直せます"' +
        ' style="font:inherit;font-size:12px;padding:3px 6px;border-radius:5px;' +
        'border:1px solid #d9c9a8;background:#f4f4f5;color:#999;width:170px">';
    }else{
      wrap.innerHTML =
        '<label style="display:inline-flex;align-items:center;gap:4px;' +
        'cursor:pointer;color:#C9184A;font-weight:800">' +
        '<input type="checkbox" class="inv-check" data-kind="inv" value="' + i + '"' +
        ' style="width:16px;height:16px;cursor:pointer">招待する</label>' +
        (know ? '' : '<span class="inv-unk" style="color:#999;font-weight:400">（状況未確認）</span>');
    }

    /* カードを開いてしまわないようにします */
    var boxes = wrap.querySelectorAll('.inv-check');
    var mon = wrap.querySelector('.inv-check[data-kind="mon"]');
    var re  = wrap.querySelector('.inv-check[data-kind="re"]');
    var inp = wrap.querySelector('.inv-mail');

    /* ★アドレス欄が開くのは「再送付」のときだけです。
         ログインIDが変わるのは再送付のときだけで、
         今月の明細を入れるだけならアドレスは関わらないためです。 */
    var sync = function(){
      var on = !!(re && re.checked);
      if(inp){
        inp.disabled = !on;
        inp.style.background = on ? '#fff'    : '#f4f4f5';
        inp.style.color      = on ? '#17171a' : '#999';
      }
      /* ★再送付は明細も一緒に入ります。両方入れると同じことを2回
           することになるので、今月の明細は外して押せなくします。 */
      if(mon){
        if(on && mon.checked) mon.checked = false;
        if(!on && mon.disabled) mon.checked = true;
        mon.disabled = on;
        var lb = mon.parentNode;
        if(lb && lb.style){
          lb.style.opacity = on ? '.45' : '1';
          lb.style.cursor  = on ? 'default' : 'pointer';
        }
      }
    };
    Array.prototype.forEach.call(boxes, function(b){
      b.addEventListener('click', function(ev){ ev.stopPropagation(); });
      b.addEventListener('change', function(){ sync(); sumPaint(); });
    });
    sync();

    if(inp){
      inp.addEventListener('click', function(ev){ ev.stopPropagation(); });
      inp.addEventListener('keydown', function(ev){ ev.stopPropagation(); });
    }
    Array.prototype.forEach.call(wrap.querySelectorAll('label'), function(lb){
      lb.addEventListener('click', function(ev){ ev.stopPropagation(); });
    });
    return wrap;
  }

  /* 箱を差し込みます。すでに入っている印は、消しません。 */
  function invDeco(){
    var list = null;
    try{ list = window.RENT && window.RENT.detail; }catch(e){}
    if(!Array.isArray(list)) return;

    /* ★場所でしぼりません。shown() と同じ「.rent-check が全部」です。
         別管理の方のカードには .rent-check がないので（ownermail.js が
         そう作っています）、別管理の方に招待の箱は出ません。
         ★#preview と #rows のどちらでも動くようにしています。 */
    var els;
    try{ els = document.querySelectorAll('.rent-check'); }catch(e){ return; }
    if(!els || !els.length) return;

    Array.prototype.forEach.call(els, function(el){
      var i = Number(el.value);
      if(!isFinite(i) || !list[i]) return;
      var head = el.parentNode;
      if(!head) return;

      var old = head.querySelector('.inv-wrap');
      /* ★印（チェック）は残します。登録状況を読み込んだだけで
           入れた印が消えると、入れ直しになります。
         ★2026/10/1 … 箱が3種類になったので、種類ごとに覚えます。
           「招待」で入れた印が、作り直しで「再送付」に化けると、
           押したつもりのないパスワード再発行が起きます。 */
      var wasOn = {}, wasMail = '', had = false;
      if(old){
        had = true;
        var m0 = old.querySelector('.inv-mail');
        var ob = old.querySelectorAll('.inv-check');
        Array.prototype.forEach.call(ob, function(b){
          wasOn[b.getAttribute('data-kind') || 'inv'] = !!b.checked;
        });
        if(m0 && wasOn.re) wasMail = String(m0.value || '').trim();
        if(old.parentNode) old.parentNode.removeChild(old);
      }
      var cell = invCell(i, list[i]);
      /* ★はじめて作るときだけ、既定（今月の明細＝入り）を使います。
           2回目からは、画面に出ていた状態をそのまま戻します。
           そうしないと、外した印が描き直しのたびに戻ってしまいます。 */
      if(had){
        Array.prototype.forEach.call(cell.querySelectorAll('.inv-check'), function(b){
          var k = b.getAttribute('data-kind') || 'inv';
          if(wasOn[k] !== undefined) b.checked = wasOn[k];
        });
        var ni = cell.querySelector('.inv-mail');
        if(ni && wasMail) ni.value = wasMail;
        /* 入れ直した状態に合わせて、欄の開け閉めをやり直します */
        var rb = cell.querySelector('.inv-check[data-kind="re"]');
        if(rb) rb.dispatchEvent(new Event('change'));
      }
      head.insertBefore(cell, el.nextSibling);
    });
    /* 札をつけ直したら、まとめの数も合わせます */
    sumPaint();
  }

  /* 一覧が描き直されたら、また差し込みます（検索・並べ替え・取込など） */
  function invWatch(){
    var box = document.getElementById('preview') ||
              document.getElementById('rows');
    if(!box || box.__invWatched) return;
    box.__invWatched = true;
    var busy = false;
    try{
      var mo = new MutationObserver(function(){
        if(busy) return;
        busy = true;
        setTimeout(function(){ busy = false; invDeco(); }, 60);
      });
      mo.observe(box, { childList:true, subtree:false });
    }catch(e){}
    invDeco();
  }

  /* ★すでに URL と管理キーを覚えているときだけ、黙って登録状況を読みます。
       覚えていないときは聞きません（開いただけで窓が出ると煩わしいため）。
       そのときは「（状況未確認）」と出します。［マイページの登録状況］を
       押していただくと「招待済み」に変わります。 */
  function invQuiet(){
    var url = '', key = '';
    try{
      url = localStorage.getItem(LS_URL) || '';
      key = localStorage.getItem(LS_KEY) || '';
    }catch(e){}
    if(!url || !key) return;
    var cfg = { url:url, key:key };
    invLoad(cfg).then(function(){
      invDeco();
      ownDeco();        /* オーナー一覧のカードも、ここで色がつきます */
    }, function(){});
    /* ★本日あと何通かも、黙って読んでおきます。
         押してから「上限でした」と知るのでは、手おくれだからです。 */
    quotaLoad(cfg).then(sumPaint, sumPaint);
  }

  /* ══════════════════════════════════════════════
   *  オーナー一覧のカードに「招待済み」を出す（2026/10/1）
   *
   *  ご指示： 「このカード一覧にオーナーマイページ招待済み、と
   *            右上辺りにわかるように記載してほしい」
   *
   *  改良前は、招待済みかどうかは［マイページの登録状況］の表を
   *  開かないと分かりませんでした。オーナー一覧（112枚）を見ながら
   *  「この方はもう招待したか」を思い出せませんでした。
   *
   *  改良後は、カードの右上に出します。
   *      招待済み　　　 … 青
   *      未招待　　　　 … 赤
   *      アドレス未登録 … 灰（招待したくてもできない方。直す必要があります）
   *      対象外　　　　 … 灰（別管理。当社が「送らない」と決めた方）
   *      （状況未確認） … 灰（まだ台帳を読んでいない）
   *
   *  ★ownermail.js は1文字も触りません。あちらが描いたあとに
   *    こちらから差し込み、描き直されたらまた差し込みます。
   *  ★お名前やアドレスは、カードに足しません（公開リポジトリのため、
   *    そもそもコードには書きません。画面で読むだけです）。
   * ══════════════════════════════════════════════ */

  /* カードの onclick から、その方の番号を取り出します */
  function ownIdx(card){
    var a = '';
    try{ a = card.getAttribute('onclick') || ''; }catch(e){}
    var m = a.match(/openOwnerSheet\((\d+)\)/);
    return m ? Number(m[1]) : -1;
  }

  function ownBadge(o){
    var mail = String((o && o.email) || '').trim();
    var txt, bg, fg = '#fff';
    if(o && o.exclude){        txt = '対象外';        bg = '#8a8a8f'; }
    else if(!mail){
      /* ★アドレス未登録だけ、黄色の地に黒い字にします（2026/10/1 ご指示）。
       *   ここは「当社が直さなければならない方」です。112枚のカードの中で
       *   いちばん先に目に入るようにします。
       *   ★黒い字にするのは、黄色に白い字だと読めないためです
       *     （黄色＋白＝明暗差 1.51 ／ 黄色＋黒＝11.83。目安は 4.5）。 */
      txt = 'アドレス未登録'; bg = '#ffcc00'; fg = '#17171a';
    }
    else if(invMap === null){  txt = '（状況未確認）'; bg = '#a0a0a5'; }
    else if(invOf(mail)){      txt = '招待済み';      bg = '#2c6ea1'; }
    else {                     txt = '未招待';        bg = '#c9184a'; }

    var el = document.createElement('span');
    el.className = 'inv-own';
    el.textContent = txt;
    el.style.cssText =
      'margin-left:auto;flex:0 0 auto;font-size:11px;font-weight:800;' +
      'line-height:1.2;padding:2px 7px;border-radius:999px;' +
      'white-space:nowrap;color:' + fg + ';background:' + bg;
    return el;
  }

  function ownDeco(){
    var list = null;
    try{ list = window.RENT_CORE && window.RENT_CORE.owners; }catch(e){}
    if(!Array.isArray(list)) return;

    var cards;
    try{ cards = document.querySelectorAll('#ownerCards .ow-card'); }catch(e){ return; }
    if(!cards || !cards.length) return;

    Array.prototype.forEach.call(cards, function(card){
      var i = ownIdx(card);
      if(i < 0 || !list[i]) return;
      var head = card.querySelector('.ow-head');
      if(!head) return;
      var old = head.querySelector('.inv-own');
      if(old && old.parentNode) old.parentNode.removeChild(old);
      head.appendChild(ownBadge(list[i]));
    });
  }

  /* 一覧が描き直されたら（検索・取込・並べ替え）、また差し込みます */
  function ownWatch(){
    var box = document.getElementById('ownerCards');
    if(!box || box.__invWatched) return;
    box.__invWatched = true;
    var busy = false;
    try{
      var mo = new MutationObserver(function(){
        if(busy) return;
        busy = true;
        setTimeout(function(){ busy = false; ownDeco(); }, 60);
      });
      mo.observe(box, { childList:true, subtree:false });
    }catch(e){}
    ownDeco();
  }

  /* ── 登録状況の表 ───────────────────────────── */
  function invBoard(list){
    var old = document.getElementById('tmp-inv');
    if(old && old.parentNode) old.parentNode.removeChild(old);
    if(!list) return;

    /* ★別管理の方は「対象外」と出します。
         「未招待」と出すと、招待し忘れのように見えてしまいます。
         当社が「メールは送らない」と決めた方なので、それでよいのです。 */
    var sh = shown();
    var rows = list.map(function(d, i){
      var mail = String(d.email || '').trim();
      return { i:i, name:(d.owner || d.atena || mail || '（お名前なし）'),
               mail:mail, rec:(mail ? invOf(mail) : null),
               /* ★out は「別管理（一覧に出ていない）」だけです。
                    アドレス未登録は out ではありません。 */
               out:!sh[i] };
    });
    var ng = rows.filter(function(r){
      return !r.out && (!r.mail || !r.rec);
    }).length;

    var box = document.createElement('div');
    box.id = 'tmp-inv';
    box.style.cssText =
      'margin:14px 0;padding:14px 16px;border-radius:12px;background:#fff;' +
      'border:1px solid ' + (ng ? '#d70015' : '#d2d2d7') + ';font-size:13px;' +
      'color:#1d1d1f;line-height:1.7';

    var head = document.createElement('p');
    head.style.cssText = 'margin:0 0 10px;font-weight:800;font-size:14px;' +
      (ng ? 'color:#c9001a' : 'color:#1d1d1f');
    head.textContent = ng
      ? ('マイページに、まだ招待していないオーナー様が ' + ng + ' 名います。')
      : ('この一覧の ' + rows.length + ' 名は、全員マイページに招待済みです。');
    box.appendChild(head);

    var t = document.createElement('table');
    t.style.cssText = 'width:100%;border-collapse:collapse;font-size:12.5px';
    t.innerHTML =
      '<thead><tr>' +
      ['オーナー様','アドレス','マイページ','最終ログイン','入っている月','明細を開いたか']
        .map(function(h){
          return '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid ' +
                 '#e5e5ea;font-weight:700;color:#57575c">' + h + '</th>';
        }).join('') + '</tr></thead><tbody>' +
      rows.map(function(r){
        var td = function(x, c){
          return '<td style="padding:6px 8px;border-bottom:1px solid #f0f0f2' +
                 (c ? (';color:' + c + ';font-weight:700') : '') + '">' + x + '</td>';
        };
        if(r.out){
          return '<tr>' + td(esc(r.name)) + td(r.mail ? esc(r.mail) : '—') +
                 td(r.rec ? '招待済み（別管理）' : '対象外（別管理）', '#57575c') +
                 td(r.rec && r.rec.login ? esc(r.rec.login) : '—') +
                 td('—') + td('—') + '</tr>';
        }
        if(!r.mail){
          return '<tr>' + td(esc(r.name)) + td('—', '#c9001a') +
                 td('アドレス未登録', '#c9001a') + td('—') + td('—') + td('—') + '</tr>';
        }
        if(!r.rec){
          return '<tr>' + td(esc(r.name)) + td(esc(r.mail)) +
                 td('未招待', '#d70015') + td('—') + td('—') + td('—') + '</tr>';
        }
        var x = r.rec;
        return '<tr>' +
          td(esc(r.name)) +
          td(esc(r.mail)) +
          td('招待済み') +
          td(x.login ? esc(x.login) : 'まだ', x.login ? '' : '#57575c') +
          td(x.months ? (x.months + 'か月' + (x.ym ? ('（最新 ' + esc(x.ym) + '）') : '')) : '0か月',
             x.months ? '' : '#c9001a') +
          td(x.pdf ? (x.opened ? '開かれました' : 'まだ') : '明細書PDFなし',
             x.pdf ? (x.opened ? '' : '#57575c') : '#c9001a') +
          '</tr>';
      }).join('') + '</tbody>';
    box.appendChild(t);

    var note = document.createElement('p');
    note.style.cssText = 'margin:10px 0 0;font-size:12px;color:#57575c';
    note.textContent = ng
      ? '「未招待」の方にチェックを入れて［マイページへ送る］を押すと、' +
        'その方だけに初回パスワードのご案内メールが届きます。'
      : '「最終ログイン」が「まだ」の方は、ご案内メールにお気づきでない' +
        'おそれがあります。お電話でお声がけいただくのが確実です。';
    box.appendChild(note);

    var host = document.getElementById('btn-to-mypage');
    host = host ? host.parentNode : document.getElementById('view-send');
    if(host && host.parentNode) host.parentNode.insertBefore(box, host.nextSibling);
    else if(host) host.appendChild(box);
    try{ box.scrollIntoView({ block:'nearest' }); }catch(e){}
  }

  /* ［マイページの登録状況］を押したとき */
  function invRun(){
    var cfg = conf(false);
    if(!cfg) return;
    var got = pickDetail();
    if(!got.list.length){
      alert('オーナー様の一覧がありません。\n\n先に明細PDFを取り込んで、振り分けをご確認ください。');
      return;
    }
    var btn = document.getElementById('btn-mypage-inv');
    var was = btn ? btn.textContent : '';
    if(btn){ btn.disabled = true; btn.textContent = '確認しています…'; }
    invBoard(null);
    invLoad(cfg)
      .then(function(){ invBoard(got.list); invDeco(); ownDeco(); })
      .catch(function(e){ alert(e && e.message ? e.message : '確認できませんでした。'); })
      .then(function(){ if(btn){ btn.disabled = false; btn.textContent = was; } });
  }

  /* ══════════════════════════════════════════════
   *  オーナーカードの「物件名」を、マイページへ渡します（2026/10/2）
   *
   *  ご指摘： 「これどこで物件を拾っていますか？新規の物件ができたときは
   *           入力しないといけないですか？PIVOT2のオーナー情報の物件所有
   *           から引っ張れたら間違いないのですが。」
   *
   *  【改良前】 マイページの物件の候補は、**明細PDFに出てきた物件だけ**
   *            でした。明細は「送金のあった物件」しか載りません。
   *            そのため
   *              ・買ったばかりで、まだ送金のない物件
   *              ・全室空室で、送金が立たなかった月の物件
   *            はマイページに1件も出ず、保険をお預けになるときに
   *            ［一覧にない物件を入力する］で手打ちしていただく形でした。
   *
   *  【改良後】 オーナーカードの「物件名」（複数は改行で）を、そのまま
   *            いっしょに送ります。PIVOT2 に物件を書けば、マイページにも
   *            出ます。オーナー様にも当社にも、入力は増えません。
   *
   *  ★明細側の物件名と重なっても困りません。マイページ側が
   *    insNorm（全角半角・空白をそろえる）で見比べて、重なりを消します。
   *  ★一覧が読めないとき（オーナー画面をまだ開いていない等）は
   *    空の配列を返します。今までどおり明細だけで動きます。
   * ══════════════════════════════════════════════ */
  function ownNm(s){
    var v = String(s == null ? '' : s);
    try{ if(v.normalize) v = v.normalize('NFKC'); }catch(e){}
    return v.toLowerCase().replace(/[\s\u3000]+/g, '');
  }

  function cardProps(d){
    var list = null;
    try{ list = window.RENT_CORE && window.RENT_CORE.owners; }catch(e){}
    if(!Array.isArray(list)) return [];

    /* ★まずアドレスで、見つからなければお名前で探します。
         アドレスは1人に1つですが、お名前は書き方が揺れるためです。 */
    var mail = ownNm(d && d.email);
    var name = ownNm(d && (d.owner || d.atena));
    var hit  = null;
    if(mail){
      hit = list.filter(function(o){ return ownNm(o && o.email) === mail; })[0] || null;
    }
    if(!hit && name){
      hit = list.filter(function(o){ return ownNm(o && o.name) === name; })[0] || null;
    }
    if(!hit) return [];

    var arr = (hit.properties && hit.properties.length)
                ? hit.properties
                : (hit.property ? String(hit.property).split(/[\n\u3001]/) : []);
    var out = [];
    arr.forEach(function(x){
      var v = String(x == null ? '' : x).trim();
      if(v && out.indexOf(v) < 0) out.push(v);
    });
    return out;
  }

  /* ── 1件ぶんを、マイページの形に直します ───── */
  function shape(d){
    var total = 0, got = false;
    (d.props || []).forEach(function(p){
      var n = parseInt(String(p.amount || '').replace(/,/g, ''), 10);
      if(!isNaN(n)){ total += n; got = true; }
    });

    var months = [], sokins = [];
    (d.props || []).forEach(function(p){
      if(p.month && months.indexOf(p.month) < 0) months.push(p.month);
      if(p.sokin && sokins.indexOf(p.sokin) < 0) sokins.push(p.sokin);
    });

    /* 内訳は、物件ごとの送金額をそのまま並べます */
    var rows = (d.props || []).filter(function(p){ return p.amount; }).map(function(p){
      return {
        label  : p.property || p.bldNo || '',
        amount : parseInt(String(p.amount).replace(/,/g, ''), 10) || 0
      };
    });

    /* 入居状況（オーナーメールが明細から自動で読み取ったもの） */
    var status = [];
    (d.props || []).forEach(function(p){
      var pn = p.property || p.bldNo || '';
      (p.vac || []).forEach(function(v){
        var boshu = (v.type === '募集中');
        status.push({
          kind : boshu ? '募集中' : '解約予定',
          prop : pn,
          room : v.room ? (v.room + '号室') : '',
          date : v.date || '',
          note : boshu ? '募集しています。'
                       : (v.date ? (v.date + ' 解約予定です。') : '解約のご予定です。')
        });
      });
      (p.newc || []).forEach(function(n){
        status.push({
          kind : '新規契約',
          prop : pn,
          room : n.room ? (n.room + '号室') : '',
          date : n.date || '',
          note : n.date ? (n.date + 'より 新規契約となりました。') : '新規契約となりました。'
        });
      });
    });

    /* 総戸数は1回だけ数えます。
     *
     *  ★2026/10/5 … ここは「あれば使う」にしてあります。
     *    pvUnitsOf は js/ownermail.js にあります。
     *    もし ownermail.js が読み込まれていない場面でここが動くと、
     *    いきなり呼べば TypeError で **マイページへ送る処理そのものが
     *    止まります**（実際に検査 tinv／tmon で止まりました。
     *    あの2つの検査は tomypage.js だけを読み込むためです）。
     *    入居率は「あると嬉しいもの」で、明細を送ることが本体です。
     *    本体を、おまけで止めることはできません。
     *    無いときは入居率を出さないだけにします。 */
    var occ = (typeof window.pvUnitsOf === 'function')
                ? window.pvUnitsOf(d)
                : { ok:false, units:0, by:[] };

    return {
      email     : String(d.email || '').trim(),
      name      : d.owner || '',
      atena     : d.atena || d.owner || '',
      ym        : months.join('・'),
      total     : got ? total : null,
      sokinDate : sokins.join('・'),
      rows      : rows,
      status    : status,
      /* ★2026/10/5 新規 … 入居率のための「総戸数」。
       *
       *  明細に「総戸数」という欄はありません。収入明細の表に、
       *  空いているお部屋も1行として出ますので、その行の数を数えています
       *  （js/ownermail.js の extractUnits）。
       *
       *  ★率そのものは、ここでは作りません。マイページ側で出します。
       *    マイページは「解約予定日が過ぎたお部屋は募集中として扱う」
       *    という直しをすでに持っており、そちらの数で割らないと、
       *    画面の一覧と率が食いちがうためです。
       *
       *  ★数えられなかったときは 0 を送ります。
       *    マイページは 0 のとき、入居率をいっさい出しません。 */
      units     : occ.ok ? occ.units : 0,
      unitsBy   : occ.ok ? occ.by    : [],
      /* ★オーナーカードの「物件名」。明細に出ない物件も拾うためです */
      props     : cardProps(d)
    };
  }

  /* ── 上の一覧で、チェックが入っている方を拾います ──
   *
   *  ★2026/9/23 直し。ここが、いちばん危ないところでした。
   *
   *  【改良前】 チェックをいっさい見ず、
   *            「メールアドレスがある方 全員」に送っていました。
   *            ご自身1名で試そうと思って押すと、
   *            **その場で全員に初回パスワードのメールが飛びます。**
   *            取り消せません。
   *
   *  【改良後】 チェックが入っている方だけに送ります。
   *            1つも入っていないときは、「全員に送りますか」と
   *            はっきりお尋ねしてから送ります（月々の一括はこちら）。
   *
   *  ★チェックの箱は、オーナーメールの振り分け一覧にもともとある
   *    ものです（.rent-check。value にその方の番号が入っています）。
   *    新しく足していません。 */
  /* ★2026/10/1 … 見る箱を .rent-check から .inv-check に変えました。
   *   .rent-check は「月々のメールを送る相手」の箱です。同じ箱を
   *   借りていたため、どちらのつもりで入れた印か分かりませんでした。 */
  function picked(list){
    var on = [];
    try{
      var els = document.querySelectorAll('.inv-check:checked');
      Array.prototype.forEach.call(els, function(el){
        var i = Number(el.value);
        if(isFinite(i) && list[i] && String(list[i].email || '').trim() &&
           on.indexOf(i) < 0) on.push(i);
      });
    }catch(e){}
    on.sort(function(a, b){ return a - b; });
    return on;
  }

  /* ══════════════════════════════════════════════
   *  いま印が入っているものを、種類ごとに数えます（2026/10/1）
   *
   *  ★「送るつもりのもの」と「実際に送るもの」を、同じ1か所から出します。
   *    画面の数と、押したあとに起きることが食いちがわないためです。
   * ══════════════════════════════════════════════ */
  function kinds(){
    var c = { inv:0, mon:0, re:0 };
    try{
      var els = document.querySelectorAll('.inv-check:checked');
      Array.prototype.forEach.call(els, function(el){
        var k = el.getAttribute('data-kind') || 'inv';
        if(c[k] !== undefined) c[k]++;
      });
    }catch(e){}
    return c;
  }

  /* 一覧に出ているのに、アドレスが無くて送れない方の数 */
  function noMailCount(){
    var list = pickDetail().list, sh = shown(), n = 0;
    Object.keys(sh).forEach(function(k){
      var d = list[Number(k)];
      if(d && !String(d.email || '').trim()) n++;
    });
    return n;
  }

  /* ══════════════════════════════════════════════
   *  本日あと何通送れるか
   *
   *  ★オーナーマイページと PIVOT2 は、同じ Google アカウントで
   *    動いています。1日の送信枠は**2つで分け合っています**。
   *    ですので「あと何通」は、マイページ側に聞くのが正しい数です。
   *  ★窓口（stQuota）がまだ無いときは、推測しません。
   * ══════════════════════════════════════════════ */
  var mailLeft = null;     /* null=まだ聞いていない / -1=聞けなかった */
  var mailWait = 0;        /* 順番待ち（翌朝に自動でお送りします） */

  function quotaLoad(cfg){
    return post(cfg.url, { action:'stQuota', key:cfg.key })
      .then(function(r){
        mailLeft = (r && r.ok && isFinite(r.left)) ? Number(r.left) : -1;
        mailWait = (r && r.ok && isFinite(r.wait)) ? Number(r.wait) : 0;
      })
      .catch(function(){ mailLeft = -1; mailWait = 0; });
  }

  /* メールアドレスの形を、かんたんに確かめます。
     ★ここで弾くのは「明らかにおかしいもの」だけです。
       実在するかどうかは分かりません。 */
  function mailOk(v){
    var t = String(v == null ? '' : v).trim();
    if(!t || t.length > 254) return false;
    if(/[\s　,;]/.test(t)) return false;
    return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(t);
  }

  /* 「再送付」として印が入っている方。
     ★アドレスを入れ直されたときは、新しいアドレスも一緒に返します。 */
  function reSend(list){
    var on = [];
    try{
      var els = document.querySelectorAll('.inv-check:checked[data-kind="re"]');
      Array.prototype.forEach.call(els, function(el){
        var i = Number(el.value);
        if(!isFinite(i) || !list[i]) return;
        for(var k = 0; k < on.length; k++){ if(on[k].i === i) return; }
        var now = String(list[i].email || '').trim();
        var inp = document.querySelector('.inv-mail[data-for="' + i + '"]');
        var val = inp ? String(inp.value || '').trim() : now;
        on.push({ i:i, now:now, next:val,
                  changed:(val.toLowerCase() !== now.toLowerCase()) });
      });
    }catch(e){}
    on.sort(function(a, b){ return a.i - b.i; });
    return on;
  }

  /* 上の一覧に「出ている」方の番号を拾います（＝送信の対象）。
   *
   *  ★2026/9/23 直し。ここも危ないところでした。
   *
   *  【改良前】 window.RENT.detail をそのまま全部なめて、
   *            「メールアドレスがある方」を対象にしていました。
   *            ところが detail には
   *            **「メール送信しないオーナー（別管理）」の方も入っています**
   *            （ownermail.js は、画面に出すときだけ外しています）。
   *            当社が「メールは送らない」と決めた方に、
   *            初回パスワードのご案内メールが飛びます。
   *
   *  【改良後】 一覧のチェックの箱（.rent-check）がある方だけを対象にします。
   *            別管理の方は一覧に出ないので箱もなく、自然に外れます。
   *            ★画面に見えているものと、送る相手が、必ず一致します。 */
  /* 一覧に「出ている」方の番号。メールの有無は問いません。
   *  ★別管理の方は一覧に出ないので、ここに入りません。
   *  ★アドレスが未登録の方は、押せない箱つきで一覧に出ます。
   *    ですのでここには入り、「アドレス未登録」として出せます。
   *    （別管理と、アドレス未登録は、まったく別のことです。
   *      前者は当社が「送らない」と決めた方、
   *      後者は当社が「直さなければならない」方です。
   *      同じ札にすると、直すべきものが埋もれます。） */
  function shown(){
    var set = {};
    try{
      var els = document.querySelectorAll('.rent-check');
      Array.prototype.forEach.call(els, function(el){
        var i = Number(el.value);
        if(isFinite(i)) set[i] = 1;
      });
    }catch(e){}
    return set;
  }

  function listed(list){
    var sh = shown(), out = [];
    Object.keys(sh).forEach(function(k){
      var i = Number(k);
      if(list[i] && String(list[i].email || '').trim() && out.indexOf(i) < 0){
        out.push(i);
      }
    });
    out.sort(function(a, b){ return a - b; });
    return out;
  }

  /* お名前を並べます（多いときは途中で切ります） */
  function names(list, idx){
    var max = 12;
    var a = idx.slice(0, max).map(function(i){
      var d = list[i];
      return '　・' + (d.owner || d.atena || d.email || '（お名前なし）');
    });
    if(idx.length > max) a.push('　ほか ' + (idx.length - max) + ' 名');
    return a.join('\n');
  }

  /* ── 押されたとき ──────────────────────────── */
  function run(){
    var cfg = conf(false);
    if(!cfg) return;

    var got  = pickDetail();
    var list = got.list;
    if(!list.length){
      alert('送るものがありません。\n\n先に明細PDFを取り込んで、振り分けをご確認ください。');
      return;
    }

    /* 送れるのは、上の一覧に出ていて、メールアドレスがある方だけです。
       ★「別管理」の方は、ここに入りません。 */
    var withMail = listed(list);
    if(!withMail.length){
      var anyMail = false;
      for(var i = 0; i < list.length; i++){
        if(String(list[i].email || '').trim()){ anyMail = true; break; }
      }
      alert(anyMail
        ? ('上の一覧に、送信できるオーナー様が出ていません。\n\n' +
           '「メール送信しないオーナー（別管理）」の方だけ、という状態かもしれません。\n' +
           '別管理の方には、マイページへも送りません。\n\n' +
           '通常の一覧に出ている方に送るには、上の枠へ明細PDFを取り込んでください。')
        : 'メールアドレスが登録されているオーナー様がいません。');
      return;
    }

    /* ★2026/10/1 … 「チェックが0なら全員」をやめました。
     *
     *  ご指示： 「チェックしたオーナーだけにする仕様に変更して」
     *
     *  改良前は、0件のときに「全員に送りますか？」とお尋ねし、
     *  ［OK］で全員に送っていました。112名の初回パスワードが
     *  一度に飛ぶ道が、確認1回の先に残っていました。
     *  改良後は、その道をなくします。送るのは、印を入れた方だけです。 */
    var idx = picked(list);
    if(!idx.length){
      alert('どなたにも印が入っていません。\n\n' +
            'オーナー様のカードの ☐ に印を入れてから、もう一度押してください。\n\n' +
            '　☑ 今月の明細 … ご利用中の方。毎月はこれです\n' +
            '　☐ 招待する　 … はじめての方。初回パスワードが届きます\n' +
            '　☐ 再送付　　 … パスワードを作り直してお送りします');
      return;
    }

    /* ★アドレスの形がおかしいときは、通信する前に止めます（2026/10/1）。
     *
     *  打ち間違えたまま送ると、オーナー様はログインできなくなり、
     *  明細もよその方に届きます。
     *
     *  ★ここで止めます。登録状況を読みにいくより前です。
     *    あとで止めると、むだな通信を1回してから止まることになり、
     *    「送っていません」とお伝えするのに一手おくれます。 */
    var reChk = reSend(list);
    var badIdx = [];
    for(var q = 0; q < reChk.length; q++){
      if(!mailOk(reChk[q].next)) badIdx.push(reChk[q].i);
    }
    if(badIdx.length){
      alert('メールアドレスの形が正しくないようです。\n\n' +
            names(list, badIdx) + '\n\n' +
            'ご確認のうえ、もう一度押してください。\n' +
            '（まだ1名にも送っていません。通信もしていません）');
      return;
    }

    var btn = document.getElementById('btn-to-mypage');
    var say = function(t){ if(btn) btn.textContent = t; };
    if(btn){ btn.disabled = true; btn.textContent = '確認しています…'; }

    /* ★送る前に、台帳に「もう招待済みか」を聞きます。
         「はじめての方が何名か」を、押す前にお見せするためです。
         読めなくても送れます（そのときは人数を出しません）。 */
    invLoad(cfg)
      .catch(function(){ invMap = null; })
      .then(function(){
        if(btn){ btn.disabled = false; btn.textContent = 'マイページへ送る'; }

        var neu = 0, old = 0, unknown = (invMap === null);
        if(!unknown){
          idx.forEach(function(i){
            if(invOf(list[i].email)) old++; else neu++;
          });
        }

        /* ★一度に多すぎるときの止め金（2026/9/23）
         *
         *  オーナー様は112名います。全員にチェックを入れて押すと
         *    ・1名につき2回やりとりするので 224回。8〜12分かかります
         *    ・その間、この画面を閉じられません
         *    ・ご案内メールは1日100通まで。超えたぶんは黙って届きません
         *      （再設定・お返事のお知らせも、同じ100通枠を使います）
         *  押す前に、はっきりお伝えします。止めはしません。
         *  ★数はこちらで決めつけず、実際の人数から出しています。 */
        var warn = '';
        if(idx.length > MANY){
          warn += '\n★ 一度に ' + idx.length + ' 名です。\n' +
                  '　 1名につき2回やりとりするため、およそ ' +
                  Math.ceil(idx.length * 2 * 2 / 60) + '〜' +
                  Math.ceil(idx.length * 2 * 3 / 60) + ' 分かかり、\n' +
                  '　 その間この画面を閉じられません。\n' +
                  '　 ' + MANY + ' 名ずつに分けると、結果の表も読みやすく、\n' +
                  '　 途中で失敗したときの押し直しも楽になります。\n';
        }
        /* ★本当の残り通数（stQuota）が読めているときは、そちらを使います。
             目安の MAIL_DAY は、読めなかったときの控えです。
             両方出すと、どちらを信じるか分からなくなります。 */
        if(mailLeft === null || mailLeft < 0){
          if(!unknown && neu > MAIL_DAY){
            warn += '\n★ はじめての方が ' + neu + ' 名です。\n' +
                    '　 ご案内メールは1日 ' + MAIL_DAY + ' 通ほどまでで、\n' +
                    '　 再設定・お返事のお知らせも同じ枠を使います。\n' +
                    '　 超えたぶんは届きません（台帳の「つまずき記録」に残ります）。\n' +
                    '　 日を分けてお送りください。\n';
          }
        }

        /* ★2026/10/1 追加。明細PDFを作れないときは、押す前に止めます。
         *
         *  改良前は「※ 明細PDFは付きません」とだけ出して、そのまま
         *  送っていました。はじめての方には、明細が1枚も無いマイページへの
         *  ご案内メールが飛びます。取り消せません。
         *
         *  ★すでに招待済みの方が混じっているときは、止めません。
         *    その方には明細の行だけ入るので、送る値があります。
         *    はじめての方のぶんだけ、送らないとお伝えします。 */
        if(!got.live){
          if(unknown){
            alert('明細PDFを作れない状態です。\n\n' +
                  'この画面で明細PDFを取り込み直してから、もう一度押してください。\n\n' +
                  '※ マイページの登録状況も読めていないため、どなたが招待済みか\n' +
                  '　 分かりません。明細の入っていないマイページにお招きしないよう、\n' +
                  '　 送信を止めました。');
            return;
          }
          if(!old){
            alert('明細PDFを作れない状態です。\n\n' +
                  'チェックされた ' + idx.length + ' 名は、全員「はじめての方」です。\n' +
                  '明細が1枚も入っていないマイページにお招きすることになるため、\n' +
                  '送信を止めました。\n\n' +
                  'この画面で明細PDFを取り込み直してから、もう一度押してください。');
            return;
          }
        }

        var re = reSend(list);
        var chg = re.filter(function(x){ return x.changed; });
        var kc  = kinds();
        /* ★2026/10/1 … 何が起きるかを、種類ごとに先に書きます。
             改良前はお名前の羅列が先頭にあり、肝心の
             「パスワードが変わる方が何名か」が下に埋もれていました。 */
        var msg = 'オーナーマイページへ送ります。\n\n' +
          '　送る相手： ' + idx.length + ' 名\n' +
          (kc.mon ? ('　　☑ 今月の明細　' + kc.mon + ' 名' +
                     ' … 明細が入ったお知らせが届きます\n') : '') +
          (kc.inv ? ('　　☐ 招待する　　' + kc.inv + ' 名' +
                     ' … 初回パスワードのご案内が届きます\n') : '') +
          (kc.re  ? ('　　☐ 再送付　　　' + kc.re  + ' 名' +
                     ' … ★パスワードを作り直します\n') : '') +
          '\n' + names(list, idx) + '\n\n' +
          (re.length
            ? ('　うち 再送付： ' + re.length + ' 名\n' +
               names(list, re.map(function(x){ return x.i; })) + '\n' +
               '　　→ 開設のご案内（初回パスワード）をもう一度お送りします。\n' +
               '　　　 パスワードは新しいものに変わります。\n\n')
            : '') +
          (chg.length
            ? ('★ メールアドレスを変えます（' + chg.length + ' 名）\n' +
               chg.map(function(x){
                 var d = list[x.i];
                 return '　・' + (d.owner || d.atena || '（お名前なし）') + '\n' +
                        '　　　前： ' + x.now + '\n' +
                        '　　　後： ' + x.next;
               }).join('\n') + '\n\n' +
               '　　ログインIDも、このアドレスに変わります。\n' +
               '　　打ち間違えると、オーナー様はログインできなくなり、\n' +
               '　　明細もよその方に届きます。よくご確認ください。\n\n')
            : '') +
          (unknown
            ? '※ 登録状況を読めなかったため、はじめての方の人数は分かりません。\n'
            : '') +
          /* ★本日の枠。足りないときだけ出します。
               足りているときにも出すと、読み飛ばす字が増えるだけです。 */
          ((mailLeft !== null && mailLeft >= 0 && idx.length > mailLeft)
            ? ('\n★ 本日の送信枠は、あと ' + mailLeft + ' 通です。\n' +
               '　 きょう ' + mailLeft + ' 名にお送りし、残り ' +
               (idx.length - mailLeft) + ' 名は\n' +
               '　 明日の朝、マイページ側から自動でお送りします。\n' +
               '　 ★押すのは今日の1回だけで結構です。明日は何もなさらなくて\n' +
               '　　 かまいません。\n')
            : '') +
          (got.live ? '' :
           '\n※ 明細PDFを作れません。\n' +
           '　 はじめての方 ' + neu + ' 名には、招待を送りません。\n' +
           '　 （明細が1枚も無いマイページにお招きしないためです）\n' +
           '　 すでに登録済みの ' + old + ' 名には、明細の行だけ入ります。\n' +
           '　 この画面で明細PDFを取り込み直すと、全員に送れます。\n') +
          warn +
          '\nよろしいですか？';
        if(!window.confirm(msg)) return;

        if(btn) btn.disabled = true;
        board(null);
        invBoard(null);

        return go(cfg, list, idx, say, got.live, re)
          .then(function(r){
            board(r.rows);
            invMap = null;          /* 台帳が変わったので、次は読み直します */
            /* ★送ったばかりの方を「招待済み」に変えます */
            invQuiet();
          })
          .catch(function(e){
            board(null);
            alert(e && e.message ? e.message : '通信できませんでした。');
          })
          .then(function(){
            if(btn){ btn.disabled = false; btn.textContent = 'マイページへ送る'; }
          });
      });
  }

  /* ══════════════════════════════════════════════
   *  送った結果を、オーナー様1名ずつ出します
   *
   *  ★なぜ必要か
   *    メールでお送りしていたころは、届かなければ返ってきたので
   *    「送れなかった」がすぐ分かりました。マイページに入れる形では、
   *    返ってくるものがありません。
   *    そこで、1名ずつ送って1名ずつ答えを受け取り、この表に出します。
   *
   *  ★どうやって1名ずつ確かめているか
   *    push 窓口は added（明細を入れた数）を返します。
   *    1名だけ送れば、added は 0 か 1 です。つまり
   *    「この方の明細が入ったか」が、そのまま分かります。
   *    ★Apps Script は1行も触っていません。
   *
   *  ★1名ずつにすると通信の回数は増えますが、PDFはもともと
   *    1名ずつ送っているので、2倍になるだけです。
   * ══════════════════════════════════════════════ */
  function board(rows){
    var old = document.getElementById('tmp-board');
    if(old && old.parentNode) old.parentNode.removeChild(old);
    if(!rows) return;

    var ng = rows.filter(function(r){ return !r.ok; }).length;
    var box = document.createElement('div');
    box.id = 'tmp-board';
    box.style.cssText =
      'margin:14px 0;padding:14px 16px;border-radius:12px;background:#fff;' +
      'border:1px solid ' + (ng ? '#d70015' : '#d2d2d7') + ';font-size:13px;' +
      'color:#1d1d1f;line-height:1.7';

    var head = document.createElement('p');
    head.style.cssText = 'margin:0 0 10px;font-weight:800;font-size:14px;' +
      (ng ? 'color:#c9001a' : 'color:#1d1d1f');
    head.textContent = ng
      ? ('マイページに入らなかった方が ' + ng + ' 名います。下をご確認ください。')
      : ('マイページに ' + rows.length + ' 名ぶん、すべて入りました。');
    box.appendChild(head);

    var t = document.createElement('table');
    t.style.cssText = 'width:100%;border-collapse:collapse;font-size:12.5px';
    t.innerHTML =
      '<thead><tr>' +
      ['オーナー様','アカウント','開設のご案内','明細のお知らせ','明細','明細PDF']
        .map(function(h){
        return '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid ' +
               '#e5e5ea;font-weight:700;color:#57575c">' + h + '</th>';
      }).join('') + '</tr></thead><tbody>' +
      rows.map(function(r){
        var td = function(x, c){
          return '<td style="padding:6px 8px;border-bottom:1px solid #f0f0f2' +
                 (c ? (';color:' + c + ';font-weight:700') : '') + '">' + x + '</td>';
        };
        return '<tr>' +
          td(esc(r.name || r.email)) +
          td(r.acct || '分かりません', r.acct === '分かりません' ? '#c9001a' : '') +
          td(r.mailTxt, r.mailOk === false ? '#d70015'
                      : (r.mailOk === null ? '#57575c' : '')) +
          td(r.noteTxt, r.noteOk === false ? '#d70015'
                      : (r.noteOk === null ? '#57575c' : '')) +
          td(r.addedTxt, r.added ? '' : '#c9001a') +
          td(r.pdfTxt,   r.pdf   ? '' : '#c9001a') +
          '</tr>';
      }).join('') + '</tbody>';
    box.appendChild(t);

    var note = document.createElement('p');
    note.style.cssText = 'margin:10px 0 0;font-size:12px;color:#57575c';
    var netNg = rows.filter(function(r){ return r.acct === '分かりません'; }).length;
    var mailNg = rows.filter(function(r){ return r.mailOk === false; }).length;
    var noteNg = rows.filter(function(r){ return r.noteOk === false; }).length;
    /* ★2026/10/1 追加。明細PDFが無くて招待を止めた方です。
         noreg … マイページの登録状況も読めなかった（つながっていない疑い）
         nopdf … つながってはいるが、明細PDFが入らなかった */
    var skipNo = rows.filter(function(r){ return r.skip && r.skipWhy === 'noreg'; }).length;
    var skipPd = rows.filter(function(r){ return r.skip && r.skipWhy === 'nopdf'; }).length;
    note.textContent = netNg
      ? '★「分かりません」「通信できませんでした」は、マイページ側に1回も' +
        'つながっていない状態です。アカウントも作られておらず、' +
        'ご案内メールも出ていません。［接続設定］の URL と、デプロイの' +
        '「アクセスできるユーザー＝全員」をご確認のうえ、もう一度お試しください。'
      : skipNo
      ? '★「送っていません」の方へは、こちらから1通も送っていません。' +
        'アカウントも作られておらず、ご案内メールも出ていません。' +
        'マイページの登録状況を読めず、明細PDFも入らなかったため、' +
        '明細の無いマイページにお招きしないよう止めました。マイページ側に' +
        'つながっていない可能性があります。［接続設定］の URL と、デプロイの' +
        '「アクセスできるユーザー＝全員」をご確認のうえ、もう一度お試しください。'
      : skipPd
      ? '★「送っていません」の方へは、こちらから1通も送っていません。' +
        'アカウントも作られておらず、ご案内メールも出ていません。' +
        '明細PDFが入らなかったため、招待を止めました。この画面で明細PDFを' +
        '取り込み直してから、もう一度押してください。'
      : mailNg
      ? '★「開設のご案内」が“出ていません”の方は、初回パスワードが届いておらず、' +
        'マイページに入れません。マイページ側の記録をご確認のうえ、当社からお伝えください。'
      : noteNg
      ? '★「明細のお知らせ」が“出ていません”の方は、明細は入っていますが、' +
        '入ったことをご存じありません。1日の送信上限に達している可能性があります。' +
        '台帳の「つまずき記録」をご確認ください。'
      : (ng
        ? '明細PDFが「なし」の方は、この画面で明細PDFを取り込み直してから、' +
          'もう一度押してください。同じ月のぶんは置き換わり、増えません。'
        : 'オーナー様が実際にご覧になったかは、この表では分かりません。' +
          '入ったところまでの確かめです。');
    box.appendChild(note);

    var host = document.getElementById('btn-to-mypage');
    host = host ? host.parentNode : document.getElementById('view-send');
    if(host && host.parentNode) host.parentNode.insertBefore(box, host.nextSibling);
    else if(host) host.appendChild(box);
    try{ box.scrollIntoView({ block:'nearest' }); }catch(e){}
  }

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"]/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];
    });
  }

  /* ── PDFの文字列を、送れる形にそろえます ──────────
   *
   *  ★2026/9/23、本番で実際に起きた不具合の直しです。
   *
   *  【改良前】
   *      b64 = window.RENT.makeOwnerPdfBase64(i);
   *
   *    ところが ownermail.js の makeOwnerPdfBase64 は **async** です。
   *    返ってくるのは PDF の文字列ではなく「**約束（Promise）**」でした。
   *    約束は空でない値なので if(!b64) を通り抜け、そのまま送られます。
   *    JSON にすると中身が消えて {} になり、マイページ側では
   *      「文字列をデコードできませんでした。」
   *    になります。しかも画面には「入りませんでした」とだけ出ていました。
   *
   *  【改良後】 必ず待ってから、形も確かめてから送ります。
   *    形が違えば **送りません**。送ってしまうと、
   *    マイページ側で失敗するだけで、原因が分からなくなります。 */
  function cleanB64(v){
    if(typeof v !== 'string') return null;              /* 約束・数・null など */
    var t = v.replace(/^data:[^,]*,/i, '').replace(/\s+/g, '');
    if(!t) return null;
    if(!/^[A-Za-z0-9+/]+={0,2}$/.test(t)) return null;  /* base64 の字だけか */
    if(t.length < 100) return null;                     /* PDFには短すぎます */
    return t;
  }

  /* その方のPDFを作って、送れる形で返します。
   *  返すもの： { b64:文字列 または null, why:出す字 } */
  function pdfOf(i, live){
    if(!live){
      return Promise.resolve({ b64:null, why:'なし（取り込み直しが必要）' });
    }
    var v;
    try{
      if(!(window.RENT && typeof window.RENT.makeOwnerPdfBase64 === 'function')){
        return Promise.resolve({ b64:null, why:'作れませんでした' });
      }
      v = window.RENT.makeOwnerPdfBase64(i);
    }catch(e){
      return Promise.resolve({ b64:null, why:'作れませんでした' });
    }
    /* ★約束でも、ふつうの値でも、同じように待てます */
    return Promise.resolve(v).then(function(raw){
      if(raw == null || raw === '') return { b64:null, why:'作れませんでした' };
      var ok = cleanB64(raw);
      if(ok) return { b64:ok, why:'' };
      /* 作れてはいるのに、形がおかしいとき。当社の不具合です。 */
      return { b64:null, why:'PDFの文字列が正しくありません（当社の不具合です）' };
    }, function(){
      return { b64:null, why:'作れませんでした' };
    });
  }

  /* ── 実際の送信 ──────────────────────────────
   *  ★2026/9/23 まで、PDFは1名ずつ送り、登録（push）だけ
   *    まとめて1回でした。まとめると答えが「何名ぶん入った」しか
   *    返らず、**誰が入らなかったのか分かりません**。
   *    メールなら届かなければ返ってきたのに、それが無くなっていました。
   *    そこで、登録も1名ずつにします。 */
  function go(cfg, list, idx, say, live, reList){
    var rows = [], authNg = false;
    /* 番号 → { now, next, changed } の表にします */
    var reMap = {};
    (reList || []).forEach(function(x){ reMap[x.i] = x; });

    var chain = Promise.resolve();
    idx.forEach(function(i, k){
      chain = chain.then(function(){
        if(authNg) return;                 /* 管理キーが違えば、続けても同じです */
        say('送信中… ' + (k + 1) + '/' + idx.length);

        var o = shape(list[i]);
        var rq = reMap[i] || null;
        var row = { name:o.name, email:o.email,
                    resend:!!rq,
                    made:false, added:false, pdf:false,
                    /* ★acct は3つの状態があります。
                         '新しく作りました' ／ 'もとからあります' ／ '分かりません'
                         通信が失敗したときは made が分からないので、
                         「もとからあります」と言い切ってはいけません。 */
                    acct:'分かりません',
                    addedTxt:'—', pdfTxt:'—',
                    /* ★「明細が入りました」のお知らせメール。
                     *   noteOk は 3つの状態： true / false / null（確かめられません） */
                    noteOk:null, noteTxt:'—',
                    /* ★開設のご案内メール（初回パスワード）が出たか。
                     *   null は「確かめられません」です。赤にはしません。 */
                    mailOk:null, mailTxt:'—' };

        /* ① この方のPDFをドライブへ
         *  ★makeOwnerPdfBase64 は ownermail.js の囲いの中にあります。
         *    window.RENT から呼びます。**async なので、必ず待ちます。**
         *    逃げ道（localStorage）で読んだときは、番号が合っている保証が
         *    ないので呼びません。取り違えたPDFを送るほうが困るためです。 */
        var step1 = pdfOf(i, live).then(function(g){
          if(!g.b64){ row.pdfTxt = g.why; return; }
          var nm = (o.name + '_明細_' + o.ym + '.pdf').replace(/\s/g, '');
          return post(cfg.url, { action:'putPdf', key:cfg.key, name:nm, b64:g.b64 })
            .then(function(r){
              if(r && r.ok && r.id){ o.fileId = r.id; row.pdf = true; row.pdfTxt = '入りました'; }
              else{
                /* ★マイページ側は、なぜ入らなかったかを message で返してきます
                 *   （例「ドライブへ入れられませんでした。DRIVE_ID をご確認ください。」）。
                 *   改良前は、それを捨てて「入りませんでした」とだけ出していました。
                 *   直す場所が分からず、原因さがしが始められませんでした。 */
                row.pdfTxt = (r && r.message) ? String(r.message) : '入りませんでした';
              }
            })
            .catch(function(){ row.pdfTxt = '通信できませんでした'; });
        });

        /* ② この方を登録（1名だけ送るので、added は 0 か 1 になります）
         *
         *  ★2026/10/1 追加。明細PDFが入らなかった方には、招待を送りません。
         *
         *  ご指示： 「マイページへ送る、は、明細添付していることを
         *           条件にしてください。明細添付してないオーナーは招待不可」
         *
         *  なぜ要るか： 初回のご案内メールは取り消せません。明細が1枚も
         *  入っていないマイページにお招きすると、オーナー様はログインして
         *  何も無い画面をご覧になります。はじめてお使いになる画面が空で、
         *  当社には「送った」と出ている——これがいちばん困る形です。
         *
         *  ★見るのは「PDFがドライブに入ったか（row.pdf）」です。
         *    「PDFを作れたか」ではありません。作れてもドライブに
         *    入らなければ、オーナー様の画面には何も出ないためです。
         *
         *  ★すでに招待済みの方は、そのまま送ります。
         *    その方には招待メールは出ず、明細の行が増えるだけなので、
         *    止める理由がありません（ご指示も「招待不可」です）。 */
        return step1.then(function(){
          if(!row.pdf && !invOf(o.email)){
            /* ★送らなかった方には印をつけます。表の下の一言で
                 「こちらから1通も送っていない」とお伝えするためです。
                 印が無いと、netNg が 0 になり、通信が死んでいても
                 注意書きが出なくなります（2026/10/1 に一度やりました）。 */
            row.skip   = true;
            row.skipWhy = (invMap === null) ? 'noreg' : 'nopdf';
            row.acct   = '送っていません';
            row.addedTxt = (invMap === null)
              ? '登録状況が読めず、明細PDFも入らなかったため、送りませんでした'
              : '明細PDFが入らなかったため、招待しませんでした';
            row.noteOk = null; row.noteTxt = '—';
            row.mailOk = null; row.mailTxt = '—';
            return null;                /* ★push しません */
          }
          return post(cfg.url, { action:'push', key:cfg.key, owners:[o] });
        }).then(function(r){
          if(r === null) return;        /* 送らなかった方（上で理由を入れてあります） */
          if(r && r.error === 'auth'){ authNg = true; return; }
          if(!r || !r.ok){
            row.addedTxt = (r && r.message) ? String(r.message) : '入りませんでした';
            return;
          }
          row.made = !!r.made;
          row.acct = row.made ? '新しく作りました' : 'もとからあります';

          /* ★開設のご案内メール（初回パスワード）が出たか。
           *
           *  なぜ要るか： このメールが出ないと、オーナー様は
           *  マイページに入れません。それでも今までは「新しく作りました」と
           *  出るだけで、出ていないことに誰も気づけませんでした。
           *
           *  ★マイページ側が mailNg を返すようになったときだけ分かります。
           *    返さないあいだは null にして、赤にはしません。
           *    分からないものを「出ました」とも「出ていません」とも言いません。 */
          if(row.resend && !row.made){
            /* ★あとで stResend を呼んで、その答えで埋めます */
            row.mailOk = null; row.mailTxt = '—';
          }else if(!row.made){
            row.mailOk = null; row.mailTxt = '—';
          }else if(r.mailNg == null){
            row.mailOk = null; row.mailTxt = '確かめられません';
          }else if(Number(r.mailNg) > 0){
            row.mailOk = false; row.mailTxt = '出ていません';
          }else{
            row.mailOk = true; row.mailTxt = 'お送りしました';
          }

          /* ★「明細が入りました」のお知らせメール。
           *
           *  なぜ要るか： 2回目以降の送信では、マイページ側はメールを
           *  1通も出しません。オーナー様は、自分で開きにいかないと
           *  新しい明細に気づけません。
           *
           *  ★マイページ側が noted / noteNg を返すようになったときだけ
           *    分かります。返さないあいだは null（確かめられません）にし、
           *    赤にはしません。分からないものを「出た」とも言いません。
           *
           *  ★はじめての方には出ません（開設のご案内に書いてあるため）。
           *    同じ月に2通目も出ません（押し直しても増えません）。 */
          if(r.noted == null && r.noteNg == null){
            row.noteOk = null; row.noteTxt = '確かめられません';
          }else if(Number(r.noteWait) > 0){
            /* ★2026/10/1 … 1日の送信枠が尽きたとき。
             *   改良前は、ただ「出ていません」と赤く出すだけで、
             *   当社が手で押し直すしかありませんでした。
             *   改良後は、マイページ側が順番待ちに入れて、
             *   翌朝に自動でお送りします。ですので赤にはしません。
             *   ★「出ていません」と同じ色にすると、手を打つべきもの
             *     （本当に失敗したもの）が埋もれます。 */
            row.noteOk = null; row.noteTxt = '明日お送りします';
          }else if(Number(r.noteNg) > 0){
            row.noteOk = false; row.noteTxt = '出ていません';
          }else if(Number(r.noted) > 0){
            row.noteOk = true;  row.noteTxt = 'お送りしました';
          }else if(row.made){
            row.noteOk = null;  row.noteTxt = '—（開設のご案内に記載）';
          }else{
            row.noteOk = null;  row.noteTxt = '—（すでにお知らせ済み）';
          }

          if(o.ym && o.fileId){
            row.added   = (Number(r.added) > 0);
            row.addedTxt = row.added ? '入りました' : '入りませんでした';
          }else if(o.ym){
            /* PDFが無いときは、明細の行そのものを作りません（push の作り） */
            row.added   = false;
            row.addedTxt = 'PDFが無いため入りません';
          }else{
            row.addedTxt = '対象月が読めません';
          }
        }).catch(function(e){
          row.addedTxt = (e && e.message) ? '通信できませんでした' : '入りませんでした';
        }).then(function(){
          /* ★③ 再送付（＋メールアドレスの入れ直し）
           *
           *  ご指示： 「再送付もできるように」「再送付時にはメールアドレス
           *            入力できるようにしてほしい」
           *            入れ直したアドレスは、登録アドレスとして置き換わります。
           *
           *  ★明細（push）を先に済ませてから呼びます。
           *    アドレスを変えてから明細を入れると、どちらの口座の
           *    話なのかが入れ違いになるためです。
           *
           *  ★マイページ側（Apps Script）の窓口 stResend は、まだ
           *    入っていません。入るまでは、返ってきた字をそのまま出します。
           *    「お送りしました」とは絶対に言いません。 */
          if(!rq || authNg) return;
          return post(cfg.url, { action:'stResend', key:cfg.key,
                                 mail:rq.now, newMail:rq.next })
            .then(function(r2){
              if(r2 && r2.error === 'auth'){ authNg = true; return; }
              if(!r2 || !r2.ok){
                row.mailOk = false;
                row.mailTxt = (r2 && r2.message) ? String(r2.message)
                                                 : '窓口がまだ入っていません';
                return;
              }
              if(!r2.sent){
                row.mailOk = false;
                row.mailTxt = (r2.message) ? String(r2.message)
                                           : '再送付できていません';
                return;
              }
              row.mailOk = true;
              row.mailTxt = rq.changed ? '再送付しました（アドレス変更）'
                                       : '再送付しました';
              if(rq.changed) row.email = rq.next;
            })
            .catch(function(){
              row.mailOk = false; row.mailTxt = '通信できませんでした';
            });
        }).then(function(){
          row.ok = row.added && row.pdf &&
                   (row.mailOk !== false) && (row.noteOk !== false);
          rows.push(row);
        });
      });
    });

    return chain.then(function(){
      if(authNg){
        try{ localStorage.removeItem(LS_KEY); }catch(e){}
        throw new Error('管理キーが違うようです。\n\nもう一度押して、ご入力ください。');
      }
      return { rows: rows };
    });
  }

  /* ══════════════════════════════════════════════
   *  ボタンの上の「今月ぶん」のまとめ（2026/10/1）
   *
   *  ご指示： 「わかりやすい仕様に」「直感的な操作ができるような」
   *
   *  【改良前】 押すまで、何名に・何が起きるか分かりませんでした。
   *            確認の窓に長い文が出て、そこで初めて読むことになります。
   *  【改良後】 押す前から、ボタンの真上に出ています。
   *            印を入れ外しするたびに、その場で変わります。
   *
   *  ★数は、実際に印が入っている箱から数えます。
   *    「たぶんこうだろう」という推測は、1つも入れていません。
   * ══════════════════════════════════════════════ */
  function sumRow(n, ttl, txt, col){
    return '<div style="display:flex;gap:10px;align-items:baseline;' +
           'padding:2px 0">' +
           '<span style="flex:0 0 7.5em;font-weight:700;color:' + col + '">' +
           ttl + '</span>' +
           '<span style="flex:0 0 3.5em;text-align:right;font-weight:800;' +
           'font-variant-numeric:tabular-nums">' + n + ' 名</span>' +
           '<span style="flex:1 1 auto;color:#57575c">' + txt + '</span>' +
           '</div>';
  }

  function sumPaint(){
    var box = document.getElementById('tmp-sum');
    if(!box) return;

    var c  = kinds();
    var nm = noMailCount();
    var n  = c.inv + c.mon + c.re;

    var left =
      (mailLeft === null) ? '確かめていません' :
      (mailLeft < 0)      ? '確かめられません（マイページ側の窓口がまだのようです）' :
      ('あと ' + mailLeft + ' 通');

    /* ★足りないときだけ赤くします。足りているのに赤いと、
         本当に足りないときに気づけなくなります。 */
    var needs = c.inv + c.mon + c.re;      /* 1名につきメール1通 */
    var tight = (mailLeft !== null && mailLeft >= 0 && needs > mailLeft);

    box.innerHTML =
      '<p style="margin:0 0 8px;font-weight:800;font-size:14px">' +
        '今月ぶん　送る相手 ' + n + ' 名' +
      '</p>' +
      (c.mon ? sumRow(c.mon, '今月の明細', '明細が入ったことを、お知らせします', '#2c6ea1') : '') +
      (c.inv ? sumRow(c.inv, '招待する',   '開設のご案内（初回パスワード）が届きます', '#C9184A') : '') +
      (c.re  ? sumRow(c.re,  '再送付',     '★パスワードを作り直します', '#c9001a') : '') +
      (nm    ? sumRow(nm,    'アドレス未登録', '送れません。ご登録をお願いします', '#8a5a00') : '') +
      (n ? '' : '<div style="color:#57575c">カードの ☐ に印を入れてください。</div>') +
      '<p style="margin:8px 0 0;padding-top:8px;border-top:1px solid #e5e5ea;' +
        'font-size:12.5px;color:#57575c">' +
        '本日の送信枠　' + left +
        /* ★2026/10/1 … 枠が足りないときの言いかたを変えました。
         *   改良前は「◯名は届きません。日を分けてください」。
         *   当社が明日もう一度押す前提の書きかたで、押し忘れたら
         *   その方には永久に届きません。
         *   改良後は、マイページ側が順番待ちに入れて翌朝お送りします。
         *   ですので「何名が明日になるか」をお伝えします。
         *   ★押すのは今日の1回だけです。 */
        (tight
          ? ('<br><span style="color:#8a5a00;font-weight:800">' +
             '★ ' + needs + ' 通ぶん要ります。きょうは ' + mailLeft + ' 名、' +
             '残り ' + (needs - mailLeft) + ' 名は<u>明日の朝に自動でお送りします</u>。' +
             '押すのは今日の1回だけで結構です。</span>')
          : '') +
        (mailWait
          ? ('<br><span style="color:#8a5a00;font-weight:800">' +
             '順番待ち ' + mailWait + ' 件</span>' +
             '<span style="color:#8a8a8f;font-weight:400">' +
             '　前に送れなかったぶんです。明日の朝に自動でお送りします</span>')
          : '') +
        '<br><span style="color:#8a8a8f">' +
        '（マイページと PIVOT2 で、1日ぶんを分け合っています）</span>' +
      '</p>';
  }

  /* ── ボタンを置きます ──────────────────────── */
  function put(){
    if(document.getElementById('btn-to-mypage')) return;

    var host = document.getElementById('view-send') ||
               document.getElementById('rent-view');
    if(!host) return;

    var wrap = document.createElement('div');
    wrap.style.cssText =
      'margin:16px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap';

    var b = document.createElement('button');
    b.id = 'btn-to-mypage';
    b.type = 'button';
    b.textContent = 'マイページへ送る';
    b.style.cssText =
      'font:inherit;font-weight:800;font-size:15px;padding:12px 22px;' +
      'border-radius:9px;border:2px solid #C9184A;background:#C9184A;' +
      'color:#fff;cursor:pointer;min-height:46px';
    b.addEventListener('click', run);

    /* ★招待済みかどうかを、いつでも確かめられるようにします */
    var v = document.createElement('button');
    v.id = 'btn-mypage-inv';
    v.type = 'button';
    v.textContent = 'マイページの登録状況';
    v.style.cssText =
      'font:inherit;font-weight:700;font-size:14px;padding:11px 18px;' +
      'border-radius:9px;border:2px solid #C9184A;background:transparent;' +
      'color:#C9184A;cursor:pointer;min-height:46px';
    v.addEventListener('click', invRun);

    var s = document.createElement('button');
    s.type = 'button';
    s.textContent = '接続設定';
    s.style.cssText =
      'font:inherit;font-size:13px;padding:10px 14px;border-radius:8px;' +
      'border:1px solid #ccc;background:transparent;color:#666;cursor:pointer;min-height:44px';
    s.addEventListener('click', function(){ conf(true); });

    var note = document.createElement('span');
    note.textContent =
      'ご利用中の方は ☑ 今月の明細 がはじめから入っています。' +
      'はじめての方は ☐ 招待する に印を入れてください。';
    note.style.cssText = 'font-size:12.5px;color:#888';

    wrap.appendChild(b); wrap.appendChild(v); wrap.appendChild(s);
    wrap.appendChild(note);

    /* ★まとめは、ボタンの真上に置きます。
         押す前に目に入る場所でないと、出す意味がありません。 */
    var sum = document.createElement('div');
    sum.id = 'tmp-sum';
    sum.style.cssText =
      'margin:16px 0 0;padding:12px 16px;border-radius:12px;background:#fff;' +
      'border:1px solid #d2d2d7;font-size:13px;color:#1d1d1f;line-height:1.7;' +
      'max-width:640px';

    /* ★置く場所（2026/9/23 直し）
     *
     *  【改良前】 host.appendChild(wrap) で、view-send の**いちばん下**に
     *            置いていました。オーナー様の一覧（長い）と
     *            「メール送信しないオーナー（別管理）」より下になり、
     *            画面を何度もスクロールしないと見つかりませんでした。
     *
     *  【改良後】 ［一斉送信］の並びのすぐ下に置きます。
     *            チェックを入れる場所と同じ高さなので、目に入ります。
     *
     *  ★［一斉送信］が見つからないときは、今までどおりいちばん下に置きます
     *    （ownermail.js の作りが変わっても、ボタンが消えないようにするため）。 */
    var bar = document.getElementById('rent-btn-send');
    bar = bar ? bar.parentNode : null;
    if(bar && bar.parentNode){
      bar.parentNode.insertBefore(sum,  bar.nextSibling);
      bar.parentNode.insertBefore(wrap, sum.nextSibling);
    }else{
      host.appendChild(sum);
      host.appendChild(wrap);
    }
    sumPaint();

    /* ★オーナーカードに「招待」の箱を差し込みます（2026/10/1）。
         ownermail.js が一覧を描き直しても、また差し込みます。 */
    invWatch();
    invQuiet();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(put, 1200); });
  }else{
    setTimeout(put, 1200);
  }
  /* 画面が切り替わったあとにも置けるよう、しばらく試します */
  var n = 0;
  var t = setInterval(function(){ put(); if(++n > 20) clearInterval(t); }, 1500);

  /* ★オーナー一覧（#ownerCards）は、送信の画面とは別の画面です。
       そちらを開いたときにも札がつくよう、別に見張ります。
       ★一覧はクラウドから届いてから描かれるので、少し長めに待ちます。 */
  var n2 = 0;
  var t2 = setInterval(function(){
    ownWatch();
    if(document.getElementById('ownerCards')){ invQuiet(); clearInterval(t2); }
    if(++n2 > 40) clearInterval(t2);
  }, 1500);
})();
