/*************************************************************
 * オーナー一覧 Excel取込  owner-import-2026-08-27a
 *
 *  「家主基本情報一覧.xlsx」をそのまま読み込みます。
 *   ・所有者別      … 所有者／メールアドレス／物件
 *   ・家主基本情報  … 郵便番号／住所／TEL／FAX ほか
 *   2枚を所有者名で突き合わせて、1件のオーナーにまとめます。
 *
 *  取込のきまり
 *   ・同じオーナーがいたら、連絡先は Excel の内容で上書き
 *   ・物件は消さずに足す（本番から移した物件が消えません）
 *   ・メール未入力の欄は、うすい赤で表示します
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
  let s = src.replace(/^\(\d+\)\s*/, "").replace(/\u3000/g, " ").trim();
  const m = s.match(/[（(]([^）)]+)[）)]\s*$/);
  if (!m) return s.replace(/\s+/g, "");
  let kana = m[1].normalize("NFKC").replace(/\s+/g, "");
  const head = s.slice(0, m.index).trim();
  const tail = head.split(/\s+/).slice(1).filter(t => {
    if (/^[A-Za-z]+$/.test(t)) return t === t.toUpperCase() && t.length >= 3;
    return true;
  });
  return kana + tail.join("");
}
 
/* 突き合わせ用に名前をそろえる（空白・全半角・敬称のゆれを吸収） */
function oiKey(s){
  return String(s || "")
    .replace(/^\(\d+\)\s*/, "")
    .normalize("NFKC")
    .replace(/[\s\u3000]/g, "")
    .replace(/(御中|様)$/, "")
    .toLowerCase();
}
 
/* 見出し行から列位置を探す */
function oiFindCol(header, ...cands){
  for (let i = 0; i < header.length; i++){
    const h = String(header[i] || "").replace(/[\s\u3000\n]/g, "");
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
 
/* ===== 取り込み本体 ===== */
async function oiImportWorkbook(file){
  const stat = document.getElementById("oiStat");
  const say = (t) => { if (stat) stat.innerHTML = t; };
  say("読み込み中…");
  try{
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
    if (cName < 0) { say('<span style="color:#c00">「所有者」の列が見つかりません。シートを確認してください。</span>'); return; }
 
    const map = new Map();   // key → {name, email, props:Set}
    for (let i = hO + 1; i < rowsO.length; i++){
      const r = rowsO[i] || [];
      const nameRaw = String(r[cName] || "").trim();
      if (!nameRaw) continue;
      const name = nameRaw.replace(/^\(\d+\)\s*/, "").replace(/\u3000/g, " ").trim();
      const k = oiKey(name);
      if (!map.has(k)) map.set(k, { name: name, email: "", props: new Set() });
      const e = map.get(k);
      const mail = cMail >= 0 ? String(r[cMail] || "").trim() : "";
      if (mail && !e.email) e.email = mail;
      const p = cProp >= 0 ? oiPropName(r[cProp]) : "";
      if (p) e.props.add(p);
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
        inv:  oiFindCol(headB, "適格請求書", "登録番号"),
      };
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
            memo: g(c.memo), sendWay: g(c.send), invoiceNo: g(c.inv),
          });
        }
      }
    }
 
    /* --- 反映：連絡先は上書き、物件は足す --- */
    let added = 0, updated = 0;
    const idx = new Map();
    owners.forEach((o, i) => idx.set(oiKey(o.name), i));
 
    map.forEach((e, k) => {
      const b = info.get(k) || {};
      const mail = e.email || b.mail || "";
      const at = idx.get(k);
      if (at === undefined){
        const props = Array.from(e.props);
        owners.push({
          name: e.name, properties: props, property: props.join("、"),
          atena: e.name + " 御中", email: mail,
          zip: b.zip || "", addr: b.addr || "", tel: b.tel || "", fax: b.fax || "",
          kana: b.kana || "", kbn: b.kbn || "", memo: b.memo || "",
          sendWay: b.sendWay || "", invoiceNo: b.invoiceNo || "",
        });
        added++;
      } else {
        const o = owners[at];
        if (mail) o.email = mail;                 // 連絡先は Excel を正とする
        ["zip","addr","tel","fax","kana","kbn","memo","sendWay","invoiceNo"].forEach(f => {
          if (b[f]) o[f] = b[f];
        });
        const cur = new Set((o.properties && o.properties.length) ? o.properties
                            : (o.property ? String(o.property).split(/[、,\n]/) : []));
        e.props.forEach(p => cur.add(p));         // 物件は消さずに足す
        o.properties = Array.from(cur).map(s => String(s).trim()).filter(Boolean);
        o.property = o.properties.join("、");
        updated++;
      }
    });
 
    // 名前が同じで中身が違うものを、そのまま2件持たない
    const noMail = owners.filter(o => !String(o.email || "").trim()).length;
 
    saveOwners(); renderOwners(); flashSaved();
    say('取り込みました　<b>新規 ' + added + '件</b>／更新 ' + updated + '件'
      + (noMail ? '　<span style="color:#c0392b;font-weight:700;">メール未入力 ' + noMail + '件</span>' : ''));
    toast("オーナー情報を取り込みました（新規 " + added + " / 更新 " + updated + "）");
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
 
try { window.RENT_IMPORT = { importWorkbook: oiImportWorkbook, propName: oiPropName }; } catch(e){}
