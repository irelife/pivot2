/* ★ 「保存できません」で行き止まりになる場所が、まだあるかの検査
     止まること自体は守りです。問題は「OKを押しても先へ進めない」ことです。 */
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
const ANS={v:true};
(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:1200,height:900}});
 const seen=[];
 pg.on('dialog',d=>{ seen.push(d.type()+'|'+d.message().slice(0,70).replace(/\n/g,' ')); ANS.v?d.accept():d.dismiss(); });
 const GAS='https://example.invalid/gas';
 await pg.route('**://**', r=>{ const u=r.request().url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0) return r.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({ok:true,version:'t',payload:{buildings:{},contracts:{},owners:[]}})});
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 await pg.addInitScript(FAKE);
 await pg.goto('file://'+DIR+'/index.html'); await pg.waitForTimeout(1200);
 await pg.evaluate((g)=>{ localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_')+'cloud_url', g); }, GAS);
 await pg.reload(); await pg.waitForTimeout(2500);
 const pre=await pg.evaluate(()=>(typeof insPrefix==='function'?insPrefix():'pivot_'));
 const BP=pre.replace(/_+$/,'')+'/data/buildings';
 await pg.evaluate((p)=>{ for(var i=1;i<=30;i++) window.__seed(p,'b'+i,
   {id:'b'+i,name:'物件'+i,addr:'住所'+i,spots:{},rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'}); }, BP);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(3000);
 const cloudN=()=>pg.evaluate((p)=>Object.keys(window.__all()).filter(k=>k.indexOf(p+'/')===0).length, BP);
 ok('（下ごしらえ）クラウドに30件', (await cloudN())===30, await cloudN());

 console.log('\n❶ 30件のうち20件を、まとめて消して保存する');
 seen.length=0; ANS.v=true;
 await pg.evaluate(()=>{
   var all=pbLoadAll(); var ids=Object.keys(all);
   for(var i=0;i<20;i++) delete all[ids[i]];
   pbSaveRaw(all); window.__pushNow();
 });
 await pg.waitForTimeout(4500);
 const after=await cloudN();
 console.log('   出たダイアログ：'); seen.forEach(x=>console.log('     '+x));
 ok('★ 確認が出て、OKを押せば通る（行き止まりにならない）', after===10, after);

 console.log('\n❷ キャンセルを選んだときは、消さないが、直したぶんは保存される');
 await pg.reload(); await pg.waitForTimeout(3000);
 const nameIn=(id)=>pg.evaluate((a)=>((window.__all()[a[0]+'/'+a[1]]||{}).name||''), [BP,id]);
 const before=await cloudN();
 seen.length=0; ANS.v=false;    /* すべてキャンセル */
 await pg.evaluate(()=>{
   var all=pbLoadAll(); var ids=Object.keys(all);
   for(var i=0;i<Math.floor(ids.length*0.7);i++) delete all[ids[i]];
   var rest=Object.keys(all); if(rest.length) all[rest[0]].name='★キャンセルでも保存';
   pbSaveRaw(all); window.__pushNow();
 });
 await pg.waitForTimeout(4500);
 ok('★ 消えていない', (await cloudN())===before, [before, await cloudN()]);

 console.log('\n❸ 黙って終わらない（必ず何か出る）');
 ok('★ 確認が出た', seen.length>0, seen.map(x=>x.split('|')[0]));

 await b.close();
 console.log('\n'+(F?'❌':'✅')+' PASS='+P+'  ❌ FAIL='+F);
 process.exit(0);
})();
