/* ［マイページへ送る］が、オーナーカードの「物件名」もいっしょに送るかの検査。
 *
 *   【なぜ要るか】
 *   2026/10/2 のご指摘：
 *     「これどこで物件を拾っていますか？新規の物件ができたときは
 *      入力しないといけないですか？PIVOT2のオーナー情報の物件所有
 *      から引っ張れたら間違いないのですが。」
 *
 *   マイページの物件の候補は、明細PDFに出てきた物件だけでした。
 *   明細は「送金のあった物件」しか載りません。買ったばかりの物件や、
 *   全室空室で送金の立たなかった物件は、マイページに1件も出ず、
 *   保険をお預けになるときに手打ちしていただく形でした。
 *
 *   ここでは、オーナーカードの「物件名」が props として送られることと、
 *   一覧が読めないときでも落ちないことを見張ります。
 *
 * 使いかた： node tests/tprops.cjs
 */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'tomypage.js'), 'utf8');

/* 中の cardProps / ownNm だけを取り出して動かします。
   画面にも通信にも触らない部分なので、これで検査できます。 */
function box(owners){
  const a = SRC.indexOf('function ownNm(');
  const b = SRC.indexOf('/* ── 1件ぶんを、マイページの形に直します');
  if (a < 0 || b < 0 || b < a) throw new Error('取り出す場所が見つかりません');
  const code = SRC.slice(a, b);
  const window = (owners === undefined) ? {} : { RENT_CORE: { owners: owners } };
  return new Function('window', code + '; return { ownNm, cardProps };')(window);
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); }
                       else   { fail++; console.log('  ❌ ' + m); } };
const same = (a, e, m) =>
  ok(JSON.stringify(a) === JSON.stringify(e), m + '（' + JSON.stringify(a) + '）');

const OWNERS = [
  { name:'Turnkey合同会社', email:'lui37sei@gmail.com',
    properties:['マーベラスA棟','マーベラスB棟','ルミエール静A棟',
                'ルミエール静B棟','ハイサニー B','ハイサニー A'] },
  { name:'山田 太郎', email:'yamada@example.jp',
    properties:[], property:'カルムコート東棟、カルムコート西棟' },
  { name:'鈴木 花子', email:'', properties:['ナディア　A'] }
];

console.log('\n── オーナーカードの物件名を拾う ──');
{
  const B = box(OWNERS);
  same(B.cardProps({ email:'lui37sei@gmail.com', owner:'Turnkey合同会社' }),
       OWNERS[0].properties, 'アドレスで見つけて、6件そのまま送る');

  same(B.cardProps({ email:'LUI37SEI@GMAIL.COM', owner:'' }),
       OWNERS[0].properties, '★大文字のアドレスでも見つける');

  same(B.cardProps({ email:'', owner:'Turnkey合同会社' }),
       OWNERS[0].properties, '★アドレスが無ければ、お名前で見つける');

  same(B.cardProps({ email:'', owner:'ＴｕｒｎｋｅｙＧ' }), [],
       '別の方は、拾わない');

  same(B.cardProps({ email:'yamada@example.jp' }),
       ['カルムコート東棟','カルムコート西棟'],
       '★古い書き方（1行に「、」区切り）も読める');

  same(B.cardProps({ email:'', owner:'鈴木 花子' }), ['ナディア　A'],
       'アドレス未登録の方も、お名前で拾える');

  same(B.cardProps({ email:'nobody@example.jp' }), [],
       '一覧にいない方は、空で返す（当てずっぽうにしない）');
}

console.log('\n── 一覧が読めないとき ──');
{
  same(box(undefined).cardProps({ email:'lui37sei@gmail.com' }), [],
       '★オーナー画面をまだ開いていなくても、落ちずに空を返す');
  same(box(null).cardProps({ email:'lui37sei@gmail.com' }), [],
       '★一覧が null でも、落ちずに空を返す');
  same(box([]).cardProps({ email:'lui37sei@gmail.com' }), [],
       '一覧が空でも、落ちない');
  same(box(OWNERS).cardProps(null), [], '★相手が無くても落ちない');
  same(box(OWNERS).cardProps({}), [], '中身が空でも落ちない');
}

console.log('\n── 物件名のそろえかた（ownNm）──');
{
  const B = box(OWNERS);
  ok(B.ownNm('ハイサニー　Ａ') === B.ownNm('ハイサニーA'),
     '★全角・空白ちがいを同じと見る');
  ok(B.ownNm('  Marvelous  ') === 'marvelous', '前後の空白を取り、小文字にする');
  ok(B.ownNm(null) === '' && B.ownNm(undefined) === '', '空でも落ちない');
}

console.log('\n── 送る形（shape）に props が入っているか ──');
{
  ok(/props\s*:\s*cardProps\(d\)/.test(SRC),
     '★shape の返す形に props: cardProps(d) がある');
  ok(SRC.indexOf('out.indexOf(v) < 0') > 0, '同じ物件名は1件にまとめる');
}

console.log('\nPASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
