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
