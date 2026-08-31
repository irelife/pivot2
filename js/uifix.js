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
    return t.indexOf('translate(')>=0 && t.indexOf('scale(1)')<0;
  }

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

  function place(img, f){
    var box=img.getBoundingClientRect();
    var iw=img.naturalWidth, ih=img.naturalHeight;
    if(!iw||!ih||!box.width||!box.height) return;
    var s=Math.max(box.width/iw, box.height/ih);
    var dw=iw*s, dh=ih*s;
    var ox = (dw>box.width)  ? (f.fx*dw - box.width/2)  / (dw-box.width)  : 0.5;
    var oy = (dh>box.height) ? (f.fy*dh - box.height/2) / (dh-box.height) : 0.5;
    ox=Math.max(0,Math.min(1,ox)); oy=Math.max(0,Math.min(1,oy));
    img.style.objectPosition = (ox*100).toFixed(1)+'% '+(oy*100).toFixed(1)+'%';
  }

  function update(){
    var p=pin(), b=body();
    if(!p||!b) return;
    var img=pinImg();
    if(!img || getComputedStyle(p).display==='none' || pinched()){
      if(p) p.classList.remove('ims-zoom');
      return;
    }
    var y=b.scrollTop||0;
    if(y>ON){
      var f=findTags(img);
      if(!f){ p.classList.remove('ims-zoom'); return; }   // 札が無ければ、そのまま
      place(img, f);
      p.classList.add('ims-zoom');
    }else if(y<OFF){
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

  window.PVPinZoom = { update: update, find: function(){ var i=pinImg(); return i?findTags(i):null; } };
})();
