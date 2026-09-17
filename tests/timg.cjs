/* ★★ 画像（間取り図・現地写真）を、あきらめずに取れるかの検査
 *
 *   2026/9/16、iPad で間取り図が「読み込み中 → 再試行」から
 *   進まなくなりました。スマホでは見えていました。
 *
 *     スマホ … 前に取った控えが端末に残っていた
 *     iPad  … 控えが無く、GAS 経由で取りに行くしかなかった
 *
 *   そこが弱いままでした。
 *     ・1回きり。失敗したら人が押すだけ
 *     ・25秒で打ち切り（Apps Script は目を覚ますのに時間がかかります）
 *     ・物件を開くと、配置図2枚＋写真5枚を いっぺんに 投げる
 *
 *   js/buildings.js は 5,000行ありますが、検査が1本もありませんでした。
 *   これが最初の1本です。
 */
const fs=require('fs');
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));
let FAKE=eval(fs.readFileSync(__dirname+'/tquota.cjs','utf8').match(/const FAKE = (`[\s\S]*?`);\n/)[1]);

let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };

/* 1x1 の PNG（本物の画像です） */
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:1200,height:900}});
 pg.on('dialog',d=>d.dismiss());
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 const GAS='https://example.invalid/gas';

 /* 画像の取得だけ、わざと失敗させられるようにします */
 let imgFailTimes = 0;      /* 最初の何回を失敗させるか */
 let imgCalls = 0;          /* 何回呼ばれたか */
 let concurrent = 0, maxConcurrent = 0;

 await pg.route('**://**', async r=>{ const q=r.request(); const u=q.url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0){
     let body = {};
     try{ body = JSON.parse(q.postData()||'{}'); }catch(e){}
     if(body.action === 'getImageUrl'){
       imgCalls++;
       concurrent++; if(concurrent > maxConcurrent) maxConcurrent = concurrent;
       await new Promise(w=>setTimeout(w, 400));     /* 少し時間がかかる */
       concurrent--;
       if(imgCalls <= imgFailTimes){
         return r.fulfill({status:200,contentType:'application/json',
           body:JSON.stringify({ok:false,message:'時間切れ'})});
       }
       return r.fulfill({status:200,contentType:'application/json',
         body:JSON.stringify({ok:true,mimeType:'image/png',base64:PNG})});
     }
     return r.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({ok:true,version:'t',payload:{buildings:{},contracts:{},owners:[]}})});
   }
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });

 await pg.addInitScript(FAKE);
 await pg.goto('file://'+DIR+'/index.html'); await pg.waitForTimeout(1500);
 await pg.evaluate((g)=>{ localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_')+'cloud_url', g); }, GAS);
 await pg.waitForTimeout(1500);

 const has = await pg.evaluate(()=>typeof window.fetchImagePatient);
 console.log('\n❶ 道具があるか');
 ok('★ あきらめずに取る係がある', has==='function', has);

 console.log('\n❷ ふつうに取れる');
 imgCalls=0; imgFailTimes=0;
 let got = await pg.evaluate(()=>window.fetchImagePatient('img_A'));
 ok('★ 画像が取れた', typeof got==='string' && got.indexOf('data:image/png;base64,')===0, String(got).slice(0,40));
 ok('★ 1回で済んでいる', imgCalls===1, imgCalls);

 console.log('\n❸ ★★ 1回目が失敗しても、あきらめない');
 imgCalls=0; imgFailTimes=1;
 got = await pg.evaluate(()=>window.fetchImagePatient('img_B'));
 ok('★★ 2回目で取れた', typeof got==='string' && got.indexOf('data:image')===0, String(got).slice(0,30));
 ok('★ ちゃんと2回試した', imgCalls===2, imgCalls);

 console.log('\n❹ ★★ 2回目まで失敗しても、あきらめない');
 imgCalls=0; imgFailTimes=2;
 got = await pg.evaluate(()=>window.fetchImagePatient('img_C'));
 ok('★★ 3回目で取れた', typeof got==='string' && got.indexOf('data:image')===0, String(got).slice(0,30));
 ok('★ ちゃんと3回試した', imgCalls===3, imgCalls);

 console.log('\n❺ 3回とも駄目なら、あきらめて知らせる（無限に回らない）');
 imgCalls=0; imgFailTimes=99;
 got = await pg.evaluate(()=>window.fetchImagePatient('img_D'));
 ok('★★ null を返す（画面は「読込失敗」になります）', got===null, got);
 ok('★★ 4回以上は試さない（回線を叩き続けない）', imgCalls===3, imgCalls);

 console.log('\n❻ ★★ いっぺんに投げるのは2本まで');
 imgCalls=0; imgFailTimes=0; maxConcurrent=0;
 await pg.evaluate(()=>Promise.all(
   ['p1','p2','p3','p4','p5','p6','p7'].map(x=>window.fetchImagePatient('img_'+x))));
 ok('★★ 同時に投げたのは2本まで（7枚あっても）', maxConcurrent<=2, maxConcurrent);
 ok('★ 7枚ぜんぶ取れた', imgCalls===7, imgCalls);

 console.log('\n❼ 「見つかりません」と言われたら、すぐやめる');
 imgCalls=0;
 await pg.route('**://**', async r=>{ const q=r.request(); const u=q.url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0){
     let body={}; try{ body=JSON.parse(q.postData()||'{}'); }catch(e){}
     if(body.action==='getImageUrl'){ imgCalls++;
       return r.fulfill({status:200,contentType:'application/json',
         body:JSON.stringify({ok:false,message:'画像が見つかりません'})}); }
     return r.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({ok:true,version:'t',payload:{buildings:{},contracts:{},owners:[]}})});
   }
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 got = await pg.evaluate(()=>window.fetchImagePatient('img_none'));
 ok('★ null を返す', got===null, got);
 ok('★★ 1回でやめる（無いものを3回も探しにいかない）', imgCalls===1, imgCalls);

 console.log('\n❽ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);

 console.log('\nPASS='+P+'  FAIL='+F);
 await b.close();
 process.exit(F?1:0);
})();
