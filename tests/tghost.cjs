/* 「幻の予約さがし」（ghost.html）が、写り込んだ予約を正しく見つけるかを確かめます。 */
const fs = require('fs');
const path = require('path');
const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const html = fs.readFileSync(path.join(DIR, 'ghost.html'), 'utf8');

/* ghost.html の中から、さがす部分だけ取り出して動かします */
const a = html.indexOf('function nrm(v){');
const b = html.indexOf('/* ---------------------------------------------------------------\n   ログイン');
if (a < 0 || b < 0) { console.log('❌ さがす部分が見つかりません'); console.log('PASS=0 FAIL=1'); process.exit(1); }
const code = html.slice(a, b);
const findGhosts = new Function(code + '; return findGhosts;')();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

/* ── ① マーベラスで実際に起きていた形 ───────────────── */
{
  const blds = { b1: { name:'マーベラス', spots:[
    { no:1, type:'縦', tou:'A', room:'101', user:'池本 葵', status:'借',
      res_user:'春名 幸輝', res_date:'2026-10-11', res_price:5500, res_srcKey:'cX' },
    { no:6, type:'縦', tou:'B', room:'101', user:'岩室 陽治', status:'解',
      res_user:'春名 幸輝', res_date:'2026-10-11', res_price:5500, res_srcKey:'cX' },
    { no:7, type:'縦', tou:'B', room:'102', user:'芝﨑 祐介', status:'借' },
  ]}};
  const cts = { cX: { id:'cX', property:'マーベラス', parking:'6', tou:'B', room:'101',
                      contractor:'春名 幸輝', contractDate:'2026-10-11' } };
  const r = findGhosts(blds, cts);
  ok(r.checked === 1, '写り込みを1件見つける');
  ok(r.ghosts.length === 1, '本物と幻を見分けられる');
  ok(r.unknown.length === 0, '「決められない」には入らない');
  const g = r.ghosts[0] || {};
  ok(g.real && g.real.no === 6, '本物は P06（契約の駐車場欄が「6」）');
  ok(g.ghost && g.ghost.no === 1, '幻は P01');
  ok(g.bld === 'マーベラス' && g.room === '101', '物件名と号室が出る');
}

/* ── ② 同じ棟の本物の縦列ペアは、幻あつかいしない ────── */
{
  const blds = { b1: { name:'アシンプトート', spots:[
    { no:5, type:'縦', tou:'A', room:'203', res_user:'春名 育典', res_date:'2026-10-01' },
    { no:6, type:'縦', tou:'A', room:'203', res_user:'春名 育典', res_date:'2026-10-01' },
  ]}};
  const r = findGhosts(blds, { c1:{ property:'アシンプトート', parking:'5・6', contractor:'春名 育典' } });
  ok(r.risky === 0 && r.checked === 0, '同じ棟のペアは、そもそも対象にしない');
}

/* ── ③ 片方だけ予約があるときは、写り込みではない ────── */
{
  const blds = { b1: { name:'テスト', spots:[
    { no:1, type:'縦', tou:'A', room:'101', res_user:'山田 太郎', res_date:'2026-11-01' },
    { no:6, type:'縦', tou:'B', room:'101' },
  ]}};
  const r = findGhosts(blds, {});
  ok(r.risky === 1, '棟ちがい・同じ号室の組としては数える');
  ok(r.checked === 0, '片方だけなら、写り込みとはしない');
}

/* ── ④ 予約者が違えば、写り込みではない ───────────── */
{
  const blds = { b1: { name:'テスト', spots:[
    { no:1, type:'縦', tou:'A', room:'101', res_user:'山田 太郎', res_date:'2026-11-01' },
    { no:6, type:'縦', tou:'B', room:'101', res_user:'佐藤 花子', res_date:'2026-11-01' },
  ]}};
  ok(findGhosts(blds, {}).checked === 0, '予約者が別なら、写り込みとはしない');
}

/* ── ⑤ 契約が見つからないときは「決められない」へ ────── */
{
  const blds = { b1: { name:'テスト', spots:[
    { no:1, type:'縦', tou:'A', room:'101', res_user:'山田 太郎', res_date:'2026-11-01' },
    { no:6, type:'縦', tou:'B', room:'101', res_user:'山田 太郎', res_date:'2026-11-01' },
  ]}};
  const r = findGhosts(blds, {});
  ok(r.checked === 1 && r.ghosts.length === 0 && r.unknown.length === 1,
     '契約が無ければ、勝手に決めつけず「決められない」に入れる');
}

/* ── ⑥ 並列（縦列でない）は対象外 ─────────────────── */
{
  const blds = { b1: { name:'テスト', spots:[
    { no:1, type:'並', tou:'A', room:'101', res_user:'山田 太郎', res_date:'2026-11-01' },
    { no:6, type:'並', tou:'B', room:'101', res_user:'山田 太郎', res_date:'2026-11-01' },
  ]}};
  ok(findGhosts(blds, {}).risky === 0, '並列どうしは、そもそも写り込まないので対象外');
}

/* ── ⑦ 契約の駐車場欄が「5・6」のように複数でも読める ── */
{
  const blds = { b1: { name:'テスト', spots:[
    { no:2, type:'縦', tou:'A', room:'101', res_user:'山田 太郎', res_date:'2026-11-01' },
    { no:6, type:'縦', tou:'B', room:'101', res_user:'山田 太郎', res_date:'2026-11-01' },
  ]}};
  const r = findGhosts(blds, { c1:{ property:'テスト', parking:'P6・9', contractor:'山田 太郎' } });
  ok(r.ghosts.length === 1 && r.ghosts[0].ghost.no === 2, '「P6・9」を読んで、P02 を幻と見分ける');
}

/* ── ⑧ 台帳が空でも落ちない ─────────────────────── */
{
  const r = findGhosts({}, {});
  ok(r.checked === 0 && r.ghosts.length === 0, '物件が0件でも落ちない');
}

console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail === 0 ? 0 : 1);
