/* 日割りの検査。お金の計算なので、手で出した答えと1円単位で突き合わせます。
   きまり（お客様のご指定 A）
     ・月ごとに、その月の実日数でわる
     ・両端入れ（9/15〜10/5 は21日）
     ・月ごとに切り捨て

   ★2026/10/6 … 数えかたを、契約書で確かめました。

       管理委託契約書：「解約日（賃貸借契約の終了日）の**翌日**」から数える

     ですので **解約日は数に入れません**（初日不算入）。
       7月1日に解約 → 7月2日が1日目 → 9月29日が90日目 → 9月30日から保証

     ★この日、いちど「解約日が1日目」に変えかけました。画面の文言に
       「解約日から**起算して**」と書いてあったためです。
       **その文言のほうが誤りでした。** 文言は直しました。
       ここを変えるときは、必ず契約書の条文を確かめてください。 */
const { chromium } = (function(){ try{ return require('playwright'); }
                                  catch(e){ return require('playwright-core'); } })();
const fs = require('fs'), path = require('path');
let PASS = 0, FAIL = 0;
function ok(n, c, got){ if(c){ PASS++; console.log('  ✅ ' + n); }
  else { FAIL++; console.log('  ❌ ' + n + '  → ' + JSON.stringify(got)); } }
/* 配列・オブジェクトを、そのままくらべます */
function eqj(got, want, n){ ok(n, JSON.stringify(got) === JSON.stringify(want), got); }

const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));
const TMP = '/tmp/claude-0/_wari';

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  /* hosho.js の中の関数を、そのまま取り出して動かします（写しません） */
  const src = fs.readFileSync(require('path').join(DIR, 'js/hosho.js'), 'utf8');
  fs.writeFileSync(path.join(TMP, 'hosho.js'), src);
  fs.writeFileSync(path.join(TMP, 'i.html'),
    '<!doctype html><meta charset="utf-8"><body>' +
    '<div id="tou-addr-section"></div>' +
    '<script>window.openModal=function(){};window.saveBld=function(){};' +
    'window.saveAll=function(){};window.loadAll=function(){return {};};<\/script>' +
    '<script src="hosho.js"><\/script>');

  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.message)));
  await pg.goto('file://' + path.join(TMP, 'i.html'));
  await new Promise(r => setTimeout(r, 300));

  /* hosho.js は IIFE なので、中の関数は外から呼べません。
     同じ計算式をここで組み立てず、ファイルの中身をそのまま評価して
     必要な関数だけ取り出します。 */
  const api = await pg.evaluate((code) => {
    const grab = code.replace(/\}\)\(\);?\s*$/, '') +
      '\n; window.__t = { planOf:planOf, splitRange:splitRange, startDay:startDay,' +
      ' endDay:endDay, termOf:termOf, monthYen:monthYen, partYen:partYen,' +
      ' span:span, ymd:ymd, day:day, mon1:mon1, plus:plus, plusM:plusM,' +
      ' sumOf:sumOf, mEnd:mEnd, monthPay:monthPay, firstBill:firstBill, overPay:overPay, nth:nth, lateMonths:lateMonths };\n})();';
    // eslint-disable-next-line no-eval
    (0, eval)(grab);
    return !!window.__t;
  }, src);
  ok('★ hosho.js の中の計算を取り出せた（写しではありません）', api, api);

  const calc = (r, from) => pg.evaluate(([r, from]) => {
    const t = from ? window.__t.termOf(from) : null;
    return { plan: window.__t.planOf(r, t),
             st: window.__t.ymd(window.__t.startDay(r)),
             en: window.__t.ymd(window.__t.endDay(r, t)) };
  }, [r, from]);

  /* 月ごとの内わけ（画面に出るもの）。日割りの決まりは、ここで見ます */
  const split = (r, from) => pg.evaluate(([r, from]) => {
    const t  = from ? window.__t.termOf(from) : null;
    const st = window.__t.startDay(r), en = window.__t.endDay(r, t);
    if(!st || !en) return [];
    return window.__t.splitRange(r, st, en)
             .map(x => ({ m: x.y + '-' + ('0' + x.mo).slice(-2), y: x.yen }));
  }, [r, from]);

  console.log('\n❶ ご指定の例：9/15〜10/5、募集賃料 65,000円');
  /* 6/16 解約 → ＋91日 = 9/15 から保証 ／ 10/6 契約 → 10/5 まで */
  {
    const r = { room:'101', out:'2026-06-16', rent:65000, sign:'2026-10-06' };
    const g = await calc(r, '');
    console.log('     保証期間: ' + g.st + ' 〜 ' + g.en);
    console.log('     月別: ' + JSON.stringify(g.plan));
    ok('★★ 9/15 から保証（解約日6/16の翌日を1日目で91日目）', g.st === '2026-09-15', g.st);
    ok('★★ 10/5 まで（契約日の前日）', g.en === '2026-10-05', g.en);
    /* 手計算：65000×0.30 = 19500
       9月 9/15〜9/30 = 16日 ／ 30日 → 19500×16/30 = 10400
       10月 10/1〜10/5 = 5日 ／ 31日 → 19500×5/31 = 3145.16… → 3145 */
    const sp  = await split(r, '');
    const m9  = sp.find(x => x.m === '2026-09');
    const m10 = sp.find(x => x.m === '2026-10');
    ok('★★ 9月分 10,400円', m9 && m9.y === 10400, m9);
    ok('★★ 10月分 3,145円（切り捨て）', m10 && m10.y === 3145, m10);
    const total = sp.reduce((a, x) => a + x.y, 0);
    ok('★★ 合計 13,545円', total === 13545, total);
    ok('★ 月は2つだけ', sp.length === 2, sp);
    /* ★ LINE へ渡す「送金予定」は、15日に実際に送る額です。
         9/15から保証なので、端数は別に送らず、10月15日にまとめて送ります。 */
    ok('★★ 送金予定は1回だけ（10月15日）', g.plan.length === 1, g.plan);
    ok('★★ その額は 13,545円（9/15〜10/5 をまとめて）',
       g.plan[0] && g.plan[0].m === '2026-10' && g.plan[0].y === 13545, g.plan[0]);
  }

  console.log('\n❷ まるまる1か月の月は、満額（日割りしない）');
  {
    /* 6/16 解約 → 9/15 から ／ 2027/1/6 契約 → 2027/1/5 まで */
    const r = { room:'102', out:'2026-06-16', rent:65000, sign:'2027-01-06' };
    const g  = await calc(r, '');
    const sp = await split(r, '');
    const m10 = sp.find(x => x.m === '2026-10');
    const m11 = sp.find(x => x.m === '2026-11');
    const m12 = sp.find(x => x.m === '2026-12');
    console.log('     月別: ' + JSON.stringify(sp));
    console.log('     送金予定: ' + JSON.stringify(g.plan));
    /* 送金予定の10月は、9月の端数（9/15〜9/30 の 10,400円）が足されます */
    const p10 = g.plan.find(x => x.m === '2026-10');
    ok('★★ 送金予定の10月は 29,900円（19,500＋9月の端数 10,400）',
       p10 && p10.y === 29900, p10);
    const p11 = g.plan.find(x => x.m === '2026-11');
    ok('★★ 送金予定の11月は 19,500円（満額）', p11 && p11.y === 19500, p11);
    ok('★★ 10月（31日ぜんぶ）は満額 19,500円', m10 && m10.y === 19500, m10);
    ok('★★ 11月（30日ぜんぶ）も満額 19,500円', m11 && m11.y === 19500, m11);
    ok('★★ 12月（31日ぜんぶ）も満額 19,500円', m12 && m12.y === 19500, m12);
    ok('★ 月の日数が違っても、満額は同じ（30日でも31日でも）',
       m10.y === m11.y && m11.y === m12.y, [m10.y, m11.y, m12.y]);
  }

  console.log('\n❸ 両端入れ');
  {
    /* 9/15 から 9/15 まで（1日だけ）。65000×0.3×1/30 = 650 */
    const r = { room:'103', out:'2026-06-16', rent:65000, sign:'2026-09-16' };
    const g = await calc(r, '');
    const sp = await split(r, '');
    ok('★★ 1日だけでも 0円にならない（両端入れ）',
       sp.length === 1 && sp[0].y === 650, sp);
    ok('★★ 送金は翌月15日に1回（650円）',
       g.plan.length === 1 && g.plan[0].m === '2026-10' && g.plan[0].y === 650, g.plan);
  }

  console.log('\n❹ 2月（28日・29日）');
  {
    /* 2027年2月は28日。11/5 解約 → ＋91日 = 2027/2/4 から */
    const r = { room:'201', out:'2026-11-05', rent:65000, sign:'2027-03-01' };
    const g  = await calc(r, '');
    const sp = await split(r, '');
    const m2 = sp.find(x => x.m === '2027-02');
    console.log('     保証期間: ' + g.st + ' 〜 ' + g.en + ' ／ ' + JSON.stringify(sp));
    /* 2/4〜2/28 = 25日 ／ 28日 → 19500×25/28 = 17410.7… → 17410 */
    ok('★★ 2月は28日でわる（25日ぶん 17,410円）', m2 && m2.y === 17410, m2);
  }

  console.log('\n❺ 契約が決まっていないとき');
  {
    const r = { room:'104', out:'2026-06-16', rent:65000, sign:'' };
    const g = await calc(r, '');
    ok('★ 終わりが決まらないので、24か月ぶんまで', g.plan.length <= 24 && g.plan.length > 0,
       g.plan.length);
    ok('★ 送金の先頭は 2026-10（9/15から。端数は10月にまとめる）',
       g.plan[0] && g.plan[0].m === '2026-10', g.plan[0]);
    ok('★ 先頭は 29,900円（19,500＋9月の端数 10,400）',
       g.plan[0] && g.plan[0].y === 29900, g.plan[0]);
  }

  console.log('\n❻ 管理開始日から2年で打ち切り');
  {
    /* 管理開始 2025-01-10 → 満了 2027-01-09 */
    const r = { room:'105', out:'2026-06-16', rent:65000, sign:'' };
    const g = await calc(r, '2025-01-10');
    console.log('     保証期間: ' + g.st + ' 〜 ' + g.en);
    ok('★★ 2027/1/9 で終わる（管理開始から2年）', g.en === '2027-01-09', g.en);
    const last = g.plan[g.plan.length - 1];
    ok('★★ 最後の月は 2027-01', last && last.m === '2027-01', last);
    /* 1/1〜1/9 = 9日 ／ 31日 → 19500×9/31 = 5661.2… → 5661 */
    ok('★★ その月は日割り 5,661円', last && last.y === 5661, last);
  }

  console.log('\n❼ 出さない場合');
  {
    const a = await calc({ room:'106', out:'', rent:65000, sign:'' }, '');
    ok('★ 解約日が無ければ、空', a.plan.length === 0, a.plan);
    const b2 = await calc({ room:'107', out:'2026-06-16', rent:0, sign:'' }, '');
    ok('★ 募集賃料が無ければ、空', b2.plan.length === 0, b2.plan);
    /* 保証が始まる前に契約が決まった */
    const c = await calc({ room:'108', out:'2026-06-16', rent:65000, sign:'2026-08-01' }, '');
    ok('★★ 保証が始まる前に決まったら、0件（払いません）', c.plan.length === 0, c.plan);
  }

  console.log('\n❾ ★数えかた（解約日の翌日が1日目）── 契約書で確認ずみ');
  {
    /* ★2026/10/6 契約書で確かめました。
         「解約日（賃貸借契約の終了日）の**翌日**」から数える
       ★この日、画面の文言が「解約日から起算して」となっていたため、
         いちど「解約日が1日目」に変えかけました。文言のほうが誤りでした。
         ここを守るための検査です。勝手に変えないでください。 */
    const n = (out, at) => pg.evaluate(([out, at]) =>
      window.__t.nth({ out:out }, window.__t.day(at)), [out, at]);
    const st = (out) => pg.evaluate((out) =>
      window.__t.ymd(window.__t.startDay({ out:out })), out);

    ok('★★ 7/1に解約 → 7/1 は 0日目（解約日は数に入れない）',
       await n('2026-07-01', '2026-07-01') === 0, await n('2026-07-01','2026-07-01'));
    ok('★★ 7/1に解約 → 7/2 が 1日目（翌日が1日目）',
       await n('2026-07-01', '2026-07-02') === 1, await n('2026-07-01','2026-07-02'));
    ok('★★ 7/1に解約 → 9/29 が 90日目（免責の最後）',
       await n('2026-07-01', '2026-09-29') === 90, await n('2026-07-01','2026-09-29'));
    ok('★★ 7/1に解約 → 9/30 が 91日目（保証のはじまり）',
       await n('2026-07-01', '2026-09-30') === 91, await n('2026-07-01','2026-09-30'));
    ok('★★ 保証開始は 9/30（9/29 ではありません）',
       await st('2026-07-01') === '2026-09-30', await st('2026-07-01'));
    ok('★ 2026/10/6 は 97日目（98日目ではありません）',
       await n('2026-07-01', '2026-10-06') === 97, await n('2026-07-01','2026-10-06'));
    ok('★ 解約日より前は 0日目',
       await n('2026-07-01', '2026-06-30') === 0, await n('2026-07-01','2026-06-30'));

    /* 月末・うるう年・年またぎの境目 */
    ok('★ 1/31に解約 → 保証開始 5/2（2026年）',
       await st('2026-01-31') === '2026-05-02', await st('2026-01-31'));
    ok('★ 2028年はうるう年。1/1に解約 → 保証開始 4/1',
       await st('2028-01-01') === '2028-04-01', await st('2028-01-01'));
    ok('★ 2026年は平年。1/1に解約 → 保証開始 4/2',
       await st('2026-01-01') === '2026-04-02', await st('2026-01-01'));
    ok('★ 12/31に解約 → 年をまたいで 2027/4/1',
       await st('2026-12-31') === '2027-04-01', await st('2026-12-31'));

    /* ★画面の文言が、計算と食いちがっていないか */
    const lead = await pg.evaluate(() => {
      const s = document.querySelector('.hs-lead');
      return s ? s.textContent.replace(/\s+/g, '') : '';
    });
    ok('★★ 画面に「起算して」と書かない（誤解のもとでした）',
       lead.indexOf('起算') < 0, lead.slice(0, 60));
  }

  console.log('\n❿ ★払いすぎ（15日に送ったあとで契約が決まった）2026/10/6 新設');
  {
    const over = (r, at, from) => pg.evaluate(([r, at, from]) => {
      const t = from ? window.__t.termOf(from) : null;
      const o = window.__t.overPay(r, window.__t.day(at), t);
      return o ? { m:o.mo, yen:o.yen, paid:o.paid, real:o.real, days:o.days,
                   from:window.__t.ymd(o.from), to:window.__t.ymd(o.to) } : null;
    }, [r, at, from]);

    /* ご指示の例：10月15日に満額を送金 → 10月25日に契約が決まった
       募集賃料 52,000 → 月額保証 15,600
       本来 10/1〜10/24 = 24日 ／ 31日 → 52000×0.3×24/31 = 12077.4… → 12077
       払いすぎ = 15600 − 12077 = 3,523 */
    const r = { room:'A105', out:'2026-05-01', rent:52000, sign:'2026-10-25' };
    const o = await over(r, '2026-10-31', '');
    console.log('     ' + JSON.stringify(o));
    ok('★★ 払いすぎが出る', !!o, o);
    ok('★★ 10月分', o && o.m === 10, o);
    ok('★★ 送った額 15,600円（満額）', o && o.paid === 15600, o);
    ok('★★ 本来の額 12,077円（10/1〜10/24・24日）', o && o.real === 12077, o);
    ok('★★ 払いすぎ 3,523円（引き算で出す。日割りし直さない）',
       o && o.yen === 3523, o);
    ok('★★ 10/25〜10/31 の 7日ぶん',
       o && o.from === '2026-10-25' && o.to === '2026-10-31' && o.days === 7, o);

    /* ★15日までに決まっていれば、15日の送金で日割り済み → 払いすぎなし */
    ok('★★ 10/10 に決まった → 払いすぎなし（15日の送金で日割り済み）',
       await over({ room:'A105', out:'2026-05-01', rent:52000, sign:'2026-10-10' },
                  '2026-10-31', '') === null,
       await over({ room:'A105', out:'2026-05-01', rent:52000, sign:'2026-10-10' },
                  '2026-10-31', ''));
    ok('★ ちょうど15日に決まった → 払いすぎなし（当日は間に合う）',
       await over({ room:'A105', out:'2026-05-01', rent:52000, sign:'2026-10-15' },
                  '2026-10-31', '') === null, null);
    ok('★★ 16日に決まった → 払いすぎが出る',
       (await over({ room:'A105', out:'2026-05-01', rent:52000, sign:'2026-10-16' },
                   '2026-10-31', '')) !== null, null);

    /* ★まだ15日が来ていなければ、送っていないので払いすぎなし */
    ok('★★ きょうが10/14（送金前）→ 払いすぎを出さない',
       await over(r, '2026-10-14', '') === null, await over(r, '2026-10-14', ''));

    /* ★月末に決まった（1日だけ減る） */
    const o31 = await over({ room:'B', out:'2026-05-01', rent:52000, sign:'2026-10-31' },
                           '2026-10-31', '');
    /* 本来 10/1〜10/30 = 30日／31日 → 15096.7… → 15096 ／ 15600−15096 = 504 */
    ok('★★ 10/31に決まった → 1日ぶん 504円', o31 && o31.yen === 504 && o31.days === 1, o31);

    /* ★保証が始まる前に決まったら、そもそも送っていません */
    ok('★ 保証開始前に決まった → 払いすぎなし',
       await over({ room:'C', out:'2026-09-01', rent:52000, sign:'2026-10-25' },
                  '2026-10-31', '') === null,
       await over({ room:'C', out:'2026-09-01', rent:52000, sign:'2026-10-25' },
                  '2026-10-31', ''));

    /* ★こわれた入力 */
    ok('★ 契約日が空 → なし',
       await over({ room:'D', out:'2026-05-01', rent:52000, sign:'' }, '2026-10-31','') === null, null);
    ok('★ 解約日が空 → なし',
       await over({ room:'E', out:'', rent:52000, sign:'2026-10-25' }, '2026-10-31','') === null, null);
    ok('★ 募集賃料が0 → なし',
       await over({ room:'F', out:'2026-05-01', rent:0, sign:'2026-10-25' }, '2026-10-31','') === null, null);

    /* ★はじめての請求月に決まった場合（前月の端数が入る月） */
    /* 6/16解約 → 9/15から保証。はじめの請求は10月15日（9/15〜10/31＝29,900円）
       10/25に決まった → 本来は 9/15〜10/24
         9月 10,400 ＋ 10月 24日/31 → 19500×24/31 = 15096.7… → 15096 ＝ 25,496
       払いすぎ = 29,900 − 25,496 = 4,404 */
    const oF = await over({ room:'G', out:'2026-06-16', rent:65000, sign:'2026-10-25' },
                          '2026-10-31', '');
    console.log('     はじめての請求月: ' + JSON.stringify(oF));
    ok('★★ はじめての請求月でも正しい（29,900 − 25,496 = 4,404円）',
       oF && oF.paid === 29900 && oF.real === 25496 && oF.yen === 4404, oF);
  }

  console.log('\n⓫ ★入力が遅れたときの注意（2026/10/6 ご指示・案2）');
  {
    const late = (r, at) => pg.evaluate(([r, at]) =>
      window.__t.lateMonths(r, window.__t.day(at), null), [r, at]);

    /* 5/1解約 → 7/31から保証。10/25に契約が決まった。
       募集賃料 52,000 → 月額保証 15,600 */
    const r = { room:'A105', out:'2026-05-01', rent:52000, sign:'2026-10-25' };

    console.log('\n  ── 遅れていないとき（注意を出してはいけません）──');
    eqj(await late(r, '2026-10-26'), [], '★★ 翌日に入力 → 注意なし');
    eqj(await late(r, '2026-10-31'), [], '★★ 月内に入力 → 注意なし');
    eqj(await late(r, '2026-11-02'), [],
        '★★ 翌月2日に入力 → 注意なし（11/15 をまだ過ぎていない）');
    eqj(await late(r, '2026-11-15'), [{ y:2026, mo:11, yen:15600 }],
        '★ 11/15 ちょうど → その日に送るので、ここから出す');

    console.log('\n  ── 遅れたとき（出さなければいけません）──');
    const L1 = await late(r, '2026-11-20');
    eqj(L1, [{ y:2026, mo:11, yen:15600 }],
        '★★ 11/20 に入力 → 11月分 15,600円');
    const L2 = await late(r, '2026-12-20');
    eqj(L2, [{ y:2026, mo:11, yen:15600 }, { y:2026, mo:12, yen:15600 }],
        '★★ 12/20 に入力 → 11月・12月の2か月ぶん');
    ok('★★ 合計 31,200円', L2.reduce((a, x) => a + x.yen, 0) === 31200,
       L2.reduce((a, x) => a + x.yen, 0));

    console.log('\n  ── 出してはいけないとき ──');
    eqj(await late({ room:'C', out:'2026-09-01', rent:52000, sign:'2026-10-25' },
                   '2026-12-20'), [],
        '★★ 保証が始まる前に決まった → 1円も送っていないので、注意なし');
    eqj(await late({ room:'D', out:'2026-05-01', rent:52000, sign:'' },
                   '2026-12-20'), [], '★ 契約日が空 → なし');
    eqj(await late({ room:'E', out:'', rent:52000, sign:'2026-10-25' },
                   '2026-12-20'), [], '★ 解約日が空 → なし');
    eqj(await late({ room:'F', out:'2026-05-01', rent:0, sign:'2026-10-25' },
                   '2026-12-20'), [], '★ 募集賃料が0 → なし');

    console.log('\n  ── 2年の満了をまたぐとき ──');
    /* 管理開始 2024-12-01 → 満了 2026-11-30。12月は保証がもう無い */
    const L3 = await pg.evaluate(() => {
      const t = window.__t.termOf('2024-12-01');
      return window.__t.lateMonths(
        { room:'G', out:'2026-05-01', rent:52000, sign:'2026-10-25' },
        window.__t.day('2026-12-20'), t);
    });
    eqj(L3, [{ y:2026, mo:11, yen:15600 }],
        '★★ 満了（2026/11/30）より後の12月は、出さない');
  }

  console.log('\n❽ 画面のエラー');
  ok('★ エラーなし', errs.length === 0, errs);

  console.log('\n' + (FAIL ? '❌ 穴があります' : '✅ 合格') + '  PASS=' + PASS + '  FAIL=' + FAIL);
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
