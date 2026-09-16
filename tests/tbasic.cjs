/* ★★ いちばん大事な3つの検査
 *
 *   A 保存できない（入力が消える・保存が通らない）
 *   B 前のデータに戻る
 *   C スマホとPCで情報が違う
 *
 *   ふだんの使いかたを、そのまま並べています。                   */
const fs=require('fs');
/* どこでも動くように：playwright があればそれを、無ければ playwright-core を使います */
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));   /* 相対パスで渡されても file:// が壊れないよう、必ず絶対パスに直します */
let FAKE=eval(fs.readFileSync(__dirname+'/tquota.cjs','utf8').match(/const FAKE = (`[\s\S]*?`);\n/)[1]);
/* にせのクラウドは、画面を開き直すと中身が消えてしまいます。
   本物のクラウドは消えないので、それに合わせて残るようにします。 */
FAKE = FAKE.replace('var DB = { docs:{} };', [
  "var _raw = (function(){ try{ return JSON.parse(sessionStorage.getItem('__fakedb')||'{}'); }catch(e){ return {}; } })();",
  "var _save = function(){ try{ sessionStorage.setItem('__fakedb', JSON.stringify(_raw)); }catch(e){} };",
  "var DB = { docs: new Proxy(_raw, {",
  "  set: function(t,k,v){ t[k]=v; _save(); return true; },",
  "  deleteProperty: function(t,k){ delete t[k]; _save(); return true; } }) };"
].join('\n'));
if(FAKE.indexOf('__fakedb') < 0){ console.error('にせクラウドの差し替えに失敗しました'); process.exit(2); }
let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };
const NET={up:true};
(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:1200,height:900}});
 pg.on('dialog',d=>d.dismiss());
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 const LOG=[]; pg.on('console',m=>{ const t=m.text(); if(/\[D\]|\[E\]|\[S\]|\[V\]/.test(t)) LOG.push(t.slice(0,130)); });
 const dump=(ttl)=>{ console.log('   --- ログ('+ttl+') ---'); LOG.forEach(l=>console.log('     '+l)); LOG.length=0; };
 const GAS='https://example.invalid/gas';
 await pg.route('**://**', r=>{ const u=r.request().url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0){
     if(!NET.up) return r.abort('failed');
     return r.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({ok:true,version:'t',payload:{buildings:{},contracts:{},owners:[]}})}); }
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 await pg.addInitScript(FAKE);
 await pg.goto('file://'+DIR+'/index.html'); await pg.waitForTimeout(1200);
 await pg.evaluate((g)=>{ localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_')+'cloud_url', g); }, GAS);
 await pg.reload(); await pg.waitForTimeout(2500);
 const pre=await pg.evaluate(()=>(typeof insPrefix==='function'?insPrefix():'pivot_'));
 const BP=pre.replace(/_+$/,'')+'/data/buildings';
 const MISC=pre.replace(/_+$/,'')+'/data/misc';
 const CP=pre.replace(/_+$/,'')+'/data/contracts';

 /* 物件30件・オーナー3人・契約5件を、クラウドに置きます */
 await pg.evaluate((a)=>{
   for(var i=1;i<=30;i++) window.__seed(a[0],'b'+i,{id:'b'+i,name:'物件'+i,addr:'住所'+i,spots:{},
     rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'});
   window.__seed(a[1],'owners',{list:[{name:'田中'},{name:'佐藤'},{name:'鈴木'}],rev:1});
   for(var j=1;j<=5;j++) window.__seed(a[2],'c'+j,{id:'c'+j,contractor:'契約'+j,
     rev:1,updatedAt2:'2026-09-01T00:00:00.000Z',updatedBy2:'x'});
 }, [BP,MISC,CP]);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(3000);

 const nameIn=(id)=>pg.evaluate((a)=>((window.__all()[a[0]+'/'+a[1]]||{}).name||''), [BP,id]);
 const mineName=(id)=>pg.evaluate((i)=>{ try{ return (pbLoadAll()[i]||{}).name||''; }catch(e){ return 'よめない'; } }, id);
 const cloudN=()=>pg.evaluate((p)=>Object.keys(window.__all()).filter(k=>k.indexOf(p+'/')===0).length, BP);
 const edit=(id,nm)=>pg.evaluate((a)=>{ var all=pbLoadAll(); all[a[0]].name=a[1]; pbSaveRaw(all);
   if(typeof window.__pushNow==='function') window.__pushNow(); }, [id,nm]);
 const fsDown=(on)=>pg.evaluate((v)=>{
   if(v){ if(window.__fsSaved) return; window.__fsSaved=window.firebase.firestore;
     var f=window.__fsSaved;
     var wrap=function(o){ var p={}; for(var k in o) p[k]=o[k];
       if(typeof o.get==='function') p.get=function(){ var e=new Error('resource-exhausted'); e.code='resource-exhausted'; return Promise.reject(e); };
       if(typeof o.collection==='function') p.collection=function(n){ return wrap(o.collection(n)); };
       if(typeof o.doc==='function') p.doc=function(n){ return wrap(o.doc(n)); };
       if(typeof o.where==='function') p.where=function(){ return wrap(o.where.apply(o,arguments)); };
       if(typeof o.set==='function') p.set=function(){ var e=new Error('resource-exhausted'); e.code='resource-exhausted'; return Promise.reject(e); };
       return p; };
     var nf=function(){ return wrap(f()); };
     /* ★ FieldValue などの「おまけ」も、そのまま持っていきます。
          落とすと realtime.js の呼び鈴が転びます（本物の SDK は持っています） */
     for(var kk in f){ if(Object.prototype.hasOwnProperty.call(f,kk)) nf[kk]=f[kk]; }
     window.firebase.firestore=nf;
     window.firebase.runTx=null;
   } else if(window.__fsSaved){ window.firebase.firestore=window.__fsSaved; window.__fsSaved=null; }
 }, on);

 console.log('\n══ A 保存できない ══');
 console.log('\nA1 ふつうに保存する');
 await edit('b5','★A1'); await pg.waitForTimeout(3000);
 ok('★ クラウドに入る', (await nameIn('b5'))==='★A1', await nameIn('b5'));
 ok('★ 物件は30件のまま', (await cloudN())===30, await cloudN());

 console.log('\nA2 通信が切れているときに入力する');
 NET.up=false; await fsDown(true);
 await edit('b6','★A2オフライン'); await pg.waitForTimeout(3000);
 ok('★ 入力した内容が、この端末に残っている', (await mineName('b6'))==='★A2オフライン', await mineName('b6'));

 console.log('\nA3 つながったら、保存が通る');
 NET.up=true; await fsDown(false);
 await edit('b6','★A3つながった'); await pg.waitForTimeout(3500);
 ok('★ クラウドに入る', (await nameIn('b6'))==='★A3つながった', await nameIn('b6'));

 console.log('\nA4 立て続けに5回保存する');
 for(const [id,nm] of [['b11','1'],['b12','2'],['b13','3'],['b14','4'],['b15','5']]){
   await edit(id,nm); await pg.waitForTimeout(1800);
 }
 await pg.waitForTimeout(2500);
 const five=[]; for(const id of ['b11','b12','b13','b14','b15']) five.push(await nameIn(id));
 ok('★ 5つぜんぶ入っている', five.join()==='1,2,3,4,5', five);
 ok('★ 物件は30件のまま', (await cloudN())===30, await cloudN());

 console.log('\n══ B 前のデータに戻る ══');
 console.log('\nB1 保存したあと、画面を開き直す');
 await edit('b20','★B1'); await pg.waitForTimeout(3000);
 await pg.reload(); await pg.waitForTimeout(3000);
 ok('★ 直しが残っている', (await mineName('b20'))==='★B1', await mineName('b20'));
 ok('★ クラウドにも残っている', (await nameIn('b20'))==='★B1', await nameIn('b20'));

 console.log('\nB2 触っていない物件を、保存で古い内容に戻さない');
 LOG.length=0;
 await pg.evaluate((p)=>{ window.__set(p,'b25',{id:'b25',name:'★ほかの人が直した',addr:'住所25',spots:{},
   rev:2,updatedAt:'2026-10-01T00:00:00.000Z',updatedBy:'ほか'}); }, BP);
 await edit('b26','★B2じぶん'); await pg.waitForTimeout(3500);
 ok('★ ほかの人の直しが残っている', (await nameIn('b25'))==='★ほかの人が直した', await nameIn('b25'));
 dump('B2');
 ok('★ じぶんの直しも入っている', (await nameIn('b26'))==='★B2じぶん', await nameIn('b26'));

 console.log('\nB3 通信が切れているあいだの直しが、消えない');
 NET.up=false; await fsDown(true);
 await edit('b27','★B3きえないで'); await pg.waitForTimeout(2500);
 NET.up=true; await fsDown(false);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(3500);
 ok('★ この端末に残っている', (await mineName('b27'))==='★B3きえないで', await mineName('b27'));

 console.log('\nB4 15分ごとの読み直しが、入力中の内容を上書きしない');
 await pg.evaluate(()=>{ var all=pbLoadAll(); all['b28'].name='★B4いま入力中'; pbSaveRaw(all); });
 await pg.evaluate((p)=>{ window.__set(p,'b28',{id:'b28',name:'クラウドの古い内容',addr:'住所28',spots:{},
   rev:9,updatedAt:'2026-10-02T00:00:00.000Z',updatedBy:'ほか'}); }, BP);
 await pg.evaluate(()=>{ try{ window.__pvSyncNow(); }catch(e){} }); await pg.waitForTimeout(2500);
 ok('★ 入力中の内容が消えない', (await mineName('b28'))==='★B4いま入力中', await mineName('b28'));

 console.log('\n══ C スマホとPCで情報が違う ══');
 console.log('\nC1 ほかの端末が直した物件が、開き直さずに出る');
 await pg.evaluate((p)=>{ window.__set(p,'b29',{id:'b29',name:'★C1スマホから',addr:'住所29',spots:{},
   rev:5,updatedAt:'2026-10-05T00:00:00.000Z',updatedBy:'スマホ'}); }, BP);
 await pg.evaluate(()=>{ try{ window.__pvSyncNow(); }catch(e){} }); await pg.waitForTimeout(2500);
 ok('★ 出てくる', (await mineName('b29'))==='★C1スマホから', await mineName('b29'));

 console.log('\nC2 ほかの端末が直したオーナーが、開き直さずに出る');
 await pg.evaluate((p)=>{ window.__set(p,'owners',{list:[{name:'田中'},{name:'佐藤'},{name:'鈴木'},{name:'★C2あたらしい人'}],rev:20}); }, MISC);
 await pg.evaluate(()=>{ try{ window.__pvSyncOwners(); }catch(e){} }); await pg.waitForTimeout(2000);
 const ow=await pg.evaluate((k)=>{ try{ return (JSON.parse(localStorage.getItem(k)||'[]')||[]).map(o=>o.name); }catch(e){ return String(e); } },
   pre+'rent_owner_send_owners_v1');
 ok('★ 出てくる', Array.isArray(ow)&&ow.join().indexOf('★C2あたらしい人')>=0, ow);

 console.log('\nC3 ほかの端末が入れた契約が、開き直さずに出る');
 await pg.evaluate((p)=>{ window.__seed(p,'c99',{id:'c99',contractor:'★C3あたらしい契約',
   rev:1,updatedAt2:'2026-10-06T00:00:00.000Z',updatedBy2:'スマホ'}); }, CP);
 await pg.evaluate(()=>{ try{ window.__pvSyncContracts(); }catch(e){} }); await pg.waitForTimeout(2000);
 const ct=await pg.evaluate((k)=>{ try{ var m=JSON.parse(localStorage.getItem(k)||'{}');
   return Object.keys(m).map(id=>m[id].contractor||''); }catch(e){ return String(e); } },
   pre+'contract_kanban_v2');
 ok('★ 出てくる', Array.isArray(ct)&&ct.join().indexOf('★C3あたらしい契約')>=0, ct);

 console.log('\nC4 じぶんの直しが、クラウドに出ていく（相手から見える）');
 LOG.length=0;
 await edit('b30','★C4PCから'); await pg.waitForTimeout(3500);
 ok('★ クラウドに出ている', (await nameIn('b30'))==='★C4PCから', await nameIn('b30'));
 dump('C4');

 console.log('\n画面のエラー: ' + (errs.length?errs.join(' / '):'なし'));
 ok('★ 画面のエラーなし', errs.length===0, errs);
 await b.close();
 console.log('\n'+(F?'❌':'✅')+' PASS='+P+'  ❌ FAIL='+F);
 process.exit(F?1:0);
})();
