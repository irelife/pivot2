/* ===========================================================
   指でつまんで大きくする部品（ピンチ）

   このアプリは画面全体のピンチを止めてあるので（index.html の
   user-scalable=no）、必要なところだけ自前で動かします。

   ・2本指でつまむ … 大きく／小さく（1〜6倍）
   ・1本指でなぞる … 大きくしているときは、見る場所を動かす
   ・2回たたく    … 2.5倍 ⇄ もとの大きさ

   指で触れる端末だけで動きます。パソコンのマウス操作は
   これまでどおりで、何も変わりません。
   =========================================================== */
(function(){
  'use strict';
  var TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  function pinchify(img, opts){
    opts = opts || {};
    if(!TOUCH || !img) return { reset:function(){}, enabled:false };

    var MIN = 1, MAX = 6;
    var pts = {}, n = 0, scale = 1, tx = 0, ty = 0;
    var startScale = 1, startDist = 0, startMid = null, startTx = 0, startTy = 0;
    var lastTap = 0, moved = 0;

    function frame(){ return opts.frame || img.parentNode || img; }
    function apply(){
      clamp();
      img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
      /* 大きくしている間だけ、指の動きをこちらで受け取ります。
         ふつうの大きさのときは、そのまま縦スクロールできるようにします。 */
      if(opts.scrollable) img.style.touchAction = (scale > 1.02) ? 'none' : 'pan-y';
    }
    function clamp(){
      if(scale < MIN) scale = MIN;
      if(scale > MAX) scale = MAX;
      if(scale <= 1){ tx = 0; ty = 0; return; }
      var r = frame().getBoundingClientRect();
      var w = img.clientWidth * scale, h = img.clientHeight * scale;
      var mx = Math.max(0, (w - r.width)  / 2);
      var my = Math.max(0, (h - r.height) / 2);
      if(tx >  mx) tx =  mx;
      if(tx < -mx) tx = -mx;
      if(ty >  my) ty =  my;
      if(ty < -my) ty = -my;
    }
    function reset(){
      scale = 1; tx = 0; ty = 0; pts = {}; n = 0; startDist = 0;
      img.style.transform = '';
      if(opts.scrollable) img.style.touchAction = 'pan-y';
    }
    function list(){ var a = []; for(var k in pts) a.push(pts[k]); return a; }
    function dist(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
    function mid(a, b){ return { x:(a.x + b.x) / 2, y:(a.y + b.y) / 2 }; }

    img.addEventListener('pointerdown', function(e){
      pts[e.pointerId] = { x:e.clientX, y:e.clientY }; n++;
      try{ img.setPointerCapture(e.pointerId); }catch(err){}
      var p = list();
      if(n === 2){
        startDist = dist(p[0], p[1]); startMid = mid(p[0], p[1]);
        startScale = scale; startTx = tx; startTy = ty;
      } else if(n === 1){
        moved = 0; startMid = { x:e.clientX, y:e.clientY }; startTx = tx; startTy = ty;
      }
    });
    img.addEventListener('pointermove', function(e){
      if(!pts[e.pointerId]) return;
      pts[e.pointerId] = { x:e.clientX, y:e.clientY };
      var p = list();
      if(n >= 2 && startDist > 0){
        if(e.cancelable) e.preventDefault();
        var d = dist(p[0], p[1]), m = mid(p[0], p[1]);
        scale = startScale * (d / startDist);
        if(scale < MIN) scale = MIN;
        if(scale > MAX) scale = MAX;
        tx = startTx + (m.x - startMid.x);
        ty = startTy + (m.y - startMid.y);
        apply();
      } else if(n === 1 && scale > 1.02){
        if(e.cancelable) e.preventDefault();
        var dx = e.clientX - startMid.x, dy = e.clientY - startMid.y;
        moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
        tx = startTx + dx; ty = startTy + dy;
        apply();
      }
    });
    function up(e){
      if(pts[e.pointerId]){ delete pts[e.pointerId]; n = Math.max(0, n - 1); }
      try{ img.releasePointerCapture(e.pointerId); }catch(err){}
      if(n === 1){ var p = list()[0]; startMid = { x:p.x, y:p.y }; startTx = tx; startTy = ty; }
      if(n === 0){
        var now = Date.now();
        if(moved < 8){
          if(now - lastTap < 300){ scale = (scale > 1.05) ? 1 : 2.5; tx = 0; ty = 0; apply(); lastTap = 0; }
          else lastTap = now;
        }
        startDist = 0;
      }
    }
    img.addEventListener('pointerup', up);
    img.addEventListener('pointercancel', up);

    if(opts.scrollable) img.style.touchAction = 'pan-y';
    else img.style.touchAction = 'none';

    return {
      reset: reset,
      enabled: true,
      zoomed: function(){ return scale > 1.05; }
    };
  }

  window.PVPinch = pinchify;

  /* ---- 配置図の拡大画面（黒い全画面）にも同じ動きを付けます ---- */
  function startZoomPinch(){
    var img = document.getElementById('img-zoom-target');
    var box = document.getElementById('img-zoom');
    if(!img || !box) return;
    var pz = pinchify(img, { frame:box });
    if(!pz.enabled) return;
    box.addEventListener('click', function(e){
      /* 大きくしている間は、画像から指を離しても閉じないようにします */
      if(pz.zoomed() && e.target === img) e.stopPropagation();
    }, true);
    if(window.MutationObserver){
      new MutationObserver(function(){ pz.reset(); })
        .observe(box, { attributes:true, attributeFilter:['class'] });
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startZoomPinch);
  else startZoomPinch();
})();

/* ===========================================================
   スマホで物件を見るときの画面（Googleマップと同じ組み立て）

   ・配置図を画面いっぱいに敷きます
   ・物件情報と区画一覧は、下から引き上げるシートに入れます

   いまある HTML の id は1つも変えません。
   .modal-body と .modal-footer を、新しく作る #pv-sheet の中へ
   「移すだけ」なので、保存・編集・印刷の動きはそのままです。
   760px より広い画面では、何もしません（パソコンは今までどおり）。
   =========================================================== */
(function(){
  'use strict';

  var MQ    = window.matchMedia('(max-width: 760px)');
  var SNAPS = ['peek', 'half', 'full'];
  var RATIO = { peek: 0.32, half: 0.60, full: 0.94 };

  var on = false, idx = 1;
  var modal, box, header, body, footer, sheet, stage, grip, gripName, hint, obs;
  var pin, pinImg, pinch;

  function q(s, r){ return (r || document).querySelector(s); }

  /* ---------- 組み立て ---------- */
  function build(){
    if(on) return;
    modal  = document.getElementById('modal');            if(!modal) return;
    box    = q('.modal', modal);                          if(!box) return;
    header = q('.modal-header', box);
    body   = q('.modal-body', box);
    footer = q('.modal-footer', box);
    if(!body) return;

    stage = document.createElement('div');
    stage.id = 'pv-stage';
    box.insertBefore(stage, box.firstChild);

    hint = document.createElement('div');
    hint.id = 'pv-hint';
    hint.textContent = 'タップで拡大';
    box.appendChild(hint);

    sheet = document.createElement('div');
    sheet.id = 'pv-sheet';

    grip = document.createElement('div');
    grip.id = 'pv-grip';
    grip.setAttribute('role', 'button');
    grip.setAttribute('tabindex', '0');
    grip.setAttribute('aria-label', 'シートの高さを変える');
    grip.innerHTML = '<i></i><b id="pv-grip-name"></b>';
    gripName = q('#pv-grip-name', grip);

    /* 区画を見るときに、配置図を上に貼りつけておく板。
       いちばん上まで上げたときだけ出ます（CSSで切り替え）。 */
    pin = document.createElement('div');
    pin.id = 'pv-pin';
    pin.innerHTML =
      '<div class="pv-pin-bar"><span>配置図</span>' +
      '<button type="button" id="pv-pin-fold">たたむ</button></div>' +
      '<div class="pv-pin-view"><img alt="配置図"></div>';
    pinImg = pin.querySelector('img');
    body.insertBefore(pin, body.firstChild);

    sheet.appendChild(grip);
    sheet.appendChild(body);
    if(footer) sheet.appendChild(footer);
    box.appendChild(sheet);

    modal.classList.add('pv-ms');
    on = true;

    grip.addEventListener('pointerdown', onDown);
    grip.addEventListener('keydown', onKey);
    grip.addEventListener('click', onTap);
    stage.addEventListener('click', onStageTap);

    var area = document.getElementById('layout-area');
    if(area && window.MutationObserver){
      obs = new MutationObserver(syncStage);
      obs.observe(area, { childList:true, subtree:true, attributes:true, attributeFilter:['src'] });
    }
    var nameEl = document.getElementById('f-name');
    if(nameEl) nameEl.addEventListener('input', syncName);

    /* 中身をスクロールしはじめたら、シートをいちばん上まで伸ばします。
       つまみを引き上げなくても読めるようにするためです（地図アプリと同じ）。 */
    body.addEventListener('scroll', onBodyScroll, { passive:true });

    pin.querySelector('#pv-pin-fold').addEventListener('click', function(){
      var folded = pin.classList.toggle('is-folded');
      this.textContent = folded ? 'ひらく' : 'たたむ';
      if(folded && pinch) pinch.reset();
    });
    if(typeof window.PVPinch === 'function'){
      pinch = window.PVPinch(pinImg, { frame: pin.querySelector('.pv-pin-view'), scrollable: true });
    }

    snap('half', false);
    syncStage();
    syncName();
  }

  /* ---------- 元に戻す（画面を広げたとき） ---------- */
  function teardown(){
    if(!on) return;
    if(obs){ obs.disconnect(); obs = null; }
    grip.removeEventListener('pointerdown', onDown);
    grip.removeEventListener('keydown', onKey);
    grip.removeEventListener('click', onTap);
    stage.removeEventListener('click', onStageTap);
    body.removeEventListener('scroll', onBodyScroll);

    box.appendChild(body);
    if(footer) box.appendChild(footer);
    if(pin && pin.parentNode) pin.parentNode.removeChild(pin);
    if(sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
    if(stage && stage.parentNode) stage.parentNode.removeChild(stage);
    if(hint  && hint.parentNode)  hint.parentNode.removeChild(hint);

    modal.classList.remove('pv-ms', 'pv-dragging');
    modal.removeAttribute('data-pv-snap');
    modal.style.removeProperty('--pv-h');
    body.style.removeProperty('overflow-y');
    sheet = stage = grip = gripName = hint = pin = pinImg = pinch = null;
    on = false;
  }

  /* ---------- 配置図をステージに映す ---------- */
  function layoutSrc(){
    var img = q('#layout-area .img-thumb img');
    return img ? img.getAttribute('src') : '';
  }
  function syncStage(){
    if(!on || !stage) return;
    var src = layoutSrc();
    if(src){
      var cur = q('img', stage);
      if(cur){ if(cur.getAttribute('src') !== src) cur.setAttribute('src', src); }
      else { stage.innerHTML = '<img alt="配置図">'; q('img', stage).setAttribute('src', src); }
      if(pinImg && pinImg.getAttribute('src') !== src) pinImg.setAttribute('src', src);
      if(pin) pin.style.display = '';
      if(hint) hint.style.display = '';
      return;
    }
    if(q('#layout-area .img-thumb-pdf')){
      stage.innerHTML = '<div class="pv-stage-pdf">配置図はPDFです<br>下の配置図欄から開いてください</div>';
    } else {
      stage.innerHTML = '<div class="pv-stage-none">配置図がまだ登録されていません。<br>下の「配置図」から追加できます。</div>';
    }
    if(hint) hint.style.display = 'none';
    if(pin) pin.style.display = 'none';   // 配置図が無いときは板も出しません
  }
  function syncName(){
    if(!on || !gripName) return;
    var el = document.getElementById('f-name');
    gripName.textContent = (el && el.value) ? el.value : '';
  }

  /* ---------- 高さ ---------- */
  function h(name){ return Math.round(box.clientHeight * RATIO[name]); }

  function snap(name){
    idx = SNAPS.indexOf(name); if(idx < 0) idx = 1;
    modal.setAttribute('data-pv-snap', name);
    modal.style.setProperty('--pv-h', h(name) + 'px');
  }

  /* ---------- 指で引き上げる ---------- */
  var dragging = false, startY = 0, startH = 0, moved = 0;

  function onDown(e){
    if(e.button != null && e.button !== 0) return;
    dragging = true; moved = 0;
    startY = e.clientY;
    startH = h(SNAPS[idx]);
    modal.classList.add('pv-dragging');
    try{ grip.setPointerCapture(e.pointerId); }catch(err){}
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
    grip.addEventListener('pointercancel', onUp);
  }
  function onMove(e){
    if(!dragging) return;
    var dy = e.clientY - startY;
    if(Math.abs(dy) > moved) moved = Math.abs(dy);
    var v = Math.min(box.clientHeight * 0.96, Math.max(80, startH - dy));
    modal.style.setProperty('--pv-h', v + 'px');
  }
  function onUp(e){
    if(!dragging) return;
    dragging = false;
    modal.classList.remove('pv-dragging');
    try{ grip.releasePointerCapture(e.pointerId); }catch(err){}
    grip.removeEventListener('pointermove', onMove);
    grip.removeEventListener('pointerup', onUp);
    grip.removeEventListener('pointercancel', onUp);

    var cur = parseFloat(getComputedStyle(modal).getPropertyValue('--pv-h')) || h('half');
    var best = 'half', d = Infinity;
    SNAPS.forEach(function(n){ var dd = Math.abs(h(n) - cur); if(dd < d){ d = dd; best = n; } });
    snap(best);
  }
  function onTap(){
    if(moved > 6){ moved = 0; return; }   // ドラッグの終わりはタップとして扱いません
    snap(SNAPS[(idx + 1) % SNAPS.length]);
  }
  function onKey(e){
    if(e.key === 'ArrowUp'){   e.preventDefault(); snap(SNAPS[Math.min(2, idx + 1)]); }
    if(e.key === 'ArrowDown'){ e.preventDefault(); snap(SNAPS[Math.max(0, idx - 1)]); }
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); snap(SNAPS[(idx + 1) % SNAPS.length]); }
  }

  /* ---------- 中身をスクロールしたら、いちばん上まで伸ばします ---------- */
  function onBodyScroll(){
    if(!on || dragging) return;
    if(body.scrollTop > 6 && SNAPS[idx] !== 'full') snap('full');
  }

  /* ---------- 配置図をタップして拡大（いまある機能をそのまま使います） ---------- */
  function onStageTap(){
    var src = layoutSrc();
    if(src && typeof window.openImgZoom === 'function') window.openImgZoom(src);
  }

  /* ---------- 出入り口 ---------- */
  function refresh(){
    if(MQ.matches) build(); else teardown();
    if(on){ snap(SNAPS[idx]); syncStage(); syncName(); }
  }
  function start(){
    refresh();
    if(MQ.addEventListener) MQ.addEventListener('change', refresh);
    else if(MQ.addListener) MQ.addListener(refresh);
    window.addEventListener('resize', function(){ if(on && !dragging) snap(SNAPS[idx]); });

    // 物件を開いたときに、配置図と物件名を映しなおします
    var m = document.getElementById('modal');
    if(m && window.MutationObserver){
      new MutationObserver(function(){
        if(!on) return;
        if(m.classList.contains('active')){ snap('half'); syncStage(); syncName(); }
      }).observe(m, { attributes:true, attributeFilter:['class'] });
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.PVMobileSheet = { refresh: refresh, sync: function(){ syncStage(); syncName(); } };
})();
