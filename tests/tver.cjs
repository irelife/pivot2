/* ★★ 「?v= の上げ忘れ」を捕まえる検査
 *
 *   index.html は、こう書いています。
 *       <script src="js/store.js?v=39"></script>
 *
 *   この番号を上げないと、端末は前のファイルを使い続けます。
 *   つまり、どんなに正しく直しても 1台にも届きません。
 *
 *   実際に2回やらかしました。
 *     ・9/15 … gasOk の直しを入れたのに ?v= が 33 のままで、届かなかった
 *     ・9/16 … 同じことを、もう一度
 *
 *   人が気をつけるのをやめて、仕組みで捕まえます。
 *
 *   使いかた： node tests/tver.cjs [場所] [くらべる相手]
 *     くらべる相手を省くと origin/main です。
 */
const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR  = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const BASE = process.argv[3] || process.env.PV_BASE || 'origin/main';

let P=0,F=0;
const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+x):''));} };

function git(args){
  return execFileSync('git', args, { cwd: DIR, encoding:'utf8' });
}
/* index.html から「ファイル名 → 版番号」を取り出します */
function vers(html){
  const m = {}, re = /<script\s+src="(js\/[^"?]+\.js)\?v=(\d+)"/g;
  let g;
  while((g = re.exec(html))) m[g[1]] = parseInt(g[2], 10);
  return m;
}

console.log('くらべる相手: ' + BASE);

let baseHtml = null, changed = [];
try{
  baseHtml = git(['show', BASE + ':index.html']);
  changed  = git(['diff', '--name-only', BASE, '--', 'js/'])
               .split('\n').map(s=>s.trim()).filter(s=>/\.js$/.test(s));
}catch(e){
  /* くらべる相手が無いときは、検査そのものを飛ばします（はじめての取り込みなど） */
  console.log('\n  ⏭  ' + BASE + ' が見つからないので、この検査は飛ばします');
  console.log('\nPASS=0  FAIL=0');
  process.exit(0);
}

const nowHtml = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const nowV = vers(nowHtml), baseV = vers(baseHtml);

console.log('\n❶ index.html の書きかた');
ok('★ 版番号つきの読み込みがある（' + Object.keys(nowV).length + '本）', Object.keys(nowV).length > 0);

console.log('\n❷ ★ 中身を直したファイルは、版番号も上がっているか');
if(!changed.length){
  console.log('  （js/ に変更はありません）');
}
changed.forEach(f=>{
  const b = baseV[f], n = nowV[f];
  if(b === undefined && n === undefined){
    ok('★ ' + f + ' … index.html から読んでいません（版番号は不要）', true);
    return;
  }
  if(n === undefined){
    ok('★ ' + f + ' の版番号', false, 'index.html に ?v= がありません');
    return;
  }
  if(b === undefined){
    ok('★ ' + f + ' … 新しいファイル（?v=' + n + '）', true);
    return;
  }
  ok('★★ ' + f + ' を直したので、?v= を ' + b + ' → ' + n + ' に上げた',
     n > b, '?v=' + b + ' のままです。このままだと、直しが1台にも届きません');
});

console.log('\n❸ 版番号を上げたのに、中身を直していないもの（念のため）');
let odd = 0;
Object.keys(nowV).forEach(f=>{
  if(baseV[f] !== undefined && nowV[f] > baseV[f] && changed.indexOf(f) < 0){
    console.log('  ⚠️  ' + f + ' … ?v= だけ上がっています（' + baseV[f] + '→' + nowV[f] + '）');
    odd++;
  }
});
ok('★ 版番号だけ上がったものは無い', odd === 0, odd + '件');

console.log('\nPASS='+P+'  FAIL='+F);
process.exit(F?1:0);
