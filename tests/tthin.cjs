/* ★★ 層を減らす作業の、安全綱
 *
 *   js/core.js には、2026年前半に作った「粗い網」が34か所あります。
 *   いまは js/store.js に「細かい網」（書類1件ずつの版番号と指紋）が
 *   あるので、粗い網は要らないはずです。
 *   むしろ、細かい網の邪魔をします（9/16 に実際に起きました）。
 *
 *   撤去していく前に、粗い網が守ろうとしていた「中身」を
 *   ここに固定します。撤去してもこの検査が通るなら、
 *   守りは弱くなっていません。
 *
 *   ── 第1回で撤去するもの ──
 *   core.js の pvMissingFromLocal（⚠️ まだ取り込めていない物件があります）
 *
 *   守ろうとしていたこと：
 *     クラウドにあって、この端末が一度も持っていない物件を、
 *     この端末の保存で消してしまわないこと。
 *
 *   なぜ要らないか：
 *     store.js は書類を1件ずつ保存します。
 *     知らない物件は、そもそも触りません。消しようがありません。   */
const fs=require('fs');
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));
let FAKE=eval(fs.readFileSync(__dirname+'/tquota.cjs','utf8').match(/const FAKE = (`[\s\S]*?`);\n/)[1]);
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
 for(let i=1;i<=19;i++) SHEET.buildings['b'+i]={ id:'b'+i, name:'物件'+i, addr:'住所'+i,
   spots:{ '1':{no:'1',type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''} } };
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

 /* クラウドに19件。この端末は、この19件を知っています。
    ★ 種まきは「開き直したあと」にします。
      開き直しをまたぐと、にせクラウドの中身が残らないことがあり、
      検査がときどき落ちていました（土台の作り方の問題です）。 */
 await pg.reload(); await pg.waitForTimeout(3000);
 await pg.evaluate((p)=>{ for(var i=1;i<=19;i++){ var sp={};
   sp['1']={no:'1',type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''};
   window.__seed(p,'b'+i,{id:'b'+i,name:'物件'+i,addr:'住所'+i,spots:sp,
     rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'}); } }, BP);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} });
 await pg.waitForTimeout(8000);

 const nb   =()=>pg.evaluate(()=>{ try{ return Object.keys(pbLoadAll()||{}).length; }catch(e){ return -1; } });
 const cloud=(id)=>pg.evaluate((a)=>{ var d=window.__all()[a[0]+'/'+a[1]]; return d?(d.name||'名なし'):null; }, [BP,id]);

 console.log('\n❶ 下ごしらえ（この端末は19件を知っています）');
 ok('★ 手元に19件', (await nb())===19, await nb());

 console.log('\n❷ ★ ほかの人が、新しい物件をクラウドに作りました');
 /* この端末には知らせません（取り込ませません）。
    これが「クラウドにあって、この端末が一度も持っていない物件」です。 */
 await pg.evaluate((p)=>{ var sp={};
   sp['1']={no:'1',type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''};
   window.__seed(p,'bNEW',{id:'bNEW',name:'★ほかの人が作った物件',addr:'新住所',spots:sp,
     rev:1,updatedAt:'2026-09-10T00:00:00.000Z',updatedBy:'y'}); }, BP);
 ok('★ クラウドに、その物件がある', (await cloud('bNEW'))==='★ほかの人が作った物件', await cloud('bNEW'));
 ok('★ この端末は、それを持っていない', (await nb())===19, await nb());

 console.log('\n❸ ★★ その状態で、この端末が保存する');
 await pg.evaluate(()=>{ var a=pbLoadAll(); a['b1'].name='★この端末が直した'; pbSaveRaw(a);
   if(typeof window.__pushNow==='function') window.__pushNow(); });
 await pg.waitForTimeout(9000);

 ok('★★ ほかの人が作った物件が、消えていない',
    (await cloud('bNEW'))==='★ほかの人が作った物件', await cloud('bNEW'));
 ok('★ この端末の直しは、ちゃんと届いた',
    (await cloud('b1'))==='★この端末が直した', await cloud('b1'));

 console.log('\n❹ ★ 何度保存しても、消えない');
 for(let i=0;i<3;i++){
   await pg.evaluate((k)=>{ var a=pbLoadAll(); a['b2'].name='直し'+k; pbSaveRaw(a);
     if(typeof window.__pushNow==='function') window.__pushNow(); }, i);
   await pg.waitForTimeout(3500);
 }
 ok('★★ 3回保存しても、消えていない',
    (await cloud('bNEW'))==='★ほかの人が作った物件', await cloud('bNEW'));

 console.log('\n❺ ★ そのあと取り込めば、ちゃんと増える');
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} });
 await pg.waitForTimeout(7000);
 ok('★★ 取り込むと20件になる', (await nb())===20, await nb());

 console.log('\n❻ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);

 console.log('\nPASS='+P+'  FAIL='+F);
 await b.close();
 process.exit(F?1:0);
})();
