/* ★★ 「新しい版が出ているのに気づけない」を直したかの検査
 *
 *   2026/9/16、こういうことが起きました。
 *     22:48 マージ → 22:49 配信おわり → 22:51 画面は古いまま
 *
 *   その画面は 22:08 に読み込んだもので、40分前のコードでした。
 *   直っていないのではなく、届いていなかっただけです。
 *
 *   js には ?v=40 のような番号を付けていますが、
 *   その番号が書いてある index.html 自身には何も付いていません。
 *   Safari が index.html を古いまま持っていると、
 *   何度開き直しても古い番号を読み続けます。
 *
 *   画面が自分で気づくようにしました。ここで見張ります。
 */
const fs=require('fs');
const path=require('path');
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..'));
let FAKE=eval(fs.readFileSync(__dirname+'/tquota.cjs','utf8').match(/const FAKE = (`[\s\S]*?`);\n/)[1]);

let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };

/* 本物の index.html と js を、http:// で配ります（file:// では見に行かない作りのため） */
const http=require('http');
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
            '.css':'text/css; charset=utf-8'};
let SERVED_V = null;      /* 配る index.html の store.js の番号を、途中で変えます */

const srv = http.createServer((req,res)=>{
  let p = req.url.split('?')[0];
  if(p === '/') p = '/index.html';
  const f = path.join(DIR, p);
  if(!f.startsWith(DIR) || !fs.existsSync(f)){ res.writeHead(404); return res.end('no'); }
  let body = fs.readFileSync(f);
  if(p === '/index.html' && SERVED_V !== null){
    body = Buffer.from(String(body).replace(/store\.js\?v=\d+/g, 'store.js?v=' + SERVED_V), 'utf8');
  }
  res.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'text/plain'});
  res.end(body);
});

(async()=>{
 await new Promise(r=>srv.listen(0, r));
 const PORT = srv.address().port;
 const BASE = 'http://127.0.0.1:' + PORT + '/';

 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:390,height:844}});
 pg.on('dialog',d=>d.dismiss());
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 await pg.route('**://**', r=>{ const u=r.request().url();
   if(u.indexOf('127.0.0.1')>=0) return r.continue();
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 await pg.addInitScript(FAKE);

 const bar=()=>pg.evaluate(()=>{ var e=document.getElementById('pv-newver-bar');
   return e ? (e.textContent||'').trim() : null; });

 console.log('\n❶ 同じ版のときは、何も出さない');
 SERVED_V = null;                      /* そのまま配ります（同じ番号） */
 await pg.goto(BASE); await pg.waitForTimeout(11000);
 ok('★ 赤い帯は出ていない', (await bar())===null, await bar());

 console.log('\n❷ ★ 新しい版が出たら、画面が自分で気づく');
 /* 配信側だけ番号を上げます。画面はもう読み込み済み（古いまま）です。 */
 const cur = Number(String(fs.readFileSync(path.join(DIR,'index.html'))).match(/store\.js\?v=(\d+)/)[1]);
 SERVED_V = cur + 5;
 await pg.evaluate(()=>{ try{ window.__pvCheckNewBuild(); }catch(e){} });
 await pg.waitForTimeout(3000);
 const t = await bar();
 ok('★★ 赤い帯が出る', !!t && /新しい版/.test(t), t);
 ok('★ いまの版と新しい版の、両方が書いてある',
    !!t && t.indexOf(String(cur))>=0 && t.indexOf(String(cur+5))>=0, t);

 console.log('\n❸ ★ 押すと、必ず新しく取りに行く形で開き直す');
 /* ただの reload では、古い index.html がまた使われます。
    URL を変えているかどうかを見ます。                    */
 await pg.evaluate(()=>{ document.getElementById('pv-newver-bar').click(); });
 await pg.waitForTimeout(4000);
 const url = pg.url();
 ok('★★ URL に新しい印が付いている（ただの開き直しではない）',
    /\?v=\d{10,}/.test(url), url);

 console.log('\n❹ 開き直したあとは、帯が消える');
 SERVED_V = null;
 await pg.goto(BASE + '?v=' + Date.now()); await pg.waitForTimeout(11000);
 ok('★ 帯は出ていない', (await bar())===null, await bar());

 console.log('\n❺ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);

 console.log('\nPASS='+P+'  FAIL='+F);
 await b.close(); srv.close();
 process.exit(F?1:0);
})();
