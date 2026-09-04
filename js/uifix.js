/* ============================================================
 *  こまかい直し   uifix 2026-08-31a
 *
 *  ・「ほか ◯件（押すと全部出ます）」を押したら、
 *    切替のお知らせが全部開くようにします。
 *    （今までは、上の見出しを押したときだけ開いていました）
 *
 *  いまある処理には一切さわっていません。
 *  すでにある toggleSwitchNotice() を呼ぶだけです。
 *  元に戻すときは index.html のこの1行を消すだけです。
 * ============================================================ */
(function(){
  'use strict';

  function boot(){
    document.addEventListener('click', function(e){
      var t = e.target;
      var more = null;
      for(var i = 0; t && t.nodeType === 1 && i < 6; i++, t = t.parentNode){
        if(t.classList && t.classList.contains('sw-more')){ more = t; break; }
      }
      if(!more) return;
      e.preventDefault();
      e.stopPropagation();
      if(typeof window.toggleSwitchNotice === 'function') window.toggleSwitchNotice();
    }, true);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ============================================================
 *  ⑤ スマホの物件画面：下を「アイコンの帯」にする
 *
 *  区画バーにある「地図」「編集」を、いちばん下の帯へ移します。
 *  ボタンそのものを動かすだけなので、押したときの動きは今までと同じです。
 *  キャンセルは出しません（右上の × に任せます）。
 *  見た目は css/uifix.css の⑤が受け持ちます。
 * ============================================================ */
(function(){
  'use strict';

  function mobile(){
    try{ return window.matchMedia('(max-width:760px)').matches; }
    catch(e){ return (window.innerWidth||999)<=760; }
  }
  function footer(){
    return document.querySelector('#modal.pv-ms #pv-sheet > .modal-footer');
  }

  function move(){
    if(!mobile()) return;
    var f = footer();
    if(!f) return;
    var save = document.getElementById('save-bld-btn');
    ['pvc-map','pvc-edit'].forEach(function(id){
      var live = document.getElementById(id);   // いま生きているボタン
      if(!live) return;
      // 帯の中に、前に移した古いものが残っていたら片づけます
      var olds = f.querySelectorAll('#'+id);
      for(var i=0;i<olds.length;i++){
        if(olds[i] !== live && olds[i].parentNode) olds[i].parentNode.removeChild(olds[i]);
      }
      if(live.parentNode === f) return;         // すでに帯の中
      if(save && save.parentNode === f) f.insertBefore(live, save);
      else f.appendChild(live);
    });
    // 並び順：地図 → 編集 → 保存
    var m = f.querySelector('#pvc-map'), e = f.querySelector('#pvc-edit');
    if(m && e && m.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING) f.insertBefore(m, e);
  }

  function boot(){
    move();
    window.setInterval(move, 700);
    document.addEventListener('click', function(){ setTimeout(move, 60); }, true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.PVIconBar = { move: move };
})();

/* ============================================================
 *  ⑥⑦⑧ スマホの画面下バー（契約タブ・オーナーメール）
 *
 *  ・契約タブ     … 整列／表示／ランキング／新規 を下に並べます
 *  ・オーナーメール … 開く／閉じる／下書き／一斉送信 を下に並べます
 *  ボタンそのものを動かすだけなので、押したときの動きは今までと同じです。
 *  何かの画面（物件の編集・契約シート）が開いている間は、隠します。
 * ============================================================ */
(function(){
  'use strict';

  function mobile(){
    try{ return window.matchMedia('(max-width:760px)').matches; }
    catch(e){ return (window.innerWidth||999)<=760; }
  }
  function anyOpen(){
    return !!document.querySelector('.modal-overlay.active, #sheet.active, #img-zoom.active');
  }
  function makeBar(id){
    var b = document.getElementById(id);
    if(!b){
      b = document.createElement('div');
      b.id = id; b.className = 'pv-fixbar';
      document.body.appendChild(b);
    }
    return b;
  }
  function put(bar, sel, cls){
    var el = document.querySelector(sel);
    if(!el) return null;
    if(cls && !el.classList.contains(cls)) el.classList.add(cls);
    if(el.parentNode !== bar) bar.appendChild(el);
    return el;
  }

  /* バーの中のボタンを 出す / しまう。
     バーのCSSが display:flex !important なので、
     こちらも !important で打ち消します */
  function showInBar(el, on){
    if(!el) return;
    if(on) el.style.removeProperty('display');
    else   el.style.setProperty('display','none','important');
  }

  function tick(){
    var open = anyOpen();
    document.body.classList.toggle('pv-anyopen', open);

    if(!mobile()){
      ['pvbar-kb','pvbar-rent'].forEach(function(id){
        var b=document.getElementById(id); if(b) b.classList.remove('on');
      });
      document.body.classList.remove('pv-bar-kb','pv-bar-rent');
      return;
    }

    /* --- 契約タブ --- */
    var kb = makeBar('pvbar-kb');
    put(kb, '#btn-sort');
    put(kb, '#btn-view');
    put(kb, '#kb-view .broker-stat-btn, .broker-stat-btn');
    put(kb, '#kb-view .btn-primary[onclick="KB.openSheet()"], .btn-primary[onclick="KB.openSheet()"]');

    /* --- オーナーメール --- */
    var rt = makeBar('pvbar-rent');
    /* いちど下のバーへ移すと #rent-view の中からは消えるので、
       2回目からはバーの中を class で探します */
    var bOpen  = put(rt, '#rent-view button[onclick="RENT.expandAll(true)"]',  'pvb-open')
              || rt.querySelector('.pvb-open');
    var bClose = put(rt, '#rent-view button[onclick="RENT.expandAll(false)"]', 'pvb-close')
              || rt.querySelector('.pvb-close');
    put(rt, '#rent-btn-draft');
    put(rt, '#rent-btn-send');

    /* 「開く」「閉じる」は 送信プレビューの開閉ボタンです。
       「明細取込・送信」タブを開いていて、かつプレビューに中身が
       あるときだけ出します。ほかの画面では押しても何も起きないので、
       出さないほうが迷いません。 */
    var canExpand = !!document.querySelector('#view-send.active')
                 && document.querySelectorAll('.pv-body').length > 0;
    showInBar(bOpen,  canExpand);
    showInBar(bClose, canExpand);

    var body = document.body;
    var onKb   = body.classList.contains('tab-kanban') && !open;
    var onRent = body.classList.contains('tab-rent')   && !open;
    kb.classList.toggle('on', onKb);
    rt.classList.toggle('on', onRent);
    body.classList.toggle('pv-bar-kb', onKb);
    body.classList.toggle('pv-bar-rent', onRent);
  }

  function boot(){
    tick();
    window.setInterval(tick, 600);
    document.addEventListener('click', function(){ setTimeout(tick, 80); }, true);
    window.addEventListener('resize', tick);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.PVBars = { tick: tick };
})();

/* ============================================================
 *  ㉒ 物件一覧に「空車 / 満車」を出します（スマホのときだけ）
 *
 *  ・PC（幅761px以上）… 今までどおりの表示（物件名＋住所＋全N区画）に戻します
 *  ・スマホ（幅760px以下）
 *      満車の物件 … カードの背景を黒、文字を白にして「満車」と出します
 *      空車がある物件 … 区画ナンバーの札（P3 普通 など）を物件名の横に出します
 *
 *  buildings.js の _bldCardHtml() を、この1枚で置き換えています。
 *  元に戻すときは index.html の uifix.js の行を消すだけです。
 * ============================================================ */
(function(){
  'use strict';

  var TYPE_LABEL = { '並':'普通', '縦':'縦列', '軽':'軽', '機':'機械式' };

  /* スマホの判定。他のCSS（mobile-fix.css など）と同じ 760px を境にしています */
  var MOBILE_MAX = 760;
  function isMobile(){ return window.innerWidth <= MOBILE_MAX; }

  /* buildings.js のもとの関数。PCのときはこちらをそのまま使います */
  var ORIG = window._bldCardHtml;

  function esc(v){
    return (typeof escapeHtml === 'function') ? escapeHtml(v) : String(v == null ? '' : v);
  }
  /* 2026-09-15 → 9/15 */
  function mmdd(v){
    var m = String(v == null ? '' : v).match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    return m ? (Number(m[2]) + '/' + Number(m[3])) : '';
  }

  window._bldCardHtml = function(b){
    /* PC は今までどおりの表示に戻します */
    if(!isMobile()){
      if(typeof ORIG === 'function') return ORIG.apply(this, arguments);
      /* 念のための保険（もとの関数が見つからないとき）*/
      var sp = (b && b.spots) || [];
      return '<div class="bld-card" onclick="openModal(\'' + b.id + '\')">' +
          '<div class="bld-card-info">' +
            '<div class="bld-name">' + esc(b.name || '(名称未設定)') + '</div>' +
            '<div class="bld-meta">' + (b.addr ? esc(b.addr) + ' / ' : '') +
              '全' + sp.length + '区画 (使用中 ' +
              sp.filter(function(s){ return s.status === '借'; }).length + ')</div>' +
          '</div>' +
          '<button class="bld-card-del" onclick="event.stopPropagation();deleteBldFromList(\'' +
            b.id + '\')" title="この物件を削除">🗑</button>' +
        '</div>';
    }

    var spots = (b && b.spots) || [];
    var total = spots.length;
    var used  = spots.filter(function(s){ return s.status === '借'; }).length;

    /* 空いている区画を、区画ナンバー順にならべます
       ・状況が「空き」…そのまま
       ・状況が「解約中」…もうすぐ空くので、解約予定日を赤字で添えます */
    var freeList = [];
    spots.forEach(function(s, i){
      if(!s) return;
      if(s.status !== '空' && s.status !== '解') return;
      freeList.push({
        no: Number(s.no) || (i + 1),
        t : TYPE_LABEL[s.type] || '普通',
        kai : (s.status === '解'),                       /* 解約中 */
        soon: (s.status === '解') ? mmdd(s.end_date) : ''  /* 解約日（入っていれば）*/
      });
    });
    freeList.sort(function(a, b){ return a.no - b.no; });
    var free = freeList.length;
    var full = (free === 0);

    /* 満車なら「満車」、空車があれば区画ナンバーの札を物件名の横に出します */
    var right = full
      ? '<span class="pv-full">満車</span>'
      : '<span class="pv-free">' +
          freeList.map(function(f){
            /* 解約中は「P8 解」。解約日が入っていれば「P8 解 9/15」 */
            return '<span class="pv-chip' + (f.kai ? ' pv-chip-soon' : '') + '">' +
                     '<b>P' + f.no + '</b>' +
                     (f.kai ? '<em>解' + (f.soon ? ' ' + f.soon : '') + '</em>' : f.t) +
                   '</span>';
          }).join('') +
        '</span>';

    return '<div class="bld-card ' + (full ? 'pv-card-full' : 'pv-card-vac') +
             '" onclick="openModal(\'' + b.id + '\')">' +
        '<div class="bld-card-info">' +
          '<div class="bld-name pv-name">' +
            '<span class="pv-nm">' + esc(b.name || '(名称未設定)') + '</span>' + right +
          '</div>' +
        '</div>' +
        '<button class="bld-card-del" onclick="event.stopPropagation();deleteBldFromList(\'' + b.id +
          '\')" title="この物件を削除">🗑</button>' +
      '</div>';
  };

  /* 画面幅がスマホ⇔PCをまたいだときだけ、一覧を作りなおします */
  var wasMobile = isMobile();
  window.addEventListener('resize', function(){
    var now = isMobile();
    if(now === wasMobile) return;
    wasMobile = now;
    if(typeof renderList === 'function') renderList();
  });
})();

/* ============================================================
 *  ㉔ 「復元」でうっかり古いデータに戻してしまわないための安全装置
 *
 *  これまでの復元は「物件◯件を復元します」としか出なかったので、
 *  古いバックアップを選んでも気づけませんでした。ここでは
 *    ・そのバックアップが「いつのものか」を必ず出します
 *    ・いまのデータと比べて、減るもの（物件・区画・配置図・契約）を出します
 *    ・減るとき／古いときは、もう一度たしかめます
 *    ・復元する直前に、いまのデータを別枠へ退避します
 *  あわせて、設定メニューに「復元前に戻す」を足しています。
 * ============================================================ */
(function(){
  'use strict';

  function pfx(){ return (typeof insPrefix === 'function') ? insPrefix() : 'pivot_'; }
  function bKey(){ return (typeof pbKey === 'function') ? pbKey() : pfx() + 'blds'; }
  function cKey(){ return (typeof ctKey === 'function') ? ctKey() : pfx() + 'contract_kanban_v2'; }
  function oKey(){ return pfx() + 'rent_owner_send_owners_v1'; }
  function preKey(){ return pfx() + 'prerestore_backup'; }

  function pj(s){ try{ return JSON.parse(s || '{}'); }catch(e){ return {}; } }
  function cnt(o){ return Object.keys(o || {}).length; }

  /* 物件のかたまりを数えます（物件／区画／配置図） */
  function tally(blds){
    var t = { bld:0, spot:0, layout:0 };
    Object.keys(blds || {}).forEach(function(id){
      var b = blds[id]; if(!b) return;
      t.bld++;
      t.spot += (b.spots || []).length;
      if(b.layout_id || b.layout2_id) t.layout++;
    });
    return t;
  }

  function ymd(s){
    var d = new Date(s);
    return isNaN(d.getTime()) ? '不明' : d.toLocaleString('ja-JP');
  }
  function daysAgo(s){
    var d = new Date(s);
    if(isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }
  function row(label, now, bak){
    var d = bak - now;
    return '　' + label + '： ' + now + ' → ' + bak +
           (d < 0 ? '　← ' + (-d) + ' 減ります' : (d > 0 ? '　（+' + d + '）' : '')) + '\n';
  }

  /* 復元の直前に、いまのデータを退避します */
  function keepBeforeRestore(){
    try{
      localStorage.setItem(preKey(), JSON.stringify({
        at: new Date().toISOString(),
        buildings: localStorage.getItem(bKey()) || '{}',
        contracts: localStorage.getItem(cKey()) || '{}',
        owners: localStorage.getItem(oKey()) || '[]'
      }));
      return true;
    }catch(e){ return false; }
  }

  /* 設定メニューの「復元前に戻す」 */
  window.undoRestore = function(){
    var s = null;
    try{ s = JSON.parse(localStorage.getItem(preKey()) || 'null'); }catch(e){ s = null; }
    if(!s){
      alert('復元前のデータが見つかりませんでした。\n（「復元」をまだ一度も使っていない場合は残っていません）');
      return;
    }
    var t = tally(pj(s.buildings));
    if(!confirm('「復元」を実行する直前の状態に戻します。\n\n' +
                '退避した時刻： ' + ymd(s.at) + '\n' +
                '物件 ' + t.bld + '件 ／ 区画 ' + t.spot + '件 ／ 配置図 ' + t.layout + '件\n\n' +
                'いまのデータは、この内容で上書きされます。よろしいですか？')) return;
    try{
      localStorage.setItem(bKey(), s.buildings);
      localStorage.setItem(cKey(), s.contracts);
      if(s.owners) localStorage.setItem(oKey(), s.owners);
      alert('復元前の状態に戻しました。ページを読み込み直します。');
      location.reload();
    }catch(e){ alert('戻せませんでした: ' + e); }
  };

  /* 復元そのものを、確認つきに置き換えます */
  window.restoreBackup = function(event){
    var inputEl = event && event.target;
    var file = inputEl && inputEl.files && inputEl.files[0];
    if(!file) return;

    var reader = new FileReader();
    reader.onload = function(e){
      var data;
      try{ data = JSON.parse(e.target.result); }
      catch(err){ alert('ファイル読み込みエラー: ' + err.message); inputEl.value = ''; return; }

      if(!data || !data.buildings){
        alert('このファイルは PIVOT のバックアップではないようです');
        inputEl.value = ''; return;
      }

      var nowT = tally(pj(localStorage.getItem(bKey())));
      var bakT = tally(data.buildings);
      var nowC = cnt(pj(localStorage.getItem(cKey())));
      var bakC = cnt(data.contracts);
      var ago  = daysAgo(data.exportedAt);

      var msg = '【いま選んだバックアップ】\n' +
                '　作成日時： ' + ymd(data.exportedAt) +
                (ago === null ? '' : '（' + (ago <= 0 ? '本日' : ago + '日前') + '）') + '\n' +
                '　ファイル： ' + file.name + '\n\n' +
                '【いまのデータ → 復元したあと】\n' +
                row('物件　', nowT.bld,    bakT.bld) +
                row('区画　', nowT.spot,   bakT.spot) +
                row('配置図', nowT.layout, bakT.layout) +
                row('契約　', nowC,        bakC);

      var lost = [];
      if(bakT.bld    < nowT.bld)    lost.push('物件');
      if(bakT.spot   < nowT.spot)   lost.push('区画');
      if(bakT.layout < nowT.layout) lost.push('配置図');
      if(bakC        < nowC)        lost.push('契約');

      if(lost.length){
        msg += '\n⚠ このバックアップは、いまより中身が少ないです。\n' +
               '　　古いファイルを選んでいないか、作成日時をもう一度たしかめてください。\n';
      }
      msg += '\n※ 復元する直前のデータは退避します（設定 →「復元前に戻す」で戻せます）\n\n復元しますか？';

      if(!confirm(msg)){ inputEl.value = ''; return; }

      /* 減るとき、または当日以外のバックアップのときは、もう一度たしかめます */
      if(lost.length || (ago !== null && ago >= 1)){
        if(!confirm('もう一度だけ確認します。\n\n' +
                    ymd(data.exportedAt) + ' 時点のデータで上書きします。\n' +
                    (lost.length ? '減るもの： ' + lost.join('・') + '\n' : '') +
                    '\n本当に進めますか？')){ inputEl.value = ''; return; }
      }

      keepBeforeRestore();

      try{
        if(typeof saveAll === 'function'){
          if(!saveAll(data.buildings)){ inputEl.value = ''; return; }
        }else{
          localStorage.setItem(bKey(), JSON.stringify(data.buildings));
        }
        if(data.contracts && typeof data.contracts === 'object'){
          try{ localStorage.setItem(cKey(), JSON.stringify(data.contracts)); }catch(e2){}
          try{ if(window.KB && window.KB.renderAll) window.KB.renderAll(); }catch(e2){}
        }
        if(data.owners && typeof window.applyCloudOwners === 'function'){
          try{ window.applyCloudOwners(data.owners); }catch(e2){}
        }
        if(typeof showToast === 'function'){
          showToast('✅ 物件' + bakT.bld + '件' + (bakC ? '・契約' + bakC + '件' : '') + 'を復元しました');
        }
        if(typeof renderAll === 'function') renderAll();
      }catch(err){
        alert('復元中にエラーが発生しました: ' + err);
      }
      inputEl.value = '';
    };
    reader.readAsText(file);
  };

  /* 設定メニューに「復元前に戻す」を足します（index.html はさわりません） */
  function addUndoButton(){
    var menu = document.getElementById('settings-menu');
    if(!menu || document.getElementById('btn-undo-restore')) return;
    var ref = null;
    Array.prototype.forEach.call(menu.querySelectorAll('button'), function(b){
      if((b.textContent || '').indexOf('緊急復元') >= 0) ref = b;
    });
    var btn = document.createElement('button');
    btn.id = 'btn-undo-restore';
    btn.textContent = '復元前に戻す';
    btn.style.color = '#c0392b';
    btn.onclick = function(){
      if(typeof closeSettingsMenu === 'function') closeSettingsMenu();
      window.undoRestore();
    };
    if(ref && ref.nextSibling) menu.insertBefore(btn, ref.nextSibling);
    else menu.appendChild(btn);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addUndoButton);
  else addUndoButton();
})();

/* ============================================================
 *  ㉚ 送るときも、受けるときも、データが減らないようにします（合体方式）
 *
 *  これまでの安全装置は「止めるだけ」でした。
 *  止めたあと何をすればよいのか分からない、という問題があったので、
 *  ここでは【OK】を押すだけで直るようにしています。
 *
 *  考え方はひとつだけです。
 *    「片方にしか無いものは、消さずに足す」
 *
 *  ・受けるとき（クラウド → この端末）
 *      届いた内容に、この端末にしか無い分を足してから取り込みます。
 *      そのあと自動でクラウドへ送り直すので、ほかの端末もそろいます。
 *  ・送るとき（この端末 → クラウド）
 *      この端末の内容に、クラウドにしか無い分を足してから送ります。
 *
 *  どちらも、物件・区画・配置図・契約・オーナーを見ています。
 *  もとの安全装置（js/core.js）は物件の「件数」しか見ていないため、
 *  物件67件のまま区画や配置図だけ古い、というデータは素通りしていました。
 *
 *  ※ わざと消した物件が、ほかの端末から戻ってくることがあります。
 *     そのときはもう一度消してください（そのほうが、消える事故より安全です）。
 *     ただし「この端末で消したと記録が残っている物件」は戻しません。
 * ============================================================ */
(function(){
  'use strict';

  function pfx(){ return (typeof insPrefix === 'function') ? insPrefix() : 'pivot_'; }
  function bKey(){ return (typeof pbKey === 'function') ? pbKey() : pfx() + 'blds'; }
  function cKey(){ return (typeof ctKey === 'function') ? ctKey() : pfx() + 'contract_kanban_v2'; }
  function oKey(){ return pfx() + 'rent_owner_send_owners_v1'; }
  function preKey(){ return pfx() + 'prerestore_backup'; }

  function pj(s, d){ try{ return JSON.parse(s || d); }catch(e){ return JSON.parse(d); } }
  function obj(s){ return pj(s, '{}'); }
  function arr(s){ var v = pj(s, '[]'); return Array.isArray(v) ? v : []; }

  /* -------- 数えかた（物件／区画／配置図） -------- */
  function tally(blds){
    var t = { bld:0, spot:0, layout:0 };
    Object.keys(blds || {}).forEach(function(id){
      var b = blds[id]; if(!b) return;
      t.bld++;
      t.spot += (b.spots || []).length;
      if(b.layout_id) t.layout++;
      if(b.layout2_id) t.layout++;
    });
    return t;
  }

  /* 区画の見分け方: 棟 + 区画番号 */
  function spotKey(s){
    if(!s) return '';
    return String(s.tou || '') + '|' + String(s.no != null ? s.no : '');
  }

  /* この端末で「わざと消した」と分かる物件IDの一覧 */
  function knownIds(){
    try{
      if(typeof window.loadSyncIds === 'function'){
        var v = window.loadSyncIds();
        return Array.isArray(v) ? v : [];
      }
    }catch(e){}
    return [];
  }

  /* -------------------------------------------------------
   *  base を土台に、other にしか無いものを足して返します。
   *  base の中身は書き換えません（消えるものを補うだけ）。
   *  戻り値: { blds, add:{bld,spot,layout}, names:[物件名…] }
   * ------------------------------------------------------- */
  function mergeBlds(base, other, respectDeleted){
    var out = {}, add = { bld:0, spot:0, layout:0 }, names = [];
    var known = respectDeleted ? knownIds() : [];
    base  = base  || {};
    other = other || {};

    Object.keys(base).forEach(function(id){ out[id] = base[id]; });

    Object.keys(other).forEach(function(id){
      var o = other[id]; if(!o) return;

      /* 土台に無い物件 */
      if(!Object.prototype.hasOwnProperty.call(out, id)){
        if(respectDeleted && known.indexOf(id) >= 0) return;   // ここで消したもの → 戻さない
        out[id] = o;
        add.bld++;
        add.spot += (o.spots || []).length;
        if(o.layout_id)  add.layout++;
        if(o.layout2_id) add.layout++;
        names.push(String(o.name || id));
        return;
      }

      /* 両方にある物件 → 足りない区画と配置図だけ補う */
      var b = out[id];
      var bs = (b && b.spots) ? b.spots : [];
      var os = (o && o.spots) ? o.spots : [];
      var have = {}, miss = [];
      bs.forEach(function(s){ have[spotKey(s)] = 1; });
      os.forEach(function(s){ if(!have[spotKey(s)]){ miss.push(s); have[spotKey(s)] = 1; } });

      var needLayout  = (!b.layout_id  && o.layout_id);
      var needLayout2 = (!b.layout2_id && o.layout2_id);
      if(!miss.length && !needLayout && !needLayout2) return;

      var nb = {};
      Object.keys(b).forEach(function(k){ nb[k] = b[k]; });
      if(miss.length){ nb.spots = bs.concat(miss); add.spot += miss.length; }
      if(needLayout){  nb.layout_id  = o.layout_id;  add.layout++; }
      if(needLayout2){ nb.layout2_id = o.layout2_id; add.layout++; }
      /* 画像の種類（mime）も、足した分だけ引き継ぎます */
      if((needLayout || needLayout2) && o.mime){
        var m = {};
        Object.keys(nb.mime || {}).forEach(function(k){ m[k] = nb.mime[k]; });
        Object.keys(o.mime).forEach(function(k){ if(m[k] == null) m[k] = o.mime[k]; });
        nb.mime = m;
      }
      out[id] = nb;
      if(names.indexOf(String(b.name || id)) < 0) names.push(String(b.name || id));
    });

    return { blds: out, add: add, names: names };
  }

  /* 契約（IDのかたまり）: 土台に無いものだけ足します */
  function mergeMap(base, other){
    var out = {}, n = 0;
    Object.keys(base || {}).forEach(function(k){ out[k] = base[k]; });
    Object.keys(other || {}).forEach(function(k){
      if(!Object.prototype.hasOwnProperty.call(out, k)){ out[k] = other[k]; n++; }
    });
    return { map: out, add: n };
  }

  /* オーナー（並び）: 名前で見て、土台に無いものだけ足します */
  function mergeOwners(base, other){
    var out = (base || []).slice(), n = 0, seen = {};
    out.forEach(function(o){ seen[String((o && (o.id || o.name)) || '')] = 1; });
    (other || []).forEach(function(o){
      var k = String((o && (o.id || o.name)) || '');
      if(!k || seen[k]) return;
      out.push(o); seen[k] = 1; n++;
    });
    return { list: out, add: n };
  }

  function nameList(names){
    if(!names.length) return '';
    return '　　' + names.slice(0, 8).join('、') + (names.length > 8 ? ('　ほか' + (names.length - 8) + '件') : '') + '\n';
  }
  function addLines(add){
    var s = '';
    if(add.bld)    s += '　物件　： ' + add.bld + '件\n';
    if(add.spot)   s += '　区画　： ' + add.spot + '\n';
    if(add.layout) s += '　配置図： ' + add.layout + '\n';
    return s;
  }

  /* 上書きされる前の状態を退避します（設定 →「復元前に戻す」で戻せます）*/
  function keepBefore(){
    try{
      localStorage.setItem(preKey(), JSON.stringify({
        at: new Date().toISOString(),
        buildings: localStorage.getItem(bKey()) || '{}',
        contracts: localStorage.getItem(cKey()) || '{}',
        owners: localStorage.getItem(oKey()) || '[]'
      }));
    }catch(e){}
  }

  /* ==========================================================
   *  受けるとき: クラウド → この端末
   * ========================================================== */
  var ORIG_SAVE = window.pbSaveRaw;
  function writeThrough(o){
    if(typeof ORIG_SAVE === 'function') return ORIG_SAVE(o);
    try{ localStorage.setItem(bKey(), JSON.stringify(o || {})); }catch(e){}
  }

  /* クラウドから読んだ中身の控え。
     この控えと同じものが書き込まれるときだけ「取り込み」と判断します。
     （エリア一括削除など、この端末の操作は止めません） */
  var _cloudSig = null;
  var _hookedPost = false;

  /* ㉞ 同じ内容を何度も聞かないようにします。
     いちど「どちらも残す」と答えた差分と同じものが、また届いたとき、
     黙って合体だけして、確認は出しません。
     （クラウド側が保存できていないと、5分ごとに同じ確認が出てしまうため） */
  function ackKey(){ return pfx() + 'merge_ack'; }
  function sigOf(m){
    return [m.add.bld, m.add.spot, m.add.layout, m.names.slice(0, 8).join('|')].join('/');
  }
  function readAck(){
    try{ return JSON.parse(localStorage.getItem(ackKey()) || 'null'); }catch(e){ return null; }
  }
  function writeAck(o){
    try{ localStorage.setItem(ackKey(), JSON.stringify(o)); }catch(e){}
  }

  window.pbSaveRaw = function(incoming){
    var mine, m;
    /* 取り込みでなければ、そのまま保存します */
    if(_hookedPost){
      var sig0 = null;
      try{ sig0 = JSON.stringify(incoming || {}); }catch(e){ sig0 = null; }
      if(sig0 === null || sig0 !== _cloudSig) return writeThrough(incoming);
    }
    try{
      mine = obj(localStorage.getItem(bKey()));
      /* 届いた内容を土台に、この端末にしか無い分を足します */
      m = mergeBlds(incoming || {}, mine, true);
    }catch(e){ return writeThrough(incoming); }

    /* 手元が空（初回）／減るものが無い → そのまま取り込みます */
    if(!Object.keys(mine).length || (!m.add.bld && !m.add.spot && !m.add.layout)){
      try{ if(readAck()) localStorage.removeItem(ackKey()); }catch(e){}   /* 直った */
      return writeThrough(incoming);
    }

    /* ㉞ 一度答えた差分と同じなら、聞かずに合体します */
    var sig = sigOf(m);
    var ack = readAck();
    if(ack && ack.sig === sig && (Date.now() - (ack.at || 0)) < 86400000){
      keepBefore();
      writeThrough(m.blds);
      var n = (ack.n || 1) + 1;
      writeAck({ sig: sig, at: ack.at, n: n });
      try{
        if(typeof setSyncStatus === 'function'){
          setSyncStatus('error', '⚠️ クラウドに保存できていない項目があります（' + m.names.slice(0,2).join('・') + '）');
        }
      }catch(e){}
      /* 送り直しても直らないときは、通信を増やさないよう2回でやめます */
      if(n <= 2){
        try{ if(typeof window.__scheduleAutoPush === 'function') window.__scheduleAutoPush(); }catch(e){}
      }
      return;
    }

    var now = tally(mine), inc = tally(incoming || {});
    var msg = '⚠️ クラウドから届いたデータのほうが少ないです。\n\n' +
              '【この端末にあって、クラウドに無いもの】\n' +
              addLines(m.add) + nameList(m.names) +
              '\n（いまの端末： 物件' + now.bld + '／区画' + now.spot + '／配置図' + now.layout + '）\n' +
              '（届いた内容： 物件' + inc.bld + '／区画' + inc.spot + '／配置図' + inc.layout + '）\n\n' +
              '【OK】どちらも残して取り込みます（おすすめ）\n' +
              '　　　届いた内容に、上の分を足します。何も消えません。\n' +
              '　　　そのあとクラウドへ送り直し、ほかの端末もそろえます。\n\n' +
              '【キャンセル】取り込みません（この端末のまま）';

    var doMerge = true;
    try{ doMerge = window.confirm(msg); }catch(e){ doMerge = true; }

    if(!doMerge){
      try{ if(typeof setSyncStatus === 'function') setSyncStatus('error', '⚠️ 取り込みを止めました（この端末のまま）'); }catch(e){}
      return;
    }

    keepBefore();
    writeThrough(m.blds);
    writeAck({ sig: sig, at: Date.now(), n: 1 });   /* ㉞ 同じ内容は次から聞きません */
    try{ if(typeof setSyncStatus === 'function') setSyncStatus('saved', '✅ 両方を残して取り込みました'); }catch(e){}
    /* クラウドにも足した内容を送り直して、全部の端末をそろえます */
    try{ if(typeof window.__scheduleAutoPush === 'function') window.__scheduleAutoPush(); }catch(e){}
  };

  /* ==========================================================
   *  送るとき: この端末 → クラウド
   *  postToGas の action:'save' を横取りして、
   *  送る中身にクラウドの分を足してから送ります。
   * ========================================================== */
  var ORIG_POST = window.postToGas;
  if(typeof ORIG_POST === 'function'){
    var _cloud = null, _cloudAt = 0;
    _hookedPost = true;

    /* もとの安全装置（js/core.js の pvMissingFromLocal）は
       「消える物件があります」と出して送信を止めるだけでした。
       ここでは足してから送るので、止める必要がありません。
       止められると直せなくなるので、こちらに任せてもらいます。 */
    try{ window.pvMissingFromLocal = function(){ return []; }; }catch(e){}

    window.postToGas = function(url, body, timeoutMs){
      /* 送信でなければ素通り。ただし読み込みの結果は覚えておきます */
      if(!body || body.action !== 'save'){
        var p = ORIG_POST(url, body, timeoutMs);
        try{
          return Promise.resolve(p).then(function(r){
            if(body && body.action === 'load' && r && r.ok && r.payload){
              _cloud = r.payload; _cloudAt = Date.now();
              try{ _cloudSig = JSON.stringify(r.payload.buildings || {}); }catch(e){ _cloudSig = null; }
            }
            return r;
          });
        }catch(e){ return p; }
      }

      /* ここから送信 */
      return (function(){
        var fresh = (_cloud && (Date.now() - _cloudAt) < 20000)
          ? Promise.resolve({ ok:true, payload:_cloud })
          : Promise.resolve(ORIG_POST(url, { action:'load' }, timeoutMs)).catch(function(){ return null; });

        return fresh.then(function(r){
          if(!r || !r.ok || !r.payload) return ORIG_POST(url, body, timeoutMs);   /* 確認できなければ通常どおり */
          var cloud = r.payload;
          _cloud = cloud; _cloudAt = Date.now();
          try{ _cloudSig = JSON.stringify(cloud.buildings || {}); }catch(e){ _cloudSig = null; }

          var pay = body.payload || {};
          var mB, mC, mO;
          try{
            mB = mergeBlds(pay.buildings || {}, cloud.buildings || {}, true);
            mC = mergeMap(pay.contracts || {}, cloud.contracts || {});
            mO = mergeOwners(pay.owners || [], cloud.owners || []);
          }catch(e){ return ORIG_POST(url, body, timeoutMs); }

          var n = mB.add.bld + mB.add.spot + mB.add.layout + mC.add + mO.add;
          if(!n) return ORIG_POST(url, body, timeoutMs);   /* 消えるものが無い → そのまま送る */

          var msg = '⚠️ このまま送ると、クラウドにあるデータが消えます。\n\n' +
                    '【クラウドにあって、この端末に無いもの】\n' +
                    addLines(mB.add) +
                    (mC.add ? ('　契約　： ' + mC.add + '件\n') : '') +
                    (mO.add ? ('　オーナー： ' + mO.add + '件\n') : '') +
                    nameList(mB.names) +
                    '\n【OK】どちらも残して送ります（おすすめ）\n' +
                    '　　　この端末の内容に、上の分を足してから送ります。何も消えません。\n\n' +
                    '【キャンセル】送りません（クラウドはそのままです）';

          var doMerge = true;
          try{ doMerge = window.confirm(msg); }catch(e){ doMerge = true; }

          if(!doMerge){
            /* もとの処理が「同期失敗」に書き換えるので、少し後で出し直します */
            try{
              window.setTimeout(function(){
                try{ if(typeof setSyncStatus === 'function') setSyncStatus('error', '⚠️ 送信を止めました（クラウドはそのまま）'); }catch(e){}
              }, 50);
            }catch(e){}
            return { ok:false, error:'送信を中止しました（この端末の操作で止めました）' };
          }

          /* 足した内容を、この端末にも反映しておきます */
          try{
            keepBefore();
            writeThrough(mB.blds);
            localStorage.setItem(cKey(), JSON.stringify(mC.map));
            localStorage.setItem(oKey(), JSON.stringify(mO.list));
            if(typeof requestRender === 'function') requestRender();
          }catch(e){}

          var nb = {};
          Object.keys(body).forEach(function(k){ nb[k] = body[k]; });
          nb.payload = {};
          Object.keys(pay).forEach(function(k){ nb.payload[k] = pay[k]; });
          nb.payload.buildings = mB.blds;
          nb.payload.contracts = mC.map;
          nb.payload.owners    = mO.list;

          return Promise.resolve(ORIG_POST(url, nb, timeoutMs)).then(function(res){
            try{ if(res && res.ok && typeof setSyncStatus === 'function') setSyncStatus('saved', '✅ 両方を残して送りました'); }catch(e){}
            return res;
          });
        });
      })();
    };
  }
})();

/* ============================================================
 *  ㉛ どの端末でも、いつも最新が見えるようにします
 *
 *  ご希望は「最新状態をどのPCでもいつも見れるようにしたい」でした。
 *  これまでは、開いたときに一度だけ確認するだけだったので、
 *  ・開きっぱなしにしていると、他の端末の変更に気づかない
 *  ・この端末のほうが時刻が新しいと、そもそも確認しない
 *  という状態でした。
 *
 *  ここでは次の3つをします。
 *   1. タブに戻ったとき（別の画面から切り替えたとき）に、最新を確認する
 *   2. 開いている間は 5分ごとに、静かに最新を確認する
 *   3. 画面に「最終更新 ○/○ ○:○○」を出して、いつの内容かが分かるようにする
 *
 *  取り込みは ㉚ の合体ガードを通るので、確認しても中身は減りません。
 *  編集中（未保存）のときは、もとの仕組みが取り込みを見送ります。
 * ============================================================ */
(function(){
  'use strict';

  var EVERY   = 5 * 60 * 1000;   /* 開いている間の自動確認：5分ごと */
  var MIN_GAP = 20 * 1000;       /* 立て続けの確認を避ける間隔：20秒 */

  var _last = 0;      /* 最後に確認した時刻 */
  var _busy = false;
  var _mtime = 0;     /* クラウド側の最終更新時刻 */
  var _device = '';   /* 最後に更新した端末の名前 */

  /* クラウドの最終更新時刻を、通信のついでに受け取ります */
  (function(){
    var P = window.postToGas;
    if(typeof P !== 'function') return;
    window.postToGas = function(url, body, timeoutMs){
      var r = P(url, body, timeoutMs);
      try{
        return Promise.resolve(r).then(function(res){
          try{
            if(res && res.ok && res.payload && res.payload.mtime){
              var v = parseInt(res.payload.mtime, 10);
              if(v && v >= _mtime){
                _mtime = v;
                _device = String(res.payload.device || '');
                showStamp();
              }
            }
          }catch(e){}
          return res;
        });
      }catch(e){ return r; }
    };
  })();

  function two(n){ return (n < 10 ? '0' : '') + n; }
  function stampText(){
    if(!_mtime) return '';
    var d = new Date(_mtime), n = new Date();
    var day = (d.getMonth()+1) + '/' + d.getDate();
    var hm  = two(d.getHours()) + ':' + two(d.getMinutes());
    var same = (d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate());
    var who = '';
    try{
      var me = localStorage.getItem((typeof insPrefix==='function'?insPrefix():'pivot_') + 'device_name') || '';
      if(_device) who = '（' + _device + (me && me === _device ? '＝この端末' : '') + '）';
    }catch(e){}
    return '最終更新 ' + (same ? '' : day + ' ') + hm + who;
  }

  /* 同期の表示のとなりに、小さく出します */
  function showStamp(){
    try{
      var host = document.getElementById('sync-status');
      if(!host || !host.parentNode) return;
      var el = document.getElementById('pv-stamp');
      if(!el){
        el = document.createElement('span');
        el.id = 'pv-stamp';
        el.style.cssText = 'margin-left:10px;font-size:12px;color:#6b7280;white-space:nowrap;';
        host.parentNode.insertBefore(el, host.nextSibling);
      }
      el.textContent = stampText();
    }catch(e){}
  }

  /* 最新を確認します（取り込みは ㉚ のガードを通ります） */
  function check(force){
    try{
      if(_busy) return;
      if(document.hidden) return;
      if(!force && (Date.now() - _last) < MIN_GAP) return;
      if(typeof getCloudUrl !== 'function' || !getCloudUrl()) return;
      if(typeof backgroundPull !== 'function') return;
      /* ログイン前（画面がまだ出ていない）は動かしません */
      var app = document.getElementById('app') || document.querySelector('.app');
      if(app && app.style && app.style.display === 'none') return;

      _busy = true; _last = Date.now();
      Promise.resolve(backgroundPull())
        .catch(function(){})
        .then(function(){ _busy = false; showStamp(); });
    }catch(e){ _busy = false; }
  }
  try{ window.__pvCheckLatest = function(){ check(true); }; }catch(e){}

  /* 1. タブに戻ったとき／ウィンドウに焦点が戻ったとき */
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) check(false); });
  window.addEventListener('focus', function(){ check(false); });
  window.addEventListener('online', function(){ check(true); });

  /* 2. 開いている間は5分ごと */
  setInterval(function(){ check(false); }, EVERY);

  /* 3. 起動してひと呼吸おいてから、表示を出します */
  function boot(){ setTimeout(showStamp, 1500); setTimeout(function(){ check(true); }, 4000); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ============================================================
 *  ㉜ 新しい端末を「リンク1回」で使えるようにします
 *
 *  いまは端末ごとに GAS の URL を手で入力しています。
 *  打ち間違いのもとですし、台数が増えるほど手間です。
 *
 *  ★ index.html に URL を書き込む案は、やめました。
 *    irelife/pivot2 と pivot3 は「公開」リポジトリなので、
 *    書き込むと URL が誰でも読める状態になります。
 *    URL を知られると、ログイン画面を通らずに
 *    入居者名や連絡先まで取り出せてしまいます。
 *
 *  かわりに「引き継ぎリンク」にしました。
 *   ・すでに使えている端末で、設定 →「引き継ぎリンクを作る」
 *   ・出てきたリンクを LINE などで新しい端末へ送る
 *   ・新しい端末でそれを1回開くと、設定が入ります
 *   ・あとはログインするだけです
 *
 *  リンクの「#」より後ろはインターネットに送信されません。
 *  開いたあとはアドレス欄からも消すので、履歴にも残りません。
 *  （ただしリンク自体は URL を含みます。社内にだけ送ってください）
 * ============================================================ */
(function(){
  'use strict';

  function pfx(){ return (typeof insPrefix === 'function') ? insPrefix() : 'pivot_'; }
  function urlKey(){ return pfx() + 'cloud_url'; }

  function getUrl(){
    try{
      if(typeof getCloudUrl === 'function') return getCloudUrl();
      return (localStorage.getItem(urlKey()) || '').trim();
    }catch(e){ return ''; }
  }
  function putUrl(v){
    try{
      if(typeof setCloudUrl === 'function') setCloudUrl(v);
      else localStorage.setItem(urlKey(), v);
    }catch(e){}
  }

  /* ---- 受け取る側：リンクで開かれたとき ---- */
  (function takeFromLink(){
    var h = '';
    try{ h = location.hash || ''; }catch(e){ return; }
    var m = /[#&]gas=([^&]+)/.exec(h);
    if(!m) return;

    var v = '';
    try{ v = decodeURIComponent(m[1]); }catch(e){ v = m[1]; }
    v = (v || '').trim();

    /* 中身の確認。GAS 以外のあて先は受け付けません */
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[^\/]+\/exec/.test(v)){
      try{ alert('引き継ぎリンクの中身が正しくありません。\n作り直して送ってもらってください。'); }catch(e){}
      return;
    }

    var before = getUrl();
    if(before && before === v){
      /* すでに同じ設定。何もしません */
    } else if(before && before !== v){
      var ok = false;
      try{
        ok = confirm('この端末には、別のクラウド設定がすでに入っています。\n\n' +
                     'リンクの設定に入れ替えますか？\n\n' +
                     '【OK】入れ替える\n【キャンセル】いまのままにする');
      }catch(e){ ok = false; }
      if(!ok){ clearHash(); return; }
      putUrl(v);
      try{ alert('クラウドの設定を入れ替えました。'); }catch(e){}
    } else {
      putUrl(v);
      try{ alert('この端末にクラウドの設定が入りました。\n\nこのあとログインすると、そのまま使えます。'); }catch(e){}
    }
    clearHash();
  })();

  /* リンクの中身をアドレス欄から消します（履歴に残さないため） */
  function clearHash(){
    try{ history.replaceState(null, '', location.pathname + location.search); }
    catch(e){ try{ location.hash = ''; }catch(e2){} }
  }

  /* ---- 渡す側：引き継ぎリンクを作る ---- */
  window.pvShareSetup = function(){
    var u = getUrl();
    if(!u){
      try{ alert('この端末には、まだクラウドの設定が入っていません。\n先に 設定 →「クラウド連携」で URL を入れてください。'); }catch(e){}
      return;
    }
    var link = location.origin + location.pathname + '#gas=' + encodeURIComponent(u);
    var msg  = '新しい端末で、このリンクを1回開いてください。\n' +
               'そのあとログインすれば、そのまま使えます。\n\n' +
               '※ 社内の人にだけ送ってください。';

    function fallback(){
      try{ window.prompt(msg + '\n\n（下の文字をコピーしてください）', link); }catch(e){}
    }
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(link).then(function(){
          try{ alert('引き継ぎリンクをコピーしました。\n\n' + msg); }catch(e){}
        }, fallback);
        return;
      }
    }catch(e){}
    fallback();
  };

  /* 設定メニューにボタンを足します（index.html はさわりません） */
  function addShareButton(){
    var menu = document.getElementById('settings-menu');
    if(!menu || document.getElementById('btn-share-setup')) return;
    var btn = document.createElement('button');
    btn.id = 'btn-share-setup';
    btn.textContent = '引き継ぎリンクを作る';
    btn.onclick = function(){
      if(typeof closeSettingsMenu === 'function') closeSettingsMenu();
      window.pvShareSetup();
    };
    menu.appendChild(btn);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addShareButton);
  else addShareButton();
})();

/* ============================================================
 *  ㉝ 「日付を選んで戻す」— 何日ぶんかの控えを自動で残します
 *
 *  いちばん困るのは「登録したものが無くなること」です。
 *  これまでの自動退避は 1世代だけで、次に上書きされていました。
 *  ここでは 1日1回、その日の最初に開いたときに控えを取り、
 *  直近5日ぶんを端末の中に残します。
 *
 *  設定 →「日付を選んで戻す」で、日付を選んで戻せます。
 *  戻したあとは、㉚ の合体ガードを通してクラウドへ送るので、
 *  戻した内容がほかの端末にも伝わり、しかも何も消えません。
 *
 *  ※ これは「端末の中」の控えです。端末が壊れたら一緒に消えます。
 *    クラウド側の日次バックアップ（コード.gs への追記）は別に用意します。
 * ============================================================ */
(function(){
  'use strict';

  var KEEP = 5;   /* 残す日数 */

  function pfx(){ return (typeof insPrefix === 'function') ? insPrefix() : 'pivot_'; }
  function bKey(){ return (typeof pbKey === 'function') ? pbKey() : pfx() + 'blds'; }
  function cKey(){ return (typeof ctKey === 'function') ? ctKey() : pfx() + 'contract_kanban_v2'; }
  function oKey(){ return pfx() + 'rent_owner_send_owners_v1'; }
  function preKey(){ return pfx() + 'prerestore_backup'; }
  function head(){ return pfx() + 'snap_'; }

  function pj(s, d){ try{ return JSON.parse(s || d); }catch(e){ return JSON.parse(d); } }
  function two(n){ return (n < 10 ? '0' : '') + n; }
  function stamp(d){ return '' + d.getFullYear() + two(d.getMonth()+1) + two(d.getDate()); }
  function ymd(s){ return s.slice(0,4) + '/' + s.slice(4,6) + '/' + s.slice(6,8); }

  function tally(blds){
    var t = { bld:0, spot:0, layout:0 };
    Object.keys(blds || {}).forEach(function(id){
      var b = blds[id]; if(!b) return;
      t.bld++; t.spot += (b.spots || []).length;
      if(b.layout_id) t.layout++;
      if(b.layout2_id) t.layout++;
    });
    return t;
  }
  function cnt(o){ return Object.keys(o || {}).length; }

  /* 残っている控えの日付を、新しい順で返します */
  function days(){
    var out = [], h = head();
    try{
      for(var i = 0; i < localStorage.length; i++){
        var k = localStorage.key(i);
        if(k && k.indexOf(h) === 0) out.push(k.slice(h.length));
      }
    }catch(e){}
    out.sort(); out.reverse();
    return out;
  }

  function trim(keep){
    var d = days();
    for(var i = keep; i < d.length; i++){
      try{ localStorage.removeItem(head() + d[i]); }catch(e){}
    }
  }

  /* その日の控えを1回だけ取ります */
  function keepToday(){
    var key = head() + stamp(new Date());
    try{ if(localStorage.getItem(key)) return; }catch(e){ return; }

    var b = '', c = '', o = '';
    try{
      b = localStorage.getItem(bKey()) || '{}';
      c = localStorage.getItem(cKey()) || '{}';
      o = localStorage.getItem(oKey()) || '[]';
    }catch(e){ return; }
    /* 空の状態を控えても意味がないので、何か入っているときだけ */
    if(cnt(pj(b,'{}')) === 0 && cnt(pj(c,'{}')) === 0) return;

    var body = JSON.stringify({ at:new Date().toISOString(), buildings:b, contracts:c, owners:o });

    /* 容量が足りなければ、古い日から順に捨てて入れ直します */
    for(var n = KEEP; n >= 1; n--){
      try{ localStorage.setItem(key, body); trim(KEEP); return; }
      catch(e){ trim(n - 1); }
    }
  }

  /* 戻す */
  function restore(day){
    var s = null;
    try{ s = JSON.parse(localStorage.getItem(head() + day) || 'null'); }catch(e){ s = null; }
    if(!s){ alert('その日の控えが見つかりませんでした。'); return; }

    var nowB = pj(localStorage.getItem(bKey()), '{}');
    var nowC = pj(localStorage.getItem(cKey()), '{}');
    var oldB = pj(s.buildings, '{}');
    var oldC = pj(s.contracts, '{}');
    var a = tally(nowB), b = tally(oldB);

    var msg = ymd(day) + ' の控えに戻します。\n\n' +
              '【いま → 戻したあと】\n' +
              '　物件　： ' + a.bld    + ' → ' + b.bld    + '\n' +
              '　区画　： ' + a.spot   + ' → ' + b.spot   + '\n' +
              '　配置図： ' + a.layout + ' → ' + b.layout + '\n' +
              '　契約　： ' + cnt(nowC) + ' → ' + cnt(oldC) + '\n\n' +
              'いまの状態は「復元前に戻す」で呼び戻せるよう退避します。\n' +
              'よろしいですか？';
    if(!confirm(msg)) return;

    try{
      localStorage.setItem(preKey(), JSON.stringify({
        at: new Date().toISOString(),
        buildings: localStorage.getItem(bKey()) || '{}',
        contracts: localStorage.getItem(cKey()) || '{}',
        owners:    localStorage.getItem(oKey()) || '[]'
      }));
      localStorage.setItem(bKey(), s.buildings);
      localStorage.setItem(cKey(), s.contracts);
      if(s.owners) localStorage.setItem(oKey(), s.owners);
    }catch(e){ alert('戻せませんでした: ' + e); return; }

    alert(ymd(day) + ' の内容に戻しました。\n\nこのあとクラウドへ送ります。\n' +
          '確認の画面が出たら【OK】を押してください（何も消えません）。');
    try{ if(typeof window.__scheduleAutoPush === 'function') window.__scheduleAutoPush(); }catch(e){}
    setTimeout(function(){ location.reload(); }, 2500);
  }

  /* 選ぶ画面 */
  window.pvPickDay = function(){
    var d = days();
    if(!d.length){ alert('まだ控えがありません。\n明日以降、開いたときから残りはじめます。'); return; }

    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;' +
                       'display:flex;align-items:center;justify-content:center;padding:16px;';
    var rows = d.map(function(day){
      var s = null;
      try{ s = JSON.parse(localStorage.getItem(head() + day) || 'null'); }catch(e){}
      var t = tally(pj(s && s.buildings, '{}'));
      var c = cnt(pj(s && s.contracts, '{}'));
      return '<button data-day="' + day + '" style="display:block;width:100%;text-align:left;' +
             'padding:12px 14px;margin:6px 0;border:1px solid #d4d4d8;border-radius:10px;' +
             'background:#fff;font-size:14px;cursor:pointer">' +
             '<b style="font-size:16px">' + ymd(day) + '</b><br>' +
             '<span style="color:#52525b">物件 ' + t.bld + '／区画 ' + t.spot +
             '／配置図 ' + t.layout + '／契約 ' + c + '</span></button>';
    }).join('');
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;padding:18px;max-width:460px;' +
                   'width:100%;max-height:80vh;overflow:auto">' +
                   '<div style="font-size:17px;font-weight:800;margin-bottom:4px">日付を選んで戻す</div>' +
                   '<div style="font-size:12px;color:#71717a;margin-bottom:12px">' +
                   'この端末に残っている控えです。選ぶとその日の内容に戻します。</div>' +
                   rows +
                   '<button id="pv-day-cancel" style="width:100%;margin-top:10px;padding:11px;' +
                   'border:0;border-radius:10px;background:#e4e4e7;font-size:14px;cursor:pointer">やめる</button>' +
                   '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(ev){
      if(ev.target === ov || ev.target.id === 'pv-day-cancel'){ ov.remove(); return; }
      var btn = ev.target.closest ? ev.target.closest('button[data-day]') : null;
      if(btn){ ov.remove(); restore(btn.getAttribute('data-day')); }
    });
  };

  /* 設定メニューにボタンを足します */
  function addPickButton(){
    var menu = document.getElementById('settings-menu');
    if(!menu || document.getElementById('btn-pick-day')) return;
    var btn = document.createElement('button');
    btn.id = 'btn-pick-day';
    btn.textContent = '日付を選んで戻す';
    btn.onclick = function(){
      if(typeof closeSettingsMenu === 'function') closeSettingsMenu();
      window.pvPickDay();
    };
    var ref = document.getElementById('btn-undo-restore');
    if(ref && ref.parentNode === menu) menu.insertBefore(btn, ref);
    else menu.appendChild(btn);
  }

  function boot(){ keepToday(); addPickButton(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ============================================================
 *  ㉟ この端末に名前をつけます
 *
 *  「最終更新 9/4 18:30（福山PC）」のように、
 *  最後に更新したのがどの端末かを画面に出します。
 *  何かおかしいとき、原因の端末がその場で分かります。
 *
 *  設定 →「この端末の名前」で登録します。1回だけで済みます。
 * ============================================================ */
(function(){
  'use strict';

  function pfx(){ return (typeof insPrefix === 'function') ? insPrefix() : 'pivot_'; }
  function nameKey(){ return pfx() + 'device_name'; }

  function getName(){
    try{ return (localStorage.getItem(nameKey()) || '').trim(); }catch(e){ return ''; }
  }
  try{ window.pvDeviceName = getName; }catch(e){}

  /* 送るときに、端末の名前を一緒に届けます */
  (function(){
    var P = window.postToGas;
    if(typeof P !== 'function') return;
    window.postToGas = function(url, body, timeoutMs){
      try{
        if(body && body.action === 'save' && body.payload){
          var nm = getName();
          if(nm) body.payload.device = nm;
        }
      }catch(e){}
      return P(url, body, timeoutMs);
    };
  })();

  window.pvSetDeviceName = function(){
    var now = getName();
    var v = null;
    try{
      v = window.prompt(
        'この端末の名前を入れてください。\n\n' +
        '「最終更新 9/4 18:30（福山PC）」のように画面に出ます。\n' +
        'おかしいことが起きたとき、どの端末が原因か分かります。\n\n' +
        '例： 福山PC ／ 広島ノート ／ 岡山PC ／ 社用スマホ',
        now || '');
    }catch(e){ return; }
    if(v === null) return;                 /* やめた */
    v = String(v).trim().slice(0, 20);
    try{
      if(v) localStorage.setItem(nameKey(), v);
      else  localStorage.removeItem(nameKey());
    }catch(e){}
    try{ alert(v ? ('この端末を「' + v + '」として記録します。') : '端末の名前を消しました。'); }catch(e){}
    /* 名前をクラウドへ反映しておきます */
    try{ if(typeof window.__scheduleAutoPush === 'function') window.__scheduleAutoPush(); }catch(e){}
  };

  function addNameButton(){
    var menu = document.getElementById('settings-menu');
    if(!menu || document.getElementById('btn-device-name')) return;
    var btn = document.createElement('button');
    btn.id = 'btn-device-name';
    btn.textContent = 'この端末の名前';
    btn.onclick = function(){
      if(typeof closeSettingsMenu === 'function') closeSettingsMenu();
      window.pvSetDeviceName();
    };
    menu.appendChild(btn);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addNameButton);
  else addNameButton();
})();

/* ============================================================
 *  ㊱ クラウドのバックアップから、日付を選んで戻します
 *
 *  ㉝ は「この端末の中」の控え（5日ぶん）でした。
 *  こちらは「クラウド（Google ドライブ）」の控え（30日ぶん）です。
 *  端末が壊れても、別の端末からここに戻せます。
 *  契約とオーナーも一緒に戻ります。
 *
 *  戻したあとはクラウドへ送り直すので、ほかの端末にも伝わります。
 *  ㉚ の合体を通るので、戻しても何かが消えることはありません。
 * ============================================================ */
(function(){
  'use strict';

  function pfx(){ return (typeof insPrefix === 'function') ? insPrefix() : 'pivot_'; }
  function bKey(){ return (typeof pbKey === 'function') ? pbKey() : pfx() + 'blds'; }
  function cKey(){ return (typeof ctKey === 'function') ? ctKey() : pfx() + 'contract_kanban_v2'; }
  function oKey(){ return pfx() + 'rent_owner_send_owners_v1'; }
  function preKey(){ return pfx() + 'prerestore_backup'; }

  function ymd(d){ return d.slice(0,4) + '/' + d.slice(4,6) + '/' + d.slice(6,8); }
  function cnt(o){ return Object.keys(o || {}).length; }
  function tally(blds){
    var t = { bld:0, spot:0, layout:0 };
    Object.keys(blds || {}).forEach(function(id){
      var b = blds[id]; if(!b) return;
      t.bld++; t.spot += (b.spots || []).length;
      if(b.layout_id) t.layout++;
      if(b.layout2_id) t.layout++;
    });
    return t;
  }
  function url(){ return (typeof getCloudUrl === 'function') ? getCloudUrl() : ''; }

  function overlay(html){
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;' +
                       'display:flex;align-items:center;justify-content:center;padding:16px;';
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;padding:18px;max-width:460px;' +
                   'width:100%;max-height:80vh;overflow:auto">' + html + '</div>';
    document.body.appendChild(ov);
    return ov;
  }

  window.pvCloudRestore = function(){
    var u = url();
    if(!u){ alert('クラウドの設定がありません。'); return; }
    try{ if(typeof setSyncStatus === 'function') setSyncStatus('loading', 'バックアップを確認中…'); }catch(e){}

    Promise.resolve(postToGas(u, { action:'listBackups' })).then(function(r){
      try{ if(typeof setSyncStatus === 'function') setSyncStatus('idle',''); }catch(e){}
      if(!r || !r.ok || !r.days || !r.days.length){
        alert('クラウドにバックアップがまだありません。\n\n' +
              '1日1回、はじめて保存したときに作られます。\n明日以降に貯まりはじめます。');
        return;
      }
      var rows = r.days.map(function(d){
        return '<button data-day="' + d + '" style="display:block;width:100%;text-align:left;' +
               'padding:12px 14px;margin:6px 0;border:1px solid #d4d4d8;border-radius:10px;' +
               'background:#fff;font-size:16px;font-weight:700;cursor:pointer">' + ymd(d) + '</button>';
      }).join('');
      var ov = overlay(
        '<div style="font-size:17px;font-weight:800;margin-bottom:4px">クラウドのバックアップから戻す</div>' +
        '<div style="font-size:12px;color:#71717a;margin-bottom:12px">' +
        'その日のはじめての保存の直前の状態です（' + r.days.length + '日ぶん）。<br>' +
        '物件・区画・配置図に加えて、契約とオーナーも戻ります。</div>' + rows +
        '<button id="pv-cb-cancel" style="width:100%;margin-top:10px;padding:11px;border:0;' +
        'border-radius:10px;background:#e4e4e7;font-size:14px;cursor:pointer">やめる</button>');
      ov.addEventListener('click', function(ev){
        if(ev.target === ov || ev.target.id === 'pv-cb-cancel'){ ov.remove(); return; }
        var btn = ev.target.closest ? ev.target.closest('button[data-day]') : null;
        if(btn){ ov.remove(); pick(btn.getAttribute('data-day')); }
      });
    }).catch(function(){
      try{ if(typeof setSyncStatus === 'function') setSyncStatus('error', '⚠️ バックアップの確認に失敗'); }catch(e){}
      alert('バックアップの一覧を取れませんでした。通信を確かめてください。');
    });
  };

  function pick(day){
    var u = url();
    try{ if(typeof setSyncStatus === 'function') setSyncStatus('loading', ymd(day) + ' を読み込み中…'); }catch(e){}

    Promise.resolve(postToGas(u, { action:'loadBackup', day: day })).then(function(r){
      try{ if(typeof setSyncStatus === 'function') setSyncStatus('idle',''); }catch(e){}
      if(!r || !r.ok || !r.payload){
        alert((r && r.message) || 'その日のバックアップを読めませんでした。');
        return;
      }
      var p = r.payload;
      var oldB = p.buildings || {}, oldC = p.contracts || {}, oldO = p.owners || [];

      var nowB = {}, nowC = {}, nowO = [];
      try{ nowB = JSON.parse(localStorage.getItem(bKey()) || '{}'); }catch(e){}
      try{ nowC = JSON.parse(localStorage.getItem(cKey()) || '{}'); }catch(e){}
      try{ nowO = JSON.parse(localStorage.getItem(oKey()) || '[]'); }catch(e){}

      var a = tally(nowB), b = tally(oldB);
      var msg = ymd(day) + ' のバックアップに戻します。\n\n' +
                '【いま → 戻したあと】\n' +
                '　物件　　： ' + a.bld    + ' → ' + b.bld    + '\n' +
                '　区画　　： ' + a.spot   + ' → ' + b.spot   + '\n' +
                '　配置図　： ' + a.layout + ' → ' + b.layout + '\n' +
                '　契約　　： ' + cnt(nowC) + ' → ' + cnt(oldC) + '\n' +
                '　オーナー： ' + (nowO.length || 0) + ' → ' + (oldO.length || 0) + '\n\n' +
                'いまの状態は「復元前に戻す」で呼び戻せるよう退避します。\n' +
                'よろしいですか？';
      if(!confirm(msg)) return;

      try{
        localStorage.setItem(preKey(), JSON.stringify({
          at: new Date().toISOString(),
          buildings: localStorage.getItem(bKey()) || '{}',
          contracts: localStorage.getItem(cKey()) || '{}',
          owners:    localStorage.getItem(oKey()) || '[]'
        }));
        localStorage.setItem(bKey(), JSON.stringify(oldB));
        localStorage.setItem(cKey(), JSON.stringify(oldC));
        localStorage.setItem(oKey(), JSON.stringify(oldO));
      }catch(e){ alert('戻せませんでした: ' + e); return; }

      alert(ymd(day) + ' の内容に戻しました。\n\nこのあとクラウドへ送ります。\n' +
            '確認の画面が出たら【OK】を押してください（何も消えません）。');
      try{ if(typeof window.__scheduleAutoPush === 'function') window.__scheduleAutoPush(); }catch(e){}
      setTimeout(function(){ location.reload(); }, 2500);
    }).catch(function(){
      try{ if(typeof setSyncStatus === 'function') setSyncStatus('error', '⚠️ 読み込みに失敗'); }catch(e){}
      alert('バックアップを読めませんでした。通信を確かめてください。');
    });
  }

  function addCloudButton(){
    var menu = document.getElementById('settings-menu');
    if(!menu || document.getElementById('btn-cloud-restore')) return;
    var btn = document.createElement('button');
    btn.id = 'btn-cloud-restore';
    btn.textContent = 'クラウドのバックアップから戻す';
    btn.onclick = function(){
      if(typeof closeSettingsMenu === 'function') closeSettingsMenu();
      window.pvCloudRestore();
    };
    var ref = document.getElementById('btn-pick-day');
    if(ref && ref.parentNode === menu && ref.nextSibling) menu.insertBefore(btn, ref.nextSibling);
    else menu.appendChild(btn);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addCloudButton);
  else addCloudButton();
})();

/* ============================================================
 *  ㊳ GAS の URL を Firebase から受け取ります
 *
 *  新しいPC・新しい社員でも「ログインするだけ」で使えるようにします。
 *  引き継ぎリンク（㉜）も残しますが、こちらが本命です。
 *
 *  ・URL は Firebase に置きます（公開リポジトリには書きません）
 *  ・ログインした人だけが読めるようにルールを設定します
 *  ・辞めた社員のアカウントを止めれば、その端末は URL を取り直せません
 *
 *  Firestore を SDK なしで読むため、REST を直接呼んでいます。
 *  （index.html に読み込む部品を増やさずに済みます）
 * ============================================================ */
(function(){
  'use strict';

  function pfx(){ return (typeof insPrefix === 'function') ? insPrefix() : 'pivot_'; }
  function insName(){ return pfx().replace(/_+$/, '') || 'pivot'; }   /* pivot2 / pivot3 */
  function project(){
    try{ return (window.FIREBASE_CONFIG && FIREBASE_CONFIG.projectId) || ''; }catch(e){ return ''; }
  }
  function getUrl(){
    try{ return (typeof getCloudUrl === 'function') ? getCloudUrl() : ''; }catch(e){ return ''; }
  }
  function putUrl(v){
    try{
      if(typeof setCloudUrl === 'function') setCloudUrl(v);
      else localStorage.setItem(pfx() + 'cloud_url', v);
    }catch(e){}
  }

  var _tried = false;
  var _retry = 0;

  function pull(){
    if(_tried) return;
    var pid = project();
    if(!pid) return;
    var user = null;
    try{ user = window.firebase && firebase.auth && firebase.auth().currentUser; }catch(e){ return; }
    if(!user) return;
    _tried = true;

    user.getIdToken().then(function(tok){
      var api = 'https://firestore.googleapis.com/v1/projects/' + pid +
                '/databases/(default)/documents/config/' + encodeURIComponent(insName());
      return fetch(api, { headers: { Authorization: 'Bearer ' + tok } });
    }).then(function(res){
      if(!res || !res.ok) throw new Error('not ok');
      return res.json();
    }).then(function(j){
      var v = '';
      try{ v = (j.fields && j.fields.gasUrl && j.fields.gasUrl.stringValue) || ''; }catch(e){}
      v = String(v).trim();
      /* GAS 以外のあて先は受け付けません */
      if(!/^https:\/\/script\.google\.com\/macros\/s\/[^\/]+\/exec/.test(v)) return;

      var cur = getUrl();
      if(cur === v) return;           /* すでに同じ */
      putUrl(v);

      if(!cur){
        /* この端末は初めて。すぐ最新を取りに行きます */
        try{ if(typeof setSyncStatus === 'function') setSyncStatus('saved', '✅ クラウドの設定が入りました'); }catch(e){}
        try{ if(typeof window.__pvCheckLatest === 'function') window.__pvCheckLatest(); }catch(e){}
      }else{
        try{ if(typeof setSyncStatus === 'function') setSyncStatus('saved', '✅ クラウドの接続先を更新しました'); }catch(e){}
      }
    }).catch(function(){
      /* 取れなくても、これまでどおり手元の設定で動きます。少し待って数回だけ試し直します */
      _tried = false;
      _retry++;
      if(_retry <= 3) setTimeout(pull, 2000 * _retry);
    });
  }
  try{ window.pvPullGasUrl = function(){ _tried = false; _retry = 0; pull(); }; }catch(e){}

  /* ログインが済んだ時点で読みに行きます */
  try{
    if(window.firebase && firebase.auth){
      firebase.auth().onAuthStateChanged(function(u){ if(u){ _tried = false; _retry = 0; setTimeout(pull, 300); } });
    }
  }catch(e){}
  setTimeout(pull, 2500);
})();

/* ============================================================
 *  ㊴ GAS の URL が未設定でも、ログイン画面を出します
 *
 *  js/core.js の showLoginScreen() は、いちばん最初に
 *      if(!getCloudUrl()){ return; }   // クラウド未設定なら…
 *  としています。「クラウドを使わず、この端末だけで使う」ための作りです。
 *
 *  ところが ㊳（URL を Firebase から受け取る）は
 *  「ログインしたあとに URL を取る」仕組みなので、
 *  　　新しいPC → URL が無い → ログイン画面が出ない → ログインできない
 *  　　　　　　→ URL を受け取れない
 *  という堂々めぐりになっていました。
 *
 *  ここでは、URL が無くても Firebase が使えるならログイン画面を出します。
 *  やり方は「showLoginScreen を呼ぶあいだだけ getCloudUrl の返事を差し替える」だけで、
 *  localStorage には何も書きません。呼び終わったら元に戻します。
 *
 *  Firebase が読み込めていないときは、これまでどおり
 *  「この端末だけで使う」動きのままにしています。
 * ============================================================ */
(function(){
  'use strict';

  var ORIG = window.showLoginScreen;
  if(typeof ORIG !== 'function') return;

  window.showLoginScreen = function(){
    var url = '';
    try{ url = (typeof getCloudUrl === 'function') ? getCloudUrl() : ''; }catch(e){}
    if(url) return ORIG.apply(this, arguments);      /* 設定済み → これまでどおり */

    var canLogin = false;
    try{ canLogin = !!(window.firebase && firebase.auth && firebase.auth()); }catch(e){ canLogin = false; }
    if(!canLogin) return ORIG.apply(this, arguments); /* Firebase が無い → これまでどおり */

    /* この呼び出しのあいだだけ「設定あり」と答えさせて、ログイン画面を出させます */
    var g = window.getCloudUrl;
    try{
      window.getCloudUrl = function(){ return 'pending'; };
      return ORIG.apply(this, arguments);
    } finally {
      window.getCloudUrl = g;                        /* すぐ元に戻します */
    }
  };
})();
