/* ★ 中身が空の「契約」を送らせない（v28）
 *   2026/09/13：スマホが id と更新情報だけの契約を書き込み、
 *   クラウドの契約が空になりました。 */
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
(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:1200,height:900}});
 const dlg=[]; pg.on('dialog',d=>{ dlg.push(d.message().slice(0,60).replace(/\n/g,' ')); d.accept(); });
 const logs=[]; pg.on('console',m=>logs.push(String(m.text()).slice(0,120)));
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 await pg.route('**://**', r=>{ const u=r.request().url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0) return r.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({ok:true,version:'t',payload:{buildings:{},contracts:{},owners:[]}})});
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 await pg.addInitScript(FAKE);
 await pg.goto('file://'+DIR+'/index.html'); await pg.waitForTimeout(1200);
 await pg.evaluate((g)=>{ localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_')+'cloud_url', g); }, 'https://example.invalid/gas');
 await pg.reload(); await pg.waitForTimeout(2500);
 const pre=await pg.evaluate(()=>(typeof insPrefix==='function'?insPrefix():'pivot_'));
 const BP=pre.replace(/_+$/,'')+'/data/buildings', CT=pre.replace(/_+$/,'')+'/data/contracts';
 const LS=pre+'contract_kanban_v2';
 await pg.evaluate((a)=>{ var sp={'1':{no:'1',type:'並',tou:'',room:'',user:'借主',price:1,status:'使用中',note:''}};
   window.__seed(a[0],'b1',{id:'b1',name:'ナディア',addr:'広島市中区',spots:sp,rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'});
   for(var i=1;i<=5;i++) window.__seed(a[1],'c'+i,{id:'c'+i,property:'ナディア',room:'10'+i,
     contractor:'契約者'+i,rev:1,updatedAt2:'2026-09-01T00:00:00.000Z'});
 }, [BP,CT]);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(4000);
 await pg.evaluate(()=>{ try{ return window.__pvSyncContracts(); }catch(e){} }); await pg.waitForTimeout(1500);
 const cloud=()=>pg.evaluate((p)=>{ var o=window.__all(), out={}, k;
   for(k in o){ if(k.indexOf(p+'/')!==0) continue; var d=o[k];
     out[k.split('/').pop()]={ contractor:(d.contractor||''), property:(d.property||''), rev:d.rev }; }
   return out; }, CT);

 console.log('\n❶ はじめの状態（契約5件、中身あり）');
 const c0=await cloud();
 ok('★ 5件ある', Object.keys(c0).length===5, Object.keys(c0).length);
 ok('★ 契約者名が入っている', c0.c1.contractor==='契約者1', c0.c1);

 console.log('\n❷ ★ 契約が「id だけ」になった端末が保存する（9/13 のスマホと同じ状態）');
 dlg.length=0;
 await pg.evaluate((k)=>{ var m=JSON.parse(localStorage.getItem(k)||'{}'), out={}, id;
   for(id in m){ if(Object.prototype.hasOwnProperty.call(m,id)) out[id]={ id:id }; }
   localStorage.setItem(k, JSON.stringify(out));
   try{ window.__pushNow(); }catch(e){} }, LS);
 await pg.waitForTimeout(7000);
 const c1=await cloud();
 console.log('  保存後の c1 : ' + JSON.stringify(c1.c1));
 ok('★★ 契約者名が残っている', c1.c1.contractor==='契約者1', c1.c1.contractor);
 ok('★★ 物件名も残っている', c1.c1.property==='ナディア', c1.c1.property);
 ok('★ 件数も5件のまま', Object.keys(c1).length===5, Object.keys(c1).length);
 /* ★ 2026/9/16 まで、ここはポップアップを期待していました。
    でも「壊れた1件があると、保存を全部止めてポップアップ」は行き止まりでした。
    開き直しても端末の置き場に残るので直らず、同じ知らせが出続けて
    1件も保存できなくなります（実際に起きました）。
    いまは、壊れた1件だけを送らず、ほかは保存します。
    大事なのは「クラウドが守られること」で、そこは上の行で見ています。 */
 ok('★ 人に知らせている（止めずに知らせる）',
    logs.filter(x=>/中身が空の契約/.test(x)).length>0 || dlg.length>0,
    logs.slice(-3));

 console.log('\n❸ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);
 await b.close();
 console.log('\n'+(F?'❌ 穴があります':'✅ 守られています')+'  PASS='+P+'  FAIL='+F);
})();
