/* ==================================================================
 * OWNER MAIL / 家賃明細送信 (IIFE / window.RENT)
 * ================================================================== */
 
/* ===== OWNER MAIL (家賃明細送信 / namespaced) ===== */
(function(){
const OWNER_SEED = [{"name": "株式会社成徳", "email": "", "atena": "株式会社成徳 御中", "properties": ["フェリックス", "ヒラリアス"], "property": "フェリックス、ヒラリアス"}, {"name": "株式会社第八白兎", "email": "yamakawashuichi@icloud.com", "atena": "株式会社第八白兎 御中", "properties": ["マースフル"], "property": "マースフル"}, {"name": "株式会社FIFTY", "email": "", "atena": "株式会社FIFTY 御中", "properties": ["S place bld."], "property": "S place bld."}, {"name": "株式会社ヤマノ", "email": "", "atena": "株式会社ヤマノ 御中", "properties": ["タリスヴィータ A棟", "タリスヴィータ B棟"], "property": "タリスヴィータ A棟、タリスヴィータ B棟"}, {"name": "ケーエステート合同会社", "email": "ikeken0710@icloud.com", "atena": "ケーエステート合同会社 御中", "properties": ["アルヴィータA棟", "アルヴィータB棟", "手城町3丁目戸建"], "property": "アルヴィータA棟、アルヴィータB棟、手城町3丁目戸建"}, {"name": "佐々木 康成", "email": "kangchengzuomu371@gmail.com", "atena": "佐々木 康成 様", "properties": ["瀬戸町戸建て"], "property": "瀬戸町戸建て"}, {"name": "ＳＡＭＡ ＳＡＭＡ合同会社", "email": "okada@okaebi.co.jp", "atena": "ＳＡＭＡ ＳＡＭＡ合同会社 御中", "properties": ["カルコーサ"], "property": "カルコーサ"}, {"name": "合同会社Ｓｔａｎｄ Ｕｐ", "email": "standup.kasaoka@gmail.com", "atena": "合同会社Ｓｔａｎｄ Ｕｐ 角田 大助 様", "properties": ["マルヴィナ", "ミルドレッド"], "property": "マルヴィナ、ミルドレッド"}, {"name": "合同会社ONE", "email": "syu.14769@gmail.com", "atena": "合同会社ONE 御中", "properties": ["スピネルデュオ"], "property": "スピネルデュオ"}, {"name": "FOMIL株式会社", "email": "info@fomil.jp", "atena": "FOMIL株式会社 御中", "properties": ["福山市東町戸建て"], "property": "福山市東町戸建て"}, {"name": "有限会社リカーショップ岡本", "email": "", "atena": "有限会社リカーショップ岡本 御中", "properties": ["スピネル"], "property": "スピネル"}, {"name": "Ａｓｓｅｔ Ｏｎｅ合同会社", "email": "", "atena": "Ａｓｓｅｔ Ｏｎｅ合同会社 御中", "properties": ["アロモントA棟", "アロモントB棟"], "property": "アロモントA棟、アロモントB棟"}, {"name": "アルファプラス株式会社", "email": "", "atena": "アルファプラス株式会社 御中", "properties": ["ナディア A", "ナディア B"], "property": "ナディア A、ナディア B"}, {"name": "アンプラグド合同会社", "email": "", "atena": "アンプラグド合同会社 御中", "properties": ["メゾンドリヴァージュA棟", "メゾンドリヴァージュB棟", "アメリア", "クラリス", "カルムコート西棟", "カルムコート東棟"], "property": "メゾンドリヴァージュA棟、メゾンドリヴァージュB棟、アメリア、クラリス、カルムコート西棟、カルムコート東棟"}, {"name": "Ｎ・Ｋアセット株式会社", "email": "", "atena": "Ｎ・Ｋアセット株式会社 御中", "properties": ["ソルトグラス"], "property": "ソルトグラス"}, {"name": "岡田 秀司", "email": "", "atena": "岡田 秀司 様", "properties": ["岡田駐車場"], "property": "岡田駐車場"}, {"name": "オスカ有限会社", "email": "osk.kouge@gmail.com", "atena": "オスカ有限会社 御中", "properties": ["ミラヴィルタス西棟", "ミラヴィルタス東棟"], "property": "ミラヴィルタス西棟、ミラヴィルタス東棟"}, {"name": "株式会社IRE", "email": "asano@i-r-e.jp", "atena": "株式会社IRE 御中 淺野充弘様", "properties": ["グロリオサ", "アルカンシェルA棟", "アルカンシェルB棟", "アシンプトートA棟", "アシンプトートB棟", "エルキュールA棟", "エルキュールB棟", "エルキュールC棟", "ラコリーヌA", "ラコリーヌB", "シティハイツ暁の星", "フレンディア常光 A棟", "フレンディア常光 B棟", "曙町戸建", "アンティカベラカーサ", "ベラカーサフェリーチェ", "モデルノ", "ペルシュ城山", "seto house East", "引野町2丁目貸家", "ガーデンヒルズ長者町", "ベラカーササウス", "ベラカーサノース", "アルファステイツ福山駅前Ⅱ", "メリッサ", "ミステール", "手城町戸建て事務所", "ビラ芳翠 A", "ビラ芳翠 Ｂ", "KUSADO HOUSE"], "property": "グロリオサ、アルカンシェルA棟、アルカンシェルB棟、アシンプトートA棟、アシンプトートB棟、エルキュールA棟、エルキュールB棟、エルキュールC棟、ラコリーヌA、ラコリーヌB、シティハイツ暁の星、フレンディア常光 A棟、フレンディア常光 B棟、曙町戸建、アンティカベラカーサ、ベラカーサフェリーチェ、モデルノ、ペルシュ城山、seto house East、引野町2丁目貸家、ガーデンヒルズ長者町、ベラカーササウス、ベラカーサノース、アルファステイツ福山駅前Ⅱ、メリッサ、ミステール、手城町戸建て事務所、ビラ芳翠 A、ビラ芳翠 Ｂ、KUSADO HOUSE"}, {"name": "株式会社Ｍ．ｓｔｙｌｅ", "email": "", "atena": "株式会社Ｍ．ｓｔｙｌｅ 御中", "properties": ["アイディール", "ハルモニア"], "property": "アイディール、ハルモニア"}, {"name": "株式会社香苞", "email": "", "atena": "株式会社香苞 御中", "properties": ["アプリシティ", "サントーシャ", "シャンティ", "タラッサ"], "property": "アプリシティ、サントーシャ、シャンティ、タラッサ"}, {"name": "株式会社グリッター", "email": "", "atena": "株式会社グリッター 御中", "properties": ["ディアレスト", "ノブリスA棟", "ノブリスB棟", "ミーティアA棟", "ミーティアB棟", "ソアヴィータ"], "property": "ディアレスト、ノブリスA棟、ノブリスB棟、ミーティアA棟、ミーティアB棟、ソアヴィータ"}, {"name": "株式会社ＮＥＷＳＴＹＬＥ", "email": "", "atena": "株式会社ＮＥＷＳＴＹＬＥ 御中", "properties": ["アルカディアA棟", "アルカディアB棟", "アルカディアC棟", "アルカディアD棟", "プティメゾン", "プレジール高橋"], "property": "アルカディアA棟、アルカディアB棟、アルカディアC棟、アルカディアD棟、プティメゾン、プレジール高橋"}, {"name": "家族資産CMC合同会社", "email": "", "atena": "家族資産CMC合同会社  石井 俊光 様", "properties": ["春日町ユニキューブ Ａ棟", "春日町ユニキューブ B棟", "マジェステ Ｂ棟", "マジェステ Ａ棟"], "property": "春日町ユニキューブ Ａ棟、春日町ユニキューブ B棟、マジェステ Ｂ棟、マジェステ Ａ棟"}, {"name": "ケービーエス株式会社", "email": "kbshoken@eagle.ocn.ne.jp", "atena": "ケービーエス株式会社 御中", "properties": ["テタンジェ", "アルデバランＢ棟", "アルデバランＡ棟"], "property": "テタンジェ、アルデバランＢ棟、アルデバランＡ棟"}, {"name": "合同会社CKS", "email": "", "atena": "合同会社CKS 御中", "properties": ["一宮賃貸戸建Ｂ", "上富井戸建 西棟", "上富井戸建 東棟"], "property": "一宮賃貸戸建Ｂ、上富井戸建 西棟、上富井戸建 東棟"}, {"name": "篠原 滋男", "email": "", "atena": "篠原 滋男 様", "properties": ["篠原貸工場"], "property": "篠原貸工場"}, {"name": "Turnkey合同会社", "email": "", "atena": "Turnkey合同会社 御中", "properties": ["マーベラスA棟", "マーベラスB棟", "ルミエール静A棟", "ルミエール静B棟", "ハイサニー B", "ハイサニー A"], "property": "マーベラスA棟、マーベラスB棟、ルミエール静A棟、ルミエール静B棟、ハイサニー B、ハイサニー A"}, {"name": "田川 彰子", "email": "", "atena": "田川 彰子 様", "properties": ["ローレルコート霞町"], "property": "ローレルコート霞町"}, {"name": "段 燕鈴", "email": "kikik-81@163.com", "atena": "段 燕鈴 様", "properties": ["エバーグリーン福山西町"], "property": "エバーグリーン福山西町"}, {"name": "鶴丸汽船株式会社", "email": "", "atena": "鶴丸汽船株式会社 御中", "properties": ["ガーデンヒルズ長者町"], "property": "ガーデンヒルズ長者町"}, {"name": "合同会社内海商会", "email": "baramatsuri.22@gmail.com", "atena": "合同会社内海商会 御中", "properties": ["アルバ北棟", "アルバ南棟", "西谷ユニキューブ", "KASUGAエコパティオ", "ユニキューブ浦上", "シティハイツみどり", "テラストリア"], "property": "アルバ北棟、アルバ南棟、西谷ユニキューブ、KASUGAエコパティオ、ユニキューブ浦上、シティハイツみどり、テラストリア"}, {"name": "合同会社サンエボ", "email": "", "atena": "合同会社サンエボ 御中", "properties": ["スパーブコート"], "property": "スパーブコート"}, {"name": "羽原 淳介", "email": "", "atena": "羽原 淳介 様", "properties": ["フローレンス南蔵王"], "property": "フローレンス南蔵王"}, {"name": "メンソーラ株式会社", "email": "", "atena": "メンソーラ株式会社 尾前 伸幸 様", "properties": ["セラータ"], "property": "セラータ"}, {"name": "森本将行", "email": "", "atena": "森本将行 様", "properties": ["ソフィア"], "property": "ソフィア"}, {"name": "田中 太郎", "email": "", "atena": "", "properties": [], "property": ""}, {"name": "山河満男", "email": "", "atena": "山河満男 様", "properties": ["グランエール"], "property": "グランエール"}];
 
const FROM_GMAIL = "infoirelife@gmail.com";
const LS_OWNERS = (typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + "rent_owner_send_owners_v1";
const LS_TMPL   = (typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + "rent_owner_send_tmpl_v1";
const TMPL_VER = 3;
const DEFAULT_SUBJECT = "【{{対象月}}分】収支報告書のご送付（{{オーナー名}}様）";
const DEFAULT_BODY = `{{宛名}}
 
いつも大変お世話になっております。
IREライフ株式会社でございます。
 
{{対象月}}分の収支報告書（家賃明細）を添付にてお送りいたします。
お振込みにつきましても、明細記載のとおり手続きを進めております。
ご査収のほど、よろしくお願い申し上げます。
{{空き予定}}
ご不明な点やお気づきの点がございましたら、お気軽に当社担当までお問い合わせくださいませ。
 
今後ともどうぞよろしくお願い申し上げます。
 
─────────────────
IREライフ株式会社
infoirelife@gmail.com
─────────────────`;
let owners = loadOwners();
let tmpl = loadTmpl();
let detail = [];      // オーナー別にまとめた明細(取込結果)
let pdfDoc = null;    // pdf-lib document(分割用)
let yearPdfDoc = null;   // 年間収支表の pdf-lib document
let yearMap = {};        // オーナー名(norm) -> { pages:[ページ番号配列] }  年間収支表の仕分け結果
let sentSet = new Set();   // 送信済みオーナーのindex(帯を青く表示)
 
function loadOwners(){
  try{ const s=JSON.parse(localStorage.getItem(LS_OWNERS)); if(Array.isArray(s)&&s.length) return s; }catch(e){}
  return JSON.parse(JSON.stringify(OWNER_SEED));
}
function saveOwners(){ localStorage.setItem(LS_OWNERS, JSON.stringify(owners)); if(typeof scheduleAutoPush==='function'){ try{ scheduleAutoPush(); }catch(e){} } try{ if(typeof window.pushFeatureToCloud==='function'){ window.pushFeatureToCloud('owners'); } }catch(e){} }
/* クラウドから取得した owners をローカルへ反映し、画面を更新する */
window.applyCloudOwners = function(cloudOwners){
  if(!Array.isArray(cloudOwners)) return;        // キー無し → 触らない(既存を守る)
  if(cloudOwners.length === 0) return;            // 空配列 → 触らない(誤消し防止)
  try{
    localStorage.setItem(LS_OWNERS, JSON.stringify(cloudOwners));
    owners = cloudOwners;
    if(typeof renderOwners === 'function') renderOwners();
  }catch(e){}
};
function resetOwners(){ if(!confirm("オーナー一覧を初期データに戻します。手入力の変更は失われます。よろしいですか?"))return;
  owners=JSON.parse(JSON.stringify(OWNER_SEED)); saveOwners(); renderOwners(); toast("初期データに戻しました"); }
function loadTmpl(){
  try{
    const s=JSON.parse(localStorage.getItem(LS_TMPL));
    if(s && s.body && s.ver===TMPL_VER && /\{\{/.test(s.subject||"")) return s;
  }catch(e){}
  const t={subject:DEFAULT_SUBJECT, body:DEFAULT_BODY, ver:TMPL_VER};
  try{ localStorage.setItem(LS_TMPL, JSON.stringify(t)); }catch(e){}
  return t;
}
function resetTmpl(){
  if(!confirm("件名・本文を初期テンプレートに戻します。よろしいですか?"))return;
  tmpl={subject:DEFAULT_SUBJECT, body:DEFAULT_BODY};
  localStorage.setItem(LS_TMPL, JSON.stringify(tmpl));
  document.getElementById("tmplSubject").value=tmpl.subject;
  document.getElementById("tmplBody").value=tmpl.body;
  renderPreview();
  toast("定型文を初期に戻しました");
}
function saveTmpl(){ tmpl={subject:document.getElementById("tmplSubject").value, body:document.getElementById("tmplBody").value, ver:TMPL_VER};
  localStorage.setItem(LS_TMPL, JSON.stringify(tmpl)); }
 
function showView(v){
  document.querySelectorAll("#rent-view .tab").forEach(t=>t.classList.toggle("active", t.dataset.v===v));
  document.querySelectorAll("#rent-view .view").forEach(x=>x.classList.remove("active"));
  const el=document.getElementById("view-"+v); if(el) el.classList.add("active");
  if(v==="send" && detail && detail.length) renderPreview();   // 最新メールを反映
  if(v==="history") renderHistory();
}
function toast(m){ const t=document.getElementById("toast"); t.textContent=m; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),1800); }
function esc(s){ return (s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function norm(s){ return (s||"").replace(/[\s\u3000]/g,"").replace(/御中|様/g,""); }

// ===== 住所でも検索できるようにする =====
// 物件画面に登録された住所を「物件名 → 住所」の表にして持っておく。
// 3秒だけ使い回すので、続けて文字を打っても重くならず、
// 物件を足したあともすぐ新しい住所を拾います。
let _bldAddrMap = null, _bldAddrAt = 0;
function bldAddrMap(){
  if(_bldAddrMap && (Date.now() - _bldAddrAt) < 3000) return _bldAddrMap;
  const m = {};
  try{
    const all = JSON.parse(localStorage.getItem((typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + "blds") || "{}");
    Object.keys(all).forEach(k=>{
      const b = all[k] || {};
      const nm = norm(b.name || k);
      if(nm) m[nm] = (b.addr||"") + " " + (b.zip||"");
    });
  }catch(e){}
  _bldAddrMap = m; _bldAddrAt = Date.now();
  return m;
}
// 1オーナー分の「住所として検索に引っかけたい文字」を集める
//   ・オーナー自身の住所（オーナー一覧の住所・郵便番号）
//   ・そのオーナーが持つ物件の住所（物件画面の住所・郵便番号）
function addrHay(d){
  let s = "";
  try{
    const o = owners.find(o => norm(o.name) === norm(d.owner));
    if(o) s += " " + (o.addr||"") + " " + (o.zip||"");
  }catch(e){}
  try{
    const m = bldAddrMap();
    (d.props||[]).forEach(p=>{
      const k = norm(p.property || p.bldNo || "");
      if(k && m[k]) s += " " + m[k];
    });
  }catch(e){}
  return s;
}
 
/* ===== オーナー一覧表 ===== */
let _ownerQ = "";
function filterOwners(v){ _ownerQ = String(v||"").trim(); renderOwners(); }
function _ownerHit(o){
  if(!_ownerQ) return true;
  const q = _ownerQ.normalize("NFKC").toLowerCase();
  const hay = [o.name, o.atena, o.email, o.property, o.addr, o.tel, o.memo,
               (o.properties||[]).join(" ")].join(" ").normalize("NFKC").toLowerCase();
  return q.split(/[\s\u3000]+/).filter(Boolean).every(w => hay.indexOf(w) >= 0);
}
/* ===== 棟数の数え方 =====
   「タリスヴィータ A棟」「タリスヴィータ B棟」は 1棟 として数えます。
   物件名の末尾の「A棟／B棟／第2棟／A館」などを落とし、
   残った基準名の種類を数えます。 */
function _bldBase(name){
  var s = String(name||'').trim();
  try{ s = s.normalize('NFKC'); }catch(e){}   // Ａ棟 → A棟 に統一
  s = s.replace(/[\s　]+/g, '');              // 空白を詰める
  // ①「A棟」「B館」「第2棟」などを落とす
  s = s.replace(/(第?[0-9A-Za-z一二三四五六七八九十]{1,3})?[棟館]$/, '');
  // ②「棟」の字がない「ハイサニーA」「ピラ芳翠B」も落とす。
  //    末尾が大文字1字で、その手前が英字でないときだけ。
  //    （"KUSADO HOUSE" の E や "seto house East" は残ります）
  if(/[A-Z]$/.test(s) && !/[A-Za-z][A-Z]$/.test(s)) s = s.slice(0, -1);
  return s.toLowerCase();
}
function _ownerProps(o){
  if(o.properties && o.properties.length) return o.properties.filter(Boolean);
  return o.property ? [o.property] : [];
}
function _touCount(o){
  var set = {};
  _ownerProps(o).forEach(function(p){ var b = _bldBase(p); if(b) set[b] = 1; });
  return Object.keys(set).length;
}
/* ランクは2段階だけ。0=白（黒文字） / 1=黒（白文字・VIP）※10棟以上 */
function _ownerRank(n){ return n >= 10 ? 1 : 0; }

/* ===== 左スワイプでゴミ箱を出す =====
   カードを指で左へ動かすと、うしろに敷いてあるゴミ箱が出ます。
   ・横に動かしたときだけ反応します（縦スクロールの邪魔をしない）
   ・半分より左まで動かせば開いたままになり、戻せば閉じます
   ・開いているカードを押すと、削除ではなく「閉じる」だけです
   ・パソコンでは指で触れないので、これまでどおりカードを開いて
     いちばん下の「このオーナーを削除する」から消せます。
   ============================================================ */
var OW_TRASH_W = 88;              // ゴミ箱の幅(px)。CSS の .ow-trash と合わせています
var _swEl = null;                 // いま触っているカード
var _swX = 0, _swY = 0;           // 指を置いた位置
var _swDir = 0;                   // 0=まだ不明 / 1=横に動いている / 2=縦
var _swBase = 0;                  // 触り始めた時点のずれ
var _swMoved = false;             // 動かしたか(押しただけかの判定に使う)

function _swClose(el){ if(el){ el.classList.remove("ow-open"); el.style.transform = ""; } }

function _swCloseAll(except){
  var l = document.querySelectorAll("#ownerCards .ow-card.ow-open");
  for(var k = 0; k < l.length; k++){ if(l[k] !== except) _swClose(l[k]); }
}

function _swCard(e){
  var t = e.target;
  return (t && t.closest) ? t.closest("#ownerCards .ow-card") : null;
}

function _bindSwipe(){
  var host = document.getElementById("ownerCards");
  if(!host || host._swBound) return;   // 付けるのは一度だけ
  host._swBound = 1;

  host.addEventListener("touchstart", function(e){
    var c = _swCard(e);
    _swEl = c; _swDir = 0; _swMoved = false;
    if(!c) return;
    _swCloseAll(c);                    // ほかに開いているカードは閉じる
    _swX = e.touches[0].clientX;
    _swY = e.touches[0].clientY;
    _swBase = c.classList.contains("ow-open") ? -OW_TRASH_W : 0;
    c.style.transition = "none";       // 指に張り付かせる
  }, {passive:true});

  host.addEventListener("touchmove", function(e){
    if(!_swEl) return;
    var dx = e.touches[0].clientX - _swX;
    var dy = e.touches[0].clientY - _swY;
    if(!_swDir){
      if(Math.abs(dx) < 8 && Math.abs(dy) < 8) return;   // まだ判断しない
      _swDir = (Math.abs(dx) > Math.abs(dy)) ? 1 : 2;
    }
    if(_swDir !== 1) return;           // 縦なら普通のスクロールに任せる
    e.preventDefault();
    _swMoved = true;
    var x = _swBase + dx;
    if(x > 0) x = 0;                                   // 右へは出さない
    if(x < -OW_TRASH_W - 40) x = -OW_TRASH_W - 40;     // 行きすぎも止める
    _swEl.style.transform = "translateX(" + x + "px)";
  }, {passive:false});

  host.addEventListener("touchend", function(){
    if(!_swEl) return;
    var c = _swEl; _swEl = null;
    c.style.transition = "";           // ここから先はCSSの動きに戻す
    if(_swDir !== 1) return;
    var m = /translateX\((-?[0-9.]+)px\)/.exec(c.style.transform || "");
    var x = m ? parseFloat(m[1]) : 0;
    if(x < -OW_TRASH_W / 2){           // 半分より左 → 開いたままにする
      c.classList.add("ow-open");
      c.style.transform = "translateX(-" + OW_TRASH_W + "px)";
    }else{
      _swClose(c);
    }
  });

  // 動かした直後の「押した」は、シートを開かずに握りつぶします
  host.addEventListener("click", function(e){
    var c = _swCard(e);
    if(!c) return;
    var open = c.classList.contains("ow-open");
    if(_swMoved || open){
      e.preventDefault(); e.stopPropagation();
      _swMoved = false;
      if(open) _swClose(c);            // 開いているときは閉じるだけ
    }
  }, true);
}

function renderOwners(){
  const t = document.getElementById("ownerTable");
  if(!t) return;
  t.style.display = "none";              // 表は残したまま隠します
  let host = document.getElementById("ownerCards");
  if(!host){
    host = document.createElement("div");
    host.id = "ownerCards";
    t.parentNode.insertBefore(host, t);
  }
  const hits = owners.map((o,i)=>({o,i})).filter(x=>_ownerHit(x.o));
  const cnt = document.getElementById("ownerCount");
  if(cnt) cnt.textContent = _ownerQ ? (hits.length + " / " + owners.length + " 件") : (owners.length + " 件");

  if(!hits.length){
    host.innerHTML = '<div class="ow-empty">「' + esc(_ownerQ) + '」に一致するオーナーはありません</div>';
    return;
  }
  host.innerHTML = hits.map(function(x){
    const o = x.o, i = x.i;
    const tou = _touCount(o);
    const rank = _ownerRank(tou);
    // カードに出すのは「会社名」と「棟数」だけ。
    // 物件名・メール・住所などは、押して開くシートで見ます。
    const nm = esc(o.name) || esc(o.atena) || '<span class="ow-none">名称なし</span>';
    return '<div class="ow-row">' +
      // カードの下に敷いておくゴミ箱。左スワイプで顔を出します。
      '<button type="button" class="ow-trash" onclick="RENT.delOwner(' + i + ')" aria-label="削除">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg>' +
      '</button>' +
      '<button type="button" class="ow-card ow-r' + rank + (o.exclude ? ' ow-ex' : '') + '"' +
      ' onclick="RENT.openOwnerSheet(' + i + ')">' +
      '<div class="ow-head">' + (rank ? '<span class="ow-vip">VIP</span>' : '') + '</div>' +
      '<div class="ow-mid"><div class="ow-atena">' + nm + '</div></div>' +
      '<div class="ow-foot">' +
        '<span class="ow-tou">' +
          '<span class="num">' + tou + '</span>' +
          '<span class="unit">棟</span>' +
        '</span>' +
      '</div>' +
    '</button>' +
    '</div>';
  }).join("");
  _bindSwipe();
}

/* ===== カードを押して開く記入シート（ここで全項目を編集します） ===== */
function openOwnerSheet(i){
  const o = owners[i];
  if(!o) return;
  closeOwnerSheet();
  const tou = _touCount(o);
  const rank = _ownerRank(tou);
  const props = _ownerProps(o);
  const sh = document.createElement("div");
  sh.className = "ow-sheet";
  sh.id = "ow-sheet";
  sh.innerHTML =
    '<div class="ow-sheet-head">' +
      '<button type="button" class="ow-sheet-close" onclick="RENT.closeOwnerSheet()" title="閉じる">×</button>' +
    '</div>' +
    '<div class="ow-sheet-body"><div class="ow-sheet-inner">' +

      /* ---- 左：このオーナーの要約 ---- */
      '<aside class="ow-aside">' +
        '<h2 class="ow-h2">オーナー情報</h2>' +
        '<div class="ow-aside-nm">' + (esc(o.name) || esc(o.atena) || '名称なし') + '</div>' +
        '<div class="ow-aside-tou"><span class="n">' + tou + '</span><span class="u">棟</span>' +
          (rank ? '<span class="ow-vip">VIP</span>' : '') + '</div>' +
        '<p class="ow-aside-p">右の項目を直すと、その場で保存されます。<br>' +
          '「タリスヴィータ A棟」「B棟」のような同じ建物は 1棟 として数えます。</p>' +
        (props.length ? '<p class="ow-aside-p ow-aside-props">登録物件 ' + props.length + '件<br>' +
          props.slice(0,6).map(function(p){ return esc(p); }).join('<br>') +
          (props.length>6 ? '<br>ほか' + (props.length-6) + '件' : '') + '</p>' : '') +
      '</aside>' +

      /* ---- 右：記入欄 ---- */
      '<div class="ow-form">' +

        '<label class="ow-f"><span class="ow-lb">オーナー名<i class="ow-req">必須</i></span>' +
          '<input value="' + esc(o.name) + '" oninput="RENT.editOwner(' + i + ',\'name\',this.value)" placeholder="株式会社〇〇"></label>' +

        '<label class="ow-f"><span class="ow-lb">宛名<i class="ow-req">必須</i></span>' +
          '<input value="' + esc(o.atena) + '" oninput="RENT.editOwner(' + i + ',\'atena\',this.value)" placeholder="株式会社〇〇 御中"></label>' +

        '<label class="ow-f"><span class="ow-lb">メールアドレス<i class="ow-req">必須</i></span>' +
          '<input value="' + esc(o.email) + '" oninput="RENT.editOwner(' + i + ',\'email\',this.value)" placeholder="owner@example.com"' +
          (String(o.email||'').trim() ? '' : ' class="ow-warn"') + '></label>' +

        '<label class="ow-f"><span class="ow-lb">物件名<i class="ow-any">複数は改行で</i></span>' +
          '<textarea rows="' + Math.min(14, Math.max(4, props.length || 4)) + '"' +
          ' oninput="RENT.editProps(' + i + ',this.value)" placeholder="グロリオサ">' +
          esc(props.join('\n')) + '</textarea></label>' +

        '<label class="ow-f"><span class="ow-lb">郵便番号</span>' +
          '<input value="' + esc(o.zip) + '" oninput="RENT.editOwner(' + i + ',\'zip\',this.value)" placeholder="721-0963"></label>' +

        '<label class="ow-f"><span class="ow-lb">住所</span>' +
          '<input value="' + esc(o.addr) + '" oninput="RENT.editOwner(' + i + ',\'addr\',this.value)" placeholder="広島県福山市…"></label>' +

        '<label class="ow-f"><span class="ow-lb">電話番号</span>' +
          '<input value="' + esc(o.tel) + '" oninput="RENT.editOwner(' + i + ',\'tel\',this.value)" placeholder="084-000-0000"></label>' +

        '<label class="ow-f"><span class="ow-lb">FAX</span>' +
          '<input value="' + esc(o.fax) + '" oninput="RENT.editOwner(' + i + ',\'fax\',this.value)" placeholder="084-000-0000"></label>' +

        '<label class="ow-f"><span class="ow-lb">課税区分</span>' +
          '<select onchange="RENT.editOwner(' + i + ',\'taxKbn\',this.value)">' +
            '<option value=""' + (!o.taxKbn ? ' selected' : '') + '>選択してください</option>' +
            '<option value="課税事業者"' + (o.taxKbn === '課税事業者' ? ' selected' : '') + '>課税事業者</option>' +
            '<option value="免税事業者"' + (o.taxKbn === '免税事業者' ? ' selected' : '') + '>免税事業者</option>' +
            '<option value="未確認"' + (o.taxKbn === '未確認' ? ' selected' : '') + '>未確認</option>' +
          '</select></label>' +

        '<label class="ow-f"><span class="ow-lb">インボイス登録番号</span>' +
          '<input value="' + esc(o.invoiceNo) + '" oninput="RENT.editOwner(' + i + ',\'invoiceNo\',this.value)" placeholder="T1234567890123"' +
          ((o.taxKbn === '課税事業者' && !String(o.invoiceNo||'').trim()) ? ' class="ow-warn"' : '') + '></label>' +

        '<label class="ow-f"><span class="ow-lb">備考<i class="ow-any">任意</i></span>' +
          '<textarea rows="4" oninput="RENT.editOwner(' + i + ',\'memo\',this.value)" placeholder="例）固定電話への連絡は不可。メールは奥様もCC希望。">' + esc(o.memo) + '</textarea></label>' +

        '<div class="ow-f ow-f-check"><label class="ow-check"><input type="checkbox"' + (o.exclude ? ' checked' : '') +
          ' onclick="RENT.editOwner(' + i + ',\'exclude\',this.checked)">' +
          '<span>このオーナーを一斉送信の対象から外す</span></label></div>' +

        '<div class="ow-del"><button type="button" onclick="RENT.delOwner(' + i + ');RENT.closeOwnerSheet()">このオーナーを削除する</button></div>' +
      '</div>' +
    '</div></div>';
  document.body.appendChild(sh);
  document.body.style.overflow = "hidden";
}
function closeOwnerSheet(){
  const m = document.getElementById("ow-sheet");
  if(m) m.remove();
  document.body.style.overflow = "";
  renderOwners();
}

let _saveTimer=null;
function flashSaved(){ const el=document.getElementById("ownerSaveStat"); if(!el)return; el.textContent="✅ 自動保存しました"; el.style.opacity="1"; clearTimeout(_saveTimer); _saveTimer=setTimeout(()=>{el.style.opacity="0";},1500); }
function editOwner(i,f,v){ owners[i][f]=v; saveOwners(); flashSaved(); if(f==="exclude"){ renderOwners(); renderPreview(); return; } if(detail && detail.length){ const o=owners[i]; detail.forEach(d=>{ if(d.owner===o.name && f==="email") d.email=v; }); if(f==="email") renderPreview(); } }
function editProps(i,v){ const arr=v.split("\n").map(s=>s.trim()).filter(Boolean); owners[i].properties=arr; owners[i].property=arr.join("、"); saveOwners(); flashSaved(); }
function addOwnerRow(){ owners.unshift({name:"",properties:[],property:"",atena:"",email:""}); saveOwners(); renderOwners(); flashSaved(); toast("新規オーナーを追加しました（自動保存）"); }
function delOwner(i){ if(!confirm("この行を削除しますか?"))return; const removed=owners[i]&&owners[i].name; owners.splice(i,1); saveOwners(); renderOwners();
  // 送信一覧(取込結果)からも同名オーナーのカードを外す
  if(removed && detail && detail.length){
    const before=detail.length;
    detail=detail.filter(d=>norm(d.owner)!==norm(removed));
    if(detail.length!==before){ sentSet=new Set(); saveDetailState(); renderPreview(); }
  }
}
 
/* ===== PDF取込 ===== */
const drop=document.getElementById("drop"), pdfInput=document.getElementById("pdfInput");
["dragover","dragenter"].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add("over");}));
["dragleave","drop"].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove("over");}));
drop.addEventListener("drop",ev=>{ const f=ev.dataTransfer.files[0]; if(f) handlePdf(f); });
pdfInput.addEventListener("change",ev=>{ const f=ev.target.files[0]; if(f) handlePdf(f); });
 
// 年間収支表のドロップ処理
const dropYear=document.getElementById("dropYear"), pdfInputYear=document.getElementById("pdfInputYear");
if(dropYear){
  ["dragover","dragenter"].forEach(e=>dropYear.addEventListener(e,ev=>{ev.preventDefault();dropYear.classList.add("over");}));
  ["dragleave","drop"].forEach(e=>dropYear.addEventListener(e,ev=>{ev.preventDefault();dropYear.classList.remove("over");}));
  dropYear.addEventListener("drop",ev=>{ const f=ev.dataTransfer.files[0]; if(f) handleYearPdf(f); });
  pdfInputYear.addEventListener("change",ev=>{ const f=ev.target.files[0]; if(f) handleYearPdf(f); });
}
 
// 振込明細のドロップ処理(IRE宛のみ添付。仕分け不要=PDF全体をそのまま保持)
let payPdfBase64 = null;
let payPdfName = "";
const dropPay=document.getElementById("dropPay"), pdfInputPay=document.getElementById("pdfInputPay");
if(dropPay){
  ["dragover","dragenter"].forEach(e=>dropPay.addEventListener(e,ev=>{ev.preventDefault();dropPay.classList.add("over");}));
  ["dragleave","drop"].forEach(e=>dropPay.addEventListener(e,ev=>{ev.preventDefault();dropPay.classList.remove("over");}));
  dropPay.addEventListener("drop",ev=>{ const f=ev.dataTransfer.files[0]; if(f) handlePayPdf(f); });
  pdfInputPay.addEventListener("change",ev=>{ const f=ev.target.files[0]; if(f) handlePayPdf(f); });
}
async function handlePayPdf(file){
  if(file.type!=="application/pdf"){ toast("PDFファイルを選んでください"); return; }
  const stat=document.getElementById("pdfStatPay");
  if(stat) stat.textContent="振込明細 読み込み中…";
  try{
    const dataUrl = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
    payPdfBase64 = (dataUrl.indexOf(",")>=0) ? dataUrl.split(",")[1] : dataUrl;
    payPdfName = file.name || "振込明細.pdf";
    if(stat) stat.textContent="振込明細を取り込みました（IRE宛 asano@i-r-e.jp にのみ添付されます）";
    if(typeof RENT!=="undefined" && RENT.renderPreview) { try{ RENT.renderPreview(); }catch(e){} }
  }catch(e){ if(stat) stat.textContent="⚠ 振込明細の読み込みに失敗しました: "+e.message; }
}
 
// 年間収支表PDFを取り込み、「オーナー名 ： ◯◯」で各オーナーに仕分け
async function handleYearPdf(file){
  if(file.type!=="application/pdf"){ toast("PDFファイルを選んでください"); return; }
  const stat=document.getElementById("pdfStatYear");
  stat.textContent="年間収支表 読み込み中…";
  const buf=await file.arrayBuffer();
  try{
    yearPdfDoc = await PDFLib.PDFDocument.load(buf);
    pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const doc=await pdfjsLib.getDocument({
      data:buf.slice(0),
      cMapUrl:"https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
      cMapPacked:true,
      useSystemFonts:true
    }).promise;
    yearMap={};
    let matched=0;
    for(let i=1;i<=doc.numPages;i++){
      const pg=await doc.getPage(i);
      const tc=await pg.getTextContent();
      const text=itemsToText(tc.items);
      // 「オーナー名 ： ◯◯　御中」を優先、なければ通常の宛名抽出
      let owner="";
      let m=text.match(/オーナー名[\s\u3000]*[：:][\s\u3000]*(.+?)[\s\u3000]*(?:御中|様)/);
      if(m){ owner=m[1].trim(); }
      else { owner=(atenaOf(text)||"").replace(/[\s\u3000]*(御中|様)$/,"").trim(); }
      if(owner){
        const key=norm(owner);
        if(!yearMap[key]) yearMap[key]={ owner:owner, pages:[] };
        yearMap[key].pages.push(i);   // pdf-libは0始まりなので後で-1する
        matched++;
      }
      stat.textContent=`年間収支表 解析中… ${i}/${doc.numPages}ページ`;
    }
    const ownerCount=Object.keys(yearMap).length;
    stat.textContent=`年間収支表 ${doc.numPages}ページ取込・${ownerCount}オーナーに仕分け（マッチ${matched}件）`;
    mergeYearIntoDetail();   // 年間だけのオーナーもカードとして追加(月額がなくても成立)
    renderPreview();
    showView("send");
  }catch(e){ console.error(e); stat.textContent="⚠ 年間収支表の読み込みに失敗しました: "+e.message; }
}
 
// あるオーナーに対応する年間収支表PDFを切り出して Base64 で返す(なければ null)
async function makeYearPdfBase64(ownerName){
  if(!yearPdfDoc) return null;
  const key=norm(ownerName);
  const ent=yearMap[key];
  if(!ent || !ent.pages.length) return null;
  try{
    const out=await PDFLib.PDFDocument.create();
    const idxs=ent.pages.map(p=>p-1);   // 0始まりに変換
    const copied=await out.copyPages(yearPdfDoc, idxs);
    copied.forEach(p=>out.addPage(p));
    const bytes=await out.save();
    let bin=""; const arr=new Uint8Array(bytes);
    for(let i=0;i<arr.length;i++) bin+=String.fromCharCode(arr[i]);
    return btoa(bin);
  }catch(e){ console.error("年間PDF切出し失敗:",e); return null; }
}
 
async function handlePdf(file){
  if(file.type!=="application/pdf"){ toast("PDFファイルを選んでください"); return; }
  const stat=document.getElementById("pdfStat");
  stat.textContent="読み込み中…";
  const buf=await file.arrayBuffer();
  try{
    pdfDoc = await PDFLib.PDFDocument.load(buf);
    pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const doc=await pdfjsLib.getDocument({
      data:buf.slice(0),
      cMapUrl:"https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
      cMapPacked:true,
      useSystemFonts:true
    }).promise;
    const pages=[];
    for(let i=1;i<=doc.numPages;i++){
      const pg=await doc.getPage(i);
      const tc=await pg.getTextContent();
      const text=itemsToText(tc.items);
      pages.push(parsePage(text,i));
      stat.textContent=`解析中… ${i}/${doc.numPages}ページ`;
    }
    buildDetail(pages);
    stat.textContent=`✅ ${doc.numPages}ページを取込・${detail.length}オーナーに仕分けしました`;
    renderPreview();
    showView("send");
  }catch(e){ console.error(e); stat.textContent="⚠ 読み込みに失敗しました: "+e.message; }
}
 
// pdf.jsのテキスト片を、Y座標(行)→X座標(左から)の順に並べ直して紙面通りの文字列にする
function itemsToText(items){
  const rows=[];
  items.forEach(it=>{
    if(!it.str) return;
    const y=it.transform?it.transform[5]:0;
    const x=it.transform?it.transform[4]:0;
    let row=rows.find(r=>Math.abs(r.y-y)<3);
    if(!row){ row={y,parts:[]}; rows.push(row); }
    row.parts.push({x,s:it.str});
  });
  rows.sort((a,b)=>b.y-a.y); // 上から下
  return rows.map(r=>{ r.parts.sort((a,b)=>a.x-b.x); return r.parts.map(p=>p.s).join(""); }).join("\n");
}
function atenaOf(t){
  for(const ln of t.split("\n")){
    if(!/(御中|様)/.test(ln)) continue;
    let m=ln.match(/((?:株式会社|合同会社|有限会社|合資会社)[^\s\u3000]{1,20})[\s\u3000]*(御中|様)/);
    if(m) return m[1]+" "+m[2];
    m=ln.match(/([^\s\u3000]{1,20}?(?:株式会社|合同会社|有限会社|合資会社))[\s\u3000]*(御中|様)/);
    if(m) return m[1]+" "+m[2];
    m=ln.match(/([\u4E00-\u9FFF\u3040-\u30FF]{2,8})[\s\u3000]*(御中|様)/);
    if(m) return m[1]+" "+m[2];
  }
  return "";
}
const PREFS="北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県";
function parsePage(t,page){
  const d={page};
  let m=t.match(/(?:^|\n)\s*(\d+)\s*\/\s*(\d+)\s*(?:\n|$)/); d.pidx=m?+m[1]:1; d.ptotal=m?+m[2]:1;
  m=t.match(/建物管理番号：\s*(\d+)/); d.bldNo=m?m[1]:"";
  m=t.match(/物件名[\s\u3000]*([^\n]+?)[\s\u3000]+[〒\u4E00-\u9FFF]*?(?:北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/); d.property=m?m[1].trim():"";
  d.atena=atenaOf(t);
  m=t.match(/¥([\d,]+)-/); d.amount=m?m[1]:"";
  m=t.match(/送金日：(\d{4}年\d{2}月\d{2}日)/); d.sokin=m?m[1]:"";
  m=t.match(/【\s*(\d{4}年\d{2}月)\s*】/); d.month=m?m[1]:"";
  const idx=t.indexOf("収入明細"); const body=(idx>=0?t.slice(idx):t).replace(/\n/g,"");
  const bodyLines=(idx>=0?t.slice(idx):t);
  d.vac=extractVac(body);
  d.newc=extractNew(bodyLines);
  return d;
}
function extractVac(body){
  const vac=[], seen=new Set();
  let m, re1=/(\d{3})\s*26\/\d{2}[\s\d,]*?募集中/g;
  while((m=re1.exec(body))){ const k="募:"+m[1]; if(!seen.has(k)){seen.add(k);vac.push({room:m[1],type:"募集中",date:""});} }
  function roomBefore(pre){ const ms=[...pre.matchAll(/(\d{3})\s*[^\d\n][^0-9\n]*?\s*26\/\d{2}/g)]; return ms.length?ms[ms.length-1][1]:""; }
  let re2=/解約予定[\s\u3000]*解約日[：:]\s*(\d{4}年\d{2}月\d{2}日)/g;
  while((m=re2.exec(body))){ const room=roomBefore(body.slice(0,m.index)); const k="解:"+room+m[1]; if(!seen.has(k)){seen.add(k);vac.push({room,type:"解約予定",date:m[1]});} }
  let re3=/退去予定[\s\u3000]*退去日[：:]\s*(\d{4}年\d{2}月\d{2}日)/g;
  while((m=re3.exec(body))){ const room=roomBefore(body.slice(0,m.index)); const k="退:"+room+m[1]; if(!seen.has(k)){seen.add(k);vac.push({room,type:"解約予定",date:m[1]});} }
  return vac;
}
 
/* 新規契約を抽出: 備考欄「新規契約 契約開始日:YYYY年MM月DD日」+ その前の部屋番号 */
function extractNew(body){
  const out=[], seen=new Set();
  const lines=body.split("\n");
  for(let i=0;i<lines.length;i++){
    const ln=lines[i];
    if(ln.indexOf("新規契約")<0) continue;
    // 行頭付近の部屋番号(3桁)を取る
    let room="";
    let rm=ln.match(/^\s*(\d{2,4})\s/);            // 行の先頭が部屋番号
    if(rm) room=rm[1];
    if(!room){ const all=[...ln.matchAll(/(\d{2,4})/g)]; if(all.length) room=all[0][1]; }
    // 日付(全角:／半角:両対応)。同じ行になければ次の行も見る
    let date="";
    let dm=ln.match(/契約開始日[：:]?\s*(\d{4}年\d{1,2}月\d{1,2}日)/);
    if(!dm && i+1<lines.length){ dm=(ln+lines[i+1]).match(/契約開始日[：:]?\s*(\d{4}年\d{1,2}月\d{1,2}日)/); }
    if(dm) date=dm[1];
    const k=room+"|"+date;
    if(!seen.has(k)){ seen.add(k); out.push({room,date}); }
  }
  return out;
}
 
function buildDetail(pages){
  // 物件単位(継続ページをまとめる)
  const groups=[]; let cur=null;
  for(const d of pages){
    if(d.pidx===1 || !cur){
      cur={bldNo:d.bldNo,property:d.property,atena:d.atena,amount:d.amount,sokin:d.sokin,month:d.month,pages:[d.page],vac:[...d.vac],newc:[...(d.newc||[])]};
      groups.push(cur);
    }else{
      cur.pages.push(d.page); cur.vac.push(...d.vac); cur.newc.push(...(d.newc||[])); if(!cur.property&&d.property)cur.property=d.property;
    }
  }
  // オーナーへ紐付け(宛名 or 物件名)
  const byName={}, byProp={};
  owners.forEach(o=>{ if(norm(o.atena))byName[norm(o.atena)]=o; if(norm(o.name)&&!byName[norm(o.name)])byName[norm(o.name)]=o;
    const plist=(o.properties&&o.properties.length)?o.properties:[o.property];
    plist.forEach(pn=>{ if(norm(pn))byProp[norm(pn)]=o; }); });
  const map=new Map();
  let unmatched=[];
  for(const g of groups){
    let o=byName[norm(g.atena)];
    if(!o){ const k=norm(g.atena); for(const kk in byName){ if(kk&&(kk.includes(k)||k.includes(kk))){o=byName[kk];break;} } }
    if(!o){ o=byProp[norm(g.property)]; }   // 宛名で見つからなければ物件名で照合
    const key=o?o.name:("（未登録）"+g.atena);
    if(!map.has(key)) map.set(key,{owner:o?o.name:g.atena, atena:(o&&o.atena)?o.atena:g.atena, email:o?o.email:"", props:[]});
    map.get(key).props.push(g);
    if(!o) unmatched.push(g.atena);
  }
  detail=[...map.values()];
  // 取り込んだ月が前回保存分と違うなら、送信済み表示をリセット(別月の引き継ぎ防止)
  try{
    const newMonth=(detail[0]&&detail[0].props[0]&&detail[0].props[0].month)||"";
    const saved=JSON.parse(localStorage.getItem(LS_DETAIL)||"null");
    const savedMonth=saved&&saved.detail&&saved.detail[0]&&saved.detail[0].props&&saved.detail[0].props[0]?saved.detail[0].props[0].month:"";
    if(newMonth && savedMonth && newMonth!==savedMonth){ sentSet=new Set(); }
  }catch(e){}
  saveDetailState();   // 仕分け結果を保存(PDFは含まない・軽量)
  const note=document.getElementById("matchNote");
  const noMail=detail.filter(d=>!d.email).length;
  note.style.display="block";
  // 新規契約の検出状況
  let newcTotal=0; detail.forEach(d=>d.props.forEach(p=>{ newcTotal+=((p.newc||[]).length); }));
  let newcMsg="";
  if(newcTotal>0){ newcMsg=` <span style="color:#2c6e49;font-weight:800;">新規契約 ${newcTotal}件を検出。</span>`; }
  note.innerHTML=`取込 <b>${groups.length}</b> 物件 → <b>${detail.length}</b> オーナーに仕分け。`+
    (noMail?` <span style="color:var(--warn)">メール未登録 ${noMail} 件</span>（オーナー一覧で登録してください）`:` 全オーナーにメール登録あり。`)+newcMsg;
  mergeYearIntoDetail();   // 年間収支表が既に取り込まれていれば、年間だけのオーナーも統合
}
 
/* 年間収支表のオーナーを detail に統合する。
   - detail に既にいるオーナー → そのまま(添付は照合で付く)
   - detail にいないオーナー → 「年間のみ」のカードを追加 */
function mergeYearIntoDetail(){
  if(!yearMap || !Object.keys(yearMap).length) return;
  const have=new Set((detail||[]).map(d=>norm(d.owner)));
  Object.keys(yearMap).forEach(key=>{
    if(have.has(key)) return;   // 月額側に既にいる → 追加不要
    const yo=yearMap[key];
    // オーナー一覧から宛名・メールを補完
    const o=owners.find(ow=>norm(ow.name)===key || norm(ow.atena)===key);
    detail.push({
      owner: o?o.name:yo.owner,
      atena: (o&&o.atena)?o.atena:(yo.owner+" 御中"),
      email: o?o.email:"",
      props: [],          // 月額明細なし
      yearOnly: true       // 年間のみのカード(月額PDFなし)
    });
  });
  saveDetailState();
}
 
/* ===== 仕分け結果の保存・復元(PDF本体は保存しない=軽量) ===== */
const LS_DETAIL  = (typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + "rent_owner_send_detail_v1";
const LS_HISTORY = (typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + "rent_owner_send_history_v1";   // 月をまたいで残す
 
/* 送信/下書きの履歴を1件追記(月をまたいで永続) */
function appendHistory(entries){
  // entries = [{month, owner, to, kind}] kind:'send'|'draft'
  try{
    const log=JSON.parse(localStorage.getItem(LS_HISTORY)||"[]");
    const now=new Date();
    const ts=now.getFullYear()+"/"+String(now.getMonth()+1).padStart(2,"0")+"/"+String(now.getDate()).padStart(2,"0")+" "+String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");
    entries.forEach(e=>{ log.push({ at:ts, month:e.month||"", owner:e.owner||"", to:e.to||"", kind:e.kind||"send" }); });
    localStorage.setItem(LS_HISTORY, JSON.stringify(log));
  }catch(e){}
}
function loadHistory(){
  try{ return JSON.parse(localStorage.getItem(LS_HISTORY)||"[]"); }catch(e){ return []; }
}
 
/* 不達(バウンス)アドレスの保存 */
const LS_BOUNCED = (typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + "rent_owner_send_bounced_v1";
function loadBounced(){
  try{ return new Set(JSON.parse(localStorage.getItem(LS_BOUNCED)||"[]")); }catch(e){ return new Set(); }
}
function saveBounced(set){
  try{ localStorage.setItem(LS_BOUNCED, JSON.stringify([...set])); }catch(e){}
}
 
/* GAS経由: 配信失敗(バウンス)を確認し、不達アドレスを記録 */
async function checkBounces(){
  const url=(typeof window.getCloudUrl==='function')?window.getCloudUrl():'';
  if(!url){ toast("クラウド(GAS)URLが未設定です"); return; }
  const st=document.getElementById("rent-history-status");
  const setS=m=>{ if(st)st.textContent=m; };
  setS("配信失敗を確認中…（受信箱を検索しています）");
  try{
    const r=await window.postToGas(url, { action:'checkBounces', sinceDays:30 }, 120000);
    if(r&&r.ok){
      const bouncedAll=new Set((r.bounced||[]).map(a=>(a||"").toLowerCase()));
      const sentAddrs=[...new Set(loadHistory().filter(e=>e.kind!=='draft'&&e.to).map(e=>e.to.toLowerCase()))];
      const set=new Set(sentAddrs.filter(a=>bouncedAll.has(a)));
      saveBounced(set);
      const newCount=set.size;
      const failSends=loadHistory().filter(e=>e.kind!=='draft'&&set.has((e.to||"").toLowerCase())).length;
      setS(newCount? `⚠ 配信できなかったアドレス ${newCount} 件（送信 ${failSends} 件が不達）。赤色で表示しています` : "✅ 配信失敗は見つかりませんでした");
      renderHistory();
      renderPreview();
    }else{
      setS("⚠ 確認失敗: "+((r&&r.message)||"不明なエラー"));
    }
  }catch(e){ setS("⚠ エラー: "+e.message); }
}
 
/* 送信履歴を月別にまとめて描画 */
function renderHistory(){
  const box=document.getElementById("rent-history-body");
  if(!box) return;
  const log=loadHistory();
  if(!log.length){ box.innerHTML='<div class="empty">まだ送信履歴はありません。</div>'; return; }
  const bounced=loadBounced();
  // 月ごとにグループ化(新しい月が上)
  const byMonth={};
  log.forEach(e=>{ const m=e.month||"(月不明)"; (byMonth[m]=byMonth[m]||[]).push(e); });
  const months=Object.keys(byMonth).sort().reverse();
  box.innerHTML=months.map(m=>{
    const rows=byMonth[m].slice().reverse().map(e=>{
      const isBounced=bounced.has((e.to||"").toLowerCase());
      const rowStyle=isBounced?' style="background:#fdecea;"':'';
      const kindCell=isBounced
        ? '<span style="color:#c0392b;font-weight:800;">⚠ 不達</span>'
        : (e.kind==='draft'?'下書き':'<span style="color:#2c6ea1;font-weight:700;">送信</span>');
      return `<tr${rowStyle}><td style="padding:6px 10px;white-space:nowrap;">${esc(e.at)}</td>`+
      `<td style="padding:6px 10px;font-weight:700;${isBounced?'color:#c0392b;':''}">${esc(e.owner)}</td>`+
      `<td style="padding:6px 10px;color:${isBounced?'#c0392b':'var(--rt-muted)'};">${esc(e.to)}</td>`+
      `<td style="padding:6px 10px;">${kindCell}</td></tr>`;
    }).join("");
    const sendCount=byMonth[m].filter(e=>e.kind!=='draft').length;
    const bouncedCount=byMonth[m].filter(e=>bounced.has((e.to||"").toLowerCase())).length;
    return `<div style="margin-bottom:20px;border:1px solid var(--rt-line);border-radius:10px;overflow:hidden;">`+
      `<div style="background:var(--rt-soft);padding:10px 14px;font-weight:800;color:var(--rt-accent-d);">${esc(m)} 分　<span style="font-weight:600;font-size:.82rem;color:var(--rt-muted);">送信 ${sendCount} 件</span>`+
      (bouncedCount?` <span style="font-weight:700;font-size:.82rem;color:#c0392b;">／ 不達 ${bouncedCount} 件</span>`:"")+`</div>`+
      `<table style="width:100%;border-collapse:collapse;font-size:.84rem;">`+
      `<thead><tr style="border-bottom:1px solid var(--rt-line);font-size:.76rem;color:var(--rt-muted);">`+
      `<th style="padding:6px 10px;text-align:left;">送信日時</th><th style="padding:6px 10px;text-align:left;">オーナー</th><th style="padding:6px 10px;text-align:left;">宛先</th><th style="padding:6px 10px;text-align:left;">種別</th></tr></thead>`+
      `<tbody>${rows}</tbody></table></div>`;
  }).join("");
}
function clearHistory(){
  if(!confirm("送信履歴をすべて消去します。よろしいですか?（送信済みメール自体は消えません）")) return;
  try{ localStorage.removeItem(LS_HISTORY); }catch(e){}
  renderHistory();
  toast("送信履歴を消去しました");
}
 
function saveDetailState(){
  try{
    // PDFは保存しない。文面編集・送信済みも一緒に保存。
    const slim = detail.map((d,i)=>({
      owner:d.owner, atena:d.atena, email:d.email,
      props:d.props.map(p=>({bldNo:p.bldNo,property:p.property,amount:p.amount,sokin:p.sokin,month:p.month,pages:p.pages,vac:p.vac,newc:p.newc})),
      subjEdited:(document.getElementById("subj-"+i)||{}).value,
      bodyEdited:(document.getElementById("body-"+i)||{}).value
    }));
    const data={ detail:slim, sent:[...sentSet], savedAt:Date.now() };
    localStorage.setItem(LS_DETAIL, JSON.stringify(data));
  }catch(e){ /* 容量超過などは無視(保存できなくても動作は継続) */ }
}
function restoreDetailState(){
  try{
    const s=JSON.parse(localStorage.getItem(LS_DETAIL)||"null");
    if(s && Array.isArray(s.detail) && s.detail.length){
      detail=s.detail;
      sentSet=new Set(s.sent||[]);
      return true;
    }
  }catch(e){}
  return false;
}
 
/* ===== 本文生成 ===== */
function buildSubject(d){ return fill(tmpl.subject, d); }
function buildBody(d){ return fill(tmpl.body, d); }
function fill(s,d){
  const months=[...new Set(d.props.map(p=>p.month).filter(Boolean))];
  const sokins=[...new Set(d.props.map(p=>p.sokin).filter(Boolean))];
  const propList=d.props.map(p=>"・"+(p.property||p.bldNo)).join("\n");
  let total=0; d.props.forEach(p=>{ const n=parseInt((p.amount||"").replace(/,/g,""),10); if(!isNaN(n))total+=n; });
  const totalStr="¥"+total.toLocaleString();
  // 入居状況(募集中・解約予定)
  let boshu=[], yotei=[];
  d.props.forEach(p=>{ p.vac.forEach(v=>{
    const room=v.room?v.room+"号室":"";
    const pn=p.property||p.bldNo;
    if(v.type==="募集中") boshu.push(`・${pn} ${room}`);
    else yotei.push(`・${pn} ${room}（解約予定　${v.date}）`);
  });});
  let vacBlock="";
  if(boshu.length||yotei.length){
    let lines=["", "なお、下記のお部屋につきまして、現在の入居状況をお知らせいたします。", ""];
    if(boshu.length){ lines.push("【募集中】"); lines.push(...boshu); }
    if(yotei.length){ if(boshu.length)lines.push(""); lines.push("【解約予定】"); lines.push(...yotei); }
    lines.push("");
    lines.push("空室につきましては、早期のご入居者確保に向けて募集に努めてまいります。");
    lines.push("");
    vacBlock=lines.join("\n");
  } else {
    vacBlock="";
  }
  // 新規契約(空き予定の文に続けて自動追記)
  let newcList=[];
  d.props.forEach(p=>{ (p.newc||[]).forEach(n=>{
    const pn=p.property||p.bldNo;
    const room=n.room?n.room+"号室":"お部屋";
    if(n.date){ newcList.push(`${pn} ${room}が${n.date}より新規契約となりました。`); }
    else { newcList.push(`${pn} ${room}が新規契約となりました。`); }
  });});
  if(newcList.length){
    let nb=[];
    if(!vacBlock){ nb.push(""); }
    nb.push("【新規契約】");
    newcList.forEach(x=>nb.push("・"+x));
    nb.push("");
    vacBlock = vacBlock + nb.join("\n");
  }
  // 年間収支表が添付されるオーナーには、その案内を本文に自動追記
  let hasYear = false;
  try{ hasYear = d.yearOnly || (yearMap && yearMap[norm(d.owner)]); }catch(e){}
  if(hasYear){
    vacBlock = vacBlock + "\nなお、本年分の年間収支表もあわせて添付しておりますので、ご確認のほどよろしくお願い申し上げます。\n";
  }
  // 対象月の文言。年間のみ(月額なし=対象月が空)のときは「年間」とし、「【分】」の残骸を防ぐ
  const monthStr = months.join("・");
  let out = s
    .replace(/\{\{宛名\}\}/g, d.atena||d.owner)
    .replace(/\{\{オーナー名\}\}/g, d.owner)
    .replace(/\{\{対象月\}\}/g, monthStr)
    .replace(/\{\{物件一覧\}\}/g, propList)
    .replace(/\{\{送金合計\}\}/g, totalStr)
    .replace(/\{\{送金日\}\}/g, sokins.join("・")||"")
    .replace(/\{\{空き予定\}\}/g, vacBlock);
  // 対象月が空(年間のみ)の場合、「【分】」「分の収支報告書」などの残骸を整形
  if(!monthStr){
    out = out
      .replace(/【\s*分\s*】/g, "【年間】")   // 件名 【分】→【年間】
      .replace(/分の収支報告書/g, "年間の収支報告書")  // 本文 分の収支報告書→年間の収支報告書
      .replace(/^\s*分\s*/gm, "");          // 行頭の余分な「分」
  }
  return out;
}
 
// 明細PDF未取込でも、除外オーナー登録があれば「閲覧専用」カードを表示（スマホ等）
function renderExcludedViewOnly(){
  const exSec=document.getElementById("rent-excluded-section");
  const exBox=document.getElementById("excludedPreview");
  if(!exSec || !exBox) return;
  const exOwners=owners.filter(o=>o.exclude);
  if(!exOwners.length){ exSec.style.display="none"; exBox.innerHTML=""; return; }
  exSec.style.display="block";
  const _gu=document.getElementById('sophiaGasUrl'); if(_gu && !_gu.value){ _gu.value=getSophiaGasUrl(); }
  exBox.innerHTML=exOwners.map((o,k)=>{
    const accumId="exaccumV-"+k;
    return `<div class="pv-item" style="border-left:4px solid #c8a96b;margin-bottom:10px;">
      <div class="pv-head" style="cursor:default;">
        <span class="nm">${esc(o.name)}</span>
        <span class="pill" style="background:#f3ead4;color:#8a6d2f;font-weight:800;">別管理</span>
        <span class="spacer"></span>
        <span class="vac" style="color:#1565c0;">閲覧のみ</span>
        <button onclick="event.stopPropagation();RENT.unexcludeOwner('${esc(o.name).replace(/'/g,"\\'")}')" title="別管理から外して通常の送信一覧に戻す"
          style="flex-shrink:0;margin-left:10px;border:1px solid #d9c9a8;background:#fff;color:#8a6d2f;font-size:.74rem;font-weight:800;padding:5px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;">✕ 別管理から外す</button>
      </div>
      <div class="pv-body open" style="padding:10px 12px;">
        <div style="font-size:.78rem;color:var(--rt-muted);margin-bottom:6px;">明細PDFを取り込んでいないため閲覧専用です。月をタップすると明細が開きます。蓄積するにはPCで明細PDFを取り込んでください。</div>
        <div style="margin-top:4px;font-size:.78rem;font-weight:800;color:#8a6d2f;">共用Driveに蓄積済みの明細（年ごと）</div>
        <div id="${accumId}" style="margin-top:4px;"><div style="font-size:.76rem;color:var(--rt-muted);">読み込み中…</div></div>
      </div>
    </div>`;
  }).join("");
  (async()=>{ for(let k=0;k<exOwners.length;k++){ try{ await renderExAccumInto("exaccumV-"+k, exOwners[k].name); }catch(e){} } })();
}
 
function renderPreview(){
  const box=document.getElementById("preview");
  if(!detail.length){ box.innerHTML='<div class="empty">まず上の「明細PDFをここにドロップ」から収支報告書PDFを取り込んでください。<br>取り込むと、オーナーごとに「宛先・件名・本文（空き予定の一言入り）・添付される明細PDF」がここに一覧表示され、送信前に確認できます。</div>'; renderExcludedViewOnly(); return; }
  // オーナー一覧の最新メールを引き直す(未登録のものだけ補完。手入力済みは尊重)
  detail.forEach(d=>{
    if(!d.email){ const o=owners.find(o=>o.name===d.owner); if(o&&o.email) d.email=o.email; }
  });
  // 復元されたがPDF未取込のときは案内を出す(送信・添付にはPDF再取込が必要)
  const note=document.getElementById("matchNote");
  if(note && !pdfDoc){
    note.style.display="block";
    note.innerHTML='<span style="color:var(--warn);font-weight:800;">前回の仕分け内容を復元しました。</span> 送信・添付するには、上の枠に明細PDFをもう一度ドロップして取り込んでください（文面・送信済みマークはそのまま使えます）。';
  }
  const sb=(document.getElementById("searchBox")||{}).value||"";
  const q=sb.replace(/[\s\u3000]/g,"").toLowerCase();
  // 年間収支表が紐づくオーナー(norm)のセット
  const yearKeys=new Set(Object.keys(yearMap||{}));
  // 「送信しない」に指定されたオーナー名のセット(除外)
  const excludeSet=new Set(owners.filter(o=>o.exclude).map(o=>norm(o.name)));
  let shown=0, excludedCount=0;
  const excludedIdx=[];
  const cards=detail.map((d,i)=>{
    // 除外オーナーは送信欄に出さず、専用区画へ回す
    if(excludeSet.has(norm(d.owner))){ excludedCount++; excludedIdx.push(i); return ""; }
    if(q){
      const hay=(d.owner+" "+d.atena+" "+d.props.map(p=>p.property||p.bldNo).join(" ")+" "+addrHay(d)).replace(/[\s\u3000]/g,"").toLowerCase();
      if(!hay.includes(q)) return "";
    }
    shown++;
    const subj=buildSubject(d), body=buildBody(d);
    const _bounced=loadBounced();
    const _isB=d.email&&_bounced.has((d.email||"").toLowerCase());
    const mailPill=d.email
      ?(_isB?`<span class="pill" style="background:#fdecea;color:#c0392b;font-weight:800;">⚠ 不達 ${esc(d.email)}</span>`:`<span class="pill pill-ok">${esc(d.email)}</span>`)
      :`<span class="pill pill-no">メール未登録</span>`;
    const cnt=d.props.length>1?`<span class="pill pill-cnt">${d.props.length}物件まとめ</span>`:"";
    let boshuN=0, yoteiN=0, newN=0;
    d.props.forEach(p=>p.vac.forEach(v=>{ if(v.type==="募集中")boshuN++; else yoteiN++; }));
    d.props.forEach(p=>{ newN+=((p.newc||[]).length); });
    let vacPill="";
    if(d.yearOnly){
      vacPill=`<span class="vac" style="color:#8a6d2f;font-weight:800;">年間収支表のみ</span>`;
    }else{
      if(boshuN) vacPill+=`<span class="vac">募集中 ${boshuN}</span>`;
      if(yoteiN) vacPill+=`<span class="vac" style="margin-left:6px;color:#a14a3a;">解約予定 ${yoteiN}</span>`;
      if(newN) vacPill+=`<span class="vac" style="margin-left:6px;color:#2c6e49;font-weight:800;">新規契約 ${newN}</span>`;
      if(!boshuN && !yoteiN && !newN) vacPill=`<span class="vac none">満室</span>`;
    }
    const pageList=d.props.flatMap(p=>p.pages).sort((a,b)=>a-b);
    const _sent=sentSet.has(i);
    const _itemClass=_isB?' sent-fail':(_sent?' sent':'');
    const _statusBadge=_isB
      ? '<span class="vac" style="color:#c0392b;font-weight:800;">⚠ 配信できませんでした</span>'
      : (_sent?'<span class="vac" style="color:#2c6ea1;">✓ 送信済み</span>':'');
    return `<div class="pv-item${_itemClass}" id="pvi-${i}">
      <div class="pv-head" onclick="RENT.togglePv(${i})">
        <input type="checkbox" class="rent-check" value="${i}" onclick="event.stopPropagation();RENT.updateCheckCount()" ${d.email?'':'disabled title="メール未登録"'} style="width:18px;height:18px;cursor:pointer;flex-shrink:0;accent-color:var(--rt-accent);">
        <span class="nm">${esc(d.owner)}</span>
        ${cnt}
        <span class="spacer"></span>
        ${_statusBadge}
        ${vacPill}
        ${mailPill}
        <button onclick="event.stopPropagation();RENT.removeFromList(${i})" title="この一覧から外す" style="flex-shrink:0;margin-left:8px;width:26px;height:26px;border:1px solid #d9c9a8;background:#fff;color:#a14a3a;border-radius:6px;font-weight:800;cursor:pointer;line-height:1;">✕</button>
      </div>
      <div class="pv-body" id="pvb-${i}">
        <div class="pv-meta">${d.yearOnly
          ? `年間収支表のみ送付 <span class="attach" style="background:#f7efdc;color:#8a6d2f;">${esc(d.owner)}_年間収支表.pdf を添付予定</span>`
          : `対象物件: <b>${d.props.map(p=>esc(p.property||p.bldNo)).join(" / ")}</b>　|　PDF ${pageList.length}ページ分 <span class="attach">${esc(d.owner)}_明細.pdf を添付予定</span>${yearKeys.has(norm(d.owner))?` <span class="attach" style="background:#f7efdc;color:#8a6d2f;">年間収支表.pdf も添付</span>`:""}`} <span class="attach" style="background:#eef;color:#446;">送信元 infoirelife@gmail.com</span></div>
        <div class="pv-grid">
          <div class="field"><label>宛先メール</label><input value="${esc(d.email)}" oninput="RENT.setEmail(${i},this.value)" placeholder="未登録 — 入力するとここだけ反映"></div>
          <div class="field"><label>件名</label><input id="subj-${i}" value="${esc(subj)}"></div>
          <div class="field"><label>本文</label><textarea id="body-${i}">${esc(body)}</textarea></div>
        </div>
        <div class="pv-actions">
          <button class="btn btn-sm btn-acc" onclick="RENT.previewOwnerPdf(${i})">添付明細を確認</button>
          <button class="btn btn-sm" onclick="RENT.sendOne(${i})" style="background:#2c4f38;color:#fff;border-color:#2c4f38;">このオーナーに送信</button>
          <button class="btn btn-sm" onclick="RENT.draftOne(${i})">下書き作成</button>
          <button class="btn btn-sm" onclick="RENT.downloadOwnerPdf(${i})">PDF書出し</button>
          <button class="btn btn-sm" onclick="RENT.copyBody(${i})">本文コピー</button>
          ${sentSet.has(i)?`<button class="btn btn-sm btn-warn" onclick="RENT.unsendOne(${i})">↩ 未送信へ戻す</button>`:''}
          <button class="btn btn-sm btn-warn" onclick="RENT.removeFromList(${i})" title="この取込結果から外す（オーナー登録は消えません）">✕ 一覧から外す</button>
        </div>
        <div class="pdf-preview" id="pdfprev-${i}"></div>
      </div>
    </div>`;
  }).join("");
  box.innerHTML = shown ? cards : '<div class="empty">'+(q?('「'+esc(sb)+'」に一致するオーナー・物件は見つかりませんでした。'):'表示できるオーナーがありません。')+'</div>';
  // 除外オーナー専用区画(別管理)
  const exSec=document.getElementById("rent-excluded-section");
  const exBox=document.getElementById("excludedPreview");
  if(exSec && exBox){
    if(excludedIdx.length){
      exSec.style.display="block";
      const _gu=document.getElementById('sophiaGasUrl'); if(_gu && !_gu.value){ _gu.value=getSophiaGasUrl(); }
      exBox.innerHTML=excludedIdx.map(i=>{
        const d=detail[i];
        const pageList=d.props.flatMap(p=>p.pages||[]).sort((a,b)=>a-b);
        const propTxt=d.props.map(p=>esc(p.property||p.bldNo)).join(" / ");
        const pdfReady=!!pdfDoc;
        const monthStr=(d.props[0]&&d.props[0].month)||"";
        const _ym=parseYM(monthStr);
        const monthLabel=_ym?`${_ym.year}年${parseInt(_ym.month,10)}月分`:(monthStr||'対象月不明');
        const accumId="exaccum-"+i;
        const monthStatId="exmonthstat-"+i;
        return `<div class="pv-item" style="border-left:4px solid #c8a96b;margin-bottom:10px;">
          <div class="pv-head" style="cursor:default;">
            <span class="nm">${esc(d.owner)}</span>
            <span class="pill" style="background:#f3ead4;color:#8a6d2f;font-weight:800;">別管理</span>
            <span class="spacer"></span>
            <span class="vac">${d.yearOnly?'年間収支表':('PDF '+pageList.length+'ページ'+(monthStr?(' / '+esc(monthStr)):''))}</span>
            <button onclick="event.stopPropagation();RENT.unexcludeOwner('${esc(d.owner).replace(/'/g,"\\'")}')" title="別管理から外して通常の送信一覧に戻す"
              style="flex-shrink:0;margin-left:10px;border:1px solid #d9c9a8;background:#fff;color:#8a6d2f;font-size:.74rem;font-weight:800;padding:5px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;">✕ 別管理から外す</button>
          </div>
          <div class="pv-body open" style="padding:10px 12px;">
            <div class="pv-meta">対象物件: <b>${propTxt||'—'}</b>　|　メール送信は行いません</div>
            ${pdfReady?`<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:#eef4fb;border:1px solid #cfe0f3;font-size:.82rem;">
              <b style="color:#1565c0;">いま取り込んでいる明細：${esc(monthLabel)}</b>
              <span id="${monthStatId}" style="margin-left:8px;font-weight:700;color:var(--rt-muted);">蓄積状況を確認中…</span>
            </div>`:''}
            <div class="pv-actions" style="margin-top:8px;">
              <button class="btn btn-sm btn-acc" onclick="RENT.previewOwnerPdf(${i})" ${pdfReady?'':'disabled'}>明細を確認</button>
              <button class="btn btn-sm" onclick="RENT.accumulateOwnerMonth(${i})" ${pdfReady?'':'disabled'} style="background:#1565c0;color:#fff;border-color:#1565c0;">${pdfReady?esc(monthLabel):'この月'}を蓄積</button>
              <button class="btn btn-sm" onclick="RENT.accumulateOwnerYear(${i})" style="background:#8a6d2f;color:#fff;border-color:#8a6d2f;">年間収支表を蓄積</button>
              <button class="btn btn-sm" onclick="RENT.downloadOwnerPdf(${i})" ${pdfReady?'':'disabled'}>この月をPCに保存</button>
            </div>
            ${pdfReady?'':'<div style="font-size:.76rem;color:var(--warn);font-weight:700;margin-top:6px;">※ 蓄積・保存するには上の枠に明細PDFを取り込んでください。</div>'}
            <div style="margin-top:10px;font-size:.78rem;font-weight:800;color:#8a6d2f;">共用Driveに蓄積済みの明細（年ごと）</div>
            <div id="${accumId}" style="margin-top:4px;"><div style="font-size:.76rem;color:var(--rt-muted);">読み込み中…</div></div>
            <div class="pdf-preview" id="pdfprev-${i}"></div>
          </div>
        </div>`;
      }).join("");
      // 各オーナーの蓄積状況を描画（共用Driveから）＋いま取込中の月が蓄積済みか判定
      (async()=>{ for(const i of excludedIdx){ try{ await renderExAccumInto("exaccum-"+i, detail[i].owner, i); }catch(e){} } })();
      // 12/20以降なら年末自動まとめを一度だけ実行
      try{ autoYearEndMergeIfDue(); }catch(e){}
    }else{
      // 明細を取り込んでいないが、除外オーナー登録がある場合は「閲覧専用」カードを出す
      renderExcludedViewOnly();
    }
  }
  // 除外件数の案内
  const exNote=document.getElementById("rent-exclude-note");
  if(exNote){
    if(excludedCount>0){ exNote.style.display="block"; exNote.textContent=`「送信しない」に指定したオーナー ${excludedCount} 件は、下の「メール送信しないオーナー（別管理）」に表示しています。`; }
    else { exNote.style.display="none"; }
  }
}
function setEmail(i,v){
  if(detail&&detail[i]){
    const old=(detail[i].email||"").toLowerCase();
    detail[i].email=v;
    if((v||"").toLowerCase()!==old){
      if(sentSet.has(i)){ sentSet.delete(i); saveDetailState(); }
    }
  }
}
function togglePv(i){ document.getElementById("pvb-"+i).classList.toggle("open"); }
function expandAll(open){ document.querySelectorAll(".pv-body").forEach(b=>b.classList.toggle("open",open)); }
function copyBody(i){ const ta=document.getElementById("body-"+i); ta.select(); document.execCommand("copy"); toast("本文をコピーしました"); }
 
/* オーナーの該当ページだけ抜いた個別PDFを生成して返す(添付の実体) */
async function makeOwnerPdfBlob(i){
  if(!pdfDoc){ toast("先にPDFを取り込んでください"); return null; }
  const d=detail[i];
  const pages=[...new Set(d.props.flatMap(p=>p.pages))].sort((a,b)=>a-b);
  const out=await PDFLib.PDFDocument.create();
  const copied=await out.copyPages(pdfDoc, pages.map(p=>p-1));
  copied.forEach(pg=>out.addPage(pg));
  const bytes=await out.save();
  return new Blob([bytes],{type:"application/pdf"});
}
 
// PDFドキュメント全体を丸ごとBlob化(IRE宛プレビュー用・全オーナー分)
async function makeFullPdfBlob(srcDoc){
  if(!srcDoc){ return null; }
  try{
    const bytes=await srcDoc.save();
    return new Blob([bytes],{type:"application/pdf"});
  }catch(e){ console.error("makeFullPdfBlob:", e); return null; }
}
 
/* オーナーiのPDFをBase64文字列で取得(GAS送信用) */
// PDFドキュメント全体を丸ごとBase64化(IRE宛の「全オーナー分」添付用)
async function makeFullPdfBase64(srcDoc){
  if(!srcDoc){ return null; }
  try{
    const b64 = await srcDoc.saveAsBase64();
    return b64;
  }catch(e){ console.error("makeFullPdfBase64:", e); return null; }
}
async function makeOwnerPdfBase64(i){
  if(!pdfDoc){ return null; }
  const d=detail[i];
  const pages=[...new Set(d.props.flatMap(p=>p.pages))].sort((a,b)=>a-b);
  const out=await PDFLib.PDFDocument.create();
  const copied=await out.copyPages(pdfDoc, pages.map(p=>p-1));
  copied.forEach(pg=>out.addPage(pg));
  const b64=await out.saveAsBase64();   // pdf-libのBase64出力
  return b64;
}
 
/* チェックされたオーナーのindex配列 */
function checkedIndexes(){
  return Array.from(document.querySelectorAll('#preview .rent-check:checked')).map(c=>+c.value);
}
 
/* 選択数をボタンに反映 */
function updateCheckCount(){
  const n=checkedIndexes().length;
  const db=document.getElementById("rent-btn-draft");
  const sb=document.getElementById("rent-btn-send");
  if(db) db.textContent = n? `選択 ${n} 件の下書きを作成` : "下書きを作成";
  if(sb) sb.textContent = n? `選択 ${n} 件を一斉送信` : "一斉送信";
}
 
/* 全選択トグル(メール登録済み=有効なものだけ) */
function toggleCheckAll(on){
  document.querySelectorAll('#preview .rent-check').forEach(c=>{ if(!c.disabled) c.checked=on; });
  updateCheckCount();
}
 
/* 選択オーナーの下書き or 送信データを組み立てる */
async function buildMailPayload(indexes, statusFn){
  // 月額PDFも年間PDFも両方ない場合だけ止める(どちらかあれば進める)
  if(!pdfDoc && !yearPdfDoc){
    alert("明細PDFが読み込まれていません。\n\n送信・下書きには、月額明細または年間収支表のPDFをドロップして取り込んでください。");
    return null;
  }
  const arr=[];
  for(let k=0;k<indexes.length;k++){
    const i=indexes[k];
    const d=detail[i];
    if(statusFn) statusFn(`PDF生成中… ${k+1}/${indexes.length}（${d.owner}）`);
    const to=(d.email||"").trim();
    const subject=buildSubject(d);
    const body=buildBody(d);
    const month=(d.props[0]&&d.props[0].month||"").replace(/[年月]/g,"");
    // IRE(asano@i-r-e.jp)宛だけは、振り分けず「全オーナー分を丸ごと」添付する
    const isIRE = (to.toLowerCase() === "asano@i-r-e.jp");
    let pdfBase64, pdfName, pdfBase64_2, pdfName_2, pdfBase64_3="", pdfName_3="";
    if(isIRE){
      pdfBase64 = pdfDoc ? await makeFullPdfBase64(pdfDoc) : null;
      pdfName   = pdfBase64 ? `月額明細_全オーナー_${month}.pdf`.replace(/\s/g,"") : "";
      pdfBase64_2 = yearPdfDoc ? await makeFullPdfBase64(yearPdfDoc) : null;
      pdfName_2   = pdfBase64_2 ? `年間収支表_全オーナー.pdf`.replace(/\s/g,"") : "";
      pdfBase64_3 = payPdfBase64 || "";
      pdfName_3   = payPdfBase64 ? (payPdfName || "振込明細.pdf").replace(/\s/g,"") : "";
    } else {
      pdfBase64 = pdfDoc ? await makeOwnerPdfBase64(i) : null;
      pdfName   = pdfBase64 ? `${d.owner}_明細_${month}.pdf`.replace(/\s/g,"") : "";
      pdfBase64_2 = await makeYearPdfBase64(d.owner);
      pdfName_2   = pdfBase64_2 ? `${d.owner}_年間収支表.pdf`.replace(/\s/g,"") : "";
    }
    arr.push({ to, subject, body, pdfBase64, pdfName, pdfBase64_2, pdfName_2, pdfBase64_3, pdfName_3, owner:d.owner });
  }
  return arr;
}
 
/* GAS経由: 選択オーナーのGmail下書きを作成 */
async function createDraftsForChecked(){
  const idx=checkedIndexes();
  if(!idx.length){ toast("オーナーを選択してください（チェックボックス）"); return; }
  const noMail=idx.filter(i=>!(detail[i].email||"").trim());
  if(noMail.length){ toast("メール未登録のオーナーが含まれています。先に登録してください"); return; }
  const url=(typeof window.getCloudUrl==='function')?window.getCloudUrl():'';
  if(!url){ toast("クラウド(GAS)URLが未設定です。設定から登録してください"); return; }
  const st=document.getElementById("rent-action-status");
  const setS=m=>{ if(st)st.textContent=m; };
  setS("準備中…");
  try{
    const drafts=await buildMailPayload(idx, setS);
    if(!drafts){ setS(""); return; }
    setS(`下書き作成中…（${drafts.length}件）`);
    const r=await window.postToGas(url, { action:'createMailDrafts', drafts: drafts }, 120000);
    if(r&&r.ok){
      const ng=(r.results||[]).filter(x=>!x.ok);
      setS(`✅ 下書き ${r.created} 件を作成しました`+(ng.length?` / 失敗 ${ng.length}件`:""));
      if(ng.length){ alert("下書き作成に失敗したものがあります:\n\n"+ng.map(x=>`・${x.to||"(宛先不明)"}: ${x.error||"不明なエラー"}`).join("\n")); }
      toast(`Gmailの下書きに ${r.created} 件作成しました`);
    }else{
      setS("⚠ 失敗: "+((r&&r.message)||"不明なエラー"));
    }
  }catch(e){ setS("⚠ エラー: "+e.message); }
}
 
/* GAS経由: 選択オーナーへ一斉送信(確認あり) */
async function sendMailsForChecked(){
  const idx=checkedIndexes();
  if(!idx.length){ toast("オーナーを選択してください（チェックボックス）"); return; }
  const noMail=idx.filter(i=>!(detail[i].email||"").trim());
  if(noMail.length){ toast("メール未登録のオーナーが含まれています。先に登録してください"); return; }
  const names=idx.map(i=>`・${detail[i].owner}（${detail[i].email}）`).join("\n");
  if(!confirm(`次の ${idx.length} 件に「実際に送信」します。よろしいですか?\n\n${names}\n\n※ 送信は取り消せません。`)) return;
  const url=(typeof window.getCloudUrl==='function')?window.getCloudUrl():'';
  if(!url){ toast("クラウド(GAS)URLが未設定です"); return; }
  const st=document.getElementById("rent-action-status");
  const setS=m=>{ if(st)st.textContent=m; };
  setS("準備中…");
  try{
    const mails=await buildMailPayload(idx, setS);
    if(!mails){ setS(""); return; }
    setS(`送信中…（${mails.length}件）`);
    const r=await window.postToGas(url, { action:'sendMails', mails: mails }, 180000);
    if(r&&r.ok){
      const ng=(r.results||[]).filter(x=>!x.ok);
      // 成功した宛先を送信済みに記録
      const okSet=new Set((r.results||[]).filter(x=>x.ok).map(x=>x.to));
      idx.forEach(i=>{ if(okSet.has((detail[i].email||"").trim())) sentSet.add(i); });
      saveDetailState();
      // 送信履歴に追記(月をまたいで残す)
      appendHistory(idx.filter(i=>okSet.has((detail[i].email||"").trim())).map(i=>({
        month:(detail[i].props[0]&&detail[i].props[0].month)||"", owner:detail[i].owner, to:detail[i].email, kind:'send'
      })));
      setS(`✅ ${r.sent} 件を送信しました`+(ng.length?` / 失敗 ${ng.length}件`:""));
      if(ng.length){ alert("送信に失敗したものがあります:\n\n"+ng.map(x=>`・${x.to||"(宛先不明)"}: ${x.error||"不明なエラー"}`).join("\n")); }
      toast(`${r.sent} 件を送信しました`);
      renderPreview();
    }else{
      setS("⚠ 失敗: "+((r&&r.message)||"不明なエラー"));
    }
  }catch(e){ setS("⚠ エラー: "+e.message); }
}
 
/* 個別: 送信済みを未送信に戻す(画面上の印を外すだけ。送ったメール自体は取り消せない) */
function unsendOne(i){
  if(!sentSet.has(i)) return;
  if(!confirm(`${detail[i].owner} を「未送信」に戻します。\n（※すでに送信されたメールは取り消せません。画面の送信済み表示を外すだけです）`)) return;
  sentSet.delete(i);
  saveDetailState();
  renderPreview();
  toast("未送信に戻しました");
}
 
/* 送信一覧(取込結果)から、このオーナーのカードだけを外す。オーナー登録は消さない */
function removeFromList(i){
  if(!detail || !detail[i]) return;
  const name=detail[i].owner;
  if(!confirm(`「${name}」を、この取込結果の一覧から外します。\n（オーナー登録は消えません。次回PDFを取り込むとまた表示されます）`)) return;
  detail.splice(i,1);
  sentSet=new Set();           // indexがずれるため送信済みマークはリセット
  saveDetailState();
  renderPreview();
  toast(`${name} を一覧から外しました`);
}
async function sendOne(i){
  if(!(detail[i].email||"").trim()){ toast("メール未登録です"); return; }
  if(!confirm(`${detail[i].owner}（${detail[i].email}）に送信します。よろしいですか?\n※送信は取り消せません。`)) return;
  const url=(typeof window.getCloudUrl==='function')?window.getCloudUrl():'';
  if(!url){ toast("クラウド(GAS)URLが未設定です"); return; }
  const st=document.getElementById("rent-action-status");
  const setS=m=>{ if(st)st.textContent=m; };
  setS(`${detail[i].owner} 送信準備中…`);
  try{
    const mails=await buildMailPayload([i], setS);
    if(!mails){ setS(""); return; }
    setS(`${detail[i].owner} 送信中…`);
    const r=await window.postToGas(url, { action:'sendMails', mails: mails }, 120000);
    if(r&&r.ok && r.sent>0){
      sentSet.add(i);
      saveDetailState();
      appendHistory([{ month:(detail[i].props[0]&&detail[i].props[0].month)||"", owner:detail[i].owner, to:detail[i].email, kind:'send' }]);
      setS(`✅ ${detail[i].owner} に送信しました`);
      toast("送信しました");
      renderPreview();
    }else{
      const err=(r&&r.results&&r.results[0]&&r.results[0].error)||(r&&r.message)||"不明なエラー";
      setS("⚠ 失敗: "+err);
      alert("送信に失敗しました:\n"+err);
    }
  }catch(e){ setS("⚠ エラー: "+e.message); }
}
 
/* 個別: 1オーナーだけ下書き作成 */
async function draftOne(i){
  if(!(detail[i].email||"").trim()){ toast("メール未登録です"); return; }
  const url=(typeof window.getCloudUrl==='function')?window.getCloudUrl():'';
  if(!url){ toast("クラウド(GAS)URLが未設定です"); return; }
  const st=document.getElementById("rent-action-status");
  const setS=m=>{ if(st)st.textContent=m; };
  setS(`${detail[i].owner} 下書き作成中…`);
  try{
    const drafts=await buildMailPayload([i], setS);
    if(!drafts){ setS(""); return; }
    const r=await window.postToGas(url, { action:'createMailDrafts', drafts: drafts }, 120000);
    if(r&&r.ok && r.created>0){
      setS(`✅ ${detail[i].owner} の下書きを作成しました`);
      toast("下書きを作成しました");
    }else{
      const err=(r&&r.results&&r.results[0]&&r.results[0].error)||(r&&r.message)||"不明なエラー";
      setS("⚠ 失敗: "+err);
      alert("下書き作成に失敗しました:\n"+err);
    }
  }catch(e){ setS("⚠ エラー: "+e.message); }
}
 
 
 
/* 添付される明細PDFをその場で埋め込みプレビュー(送信前の目視確認用) */
async function previewOwnerPdf(i){
  const box=document.getElementById("pdfprev-"+i);
  if(box.dataset.open==="1"){ box.innerHTML=""; box.dataset.open="0"; return; }
  box.innerHTML='<div class="pdf-loading">添付PDFを生成中…</div>';
  const d=detail[i];
  const isIRE=((d.email||"").trim().toLowerCase()==="asano@i-r-e.jp");
  let html="";
  // 月額明細(月額が取り込まれていれば)
  if(pdfDoc && !d.yearOnly){
    const blob = isIRE ? await makeFullPdfBlob(pdfDoc) : await makeOwnerPdfBlob(i);
    if(blob){
      const url=URL.createObjectURL(blob);
      const pages = isIRE ? pdfDoc.getPageCount() : [...new Set(d.props.flatMap(p=>p.pages))].length;
      const capName = isIRE ? `月額明細_全オーナー.pdf（${pages}ページ・全オーナー分）` : `${esc(d.owner)}_明細.pdf（${pages}ページ）`;
      html+=`<div class="pdf-cap">${capName} — このPDFが添付されます</div>
        <iframe src="${url}#toolbar=1" title="明細プレビュー"></iframe>`;
    }
  }
  let yb64=null;
  try{ yb64 = isIRE ? (yearPdfDoc ? await makeFullPdfBase64(yearPdfDoc) : null) : await makeYearPdfBase64(d.owner); }catch(e){ html+=`<div class="pdf-cap" style="background:#fdecea;color:#c0392b;">⚠ 年間PDF生成エラー: ${esc(e.message)}</div>`; }
  if(yb64){
    try{
      const bin=atob(yb64); const arr=new Uint8Array(bin.length);
      for(let k=0;k<bin.length;k++) arr[k]=bin.charCodeAt(k);
      const yblob=new Blob([arr],{type:"application/pdf"});
      const yurl=URL.createObjectURL(yblob);
      html+=`<div class="pdf-cap" style="background:#f7efdc;color:#8a6d2f;margin-top:10px;">${esc(d.owner)}_年間収支表.pdf — このPDFも添付されます（<a href="${yurl}" target="_blank" style="color:#8a6d2f;text-decoration:underline;">別タブで開く</a>）</div>
        <iframe src="${yurl}#toolbar=1" title="年間収支表プレビュー" style="width:100%;min-height:400px;"></iframe>`;
    }catch(e){ html+=`<div class="pdf-cap" style="background:#fdecea;color:#c0392b;">⚠ 年間PDF表示エラー: ${esc(e.message)}</div>`; }
  } else {
    // 年間が紐づいているはずなのに取れない場合の手がかり
    let info="";
    try{ info = `yearPdfDoc=${!!yearPdfDoc}, yearMapキー数=${Object.keys(yearMap||{}).length}, このオーナーのキー="${norm(d.owner)}", 該当=${!!(yearMap&&yearMap[norm(d.owner)])}`; }catch(e){}
    if(yearPdfDoc){ html+=`<div class="pdf-cap" style="background:#fff7e6;color:#9a6;margin-top:10px;">年間収支表は見つかりませんでした（${esc(info)}）</div>`; }
  }
  if(!html){ box.innerHTML='<div class="pdf-loading">表示できるPDFがありません（PDFを取り込んでください）</div>'; box.dataset.open="1"; return; }
  box.innerHTML=html;
  box.dataset.open="1";
}
 
/* Gmailの作成画面を開く(宛先・件名・本文入り)。添付PDFは自動ダウンロードし手動でドラッグ添付 */
async function sendViaGmail(i){
  const d=detail[i];
  const to=(document.querySelector(`#pvb-${i} input[placeholder^="未登録"]`)||{}).value || d.email || "";
  const subj=document.getElementById("subj-"+i).value;
  const body=document.getElementById("body-"+i).value;
  if(!to){ toast("宛先メールが未登録です。オーナー一覧か上の宛先欄に入力してください"); return; }
  // 添付PDFを先にダウンロード(Gmail画面でドラッグ添付してもらう)
  await downloadOwnerPdf(i);
  const url="https://mail.google.com/mail/?view=cm&fs=1&to="+encodeURIComponent(to)
    +"&su="+encodeURIComponent(subj)+"&body="+encodeURIComponent(body);
  window.open(url,"_blank");
  toast("Gmail作成画面を開きました。ダウンロードした明細PDFを添付してください");
}
 
/* オーナーの該当ページだけ抜いた個別PDFをダウンロード */
async function downloadOwnerPdf(i){
  const blob=await makeOwnerPdfBlob(i);
  if(!blob) return;
  const d=detail[i];
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`${d.owner}_明細_${(d.props[0]&&d.props[0].month||"").replace(/[年月]/g,"")}.pdf`.replace(/\s/g,"");
  a.click();
  toast(d.owner+" の明細PDFを書き出しました");
}
 
/* =========================================================
   除外オーナー(ソフィア等)専用: PIVOT内(端末IndexedDB)への明細蓄積
   - Firebaseとは完全に別。物件データには一切影響しない。
   - キー: owner|YYYY|MM(月次) / owner|YYYY|YEAR(年間収支表)
   ========================================================= */
/* =========================================================
   除外オーナー(ソフィア等)専用: 共用Drive(GAS経由)への明細蓄積
   - Firebaseとは完全に別。物件データには一切影響しない。
   - 社員全員が同じDriveを参照・蓄積できる。
   ========================================================= */
const SOPHIA_GAS_KEY='sophia_gas_url_v1';
const SOPHIA_GAS_DEFAULT='https://script.google.com/macros/s/AKfycbziyfOAZHMr1m9ocFJrl0uLPGg5pwSZoHbb_gJETlEbGlHcHdmu6ZglOVl7TwJqMYuq/exec';
function getSophiaGasUrl(){ try{ return localStorage.getItem(SOPHIA_GAS_KEY)||SOPHIA_GAS_DEFAULT; }catch(e){ return SOPHIA_GAS_DEFAULT; } }
// 別管理（除外）から外して、通常の送信一覧へ戻す
function unexcludeOwner(name){
  const o = owners.find(x => norm(x.name) === norm(name));
  if(!o){ toast("オーナーが見つかりません"); return; }
  if(!confirm("「" + o.name + "」を別管理から外しますか?\n\n通常の送信一覧に戻ります。\n共用Driveに蓄積した明細は消えません。")) return;
  o.exclude = false;
  saveOwners();
  renderOwners();
  renderPreview();
  toast(o.name + " を別管理から外しました");
}
function saveSophiaGasUrl(){
  const el=document.getElementById('sophiaGasUrl'); if(!el) return;
  const url=(el.value||'').trim();
  const stat=document.getElementById('sophiaGasStat');
  if(url && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)){
    if(stat){ stat.textContent='※ URLの形式が違うようです'; stat.style.color='#c0392b'; }
    return;
  }
  try{ localStorage.setItem(SOPHIA_GAS_KEY,url); }catch(e){}
  if(stat){ stat.textContent='保存しました'; stat.style.color='#2c6e49'; }
  renderPreview();
}
// GASにPOSTして結果(JSON)を返す
async function sophiaGasCall(payload){
  const url=getSophiaGasUrl();
  if(!url) throw new Error('共用Drive連携URLが未設定です（別管理の上部で設定してください）');
  const res=await fetch(url,{
    method:'POST',
    // GASのdoPostはe.postData.contentsで受けるため、text/plainで送る(プリフライト回避)
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(payload)
  });
  if(!res.ok) throw new Error('通信エラー(HTTP '+res.status+')');
  const data=await res.json();
  if(data && data.ok===false) throw new Error(data.error||'GAS側でエラー');
  return data;
}
// 「2026年03月」「2026年6月」→ {year:'2026', month:'06'}。取れなければ null
function parseYM(monthStr){
  const m=(monthStr||'').match(/(\d{4})年\s*(\d{1,2})月/);
  if(!m) return null;
  return { year:m[1], month:String(parseInt(m[2],10)).padStart(2,'0') };
}
// いま取り込んでいる除外オーナー(detail[i])の当月明細を共用Driveへ蓄積
async function accumulateOwnerMonth(i){
  if(!pdfDoc){ toast('先に明細PDFを取り込んでください'); return; }
  const d=detail[i];
  const ym=parseYM((d.props[0]&&d.props[0].month)||'');
  if(!ym){ toast('対象月が読み取れませんでした(この明細は年間のみ等の可能性)'); return; }
  try{
    // 既に同じ月が蓄積済みなら上書き確認
    const acc=await loadExAccum(d.owner);
    const already=acc[ym.year] && acc[ym.year].months && acc[ym.year].months.has(ym.month);
    if(already && !confirm(`${d.owner} の ${ym.year}年${parseInt(ym.month,10)}月分は既に共用Driveに蓄積済みです。\n上書きしますか?`)) return;
    toast('共用Driveへ保存中…');
    const b64=await makeOwnerPdfBase64(i);
    if(!b64){ toast('明細PDFの作成に失敗しました'); return; }
    await sophiaGasCall({ action:'save', owner:d.owner, year:ym.year, month:ym.month, kind:'month', b64 });
    toast(`${d.owner} ${ym.year}年${parseInt(ym.month,10)}月分を共用Driveに保存しました`);
    renderPreview();
  }catch(e){ console.error(e); toast('保存に失敗: '+e.message); }
}
// 年間収支表を共用Driveへ蓄積
async function accumulateOwnerYear(i){
  const d=detail[i];
  try{
    const b64=await makeYearPdfBase64(d.owner);
    if(!b64){ toast('この明細に年間収支表が見つかりません'); return; }
    let year=(parseYM((d.props[0]&&d.props[0].month)||'')||{}).year || String(new Date().getFullYear());
    const acc=await loadExAccum(d.owner);
    if(acc[year] && acc[year].hasYear && !confirm(`${d.owner} の ${year}年 年間収支表は既に共用Driveに蓄積済みです。\n上書きしますか?`)) return;
    toast('共用Driveへ保存中…');
    await sophiaGasCall({ action:'save', owner:d.owner, year, month:'YEAR', kind:'year', b64 });
    toast(`${d.owner} ${year}年 年間収支表を共用Driveに保存しました`);
    renderPreview();
  }catch(e){ console.error(e); toast('年間収支表の保存に失敗: '+e.message); }
}
// あるオーナーの蓄積状況を年ごとに集計(共用Driveから) → {year:{months:Set, hasYear:bool}}
async function loadExAccum(ownerName){
  const byYear={};
  if(!getSophiaGasUrl()) return byYear;
  try{
    const data=await sophiaGasCall({ action:'list', owner:ownerName });
    const years=data.years||{};
    Object.keys(years).forEach(y=>{
      const info=years[y];
      const set=new Set((info.months||[]).map(mm=>String(parseInt(mm,10)).padStart(2,'0')));
      byYear[y]={ months:set, hasYear:!!info.hasYear };
    });
  }catch(e){ console.warn('list失敗:',e.message); }
  return byYear;
}
// 除外オーナーの、ある年の 1〜12月＋年間 を1つのPDFに結合してダウンロード(共用Driveから取得)
async function mergeYearForOwner(ownerName,year){
  try{
    toast('共用Driveから取得中…');
    const data=await sophiaGasCall({ action:'merge', owner:ownerName, year });
    const items=data.items||[];
    if(!items.length){ toast('この年の蓄積データがありません'); return; }
    const out=await PDFLib.PDFDocument.create();
    for(const it of items){
      if(!it.b64) continue;
      const src=await PDFLib.PDFDocument.load(_b64ToBytes(it.b64));
      const pages=await out.copyPages(src,src.getPageIndices());
      pages.forEach(p=>out.addPage(p));
    }
    const bytes=await out.save();
    const blob=new Blob([bytes],{type:'application/pdf'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`${ownerName}_${year}年_年間まとめ.pdf`.replace(/\s/g,'');
    a.click();
    toast(`${ownerName} ${year}年分(${items.length}件)を1つのPDFにまとめました`);
  }catch(e){ console.error(e); toast('まとめPDFの作成に失敗: '+e.message); }
}
function _b64ToBytes(b64){
  const bin=atob(b64); const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return arr;
}
// 蓄積済みの1件(月次または年間)を新しいタブで開く
async function viewExAccum(ownerName,year,mm){
  try{
    toast('共用Driveから取得中…');
    const data=await sophiaGasCall({ action:'merge', owner:ownerName, year });
    const items=data.items||[];
    // mm='03'なら「YYYY年03月」を、'YEAR'なら「年間収支表」を含むファイルを探す
    const target=items.find(it=>{
      if(mm==='YEAR') return /年_年間収支表_/.test(it.name);
      return new RegExp(year+'年'+mm+'月_').test(it.name);
    });
    if(!target || !target.b64){ toast('その明細が見つかりませんでした'); return; }
    const bytes=_b64ToBytes(target.b64);
    const blob=new Blob([bytes],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const win=window.open(url,'_blank');
    if(!win){ // ポップアップブロック時はダウンロードにフォールバック
      const a=document.createElement('a'); a.href=url; a.download=target.name; a.click();
      toast('新しいタブが開けなかったため、ダウンロードしました');
    }else{
      toast('明細を新しいタブで開きました');
    }
  }catch(e){ console.error(e); toast('表示に失敗: '+e.message); }
}
// 12/20以降かどうか(年末自動まとめの解禁判定)
function isYearEndOpen(){
  const now=new Date();
  return (now.getMonth()===11 && now.getDate()>=20);
}
// 蓄積済みの1件を削除(共用Drive)
async function deleteExAccum(ownerName,year,mm){
  const label=mm==='YEAR'?`${year}年 年間収支表`:`${year}年${mm}月分`;
  if(!confirm(`${ownerName} の ${label} を共用Driveから削除しますか?`)) return;
  try{
    await sophiaGasCall({ action:'delete', owner:ownerName, year, month:mm, kind:(mm==='YEAR'?'year':'month') });
    toast('削除しました'); renderPreview();
  }catch(e){ console.error(e); toast('削除に失敗: '+e.message); }
}
// ある年の蓄積を一括削除(共用Drive)
async function deleteExYear(ownerName,year){
  if(!confirm(`${ownerName} の ${year}年分（月次・年間すべて）を共用Driveから削除します。\nまとめPDFを書き出し済みか確認してください。よろしいですか?`)) return;
  try{
    const data=await sophiaGasCall({ action:'deleteYear', owner:ownerName, year });
    toast(`${year}年分 ${data.deleted||0}件を削除しました`); renderPreview();
  }catch(e){ console.error(e); toast('削除に失敗: '+e.message); }
}
// 除外オーナーカード内に「年ごとの蓄積状況」HTMLを組み立てて差し込む(非同期)
async function renderExAccumInto(containerId,ownerName,cardIdx){
  const el=document.getElementById(containerId);
  if(!el) return;
  const byYear=await loadExAccum(ownerName);
  // いま取り込んでいる月が蓄積済みかを、同じ集計結果から判定して表示
  if(cardIdx!==undefined){
    const stat=document.getElementById("exmonthstat-"+cardIdx);
    const d=detail[cardIdx];
    const ym=d&&parseYM((d.props[0]&&d.props[0].month)||'');
    if(stat && ym){
      const info=byYear[ym.year];
      const done=info && info.months && info.months.has(ym.month);
      if(done){ stat.textContent='✓ この月は蓄積済み'; stat.style.color='#1565c0'; }
      else{ stat.textContent='● 未蓄積（まだ保存されていません）'; stat.style.color='#c0392b'; }
    }else if(stat){ stat.textContent=''; }
  }
  const years=Object.keys(byYear).sort((a,b)=>b.localeCompare(a));
  if(!years.length){ el.innerHTML='<div style="font-size:.76rem;color:var(--rt-muted);">まだ蓄積された明細はありません。</div>'; return; }
  const yearEnd=isYearEndOpen();
  el.innerHTML=years.map(y=>{
    const info=byYear[y];
    const cells=[];
    for(let m=1;m<=12;m++){
      const mm=String(m).padStart(2,'0');
      const has=info.months.has(mm);
      cells.push(`<span title="${has?'クリックで明細を表示':'未蓄積'}" ${has?`onclick="RENT.viewExAccum('${esc(ownerName)}','${y}','${mm}')" style="cursor:pointer;"`:''} class="ex-mchip" style="display:inline-block;min-width:30px;text-align:center;padding:3px 4px;margin:2px;border-radius:5px;font-size:.72rem;font-weight:700;${has?'background:#1565c0;color:#fff;':'background:#eee;color:#aaa;'}">${m}月</span>`);
    }
    const yChip=`<span title="${info.hasYear?'クリックで年間収支表を表示':'未蓄積'}" ${info.hasYear?`onclick="RENT.viewExAccum('${esc(ownerName)}','${y}','YEAR')" style="cursor:pointer;"`:''} class="ex-mchip" style="display:inline-block;padding:3px 6px;margin:2px;border-radius:5px;font-size:.72rem;font-weight:800;${info.hasYear?'background:#8a6d2f;color:#fff;':'background:#eee;color:#aaa;'}">📊年間</span>`;
    const cnt=info.months.size;
    return `<div style="margin-top:8px;padding:8px;border:1px solid #e3d9c4;border-radius:8px;background:#fff;">
      <div style="font-weight:800;color:#8a6d2f;font-size:.82rem;margin-bottom:4px;">${y}年 <span style="font-weight:600;color:var(--rt-muted);">（月次 ${cnt}/12 ・ ${info.hasYear?'年間あり':'年間なし'}）</span></div>
      <div>${cells.join('')} ${yChip}</div>
      <div style="margin-top:8px;">
        <button class="btn btn-sm" onclick="RENT.mergeYearForOwner('${esc(ownerName)}','${y}')" style="background:#8a6d2f;color:#fff;border-color:#8a6d2f;">${y}年分を1つのPDFにまとめる（${cnt+(info.hasYear?1:0)}件）</button>
        <button class="btn btn-sm btn-warn" onclick="RENT.deleteExYear('${esc(ownerName)}','${y}')" title="この年の蓄積をすべて削除">${y}年分を削除</button>
        ${yearEnd?'<span style="font-size:.72rem;color:#2c6e49;font-weight:700;margin-left:6px;">年末まとめOK</span>':'<span style="font-size:.72rem;color:var(--rt-muted);margin-left:6px;">※いつでもまとめられます（自動解禁:12/20〜）</span>'}
      </div>
    </div>`;
  }).join('');
}
// 12/20以降の年末自動まとめ: 未生成ならその年のまとめPDFを1回だけ自動ダウンロード
async function autoYearEndMergeIfDue(){
  if(!isYearEndOpen()) return;
  const year=String(new Date().getFullYear());
  const flagKey='rent_exaccum_autoyear_'+year;
  if(localStorage.getItem(flagKey)) return; // その年は実行済み
  // 除外オーナーで、その年の蓄積があるものを対象
  const excludedOwners=owners.filter(o=>o.exclude).map(o=>o.name);
  let did=false;
  for(const own of excludedOwners){
    const byYear=await loadExAccum(own);
    if(byYear[year] && (byYear[year].months.size>0 || byYear[year].hasYear)){
      await mergeYearForOwner(own,year); did=true;
    }
  }
  if(did){ localStorage.setItem(flagKey,'1'); }
}
 
/* タブ表示時に初期化(初回のみ実体化) */
let _rentBooted=false;
function activate(){
  const subj=document.getElementById("tmplSubject"); if(subj) subj.value=tmpl.subject;
  const bd=document.getElementById("tmplBody"); if(bd) bd.value=tmpl.body;
  if(!_rentBooted){
    // 前回の仕分け結果を復元(PDFは含まないので、送信/プレビューにはPDF再取込が必要)
    if(!detail.length){ restoreDetailState(); }
  }
  renderOwners();
  renderPreview();
  // オーナーメール画面を開くたびに、いちばん左の
  // 「明細取込・送信」に戻します。
  // （前に見ていたタブが残ったままになるのを防ぐため）
  showView("send");
  _rentBooted=true;
}
 
 
/* 取込モジュール(ownerimport.js)から中の owners を触れるようにする橋渡し */
try{ window.RENT_CORE = {
  get owners(){ return owners; },
  save: saveOwners, render: renderOwners, flash: flashSaved, toast: toast
}; }catch(e){}
window.RENT = { activate, filterOwners, openOwnerSheet, closeOwnerSheet, unexcludeOwner, setEmail, showView, addOwnerRow, resetOwners, resetTmpl, expandAll, renderPreview, saveTmpl, editOwner, editProps, delOwner, togglePv, copyBody, previewOwnerPdf, downloadOwnerPdf, sendViaGmail, renderOwners, createDraftsForChecked, sendMailsForChecked, updateCheckCount, toggleCheckAll, sendOne, draftOne, unsendOne, removeFromList, renderHistory, clearHistory, checkBounces, accumulateOwnerMonth, accumulateOwnerYear, mergeYearForOwner, deleteExAccum, deleteExYear, saveSophiaGasUrl, viewExAccum };
})();
