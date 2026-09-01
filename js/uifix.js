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
 *  ④ 区画を見るときに、上の配置図を「区画の並び」に寄せて大きくする
 *
 *  ・シートを下にスクロールし始めたら、上に貼りついている配置図を
 *    画面いっぱいに広げて、区画の番号が並んでいる場所を映します。
 *  ・場所は決め打ちではありません。画像を小さな下絵にして、
 *    「番号の札（黒・赤の小さな四角）」がまとまっている所を探します。
 *    下でも、右でも、真ん中でも見つけられます。
 *  ・札が見つからない画像（ふつうの図面や写真）では、何もしません。
 *  ・指でつまんで大きくしている間も、何もしません。
 * ============================================================ */
(function(){
  'use strict';

  var ON = 40;    // これだけ下にスクロールしたら大きくします（px）
  var OFF = 14;   // ここまで戻したら、元にもどします（px）
  var SW = 160;   // 下絵の幅（この大きさで札を探します）
  var cache = {}; // 画像ごとの結果を覚えておきます

  function pin(){ return document.getElementById('pv-pin'); }
  function pinImg(){ var p=pin(); return p ? p.querySelector('.pv-pin-view img') : null; }
  function body(){
    return document.querySelector('#modal.pv-ms #pv-sheet > .modal-body') ||
           document.querySelector('#pv-sheet > .modal-body');
  }
  function pinched(){
    var im=pinImg(); if(!im) return false;
    var t=im.style.transform||'';
    var m=t.match(/scale\(([\d.]+)\)/);
    return !!(m && parseFloat(m[1])>1.05);
  }
  function zoomOn(){ var p=pin(); return !!(p && p.classList.contains('ims-zoom')); }

  /* ---- 画像の中から「番号の札」を探して、その中心を返します ---- */
  function findTags(img){
    var key = img.currentSrc || img.src || '';
    if(!key) return null;
    if(Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
    var res = null;
    try{
      var iw=img.naturalWidth, ih=img.naturalHeight;
      if(!iw || !ih) return null;
      var sw=SW, sh=Math.max(1, Math.round(ih*sw/iw));
      var cv=document.createElement('canvas'); cv.width=sw; cv.height=sh;
      var cx=cv.getContext('2d', {willReadFrequently:true});
      cx.drawImage(img, 0, 0, sw, sh);
      var d=cx.getImageData(0,0,sw,sh).data;
      var n=sw*sh, mask=new Uint8Array(n), i, r, g, b, mx, mn;
      for(i=0;i<n;i++){
        r=d[i*4]; g=d[i*4+1]; b=d[i*4+2];
        mx=Math.max(r,g,b); mn=Math.min(r,g,b);
        // 黒い札 or 赤い札
        if((mx<60 && (mx-mn)<26) || (r>150 && g<90 && b<90)) mask[i]=1;
      }
      // つながっている固まりに分ける
      var seen=new Uint8Array(n), stack=[], blobs=[], p, x, y, x0,x1,y0,y1,area,q,nx,ny;
      for(i=0;i<n;i++){
        if(!mask[i] || seen[i]) continue;
        stack.length=0; stack.push(i); seen[i]=1;
        x0=x1=i%sw; y0=y1=(i/sw)|0; area=0;
        while(stack.length){
          p=stack.pop(); area++;
          x=p%sw; y=(p/sw)|0;
          if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
          nx=x-1; if(nx>=0){ q=p-1; if(mask[q]&&!seen[q]){seen[q]=1;stack.push(q);} }
          nx=x+1; if(nx<sw){ q=p+1; if(mask[q]&&!seen[q]){seen[q]=1;stack.push(q);} }
          ny=y-1; if(ny>=0){ q=p-sw; if(mask[q]&&!seen[q]){seen[q]=1;stack.push(q);} }
          ny=y+1; if(ny<sh){ q=p+sw; if(mask[q]&&!seen[q]){seen[q]=1;stack.push(q);} }
        }
        blobs.push({cx:(x0+x1)/2, cy:(y0+y1)/2, a:area, w:x1-x0+1, h:y1-y0+1});
      }
      // 札らしい大きさ・形のものだけ残す
      var good=[], t;
      for(i=0;i<blobs.length;i++){
        t=blobs[i];
        if(t.a >= n*0.0002 && t.a <= n*0.015){
          var ar=t.w/Math.max(1,t.h);
          if(ar>=0.3 && ar<=3.0) good.push(t);
        }
      }
      if(good.length>=4){
        // 大きさのそろったものだけにする（写真の影などを外します）
        var areas=good.map(function(o){return o.a;}).sort(function(a,b){return a-b;});
        var med=areas[(areas.length/2)|0];
        var same=good.filter(function(o){ return o.a>=med*0.6 && o.a<=med*1.7; });
        if(same.length>=4){
          var xs=same.map(function(o){return o.cx;}).sort(function(a,b){return a-b;});
          var ys=same.map(function(o){return o.cy;}).sort(function(a,b){return a-b;});
          res={ fx: xs[(xs.length/2)|0]/sw, fy: ys[(ys.length/2)|0]/sh };
        }
      }
    }catch(e){ res=null; }   // 画像が読めないときは、何もしません
    cache[key]=res;
    return res;
  }

  var curX = 0.5, curY = 0.5, ovX = 0, ovY = 0;   // いまの位置と、動かせる余地
  var escaped = false;                            // 自分で全体表示にもどしたか

  function setPos(img, x, y){
    curX = Math.max(0, Math.min(1, x));
    curY = Math.max(0, Math.min(1, y));
    img.style.objectPosition = (curX*100).toFixed(1)+'% '+(curY*100).toFixed(1)+'%';
  }

  function place(img, f){
    var box=img.getBoundingClientRect();
    var iw=img.naturalWidth, ih=img.naturalHeight;
    if(!iw||!ih||!box.width||!box.height) return;
    var s=Math.max(box.width/iw, box.height/ih);
    var dw=iw*s, dh=ih*s;
    ovX = Math.max(0, dw - box.width);
    ovY = Math.max(0, dh - box.height);
    var ox = ovX ? (f.fx*dw - box.width/2)  / ovX : 0.5;
    var oy = ovY ? (f.fy*dh - box.height/2) / ovY : 0.5;
    setPos(img, ox, oy);
  }

  /* ---- 大きくしている間は、指で上下左右に動かせるようにします ---- */
  function bindPan(){
    var img = pinImg();
    if(!img || img.__pvPan) return;
    img.__pvPan = true;
    var st = null;
    img.addEventListener('touchstart', function(e){
      if(!zoomOn() || pinched() || !e.touches || e.touches.length !== 1){ st=null; return; }
      var t = e.touches[0];
      st = { x:t.clientX, y:t.clientY, ox:curX, oy:curY };
    }, {passive:true});
    img.addEventListener('touchmove', function(e){
      if(!st || !zoomOn() || pinched() || !e.touches || e.touches.length !== 1) return;
      if(!ovX && !ovY) return;                     // 動かす余地が無ければ、そのままスクロール
      var t = e.touches[0];
      var dx = t.clientX - st.x, dy = t.clientY - st.y;
      var ny = ovY ? st.oy - dy/ovY : curY;
      /* いちばん上の端で、さらに下へ払ったとき → 全体表示にもどします（逃げ道） */
      if(ovY && ny < -0.06 && dy > 46){
        var p2 = pin();
        if(p2) p2.classList.remove('ims-zoom');
        img.style.objectPosition = '';
        escaped = true;          // いちばん上まで戻すまで、勝手に大きくしません
        st = null;
        return;
      }
      setPos(img,
        ovX ? st.ox - dx/ovX : curX,
        ny);
      try{ e.preventDefault(); }catch(err){}       // 指で動かしている間は、シートを動かしません
    }, {passive:false});
    img.addEventListener('touchend', function(){ st=null; }, {passive:true});
    img.addEventListener('touchcancel', function(){ st=null; }, {passive:true});
  }

  function update(){
    var p=pin(), b=body();
    if(!p||!b) return;
    var img=pinImg();
    if(!img || getComputedStyle(p).display==='none'){
      if(p) p.classList.remove('ims-zoom');
      return;
    }
    bindPan();
    var y=b.scrollTop||0;
    if(y>ON){
      if(escaped) return;                                 // 自分で戻したときは、そのまま
      if(zoomOn()) return;                                // すでに大きくしている（＝指で動かした位置を保ちます）
      if(pinched()) return;                               // 指でつまんでいる間は、切り替えません
      var f=findTags(img);
      if(!f){ p.classList.remove('ims-zoom'); return; }   // 札が無ければ、そのまま
      place(img, f);
      p.classList.add('ims-zoom');
    }else if(y<OFF){
      escaped = false;
      p.classList.remove('ims-zoom');
      img.style.objectPosition='';
    }
  }

  function boot(){
    document.addEventListener('scroll', update, {passive:true, capture:true});
    document.addEventListener('touchend', function(){ setTimeout(update,60); }, {passive:true, capture:true});
    window.addEventListener('resize', update);
    window.setInterval(update, 700);   // 画面が作り直されたときの取りこぼし防止
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.PVPinZoom = {
    update: update,
    find: function(){ var i=pinImg(); return i?findTags(i):null; },
    pos:  function(){ return { x:curX, y:curY, ovX:ovX, ovY:ovY }; }
  };
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
    put(rt, '#rent-view button[onclick="RENT.expandAll(true)"]',  'pvb-open');
    put(rt, '#rent-view button[onclick="RENT.expandAll(false)"]', 'pvb-close');
    put(rt, '#rent-btn-draft');
    put(rt, '#rent-btn-send');

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
