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
      .then(function(){ invBoard(got.list); })
      .catch(function(e){ alert(e && e.message ? e.message : '確認できませんでした。'); })
      .then(function(){ if(btn){ btn.disabled = false; btn.textContent = was; } });
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

    return {
      email     : String(d.email || '').trim(),
      name      : d.owner || '',
      atena     : d.atena || d.owner || '',
      ym        : months.join('・'),
      total     : got ? total : null,
      sokinDate : sokins.join('・'),
      rows      : rows,
      status    : status
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
  function picked(list){
    var on = [];
    try{
      var els = document.querySelectorAll('.rent-check:checked');
      Array.prototype.forEach.call(els, function(el){
        var i = Number(el.value);
        if(isFinite(i) && list[i] && String(list[i].email || '').trim() &&
           on.indexOf(i) < 0) on.push(i);
      });
    }catch(e){}
    on.sort(function(a, b){ return a - b; });
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

    var idx = picked(list);
    if(!idx.length){
      if(!window.confirm(
        '上の一覧に、チェックが1つも入っていません。\n\n' +
        'メールアドレスのある ' + withMail.length + ' 名 **全員** に送りますか？\n\n' +
        '★はじめての方には、初回パスワードのご案内メールが届きます。\n' +
        '　送ったメールは、取り消せません。\n\n' +
        '1名だけお試しになるときは、［キャンセル］を押して、\n' +
        '上の一覧でその方にチェックを入れてから、もう一度押してください。')) return;
      idx = withMail;
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
        if(!unknown && neu > MAIL_DAY){
          warn += '\n★ はじめての方が ' + neu + ' 名です。\n' +
                  '　 ご案内メールは1日 ' + MAIL_DAY + ' 通ほどまでで、\n' +
                  '　 再設定・お返事のお知らせも同じ枠を使います。\n' +
                  '　 超えたぶんは届きません（台帳の「つまずき記録」に残ります）。\n' +
                  '　 日を分けてお送りください。\n';
        }

        var msg = 'オーナーマイページへ送ります。\n\n' +
          '　対象： ' + idx.length + ' 名\n' +
          names(list, idx) + '\n\n' +
          (unknown
            ? '※ 登録状況を読めなかったため、はじめての方の人数は分かりません。\n'
            : ('　はじめての方　 ' + neu + ' 名 ← 初回パスワードのご案内メールが届きます\n' +
               '　すでに登録済み ' + old + ' 名 ← メールは届きません。明細だけ増えます\n')) +
          (got.live ? '' :
           '\n※ 明細PDFは付きません。\n' +
           '　 この画面で明細PDFを取り込み直してから押していただくと、\n' +
           '　 PDFも一緒に送られます。\n') +
          warn +
          '\nよろしいですか？';
        if(!window.confirm(msg)) return;

        if(btn) btn.disabled = true;
        board(null);
        invBoard(null);

        return go(cfg, list, idx, say, got.live)
          .then(function(r){
            board(r.rows);
            invMap = null;          /* 台帳が変わったので、次は読み直します */
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
    note.textContent = netNg
      ? '★「分かりません」「通信できませんでした」は、マイページ側に1回も' +
        'つながっていない状態です。アカウントも作られておらず、' +
        'ご案内メールも出ていません。［接続設定］の URL と、デプロイの' +
        '「アクセスできるユーザー＝全員」をご確認のうえ、もう一度お試しください。'
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
  function go(cfg, list, idx, say, live){
    var rows = [], authNg = false;

    var chain = Promise.resolve();
    idx.forEach(function(i, k){
      chain = chain.then(function(){
        if(authNg) return;                 /* 管理キーが違えば、続けても同じです */
        say('送信中… ' + (k + 1) + '/' + idx.length);

        var o = shape(list[i]);
        var row = { name:o.name, email:o.email,
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

        /* ② この方を登録（1名だけ送るので、added は 0 か 1 になります） */
        return step1.then(function(){
          return post(cfg.url, { action:'push', key:cfg.key, owners:[o] });
        }).then(function(r){
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
          if(!row.made){
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
    note.textContent = 'チェックを入れた方だけに送ります（無ければ全員に確認します）';
    note.style.cssText = 'font-size:12.5px;color:#888';

    wrap.appendChild(b); wrap.appendChild(v); wrap.appendChild(s);
    wrap.appendChild(note);

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
      bar.parentNode.insertBefore(wrap, bar.nextSibling);
    }else{
      host.appendChild(wrap);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(put, 1200); });
  }else{
    setTimeout(put, 1200);
  }
  /* 画面が切り替わったあとにも置けるよう、しばらく試します */
  var n = 0;
  var t = setInterval(function(){ put(); if(++n > 20) clearInterval(t); }, 1500);
})();
