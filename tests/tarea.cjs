/* ★★ PIVOT2 と PIVOT3 のエリア判定が、2つのファイルで食いちがわないか
 *
 *  なぜ要るか
 *    住所からエリアを決めるところが、同じリポジトリに2つあります。
 *      js/ownerimport.js … 物件を取り込むとき「どちらへ入れるか」を決める
 *      js/areaclean.js   … よそのエリアの空物件を「消してよいか」を決める
 *
 *    2026-09-23 まで、この2つはちがう答えを出していました。
 *      ownerimport.js … 総社市 は 広島エリア（PIVOT2 へ入れる）
 *      areaclean.js   … 総社市 は よそのエリア（消す候補に挙げる）
 *    つまり、一方が入れたものを、もう一方が消そうとしていました。
 *
 *    「PIVOT2 と PIVOT3 のデータを絶対に取り違えない」は、
 *    この仕事のいちばん上の決まりです。人の目で見比べるのをやめて、
 *    検査で押さえます。
 *
 *  何を見るか
 *    ❶ 2つのファイルが、同じ住所に同じ答えを出すか（ここが本題）
 *    ❷ 決まりどおりか（広島県／倉敷市老松町／総社市 は PIVOT2）
 *    ❸ 判定できない住所を、勝手にどちらかへ寄せていないか
 *
 *  使いかた： node tests/tarea.cjs [場所]
 */
const fs   = require('fs');
const path = require('path');
const DIR  = path.resolve(process.argv[2] || path.join(__dirname, '..'));

let P = 0, F = 0;
const ok = (n, c, x) => {
  if (c) { P++; console.log('  ✅ ' + n); }
  else   { F++; console.log('  ❌ ' + n + (x !== undefined ? ('  → ' + JSON.stringify(x)) : '')); }
};
function die(msg){
  console.log('  ❌ ' + msg);
  console.log('\nPASS=' + P + '  FAIL=' + (F + 1));
  process.exit(1);
}

/* ── 本体から、判定のところだけ取り出して動かします ──
   （検査のために本体を書きかえない、という決まりに合わせています） */
function cut(file, from, to, ret){
  const src = fs.readFileSync(path.join(DIR, file), 'utf8');
  const a = src.indexOf(from);
  if (a < 0) die(file + ' に「' + from + '」が見つかりません');
  const b = src.indexOf(to, a);
  if (b < 0) die(file + ' に「' + to + '」が見つかりません');
  return { code: src.slice(a, b + to.length), src: src };
}

const CL = cut('js/areaclean.js',
               "var HIROSHIMA = ['広島県'",
               'return \'unknown\';\n  }');
const IM = cut('js/ownerimport.js',
               'const OI_AREA_HIROSHIMA = ',
               'return "unknown";\n}');

let clean, imp;
try{
  clean = new Function(CL.code + '; return areaOf;')();
  imp   = new Function(IM.code + '; return oiAreaOf;')();
}catch(e){
  die('判定のところを取り出せませんでした： ' + e.message);
}

/* ── ❶ 2つのファイルの答えが、1件でも食いちがわないか ── */
console.log('\n❶ ★★ areaclean.js と ownerimport.js が、同じ答えを出すか');

const ADDR = [
  /* 広島（PIVOT2） */
  '広島県福山市南手城町2丁目15-6',
  '広島県福山市今津町6丁目18-17',
  '広島県広島市中区大手町1-1-1',
  /* 住所は岡山県だが PIVOT2 の担当 */
  '岡山県倉敷市老松町3-4-5',
  '岡山県総社市中央1-2-3',
  '岡山県総社市駅前1-1',
  /* 岡山（PIVOT3） */
  '岡山県岡山市北区駅元町1-1',
  '岡山県倉敷市中央2-3-4',
  '岡山県津山市山下1',
  /* 判定できない */
  '',
  '東京都千代田区丸の内1-1-1',
  '1丁目2-3',
  /* 全角・空白まじり（normalize/空白除去が両方で効くか） */
  '岡山県　総社市　中央１−２−３',
  '広島県　福山市　東深津町',
];

let diff = [];
ADDR.forEach(function(a){
  const x = clean(a), y = imp(a);
  if (x !== y) diff.push({ 住所: a, areaclean: x, ownerimport: y });
});
ok('★★ 14通りの住所で、2つのファイルの答えが1件も食いちがわない',
   diff.length === 0, diff);

/* ── ❷ 決まりどおりか ── */
console.log('\n❷ 決まりどおりか（総社市・倉敷市老松町 は PIVOT2 の担当）');

const HIRO = ['広島県福山市南手城町2丁目15-6',
              '岡山県倉敷市老松町3-4-5',
              '岡山県総社市中央1-2-3',
              '岡山県　総社市　中央１−２−３'];
const OKA  = ['岡山県岡山市北区駅元町1-1',
              '岡山県倉敷市中央2-3-4',
              '岡山県津山市山下1'];

HIRO.forEach(function(a){
  ok('★ ' + a + ' … PIVOT2（広島）',
     clean(a) === 'hiroshima' && imp(a) === 'hiroshima',
     { areaclean: clean(a), ownerimport: imp(a) });
});
OKA.forEach(function(a){
  ok('★ ' + a + ' … PIVOT3（岡山）',
     clean(a) === 'okayama' && imp(a) === 'okayama',
     { areaclean: clean(a), ownerimport: imp(a) });
});

/* ここが今回の直しの中心です */
ok('★★ 総社市の物件は、PIVOT2（広島）として数える（消す候補に挙げない）',
   clean('岡山県総社市中央1-2-3') === 'hiroshima',
   clean('岡山県総社市中央1-2-3'));

/* ── ❸ 分からないものを、勝手に寄せていないか ── */
console.log('\n❸ 判定できない住所を、勝手にどちらかへ寄せていないか');

[['', '住所が空'],
 ['東京都千代田区丸の内1-1-1', 'よその県'],
 ['1丁目2-3', '県名がない']].forEach(function(p){
  ok('★ ' + p[1] + ' … unknown のまま（勝手に振り分けない）',
     clean(p[0]) === 'unknown' && imp(p[0]) === 'unknown',
     { areaclean: clean(p[0]), ownerimport: imp(p[0]) });
});

/* unknown は、areaclean.js では「消さない」側に入っていること。
   ここを取りちがえると、住所が空の物件が消えます。 */
console.log('\n❹ areaclean.js は、unknown を「消さない」側に入れているか');
ok('★★ 「a === mine || a === \'unknown\'」で残す判断をしている',
   /a\s*===\s*mine\s*\|\|\s*a\s*===\s*'unknown'/.test(CL.src),
   '見つかりません。住所が空の物件が消される恐れがあります');

/* ── 一覧の中身そのものも、そろっているか ── */
console.log('\n❺ 一覧の中身（念のため、字そのものを見ます）');
function arr(src, name){
  const m = src.match(new RegExp(name + "\\s*=\\s*\\[([^\\]]*)\\]"));
  if (!m) return null;
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}
const a1 = arr(CL.src, 'var HIROSHIMA');
const a2 = arr(IM.src, 'const OI_AREA_HIROSHIMA');
ok('★ 2つの「広島エリア」の一覧が、同じ中身', 
   a1 && a2 && JSON.stringify(a1.slice().sort()) === JSON.stringify(a2.slice().sort()),
   { areaclean: a1, ownerimport: a2 });
ok('★ 「総社市」が、両方の一覧に入っている',
   a1 && a2 && a1.indexOf('総社市') >= 0 && a2.indexOf('総社市') >= 0,
   { areaclean: a1, ownerimport: a2 });

console.log('\nPASS=' + P + '  FAIL=' + F);
process.exit(F ? 1 : 0);
