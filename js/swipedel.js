/* ============================================================
 *  左スワイプで削除   swipedel 2026-08-31a
 *
 *  ・スマホ幅（760px以下）のときだけ働きます。パソコンでは今まで通りです。
 *  ・物件カード（一覧）と契約カード（契約タブ）を、指で左へ引くと
 *    右から黒い「削除」が出ます。その「削除」を押すと消せます。
 *  ・消すときの確認（本当に削除しますか？）は、今までの処理を
 *    そのまま呼んでいるので、これまでと同じです。
 *  ・元に戻すときは index.html のこの1行を消すだけです。
 *    （中の処理には一切さわっていません）
 * ============================================================ */
(function(){
  'use strict';

  var OPEN_W   = 96;   // 開いたときに見える「削除」の幅（px）
  var OPEN_TH  = 40;   // ここまで引いたら、開いたままにします（px）
  var DIR_TH   = 12;   // 横に引いた、と判断する距離（px）
  var RUBBER   = 0.28; // OPEN_W より先は重くします

  var panel = null;              // 「削除」の面（1枚を使い回します）
  var card  = null;              // いま触っているカード
  var info  = null;              // 削除に使う情報 {kind,id}
  var base  = null;              // 触り始めたときのカードの位置
  var sx = 0, sy = 0, off = 0;   // 指の開始位置と、いまのずらし量
  var axis = 0;                  // 0=未確定 1=横 2=縦
  var opened = false;            // 「削除」が出たまま止まっているか
  var tracking = false;
  var swallow = 0;               // この時刻までのタップは、なかったことにします
  var gen = 0;                   // 何回目の操作か（前の後片づけが新しい操作を邪魔しないように）
  var radius = '14px';           // 「削除」の角の丸み（カードに合わせます）

  function mobile(){
    try{ return window.matchMedia('(max-width:760px)').matches; }
    catch(e){ return (window.innerWidth || 999) <= 760; }
  }

  /* ---- カードを探す ---- */
  function cardOf(t){
    for(var i = 0; t && t.nodeType === 1 && i < 12; i++, t = t.parentNode){
      if(t.classList && (t.classList.contains('bld-card') || t.classList.contains('ct-card'))) return t;
      if(t === document.body) break;
    }
    return null;
  }

  /* ---- そのカードの削除のしかたを、元のボタンから読み取ります ---- */
  function delInfoOf(el){
    if(!el) return null;
    var btn = el.querySelector('.bld-card-del, .ct-card-del');
    var oc  = btn ? (btn.getAttribute('onclick') || '') : '';
    var m;
    m = oc.match(/deleteBldFromList\(\s*'([^']+)'/);
    if(m) return { kind:'bld', id:m[1] };
    m = oc.match(/deleteCardContract\(\s*[^,]*,\s*'([^']+)'/);
    if(m) return { kind:'ct', id:m[1] };
    // 念のための予備（ボタンの書き方が変わったとき用）
    if(el.classList.contains('ct-card')){
      var id = el.getAttribute('data-id');
      if(id) return { kind:'ct', id:id };
    }
    if(el.classList.contains('bld-card')){
      var oc2 = el.getAttribute('onclick') || '';
      var m2 = oc2.match(/openModal\(\s*'([^']+)'/);
      if(m2) return { kind:'bld', id:m2[1] };
    }
    return null;
  }

  /* ---- 「削除」の面をつくります ---- */
  function makePanel(){
    if(panel) return panel;
    panel = document.createElement('div');
    panel.id = 'swd-panel';
    panel.innerHTML = '<span class="swd-ico">🗑</span><span class="swd-txt">削除</span>';
    document.body.appendChild(panel);

    var px = 0, py = 0, pmoved = false;
    panel.addEventListener('touchstart', function(e){
      var t = e.touches && e.touches[0]; if(!t) return;
      px = t.clientX; py = t.clientY; pmoved = false;
      panel.classList.add('swd-press');
      e.stopPropagation();
    }, {passive:true});
    panel.addEventListener('touchmove', function(e){
      var t = e.touches && e.touches[0]; if(!t) return;
      if(Math.abs(t.clientX - px) > 10 || Math.abs(t.clientY - py) > 10){
        pmoved = true; panel.classList.remove('swd-press');
      }
    }, {passive:true});
    panel.addEventListener('touchend', function(e){
      panel.classList.remove('swd-press');
      e.stopPropagation();
      try{ e.preventDefault(); }catch(_){}   // このあとのタップを出さない
      if(!pmoved) fire();
    }, {passive:false});
    panel.addEventListener('click', function(e){
      e.stopPropagation();
      try{ e.preventDefault(); }catch(_){}
      if(!('ontouchstart' in window)) fire();  // 指のない端末むけ
    }, true);
    return panel;
  }

  function placePanel(w, anim){
    if(!panel || !base) return;
    if(w < 0) w = 0;
    panel.classList.toggle('swd-anim', !!anim);
    panel.style.top    = base.top + 'px';
    panel.style.height = base.height + 'px';
    panel.style.left   = (base.right - w) + 'px';
    panel.style.width  = w + 'px';
    panel.style.borderRadius = '0 ' + radius + ' ' + radius + ' 0';
    panel.classList.add('on');
  }

  function hidePanel(){
    if(!panel) return;
    panel.classList.remove('on','swd-anim','swd-press');
    panel.style.width = '0px';
  }

  function setOff(v, anim){
    if(!card) return;
    card.classList.toggle('swd-anim', !!anim);
    card.classList.toggle('swd-drag', !anim);
    card.style.transform = v ? ('translateX(' + (-v) + 'px)') : '';
  }

  /* ---- 閉じる ---- */
  function close(now){
    var c = card, p = panel, myGen = ++gen;
    opened = false; tracking = false; axis = 0;
    if(!c){ hidePanel(); card = null; info = null; base = null; return; }
    if(now){
      c.classList.remove('swd-card','swd-drag','swd-anim');
      c.style.transform = '';
      hidePanel();
    }else{
      setOff(0, true);
      placePanel(0, true);
      window.setTimeout(function(){
        if(c !== card){                       // もう別のカードを触っている → 前のカードだけ片づけます
          c.classList.remove('swd-card','swd-drag','swd-anim');
          c.style.transform = '';
          return;
        }
        if(myGen !== gen) return;             // 同じカードで新しい操作が始まっている → さわりません
        c.classList.remove('swd-card','swd-drag','swd-anim');
        c.style.transform = '';
        if(p) p.classList.remove('on','swd-anim');
      }, 210);
    }
    off = 0;
    if(now){ card = null; info = null; base = null; }
  }

  /* ---- 実際に削除します（今までの処理をそのまま呼びます） ---- */
  function fire(){
    var target = info;
    close(true);
    if(!target) return;
    window.setTimeout(function(){
      try{
        if(target.kind === 'bld' && typeof window.deleteBldFromList === 'function'){
          window.deleteBldFromList(target.id);
        }else if(target.kind === 'ct' && window.KB && typeof window.KB.deleteCardContract === 'function'){
          window.KB.deleteCardContract(null, target.id);
        }
      }catch(err){}
    }, 10);
  }

  /* ---- 指の動き ---- */
  function onStart(e){
    if(!mobile()) return;
    var t = e.touches && e.touches[0]; if(!t) return;
    var hit = cardOf(e.target);

    if(opened){                       // 開いているときは、まず閉じます
      swallow = Date.now() + 700;     // 閉じるためのタップで、カードを開かない
      if(hit === card){ close(false); return; }
      close(false);
    }
    if(!hit) return;
    var di = delInfoOf(hit);
    if(!di) return;                   // 削除ボタンのないカードは、さわりません

    gen++;
    card = hit; info = di;
    base = hit.getBoundingClientRect();
    try{
      var br = window.getComputedStyle(hit).borderTopRightRadius;
      radius = (br && parseFloat(br) > 0) ? br : '14px';
    }catch(e){ radius = '14px'; }
    sx = t.clientX; sy = t.clientY;
    off = 0; axis = 0; tracking = true;
  }

  function onMove(e){
    if(!tracking || !card) return;
    var t = e.touches && e.touches[0]; if(!t) return;
    var mx = t.clientX - sx, my = t.clientY - sy;

    if(axis === 0){
      if(Math.abs(my) > DIR_TH && Math.abs(my) > Math.abs(mx)){ axis = 2; tracking = false; return; }
      if(Math.abs(mx) > DIR_TH && Math.abs(mx) > Math.abs(my)){
        axis = 1;
        makePanel();
        card.classList.add('swd-card');
      }else{
        return;
      }
    }
    if(axis !== 1) return;

    var d = -mx;                                  // 左へ引いた量
    if(d < 0) d = 0;
    if(d > OPEN_W) d = OPEN_W + (d - OPEN_W) * RUBBER;
    off = d;
    setOff(d, false);
    placePanel(d, false);
    try{ e.preventDefault(); }catch(_){}           // 横に引く間は縦スクロールを止めます
  }

  function onEnd(){
    if(!card){ tracking = false; return; }
    if(axis !== 1){ tracking = false; axis = 0; return; }
    tracking = false;
    swallow = Date.now() + 700;       // スワイプのあとのタップで、カードを開かない
    if(off >= OPEN_TH){
      opened = true;
      off = OPEN_W;
      setOff(OPEN_W, true);
      placePanel(OPEN_W, true);
    }else{
      close(false);
    }
  }

  /* ---- 取り付け ---- */
  function onClickCapture(e){
    if(Date.now() > swallow) return;
    if(panel && (e.target === panel || (panel.contains && panel.contains(e.target)))) return;
    if(!cardOf(e.target)) return;
    swallow = 0;
    e.stopPropagation();
    try{ e.preventDefault(); }catch(_){}
  }

  function boot(){
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('touchstart', onStart, {passive:true, capture:true});
    document.addEventListener('touchmove',  onMove,  {passive:false, capture:true});
    document.addEventListener('touchend',   onEnd,   {passive:true, capture:true});
    document.addEventListener('touchcancel',function(){ if(card && !opened) close(true); }, {passive:true, capture:true});
    document.addEventListener('scroll', function(){ if(opened) close(true); }, {passive:true, capture:true});
    window.addEventListener('resize', function(){ if(card) close(true); });
    window.addEventListener('orientationchange', function(){ if(card) close(true); });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }

  window.SWD = { close: function(){ close(true); } };
})();
