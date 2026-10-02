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
    if (d.type()==='confirm') {
      /* ★確認が2段のとき（全員に送りますか → 対象○名）を分けて答えます */
      if (p.__cancelMain && /送る相手：/.test(d.message())) await d.dismiss();
      else await (p.__accept ? d.accept() : d.dismiss());
    }
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
             sum:kids.indexOf('tmp-sum'),
             bar:kids.indexOf('bar'), rows:kids.indexOf('rows') };
  });
  console.log('    view-send の中身:', where.kids.join(' → '));
  /* ★2026/10/1 … ［一斉送信］の下に「今月ぶん」のまとめ（#tmp-sum）が
       入りました。その下がボタンです。押す前に数が目に入る並びです。 */
  ok(where.sum === where.bar + 1,
     '★★「今月ぶん」のまとめが［一斉送信］のすぐ下にある');
  ok(where.idx === where.sum + 1,
     '★ボタンは、まとめのすぐ下にある');
  ok(where.idx < where.rows,
     '★オーナー様の一覧より「上」にある（下だと見つけられません）');

  /* ★★★はじめの印（何も触っていない状態）。
       ここで見ないと、あとの検査が印を外したあとの姿を見てしまいます。 */
  const first = await p.evaluate(()=>{
    const out = {};
    document.querySelectorAll('.inv-check').forEach(b=>{
      const k = b.getAttribute('data-kind');
      out[k] = (out[k] || 0) + (b.checked ? 1 : 0);
    });
    return out;
  });
  console.log('    はじめから入っている印:', JSON.stringify(first));
  ok(first.mon === 1,
     '★★★「今月の明細」は、はじめから入っている（毎月の手順を2つにするため）');
  ok(!first.inv,
     '★★★「招待する」は、はじめから入っていない（初回パスワードは取り消せないため）');
  ok(!first.re,
     '★★★「再送付」も、はじめから入っていない（パスワードが作り直されるため）');

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

  console.log('\n── ② ★★印が0のとき、1名にも送らないか ──');
  /*  ★2026/10/1 … 期待を変えました。
   *
   *   改良前は、印が0のときに「全員に送りますか？」とお尋ねし、
   *   ［OK］で全員に送っていました。112名の初回パスワードが
   *   一度に飛ぶ道が、確認1回の先に残っていました。
   *
   *   ご指示（2026/10/1）：
   *     「招待はオーナーカードに招待チェックボックスつけて
   *       チェックしたオーナーだけにする仕様に変更して」
   *
   *   改良後は、その道そのものをなくします。
   *   「OK を押しさえすれば全員に送れる」状態ではなくなりました。 */
  /* ★2026/10/1 … 「今月の明細」がはじめから入るようになったので、
       いったん全部の印を外してから試します。
       ★ここで見たいのは「印が0なら送らない」ことです。 */
  await p.evaluate(()=>{
    document.querySelectorAll('.inv-check').forEach(b=>{
      b.checked = false; b.dispatchEvent(new Event('change')); });
  });
  dialogs=[]; p.__accept=true;                  /* ★OK を押しても送れません */
  await p.click('#btn-to-mypage'); await p.waitForTimeout(600);
  let sent = await p.evaluate(()=>window.__sent.filter(x=>x.action==='push').length);
  ok(sent===0, '★★OK を押しても、1名も送らない');
  ok(dialogs.length===1 && dialogs[0].type==='alert',
     '★確認（confirm）ではなく、お知らせ（alert）で止める');
  ok(dialogs[0] && !/全員/.test(dialogs[0].msg),
     '★★「全員に送りますか」という道が無くなった');
  ok(dialogs[0] && /今月の明細/.test(dialogs[0].msg),
     '★毎月使う印（今月の明細）を、いちばん上に伝える');
  ok(dialogs[0] && /招待する/.test(dialogs[0].msg),
     '★どこに印を入れるかを伝える');
  ok(dialogs[0] && /再送付/.test(dialogs[0].msg),
     '★招待済みの方への送り方（再送付）も伝える');

  console.log('\n── ②-0 ★★オーナーカードの箱（招待／今月の明細／再送付）──');
  /* ★2026/10/1 … 招待済みの方の箱が2つになりました。
   *
   *  【改良前】 招待済みの方には ☐ 再送付 しかありませんでした。
   *            毎月の明細をマイページに入れるには、それを押すしか
   *            なく、押すと初回パスワードが作り直されます。
   *            つまり、毎月の明細を安全に入れる道がありませんでした。
   *  【改良後】 ☑ 今月の明細（はじめから入っている）を足しました。 */
  const cells = await p.evaluate(()=>
    [...document.querySelectorAll('#rows > label')].map(l => {
      const w = l.querySelector('.inv-wrap');
      const bs = [...l.querySelectorAll('.inv-check')];
      return { who: (l.childNodes[1] ? l.childNodes[1].textContent : '').trim(),
               box: bs.map(b=>({mon:'今月の明細', re:'再送付', inv:'招待'}
                                 [b.getAttribute('data-kind')] || '?')).join('＋'),
               on : bs.filter(b=>b.checked).map(b=>b.getAttribute('data-kind')).join(','),
               done: !!(w && w.querySelector('.inv-done')),
               txt: w ? w.textContent.replace(/\s+/g,'') : '' };
    }));
  cells.forEach(c=>console.log('    ', JSON.stringify(c)));
  ok(cells.length===4, 'カードは4枚（別管理の森本様は一覧に出ない）');
  ok(cells[0] && cells[0].done && cells[0].box==='今月の明細＋再送付',
     '★★招待済みの方（山田）は「招待済み」＋ ☑今月の明細 ＋ ☐再送付');

  ok(cells[1] && !cells[1].done && cells[1].box==='招待',
     '★★未招待の方（鈴木）は ☐ 招待');

  ok(cells[2] && cells[2].box==='招待', '★未招待の方（私）は ☐ 招待');
  ok(cells[3] && cells[3].box==='' && /アドレス未登録/.test(cells[3].txt),
     '★アドレス未登録の方には箱を出さない');
  const exBox = await p.evaluate(()=>
    document.getElementById('rent-excluded-section').querySelectorAll('.inv-check').length);
  ok(exBox===0, '★★別管理の区画に、招待の箱を出さない');

  console.log('\n── ②-2 ★別管理（除外）の方に、招待メールが飛ばないか ──');
  ok(v.rows.length===5, '表には別管理の方も出る（5行）');
  ok(v.rows[4][2]==='対象外（別管理）',
     '★別管理の方は「対象外（別管理）」と出る（「未招待」ではない）');
  ok(!/まだ招待していないオーナー様が 4 名/.test(v.head),
     '★別管理の方を「未招待」に数えない（招待し忘れに見えてしまうため）');
  /* ★別管理の方に、印を入れる手だてが無いこと。
       改良前は「全員に送る」という道があり、そこに混ざらないかを
       見ていました。その道が無くなったので、
       「そもそも印を入れられない」ことを見ます。 */
  const exCan = await p.evaluate(()=>{
    const list = window.RENT.detail;
    const boxes = [...document.querySelectorAll('.inv-check')].map(b=>Number(b.value));
    return { boxes: boxes, mori: list.findIndex(d=>/森本/.test(d.owner||'')) };
  });
  console.log('    箱がある番号:', exCan.boxes.join(','), '／森本様の番号:', exCan.mori);
  ok(exCan.boxes.indexOf(exCan.mori) < 0,
     '★★別管理の森本様には、招待の箱そのものが無い（印を入れられない）');

  console.log('\n── ①-2 ★★オーナー一覧のカードに「招待済み」が出るか ──');
  /*  ご指示（2026/10/1）：
   *    「このカード一覧にオーナーマイページ招待済み、と
   *      右上辺りにわかるように記載してほしい」
   *
   *  ★112枚のカードを見ながら「この方はもう招待したか」が分かる
   *    ようにするためのものです。表を開き直さずに分かることが大事です。 */
  await p.waitForTimeout(900);          /* 札が差し込まれるのを待ちます */
  const own = await p.evaluate(()=>
    [...document.querySelectorAll('#ownerCards .ow-card')].map(c => {
      const b = c.querySelector('.ow-head .inv-own');
      return { who: (c.querySelector('.ow-atena')||{}).textContent || '',
               badge: b ? b.textContent.trim() : null,
               inHead: !!b,
               right: b ? getComputedStyle(b).marginLeft : '' };
    }));
  own.forEach(o=>console.log('    ', JSON.stringify(o)));
  ok(own.length === 5, 'カードが5枚ある', own.length);
  ok(own.every(o=>o.inHead), '★札は、カードの上の段（.ow-head）に入っている');
  ok(own.every(o=>o.right === 'auto' || /px$/.test(o.right)),
     '★右寄せになっている（margin-left:auto）', own.map(o=>o.right));
  ok(own[0] && own[0].badge === '招待済み',
     '★★山田様（台帳にある）は「招待済み」', own[0]);
  ok(own[1] && own[1].badge === '未招待',
     '★★鈴木様（台帳に無い）は「未招待」', own[1]);
  ok(own[3] && own[3].badge === 'アドレス未登録',
     '★アドレスが無い方は「アドレス未登録」（招待できない方として分ける）', own[3]);
  /* ★2026/10/1 ご指示：「アドレス未登録、背景黄色文字黒にして」
   *   ここは「当社が直さなければならない方」です。112枚のカードの中で
   *   いちばん先に目に入る色にします。
   *   ★黄色に白い字では読めません（明暗差 1.51）。黒にします（11.83）。 */
  const badgeCol = await p.evaluate(()=>{
    const bs = [...document.querySelectorAll('#ownerCards .ow-head .inv-own')];
    const one = bs.filter(b=>b.textContent.trim()==='アドレス未登録')[0];
    const other = bs.filter(b=>b.textContent.trim()==='未招待')[0];
    const g = e => e ? { bg:getComputedStyle(e).backgroundColor,
                         fg:getComputedStyle(e).color } : null;
    return { nomail:g(one), mi:g(other) };
  });
  console.log('    アドレス未登録:', JSON.stringify(badgeCol.nomail));
  console.log('    未招待　　　　:', JSON.stringify(badgeCol.mi));
  ok(badgeCol.nomail && badgeCol.nomail.bg === 'rgb(255, 204, 0)',
     '★★アドレス未登録の地は 黄色（#FFCC00）', badgeCol.nomail);
  ok(badgeCol.nomail && badgeCol.nomail.fg === 'rgb(23, 23, 26)',
     '★★アドレス未登録の字は 黒（#17171A）', badgeCol.nomail);
  ok(badgeCol.mi && badgeCol.mi.fg === 'rgb(255, 255, 255)',
     '★ほかの札は、これまでどおり白い字', badgeCol.mi);
  ok(own[4] && own[4].badge === '対象外',
     '★★別管理の森本様は「対象外」（「未招待」と出すと、招待し忘れに見える）', own[4]);

  /* ★一覧が描き直されても、札が消えないこと（検索・取込でよく起きます） */
  await p.evaluate(()=>{
    const h = document.getElementById('ownerCards');
    h.innerHTML = window.RENT_CORE.owners.map(function(o,i){
      return '<div class="ow-row"><button type="button" class="ow-card"' +
             ' onclick="RENT.openOwnerSheet(' + i + ')">' +
             '<div class="ow-head"></div>' +
             '<div class="ow-mid"><div class="ow-atena">' + o.name + '</div></div>' +
             '</button></div>';
    }).join('');
  });
  await p.waitForTimeout(500);
  const again = await p.evaluate(()=>
    [...document.querySelectorAll('#ownerCards .ow-head .inv-own')].map(b=>b.textContent.trim()));
  console.log('    描き直したあと:', again.join(' / '));
  ok(again.length === 5, '★★描き直されても、札がまた付く', again);
  ok(again[0] === '招待済み' && again[4] === '対象外',
     '★中身も同じ', again);

  console.log('\n── ②-1 ★★再送付（招待済みの方へ、もう一度ご案内を出す）──');
  /*  ご指示： 「いちど招待したら招待済みにして。再送付もできるように」
   *
   *  ★マイページ側（Apps Script）の窓口は、まだ入っていません。
   *    ですので、ここで見るのは次の2つです。
   *      ① 再送付のつもりが、ちゃんと送信に乗っているか（resend）
   *      ② 窓口が無いあいだ、「お送りしました」と嘘をつかないか
   *    ②がいちばん大事です。押したのに何も起きていないのに
   *    「お送りしました」と出ると、当社は届いたと思い込みます。 */
  await p.evaluate(()=>{
    window.__sent.length = 0;
    window.RENT.makeOwnerPdfBase64 = async function(){ return window.__B64; };
  });
  dialogs=[]; p.__accept=true;
  await p.evaluate(()=>{
    document.querySelectorAll('.inv-check').forEach(b=>{ b.checked = false; });
    const b = document.querySelector('.inv-check[data-kind="re"][value="0"]');
    if(b) b.checked = true;                       /* 山田様（招待済み）*/
  });
  await p.click('#btn-to-mypage');
  await p.waitForTimeout(2200);
  const rs = await p.evaluate(()=>{
    const t = document.querySelector('#tmp-board table');
    return {
      head: t ? [...t.querySelectorAll('thead th')].map(x=>x.textContent.trim()) : [],
      row:  t ? [...t.querySelectorAll('tbody tr td')].map(x=>x.textContent.trim()) : [],
      push: window.__sent.filter(x=>x.action==='push'),
      res:  window.__sent.filter(x=>x.action==='stResend'),
      order: window.__sent.map(x=>x.action)
    };
  });
  const rcol = n => rs.row[rs.head.indexOf(n)];
  const cfr = dialogs.find(d=>/送る相手/.test(d.msg));
  console.log('    確認の文:', cfr ? cfr.msg.split('\n').filter(x=>/再送付|送る相手/.test(x)).join(' / ') : '(なし)');
  console.log('    通信の順番:', rs.order.join(' → '));
  console.log('    stResend の中身:', JSON.stringify(rs.res[0] ? {mail:rs.res[0].mail, newMail:rs.res[0].newMail} : null));
  console.log('    表:', rs.row.join(' | '));
  ok(cfr && /うち 再送付： 1 名/.test(cfr.msg), '★確認の文に「再送付 1名」と出る');
  ok(cfr && /パスワードは新しいものに変わります/.test(cfr.msg),
     '★★パスワードが変わることを、押す前にお伝えする');
  ok(!/アドレスを変えます/.test(cfr ? cfr.msg : ''),
     '★アドレスを直していないときは「アドレスを変えます」と出さない');
  ok(rs.res.length === 1, '★★再送付の窓口（stResend）を1回だけ呼ぶ');
  ok(rs.res[0] && rs.res[0].mail === 'yamada@example.jp',
     '★どなたの再送付かを送っている');
  ok(rs.res[0] && rs.res[0].newMail === 'yamada@example.jp',
     '★直していないときは、同じアドレスを送る');
  ok(rs.order.indexOf('push') >= 0 &&
     rs.order.indexOf('push') < rs.order.indexOf('stResend'),
     '★★明細（push）を先に済ませてから、アドレスを変える');
  ok(/窓口がまだ入っていません|再送付できていません/.test(rcol('開設のご案内') || ''),
     '★★窓口が無いあいだは、その旨を出す');
  ok(!/お送りしました|再送付しました/.test(rcol('開設のご案内') || ''),
     '★★★出ていないのに「送った」と嘘をつかない');

  console.log('\n── ②-1b ★★★再送付で、メールアドレスを入れ直す ──');
  /*  ご指示： 「再送付時にはメールアドレス入力できるようにしてほしい」
   *           ①＝1（登録アドレスとして置き換わる。ログインIDも変わる）
   *
   *  ★ここがこの画面でいちばん危ないところです。
   *    打ち間違えたまま送ると、オーナー様はログインできなくなり、
   *    明細もよその方に届きます。
   *    ですので「押す前に 前→後 を見せる」「形がおかしければ止める」
   *    の2つを必ず見ます。 */
  await p.evaluate(()=>{ window.__sent.length = 0; });
  /* ① 印を入れていないあいだ、欄は押せないこと */
  const lock = await p.evaluate(()=>{
    document.querySelectorAll('.inv-check').forEach(b=>{ b.checked = false;
      b.dispatchEvent(new Event('change')); });
    const inp = document.querySelector('.inv-mail[data-for="0"]');
    return { disabled: inp ? inp.disabled : null, val: inp ? inp.value : null };
  });
  console.log('    印なしのとき:', JSON.stringify(lock));
  ok(lock.disabled === true, '★★印を入れるまで、アドレスの欄は押せない');
  ok(lock.val === 'yamada@example.jp', '★はじめは、いまの登録アドレスが入っている');

  /* ② 形がおかしいアドレスは、送る前に止めること */
  dialogs=[]; p.__accept=true;
  await p.evaluate(()=>{
    const b = document.querySelector('.inv-check[data-kind="re"][value="0"]');
    b.checked = true; b.dispatchEvent(new Event('change'));
    document.querySelector('.inv-mail[data-for="0"]').value = 'yamada(at)example';
  });
  await p.click('#btn-to-mypage');
  await p.waitForTimeout(1200);
  const badSent = await p.evaluate(()=>window.__sent.length);
  const badMsg = dialogs.map(d=>d.msg).join(' / ');
  console.log('    出た窓:', badMsg.split('\n')[0]);
  ok(badSent === 0, '★★★形がおかしいときは、1回も通信しない');
  ok(/形が正しくない/.test(badMsg), '★何がおかしいかを伝える');
  ok(/まだ1名にも送っていません/.test(badMsg), '★★送っていないことを、はっきり伝える');
  ok(/通信もしていません/.test(badMsg), '★通信もしていないことを伝える');

  /* ③ ちゃんとしたアドレスに直したとき */
  await p.evaluate(()=>{ window.__sent.length = 0;
    document.querySelector('.inv-mail[data-for="0"]').value = 'yamada.new@example.jp'; });
  dialogs=[]; p.__accept=true;
  await p.click('#btn-to-mypage');
  await p.waitForTimeout(2200);
  const chg = await p.evaluate(()=>({
    res: window.__sent.filter(x=>x.action==='stResend'),
    push: window.__sent.filter(x=>x.action==='push')
  }));
  const cfc = dialogs.find(d=>/送る相手/.test(d.msg));
  if(cfc) console.log('    確認の文:\n' + cfc.msg.split('\n')
     .filter(x=>/アドレスを変えます|前：|後：|ログインID|打ち間違/.test(x))
     .map(x=>'      '+x).join('\n'));
  console.log('    stResend:', JSON.stringify(chg.res[0] ? {mail:chg.res[0].mail, newMail:chg.res[0].newMail} : null));
  ok(cfc && /アドレスを変えます/.test(cfc.msg), '★★「アドレスを変えます」と出る');
  ok(cfc && /前： yamada@example\.jp/.test(cfc.msg), '★★変更前を出す');
  ok(cfc && /後： yamada\.new@example\.jp/.test(cfc.msg), '★★変更後を出す');
  ok(cfc && /ログインIDも、このアドレスに変わります/.test(cfc.msg),
     '★★ログインIDも変わることを伝える');
  ok(cfc && /よその方に届きます/.test(cfc.msg),
     '★★打ち間違えたときに何が起きるかを伝える');
  ok(chg.res.length === 1 && chg.res[0].newMail === 'yamada.new@example.jp',
     '★★新しいアドレスを送っている');
  ok(chg.push.length === 1 && chg.push[0].owners[0].email === 'yamada@example.jp',
     '★★明細（push）は、まだ元のアドレスで入れる（入れ違いを防ぐ）');
  /* ④ 窓口が入ったときは、ちゃんと「再送付しました（アドレス変更）」と出ること */
  await p.evaluate(()=>{ window.__resend = true; window.__sent.length = 0; });
  dialogs=[]; p.__accept=true;
  await p.click('#btn-to-mypage');
  await p.waitForTimeout(2200);
  const okr = await p.evaluate(()=>{
    const t = document.querySelector('#tmp-board table');
    return { head:[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim()),
             row:[...t.querySelectorAll('tbody tr td')].map(x=>x.textContent.trim()) };
  });
  const ocol = n => okr.row[okr.head.indexOf(n)];
  console.log('    窓口が入ったとき:', okr.row.join(' | '));
  ok(/再送付しました（アドレス変更）/.test(ocol('開設のご案内') || ''),
     '★★窓口が入れば「再送付しました（アドレス変更）」と出る');
  await p.evaluate(()=>{ window.__resend = false; });

  /* 片づけ */
  await p.evaluate(()=>{
    const inp = document.querySelector('.inv-mail[data-for="0"]');
    if(inp) inp.value = 'yamada@example.jp';
    document.querySelectorAll('.inv-check').forEach(b=>{ b.checked = false;
      b.dispatchEvent(new Event('change')); });
    window.__sent.length = 0;
  });

  console.log('\n── ③ 私（テスト）1名だけにチェックして送る ──');
  /* ★2026/10/1 … 明細PDFの作り手を、先に用意します。
   *   それまで、この検査は「明細PDFが無いまま送れていた」ことに
   *   頼っていました。2026/10/1 から、明細PDFが入らない
   *   「はじめての方」には招待を送りません（ご指示）。
   *   この検査のねらいは「1名だけに送るか」なので、
   *   正しく明細PDFが入る状態にしてから試します。 */
  await p.evaluate(()=>{
    window.RENT.makeOwnerPdfBase64 = async function(){ return window.__B64; };
    window.__sent.length = 0;
    /* ★前の検査（②-1 再送付）の印を、必ず消します。
         残っていると「1名だけ送る」ことの検査になりません。 */
    document.querySelectorAll('.inv-check').forEach(b=>{ b.checked = false; });
  });
  await p.evaluate(()=>{ document.querySelector('.inv-check[value="2"]').checked = true; });
  dialogs=[]; p.__accept=true;
  await p.click('#btn-to-mypage');
  await p.waitForSelector('#tmp-board', { timeout:8000 });
  await p.waitForTimeout(400);
  const pushes = await p.evaluate(()=>window.__sent.filter(x=>x.action==='push'));
  console.log('    送った相手:', pushes.map(x=>x.owners[0].email).join(' , '));
  ok(pushes.length===1, '★通信は1名ぶんだけ');
  ok(pushes[0].owners[0].email==='me@example.jp', '★送った相手は、私だけ');
  const cf = dialogs.find(d=>/送る相手/.test(d.msg));
  console.log('    確認の文:\n' + (cf? cf.msg.split('\n').map(x=>'      '+x).join('\n') : '(なし)'));
  ok(cf && /送る相手： 1 名/.test(cf.msg), '★「送る相手 1名」と出る');
  ok(cf && /私（テスト）/.test(cf.msg), '★お名前が出る');
  /* ★2026/10/1 … 確認の文を、印の種類ごとに書き直しました。
       改良前は「はじめての方 1名／すでに登録済み 0名」と人数だけで、
       その方に何が起きるか（パスワードが届く／変わる）は
       下のほうに埋もれていました。 */
  ok(cf && /☐ 招待する　　1 名/.test(cf.msg), '★★招待が1名と、印の名前つきで出る');
  ok(cf && /初回パスワードのご案内が届きます/.test(cf.msg),
     '★★その方に何が起きるかを、人数の横に書く');
  ok(cf && !/今月の明細/.test(cf.msg),
     '★印の入っていない種類は、確認の文に出さない（読む字を増やさない）');

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
  await p.evaluate(()=>{ document.querySelector('.inv-check[value="0"]').checked = true;
                         document.querySelector('.inv-check[value="1"]').checked = false;
                         document.querySelector('.inv-check[value="2"]').checked = false; });
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
  await p.evaluate(()=>{ document.querySelector('.inv-check[value="0"]').checked = true;
                         document.querySelector('.inv-check[value="2"]').checked = false; });
  await p.click('#btn-to-mypage');
  await p.waitForTimeout(2000);
  /* ★列の番号ではなく「列の名前」で見ます。
       列を足すたびに検査が壊れるのを防ぐためです。 */
  const why = await p.evaluate(()=>{
    const t=document.querySelector('#tmp-board table');
    if(!t) return null;
    const h=[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim());
    const tds=[...t.querySelectorAll('tbody tr')].map(tr=>
      [...tr.querySelectorAll('td')].map(td=>td.textContent.trim()));
    return { head:h, rows:tds, at:function(){ return 0; } };
  });
  const col = (r, name) => r.rows[0][r.head.indexOf(name)];
  console.log('    表:', why ? why.rows[0].join(' | ') : '(なし)');
  ok(why && /DRIVE_ID/.test(col(why, '明細PDF')),
     '★マイページ側が返した理由（DRIVE_ID…）を、そのまま表に出す');
  ok(why && col(why, '明細PDF') !== '入りませんでした',
     '★「入りませんでした」だけで済ませない（原因さがしが始められないため）');
  /* ★2026/10/1 … この方（山田）は すでに招待済み です（__reg に入っています）。
   *   招待済みの方には招待メールが出ないので、明細PDFが入らなくても
   *   送ります。止めるのは「はじめての方」だけです。 */
  ok(why && col(why, 'アカウント') === 'もとからあります',
     '★招待済みの方は、明細PDFが入らなくても送る（止めるのは はじめての方だけ）');

  console.log('\n── ③-1b ★★明細PDFが入らない「はじめての方」に、招待を送らないか ──');
  /*  ご指示（2026/10/1）：
   *    「マイページへ送る、は、明細添付していることを条件にしてください。
   *      明細添付してないオーナーは招待不可」
   *
   *  初回のご案内メールは取り消せません。明細が1枚も入っていない
   *  マイページにお招きすると、オーナー様は空の画面をご覧になります。
   *  鈴木様は まだ招待されていない方です（__reg に入っていません）。 */
  await p.evaluate(()=>{ window.__sent.length = 0; });
  dialogs=[]; p.__accept=true;
  await p.evaluate(()=>{ document.querySelector('.inv-check[value="0"]').checked = false;
                         document.querySelector('.inv-check[value="1"]').checked = true; });
  await p.click('#btn-to-mypage');
  await p.waitForTimeout(2000);
  const blk = await p.evaluate(()=>{
    const t=document.querySelector('#tmp-board table');
    return {
      tbl: t ? { head:[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim()),
                 row:[...t.querySelectorAll('tbody tr td')].map(x=>x.textContent.trim()) } : null,
      push: window.__sent.filter(x=>x.action==='push').length,
      pushed: window.__sent.filter(x=>x.action==='push')
                .map(x=>String((x.owners||[])[0].email||'')),
      reg: window.__reg.slice()
    };
  });
  const bcol = n => blk.tbl.row[blk.tbl.head.indexOf(n)];
  console.log('    表:', blk.tbl ? blk.tbl.row.join(' | ') : '(なし)');
  console.log('    push した相手:', blk.pushed.length ? blk.pushed.join(' , ') : '(なし)');
  ok(!!blk.tbl, '結果の表は出る（黙って終わらない）');
  ok(blk.push === 0, '★★push を1回も送っていない');
  ok(blk.reg.indexOf('suzuki@example.jp') < 0,
     '★★台帳に作られていない（あとから「招待済み」に見えない）');
  ok(blk.tbl && bcol('アカウント') === '送っていません',
     '★アカウントの欄は「送っていません」');
  ok(blk.tbl && /招待しませんでした/.test(bcol('明細')),
     '★その理由を、表にそのまま出す');
  ok(blk.tbl && /DRIVE_ID/.test(bcol('明細PDF')),
     '★明細PDFが入らなかった理由も、そのまま残す');
  ok(blk.tbl && bcol('開設のご案内') === '—',
     '★「開設のご案内」は — （出していないので「お送りしました」と言わない）');

  await p.evaluate(()=>{ window.__pdfng = false; window.__sent.length = 0;
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
  await p.evaluate(()=>{ document.querySelector('.inv-check[value="1"]').checked = true;
                         document.querySelector('.inv-check[value="2"]').checked = false; });
  await p.click('#btn-to-mypage');
  await p.waitForTimeout(2500);
  const ng = await p.evaluate(()=>{
    const t=document.querySelector('#tmp-board table');
    if(!t) return null;
    return { head:[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim()),
             rows:[...t.querySelectorAll('tbody tr')].map(tr=>
               [...tr.querySelectorAll('td')].map(td=>td.textContent.trim())),
             note: [...document.querySelectorAll('#tmp-board p')].pop().textContent.trim() };
  });
  console.log('    表:', ng ? ng.rows.map(r=>r.join(' | ')).join(' / ') : '(なし)');
  ok(!!ng, '結果の表は出る');
  /* ★2026/10/1 … ここの期待を変えました。
   *   明細PDFが入らなかった「はじめての方」には push しなくなったため、
   *   アカウントの欄は「分かりません」ではなく「送っていません」になります。
   *   この検査のねらいは「嘘をつかない」ことです。実際に送っていないので
   *   「送っていません」は嘘ではなく、「分かりません」より正確です。
   *   ★大事なのは、ここが「もとからあります」にならないことです。 */
  ok(ng && ng.rows[0][ng.head.indexOf('アカウント')] !== 'もとからあります',
     '★★アカウントの欄に「もとからあります」と嘘をつかない');
  ok(ng && ng.rows[0][ng.head.indexOf('アカウント')] === '送っていません',
     '★アカウントの欄は「送っていません」（push していないため）');
  ok(ng && /読めず|送りませんでした/.test(ng.rows[0][ng.head.indexOf('明細')]),
     '★明細の欄に、送らなかった理由が出る');
  /* ★2026/10/1 … 下の一言の字が変わりました。
   *   push しなくなったため、「1回もつながっていない」と言い切れません
   *   （つながっていないのか、stCheck が入っていないのかが分かりません）。
   *   言い切れることだけを書きます。
   *     ・こちらから1通も送っていない      … 確かです
   *     ・アカウントも作られていない        … 確かです
   *     ・ご案内メールも出ていない          … 確かです  ★ここが大事
   *     ・つながっていない可能性がある      … 可能性として書きます */
  ok(ng && /1通も送っていません/.test(ng.note),
     '★下の一言で「こちらから1通も送っていない」と伝える');
  ok(ng && /メールも出ていません/.test(ng.note),
     '★★「ご案内メールも出ていません」と、はっきり伝える');
  ok(ng && /つながっていない可能性/.test(ng.note),
     '★つながっていない可能性に触れる（言い切らない）');
  ok(ng && !/1回もつながっていない/.test(ng.note),
     '★★確かめていないことを「つながっていない」と言い切らない');
  /* ★英語のまま出さないか */
  const alerts = dialogs.filter(d=>d.type==='alert').map(d=>d.msg);
  ok(!alerts.some(m=>/Failed to fetch/.test(m)),
     '★「Failed to fetch」をそのまま出さない');
  ok(alerts.some(m=>/アクセスできるユーザー/.test(m)) ||
     (ng && /つながっていない/.test(ng.note)),
     '★何を確かめればよいかを日本語で出す');
  await p.evaluate(()=>{ window.__netng = false; });

  console.log('\n── ③-4 ★「明細が入りました」のお知らせ ──');
  /* ★山田様・私（テスト）は、もう招待済みです。ですので箱は「再送付」しか
       ありません。再送付が失敗すると、その知らせが下の一言を
       覆い隠してしまい、この検査が見たいものが見えません。
       ここでは再送付の窓口が入っている形（__resend）にします。 */
  await p.evaluate(()=>{
    window.__resend = true;
    window.__pdfng = false; window.__noteoff = false; window.__notengai = false;
    window.RENT.makeOwnerPdfBase64 = async function(){ return window.__B64; };
    window.__sent.length = 0;
  });
  const noteCol = async (val, label) => {
    dialogs=[]; p.__accept=true;
    await p.evaluate((v)=>{
      document.querySelector('.inv-check[value="'+v+'"]').checked = true;
      [0,1,2].filter(x=>x!==v).forEach(x=>{
        document.querySelector('.inv-check[value="'+x+'"]').checked = false; });
    }, val);
    await p.click('#btn-to-mypage');
    await p.waitForTimeout(2200);
    const r = await p.evaluate(()=>{
      const t=document.querySelector('#tmp-board table');
      return { cols:[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim()),
               row:[...t.querySelectorAll('tbody tr td')].map(x=>x.textContent.trim()) };
    });
    console.log('    ' + label + ': ' + r.row.join(' | '));
    return r;
  };
  /* 山田様＝すでに登録済み → お知らせが出る */
  let r1 = await noteCol(0, 'すでに登録済み');
  ok(r1.cols.indexOf('明細のお知らせ') === 3, '★「明細のお知らせ」の列がある（4列目）');
  ok(r1.row[3] === 'お送りしました', '★すでに登録済みの方には お送りしました');
  /* 出せなかったとき */
  await p.evaluate(()=>{ window.__notengai = true; });
  let r2 = await noteCol(0, '出せなかったとき');
  ok(r2.row[3] === '出ていません', '★出せなかったら「出ていません」（赤）');
  const nt = await p.evaluate(()=>[...document.querySelectorAll('#tmp-board p')].pop().textContent.trim());
  ok(/入ったことをご存じありません/.test(nt),
     '★下の一言で「明細は入っているが、ご存じない」と伝える');
  /* ★★1日の送信枠が尽きたとき（2026/10/1）。
       マイページ側が順番待ちに入れ、翌朝に自動でお送りします。
       ★ですので赤にはしません。「出ていません」と同じ色にすると、
         本当に手を打つべきもの（失敗したもの）が埋もれます。 */
  await p.evaluate(()=>{ window.__notengai = false; window.__notewait = true; });
  let rw = await noteCol(0, '枠が尽きたとき');
  ok(rw.row[3] === '明日お送りします',
     '★★★枠が尽きたら「明日お送りします」（失敗あつかいにしない）');
  const wcol = await p.evaluate(()=>{
    const t = document.querySelector('#tmp-board table');
    const td = [...t.querySelectorAll('tbody tr td')][3];
    return getComputedStyle(td).color;
  });
  console.log('    その欄の色: ' + wcol);
  ok(!/215,\s*0,\s*21/.test(wcol), '★★赤（#d70015）にしない', wcol);
  await p.evaluate(()=>{ window.__notewait = false; });

  /* マイページ側が、まだ知らせてこないとき */
  await p.evaluate(()=>{ window.__notengai = false; window.__noteoff = true; });
  let r3 = await noteCol(0, 'まだ知らせてこないとき');
  ok(r3.row[3] === '確かめられません', '★知らせてこないあいだは「確かめられません」（灰色）');
  await p.evaluate(()=>{ window.__noteoff = false; });

  console.log('\n── ④ もう一度［登録状況］を押すと、招待済みに変わるか ──');
  await p.click('#btn-mypage-inv');
  await p.waitForTimeout(800);
  v = await p.evaluate(()=>[...document.querySelectorAll('#tmp-inv tbody tr')]
      .map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim())));
  console.log('    私（テスト）:', v[2].join(' | '));
  ok(v[2][2]==='招待済み', '★私（テスト）が「招待済み」に変わった');
  ok(v[1][2]==='未招待',   '鈴木様は、まだ未招待のまま');

  console.log('\n── ⑤ ★112名を一度に押したとき、止め金が出るか ──');
  await p.evaluate(()=>{
    /* 112名に増やします（本番と同じ人数） */
    window.RENT.detail.length = 0;
    for(let i=0;i<112;i++){
      window.RENT.detail.push({ owner:'オーナー'+(i+1), atena:'オーナー'+(i+1)+' 様',
                                email:'o'+(i+1)+'@example.jp', props:[] });
    }
    document.getElementById('rows').innerHTML = window.RENT.detail.map((d,i)=>
      '<label><input type="checkbox" class="rent-check" value="'+i+'"> '+d.owner+'</label>').join('');
    window.__reg.length = 0;          /* 全員 未招待 にします */
    window.__sent.length = 0;
    window.__netng = false;
  });
  /* ★2026/10/1 … 「印が0なら全員」の道が無くなったので、
       112名ぶんの箱に、実際に印を入れてから押します。
       これは本番で起こりうる操作です（全選択のつもりで入れてしまう）。 */
  await p.waitForTimeout(600);                    /* 箱が差し込まれるのを待ちます */
  const n112 = await p.evaluate(()=>{
    const bs = [...document.querySelectorAll('.inv-check')];
    bs.forEach(b=>{ b.checked = true; });
    return bs.length;
  });
  console.log('    印を入れた箱の数:', n112);
  ok(n112 === 112, '★112名ぶんの箱が出ている');
  dialogs=[]; p.__accept=false;                   /* 確認で取り消します */
  await p.click('#btn-to-mypage'); await p.waitForTimeout(2500);
  console.log('    出た窓の数:', dialogs.length);
  const m2 = dialogs.filter(d=>/送る相手/.test(d.msg))[0];
  if(m2) console.log('    ' + m2.msg.split('\n').filter(x=>/★|送る相手|名/.test(x))
                       .slice(0,10).map(x=>'  '+x).join('\n    '));
  ok(m2 && /送る相手： 112 名/.test(m2.msg), '★送る相手が112名と出る');
  ok(m2 && /一度に 112 名です/.test(m2.msg), '★「一度に112名です」と伝える');
  ok(m2 && /分かかり/.test(m2.msg), '★かかる時間を伝える');
  ok(m2 && /20 名ずつに分ける/.test(m2.msg), '★20名ずつを勧める');
  ok(m2 && /はじめての方が 112 名です/.test(m2.msg), '★はじめての方の人数を伝える');
  ok(m2 && /日を分けて/.test(m2.msg), '★1日の上限があることを伝える');
  ok(m2 && /つまずき記録/.test(m2.msg), '★超えたぶんの行き先も伝える');
  const pushed = await p.evaluate(()=>window.__sent.filter(x=>x.action==='push').length);
  ok(pushed === 0, '★取り消したので、1名も送っていない');

  console.log('\nJS の不具合:', errs.length ? errs : 'なし');
  ok(errs.length===0, 'JS の不具合なし');
  console.log('\nPASS='+pass+' FAIL='+fail);
  await b.close();
  process.exit(fail?1:0);
})();
