/* ==================================================================
 *  30％保証賃料（空室保証）
 *
 *  管理委託契約で「空室が91日目に入ったら、募集賃料の30％を保証する」
 *  としている物件のための画面です。
 *
 *  ・物件の編集画面に「30％保証賃料」の欄を足します（10部屋まで）
 *  ・解約日を入れると、空室が何日目かを毎日かぞえます
 *  ・91日目に入ると「保証中」になり、一覧のカードにも赤い札が出ます
 *  ・契約日を入れて「完了」を押すと、履歴に移ります
 *  ・履歴では、どの部屋を いつからいつまで 月いくら保証したかが見られます
 *
 *  このファイルは、ほかのファイルを書き替えずに動きます。
 *  やめるときは index.html の hosho.js の行を消すだけです。
 *  PIVOT2 と PIVOT3 で、中身は同じです。
 * ================================================================== */
(function(){
  'use strict';

  var FREE_DAYS = 90;   /* 解約日から起算して、何日目まで免責か */
  var YEARS     = 2;    /* 管理開始日から何年で、保証の契約が終わるか */
  var RATE = 0.30;    /* 募集賃料に掛ける割合 */
  var MAX  = 10;      /* 何部屋まで足せるか */
  var PRE  = 3;       /* 何日前にお知らせするか */

  var _rows = [];     /* いま編集している物件の、保証の行 */
  var _log  = [];     /* いま編集している物件の、履歴 */
  var _from = '';     /* いま編集している物件の、管理開始日 */

  /* ---------- 小道具 ---------- */
  function esc(v){
    return (typeof escapeHtml === 'function') ? escapeHtml(v)
         : String(v == null ? '' : v).replace(/[&<>"]/g, function(c){
             return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; });
  }
  function el(id){ return document.getElementById(id); }
  function num(v){ var n = Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')); return isFinite(n) ? n : 0; }
  function yen(n){ return Number(n || 0).toLocaleString('ja-JP'); }

  /* 'YYYY-MM-DD' → その日の午前0時。読めなければ null */
  function day(v){
    var m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(String(v == null ? '' : v).trim());
    if(!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  function today0(){ var d = new Date(); d.setHours(0,0,0,0); return d; }
  function plus(d, n){ var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function ymd(d){
    if(!d) return '';
    var p = function(n){ return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  /* 9/30 のような、みじかい日づけ */
  function md(v){
    var d = (v instanceof Date) ? v : day(v);
    return d ? ((d.getMonth() + 1) + '/' + d.getDate()) : '';
  }
  function jp(v){
    var d = (v instanceof Date) ? v : day(v);
    if(!d) return '';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function jpy(v){
    var d = (v instanceof Date) ? v : day(v);
    if(!d) return '';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function who(){
    try{ if(typeof window.pvDeviceName === 'function') return (window.pvDeviceName() || '').trim(); }catch(e){}
    return '';
  }

  /* 空室が何日目か。解約日の翌日を1日目とかぞえます */
  function nth(r, at){
    var s = day(r && r.out);
    if(!s) return 0;
    var e = at || today0();
    var n = Math.floor((e.getTime() - s.getTime()) / 86400000);
    return n > 0 ? n : 0;
  }
  /* ★ 保証のもとになるのは「募集賃料」だけです。
       管理委託契約の第2項で、こう決めています。

         「募集賃料」とは、甲乙が合意した満室想定の月額賃料をいい、
         共益費、駐車場使用料その他の付随費用はこれに含まない。

       ですので、共益費も駐車場使用料も、計算には入れません。
       （賃料5万円・共益費3,000円・駐車場5,000円なら、
         もとになるのは5万円だけ。保証額は月15,000円です） */
  function base(r){ return num(r && r.rent); }
  /* ひと月まるまるのぶん */
  function monthYen(r){ return Math.floor(base(r) * RATE); }
  /* 欠けている月のぶん。日割りしてから30％にします */
  function partYen(r, days, dim){ return Math.floor(base(r) * RATE * days / dim); }
  function amount(r){ return monthYen(r); }
  /* 保証が始まるまで、あと何日か。もう始まっていれば 0 です */
  function left(r, at){
    var st = startDay(r);
    if(!st) return null;
    var e = at || today0();
    var n = Math.round((st.getTime() - e.getTime()) / 86400000);
    return n > 0 ? n : 0;
  }

  /* その月の末日 */
  function mEnd(d){ return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  /* 日数（両はしを入れて数えます） */
  function span(a, b){ return Math.round((b.getTime() - a.getTime()) / 86400000) + 1; }

  /* ★ ある期間を、月ごとに分けます。
       ・まるまる1か月ある月　… 満額
       ・欠けている月　　　　… 日割り（その月の実日数でわります） */
  function splitRange(r, a, b){
    var out = [], cur = mon1(a);
    while(cur.getTime() <= b.getTime()){
      var e  = mEnd(cur);
      var x  = (cur.getTime() > a.getTime()) ? cur : a;
      var y  = (e.getTime() < b.getTime()) ? e : b;
      var n  = span(x, y), dim = e.getDate(), full = (n === dim);
      out.push({ y:cur.getFullYear(), mo:cur.getMonth() + 1, from:x, to:y,
                 days:n, dim:dim, full:full,
                 yen:(full ? monthYen(r) : partYen(r, n, dim)) });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return out;
  }
  function sumOf(list){ var t = 0; list.forEach(function(x){ t += x.yen; }); return t; }

  /* ★ 保証のぜんぶ。91日目から、契約日の前日までです */
  function split(r, sign, term){
    var st = startDay(r);
    var sg = day(sign == null ? (r && r.sign) : sign);
    if(!st || !sg) return null;
    var to = plus(sg, -1);                       /* 契約日の前日まで */
    /* 保証契約の満了をすぎたぶんは、入れません */
    var t = (term === undefined) ? termEnd() : term;
    var cut = false;
    if(t && t.getTime() < to.getTime()){ to = t; cut = true; }
    if(to.getTime() < st.getTime()){
      return { list:[], total:0, days:0, from:null, to:null, cut:cut, term:t };
    }
    var list = splitRange(r, st, to);
    return { list:list, total:sumOf(list), days:span(st, to), from:st, to:to, cut:cut, term:t };
  }
  /* ★ 月を足します。応当日がない月は、その月の末日にします
       （例：11月30日の3か月後は 2月28日。2月30日は無いためです） */
  function plusM(d, n){
    var y = d.getFullYear(), m = d.getMonth() + n, dd = d.getDate();
    var last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(dd, last));
  }
  /* ★ 保証が始まる日。
       解約日から起算して90日目までが免責。91日目から保証です。
       例）7月1日に解約 → 9月29日が90日目 → 9月30日から保証 */
  function startDay(r){ var s = day(r && r.out); return s ? plus(s, FREE_DAYS + 1) : null; }
  /* ★ 保証契約の満了の日。管理開始日から2年で終わります（2年後の前日）。
       管理開始日が空なら null（満了なし）です。 */
  function termOf(from){
    var d = day(from);
    return d ? plus(plusM(d, YEARS * 12), -1) : null;
  }

  /* ★ 保証が終わる日。次の2つのうち、早いほうです。
       ・契約が決まった日の前日
       ・保証契約の満了の日（管理開始日から2年）
       どちらも無ければ null（まだ終わりません）。 */
  function endDay(r, term){
    var g = day(r && r.sign);
    var a = g ? plus(g, -1) : null;
    var t = (term === undefined) ? termEnd() : term;
    if(!a) return t || null;
    if(t && t.getTime() < a.getTime()) return t;
    return a;
  }
  /* いま保証中か（解約日あり・契約日なし・91日目以降） */
  function live(r, at, term){
    if(!r || !day(r.out)) return false;
    if(String(r.sign || '').trim()) return false;
    var st = startDay(r);
    var e  = at || today0();
    if(!st || e.getTime() < st.getTime()) return false;
    var en = endDay(r, term);
    return !en || e.getTime() <= en.getTime();
  }
  function rowsOf(b){
    var a = (b && b.guarantees);
    return Array.isArray(a) ? a : [];
  }
  function logOf(b){
    var a = (b && b.guaranteeLog);
    return Array.isArray(a) ? a : [];
  }
  /* その物件に、いま保証中の部屋がいくつあるか */
  function liveCount(b){
    var n = 0, t = termOf(b && b.guaranteeFrom);
    rowsOf(b).forEach(function(r){ if(live(r, null, t)) n++; });
    return n;
  }
  window.pvHoshoLive = liveCount;

  /* ---------- 見た目 ---------- */
  var CSS = ''
  + '.hs-sec{border:1px solid #e5e5e7;border-radius:12px;padding:14px 16px;margin-bottom:16px;background:#fff;}'
  + '.hs-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:4px;}'
  + '.hs-title{font-size:14px;font-weight:800;letter-spacing:.02em;}'
  + '.hs-on{display:inline-block;margin-left:8px;padding:3px 10px;border-radius:100px;'
  +   'background:#c7362a;color:#fff;font-size:11.5px;font-weight:800;vertical-align:1px;}'
  + '.hs-head-a{margin-left:auto;display:flex;gap:8px;}'
  + '.hs-btn{border:1px solid #000;background:#000;color:#fff;font-size:12px;font-weight:700;'
  +   'padding:6px 12px;border-radius:8px;cursor:pointer;}'
  + '.hs-btn.ghost{background:#fff;color:#000;}'
  + '.hs-btn[disabled]{opacity:.35;cursor:default;}'
  + '.hs-lead{font-size:11.5px;line-height:1.75;color:#666;margin:6px 0 10px;}'
  /* 管理開始日と、2年のカウントダウン */
  + '.hs-term{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;'
  +   'padding:9px 12px;border-radius:9px;background:#f6f6f8;}'
  + '.hs-term label{font-size:11.5px;font-weight:700;color:#555;}'
  + '.hs-term input{border:1px solid #d5d5d8;border-radius:7px;padding:6px 8px;font-size:12.5px;background:#fff;}'
  + '.hs-cd{font-size:12px;color:#555;line-height:1.5;}'
  + '.hs-cd b{font-size:13.5px;font-weight:800;color:#111;}'
  + '.hs-cd span{margin-left:8px;font-size:11px;color:#999;}'
  + '.hs-cd.near b{color:#c7362a;}'
  + '.hs-cd.over b{color:#c7362a;}'
  + '.hs-wrap{max-height:430px;overflow:auto;}'
  + '.hs-hd,.hs-row{display:grid;gap:8px;align-items:center;'
  +   'grid-template-columns:92px 126px 112px 112px minmax(96px,1fr) 152px 66px 26px;}'
  + '.hs-hd{font-size:11px;font-weight:700;color:#888;padding:0 2px 6px;position:sticky;top:0;background:#fff;z-index:1;}'
  + '.hs-row{padding:5px 2px;border-top:1px solid #f0f0f2;}'
  + '.hs-row.on{background:#fff5f4;}'
  /* 左は「いまの様子」、右は「決まったときに入れるところ」。
     あいだに細い線を引いて、役目のちがいを見せます */
  + '.hs-hd > div,.hs-row > div{min-width:0;}'
  + '.hs-c-sign{border-left:1px solid #ececee;padding-left:12px;}'
  + '.hs-hd .hs-c-sign{border-left:1px solid #ececee;}'
  + '.hs-row input{width:100%;border:1px solid #d5d5d8;border-radius:7px;padding:7px 8px;font-size:12.5px;}'
  + '.hs-row input:focus{outline:none;border-color:#000;}'
  + '.hs-row input.ro{border-color:transparent;background:transparent;font-weight:700;}'
  + '.hs-amt{font-size:13px;font-weight:800;padding:7px 8px;white-space:nowrap;}'
  + '.hs-day{font-size:12px;font-weight:700;color:#666;padding:7px 4px;white-space:nowrap;}'
  + '.hs-day b{font-size:14px;}'
  + '.hs-day.on{color:#c7362a;}'
  + '.hs-day .hs-sub{display:block;font-size:10.5px;font-weight:500;color:#999;}'
  /* 契約日の下に出す、日割りの合計 */
  + '.hs-wari{font-size:10.5px;line-height:1.55;color:#666;margin-top:4px;padding:0 1px;overflow-wrap:anywhere;}'
  + '.hs-wari .hs-wsub{display:block;color:#999;}'
  /* 保証賃料の下に出す「今月は日割り」 */
  + '.hs-now{font-size:10.5px;line-height:1.5;color:#c7362a;padding:0 8px;}'
  + '.hs-now b{font-size:12px;font-weight:800;}'
  + '.hs-wari b{font-size:12px;font-weight:800;color:#111;}'
  + '.hs-wari.no{color:#999;}'
  + '.hs-day.on .hs-sub{color:#c7362a;opacity:.8;}'
  + '.hs-x{border:0;background:transparent;color:#c7362a;font-size:15px;cursor:pointer;padding:4px;}'
  + '.hs-fin{border:1px solid #000;background:#fff;color:#000;font-size:11.5px;font-weight:700;'
  +   'padding:6px 6px;border-radius:7px;cursor:pointer;white-space:nowrap;}'
  + '.hs-fin.go{background:#000;color:#fff;}'
  + '.hs-fin[disabled]{opacity:.3;cursor:default;}'
  + '.hs-none{font-size:12px;color:#999;padding:14px 2px;}'
  + '.hs-warn{margin-top:10px;padding:10px 12px;border-radius:9px;background:#fff4e2;'
  +   'color:#7a4e0c;font-size:12px;line-height:1.7;font-weight:600;}'
  + '.hs-warn.cut{background:#fcf0ee;color:#8e2a20;}'
  /* 履歴の窓 */
  + '#hs-hist{position:fixed;inset:0;z-index:100050;display:none;align-items:center;justify-content:center;'
  +   'padding:24px;background:rgba(0,0,0,.42);}'
  + '#hs-hist.on{display:flex;}'
  + '.hs-hcard{width:min(760px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:16px;padding:24px;}'
  + '.hs-hcard h3{margin:0 0 4px;font-size:17px;font-weight:800;}'
  + '.hs-hsub{font-size:12px;color:#888;margin-bottom:16px;}'
  + '.hs-hrow{border-top:1px solid #eee;padding:12px 2px;display:grid;gap:6px;'
  +   'grid-template-columns:88px 1fr 120px;align-items:baseline;}'
  + '.hs-hrow b{font-size:14px;font-weight:800;}'
  + '.hs-hrow .hs-hd2{font-size:12px;color:#555;line-height:1.8;}'
  + '.hs-hrow .hs-hy{font-size:14px;font-weight:800;text-align:right;white-space:nowrap;}'
  + '.hs-hrow .hs-hy small{display:block;font-size:10.5px;font-weight:600;color:#999;}'
  + '.hs-hclose{margin-top:20px;width:100%;border:0;background:#000;color:#fff;'
  +   'font-size:14px;font-weight:700;padding:12px;border-radius:10px;cursor:pointer;}'
  /* 一覧のカードに出す札 */
  + '.pv-hosho{display:inline-block;margin-right:7px;padding:2px 9px;border-radius:6px;'
  +   'background:#c7362a;color:#fff;font-size:11px;font-weight:800;vertical-align:1.5px;letter-spacing:.02em;}'
  + '@media (max-width:900px){'
  +   '.hs-hd{display:none;}'
  +   '.hs-row{grid-template-columns:1fr 1fr;padding:12px 2px;}'
  +   '.hs-row .hs-c-amt,.hs-row .hs-c-day,.hs-row .hs-c-sign{grid-column:1 / -1;}'
  +   '.hs-c-sign{border-left:0;padding-left:0;}'
  +   '.hs-hrow{grid-template-columns:1fr;}'
  +   '.hs-hrow .hs-hy{text-align:left;}'
  + '}';

  function style(){
    if(el('hs-style')) return;
    var s = document.createElement('style');
    s.id = 'hs-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------- 画面をつくる ---------- */
  function build(){
    if(el('hs-section')) return true;
    var anchor = el('tou-addr-section');
    if(!anchor || !anchor.parentNode) return false;
    var d = document.createElement('div');
    d.id = 'hs-section';
    d.className = 'hs-sec';
    d.innerHTML =
      '<div class="hs-head">' +
        '<div class="hs-title">30％保証賃料<span id="hs-on" class="hs-on" style="display:none;"></span></div>' +
        '<div class="hs-head-a">' +
          '<button type="button" class="hs-btn" id="hs-add">＋ 部屋を追加</button>' +
          '<button type="button" class="hs-btn ghost" id="hs-hist-b">履歴</button>' +
        '</div>' +
      '</div>' +
      /* ★ この物件の管理開始日。ここから2年で、30％保証の契約は終わります */
      '<div class="hs-term">' +
        '<label for="hs-from">管理開始日</label>' +
        '<input type="date" id="hs-from">' +
        '<div class="hs-cd" id="hs-cd"></div>' +
      '</div>' +
      '<div class="hs-lead">' +
        '解約日から起算して <b>' + FREE_DAYS + '日目</b>までが免責。<b>' + (FREE_DAYS + 1) + '日目</b>から、' +
        '<b>募集賃料</b>の <b>30％</b> を保証します。' +
        '（7月1日に解約なら、9月29日までが免責、9月30日から保証です）<br>' +
        '募集賃料は満室想定の月額賃料で、<b>共益費・駐車場使用料は含みません</b>。<br>' +
        'オーナー様へは<b>毎月15日に当月ぶん</b>を送金します。' +
        '保証がその月のとちゅうで始まる／終わるときは、<b>その月の実日数で日割り</b>します。<br>' +
        '契約が決まった日を入れると、月ごとの内わけが出ます。「完了」を押すと、履歴に残します。' +
      '</div>' +
      '<div class="hs-wrap"><div class="hs-hd">' +
        '<div>部屋番号</div><div>解約日</div><div>募集賃料</div><div>保証賃料（30％）</div>' +
        '<div>空室の日数</div><div class="hs-c-sign">契約が決まった日</div><div></div><div></div>' +
      '</div><div id="hs-rows"></div></div>' +
      '<div id="hs-warn"></div>';
    anchor.parentNode.insertBefore(d, anchor.nextSibling);

    el('hs-from').addEventListener('input', onFrom);
    el('hs-from').addEventListener('change', onFrom);
    el('hs-add').addEventListener('click', add);
    el('hs-hist-b').addEventListener('click', openHist);
    el('hs-rows').addEventListener('input', onInput);
    el('hs-rows').addEventListener('change', onInput);
    el('hs-rows').addEventListener('click', onClick);
    return true;
  }

  /* 金額をいれる欄 */
  function numCell(r, k, ph){
    var v = r[k];
    return '<div><input type="number" class="hs-f" data-k="' + k + '" value="' +
           ((v === '' || v == null) ? '' : num(v)) +
           '" min="0" step="1000" placeholder="' + ph + '"></div>';
  }

  /* ★ 今月（15日）に送る金額。満額なら出しません（上の保証賃料と同じなので）。
       日割りや、前の月の端数が入る月だけ、その金額と期間を出します。 */
  function nowHtml(r){
    if(!day(r.out) || !base(r)) return '';
    var m = monthPay(r, mon1(today0()));
    if(!m || m.full) return '';
    return '今月の送金<br>' + md(m.from) + '〜' + md(m.to) + '　<b>¥' + yen(m.yen) + '</b>';
  }

  /* 契約日の下に出す「これから送る残り」。契約日が空なら、何も出しません。
     いまの月ぶんは15日に送るので、残りは次の月からです。 */
  function wariHtml(r){
    if(!String(r.sign || '').trim() || !day(r.out)) return '';
    var w = split(r);
    if(!w) return '';
    if(!w.list.length) return '<span class="no">保証が始まる前に決まったため、保証はありません</span>';
    var rs = rest(r);
    if(!rs || !rs.list.length){
      return '残りの送金はありません<span class="hs-wsub">保証ぜんぶで ¥' + yen(w.total) + '</span>';
    }
    return 'これから送る残り <b>¥' + yen(rs.total) + '</b>' +
           '<span class="hs-wsub">' + md(rs.from) + '〜' + md(rs.to) + '・' + rs.days + '日</span>';
  }

  /* ★ 管理開始日から2年。あとどれだけ残っているかを出します */
  function onFrom(){
    _from = String(el('hs-from').value || '');
    dirty();
    paintTerm();
  }
  function termEnd(){ return termOf(_from); }
  /* あと何年何か月何日か */
  function countdown(to, at){
    var a = at || today0();
    if(to.getTime() < a.getTime()) return null;
    var y = 0, m = 0;
    while(plusM(a, (y + 1) * 12).getTime() <= to.getTime()) y++;
    var p = plusM(a, y * 12);
    while(plusM(p, m + 1).getTime() <= to.getTime()) m++;
    p = plusM(p, m);
    var d = Math.round((to.getTime() - p.getTime()) / 86400000);
    return { y:y, m:m, d:d };
  }
  function paintTerm(){
    var box = el('hs-cd');
    if(!box) return;
    var e = termEnd();
    if(!e){ box.className = 'hs-cd'; box.innerHTML = '管理開始日を入れると、保証契約の残りが出ます'; return; }
    var c = countdown(e);
    if(!c){
      box.className = 'hs-cd over';
      box.innerHTML = '<b>' + YEARS + '年の保証契約は、' + jpy(e) + ' で終わっています</b>';
      return;
    }
    var t = [];
    if(c.y) t.push(c.y + '年');
    if(c.m) t.push(c.m + 'か月');
    t.push(c.d + '日');
    var near = (c.y === 0 && c.m < 3);
    box.className = 'hs-cd' + (near ? ' near' : '');
    box.innerHTML = '保証契約の満了まで <b>あと ' + t.join(' ') + '</b>' +
                    '<span>' + jpy(e) + ' まで（' + YEARS + '年）</span>';
  }

  function rowHtml(r, i){
    var n  = nth(r);
    var on = live(r);
    var st = startDay(r);
    var fin = !!String(r.sign || '').trim();
    var sub = '';
    if(!day(r.out))      sub = '解約日を入れてください';
    else if(fin)         sub = '契約が決まりました';
    else if(on)          sub = jp(st) + ' から保証中';
    else                 sub = 'あと ' + left(r) + ' 日（' + jp(st) + ' から）';

    return '<div class="hs-row' + (on ? ' on' : '') + '" data-i="' + i + '">' +
      '<div><input type="text" class="hs-f" data-k="room" value="' + esc(r.room || '') + '" placeholder="101"></div>' +
      '<div><input type="date" class="hs-f" data-k="out" value="' + esc(r.out || '') + '"></div>' +
      numCell(r, 'rent', '65000') +
      '<div class="hs-c-amt"><div class="hs-amt">' + (base(r) ? ('¥' + yen(amount(r))) : '—') + '</div>' +
        '<div class="hs-now">' + nowHtml(r) + '</div></div>' +
      '<div class="hs-c-day"><div class="hs-day' + (on ? ' on' : '') + '">' +
        (day(r.out) ? ('<b>' + n + '</b> 日目') : '—') +
        '<span class="hs-sub">' + esc(sub) + '</span></div></div>' +
      '<div class="hs-c-sign"><input type="date" class="hs-f" data-k="sign" value="' + esc(r.sign || '') + '">' +
        '<div class="hs-wari">' + wariHtml(r) + '</div></div>' +
      '<div><button type="button" class="hs-fin' + (fin ? ' go' : '') + '" data-a="fin"' +
        (fin ? '' : ' disabled title="契約日を入れると押せます"') + '>完了</button></div>' +
      '<div><button type="button" class="hs-x" data-a="del" title="この行を消す">✕</button></div>' +
    '</div>';
  }

  function render(){
    if(!el('hs-section')) return;
    var box = el('hs-rows');
    if(!box) return;
    box.innerHTML = _rows.length
      ? _rows.map(rowHtml).join('')
      : '<div class="hs-none">保証している部屋はありません。「＋ 部屋を追加」から入れてください。</div>';
    refresh();
  }

  /* ★ 打っている最中は、行を作り直しません。
       作り直すとカーソルが飛び、消えた欄をブラウザが触ろうとして
       エラーになることがあります。計算した分だけ書き替えます。 */
  function refresh(){
    if(!el('hs-section')) return;
    var box = el('hs-rows');
    if(!box) return;

    _rows.forEach(function(r, i){
      var row = box.querySelector('.hs-row[data-i="' + i + '"]');
      if(!row) return;
      var on  = live(r);
      var n   = nth(r);
      var st  = startDay(r);
      var fin = !!String(r.sign || '').trim();

      row.classList.toggle('on', on);

      var amt = row.querySelector('.hs-amt');
      if(amt) amt.textContent = base(r) ? ('¥' + yen(amount(r))) : '—';

      var nw = row.querySelector('.hs-now');
      if(nw) nw.innerHTML = nowHtml(r);

      var wa = row.querySelector('.hs-wari');
      if(wa) wa.innerHTML = wariHtml(r);

      var dy = row.querySelector('.hs-day');
      if(dy){
        var sub = '';
        if(!day(r.out))      sub = '解約日を入れてください';
        else if(fin)         sub = '契約が決まりました';
        else if(on)          sub = jp(st) + ' から保証中';
        else                 sub = 'あと ' + left(r) + ' 日（' + jp(st) + ' から）';
        dy.classList.toggle('on', on);
        dy.innerHTML = (day(r.out) ? ('<b>' + n + '</b> 日目') : '—') +
                       '<span class="hs-sub">' + esc(sub) + '</span>';
      }

      var fb = row.querySelector('.hs-fin');
      if(fb){
        fb.disabled = !fin;
        fb.classList.toggle('go', fin);
        fb.title = fin ? '' : '契約日を入れると押せます';
      }
    });

    var n = 0;
    _rows.forEach(function(r){ if(live(r)) n++; });
    var b = el('hs-on');
    if(b){
      b.style.display = n ? 'inline-block' : 'none';
      b.textContent = '保証中 ' + n + ' 部屋';
    }
    var a = el('hs-add');
    if(a) a.disabled = (_rows.length >= MAX);
    paintTerm();

    /* もうすぐ保証が始まる部屋を、ここでもお知らせします */
    var soon = [];
    _rows.forEach(function(r){
      if(!day(r.out) || String(r.sign || '').trim()) return;
      if(live(r)) return;                 /* もう始まっている部屋は、お知らせしません */
      var d = left(r);
      if(d !== null && d > 0 && d <= PRE) soon.push((r.room || '(部屋番号なし)') + '：あと ' + d + ' 日');
    });
    /* 満了で打ち切っている部屋があれば、それも知らせます */
    var t = termEnd();
    var cut = [];
    if(t){
      _rows.forEach(function(r){
        if(!day(r.out)) return;
        var sg = day(r.sign);
        var to = sg ? plus(sg, -1) : null;
        var st = startDay(r);
        if(!st || st.getTime() > t.getTime()) return;       /* 満了より後に始まる */
        if(!to || to.getTime() > t.getTime()) cut.push(r.room || '(部屋番号なし)');
      });
    }
    var w = el('hs-warn');
    if(w){
      var h = '';
      if(soon.length) h += '<div class="hs-warn">まもなく保証が始まります　' + esc(soon.join('　／　')) + '</div>';
      if(cut.length)  h += '<div class="hs-warn cut">保証契約の満了は <b>' + esc(jpy(t)) + '</b> です。' +
                           'それより後のぶんは、金額に入れていません　' + esc(cut.join('　／　')) + '</div>';
      w.innerHTML = h;
    }
  }

  function add(){
    if(_rows.length >= MAX){ toast('部屋は ' + MAX + ' 件までです'); return; }
    _rows.push({ room:'', out:'', rent:'', sign:'' });
    dirty();
    render();
    var last = el('hs-rows').querySelector('.hs-row:last-child input');
    if(last) last.focus();
  }

  function onInput(ev){
    var f = ev.target;
    if(!f || !f.classList || !f.classList.contains('hs-f')) return;
    var row = f.closest('.hs-row');
    if(!row) return;
    var i = Number(row.getAttribute('data-i'));
    if(!_rows[i]) return;
    var k = f.getAttribute('data-k');
    _rows[i][k] = (k === 'rent') ? (f.value === '' ? '' : num(f.value)) : String(f.value || '');
    dirty();
    /* 打っている最中に作り直すと、カーソルが飛びます。
       日付と金額だけ、その場で計算し直します。 */
    refresh();
  }

  function onClick(ev){
    var b = ev.target.closest ? ev.target.closest('button[data-a]') : null;
    if(!b) return;
    var row = b.closest('.hs-row');
    if(!row) return;
    var i = Number(row.getAttribute('data-i'));
    var r = _rows[i];
    if(!r) return;
    if(b.getAttribute('data-a') === 'del'){
      var nm = (r.room || '').trim();
      if((nm || day(r.out)) && !confirm('この行を消します。よろしいですか？\n\n' +
          (nm ? ('部屋 ' + nm + '\n') : '') +
          '※ 履歴には残りません。保証を終えるときは「完了」を押してください。')) return;
      _rows.splice(i, 1);
      dirty(); render();
      return;
    }
    if(b.getAttribute('data-a') === 'fin') finish(i);
  }

  /* 完了 → 履歴へ移します */
  function finish(i){
    var r = _rows[i];
    if(!r) return;
    var sg = day(r.sign);
    if(!sg){ toast('契約日を入れてください'); return; }
    var ot = day(r.out);
    if(!ot){ toast('解約日を入れてください'); return; }
    if(sg.getTime() < ot.getTime()){ toast('契約日が、解約日より前になっています'); return; }

    var st = startDay(r);
    var w  = split(r, r.sign) || { list:[], total:0, days:0 };
    var paid = w.list.length > 0;                       /* 保証が発生したか */
    var to   = plus(sg, -1);                            /* 保証は契約日の前日まで */

    /* 月ごとの内わけ。欠けている月は日割りです */
    var lines = w.list.map(function(x){
      var t = '　　' + x.y + '年' + x.mo + '月分　¥' + yen(x.yen) +
              (x.full ? '（満額）'
                      : ('（日割り ' + x.days + '日 / ' + x.dim + '日　' +
                         jp(x.from) + '〜' + jp(x.to) + '）'));
      return t;
    }).join('\n');

    var msg = '部屋 ' + (r.room || '(部屋番号なし)') + ' の保証を完了にします。\n\n'
            + '　解約日　： ' + jpy(ot) + '\n'
            + '　契約日　： ' + jpy(sg) + '\n'
            + '　空室日数： ' + nth(r, sg) + ' 日\n\n'
            + (paid
                ? ('　募集賃料： ¥' + yen(base(r)) + '　→　30％＝ 月 ¥' + yen(amount(r)) + '\n'
                 + '　　（共益費・駐車場使用料は、保証の対象外です）\n\n'
                 + '　保証した期間： ' + jpy(st) + ' 〜 ' + jpy(w.to) + '（' + w.days + ' 日）\n'
                 + (w.cut ? ('　　※ 保証契約の満了（' + jpy(w.term) + '）で打ち切っています\n') : '')
                 + '\n'
                 + lines + '\n'
                 + '　　─────────────\n'
                 + '　　合計　¥' + yen(w.total) + '\n\n')
                : ('　保証が始まる前に決まったため、保証は発生していません。\n\n'))
            + '履歴に残して、この行を消します。よろしいですか？';
    if(!confirm(msg)) return;

    _log.unshift({
      room  : String(r.room || ''),
      out   : ymd(ot),
      sign  : ymd(sg),
      rent  : num(r.rent),
      amount: paid ? amount(r) : 0,
      total : paid ? w.total : 0,
      months: paid ? w.list.map(function(x){
                return { y:x.y, mo:x.mo, days:x.days, dim:x.dim, full:x.full, yen:x.yen };
              }) : [],
      from  : paid ? ymd(st) : '',
      to    : paid ? ymd(to) : '',
      days  : nth(r, sg),
      paid  : paid ? w.days : 0,
      at    : ymd(today0()),
      by    : who()
    });
    _rows.splice(i, 1);
    dirty(); render();
    toast('履歴に残しました');
  }

  /* 履歴に出す、月ごとの内わけ */
  function monHtml(h){
    var a = Array.isArray(h && h.months) ? h.months : [];
    if(!a.length) return '';
    return '<br>' + a.map(function(x){
      return esc(x.y + '年' + x.mo + '月　¥' + yen(x.yen) +
                 (x.full ? '（満額）' : ('（日割り ' + x.days + '/' + x.dim + '日）')));
    }).join('　／　');
  }

  /* ---------- 履歴 ---------- */
  function openHist(){
    var w = el('hs-hist');
    if(!w){
      w = document.createElement('div');
      w.id = 'hs-hist';
      document.body.appendChild(w);
      w.addEventListener('click', function(ev){ if(ev.target === w) closeHist(); });
    }
    var name = '';
    try{ name = (el('f-name') && el('f-name').value) || ''; }catch(e){}
    var body = _log.length
      ? _log.map(function(h){
          var per = h.from
            ? (jpy(h.from) + ' 〜 ' + jpy(h.to) + '（' + h.paid + ' 日）')
            : ('保証が始まる前に決まったため、保証はありません');
          return '<div class="hs-hrow">' +
            '<b>' + esc(h.room || '(部屋番号なし)') + '</b>' +
            '<div class="hs-hd2">' +
              '解約 ' + esc(jpy(h.out)) + '　→　契約 ' + esc(jpy(h.sign)) +
              '（空室 ' + h.days + ' 日）<br>' + esc(per) +
              monHtml(h) +
              (h.by ? ('<br>完了：' + esc(h.at) + '　' + esc(h.by)) : ('<br>完了：' + esc(h.at))) +
            '</div>' +
            '<div class="hs-hy">' + (h.total ? ('¥' + yen(h.total)) : (h.amount ? ('月 ¥' + yen(h.amount)) : '—')) +
              '<small>' + (h.amount ? ('月 ¥' + yen(h.amount)) : '') +
              (h.rent ? ('　募集 ¥' + yen(h.rent)) : '') +
              '</small></div>' +
          '</div>';
        }).join('')
      : '<div class="hs-none">まだ履歴はありません。契約日を入れて「完了」を押すと、ここに残ります。</div>';

    w.innerHTML = '<div class="hs-hcard">' +
      '<h3>30％保証の履歴</h3>' +
      '<div class="hs-hsub">' + esc(name || '(物件名なし)') + '　／　' + _log.length + ' 件</div>' +
      body +
      '<button type="button" class="hs-hclose" id="hs-hclose">とじる</button>' +
    '</div>';
    w.classList.add('on');
    el('hs-hclose').addEventListener('click', closeHist);
  }
  function closeHist(){ var w = el('hs-hist'); if(w) w.classList.remove('on'); }
  document.addEventListener('keydown', function(ev){
    if(ev.key === 'Escape'){ var w = el('hs-hist'); if(w && w.classList.contains('on')){ ev.stopPropagation(); closeHist(); } }
  }, true);

  /* ---------- ほかの部分とのつなぎ ---------- */
  function toast(m){
    try{ if(typeof showToast === 'function'){ showToast(m); return; } }catch(e){}
    try{ window.alert(m); }catch(e){}
  }
  /* buildings.js の変数は let で作られているため、window には付いていません。
     同じページの別ファイルからは、名前でそのまま触れます。 */
  function dirty(){
    try{ _modalDirty = true; }catch(e){}
    try{ window._modalDirty = true; }catch(e){}
  }
  function editId(){
    try{ if(typeof currentEditId !== 'undefined' && currentEditId) return currentEditId; }catch(e){}
    try{ if(window.currentEditId) return window.currentEditId; }catch(e){}
    return '';
  }

  function load(b){
    _from = String((b && b.guaranteeFrom) || '');
    try{ if(el('hs-from')) el('hs-from').value = _from; }catch(e){}
    _rows = rowsOf(b).map(function(r){
      return { room:String(r.room||''), out:String(r.out||''),
               rent:(r.rent === '' || r.rent == null) ? '' : num(r.rent),
               sign:String(r.sign||'') };
    }).slice(0, MAX);
    _log = logOf(b).map(function(h){ return Object.assign({}, h); });
    render();
  }
  function collect(){
    return _rows.filter(function(r){
      return String(r.room||'').trim() || String(r.out||'').trim() || base(r);
    }).map(function(r){
      return { room:String(r.room||'').trim(), out:String(r.out||''),
               rent:num(r.rent), sign:String(r.sign||'') };
    });
  }

  /* 物件の編集画面がひらいたら、この物件の分を出します */
  var _open = window.openModal;
  window.openModal = function(id){
    var r = _open.apply(this, arguments);
    try{
      style();
      if(build()){
        var b = null;
        try{ b = id ? ((typeof loadAll === 'function' ? loadAll() : {})[id] || null) : null; }catch(e){ b = null; }
        load(b);
      }
    }catch(e){ try{ console.warn('[保証] 画面を出せませんでした', e); }catch(x){} }
    return r;
  };

  /* 保存のときに、保証の分もいっしょに入れます。
     buildings.js を書き替えずに済むよう、保存の入口を包んでいます。 */
  var _saveBld = window.saveBld;
  var _inSave = false, _before = null;
  if(typeof _saveBld === 'function'){
    window.saveBld = function(){
      _inSave = true;
      try{ _before = Object.keys((typeof loadAll === 'function' ? loadAll() : {}) || {}); }catch(e){ _before = []; }
      try{ return _saveBld.apply(this, arguments); }
      finally{ _inSave = false; _before = null; }
    };
  }
  var _saveAll = window.saveAll;
  if(typeof _saveAll === 'function'){
    window.saveAll = function(data){
      try{
        if(_inSave && data){
          var id = editId();
          if(!id || !data[id]){
            /* 新しく作ったときは、前に無かった物件がそれです */
            var had = {}, k;
            (_before || []).forEach(function(x){ had[x] = 1; });
            for(k in data){ if(Object.prototype.hasOwnProperty.call(data, k) && !had[k]){ id = k; break; } }
          }
          if(id && data[id]){
            data[id].guarantees     = collect();
            data[id].guaranteeLog   = _log.slice(0, 200);
            data[id].guaranteeFrom  = _from;
          }
        }
      }catch(e){ try{ console.warn('[保証] 保存に足せませんでした', e); }catch(x){} }
      return _saveAll.apply(this, arguments);
    };
  }

  /* 一覧のカードに、赤い札を出します */
  function hook(){
    var ORIG = window._bldCardHtml;
    if(typeof ORIG !== 'function') return;
    if(ORIG.__hs) return;
    var wrapped = function(b){
      var h = ORIG.apply(this, arguments);
      try{
        if(liveCount(b) > 0){
          h = h.replace(/(<div class="bld-name[^"]*">)/,
                        '$1<span class="pv-hosho">30％保証中</span>');
        }
      }catch(e){}
      return h;
    };
    wrapped.__hs = true;
    window._bldCardHtml = wrapped;
  }
  /* uifix.js など、あとから差し替えるものより後ろで包みます */
  setTimeout(hook, 0);
  setTimeout(hook, 800);

  /* ================================================================
     ★ 毎月の送金のお知らせ

     オーナー様へは、毎月15日に「その月ぶん」を送金します。
     ですので、15日になったら、その月に送る金額をお知らせします。

     ・その月まるまる保証しているときは、満額（募集賃料の30％）
     ・その月のとちゅうで保証が始まるとき（91日目がその月）は、日割り
     ・その月のとちゅうで保証が終わるとき（契約が決まった日がその月）も、日割り

     例）10月20日に契約が決まった部屋
         10月は 10/1〜10/19 の19日ぶん。募集賃料の日割りの30％です。

     ・その月に一度だけ出します
     ・15日に誰も PIVOT を開かなかったときは、そのあと はじめて開いた人に
       出ます。お知らせを取りこぼさないためです。

     （LINE への通知は、別に用意します。これはこの画面だけのものです）
     ================================================================ */

  var PAY_DAY = 15;   /* 毎月、この日に送金します */

  /* その月の1日 */
  function mon1(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
  /* 月の差（何か月目か）。はじめの月を1か月目とかぞえます */
  function monthNo(from, now){
    return (now.getFullYear() - from.getFullYear()) * 12 +
           (now.getMonth() - from.getMonth()) + 1;
  }
  function monKey(d){
    var m = d.getMonth() + 1;
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m;
  }

  /* ★ はじめて請求する月の1日。
       保証が月のとちゅうで始まったときは、その端数だけを別に送らず、
       次の月ぶんに足して、いっしょに送ります。
       例）9月30日から保証 → 10月15日に「9/30〜10/31」をまとめて送る */
  function firstBill(r){
    var st = startDay(r);
    if(!st) return null;
    return (st.getDate() === 1) ? mon1(st) : mon1(plusM(st, 1));
  }

  /* ★ その月（15日）に送る金額。
       ・はじめての月は、前の月の端数もいっしょに入ります
       ・契約が決まっていれば、その前日までです
       その月に送るものがなければ null を返します。 */
  function monthPay(r, m1, term){
    var st = startDay(r);
    var fb = firstBill(r);
    if(!st || !fb || m1.getTime() < fb.getTime()) return null;
    var e   = mEnd(m1);
    var en  = endDay(r, term);
    var a   = (m1.getTime() === fb.getTime()) ? st : m1;
    var b   = (en && en.getTime() < e.getTime()) ? en : e;
    if(b.getTime() < a.getTime()) return null;   /* この月は、送るものがありません */
    var parts = splitRange(r, a, b);
    return { y:m1.getFullYear(), mo:m1.getMonth() + 1, from:a, to:b,
             days:span(a, b), dim:e.getDate(), parts:parts, yen:sumOf(parts),
             full:(parts.length === 1 && parts[0].full) };
  }

  /* ★ これから送る残り。
       いまの月ぶんは15日に送るので、残りは「次の月の1日」から
       「契約日の前日」までです。契約が決まっていなければ null。
       例）いま10月20日・契約開始12月23日 → 11/1〜12/22 をまとめて */
  function rest(r, at, term){
    var en = endDay(r, term);
    if(!en) return null;
    var now = at || today0();
    var st  = startDay(r);
    var a   = mon1(plusM(now, 1));
    if(st && a.getTime() < st.getTime()) a = st;
    if(en.getTime() < a.getTime()) return { list:[], total:0, days:0, from:null, to:null };
    var list = splitRange(r, a, en);
    return { list:list, total:sumOf(list), days:span(a, en), from:a, to:en };
  }

  /* いま、お知らせに出す部屋。その月に保証がかかっているものだけです */
  function due(at){
    var now = at || today0();
    var thisM = mon1(now);
    var out = [], all = {};
    try{ all = (typeof loadAll === 'function' ? loadAll() : {}) || {}; }catch(e){ return out; }
    Object.keys(all).forEach(function(k){
      var b = all[k];
      var term = termOf(b && b.guaranteeFrom);
      rowsOf(b).forEach(function(r){
        if(!day(r.out)) return;
        var m = monthPay(r, thisM, term);
        if(!m) return;
        var f = firstBill(r);
        out.push({ bld:(b.name || ''), room:(r.room || ''), nth:nth(r, now),
                   amount:amount(r), from:ymd(startDay(r)),
                   month:(f ? monthNo(f, thisM) : 1),
                   days:m.days, dim:m.dim, full:m.full, pay:m.yen,
                   pFrom:m.from, pTo:m.to, parts:m.parts,
                   lines:[m], total:m.yen });
      });
    });
    return out;
  }
  window.pvHoshoDue = due;

  /* at を渡すと、その日で組み立てます（確かめ用） */
  function tellMonth(at){
    var now  = at || today0();
    if(now.getDate() < PAY_DAY) return;     /* 15日になってから出します */
    var list = due(now);
    if(!list.length) return;
    var key = 'hs_told_' + monKey(now);
    try{ if(localStorage.getItem(key)) return; localStorage.setItem(key, '1'); }catch(e){}
    var sum = 0;
    var t = list.map(function(x){
      sum += x.pay;
      return '・' + x.bld + '　' + (x.room || '(部屋番号なし)') +
             '　¥' + yen(x.pay) +
             (x.full ? '（満額）'
                     : ('（' + md(x.pFrom) + '〜' + md(x.pTo) + '　' + x.days + '日ぶん）'));
    });
    try{
      window.alert('【30％保証賃料　' + (now.getMonth() + 1) + '月分の送金のお知らせ】\n\n' +
                   '毎月15日に、その月ぶんを送金します。\n\n' +
                   t.join('\n') +
                   '\n\n合計　¥' + yen(sum) +
                   '\n\n契約が決まったら、その行に「契約が決まった日」を入れてください。' +
                   '\nその月は日割りになります。' +
                   '\n\n※ このお知らせは、今月は一度だけ出します。');
    }catch(e){}
  }
  window.pvHoshoTell = tellMonth;
  setTimeout(function(){ try{ tellMonth(); }catch(e){} }, 4000);

  /* 確かめ用 */
  try{
    window.pvHosho = { rows:function(){ return _rows; }, log:function(){ return _log; },
                       nth:nth, live:live, base:base, amount:amount, split:split,
                       monthPay:monthPay, plusM:plusM, left:left, rest:rest,
                       startDay:startDay, endDay:endDay, firstBill:firstBill,
                       termEnd:termEnd, termOf:termOf, countdown:countdown,
                       FREE_DAYS:FREE_DAYS, YEARS:YEARS,
                       RATE:RATE, MAX:MAX, PAY_DAY:PAY_DAY };
  }catch(e){}
})();
