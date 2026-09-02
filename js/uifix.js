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
 *  ㉒ 物件一覧に「空車 / 満車」を出します
 *
 *  ・満車の物件 … カードの背景を黒、文字を白にして「満車」と出します
 *  ・空車がある物件 … カードの背景を薄い青にして、
 *      種別（並列・縦列・軽専用）ごとに「空車の数」と「区画ナンバー」を出します
 *
 *  buildings.js の _bldCardHtml() を、この1枚で置き換えています。
 *  元に戻すときは index.html の uifix.js の行を消すだけです。
 * ============================================================ */
(function(){
  'use strict';

  var TYPE_LABEL = { '並':'普通', '縦':'縦列', '軽':'軽', '機':'機械式' };

  function esc(v){
    return (typeof escapeHtml === 'function') ? escapeHtml(v) : String(v == null ? '' : v);
  }

  window._bldCardHtml = function(b){
    var spots = (b && b.spots) || [];
    var total = spots.length;
    var used  = spots.filter(function(s){ return s.status === '借'; }).length;

    /* 空いている区画（状況が「空き」のもの）を、区画ナンバー順にならべます */
    var freeList = [];
    spots.forEach(function(s, i){
      if(!s || s.status !== '空') return;
      freeList.push({ no: Number(s.no) || (i + 1), t: TYPE_LABEL[s.type] || '普通' });
    });
    freeList.sort(function(a, b){ return a.no - b.no; });
    var free = freeList.length;
    var full = (free === 0);

    /* 満車なら「満車」、空車があれば区画ナンバーの札を物件名の横に出します */
    var right = full
      ? '<span class="pv-full">満車</span>'
      : '<span class="pv-free">' +
          freeList.map(function(f){
            return '<span class="pv-chip"><b>P' + f.no + '</b>' + f.t + '</span>';
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
})();
