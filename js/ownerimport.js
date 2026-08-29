/*************************************************************
 * オーナー一覧 Excel取込  owner-import-2026-08-29c
 *
 *  「家主基本情報一覧.xlsx」をそのまま読み込みます。
 *   ・所有者別      … 所有者／メールアドレス／物件
 *   ・家主基本情報  … 郵便番号／住所／TEL／FAX ほか
 *   2枚を所有者名で突き合わせて、1件のオーナーにまとめます。
 *
 *  ★2026-08-29 変更点
 *   ・取り込む前に「突き合わせの結果」を必ず見せます（プレビュー）。
 *     いきなり書き換えないので、事故が起きません。
 *   ・取り込み方を選べます。
 *       物件だけ足す … 既存オーナーの連絡先には一切触りません（初期値）
 *       連絡先も更新 … メール・住所・TEL なども Excel の内容にします
 *   ・名前が少し違うだけの「同じ会社かもしれない」分は、
 *     1件ずつ「同じ／別」を選べます。
 *   ・物件はどのモードでも消しません（足すだけ）。
 *     エリアの違う物件を持つオーナーでも、今の物件は残ります。
 *   ・同じ Excel から「物件一覧」にも登録できます（物件名・郵便番号・住所）。
 *     区画は0のまま。同じ名前の物件があれば、住所だけ直します。
 *     区画・配置図・写真には触りません。
 *   ・「○○ A」「○○ B」「○○ 東」のように棟で分かれている物件は、
 *       住所が同じ → A/B を外して 1つの物件にまとめます
 *       住所が違う → 1つの物件にして、2つめ以降を「棟マスター」に入れます
 *     （メイン住所には A の住所、棟マスターに B の住所が自動で入ります）
 *************************************************************/

/* 物件名をカタカナ表記に直す。
   括弧の中のカナを採り、外に残る大文字ローマ字・数字・日本語は後ろに付ける。
   例) Louvre NAGAOKA(ﾙｰﾌﾞﾙ) → ルーブルNAGAOKA */
const OI_NAME_FIX = {
  // 変換表で直した対応をここに追記していきます。
  // "(87) Cross　Road　Ⅱ": "クロスロードⅡ",
};
function oiPropName(raw){
  const src = String(raw || "").trim();
  if (!src) return "";
  if (OI_NAME_FIX[src]) return OI_NAME_FIX[src];
  let s = src.replace(/^\(\d+\)\s*/, "").trim();
  const m = s.match(/[（(]([^）)]+)[）)]\s*$/);
  const head = m ? s.slice(0, m.index).trim() : s;
  /* ★カッコの中をカナ名として採るのは、
     カッコの前がローマ字のとき（＝古い書式 "Amenity（アメニティ）"）だけにします。
     こうしないと「シルヴィア　（東）」が「東」になってしまいます。
     すでに整えてある名前は、書いてあるとおりに使います。 */
  if (m && /[A-Za-z]/.test(head)){
    const kana = m[1].normalize("NFKC").replace(/\s+/g, "");
    const tail = head.replace(/　/g, " ").split(/\s+/).slice(1).filter(t => {
      if (/^[A-Za-z]+$/.test(t)) return t === t.toUpperCase() && t.length >= 3;
      return true;
    });
    return kana + tail.join("");
  }
  // 全角スペースは半角に、続いた空白は1つに、前後は詰める（それ以外は変えません）
  return s.replace(/　/g, " ").replace(/\s+/g, " ").trim();
}

/* 突き合わせ用に名前をそろえる（空白・全半角・敬称のゆれを吸収） */
function oiKey(s){
  return String(s || "")
    .replace(/^\(\d+\)\s*/, "")
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(/(御中|様)$/, "")
    .toLowerCase();
}
/* もっとゆるい突き合わせ用。「株式会社」「(株)」や記号・異体字の違いを外します。
   これで一致したものは、決めつけずに「同じ会社かもしれない」として出します。 */
const OI_KANJI_VAR = { '髙':'高','﨑':'崎','濵':'浜','濱':'浜','德':'徳','眞':'真','靑':'青' };
function oiKeyLoose(s){
  let n = oiKey(s);
  n = n.replace(/[髙﨑濵濱德眞靑]/g, c => OI_KANJI_VAR[c] || c);
  n = n.replace(/(株式会社|有限会社|合同会社|一般社団法人|一般財団法人|\(株\)|\(有\)|\(合\))/g, "");
  n = n.replace(/[・･,，\.。\-ー―─()（）「」『』]/g, "");
  return n;
}

/* 見出し行から列位置を探す */
function oiFindCol(header, ...cands){
  for (let i = 0; i < header.length; i++){
    const h = String(header[i] || "").replace(/[\s　\n]/g, "");
    if (cands.some(c => h.indexOf(c) >= 0)) return i;
  }
  return -1;
}
function oiHeaderRow(rows){
  for (let i = 0; i < Math.min(8, rows.length); i++){
    const line = (rows[i] || []).map(x => String(x || "")).join("");
    if (line.indexOf("所有者") >= 0 || line.indexOf("家主") >= 0) return i;
  }
  return 0;
}
function oiEsc(s){
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* ===== ① Excel を読んで、取り込む中身を作る ===== */
async function oiReadWorkbook(file){
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const shOwner = wb.Sheets["所有者別"] || wb.Sheets[wb.SheetNames[0]];
  const shBase  = wb.Sheets["家主基本情報"] || null;

  /* --- 所有者別：オーナー・メール・物件 --- */
  const rowsO = XLSX.utils.sheet_to_json(shOwner, { header: 1, defval: "" });
  const hO = oiHeaderRow(rowsO), headO = rowsO[hO] || [];
  const cName = oiFindCol(headO, "所有者", "家主");
  const cMail = oiFindCol(headO, "メール");
  const cProp = oiFindCol(headO, "物件", "物　件");
  const cZip  = oiFindCol(headO, "郵便");
  const cAddr = oiFindCol(headO, "住所");
  if (cName < 0) throw new Error("「所有者」の列が見つかりません。シートを確認してください。");

  const map  = new Map();  // key → {name, email, props:Set}
  const bldg = new Map();  // 物件名 → {zip, addr}
  for (let i = hO + 1; i < rowsO.length; i++){
    const r = rowsO[i] || [];
    const nameRaw = String(r[cName] || "").trim();
    if (!nameRaw) continue;
    const name = nameRaw.replace(/^\(\d+\)\s*/, "").replace(/　/g, " ").trim();
    const k = oiKey(name);
    if (!map.has(k)) map.set(k, { name: name, email: "", props: new Set() });
    const e = map.get(k);
    const mail = cMail >= 0 ? String(r[cMail] || "").trim() : "";
    if (mail && !e.email) e.email = mail;
    const p = cProp >= 0 ? oiPropName(r[cProp]) : "";
    if (p){
      e.props.add(p);
      // 物件一覧に登録するための郵便番号・住所（この行の物件のもの）
      const z = cZip  >= 0 ? String(r[cZip]  || "").trim() : "";
      const a = cAddr >= 0 ? String(r[cAddr] || "").trim() : "";
      if (!bldg.has(p)) bldg.set(p, { zip:z, addr:a });
      else { const g = bldg.get(p); if (!g.zip && z) g.zip = z; if (!g.addr && a) g.addr = a; }
    }
  }

  /* --- 家主基本情報：住所・TEL など --- */
  const info = new Map();
  if (shBase){
    const rowsB = XLSX.utils.sheet_to_json(shBase, { header: 1, defval: "" });
    const hB = oiHeaderRow(rowsB), headB = rowsB[hB] || [];
    const c = {
      name: oiFindCol(headB, "家主", "所有者"),
      kana: oiFindCol(headB, "カナ"),
      kbn:  oiFindCol(headB, "区分"),
      zip:  oiFindCol(headB, "郵便"),
      addr: oiFindCol(headB, "住所"),
      tel:  oiFindCol(headB, "TEL", "電話"),
      fax:  oiFindCol(headB, "FAX"),
      mail: oiFindCol(headB, "メール"),
      memo: oiFindCol(headB, "備考"),
      send: oiFindCol(headB, "送信方法"),
      tax:  oiFindCol(headB, "適格請求書", "登録番号"),
    };
    // 「適格請求書…」の列には 課税事業者／免税事業者 が入り、
    // 登録番号(T…)は そのすぐ右どなりの列（見出しが空欄）に入っている。
    c.inv = (c.tax >= 0) ? c.tax + 1 : -1;
    if (c.name >= 0){
      for (let i = hB + 1; i < rowsB.length; i++){
        const r = rowsB[i] || [];
        const nm = String(r[c.name] || "").trim();
        if (!nm) continue;
        const g = (x) => (x >= 0 ? String(r[x] || "").trim() : "");
        info.set(oiKey(nm), {
          name: nm.replace(/^\(\d+\)\s*/, "").trim(),
          kana: g(c.kana), kbn: g(c.kbn), zip: g(c.zip), addr: g(c.addr),
          tel: g(c.tel), fax: g(c.fax), mail: g(c.mail),
          memo: g(c.memo), sendWay: g(c.send),
          taxKbn: g(c.tax), invoiceNo: /^T?\d/.test(g(c.inv)) ? g(c.inv) : "",
        });
      }
    }
  }
  return { map, info, bldg };
}

/* ===== ② 今のオーナー一覧と突き合わせる（まだ書き換えません） ===== */
function oiBuildPlan(map, info, owners){
  const strict = new Map();   // 完全一致用
  const loose  = new Map();   // ゆるい一致用（同じキーが複数なら候補にしない）
  owners.forEach((o, i) => {
    const k = oiKey(o.name);
    if (!strict.has(k)) strict.set(k, i);
    const l = oiKeyLoose(o.name);
    if (!loose.has(l)) loose.set(l, [i]); else loose.get(l).push(i);
  });

  const same = [], maybe = [], neu = [];
  map.forEach((e, k) => {
    const b = info.get(k) || {};
    const item = { key:k, name:e.name, email:(e.email || b.mail || ""), props:Array.from(e.props), base:b };
    const at = strict.get(k);
    if (at !== undefined){ item.at = at; same.push(item); return; }
    const cand = loose.get(oiKeyLoose(e.name));
    if (cand && cand.length === 1){ item.at = cand[0]; maybe.push(item); return; }
    neu.push(item);
  });
  return { same, maybe, neu };
}

/* ===== 「○○ A」「○○ B」を1つの物件にまとめる =====
   住所が同じなら A/B を外して1物件に。
   住所が違うなら、1つめをメイン、2つめ以降を「棟マスター」に入れます。 */
const OI_TOU_PATTERNS = [
  /^(.*?)[\s]*([A-Za-zＡ-Ｚａ-ｚ])棟$/,          // ○○A棟
  /^(.*?)[\s]*([東西南北])棟$/,                  // ○○東棟
  /^(.*?)[\s]*[（(]([東西南北])[）)]$/,          // ○○（東）
  /^(.*?)[\s]+([A-Za-zＡ-Ｚａ-ｚ])$/,            // ○○ A
  /^(.*?)[\s]+([東西南北])$/,                    // ○○ 東
  /^(.*?)[\s]*([東西南北])$/                     // ○○東
];
function oiSplitTou(name){
  const n = String(name || "").trim();
  for (let i = 0; i < OI_TOU_PATTERNS.length; i++){
    const m = n.match(OI_TOU_PATTERNS[i]);
    if (m && m[1].trim().length >= 2) return { base: m[1].trim(), tou: m[2] };
  }
  return { base: n, tou: "" };
}
function oiMergeTou(bldg){
  const g = new Map();   // 本体の名前 → [{name, tou, zip, addr}]
  bldg.forEach((v, name) => {
    const s = oiSplitTou(name);
    if (!g.has(s.base)) g.set(s.base, []);
    g.get(s.base).push({ name: name, tou: s.tou, zip: v.zip || "", addr: v.addr || "" });
  });
  const out = new Map();
  let merged = 0, toued = 0;
  g.forEach((list, base) => {
    if (list.length === 1){
      const x = list[0];
      out.set(x.name, { zip:x.zip, addr:x.addr, mainTou:"", tous:[] });
      return;
    }
    // 棟の名前の順に並べます（A→B→C／東→西→南→北）
    const ord = "東西南北";
    list.sort((a, b) => {
      const ia = ord.indexOf(a.tou), ib = ord.indexOf(b.tou);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return String(a.tou).localeCompare(String(b.tou), "ja");
    });
    const addrs = {};
    list.forEach(x => { addrs[x.addr || ""] = 1; });
    if (Object.keys(addrs).length === 1){
      // 住所が同じ → A/B を外して1つに
      out.set(base, { zip:list[0].zip, addr:list[0].addr, mainTou:"", tous:[] });
      merged += list.length - 1;
    } else {
      // 住所が違う → 1つめをメイン、2つめ以降を棟マスターへ
      const head = list[0], rest = list.slice(1);
      out.set(base, {
        zip: head.zip, addr: head.addr, mainTou: head.tou || "",
        tous: rest.map(x => ({ tou: x.tou || "", zip: x.zip || "", addr: x.addr || "" }))
      });
      toued += rest.length;
    }
  });
  out._merged = merged; out._toued = toued;
  return out;
}

/* ===== 物件一覧（buildings.js の保存領域）への登録 =====
   ★ contracts.js / ownermail.js は自分の中に包まれているので、
     ここで見える loadAll / saveAll / renderAll は buildings.js のものです。 */
function oiBldKey(s){
  return String(s || "").normalize("NFKC").replace(/[\s　]/g, "").toLowerCase();
}
function oiCountBuildings(bldg){
  const out = { total: bldg ? bldg.size : 0, add: 0, upd: 0,
                merged: (bldg && bldg._merged) || 0, toued: (bldg && bldg._toued) || 0 };
  if (!bldg || !bldg.size) return out;
  let all = {};
  try{ all = (typeof pbLoadAll === "function") ? (pbLoadAll() || {}) : {}; }catch(e){}
  const have = new Set(Object.values(all).map(b => oiBldKey((b || {}).name)));
  bldg.forEach((v, name) => { if (have.has(oiBldKey(name))) out.upd++; else out.add++; });
  return out;
}
function oiApplyBuildings(bldg){
  if (!bldg || !bldg.size) return { add:0, upd:0, ok:true };
  if (typeof pbLoadAll !== "function" || typeof saveAll !== "function"){
    return { add:0, upd:0, ok:false };
  }
  const all = pbLoadAll() || {};
  const idx = {};
  Object.keys(all).forEach(k => {
    const n = oiBldKey((all[k] || {}).name);
    if (n && !(n in idx)) idx[n] = k;
  });
  let add = 0, upd = 0;
  bldg.forEach((v, name) => {
    const k = oiBldKey(name);
    if (idx[k]){
      const b = all[idx[k]];
      if (v.addr) b.addr = v.addr;      // 住所だけ直します
      if (v.zip)  b.zip  = v.zip;
      if (v.mainTou && !b.main_tou) b.main_tou = v.mainTou;
      // 棟マスターは、まだ登録が無いときだけ入れます（手で直した分を消さないため）
      if (v.tous && v.tous.length && !(Array.isArray(b.tou_addrs) && b.tou_addrs.length)){
        b.tou_addrs = v.tous.slice();
      }
      upd++;                            // 区画・配置図・写真はそのまま
    } else {
      const id = "bld_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      all[id] = {
        id: id, name: name, zip: v.zip || "", addr: v.addr || "",
        spots: [], main_tou: v.mainTou || "", layout_id: "", layout2_id: "",
        mime: {}, photo_ids: [], tou_addrs: (v.tous || []).slice()
      };
      idx[k] = id;
      add++;
    }
  });
  saveAll(all);
  try{ if (typeof renderAll === "function") renderAll(); }catch(e){}
  return { add, upd, ok:true };
}

/* ===== ③ 突き合わせの結果を見せる ===== */
let _oiPlan = null, _oiOwners = null;
function oiShowPreview(plan, owners){
  _oiPlan = plan; _oiOwners = owners;
  const old = document.getElementById("oi-prev"); if (old) old.remove();
  const ov = document.createElement("div");
  ov.id = "oi-prev";
  ov.setAttribute("style",
    "position:fixed;inset:0;z-index:190000;background:rgba(0,0,0,.45);display:flex;" +
    "align-items:center;justify-content:center;padding:16px;");
  const nProp = plan.same.reduce((a,x)=>a+x.props.length,0) + plan.neu.reduce((a,x)=>a+x.props.length,0);
  const row = (x, cls) =>
    '<div class="oi-r ' + cls + '"><span class="oi-nm">' + oiEsc(x.name) + '</span>' +
    '<span class="oi-sub">物件 ' + x.props.length + '件' + (x.email ? ' ／ ' + oiEsc(x.email) : '') + '</span></div>';
  const maybeRow = (x, i) =>
    '<div class="oi-r oi-maybe">' +
      '<div class="oi-nm">' + oiEsc(x.name) + '<span class="oi-sub">（Excel）物件 ' + x.props.length + '件</span></div>' +
      '<div class="oi-vs">今ある「<b>' + oiEsc(owners[x.at] ? owners[x.at].name : "") + '</b>」と同じ会社ですか？</div>' +
      '<div class="oi-ch">' +
        '<label><input type="radio" name="oim' + i + '" value="same" checked> 同じ（物件を足す）</label>' +
        '<label><input type="radio" name="oim' + i + '" value="new"> 別（新しく作る）</label>' +
      '</div>' +
    '</div>';
  ov.innerHTML =
    '<div class="oi-card">' +
      '<div class="oi-head">取り込む前の確認</div>' +
      '<div class="oi-sum">' +
        '<div><b>' + plan.same.length + '</b><span>今あるオーナーと一致</span></div>' +
        '<div><b>' + plan.neu.length + '</b><span>新しいオーナー</span></div>' +
        '<div><b>' + plan.maybe.length + '</b><span>同じか迷うもの</span></div>' +
        '<div><b>' + nProp + '</b><span>足される物件</span></div>' +
      '</div>' +
      '<div class="oi-mode">' +
        '<label><input type="radio" name="oimode" value="addr" checked>' +
          '<b>物件を足す ＋ 住所を更新</b>' +
          '<span>郵便番号と住所だけ Excel の内容にします。メール・TEL・FAX は触りません（おすすめ）</span></label>' +
        '<label><input type="radio" name="oimode" value="propsonly">' +
          '<b>物件だけ足す</b><span>今あるオーナーの連絡先には一切触りません</span></label>' +
        '<label><input type="radio" name="oimode" value="full">' +
          '<b>連絡先も全部更新する</b><span>メール・住所・TEL・FAX・インボイス番号などを書き換えます</span></label>' +
      '</div>' +
      (plan.bldgStat && plan.bldgStat.total
        ? '<div class="oi-bld"><label><input type="checkbox" id="oi-bld-on" checked>' +
            '<b>物件一覧にも登録する</b>' +
            '<span>新しく作る ' + plan.bldgStat.add + '件 ／ 住所だけ直す ' + plan.bldgStat.upd + '件' +
            (plan.bldgStat.merged ? '<br>「○○ A」「○○ B」で住所が同じ ' + plan.bldgStat.merged + '件は、A/Bを外して1つにまとめます。' : '') +
            (plan.bldgStat.toued  ? '<br>住所が違う棟 ' + plan.bldgStat.toued + '件は、「棟マスター」に住所ごと登録します。' : '') +
            '<br>区画は0のまま。すでにある物件の区画・配置図・写真には触りません。</span>' +
          '</label></div>'
        : '') +
      (plan.maybe.length
        ? '<div class="oi-sec">同じか迷うもの（1件ずつ選んでください）</div>' +
          '<div class="oi-list oi-maybe-list">' + plan.maybe.map(maybeRow).join('') + '</div>'
        : '') +
      '<div class="oi-sec">新しく作るオーナー ' + plan.neu.length + '件</div>' +
      '<div class="oi-list">' + (plan.neu.map(x=>row(x,'oi-new')).join('') || '<div class="oi-none">ありません</div>') + '</div>' +
      '<div class="oi-sec">今あるオーナーに物件を足す ' + plan.same.length + '件</div>' +
      '<div class="oi-list">' + (plan.same.map(x=>row(x,'oi-same')).join('') || '<div class="oi-none">ありません</div>') + '</div>' +
      '<div class="oi-foot">' +
        '<button type="button" class="oi-cancel">やめる</button>' +
        '<button type="button" class="oi-ok">この内容で取り込む</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
  ov.querySelector(".oi-cancel").onclick = () => ov.remove();
  ov.querySelector(".oi-ok").onclick = () => {
    const mode = (ov.querySelector('input[name="oimode"]:checked') || {}).value || "addr";
    const pick = plan.maybe.map((x, i) => {
      const el = ov.querySelector('input[name="oim' + i + '"]:checked');
      return (el && el.value === "new") ? "new" : "same";
    });
    const bldOn = !!(ov.querySelector("#oi-bld-on") || {}).checked;
    ov.remove();
    oiApply(plan, mode, pick, bldOn);
  };
}

/* ===== ④ 実際に取り込む ===== */
function oiApply(plan, mode, pick, bldOn){
  const C = window.RENT_CORE;
  if (!C) return;
  const owners = C.owners;
  const stat = document.getElementById("oiStat");
  const say = (t) => { if (stat) stat.innerHTML = t; };
  const FIELDS = ["zip","addr","tel","fax","kana","kbn","memo","sendWay","taxKbn","invoiceNo"];

  const addProps = (o, props) => {
    const cur = new Set((o.properties && o.properties.length) ? o.properties
                        : (o.property ? String(o.property).split(/[、,\n]/) : []));
    props.forEach(p => cur.add(p));          // 物件は消さずに足す
    o.properties = Array.from(cur).map(s => String(s).trim()).filter(Boolean);
    o.property = o.properties.join("、");
  };
  const makeNew = (x) => {
    const b = x.base || {};
    owners.push({
      name: x.name, properties: x.props.slice(), property: x.props.join("、"),
      atena: x.name + " 御中", email: x.email || "",
      zip: b.zip || "", addr: b.addr || "", tel: b.tel || "", fax: b.fax || "",
      kana: b.kana || "", kbn: b.kbn || "", memo: b.memo || "",
      sendWay: b.sendWay || "", taxKbn: b.taxKbn || "", invoiceNo: b.invoiceNo || "",
    });
  };
  const updateExisting = (x) => {
    const o = owners[x.at];
    if (!o) { makeNew(x); return; }
    addProps(o, x.props);
    const b = x.base || {};
    if (mode === "addr"){
      // 郵便番号と住所だけ。メール・TEL などは触りません。
      ["zip","addr"].forEach(f => { if (b[f]) o[f] = b[f]; });
    } else if (mode === "full"){
      if (x.email) o.email = x.email;                    // 空欄では上書きしません
      FIELDS.forEach(f => { if (b[f]) o[f] = b[f]; });
    }
  };

  let added = 0, updated = 0;
  plan.same.forEach(x => { updateExisting(x); updated++; });
  plan.maybe.forEach((x, i) => {
    if (pick[i] === "new"){ makeNew(x); added++; }
    else { updateExisting(x); updated++; }
  });
  plan.neu.forEach(x => { makeNew(x); added++; });

  // 物件一覧にも登録する（チェックが入っているときだけ）
  let bres = { add:0, upd:0, ok:true };
  if (bldOn && plan.bldg && plan.bldg.size) bres = oiApplyBuildings(plan.bldg);

  const noMail = owners.filter(o => !String(o.email || "").trim()).length;
  C.save(); C.render(); C.flash();
  say('取り込みました　<b>新規 ' + added + '件</b>／物件を足した ' + updated + '件'
    + (mode === "propsonly" ? '　<span style="color:#555;">※連絡先は触っていません</span>' : '')
    + (mode === "addr" ? '　<span style="color:#555;">※住所だけ更新しました</span>' : '')
    + (noMail ? '　<span style="color:#c0392b;font-weight:700;">メール未入力 ' + noMail + '件</span>' : '')
    + ((bres.add || bres.upd)
        ? '<br><span style="color:#17171a;">物件一覧：新規 <b>' + bres.add + '件</b>／住所を直した ' + bres.upd + '件</span>'
        : '')
    + ((bldOn && !bres.ok) ? '<br><span style="color:#c00;">物件一覧には登録できませんでした（物件画面の準備ができていません）</span>' : ''));
  C.toast("オーナー情報を取り込みました（新規 " + added + " / 更新 " + updated + "）");
}

/* ===== 入口 ===== */
async function oiImportWorkbook(file){
  const C = window.RENT_CORE;
  if (!C){ alert("オーナー一覧の準備ができていません。ページを再読み込みしてください。"); return; }
  const stat = document.getElementById("oiStat");
  const say = (t) => { if (stat) stat.innerHTML = t; };
  say("読み込み中…");
  try{
    const { map, info, bldg } = await oiReadWorkbook(file);
    if (map.size === 0){ say('<span style="color:#c00">オーナーが1件も読み取れませんでした。</span>'); return; }
    const plan = oiBuildPlan(map, info, C.owners);
    plan.bldg = oiMergeTou(bldg || new Map());
    plan.bldgStat = oiCountBuildings(plan.bldg);
    say('突き合わせました。内容を確認してください。');
    oiShowPreview(plan, C.owners);
  } catch (err){
    say('<span style="color:#c00">読み込めませんでした：' + (err && err.message ? err.message : err) + '</span>');
  }
}

/* ===== 取込ボックスの配線 ===== */
(function oiBind(){
  const box = document.getElementById("oiDrop");
  const inp = document.getElementById("oiFile");
  if (!box || !inp) return;
  ["dragover","dragenter"].forEach(ev =>
    box.addEventListener(ev, e => { e.preventDefault(); box.classList.add("over"); }));
  ["dragleave","drop"].forEach(ev =>
    box.addEventListener(ev, e => { e.preventDefault(); box.classList.remove("over"); }));
  box.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) oiImportWorkbook(f); });
  inp.addEventListener("change", e => { const f = e.target.files[0]; if (f) oiImportWorkbook(f); });
})();

/* ===== 確認画面の見た目（このファイルの中で完結させています） ===== */
(function oiStyle(){
  if (document.getElementById("oi-style")) return;
  const st = document.createElement("style");
  st.id = "oi-style";
  st.textContent = [
    "#oi-prev .oi-card{background:#fff;border-radius:14px;width:min(760px,100%);max-height:92vh;",
    "  display:flex;flex-direction:column;overflow:hidden;font-family:inherit;}",
    "#oi-prev .oi-head{padding:16px 20px;background:#17171a;color:#fff;font-size:16px;font-weight:800;letter-spacing:.06em;}",
    "#oi-prev .oi-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#ededf0;}",
    "#oi-prev .oi-sum>div{background:#fff;padding:14px 10px;text-align:center;}",
    "#oi-prev .oi-sum b{display:block;font-size:24px;font-weight:800;color:#17171a;}",
    "#oi-prev .oi-sum span{font-size:12px;color:#8a8a90;}",
    "#oi-prev .oi-mode{padding:14px 20px;border-top:1px solid #ededf0;display:grid;gap:8px;}",
    "#oi-prev .oi-mode label{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:14px;cursor:pointer;}",
    "#oi-prev .oi-mode b{font-weight:800;color:#17171a;}",
    "#oi-prev .oi-mode span{font-size:12.5px;color:#8a8a90;flex:1 0 100%;padding-left:24px;}",
    "#oi-prev .oi-bld{padding:12px 20px;border-top:1px solid #ededf0;background:#fafafa;}",
    "#oi-prev .oi-bld label{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:14px;cursor:pointer;}",
    "#oi-prev .oi-bld b{font-weight:800;color:#17171a;}",
    "#oi-prev .oi-bld span{font-size:12.5px;color:#8a8a90;flex:1 0 100%;padding-left:24px;line-height:1.8;}",
    "#oi-prev .oi-sec{padding:12px 20px 6px;font-size:12.5px;font-weight:800;color:#8a8a90;",
    "  letter-spacing:.08em;border-top:1px solid #ededf0;}",
    "#oi-prev .oi-list{overflow-y:auto;max-height:24vh;padding:0 20px 8px;}",
    "#oi-prev .oi-maybe-list{max-height:34vh;}",
    "#oi-prev .oi-r{padding:9px 0;border-bottom:1px solid #f2f2f5;font-size:14px;}",
    "#oi-prev .oi-nm{font-weight:800;color:#17171a;}",
    "#oi-prev .oi-sub{font-size:12.5px;color:#8a8a90;margin-left:8px;font-weight:600;}",
    "#oi-prev .oi-maybe{background:#fafafa;border:1px solid #e3e3e6;border-radius:10px;padding:11px 12px;margin:8px 0;}",
    "#oi-prev .oi-vs{font-size:13px;color:#3d3d42;margin:6px 0 8px;}",
    "#oi-prev .oi-ch{display:flex;gap:16px;flex-wrap:wrap;font-size:13.5px;}",
    "#oi-prev .oi-ch label{cursor:pointer;}",
    "#oi-prev .oi-none{padding:10px 0;color:#a8a8ae;font-size:13px;}",
    "#oi-prev .oi-foot{margin-top:auto;padding:14px 20px;border-top:1px solid #ededf0;display:flex;gap:10px;justify-content:flex-end;}",
    "#oi-prev .oi-foot button{padding:12px 22px;border-radius:999px;border:0;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;}",
    "#oi-prev .oi-cancel{background:#f0f0f3;color:#3d3d42;}",
    "#oi-prev .oi-ok{background:#17171a;color:#fff;}",
    "@media (max-width:640px){#oi-prev .oi-sum{grid-template-columns:repeat(2,1fr);}",
    "  #oi-prev .oi-list{max-height:22vh;}}"
  ].join("\n");
  document.head.appendChild(st);
})();

try { window.RENT_IMPORT = { importWorkbook: oiImportWorkbook, propName: oiPropName }; } catch(e){}
