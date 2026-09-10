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

  var DAYS = 91;      /* 何日目から保証が始まるか */
  var RATE = 0.30;    /* 募集賃料に掛ける割合 */
  var MAX  = 10;      /* 何部屋まで足せるか */
  var PRE  = 3;       /* 何日前にお知らせするか */

  var _rows = [];     /* いま編集している物件の、保証の行 */
  var _log  = [];     /* いま編集している物件の、履歴 */

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
  function amount(r){ return Math.floor(num(r && r.rent) * RATE); }
  function startDay(r){ var s = day(r && r.out); return s ? plus(s, DAYS) : null; }
  /* いま保証中か（解約日あり・契約日なし・91日目以降） */
  function live(r, at){
    if(!r || !day(r.out)) return false;
    if(String(r.sign || '').trim()) return false;
    return nth(r, at) >= DAYS;
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
    var n = 0;
    rowsOf(b).forEach(function(r){ if(live(r)) n++; });
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
  + '.hs-lead{font-size:11.5px;line-height:1.75;color:#666;margin:6px 0 12px;}'
  + '.hs-wrap{max-height:430px;overflow:auto;}'
  + '.hs-hd,.hs-row{display:grid;gap:8px;align-items:center;'
  +   'grid-template-columns:96px 132px 116px 116px 1fr 132px 74px 30px;}'
  + '.hs-hd{font-size:11px;font-weight:700;color:#888;padding:0 2px 6px;position:sticky;top:0;background:#fff;z-index:1;}'
  + '.hs-row{padding:5px 2px;border-top:1px solid #f0f0f2;}'
  + '.hs-row.on{background:#fff5f4;}'
  /* 左は「いまの様子」、右は「決まったときに入れるところ」。
     あいだに細い線を引いて、役目のちがいを見せます */
  + '.hs-c-sign{border-left:1px solid #ececee;padding-left:14px;}'
  + '.hs-hd .hs-c-sign{border-left:1px solid #ececee;}'
  + '.hs-row input{width:100%;border:1px solid #d5d5d8;border-radius:7px;padding:7px 8px;font-size:12.5px;}'
  + '.hs-row input:focus{outline:none;border-color:#000;}'
  + '.hs-row input.ro{border-color:transparent;background:transparent;font-weight:700;}'
  + '.hs-amt{font-size:13px;font-weight:800;padding:7px 8px;white-space:nowrap;}'
  + '.hs-day{font-size:12px;font-weight:700;color:#666;padding:7px 4px;white-space:nowrap;}'
  + '.hs-day b{font-size:14px;}'
  + '.hs-day.on{color:#c7362a;}'
  + '.hs-day .hs-sub{display:block;font-size:10.5px;font-weight:500;color:#999;}'
  + '.hs-day.on .hs-sub{color:#c7362a;opacity:.8;}'
  + '.hs-x{border:0;background:transparent;color:#c7362a;font-size:15px;cursor:pointer;padding:4px;}'
  + '.hs-fin{border:1px solid #000;background:#fff;color:#000;font-size:11.5px;font-weight:700;'
  +   'padding:6px 6px;border-radius:7px;cursor:pointer;white-space:nowrap;}'
  + '.hs-fin.go{background:#000;color:#fff;}'
  + '.hs-fin[disabled]{opacity:.3;cursor:default;}'
  + '.hs-none{font-size:12px;color:#999;padding:14px 2px;}'
  + '.hs-warn{margin-top:10px;padding:10px 12px;border-radius:9px;background:#fff4e2;'
  +   'color:#7a4e0c;font-size:12px;line-height:1.7;font-weight:600;}'
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
  +   '.hs-row .hs-c-amt,.hs-row .hs-c-day{grid-column:1 / -1;}'
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
      '<div class="hs-lead">' +
        '空室が <b>' + DAYS + '日目</b>に入ると、募集賃料の <b>30％</b> を保証します。' +
        '解約日を入れると、空室の日数を毎日かぞえます。<br>' +
        '契約が決まったら契約日を入れて「完了」を押してください。数えるのを止めて、履歴に残します。' +
      '</div>' +
      '<div class="hs-wrap"><div class="hs-hd">' +
        '<div>部屋番号</div><div>解約日</div><div>募集賃料</div><div>保証賃料（30％）</div>' +
        '<div>空室の日数</div><div class="hs-c-sign">契約が決まった日</div><div></div><div></div>' +
      '</div><div id="hs-rows"></div></div>' +
      '<div id="hs-warn"></div>';
    anchor.parentNode.insertBefore(d, anchor.nextSibling);

    el('hs-add').addEventListener('click', add);
    el('hs-hist-b').addEventListener('click', openHist);
    el('hs-rows').addEventListener('input', onInput);
    el('hs-rows').addEventListener('change', onInput);
    el('hs-rows').addEventListener('click', onClick);
    return true;
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
    else                 sub = 'あと ' + Math.max(DAYS - n, 0) + ' 日（' + jp(st) + ' から）';

    return '<div class="hs-row' + (on ? ' on' : '') + '" data-i="' + i + '">' +
      '<div><input type="text" class="hs-f" data-k="room" value="' + esc(r.room || '') + '" placeholder="101"></div>' +
      '<div><input type="date" class="hs-f" data-k="out" value="' + esc(r.out || '') + '"></div>' +
      '<div><input type="number" class="hs-f" data-k="rent" value="' + (r.rent === '' || r.rent == null ? '' : num(r.rent)) + '" min="0" step="1000" placeholder="65000"></div>' +
      '<div class="hs-c-amt"><div class="hs-amt">' + (num(r.rent) ? ('¥' + yen(amount(r))) : '—') + '</div></div>' +
      '<div class="hs-c-day"><div class="hs-day' + (on ? ' on' : '') + '">' +
        (day(r.out) ? ('<b>' + n + '</b> 日目') : '—') +
        '<span class="hs-sub">' + esc(sub) + '</span></div></div>' +
      '<div class="hs-c-sign"><input type="date" class="hs-f" data-k="sign" value="' + esc(r.sign || '') + '"></div>' +
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
      if(amt) amt.textContent = num(r.rent) ? ('¥' + yen(amount(r))) : '—';

      var dy = row.querySelector('.hs-day');
      if(dy){
        var sub = '';
        if(!day(r.out))      sub = '解約日を入れてください';
        else if(fin)         sub = '契約が決まりました';
        else if(on)          sub = jp(st) + ' から保証中';
        else                 sub = 'あと ' + Math.max(DAYS - n, 0) + ' 日（' + jp(st) + ' から）';
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

    /* もうすぐ保証が始まる部屋を、ここでもお知らせします */
    var soon = [];
    _rows.forEach(function(r){
      if(!day(r.out) || String(r.sign || '').trim()) return;
      var d = DAYS - nth(r);
      if(d >= 0 && d <= PRE) soon.push((r.room || '(部屋番号なし)') + '：あと ' + d + ' 日');
    });
    var w = el('hs-warn');
    if(w){
      w.innerHTML = soon.length
        ? '<div class="hs-warn">まもなく保証が始まります　' + esc(soon.join('　／　')) + '</div>'
        : '';
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
    var paid = (sg.getTime() > st.getTime());          /* 保証が発生したか */
    var to   = plus(sg, -1);                            /* 保証は契約日の前日まで */
    var mons = paid ? Math.max(Math.round((to.getTime() - st.getTime()) / 86400000) + 1, 0) : 0;

    var msg = '部屋 ' + (r.room || '(部屋番号なし)') + ' の保証を完了にします。\n\n'
            + '　解約日　： ' + jpy(ot) + '\n'
            + '　契約日　： ' + jpy(sg) + '\n'
            + '　空室日数： ' + nth(r, sg) + ' 日\n\n'
            + (paid
                ? ('　保証した期間： ' + jpy(st) + ' 〜 ' + jpy(to) + '（' + mons + ' 日）\n'
                 + '　保証賃料　　： 月 ¥' + yen(amount(r)) + '\n\n')
                : ('　' + DAYS + '日目より前に決まったため、保証は発生していません。\n\n'))
            + '履歴に残して、この行を消します。よろしいですか？';
    if(!confirm(msg)) return;

    _log.unshift({
      room  : String(r.room || ''),
      out   : ymd(ot),
      sign  : ymd(sg),
      rent  : num(r.rent),
      amount: paid ? amount(r) : 0,
      from  : paid ? ymd(st) : '',
      to    : paid ? ymd(to) : '',
      days  : nth(r, sg),
      paid  : paid ? mons : 0,
      at    : ymd(today0()),
      by    : who()
    });
    _rows.splice(i, 1);
    dirty(); render();
    toast('履歴に残しました');
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
            : (DAYS + '日目より前に決まったため、保証はありません');
          return '<div class="hs-hrow">' +
            '<b>' + esc(h.room || '(部屋番号なし)') + '</b>' +
            '<div class="hs-hd2">' +
              '解約 ' + esc(jpy(h.out)) + '　→　契約 ' + esc(jpy(h.sign)) +
              '（空室 ' + h.days + ' 日）<br>' + esc(per) +
              (h.by ? ('<br>完了：' + esc(h.at) + '　' + esc(h.by)) : ('<br>完了：' + esc(h.at))) +
            '</div>' +
            '<div class="hs-hy">' + (h.amount ? ('月 ¥' + yen(h.amount)) : '—') +
              '<small>' + (h.rent ? ('募集 ¥' + yen(h.rent)) : '') + '</small></div>' +
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
      return String(r.room||'').trim() || String(r.out||'').trim() || num(r.rent);
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
            data[id].guarantees   = collect();
            data[id].guaranteeLog = _log.slice(0, 200);
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

  /* 開いたときに、もうすぐ91日目の部屋があればお知らせします。
     （LINE への通知は、別に用意します。これはこの画面だけのものです） */
  function due(){
    var out = [], all = {};
    try{ all = (typeof loadAll === 'function' ? loadAll() : {}) || {}; }catch(e){ return out; }
    Object.keys(all).forEach(function(k){
      var b = all[k];
      rowsOf(b).forEach(function(r){
        if(!day(r.out) || String(r.sign || '').trim()) return;
        var n = nth(r);
        var d = DAYS - n;
        if(d === PRE || d === 0 || (d < 0 && n === DAYS)){
          out.push({ bld:(b.name || ''), room:(r.room || ''), nth:n, left:d,
                     amount:amount(r), from:ymd(startDay(r)) });
        }
      });
    });
    return out;
  }
  window.pvHoshoDue = due;

  function tellOnce(){
    var list = due();
    if(!list.length) return;
    var key = 'hs_told_' + ymd(today0());
    try{ if(localStorage.getItem(key)) return; localStorage.setItem(key, '1'); }catch(e){}
    var t = list.map(function(x){
      return '・' + x.bld + '　' + (x.room || '(部屋番号なし)') +
             (x.left > 0 ? ('　あと ' + x.left + ' 日で保証が始まります')
                         : ('　きょうから保証です（月 ¥' + yen(x.amount) + '）'));
    });
    try{
      window.alert('【30％保証のお知らせ】\n\n' + t.join('\n') +
                   '\n\n※ このお知らせは、きょうは一度だけ出します。');
    }catch(e){}
  }
  setTimeout(function(){ try{ tellOnce(); }catch(e){} }, 4000);

  /* 確かめ用 */
  try{
    window.pvHosho = { rows:function(){ return _rows; }, log:function(){ return _log; },
                       nth:nth, live:live, amount:amount, DAYS:DAYS, RATE:RATE, MAX:MAX };
  }catch(e){}
})();
