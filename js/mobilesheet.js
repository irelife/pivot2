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
    var baseC = null;                 // 変形していないときの中心（画面座標）
    var lastTap = 0, moved = 0;

    function frame(){ return opts.frame || img.parentNode || img; }
    /* いまの見た目の中心から、変形していないときの中心を逆算します。
       （中心を基準に拡大するので、拡大しても中心は動きません） */
    function centerNow(){
      var r = img.getBoundingClientRect();
      return { x: r.left + r.width/2 - tx, y: r.top + r.height/2 - ty };
    }
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
      scale = 1; tx = 0; ty = 0; pts = {}; n = 0; startDist = 0; baseC = null;
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
        baseC = centerNow();
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
        /* 指の間の点が動かないように、拡大と同時に上下左右へずらします。
           k は今回の拡大率。指を広げながら好きな向きへ動かせます。 */
        var k = scale / startScale;
        var c = baseC || centerNow();
        tx = m.x - c.x - k * (startMid.x - c.x - startTx);
        ty = m.y - c.y - k * (startMid.y - c.y - startTy);
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
          if(now - lastTap < 300){
            if(scale > 1.05){ scale = 1; tx = 0; ty = 0; }
            else {
              /* たたいた場所を中心に2.5倍にします */
              var c2 = centerNow(), k2 = 2.5 / scale;
              tx = e.clientX - c2.x - k2 * (e.clientX - c2.x - tx);
              ty = e.clientY - c2.y - k2 * (e.clientY - c2.y - ty);
              scale = 2.5;
            }
            apply(); lastTap = 0;
          }
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

   ・配置図（または現地写真）を画面いっぱいに敷きます
   ・物件情報と区画一覧は、下から引き上げるシートに入れます

   いまある HTML の id は1つも変えません。
   .modal-body と .modal-footer を、新しく作る #pv-sheet の中へ
   「移すだけ」なので、保存・編集・印刷の動きはそのままです。
   760px より広い画面では、何もしません（パソコンは今までどおり）。

   v5 で直したところ
   ・配置図が無くて「現地写真」しか入れていない物件でも、
     上に敷いて、上に貼りつけられるようにしました。
   ・画像が2枚以上あるときは ‹ › で切り替えられるようにしました。
   ・シートが下がらなくなる（読もうとすると勝手に上まで戻る）のを
     直しました。自分で下げたあとは、勝手に上がりません。
   ・つまみを大きくして、いちばん上のときは「▼ 下げる」と出します。
   ・中身をいちばん上まで戻した状態で下へなぞると、1段下がります。
   =========================================================== */
(function(){
  'use strict';

  var MQ    = window.matchMedia('(max-width: 760px)');
  var SNAPS = ['peek', 'half', 'full'];
  var RATIO = { peek: 0.32, half: 0.60, full: 0.94 };

  var on = false, idx = 1;
  var modal, box, header, body, footer, sheet, stage, grip, gripName, hint, obs;
  var pin, pinImg, pinLabel, pinPrev, pinNext, pinch;
  var stageImg, stagePinch;
  var stageNav, stageNavLabel;
  var shots = [], cur = 0, curName = '';
  var userSnapped = false;   /* 自分で下げたあとは、勝手に上げません */

  function q(s, r){ return (r || document).querySelector(s); }
  function qa(s, r){ return (r || document).querySelectorAll(s); }

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

    stageNav = document.createElement('div');
    stageNav.id = 'pv-stage-nav';
    stageNav.innerHTML =
      '<button type="button" data-pv-step="-1" aria-label="前の画像">‹</button>' +
      '<b></b>' +
      '<button type="button" data-pv-step="1" aria-label="次の画像">›</button>';
    stageNavLabel = q('b', stageNav);
    box.appendChild(stageNav);

    hint = document.createElement('div');
    hint.id = 'pv-hint';
    hint.textContent = 'タップで全画面・2本指で拡大';
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

    /* 区画を見るときに、配置図（または写真）を上に貼りつけておく板。
       いちばん上まで上げたときだけ出ます（CSSで切り替え）。 */
    pin = document.createElement('div');
    pin.id = 'pv-pin';
    pin.innerHTML =
      '<div class="pv-pin-bar">' +
        '<span id="pv-pin-label">配置図</span>' +
        '<div class="pv-pin-btns">' +
          '<button type="button" id="pv-pin-prev" aria-label="前の画像">‹</button>' +
          '<button type="button" id="pv-pin-next" aria-label="次の画像">›</button>' +
          '<button type="button" id="pv-pin-fold">たたむ</button>' +
        '</div>' +
      '</div>' +
      '<div class="pv-pin-view"><img alt="配置図"></div>';
    pinImg   = q('img', pin);
    pinLabel = q('#pv-pin-label', pin);
    pinPrev  = q('#pv-pin-prev', pin);
    pinNext  = q('#pv-pin-next', pin);
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

    stageNav.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('button') : null;
      if(!b) return;
      e.stopPropagation();
      step(parseInt(b.getAttribute('data-pv-step'), 10) || 1);
    });
    pinPrev.addEventListener('click', function(){ step(-1); });
    pinNext.addEventListener('click', function(){ step(1); });

    var area = document.getElementById('layout-area');
    if(area && window.MutationObserver){
      obs = new MutationObserver(syncStage);
      obs.observe(area, { childList:true, subtree:true, attributes:true, attributeFilter:['src'] });
    }
    var nameEl = document.getElementById('f-name');
    if(nameEl) nameEl.addEventListener('input', syncName);

    /* 中身をスクロールしはじめたら、シートをいちばん上まで伸ばします。
       ただし、自分でつまみを下げたあとは伸ばしません（v5）。 */
    body.addEventListener('scroll', onBodyScroll, { passive:true });

    /* 中身がいちばん上のときに下へなぞったら、1段下げます（v5） */
    body.addEventListener('pointerdown', onBodyDown,  { passive:true });
    body.addEventListener('pointermove', onBodyMove,  { passive:true });
    body.addEventListener('pointerup',   onBodyEnd,   { passive:true });
    body.addEventListener('pointercancel', onBodyEnd, { passive:true });

    q('#pv-pin-fold', pin).addEventListener('click', function(){
      var folded = pin.classList.toggle('is-folded');
      this.textContent = folded ? 'ひらく' : 'たたむ';
      if(folded && pinch) pinch.reset();
    });
    if(typeof window.PVPinch === 'function'){
      pinch = window.PVPinch(pinImg, { frame: q('.pv-pin-view', pin), scrollable: true });
    }

    snap('half');
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
    body.removeEventListener('pointerdown', onBodyDown);
    body.removeEventListener('pointermove', onBodyMove);
    body.removeEventListener('pointerup', onBodyEnd);
    body.removeEventListener('pointercancel', onBodyEnd);

    box.appendChild(body);
    if(footer) box.appendChild(footer);
    if(pin && pin.parentNode) pin.parentNode.removeChild(pin);
    if(sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
    if(stage && stage.parentNode) stage.parentNode.removeChild(stage);
    if(stageNav && stageNav.parentNode) stageNav.parentNode.removeChild(stageNav);
    if(hint  && hint.parentNode)  hint.parentNode.removeChild(hint);

    modal.classList.remove('pv-ms', 'pv-dragging');
    modal.removeAttribute('data-pv-snap');
    modal.style.removeProperty('--pv-h');
    body.style.removeProperty('overflow-y');
    sheet = stage = stageNav = stageNavLabel = grip = gripName = null;
    hint = pin = pinImg = pinLabel = pinPrev = pinNext = pinch = null;
    stageImg = stagePinch = null;
    shots = []; cur = 0;
    on = false;
  }

  /* ---------- 上に映す画像を集める ----------
     上に映すのは「配置図」だけです。
     現地写真は映しません（配置図と取りちがえないようにするためです）。
     配置図が2枚あるときは、‹ › で切り替えられます。 */
  function collect(){
    var out = [];
    var L = qa('#layout-area .img-thumb img');
    for(var i = 0; i < L.length; i++){
      out.push({ src: L[i].getAttribute('src') || '',
                 label: '配置図' + (L.length > 1 ? ' ' + (i + 1) : '') });
    }
    return out.filter(function(s){ return !!s.src; });
  }

  function syncStage(){
    if(!on || !stage) return;
    var keep = shots[cur] ? shots[cur].src : '';
    shots = collect();

    cur = 0;
    for(var i = 0; i < shots.length; i++){ if(shots[i].src === keep){ cur = i; break; } }

    if(!shots.length){
      if(q('#layout-area .img-thumb-pdf')){
        stage.innerHTML = '<div class="pv-stage-pdf">配置図はPDFです<br>下の配置図欄から開いてください</div>';
      } else {
        stage.innerHTML = '<div class="pv-stage-none">配置図がまだ登録されていません。<br>下の「配置図」から追加できます。</div>';
      }
      if(hint) hint.style.display = 'none';
      if(pin) pin.style.display = 'none';
      if(stageNav) stageNav.style.display = 'none';
      return;
    }
    show();
  }

  function show(){
    var s = shots[cur]; if(!s) return;
    var img = q('img', stage);
    if(!img){
      stage.innerHTML = '<img alt="配置図">'; img = q('img', stage);
      stageImg = img; stagePinch = null;
    }
    if(img.getAttribute('src') !== s.src){
      img.setAttribute('src', s.src);
      if(stagePinch) stagePinch.reset();
    }
    /* 上に敷いた配置図も、2本指でつまんで大きくできるようにします。
       （いままでは、いちばん上まで上げて貼りつけた板でしか
         つまめませんでした） */
    if(!stagePinch && typeof window.PVPinch === 'function'){
      stageImg = img;
      stagePinch = window.PVPinch(img, { frame: stage });
    }

    if(pinImg && pinImg.getAttribute('src') !== s.src){
      pinImg.setAttribute('src', s.src);
      if(pinch) pinch.reset();
    }
    if(pinLabel) pinLabel.textContent = s.label;
    if(pin) pin.style.display = '';

    var many = shots.length > 1;
    if(pinPrev) pinPrev.style.display = many ? '' : 'none';
    if(pinNext) pinNext.style.display = many ? '' : 'none';
    if(stageNav){
      stageNav.style.display = many ? '' : 'none';
      if(stageNavLabel) stageNavLabel.textContent = (cur + 1) + ' / ' + shots.length;
    }
    if(hint) hint.style.display = '';
  }

  function step(d){
    if(shots.length < 2) return;
    cur = (cur + d + shots.length) % shots.length;
    show();
  }

  function layoutSrc(){ return shots[cur] ? shots[cur].src : ''; }

  function syncName(){
    var el = document.getElementById('f-name');
    curName = (el && el.value) ? el.value : '';
    syncGripLabel();
  }
  function syncGripLabel(){
    if(!on || !gripName) return;
    gripName.textContent = (SNAPS[idx] === 'full') ? '▼ 下げる' : curName;
  }

  /* ---------- 高さ ---------- */
  function h(name){ return Math.round(box.clientHeight * RATIO[name]); }

  function snap(name){
    var before = SNAPS[idx];
    idx = SNAPS.indexOf(name); if(idx < 0) idx = 1;
    modal.setAttribute('data-pv-snap', name);
    modal.style.setProperty('--pv-h', h(name) + 'px');
    syncGripLabel();
    /* 上の画面の高さが変わるので、つまんだ倍率はもとに戻します */
    if(before !== SNAPS[idx] && stagePinch) stagePinch.reset();
  }
  /* 人が動かしたとき。以後は勝手に上まで伸ばしません。 */
  function snapByHand(name){
    if(name !== 'full') userSnapped = true;
    snap(name);
  }

  /* ---------- つまみを指で引き上げる ---------- */
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

    var now = parseFloat(getComputedStyle(modal).getPropertyValue('--pv-h')) || h('half');
    var best = 'half', d = Infinity;
    SNAPS.forEach(function(n){ var dd = Math.abs(h(n) - now); if(dd < d){ d = dd; best = n; } });
    snapByHand(best);
  }
  /* つまみを軽くたたいたとき。
     いちばん上のときは下へ、それ以外は上へ。行ったり来たりできます。 */
  function onTap(){
    if(moved > 6){ moved = 0; return; }
    if(SNAPS[idx] === 'full') snapByHand('half');
    else snapByHand(SNAPS[Math.min(2, idx + 1)]);
  }
  function onKey(e){
    if(e.key === 'ArrowUp'){   e.preventDefault(); snapByHand(SNAPS[Math.min(2, idx + 1)]); }
    if(e.key === 'ArrowDown'){ e.preventDefault(); snapByHand(SNAPS[Math.max(0, idx - 1)]); }
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      if(SNAPS[idx] === 'full') snapByHand('half'); else snapByHand(SNAPS[Math.min(2, idx + 1)]);
    }
  }

  /* ---------- 中身をスクロールしたときの動き ----------
     ★2026-09-02：スクロールしても、シートを勝手に全画面へ伸ばさなくしました。

       これまでは、中身を少し下へ動かしただけで snap('full') が走り、
       シートがいちばん上まで伸びていました。
       全画面になると上の配置図の板（画面の約30%）が現れるため、
       「スクロールすると配置図が大きくなる」ように見えていました。

       いまは、指でシートの持ち手を上げたときだけ全画面になります。
       上げれば配置図の板は今までどおり出ます。
       戻したいときは、下の1行のコメントを外してください。 */
  function onBodyScroll(){
    if(!on || dragging || userSnapped) return;
    /* if(body.scrollTop > 6 && SNAPS[idx] !== 'full') snap('full'); */
  }

  /* ---------- 中身がいちばん上のときに下へなぞると、1段下げます（v5） ---------- */
  var bTrack = false, bStartY = 0;

  function onBodyDown(e){
    bTrack = false;
    if(!on || dragging) return;
    if(e.pointerType === 'mouse') return;
    if(pin && pin.contains(e.target)) return;   /* 貼りつけた配置図は、つまんで拡大する場所 */
    if(body.scrollTop > 2) return;
    bTrack = true; bStartY = e.clientY;
  }
  function onBodyMove(e){
    if(!bTrack) return;
    var dy = e.clientY - bStartY;
    if(dy < -4){ bTrack = false; return; }      /* 上へ動いたら、ふつうのスクロール */
    if(dy > 56){
      bTrack = false;
      if(idx > 0) snapByHand(SNAPS[idx - 1]);
    }
  }
  function onBodyEnd(){ bTrack = false; }

  /* ---------- 上の画像をタップして拡大（いまある機能をそのまま使います） ---------- */
  function onStageTap(e){
    /* 配置図「そのもの」を押したときだけ、全画面にします。
       まわりの黒いところは反応しません。
       （上の「×」を押そうとして、少し外れたときに
         全画面が開いてしまうのを防ぎます） */
    if(!e || !e.target || e.target.tagName !== 'IMG') return;
    /* つまんで大きくしている間は、指を離しても全画面に飛ばしません */
    if(stagePinch && stagePinch.zoomed()) return;
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

    // 物件を開いたときに、上の画像と物件名を映しなおします。
    // 「閉じている→開いた」の瞬間だけ動かします。
    // （つまみを動かすときにも #modal のクラスは変わるので、
    //   毎回動かすと、たたんだ配置図が勝手に開いてしまいます）
    var m = document.getElementById('modal');
    var wasActive = m ? m.classList.contains('active') : false;
    if(m && window.MutationObserver){
      new MutationObserver(function(){
        var nowActive = m.classList.contains('active');
        var opened = nowActive && !wasActive;
        wasActive = nowActive;
        if(!on) return;
        if(opened){
          userSnapped = false;
          cur = 0;
          /* たたんだままだと「配置図が出ない」と見えるので、開き直します */
          if(pin){
            pin.classList.remove('is-folded');
            var fb = q('#pv-pin-fold', pin);
            if(fb) fb.textContent = 'たたむ';
          }
          if(pinch) pinch.reset();
          snap('half'); syncStage(); syncName();
        }
      }).observe(m, { attributes:true, attributeFilter:['class'] });
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.PVMobileSheet = { refresh: refresh, sync: function(){ syncStage(); syncName(); } };
})();
