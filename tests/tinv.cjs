/* ★★ ［マイページへ送る］の検査
 *
 *   ①［マイページの登録状況］で、招待済み／未招待が分かるか
 *   ② チェックが0のとき、いきなり全員に送らないか
 *   ③ チェックした1名だけに送るか
 *   ④ 送ったあと、その方が「招待済み」に変わるか
 *
 *   ★②が、いちばん大事な検査です。
 *     2026/9/23 まで、チェックを見ずに「アドレスがある方 全員」に
 *     送っていました。1名で試すつもりで押すと、その場で全員に
 *     初回パスワードのメールが飛びます。取り消せません。
 *
 *   使いかた：  node tests/tinv.cjs
 */
/* どこでも動くように：playwright があればそれを、無ければ playwright-core */
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const D=__dirname+'/';
let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✅ '+m);} else {fail++;console.log('  ❌ '+m);} };
(async()=>{
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let dialogs=[];
  p.on('dialog', async d => { dialogs.push({type:d.type(), msg:d.message()});
    if (d.type()==='confirm') { await (p.__accept ? d.accept() : d.dismiss()); }
    else await d.accept(); });
  await p.goto('file://'+D+'tinv.html');
  /* ★tomypage.js は 1200ms 待ってからボタンを置きます（画面の切り替えに備えて）。
       出るまで待ちます。 */
  await p.waitForSelector('#btn-to-mypage', { timeout:10000 });

  console.log('\n── ボタンが出るか ──');
  ok(await p.isVisible('#btn-to-mypage'), '［マイページへ送る］がある');
  ok(await p.isVisible('#btn-mypage-inv'), '★［マイページの登録状況］がある');
  /* ★置き場所。オーナー様の一覧より下だと、見つけられません。 */
  const where = await p.evaluate(()=>{
    const kids=[...document.getElementById('view-send').children].map(x=>x.id||x.className||'(無名)');
    const w = document.getElementById('btn-to-mypage').parentNode;
    return { kids:kids, idx:kids.indexOf(w.id||w.className||'(無名)'),
             bar:kids.indexOf('bar'), rows:kids.indexOf('rows') };
  });
  console.log('    view-send の中身:', where.kids.join(' → '));
  ok(where.idx === where.bar + 1,
     '★［一斉送信］のすぐ下にある（' + (where.bar+1) + '番目）');
  ok(where.idx < where.rows,
     '★オーナー様の一覧より「上」にある（下だと見つけられません）');

  console.log('\n── ① 登録状況（招待済み・未招待）──');
  await p.click('#btn-mypage-inv');
  await p.waitForSelector('#tmp-inv', { timeout:5000 });
  await p.waitForTimeout(200);
  let v = await p.evaluate(()=>{
    const t=document.querySelector('#tmp-inv table');
    return { head: document.querySelector('#tmp-inv p').textContent.trim(),
      rows: [...t.querySelectorAll('tbody tr')].map(tr =>
        [...tr.querySelectorAll('td')].map(td=>td.textContent.trim())) };
  });
  console.log('    見出し:', v.head);
  v.rows.forEach(r=>console.log('    ', r.join(' | ')));
  ok(/まだ招待していないオーナー様が 3 名/.test(v.head),
     '★未招待が3名と出る（鈴木・私・アドレス無し。★別管理の森本様は数えない）');
  ok(v.rows[0][2]==='招待済み',     '山田様は 招待済み');
  ok(v.rows[1][2]==='未招待',       '★鈴木様は 未招待');
  ok(v.rows[2][2]==='未招待',       '★私（テスト）は 未招待');
  ok(v.rows[3][2]==='アドレス未登録','アドレス無しの方は その旨');
  ok(v.rows[0][3]==='2026/9/20',    '最終ログインが出る');

  console.log('\n── ② チェック0のとき、いきなり全員に送らないか ──');
  dialogs=[]; p.__accept=false;                 /* キャンセルします */
  await p.click('#btn-to-mypage'); await p.waitForTimeout(600);
  ok(dialogs.length===1 && /全員/.test(dialogs[0].msg),
     '★「全員に送りますか？」と必ず聞く');
  ok(/1名だけお試し/.test(dialogs[0].msg), '★1名だけ試す方法も書いてある');
  let sent = await p.evaluate(()=>window.__sent.filter(x=>x.action==='push').length);
  ok(sent===0, '★キャンセルしたので、1名も送っていない');

  console.log('\n── ②-2 ★別管理（除外）の方に、招待メールが飛ばないか ──');
  ok(v.rows.length===5, '表には別管理の方も出る（5行）');
  ok(v.rows[4][2]==='対象外（別管理）',
     '★別管理の方は「対象外（別管理）」と出る（「未招待」ではない）');
  ok(!/まだ招待していないオーナー様が 4 名/.test(v.head),
     '★別管理の方を「未招待」に数えない（招待し忘れに見えてしまうため）');
  /* チェック0で「全員」に送るとき、別管理の方が混ざらないか */
  dialogs=[]; p.__accept=false;
  await p.click('#btn-to-mypage'); await p.waitForTimeout(600);
  const zen = dialogs[0] ? dialogs[0].msg : '';
  console.log('    「全員」の確認:', zen.split('\n').filter(x=>/名/.test(x)).join(' / '));
  ok(/ある 3 名/.test(zen),
     '★「全員」でも 3 名（山田・鈴木・私）。別管理の森本様とアドレス無しは入らない');
  ok(!/森本/.test(zen), '★確認の文に森本様が出てこない');

  console.log('\n── ③ 私（テスト）1名だけにチェックして送る ──');
  await p.evaluate(()=>{ document.querySelector('.rent-check[value="2"]').checked = true; });
  dialogs=[]; p.__accept=true;
  await p.click('#btn-to-mypage');
  await p.waitForSelector('#tmp-board', { timeout:8000 });
  await p.waitForTimeout(400);
  const pushes = await p.evaluate(()=>window.__sent.filter(x=>x.action==='push'));
  console.log('    送った相手:', pushes.map(x=>x.owners[0].email).join(' , '));
  ok(pushes.length===1, '★通信は1名ぶんだけ');
  ok(pushes[0].owners[0].email==='me@example.jp', '★送った相手は、私だけ');
  const cf = dialogs.find(d=>/対象/.test(d.msg));
  console.log('    確認の文:\n' + (cf? cf.msg.split('\n').map(x=>'      '+x).join('\n') : '(なし)'));
  ok(cf && /対象： 1 名/.test(cf.msg), '★「対象 1名」と出る');
  ok(cf && /私（テスト）/.test(cf.msg), '★お名前が出る');
  ok(cf && /はじめての方　 1 名/.test(cf.msg), '★はじめての方が1名と出る');
  ok(cf && /すでに登録済み 0 名/.test(cf.msg), '★登録済みは0名と出る');

  const bd = await p.evaluate(()=>{
    const t=document.querySelector('#tmp-board table');
    return { head: document.querySelector('#tmp-board p').textContent.trim(),
      cols: [...t.querySelectorAll('thead th')].map(x=>x.textContent.trim()),
      rows: [...t.querySelectorAll('tbody tr')].map(tr=>
        [...tr.querySelectorAll('td')].map(td=>td.textContent.trim())) };
  });
  console.log('    結果の表:', bd.cols.join(' | '));
  bd.rows.forEach(r=>console.log('              ', r.join(' | ')));
  ok(bd.rows.length===1, '★結果の表も1名だけ');
  ok(bd.cols.indexOf('開設のご案内')>=0, '「開設のご案内」の列がある');
  ok(bd.rows[0][2]==='お送りしました', '★案内メールを送った、と出る');

  console.log('\n── ③-0 ★async のPDFを、待ってから送れているか ──');
  await p.evaluate(()=>{
    /* 本物と同じ async。少し時間もかかる形にします */
    window.RENT.makeOwnerPdfBase64 = async function(){
      await new Promise(r=>setTimeout(r,120));
      return window.__B64;
    };
    window.__sent.length = 0;
  });
  dialogs=[]; p.__accept=true;
  await p.evaluate(()=>{ document.querySelector('.rent-check[value="0"]').checked = true;
                         document.querySelector('.rent-check[value="1"]').checked = false;
                         document.querySelector('.rent-check[value="2"]').checked = false; });
  await p.click('#btn-to-mypage');
  await p.waitForSelector('#tmp-board', { timeout:8000 });
  await p.waitForTimeout(400);
  const put = await p.evaluate(()=>{
    const x = window.__sent.filter(v=>v.action==='putPdf')[0] || null;
    const t = document.querySelector('#tmp-board table');
    return { sent:x ? { type:typeof x.b64, len:(x.b64||'').length,
                        head:String(x.b64||'').slice(0,12) } : null,
             pdfTxt: t ? [...t.querySelectorAll('tbody tr td')].pop().textContent.trim() : '' };
  });
  console.log('    putPdf に送った b64:', JSON.stringify(put.sent));
  console.log('    表の「明細PDF」欄  :', put.pdfTxt);
  ok(put.sent && put.sent.type === 'string',
     '★b64 が「文字列」で送られている（約束のままではない）');
  ok(put.sent && put.sent.len > 100, '★中身がある（' + (put.sent?put.sent.len:0) + '字）');
  ok(put.sent && put.sent.head === 'JVBERi0xLjQK', '★PDFの先頭の字が合っている');
  ok(put.pdfTxt === '入りました', '★表は「入りました」');

  console.log('\n── ③-0b ★形がおかしい文字列は、送らないか ──');
  await p.evaluate(()=>{
    window.RENT.makeOwnerPdfBase64 = async function(){ return { なにか:'約束の中身ではない' }; };
    window.__sent.length = 0;
  });
  dialogs=[]; p.__accept=true;
  await p.click('#btn-to-mypage');
  await p.waitForTimeout(2000);
  const bad = await p.evaluate(()=>{
    const t = document.querySelector('#tmp-board table');
    return { put: window.__sent.filter(v=>v.action==='putPdf').length,
             pdfTxt: t ? [...t.querySelectorAll('tbody tr td')].pop().textContent.trim() : '' };
  });
  console.log('    putPdf を送った回数:', bad.put, '／表:', bad.pdfTxt);
  ok(bad.put === 0, '★形がおかしいものは、そもそも送らない');
  ok(/正しくありません/.test(bad.pdfTxt), '★「当社の不具合です」と正直に出す');

  console.log('\n── ③-1 ★PDFが入らなかったとき、理由を捨てないか ──');
  await p.evaluate(()=>{ window.__pdfng = true;
    window.RENT.makeOwnerPdfBase64 = async function(){ return window.__B64; }; });
  dialogs=[]; p.__accept=true;
  await p.evaluate(()=>{ document.querySelector('.rent-check[value="0"]').checked = true;
                         document.querySelector('.rent-check[value="2"]').checked = false; });
  await p.click('#btn-to-mypage');
  await p.waitForTimeout(2000);
  const why = await p.evaluate(()=>{
    const t=document.querySelector('#tmp-board table');
    return t ? [...t.querySelectorAll('tbody tr')].map(tr=>
      [...tr.querySelectorAll('td')].map(td=>td.textContent.trim())) : null;
  });
  console.log('    表:', why ? why[0].join(' | ') : '(なし)');
  ok(why && /DRIVE_ID/.test(why[0][4]),
     '★マイページ側が返した理由（DRIVE_ID…）を、そのまま表に出す');
  ok(why && why[0][4] !== '入りませんでした',
     '★「入りませんでした」だけで済ませない（原因さがしが始められないため）');
  await p.evaluate(()=>{ window.__pdfng = false;
    window.RENT.makeOwnerPdfBase64 = async function(){ return null; }; });

  console.log('\n── ③-2 ★通信できなかったとき、嘘をつかないか ──');
  await p.evaluate(()=>{
    window.__netng = true;
    const f = window.fetch;
    window.fetch = function(u, o){
      if(window.__netng) return Promise.reject(new TypeError('Failed to fetch'));
      return f(u, o);
    };
  });
  dialogs=[]; p.__accept=true;
  await p.evaluate(()=>{ document.querySelector('.rent-check[value="1"]').checked = true;
                         document.querySelector('.rent-check[value="2"]').checked = false; });
  await p.click('#btn-to-mypage');
  await p.waitForTimeout(2500);
  const ng = await p.evaluate(()=>{
    const t=document.querySelector('#tmp-board table');
    if(!t) return null;
    return { rows:[...t.querySelectorAll('tbody tr')].map(tr=>
               [...tr.querySelectorAll('td')].map(td=>td.textContent.trim())),
             note: [...document.querySelectorAll('#tmp-board p')].pop().textContent.trim() };
  });
  console.log('    表:', ng ? ng.rows.map(r=>r.join(' | ')).join(' / ') : '(なし)');
  ok(!!ng, '結果の表は出る');
  ok(ng && ng.rows[0][1] === '分かりません',
     '★アカウントの欄は「分かりません」（「もとからあります」と嘘をつかない）');
  ok(ng && /通信できませんでした/.test(ng.rows[0][3]), '明細は「通信できませんでした」');
  ok(ng && /つながっていない/.test(ng.note),
     '★下の一言で「1回もつながっていない」と伝える');
  ok(ng && /メールも出ていません/.test(ng.note),
     '★「ご案内メールも出ていません」と、はっきり伝える');
  /* ★英語のまま出さないか */
  const alerts = dialogs.filter(d=>d.type==='alert').map(d=>d.msg);
  ok(!alerts.some(m=>/Failed to fetch/.test(m)),
     '★「Failed to fetch」をそのまま出さない');
  ok(alerts.some(m=>/アクセスできるユーザー/.test(m)) ||
     (ng && /つながっていない/.test(ng.note)),
     '★何を確かめればよいかを日本語で出す');
  await p.evaluate(()=>{ window.__netng = false; });

  console.log('\n── ④ もう一度［登録状況］を押すと、招待済みに変わるか ──');
  await p.click('#btn-mypage-inv');
  await p.waitForTimeout(800);
  v = await p.evaluate(()=>[...document.querySelectorAll('#tmp-inv tbody tr')]
      .map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim())));
  console.log('    私（テスト）:', v[2].join(' | '));
  ok(v[2][2]==='招待済み', '★私（テスト）が「招待済み」に変わった');
  ok(v[1][2]==='未招待',   '鈴木様は、まだ未招待のまま');

  console.log('\nJS の不具合:', errs.length ? errs : 'なし');
  ok(errs.length===0, 'JS の不具合なし');
  console.log('\nPASS='+pass+' FAIL='+fail);
  await b.close();
  process.exit(fail?1:0);
})();
