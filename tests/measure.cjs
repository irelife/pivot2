/* ★★ Firestore の読み書きを、実際に数えます（検査ではなく「ものさし」です）
 *
 *   無料枠は 1日 読み 50,000 / 書き 20,000 です。
 *   呼び鈴（realtime.js）を入れてから、読み込みの回数が増えています。
 *   超えると quota エラーになり、本物の未送信になります（夕方4時まで）。
 *
 *   使いかた： node tests/measure.cjs [場所] [物件数]
 */
const fs=require('fs');
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));
const N   = parseInt(process.argv[3] || '67', 10);      /* いまの PIVOT2 は物件67件 */
let FAKE=eval(fs.readFileSync(__dirname+'/tquota.cjs','utf8').match(/const FAKE = (`[\s\S]*?`);\n/)[1]);
FAKE = FAKE.replace('var DB = { docs:{} };', [
  "var _raw=(function(){ try{ return JSON.parse(sessionStorage.getItem('__fakedb')||'{}'); }catch(e){ return {}; } })();",
  "var _save=function(){ try{ sessionStorage.setItem('__fakedb', JSON.stringify(_raw)); }catch(e){} };",
  "var DB = { docs: new Proxy(_raw, { set:function(t,k,v){ t[k]=v; _save(); return true; },",
  "  deleteProperty:function(t,k){ delete t[k]; _save(); return true; } }) };"].join('\n'));

const rows=[];
const row=(what,r,w,note)=>{ rows.push({what,r,w,note:note||''}); };

(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:390,height:844}});
 pg.on('dialog',d=>d.dismiss());
 const GAS='https://example.invalid/gas';
 const SHEET={ buildings:{}, contracts:{}, owners:[] };
 for(let i=1;i<=N;i++) SHEET.buildings['b'+i]={ id:'b'+i, name:'物件'+i, addr:'住所'+i, spots:{} };
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

 await pg.evaluate((a)=>{ var i,j,sp;
   for(i=1;i<=a[1];i++){ sp={};
     for(j=1;j<=15;j++) sp[''+j]={no:''+j,type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''};
     window.__seed(a[0],'b'+i,{id:'b'+i,name:'物件'+i,addr:'住所'+i,spots:sp,
       rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'}); }
   for(i=1;i<=a[1];i++) window.__seed(a[2],'c'+i,{id:'c'+i,property:'物件'+i,room:'101',
     contractor:'契約者'+i,rev:1,updatedAt2:'2026-09-01T00:00:00.000Z'});
 }, [BP,N,CT]);

 /* ── ① 画面を開く ─────────────────────────── */
 await pg.evaluate(()=>{ try{ sessionStorage.setItem('__z','1'); }catch(e){} });
 await pg.reload(); await pg.waitForTimeout(1000);
 await pg.evaluate(()=>{ window.__zero(); });
 await pg.waitForTimeout(8000);
 let m=await pg.evaluate(()=>({r:window.__fs.reads,w:window.__fs.writes}));
 row('画面を開く（1回）', m.r, m.w, '起動時の読み込み一式');

 /* ── ② 保存する ───────────────────────────── */
 await pg.evaluate(()=>{ window.__zero(); });
 await pg.evaluate(()=>{ var a=pbLoadAll(); a['b1'].name='★測定'; pbSaveRaw(a);
   if(typeof window.__pushNow==='function') window.__pushNow(); });
 await pg.waitForTimeout(6000);
 m=await pg.evaluate(()=>({r:window.__fs.reads,w:window.__fs.writes}));
 row('保存する（1回）', m.r, m.w, '呼び鈴の書き込みを含みます');

 /* ── ③ 呼び鈴を受けて読み直す ───────────────── */
 await pg.evaluate(()=>{ window.__zero(); });
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} });
 await pg.waitForTimeout(7000);
 m=await pg.evaluate(()=>({r:window.__fs.reads,w:window.__fs.writes}));
 row('呼び鈴を受けて読み直す（1回）', m.r, m.w, 'ほかの端末が保存するたび、全端末で起きます');

 /* ── ④ 15分ごとの静かな同期 ─────────────────── */
 await pg.evaluate(()=>{ window.__zero(); });
 await pg.evaluate(()=>{ try{ window.__pvSyncNow && window.__pvSyncNow(); }catch(e){} });
 await pg.waitForTimeout(7000);
 m=await pg.evaluate(()=>({r:window.__fs.reads,w:window.__fs.writes}));
 row('静かな同期（1回）', m.r, m.w, '15分ごと');

 console.log('\n物件 ' + N + ' 件・区画 ' + (N*15) + ' 件で実測しました（にせクラウド）\n');
 console.log('  ' + 'やったこと'.padEnd(30) + '読み'.padStart(6) + '書き'.padStart(6) + '  ' + 'ひとこと');
 console.log('  ' + '─'.repeat(78));
 rows.forEach(x=>{
   console.log('  ' + x.what.padEnd(30) + String(x.r).padStart(6) + String(x.w).padStart(6) + '  ' + x.note);
 });
 console.log('');
 console.log(JSON.stringify(rows));
 await b.close();
})();
