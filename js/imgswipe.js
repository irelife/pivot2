/* ============================================================
 *  拡大画像を、左右スワイプで送る   imgswipe 2026-08-31a
 *
 *  ・配置図や現地写真を大きく開いたあと、いちいち閉じなくても
 *    指で左右に払うだけで、次の写真・前の写真に移れます。
 *  ・上の中央に「2 / 6」と、いま何枚目かを出します。
 *  ・パソコンでは ‹ › のボタンと、キーボードの ← → でも送れます。
 *  ・指2本で大きくしている間は、送らずにそのまま動かせます。
 *  ・PDFの配置図を開いているときは、何もしません。
 *
 *  いまある処理には一切さわっていません。
 *  openImgZoom / closeImgZoom を外側から包んでいるだけなので、
 *  元に戻すときは index.html のこの1行を消すだけです。
 * ============================================================ */
(function(){
  'use strict';

  var TH = 45;          // これだけ横に払ったら送ります（px）
  var DIR = 12;         // 横に払った、と判断する距離（px）
  var list = [];        // いま開いている物件の画像（上から順）
  var idx = -1;         // いま何枚目か
  var sx = 0, sy = 0, axis = 0, dragging = false, dx = 0;
  var swiped = 0;       // スワイプ直後のタップで閉じないための時刻
  var built = false;

  function q(id){ return document.getElementById(id); }
  /* 「img2.png」と「file:///…/img2.png」を同じものとして比べるために、
     どちらも完全な形にそろえます */
  function abs(u){
    u = String(u || '');
    if(!u) return '';
    if(u.indexOf('data:') === 0 || u.indexOf('blob:') === 0) return u;
    try{ var a = document.createElement('a'); a.href = u; return a.href; }catch(e){ return u; }
  }
  function box(){ return q('img-zoom'); }
  function target(){ return q('img-zoom-target'); }

  /* ---- いま画面にある画像を、上から順に集めます ---- */
  function collect(){
    var out = [], seen = {};
    var sel = ['#layout-area .img-thumb img', '#photos-area .img-thumb img'];
    for(var s = 0; s < sel.length; s++){
      var el = document.querySelectorAll(sel[s]);
      for(var i = 0; i < el.length; i++){
        var src = abs(el[i].src || el[i].getAttribute('src') || '');
        if(!src || seen[src]) continue;
        seen[src] = 1;
        out.push(src);
      }
    }
    return out;
  }

  /* ---- 画面の部品（枚数・左右ボタン）を1回だけ作ります ---- */
  function build(){
    if(built) return;
    var b = box();
    if(!b) return;
    built = true;

    var c = document.createElement('div');
    c.id = 'ims-count';
    b.appendChild(c);

    var p = document.createElement('button');
    p.id = 'ims-prev'; p.className = 'ims-arrow';
    p.type = 'button'; p.title = '前の写真'; p.innerHTML = '‹';
    p.addEventListener('click', function(e){ e.stopPropagation(); e.preventDefault(); go(-1); });

    var n = document.createElement('button');
    n.id = 'ims-next'; n.className = 'ims-arrow';
    n.type = 'button'; n.title = '次の写真'; n.innerHTML = '›';
    n.addEventListener('click', function(e){ e.stopPropagation(); e.preventDefault(); go(1); });

    b.appendChild(p);
    b.appendChild(n);

    b.addEventListener('touchstart', onStart, {passive:true});
    b.addEventListener('touchmove',  onMove,  {passive:false});
    b.addEventListener('touchend',   onEnd,   {passive:true});
    b.addEventListener('touchcancel',onEnd,   {passive:true});
  }

  function pdfOpen(){
    var f = q('img-zoom-pdf');
    return !!(f && f.style.display && f.style.display !== 'none');
  }

  /* ---- 指2本で大きくしている間は、送りません ---- */
  function zoomed(){
    var im = target();
    if(!im) return false;
    var t = im.style.transform || '';
    var m = t.match(/scale\(([\d.]+)\)/);
    return !!(m && parseFloat(m[1]) > 1.05);
  }

  function refresh(){
    var b = box(), c = q('ims-count');
    if(!b) return;
    var on = (list.length > 1) && !pdfOpen();
    b.classList.toggle('ims-on', on);
    if(c && on) c.textContent = (idx + 1) + ' / ' + list.length;
  }

  /* ---- ピンチの拡大を元に戻します（mobilesheet 側の後始末を呼びます） ---- */
  function resetPinch(){
    var b = box();
    if(!b) return;
    b.classList.add('ims-reset');
    b.classList.remove('ims-reset');
    var im = target();
    if(im) im.style.transform = '';
  }

  function go(d){
    if(list.length < 2) return;
    idx = (idx + d + list.length) % list.length;
    var im = target();
    resetPinch();
    if(im){ im.style.opacity = '0'; im.src = list[idx]; }
    window.setTimeout(function(){
      var i2 = target();
      if(i2) i2.style.opacity = '';
    }, 30);
    refresh();
  }

  function onStart(e){
    if(!e.touches || e.touches.length !== 1) { dragging = false; return; }
    if(list.length < 2 || pdfOpen() || zoomed()) { dragging = false; return; }
    var t = e.touches[0];
    sx = t.clientX; sy = t.clientY;
    axis = 0; dx = 0; dragging = true;
    var b = box(); if(b) b.classList.remove('ims-anim');
  }

  function onMove(e){
    if(!dragging || !e.touches || e.touches.length !== 1) return;
    if(zoomed()){ dragging = false; return; }
    var t = e.touches[0];
    var mx = t.clientX - sx, my = t.clientY - sy;
    if(axis === 0){
      if(Math.abs(my) > DIR && Math.abs(my) > Math.abs(mx)){ dragging = false; return; }
      if(Math.abs(mx) > DIR && Math.abs(mx) > Math.abs(my)){ axis = 1; }
      else return;
    }
    dx = mx;
    var im = target();
    if(im) im.style.transform = 'translateX(' + (dx * 0.55) + 'px)';
    try{ e.preventDefault(); }catch(err){}
  }

  function onEnd(){
    if(!dragging || axis !== 1){ dragging = false; axis = 0; return; }
    dragging = false;
    axis = 0;
    swiped = Date.now();
    var b = box(), im = target();
    if(b) b.classList.add('ims-anim');
    if(im) im.style.transform = '';
    if(dx <= -TH)      go(1);    // 左へ払う → 次
    else if(dx >= TH)  go(-1);   // 右へ払う → 前
    window.setTimeout(function(){ if(b) b.classList.remove('ims-anim'); }, 200);
    dx = 0;
  }

  function onKey(e){
    var b = box();
    if(!b || !b.classList.contains('active')) return;
    if(list.length < 2) return;
    if(e.key === 'ArrowRight'){ e.preventDefault(); go(1); }
    else if(e.key === 'ArrowLeft'){ e.preventDefault(); go(-1); }
  }

  /* ---- 今までの openImgZoom / closeImgZoom を包みます ---- */
  function wrap(){
    if(typeof window.openImgZoom === 'function' && !window.openImgZoom.__ims){
      var _open = window.openImgZoom;
      var open2 = function(src){
        _open(src);
        build();
        list = collect();
        idx = list.indexOf(abs(src));
        if(idx < 0 && src){ list = [abs(src)]; idx = 0; }
        refresh();
      };
      open2.__ims = true;
      window.openImgZoom = open2;
    }
    if(typeof window.openPdfZoom === 'function' && !window.openPdfZoom.__ims){
      var _pdf = window.openPdfZoom;
      var pdf2 = function(slot){
        _pdf(slot);
        list = []; idx = -1;
        refresh();
      };
      pdf2.__ims = true;
      window.openPdfZoom = pdf2;
    }
    if(typeof window.closeImgZoom === 'function' && !window.closeImgZoom.__ims){
      var _close = window.closeImgZoom;
      var close2 = function(ev){
        // 指で払った直後のタップでは閉じません
        if(Date.now() - swiped < 400) return;
        if(ev && ev.target && ev.target.className &&
           String(ev.target.className).indexOf('ims-arrow') >= 0) return;
        _close(ev);
        var b = box();
        if(b) b.classList.remove('ims-on', 'ims-anim');
        list = []; idx = -1;
      };
      close2.__ims = true;
      window.closeImgZoom = close2;
    }
  }

  function boot(){
    wrap();
    build();
    document.addEventListener('keydown', onKey);
    // 他のファイルが後から読み込まれても包めるように、少しあとにもう一度
    window.setTimeout(wrap, 800);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.IMS = { go: go, list: function(){ return list.slice(); }, index: function(){ return idx; } };
})();
