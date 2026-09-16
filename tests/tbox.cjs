/* ★★ 「件数を見るための から箱」の検査
 *
 *   保存の前に、こう確かめています。
 *     「手元の件数が、クラウドの件数の半分より少なくないか」
 *   件数を知るだけなら、物件をぜんぶ読む必要はありません。
 *   そこで store.js は、控えの一覧から
 *     { 物件ID:1, 物件ID:1, … }
 *   という「から箱」を作って、件数だけ答えていました。
 *
 *   ところが、ロゴの「最新を取り込む」は送信を3秒しか待たず、
 *   終わっていなくても先へ進みます。そこへ から箱 が届くと、
 *   あれは届いた中身を、そのまま手元へ書きます。
 *     ・物件 … uifix.js が「区画0／配置図0 が届きました」と聞いてくる
 *     ・契約 … 見張りが無いので、手元の契約がから箱に置き換わる
 *
 *   もうひとつ。GAS（控えのスプレッドシート）が失敗すると、
 *   store.js は __fsPrimary（Firestore が正、という旗）を立てる前に
 *   引き返していました。旗が無い端末では uifix.js の古い合体が動き、
 *   上の確認が出てしまいます。
 *
 *   この検査は、その3つを見張ります。                              */
const fs=require('fs');
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));
let FAKE=eval(fs.readFileSync(__dirname+'/tquota.cjs','utf8').match(/const FAKE = (`[\s\S]*?`);\n/)[1]);
/* 画面を開き直しても、にせクラウドの中身が消えないようにします
   （tlogo.cjs と同じやりかたです）                               */
FAKE = FAKE.replace('var DB = { docs:{} };', [
  "var _raw=(function(){ try{ return JSON.parse(sessionStorage.getItem('__fakedb')||'{}'); }catch(e){ return {}; } })();",
  "var _save=function(){ try{ sessionStorage.setItem('__fakedb', JSON.stringify(_raw)); }catch(e){} };",
  "var DB = { docs: new Proxy(_raw, { set:function(t,k,v){ t[k]=v; _save(); return true; },",
  "  deleteProperty:function(t,k){ delete t[k]; _save(); return true; } }) };"].join('\n'));

/* ★ 固定の待ち時間は、機械が混んでいると足りなくなります。
      「条件が満たされるまで待つ」形にします（最長 ms まで）。 */
const until = async (pg, fn, ms) => {
  const end = Date.now() + (ms || 20000);
  while(Date.now() < end){
    try{ if(await pg.evaluate(fn)) return true; }catch(e){}
    await pg.waitForTimeout(500);
  }
  return false;
};

let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };

(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:390,height:844}});
 const dlg=[]; pg.on('dialog',d=>{ dlg.push(d.message().slice(0,80).replace(/\n/g,' ')); d.dismiss(); });
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 const GAS='https://example.invalid/gas';

 /* 控えのスプレッドシートは、ちゃんと20件ぶん返します（区画つき） */
 const SHEET={ buildings:{}, contracts:{}, owners:[] };
 for(let i=1;i<=20;i++){
   SHEET.buildings['b'+i]={ id:'b'+i, name:'物件'+i, addr:'住所'+i,
     spots:{ '1':{no:'1',type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''},
             '2':{no:'2',type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''} } };
   SHEET.contracts['c'+i]={ id:'c'+i, property:'物件'+i, room:'101', contractor:'契約者'+i };
   SHEET.owners.push({ name:'オーナー'+i });
 }
 let GASOK=true;
 await pg.route('**://**', r=>{ const u=r.request().url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0)
     return r.fulfill({status:200,contentType:'application/json',
       body: GASOK ? JSON.stringify({ok:true,version:'t',payload:SHEET})
                   : JSON.stringify({ok:false,message:'スプレッドシートが失敗しました'})});
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 await pg.addInitScript(FAKE);
 await pg.goto('file://'+DIR+'/index.html'); await pg.waitForTimeout(1200);
 await pg.evaluate((g)=>{ localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_')+'cloud_url', g); }, GAS);

 const pre=await pg.evaluate(()=>(typeof insPrefix==='function'?insPrefix():'pivot_'));
 const BP=pre.replace(/_+$/,'')+'/data/buildings';
 const CT=pre.replace(/_+$/,'')+'/data/contracts';
 const LS=pre+'contract_kanban_v2';

 /* クラウド（Firestore）に、区画つきで20件 */
 await pg.evaluate((a)=>{ var i, sp;
   for(i=1;i<=20;i++){ sp={};
     sp['1']={no:'1',type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''};
     sp['2']={no:'2',type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''};
     window.__seed(a[0],'b'+i,{id:'b'+i,name:'物件'+i,addr:'住所'+i,spots:sp,
       rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'}); }
   var at='2026-09-01T00:00:00.000Z';
   for(i=1;i<=20;i++) window.__seed(a[1],'c'+i,{id:'c'+i,property:'物件'+i,room:'101',
     contractor:'契約者'+i,rev:1,updatedAt2:at});
 }, [BP,CT]);
 await pg.reload(); await pg.waitForTimeout(7000);

 const nb=()=>pg.evaluate(()=>{ try{ return Object.keys(pbLoadAll()||{}).length; }catch(e){ return -1; } });
 const nsp=()=>pg.evaluate(()=>{ try{ var t=0,a=pbLoadAll()||{};
   Object.keys(a).forEach(function(k){ t+=Object.keys((a[k]||{}).spots||{}).length; }); return t; }catch(e){ return -1; } });
 const nc=()=>pg.evaluate((k)=>{ try{ return Object.keys(JSON.parse(localStorage.getItem(k)||'{}')).length; }catch(e){ return -1; } }, LS);
 const ctBody=()=>pg.evaluate((k)=>{ try{ var m=JSON.parse(localStorage.getItem(k)||'{}');
   var f=m[Object.keys(m)[0]]; return (f && typeof f==='object') ? 'もの' : String(f); }catch(e){ return 'err'; } }, LS);
 const fsp=()=>pg.evaluate(()=>!!window.__fsPrimary);

 console.log('\n❶ 下ごしらえ');
 ok('★ 手元に物件20件', (await nb())===20, await nb());
 ok('★ 区画も入っている（40個）', (await nsp())===40, await nsp());
 ok('★ 手元に契約20件', (await nc())===20, await nc());

 console.log('\n❷ から箱を見分ける道具');
 const iz=await pg.evaluate(()=>{ var f=window.__pvIsCountBox; if(typeof f!=='function') return 'ない';
   return [ f({b1:1,b2:1,b3:1}), f({b1:{id:'b1',spots:{}}}), f({}), f(null),
            f({b1:1,b2:{id:'b2'}}) ]; });
 ok('★ 道具がある', Array.isArray(iz), iz);
 ok('★ から箱を から箱 と見分ける', Array.isArray(iz) && iz[0]===true, iz);
 ok('★ 本物の物件を から箱 と間違えない', Array.isArray(iz) && iz[1]===false, iz);
 ok('★ 空っぽ・null は から箱 あつかいしない',
    Array.isArray(iz) && iz[2]===false && iz[3]===false, iz);
 ok('★ 1件でも本物が混ざれば、本物あつかい', Array.isArray(iz) && iz[4]===false, iz);

 console.log('\n❸ ★ から箱が届いても、手元に書かない（最後の砦）');
 dlg.length=0;
 await pg.evaluate(()=>{ try{ var box={}; Object.keys(pbLoadAll()||{}).forEach(function(k){ box[k]=1; });
   window.pbSaveRaw(box); }catch(e){} });
 await pg.waitForTimeout(800);
 ok('★★ 物件が20件のまま', (await nb())===20, await nb());
 ok('★★ 区画が消えていない（40個）', (await nsp())===40, await nsp());

 console.log('\n❹ ★ 送信中にロゴをタップしても、から箱にならない');
 dlg.length=0;
 await pg.evaluate(()=>{ try{ _autoPushInFlight = true; }catch(e){} });
 const inflight=await pg.evaluate(()=>{ try{ return _autoPushInFlight===true; }catch(e){ return 'とれない'; } });
 ok('★ 送信中の状態を作れた', inflight===true, inflight);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} });
 await pg.waitForTimeout(7000);
 await pg.evaluate(()=>{ try{ _autoPushInFlight = false; }catch(e){} });
 ok('★★ 「届いた内容」の確認が出ない',
    dlg.filter(m=>/届いた内容|クラウドから届いたデータ/.test(m)).length===0, dlg);
 ok('★★ 物件が20件のまま', (await nb())===20, await nb());
 ok('★★ 区画が消えていない（40個）', (await nsp())===40, await nsp());
 ok('★★ 契約が20件のまま', (await nc())===20, await nc());
 ok('★★ 契約の中身が から箱 に置き換わっていない', (await ctBody())==='もの', await ctBody());

 console.log('\n❺ ★ 控えのスプレッドシートが失敗しても、Firestore が「正」になる');
 GASOK=false;
 await pg.evaluate(()=>{ try{ window.__fsPrimary = false; }catch(e){} });
 await pg.reload();
 await until(pg, ()=>!!window.__fsPrimary, 25000);
 ok('★★ Firestore が「正」の旗が立っている（uifix の古い合体を止める）', (await fsp())===true, await fsp());
 ok('★ 物件が20件のまま', (await nb())===20, await nb());
 ok('★ 区画が消えていない（40個）', (await nsp())===40, await nsp());
 ok('★ 「クラウドから届いたデータのほうが少ない」と言われない',
    dlg.filter(m=>/少ないです/.test(m)).length===0, dlg);

 console.log('\n❻ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);

 console.log('\nPASS='+P+'  FAIL='+F);
 await b.close();
 process.exit(F?1:0);
})();
