/*************************************************************
 * 区画・契約 Excel一括取込  spot-import-2026-08-29a
 *
 *  Excel を1枚ドロップすると、全物件の区画をまとめて入れます。
 *  1行 ＝ 1区画。シート「区画一覧」（無ければ先頭のシート）を読みます。
 *
 *  見出しの名前で列を探すので、列の並び順は自由です。
 *    物件名／区画番号／状況／契約者名／部屋番号／金額／仕様／棟／備考
 *
 *  ・Excel に無い区画は、そのまま残します（消しません）
 *  ・Excel にある区画は、その内容で書き換えます
 *  ・PIVOT に無い物件名の行は取り込まず、一覧で出します
 *  ・取り込む前に必ず確認画面を出します
 *************************************************************/

const SI_TYPES  = ['並','縦','軽','機'];
const SI_STATUS = ['借','空','解','予','退','募停','申'];
/* 書き方のゆれを、PIVOTの記号に直します */
const SI_STATUS_ALIAS = {
  '使用中':'借','入居中':'借','契約中':'借','賃貸中':'借','有':'借',
  '空車':'空','空き':'空','空室':'空','なし':'空','無':'空','':'空',
  '解約':'解','解約予定':'解','退去予定':'解',
  '予約':'予','予約済':'予','予約済み':'予',
  '退去':'退','退去済':'退','退去済み':'退',
  '募集停止':'募停','停止':'募停','工事中':'募停',
  '申込':'申','申込中':'申','申し込み':'申'
};
const SI_TYPE_ALIAS = {
  '並列':'並','普通':'並','通常':'並','':'並',
  '縦列':'縦','縦列駐車':'縦',
  '軽':'軽','軽自動車':'軽','軽専用':'軽',
  '機械':'機','機械式':'機'
};

function siNorm(s){
  return String(s == null ? '' : s).normalize('NFKC').replace(/[\s　]/g, '');
}
function siKey(s){ return siNorm(s).toLowerCase(); }
function siEsc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
/* 見出し行から列の位置を探します */
function siCol(header, cands){
  for(let i = 0; i < header.length; i++){
    const h = siNorm(header[i]);
    if(!h) continue;
    for(let k = 0; k < cands.length; k++){ if(h.indexOf(cands[k]) >= 0) return i; }
  }
  return -1;
}
function siHeaderRow(rows){
  for(let i = 0; i < Math.min(8, rows.length); i++){
    const line = (rows[i] || []).map(x => siNorm(x)).join('');
    if(line.indexOf('物件') >= 0 && line.indexOf('区画') >= 0) return i;
  }
  return 0;
}

/* ===== Excel を読む ===== */
async function siRead(file){
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type:'array' });
  const sh = wb.Sheets['区画一覧'] || wb.Sheets[wb.SheetNames[0]];
  if(!sh) throw new Error('シートが見つかりません。');
  const rows = XLSX.utils.sheet_to_json(sh, { header:1, defval:'' });
  const hi = siHeaderRow(rows), head = rows[hi] || [];
  const c = {
    prop  : siCol(head, ['物件']),
    no    : siCol(head, ['区画']),
    status: siCol(head, ['状況','状態']),
    user  : siCol(head, ['契約者','氏名','名義','使用者']),
    room  : siCol(head, ['部屋']),
    price : siCol(head, ['金額','賃料','料金','使用料']),
    type  : siCol(head, ['仕様','種別','タイプ']),
    tou   : siCol(head, ['棟']),
    note  : siCol(head, ['備考','メモ'])
  };
  if(c.prop < 0) throw new Error('「物件名」の列が見つかりません。1行目の見出しを確認してください。');
  if(c.no   < 0) throw new Error('「区画番号」の列が見つかりません。1行目の見出しを確認してください。');

  const out = [], bad = [];
  for(let i = hi + 1; i < rows.length; i++){
    const r = rows[i] || [];
    const g = (x) => (x >= 0 ? String(r[x] == null ? '' : r[x]).trim() : '');
    const prop = g(c.prop);
    if(!prop) continue;
    const noRaw = g(c.no);
    const no = parseInt(String(noRaw).replace(/[^0-9]/g, ''), 10);
    if(!no || no < 1){ bad.push('Excelの' + (i + 1) + '行目: 区画番号が読めません（' + noRaw + '）'); continue; }

    let st = siNorm(g(c.status));
    if(SI_STATUS_ALIAS[st] !== undefined) st = SI_STATUS_ALIAS[st];
    if(SI_STATUS.indexOf(st) < 0){
      if(st) bad.push('Excelの' + (i + 1) + '行目: 状況「' + st + '」がわからないので「空」にします');
      st = '空';
    }
    let ty = siNorm(g(c.type));
    if(SI_TYPE_ALIAS[ty] !== undefined) ty = SI_TYPE_ALIAS[ty];
    if(SI_TYPES.indexOf(ty) < 0){
      if(ty) bad.push('Excelの' + (i + 1) + '行目: 仕様「' + ty + '」がわからないので「並」にします');
      ty = '並';
    }
    out.push({
      row   : i + 1,
      prop  : prop,
      no    : no,
      status: st,
      type  : ty,
      user  : g(c.user),
      room  : String(g(c.room)).replace(/^P/i, '').replace(/\.0$/, ''),
      price : parseInt(g(c.price).replace(/[^0-9]/g, ''), 10) || 0,
      tou   : g(c.tou),
      note  : g(c.note)
    });
  }
  return { rows: out, bad: bad };
}

/* ===== 物件と突き合わせて、取り込む中身を作る ===== */
function siPlan(list){
  let all = {};
  try{ all = (typeof pbLoadAll === 'function') ? (pbLoadAll() || {}) : {}; }catch(e){ all = {}; }
  const idx = {};
  Object.keys(all).forEach(id => { const k = siKey((all[id] || {}).name); if(k && !(k in idx)) idx[k] = id; });

  const hit = new Map();     // 物件ID → { name, rows:Map(区画番号→行), add:[], upd:[] }
  const miss = new Map();    // 見つからない物件名 → 件数
  const dup = [];            // 同じ物件・同じ区画番号が2行以上
  const seen = {};
  list.forEach(r => {
    const id = idx[siKey(r.prop)];
    if(!id){ miss.set(r.prop, (miss.get(r.prop) || 0) + 1); return; }
    const dk = id + '#' + r.no;
    if(seen[dk]){ dup.push(r.prop + ' の ' + r.no + '番（Excelの' + seen[dk] + '行目と' + r.row + '行目）'); }
    seen[dk] = r.row;
    if(!hit.has(id)) hit.set(id, { name:(all[id] || {}).name || '', rows:new Map(), add:[], upd:[] });
    // 同じ区画番号が2行あったら、あとの行で上書きします（二重に作らない）
    hit.get(id).rows.set(r.no, r);
  });
  // すでにある区画かどうかで、新規 / 書き換え に振り分けます
  hit.forEach((v, id) => {
    const cur = {};
    ((all[id] || {}).spots || []).forEach(s => { cur[parseInt(String(s.no).replace(/\D/g, ''), 10)] = 1; });
    v.rows.forEach((r, no) => { (cur[no] ? v.upd : v.add).push(r); });
  });
  return { all, hit, miss, dup };
}

/* ===== 実際に入れる ===== */
function siApply(plan){
  const all = plan.all;
  let addN = 0, updN = 0, bldN = 0;
  plan.hit.forEach((v, id) => {
    const b = all[id]; if(!b) return;
    const spots = Array.isArray(b.spots) ? b.spots.slice() : [];
    const pos = {};
    spots.forEach((s, i) => { pos[parseInt(String(s.no).replace(/\D/g, ''), 10)] = i; });
    v.add.concat(v.upd).forEach(r => {
      const now = {
        no: r.no, type: r.type, tou: r.tou, room: r.room,
        user: r.user, price: r.price, status: r.status, note: r.note
      };
      if(pos[r.no] !== undefined){
        // すでにある区画 … 契約の日付や予約は消さずに、上の項目だけ書き換えます
        spots[pos[r.no]] = Object.assign({}, spots[pos[r.no]], now);
        updN++;
      } else {
        spots.push(Object.assign({ start_date:'', end_date:'' }, now));
        pos[r.no] = spots.length - 1;   // 同じ番号が続けて来ても二重に作らない
        addN++;
      }
    });
    spots.sort((a, b2) => (parseInt(String(a.no).replace(/\D/g,''),10) || 0) - (parseInt(String(b2.no).replace(/\D/g,''),10) || 0));
    b.spots = spots;
    bldN++;
  });
  if(typeof saveAll === 'function') saveAll(all);
  try{ if(typeof renderAll === 'function') renderAll(); }catch(e){}
  return { addN, updN, bldN };
}

/* ===== 画面 ===== */
function siClose(){ const o = document.getElementById('si-ov'); if(o) o.remove(); }
function siOpen(){
  siClose();
  const ov = document.createElement('div');
  ov.id = 'si-ov';
  ov.innerHTML =
    '<div class="si-card">' +
      '<div class="si-head">区画・契約の一括取込<button type="button" class="si-x" title="閉じる">✕</button></div>' +
      '<div class="si-body">' +
        '<div id="si-drop" class="si-drop">' +
          '<div class="si-ico">📘</div>' +
          '<div class="si-t">区画のExcelをドロップ / クリック</div>' +
          '<div class="si-s">1行 ＝ 1区画。シート「区画一覧」を読みます。<br>' +
            'Excel に無い区画はそのまま残ります。取り込む前に確認画面を出します。</div>' +
          '<input type="file" id="si-file" accept=".xlsx,.xls" style="display:none">' +
        '</div>' +
        '<div id="si-stat" class="si-stat"></div>' +
        '<div id="si-result"></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
  ov.querySelector('.si-x').onclick = siClose;
  ov.addEventListener('click', e => { if(e.target === ov) siClose(); });
  const box = ov.querySelector('#si-drop'), inp = ov.querySelector('#si-file');
  box.onclick = () => inp.click();
  ['dragover','dragenter'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); box.classList.add('over'); }));
  ['dragleave','drop'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); box.classList.remove('over'); }));
  box.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if(f) siLoad(f); });
  inp.addEventListener('change', e => { const f = e.target.files[0]; if(f) siLoad(f); });
}

async function siLoad(file){
  const stat = document.getElementById('si-stat');
  const res  = document.getElementById('si-result');
  const say = (t) => { if(stat) stat.innerHTML = t; };
  say('読み込み中…'); if(res) res.innerHTML = '';
  try{
    const { rows, bad } = await siRead(file);
    if(!rows.length){ say('<span class="si-ng">区画が1件も読み取れませんでした。</span>'); return; }
    const plan = siPlan(rows);
    say('読み取りました。内容を確認してください。');
    siPreview(plan, rows, bad);
  }catch(err){
    say('<span class="si-ng">読み込めませんでした：' + siEsc(err && err.message ? err.message : err) + '</span>');
  }
}

function siPreview(plan, rows, bad){
  let addN = 0, updN = 0;
  plan.hit.forEach(v => { addN += v.add.length; updN += v.upd.length; });
  let missN = 0; plan.miss.forEach(n => { missN += n; });
  const list = [];
  plan.hit.forEach(v => list.push(v));
  list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ja'));

  const res = document.getElementById('si-result');
  res.innerHTML =
    '<div class="si-sum">' +
      '<div><b>' + plan.hit.size + '</b><span>取り込む物件</span></div>' +
      '<div><b>' + addN + '</b><span>新しく作る区画</span></div>' +
      '<div><b>' + updN + '</b><span>書き換える区画</span></div>' +
      '<div><b>' + plan.miss.size + '</b><span>見つからない物件</span></div>' +
    '</div>' +
    (plan.miss.size
      ? '<div class="si-sec si-warn">PIVOT に無い物件名 ' + plan.miss.size + '件（' + missN + '行）… 取り込みません</div>' +
        '<div class="si-list">' + Array.from(plan.miss.keys()).map(n =>
            '<div>' + siEsc(n) + ' <span>' + plan.miss.get(n) + '行</span></div>').join('') + '</div>'
      : '') +
    (plan.dup.length
      ? '<div class="si-sec si-warn">同じ区画番号が2回以上出てきます ' + plan.dup.length + '件（あとの行が勝ちます）</div>' +
        '<div class="si-list">' + plan.dup.map(x => '<div>' + siEsc(x) + '</div>').join('') + '</div>'
      : '') +
    (bad.length
      ? '<div class="si-sec si-warn">書き方がわからなかったところ ' + bad.length + '件</div>' +
        '<div class="si-list">' + bad.map(x => '<div>' + siEsc(x) + '</div>').join('') + '</div>'
      : '') +
    '<div class="si-sec">取り込む物件 ' + plan.hit.size + '件</div>' +
    '<div class="si-list">' + (list.map(v =>
        '<div>' + siEsc(v.name) + ' <span>新規 ' + v.add.length + ' ／ 書き換え ' + v.upd.length + '</span></div>'
      ).join('') || '<div class="si-none">ありません</div>') + '</div>' +
    '<div class="si-note">Excel に無い区画は、そのまま残ります。すでにある区画の契約日・予約は消しません。</div>' +
    '<div class="si-foot">' +
      '<button type="button" class="si-cancel">やめる</button>' +
      '<button type="button" class="si-ok">この内容で取り込む</button>' +
    '</div>';
  res.querySelector('.si-cancel').onclick = siClose;
  res.querySelector('.si-ok').onclick = () => {
    if(!confirm('物件 ' + plan.hit.size + '件に、区画を新しく ' + addN + '件つくり、' + updN + '件を書き換えます。\n\nよろしいですか？')) return;
    const r = siApply(plan);
    res.innerHTML = '<div class="si-done">✅ 取り込みました<br>物件 <b>' + r.bldN + '件</b> ／ 区画を新しく <b>' + r.addN + '件</b> ／ 書き換え <b>' + r.updN + '件</b></div>' +
      '<div class="si-foot"><button type="button" class="si-ok">閉じる</button></div>';
    res.querySelector('.si-ok').onclick = siClose;
    try{ if(typeof showToast === 'function') showToast('区画を取り込みました（新規 ' + r.addN + ' / 書き換え ' + r.updN + '）'); }catch(e){}
  };
}

/* ===== 見た目 ===== */
(function siStyle(){
  if(document.getElementById('si-style')) return;
  const st = document.createElement('style');
  st.id = 'si-style';
  st.textContent = [
    '#si-ov{position:fixed;inset:0;z-index:190000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;}',
    '#si-ov .si-card{background:#fff;border-radius:14px;width:min(760px,100%);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;}',
    '#si-ov .si-head{padding:16px 20px;background:#17171a;color:#fff;font-size:16px;font-weight:800;letter-spacing:.06em;display:flex;align-items:center;}',
    '#si-ov .si-x{margin-left:auto;background:transparent;border:0;color:#fff;font-size:16px;cursor:pointer;}',
    '#si-ov .si-body{overflow-y:auto;padding:16px 20px 20px;}',
    '#si-ov .si-drop{border:3px dashed #b9b9c2;border-radius:16px;padding:34px 20px;text-align:center;cursor:pointer;background:#fafafa;}',
    '#si-ov .si-drop.over{background:#f0f0f3;border-color:#17171a;}',
    '#si-ov .si-ico{font-size:2.2rem;line-height:1;margin-bottom:8px;}',
    '#si-ov .si-t{font-weight:800;font-size:1.05rem;color:#17171a;}',
    '#si-ov .si-s{font-size:.82rem;color:#8a8a90;margin-top:8px;line-height:1.7;}',
    '#si-ov .si-stat{font-size:.92rem;margin-top:12px;font-weight:700;text-align:center;}',
    '#si-ov .si-ng{color:#c0392b;}',
    '#si-ov .si-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#ededf0;margin-top:14px;border:1px solid #ededf0;}',
    '#si-ov .si-sum>div{background:#fff;padding:12px 8px;text-align:center;}',
    '#si-ov .si-sum b{display:block;font-size:22px;font-weight:800;color:#17171a;}',
    '#si-ov .si-sum span{font-size:11.5px;color:#8a8a90;}',
    '#si-ov .si-sec{padding:12px 0 6px;font-size:12.5px;font-weight:800;color:#8a8a90;letter-spacing:.08em;border-top:1px solid #ededf0;margin-top:10px;}',
    '#si-ov .si-warn{color:#17171a;}',
    '#si-ov .si-list{max-height:24vh;overflow-y:auto;font-size:13.5px;}',
    '#si-ov .si-list>div{padding:7px 0;border-bottom:1px solid #f2f2f5;font-weight:700;color:#17171a;}',
    '#si-ov .si-list span{font-size:12.5px;color:#8a8a90;font-weight:600;margin-left:8px;}',
    '#si-ov .si-none{color:#a8a8ae;font-size:13px;}',
    '#si-ov .si-note{font-size:12.5px;color:#8a8a90;margin-top:12px;line-height:1.7;}',
    '#si-ov .si-done{padding:24px 0;text-align:center;font-size:15px;font-weight:700;color:#17171a;line-height:2;}',
    '#si-ov .si-foot{margin-top:14px;padding-top:14px;border-top:1px solid #ededf0;display:flex;gap:10px;justify-content:flex-end;}',
    '#si-ov .si-foot button{padding:12px 22px;border-radius:999px;border:0;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;}',
    '#si-ov .si-cancel{background:#f0f0f3;color:#3d3d42;}',
    '#si-ov .si-ok{background:#17171a;color:#fff;}',
    '@media (max-width:640px){#si-ov .si-sum{grid-template-columns:repeat(2,1fr);}}'
  ].join('\n');
  document.head.appendChild(st);
})();

try{ window.openSpotImport = siOpen; }catch(e){}
