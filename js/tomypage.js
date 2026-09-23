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

    /* 送るのは、メールアドレスがある方だけです */
    var idx = [];
    for(var i = 0; i < list.length; i++){
      if(String(list[i].email || '').trim()) idx.push(i);
    }
    var noMail = list.length - idx.length;
    if(!idx.length){
      alert('メールアドレスが登録されているオーナー様がいません。');
      return;
    }

    var msg = 'オーナーマイページへ送ります。\n\n' +
              '　対象： ' + idx.length + ' 名\n' +
              (noMail ? ('　※ メールアドレスが無い ' + noMail + ' 名は送りません\n') : '') +
              (got.live ? '' :
               '\n※ 明細PDFは付きません。\n' +
               '　 この画面で明細PDFを取り込み直してから押していただくと、\n' +
               '　 PDFも一緒に送られます。\n') +
              '\nはじめての方には、初回パスワードのご案内メールが届きます。\n' +
              'よろしいですか？';
    if(!window.confirm(msg)) return;

    var btn = document.getElementById('btn-to-mypage');
    var say = function(t){ if(btn) btn.textContent = t; };
    if(btn) btn.disabled = true;
    board(null);

    go(cfg, list, idx, say, got.live)
      .then(function(r){ board(r.rows); })
      .catch(function(e){
        board(null);
        alert(e && e.message ? e.message : '通信できませんでした。');
      })
      .then(function(){
        if(btn){ btn.disabled = false; btn.textContent = 'マイページへ送る'; }
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
      ['オーナー様','アカウント','開設のご案内','明細','明細PDF'].map(function(h){
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
          td(r.made ? '新しく作りました' : 'もとからあります') +
          td(r.mailTxt, r.mailOk === false ? '#d70015'
                      : (r.mailOk === null ? '#57575c' : '')) +
          td(r.addedTxt, r.added ? '' : '#c9001a') +
          td(r.pdfTxt,   r.pdf   ? '' : '#c9001a') +
          '</tr>';
      }).join('') + '</tbody>';
    box.appendChild(t);

    var note = document.createElement('p');
    note.style.cssText = 'margin:10px 0 0;font-size:12px;color:#57575c';
    var mailNg = rows.filter(function(r){ return r.mailOk === false; }).length;
    note.textContent = mailNg
      ? '★「開設のご案内」が“出ていません”の方は、初回パスワードが届いておらず、' +
        'マイページに入れません。マイページ側の記録をご確認のうえ、当社からお伝えください。'
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
                    addedTxt:'—', pdfTxt:'—',
                    /* ★開設のご案内メール（初回パスワード）が出たか。
                     *   null は「確かめられません」です。赤にはしません。 */
                    mailOk:null, mailTxt:'—' };

        /* ① この方のPDFをドライブへ
         *  ★makeOwnerPdfBase64 は ownermail.js の囲いの中にあります。
         *    window.RENT から呼びます。
         *    逃げ道（localStorage）で読んだときは、番号が合っている保証が
         *    ないので呼びません。取り違えたPDFを送るほうが困るためです。 */
        var b64 = null;
        try{
          if(live && window.RENT &&
             typeof window.RENT.makeOwnerPdfBase64 === 'function'){
            b64 = window.RENT.makeOwnerPdfBase64(i);
          }
        }catch(e){ b64 = null; }

        var step1;
        if(!b64){
          row.pdfTxt = live ? '作れませんでした' : 'なし（取り込み直しが必要）';
          step1 = Promise.resolve();
        }else{
          var nm = (o.name + '_明細_' + o.ym + '.pdf').replace(/\s/g, '');
          step1 = post(cfg.url, { action:'putPdf', key:cfg.key, name:nm, b64:b64 })
            .then(function(r){
              if(r && r.ok && r.id){ o.fileId = r.id; row.pdf = true; row.pdfTxt = '入りました'; }
              else{ row.pdfTxt = '入りませんでした'; }
            })
            .catch(function(){ row.pdfTxt = '通信できませんでした'; });
        }

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
          row.ok = row.added && row.pdf && (row.mailOk !== false);
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

    var s = document.createElement('button');
    s.type = 'button';
    s.textContent = '接続設定';
    s.style.cssText =
      'font:inherit;font-size:13px;padding:10px 14px;border-radius:8px;' +
      'border:1px solid #ccc;background:transparent;color:#666;cursor:pointer;min-height:44px';
    s.addEventListener('click', function(){ conf(true); });

    var note = document.createElement('span');
    note.textContent = 'メール送信のあとに押してください';
    note.style.cssText = 'font-size:12.5px;color:#888';

    wrap.appendChild(b); wrap.appendChild(s); wrap.appendChild(note);
    host.appendChild(wrap);
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
