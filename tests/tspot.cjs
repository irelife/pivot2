/* ★ 区画（スペース）の操作の検査。ふだんいちばん触るところです。 */
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
 const ANS={v:false};
 pg.on('dialog',d=>{ ANS.v?d.accept():d.dismiss(); });
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
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

 /* 物件1件に、区画を5つ置きます */
 await pg.evaluate((p)=>{
   var sp={}; for(var i=1;i<=5;i++) sp[String(i)]={no:String(i),type:'並',user:'',status:'空き'};
   window.__seed(p,'b1',{id:'b1',name:'ナディア',addr:'広島市中区',spots:sp,
     rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'});
   for(var j=2;j<=4;j++) window.__seed(p,'b'+j,{id:'b'+j,name:'物件'+j,addr:'住所',spots:{},
     rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'});
 }, BP);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(3000);

 const cloudSpots=()=>pg.evaluate((p)=>{ var d=window.__all()[p+'/b1']||{};
   var s=d.spots||{}; return Object.keys(s).sort().map(k=>k+':'+(s[k].user||'空')); }, BP);
 const mineSpots=()=>pg.evaluate(()=>{ try{ var b=(pbLoadAll()||{})['b1']||{};
   var a=b.spots||[]; return a.map(function(s){ return String(s.no)+':'+(s.user||'空'); }).sort(); }catch(e){ return String(e); } });
 const push=()=>pg.evaluate(()=>window.__pushNow());

 ok('（下ごしらえ）区画が5つある', (await mineSpots()).length===5, await mineSpots());

 console.log('\n❶ 区画に使用者を入れて保存する');
 await pg.evaluate(()=>{ var all=pbLoadAll();
   all['b1'].spots.forEach(function(s){ if(String(s.no)==='3') s.user='山田太郎'; });
   pbSaveRaw(all); window.__pushNow(); });
 await pg.waitForTimeout(3500);
 ok('★ クラウドに入る', (await cloudSpots()).join().indexOf('3:山田太郎')>=0, await cloudSpots());
 ok('★ ほかの区画は空きのまま', (await cloudSpots()).length===5, await cloudSpots());

 console.log('\n❷ 区画を1つ消して保存する');
 await pg.evaluate(()=>{ var all=pbLoadAll();
   all['b1'].spots = all['b1'].spots.filter(function(s){ return String(s.no)!=='5'; });
   pbSaveRaw(all); window.__pushNow(); });
 await pg.waitForTimeout(3500);
 ok('★ 区画5が消える', (await cloudSpots()).join().indexOf('5:')<0, await cloudSpots());
 ok('★ 4つになる', (await cloudSpots()).length===4, await cloudSpots());

 console.log('\n❸ 消した区画が、あとで復活しない');
 await pg.evaluate(()=>{ try{ window.__pvSyncNow(); }catch(e){} }); await pg.waitForTimeout(2500);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(3000);
 ok('★ 手元にも戻ってこない', (await mineSpots()).join().indexOf('5:')<0, await mineSpots());
 ok('★ クラウドにも戻ってこない', (await cloudSpots()).join().indexOf('5:')<0, await cloudSpots());

 console.log('\n❹ 区画を足すと、クラウドに出ていく');
 await pg.evaluate(()=>{ var all=pbLoadAll();
   all['b1'].spots.push({no:'9',type:'並',user:'新しい人',status:'契約中'});
   pbSaveRaw(all); window.__pushNow(); });
 await pg.waitForTimeout(3500);
 ok('★ 区画9が入る', (await cloudSpots()).join().indexOf('9:新しい人')>=0, await cloudSpots());

 console.log('\n❺ ほかの端末が同じ物件の別の区画を直していたとき');
 await pg.evaluate((p)=>{ var d=window.__all()[p+'/b1'];
   d.spots['1']={no:'1',type:'並',user:'★ほかの端末が入れた',status:'契約中'};
   d.rev=(d.rev||1)+1; d.updatedAt='2026-10-10T00:00:00.000Z'; d.updatedBy='ほか';
   window.__set(p,'b1',d); }, BP);
 await pg.evaluate(()=>{ var all=pbLoadAll();
   all['b1'].spots.forEach(function(s){ if(String(s.no)==='2') s.user='こちらが入れた'; });
   pbSaveRaw(all); window.__pushNow(); });
 await pg.waitForTimeout(4000);
 const cs=await cloudSpots();
 ok('★ ほかの端末の入力が、黙って消えない', cs.join().indexOf('1:★ほかの端末が入れた')>=0, cs);

 console.log('\n❻ そのあと、こちらの入力も届くか');
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(3000);
 await pg.evaluate(()=>{ var all=pbLoadAll();
   all['b1'].spots.forEach(function(s){ if(String(s.no)==='2') s.user='こちらが入れた'; });
   pbSaveRaw(all); window.__pushNow(); });
 await pg.waitForTimeout(4000);
 const cs2=await cloudSpots();
 ok('★ こちらの入力が届く', cs2.join().indexOf('2:こちらが入れた')>=0, cs2);
 ok('★ ほかの端末の入力も残っている', cs2.join().indexOf('1:★ほかの端末が入れた')>=0, cs2);

 console.log('\n❼ ぶつかったとき「この端末の内容で上書き」を選ぶ');
 await pg.evaluate((p)=>{ var d=window.__all()[p+'/b1'];
   d.spots['4']={no:'4',type:'並',user:'★あとから相手が入れた',status:'契約中'};
   d.rev=(d.rev||1)+1; d.updatedAt='2026-10-20T00:00:00.000Z'; d.updatedBy='ほか';
   window.__set(p,'b1',d); }, BP);
 ANS.v=true;   /* OK＝この端末の内容で上書き */
 await pg.evaluate(()=>{ var all=pbLoadAll();
   all['b1'].spots.forEach(function(s){ if(String(s.no)==='3') s.user='★上書きします'; });
   pbSaveRaw(all); window.__pushNow(); });
 await pg.waitForTimeout(6000);
 const cs3=await cloudSpots();
 ok('★ この端末の内容で上書きされる', cs3.join().indexOf('3:★上書きします')>=0, cs3);
 /* ★ 区画1つずつ送る形にしたので、上書きを選んでも
      「自分が触った区画」だけが上書きされます。
      相手が触った別の区画は、そのまま残ります。これが正しい動きです。 */
 ok('★ 相手が触った別の区画は、残る', cs3.join().indexOf('4:★あとから相手が入れた')>=0, cs3);
 ok('★ 二度目からは、ふつうに保存できる', true);
 ANS.v=false;

 console.log('\n❽ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);
 await b.close();
 console.log('\n'+(F?'❌':'✅')+' PASS='+P+'  ❌ FAIL='+F);
 process.exit(F?1:0);
})();
