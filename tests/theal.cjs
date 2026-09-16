/* ★★ 中身が空になった手元のデータが、クラウドから戻るかの検査
 *
 *   2026/9/16 23:31、PIVOT2 の契約 215件すべてが
 *     （物件未入力）（契約者未入力）
 *   になりました。手元の置き場が壊れた形です。
 *
 *   クラウドは無事でした（空のものは、もともと送らない作りのため）。
 *   ところが、開き直しても戻りませんでした。
 *
 *   adoptCts が「指紋がちがう＝この端末の新しい直し」と読んで、
 *   壊れたほうを残していたからです。
 *   壊れは直しではありません。クラウドを取るのが正しい。         */
const fs=require('fs');
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));
let FAKE=eval(fs.readFileSync(__dirname+'/tquota.cjs','utf8').match(/const FAKE = (`[\s\S]*?`);\n/)[1]);

let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };

(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:390,height:844}});
 pg.on('dialog',d=>d.dismiss());
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 const GAS='https://example.invalid/gas';
 const SHEET={ buildings:{}, contracts:{}, owners:[] };
 for(let i=1;i<=10;i++){
   SHEET.buildings['b'+i]={ id:'b'+i, name:'物件'+i, addr:'住所'+i,
     spots:{ '1':{no:'1',type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''} } };
   SHEET.contracts['c'+i]={ id:'c'+i, property:'物件'+i, room:'101', contractor:'契約者'+i };
 }
 await pg.route('**://**', r=>{ const u=r.request().url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0)
     return r.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({ok:true,version:'t',payload:SHEET})});
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 await pg.addInitScript(FAKE);
 await pg.goto('file://'+DIR+'/index.html'); await pg.waitForTimeout(1200);
 await pg.evaluate((g)=>{ localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_')+'cloud_url', g); }, GAS);

 const pre=await pg.evaluate(()=>(typeof insPrefix==='function'?insPrefix():'pivot_'));
 const BP=pre.replace(/_+$/,'')+'/data/buildings';
 const CT=pre.replace(/_+$/,'')+'/data/contracts';
 const CTK= pre+'contract_kanban_v2';

 await pg.reload(); await pg.waitForTimeout(3000);
 await pg.evaluate((a)=>{ var i, sp;
   for(i=1;i<=10;i++){ sp={};
     sp['1']={no:'1',type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''};
     window.__seed(a[0],'b'+i,{id:'b'+i,name:'物件'+i,addr:'住所'+i,spots:sp,
       rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'});
     window.__seed(a[1],'c'+i,{id:'c'+i,property:'物件'+i,room:'101',
       contractor:'契約者'+i,rev:1,updatedAt2:'2026-09-01T00:00:00.000Z'}); } }, [BP,CT]);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} });
 await pg.waitForTimeout(8000);
 await pg.evaluate(()=>{ try{ window.__pvSyncContracts(); }catch(e){} });
 await pg.waitForTimeout(3000);

 const ctN =()=>pg.evaluate((k)=>{ try{ return Object.keys(JSON.parse(localStorage.getItem(k)||'{}')).length; }catch(e){ return -1; } }, CTK);
 const ctOK=()=>pg.evaluate((k)=>{ try{ var m=JSON.parse(localStorage.getItem(k)||'{}'), n=0, i;
   for(i in m){ if(m[i] && typeof m[i]==='object' && m[i].contractor) n++; } return n; }catch(e){ return -1; } }, CTK);
 const bOK =()=>pg.evaluate(()=>{ try{ var a=pbLoadAll(), n=0, i;
   for(i in a){ if(a[i] && typeof a[i]==='object' && a[i].name) n++; } return n; }catch(e){ return -1; } });

 console.log('\n❶ 下ごしらえ');
 ok('★ 契約10件が、中身つきで入っている', (await ctOK())===10, [await ctN(), await ctOK()]);
 ok('★ 物件10件も、中身つき', (await bOK())===10, await bOK());

 console.log('\n❷ ★ 手元の契約と物件を、まるごと空にします（9/16 に起きた形）');
 await pg.evaluate((k)=>{
   var m={}; try{ m=JSON.parse(localStorage.getItem(k)||'{}'); }catch(e){}
   var o={}, i; for(i in m) o[i] = 1;            /* 中身だけ消えた形 */
   localStorage.setItem(k, JSON.stringify(o));
   var a={}; try{ a=pbLoadAll()||{}; }catch(e){}
   var ob={}, j; for(j in a) ob[j] = { id:j, name:'', addr:'', spots:{} };
   pbSaveRaw(ob);
 }, CTK);
 ok('★ 契約の中身が、全部なくなった', (await ctOK())===0, await ctOK());
 ok('★ 件数だけは残っている', (await ctN())===10, await ctN());
 ok('★ 物件の中身も、なくなった', (await bOK())===0, await bOK());

 console.log('\n❸ ★★ 開き直すと、クラウドから戻るか');
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} });
 await pg.waitForTimeout(8000);
 await pg.evaluate(()=>{ try{ window.__pvSyncContracts(); }catch(e){} });
 await pg.waitForTimeout(4000);
 ok('★★ 契約10件が、中身ごと戻った', (await ctOK())===10, [await ctN(), await ctOK()]);
 ok('★★ 物件10件も、中身ごと戻った', (await bOK())===10, await bOK());

 console.log('\n❹ ★ クラウドは、空で上書きされていない');
 const cc = await pg.evaluate((p)=>{ var all=window.__all(), n=0, k;
   for(k in all){ if(k.indexOf(p+'/')===0 && all[k] && all[k].contractor) n++; } return n; }, CT);
 ok('★★ クラウドの契約10件は無事', cc===10, cc);

 console.log('\n❺ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);

 console.log('\nPASS='+P+'  FAIL='+F);
 await b.close();
 process.exit(F?1:0);
})();
