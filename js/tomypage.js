/* ============================================================
 *  PIVOT2 →  オーナーマイページ  へ送る
 *
 *  ★ 既存のファイルには一切触りません。
 *    このファイルを足して、index.html に1行読み込むだけです。
 *
 *  ★ 合言葉（ADMIN_KEY）は、コードにも config.js にも書きません。
 *    pivot2 は公開リポジトリのためです。
 *    はじめて押したときに聞いて、その端末の中だけに覚えます。
 *
 *  ★ 使わせてもらうもの（ownermail.js の中にあります）
 *      detail[]                … オーナー別にまとめた明細
 *      makeOwnerPdfBase64(i)   … そのオーナーのページだけ抜いたPDF
 *    どちらも読むだけで、書き替えません。
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
        'マイページの Apps Script ウェブアプリURL を入れてください。\n' +
        '（https://script.google.com/macros/s/……/exec）', url || '') || '';
      if(!url) return null;
      try{ localStorage.setItem(LS_URL, url.trim()); }catch(e){}
    }
    if(force || !key){
      key = window.prompt(
        'マイページの合言葉（ADMIN_KEY）を入れてください。\n\n' +
        '※ この端末の中だけに覚えます。社外に出さないでください。', '') || '';
      if(!key) return null;
      try{ localStorage.setItem(LS_KEY, key.trim()); }catch(e){}
    }
    return { url:(url||'').trim(), key:(key||'').trim() };
  }

  function post(url, body){
    return fetch(url, {
      method : 'POST',
      headers: { 'Content-Type':'text/plain;charset=utf-8' },
      body   : JSON.stringify(body)
    }).then(function(r){ return r.json(); });
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

    var list;
    try{ list = detail; }catch(e){ list = null; }
    if(!Array.isArray(list) || !list.length){
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
              '\nはじめての方には、初回パスワードのご案内メールが届きます。\n' +
              'よろしいですか？';
    if(!window.confirm(msg)) return;

    var btn = document.getElementById('btn-to-mypage');
    var say = function(t){ if(btn) btn.textContent = t; };
    if(btn) btn.disabled = true;

    go(cfg, list, idx, say)
      .then(function(r){
        alert('送りました。\n\n' +
              '　新しく作ったアカウント： ' + (r.made || 0) + ' 件\n' +
              '　明細を入れた　　　　　： ' + (r.added || 0) + ' 件' +
              (r.pdfNg ? ('\n　PDFを入れられなかった： ' + r.pdfNg + ' 件') : ''));
      })
      .catch(function(e){
        alert(e && e.message ? e.message : '通信できませんでした。');
      })
      .then(function(){
        if(btn){ btn.disabled = false; btn.textContent = 'マイページへ送る'; }
      });
  }

  /* ── 実際の送信 ────────────────────────────── */
  function go(cfg, list, idx, say){
    var owners = [], pdfNg = 0;

    /* ① オーナーごとのPDFを、1件ずつドライブへ入れます */
    var chain = Promise.resolve();
    idx.forEach(function(i, k){
      chain = chain.then(function(){
        say('PDFを送信中… ' + (k + 1) + '/' + idx.length);
        var o = shape(list[i]);

        var b64 = null;
        try{
          if(typeof makeOwnerPdfBase64 === 'function') b64 = makeOwnerPdfBase64(i);
        }catch(e){ b64 = null; }

        return Promise.resolve(b64).then(function(data){
          if(!data){ pdfNg++; owners.push(o); return; }
          var name = (o.name + '_明細_' + o.ym + '.pdf').replace(/\s/g, '');
          return post(cfg.url, { action:'putPdf', key:cfg.key, name:name, b64:data })
            .then(function(r){
              if(r && r.ok && r.id) o.fileId = r.id;
              else pdfNg++;
              owners.push(o);
            })
            .catch(function(){ pdfNg++; owners.push(o); });
        });
      });
    });

    /* ② まとめて登録します */
    return chain.then(function(){
      say('登録中…');
      return post(cfg.url, { action:'push', key:cfg.key, owners:owners });
    }).then(function(r){
      if(r && r.ok) return { made:r.made, added:r.added, pdfNg:pdfNg };
      if(r && r.error === 'auth'){
        try{ localStorage.removeItem(LS_KEY); }catch(e){}
        throw new Error('合言葉が違うようです。\n\nもう一度押して、入れ直してください。');
      }
      throw new Error((r && r.message) || 'うまくいきませんでした。');
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
    s.textContent = '接続先を変える';
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
