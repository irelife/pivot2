/* ★ 検査をまとめて走らせる係
 *
 *   使いかた：
 *     node tests/run-all.cjs              … このリポジトリを検査します
 *     node tests/run-all.cjs /別の/場所    … よその場所を検査します
 *
 *   1件でも失敗したら、終了コード 1 で終わります。
 *   GitHub Actions は、これを見て「赤」にします。
 */
const { execFileSync } = require('child_process');
const path = require('path');

const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..'));

const SUITES = [
  ['tbasic',    '基本の保存（入力が消えない・前に戻らない・端末間で同じ）'],
  ['tsafe',     '件数が減る保存を止める'],
  ['thollow',   '中身だけ空になる保存を止める（物件）'],
  ['thollowct', '中身だけ空になる保存を止める（契約）'],
  ['tpart',     '部品ごとの指紋（変わったところだけ送る）'],
  ['tspot',     '区画の同時編集'],
  ['tcache',    'クラウドに届いていないのを見破る'],
  ['tunsent',   '未送信の知らせと、自動の送り直し'],
  ['tnofb',     'クラウドが使えないときでも動く'],
  ['tblock',    '行き止まりにならない'],
  ['tbox',      '件数を見るための「から箱」が、データとして書かれない'],
  ['tstuck',    '控えが落ちても、Firestore には保存できる（永久に詰まらない）'],
  ['tthin',     '層を減らしても、守りが弱くならない'],
  ['tlogo',     '画面まわり'],
];

let ngList = [];
console.log('検査する場所: ' + DIR);
console.log('');

for (const [name, what] of SUITES) {
  process.stdout.write('▶ ' + name + '  ' + what + ' … ');
  let out = '';
  let ng = false;
  try {
    out = execFileSync(process.execPath, [path.join(__dirname, name + '.cjs'), DIR],
                       { encoding: 'utf8', timeout: 5 * 60 * 1000 });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
    ng = true;
  }
  const m = out.match(/PASS=(\d+)\s+.*?FAIL=(\d+)/);
  const pass = m ? Number(m[1]) : 0;
  const fail = m ? Number(m[2]) : -1;
  if (fail !== 0) ng = true;

  console.log(ng ? ('❌ 合格' + pass + ' / 失敗' + (fail < 0 ? '?' : fail))
                 : ('✅ 合格' + pass));
  if (ng) {
    ngList.push(name);
    console.log('--- ' + name + ' の中身 ---');
    console.log(out.split('\n').filter(l => /❌|PASS=|エラー/.test(l)).join('\n'));
    console.log('--- ここまで ---');
  }
}

console.log('');
if (ngList.length === 0) {
  console.log('✅ すべて合格しました。');
  process.exit(0);
}
console.log('❌ 失敗した検査: ' + ngList.join(', '));
process.exit(1);
