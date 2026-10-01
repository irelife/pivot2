/* ★★ 毎月の明細を、マイページへ送る（2026/10/1）
 *
 *  ご指示：
 *    「PIVOT2→オーナーマイページへ毎月明細送付　その際にオーナーの
 *      登録メールアドレス宛に明細を送ったので、下記URLからご確認ください
 *      的な文面が自動で届くようにしたい」
 *    「わかりやすい仕様に」「直感的な操作ができるような」
 *
 *  【改良前 ── ここが欠けていました】
 *    招待済みの方のカードには ☐ 再送付 しかありませんでした。
 *    毎月の明細をマイページに入れるには、それを押すしかなく、
 *    押すと**初回パスワードが作り直されます**。
 *    つまり、毎月の明細を安全に入れる道が1本もありませんでした。
 *
 *  【改良後】
 *    ☑ 今月の明細 を足し、ご利用中の方は**はじめから入れておきます**。
 *    毎月の手順は
 *        ① 明細PDFを取り込む  ②［マイページへ送る］を押す
 *    の2つだけです。パスワードは変わりません。
 *
 *  ★この検査でいちばん大事なのは ❺ です。
 *    「毎月の明細を送っても、パスワードが作り直されないこと」。
 *    ここが崩れると、毎月112名のログインができなくなります。
 *
 *  使いかた： node tests/tmon.cjs
 */
const { chromium } = (function(){
  try{ return require('playwright'); }
  catch(e){ return require('/opt/node22/lib/node_modules/playwright'); }
})();
const D = __dirname + '/';
let P = 0, F = 0;
const ok = (c, m, x) => {
  if (c) { P++; console.log('  ✅ ' + m); }
  else   { F++; console.log('  ❌ ' + m + (x !== undefined ? ('  → ' + JSON.stringify(x)) : '')); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:1280, height:900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let dialogs = [];
  p.on('dialog', async d => {
    dialogs.push({ type:d.type(), msg:d.message() });
    await (p.__accept ? d.accept() : d.dismiss());
  });
  await p.goto('file://' + D + 'tmon.html');
  await p.waitForSelector('#btn-to-mypage', { timeout:10000 });
  await p.waitForTimeout(700);                 /* 札がつくのを待ちます */

  /* いま入っている印を、種類ごとに数えます */
  const marks = () => p.evaluate(() => {
    const out = { mon:0, inv:0, re:0 };
    document.querySelectorAll('.inv-check:checked').forEach(b => {
      const k = b.getAttribute('data-kind'); if (out[k] !== undefined) out[k]++;
    });
    return out;
  });
  const sumTxt = () => p.evaluate(() =>
    (document.getElementById('tmp-sum') || {}).textContent || '');
  const set = (val, kind, on) => p.evaluate((a) => {
    const b = document.querySelector(
      '.inv-check[data-kind="' + a[1] + '"][value="' + a[0] + '"]');
    if (!b) throw new Error('箱がありません: ' + a[0] + ' / ' + a[1]);
    b.checked = a[2]; b.dispatchEvent(new Event('change'));
  }, [val, kind, on]);

  console.log('\n❶ はじめの形（何も触っていないとき）');
  let m = await marks();
  console.log('   印: ' + JSON.stringify(m));
  ok(m.mon === 3, '★★★ご利用中の3名は「今月の明細」が入っている', m);
  ok(m.inv === 0, '★★はじめての2名は、印が入っていない（パスワードは取り消せないため）', m);
  ok(m.re  === 0, '★再送付も入っていない', m);

  console.log('\n❷ ボタンの上の「今月ぶん」');
  let t = await sumTxt();
  console.log('   ' + t.replace(/\s+/g, ' ').trim());
  ok(/送る相手 3 名/.test(t), '★★押す前に、送る相手の数が出ている', t);
  ok(/今月の明細/.test(t) && /3 名/.test(t), '★内わけ（今月の明細 3名）が出る');
  ok(/アドレス未登録/.test(t) && /1 名/.test(t),
     '★★送れない方（アドレス未登録 1名）も出る。直すべき相手だからです');
  ok(/あと 100 通/.test(t), '★★本日あと何通送れるかが出る', t);

  console.log('\n❸ 印を入れ外しすると、その場で数が変わるか');
  await set(3, 'inv', true);                   /* 鈴木様を招待 */
  await p.waitForTimeout(150);
  t = await sumTxt(); m = await marks();
  ok(/送る相手 4 名/.test(t), '★入れたら 3 → 4 名', t);
  ok(/開設のご案内（初回パスワード）が届きます/.test(t),
     '★★その方に何が起きるかも、その場で出る', t);
  await set(3, 'inv', false);
  await p.waitForTimeout(150);
  t = await sumTxt();
  ok(/送る相手 3 名/.test(t), '★外したら 4 → 3 名に戻る', t);

  console.log('\n❹ 「今月の明細」と「再送付」は、同時に入らないか');
  await set(0, 're', true);
  await p.waitForTimeout(150);
  let st = await p.evaluate(() => {
    const mo = document.querySelector('.inv-check[data-kind="mon"][value="0"]');
    const inp = document.querySelector('.inv-mail[data-for="0"]');
    return { monOn:mo.checked, monLock:mo.disabled, mailLock:inp.disabled };
  });
  console.log('   再送付を入れたとき: ' + JSON.stringify(st));
  ok(st.monOn === false, '★★再送付を入れると、今月の明細は外れる', st);
  ok(st.monLock === true, '★★押せなくする（再送付は明細も一緒に入るため）', st);
  ok(st.mailLock === false, '★アドレスの欄は、このときだけ開く', st);
  await set(0, 're', false);
  await p.waitForTimeout(150);
  st = await p.evaluate(() => {
    const mo = document.querySelector('.inv-check[data-kind="mon"][value="0"]');
    const inp = document.querySelector('.inv-mail[data-for="0"]');
    return { monOn:mo.checked, monLock:mo.disabled, mailLock:inp.disabled };
  });
  console.log('   再送付を外したとき: ' + JSON.stringify(st));
  ok(st.monOn === true && st.monLock === false, '★外したら、今月の明細が戻る', st);
  ok(st.mailLock === true, '★★アドレスの欄は、また押せなくなる（うっかり直さないため）', st);

  console.log('\n❺ ★★★毎月の明細を送っても、パスワードが作り直されないか');
  await p.evaluate(() => { window.__sent.length = 0; });
  dialogs = []; p.__accept = true;
  await p.click('#btn-to-mypage');
  await p.waitForTimeout(2600);
  const r = await p.evaluate(() => ({
    push : window.__sent.filter(x => x.action === 'push')
             .map(x => ((x.owners || [])[0] || {}).email),
    res  : window.__sent.filter(x => x.action === 'stResend').length,
    board: (document.getElementById('tmp-board') || {}).textContent || ''
  }));
  const cf = dialogs.find(d => /送る相手/.test(d.msg));
  console.log('   送った相手: ' + r.push.join(' / '));
  console.log('   stResend を呼んだ回数: ' + r.res);
  ok(r.res === 0, '★★★パスワードを作り直す窓口（stResend）を、1回も呼ばない', r.res);
  ok(r.push.length === 3, '★ご利用中の3名ぶんだけ送る', r.push);
  ok(r.push.indexOf('suzuki@example.jp') < 0 && r.push.indexOf('tanaka@example.jp') < 0,
     '★★印の入っていない「はじめての方」には送らない', r.push);
  ok(r.push.indexOf('morimoto@example.jp') < 0,
     '★★別管理の森本様には送らない', r.push);
  ok(cf && !/パスワード/.test(cf.msg),
     '★★確認の文に「パスワード」が出ない（変わらないのだから、出す理由がない）');
  ok(/明細のお知らせ/.test(r.board), '★結果の表に「明細のお知らせ」の列がある');
  ok(/お送りしました/.test(r.board), '★★お知らせを出した、と出る');

  console.log('\n❻ 外した印が、描き直しで戻ってこないか');
  await p.evaluate(() => { window.__sent.length = 0; });
  await set(1, 'mon', false);                  /* 佐藤様だけ外します */
  await p.waitForTimeout(150);
  await p.click('#btn-mypage-inv');            /* 登録状況＝札を描き直します */
  await p.waitForTimeout(1200);
  m = await marks();
  console.log('   描き直したあとの印: ' + JSON.stringify(m));
  ok(m.mon === 2,
     '★★外した印は、描き直しでも戻らない（戻ると、送らないはずの方に送ります）', m);

  console.log('\n❼ 本日の枠が足りないとき');
  await p.goto('file://' + D + 'tmon.html?left=1');
  await p.waitForSelector('#btn-to-mypage', { timeout:10000 });
  await p.waitForTimeout(900);
  t = await sumTxt();
  console.log('   ' + t.split('本日の送信枠')[1]);
  ok(/あと 1 通/.test(t), '★残り1通と出る', t);
  ok(/2 名は届きません/.test(t), '★★何名に届かないかを、押す前に数で出す', t);
  dialogs = []; p.__accept = false;            /* 取り消します */
  await p.click('#btn-to-mypage');
  await p.waitForTimeout(1800);
  const cf2 = dialogs.find(d => /送る相手/.test(d.msg));
  ok(cf2 && /本日あと 1 通しか送れません/.test(cf2.msg),
     '★★確認の窓でも、もう一度伝える', cf2 && cf2.msg);
  const none = await p.evaluate(() =>
    window.__sent.filter(x => x.action === 'push').length);
  ok(none === 0, '★取り消したら、1名も送らない', none);

  console.log('\n❽ 残り通数を聞けないとき（窓口がまだのとき）');
  await p.goto('file://' + D + 'tmon.html?left=none');
  await p.waitForSelector('#btn-to-mypage', { timeout:10000 });
  await p.waitForTimeout(900);
  t = await sumTxt();
  console.log('   ' + t.split('本日の送信枠')[1]);
  ok(/確かめられません/.test(t), '★★読めないときは「確かめられません」（0とは書かない）', t);
  ok(!/あと 0 通/.test(t), '★★★読めないことを「あと0通」と言い換えない');

  ok(errs.length === 0, '　JavaScript の誤りが出ない', errs);
  await p.close(); await b.close();
  console.log('\nPASS=' + P + ' FAIL=' + F);
  process.exit(F ? 1 : 0);
})();
