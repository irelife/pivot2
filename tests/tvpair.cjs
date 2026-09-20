/* 縦列ペア連動が「棟」まで見ているかを確かめる。
   A棟101 と B棟101 のように号室だけ偶然そろった別区画へ、予約が写らないこと。 */
const fs = require('fs');
const path = require('path');
const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const src = fs.readFileSync(path.join(DIR, 'js/buildings.js'), 'utf8');

// saveBld の中の (function syncVerticalPairReservations(){ ... })(); を取り出す
const start = src.indexOf('(function syncVerticalPairReservations(){');
if (start < 0) { console.log('❌ syncVerticalPairReservations が見つかりません'); console.log('PASS=0 FAIL=1'); process.exit(1); }
const end = src.indexOf('})();', start);
const sync = new Function('spots', src.slice(start, end + 5));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✅ ' + msg); } else { fail++; console.log('  ❌ ' + msg); } };

// ① マーベラスで起きた形（A棟101 と B棟101）
{
  const spots = [
    { no:1, type:'縦', tou:'A', room:'101', user:'池本 葵',   price:4400, status:'借' },
    { no:6, type:'縦', tou:'B', room:'101', user:'岩室 陽治', price:4400, status:'解',
      res_user:'春名 幸輝', res_date:'2026-10-11', res_price:5500, res_srcKey:'c-haruna' },
  ];
  sync(spots);
  ok(!spots[0].res_user,   'A棟101 に B棟101 の予約が写らない');
  ok(!spots[0].res_srcKey, 'A棟101 に紐づけキーが写らない');
  ok(spots[1].res_user === '春名 幸輝', 'B棟101 の予約はそのまま残る');
}

// ② 本当の縦列ペア（同じ棟・同じ号室）は今までどおり連動する
{
  const spots = [
    { no:3, type:'縦', tou:'A', room:'205', price:4400, status:'空',
      res_user:'山田 太郎', res_date:'2026-11-01', res_price:5500, res_srcKey:'c-yamada' },
    { no:4, type:'縦', tou:'A', room:'205', price:4400, status:'空' },
  ];
  sync(spots);
  ok(spots[1].res_user === '山田 太郎',  '同じ棟の縦列ペアには予約が写る');
  ok(spots[1].res_date === '2026-11-01', '予約日も写る');
  ok(spots[1].res_srcKey === 'c-yamada', '紐づけキーも写る');
}

// ③ 棟が両方とも空のときも、今までどおりペアとして扱う
{
  const spots = [
    { no:1, type:'縦', tou:'', room:'302', price:3300, status:'空',
      res_user:'佐藤 花子', res_date:'2026-12-01' },
    { no:2, type:'縦', tou:'', room:'302', price:3300, status:'空' },
  ];
  sync(spots);
  ok(spots[1].res_user === '佐藤 花子', '棟が両方とも空なら今までどおりペア');
}

// ④ 片方だけ棟が入っているときは、ペアにしない
{
  const spots = [
    { no:1, type:'縦', tou:'A', room:'401', res_user:'田中 一郎', res_date:'2026-10-05' },
    { no:2, type:'縦', tou:'',  room:'401' },
  ];
  sync(spots);
  ok(!spots[1].res_user, '棟が片方だけのときはペアにしない');
}

// ⑤ 種別が縦列でなければ連動しない（元からの決まり）
{
  const spots = [
    { no:1, type:'並', tou:'A', room:'101', res_user:'誰か', res_date:'2026-10-01' },
    { no:2, type:'並', tou:'A', room:'101' },
  ];
  sync(spots);
  ok(!spots[1].res_user, '並列どうしは連動しない');
}

console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail === 0 ? 0 : 1);
