/* ★★ やりとりの画面「開閉式」と「検索」の検査
 *
 *  ご指示（2026/10/1）：
 *    「これって、どんどん溜まっていったらどうなるの？きれいに整理してほしい」
 *    → 1（開閉式）＋ 2（検索欄）
 *
 *  【なぜ要るか】
 *  改良前は、全部のやりとりを開いたまま縦に並べていました。
 *  12件でも画面がとても長くなり、1つ返信するのに延々とスクロールします。
 *  112名が毎月ご相談を送れば、年に数百件になります。
 *
 *  ★未返信のものだけ開いておきます。いま手を打つべきものだからです。
 *  ★検索したときは、見つかったものを全部開きます。
 *    探しあてたのに、また押して開くのは手間だからです。
 *
 *  使いかた： node tests/torp.cjs
 */
const path = require('path');
const { chromium } = (function(){
  try{ return require('playwright'); }
  catch(e){ return require('/opt/node22/lib/node_modules/playwright'); }
})();
const D = __dirname + '/';

let P = 0, F = 0;
const ok = (c, m, x) => {
  if (c) { P++; console.log('  ✅ ' + m); }
  else   { F++; console.log('  ❌ ' + m + (x !== undefined ? ('  → ' + JSON.stringify(x)) : '')); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:1280, height:900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + D + 'torp.html');
  await p.waitForSelector('#view-reply', { timeout:10000 });
  /* 「未返信のみ表示」を外して、12件すべて出します */
  await p.evaluate(() => {
    const c = document.getElementById('orp-only');
    c.checked = false; c.dispatchEvent(new Event('change'));
  });
  await p.waitForTimeout(900);

  const look = () => p.evaluate(() => {
    const ts = [].slice.call(document.querySelectorAll('#orp-list .orp-t'));
    return {
      n     : ts.length,
      open  : ts.filter(function(t){
                var b = t.querySelector('.orp-body'); return b && !b.hidden; }).length,
      first : ts.length ? (ts[0].querySelector('.orp-o')||{}).textContent : '',
      note  : (document.getElementById('orp-cnt')||{}).textContent || '',
      hasQ  : !!document.getElementById('orp-q')
    };
  });

  console.log('\n❶ 開閉式になっているか');
  let v = await look();
  console.log('   ' + v.n + '件中、開いているのは ' + v.open + '件');
  ok(v.n === 12, 'やりとりが12件出る', v.n);
  ok(v.hasQ, '★検索欄がある');
  ok(v.open === 1, '★★開いているのは「未返信」の1件だけ', v.open);

  console.log('\n❷ 見出しを押すと開く／もう一度押すと閉じる');
  await p.click('#orp-list .orp-t:nth-child(3) .orp-hb');
  await p.waitForTimeout(200);
  v = await look();
  ok(v.open === 2, '★押したら開く（1 → 2件）', v.open);
  await p.click('#orp-list .orp-t:nth-child(3) .orp-hb');
  await p.waitForTimeout(200);
  v = await look();
  ok(v.open === 1, '★もう一度押したら閉じる（2 → 1件）', v.open);

  console.log('\n❸ 検索');
  const find = async (word) => {
    await p.fill('#orp-q', word);
    await p.waitForTimeout(300);
    return await look();
  };

  v = await find('Turnkey');
  console.log('   「Turnkey」→ ' + v.n + '件  ' + v.note);
  ok(v.n === 1, '★★お名前で引ける', v.n);
  ok(v.first.indexOf('Turnkey') >= 0, '★その方が出る', v.first);
  ok(v.open === 1, '★★見つかったものは、開いた形で出る（また押さなくてよい）', v.open);

  v = await find('相続');
  console.log('   「相続」→ ' + v.n + '件');
  ok(v.n === 1, '★★本文の中の字でも引ける', v.n);

  v = await find('登録内容の変更');
  ok(v.n === 1, '★用件でも引ける', v.n);

  v = await find('ＴＵＲＮＫＥＹ');
  console.log('   「ＴＵＲＮＫＥＹ」（全角・大文字）→ ' + v.n + '件');
  ok(v.n === 1, '★★全角・大文字でも引ける（そろえてからくらべる）', v.n);

  v = await find('ないはずの字');
  console.log('   見つからないとき: ' + v.note);
  ok(v.n === 0, '無いものは0件', v.n);
  const emp = await p.evaluate(()=>(document.querySelector('#orp-list .empty')||{}).textContent||'');
  ok(/一致するやりとりはありません/.test(emp), '★見つからないと、その旨を出す', emp);

  v = await find('');
  ok(v.n === 12, '★検索を消すと、全部に戻る', v.n);
  ok(v.open === 1, '★戻したら、また未返信だけが開く', v.open);

  console.log('\n❹ 通信の回数（打つたびに通信していないか）');
  const before = await p.evaluate(()=>window.__sent.filter(x=>x.action==='stList').length);
  await p.fill('#orp-q', 'やまだ');
  await p.waitForTimeout(400);
  const after = await p.evaluate(()=>window.__sent.filter(x=>x.action==='stList').length);
  console.log('   検索の前後で stList: ' + before + ' → ' + after);
  ok(before === after, '★★検索しても通信しない（手元の一覧を絞るだけ）', [before, after]);
  await p.fill('#orp-q', '');

  console.log('\n❺ 件数の表示');
  v = await look();
  ok(/表示： 12 件/.test(v.note), '★件数を出す', v.note);

  ok(errs.length === 0, '　JavaScript の誤りが出ない', errs);
  await p.close();
  await b.close();
  console.log('\nPASS=' + P + ' FAIL=' + F);
  process.exit(F ? 1 : 0);
})();
