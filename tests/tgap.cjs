/* 区画を足すとき、欠番を小さい順に埋めるかを確かめます。
   すでにある区画の番号は、1つも動かないことも見ます。 */
const fs = require('fs');
const path = require('path');
const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const src = fs.readFileSync(path.join(DIR, 'js/buildings.js'), 'utf8');

/* addSpots の中の「番号を決めるところ」だけ取り出して動かします */
const a = src.indexOf('  const noOf = (sp)');
const b = src.indexOf('  document.getElementById(\'f-count\').value = newCount;', a);
if (a < 0 || b < 0) { console.log('❌ 番号を決めるところが見つかりません'); console.log('PASS=0 FAIL=1'); process.exit(1); }
const code = src.slice(a, b);
const run = new Function('currentSpots', 'currentCount', 'addCount',
                         code + '; return newNos;');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };
const mk = nos => nos.map(n => ({ no: n, type: '縦', user: '' }));
const nums = sp => sp.map(x => x.no);

/* ① P01 を消したあと1つ足すと、P01 に戻る */
{
  const sp = mk([2,3,4,5,6,7,8,9,10]);
  const got = run(sp, sp.length - 0, 1);
  ok(JSON.stringify(got) === '[1]', 'P01 が空いていれば、足した区画は P01 になる');
  ok(JSON.stringify(nums(sp)) === JSON.stringify([1,2,3,4,5,6,7,8,9,10]),
     '番号の順に並んでいる表では、正しい位置に入る');
}

/* ② 欠番が無ければ、これまでどおり最大の次 */
{
  const sp = mk([1,2,3]);
  const got = run(sp, sp.length, 2);
  ok(JSON.stringify(got) === '[4,5]', '欠番が無ければ P04・P05 と続く');
}

/* ③ 欠番が複数あれば、小さい順に埋めてから続ける */
{
  const sp = mk([2,5,6]);
  const got = run(sp, sp.length, 4);
  ok(JSON.stringify(got) === '[1,3,4,7]', '欠番 1・3・4 を埋めてから P07 へ続く');
}

/* ④ すでにある区画の番号は、1つも動かない */
{
  const sp = mk([2,5,6]);
  const before = JSON.stringify(nums(sp).slice().sort((x,y)=>x-y));
  run(sp, sp.length, 2);
  const kept = nums(sp).filter(n => [2,5,6].indexOf(n) >= 0).sort((x,y)=>x-y);
  ok(JSON.stringify(kept) === before, '元からあった P02・P05・P06 は番号が変わらない');
}

/* ⑤ 1つも区画が無いときは P01 から */
{
  const sp = [];
  const got = run(sp, 0, 3);
  ok(JSON.stringify(got) === '[1,2,3]', '区画が0のときは P01 から始まる');
}

/* ⑥ 並べ替えてある表でも、こわれない */
{
  const sp = mk([3,1,5]);
  const got = run(sp, sp.length, 1);
  ok(JSON.stringify(got) === '[2]', '並べ替えてあっても、欠番の P02 を見つける');
  ok(sp.length === 4, '区画の数は1つだけ増える');
}

console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail === 0 ? 0 : 1);
