/* ★★ ロゴをタップしたとき（forcePullLatest）の検査
 *
 *   ロゴを押すと、届いた中身で手元をまるごと置き換えます。
 *   core.js の、ほかの3か所には守りがありますが、
 *   ロゴの1か所（core.js 824行目）だけ、素のままでした。
 *
 *   クラウドを確かめられないときは、1件も置き換えてはいけません。   */
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
FAKE = FAKE.replace(
  "  function snapOf(path, id, d){ return { id:id, exists:!!d, data:function(){ return d; } }; }",
  "  function snapOf(path, id, d){ if(window.__offline) d = null;\n" +
  "    return { id:id, exists:!!d, metadata:{ fromCache: !!window.__offline }, data:function(){ return d; } }; }");

let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };

(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:390,height:844}});
 const dlg=[]; pg.on('dialog',d=>{ dlg.push(d.message().slice(0,60).replace(/\n/g,' ')); d.dismiss(); });
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 const GAS='https://example.invalid/gas';
 /* 控えのスプレッドシートは「古いまま」です。物件1件・契約1件しかありません。
    実際にこうなります：クラウドに保存できたあと、控えへ送る途中で通信がこけた場合。 */
 /* ★ わざと「半分より上」の減り方にします（20件 → 12件、4割減）。
      これまでの守りは「半分より小さくなったら」なので、ここをすり抜けます。
      実際にいちばん起きやすいのも、この減り方です。                      */
 let SHEET={ buildings:{}, contracts:{}, owners:[] };
 for(let i=1;i<=12;i++){
   SHEET.buildings['b'+i] = { id:'b'+i, name:'物件'+i+'（古い控え）', addr:'住所'+i, spots:[] };
   SHEET.contracts['c'+i] = { id:'c'+i, property:'物件'+i, room:'101', contractor:'契約者'+i };
   SHEET.owners.push({ name:'オーナー'+i });
 }
 await pg.route('**://**', r=>{ const q=r.request(); const u=q.url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0)
     return r.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({ok:true,version:'t',payload:SHEET})});
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 await pg.addInitScript(FAKE);
 await pg.goto('file://'+DIR+'/index.html'); await pg.waitForTimeout(1200);
 await pg.evaluate((g)=>{ localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_')+'cloud_url', g); }, GAS);
 await pg.reload(); await pg.waitForTimeout(2500);

 const pre=await pg.evaluate(()=>(typeof insPrefix==='function'?insPrefix():'pivot_'));
 const BP=pre.replace(/_+$/,'')+'/data/buildings';
 const CT=pre.replace(/_+$/,'')+'/data/contracts';
 const LS=pre+'contract_kanban_v2';

 /* クラウドには、新しい内容が20件ぶんあります */
 await pg.evaluate((a)=>{ var i, sp;
   for(i=1;i<=20;i++){ sp={};
     sp['1']={no:'1',type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''};
     window.__seed(a[0],'b'+i,{id:'b'+i,name:'物件'+i,addr:'住所'+i,spots:sp,
       rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'}); }
   var at='2026-09-01T00:00:00.000Z';
   for(i=1;i<=20;i++) window.__seed(a[1],'c'+i,{id:'c'+i,property:'物件'+i,room:'101',
     contractor:'契約者'+i,rev:1,updatedAt2:at});
 }, [BP,CT]);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(4000);
 await pg.evaluate(()=>{ try{ return window.__pvSyncContracts(); }catch(e){} }); await pg.waitForTimeout(1500);

 const nb=()=>pg.evaluate(()=>{ try{ return Object.keys(pbLoadAll()||{}).length; }catch(e){ return -1; } });
 const nc=()=>pg.evaluate((k)=>{ try{ return Object.keys(JSON.parse(localStorage.getItem(k)||'{}')).length; }catch(e){ return -1; } }, LS);
 const bname=()=>pg.evaluate(()=>{ try{ return (pbLoadAll()['b1']||{}).name; }catch(e){ return String(e); } });
 const st=()=>pg.evaluate(()=>{ try{ var e=document.getElementById('sync-status');
   return e ? (e.textContent||'').trim().slice(0,40) : ''; }catch(e){ return ''; } });

 console.log('\n❶ 下ごしらえ（クラウドに20件。控えの表は古くて12件＝4割減）');
 ok('★ 手元に物件20件', (await nb())===20, await nb());
 ok('★ 手元に契約20件', (await nc())===20, await nc());
 ok('★ 物件名はクラウドのもの', (await bname())==='物件1', await bname());

 console.log('\n❷ ★ クラウドへ届かないまま、ロゴをタップする');
 await pg.evaluate((x)=>{ window.__offline=x; }, true);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} });
 await pg.waitForTimeout(5000);
 ok('★★ 物件が、古い控え（12件）に置き換わっていない', (await nb())===20, await nb());
 ok('★★ 契約も、古い控え（12件）に置き換わっていない', (await nc())===20, await nc());
 ok('★ 物件名も、古い控えのものになっていない', (await bname())==='物件1', await bname());
 ok('★ 「最新です」と嘘をつかない', (await st()).indexOf('最新')<0, await st());
 ok('★ 確かめられなかったことが、画面に出る',
    (await st()).indexOf('⚠')>=0 || (await st()).indexOf('確かめ')>=0, await st());

 console.log('\n❸ 何度タップしても、減らない');
 for(let i=0;i<3;i++){ await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(1500); }
 ok('★ 3回タップしても20件のまま', (await nb())===20 && (await nc())===20, [await nb(), await nc()]);

 console.log('\n❹ 電波が戻れば、ロゴはこれまでどおり効く');
 await pg.evaluate((x)=>{ window.__offline=x; }, false);
 /* ほかの端末が、物件1の名前を直したことにします */
 await pg.evaluate((p)=>{ var d=window.__all()[p+'/b1'];
   d.name='★ほかの端末が直した'; d.rev=(d.rev||1)+1; d.updatedAt=new Date().toISOString();
   window.__set(p,'b1',d); }, BP);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(5000);
 ok('★ ほかの端末の直しが、ちゃんと届く', (await bname())==='★ほかの端末が直した', await bname());
 ok('★ 件数も減っていない', (await nb())===20 && (await nc())===20, [await nb(), await nc()]);

 console.log('\n❺ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);
 await b.close();
 console.log('\n'+(F?'❌':'✅')+' PASS='+P+'  ❌ FAIL='+F);
})();
