/* ★ Firebase そのものが読み込めていないとき（v26）
 *   これまで： store.js がまるごと動かず、postToGas は素通し。
 *             クラウドを1度も見ないまま、控えの表へ直接書いていました。
 *   これから： 読むのは通す。書くのは全部止める。                      */
const fs=require('fs');
/* どこでも動くように：playwright があればそれを、無ければ playwright-core を使います */
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));   /* 相対パスで渡されても file:// が壊れないよう、必ず絶対パスに直します */
let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };

(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:1200,height:900}});
 const dlg=[]; pg.on('dialog',d=>{ dlg.push(d.message().slice(0,70).replace(/\n/g,' ')); d.accept(); });
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 const GAS='https://example.invalid/gas';
 const posts=[];
 await pg.route('**://**', r=>{ const q=r.request(); const u=q.url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0){
     let a='?'; try{ a=(JSON.parse(q.postData()||'{}').action)||'?'; }catch(e){}
     posts.push(a);
     return r.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({ok:true,version:'t',payload:{buildings:{},contracts:{},owners:[]}})});
   }
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 /* ★ Firebase を、わざと読み込めなくします（CDN がふさがれた状態） */
 await pg.addInitScript(()=>{ try{ delete window.firebase; }catch(e){}
   Object.defineProperty(window,'firebase',{ get:function(){ return undefined; },
                                             set:function(){}, configurable:true }); });
 await pg.goto('file://'+DIR+'/index.html'); await pg.waitForTimeout(1200);
 await pg.evaluate((g)=>{ localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_')+'cloud_url', g); }, GAS);
 await pg.reload(); await pg.waitForTimeout(3000);

 console.log('\n❶ Firebase が読み込めていないことの確認');
 ok('★ firebase が居ない', (await pg.evaluate(()=>typeof window.firebase))==='undefined');
 ok('★ postToGas はある', (await pg.evaluate(()=>typeof window.postToGas))==='function');

 console.log('\n❷ 書き込みは、ぜんぶ止まる');
 for(const act of ['save','saveBuildings','saveContractsOnly','saveOwnersOnly','deleteContract','uploadImage','deleteImage']){
   posts.length=0; dlg.length=0;
   const r=await pg.evaluate(async(a)=>{ try{ return await window.postToGas('https://example.invalid/gas',{action:a,payload:{buildings:{b1:{}}}}); }
                                         catch(e){ return {thrown:String(e)}; } }, act);
   ok('★ '+act+' は送られない',
      posts.filter(x=>x===act).length===0 && r && r.ok===false, [posts.slice(0,3), r]);
 }

 console.log('\n❸ 読み込みなどは、これまでどおり通る');
 posts.length=0;
 const rl=await pg.evaluate(async()=>{ try{ return await window.postToGas('https://example.invalid/gas',{action:'load'}); }catch(e){ return {thrown:String(e)}; } });
 ok('★ load は通る', posts.filter(x=>x==='load').length===1 && rl && rl.ok===true, [posts.slice(0,3), rl && rl.ok]);
 posts.length=0;
 await pg.evaluate(async()=>{ try{ return await window.postToGas('https://example.invalid/gas',{action:'ping'}); }catch(e){} });
 ok('★ ping も通る', posts.filter(x=>x==='ping').length===1, posts.slice(0,3));

 console.log('\n❹ 契約の削除も止まる（contracts.js から）');
 dlg.length=0; posts.length=0;
 /* 消す相手が手元にいないと、確認も出ないので、1件入れておきます */
 await pg.evaluate(()=>{ var k=(typeof insPrefix==='function'?insPrefix():'pivot_')+'contract_kanban_v2';
   localStorage.setItem(k, JSON.stringify({ cX:{ id:'cX', property:'ナディア', room:'101', contractor:'テスト' } })); });
 await pg.evaluate(()=>{ try{ window.KB.deleteFromDone(null,'cX'); }catch(e){} });
 await pg.waitForTimeout(2000);
 ok('★ 控えの表へ deleteContract が飛ばない',
    posts.filter(x=>x==='deleteContract').length===0, posts.slice(0,5));
 ok('★ 消せなかったことを、人に知らせる',
    dlg.filter(x=>x.indexOf('削除しませんでした')>=0).length>=1, dlg);

 console.log('\n❺ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);
 await b.close();
 console.log('\n'+(F?'❌':'✅')+' PASS='+P+'  ❌ FAIL='+F);
})();
