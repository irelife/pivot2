/* ★★ 明細PDFから「募集中・解約予定」を読み取る検査（extractVac）
 *
 *  【なぜ要るか】
 *  ここには、西暦が「26」で決め打ちされていました。
 *      /(\d{3})\s*26\/\d{2}[\s\d,]*?募集中/
 *  明細の「入／退」の欄は 26/09（2026年9月）の形です。年が変わると、
 *      ・募集中の部屋　　　 … 1件も見つからない
 *      ・解約予定の部屋番号 … 空になる
 *  エラーは出ません。オーナー様への定型文から【募集中】の節が黙って消え、
 *  解約予定は部屋番号なしで送られます。2027年1月に、そうなるところでした。
 *
 *  この検査は「年が変わっても読める」ことを、年をまたいで確かめます。
 *
 *  使いかた：  node tests/tvac.cjs
 */
const fs   = require('fs');
const path = require('path');

const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const src = fs.readFileSync(path.join(DIR, 'js/ownermail.js'), 'utf8');

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
const body = cut('extractVac');
if (!body) {
  console.log('❌ extractVac が見つかりません（js/ownermail.js の関数名を変えていませんか）');
  console.log('PASS=0 FAIL=1');
  process.exit(1);
}
const extractVac = new Function(body + '; return extractVac;')();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); }
                       else   { fail++; console.log('  ❌ ' + m); } };
const eq = (g, w, m) => ok(JSON.stringify(g) === JSON.stringify(w),
                           m + '（' + JSON.stringify(g) + '）');

/* ── 本物の明細に近い形を作ります ──────────────
 *  ownermail.js は、ページの文字から改行を取ってから渡しています。
 *  同じ形で渡します。
 *    ・入っている部屋 … 部屋番号 お名前 入／退 賃料 …
 *    ・空いている部屋 … 部屋番号 入／退 0 … 募集中   （お名前が無い）
 *    ・解約予定　　　 … 入っている部屋の行の備考に書かれる
 */
function sheet(yy){
  return '部屋 氏名 入/退 賃料 共益費 駐車料 合計額 備考' +
    ' 101 山田 太郎 ' + yy + '/09 65,000 3,000 4,400 72,400' +
    ' 102 ' + yy + '/09 0 0 0 0 募集中' +
    ' 103 佐藤 一 ' + yy + '/09 62,000 3,000 4,400 69,400' +
    ' 解約予定 解約日：20' + yy + '年09月30日' +
    ' 105 鈴木 花 ' + yy + '/09 67,000 4,000 5,500 76,500' +
    ' 合計 194,000 10,000 14,300 218,300 1 / 1';
}

console.log('\n── ★★ 年が変わっても読めるか ──');
/* 2026（いままで動いていた年）と、そのあとの年ぜんぶ */
[['26', '2026年（これまで）'], ['27', '2027年'], ['28', '2028年'],
 ['30', '2030年'], ['99', '2099年']].forEach(function(p){
  const v = extractVac(sheet(p[0]));
  const boshu = v.filter(x => x.type === '募集中').map(x => x.room);
  const kaiya = v.filter(x => x.type === '解約予定');
  ok(boshu.length === 1 && boshu[0] === '102',
     p[1] + ' … 募集中の部屋が読める（' + JSON.stringify(boshu) + '）');
  ok(kaiya.length === 1 && kaiya[0].room === '103',
     p[1] + ' … 解約予定の部屋番号が読める（' +
     JSON.stringify(kaiya.map(x => x.room)) + '）');
});

console.log('\n── 解約予定・退去予定の日付 ──');
{
  const v = extractVac(sheet('27'));
  const k = v.filter(x => x.type === '解約予定')[0];
  eq(k.date, '2027年09月30日', '解約日を、そのまま持つ');
}
{
  const t = '101 山田 太郎 27/09 65,000 退去予定 退去日：2027年10月15日 合計 1 / 1';
  const v = extractVac(t);
  eq(v.length, 1, '退去予定も1件として読む');
  eq(v[0].type, '解約予定', '★退去予定は「解約予定」としてまとめる（これまでどおり）');
  eq(v[0].room, '101', '部屋番号も読める');
}

console.log('\n── 拾いすぎないか ──');
{
  /* ★年のところをゆるめたことで、よけいなものを拾っていないかを見ます */
  const t = '部屋 氏名 入/退 賃料 合計額 備考' +
            ' 101 山田 太郎 27/09 65,000 3,000 68,000' +
            ' 合計 65,000 3,000 68,000 1 / 1';
  eq(extractVac(t), [], '★満室の棟では、1件も拾わない');
}
{
  const t = '101 山田 太郎 27/09 1,234,567 2,345,678 合計 1 / 12';
  eq(extractVac(t), [], '★金額やページ番号を、日付と読み違えない');
}
{
  const t = '〒721-0963 TEL 084-999-5383 FAX 084-999-5386 2.8kw 合計';
  eq(extractVac(t), [], '★郵便番号・電話番号を、日付と読み違えない');
}
{
  /* ★空いている部屋の行には、入居者のお名前が入りません。
       お名前が入っている行は「入居中」なので、拾いません。 */
  const t = '101 27/09 0 0 募集中 102 27/09 0 0 募集中';
  const v = extractVac(t).filter(x => x.type === '募集中').map(x => x.room);
  eq(v, ['101', '102'], '募集中が2つあれば、2つとも読む');
}
{
  const t = '101 山田 太郎 27/09 65,000 3,000 68,000 募集中';
  eq(extractVac(t).filter(x => x.type === '募集中'), [],
     '★入居者のお名前がある行は、募集中として拾わない');
}
{
  const t = '102 27/09 0 0 募集中 102 27/10 0 0 募集中';
  const v = extractVac(t).filter(x => x.type === '募集中');
  eq(v.length, 1, '★同じ部屋が2度出ても、1件にまとめる');
}

console.log('\n── こわれた入力でも落ちないか ──');
[['', '空'], ['あいうえお', '日本語だけ'], ['////', 'スラッシュだけ'],
 ['募集中', '部屋番号も日付も無い「募集中」']].forEach(function(p){
  let got = null, threw = false;
  try{ got = extractVac(p[0]); }catch(e){ threw = true; }
  ok(!threw && Array.isArray(got), p[1] + ' … 落ちない');
});

console.log('\n── ★★ 西暦の決め打ちが、戻っていないか ──');
ok(!/\b26\\\/\\d\{2\}/.test(src) && src.indexOf('26\\/\\d{2}') < 0,
   '★ownermail.js に「26/」の決め打ちが残っていない');

console.log('\nPASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
