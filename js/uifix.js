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
 *  ④ 区画を見るときに、上の配置図を大きくする
 *
 *  シートを下にスクロールし始めたら、上に貼りついている配置図を
 *  画面いっぱいに広げて、下のほう（区画の並び）を映します。
 *  いちばん上に戻すと、元の「全体が入る」表示に戻ります。
 *  指でつまんで大きくしている間は、何もしません。
 * ============================================================ */
(function(){
  'use strict';

  var ON = 40;   // これだけ下にスクロールしたら、大きくします（px）
  var OFF = 14;  // ここまで戻したら、元にもどします（px）

  function pin(){ return document.getElementById('pv-pin'); }
  function pinImg(){
    var p = pin();
    return p ? p.querySelector('.pv-pin-view img') : null;
  }
  function body(){
    return document.querySelector('#modal.pv-ms #pv-sheet > .modal-body') ||
           document.querySelector('#pv-sheet > .modal-body');
  }
  /* 指でつまんで大きくしている最中か（mobilesheet 側が transform を入れます） */
  function pinched(){
    var im = pinImg();
    if(!im) return false;
    var t = im.style.transform || '';
    return t.indexOf('translate(') >= 0 && t.indexOf('scale(1)') < 0;
  }

  function update(){
    var p = pin(), b = body();
    if(!p || !b) return;
    if(getComputedStyle(p).display === 'none'){ p.classList.remove('ims-zoom'); return; }
    if(pinched()){ p.classList.remove('ims-zoom'); return; }
    var y = b.scrollTop || 0;
    if(y > ON) p.classList.add('ims-zoom');
    else if(y < OFF) p.classList.remove('ims-zoom');
  }

  function boot(){
    document.addEventListener('scroll', update, {passive:true, capture:true});
    document.addEventListener('touchend', function(){ setTimeout(update, 60); }, {passive:true, capture:true});
    window.setInterval(update, 700);   // 画面が作り直されたときの取りこぼし防止
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.PVPinZoom = { update: update };
})();
