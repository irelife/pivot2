/* ★ 保存の道を軽くしたことで、壊れていないかの検査
     ・クラウドに正しく入るか
     ・控えのスプレッドシートに、ぜんぶの物件が送られるか
     ・ほかの端末の直しを消さないか
     ・続けて保存しても平気か
     ・ぶつかりは、ちゃんと見つかるか                            */
const fs=require('fs');
/* どこでも動くように：playwright があればそれを、無ければ playwright-core を使います */
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));   /* 相対パスで渡されても file:// が壊れないよう、必ず絶対パスに直します */
const FAKE=eval(fs.readFileSync(__dirname+'/tquota.cjs','utf8').match(/const FAKE = (`[\s\S]*?`);\n/)[1]);
let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };
const SENT=[];
(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:1200,height:900}});
 const DLG=[];
 pg.on('dialog',d=>{ DLG.push(d.message().slice(0,60).replace(/\n/g,' ')); d.dismiss(); });
 const LOG=[]; pg.on('console',m=>{ const t=m.text(); if(/\[D\]|\[E\]|\[S\]/.test(t)) LOG.push(t.slice(0,120)); });
 const GAS='https://example.invalid/gas';
 await pg.route('**://**', async r=>{ const u=r.request().url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0){
     let body=null; try{ body=JSON.parse(r.request().postData()||'null'); }catch(e){}
     if(body && body.action==='save') SENT.push(body);
     return r.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({ok:true,version:'t',payload:{buildings:{},contracts:{},owners:[]}})});
   }
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

 const nameIn=(id)=>pg.evaluate((a)=>((window.__all()[a[0]+'/'+a[1]]||{}).name||''), [BP,id]);

 console.log('\n❶ 1件直して保存');
 SENT.length=0;
 await pg.evaluate(()=>{ var all=pbLoadAll(); all['b5'].name='★なおした'; pbSaveRaw(all); window.__pushNow(); });
 await pg.waitForTimeout(3500);
 ok('★ クラウドに直しが入る', (await nameIn('b5'))==='★なおした', await nameIn('b5'));
 ok('★ 物件は30件のまま（消えていない）', (await cloudN())===30, await cloudN());
 const last=SENT[SENT.length-1];
 const sentN=last&&last.payload&&last.payload.buildings?Object.keys(last.payload.buildings).length:-1;
 ok('★ 控えの表へ、30件ぜんぶ送っている', sentN===30, sentN);
 ok('★ 控えの表へ送った中身に、直しが入っている',
    !!last && (last.payload.buildings['b5']||{}).name==='★なおした',
    last?(last.payload.buildings['b5']||{}).name:null);

 console.log('\n❷ ほかの端末が直した物件を、保存で消さない');
 await pg.evaluate((p)=>{ window.__set(p,'b9',{id:'b9',name:'ほかの端末が直した',addr:'住所9',spots:{},
   rev:2,updatedAt:'2026-09-30T00:00:00.000Z',updatedBy:'ほか'}); }, BP);
 SENT.length=0;
 await pg.evaluate(()=>{ var all=pbLoadAll(); all['b6'].name='★2つめ'; pbSaveRaw(all); window.__pushNow(); });
 await pg.waitForTimeout(3500);
 ok('★ ほかの端末の直しが、クラウドに残っている',
    (await nameIn('b9'))==='ほかの端末が直した', await nameIn('b9'));
 const last2=SENT[SENT.length-1];
 ok('★ 控えの表へ送った中身にも、ほかの端末の直しが入っている',
    !!last2 && (last2.payload.buildings['b9']||{}).name==='ほかの端末が直した',
    last2?(last2.payload.buildings['b9']||{}).name:null);
 ok('★ 30件のまま', (await cloudN())===30, await cloudN());

 console.log('\n❸ 続けて3回保存しても平気か');
 for(const [id,nm] of [['b1','あ'],['b2','い'],['b3','う']]){
   await pg.evaluate((a)=>{ var all=pbLoadAll(); all[a[0]].name=a[1]; pbSaveRaw(all); window.__pushNow(); }, [id,nm]);
   await pg.waitForTimeout(2500);
 }
 ok('★ 3件ぜんぶ入っている',
    (await nameIn('b1'))==='あ' && (await nameIn('b2'))==='い' && (await nameIn('b3'))==='う',
    [await nameIn('b1'), await nameIn('b2'), await nameIn('b3')]);
 ok('★ 30件のまま', (await cloudN())===30, await cloudN());

 console.log('\n❹ ぶつかりは、ちゃんと見つかる');
 LOG.length=0; DLG.length=0;
 /* クラウドの版番号だけを上げて、この端末の控えとずらします */
 await pg.evaluate((p)=>{ var d=window.__all()[p+'/b7']; d.rev=99; d.name='先に保存された';
   window.__set(p,'b7',d); }, BP);
 const cf=await pg.evaluate(async()=>{
   var all=pbLoadAll(); all['b7'].name='あとから上書き'; pbSaveRaw(all);
   var r=await window.postToGas(getCloudUrl(), { action:'save',
     payload:{ buildings:all, contracts:{}, owners:[] } }, 8000);
   return (r && r.error) || (r && r.ok ? 'とおった' : 'ふめい');
 });
 await pg.waitForTimeout(600);
 console.log('   --- ログ ---'); LOG.forEach(l=>console.log('     '+l));
 console.log('   控え: ' + JSON.stringify(await pg.evaluate((pre)=>{
   var f=JSON.parse(localStorage.getItem(pre+'fs_fpr')||'{}');
   var r=JSON.parse(localStorage.getItem(pre+'fs_rev')||'{}');
   return { b7の部品控え:(f['b7']? Object.keys(f['b7']).length : 'なし'),
            b7のname控え:(f['b7']? f['b7']['f:name'] : 'なし'),
            b7の版番号:r['b7'] };
 }, pre)));
 /* ★ 区画・欄ごとに送る形にしたので、ぶつかった部品だけが止まり、
      ほかはそのまま保存されます。呼び出しの戻り値は成功になりますが、
      ぶつかったことは画面でお知らせします。そこを確かめます。 */
 ok('★ ぶつかったことを、画面でお知らせする',
    DLG.some(x=>x.indexOf('先に保存')>=0), DLG);
 ok('★ ぶつかった欄は、上書きしない', (await nameIn('b7'))==='先に保存された', await nameIn('b7'));
 ok('★ 先に保存された内容が、消えていない', (await nameIn('b7'))==='先に保存された', await nameIn('b7'));

 await b.close();
 console.log('\n'+(F?'❌':'✅')+' PASS='+P+'  ❌ FAIL='+F);
 process.exit(F?1:0);
})();
