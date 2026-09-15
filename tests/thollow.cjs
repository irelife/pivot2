/* ★★ 中身だけが消える経路の再現
 *   件数は減らないので、いまの安全装置（半分以下で止める）は反応しません。 */
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
 const dlg=[]; pg.on('dialog',d=>{ dlg.push(d.message().slice(0,70).replace(/\n/g,' ')); d.accept(); });
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
 const BP=pre.replace(/_+$/,'')+'/data/buildings';

 /* クラウドに、中身のある物件を5件 */
 await pg.evaluate((p)=>{ for(var i=1;i<=5;i++){ var sp={};
   for(var j=1;j<=4;j++) sp[String(j)]={no:String(j),type:'並',tou:'',room:'',user:'借り主'+j,price:12000,status:'使用中',note:''};
   window.__seed(p,'b'+i,{id:'b'+i,name:'ナディア'+i,addr:'広島市中区'+i,spots:sp,
     rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'}); } }, BP);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(4000);

 const cloud=()=>pg.evaluate((p)=>{ var o=window.__all(), out={}, k;
   for(k in o){ if(k.indexOf(p+'/')!==0) continue; var d=o[k];
     out[k.split('/').pop()] = { name:(d.name||''), addr:(d.addr||''),
       spots:(d.spots?Object.keys(d.spots).length:0), rev:d.rev,
       keys:Object.keys(d).sort().join(',') }; }
   return out; }, BP);

 console.log('\n❶ はじめの状態（クラウドに、中身のある物件5件）');
 const c0=await cloud();
 ok('★ 5件ある', Object.keys(c0).length===5, Object.keys(c0).length);
 ok('★ 名前も区画も入っている', c0.b1.name==='ナディア1' && c0.b1.spots===4, c0.b1);

 console.log('\n❷ ★ 手元の物件が「中身なし」になった端末が、保存する');
 dlg.length=0;
 await pg.evaluate(()=>{ var all=pbLoadAll(), out={}, id;
   for(id in all){ if(!Object.prototype.hasOwnProperty.call(all,id)) continue;
     out[id] = { id:id, name:'', addr:'', spots:[] };   /* 中身だけ空。件数は5件のまま */ }
   pbSaveRaw(out); window.__pushNow(); });
 await pg.waitForTimeout(7000);
 const c1=await cloud();
 console.log('  保存後のクラウド b1 : ' + JSON.stringify(c1.b1));
 ok('★ 件数は5件のまま（だから件数の安全装置は効かない）', Object.keys(c1).length===5, Object.keys(c1).length);
 ok('★★ 名前が残っている', c1.b1.name==='ナディア1', c1.b1.name);
 ok('★★ 区画が残っている', c1.b1.spots===4, c1.b1.spots);
 ok('★ 人に確認が出た', dlg.length>0, dlg);

 console.log('\n❸ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);
 await b.close();
 console.log('\n'+(F?'❌ 穴があります':'✅ 守られています')+'  PASS='+P+'  FAIL='+F);
})();
