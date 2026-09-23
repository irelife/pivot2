/* ============================================================
 *  PIVOT2  ←→  オーナーマイページ　やりとり（当社側の返信画面）
 *
 *  ★ 既存のファイルには一切触りません。
 *    このファイルを足して、index.html に1行読み込むだけです。
 *    タブも置き場所も、このファイルが自分で作ります。
 *
 *  ★ いままで： オーナー様からのご連絡に返すには、別の画面
 *    （マイページ側の staff.html）を開き、合言葉を入れ直していました。
 *    これから： 「家賃明細 オーナー送信」の5つめのタブで返せます。
 *    ［マイページへ送る］と同じ URL・同じ合言葉を使うので、
 *    入れ直しは要りません。
 *
 *  ★ 合言葉（ADMIN_KEY）は、コードにも config.js にも書きません。
 *    pivot2 は公開リポジトリのためです。
 *    tomypage.js が端末に覚えたものを借ります。無ければ聞きます。
 *
 *  ★ 使う窓口（マイページ側にもとからあるもの。GAS は足していません）
 *      stPing  … 合言葉が合っているかだけ確かめる
 *      stList  … やりとりの一覧（お返事がまだのものが上）
 *      stReply … お返事を入れる（オーナー様の画面にも出ます）
 *      stArea  … その方の支社を決める
 *
 *  ★ stReply に mail は送りません。
 *    2026/9/23 の直しで、マイページ側が番号から宛先を引くようになりました。
 *    画面から宛先を送ると、選び間違いで別のオーナー様に届くためです。
 * ============================================================ */
(function(){
  'use strict';

  /* tomypage.js と同じ鍵を使います（入れ直しをさせないため） */
  var LS_URL = 'pv_mypage_url';
  var LS_KEY = 'pv_mypage_key';

  var area  = '';        /* '' = すべて / '?' = 支社がまだ */
  var only  = true;      /* お返事がまだのものだけ */
  var ready = false;     /* 合言葉が通ったか */

  function $(id){ return document.getElementById(id); }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];
    });
  }

  /* ── 設定（tomypage.js が覚えたものを借ります） ── */
  function conf(force){
    var url = '', key = '';
    try{
      url = localStorage.getItem(LS_URL) || '';
      key = localStorage.getItem(LS_KEY) || '';
    }catch(e){}

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
    return { url:(url || '').trim(), key:(key || '').trim() };
  }

  /* ── 送る ──
   *  ★ r.text() を通してから JSON にします。マイページ側が JSON でない
   *    ものを返したとき（デプロイの公開先が「全員」でない・URL が古い など）、
   *    「Unexpected token <」ではなく、確かめる先が分かるようにするためです。 */
  function call(action, data){
    var cfg = conf(false);
    if(!cfg) return Promise.reject(new Error('設定が終わっていません。'));

    return fetch(cfg.url, {
      method : 'POST',
      headers: { 'Content-Type':'text/plain;charset=utf-8' },
      body   : JSON.stringify(Object.assign({ action:action, key:cfg.key }, data || {}))
    })
    .then(function(r){ return r.text(); })
    .then(function(t){
      var r;
      try{ r = JSON.parse(t); }
      catch(e){
        throw new Error(
          'マイページ側から、思っていない答えが返りました。\n\n' +
          '次の3つをご確認ください。\n' +
          '　・URL が「……/exec」で終わっているか\n' +
          '　・デプロイの「アクセスできるユーザー」が「全員」か\n' +
          '　・デプロイを管理 → 鉛筆 → 新バージョン で反映したか');
      }
      if(r && r.ok) return r;
      var e2 = new Error((r && r.message) || 'うまくいきませんでした。');
      e2.code = (r && r.error) || '';
      throw e2;
    });
  }

  /* ── 見た目（このファイルの中だけ。base.css は触りません） ── */
  function css(){
    if($('orp-css')) return;
    var st = document.createElement('style');
    st.id = 'orp-css';
    st.textContent = [
      /* ★ここだけ独自の色を持ちます。
       *   画面の --rt-warn（#ff3b30）は明るすぎて、白文字を乗せると
       *   明暗差が 3.55:1 しかありません（読める線は 4.5:1）。
       *   薄い赤地に赤文字だと 3.12:1 でした。計算して決めた値を使います。
       *     #d70015 … 白文字を乗せて 5.38:1（バッジ・枠線）
       *     #c9001a … #ffeceb の地に乗せて 5.27:1（チップの文字）
       *     #57575c … 薄い地（#f5f5f7）に乗せて 5.4:1（小さい注記）
       *   ★--rt-warn 自体は直しません。ほかの画面の見た目を変えないためです。 */
      '#view-reply,#rent-view .tab .orp-n{--orp-ng:#d70015;--orp-ng-t:#c9001a;--orp-sub:#57575c}',
      '#rent-view .tab .orp-n{display:inline-flex;align-items:center;justify-content:center;',
      '  min-width:18px;height:18px;margin-left:7px;padding:0 5px;border-radius:9px;',
      '  background:var(--orp-ng);color:#fff;font-size:.68rem;font-weight:800;line-height:1}',
      /* ★hidden を付けただけでは消えません。display を自分で書いているため、
       *   ブラウザの [hidden]{display:none} に勝ってしまいます。
       *   0件のときに「0」が出てしまうので、ここで打ち消します。 */
      '#rent-view .tab .orp-n[hidden]{display:none}',
      '#view-reply .orp-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}',
      '#view-reply .orp-a{font-family:inherit;font-size:.8rem;font-weight:700;padding:7px 14px;',
      '  border-radius:999px;border:1px solid var(--rt-line);background:#fff;',
      '  color:var(--rt-muted);cursor:pointer}',
      '#view-reply .orp-a.on{background:var(--rt-accent-d);color:#fff;border-color:var(--rt-accent-d)}',
      '#view-reply .orp-a .n{margin-left:6px;font-size:.72rem;font-weight:800;color:var(--orp-ng-t)}',
      '#view-reply .orp-a.on .n{color:#ffd9d0}',
      '#view-reply .orp-only{display:flex;align-items:center;gap:6px;font-size:.8rem;font-weight:700}',
      '#view-reply .orp-mails{font-size:.74rem;color:var(--orp-sub);margin:0 0 14px}',
      '#view-reply .orp-t{background:var(--rt-card);border:1px solid var(--rt-line);',
      '  border-radius:12px;padding:14px 16px;margin-bottom:14px}',
      '#view-reply .orp-t.open{border-color:var(--orp-ng);box-shadow:0 0 0 1px var(--orp-ng) inset}',
      '#view-reply .orp-h{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px}',
      '#view-reply .orp-o{font-size:.92rem;font-weight:800}',
      '#view-reply .orp-c{font-size:.7rem;font-weight:700;padding:2px 9px;border-radius:999px;',
      '  border:1px solid var(--rt-line);color:var(--rt-muted);background:#fff}',
      '#view-reply .orp-c.open{background:#ffeceb;color:var(--orp-ng-t);font-weight:800;',
      '  border-color:#ffd9d6}',
      '#view-reply .orp-c.done{background:var(--rt-soft);color:var(--rt-accent-d);',
      '  border-color:var(--rt-soft)}',
      '#view-reply .orp-ti{font-size:.82rem;color:var(--orp-sub);margin-bottom:10px}',
      '#view-reply .orp-talk{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}',
      '#view-reply .orp-b{max-width:82%;padding:9px 13px;border-radius:13px;',
      '  background:var(--rt-paper);border:1px solid var(--rt-line);align-self:flex-start}',
      '#view-reply .orp-b.us{align-self:flex-end;background:var(--rt-soft);',
      '  border-color:var(--rt-soft)}',
      '#view-reply .orp-bw{display:block;font-size:.68rem;color:var(--orp-sub);margin-bottom:3px}',
      '#view-reply .orp-bb{display:block;font-size:.83rem;line-height:1.75;white-space:pre-wrap;',
      '  word-break:break-word}',
      '#view-reply .orp-r{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start}',
      '#view-reply .orp-r textarea{flex:1 1 260px;min-height:64px;font-family:inherit;',
      '  font-size:.83rem;line-height:1.7;padding:9px 11px;border:1px solid var(--rt-line);',
      '  border-radius:9px;background:#fff;color:var(--rt-ink)}',
      '#view-reply .orp-m{flex:1 1 100%;font-size:.78rem;font-weight:800;color:var(--orp-ng-t);',
      '  min-height:1.2em}',
      '#view-reply .orp-ar{display:flex;align-items:center;gap:8px;margin-top:10px;',
      '  padding-top:10px;border-top:1px solid var(--rt-line);font-size:.78rem}',
      '#view-reply .orp-ar select{font-family:inherit;font-size:.8rem;padding:6px 9px;',
      '  border:1px solid var(--rt-line);border-radius:8px;background:#fff;color:var(--rt-ink)}',
      /* 届いたか・見たかの表 */
      '#orp-chk{margin:0 0 16px;padding:14px 16px;background:var(--rt-card);',
      '  border:1px solid var(--rt-line);border-radius:12px}',
      '#orp-chk h3{margin:0 0 4px;font-size:.95rem;font-weight:800}',
      '#orp-chk .orp-cn{margin:0 0 12px;font-size:.78rem;color:var(--orp-sub)}',
      '#orp-chk table{width:100%;border-collapse:collapse;font-size:12.5px}',
      '#orp-chk th{text-align:left;padding:6px 8px;border-bottom:1px solid var(--rt-line);',
      '  font-weight:700;color:var(--orp-sub);white-space:nowrap}',
      '#orp-chk td{padding:6px 8px;border-bottom:1px solid #f0f0f2;white-space:nowrap}',
      '#orp-chk td.w{color:var(--orp-ng-t);font-weight:700}',
      '#orp-chk .orp-s{font-weight:800}',
      '#orp-chk .orp-s.ok{color:#0a7a3d}',
      '#orp-chk .orp-s.mid{color:#8a5a00}',
      '#orp-chk .orp-s.ng{color:var(--orp-ng-t)}',
      '#orp-chk .orp-sc{overflow-x:auto;-webkit-overflow-scrolling:touch}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ── タブと置き場所を作ります ── */
  function put(){
    if($('view-reply')) return true;

    var host = $('rent-view');
    if(!host) return false;
    var tabs = host.querySelector('.tabs');
    var hist = $('view-history');
    if(!tabs || !hist) return false;

    css();

    var b = document.createElement('button');
    b.className = 'tab';
    b.id = 'orp-tab';
    b.type = 'button';
    b.setAttribute('data-v', 'reply');
    b.innerHTML = 'オーナー様とのやりとり<span class="orp-n" id="orp-n" hidden></span>';
    b.addEventListener('click', function(){
      /* ★ RENT.showView に任せます。自分でクラスを付け替えると、
       *   ほかのタブと食い違うためです。 */
      try{ window.RENT.showView('reply'); }catch(e){}
      load();
    });
    tabs.appendChild(b);

    var v = document.createElement('div');
    v.className = 'view';
    v.id = 'view-reply';
    v.innerHTML =
      '<div class="bar" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;' +
      'margin-bottom:10px"><h2 style="font-size:1rem">オーナー様とのやりとり</h2>' +
      '<span class="spacer" style="flex:1"></span>' +
      '<button type="button" class="btn btn-sm" id="orp-chk-go">' +
      '届いたか・見たかを確かめる</button>' +
      '<button type="button" class="btn btn-sm" id="orp-again">読み込み直す</button>' +
      '<button type="button" class="btn btn-sm btn-warn" id="orp-key">合言葉を入れ直す</button>' +
      '</div>' +
      '<div style="font-size:.8rem;color:#57575c;margin-bottom:10px">' +
      'お返事がまだのものを上に出します。ここから返すと、オーナー様のマイページにも出ます。</div>' +
      '<div class="orp-bar" id="orp-tabs"></div>' +
      '<label class="orp-only"><input type="checkbox" id="orp-only" checked>' +
      'お返事がまだのものだけ</label>' +
      '<p class="orp-mails" id="orp-mails"></p>' +
      '<div id="orp-chk-host"></div>' +
      '<div id="orp-list"></div>';
    hist.parentNode.insertBefore(v, hist.nextSibling);

    $('orp-only').addEventListener('change', function(){
      only = $('orp-only').checked; load();
    });
    $('orp-again').addEventListener('click', load);
    $('orp-chk-go').addEventListener('click', check);
    $('orp-key').addEventListener('click', function(){
      if(!window.confirm('URL と合言葉を、もう一度入れ直しますか？')) return;
      if(conf(true)) load();
    });

    /* お返事がまだの数を、開かなくても見せます */
    quiet();
    return true;
  }

  /* ── タブの数字だけ、静かに取ってきます ── */
  function quiet(){
    var url = '', key = '';
    try{
      url = localStorage.getItem(LS_URL) || '';
      key = localStorage.getItem(LS_KEY) || '';
    }catch(e){}
    /* ★まだ設定していない方に、いきなり入力を求めません。 */
    if(!url || !key) return;

    call('stList', { area:'', open:true })
      .then(function(r){ badge((r.counts && r.counts['']) || 0); ready = true; })
      .catch(function(){ badge(0); });
  }

  function badge(n){
    var el = $('orp-n');
    if(!el) return;
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = !n;
  }

  /* ══════════════════════════════════════════════
   *  届いたか・見たかを確かめる（stCheck）
   *
   *  ★なぜ必要か
   *    メールなら、届かなければ返ってきました。マイページでは
   *    返ってくるものがありません。そのかわり「本当にご覧になったか」が
   *    分かります。
   *
   *  ★3つに分けて出します。
   *    ● ご覧になっています … ログインして、その月の明細も開いた
   *    ▲ 入りましたが未読 … 明細は入ったが、まだ開いていない
   *    ✗ 届いていません   … 明細が入っていない、または一度もログインなし
   *
   *  ★「中身を読んだか」は分かりません。画面を開いただけかもしれません。
   *    表の下にもそう書いてあります。
   * ══════════════════════════════════════════════ */
  function check(){
    var host = $('orp-chk-host');
    if(!host) return;
    var b = $('orp-chk-go');
    if(b){ b.disabled = true; b.textContent = '確かめています…'; }

    call('stCheck', {})
      .then(function(r){ chkPaint(r.list || []); })
      .catch(function(e){
        host.innerHTML = '<div class="empty">' +
          esc(e.message).replace(/\n/g, '<br>') + '</div>';
      })
      .then(function(){
        if(b){ b.disabled = false; b.textContent = '届いたか・見たかを確かめる'; }
      });
  }

  /* 1名ぶんの状態を決めます。★ここだけで決めます（同じ判断を2か所に書かないため） */
  function chkState(x){
    if(!x || !x.pdf)  return { key:'ng',  mark:'✗', txt:'届いていません' };
    if(!x.login)      return { key:'ng',  mark:'✗', txt:'一度もログインなし' };
    if(!x.opened)     return { key:'mid', mark:'▲', txt:'入りましたが未読' };
    return { key:'ok', mark:'●', txt:'ご覧になっています' };
  }

  function chkPaint(list){
    var host = $('orp-chk-host');
    if(!list.length){
      host.innerHTML = '<div class="empty">オーナー様がまだ登録されていません。</div>';
      return;
    }

    /* 未読・未着を上に、そのなかはお名前の順 */
    var rank = { ng:0, mid:1, ok:2 };
    var rows = list.slice().sort(function(a, b){
      var d = rank[chkState(a).key] - rank[chkState(b).key];
      if(d) return d;
      return String(a.name || a.mail).localeCompare(String(b.name || b.mail), 'ja');
    });

    var n = { ok:0, mid:0, ng:0 };
    list.forEach(function(x){ n[chkState(x).key]++; });

    var dash = function(v){ return v ? esc(v) : '—'; };

    host.innerHTML =
      '<div id="orp-chk">' +
        '<h3>届いたか・見たか</h3>' +
        '<p class="orp-cn">' +
          'ご覧になっています ' + n.ok + ' 名　／　' +
          '入りましたが未読 ' + n.mid + ' 名　／　' +
          '届いていません ' + n.ng + ' 名' +
        '</p>' +
        '<div class="orp-sc"><table>' +
        '<thead><tr><th>オーナー様</th><th>支社</th><th>対象月</th>' +
        '<th>明細PDF</th><th>ログイン</th><th>明細を開いた</th><th>状態</th>' +
        '</tr></thead><tbody>' +
        rows.map(function(x){
          var st = chkState(x);
          return '<tr>' +
            '<td>' + esc(x.name || x.mail) + '</td>' +
            '<td>' + dash(x.area) + '</td>' +
            '<td>' + dash(x.ym) + '</td>' +
            '<td' + (x.pdf ? '' : ' class="w"') + '>' +
              (x.pdf ? 'あり' : 'なし') + '</td>' +
            '<td' + (x.login ? '' : ' class="w"') + '>' + dash(x.login) + '</td>' +
            '<td' + (x.opened ? '' : ' class="w"') + '>' + dash(x.seen) + '</td>' +
            '<td><span class="orp-s ' + st.key + '">' +
              st.mark + ' ' + esc(st.txt) + '</span></td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>' +
        '<p class="orp-cn" style="margin:12px 0 0">' +
          '★「中身を読んだか」は分かりません。画面を開いたかどうかまでです。<br>' +
          'ご家族や税理士先生がご覧になった場合も、見分けられません。' +
        '</p>' +
      '</div>';
  }

  /* ── 一覧 ── */
  function load(){
    var list = $('orp-list');
    if(!list) return;
    list.innerHTML = '<div class="empty">読み込んでいます…</div>';

    call('stList', { area:area, open:only })
      .then(function(r){ ready = true; paint(r); })
      .catch(function(e){
        if(e.code === 'auth'){
          try{ localStorage.removeItem(LS_KEY); }catch(x){}
          list.innerHTML = '<div class="empty">合言葉が違うようです。' +
            '［合言葉を入れ直す］からお願いします。</div>';
          return;
        }
        list.innerHTML = '<div class="empty">' +
          esc(e.message).replace(/\n/g, '<br>') + '</div>';
      });
  }

  var AREAS = ['', '福山', '倉敷', '岡山', '?'];
  var LABEL = { '':'すべて', '福山':'福山', '倉敷':'倉敷・総社', '岡山':'岡山',
                '?':'支社がまだ' };

  function paint(r){
    var n = r.counts || {};
    badge(n[''] || 0);

    $('orp-tabs').innerHTML = AREAS.map(function(a){
      var c = n[a] || 0;
      return '<button type="button" class="orp-a' + (area === a ? ' on' : '') +
             '" data-a="' + esc(a) + '">' + esc(LABEL[a]) +
             (c ? '<span class="n">' + c + '</span>' : '') + '</button>';
    }).join('');
    Array.prototype.forEach.call($('orp-tabs').querySelectorAll('[data-a]'), function(b){
      b.addEventListener('click', function(){
        area = b.getAttribute('data-a'); load();
      });
    });

    var m = r.mails || {};
    $('orp-mails').textContent =
      '届け先： 福山 ' + (m['福山'] || '（未設定→SUPPORT）') +
      '／倉敷 ' + (m['倉敷'] || '（未設定→SUPPORT）') +
      '／岡山 ' + (m['岡山'] || '（未設定→SUPPORT）') +
      '／SUPPORT ' + (m.SUPPORT || '');

    var list = r.list || [];
    if(!list.length){
      $('orp-list').innerHTML = '<div class="empty">' +
        (only ? 'お返事がまだのものはありません。' : 'やりとりはまだありません。') +
        '</div>';
      return;
    }

    $('orp-list').innerHTML = list.map(function(t){
      var talk = (t.msgs || []).map(function(x){
        var us = (String(x.who || '') !== 'オーナー');
        return '<div class="orp-b' + (us ? ' us' : '') + '">' +
               '<span class="orp-bw">' + esc(us ? 'IREライフ' : (t.owner || 'オーナー様')) +
               '　' + esc(x.at) + '</span>' +
               '<span class="orp-bb">' + esc(x.body) + '</span></div>';
      }).join('');

      var sel = ['', '福山', '倉敷', '岡山'].map(function(a){
        return '<option value="' + esc(a) + '"' + (t.area === a ? ' selected' : '') +
               '>' + esc(a ? a : '（未設定）') + '</option>';
      }).join('');

      return '<div class="orp-t' + (t.open ? ' open' : '') + '">' +
        '<div class="orp-h">' +
          '<span class="orp-o">' + esc(t.owner) + '</span>' +
          '<span class="orp-c' + (t.open ? ' open' : ' done') + '">' +
            (t.open ? 'お返事がまだ' : 'お返事済み') + '</span>' +
          '<span class="orp-c">' + esc(t.type) + '</span>' +
          '<span class="orp-c">' + esc(t.area || '支社がまだ') + '</span>' +
        '</div>' +
        '<p class="orp-ti">' + esc(t.title) + '　' + esc(t.id) + '</p>' +
        '<div class="orp-talk">' + talk + '</div>' +
        '<div class="orp-r">' +
          '<textarea data-w="' + esc(t.id) + '" rows="3"' +
            ' placeholder="お返事をお書きください。オーナー様の画面に出ます。"></textarea>' +
          '<button type="button" class="btn btn-acc" data-send="' + esc(t.id) +
            '">お返事を入れる</button>' +
          '<span class="orp-m" data-msg="' + esc(t.id) + '"></span>' +
        '</div>' +
        '<div class="orp-ar"><span>この方の支社</span>' +
          '<select data-area="' + esc(t.mail) + '">' + sel + '</select></div>' +
      '</div>';
    }).join('');

    Array.prototype.forEach.call($('orp-list').querySelectorAll('[data-send]'),
      function(b){ b.addEventListener('click', function(){ reply(b); }); });

    Array.prototype.forEach.call($('orp-list').querySelectorAll('[data-area]'),
      function(sl){
        sl.addEventListener('change', function(){
          call('stArea', { mail: sl.getAttribute('data-area'), area: sl.value })
            .then(load)
            .catch(function(e){ window.alert(e.message); });
        });
      });
  }

  function reply(btn){
    var id  = btn.getAttribute('data-send');
    var ta  = $('orp-list').querySelector('[data-w="' + id + '"]');
    var msg = $('orp-list').querySelector('[data-msg="' + id + '"]');
    var body = ta ? (ta.value || '').trim() : '';
    if(msg) msg.textContent = '';
    if(!body){ if(msg) msg.textContent = '本文をお書きください。'; return; }

    btn.disabled = true;
    var was = btn.textContent;
    btn.textContent = '送信中…';

    /* ★ mail は送りません。マイページ側が番号から宛先を引きます。
     *   画面から宛先を送ると、選び間違いで別のオーナー様に届くためです。 */
    call('stReply', { id:id, body:body })
      .then(function(){ if(ta) ta.value = ''; load(); })
      .catch(function(e){ if(msg) msg.textContent = e.message; })
      .then(function(){ btn.disabled = false; btn.textContent = was; });
  }

  /* ── 起動 ──
   *  ★ #rent-view は最初から DOM にあります（body のクラスで出し入れしています）。
   *    それでも、読み込みの順番で .tabs がまだ無いことがあるため、
   *    少し待って何度か試します。 */
  function boot(){
    if(put()) return;
    var n = 0;
    var t = setInterval(function(){
      if(put() || ++n > 40) clearInterval(t);
    }, 250);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();
