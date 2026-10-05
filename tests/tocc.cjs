/* ★★ 明細PDFから「総戸数（お部屋の数）」を数える検査
 *     （js/ownermail.js の extractUnits と window.pvUnitsOf）
 *
 *  【なぜ要るか】
 *  オーナーマイページの「入居率」は、この数で割って出します。
 *  明細には「総戸数」「室数」という欄が、どこにもありません。
 *  けれども「収入明細」の表には、空いているお部屋も1行として出ます。
 *      101 山田 太郎 26/09 65,000 3,000 4,400 72,400   ← 入っている
 *      102           26/09 0 0 0 0 募集中              ← 空いている
 *  ですから「収入明細の表にある、部屋番号で始まる行の数」が総戸数です。
 *
 *  ここを1室まちがえると、入居率がまるごと狂います。
 *  しかもエラーは出ません。オーナー様の画面に、
 *  まちがった率が静かに出続けます。だから、この検査が要ります。
 *
 *  使いかた：  node tests/tocc.cjs
 */
const fs   = require('fs');
const path = require('path');

const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const src = fs.readFileSync(path.join(DIR, 'js/ownermail.js'), 'utf8');
const tmp = fs.readFileSync(path.join(DIR, 'js/tomypage.js'), 'utf8');

/* ownermail.js は囲い（IIFE）の中にあるので、関数の中身だけ切り出します */
function cut(name){
  const head = 'function ' + name + '(';
  const a = src.indexOf(head);
  if (a < 0) return null;
  let i = src.indexOf('{', a), d = 0;
  for (let j = i; j < src.length; j++){
    if (src[j] === '{') d++;
    else if (src[j] === '}'){ d--; if (d === 0) return src.slice(a, j + 1); }
  }
  return null;
}
function cutAssign(name){
  const head = 'window.' + name + ' = function(';
  const a = src.indexOf(head);
  if (a < 0) return null;
  let i = src.indexOf('{', a), d = 0;
  for (let j = i; j < src.length; j++){
    if (src[j] === '{') d++;
    else if (src[j] === '}'){ d--; if (d === 0) return src.slice(a, j + 1) + ';'; }
  }
  return null;
}

const bUnits = cut('extractUnits');
const bOf    = cutAssign('pvUnitsOf');
if (!bUnits || !bOf){
  console.log('❌ ' + (!bUnits ? 'extractUnits' : 'window.pvUnitsOf') +
              ' が見つかりません（js/ownermail.js の名前を変えていませんか）');
  console.log('PASS=0 FAIL=1');
  process.exit(1);
}
const extractUnits = new Function(bUnits + '; return extractUnits;')();
const pvUnitsOf    = new Function('var window={};' + bOf + '; return window.pvUnitsOf;')();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); }
                       else   { fail++; console.log('  ❌ ' + m); } };
const eq = (g, w, m) => ok(JSON.stringify(g) === JSON.stringify(w),
                           m + '（' + JSON.stringify(g) + '）');

/* ── 本物の明細に近い形を作ります ────────────────────
 *  ★extractUnits には、改行を取る前の文字が渡ります
 *    （js/ownermail.js の parsePage の bodyLines）。同じ形で渡します。
 *  ★本物の並びに合わせています：
 *      収入明細 → 見出しの行 → お部屋の行… → 駐車場の行 → 合計 → 支出明細
 */
function page(rooms, opt){
  opt = opt || {};
  const L = [];
  L.push('物件名　○○ハイツ　　広島県広島市…');
  L.push('収入明細');
  L.push('部屋 入居者名 入／退 賃料 共益費 駐車料 駐車料2台目 駐車料3台目 水道 町費 更新手数料 修繕費 その他 合計');
  rooms.forEach(r => L.push(r));
  if (opt.parking !== false){
    L.push('駐車料 26/09 121,000 121,000 その他収入 太陽光発電2.8kw売電');
    L.push('駐車場２台目 14,858 1,485');
  }
  L.push('合計 324,000 16,000 24,200 0 0 0 0 0 121,000 0 485,200');
  L.push('支出明細');
  L.push('項目 支払先 入／退 お支払日 金額 消費税 合計');
  L.push('26/09 ○○サービス 10,910 1,090 12,000');
  L.push('合計 10,910 1,090 12,000');
  L.push('1 / 1');
  return L.join('\n');
}
const occupied = (no, name, yy) =>
  no + ' ' + name + ' ' + (yy || 26) + '/09 65,000 3,000 4,400 72,400';
const vacant = (no, yy) =>
  no + ' ' + (yy || 26) + '/09 0 0 0 0 募集中';

/* ── ① 本物と同じ6棟（ご本人に35室で確認いただいた形） ───── */
console.log('\n① 実際の明細6棟（ご確認いただいた 35室）');
const SIX = [
  ['101','102','103','105','106'],
  ['101','102','103','105','106'],
  ['101','102','201','202','301','302'],
  ['101','102','201','202','301','302'],
  ['101','102','103','105','201','202','203','205'],
  ['101','102','103','105','106']
];
let sum = 0;
SIX.forEach((rs, i) => {
  const t = page(rs.map(r => occupied(r, '山田 太郎')));
  const got = extractUnits(t);
  eq(got, rs, (i + 1) + '棟め：' + rs.length + '室を、そのまま数えた');
  sum += got.length;
});
ok(sum === 35, '6棟の合計が 35室（ご本人にご確認いただいた数）＝' + sum);

/* ── ② 空いているお部屋も、1室として数える ──────────── */
console.log('\n② 空いているお部屋（お名前が無い行）も数える');
eq(extractUnits(page([
  occupied('101','山田 太郎'),
  vacant('102'),
  occupied('103','佐藤 一')
])), ['101','102','103'], '募集中の102号室も数えた');

eq(extractUnits(page([
  vacant('101'), vacant('102'), vacant('103')
])), ['101','102','103'], '全室が空いていても、総戸数は3室');

/* ── ③ 数えてはいけないもの ───────────────────── */
console.log('\n③ 数えてはいけないもの');
const t3 = page([occupied('101','山田 太郎'), occupied('102','佐藤 一')]);
eq(extractUnits(t3), ['101','102'], '駐車料・駐車場２台目・合計・支出明細を数えない');
ok(extractUnits(t3).indexOf('324') < 0, '合計の行の金額（324,000）を部屋にしない');
ok(extractUnits(t3).indexOf('121') < 0, '駐車料の金額（121,000）を部屋にしない');
ok(extractUnits(t3).indexOf('910') < 0, '支出明細の金額を部屋にしない');

eq(extractUnits([
  '収入明細',
  '部屋 入居者名 入／退 賃料 合計',
  '101 山田 太郎 26/09 65,000 65,000',
  '001 駐車場 26/09 11,000 11,000',
  '002 駐輪場 26/09 1,000 1,000',
  '003 倉庫 26/09 5,000 5,000',
  '004 看板 26/09 20,000 20,000',
  '005 太陽光 26/09 30,000 30,000',
  '合計 132,000',
  '支出明細'
].join('\n')), ['101'], '番号つきの駐車場・駐輪場・倉庫・看板・太陽光は、お部屋にしない');

eq(extractUnits([
  '収入明細',
  '部屋 入居者名 入／退 賃料 合計 備考',
  '101 山田 太郎 26/09 65,000 69,400 駐車場1台込み',
  '102 佐藤 一 26/09 62,000 62,000'
].join('\n')), ['101','102'],
   '★備考に「駐車場1台込み」と書かれたお部屋は、ちゃんと数える');

eq(extractUnits([
  '物件名　○○ハイツ',
  '101 まだ収入明細の前の行 26/09 65,000',
  '収入明細',
  '部屋 入居者名 入／退 賃料',
  '102 山田 太郎 26/09 65,000',
  '支出明細'
].join('\n')), ['102'], '「収入明細」より前の行は見ない');

eq(extractUnits([
  '収入明細',
  '部屋 入居者名',
  '101 山田 太郎 26/09 65,000',
  '支出明細',
  '201 ここは支出の行 26/09 10,000'
].join('\n')), ['101'], '「支出明細」から先は見ない');

eq(extractUnits([
  '収入明細',
  '部屋 入居者名',
  '101 山田 太郎 26/09 65,000',
  '合計 65,000',
  '201 合計より後の行 26/09 10,000'
].join('\n')), ['101'], '「合計」の行から先は見ない');

eq(extractUnits([
  '収入明細',
  '部屋 入居者名',
  '101 山田 太郎 26/09 65,000',
  '合　計 65,000',
  '201 合計より後の行 26/09 10,000'
].join('\n')), ['101'], '「合　計」（全角あき）でも、そこで止まる');

/* ── ③-2 ★あいだの空白が落ちても読める（2026/10/5 追加） ───
 *  pdf.js は文字のかたまりを座標順につなぎます。たいていは空白が
 *  入りますが、まれに落ちて「10126/09」のようにくっつきます。
 *  空白しか見ていないと、その棟だけ総戸数が数えられず、
 *  その月のその方の入居率が黙って出なくなります。
 */
console.log('\n③-2 ★部屋番号と日付の空白が落ちても読める');
eq(extractUnits([
  '収入明細',
  '部屋 入居者名 入／退 賃料 合計',
  '10126/09 0 0 0 0 募集中',
  '10226/09 0 0 0 0 募集中',
  '103 佐藤 一 26/09 62,000 62,000',
  '合計 62,000',
  '支出明細'
].join('\n')), ['101','102','103'],
   '★空白が落ちた行（10126/09）も、101号室として数える');

eq(extractUnits([
  '収入明細',
  '部屋 入居者名',
  '10127/01 0 0 0 0 募集中',
  '10230/12 0 0 0 0 募集中',
  '10399/09 0 0 0 0 募集中'
].join('\n')), ['101','102','103'],
   '西暦が変わっても、空白なしで読める（27/28/99年）');

eq(extractUnits([
  '収入明細',
  '部屋 入居者名',
  '100126/09 0 0 0 0 募集中'
].join('\n')), ['1001'],
   '4桁のお部屋（1001）でも、空白なしで読める');

/* ★ここが肝心です。空白を見なくした分、拾いすぎていないか。 */
eq(extractUnits([
  '収入明細',
  '部屋 入居者名',
  '101 山田 太郎 26/09 65,000 69,400',
  '324,000 16,000 24,200',
  '1234567890',
  '2026年09月分',
  '0120/09/09 お問い合わせ',
  '合計 324,000',
  '支出明細'
].join('\n')), ['101'],
   '★金額（324,000）・長い数字・年月（2026年09月）を拾わない');

eq(extractUnits([
  '収入明細',
  '部屋 入居者名',
  '1 / 1',
  '12 / 3',
  '101 山田 太郎 26/09 65,000'
].join('\n')), ['101'], 'ページ番号（1 / 1・12 / 3）を拾わない');

eq(extractUnits([
  '収入明細',
  '部屋 入居者名',
  '00126/09 駐車場 11,000',
  '101 山田 太郎 26/09 65,000'
].join('\n')), ['101'],
   '空白が落ちた駐車場の行は、やはりお部屋にしない');

/* ── ④ 同じお部屋を二重に数えない（ページをまたぐ物件） ───── */
console.log('\n④ 同じお部屋を二重に数えない');
eq(extractUnits([
  '収入明細',
  '部屋 入居者名',
  '101 山田 太郎 26/09 65,000',
  '101 山田 太郎 26/09 65,000',
  '102 佐藤 一 26/09 62,000'
].join('\n')), ['101','102'], '同じ101号室が2行あっても、1室');

/* ── ⑤ 西暦が変わっても数えられる ───────────────── */
console.log('\n⑤ 西暦が変わっても止まらない');
[26, 27, 28, 30, 99].forEach(yy => {
  eq(extractUnits(page([
    occupied('101','山田 太郎', yy), vacant('102', yy), occupied('103','佐藤 一', yy)
  ])), ['101','102','103'], '20' + yy + '年の明細でも 3室');
});

/* ── ⑥ 落ちない ─────────────────────────── */
console.log('\n⑥ こわれた入力でも落ちない');
eq(extractUnits(''), [], '空の文字 → 空（0室）');
eq(extractUnits(null), [], 'null → 空');
eq(extractUnits(undefined), [], 'undefined → 空');
eq(extractUnits('収入明細'), [], '見出しだけ → 空');
eq(extractUnits('日本語だけ\nお世話になっております'), [], '日本語だけ → 空');
eq(extractUnits('収入明細\n/////\n1/1/1/1'), [], 'スラッシュだけ → 空');

/* ── ⑦ pvUnitsOf：オーナー様ごとのまとめ ─────────── */
console.log('\n⑦ オーナー様ごとのまとめ（window.pvUnitsOf）');
const P = (prop, units, vac) => ({ property:prop, units:units, vac:vac || [] });

let r = pvUnitsOf({ props:[ P('A棟', ['101','102','103','105','106']) ] });
ok(r.ok === true && r.units === 5, '1棟5室 → 全5室' );
eq(r.by, [{ prop:'A棟', units:5 }], '棟ごとの内訳も返す');

r = pvUnitsOf({ props:[
  P('A棟', ['101','102','103','105','106']),
  P('B棟', ['101','102','201','202','301','302'])
] });
ok(r.ok === true && r.units === 11, '2棟まとめ → 11室（5＋6）');
eq(r.by, [{ prop:'A棟', units:5 }, { prop:'B棟', units:6 }], '2棟の内訳');

r = pvUnitsOf({ props:[ P('A棟', ['101','102','103'],
     [{ room:'102', type:'募集中' }, { room:'103', type:'解約予定' }]) ] });
ok(r.ok === true && r.units === 3, '募集中と解約予定があっても、総戸数は3室');

/* ── ⑧ ★つじつまが合わないときは、入居率を出さない ───── */
console.log('\n⑧ ★つじつまが合わないときは、率をいっさい出さない');

r = pvUnitsOf({ props:[ P('A棟', [], [{ room:'102', type:'募集中' }]) ] });
ok(r.ok === false, '表が読めないのに募集中だけ読めた → 出さない');
ok(/読めません/.test(r.why), '理由を返す（' + r.why + '）');

r = pvUnitsOf({ props:[ P('A棟', ['101','102'], [{ room:'305', type:'募集中' }]) ] });
ok(r.ok === false, '募集中の部屋番号が、表に無い → 出さない');
ok(/305/.test(r.why), '理由に部屋番号が入る（' + r.why + '）');

r = pvUnitsOf({ props:[ P('A棟', ['1001','1002'],
     [{ room:'001', type:'募集中' }]) ] });
ok(r.ok === false,
   '★4桁のお部屋（1001）で、募集中が3桁（001）に読めたとき → 出さない');

r = pvUnitsOf({ props:[ P('A棟', ['101','102'],
     [{ room:'', type:'解約予定', date:'2026年09月30日' }]) ] });
ok(r.ok === false, '解約予定の部屋番号が読めていない（空） → 出さない');

r = pvUnitsOf({ props:[ P('A棟', ['101','102','103']),
                        P('B棟', [], [{ room:'201', type:'募集中' }]) ] });
ok(r.ok === false, '2棟のうち1棟が読めない → まとめて出さない（片方だけ出さない）');

r = pvUnitsOf({ props:[] });
ok(r.ok === false && r.units === 0, '物件が1つも無い → 出さない');
r = pvUnitsOf({});
ok(r.ok === false, 'props が無い → 出さない（落ちない）');
r = pvUnitsOf(null);
ok(r.ok === false, 'null → 出さない（落ちない）');

/* ── ⑨ 年間収支表のみの物件は、そっと飛ばす ─────────── */
console.log('\n⑨ 年間収支表のみの物件は、そっと飛ばす');
r = pvUnitsOf({ props:[ P('A棟', ['101','102','103']), P('B棟', [], []) ] });
ok(r.ok === true && r.units === 3,
   '収入明細が無く、募集中も無い物件は飛ばす → 3室のまま');
eq(r.by, [{ prop:'A棟', units:3 }], '飛ばした物件は、内訳にも入れない');

/* ── ⑩ 同じお部屋が募集中と解約予定の両方にあっても、こわれない ── */
console.log('\n⑩ 同じお部屋が2度出てきても、こわれない');
r = pvUnitsOf({ props:[ P('A棟', ['101','102'],
     [{ room:'102', type:'募集中' }, { room:'102', type:'解約予定' }]) ] });
ok(r.ok === true && r.units === 2, '102号室が2度出ても、総戸数は2室のまま');

/* ── ⑪ 送る中身に units／unitsBy が入っているか ────────── */
console.log('\n⑪ マイページへ送る中身');
ok(/units\s*:\s*occ\.ok\s*\?\s*occ\.units/.test(tmp),
   'js/tomypage.js が units を送っている');
ok(/unitsBy\s*:\s*occ\.ok\s*\?\s*occ\.by/.test(tmp),
   'js/tomypage.js が unitsBy（棟ごと）を送っている');
ok(/window\.pvUnitsOf\(d\)/.test(tmp),
   '総戸数は pvUnitsOf で数えている（別の数え方を作っていない）');
ok((tmp.match(/window\.pvUnitsOf\(d\)/g) || []).length === 1,
   '数えるのは1回だけ（同じ数えを2度しない）');

/* ★★ここは、いちど私が間違えたところです。
 *  pvUnitsOf は js/ownermail.js にあります。tomypage.js から
 *  いきなり呼ぶと、ownermail.js が読み込まれていない場面で
 *  TypeError になり、**マイページへ送る処理そのものが止まります**。
 *  （検査 tinv／tmon は tomypage.js だけを読み込むので、実際に止まりました。）
 *  入居率は「あると嬉しいもの」で、明細を送ることが本体です。
 *  本体を、おまけで止めることはできません。 */
ok(/typeof\s+window\.pvUnitsOf\s*===\s*'function'/.test(tmp),
   '★★pvUnitsOf は「あれば使う」になっている（無くても送信は止まらない）');

/* ── ⑫ 読めなかったとき、PIVOT2 の画面で分かるか ───────── */
console.log('\n⑫ 読めなかったとき、押す前に気づけるか');
ok(/室数が読めません/.test(src),
   'オーナーカードに「室数が読めません」と出す');
ok(/全\s*\$\{_u\.units\}\s*室/.test(src) || /全 \$\{_u\.units\} 室/.test(src),
   'オーナーカードに「全 ○ 室」と出す（送る前に目で確かめられる）');
ok(/d\.units\s*=\s*extractUnits\(bodyLines\)/.test(src),
   'parsePage が extractUnits を呼んでいる');
ok(/units:\[\.\.\.\(d\.units\|\|\[\]\)\]/.test(src.replace(/\s/g, '')) ||
   /units:\[\.\.\.\(d\.units\s*\|\|\s*\[\]\)\]/.test(src),
   'buildDetail が units を引き継いでいる');
ok(/cur\.units\.indexOf\(u\)\s*<\s*0/.test(src),
   'ページをまたぐ物件で、同じお部屋を二重に数えない');
ok(/units:p\.units/.test(src.replace(/\s/g, '')),
   '画面を閉じて開きなおしても、総戸数が残る（localStorage に保存）');

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
