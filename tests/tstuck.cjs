/* ★★ 「控えが落ちているだけで、永久に保存できなくなる」の検査
 *
 *   物件の本体は Firestore です。
 *   スプレッドシート（GAS）は、そのあとに送る「控え」です。
 *
 *   ところが core.js は、保存の前に控えを読みに行き、
 *   読めなければ保存そのものを見送っていました。
 *   控えが落ちていると、Firestore がどれだけ元気でも
 *   その端末は永久に保存できません。送り直しも毎回そこで止まります。
 *
 *     2026/9/14〜15 … 22時間半
 *     2026/9/16     … 3時間59分（赤い札のまま消えない）
 *
 *   Firestore を読み込めているなら、進めてよいはずです。
 *   store.js の onSave のほうが、ずっと厳しく確かめています。       */
const fs=require('fs');
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));
let FAKE=eval(fs.readFileSync(__dirname+'/tquota.cjs','utf8').match(/const FAKE = (`[\s\S]*?`);\n/)[1]);
FAKE = "(function(){ try{ Object.defineProperty(window,'__offline',{" +
       "get:function(){ try{ return sessionStorage.getItem('__off')==='1'; }catch(e){ return false; } }," +
       "set:function(v){ try{ sessionStorage.setItem('__off', v?'1':'0'); }catch(e){} }}); }catch(e){} })();\n" + FAKE;
FAKE = FAKE.replace(
  "  function qs(arr){\n    return { size:arr.length, empty:arr.length===0,\n             forEach:function(f){ for(var i=0;i<arr.length;i++) f(arr[i]); } };\n  }",
  [ "  function qs(arr){",
    "    if(window.__offline){ arr = []; }",
    "    return { size:arr.length, empty:arr.length===0,",
    "             metadata:{ fromCache: !!window.__offline },",
    "             forEach:function(f){ for(var i=0;i<arr.length;i++) f(arr[i]); } };",
    "  }" ].join('\n'));
FAKE = FAKE.replace('var DB = { docs:{} };', [
  "var _raw=(function(){ try{ return JSON.parse(sessionStorage.getItem('__fakedb')||'{}'); }catch(e){ return {}; } })();",
  "var _save=function(){ try{ sessionStorage.setItem('__fakedb', JSON.stringify(_raw)); }catch(e){} };",
  "var DB = { docs: new Proxy(_raw, { set:function(t,k,v){ t[k]=v; _save(); return true; },",
  "  deleteProperty:function(t,k){ delete t[k]; _save(); return true; } }) };"].join('\n'));

let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };

(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:390,height:844}});
 pg.on('dialog',d=>d.dismiss());
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 const GAS='https://example.invalid/gas';

 const SHEET={ buildings:{}, contracts:{}, owners:[] };
 for(let i=1;i<=20;i++){
   SHEET.buildings['b'+i]={ id:'b'+i, name:'物件'+i, addr:'住所'+i,
     spots:{ '1':{no:'1',type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''} } };
 }
 let GASOK=true;
 await pg.route('**://**', r=>{ const u=r.request().url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0){
     if(!GASOK) return r.fulfill({status:500,contentType:'text/plain',body:'控えが落ちています'});
     return r.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({ok:true,version:'t',payload:SHEET})});
   }
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 await pg.addInitScript(FAKE);
 await pg.goto('file://'+DIR+'/index.html'); await pg.waitForTimeout(1200);
 await pg.evaluate((g)=>{ localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_')+'cloud_url', g); }, GAS);

 const pre=await pg.evaluate(()=>(typeof insPrefix==='function'?insPrefix():'pivot_'));
 const BP=pre.replace(/_+$/,'')+'/data/buildings';

 /* ★ 種まきは「開き直したあと」にします。
      開き直しをまたぐと、にせクラウドの中身が残らないことがあり、
      検査がときどき落ちていました（土台の作り方の問題です）。
      PIVOT3 側で、実際に落ちました。                               */
 await pg.reload(); await pg.waitForTimeout(3000);
 await pg.evaluate((p)=>{ for(var i=1;i<=20;i++){ var sp={};
   sp['1']={no:'1',type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''};
   window.__seed(p,'b'+i,{id:'b'+i,name:'物件'+i,addr:'住所'+i,spots:sp,
     rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'}); } }, BP);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} });
 await pg.waitForTimeout(8000);

 const loaded=()=>pg.evaluate(()=>{ try{ return window.__pvLoaded(); }catch(e){ return 'ない'; } });
 const cloudName=()=>pg.evaluate((p)=>{ try{ return (window.__all()[p+'/b1']||{}).name; }catch(e){ return String(e); } }, BP);
 const unsent=()=>pg.evaluate(()=>{ try{ var u=window.__pvUnsent.read(); return u?u.kind:null; }catch(e){ return 'ない'; } });

 console.log('\n❶ 下ごしらえ');
 ok('★ Firestore を読み込めている', (await loaded())===true, await loaded());
 ok('★ まだ未送信の札は無い', (await unsent())===null, await unsent());

 console.log('\n❷ ★ 控えのスプレッドシートを落とします（Firestore は元気なまま）');
 GASOK=false;
 /* 物件1の名前を直して、保存させます */
 await pg.evaluate(()=>{ try{ var a=pbLoadAll(); a['b1'].name='★直しました';
   pbSaveRaw(a); if(typeof window.__pushNow==='function') window.__pushNow(); }catch(e){} });
 await pg.waitForTimeout(9000);

 ok('★★ 控えが落ちていても、Firestore には保存できた',
    (await cloudName())==='★直しました', await cloudName());
 ok('★★ 未送信の札が残らない', (await unsent())===null, await unsent());

 console.log('\n❸ Firestore も読み込めていないときは、これまでどおり止めます');
 await pg.evaluate(()=>{ try{ window.__pvLoaded = function(){ return false; }; }catch(e){} });
 await pg.evaluate(()=>{ try{ var a=pbLoadAll(); a['b2'].name='★通ってはいけない';
   pbSaveRaw(a); if(typeof window.__pushNow==='function') window.__pushNow(); }catch(e){} });
 await pg.waitForTimeout(9000);
 ok('★★ クラウドは書き替わっていない',
    (await pg.evaluate((p)=>(window.__all()[p+'/b2']||{}).name, BP))==='物件2',
    await pg.evaluate((p)=>(window.__all()[p+'/b2']||{}).name, BP));
 ok('★ 未送信の札が出る（放っておかない）', (await unsent())!==null, await unsent());

 console.log('\n❹ ★ 何も編集していないのに「未送信」と言わない');
 /* 画面を開いたまま置いておくと、15分ごとに静かな読み直しが走ります。
    それがクラウドへ届かなくても、送るものが1つも無いなら
    「未送信」ではありません。出してはいけません。                 */
 await pg.evaluate(()=>{ try{ window.__pvUnsent.clear(); }catch(e){}
                         try{ _hasUnsavedChanges = false; }catch(e){} });
 await pg.evaluate(()=>{ try{ window.__pvLoaded = function(){ return true; }; }catch(e){} });
 await pg.evaluate((x)=>{ window.__offline=x; }, true);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} });
 await pg.waitForTimeout(6000);
 ok('★★ 何も編集していなければ、札は出ない', (await unsent())===null, await unsent());
 await pg.evaluate((x)=>{ window.__offline=x; }, false);

 console.log('\n❺ ★ 送るものが1件も無いなら、札は消える（出口）');
 /* 札が出る道は11本、消える道は「保存が成功したとき」の1本だけでした。
    送るものが無いときは保存が起きないので、永久に消えませんでした。   */
 /* ❸ で、わざと送れなかった直し（b2）を、元に戻しておきます。
    残したままだと「送るものが有る」ので、消えないのが正しくなります。 */
 await pg.evaluate(()=>{ try{ var a=pbLoadAll(); a['b2'].name='物件2'; pbSaveRaw(a); }catch(e){} });
 await pg.evaluate(()=>{ try{ window.__pvUnsent.mark('net'); }catch(e){} });
 ok('★ まず札を出しておく', (await unsent())==='net', await unsent());
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} });
 await pg.waitForTimeout(7000);
 ok('★★ 読み込めて、送るものが無ければ、札は消える', (await unsent())===null, await unsent());

 console.log('\n❻ ★ 送るものが有るときは、消さない');
 await pg.evaluate(()=>{ try{ var a=pbLoadAll(); a['b3'].name='★まだ送っていない直し';
   pbSaveRaw(a); window.__pvUnsent.mark('net'); }catch(e){} });
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} });
 await pg.waitForTimeout(7000);
 ok('★★ 送っていない直しがあるうちは、札を消さない', (await unsent())!==null, await unsent());

 console.log('\n❼ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);

 console.log('\nPASS='+P+'  FAIL='+F);
 await b.close();
 process.exit(F?1:0);
})();
