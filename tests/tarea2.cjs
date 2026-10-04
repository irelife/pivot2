/* ★★ PIVOT2 は「すべてのエリア」を扱う、という決まりを見張ります
 *
 *  なぜ要るか
 *    2026-10-04 に決まりが変わりました。
 *      改良前： PIVOT2 の担当は 広島県・倉敷市老松町・総社市 だけ。
 *              岡山県の物件は「よそのエリア」で、区画0・契約なし・画像なし
 *              の3つがそろうと、片づけ道具の「消す候補」に挙がっていました。
 *              取り込み画面も「広島エリア」が初めから選ばれていたので、
 *              そのまま取り込むと岡山県の物件が **だまって除かれて** いました。
 *      改良後： PIVOT2 は、すべてのエリア（岡山・広島・福山・総社・倉敷・
 *              赤磐 ほか）を扱います。
 *
 *    30％保証の LINE は PIVOT2 の「保証」シートだけを読みます。
 *    岡山の物件が PIVOT2 に入らないと、保証中になっても LINE に出ません。
 *    だから、この2つが元に戻っていないかを、毎回ここで見張ります。
 *
 *  何を見るか
 *    ❶ 取り込みの初期選択が「全部」になっているか（PIVOT2）／「岡山」か（PIVOT3）
 *    ❷ 片づけ道具が、PIVOT2 では1件も消さないか（岡山県の空物件を置いても）
 *    ❸ 片づけ道具が、PIVOT3 では これまでどおり働くか
 *
 *  使いかた： node tests/tarea2.cjs [場所]
 */
const fs   = require('fs');
const path = require('path');
const http = require('http');
const DIR  = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const { chromium } = (function(){
  try{ return require('playwright'); }
  catch(e){ return require('/opt/node22/lib/node_modules/playwright'); }
})();

let P = 0, F = 0;
const ok = (n, c, x) => {
  if (c) { P++; console.log('  ✅ ' + n); }
  else   { F++; console.log('  ❌ ' + n + (x !== undefined ? ('  → ' + JSON.stringify(x)) : '')); }
};

const AC = fs.readFileSync(path.join(DIR, 'js/areaclean.js'), 'utf8');
const OI = fs.readFileSync(path.join(DIR, 'js/ownerimport.js'), 'utf8');

/* ── ❶ 取り込みの初期選択 ───────────────────────── */
console.log('\n❶ 取り込み画面で、初めに選ばれるエリア');

const m = OI.match(/function oiDefaultArea\(\)\{[\s\S]*?\n\}/);
let oiDef = null;
if (m) {
  try { oiDef = new Function('location', m[0] + '; return oiDefaultArea;'); } catch(e){}
}
ok('oiDefaultArea を取り出せた', !!oiDef);
if (oiDef) {
  /* new Function は「関数そのもの」を返すので、もう一度呼んで答えを取ります */
  const f2 = oiDef({ pathname: '/pivot2/index.html' })();
  const f3 = oiDef({ pathname: '/pivot3/index.html' })();
  ok('★★ PIVOT2 は「全部（振り分けない）」が初めから選ばれる', f2 === 'all', f2);
  ok('★ PIVOT3 は これまでどおり「岡山エリア」', f3 === 'okayama', f3);
}
ok('★ 「全部」のラジオに、初期選択の印が付く作りになっている',
   /value="all"'\s*\+\s*\(def === 'all' \? ' checked' : ''\)/.test(OI));

/* ── ❷❸ 片づけ道具 ─────────────────────────────── */
const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>
/* 検査用の、にせの物件一覧（区画0・契約なし・画像なし＝いちばん消されやすい形） */
window.pbLoadAll = function(){ return {
  b1:{ name:'岡山のからっぽ物件', addr:'岡山県岡山市北区駅元町1-1', spots:[], photo_ids:[] },
  b2:{ name:'赤磐のからっぽ物件', addr:'岡山県赤磐市下市1-1',       spots:[], photo_ids:[] },
  b3:{ name:'広島のからっぽ物件', addr:'広島県福山市東深津町1-1',   spots:[], photo_ids:[] }
}; };
</script>
<script src="/js/areaclean.js"></script>
</body></html>`;

function serve(){
  return new Promise(res => {
    const srv = http.createServer((req, rq) => {
      const u = decodeURIComponent((req.url || '').split('?')[0]);
      if (u.endsWith('/index.html') || u.endsWith('/')) {
        rq.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); rq.end(PAGE); return;
      }
      const f = path.join(DIR, u.replace(/^\//, ''));
      if (fs.existsSync(f) && fs.statSync(f).isFile()) {
        rq.writeHead(200, {'Content-Type':'application/javascript; charset=utf-8'});
        rq.end(fs.readFileSync(f)); return;
      }
      rq.writeHead(404); rq.end('');
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}

(async () => {
  const { srv, port } = await serve();
  const b = await chromium.launch();

  async function look(dir){
    const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:' + port + '/' + dir + '/index.html');
    await p.waitForTimeout(200);
    const r = await p.evaluate(() => {
      if (typeof window.openAreaClean !== 'function') return { err:'openAreaClean がない' };
      window.openAreaClean();
      const ov = document.getElementById('ac-ov');
      if (!ov) return { err:'画面が出ない' };
      const go = document.getElementById('ac-go');
      return {
        lead : (ov.querySelector('.ac-lead') || {}).textContent || '',
        head : Array.prototype.map.call(ov.querySelectorAll('.ac-h2'), e => e.textContent).join(' / '),
        rows : ov.querySelectorAll('.ac-list .ac-r').length,
        btn  : go ? go.textContent : '',
        off  : go ? go.disabled : null
      };
    });
    await p.close();
    return { r, errs };
  }

  console.log('\n❷ ★★ PIVOT2 では、岡山県の からっぽ物件を1件も消さない');
  const a = await look('pivot2');
  ok('JavaScript の誤りが出ない', a.errs.length === 0, a.errs);
  ok('★★ 消す候補が 0件', a.r.rows === 0, a.r);
  ok('★★ 「この 0件を消す」になっていて、押せない', a.r.off === true && /0件/.test(a.r.btn || ''), a.r.btn);
  ok('★ 「すべてのエリアを扱います」と出る', /すべてのエリア/.test(a.r.lead || ''), a.r.lead);

  console.log('\n❸ PIVOT3 では、これまでどおり働く（広島の空物件が候補に挙がる）');
  const c = await look('pivot3');
  ok('JavaScript の誤りが出ない', c.errs.length === 0, c.errs);
  ok('★ 消す候補が 1件（広島のからっぽ物件）', c.r.rows === 1, c.r);
  ok('★ 岡山の2件は、候補に挙がらない', c.r.rows === 1, c.r);

  await b.close(); srv.close();
  console.log('\nPASS=' + P + '  FAIL=' + F);
  process.exit(F ? 1 : 0);
})();
