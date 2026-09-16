/* ★ 未送信の札と、自動の送り直しの検査 */
const fs=require('fs');
/* どこでも動くように：playwright があればそれを、無ければ playwright-core を使います */
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));   /* 相対パスで渡されても file:// が壊れないよう、必ず絶対パスに直します */
let FAKE=eval(fs.readFileSync(__dirname+'/tquota.cjs','utf8').match(/const FAKE = (`[\s\S]*?`);\n/)[1]);
FAKE = FAKE.replace('var DB = { docs:{} };', [
  "var _raw=(function(){ try{ return JSON.parse(sessionStorage.getItem('__fakedb')||'{}'); }catch(e){ return {}; } })();",
  "var _save=function(){ try{ sessionStorage.setItem('__fakedb', JSON.stringify(_raw)); }catch(e){} };",
  "var DB = { docs: new Proxy(_raw, { set:function(t,k,v){ t[k]=v; _save(); return true; },",
  "  deleteProperty:function(t,k){ delete t[k]; _save(); return true; } }) };"].join('\n'));
let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };
const NET={up:true};
(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:1200,height:900}});
 pg.on('dialog',d=>d.dismiss());
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 const GAS='https://example.invalid/gas';
 await pg.route('**://**', r=>{ const u=r.request().url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0){
     if(!NET.up) return r.abort('failed');
     return r.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({ok:true,version:'t',payload:{buildings:{},contracts:{},owners:[]}})}); }
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 await pg.addInitScript(FAKE);
 await pg.goto('file://'+DIR+'/index.html'); await pg.waitForTimeout(1200);
 await pg.evaluate((g)=>{ localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_')+'cloud_url', g); }, GAS);
 await pg.reload(); await pg.waitForTimeout(2500);
 const pre=await pg.evaluate(()=>(typeof insPrefix==='function'?insPrefix():'pivot_'));
 const BP=pre.replace(/_+$/,'')+'/data/buildings';
 await pg.evaluate((p)=>{ for(var i=1;i<=10;i++) window.__seed(p,'b'+i,
   {id:'b'+i,name:'物件'+i,addr:'住所'+i,spots:{},rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'}); }, BP);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(3000);

 const badge=()=>pg.evaluate(()=>{ var e=document.getElementById('pv-unsent-badge');
   return e ? e.textContent : null; });
 const badgeBg=()=>pg.evaluate(()=>{ var e=document.getElementById('pv-unsent-badge');
   return e ? getComputedStyle(e).backgroundColor : null; });
 const saved=()=>pg.evaluate(()=>{ var e=document.getElementById('pv-saved-badge');
   return e ? e.textContent : null; });
 const nameIn=(id)=>pg.evaluate((a)=>((window.__all()[a[0]+'/'+a[1]]||{}).name||''), [BP,id]);
 const edit=(id,nm)=>pg.evaluate((a)=>{ var all=pbLoadAll(); all[a[0]].name=a[1]; pbSaveRaw(all);
   window.__pushNow(); }, [id,nm]);
 const fsDown=(on)=>pg.evaluate((v)=>{
   if(v){ if(window.__fsSaved) return; window.__fsSaved=window.firebase.firestore; var f=window.__fsSaved;
     var wrap=function(o){ var p={}; for(var k in o) p[k]=o[k];
       var bad=function(){ var e=new Error('unavailable'); e.code='unavailable'; return Promise.reject(e); };
       if(typeof o.get==='function') p.get=bad;
       if(typeof o.set==='function') p.set=bad;
       if(typeof o.collection==='function') p.collection=function(n){ return wrap(o.collection(n)); };
       if(typeof o.doc==='function') p.doc=function(n){ return wrap(o.doc(n)); };
       if(typeof o.where==='function') p.where=function(){ return wrap(o.where.apply(o,arguments)); };
       return p; };
     var db0=f();
     var nf=function(){ var w=wrap(db0);
       w.runTransaction=function(){ var e=new Error('unavailable'); e.code='unavailable'; return Promise.reject(e); };
       w.batch=function(){ return { set:function(){}, commit:function(){ var e=new Error('unavailable'); return Promise.reject(e); } }; };
       return w; };
     /* ★ FieldValue などの「おまけ」も、そのまま持っていきます */
     for(var kk in f){ if(Object.prototype.hasOwnProperty.call(f,kk)) nf[kk]=f[kk]; }
     window.firebase.firestore=nf;
   } else if(window.__fsSaved){ window.firebase.firestore=window.__fsSaved; window.__fsSaved=null; }
 }, on);

 console.log('\n❶ ふつうに保存できているときは、札は出ない');
 await edit('b1','ふつう'); await pg.waitForTimeout(3000);
 ok('★ 札が出ていない', (await badge())===null, await badge());

 console.log('\n❷ 一瞬の通信切れでは、何も出さない（静かに送り直す）');
 NET.up=false; await fsDown(true);
 await edit('b2','★オフライン'); await pg.waitForTimeout(3500);
 ok('★ すぐには札を出さない', (await badge())===null, await badge());
 const hd=await pg.evaluate(()=>{ var e=document.getElementById('sync-status');
   return e && e.style.display!=='none' ? e.textContent : null; });
 ok('★ ヘッダーには「保存中…」と出る', !!hd && hd.indexOf('保存中')>=0, hd);

 console.log('\n❷-2 長く送れないときだけ、小さな印を出す');
 /* 25秒待たずに済むよう、印を出す時刻だけ過去にずらします */
 await pg.evaluate(()=>{ var k=Object.keys(localStorage).filter(x=>/unsent$/.test(x))[0];
   var v=JSON.parse(localStorage.getItem(k)); v.from=Date.now()-120000;
   localStorage.setItem(k, JSON.stringify(v)); window.__pvUnsent.mark(v.kind); });
 await pg.waitForTimeout(600);
 const bd=await badge();
 ok('★ 印が出る', !!bd, bd);
 ok('★ 「未送信」とだけ書く', !!bd && bd.indexOf('未送信')>=0, bd);
 ok('★ 「保存できていません」とは書かない', !!bd && bd.indexOf('保存できていません')<0, bd);
 ok('★ 説明文を札の中に詰めこまない', !!bd && bd.length<16, bd);
 const bg=await badgeBg();
 ok('★ 赤ではない（静かな色）', bg!=='rgb(185, 28, 28)', bg);
 const box=await pg.evaluate(()=>{ var e=document.getElementById('pv-unsent-badge');
   if(!e) return null; var r=e.getBoundingClientRect();
   return { w:Math.round(r.width), h:Math.round(r.height), right:Math.round(innerWidth-r.right) }; });
 ok('★ 小さい（幅200px未満・高さ40px未満）', !!box && box.w<200 && box.h<40, box);
 ok('★ ＋ボタン（右下）に重ならない', !!box && box.right>120, box);

 console.log('\n❸ 画面を開き直しても、札は消えない（忘れない）');
 await pg.reload(); await pg.waitForTimeout(3500);
 ok('★ 札が残っている', !!(await badge()), await badge());

 console.log('\n❹ つながったら、自分から送り直す');
 NET.up=true; await fsDown(false);
 /* ヘッダーの表示は2秒で自動的に消えるので、出た瞬間を記録します */
 await pg.evaluate(()=>{ window.__hdSeen=[];
   var e=document.getElementById('sync-status');
   if(e) new MutationObserver(()=>{ var t=(e.textContent||'').trim();
     if(t && window.__hdSeen[window.__hdSeen.length-1]!==t) window.__hdSeen.push(t); })
     .observe(e,{childList:true,subtree:true,characterData:true}); });
 await pg.evaluate(()=>{ window.dispatchEvent(new Event('online')); });
 await pg.waitForTimeout(5000);
 ok('★ クラウドに届いている', (await nameIn('b2'))==='★オフライン', await nameIn('b2'));
 ok('★ 札が消える', (await badge())===null, await badge());
 const hd2=await pg.evaluate(()=>window.__hdSeen||[]);
 ok('★ ヘッダーに「保存しました」と出る',
    hd2.some(t=>t.indexOf('保存しました')>=0), hd2);
 const hdNow=await pg.evaluate(()=>{ var e=document.getElementById('sync-status');
   return e ? (e.textContent||'').trim() : null; });
 ok('★ その表示は、しばらくで自然に消える', hdNow==='', hdNow);

 console.log('\n❺ 札を押すと、その場で送り直す');
 NET.up=false; await fsDown(true);
 await edit('b3','★てで送り直す'); await pg.waitForTimeout(3500);
 await pg.evaluate(()=>{ var k=Object.keys(localStorage).filter(x=>/unsent$/.test(x))[0];
   var v=JSON.parse(localStorage.getItem(k)); v.from=Date.now()-120000;
   localStorage.setItem(k, JSON.stringify(v)); window.__pvUnsent.mark(v.kind); });
 await pg.waitForTimeout(600);
 ok('★ 印が出る', !!(await badge()), await badge());
 NET.up=true; await fsDown(false);
 await pg.evaluate(()=>{ var e=document.getElementById('pv-unsent-badge'); if(e) e.click(); });
 await pg.waitForTimeout(5000);
 ok('★ クラウドに届く', (await nameIn('b3'))==='★てで送り直す', await nameIn('b3'));
 ok('★ 札が消える', (await badge())===null, await badge());

 console.log('\n❻ 人が動かないと直らないものは、待たずにすぐ赤で出す');
 await pg.evaluate(()=>{ window.__pvUnsent.clear(); window.__pvUnsent.mark('local'); });
 await pg.waitForTimeout(400);
 const hb=await badge(), hbg=await badgeBg();
 ok('★ 待たずに すぐ出る', !!hb, hb);
 ok('★ 赤で出る', hbg==='rgb(185, 28, 28)', hbg);
 ok('★ 「保存できませんでした」と はっきり書く', !!hb && hb.indexOf('保存できませんでした')>=0, hb);
 await pg.evaluate(()=>{ window.__pvUnsent.clear(); });
 await pg.waitForTimeout(300);

 console.log('\n❼ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);
 await b.close();
 console.log('\n'+(F?'❌':'✅')+' PASS='+P+'  ❌ FAIL='+F);
 process.exit(F?1:0);
})();
