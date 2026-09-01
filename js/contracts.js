/* ==================================================================
 * CONTRACTS / 契約カンバン (IIFE / window.KB)
 * ================================================================== */
 
/* ===== KANBAN (namespaced) ===== */
(function(){
 
const STORAGE_KEY = (typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + 'contract_kanban_v2';
function loadAll(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e){ return {}; } }
function saveAll(d){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  // 契約データの変更は即座にクラウドへ送信(削除直後にリロードしても間に合うように)
  try{
    if(typeof window.__pushNow === 'function'){ window.__pushNow(); }
    else if(typeof window.__scheduleAutoPush === 'function'){ window.__scheduleAutoPush(); }
  }catch(e){}
  try{ if(typeof window.pushFeatureToCloud==='function'){ window.pushFeatureToCloud('contracts'); } }catch(e){}
}
function genId(){ return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function today(){ return new Date().toISOString().slice(0,10); }
 
// ステージ定義(順序が「標準的な流れ」。ただしドラッグは自由)
// ===== カード用アイコン(インラインSVG・モノトーン) =====
// 犬の顔
const ICON_DOG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5 7l1.5-3 3 2.2h5L17.5 4 19 7c1.2 1 1.6 2.6 1.6 4.3 0 4-3.4 7.2-8.6 7.2S3.4 15.3 3.4 11.3C3.4 9.6 3.8 8 5 7z"/>' +
  '<circle cx="9.3" cy="11.2" r="0.6" fill="#3a3a3c" stroke="none"/>' +
  '<circle cx="14.7" cy="11.2" r="0.6" fill="#3a3a3c" stroke="none"/>' +
  '<path d="M12 13.2v1.4M10.6 15.4c.4.4 2.4.4 2.8 0"/>' +
  '</svg>'
);
// カード一覧用の大きめカラー犬アイコン(柴犬風)
const ICON_DOG_COLOR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
  // 耳(垂れ耳・濃い茶)
  '<path d="M9 10 Q6 17 10 25 L17 20 Q12 14 14 9 Z" fill="#b5651d"/>' +
  '<path d="M39 10 Q42 17 38 25 L31 20 Q36 14 34 9 Z" fill="#b5651d"/>' +
  // 顔(明るい茶)
  '<path d="M24 12 C33 12 38 19 38 27 C38 36 31 41 24 41 C17 41 10 36 10 27 C10 19 15 12 24 12 Z" fill="#e8a05a"/>' +
  // 口まわり(白)
  '<ellipse cx="24" cy="31" rx="9" ry="7.5" fill="#fff6ec"/>' +
  // ほお(白)
  '<circle cx="14.5" cy="27" r="4" fill="#fff6ec"/>' +
  '<circle cx="33.5" cy="27" r="4" fill="#fff6ec"/>' +
  // 目
  '<circle cx="18.5" cy="24" r="2.2" fill="#3a2a1a"/>' +
  '<circle cx="29.5" cy="24" r="2.2" fill="#3a2a1a"/>' +
  '<circle cx="19.2" cy="23.3" r="0.7" fill="#fff"/>' +
  '<circle cx="30.2" cy="23.3" r="0.7" fill="#fff"/>' +
  // 鼻
  '<ellipse cx="24" cy="29.5" rx="2.6" ry="2" fill="#2a1a10"/>' +
  // 口
  '<path d="M24 31.5 Q24 34 21 34.5 M24 31.5 Q24 34 27 34.5" stroke="#5a3a20" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
  // 舌
  '<path d="M23 34.5 Q24 37.5 25 34.5 Z" fill="#f288b9"/>' +
  '</svg>'
);
// 車(正面/横)
const ICON_PARK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M4 13l1.6-4.2C5.9 8 6.6 7.5 7.4 7.5h9.2c.8 0 1.5.5 1.8 1.3L20 13"/>' +
  '<path d="M3.5 13h17v4.2c0 .5-.4.8-.8.8h-1.6c-.5 0-.8-.4-.8-.8V17H6.5v.2c0 .5-.4.8-.8.8H4.1c-.5 0-.8-.4-.8-.8V13z"/>' +
  '<circle cx="7" cy="14.6" r="0.7" fill="#3a3a3c" stroke="none"/>' +
  '<circle cx="17" cy="14.6" r="0.7" fill="#3a3a3c" stroke="none"/>' +
  '</svg>'
);
// 駆け付け(ベル)
const ICON_RESCUE = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="4.5" r="2"/><path d="M13.5 8l-3.2 2.3.6 3.7M10.9 14l-2.4 4.5M14.1 13.3l1.4 2.2 3 1.5"/><path d="M13.5 8c1.2-.3 2.6.2 3.3 1.3l1.1 1.7 2.4.4"/><path d="M5 12l2.5-.3"/></svg>');
 
// ===== アイテム用アイコン(SVG) =====
const ITEM_ICON = {
  insurance: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.4c1.1-1.5 3.8-1.4 4.5.6.6 1.8-.9 3.7-4.5 6.1-3.6-2.4-5.1-4.3-4.5-6.1.7-2 3.4-2.1 4.5-.6z" fill="#3a3a3c" stroke="none"/><path d="M2.8 14c1.4-.7 2.6-.4 3.9.7L9 16.6c.5.4 1.1.6 1.7.6h3.6c.5 0 .9.4.9.9s-.4.9-.9.9h-3.9"/><path d="M21.2 14c-1.4-.7-2.6-.4-3.9.7l-1.4 1.1"/><path d="M2.8 13.6v6.4M21.2 13.6v6.4"/></svg>'),
  rescue: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="4.5" r="2"/><path d="M13.5 8l-3.2 2.3.6 3.7M10.9 14l-2.4 4.5M14.1 13.3l1.4 2.2 3 1.5"/><path d="M13.5 8c1.2-.3 2.6.2 3.3 1.3l1.1 1.7 2.4.4"/><path d="M5 12l2.5-.3"/></svg>'),
  electric: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 16.5a6 6 0 1 1 6 0c-.5.4-.8 1-.8 1.7v.3H9.8v-.3c0-.7-.3-1.3-.8-1.7z"/><path d="M9.5 20.5h5M10 22.2h4"/></svg>'),
  invoice: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5h9l3 3V21l-2-1-2 1-2-1-2 1-2-1-2 1V2.5z"/><path d="M8.5 7.5h7M8.5 11h7M8.5 14.5h4"/></svg>'),
  keymail: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6 8.5-6"/></svg>'),
  keyexchange: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="4"/><path d="M11 11l8 8M16 16l2-2M18 18l2-2"/></svg>'),
  car: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13l1.6-4.2C5.9 8 6.6 7.5 7.4 7.5h9.2c.8 0 1.5.5 1.8 1.3L20 13"/><path d="M3.5 13h17v4.2c0 .5-.4.8-.8.8h-1.6c-.5 0-.8-.4-.8-.8V17H6.5v.2c0 .5-.4.8-.8.8H4.1c-.5 0-.8-.4-.8-.8V13z"/><circle cx="7" cy="14.6" r="0.7" fill="#3a3a3c" stroke="none"/><circle cx="17" cy="14.6" r="0.7" fill="#3a3a3c" stroke="none"/></svg>'),
  pet: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="6" cy="10" rx="1.6" ry="2.3"/><ellipse cx="18" cy="10" rx="1.6" ry="2.3"/><ellipse cx="9.5" cy="6.5" rx="1.7" ry="2.4"/><ellipse cx="14.5" cy="6.5" rx="1.7" ry="2.4"/><path d="M12 12.5c-2.4 0-4.3 1.8-4.7 3.6-.3 1.4.8 2.6 2.2 2.4 1-.1 1.7-.5 2.5-.5s1.5.4 2.5.5c1.4.2 2.5-1 2.2-2.4C16.3 14.3 14.4 12.5 12 12.5z"/></svg>'),
  // ===== 完了時に変化するアイコン =====
  // 電気(点灯): 電球から光線が出ている
  electric_on: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15.5a6 6 0 1 1 6 0c-.5.4-.8 1-.8 1.7v.3H9.8v-.3c0-.7-.3-1.3-.8-1.7z" fill="#3a3a3c" stroke="none"/><path d="M9.5 19.5h5M10 21.2h4" stroke="#3a3a3c"/><path d="M12 1.5v1.6M4.7 4.7l1.1 1.1M1.5 12h1.6M22.5 12h-1.6M19.3 4.7l-1.1 1.1"/></svg>'),
  // 鍵交換(ドアが開く): 開いた扉
  keyexchange_open: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21h16"/><path d="M14 21V4.5L5.5 6.5V21"/><path d="M14 4.5L20 3v18"/><circle cx="7.3" cy="13" r="0.7" fill="#3a3a3c" stroke="none"/></svg>'),
  // 鍵渡しメール(送信): 紙飛行機
  keymail_sent: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2.5L11 13"/><path d="M21.5 2.5L15 21l-4-8-8-4 18.5-6.5z"/></svg>'),
  // 駆け付け(直立=未完了): まっすぐ立つ人
  rescue_idle: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2"/><path d="M12 7v8"/><path d="M12 15l-2.5 6M12 15l2.5 6"/><path d="M12 9l-3 1.5M12 9l3 1.5"/></svg>'),
  // 駆け付け(敬礼=完了): 右手を額に当てる人
  rescue_salute: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4.5" r="2"/><path d="M11 7v8"/><path d="M11 15l-2.5 6M11 15l2.5 6"/><path d="M11 9l-3 1.5"/><path d="M11 9c2 0 3.2 1 3.6 2.3l.4 1.2 1.5-1.3"/></svg>'),
  // ===== ステージ由来アイテム(濃色) =====
  send: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L3 11l7 2 2 7z"/><path d="M21 3l-9 10"/></svg>'),
  sret: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l4-4M4 11l4 4M4 11h10a6 6 0 0 1 6 6v2"/></svg>'),
  pay: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.3 9.3h4a1.7 1.7 0 0 1 0 3.4h-2.6a1.7 1.7 0 0 0 0 3.4h4"/></svg>'),
  keyhand: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="4.5"/><path d="M11 11l8 8M15.5 15.5l2-2M18 18l2-2"/></svg>'),
  trophy: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 5H4.5a2.5 2.5 0 0 0 2.5 4M17 5h2.5a2.5 2.5 0 0 1-2.5 4"/><path d="M12 13v3M9 20h6M10 16h4l.5 4h-5z"/></svg>'),
  esign: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h9l4 4v12H5z"/><path d="M13 4v4h4"/><path d="M8 16c2-1 4-3 7-2"/><path d="M14.5 13.5l3-3 1.5 1.5-3 3z"/></svg>'),
  guarantee: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="5.5"/><path d="M6.5 10h11M12 4.5v11" stroke-width="2"/><rect x="4" y="18" width="16" height="2.2" rx="1" fill="#3a3a3c" stroke="none"/></svg>'),
  // ひな形送付済み(法人): 書類+送信
  hinagata: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h7l4 4v6.5"/><path d="M12 3v4h4"/><path d="M5 3v18h7"/><path d="M8 8.5h3M8 12h3M8 15.5h2"/><path d="M21 17l-6 2.2L17 14z"/><path d="M21 17l-4.5 1.6"/></svg>'),
  // AD(広告料): 円マーク付きの札
  ad: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M12 9v6M9.6 10.8h4.8M9.6 13.2h4.8" stroke-width="1.5"/><circle cx="5.5" cy="12" r="0.6" fill="#3a3a3c" stroke="none"/><circle cx="18.5" cy="12" r="0.6" fill="#3a3a3c" stroke="none"/></svg>'),
};
 
// アイテム定義(キー, ラベル, 取得判定関数, クリック時のON/OFF値)
const ITEMS = [
  { key:'insurance',   label:'火災保険',     icon:'insurance',
    got:v => !!v && v!=='-' && v!=='未', on:'完了', off:'',
    cycle:['', '完了', 'ホープ', '他保険'],
    color:v => v==='完了' ? '#f5c000' : (v==='ホープ' ? '#2e9e4f' : (v==='他保険' ? '#9aa0a6' : '#f5c000')),
    note:v => v || '' },
  { key:'rescue',      label:'駆け付け',     icon:'rescue_idle', iconGot:'rescue_salute',
    got:v => v==='完了', on:'完了', off:'',
    cycle:['', '完了', '不要'],
    color:v => v==='不要' ? '#e60012' : '#f5c000',
    note:v => v || '' },
  { key:'electric',    label:'電気',         icon:'electric', iconGot:'electric_on',
    got:v => v==='完了', on:'完了', off:'', note:v => v || '' },
  { key:'invoice',     label:'請求書',       icon:'invoice',
    got:v => !!v && v!=='-' && String(v).trim()!=='', on:'回収', off:'',
    cycle:['', '回収', '要', '不要'],
    color:v => v==='回収' ? '#f5c000' : (v==='不要' ? '#e60012' : (v==='要' ? '#2e9e4f' : '#f5c000')),
    note:v => v || '' },
  { key:'keyMail',     label:'鍵渡しメール', icon:'keymail', iconGot:'keymail_sent',
    got:v => v==='完了', on:'完了', off:'', note:v => v || '' },
  { key:'keyExchange', label:'鍵交換',       icon:'keyexchange', iconGot:'keyexchange_open',
    got:v => !!v && String(v).trim()!=='', on:'済', off:'', note:v => v || '' },
  { key:'pet',         label:'ペット',       icon:'pet',
    got:v => !!v && v!=='なし' && v!=='無' && String(v).trim()!=='', auto:true,
    color:v => '#f5c000', note:v => 'あり' },
  { key:'sendDate',    label:'契約書送付',   icon:'send',
    got:v => v==='完了', on:'完了', off:'', note:v => v || '' },
  { key:'esignDate',   label:'電子署名',     icon:'esign',
    got:v => v==='完了', on:'完了', off:'', note:v => v || '' },
  { key:'returnDate',  label:'契約書返送',   icon:'sret',
    got:v => v==='完了', on:'完了', off:'', note:v => v || '' },
  { key:'guaranteeDate', label:'保証電子印', icon:'guarantee',
    got:v => v==='完了', on:'完了', off:'', note:v => v || '' },
  { key:'paymentDate', label:'入金',         icon:'pay',
    got:v => v==='完了', on:'完了', off:'', note:v => v || '' },
  { key:'keyHandover', label:'鍵渡し',       icon:'keyhand',
    got:v => v==='完了', on:'完了', off:'', note:v => v || '' },
  { key:'hinagata',    label:'ひな形送付済み', icon:'hinagata',
    corpOnly:true, got:v => v==='完了', on:'完了', off:'', note:v => v || '' },
  { key:'ad',          label:'AD',           icon:'ad', displayOnly:true,
    got:v => { const n = adValue(v); return n > 0; },
    cycle:['0','50','100','150','200','250','300'],
    color:v => (adValue(v) > 0 ? '#0d9488' : '#9aa0a6'),
    note:v => 'AD' + adValue(v) + '%' },
];
// AD値を取り出す。未設定(空/undefined/null)は既定 100 とみなす。明示的な '0' は 0。
function adValue(v){
  if(v === undefined || v === null || v === '') return 100;
  const n = Number(v);
  return isNaN(n) ? 100 : n;
}
function itemGot(c, item){ return item.got(c[item.key]); }
// 法人専用アイテムか(corpOnly)を、契約種別に応じて表示対象とするか判定
function itemApplies(c, item){ return item.corpOnly ? ((c && c.type) === '法人') : true; }
// 達成数・完了判定に使うアイテム(displayOnly=表示専用アイテムは除外)
function applicableItems(c){ return ITEMS.filter(it => itemApplies(c, it) && !it.displayOnly); }
// 詳細画面のアイテム描画に使う一覧(displayOnlyも含む)
function displayItems(c){ return ITEMS.filter(it => itemApplies(c, it)); }
// 日付記録項目(同じ仕様: クリックで色と日付)
const DATE_ITEMS = [
  { key:'esignDate',     label:'電子署名',   icon:'esign' },
  { key:'guaranteeDate', label:'保証電子印', icon:'guarantee' },
];
// アイテムの取得時の色(color関数があればそれ、なければ既定の黄)
function itemColor(c, item){
  if(!itemGot(c, item)) return null;
  return (item.color ? item.color(c[item.key]) : '#f5c000');
}
// hex色を半透明rgbaに(背景用)
function hexA(hex, a){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}
 
// ===== ステージ用アイコン(SVG・白線/色背景に乗せる) =====
function stageIcon(svg){ return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg); }
const STAGE_ICON = {
  apply: stageIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M13 3v4h4"/><path d="M9 12h6M9 15.5h4"/></svg>'),
  cdate: stageIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/><path d="M9 14l2 2 4-4"/></svg>'),
  send: stageIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L3 11l7 2 2 7z"/><path d="M21 3l-9 10"/></svg>'),
  return: stageIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l4-4M3 11l4 4M3 11h10a6 6 0 0 1 6 6v2"/></svg>'),
  pay: stageIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.3 9.3h4a1.7 1.7 0 0 1 0 3.4h-2.6a1.7 1.7 0 0 0 0 3.4h4"/></svg>'),
  key: stageIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="4.5"/><path d="M11 11l8 8M15.5 15.5l2-2M18 18l2-2"/></svg>'),
  done: stageIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 5H4.5a2.5 2.5 0 0 0 2.5 4M17 5h2.5a2.5 2.5 0 0 1-2.5 4"/><path d="M12 13v3M9 20h6M10 16h4l.5 4h-5z"/></svg>'),
};
 
// ===== 日付記録用アイコン(SVG) =====
const DATE_ICON = {
  send: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L3 11l7 2 2 7z"/><path d="M21 3l-9 10"/></svg>'),
  esign: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h9l4 4v12H5z"/><path d="M13 4v4h4"/><path d="M8 16c2-1 4-3 7-2"/><path d="M14.5 13.5l3-3 1.5 1.5-3 3z"/></svg>'),
  return: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l4-4M4 11l4 4M4 11h10a6 6 0 0 1 6 6v2"/><rect x="14" y="4" width="6" height="6" rx="1"/><path d="M15.5 6h3M15.5 7.5h2"/></svg>'),
  guarantee: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="5.5" fill="#fff"/><path d="M6.5 10h11M12 4.5v11" stroke-width="2"/><rect x="4" y="18" width="16" height="2.2" rx="1" fill="#3a3a3c"/></svg>'),
  handover: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="9" r="3.5"/><path d="M10.5 9h9M15 9v2.5M18 9v2"/><path d="M5 16c2 2 6 3 9 1l4-2"/></svg>'),
  payment: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M9 10l3 3 3-3M9 14h6M9.5 16h5"/></svg>'),
};
 
const STAGES = [
  {key:'申込',         name:'申込',        emoji:'📥', icon:'apply',  color:'#8e8e93'},
  {key:'契約日確定',   name:'契約日確定',  emoji:'📅', icon:'cdate',  color:'#5856d6'},
  {key:'契約書送付',   name:'契約書送付',  emoji:'📤', icon:'send',   color:'#007aff'},
  {key:'契約書返送',   name:'契約書返送',  emoji:'📥', icon:'return', color:'#5ac8fa'},
  {key:'入金',         name:'入金',        emoji:'💰', icon:'pay',    color:'#ff9500'},
  {key:'鍵渡し',       name:'鍵渡し',      emoji:'🔑', icon:'key',    color:'#af52de'},
  {key:'完了',         name:'完了',        emoji:'✅', icon:'done',   color:'#34c759'}
];
function stageIndex(key){ return STAGES.findIndex(s => s.key === key); }
 
let _editingId = null;
let _editingType = '個人';
let _editingWarn = 0;
let _editingReached = {}; // 編集中のステージ到達記録
let _editingItemDates = {}; // 編集中のアイテム取得日
let _editingItemValues = {}; // 編集中のアイテム値(プルダウン廃止のため内部で保持)
let _editingDateValues = {}; // 編集中の日付項目の値(YYYY-MM-DD or 自由文字)
let _draggingId = null;
let _sortMode = 'manual'; // 'manual' | 'kana' | 'defect' | 'cdate'
let _defectFilter = '';   // 手入力: 特定の不備項目で絞り込み
/* 上の件数バーを押したときの、しぼり込み。'' なら全件 */
let _statFilter = '';
/* 契約日まであと何日か。未入力なら null（過去はマイナス） */
function daysToContract(c){
  const m = String(c && c.contractDate || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if(!m) return null;
  const d = new Date(+m[1], +m[2]-1, +m[3]);
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.round((d - t) / 86400000);
}
/* 契約日間近 = 契約日の10日前から当日まで（完了タブへ移したものは除く） */
function isNearContract(c){
  if(!c || c.archived) return false;
  const n = daysToContract(c);
  return n !== null && n >= 0 && n <= 10;
}
/* 件数バーのしぼり込みに合うかどうか */
function matchStatFilter(c){
  switch(_statFilter){
    case '':         return true;
    case 'all':      return true;
    case 'near':     return isNearContract(c);
    case 'defect':
    case 'progress':
    case 'almost':   return cardStatus(c) === _statFilter;
  }
  return true;
}
function setStatFilter(k){
  _statFilter = (_statFilter === k) ? '' : (k || '');   // 同じ所を押したら解除
  renderBoard();
  renderStats();
}
 
// ====== レンダリング ======
// CSVで保管済みの年（この年の完了は件数から外す）
function archivedYears(){
  try { return JSON.parse(localStorage.getItem((typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + 'csv_archived_years') || '[]'); }
  catch(e){ return []; }
}
function markYearArchived(y){
  const a = archivedYears();
  if(!a.includes(String(y))) a.push(String(y));
  localStorage.setItem((typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + 'csv_archived_years', JSON.stringify(a));
}
// 完了した年（完了タブへ移した日→契約日→申込日の順で判定）
function doneYearOf(c){
  const d = c.archivedAt || c.contractDate || c.applyDate || '';
  const m = String(d).match(/^(\d{4})/);
  return m ? m[1] : '';
}
/* いまの年（1月〜12月で数えます） */
function currentCountYear(){
  return String(new Date().getFullYear());
}
 
// 起動時に「一覧表示／カード表示」の文言をそろえる
function syncViewBtn(){
  const b = document.getElementById('btn-view');
  if(!b) return;
  b.textContent = (_viewMode === 'list') ? 'カード表示' : '一覧表示';
  b.classList.toggle('on', _viewMode === 'list');
}
 
function renderStats(){
  const list = Object.values(loadAll());
  const active = list.filter(c => !c.archived);
  // 登録＝進行中のみ（完了タブへ移したものは含めない）
  const total = active.length;
  // カードの状態色で集計(cardStatusと一致させる)
  const defect   = active.filter(c => cardStatus(c) === 'defect').length;
  const progress = active.filter(c => cardStatus(c) === 'progress').length;
  const almost   = active.filter(c => cardStatus(c) === 'almost').length;
  /* 完了 = 完了タブへ移動済みのうち、今年ぶん（1月〜12月）。
   * 年が替わるまでは、CSVで保管しても件数から消えません。
   * 前年以前のぶんは、年が替わった時点で自動的に外れます。
   * （データは残っているので、完了タブの年の欄に入力すれば見られます） */
  const nowY = currentCountYear();
  const complete = list.filter(c => c.archived && doneYearOf(c) === nowY).length;
  const near = active.filter(isNearContract).length;
  const stats = [
    {lbl:'登録',       num:total,    cls:'',        k:'all'},
    {lbl:'不備あり',   num:defect,   cls:'warn',    k:'defect'},
    {lbl:'進行中',     num:progress, cls:'accent',  k:'progress'},
    {lbl:'もうすぐ',   num:almost,   cls:'almost',  k:'almost'},
    {lbl:'契約日間近', num:near,     cls:'near',    k:'near'},
    {lbl:'完了',       num:complete, cls:'success', k:'done'}
  ];
  /* 押すと、その状態のカードだけを出す。もう一度押すと全件に戻る。
     「完了」だけは今までどおり完了タブを開く。 */
  document.getElementById('stats-bar').innerHTML = stats.map(s => {
    const isDoneCol = (s.k === 'done');
    const on = (!isDoneCol && _statFilter === s.k) ? ' on' : '';
    const click = isDoneCol ? 'KB.openDoneModal()' : ("KB.setStatFilter('" + s.k + "')");
    return '<div class="stat-pill clickable ' + s.cls + on + '" onclick="' + click + '"'
      + ' title="' + (isDoneCol ? '完了タブを開きます' : 'ここだけを表示（もう一度押すと全件）') + '">'
      + '<span class="num">' + s.num + '</span>'
      + '<span class="lbl">' + s.lbl + (isDoneCol ? ' \u25B8' : '') + '</span></div>';
  }).join('');
  drawArchiveNotice();
  syncViewBtn();
}
 
/* =========================================================
 *  年をまたいだ完了ぶんの保管をうながす案内
 * ======================================================= */
function pendingArchiveYear(){
  const nowY = currentCountYear();
  const done = archivedYears();
  const years = new Set();
  Object.values(loadAll()).forEach(c => {
    if(!c.archived) return;
    const y = doneYearOf(c);
    if(y && y < nowY && !done.includes(y)) years.add(y);
  });
  return Array.from(years).sort()[0] || '';   // 古い年から順に片付ける
}
function drawArchiveNotice(){
  const y = pendingArchiveYear();
  let bar = document.getElementById('arch-notice');
  if(!y){ if(bar) bar.remove(); return; }
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'arch-notice';
    bar.className = 'arch-notice';
    const host = document.getElementById('stats-bar');
    if(host && host.parentNode) host.parentNode.insertBefore(bar, host);
    else document.body.insertBefore(bar, document.body.firstChild);
  }
  const n = Object.values(loadAll()).filter(c => c.archived && doneYearOf(c) === y).length;
  bar.innerHTML =
    '<div class="an-t"><b>' + y + '年の完了ぶん ' + n + '件 が残っています。</b>'
    + 'CSVをダウンロードしてデータ保管してください。</div>'
    + '<button class="an-btn" onclick="KB.archiveYearCsv(\'' + y + '\')">' + y + '年のCSVを保存して片付ける</button>';
}
// その年の完了ぶんをCSVで書き出し、完了件数から外す
function archiveYearCsv(y){
  const list = Object.values(loadAll()).filter(c => c.archived && doneYearOf(c) === y);
  if(!list.length){ markYearArchived(y); renderStats(); return; }
  const head = ['完了日','物件','部屋','契約者','種別','仲介業者','担当者','契約日','申込日','状況','メモ'];
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"';
  const rows = list.map(c => [
    (c.archivedAt||'').slice(0,10), c.property||'', c.room||'', c.contractor||'',
    c.type==='法人' ? '法人' : '個人', c.broker||'', c.staff||'',
    c.contractDate||'', c.applyDate||'', c.dealStatus||'', (c.memo||'').replace(/\r?\n/g,' ')
  ].map(q).join(','));
  const csv = '\uFEFF' + head.map(q).join(',') + '\n' + rows.join('\n') + '\n';
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url; a.download = 'PIVOT完了契約_' + y + '年.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if(!confirm(y + '年の完了ぶん ' + list.length + '件 をCSVで保存しました。\n\n保管を済ませたものとして、案内を消してよろしいですか？\n※契約データは消えません。')) return;
  markYearArchived(y);
  renderStats();
  toast(y + '年ぶんを保管済みにしました');
}
 
function renderBoard(){
  const all = loadAll();
  const search = (document.getElementById('kb-search').value || '').trim().toLowerCase();
  // 検索しているときは、完了タブへ移したぶんも探せるようにする
  let list = Object.values(all).filter(c => search ? true : !c.archived);
  if(search){
    list = list.filter(c => ((c.property||'') + ' ' + (c.contractor||'') + ' ' + (c.staff||'') + ' ' + (c.broker||'')).toLowerCase().includes(search));
    // 進行中を先に、完了は後ろへ
    list.sort((a,b) => (a.archived?1:0) - (b.archived?1:0));
  }
  // 件数バーのしぼり込み（登録/不備あり/進行中/もうすぐ/契約日間近）
  if(_statFilter && _statFilter !== 'all'){
    list = list.filter(matchStatFilter);
  }
  // 不備の手入力フィルタ: 入力した項目が不足しているカードだけ表示
  if(_defectFilter){
    const q = _defectFilter.trim();
    if(q){ list = list.filter(c => missingLabels(c).some(m => m.includes(q) || q.includes(m))); }
  }
  const board = document.getElementById('board');
  if(list.length === 0){
    board.innerHTML = '<div class="empty-grid">契約がありません。「＋ 新規」から登録してください。</div>';
    return;
  }
  // 整列モード: 五十音順 / 不備順 / 契約日順 / 手動(保存順)
  if(_sortMode === 'kana'){
    list.sort((a,b) => (a.property||'').localeCompare((b.property||''), 'ja'));
    paintBoard(board, list);
    bindCardDrag();
    return;
  }
  if(_sortMode === 'defect'){
    list.sort((a,b) => {
      const da = damageLevel(b) - damageLevel(a);            // 破損レベル高い順
      if(da !== 0) return da;
      const ra = (contractProgress(a).done) - (contractProgress(b).done); // 達成数少ない順
      if(ra !== 0) return ra;
      return (a.property||'').localeCompare(b.property||'');
    });
    paintBoard(board, list);
    bindCardDrag();
    return;
  }
  if(_sortMode === 'cdate'){
    const key = c => {
      const m = String(c.contractDate||'').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
      return m ? (m[1] + m[2].padStart(2,'0') + m[3].padStart(2,'0')) : '99999999'; // 未入力は最後
    };
    list.sort((a,b) => {
      const ka = key(a), kb = key(b);
      if(ka !== kb) return ka.localeCompare(kb);             // 契約日が早い順
      return (a.property||'').localeCompare(b.property||'');
    });
    paintBoard(board, list);
    bindCardDrag();
    return;
  }
  // 保存された並び順(order)で表示。orderが無いものは後ろ。
  list.sort((a,b) => {
    const oa = (typeof a.order === 'number') ? a.order : 1e9;
    const ob = (typeof b.order === 'number') ? b.order : 1e9;
    if(oa !== ob) return oa - ob;
    return (a.updatedAt||'').localeCompare(b.updatedAt||'');
  });
  paintBoard(board, list);
  bindCardDrag();
}
 
// 現在到達している最終ステージのインデックスを返す
function currentStageIndex(c){
  const reached = c.stageReached || {};
  let idx = -1;
  STAGES.forEach((s, i) => { if(reached[s.key]) idx = i; });
  // 到達記録がなければ stage プロパティから推定
  if(idx < 0){ idx = Math.max(0, stageIndex(c.stage || '申込')); }
  return idx;
}
 
// 残タスク(まだ到達していないステージ)を計算
function getRemainingStages(c){
  const reached = c.stageReached || {};
  return STAGES.filter(s => !reached[s.key] && s.key !== (c.stage||'申込'));
}
function getReachedStages(c){
  const reached = c.stageReached || {};
  return STAGES.filter(s => reached[s.key]);
}
 
// 進捗の段階定義(基本情報の日付 + アイテム化したステージ)
const PROGRESS_STEPS = [
  { key:'applyDate',    name:'申込',       color:'#8e8e93', done:c => !!c.applyDate },
  { key:'contractDate', name:'契約日確定', color:'#5856d6', done:c => !!c.contractDate },
  { key:'sendDate',     name:'契約書送付', color:'#007aff', done:c => c.sendDate==='完了' },
  { key:'returnDate',   name:'契約書返送', color:'#5ac8fa', done:c => c.returnDate==='完了' },
  { key:'paymentDate',  name:'入金',       color:'#ff9500', done:c => c.paymentDate==='完了' },
  { key:'keyHandover',  name:'鍵渡し',     color:'#af52de', done:c => c.keyHandover==='完了' },
];
// 基本情報7項目の達成判定(駐車場は不要でも達成)
const BASIC_KEYS = ['applyDate','type','contractDate','property','contractor','broker','parking'];
function basicDone(c, key){
  switch(key){
    case 'applyDate':    return !!c.applyDate;
    case 'contractDate': return !!c.contractDate;
    case 'type':         return !!c.type;
    case 'property':     return !!(c.property && String(c.property).trim());
    case 'contractor':   return !!(c.contractor && String(c.contractor).trim());
    case 'broker':       return !!(c.broker && String(c.broker).trim());
    case 'parking':      return true;   // 不要(空)でも達成扱い
  }
  return false;
}
function basicInfoComplete(c){
  return BASIC_KEYS.every(k => basicDone(c, k));
}
// 基本項目のラベル(手入力フィルタ用)
const BASIC_LABELS = { applyDate:'申込日', type:'種別', contractDate:'契約日', property:'物件名', contractor:'契約者', broker:'仲介', parking:'駐車場' };
// このカードで不足している項目名の一覧を返す
function missingLabels(c){
  const out = [];
  BASIC_KEYS.forEach(k => { if(!basicDone(c, k)) out.push(BASIC_LABELS[k] || k); });
  applicableItems(c).forEach(it => {
    if(it.key === 'pet') return;          // ペットは任意
    if(!itemGot(c, it)) out.push(it.label);
  });
  return out;
}
// 達成数 / 合計(基本情報7 + 獲得アイテム ※法人時はひな形送付済みを含む)
function contractProgress(c){
  const applicable = applicableItems(c);
  const basic = BASIC_KEYS.filter(k => basicDone(c, k)).length;
  const items = applicable.filter(it => (it.key === 'pet') ? true : itemGot(c, it)).length;
  return { done: basic + items, total: BASIC_KEYS.length + applicable.length };
}
// 全項目完了で「完了」
function isContractComplete(c){
  if(!basicInfoComplete(c)) return false;
  for(const it of applicableItems(c)){
    if(it.key === 'pet') continue;
    if(!itemGot(c, it)) return false;
  }
  return true;
}
// カードの状態色: complete(青) / defect(赤・基本情報未完了) / almost(緑 17〜19) / progress(紫 16以下)
// マンスリー区分かどうか
function isMonthly(c){ return !!(c && c.dealStatus === 'monthly'); }
function cardStatus(c){
  if(isCancelStatus(c)) return 'cancel';
  if(isContractComplete(c)) return 'complete';
  if(isMonthly(c)) return 'monthly';
  if(!basicInfoComplete(c)) return 'defect';
  const done = contractProgress(c).done;
  if(done >= 17) return 'almost';
  return 'progress';
}
// カードのプルダウンで選べる状況(7段階) + 自動表示(ひな形送付済み)
//  申込/審査中/審査完了/条件確認中/契約書類作成中/契約書類作成完了/キャンセル・審査落ち
//  ひな形送付済み(hinagata)は法人でアイテム取得時に自動表示(手動選択肢には出さない)
const DEAL_STATUSES = [
  { key:'apply',      label:'申込',             text:'#3a3a3c', bg:'#e8e8ec', tone:'progress' },
  { key:'screening',  label:'審査中',           text:'#9a5b00', bg:'#ffe9c7', tone:'progress' },
  { key:'screen_ok',  label:'審査完了',         text:'#1f7a3d', bg:'#d8f3e2', tone:'progress' },
  { key:'condition',  label:'条件確認中',       text:'#0a6e8e', bg:'#d4f0fb', tone:'progress' },
  { key:'doc_making', label:'契約書類作成中',   text:'#3b39b5', bg:'#e4e3fb', tone:'progress' },
  { key:'doc_done',   label:'契約書類作成完了', text:'#7a2fa6', bg:'#f0e1fa', tone:'progress' },
  { key:'monthly',    label:'マンスリー',       text:'#0a5a9e', bg:'#d4e8fb', tone:'monthly' },
  { key:'cancel',     label:'キャンセル',       text:'#5b626b', bg:'#e4e6ea', tone:'cancel' },
  { key:'rejected',   label:'審査落ち',         text:'#7a3a3a', bg:'#ecdede', tone:'cancel' },
];
// 手動選択肢(プルダウンに出す順)
const DEAL_MENU = DEAL_STATUSES;
// 自動状況: ひな形送付済み(法人 + 取得)
function autoHinagata(c){
  if(!c || c.type !== '法人') return false;
  const it = ITEMS.find(x => x.key === 'hinagata');
  return it ? itemGot(c, it) : false;
}
function dealStatusDef(key){
  if(key === 'hinagata') return { key:'hinagata', label:'ひな形送付済み', text:'#15703a', bg:'#d8f3e2', tone:'progress' };
  return DEAL_STATUSES.find(s => s.key === key) || null;
}
// キャンセル・審査落ち(グレー扱い)かどうか
function isCancelStatus(c){ return !!(c && (c.dealStatus === 'cancel' || c.dealStatus === 'rejected')); }
// プルダウン/カードに表示すべき状況キーを決定
function dropdownStatus(c){
  if(isCancelStatus(c)) return c.dealStatus;   // 'cancel' or 'rejected'
  if(isContractComplete(c)) return 'complete';
  // ユーザーが申込以外の段階を手動選択していれば、それを最優先で尊重する
  if(c && c.dealStatus && c.dealStatus !== 'apply' && dealStatusDef(c.dealStatus)){
    return c.dealStatus;
  }
  // 手動指定が無い(または申込のまま)で、法人かつひな形取得済みなら自動表示
  if(autoHinagata(c)) return 'hinagata';
  if(c && c.dealStatus){
    if(dealStatusDef(c.dealStatus)) return c.dealStatus;
  }
  return 'apply';
}
const STATUS_COLOR = { complete:'#f5b400', defect:'#e60012', almost:'#34c759', progress:'#8e44d8', cancel:'#9aa1aa', monthly:'#1a7fd4' };
function progressCurrentIndex(c){
  let idx = -1;
  PROGRESS_STEPS.forEach((s, i) => { if(s.done(c)) idx = i; });
  return idx;
}
// 契約確定日をカードに大きく表示
function cdateHtml(c){
  if(!c.contractDate) return '';
  const m = String(c.contractDate).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if(!m) return '<div class="ct-cdate"><span class="cd-label">契約日</span><span class="cd-md">' + esc(c.contractDate) + '</span></div>';
  const y = m[1], mo = m[2].padStart(2,'0'), d = m[3].padStart(2,'0');
  return '<div class="ct-cdate"><span class="cd-label">契約日</span>' +
    '<span class="cd-value">' + mo + '/' + d + '</span>' +
    '<span class="cd-md">' + y + '</span></div>';
}
 
// 破損レベル: 不備あり=3, 進行度で 2→1→0(完了) へ修復
function damageLevel(c){
  if(isContractComplete(c)) return 0;
  if(!basicInfoComplete(c)) return 3;
  const prog = contractProgress(c);
  const ratio = prog.done / prog.total;
  if(ratio >= 0.85) return 1;
  return 2;
}
// 整列モードの設定
function setSortMode(mode){
  _sortMode = mode || 'manual';
  updateSortButtons();
  renderBoard();
}
// メインボタンを押すと手動(解除)に戻すショートカット
function cycleSortNone(){ setSortMode('manual'); }
// 不備の手入力フィルタ
function onDefectFilter(v){
  _defectFilter = v || '';
  const btn = document.getElementById('btn-sort');
  if(btn) btn.classList.toggle('active', _defectFilter.trim() !== '' || _sortMode !== 'manual');
  renderBoard();
}
function updateSortButtons(){
  const labels = { kana:'整列中(五十音)', defect:'整列中(不備順)', cdate:'整列中(契約日)', manual:'整列' };
  const btn = document.getElementById('btn-sort');
  if(btn){
    const active = _sortMode !== 'manual';
    btn.classList.toggle('active', active);
    btn.textContent = (labels[_sortMode] || '整列');
  }
  document.querySelectorAll('.sort-opt').forEach(o => {
    o.classList.toggle('active', o.dataset.mode === _sortMode);
  });
}
/* =========================================================
 *  表示の切り替え（カード／一覧）
 * ======================================================= */
let _viewMode = (function(){ try{ return localStorage.getItem((typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + 'view_mode') || 'card'; }catch(e){ return 'card'; } })();
function setViewMode(m){
  _viewMode = (m === 'list') ? 'list' : 'card';
  try{ localStorage.setItem((typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + 'view_mode', _viewMode); }catch(e){}
  const b = document.getElementById('btn-view');
  if(b){ b.textContent = (_viewMode === 'list') ? 'カード表示' : '一覧表示'; b.classList.toggle('on', _viewMode === 'list'); }
  renderBoard();
}
function toggleViewMode(){ setViewMode(_viewMode === 'list' ? 'card' : 'list'); }
 
function paintBoard(board, list){
  if(_viewMode === 'list'){ board.innerHTML = renderListView(list); return; }
  board.innerHTML = '<div class="contract-grid" id="contract-grid">' + list.map(c => renderCard(c)).join('') + '</div>';
}
 
// 列（テーブル）で表示する
function renderListView(list){
  const row = c => {
    const st = cardStatus(c);
    const prog = contractProgress(c);
    const lbl = c.archived ? '完了タブ'
      : (st === 'defect' ? '不備あり' : st === 'almost' ? 'もうすぐ' : st === 'complete' ? '完了' : '進行中');
    const cls = c.archived ? 'arch' : st;
    const roomNo = c.room ? String(c.room).replace(/^P/i,'') : '';
    const pct = Math.round(prog.done / prog.total * 100);
    /* いま何が足りなくて、この状態なのか。missingLabels() は既存の関数。 */
    const miss = c.archived ? [] : missingLabels(c);
    const missHtml = miss.length
      ? miss.map(m => '<span class="lv-miss-tag">' + esc(m) + '</span>').join('')
      : '<span class="lv-miss-ok">\u2713 そろっています</span>';
    /* 契約日まで何日か。10日前から当日までは目立たせる */
    const dleft = daysToContract(c);
    const dueHtml = (!c.archived && dleft !== null && dleft >= 0 && dleft <= 10)
      ? '<span class="lv-due">\u3042\u3068' + dleft + '\u65E5</span>'
      : '';
    return '<tr class="lv-row ' + cls + '" onclick="KB.onCardClick(event,\'' + c.id + '\')">'
      + '<td class="lv-st"><span class="lv-badge ' + cls + '">' + lbl + '</span></td>'
      + '<td class="lv-prop"><b>' + esc(c.property || '(物件未入力)') + '</b>'
        + (c.tou ? ' <span class="lv-sub">' + esc(c.tou) + '棟</span>' : '')
        + (roomNo ? ' <span class="lv-sub">' + esc(roomNo) + '号</span>' : '')
        + (c.parking ? ' <span class="lv-sub">P' + esc(String(c.parking).replace(/^P[-\s]?/i,'')) + '</span>' : '')
      + '</td>'
      + '<td>' + esc(c.contractor || '') + '</td>'
      + '<td class="lv-c">' + ((c.type === '法人') ? '法人' : '個人') + '</td>'
      + '<td>' + esc(c.broker || '') + '</td>'
      + '<td>' + esc(c.staff || '') + '</td>'
      + '<td class="lv-c">' + (c.contractDate ? esc(c.contractDate.replace(/-/g,'/')) : '\u2014')
        + dueHtml + '</td>'
      + '<td class="lv-prog"><span class="lv-bar"><i style="width:' + pct + '%"></i></span>'
        + '<span class="lv-num">' + prog.done + '/' + prog.total + '</span></td>'
      + '<td class="lv-miss">' + missHtml + '</td>'
      + '</tr>';
  };
  return '<div class="lv-wrap"><table class="lv-table">'
    + '<thead><tr><th>状態</th><th>物件</th><th>契約者</th><th>種別</th>'
    + '<th>仲介業者</th><th>担当</th><th>契約日</th><th>進捗</th>'
    + '<th class="lv-miss-h">不備（足りていない項目）</th></tr></thead>'
    + '<tbody>' + list.map(row).join('') + '</tbody></table></div>';
}
 
function renderCard(c){
  const curIdx = progressCurrentIndex(c);
  const cur = PROGRESS_STEPS[curIdx] || PROGRESS_STEPS[0];
  const isDone = isContractComplete(c);
  const status = cardStatus(c);
  const accent = STATUS_COLOR[status];
  const prog = contractProgress(c);
  const doneCount = prog.done, totalCount = prog.total;
 
  // 進捗バー(20分割は細かいので、達成割合で塗る6セグメント表示)
  const ratio = doneCount / totalCount;
  const segHtml = Array.from({length:6}).map((_, i) => {
    const on = (i < Math.round(ratio * 6));
    return '<span class="prog-seg' + (on ? ' on' : '') + '"' + (on ? ' style="background:' + accent + ';"' : '') + '></span>';
  }).join('');
 
  // タイトル
  const roomNo = c.room ? String(c.room).replace(/^P/i, '') : '';
  const pkg = c.parking ? String(c.parking) : '';
  let titleLine = '<span class="t-prop">' + esc(c.property || '(物件未入力)') + '</span>';
  if(c.tou) titleLine += '<span class="t-room">' + esc(c.tou) + '棟</span>';
  if(roomNo) titleLine += '<span class="t-room">' + esc(roomNo) + '号</span>';
  if(pkg) titleLine += '<span class="t-park">P' + esc(pkg.replace(/^P[-\s]?/i,'')) + '</span>';
 
  // 駐車場(P区画)があるのに、まだ物件管理の区画へ紐づけていない場合は警告する
  // (キャンセル・審査落ち・完了移動済みは対象外)
  let notLinked = false;
  if(pkg && !c.archived && status !== 'cancel'){
    try{
      const info = { contractor: c.contractor, carContractor: c.carContractor, srcKey: c.id, property: c.property, parking: c.parking };
      const linked = (typeof window.PV_hasReservation === 'function') ? window.PV_hasReservation(info) : true;
      notLinked = !linked;
    }catch(e){ notLinked = false; }
  }
  const notLinkedBadge = notLinked
    ? '<div class="ct-notlinked" title="この契約は駐車場区画にまだ紐づけられていません。カードを開いて「🅿 紐づけ」を押してください。">⚠ 駐車場 未紐づけ</div>'
    : '';
 
  const curName = (curIdx < 0) ? '未着手' : cur.name;
  const statusLabel = isDone ? '✓ 完了' : (status==='defect' ? '基本情報不備あり' : (status==='almost' ? 'もうすぐ完了' : '進行中'));
 
  const isCancel = (status === 'cancel');
  const moveBtn = ((isDone || isCancel) && !c.archived)
    ? '<button class="ct-move-done' + (isCancel ? ' ct-move-done-gray' : '') + '" onclick="KB.moveToDone(event,\'' + c.id + '\')">完了タブへ移動 ▸</button>'
    : '';
  // キャンセル・審査落ちカードには「申込に戻す」ボタン(復活用)
  const revertBtn = (isCancel && !c.archived)
    ? '<button class="ct-revert" onclick="KB.revertToApply(event,\'' + c.id + '\')">↩ 申込に戻す</button>'
    : '';
 
  // 状況プルダウン。法人のときは「ひな形送付済み」を選択肢に追加する。
  const ddStatus = dropdownStatus(c);
  const isCorp = (c && c.type === '法人');
  // 表示色を決定(文字は濃色で見やすく、背景は淡色)
  let ddColor, ddBg, ddLabel, ddIsAuto = false;
  if(ddStatus === 'complete'){ ddColor = '#8a6500'; ddBg = '#fff0bf'; ddLabel = '完了'; ddIsAuto = true; }
  else if(ddStatus === 'hinagata'){ ddColor = '#15703a'; ddBg = '#d8f3e2'; ddLabel = 'ひな形送付済み'; }
  else {
    const def = dealStatusDef(ddStatus) || DEAL_STATUSES[0];
    ddColor = def.text;        // 濃い文字色
    ddBg = def.bg;             // 淡い背景色
    ddLabel = def.label;
  }
  // 選択肢: 法人なら「契約書類作成完了」の後に「ひな形送付済み」を差し込む
  const menuItems = [];
  DEAL_MENU.forEach(s => {
    menuItems.push(s);
    if(isCorp && s.key === 'condition'){
      menuItems.push({ key:'hinagata', label:'ひな形送付済み' });
    }
  });
  const menuOpts = menuItems.map(s =>
    '<option value="' + s.key + '"' + (ddStatus === s.key ? ' selected' : '') + '>' + s.label + '</option>'
  ).join('');
  // 完了は自動表示専用(手動選択肢に無い)。その場合だけ先頭にダミー表示。
  const autoOpt = ddIsAuto
    ? '<option value="__auto" selected disabled>' + ddLabel + '</option>'
    : '';
  const statusSelect =
    '<select class="ct-status-select" ' +
    'style="color:' + ddColor + ';background-color:' + ddBg + ';border-color:' + ddColor + ';"' +
    ' onclick="event.stopPropagation();"' +
    ' onchange="KB.onCardStatusChange(event,\'' + c.id + '\')"' +
    ' title="この契約の状況を切り替えます">' +
      autoOpt +
      menuOpts +
    '</select>';
  // ステータスを切り替えた日（自動記録）を、「ひな形送付済み」のときだけバッジの横に表示（年なし）
  // ステータスを切り替えた日を、どのステータスでもバッジの上に表示（年なし）
  // 既存カードは切替日が未記録なので、最終更新日から補う（タップで直せます）
  const ddDate = c.dealStatusDate || String(c.updatedAt || '').slice(0, 10) || '';
  const ddDateHtml = ddDate
    ? '<span class="ct-status-date" style="color:' + ddColor + ';cursor:pointer;" title="タップで日付だけ変更" onclick="event.stopPropagation();KB.promptStatusDate(\'' + c.id + '\')">' +
        '<span class="ct-status-date-arrow">📅</span>' +
        esc(String(ddDate).replace(/^\d{4}-/, '').replace('-', '/')) +
        '<span class="ct-status-date-edit">✎</span>' +
      '</span>'
    : '';
  const statusBox = '<div class="ct-status-box">' + ddDateHtml + statusSelect + '</div>';
 
  // 個人/法人の横に出す AD 表示（未設定は既定100%。ティール色で目立たせる）
  const adNum = adValue(c.ad);
  const adCls = (adNum === 0) ? ' ad-zero' : (adNum === 200) ? ' ad-200' : (adNum === 300) ? ' ad-300' : '';
  const adText = (adNum === 0) ? 'ADなし' : ('AD' + esc(String(adNum)) + '%');
  const adLabelHtml = '<span class="ct-ad-label' + adCls + '">' + adText + '</span>';
 
  var _touch = ('ontouchstart' in window);
 　  // 契約日がまだ来ていないものは、カードを薄い緑にします（ct-future）
  const _dtc = daysToContract(c);
  const isFuture = (_dtc !== null && _dtc > 0 && !isDone && !c.archived);
  return '<div class="ct-card status-' + status + (isDone ? ' done' : '') + (c.archived ? ' archived' : '') + (isFuture ? ' ct-future' : '') + '" data-id="' + c.id + '"' + (_touch ? '' : ' draggable="true"') +

    ' onclick="KB.onCardClick(event,\'' + c.id + '\')">' +
    '<button class="ct-card-del" title="この契約を削除" onclick="event.stopPropagation();KB.deleteCardContract(event,\'' + c.id + '\')">×</button>' +
    (c.archived ? '<div class="ct-archived">完了タブ' + (c.archivedAt ? '（' + esc(c.archivedAt.slice(0,10).replace(/-/g,'/')) + '）' : '') + '</div>' : '') +
    '<div class="ct-head">' +
      '<span class="ct-head-left">' +
        '<span class="ct-type-label ct-type-' + ((c.type === '法人') ? 'corp' : 'indiv') + '">' + ((c.type === '法人') ? '法人' : '個人') + '</span>' +
        adLabelHtml +
      '</span>' +
      statusBox +
    '</div>' +
    '<div class="ct-main">' +
      '<div class="ct-badge" style="background:' + accent + ';">' +
        '<img src="' + STAGE_ICON[isDone ? 'done' : iconForStep(cur.key)] + '" alt="">' +
      '</div>' +
      '<div class="ct-body">' +
        '<div class="card-title">' + titleLine + '</div>' +
        notLinkedBadge +
        (isMonthly(c) ? '<div class="ct-monthly-badge">マンスリー</div>' : '') +
        '<div class="card-sub">' +
          '<span class="card-name">' + esc(c.contractor || '(契約者未入力)') + '</span>' +
          ((c.pet === 'あり') ? '<img class="ct-pet-dog" src="' + ICON_DOG_COLOR + '" title="ペット飼育あり" alt="ペットあり"><span class="ct-pet-label">ペット飼育あり</span>' : '') +
        '</div>' +
        cdateHtml(c) +
        '<div class="ct-progress"><div class="prog-bar">' + segHtml + '</div>' +
          '<div class="ct-stage-name' + (isDone ? ' done-label' : '') + '" style="color:' + accent + ';">' +
            statusLabel +
            ' <span class="ct-stage-count">' + doneCount + '/' + totalCount + '</span>' +
          '</div>' +
        '</div>' +
        (c.memo ? '<div class="ct-memo">📝 ' + esc(c.memo).replace(/\n/g,'<br>') + '</div>' : '') +
      '</div>' +
    '</div>' +
    ((moveBtn || revertBtn) ? '<div class="ct-actions">' + revertBtn + moveBtn + '</div>' : '') +
  '</div>';
}
// カードのドラッグ並べ替え
let _dragCardId = null;
function bindCardDrag(){
  const grid = document.getElementById('contract-grid');
  if(!grid) return;
  grid.querySelectorAll('.ct-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      _dragCardId = card.dataset.id;
      card.classList.add('dragging');
      try{ e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', _dragCardId); }catch(_){}
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      _dragCardId = null;
      _justDragged = true;
      setTimeout(() => { _justDragged = false; }, 300);
    });
    card.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = grid.querySelector('.ct-card.dragging');
      if(!dragging || dragging === card) return;
      const r = card.getBoundingClientRect();
      const after = (e.clientY > r.top + r.height/2) || (e.clientX > r.left + r.width/2);
      if(after){ card.after(dragging); } else { card.before(dragging); }
    });
  });
  grid.addEventListener('drop', e => { e.preventDefault(); persistCardOrder(); });
}
// 現在のDOM順を order として保存
function persistCardOrder(){
  const grid = document.getElementById('contract-grid');
  if(!grid) return;
  const all = loadAll();
  let i = 0;
  grid.querySelectorAll('.ct-card').forEach(card => {
    const c = all[card.dataset.id];
    if(c){ c.order = i++; }
  });
  saveAll(all);
  renderStats();
}
// 完了カードを完了タブへ移動
function moveToDone(event, id){  event.stopPropagation();
  const all = loadAll();
  const c = all[id];
  if(!c) return;
  c.archived = true;
  c.archivedAt = new Date().toISOString();
  saveAll(all);
  renderAll();
  toast('「' + (c.property||'契約') + '」を完了タブへ移動しました');
}
// キャンセル・審査落ちカードを「申込」に戻す(復活)
// 駐車場予約を復活するか確認して、OKなら復活する(申込に戻す・通常状態に戻す両方で使用)
function maybeRestoreReservation(c){
  try{
    if(c && c.property && c.parking && c.contractDate && typeof window.PV_linkReservation === 'function'){
      if(confirm('紐づいていた駐車場予約も復活させますか?')){
        const resName = (c.type === '法人' && c.carContractor && c.carContractor.trim())
          ? c.carContractor.trim() : c.contractor;
        const r = window.PV_linkReservation({
          property: c.property, tou: c.tou, parking: c.parking, room: c.room,
          contractor: resName, contractDate: c.contractDate, srcKey: c.id,
          silent: true, price: c.parkingPrice
        });
        if(r && r.ok){ toast('駐車場予約を復活しました'); }
        else if(r && r.reason === 'already'){ toast('駐車場予約はすでに登録済みです'); }
        else if(r && r.msg){ toast(r.msg); }
      }
    }
  }catch(e){}
}
function revertToApply(event, id){
  if(event) event.stopPropagation();
  const all = loadAll();
  const c = all[id];
  if(!c) return;
  c.dealStatus = 'apply';
  saveAll(all);
  renderAll();
  toast('「' + (c.property||'契約') + '」を申込に戻しました');
  maybeRestoreReservation(c);
}
// カード状況プルダウンの変更
// 新規契約画面のマンスリーチェック切替(編集中の契約に即反映)
function onMonthlyToggle(event){
  const on = event && event.target && event.target.checked;
  const id = _editingId || null;
  if(!id){ return; }
  const all = loadAll();
  const c = all[id];
  if(!c) return;
  if(on){ c.dealStatus = 'monthly'; }
  else if(c.dealStatus === 'monthly'){ c.dealStatus = 'apply'; }
  saveAll(all);
  if(typeof renderAll === 'function') renderAll();
}
function onCardStatusChange(event, id){
  if(event) event.stopPropagation();
  const sel = event && event.target;
  const val = sel ? sel.value : '';
  const all = loadAll();
  const c = all[id];
  if(!c){ return; }
  const statusChanged = (val && c.dealStatus !== val);
  // ★ ステータスが変わったら、その切り替え日を記録（初期値は今日、後でカレンダーで修正可）
  if(statusChanged){
    const _t = new Date();
    c.dealStatusDate = _t.getFullYear() + '-' + String(_t.getMonth()+1).padStart(2,'0') + '-' + String(_t.getDate()).padStart(2,'0');
  }
  if(val === 'cancel' || val === 'rejected'){
    const lbl = (val === 'cancel') ? 'キャンセル' : '審査落ち';
    const info = { contractor: c.contractor, carContractor: c.carContractor, srcKey: c.id, property: c.property, parking: c.parking };
    const hasRes = (typeof window.PV_hasReservation === 'function') ? window.PV_hasReservation(info) : false;
    if(hasRes && typeof window.PV_unlinkReservation === 'function'){
      // 駐車場予約がある場合のみ確認。OK=変更&予約削除 / キャンセル=ステータス変更も取り消し
      const ok = confirm('「' + (c.property||'契約') + '」を' + lbl + 'にします。\n紐づいている駐車場予約も削除しますか?\n\nOK: ' + lbl + 'にして予約も削除\nキャンセル: ' + lbl + 'への変更も取りやめ');
      if(!ok){
        // ステータス変更そのものを取り消し → 元の表示に戻す
        renderAll();
        return;
      }
      c.dealStatus = val;
      saveAll(all);
      renderAll();
      const r = window.PV_unlinkReservation(info);
      if(r && r.removed > 0){ toast('駐車場予約も削除しました'); }
    } else {
      // 予約が無ければ確認なしでそのまま変更
      c.dealStatus = val;
      saveAll(all);
      renderAll();
    }
  } else {
    // 申込〜契約書類作成完了 などの段階を保存
    const wasCancel = (c.dealStatus === 'cancel' || c.dealStatus === 'rejected');
    c.dealStatus = val;
    // ★ プルダウンで「ひな形送付済み」を選んだら、獲得アイテムも当日の日付でOKにする
    if(val === 'hinagata'){
      if(c.hinagata !== '完了'){ c.hinagata = '完了'; }
      c.itemDates = c.itemDates || {};
      if(!c.itemDates.hinagata){
        const _t = new Date();
        c.itemDates.hinagata = _t.getFullYear() + '-' + String(_t.getMonth()+1).padStart(2,'0') + '-' + String(_t.getDate()).padStart(2,'0');
      }
    }
    saveAll(all);
    renderAll();
    // もし編集画面(シート)を開いている契約なら、アイテム表示も更新する
    try{
      if(_editingId === id){
        if(typeof _editingItemValues !== 'undefined'){ _editingItemValues.hinagata = c.hinagata || ''; }
        if(typeof _editingItemDates !== 'undefined' && c.itemDates){ _editingItemDates.hinagata = c.itemDates.hinagata || _editingItemDates.hinagata; }
        if(typeof renderSheetItemSummary === 'function'){ renderSheetItemSummary(); }
      }
    }catch(e){}
    if(wasCancel){ maybeRestoreReservation(c); }
  }
  // ★ ステータスが変わったら、日付を確認・修正できるカレンダーを出す
  if(statusChanged && val !== 'cancel' && val !== 'rejected'){
    promptStatusDate(id);
  }
}
 
// ステータス切替日をカレンダーで選ばせる小さなダイアログ
function promptStatusDate(id){
  const all = loadAll();
  const c = all[id];
  if(!c) return;
  const cur = c.dealStatusDate || (function(){ const t=new Date(); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); })();
  // 既存のダイアログがあれば消す
  const old = document.getElementById('status-date-dialog');
  if(old) old.remove();
  const statusLabel = (function(){
    const def = (typeof dealStatusDef === 'function') ? dealStatusDef(c.dealStatus) : null;
    if(c.dealStatus === 'hinagata') return 'ひな形送付済み';
    return def ? def.label : (c.dealStatus || '');
  })();
  const ov = document.createElement('div');
  ov.id = 'status-date-dialog';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center;';
  ov.innerHTML =
    '<div style="background:#fff;border-radius:14px;padding:22px 20px;max-width:320px;width:88%;box-shadow:0 10px 40px rgba(0,0,0,0.3);">' +
      '<div style="font-weight:800;font-size:15px;color:#333;margin-bottom:4px;">「' + esc(statusLabel) + '」にした日</div>' +
      '<div style="font-size:12px;color:#888;margin-bottom:14px;">その日でなければカレンダーで直してください（既定は今日）</div>' +
      '<input type="date" id="status-date-input" value="' + esc(cur) + '" style="width:100%;font-size:17px;padding:10px;border:1.5px solid #cbd5e0;border-radius:8px;box-sizing:border-box;margin-bottom:16px;">' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;">' +
        '<button id="status-date-cancel" style="padding:9px 16px;border:1.5px solid #cbd5e0;background:#fff;border-radius:8px;font-weight:700;cursor:pointer;">キャンセル</button>' +
        '<button id="status-date-ok" style="padding:9px 18px;border:none;background:#4a5fd0;color:#fff;border-radius:8px;font-weight:800;cursor:pointer;">決定</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
  const input = document.getElementById('status-date-input');
  const close = () => { const d=document.getElementById('status-date-dialog'); if(d) d.remove(); };
  document.getElementById('status-date-cancel').onclick = () => { close(); };
  document.getElementById('status-date-ok').onclick = () => {
    const v = input.value;
    if(v){
      const a2 = loadAll(); const c2 = a2[id];
      if(c2){ c2.dealStatusDate = v; saveAll(a2); renderAll(); }
    }
    close();
  };
  ov.onclick = (e) => { if(e.target === ov) close(); };
  setTimeout(() => { try{ input.focus(); }catch(e){} }, 50);
}
function iconForStep(key){
  const m = {applyDate:'apply', contractDate:'cdate', sendDate:'send', returnDate:'return', paymentDate:'pay', keyHandover:'key', doneStage:'done'};
  return m[key] || 'apply';
}
 
function esc(s){ if(s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
 
// ホバー可能なデバイス(PC等)か判定
const _canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
let _hoverTimer = null;
let _suppressHoverUntil = 0;
let _previewId = null;
 
// 中央ポップアップに詳細を描画して開く
function showPreview(id){
  const c = loadAll()[id];
  if(!c) return;
  _previewId = id;
  const reached = c.stageReached || {};
  const roomNo = c.room ? String(c.room).replace(/^P/i,'') : '';
  const reachedContract = !!reached['契約日確定'];
  const pkg = c.parking ? String(c.parking).replace(/^P[-\s]?/i,'') : '';
  const isPet = (c.pet === 'あり');
 
  // タイトル行
  let head = '<span class="pv-title">' + esc(c.property || '(物件未入力)') + '</span>';
  if(roomNo) head += '<span class="pv-room">' + esc(roomNo) + '号</span>';
  if(pkg) head += '<span class="pv-park">P' + esc(pkg) + '</span>';
 
  // ステージ一覧
  const stagesHtml = STAGES.map(s => {
    const d = reached[s.key];
    const dtxt = d ? d.slice(5).replace('-','/') : '';
    return '<div class="pv-stage' + (d ? ' reached' : '') + '">' +
      '<span>' + s.emoji + '</span>' +
      '<span class="pv-st-name">' + s.name + '</span>' +
      (d ? '<span class="pv-st-date">' + dtxt + '</span>' : '<span class="pv-st-date" style="color:#bbb;">未到達</span>') +
    '</div>';
  }).join('');
 
  const metaHtml =
    (c.type === '法人' ? '<span class="pv-tag">法人</span>' : '<span class="pv-tag">個人</span>') +
    (c.warn ? '<span class="pv-tag" style="background:#ffe5e3;color:#c0392b;">不備あり</span>' : '') +
    (c.staff ? '<span class="pv-tag">担当 ' + esc(c.staff) + '</span>' : '') +
    (c.contractDate ? '<span class="pv-tag">契約日 ' + esc(c.contractDate.slice(5).replace('-','/')) + '</span>' : '');
 
  // 獲得アイテム(大きく表示)
  const pvItems = displayItems(c);                         // AD等の表示専用も出す
  const gotCount = applicableItems(c).filter(it => itemGot(c, it)).length;  // 取得数は達成項目のみ
  const itemsBig = pvItems.map(it => {
    const got = itemGot(c, it);
    const gotDate = (c.itemDates && c.itemDates[it.key]) ? c.itemDates[it.key].slice(5).replace('-','/') : '';
    // AD は「取得/未取得」ではなく金額(%)を表示
    if(it.key === 'ad'){
      const adn = adValue(c.ad);
      return '<div class="pv-item got">' +
        '<img src="' + ITEM_ICON[it.icon] + '" alt="AD">' +
        '<span class="pv-item-label">AD</span>' +
        '<span class="pv-item-status">AD' + esc(String(adn)) + '%</span>' +
      '</div>';
    }
    return '<div class="pv-item' + (got ? ' got' : '') + '">' +
      '<img src="' + ITEM_ICON[it.icon] + '" alt="' + it.label + '">' +
      '<span class="pv-item-label">' + it.label + '</span>' +
      '<span class="pv-item-status">' + (got ? (gotDate ? '取得 ' + gotDate : '✔ 取得') : '—') + '</span>' +
    '</div>';
  }).join('');
 
  const popup = document.getElementById('preview-popup');
  popup.innerHTML =
    '<button class="pv-close" onclick="KB.hidePreview(true)">×</button>' +
    (isPet ? '<img class="pv-pet" src="' + ICON_DOG + '" title="ペットあり" alt="ペット">' : '') +
    '<div class="pv-head">' + head + '</div>' +
    '<div class="pv-contractor">' + esc(c.contractor || '(契約者未入力)') + '</div>' +
    (c.broker ? '<div class="pv-broker">🏢 ' + esc(c.broker) + '</div>' : '') +
    '<div class="pv-meta">' + metaHtml + '</div>' +
    '<div class="pv-section-title">🎒 獲得アイテム (' + gotCount + ' / ' + pvItems.length + ')</div>' +
    '<div class="pv-items">' + itemsBig + '</div>' +
    '<div class="pv-section-title">ステージ到達履歴</div>' +
    '<div class="pv-stages">' + stagesHtml + '</div>' +
    (c.memo ? '<div class="pv-section-title">📝 備考</div><div class="pv-memo">' + esc(c.memo).replace(/\n/g,'<br>') + '</div>' : '') +
    '<button class="pv-edit-btn" onclick="KB.openSheet(\'' + id + '\')">編集する</button>';
 
  document.getElementById('preview-backdrop').classList.add('active');
  popup.classList.add('active');
  popup.setAttribute('aria-hidden','false');
}
function hidePreview(){
  _previewId = null;
  document.getElementById('preview-backdrop').classList.remove('active');
  const popup = document.getElementById('preview-popup');
  popup.classList.remove('active');
  popup.setAttribute('aria-hidden','true');
}
 
// ====== 完了済みモーダル ======
function openDoneModal(){
  renderDoneList();
  document.getElementById('done-backdrop').classList.add('active');
  const m = document.getElementById('done-modal');
  m.classList.add('active');
  m.setAttribute('aria-hidden','false');
}
function closeDoneModal(){
  document.getElementById('done-backdrop').classList.remove('active');
  const m = document.getElementById('done-modal');
  m.classList.remove('active');
  m.setAttribute('aria-hidden','true');
}
 
// ====== PIVOT導入前の客付け履歴（Excel契約書管理表より・カード化しない分析専用データ） ======
/* 3年分(2023-2026) 804件。統計/分析にのみ使用。契約カンバンには出しません。 */
const BROKER_HISTORY = [{"property":"ベラカーサノース","room":"705.0","broker":"穴吹ハウジングサービス　岡山","staff":"森川","contractDate":"2026-04-14","applyDate":"2026-03-18","status":"契約書類不備あり"},{"property":"ベラカーサノース","room":"501.0","broker":"ホーミィエステート","staff":"矢野","contractDate":"2026-04-15","applyDate":"2026-03-06","status":"契約書類不備あり"},{"property":"エスプレイスビルド","room":"106.0","broker":"エイブル総社店","staff":"吉村","contractDate":"2026-05-07","applyDate":"2026-04-09","status":"契約書類不備あり"},{"property":"アンティカベラカーサ","room":"207.0","broker":"DOORS岡山駅前店","staff":"水野","contractDate":"2026-06-11","applyDate":"2026-06-06","status":"契約書類不備あり"},{"property":"サントーシャ","room":"101.0","broker":"中国バス不動産　福山","staff":"上田","contractDate":"2026-06-14","applyDate":"2026-05-21","status":"契約書類不備あり"},{"property":"ラコリーヌ","room":"A102","broker":"ケイアイ沖野上","staff":"馬場","contractDate":"2026-06-17","applyDate":"2026-05-20","status":"契約書類不備あり"},{"property":"アイディール","room":"102.0","broker":"タカハシ東尾道駅前店","staff":"肌野","contractDate":"2026-06-26","applyDate":"2026-05-28","status":"契約書類不備あり"},{"property":"ベラカーササウス","room":"603.0","broker":"ワイケイ倉敷駅前店","staff":"永田","contractDate":"2026-07-01","applyDate":"2026-06-02","status":"契約書類不備あり"},{"property":"アンティカベラカーサ","room":"302.0","broker":"東建コーポレーション 倉敷支店","staff":"新田","contractDate":"2026-07-11","applyDate":"2026-06-29","status":"契約書類不備あり"},{"property":"エスプレイスビルド","room":"902.0","broker":"ワイケイ　新倉敷駅前","staff":"金光","contractDate":"2026-07-12","applyDate":"2026-06-14","status":"契約書類不備あり"},{"property":"アンティカベラカーサ","room":"402.0","broker":"エイブル　庭瀬","staff":"古谷","contractDate":"2026-07-18","applyDate":"2026-06-27","status":"契約書送付済み"},{"property":"エスプレイスビルド","room":"802.0","broker":"エイブルNW倉敷市役所前店","staff":"鳥越","contractDate":"2026-07-18","applyDate":"2026-07-07","status":"契約書送付済み"},{"property":"シティハイツ暁の星","room":"102.0","broker":"アパマンショップ沖野上店","staff":"段上","contractDate":"2026-07-23","applyDate":"2026-06-18","status":"契約書送付済み"},{"property":"アイディール","room":"201.0","broker":"中国バス不動産","staff":"宗政","contractDate":"2026-07-24","applyDate":"2026-06-05","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"806.0","broker":"ワイケイ　倉敷沖新店","staff":"安藤","contractDate":"2026-07-24","applyDate":"2026-07-11","status":"契約書送付済み"},{"property":"セラータ","room":"107.0","broker":"株式会社 ケイアイホーム神辺店","staff":"坂井","contractDate":"2026-07-25","applyDate":"2026-07-11","status":"契約書送付済み"},{"property":"エスプレイスビルド","room":"505.0","broker":"ケイアイホーム　倉敷白楽町店","staff":"豊嶋","contractDate":"2026-07-26","applyDate":"2026-07-05","status":"契約書送付済み"},{"property":"ベラカーサノース","room":"903.0","broker":"大東建託リーシング株式会社 倉敷店","staff":"赤堀","contractDate":"2026-07-27","applyDate":"2026-07-05","status":"契約書送付済み"},{"property":"ヘスティア","room":"105.0","broker":"ケイアイ　福山駅前","staff":"小葉竹","contractDate":"2026-07-28","applyDate":"2026-07-15","status":"契約書送付済み"},{"property":"アルバ","room":"北107","broker":"アヤカホーム 株式会社","staff":"有安","contractDate":"2026-07-29","applyDate":"2026-07-15","status":"契約書送付済み"},{"property":"ハルモニア","room":"103.0","broker":"中国バス　福山","staff":"","contractDate":"2026-07-31","applyDate":"2026-07-04","status":"契約書送付済み"},{"property":"ヘスティア","room":"110.0","broker":"いえなび春日","staff":"山本","contractDate":"2026-08-01","applyDate":"2026-07-02","status":"契約書送付済み"},{"property":"ベラカーサノース","room":"307.0","broker":"株式会社 ワイケイ　倉敷沖新店","staff":"安藤","contractDate":"2026-08-01","applyDate":"2026-07-04","status":"契約書送付済み"},{"property":"ヘスティア","room":"108.0","broker":"住まいのクエスト","staff":"富田","contractDate":"2026-08-01","applyDate":"2026-07-10","status":"契約書送付済み"},{"property":"アメリア","room":"103.0","broker":"いい部屋ネット　福山駅南口店","staff":"高橋","contractDate":"2026-08-25","applyDate":"2026-07-14","status":"契約書送付済み"},{"property":"ベラカーサノース","room":"405.0","broker":"ライフ","staff":"","contractDate":"2026-08-29","applyDate":"2026-06-25","status":"ひな形送付済み"},{"property":"フローレンス南蔵王","room":"2F北","broker":"","staff":"","contractDate":"","applyDate":"2026-04-14","status":"審査完了"},{"property":"ビラ芳翠","room":"B101","broker":"ケイアイ神辺","staff":"坂井","contractDate":"","applyDate":"2026-07-16","status":"条件確認中"},{"property":"アプリシティ","room":"103.0","broker":"中国バス不動産　見ない点","staff":"","contractDate":"","applyDate":"2026-07-18","status":"審査中"},{"property":"カルコーサ","room":"103.0","broker":"タカハシ　東尾道駅前","staff":"大前","contractDate":"2026-01-16","applyDate":"2025-12-01","status":"契約書類返送完備"},{"property":"マースフル","room":"102.0","broker":"株式会社 タカハシ福山南店","staff":"蟻田","contractDate":"2026-02-11","applyDate":"2026-01-30","status":"契約書類返送完備"},{"property":"ソフィア","room":"201.0","broker":"大東建託リーシング株式会社　福山店","staff":"平田","contractDate":"2026-01-31","applyDate":"2026-01-09","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"707.0","broker":"ＢＲＵＮＯ不動産 株式会社　総社","staff":"鷺原","contractDate":"","applyDate":"2026-01-25","status":"キャンセル"},{"property":"ベラカーサノース","room":"502.0","broker":"良和ハウス岡山駅前店","staff":"松本","contractDate":"2026-01-31","applyDate":"2026-01-14","status":"契約書類返送完備"},{"property":"ナディア","room":"B106","broker":"ワイケイ倉敷駅前店","staff":"永田","contractDate":"2026-01-01","applyDate":"2025-12-04","status":"契約書類返送完備"},{"property":"フローレンス南蔵王2F北","room":"","broker":"ライフ","staff":"","contractDate":"","applyDate":"2026-02-13","status":"審査落ち"},{"property":"タリスヴィータ","room":"B103","broker":"E-dith株式会社","staff":"三村","contractDate":"2026-02-20","applyDate":"2026-01-23","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"501.0","broker":"株式会社 ケイアイホーム倉敷インター南店","staff":"土井","contractDate":"2026-02-21","applyDate":"2026-01-17","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"407.0","broker":"ワイケイ倉敷沖新店","staff":"藤原","contractDate":"2026-02-20","applyDate":"2025-12-27","status":"契約書類返送完備"},{"property":"マジェステ","room":"B105","broker":"タカハシ東尾道駅前店","staff":"藤井","contractDate":"2026-02-28","applyDate":"2026-01-17","status":"契約書類返送完備"},{"property":"マルヴィナ","room":"201.0","broker":"トリコム","staff":"河野","contractDate":"2026-02-28","applyDate":"2026-01-26","status":"契約書類返送完備"},{"property":"アシンプトート","room":"Ａ105","broker":"アークス　イオンモール倉敷","staff":"阿部","contractDate":"2025-11-21","applyDate":"2025-01-09","status":"契約書類返送完備"},{"property":"カルコーサ","room":"102.0","broker":"株式会社 いえなび福山春日店","staff":"今井","contractDate":"2026-02-28","applyDate":"2026-01-20","status":"契約書類返送完備"},{"property":"スピネルデュオ","room":"102.0","broker":"大東建託リーシング株式会社　福山店","staff":"山田","contractDate":"2026-02-28","applyDate":"2026-01-29","status":"契約書類返送完備"},{"property":"スピネルデュオ","room":"108.0","broker":"いえなび春日","staff":"髙木","contractDate":"2026-02-28","applyDate":"2026-02-03","status":"契約書類返送完備"},{"property":"マースフル","room":"103.0","broker":"中国バス不動産株式会社　福山","staff":"田平","contractDate":"2026-02-28","applyDate":"2026-02-11","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"606.0","broker":"ＢＲＵＮＯ不動産 株式会社","staff":"平田","contractDate":"2026-03-01","applyDate":"2025-09-17","status":"契約書類返送完備"},{"property":"グロリオサ","room":"302.0","broker":"エイブルＮＷ神辺店","staff":"大塚","contractDate":"2026-03-01","applyDate":"2026-01-11","status":"契約書類返送完備"},{"property":"アルデバラン","room":"A106","broker":"不動産の岩原","staff":"岩原","contractDate":"2026-03-01","applyDate":"2026-01-17","status":"契約書類返送完備"},{"property":"タラッサ","room":"111.0","broker":"ワイケイ　倉敷沖新店","staff":"栗木","contractDate":"2026-03-01","applyDate":"2026-01-18","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"205.0","broker":"Ｔｏｒｕｓ不動産 合同会社","staff":"前田","contractDate":"2026-03-01","applyDate":"2026-01-19","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"502.0","broker":"ＢＲＵＮＯ不動産 株式会社庭瀬駅前店⇒総社店","staff":"福本","contractDate":"2026-03-01","applyDate":"2026-02-09","status":"契約書類返送完備"},{"property":"マースフル","room":"203.0","broker":"エイブルＮＷ福山蔵王店","staff":"井上","contractDate":"2026-03-08","applyDate":"2026-02-07","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"703.0","broker":"エイブルNW倉敷駅北店","staff":"鳥越","contractDate":"","applyDate":"2026-02-26","status":"キャンセル"},{"property":"マースフル","room":"101.0","broker":"大東建託リーシング株式会社　福山店","staff":"平田","contractDate":"2026-03-09","applyDate":"2026-02-26","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"306.0","broker":"エイブルNWイオンモール倉敷店　株式会社アークス","staff":"阿部","contractDate":"2026-02-28","applyDate":"2026-01-29","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"111.0","broker":"株式会社 いえなび福山春日店","staff":"山本","contractDate":"2026-03-16","applyDate":"2026-03-02","status":"キャンセル"},{"property":"テタンジェ","room":"108.0","broker":"株式会社 ケイアイホーム岡山西市店","staff":"野上","contractDate":"2026-03-20","applyDate":"2026-03-09","status":"審査落ち"},{"property":"エスプレイスビルド","room":"503.0","broker":"西日本開発 株式会社","staff":"横浦","contractDate":"2026-03-14","applyDate":"2026-02-21","status":"契約書類返送完備"},{"property":"ミステール","room":"103.0","broker":"アパマンショップ東尾道駅前店","staff":"藤井","contractDate":"2026-03-14","applyDate":"2026-02-23","status":"契約書類返送完備"},{"property":"アイディール","room":"205.0","broker":"いえなび春日","staff":"山本","contractDate":"2026-03-01","applyDate":"2026-02-02","status":"契約書類返送完備"},{"property":"マースフル","room":"202.0","broker":"あきつ住研","staff":"西澤","contractDate":"2026-02-22","applyDate":"2026-02-12","status":"契約書類返送完備"},{"property":"ミステール","room":"203.0","broker":"株式会社 タカハシ福山松永店","staff":"前迫","contractDate":"2026-03-20","applyDate":"2026-01-23","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"505.0","broker":"株式会社 さくらコーポレーション","staff":"髙原","contractDate":"2026-03-22","applyDate":"2026-02-23","status":"契約書類返送完備"},{"property":"モデルノ","room":"202.0","broker":"ダイシン都市開発㈱","staff":"宮地","contractDate":"2026-02-15","applyDate":"2026-01-21","status":"契約書類返送完備"},{"property":"エルキュール","room":"C203","broker":"エイブルNWイオンモール倉敷店　株式会社アークス","staff":"山本","contractDate":"2025-12-03","applyDate":"2025-11-23","status":"契約書類返送完備"},{"property":"ナディア","room":"Ｂ103","broker":"(株)ワイケイ　アパマンショップ倉敷水島店","staff":"薮井","contractDate":"2025-12-26","applyDate":"2025-12-14","status":"契約書類返送完備"},{"property":"ナディア","room":"A106","broker":"エイブル新倉敷店","staff":"守屋","contractDate":"2026-03-23","applyDate":"2026-02-27","status":"契約書類返送完備"},{"property":"カルムコート","room":"東105","broker":"大東建託リーシング株式会社 福山店","staff":"柴野","contractDate":"2026-04-09","applyDate":"2026-03-19","status":"キャンセル"},{"property":"アルカディア","room":"D203","broker":"大東建託リーシング株式会社　福山店","staff":"平田","contractDate":"2026-03-21","applyDate":"2026-02-23","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"706.0","broker":"ＢＲＵＮＯ不動産 株式会社庭瀬駅前店⇒総社店","staff":"福本","contractDate":"2026-03-24","applyDate":"2026-03-08","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"108.0","broker":"いえなび多治米","staff":"宮地","contractDate":"2026-03-24","applyDate":"2026-02-06","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"806.0","broker":"あびこ不動産","staff":"藤井","contractDate":"2026-03-25","applyDate":"2026-03-12","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"302.0","broker":"叶う不動産 株式会社","staff":"六車","contractDate":"2026-03-27","applyDate":"2025-12-19","status":"契約書類返送完備"},{"property":"ミーティア","room":"B101","broker":"いえなび　多治米","staff":"宮地","contractDate":"","applyDate":"2026-03-24","status":"キャンセル"},{"property":"ディアレスト","room":"103.0","broker":"株式会社いえなび 福山多治米店","staff":"宮地","contractDate":"2026-03-28","applyDate":"2026-03-13","status":"契約書類返送完備"},{"property":"ソルトグラス","room":"201.0","broker":"大東建託リーシング株式会社福山","staff":"平田","contractDate":"2026-03-28","applyDate":"2026-03-22","status":"契約書類返送完備"},{"property":"ミステール","room":"105.0","broker":"株式会社 ケイアイホーム沖野上店","staff":"大渡","contractDate":"2026-02-24","applyDate":"2026-02-14","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"201.0","broker":"株式会社さくらコーポレーションミニミニFC倉敷店","staff":"小林","contractDate":"2026-03-16","applyDate":"2026-02-21","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"505.0","broker":"株式会社ケイアイホーム","staff":"國定","contractDate":"2026-02-18","applyDate":"2026-01-28","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"702.0","broker":"ライフ","staff":"","contractDate":"2026-03-31","applyDate":"2026-03-05","status":"契約書類返送完備"},{"property":"ナディア","room":"A201","broker":"株式会社 さくらコーポレーション　ミニミニFC水島店","staff":"田村","contractDate":"2026-03-31","applyDate":"2026-03-23","status":"契約書類返送完備"},{"property":"アルバ","room":"北110","broker":"トリコム","staff":"山田","contractDate":"2026-04-01","applyDate":"2026-02-16","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"703.0","broker":"あびこ不動産","staff":"藤井","contractDate":"2026-04-02","applyDate":"2026-03-09","status":"契約書類返送完備"},{"property":"カルムコート","room":"東207","broker":"いえなび春日","staff":"髙木","contractDate":"2026-03-31","applyDate":"2026-02-24","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"906.0","broker":"ＢＲＵＮＯ不動産 株式会社　総社店","staff":"平田","contractDate":"2026-03-28","applyDate":"2026-03-17","status":"契約書類返送完備"},{"property":"プレジール高橋","room":"205.0","broker":"いえなび春日","staff":"今井","contractDate":"2026-03-23","applyDate":"2026-02-12","status":"契約書類返送完備"},{"property":"ミステール","room":"205.0","broker":"株式会社 いえなび福山春日店","staff":"山本","contractDate":"2026-03-28","applyDate":"2026-02-18","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"103.0","broker":"株式会社 吉備土地開発","staff":"原","contractDate":"2026-04-03","applyDate":"2026-03-06","status":"契約書類返送完備"},{"property":"KASUGAエコパティオ","room":"Ｂ","broker":"LIFUKU 福山南店","staff":"行友","contractDate":"2026-04-01","applyDate":"2026-03-07","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"707.0","broker":"ＢＲＵＮＯ不動産 株式会社　総社店","staff":"吉村","contractDate":"2026-03-28","applyDate":"2026-03-07","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"702.0","broker":"ＢＲＵＮＯ不動産 株式会社　総社店","staff":"平田","contractDate":"2026-04-03","applyDate":"2026-03-01","status":"契約書類返送完備"},{"property":"テタンジェ","room":"106.0","broker":"ミニミニFC玉島店","staff":"久保津","contractDate":"2026-04-04","applyDate":"2026-03-22","status":"契約書類返送完備"},{"property":"ミーティア","room":"B101","broker":"株式会社いえなび 福山多治米店","staff":"宮地","contractDate":"2026-04-07","applyDate":"2026-04-02","status":"キャンセル"},{"property":"アイディール","room":"203.0","broker":"いえなび　多治米","staff":"宮地","contractDate":"2026-04-13","applyDate":"2026-01-09","status":"契約書類返送完備"},{"property":"マルヴィナ","room":"102.0","broker":"エイブル神辺","staff":"大塚","contractDate":"2026-04-11","applyDate":"2026-01-30","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"403.0","broker":"さくら　ミニミニFC倉敷店","staff":"中原","contractDate":"2026-03-25","applyDate":"2026-02-24","status":"契約書類返送完備"},{"property":"マースフル","room":"201.0","broker":"ケイアイホーム福山駅前店","staff":"矢口","contractDate":"2026-03-26","applyDate":"2026-02-20","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"A102","broker":"大東建託リーシング株式会社 福山店","staff":"柴野","contractDate":"2026-04-13","applyDate":"2026-03-30","status":"契約書類返送完備"},{"property":"メゾンドリヴァージュ","room":"Ａ103","broker":"株式会社 いえなび福山春日店","staff":"山本","contractDate":"2026-04-14","applyDate":"2026-03-04","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"606.0","broker":"GHOUSE","staff":"リュウ シンコウ","contractDate":"2026-04-14","applyDate":"2026-03-11","status":"契約書類返送完備"},{"property":"テラストリア","room":"203.0","broker":"大東建託リーシング株式会社 三原店","staff":"佐藤","contractDate":"2026-04-14","applyDate":"2026-03-15","status":"契約書類返送完備"},{"property":"ナディア","room":"Ｂ105","broker":"ＢＲＵＮＯ不動産 株式会社妹尾店","staff":"山本","contractDate":"2026-01-31","applyDate":"2025-12-14","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"705.0","broker":"ケイアイホーム岡山駅西口店","staff":"木下","contractDate":"2026-03-19","applyDate":"2026-02-16","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"405.0","broker":"エイブルNWイオンモール倉敷店　株式会社アークス","staff":"山本","contractDate":"2026-03-18","applyDate":"2026-02-03","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"202.0","broker":"いえなび　春日","staff":"今井","contractDate":"2026-04-15","applyDate":"2026-03-08","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"507.0","broker":"エイブルNW倉敷駅北店","staff":"鳥越","contractDate":"2026-04-17","applyDate":"2026-03-04","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"502.0","broker":"ワイケイ倉敷沖新店","staff":"岡野","contractDate":"2026-03-28","applyDate":"2026-02-19","status":"契約書類返送完備"},{"property":"グロリオサ","room":"403.0","broker":"株式会社My Room","staff":"吉本","contractDate":"2026-04-20","applyDate":"2026-03-23","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"603.0","broker":"株式会社ジェイ・フィール　Doors岡山駅前店","staff":"中原","contractDate":"2026-03-22","applyDate":"2026-02-27","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"503.0","broker":"ケイアイホーム　アパマンショップ 白楽町店","staff":"今村","contractDate":"2026-04-25","applyDate":"2026-03-01","status":"契約書類返送完備"},{"property":"メゾンドリヴァージュ","room":"A302","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2026-04-25","applyDate":"2026-04-15","status":"契約書類返送完備"},{"property":"スピネルデュオ","room":"107.0","broker":"中国バス不動産　南店","staff":"行友","contractDate":"2026-04-26","applyDate":"2026-04-04","status":"契約書類返送完備"},{"property":"ナディア","room":"A103","broker":"株式会社 ケイアイホーム倉敷インター南店","staff":"土井","contractDate":"2026-04-30","applyDate":"2026-04-07","status":"契約書類返送完備"},{"property":"ナディア","room":"A203","broker":"株式会社 ケイアイホーム倉敷インター南店","staff":"土井","contractDate":"2026-04-30","applyDate":"2026-04-07","status":"契約書類返送完備"},{"property":"テタンジェ","room":"108.0","broker":"有限会社 エステート守屋本店","staff":"守屋","contractDate":"2026-05-01","applyDate":"2026-04-02","status":"契約書類返送完備"},{"property":"アプリシティ","room":"305.0","broker":"株式会社 いえなび福山春日店","staff":"髙木","contractDate":"2026-05-01","applyDate":"2026-04-06","status":"契約書類返送完備"},{"property":"アルカンシェル","room":"A105","broker":"中国バス不動産　福山店","staff":"小川","contractDate":"2026-04-30","applyDate":"2026-04-06","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"906.0","broker":"株式会社 さくらコーポレーション倉敷本店","staff":"小林","contractDate":"","applyDate":"2026-04-27","status":"審査落ち"},{"property":"ナディア","room":"A102","broker":"株式会社ワイケイ　アパマンショップ　倉敷水島店","staff":"佐藤","contractDate":"2026-04-29","applyDate":"2026-04-17","status":"契約書類返送完備"},{"property":"ルミエール静","room":"B301","broker":"株式会社 ケイアイホーム沖野上店","staff":"藤井","contractDate":"2026-04-15","applyDate":"2026-03-29","status":"契約書類返送完備"},{"property":"ナディア","room":"Ａ101","broker":"ネクステージホーム","staff":"松本","contractDate":"2026-03-29","applyDate":"2026-03-23","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"303.0","broker":"エイブル倉敷中庄店","staff":"田川","contractDate":"2026-05-01","applyDate":"2026-04-21","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"901.0","broker":"ワイケイ　倉敷沖新店","staff":"岡野","contractDate":"2026-03-31","applyDate":"2026-02-24","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"1003.0","broker":"株式会社さくらコーポレーション　ミニミニFC倉敷店","staff":"小林","contractDate":"2026-04-29","applyDate":"2026-04-16","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"503.0","broker":"アークス　倉敷中庄店","staff":"内田","contractDate":"2026-04-10","applyDate":"2026-03-23","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"806.0","broker":"エイブルNW倉敷市役所前店","staff":"","contractDate":"","applyDate":"2026-05-10","status":"審査落ち"},{"property":"ベラカーサノース","room":"907.0","broker":"株式会社 ケイアイホーム倉敷インター南店","staff":"土井","contractDate":"2026-04-18","applyDate":"2026-03-14","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"505.0","broker":"株式会社良和ハウス岡山駅前店","staff":"西川","contractDate":"2026-04-09","applyDate":"2026-03-10","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"806.0","broker":"株式会社 ワイケイ　倉敷沖新店","staff":"金光","contractDate":"","applyDate":"2026-05-14","status":"審査落ち"},{"property":"ベラカーサノース","room":"901.0","broker":"株式会社ワイケイ　アパマンショップ　倉敷駅前店","staff":"岡野","contractDate":"2026-05-09","applyDate":"2026-04-10","status":"契約書類返送完備"},{"property":"アルバ","room":"北106","broker":"いえなび春日","staff":"髙木","contractDate":"2026-05-21","applyDate":"2026-04-23","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"805.0","broker":"良和ハウス","staff":"三宅","contractDate":"2026-03-28","applyDate":"2026-03-06","status":"契約書類返送完備"},{"property":"シャンティ","room":"203.0","broker":"株式会社 タカハシ福山東インター南店","staff":"寺地","contractDate":"2026-05-24","applyDate":"2026-05-07","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"903.0","broker":"株式会社 ワイケイ","staff":"金光","contractDate":"","applyDate":"2026-05-22","status":"審査落ち"},{"property":"エスプレイスビルド","room":"607.0","broker":"株式会社 良和ハウス","staff":"松本","contractDate":"2026-03-08","applyDate":"2026-02-22","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"202.0","broker":"株式会社 金葉マネジメント","staff":"大石","contractDate":"2026-03-24","applyDate":"2026-01-13","status":"契約書類返送完備"},{"property":"プティメゾン","room":"202.0","broker":"株式会社 ケイアイホーム神辺店","staff":"羽原","contractDate":"2026-04-24","applyDate":"2026-03-29","status":"契約書類返送完備"},{"property":"ミステール","room":"102.0","broker":"株式会社 タカハシ本店","staff":"加藤","contractDate":"2026-03-21","applyDate":"2026-02-17","status":"契約書類返送完備"},{"property":"アプリシティ","room":"101.0","broker":"ケイアイホーム沖野上店","staff":"馬場","contractDate":"2026-06-01","applyDate":"2026-04-30","status":"契約書類返送完備"},{"property":"ラコリーヌ","room":"A101","broker":"エイブルＮＷ神辺店　株式会社アークス","staff":"井上","contractDate":"2026-06-03","applyDate":"2026-05-16","status":"契約書類返送完備"},{"property":"エバーグリーン福山西町","room":"302.0","broker":"アパマンショップ福山駅前店","staff":"友滝","contractDate":"2026-04-28","applyDate":"2026-04-17","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"905.0","broker":"エイブル総社店","staff":"鷺原","contractDate":"2026-06-08","applyDate":"2026-05-21","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"206.0","broker":"ワイケイ倉敷沖新店","staff":"藤原","contractDate":"2026-04-18","applyDate":"2026-02-21","status":"契約書類返送完備"},{"property":"ビラ芳翠","room":"B101","broker":"株式会社JAPANHOMES本店","staff":"PHAM MINH TAN","contractDate":"2026-06-20","applyDate":"2026-05-13","status":"キャンセル"},{"property":"ガーデンヒルズ長者町","room":"111.0","broker":"いえなび春日","staff":"髙木","contractDate":"2026-06-01","applyDate":"2026-05-02","status":"契約書類返送完備"},{"property":"マースフル","room":"102.0","broker":"不動産の岩原","staff":"岩原","contractDate":"2026-06-10","applyDate":"2026-05-23","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"1001.0","broker":"エイブルNWイオンモール倉敷店","staff":"阿部","contractDate":"","applyDate":"2026-06-11","status":"キャンセル"},{"property":"ミラヴィルタス","room":"東111","broker":"いえなび春日","staff":"山本","contractDate":"","applyDate":"2026-06-08","status":"キャンセル"},{"property":"ビラ芳翠","room":"A105","broker":"株式会社 ケイアイホーム神辺店","staff":"小葉竹","contractDate":"2026-06-20","applyDate":"2026-05-22","status":"契約書類返送完備"},{"property":"カルムコート","room":"東105","broker":"トリコム","staff":"山田","contractDate":"2026-06-20","applyDate":"2026-06-04","status":"契約書類返送完備"},{"property":"マジェステ","room":"B102","broker":"中国バス不動産　福山店","staff":"田平","contractDate":"2026-06-20","applyDate":"2026-06-08","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"302.0","broker":"株式会社ＨＹクレスト/いい部屋ネット　岡山南店","staff":"池田","contractDate":"","applyDate":"2026-06-18","status":"審査落ち"},{"property":"ルミエール静","room":"B201","broker":"株式会社 いえなび福山春日店","staff":"山本","contractDate":"2026-06-21","applyDate":"2026-05-17","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"201.0","broker":"東建コーポレーション 株式会社ホームメイト岡山店","staff":"山崎","contractDate":"2026-03-07","applyDate":"2026-01-20","status":"契約書類返送完備"},{"property":"ミーティア","room":"B101","broker":"LIFUKU 福山店","staff":"光吉","contractDate":"2026-06-27","applyDate":"2026-05-18","status":"契約書類返送完備"},{"property":"ビラ芳翠","room":"B103","broker":"トリコム","staff":"山田","contractDate":"2026-06-27","applyDate":"2026-05-18","status":"契約書類返送完備"},{"property":"アルカディア","room":"D102","broker":"株式会社 いえなび福山春日店","staff":"今井","contractDate":"2026-06-27","applyDate":"2026-05-29","status":"契約書類返送完備"},{"property":"KUSADO　HOUSE","room":"","broker":"ライフ","staff":"","contractDate":"2026-07-01","applyDate":"2026-05-18","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"705.0","broker":"あなぶき　倉敷","staff":"久保田","contractDate":"2026-04-06","applyDate":"2026-03-07","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"903.0","broker":"株式会社アシスト不動産プラス","staff":"田久間","contractDate":"2026-07-01","applyDate":"2026-05-21","status":"契約書類返送完備"},{"property":"アシンプトート","room":"Ａ303","broker":"株式会社 いえなび福山春日店","staff":"今井","contractDate":"2026-07-01","applyDate":"2026-06-01","status":"契約書類返送完備"},{"property":"ミラヴィルタス","room":"西202","broker":"いえなび春日","staff":"山本","contractDate":"2026-07-01","applyDate":"2026-06-14","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"102.0","broker":"エイブル新涯","staff":"","contractDate":"","applyDate":"2026-07-04","status":"キャンセル"},{"property":"ベラカーサフェリーチェ","room":"303.0","broker":"株式会社 ワイケイ　アパマンショップ倉敷駅前店","staff":"松尾","contractDate":"2026-05-20","applyDate":"2026-04-23","status":"契約書類返送完備"},{"property":"フェリックス","room":"102.0","broker":"いえなび春日","staff":"","contractDate":"","applyDate":"2026-07-08","status":"審査落ち"},{"property":"ヘスティア","room":"101.0","broker":"中国バス不動産　福山店","staff":"上田","contractDate":"2026-07-01","applyDate":"2026-05-10","status":"契約書類返送完備"},{"property":"エルキュール","room":"B201","broker":"大東建託リーシング株式会社　福山店","staff":"平田","contractDate":"2026-07-13","applyDate":"2026-06-28","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"305.0","broker":"ケイアイホーム　倉敷白楽町店","staff":"豊嶋","contractDate":"2026-07-14","applyDate":"2026-07-03","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"B103","broker":"不動産の岩原","staff":"岩原","contractDate":"2026-07-14","applyDate":"2026-07-07","status":"契約書類返送完備"},{"property":"ハルモニア","room":"201.0","broker":"いい部屋ネット　福山北店","staff":"石原","contractDate":"2026-07-17","applyDate":"2026-06-04","status":"契約書類返送完備"},{"property":"ヘスティア","room":"106.0","broker":"いえなび春日","staff":"山本","contractDate":"2026-07-19","applyDate":"2026-07-03","status":"契約書類返送完備"},{"property":"ヘスティア","room":"102.0","broker":"アフィット不動産","staff":"箱﨑","contractDate":"2026-07-14","applyDate":"2026-06-25","status":"契約書類返送完備"},{"property":"ハイサニー","room":"B101","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2025-01-10","applyDate":"2024-12-07","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"208.0","broker":"エイブルNW倉敷水島店","staff":"合田","contractDate":"2025-01-14","applyDate":"2024-12-15","status":"契約書類返送完備"},{"property":"アルバ","room":"北108","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2025-01-15","applyDate":"2024-12-29","status":"契約書類返送完備"},{"property":"スパーブコート","room":"201.0","broker":"いえなび","staff":"山本","contractDate":"2025-02-01","applyDate":"2024-12-12","status":"キャンセル"},{"property":"タリスヴィータ","room":"B101","broker":"エイブルネットワークイオンモール倉敷店","staff":"宮内","contractDate":"2024-12-18","applyDate":"2024-10-08","status":"契約書類返送完備"},{"property":"アルバ","room":"北208","broker":"IREライフ株式会社","staff":"","contractDate":"2024-12-30","applyDate":"2024-12-17","status":"契約書類不備あり"},{"property":"ベラカーササウス","room":"501.0","broker":"ワイケイ　アパマン倉敷沖新","staff":"山足","contractDate":"2025-01-07","applyDate":"2024-12-07","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"607.0","broker":"株式会社スカイホーム","staff":"渡辺","contractDate":"2025-01-31","applyDate":"2025-01-17","status":"審査落ち"},{"property":"プレジール高橋","room":"106.0","broker":"株式会社アークス　エイブルＮＷ福山蔵王店","staff":"鏡内","contractDate":"","applyDate":"2025-01-07","status":"キャンセル"},{"property":"ベラカーサノース","room":"902.0","broker":"和幸産業　幸町店","staff":"大森","contractDate":"2025-01-11","applyDate":"2024-12-21","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"401.0","broker":"エイブル倉敷駅北","staff":"山本","contractDate":"2025-01-18","applyDate":"2025-01-04","status":"契約書類返送完備"},{"property":"一宮戸建て","room":"B","broker":"ＢＲＵＮＯ不動産株式会社","staff":"上林","contractDate":"2025-01-25","applyDate":"2024-11-08","status":"契約書類返送完備"},{"property":"スパーブコート","room":"201.0","broker":"IREライフ","staff":"","contractDate":"","applyDate":"2025-01-23","status":"キャンセル"},{"property":"タリスヴィータＡ","room":"202.0","broker":"株式会社さくらコーポレーションミニミニＦＣ倉敷店","staff":"中原","contractDate":"2025-01-23","applyDate":"2025-01-11","status":"契約書類返送完備"},{"property":"エルキュール","room":"Ｃ101","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2025-01-26","applyDate":"2024-12-16","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"803.0","broker":"株式会社アークス　エイブルネットワーク倉敷中庄店","staff":"仲島","contractDate":"2025-01-29","applyDate":"2025-01-11","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"406.0","broker":"ホーミィエステート株式会社　倉敷店","staff":"藤井","contractDate":"2025-01-31","applyDate":"2025-01-09","status":"契約書類返送完備"},{"property":"ヒラリアス","room":"201.0","broker":"エイブルNW福山蔵王","staff":"大塚","contractDate":"2025-02-01","applyDate":"2024-10-27","status":"契約書類返送完備"},{"property":"ヒラリアス","room":"103.0","broker":"IREライフ株式会社","staff":"","contractDate":"2025-02-01","applyDate":"2024-09-30","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"A203","broker":"エイブルネットワーク　倉敷中庄店","staff":"柳澤","contractDate":"2025-02-01","applyDate":"2024-12-04","status":"契約書類返送完備"},{"property":"ヒラリアス","room":"101.0","broker":"いえなび","staff":"宮路","contractDate":"2025-02-01","applyDate":"2024-12-21","status":"契約書類返送完備"},{"property":"アプリシティ","room":"303.0","broker":"ケイアイ　沖野上","staff":"馬場","contractDate":"2025-02-01","applyDate":"2024-12-23","status":"契約書類返送完備"},{"property":"テタンジェ","room":"106.0","broker":"(株)ワイケイ　アパマンショップ倉敷沖新店","staff":"山足","contractDate":"2025-01-29","applyDate":"2025-01-12","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"408.0","broker":"株式会社ワイケイアパマンショップ倉敷沖新店","staff":"松尾","contractDate":"2025-02-01","applyDate":"2025-01-14","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"101.0","broker":"東建コーポレーション（株）倉敷支店","staff":"新田","contractDate":"2025-01-26","applyDate":"2025-01-11","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"507.0","broker":"ＢＲＵＮＯ不動産株式会社　エイブルネットワーク庭瀬駅前店","staff":"福本","contractDate":"2025-02-05","applyDate":"2025-01-24","status":"契約書類返送完備"},{"property":"スパーブコート","room":"201.0","broker":"LIFUKU福山北店　中国バス不動産株式会社","staff":"野島","contractDate":"2025-02-08","applyDate":"2025-01-24","status":"契約書類返送完備"},{"property":"スピネル","room":"108.0","broker":"中国バス不動産　北店","staff":"野島","contractDate":"2025-02-10","applyDate":"2025-01-06","status":"契約書類返送完備"},{"property":"アメリア","room":"107.0","broker":"","staff":"","contractDate":"","applyDate":"2025-02-11","status":"審査落ち"},{"property":"タリスヴィータ","room":"Ａ101","broker":"ワイケイ　アパマン倉敷沖新","staff":"藤井","contractDate":"2025-01-18","applyDate":"2024-12-13","status":"契約書類返送完備"},{"property":"ヒラリアス","room":"102.0","broker":"IREライフ株式会社","staff":"","contractDate":"2025-02-15","applyDate":"2024-09-30","status":"契約書類返送完備"},{"property":"アロモント","room":"A101","broker":"ケイアイホーム　神辺","staff":"坂井","contractDate":"2025-02-15","applyDate":"2024-12-10","status":"契約書類返送完備"},{"property":"ソフィア","room":"103.0","broker":"アヤカホーム","staff":"村上","contractDate":"","applyDate":"2025-02-14","status":"審査落ち"},{"property":"フローレンス南蔵王","room":"1F北","broker":"中国バス不動産　LIFUKU福山売買センター","staff":"山崎","contractDate":"2025-02-11","applyDate":"2024-12-13","status":"契約書類返送完備"},{"property":"プレジール高橋","room":"106.0","broker":"エイブルNW福山蔵王店","staff":"佐々木","contractDate":"2025-02-15","applyDate":"2025-01-27","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"408.0","broker":"ホーミィエステート株式会社　倉敷駅前店","staff":"矢野","contractDate":"2025-02-22","applyDate":"2025-01-25","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"210.0","broker":"ケイアイ沖野上","staff":"藤井","contractDate":"2025-03-20","applyDate":"2025-02-19","status":"キャンセル"},{"property":"ソアヴィータ","room":"203.0","broker":"いえなび","staff":"山本","contractDate":"2025-04-12","applyDate":"2025-02-21","status":"審査落ち"},{"property":"ベラカーサノース","room":"805.0","broker":"エイブルネットワーク倉敷中庄店","staff":"仲島","contractDate":"2025-02-26","applyDate":"2025-01-31","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"705.0","broker":"株式会社穴吹ハウジングサービス","staff":"堤","contractDate":"2025-02-28","applyDate":"2025-02-10","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"301.0","broker":"ＢＲＵＮＯ不動産株式会社　エイブルＮＷ総社","staff":"平田","contractDate":"2025-03-01","applyDate":"","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"201.0","broker":"株式会社アークス　エイブルネットワーク倉敷駅北店","staff":"山本","contractDate":"2025-03-01","applyDate":"2025-01-11","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"508.0","broker":"ホーミィエステート株式会社　倉敷店","staff":"小林","contractDate":"2025-03-01","applyDate":"2025-01-25","status":"契約書類返送完備"},{"property":"セラータ","room":"101.0","broker":"エイブルＮＷ神辺店","staff":"大塚（代理　難波）","contractDate":"2025-03-01","applyDate":"2025-01-15","status":"契約書類返送完備"},{"property":"スピネルデュオ","room":"101.0","broker":"中国バス不動産　北店","staff":"宗政","contractDate":"2025-01-31","applyDate":"2024-11-03","status":"契約書類返送完備"},{"property":"アロモント","room":"B202","broker":"株式会社タカハシアパマンショップ福山松永店","staff":"佐藤","contractDate":"2025-02-28","applyDate":"2025-01-14","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"201.0","broker":"株式会社アークス　エイブルネットワークイオンモール倉敷店","staff":"鳥越","contractDate":"2025-03-01","applyDate":"2025-01-10","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"607.0","broker":"株式会社アークス　エイブルネットワークイオンモール倉敷店","staff":"鳥越","contractDate":"2025-03-01","applyDate":"2025-01-27","status":"契約書類返送完備"},{"property":"ハルモニア","room":"102.0","broker":"いえなび","staff":"山本","contractDate":"2025-03-01","applyDate":"2025-02-02","status":"契約書類返送完備"},{"property":"アシンプトート","room":"A203","broker":"トリコム","staff":"河野","contractDate":"","applyDate":"2025-02-22","status":"キャンセル"},{"property":"グロリオサ","room":"602.0","broker":"トリコム","staff":"河野","contractDate":"2025-03-01","applyDate":"2025-02-22","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"305.0","broker":"株式会社アークス エイブルネットワーク倉敷駅北店","staff":"田川","contractDate":"2025-02-01","applyDate":"2025-01-22","status":"契約書類返送完備"},{"property":"ソフィア","room":"103.0","broker":"エイブルＮＷ福山南蔵王","staff":"佐々木","contractDate":"2025-03-01","applyDate":"2025-02-16","status":"契約書類返送完備"},{"property":"アメリア","room":"105.0","broker":"アフィット不動産","staff":"箱崎","contractDate":"2025-03-07","applyDate":"2025-02-14","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"703.0","broker":"IREライフ","staff":"","contractDate":"2025-03-16","applyDate":"2025-02-26","status":"契約書類返送完備"},{"property":"ラコリーヌ","room":"A201","broker":"ライフ","staff":"","contractDate":"","applyDate":"2025-03-08","status":"キャンセル"},{"property":"プティメゾン","room":"202.0","broker":"ケイアイ沖野上","staff":"藤井","contractDate":"2025-03-11","applyDate":"2025-02-19","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"702.0","broker":"ホーミィエステート　倉敷駅前店","staff":"藤井","contractDate":"2025-03-10","applyDate":"2025-02-23","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"303.0","broker":"株式会社アークス　エイブルネットワーク倉敷駅北店","staff":"山本","contractDate":"2025-03-15","applyDate":"2025-01-12","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"405.0","broker":"良和ハウス　岡山中央店","staff":"古田","contractDate":"2025-03-15","applyDate":"2025-02-15","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"205.0","broker":"㈱ワイケイ　倉敷駅前店","staff":"藤原","contractDate":"2025-03-15","applyDate":"2025-02-24","status":"契約書類返送完備"},{"property":"グロリオサ","room":"301.0","broker":"ケイアイ　神辺","staff":"小葉竹","contractDate":"2025-03-15","applyDate":"2025-02-22","status":"契約書類返送完備"},{"property":"ノブリス","room":"B103","broker":"ケイアイ駅前","staff":"萬代","contractDate":"2025-03-16","applyDate":"2025-02-21","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"203.0","broker":"エイブルNW倉敷中庄店","staff":"仲島","contractDate":"2025-03-18","applyDate":"2025-01-21","status":"契約書類返送完備"},{"property":"アロモント","room":"A203","broker":"IREライフ","staff":"","contractDate":"2025-03-15","applyDate":"2025-01-23","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"510.0","broker":"㈱アークス　エイブル倉敷駅北店","staff":"山本","contractDate":"2025-04-10","applyDate":"2025-03-04","status":"キャンセル"},{"property":"プレジール髙橋","room":"205.0","broker":"いえなび","staff":"宮路","contractDate":"2025-03-15","applyDate":"2025-02-09","status":"契約書類返送完備"},{"property":"アシンプトート","room":"A203","broker":"㈲山陽不動産","staff":"西原","contractDate":"2025-03-15","applyDate":"2025-03-03","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"210.0","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2025-03-18","applyDate":"2025-02-25","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"805.0","broker":"株式会社アークス エイブルネットワーク倉敷駅北店","staff":"田川","contractDate":"2025-03-19","applyDate":"2025-01-23","status":"契約書類返送完備"},{"property":"スパーブコート","room":"102.0","broker":"いえなび","staff":"山本","contractDate":"2025-03-28","applyDate":"2025-03-08","status":"キャンセル"},{"property":"アルバ","room":"北210","broker":"ライフ","staff":"","contractDate":"2025-03-22","applyDate":"2025-03-07","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"1003.0","broker":"エイブル倉敷市役所前店","staff":"木下","contractDate":"2025-03-25","applyDate":"2025-02-25","status":"契約書類返送完備"},{"property":"フレンディア常光","room":"Ａ101","broker":"エイブル神辺","staff":"大塚","contractDate":"","applyDate":"2025-03-21","status":"審査落ち"},{"property":"ベラカーササウス","room":"302.0","broker":"エイブルNW神辺","staff":"難波","contractDate":"2025-03-26","applyDate":"2025-02-19","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"407.0","broker":"ピタットハウス新倉敷店","staff":"鳥越","contractDate":"2025-03-11","applyDate":"2025-02-04","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"206.0","broker":"タイヨウエステート","staff":"岡山","contractDate":"2025-03-29","applyDate":"2025-03-20","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"902.0","broker":"エイブル倉敷市役所前店","staff":"中川","contractDate":"2025-03-30","applyDate":"2025-02-27","status":"契約書類返送完備"},{"property":"アルバ","room":"北110","broker":"ライフ","staff":"","contractDate":"2025-04-01","applyDate":"2025-03-17","status":"契約書類返送完備"},{"property":"アシンプトート","room":"Ａ301","broker":"トリコム","staff":"山田","contractDate":"2025-03-22","applyDate":"2025-03-14","status":"契約書類返送完備"},{"property":"スピネルデュオ","room":"106.0","broker":"エイブル神辺","staff":"大塚","contractDate":"","applyDate":"2025-03-30","status":"審査落ち"},{"property":"ベラカーサフェリーチェ","room":"602.0","broker":"大東建託リーシング株式会社　倉敷店","staff":"篠原","contractDate":"2025-03-29","applyDate":"2025-02-21","status":"契約書類返送完備"},{"property":"ソアヴィータ","room":"203.0","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2025-03-31","applyDate":"2025-03-20","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"601.0","broker":"株式会社さくらコーポレーションミニミニFC倉敷店","staff":"中原","contractDate":"2025-03-20","applyDate":"2025-02-13","status":"契約書類返送完備"},{"property":"ラコリーヌ","room":"B202","broker":"アパマンショップ福山東インター南店","staff":"川上","contractDate":"2025-04-01","applyDate":"2025-03-01","status":"契約書類返送完備"},{"property":"カルムコート","room":"東208","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2025-04-27","applyDate":"2025-04-01","status":"審査落ち"},{"property":"クラリス","room":"107.0","broker":"トリコム","staff":"山田","contractDate":"2025-04-01","applyDate":"2025-02-27","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"306.0","broker":"アパマンショップ倉敷白楽町店","staff":"高田","contractDate":"2025-04-05","applyDate":"2025-02-25","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"Ｂ111","broker":"エイブルＮＷ神辺","staff":"大塚","contractDate":"","applyDate":"2025-04-12","status":"審査落ち"},{"property":"フェリックス","room":"201.0","broker":"ケイアイ　沖野上店","staff":"藤井","contractDate":"2025-03-29","applyDate":"2025-03-10","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"1007.0","broker":"あすみらい株式会社","staff":"恵","contractDate":"2025-04-10","applyDate":"2025-02-25","status":"契約書類返送完備"},{"property":"ハルモニア","room":"103.0","broker":"エイブル神辺","staff":"鏡内","contractDate":"2025-04-10","applyDate":"2025-03-20","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"903.0","broker":"株式会社一矢　三恵不動産","staff":"山本","contractDate":"2025-04-12","applyDate":"2025-03-19","status":"契約書類返送完備"},{"property":"スパーブコート","room":"101.0","broker":"アムス・インターナショナル株式会社","staff":"延藤","contractDate":"2025-04-14","applyDate":"2025-03-11","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"A201","broker":"ケイアイ神辺","staff":"坂井","contractDate":"2025-04-14","applyDate":"2025-04-03","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"401.0","broker":"ＢＲＵＮＯ不動産株式会　エイブルネットワーク庭瀬駅前店","staff":"福本","contractDate":"2025-04-15","applyDate":"2025-03-23","status":"契約書類返送完備"},{"property":"ソレイユ","room":"西103","broker":"トリコム","staff":"山田","contractDate":"2025-03-31","applyDate":"2025-03-14","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"110.0","broker":"アパマンショップ福山駅前店","staff":"萬代","contractDate":"2025-03-27","applyDate":"2025-03-20","status":"契約書類返送完備"},{"property":"グロリオサ","room":"501.0","broker":"ケイアイ沖野上","staff":"馬場","contractDate":"2025-04-15","applyDate":"2025-02-21","status":"契約書類返送完備"},{"property":"アイディール","room":"105.0","broker":"ライフ","staff":"","contractDate":"2025-04-19","applyDate":"2025-03-13","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"205.0","broker":"株式会社一矢　三恵不動産","staff":"山本","contractDate":"2025-04-19","applyDate":"2025-03-20","status":"契約書類返送完備"},{"property":"マーベラス","room":"Ｂ102","broker":"トリコム","staff":"山田","contractDate":"2025-04-15","applyDate":"2025-03-13","status":"契約書類返送完備"},{"property":"アルバ","room":"南103","broker":"ハマ不動産","staff":"藤井","contractDate":"2025-03-29","applyDate":"2025-03-17","status":"契約書類返送完備"},{"property":"曙町戸建","room":"Ｆ","broker":"佐藤エステート","staff":"大植","contractDate":"2025-04-24","applyDate":"2025-03-24","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"1005.0","broker":"アパマンショップ倉敷水島店","staff":"鎌田","contractDate":"2025-03-31","applyDate":"2025-03-05","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"1002.0","broker":"アパマンショップ水島店","staff":"栗元","contractDate":"2025-03-31","applyDate":"2025-03-20","status":"契約書類返送完備"},{"property":"メゾンドリヴァージュ","room":"A201","broker":"穴吹ﾊｳｼﾞﾝｸﾞｻｰﾋﾞｽ","staff":"伊東","contractDate":"2025-05-07","applyDate":"2025-04-17","status":"キャンセル"},{"property":"ベラカーササウス","room":"1001.0","broker":"ＢＲＵＮＯ不動産株式会社　エイブルネットワーク総社店","staff":"平田","contractDate":"2025-04-25","applyDate":"2025-03-18","status":"契約書類返送完備"},{"property":"グロリオサ","room":"401.0","broker":"ハマ不動産","staff":"藤井","contractDate":"2025-04-25","applyDate":"2025-04-04","status":"契約書類返送完備"},{"property":"アルデバラン","room":"A202","broker":"エイブル蔵王","staff":"佐々木","contractDate":"2025-04-25","applyDate":"2025-04-15","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"203.0","broker":"ケイアイ福山駅前店","staff":"友滝","contractDate":"2025-04-26","applyDate":"2025-04-07","status":"契約書類返送完備"},{"property":"グロリオサ","room":"503.0","broker":"トリコム","staff":"河野","contractDate":"2025-05-01","applyDate":"2025-03-22","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"201.0","broker":"㈱ケイアイ福山駅前店","staff":"萬代","contractDate":"2025-04-19","applyDate":"2025-04-09","status":"契約書類返送完備"},{"property":"エルキュール","room":"C205","broker":"いえなび","staff":"山本","contractDate":"","applyDate":"2025-04-27","status":"審査落ち"},{"property":"ベラカーサフェリーチェ","room":"410.0","broker":"株式会社一矢　三恵不動産","staff":"山本","contractDate":"2025-04-30","applyDate":"2025-03-30","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"207.0","broker":"㈱タカハシ　インター南店","staff":"藤井","contractDate":"2025-05-01","applyDate":"2025-04-24","status":"契約書類返送完備"},{"property":"アルデバラン","room":"A101","broker":"有限会社佐藤不動産","staff":"佐藤","contractDate":"2025-04-28","applyDate":"2025-04-21","status":"契約書類返送完備"},{"property":"ラコリーヌ","room":"A201","broker":"いえなび","staff":"山本","contractDate":"","applyDate":"2025-04-30","status":"審査落ち"},{"property":"ディアレスト","room":"203.0","broker":"いえなび","staff":"山本","contractDate":"2025-05-01","applyDate":"2025-03-27","status":"契約書類返送完備"},{"property":"アプリシティ","room":"105.0","broker":"大東建託リーシング株式会社","staff":"田村","contractDate":"2025-05-09","applyDate":"2025-04-12","status":"契約書類返送完備"},{"property":"アルデバラン","room":"B105","broker":"ごゆう不動産株式会社","staff":"内山","contractDate":"2025-05-10","applyDate":"2025-04-26","status":"契約書類返送完備"},{"property":"アメリア","room":"107.0","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2025-05-15","applyDate":"2025-04-21","status":"契約書類返送完備"},{"property":"アルデバラン","room":"A105","broker":"エイブルＮＷ福山蔵王店","staff":"佐々木","contractDate":"2025-05-15","applyDate":"2025-04-26","status":"契約書類返送完備"},{"property":"タラッサ","room":"201.0","broker":"東建コーポレーション　倉敷店","staff":"板谷","contractDate":"2025-03-26","applyDate":"2025-03-09","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"B111","broker":"いえなび","staff":"高木","contractDate":"","applyDate":"2025-05-13","status":"審査落ち"},{"property":"ガーデンヒルズ長者町","room":"208.0","broker":"ケイアイ福山駅前店","staff":"萬代","contractDate":"2025-05-01","applyDate":"2025-04-17","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"603.0","broker":"東建コーポレーション㈱倉敷支店","staff":"藤原","contractDate":"2025-05-20","applyDate":"2025-04-15","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"903.0","broker":"株式会社穴吹ハウジングサービス倉敷店","staff":"堤","contractDate":"2025-04-05","applyDate":"2025-03-12","status":"契約書類返送完備"},{"property":"ルミエール静","room":"A202","broker":"大東建託リーシング","staff":"平田","contractDate":"2025-05-24","applyDate":"2025-04-29","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"905.0","broker":"株式会社穴吹ハウジングサービス倉敷店","staff":"堤","contractDate":"2025-03-23","applyDate":"2025-02-28","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"301.0","broker":"(株)穴吹ハウジングサービス　倉敷店","staff":"村木","contractDate":"2025-04-10","applyDate":"2025-03-17","status":"契約書類返送完備"},{"property":"アルデバラン","room":"B101","broker":"中国バス不動産　南店","staff":"光吉","contractDate":"2025-05-26","applyDate":"2025-05-01","status":"契約書類返送完備"},{"property":"アルカンシェル","room":"A106","broker":"ケイアイ福山駅","staff":"友滝","contractDate":"2025-06-01","applyDate":"2025-05-13","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"103.0","broker":"ケイアイ沖野上","staff":"藤井","contractDate":"2025-05-31","applyDate":"2025-05-18","status":"契約書類返送完備"},{"property":"アプリシティ","room":"306.0","broker":"ケイアイ沖野上","staff":"馬場","contractDate":"2025-05-31","applyDate":"2025-04-11","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"401.0","broker":"ケイアイ白楽町店","staff":"今村","contractDate":"2025-05-31","applyDate":"2025-04-30","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"Ｂ106","broker":"エイブルネットワーク神辺店","staff":"寺岡","contractDate":"2025-06-23","applyDate":"2025-05-28","status":"審査落ち"},{"property":"アプリシティ","room":"101.0","broker":"大東建託リーシング","staff":"平田","contractDate":"2025-05-17","applyDate":"2025-04-01","status":"契約書類返送完備"},{"property":"シンティランテ","room":"201.0","broker":"エイブル蔵王","staff":"藤井","contractDate":"2025-05-31","applyDate":"2025-04-02","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"A103","broker":"エステート高橋","staff":"福間","contractDate":"2025-06-01","applyDate":"2025-05-06","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"510.0","broker":"ケイアイ白楽町","staff":"今村","contractDate":"2025-04-26","applyDate":"2025-04-10","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"210.0","broker":"株式会社ワイケイ　アパマンショップ倉敷沖新店","staff":"上田","contractDate":"2025-05-19","applyDate":"2025-04-21","status":"契約書類返送完備"},{"property":"ヒラリアス","room":"201.0","broker":"いい部屋ネット北店","staff":"","contractDate":"","applyDate":"2025-05-30","status":"審査落ち"},{"property":"ガーデンヒルズ長者町","room":"211.0","broker":"㈱タカハシ　インター南店","staff":"山上","contractDate":"2025-04-17","applyDate":"2025-04-07","status":"契約書類返送完備"},{"property":"スパーブコート","room":"102.0","broker":"エイブル神辺","staff":"鏡内","contractDate":"2025-06-01","applyDate":"2025-05-18","status":"契約書類返送完備"},{"property":"アルデバラン","room":"B103","broker":"住まいのクエスト","staff":"富田","contractDate":"2025-06-29","applyDate":"2025-06-02","status":"キャンセル"},{"property":"アロモント","room":"B103","broker":"株式会社タカハシ　東尾道駅前店","staff":"新宅","contractDate":"2025-06-13","applyDate":"2025-05-17","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"403.0","broker":"エイブルNW倉敷市役所前店　株式会社アークス","staff":"","contractDate":"2025-06-13","applyDate":"2025-05-19","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"906.0","broker":"あくら不動産株式会社","staff":"山本","contractDate":"2025-06-15","applyDate":"2025-05-20","status":"契約書類返送完備"},{"property":"アルデバラン","room":"B102","broker":"カウ不動産","staff":"佐藤","contractDate":"2025-06-21","applyDate":"2025-05-30","status":"契約書類返送完備"},{"property":"テラストリア","room":"107.0","broker":"オリゾン株式会社","staff":"石原","contractDate":"","applyDate":"2025-06-12","status":"審査落ち"},{"property":"テラストリア","room":"106.0","broker":"株式会社 タカハシ","staff":"肌野","contractDate":"","applyDate":"2025-06-14","status":"審査落ち"},{"property":"ミラヴィルタス西棟 102","room":"西102","broker":"中国バス不動産株式会社","staff":"山田","contractDate":"2025-06-17","applyDate":"2025-05-30","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"A202","broker":"エイブルNW倉敷市役所前店","staff":"柳澤","contractDate":"2025-06-22","applyDate":"2025-06-07","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"402.0","broker":"東建コーポレーション（株）倉敷支店","staff":"新田","contractDate":"2025-06-26","applyDate":"2025-06-06","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"205.0","broker":"ケイアイ福山駅前店","staff":"友滝","contractDate":"2025-04-07","applyDate":"2025-03-28","status":"契約書類返送完備"},{"property":"ラコリーヌ","room":"A201","broker":"ケイアイ福山駅前店","staff":"萬代","contractDate":"2025-06-27","applyDate":"2025-05-10","status":"契約書類返送完備"},{"property":"ハイサニー","room":"B201","broker":"大東建託リーシング株式会社 福山店","staff":"山田","contractDate":"2025-06-27","applyDate":"2025-06-09","status":"契約書類返送完備"},{"property":"セラータ","room":"110.0","broker":"株式会社 My　Room","staff":"吉本","contractDate":"2025-06-28","applyDate":"2025-06-01","status":"契約書類返送完備"},{"property":"アルデバラン","room":"B202","broker":"オリゾン株式会社　いい部屋ネット福山北店","staff":"森原","contractDate":"2025-06-14","applyDate":"2025-05-08","status":"契約書類返送完備"},{"property":"アルカンシェル","room":"A102","broker":"中国バス不動産　福山店","staff":"岡川","contractDate":"2025-06-30","applyDate":"2025-05-19","status":"契約書類返送完備"},{"property":"カルムコート","room":"東208","broker":"大東建託リーシング","staff":"平田","contractDate":"2025-05-31","applyDate":"2025-05-10","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"111.0","broker":"ケイアイ沖野上","staff":"大渡","contractDate":"2025-03-30","applyDate":"2025-03-13","status":"契約書類返送完備"},{"property":"スピネルデュオ","room":"106.0","broker":"エイブル神辺","staff":"鏡内","contractDate":"2025-06-25","applyDate":"2025-05-15","status":"契約書類返送完備"},{"property":"テラストリア","room":"205.0","broker":"株式会社タカハシ　東尾道駅前店","staff":"肌野","contractDate":"2025-07-01","applyDate":"2025-06-06","status":"契約書類返送完備"},{"property":"ルミエール静","room":"A201","broker":"大東建託リーシング株式会社 福山店","staff":"平田","contractDate":"2025-06-30","applyDate":"2025-06-08","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"502.0","broker":"株式会社 ワイケイ　倉敷沖新店","staff":"松尾","contractDate":"2025-06-30","applyDate":"2025-06-08","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"201.0","broker":"エイブルNW倉敷中庄店　株式会社アークス","staff":"仲島","contractDate":"2025-07-01","applyDate":"2025-06-10","status":"契約書類返送完備"},{"property":"テラストリア","room":"203.0","broker":"オリゾン株式会社","staff":"石原","contractDate":"2025-07-01","applyDate":"2025-06-08","status":"契約書類返送完備"},{"property":"アイディール","room":"102.0","broker":"いえなび","staff":"高木","contractDate":"2025-04-28","applyDate":"2025-04-15","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"B106","broker":"エイブル蔵王","staff":"藤井","contractDate":"2025-07-31","applyDate":"2025-06-24","status":"審査落ち"},{"property":"アルデバラン","room":"A102","broker":"大東建託リーシング株式会社　ﾌｸﾔﾏﾃﾝ","staff":"近藤","contractDate":"2025-06-29","applyDate":"2025-06-23","status":"契約書類返送完備"},{"property":"アルデバラン","room":"A206","broker":"不動産の岩原","staff":"岩原","contractDate":"2025-07-01","applyDate":"2025-06-10","status":"契約書類返送完備"},{"property":"スピネルデュオ","room":"101.0","broker":"有限会社山陽不動産","staff":"西原","contractDate":"2025-07-02","applyDate":"2025-06-13","status":"契約書類返送完備"},{"property":"サントーシャ","room":"201.0","broker":"ライフ","staff":"","contractDate":"2025-07-01","applyDate":"2025-05-15","status":"契約書類返送完備"},{"property":"グロリオサ","room":"603.0","broker":"大東建託リーシング株式会社","staff":"平田","contractDate":"2025-06-21","applyDate":"2025-06-02","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"202.0","broker":"いえなび","staff":"高木","contractDate":"2025-06-30","applyDate":"2025-05-10","status":"契約書類返送完備"},{"property":"テラストリア","room":"202.0","broker":"株式会社ケイアイホーム沖野上店","staff":"馬場","contractDate":"2025-07-01","applyDate":"2025-06-10","status":"契約書類返送完備"},{"property":"テラストリア","room":"106.0","broker":"エイブル神辺","staff":"大塚","contractDate":"2025-07-01","applyDate":"2025-06-17","status":"契約書類返送完備"},{"property":"曙町戸建","room":"B","broker":"佐藤エステート","staff":"津組","contractDate":"2025-07-01","applyDate":"2025-06-14","status":"契約書類返送完備"},{"property":"プレジール高橋","room":"203.0","broker":"ケイアイ福山駅前店","staff":"友滝","contractDate":"2025-07-01","applyDate":"2025-06-18","status":"契約書類返送完備"},{"property":"フレンディア常光","room":"A101","broker":"ライフ","staff":"","contractDate":"2025-07-01","applyDate":"2025-06-23","status":"契約書類返送完備"},{"property":"テラストリア","room":"102.0","broker":"株式会社タカハシ　松永店","staff":"坂本","contractDate":"2025-07-01","applyDate":"2025-06-26","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"301.0","broker":"エイブル倉敷市役所前店","staff":"中川","contractDate":"2025-07-03","applyDate":"2025-06-21","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"303.0","broker":"エイブルネットワーク庭瀬駅前店","staff":"福本","contractDate":"2025-07-04","applyDate":"2025-06-05","status":"契約書類返送完備"},{"property":"テラストリア","room":"207.0","broker":"IREライフ","staff":"","contractDate":"2025-07-01","applyDate":"2025-06-03","status":"契約書類返送完備"},{"property":"テラストリア","room":"101.0","broker":"ライフ","staff":"","contractDate":"2025-07-01","applyDate":"2025-06-17","status":"契約書類返送完備"},{"property":"テラストリア","room":"206.0","broker":"株式会社タカハシ　東尾道駅前店","staff":"肌野","contractDate":"2025-07-06","applyDate":"2025-05-23","status":"契約書類返送完備"},{"property":"アルファステイツ福山駅前Ⅱ","room":"204.0","broker":"エイブルNW福山駅前店","staff":"難波","contractDate":"2025-08-01","applyDate":"2025-06-21","status":"キャンセル"},{"property":"ノブリス","room":"A101","broker":"中国バス不動産　福山店","staff":"光吉","contractDate":"2025-09-01","applyDate":"2025-07-03","status":"キャンセル"},{"property":"アルデバラン","room":"A203","broker":"いえなび","staff":"高木","contractDate":"2025-06-01","applyDate":"2025-05-18","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"603.0","broker":"株式会社ネクステージホーム","staff":"小出","contractDate":"2025-06-29","applyDate":"2025-06-01","status":"契約書類返送完備"},{"property":"テタンジェ","room":"103.0","broker":"株式会社 ケイアイホーム倉敷インター南店","staff":"飛田","contractDate":"2025-08-01","applyDate":"2025-07-06","status":"キャンセル"},{"property":"タラッサ","room":"110.0","broker":"ＢＲＵＮＯ不動産 株式会社エイブルネットワーク総社店","staff":"平田","contractDate":"2025-08-20","applyDate":"2025-06-22","status":"キャンセル"},{"property":"メゾンドリヴァージュ","room":"A201","broker":"いえなび","staff":"宮地","contractDate":"2025-07-13","applyDate":"2025-06-15","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"606.0","broker":"ホーミィエステート 株式会社本店","staff":"","contractDate":"","applyDate":"2025-07-10","status":"審査落ち"},{"property":"ベラカーサノース","room":"1001.0","broker":"ホーミィエステート㈱　倉敷駅前店","staff":"上田","contractDate":"2025-06-20","applyDate":"2025-05-26","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"406.0","broker":"ケイアイ白楽町","staff":"左京","contractDate":"2025-06-28","applyDate":"2025-05-16","status":"契約書類返送完備"},{"property":"ユニキューブ浦上","room":"前","broker":"いえなび","staff":"山本","contractDate":"2025-07-15","applyDate":"2025-06-25","status":"契約書類返送完備"},{"property":"テラストリア","room":"107.0","broker":"オリゾン","staff":"石原","contractDate":"2025-07-19","applyDate":"2025-06-23","status":"契約書類返送完備"},{"property":"上富井戸建","room":"東","broker":"エイブルネットワーク倉敷市役所前店","staff":"岡野","contractDate":"2025-07-11","applyDate":"2025-06-07","status":"契約書類返送完備"},{"property":"シティハイツ暁の星","room":"102.0","broker":"ライフ","staff":"","contractDate":"2025-07-14","applyDate":"2025-07-08","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"201.0","broker":"株式会社ケイアイホーム　倉敷白楽町店","staff":"","contractDate":"2025-06-28","applyDate":"2025-06-05","status":"契約書類返送完備"},{"property":"ハイサニー","room":"B102","broker":"ライフ","staff":"","contractDate":"2025-07-24","applyDate":"2025-06-20","status":"契約書類返送完備"},{"property":"テラストリア","room":"105.0","broker":"株式会社タカハシ　東尾道駅前店","staff":"肌野","contractDate":"2025-07-24","applyDate":"2025-06-26","status":"契約書類返送完備"},{"property":"アルデバラン","room":"B103","broker":"いえなび","staff":"宮地","contractDate":"2025-08-01","applyDate":"2025-07-17","status":"審査落ち"},{"property":"アルヴィータ","room":"B106","broker":"エイブル神辺","staff":"鏡内","contractDate":"2025-07-26","applyDate":"2025-06-28","status":"契約書類返送完備"},{"property":"アルデバラン","room":"A201","broker":"オリゾン","staff":"石原","contractDate":"2025-07-27","applyDate":"2025-06-28","status":"契約書類返送完備"},{"property":"アプリシティ","room":"301.0","broker":"株式会社 ケイアイホーム福山駅前店","staff":"友滝","contractDate":"2025-07-30","applyDate":"2025-07-21","status":"契約書類返送完備"},{"property":"テラストリア","room":"103.0","broker":"ケイアイ　三原店","staff":"裏崎","contractDate":"2025-08-01","applyDate":"2025-06-26","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"301.0","broker":"エイブルNW倉敷駅北店","staff":"鳥越","contractDate":"2025-08-01","applyDate":"2025-06-08","status":"契約書類返送完備"},{"property":"S place bld.","room":"501.0","broker":"ＢＲＵＮＯ不動産 株式会社エイブルネットワーク総社店","staff":"平田","contractDate":"2025-08-01","applyDate":"2025-06-29","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"606.0","broker":"株式会社 ワイケイ倉敷沖新店","staff":"下元","contractDate":"2025-08-01","applyDate":"2025-07-19","status":"契約書類返送完備"},{"property":"セラータ","room":"201.0","broker":"大東建託リーシング株式会社","staff":"山田","contractDate":"2025-07-29","applyDate":"2025-06-17","status":"契約書類返送完備"},{"property":"アルカディア","room":"D102","broker":"ケイアイ沖野上","staff":"馬場","contractDate":"2025-07-30","applyDate":"2025-07-24","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"B111","broker":"大東建託リーシング株式会社 福山店","staff":"近藤","contractDate":"2025-08-01","applyDate":"2025-06-29","status":"契約書類返送完備"},{"property":"テラストリア","room":"201.0","broker":"いえなび","staff":"宮地","contractDate":"2025-08-01","applyDate":"2025-07-06","status":"契約書類返送完備"},{"property":"カルムコート","room":"東106","broker":"いえなび","staff":"藤川","contractDate":"2025-08-01","applyDate":"2025-07-14","status":"契約書類返送完備"},{"property":"アルデバラン","room":"A205","broker":"中国バス不動産　南店","staff":"光吉","contractDate":"2025-08-01","applyDate":"2025-07-16","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"A201","broker":"大東建託リーシング株式会社　福山店","staff":"山田","contractDate":"2025-07-29","applyDate":"2025-07-15","status":"契約書類返送完備"},{"property":"アルファステイツ福山駅前Ⅱ","room":"204.0","broker":"ライフ","staff":"","contractDate":"2025-08-01","applyDate":"2025-07-24","status":"契約書類返送完備"},{"property":"ヒラリアス","room":"201.0","broker":"佐藤エステート","staff":"大元","contractDate":"2025-08-08","applyDate":"2025-07-24","status":"契約書類返送完備"},{"property":"メリッサ","room":"201.0","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2025-08-08","applyDate":"2025-07-26","status":"契約書類返送完備"},{"property":"セラータ","room":"103.0","broker":"エイブルＮＷ福山蔵王店　株式会社アークス","staff":"兼田","contractDate":"2025-08-10","applyDate":"2025-06-30","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"302.0","broker":"エイブルネットワーク総社店","staff":"鷺原","contractDate":"2025-08-18","applyDate":"2025-07-18","status":"契約書類返送完備"},{"property":"エバーグリーン福山西町","room":"302.0","broker":"ＬｉｆｅＶｉｓｉｏｎ 株式会社本店","staff":"坂本","contractDate":"2025-08-20","applyDate":"2025-07-28","status":"契約書類返送完備"},{"property":"セラータ","room":"101.0","broker":"いえなび","staff":"高木","contractDate":"2025-08-16","applyDate":"2025-08-01","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"A106","broker":"株式会社 ワイケイ新倉敷駅前店","staff":"栗木","contractDate":"2025-08-23","applyDate":"2025-07-12","status":"契約書類返送完備"},{"property":"ミラヴィルタス","room":"西103","broker":"いえなび","staff":"山本","contractDate":"2025-06-01","applyDate":"2025-05-07","status":"契約書類返送完備"},{"property":"アルデバラン","room":"Ａ106","broker":"いえなび","staff":"宮地","contractDate":"2025-09-01","applyDate":"2025-07-27","status":"キャンセル"},{"property":"スピネル","room":"202.0","broker":"エイブルNW福山駅前店","staff":"佐々木","contractDate":"2025-08-29","applyDate":"2025-06-30","status":"契約書類返送完備"},{"property":"アプリシティ","room":"305.0","broker":"不動産の岩原","staff":"岩原","contractDate":"2025-08-27","applyDate":"2025-08-10","status":"契約書類返送完備"},{"property":"プティメゾン","room":"102.0","broker":"ライフ","staff":"","contractDate":"2025-09-01","applyDate":"2025-08-25","status":"契約書類返送完備"},{"property":"マルヴィナ","room":"103.0","broker":"ＬｉｆｅＶｉｓｉｏｎ 株式会社本店","staff":"坂本","contractDate":"2025-08-31","applyDate":"2025-07-20","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"605.0","broker":"エイブルNW倉敷市役所前店","staff":"岡野","contractDate":"2025-09-01","applyDate":"2025-07-14","status":"契約書類返送完備"},{"property":"マルヴィナ","room":"105.0","broker":"中国バス不動産　福山店","staff":"宗政","contractDate":"2025-09-01","applyDate":"2025-07-20","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"803.0","broker":"エイブルNW倉敷駅北店","staff":"鳥越","contractDate":"2025-09-01","applyDate":"2025-07-16","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"602.0","broker":"あびこ不動産","staff":"藤井","contractDate":"2025-09-01","applyDate":"2025-08-01","status":"契約書類返送完備"},{"property":"タラッサ","room":"102.0","broker":"エイブルNW倉敷水島店","staff":"藤本","contractDate":"2025-09-01","applyDate":"2025-08-17","status":"契約書類返送完備"},{"property":"シャンティ","room":"101.0","broker":"いえなび福山多治米店","staff":"宮地","contractDate":"2025-08-19","applyDate":"2025-08-02","status":"契約書類返送完備"},{"property":"マルヴィナ","room":"201.0","broker":"いえなび多治米店","staff":"宮地","contractDate":"2025-09-01","applyDate":"2025-08-17","status":"契約書類返送完備"},{"property":"ソルトグラス","room":"110.0","broker":"ライフ","staff":"","contractDate":"2025-09-01","applyDate":"2025-07-29","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"1003.0","broker":"ミニミニFC倉敷店","staff":"中原","contractDate":"2025-09-07","applyDate":"2025-08-19","status":"契約書類返送完備"},{"property":"メリッサ","room":"205.0","broker":"エイブルＮＷ福山蔵王店","staff":"藤井","contractDate":"2025-10-01","applyDate":"2025-08-21","status":"キャンセル"},{"property":"ガーデンヒルズ長者町","room":"105.0","broker":"ライフ","staff":"","contractDate":"2025-07-10","applyDate":"2025-07-08","status":"契約書類返送完備"},{"property":"エルキュール","room":"Ｃ205","broker":"山陽不動産","staff":"西原","contractDate":"2025-08-17","applyDate":"2025-08-03","status":"契約書類返送完備"},{"property":"メゾンドリヴァージュ","room":"Ａ203","broker":"遠藤不動産","staff":"","contractDate":"","applyDate":"2025-09-03","status":"審査落ち"},{"property":"タラッサ","room":"110.0","broker":"ネクステージホーム","staff":"松本","contractDate":"2025-09-01","applyDate":"2025-08-02","status":"契約書類返送完備"},{"property":"メリッサ","room":"101.0","broker":"トリコム","staff":"山田","contractDate":"2025-09-15","applyDate":"2025-09-09","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"203.0","broker":"ライフ　代行タイセイハウジー","staff":"","contractDate":"2025-08-29","applyDate":"2025-07-07","status":"契約書類返送完備"},{"property":"マルヴィナ","room":"202.0","broker":"いえなび春日店","staff":"山本","contractDate":"2025-09-01","applyDate":"2025-08-03","status":"契約書類返送完備"},{"property":"メリッサ","room":"203.0","broker":"大東建託株式会社　福山","staff":"近藤","contractDate":"2025-09-19","applyDate":"2025-08-28","status":"契約書類返送完備"},{"property":"クラリス","room":"101.0","broker":"中バス　福山","staff":"小川","contractDate":"2025-09-20","applyDate":"2025-08-23","status":"契約書類返送完備"},{"property":"メゾンドリヴァージュ","room":"B305","broker":"アパマンショップ神辺店","staff":"小葉竹","contractDate":"2025-09-21","applyDate":"2025-08-24","status":"契約書類返送完備"},{"property":"メリッサ","room":"102.0","broker":"中国バス　福山","staff":"田平","contractDate":"2025-09-21","applyDate":"2025-08-23","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"102.0","broker":"いえなび　多治米店","staff":"中川","contractDate":"","applyDate":"2025-09-16","status":"キャンセル"},{"property":"カルコーサ","room":"101.0","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"","applyDate":"2025-09-19","status":"審査落ち"},{"property":"ガーデンヒルズ長者町","room":"101.0","broker":"株式会社ケイアイホーム　福山駅前店","staff":"矢口","contractDate":"2025-09-26","applyDate":"2025-09-17","status":"契約書類返送完備"},{"property":"メリッサ","room":"205.0","broker":"いえなび　春日店","staff":"今井","contractDate":"2025-09-30","applyDate":"2025-09-08","status":"契約書類返送完備"},{"property":"カルムコート","room":"東208","broker":"ライフ","staff":"","contractDate":"2025-10-01","applyDate":"2025-08-14","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"505.0","broker":"株式会社アークス　エイブルネットワーク倉敷駅北店","staff":"山本","contractDate":"2025-05-07","applyDate":"2025-04-21","status":"契約書類返送完備"},{"property":"ノブリス","room":"A101","broker":"株式会社 トリコム","staff":"河野","contractDate":"2025-09-30","applyDate":"2025-09-17","status":"契約書類返送完備"},{"property":"エルキュール","room":"A201","broker":"タイヨウエステート","staff":"岡山","contractDate":"2025-09-30","applyDate":"2025-09-22","status":"契約書類返送完備"},{"property":"ソルトグラス","room":"203.0","broker":"いえなび春日店","staff":"高木","contractDate":"2025-10-01","applyDate":"2025-08-06","status":"契約書類返送完備"},{"property":"アルデバラン","room":"B103","broker":"中国バス不動産　南店","staff":"光吉","contractDate":"2025-10-01","applyDate":"2025-08-21","status":"契約書類返送完備"},{"property":"ミルドレッド","room":"106.0","broker":"いえなび","staff":"山本","contractDate":"2025-10-01","applyDate":"2025-08-24","status":"契約書類返送完備"},{"property":"メリッサ","room":"106.0","broker":"エステート高橋有限会社","staff":"福間","contractDate":"2025-10-01","applyDate":"2025-09-10","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"305.0","broker":"ＢＲＵＮＯ不動産 株式会社","staff":"鷺原","contractDate":"2025-10-01","applyDate":"2025-09-15","status":"契約書類返送完備"},{"property":"カルコーサ","room":"111.0","broker":"いえなび　春日店","staff":"山本","contractDate":"2025-10-01","applyDate":"2025-09-17","status":"契約書類返送完備"},{"property":"メリッサ","room":"202.0","broker":"中国バス不動産　福山店","staff":"小川","contractDate":"2025-09-27","applyDate":"2025-09-04","status":"契約書類返送完備"},{"property":"カルコーサ","room":"108.0","broker":"いえなび","staff":"山本","contractDate":"2025-10-01","applyDate":"2025-08-17","status":"契約書類返送完備"},{"property":"カルコーサ","room":"110.0","broker":"いえなび　春日店","staff":"今井","contractDate":"2025-10-01","applyDate":"2025-09-10","status":"契約書類返送完備"},{"property":"瀬戸町戸建て","room":"1.0","broker":"中国バス不動産　南店","staff":"行友","contractDate":"2025-10-01","applyDate":"2025-09-05","status":"契約書類返送完備"},{"property":"仮）中畝AP3","room":"B101","broker":"(株)ワイケイ　アパマンショップ倉敷水島店","staff":"薮井","contractDate":"2025-12-05","applyDate":"2025-09-29","status":"審査落ち"},{"property":"カルコーサ","room":"101.0","broker":"株式会社 タカハシ福山松永店","staff":"佐藤","contractDate":"2025-10-18","applyDate":"2025-09-27","status":"キャンセル"},{"property":"テタンジェ","room":"103.0","broker":"ワイケイ","staff":"安藤","contractDate":"2025-09-20","applyDate":"2025-08-23","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"107.0","broker":"不動産の岩原","staff":"岩原","contractDate":"2025-09-30","applyDate":"2025-09-19","status":"契約書類返送完備"},{"property":"メリッサ","room":"105.0","broker":"不動産の岩原","staff":"岩原","contractDate":"2025-10-01","applyDate":"2025-09-17","status":"契約書類返送完備"},{"property":"メリッサ","room":"206.0","broker":"エイブルＮＷ福山蔵王店","staff":"藤井","contractDate":"2025-10-01","applyDate":"2025-09-14","status":"契約書類返送完備"},{"property":"ミルドレッド","room":"101.0","broker":"大東建託リーシング三原店","staff":"佐藤","contractDate":"2025-10-03","applyDate":"2025-09-19","status":"契約書類返送完備"},{"property":"メリッサ","room":"103.0","broker":"株式会社 レイクスコーポレーション","staff":"川上","contractDate":"2025-09-29","applyDate":"2025-09-12","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"610.0","broker":"東建コーポレーション　倉敷","staff":"難波","contractDate":"2025-09-27","applyDate":"2025-09-06","status":"契約書類返送完備"},{"property":"アルデバラン","room":"A103","broker":"㈱タカハシインター南店","staff":"加藤","contractDate":"2025-07-10","applyDate":"2025-06-30","status":"契約書類返送完備"},{"property":"マジェステ","room":"A103","broker":"ケイアイ　三原","staff":"内山","contractDate":"2025-10-19","applyDate":"2025-10-05","status":"審査落ち"},{"property":"マルヴィナ","room":"102.0","broker":"株式会社タカハシ　東尾道駅前店","staff":"大前","contractDate":"2025-09-25","applyDate":"2025-09-16","status":"契約書類返送完備"},{"property":"ミルドレッド","room":"202.0","broker":"株式会社 タカハシ福山松永店","staff":"前迫","contractDate":"2025-10-11","applyDate":"2025-09-30","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"106.0","broker":"エイブルＮＷ福山蔵王店","staff":"井上","contractDate":"2025-10-08","applyDate":"2025-09-30","status":"契約書類返送完備"},{"property":"ソアヴィータ","room":"203.0","broker":"エイブルＮＷ福山蔵王店","staff":"藤井","contractDate":"2025-10-19","applyDate":"2025-08-21","status":"契約書類返送完備"},{"property":"ソフィア","room":"201.0","broker":"いえなび春日","staff":"山本","contractDate":"","applyDate":"2025-10-04","status":"キャンセル"},{"property":"カルコーサ","room":"101.0","broker":"株式会社タカハシ　南店","staff":"蟻田","contractDate":"2025-10-17","applyDate":"2025-10-02","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"302.0","broker":"あなぶきハウジングサービス　倉敷店","staff":"村木","contractDate":"2025-09-26","applyDate":"2025-09-05","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"402.0","broker":"あなぶきハウジングサービス 倉敷店","staff":"久保田","contractDate":"2025-10-04","applyDate":"2025-08-30","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"108.0","broker":"不動産の岩原","staff":"岩原","contractDate":"","applyDate":"2025-10-19","status":"審査落ち"},{"property":"アンティカベラカーサ","room":"102.0","broker":"株式会社Connect","staff":"平川","contractDate":"2025-10-25","applyDate":"2025-09-02","status":"契約書類返送完備"},{"property":"カルコーサ","room":"102.0","broker":"エイブルＮＷ神辺店","staff":"鏡内","contractDate":"2025-10-27","applyDate":"2025-10-08","status":"契約書類返送完備"},{"property":"ナディア","room":"B107","broker":"(株)ワイケイ　アパマンショップ倉敷水島店","staff":"薮井","contractDate":"","applyDate":"2025-10-24","status":"キャンセル"},{"property":"カルムコート","room":"東207","broker":"いえなび　多治米","staff":"宮地","contractDate":"","applyDate":"2025-10-28","status":"審査落ち"},{"property":"ハイサニー","room":"B105","broker":"ライフ","staff":"","contractDate":"2025-10-31","applyDate":"2025-09-30","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"102.0","broker":"ケイアイホーム　福山駅前店","staff":"友滝","contractDate":"2025-10-31","applyDate":"2025-10-15","status":"契約書類返送完備"},{"property":"ミルドレッド","room":"201.0","broker":"中国バス不動産　福山店","staff":"髙橋","contractDate":"2025-11-01","applyDate":"2025-09-29","status":"契約書類返送完備"},{"property":"ナディア","room":"B107","broker":"エイブルNW倉敷駅北店","staff":"中川","contractDate":"","applyDate":"2025-10-24","status":"キャンセル"},{"property":"ミルドレッド","room":"107.0","broker":"タカハシ東尾道","staff":"肌野","contractDate":"2025-11-07","applyDate":"2025-09-22","status":"契約書類返送完備"},{"property":"ミステール","room":"206.0","broker":"株式会社 タカハシ福山松永店","staff":"佐藤","contractDate":"","applyDate":"2025-11-06","status":"審査落ち"},{"property":"ナディア","room":"B106","broker":"エイブルNW倉敷水島店","staff":"藤本","contractDate":"","applyDate":"2025-11-06","status":"審査落ち"},{"property":"ミステール","room":"106.0","broker":"中国バス不動産株式会社　福山店","staff":"小川","contractDate":"2025-11-08","applyDate":"2025-10-06","status":"契約書類返送完備"},{"property":"ミルドレッド","room":"103.0","broker":"いえなび　春日","staff":"高木","contractDate":"2025-11-01","applyDate":"2025-10-03","status":"契約書類返送完備"},{"property":"メゾンドリヴァージュ","room":"B306","broker":"中国バス不動産　南店","staff":"光吉","contractDate":"2025-11-15","applyDate":"2025-09-14","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"901.0","broker":"東建コーポレーション　岡山店","staff":"山﨑","contractDate":"2025-10-06","applyDate":"2025-09-18","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"607.0","broker":"株式会社ワイケイ倉敷沖新店","staff":"下元","contractDate":"2025-10-24","applyDate":"2025-08-20","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"701.0","broker":"ワイケイ　倉敷駅前店","staff":"永田","contractDate":"2025-11-01","applyDate":"2025-09-26","status":"契約書類返送完備"},{"property":"ミルドレッド","room":"105.0","broker":"タカハシ　東尾道駅前店","staff":"肌野","contractDate":"2025-10-31","applyDate":"2025-09-26","status":"契約書類返送完備"},{"property":"タラッサ","room":"103.0","broker":"株式会社 ワイケイ倉敷沖新店","staff":"安藤","contractDate":"2025-11-15","applyDate":"2025-10-25","status":"契約書類返送完備"},{"property":"ミルドレッド","room":"102.0","broker":"株式会社コミコミ","staff":"政野","contractDate":"2025-11-01","applyDate":"2025-09-29","status":"契約書類返送完備"},{"property":"ナディア","room":"B107","broker":"株式会社ケイアイホーム　白楽町店","staff":"今村","contractDate":"2025-12-23","applyDate":"2025-11-16","status":"審査落ち"},{"property":"スピネル","room":"107.0","broker":"ライフ","staff":"","contractDate":"2025-11-21","applyDate":"2025-10-20","status":"契約書類返送完備"},{"property":"ソルトグラス","room":"201.0","broker":"いい部屋ネット　福山北店","staff":"石原","contractDate":"","applyDate":"2025-11-22","status":"キャンセル"},{"property":"ナディア","room":"B105","broker":"株式会社OFC本店","staff":"","contractDate":"","applyDate":"2025-11-24","status":"審査落ち"},{"property":"メゾンドリヴァージュ","room":"B206","broker":"トリコム","staff":"河野","contractDate":"2025-11-23","applyDate":"2025-10-22","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"303.0","broker":"株式会社ワイケイ倉敷沖新店","staff":"安藤","contractDate":"2025-11-23","applyDate":"2025-10-25","status":"契約書類返送完備"},{"property":"スパーブコート","room":"106.0","broker":"大東建託リーシング株式会社　福山店","staff":"近藤","contractDate":"2025-11-26","applyDate":"2025-09-28","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"606.0","broker":"ＢＲＵＮＯ不動産 株式会社庭瀬駅前店","staff":"古谷","contractDate":"2025-11-27","applyDate":"2025-10-14","status":"契約書類返送完備"},{"property":"ミステール","room":"207.0","broker":"中国バス不動産　福山店","staff":"田平","contractDate":"2025-11-27","applyDate":"2025-10-27","status":"契約書類返送完備"},{"property":"ベラカーサノース","room":"1002.0","broker":"ライフ","staff":"","contractDate":"2025-12-01","applyDate":"2025-10-20","status":"契約書類返送完備"},{"property":"カルコーサ","room":"105.0","broker":"トリコム","staff":"山田","contractDate":"2025-11-20","applyDate":"2025-09-25","status":"契約書類返送完備"},{"property":"エルキュール","room":"C102","broker":"中国バス不動産株式会社　福山店","staff":"小川","contractDate":"2025-11-30","applyDate":"2025-10-19","status":"契約書類返送完備"},{"property":"ルミエール静","room":"B202","broker":"ケイアイホーム　沖野上店","staff":"馬場","contractDate":"2025-12-01","applyDate":"2025-11-23","status":"契約書類返送完備"},{"property":"マジェステ","room":"A103","broker":"株式会社 タカハシ福山松永店","staff":"高本","contractDate":"2025-11-30","applyDate":"2025-11-24","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"B110","broker":"いえなび　春日","staff":"今井","contractDate":"2025-11-20","applyDate":"2025-10-21","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"211.0","broker":"株式会社 タカハシ福山南店","staff":"山上","contractDate":"2025-09-27","applyDate":"2025-09-13","status":"契約書類返送完備"},{"property":"ミステール","room":"202.0","broker":"ＬｉｆｅＶｉｓｉｏｎ 株式会社本店","staff":"坂本","contractDate":"2025-11-16","applyDate":"2025-11-07","status":"契約書類返送完備"},{"property":"S place bld.","room":"507.0","broker":"ＢＲＵＮＯ不動産 株式会社　総社","staff":"鷺原","contractDate":"2025-12-06","applyDate":"2025-11-22","status":"契約書類返送完備"},{"property":"KASUGAエコパティオ B","room":"B","broker":"エイブルNW福山駅前店","staff":"寺岡","contractDate":"","applyDate":"2025-12-11","status":"審査落ち"},{"property":"カルコーサ","room":"106.0","broker":"エイブルNW福山駅前店","staff":"佐々木","contractDate":"2025-11-30","applyDate":"2025-10-20","status":"契約書類返送完備"},{"property":"ガーデンヒルズ長者町","room":"201.0","broker":"いえなび　春日","staff":"髙木","contractDate":"2025-12-06","applyDate":"2025-11-12","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"406.0","broker":"叶う不動産","staff":"六車","contractDate":"2025-12-08","applyDate":"2025-11-14","status":"契約書類返送完備"},{"property":"アシンプトート","room":"B103","broker":"いえなび春日","staff":"","contractDate":"2025-12-10","applyDate":"2025-11-26","status":"契約書類返送完備"},{"property":"ナディア","room":"A203","broker":"株式会社OFC本店","staff":"松山","contractDate":"2025-12-19","applyDate":"2025-11-25","status":"キャンセル"},{"property":"サントーシャ","room":"102.0","broker":"大東建託リーシング　福山店","staff":"田村","contractDate":"2025-12-14","applyDate":"2025-11-05","status":"契約書類返送完備"},{"property":"ナディア","room":"Ｂ102","broker":"(株)ワイケイ　アパマンショップ倉敷水島店","staff":"","contractDate":"","applyDate":"2025-12-13","status":"審査落ち"},{"property":"サントーシャ","room":"205.0","broker":"ライフ","staff":"","contractDate":"2025-12-18","applyDate":"2025-12-01","status":"契約書類返送完備"},{"property":"ミステール","room":"201.0","broker":"中国バス不動産　福山店","staff":"宗政","contractDate":"2025-12-20","applyDate":"2025-11-14","status":"契約書類返送完備"},{"property":"アルカディア","room":"Ａ302","broker":"いえなび多治米","staff":"中川","contractDate":"2025-12-15","applyDate":"2025-11-09","status":"契約書類返送完備"},{"property":"アロモント","room":"B102","broker":"タカハシ　福山松永店","staff":"前迫","contractDate":"2025-12-07","applyDate":"2025-11-24","status":"契約書類返送完備"},{"property":"ラコリーヌ","room":"A202","broker":"アフィット不動産","staff":"箱﨑","contractDate":"2025-11-29","applyDate":"2025-10-18","status":"契約書類返送完備"},{"property":"ナディア","room":"B101","broker":"大東建託リーシング株式会社 倉敷店","staff":"赤堀","contractDate":"2025-12-10","applyDate":"2025-10-13","status":"契約書類返送完備"},{"property":"マルヴィナ","room":"101.0","broker":"株式会社タカハシ　東尾道駅前店","staff":"肌野","contractDate":"2025-12-01","applyDate":"2025-11-20","status":"契約書類返送完備"},{"property":"ナディア","room":"Ｂ107","broker":"ＢＲＵＮＯ不動産 株式会社","staff":"平田","contractDate":"2025-12-06","applyDate":"2025-11-30","status":"契約書類返送完備"},{"property":"ミステール","room":"206.0","broker":"タイヨウエステート","staff":"岡山","contractDate":"2025-12-21","applyDate":"2025-11-30","status":"契約書類返送完備"},{"property":"ミーティア","room":"B203","broker":"大東建託リーシング株式会社 福山店","staff":"山田","contractDate":"2025-12-21","applyDate":"2025-11-25","status":"契約書類返送完備"},{"property":"ナディア","room":"B102","broker":"ケイアイ　白楽町店","staff":"豊島","contractDate":"","applyDate":"2025-12-19","status":"審査落ち"},{"property":"ソアヴィータ","room":"106.0","broker":"エイブルＮＷ福山蔵王店","staff":"藤井","contractDate":"2025-12-23","applyDate":"2025-11-30","status":"契約書類返送完備"},{"property":"西谷ユニキューブ","room":"B","broker":"大東建託リーシング株式会社 福山店","staff":"片山","contractDate":"2025-12-23","applyDate":"2025-11-15","status":"契約書類返送完備"},{"property":"カルコーサ","room":"107.0","broker":"中国バス不動産株式会社　福山西・尾道店","staff":"宗政","contractDate":"2025-12-25","applyDate":"2025-12-05","status":"契約書類返送完備"},{"property":"ミステール","room":"101.0","broker":"穴吹ハウジングサービス　福山店","staff":"野村","contractDate":"2025-12-21","applyDate":"2025-11-21","status":"契約書類返送完備"},{"property":"アルカンシェル","room":"A102","broker":"エイブルNW福山駅前店","staff":"佐々木","contractDate":"2025-12-19","applyDate":"2025-11-27","status":"契約書類返送完備"},{"property":"曙戸建て","room":"A","broker":"エイブルNW福山駅前店","staff":"佐々木","contractDate":"2025-12-20","applyDate":"2025-11-20","status":"契約書類返送完備"},{"property":"ナディア","room":"A205","broker":"株式会社OFC本店","staff":"太田","contractDate":"2025-12-26","applyDate":"2025-11-23","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"308.0","broker":"エイブル　倉敷","staff":"阿部","contractDate":"2025-11-23","applyDate":"2025-10-05","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"205.0","broker":"エイブルNWイオンモール倉敷店","staff":"山本","contractDate":"","applyDate":"2025-12-10","status":"キャンセル"},{"property":"ベラカーササウス","room":"407.0","broker":"エイブルNW倉敷水島店","staff":"宮内","contractDate":"","applyDate":"2025-12-26","status":"審査落ち"},{"property":"スピネルデュオ","room":"108.0","broker":"いえなび春日","staff":"","contractDate":"","applyDate":"2026-01-04","status":"審査落ち"},{"property":"アルバ","room":"北208","broker":"株式会社 ケイアイホーム福山駅前店","staff":"萬代","contractDate":"2025-12-25","applyDate":"2025-12-07","status":"契約書類返送完備"},{"property":"エスプレイスビルド","room":"103.0","broker":"ＢＲＵＮＯ不動産 株式会社庭瀬駅前店","staff":"福本","contractDate":"","applyDate":"2026-01-08","status":"キャンセル"},{"property":"メゾンドリヴァージュ","room":"A203","broker":"株式会社 いえなび福山春日店","staff":"山本","contractDate":"2026-01-17","applyDate":"2026-01-08","status":"キャンセル"},{"property":"カルムコート","room":"東105","broker":"株式会社いえなび 福山多治米店","staff":"宮地","contractDate":"","applyDate":"2026-01-11","status":"審査落ち"},{"property":"カルコーサ","room":"102.0","broker":"ライフ","staff":"","contractDate":"2026-02-15","applyDate":"2025-12-21","status":"キャンセル"},{"property":"ベラカーササウス","room":"206.0","broker":"株式会社つぼみ不動産","staff":"徐 蕾","contractDate":"","applyDate":"2026-01-19","status":"キャンセル"},{"property":"アイディール","room":"206.0","broker":"株式会社 いえなび福山多治米店","staff":"宮地","contractDate":"2026-01-10","applyDate":"2025-12-01","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"508.0","broker":"大東建託リーシング株式会社 倉敷店","staff":"赤堀","contractDate":"2026-01-15","applyDate":"2025-11-15","status":"契約書類返送完備"},{"property":"ミステール","room":"107.0","broker":"株式会社 タカハシ福山松永店","staff":"高本","contractDate":"2026-01-16","applyDate":"2025-12-07","status":"契約書類返送完備"},{"property":"S place bld.","room":"506.0","broker":"ＢＲＵＮＯ不動産 株式会社","staff":"鷺原","contractDate":"2026-01-16","applyDate":"2025-11-29","status":"契約書類返送完備"},{"property":"アシンプトート","room":"A205","broker":"ライフ","staff":"","contractDate":"2026-01-16","applyDate":"2025-12-19","status":"契約書類返送完備"},{"property":"セラータ","room":"107.0","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2026-01-16","applyDate":"2025-12-21","status":"契約書類返送完備"},{"property":"マーベラス","room":"B106","broker":"タカハシ　東尾道駅前店","staff":"加藤","contractDate":"2026-01-18","applyDate":"2025-12-18","status":"契約書類返送完備"},{"property":"エルキュール","room":"B101","broker":"ライフ","staff":"","contractDate":"2026-02-01","applyDate":"2026-01-08","status":"契約書類返送完備"},{"property":"ミラヴィルタス","room":"西201","broker":"いえなび　春日","staff":"髙木","contractDate":"2026-01-31","applyDate":"2025-12-13","status":"契約書類返送完備"},{"property":"セラータ","room":"105.0","broker":"株式会社 いえなび福山春日店","staff":"今井","contractDate":"2026-02-01","applyDate":"2025-12-07","status":"契約書類返送完備"},{"property":"メゾンドリヴァージュ","room":"A203","broker":"ライフ","staff":"","contractDate":"2026-01-29","applyDate":"2026-01-23","status":"契約書類返送完備"},{"property":"マースフル","room":"101.0","broker":"株式会社 いえなび福山春日店","staff":"","contractDate":"","applyDate":"2026-01-27","status":"審査落ち"},{"property":"アプリシティ","room":"201.0","broker":"トリコム","staff":"山田","contractDate":"2026-01-31","applyDate":"2026-01-11","status":"契約書類返送完備"},{"property":"テタンジェ","room":"108.0","broker":"エイブルNWイオンモール倉敷店　株式会社アークス","staff":"山本","contractDate":"2026-03-01","applyDate":"2026-01-14","status":"キャンセル"},{"property":"スピネルデュオ","room":"108.0","broker":"いえなび春日","staff":"","contractDate":"","applyDate":"2026-01-24","status":"審査落ち"},{"property":"ナディア","room":"B102","broker":"ネクステージホーム","staff":"小出","contractDate":"2026-02-01","applyDate":"2026-01-11","status":"契約書類返送完備"},{"property":"手城3丁目戸建て","room":"","broker":"エイブル蔵王","staff":"井上","contractDate":"2026-02-01","applyDate":"2025-12-22","status":"契約書類返送完備"},{"property":"アイディール","room":"205.0","broker":"中国バス不動産　LIFUKU福山西・尾道店","staff":"宗政","contractDate":"2026-03-20","applyDate":"2026-01-29","status":"キャンセル"},{"property":"ディアレスト","room":"201.0","broker":"いえなび　春日","staff":"山本","contractDate":"2025-12-19","applyDate":"2025-12-01","status":"契約書類返送完備"},{"property":"ディアレスト","room":"203.0","broker":"いえなび　春日","staff":"今井","contractDate":"2025-12-21","applyDate":"2025-11-08","status":"契約書類返送完備"},{"property":"ソフィア","room":"105.0","broker":"いえなび","staff":"","contractDate":"2023-09-30","applyDate":"2023-09-30","status":"契約書類返送完備"},{"property":"ソフィア","room":"","broker":"エステート高橋","staff":"","contractDate":"2023-10-15","applyDate":"2023-09-15","status":"契約書類返送完備"},{"property":"ソフィア","room":"201.0","broker":"ケイアイ沖野上","staff":"","contractDate":"2023-11-01","applyDate":"2023-10-10","status":"契約書類返送完備"},{"property":"ソフィア","room":"202.0","broker":"いえなび","staff":"","contractDate":"2023-12-16","applyDate":"2023-12-03","status":"契約書類返送完備"},{"property":"モデルノ","room":"202.0","broker":"いえなび","staff":"","contractDate":"2023-12-20","applyDate":"","status":"契約書類返送完備"},{"property":"モデルノ","room":"201.0","broker":"ＩＲＥライフ","staff":"西澤","contractDate":"2023-12-23","applyDate":"2023-11-30","status":"契約書類返送完備"},{"property":"ソフィア","room":"102.0","broker":"タカハシ　南店","staff":"山上","contractDate":"2023-12-25","applyDate":"2023-12-07","status":"契約書類返送完備"},{"property":"ミーティア","room":"B201","broker":"住まいのクエスト","staff":"富田","contractDate":"2024-01-01","applyDate":"2023-12-13","status":"契約書類返送完備"},{"property":"ソフィア","room":"101.0","broker":"中バス　北店","staff":"黒川","contractDate":"2024-01-05","applyDate":"2023-12-12","status":"契約書類返送完備"},{"property":"セラータ","room":"201.0","broker":"ＩＲＥライフ","staff":"","contractDate":"2024-01-15","applyDate":"2024-01-13","status":"契約書類返送完備"},{"property":"モデルノ","room":"203.0","broker":"不動産の岩原","staff":"岩原","contractDate":"2024-01-31","applyDate":"2023-12-24","status":"契約書類返送完備"},{"property":"モデルノ","room":"306.0","broker":"2024-01-16 00:00:00","staff":"山本","contractDate":"2024-02-01","applyDate":"2023-12-24","status":"契約書類返送完備"},{"property":"モデルノ","room":"206.0","broker":"ＩＲＥライフ","staff":"","contractDate":"2024-02-01","applyDate":"2024-01-26","status":"契約書類返送完備"},{"property":"グロリオサ","room":"302.0","broker":"ＩＲＥライフ","staff":"西澤","contractDate":"2024-02-01","applyDate":"2023-12-25","status":"契約書類返送完備"},{"property":"マーベラス","room":"A106","broker":"株式会社Jubilation","staff":"亀岡","contractDate":"2024-02-01","applyDate":"2024-01-11","status":"契約書類返送完備"},{"property":"アシンプトート","room":"B203","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2024-02-15","applyDate":"","status":"契約書類返送完備"},{"property":"セラータ","room":"105.0","broker":"ハマ不動産","staff":"藤井","contractDate":"2024-02-15","applyDate":"2024-02-01","status":"契約書類返送完備"},{"property":"クラリス","room":"106.0","broker":"住まいのクエスト","staff":"藤井","contractDate":"2024-02-18","applyDate":"2024-02-03","status":"申し込み"},{"property":"プティメゾン","room":"102.0","broker":"ＩＲＥライフ","staff":"","contractDate":"2024-02-19","applyDate":"2024-02-13","status":"契約書類返送完備"},{"property":"ルミエール静","room":"B102","broker":"ケイアイ駅前","staff":"亀谷","contractDate":"2024-02-20","applyDate":"2024-01-26","status":"契約書類返送完備"},{"property":"モデルノ","room":"305.0","broker":"中国バス不動産　南店","staff":"中山","contractDate":"2024-02-24","applyDate":"2024-01-27","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"A103","broker":"株式会社OneStepForward","staff":"石井","contractDate":"2024-02-25","applyDate":"2024-02-16","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"A203","broker":"不動産の岩原","staff":"岩原","contractDate":"2024-02-26","applyDate":"2024-01-26","status":"契約書類返送完備"},{"property":"モデルノ","room":"205.0","broker":"大東建託　福山","staff":"田村","contractDate":"2024-02-29","applyDate":"2024-01-01","status":"契約書類返送完備"},{"property":"ミラヴィルタス","room":"東111","broker":"いえなび","staff":"宮地","contractDate":"2024-02-29","applyDate":"2024-01-14","status":"契約書類返送完備"},{"property":"アルカンシェル","room":"A103","broker":"タイヨウエステート","staff":"岡山","contractDate":"2024-02-29","applyDate":"2024-02-21","status":"契約書類返送完備"},{"property":"セラータ","room":"103.0","broker":"大東建託　福山","staff":"近藤","contractDate":"2024-03-01","applyDate":"2024-01-18","status":"契約書類返送完備"},{"property":"アルバ","room":"南101～105","broker":"佐藤エステート","staff":"佐藤","contractDate":"2024-03-01","applyDate":"2024-01-22","status":"契約書類返送完備"},{"property":"モデルノ","room":"303.0","broker":"株式会社穴吹ハウジングサービス","staff":"安部","contractDate":"2024-03-01","applyDate":"2024-01-26","status":"契約書類返送完備"},{"property":"セラータ","room":"110.0","broker":"㈱ケイアイホーム　神辺店","staff":"朝野","contractDate":"2024-03-01","applyDate":"2024-02-03","status":"契約書類返送完備"},{"property":"セラータ","room":"202.0","broker":"㈱ケイアイホーム　神辺店","staff":"馬場","contractDate":"2024-03-01","applyDate":"2024-02-06","status":"契約書類返送完備"},{"property":"セラータ","room":"101.0","broker":"㈱ケイアイホーム　福山駅前店","staff":"萬代","contractDate":"2024-03-01","applyDate":"2024-02-06","status":"契約書類返送完備"},{"property":"クラリス","room":"106.0","broker":"いえなび","staff":"宮地","contractDate":"2024-03-01","applyDate":"2024-02-14","status":"契約書類返送完備"},{"property":"プレジール高橋","room":"103.0","broker":"中国バス不動産","staff":"宗政","contractDate":"2024-03-01","applyDate":"2024-02-23","status":"契約書類返送完備"},{"property":"ルミエール静","room":"A102","broker":"㈱ケイアイホーム　沖野上店","staff":"藤井","contractDate":"2024-03-01","applyDate":"2024-02-03","status":"契約書類返送完備"},{"property":"アシンプトート","room":"Ａ201","broker":"大東建託　福山","staff":"平田","contractDate":"2024-03-01","applyDate":"2024-01-09","status":"契約書類返送完備"},{"property":"セラータ","room":"106.0","broker":"穴吹ハウジングサービス","staff":"野村","contractDate":"2024-03-02","applyDate":"2024-02-15","status":"契約書類返送完備"},{"property":"アルバ","room":"南202","broker":"佐藤エステート","staff":"津組","contractDate":"2024-03-03","applyDate":"2024-02-06","status":"契約書類返送完備"},{"property":"アシンプトート","room":"A102","broker":"IREライフ","staff":"","contractDate":"2024-03-14","applyDate":"2024-02-27","status":"契約書類返送完備"},{"property":"アルカディア","room":"D205","broker":"大東建託","staff":"近藤","contractDate":"2024-03-15","applyDate":"2024-02-23","status":"契約書類返送完備"},{"property":"モデルノ","room":"302.0","broker":"いえなび","staff":"宮地","contractDate":"2024-03-16","applyDate":"2024-01-29","status":"契約書類返送完備"},{"property":"セラータ","room":"108.0","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2024-03-16","applyDate":"2024-03-04","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"502.0","broker":"㈱ケイアイホーム　倉敷白楽町店","staff":"高田","contractDate":"2024-03-16","applyDate":"2024-02-02","status":"契約書類返送完備"},{"property":"アシンプトート","room":"A303","broker":"ＩＲＥライフ","staff":"","contractDate":"2024-03-17","applyDate":"2024-02-06","status":"契約書類返送完備"},{"property":"アルカディア","room":"A102","broker":"中国バス不動産　福山店","staff":"高田","contractDate":"2024-03-17","applyDate":"2024-02-22","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"208.0","broker":"㈱ケイアイホーム　倉敷白楽町店","staff":"中山","contractDate":"2024-03-17","applyDate":"2024-02-23","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"307.0","broker":"株式会社アークス\nエイブルネットワーク倉敷駅北店","staff":"林田","contractDate":"2024-03-20","applyDate":"2024-01-26","status":"契約書類返送完備"},{"property":"セトハウス　イースト","room":"1.0","broker":"なごみ不動産","staff":"須田","contractDate":"2024-03-20","applyDate":"2024-02-13","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"B106","broker":"いえなび","staff":"宮地","contractDate":"2024-03-20","applyDate":"2024-03-17","status":"契約書類返送完備"},{"property":"アルカディア","room":"B102","broker":"タカハシ　インター南店","staff":"西村","contractDate":"2024-03-20","applyDate":"2024-03-01","status":"契約書類返送完備"},{"property":"アルバ","room":"南201","broker":"ケイアイホーム　沖野上店","staff":"友滝","contractDate":"2024-03-22","applyDate":"2024-02-27","status":"契約書類返送完備"},{"property":"春日町ユニキューブ","room":"B","broker":"住まいのクエスト","staff":"富田","contractDate":"2024-03-25","applyDate":"2024-02-14","status":"契約書類返送完備"},{"property":"アルバ","room":"北106","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2024-03-25","applyDate":"2024-03-06","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"A102","broker":"中国バス不動産　北店","staff":"黒川","contractDate":"2024-03-25","applyDate":"2024-02-27","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"B113","broker":"ケイアイ　神辺","staff":"馬場","contractDate":"2024-03-29","applyDate":"2024-03-07","status":"契約書類返送完備"},{"property":"アシンプトート","room":"A202","broker":"中国バス不動産","staff":"中重","contractDate":"2024-03-30","applyDate":"2024-03-04","status":"契約書類返送完備"},{"property":"セラータ","room":"107.0","broker":"アヤカホーム","staff":"吉岡・村上","contractDate":"2024-03-30","applyDate":"2024-02-12","status":"契約書類返送完備"},{"property":"サントーシャ","room":"205.0","broker":"タカハシ南店","staff":"山上","contractDate":"2024-03-30","applyDate":"2024-03-21","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"206.0","broker":"","staff":"吉田","contractDate":"2024-03-31","applyDate":"2024-02-15","status":"契約書類返送完備"},{"property":"スピネル","room":"202.0","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2024-03-31","applyDate":"2024-03-22","status":"契約書類返送完備"},{"property":"スピネル","room":"106.0","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2024-03-31","applyDate":"2024-03-15","status":"契約書類返送完備"},{"property":"アルバ","room":"北110","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2024-03-31","applyDate":"2024-03-20","status":"契約書類返送完備"},{"property":"セラータ","room":"102.0","broker":"タイヨウエステート","staff":"岡山","contractDate":"2024-03-31","applyDate":"2024-03-06","status":"契約書類返送完備"},{"property":"スピネル","room":"108.0","broker":"いえなび","staff":"山本","contractDate":"2024-03-31","applyDate":"2024-02-04","status":"契約書類返送完備"},{"property":"カルムコート","room":"東107","broker":"いえなび","staff":"山本","contractDate":"2024-03-31","applyDate":"2024-03-14","status":"契約書類返送完備"},{"property":"アルバ","room":"北207","broker":"タカハシ　インター南店","staff":"千葉","contractDate":"2024-03-31","applyDate":"2024-03-24","status":"契約書類返送完備"},{"property":"テタンジェ","room":"110.0","broker":"㈱ケイアイホーム　倉敷白楽町店","staff":"蜂谷","contractDate":"2024-04-01","applyDate":"2024-02-04","status":"契約書類返送完備"},{"property":"アルバ","room":"南203","broker":"アットホーム","staff":"板崎","contractDate":"2024-04-01","applyDate":"2024-02-29","status":"契約書類返送完備"},{"property":"スピネル","room":"101.0","broker":"ケイアイ神辺","staff":"馬場","contractDate":"2024-04-01","applyDate":"2024-03-20","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"305.0","broker":"旭株式会社","staff":"林","contractDate":"2024-04-02","applyDate":"2024-03-21","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"601.0","broker":"株式会社MPCコーポレーション","staff":"ジョコウ","contractDate":"2024-04-02","applyDate":"2024-03-21","status":"契約書類返送完備"},{"property":"スピネル","room":"201.0","broker":"ケイアイ　神辺","staff":"坂井","contractDate":"2024-04-06","applyDate":"2024-03-11","status":"契約書類返送完備"},{"property":"ディアレスト","room":"102.0","broker":"中国バス不動産","staff":"髙田","contractDate":"2024-04-06","applyDate":"2024-03-21","status":"契約書類返送完備"},{"property":"アルカディア","room":"Ｃ102","broker":"中国バス不動産","staff":"山田","contractDate":"2024-04-10","applyDate":"2024-04-03","status":"契約書類返送完備"},{"property":"ミラヴィルタス","room":"西102","broker":"中国バス不動産　北店","staff":"黒川","contractDate":"2024-04-13","applyDate":"2024-03-10","status":"契約書類返送完備"},{"property":"アシンプトート","room":"A101","broker":"IREライフ","staff":"","contractDate":"2024-04-15","applyDate":"2024-03-07","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"308.0","broker":"（株）金葉マネジメント","staff":"藤山","contractDate":"2024-04-20","applyDate":"2024-04-13","status":"契約書類返送完備"},{"property":"スピネル","room":"203.0","broker":"大東建託リーシング","staff":"平田","contractDate":"2024-04-27","applyDate":"2024-04-12","status":"契約書類返送完備"},{"property":"アルカディア","room":"Ｃ202","broker":"大東建託リーシング","staff":"近藤","contractDate":"2024-04-28","applyDate":"2024-03-25","status":"契約書類返送完備"},{"property":"ソルトグラス","room":"205.0","broker":"中国バス不動産　北店","staff":"山田","contractDate":"2024-04-30","applyDate":"2024-03-12","status":"キャンセル"},{"property":"マジェスティ","room":"N201","broker":"あかりホーム","staff":"藤村","contractDate":"2024-04-30","applyDate":"2024-02-11","status":"契約書類返送完備"},{"property":"マジェスティ","room":"Ｎ101","broker":"ＩＲＥライフ株式会社","staff":"","contractDate":"2024-04-30","applyDate":"2024-04-18","status":"契約書類返送完備"},{"property":"（仮）南松永ＡＰ","room":"北203","broker":"あかりホーム","staff":"藤村","contractDate":"2024-05-01","applyDate":"2024-02-17","status":"キャンセル"},{"property":"テタンジェ","room":"108.0","broker":"株式会社サンホーム","staff":"福原","contractDate":"2024-05-01","applyDate":"2024-03-25","status":"契約書類返送完備"},{"property":"アルバ","room":"北108","broker":"㈲ウィーク","staff":"中村","contractDate":"2024-05-01","applyDate":"2024-04-12","status":"契約書類返送完備"},{"property":"アシンプトート","room":"A105","broker":"IREライフ","staff":"瀧口","contractDate":"2024-05-01","applyDate":"2024-04-05","status":"契約書類返送完備"},{"property":"スピネル","room":"107.0","broker":"ＩＲＥライフ株式会社","staff":"","contractDate":"2024-05-01","applyDate":"2024-04-25","status":"契約書類返送完備"},{"property":"テタンジェ","room":"102.0","broker":"株式会社ワイケイ　アパマンショップ新倉敷駅前店","staff":"松島","contractDate":"2024-05-01","applyDate":"2024-04-18","status":"契約書類返送完備"},{"property":"マジェスティ","room":"Ｎ105","broker":"IREライフ","staff":"","contractDate":"2024-05-01","applyDate":"2024-04-13","status":"契約書類返送完備"},{"property":"マジェスティ","room":"N102","broker":"あかりホーム","staff":"藤村","contractDate":"2024-05-01","applyDate":"2024-02-28","status":"契約書類返送完備"},{"property":"西谷ユニキューブ","room":"Ｂ","broker":"いえなび","staff":"髙木","contractDate":"2024-05-01","applyDate":"2024-04-01","status":"契約書類返送完備"},{"property":"マジェスティ","room":"N205","broker":"いえなび","staff":"宮地","contractDate":"2024-05-01","applyDate":"2024-03-24","status":"契約書類返送完備"},{"property":"グロリオサ","room":"403.0","broker":"いえなび","staff":"宮地","contractDate":"2024-05-01","applyDate":"2024-04-08","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"Ａ201","broker":"Oggi合同会社","staff":"三島","contractDate":"2024-05-01","applyDate":"2024-04-18","status":"契約書類返送完備"},{"property":"アルバ","room":"北210","broker":"大東建託リーシング","staff":"近藤","contractDate":"2024-05-01","applyDate":"2024-04-15","status":"契約書類返送完備"},{"property":"マジェスティ","room":"N202","broker":"いえなび","staff":"藤川","contractDate":"2024-05-01","applyDate":"2024-03-03","status":"契約書類返送完備"},{"property":"マジェスティ","room":"Ｎ103","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2024-05-12","applyDate":"2024-04-21","status":"契約書類返送完備"},{"property":"テタンジェ","room":"203.0","broker":"㈱ｱｰｸｽ　エイブルイオンモール倉敷店","staff":"鳥越","contractDate":"2024-05-14","applyDate":"2024-05-03","status":"契約書類返送完備"},{"property":"クラリス","room":"103.0","broker":"ごゆう不動産","staff":"内山","contractDate":"2024-05-18","applyDate":"2024-05-02","status":"契約書類返送完備"},{"property":"タラッサ","room":"113.0","broker":"株式会社ワイケイ","staff":"薮井","contractDate":"2024-05-18","applyDate":"2024-03-17","status":"契約書類返送完備"},{"property":"スピネル","room":"103.0","broker":"アカリホーム","staff":"藤村","contractDate":"2024-05-20","applyDate":"2024-05-21","status":"契約書類返送完備"},{"property":"アルカンシェル","room":"A102","broker":"中国バス不動産","staff":"山田","contractDate":"2024-05-23","applyDate":"2024-05-10","status":"契約書類返送完備"},{"property":"スピネル","room":"102.0","broker":"中国バス不動産","staff":"山田","contractDate":"2024-05-24","applyDate":"2024-05-06","status":"契約書類返送完備"},{"property":"ソルトグラス","room":"202.0","broker":"(株)アフィット不動産 <info@affitto.jp>","staff":"岩崎","contractDate":"2024-05-25","applyDate":"2024-05-11","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"207.0","broker":"","staff":"","contractDate":"2024-05-25","applyDate":"2024-05-13","status":"契約書類返送完備"},{"property":"アイディール","room":"106.0","broker":"IREライフ","staff":"","contractDate":"2024-05-25","applyDate":"2024-05-14","status":"契約書類返送完備"},{"property":"クラリス","room":"202.0","broker":"共立不動産","staff":"藤野","contractDate":"2024-05-27","applyDate":"2024-04-12","status":"契約書類返送完備"},{"property":"アシンプトート","room":"Ａ301","broker":"穴吹ハウジングサービス","staff":"野村","contractDate":"2024-05-28","applyDate":"2024-05-15","status":"契約書類返送完備"},{"property":"エルキュール","room":"Ｃ203","broker":"中国バス不動産","staff":"髙田","contractDate":"2024-05-31","applyDate":"2024-05-07","status":"キャンセル"},{"property":"ベラカーサフェリーチェ","room":"407.0","broker":"ミニミニＦＣ倉敷","staff":"田村","contractDate":"2024-05-31","applyDate":"2024-05-19","status":"契約書類返送完備"},{"property":"ルミエール静","room":"Ｂ201","broker":"株式会社ケイアイホーム　福山駅前店","staff":"矢口","contractDate":"2024-05-31","applyDate":"2024-05-09","status":"契約書類返送完備"},{"property":"カルムコート","room":"東105","broker":"ケイアイ　沖野上","staff":"藤井","contractDate":"2024-06-01","applyDate":"2024-05-12","status":"契約書類返送完備"},{"property":"アプリシティ","room":"102.0","broker":"エステート髙橋","staff":"福間","contractDate":"2024-06-01","applyDate":"2024-05-02","status":"契約書類返送完備"},{"property":"テタンジェ","room":"201.0","broker":"ピタットハウス新倉敷店","staff":"松崎","contractDate":"2024-06-01","applyDate":"2024-05-02","status":"契約書類返送完備"},{"property":"テタンジェ","room":"107.0","broker":"ピタットハウス新倉敷店","staff":"松崎","contractDate":"2024-06-01","applyDate":"2024-05-07","status":"契約書類返送完備"},{"property":"マジェスティ","room":"Ａ203","broker":"佐藤エステート","staff":"佐藤","contractDate":"2024-06-01","applyDate":"2024-05-10","status":"契約書類返送完備"},{"property":"アプリシティ","room":"201.0","broker":"佐藤エステート","staff":"大植","contractDate":"2024-06-01","applyDate":"2024-05-18","status":"契約書類返送完備"},{"property":"エルキュール","room":"A202","broker":"エステート高橋","staff":"福間","contractDate":"2024-06-01","applyDate":"2024-05-19","status":"契約書類返送完備"},{"property":"ミーティア","room":"Ｂ101","broker":"(株)Ｊｕｂｉｌａｔｉｏｎ","staff":"平良","contractDate":"2024-06-01","applyDate":"2024-05-17","status":"契約書類返送完備"},{"property":"マジェスティ","room":"Ｂ205","broker":"いえなび","staff":"藤川","contractDate":"2024-06-01","applyDate":"2024-04-28","status":"契約書類返送完備"},{"property":"ソルトグラス","room":"205.0","broker":"いえなび","staff":"山本","contractDate":"2024-06-01","applyDate":"2024-05-21","status":"契約書類返送完備"},{"property":"テタンジェ","room":"202.0","broker":"アパマンショップ倉敷白楽町店","staff":"左京","contractDate":"2024-06-12","applyDate":"2024-05-05","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"Ｂ101","broker":"中国バス不動産　北店","staff":"黒川","contractDate":"2024-06-15","applyDate":"2024-05-17","status":"キャンセル"},{"property":"アルヴィータＢ","room":"101.0","broker":"中国バス","staff":"黒川","contractDate":"2024-06-15","applyDate":"2024-06-02","status":"契約書類返送完備"},{"property":"タラッサ","room":"107.0","broker":"ワールドクィーン株式会社","staff":"鳥越","contractDate":"2024-06-15","applyDate":"2024-05-26","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"608.0","broker":"エイブル倉敷駅北店","staff":"福島","contractDate":"2024-06-19","applyDate":"2024-05-30","status":"契約書類返送完備"},{"property":"アルバ","room":"北206","broker":"アフィット不動産","staff":"箱崎","contractDate":"2024-06-20","applyDate":"2024-06-12","status":"契約書類返送完備"},{"property":"メゾンドリヴァージュ","room":"Ｂ105","broker":"大東建託リーシング","staff":"近藤","contractDate":"2024-06-25","applyDate":"2024-05-23","status":"契約書類返送完備"},{"property":"テタンジェ","room":"106.0","broker":"ホーミィエステート株式会社","staff":"越智","contractDate":"2024-06-29","applyDate":"2024-05-11","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"B108","broker":"中国バス北","staff":"高橋","contractDate":"2024-06-29","applyDate":"2024-06-23","status":"契約書類返送完備"},{"property":"サントーシャ","room":"202.0","broker":"大東建託リーシング","staff":"山田","contractDate":"2024-06-30","applyDate":"2024-06-07","status":"契約書類返送完備"},{"property":"アルバ南","room":"205.0","broker":"中国バス　南店","staff":"中山","contractDate":"2024-06-30","applyDate":"2024-06-08","status":"契約書類返送完備"},{"property":"タラッサ","room":"112.0","broker":"ワールドクィーン株式会社","staff":"鳥越","contractDate":"2024-07-01","applyDate":"2024-06-02","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"302.0","broker":"名義変更","staff":"","contractDate":"2024-07-01","applyDate":"2024-06-05","status":"契約書類返送完備"},{"property":"テタンジェ","room":"105.0","broker":"アパマンショップ倉敷白楽町店","staff":"左京","contractDate":"2024-07-01","applyDate":"2024-06-09","status":"契約書類返送完備"},{"property":"テタンジェ","room":"103.0","broker":"ホーミィエステート(株)　倉敷駅北口店","staff":"矢野","contractDate":"2024-07-01","applyDate":"2024-06-09","status":"契約書類返送完備"},{"property":"ソフィア","room":"202.0","broker":"大東リーシング","staff":"山田","contractDate":"2024-07-01","applyDate":"2024-06-04","status":"契約書類返送完備"},{"property":"ソルトグラス","room":"203.0","broker":"大東建託リーシング","staff":"近藤","contractDate":"2024-07-01","applyDate":"2024-06-10","status":"契約書類返送完備"},{"property":"スピネル","room":"105.0","broker":"ＩＲＥライフ株式会社","staff":"","contractDate":"2024-07-01","applyDate":"2024-05-02","status":"契約書類返送完備"},{"property":"アプリシティ","room":"203.0","broker":"ハマ不動産","staff":"藤井","contractDate":"2024-07-01","applyDate":"2024-06-23","status":"契約書類返送完備"},{"property":"ローレルコート霞町","room":"1301.0","broker":"あかりホーム","staff":"藤村","contractDate":"2024-07-14","applyDate":"2024-07-01","status":"契約書類返送完備"},{"property":"マジェステ","room":"B103","broker":"大東建託リーシング株式会社　三原店","staff":"速水","contractDate":"2024-07-14","applyDate":"2024-07-01","status":"契約書類返送完備"},{"property":"アシンプトート","room":"Ａ303","broker":"ＩＲＥライフ株式会社","staff":"","contractDate":"2024-07-17","applyDate":"2024-06-27","status":"契約書類返送完備"},{"property":"マジェステ","room":"Ｂ102","broker":"大東建託リーシング株式会社　三原店","staff":"速水","contractDate":"2024-07-24","applyDate":"2024-07-08","status":"契約書類返送完備"},{"property":"テタンジェ","room":"101.0","broker":"(株)アークス　エイブル　水島店","staff":"山下","contractDate":"2024-07-25","applyDate":"2024-06-13","status":"契約書類返送完備"},{"property":"マジェステ","room":"Ｂ206","broker":"㈱タカハシ　東尾道駅前店","staff":"大瀬戸","contractDate":"2024-07-25","applyDate":"2024-07-11","status":"契約書類返送完備"},{"property":"エルキュール","room":"C203","broker":"住まいのクエスト","staff":"富田","contractDate":"2024-07-28","applyDate":"2024-06-29","status":"契約書類返送完備"},{"property":"アルカディア","room":"Ｂ302","broker":"ケイアイ沖野上","staff":"佐久間","contractDate":"2024-07-28","applyDate":"2024-07-10","status":"契約書類返送完備"},{"property":"タラッサ","room":"202.0","broker":"㈱ワイケイ","staff":"安野","contractDate":"2024-08-01","applyDate":"2024-06-20","status":"契約書類返送完備"},{"property":"ミーティア","room":"Ｂ202","broker":"大東建託リーシング株式会社","staff":"山田","contractDate":"2024-08-01","applyDate":"2024-07-14","status":"契約書類返送完備"},{"property":"ユニキューブ浦上","room":"B","broker":"いえなび","staff":"宮地","contractDate":"2024-08-01","applyDate":"2024-06-21","status":"契約書類返送完備"},{"property":"ソレイユ","room":"西103","broker":"いえなび","staff":"高木","contractDate":"2024-08-01","applyDate":"2024-07-27","status":"契約書類返送完備"},{"property":"アルバ","room":"北107","broker":"ＩＲＥライフ株式会社","staff":"","contractDate":"2024-08-20","applyDate":"2024-08-10","status":"キャンセル"},{"property":"シンティランテ","room":"103.0","broker":"あかりホーム","staff":"","contractDate":"2024-08-20","applyDate":"2024-07-05","status":"契約書類返送完備"},{"property":"アロモント","room":"B102","broker":"ＩＲＥライフ株式会社","staff":"","contractDate":"2024-08-30","applyDate":"2024-07-27","status":"契約書類返送完備"},{"property":"アルカディア","room":"Ａ301","broker":"エイブル　南蔵王","staff":"難波","contractDate":"2024-08-31","applyDate":"2024-07-13","status":"契約書類返送完備"},{"property":"マジェステ","room":"B101","broker":"株式会社タカハシ　東尾道駅","staff":"岡本","contractDate":"2024-08-31","applyDate":"2024-07-25","status":"契約書類返送完備"},{"property":"アルバ","room":"208.0","broker":"エイブル蔵王","staff":"兼田","contractDate":"2024-09-01","applyDate":"2024-07-31","status":"キャンセル"},{"property":"カルムコート","room":"東205","broker":"トリコム","staff":"村上","contractDate":"2024-09-01","applyDate":"2024-08-02","status":"契約書類返送完備"},{"property":"マジェステ","room":"B202","broker":"いえなび","staff":"山本","contractDate":"2024-09-01","applyDate":"2024-08-17","status":"契約書類返送完備"},{"property":"アルカディア","room":"A201","broker":"ＩＲＥライフ株式会社","staff":"名義変更","contractDate":"2024-09-05","applyDate":"2024-07-29","status":"契約書類返送完備"},{"property":"マジェステ→201が申込\nのため105に。\n1ヶ月FR（賃料共益費P）\n+鍵交換代無し","room":"B105","broker":"いえなび","staff":"山本","contractDate":"2024-09-09","applyDate":"2024-09-01","status":"契約書類返送完備"},{"property":"マジェステ","room":"Ｂ201","broker":"ケイアイ　神辺","staff":"馬場","contractDate":"2024-09-15","applyDate":"2024-08-26","status":"契約書類返送完備"},{"property":"アシンプトート","room":"A205","broker":"中国バス不動産福山","staff":"小川","contractDate":"2024-09-15","applyDate":"2024-08-10","status":"契約書類返送完備"},{"property":"シンティランテ","room":"206.0","broker":"いえなび","staff":"高木","contractDate":"2024-09-17","applyDate":"2024-09-03","status":"契約書類返送完備"},{"property":"マジェステ","room":"B203","broker":"タカハシ松永","staff":"佐藤","contractDate":"2024-09-17","applyDate":"2024-08-17","status":"契約書類返送完備"},{"property":"アルカディア","room":"C102","broker":"ケイアイ　福山駅前","staff":"水城","contractDate":"2024-09-18","applyDate":"2024-09-08","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"406.0","broker":"株式会社OFC","staff":"松山","contractDate":"2024-09-21","applyDate":"2024-07-28","status":"契約書類返送完備"},{"property":"マジェステ","room":"B106","broker":"いえなび","staff":"高木","contractDate":"2024-09-21","applyDate":"2024-08-31","status":"契約書類返送完備"},{"property":"アンティカベラカーサ","room":"207.0","broker":"エイブル倉敷駅北店","staff":"山本","contractDate":"2024-09-29","applyDate":"2024-09-21","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"503.0","broker":"穴吹ハウジングサービス　倉敷","staff":"久保田","contractDate":"2024-09-29","applyDate":"2024-09-13","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"202.0","broker":"穴吹ハウジングサービス","staff":"村木","contractDate":"2024-09-29","applyDate":"2024-09-11","status":"契約書類返送完備"},{"property":"アルバ","room":"南201","broker":"エイブル南蔵王","staff":"兼田","contractDate":"2024-09-30","applyDate":"2024-08-23","status":"キャンセル"},{"property":"アメリア","room":"101.0","broker":"ケイアイホーム　沖野上","staff":"友滝","contractDate":"2024-09-30","applyDate":"2024-09-18","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"B112","broker":"佐藤エステート","staff":"大元","contractDate":"2024-10-01","applyDate":"2024-08-25","status":"契約書類返送完備"},{"property":"ベラカーサフェリーチェ","room":"603.0","broker":"クローバー不動産","staff":"大塚","contractDate":"2024-10-01","applyDate":"2024-09-22","status":"契約書類返送完備"},{"property":"ルミエール静","room":"A301","broker":"IREライフ株式会社","staff":"","contractDate":"2024-10-15","applyDate":"2024-09-27","status":"契約書類返送完備"},{"property":"ハイサニー","room":"A101","broker":"中国バス不動産福山南店","staff":"光吉","contractDate":"2024-10-20","applyDate":"2024-08-10","status":"契約書類返送完備"},{"property":"ハイサニー","room":"Ｂ201","broker":"ケイアイ沖野上","staff":"友滝","contractDate":"2024-10-21","applyDate":"2024-06-19","status":"契約書類返送完備"},{"property":"ハイサニー","room":"A103","broker":"ＩＲＥライフ株式会社","staff":"","contractDate":"2024-10-26","applyDate":"2024-08-25","status":"契約書類返送完備"},{"property":"ハイサニー","room":"A102","broker":"IREライフ株式会社","staff":"","contractDate":"2024-10-28","applyDate":"2024-09-02","status":"契約書類返送完備"},{"property":"ハイサニー","room":"B203","broker":"ケイアイ福山駅前","staff":"水城","contractDate":"2024-10-29","applyDate":"2024-07-17","status":"キャンセル"},{"property":"ハイサニー","room":"Ｂ202","broker":"タイヨウエステート","staff":"鼻戸","contractDate":"2024-10-31","applyDate":"2024-09-08","status":"契約書類返送完備"},{"property":"スピネルデュオ→AD100","room":"108.0","broker":"いえなび","staff":"山本","contractDate":"2024-10-31","applyDate":"2024-09-11","status":"契約書類返送完備"},{"property":"ディアレスト","room":"201.0","broker":"アフィット不動産","staff":"箱崎","contractDate":"2024-10-31","applyDate":"2024-09-21","status":"契約書類返送完備"},{"property":"スピネルデュオ","room":"101.0","broker":"ＩＲＥライフ株式会社","staff":"","contractDate":"2024-11-01","applyDate":"2024-07-23","status":"キャンセル"},{"property":"ハイサニー","room":"Ｂ203","broker":"佐藤エステート","staff":"津組","contractDate":"2024-11-01","applyDate":"2024-10-05","status":"キャンセル"},{"property":"ハイサニー","room":"Ｂ205","broker":"アカリホーム","staff":"","contractDate":"2024-11-01","applyDate":"2024-06-15","status":"契約書類返送完備"},{"property":"ハイサニー","room":"Ａ106","broker":"いえなび","staff":"山本","contractDate":"2024-11-01","applyDate":"2024-07-18","status":"契約書類返送完備"},{"property":"スピネルデュオ→AD50","room":"105.0","broker":"いえなび","staff":"山本","contractDate":"2024-11-01","applyDate":"2024-08-17","status":"契約書類返送完備"},{"property":"スピネルデュオ→AD50","room":"103.0","broker":"いえなび","staff":"山本","contractDate":"2024-11-01","applyDate":"2024-08-24","status":"契約書類返送完備"},{"property":"ハイサニー","room":"B102","broker":"中国バス不動産株式会社　南店","staff":"光吉","contractDate":"2024-11-01","applyDate":"2024-09-13","status":"契約書類返送完備"},{"property":"シンティランテ","room":"105.0","broker":"ケイアイ沖野上","staff":"大渡","contractDate":"2024-11-01","applyDate":"2024-10-03","status":"契約書類返送完備"},{"property":"フローレンス南蔵王","room":"2階北","broker":"タカセ不動産","staff":"井上","contractDate":"2024-11-01","applyDate":"2024-08-09","status":"契約書類返送完備"},{"property":"アルヴィータ","room":"B103","broker":"中国バス不動産　福山北店","staff":"髙田","contractDate":"2024-11-01","applyDate":"2024-10-13","status":"契約書類返送完備"},{"property":"ハイサニー","room":"B103","broker":"(株)住徳","staff":"垣原","contractDate":"2024-11-02","applyDate":"2024-09-19","status":"契約書類返送完備"},{"property":"シンティランテ","room":"106.0","broker":"エイブル福山蔵王","staff":"難波","contractDate":"2024-11-09","applyDate":"2024-10-03","status":"契約書類返送完備"},{"property":"ミラヴィルタス→軽なら4","room":"西201","broker":"ケイアイ神辺","staff":"小葉竹","contractDate":"2024-11-09","applyDate":"2024-10-06","status":"契約書類返送完備"},{"property":"アルバ","room":"北107","broker":"ケイアイホーム　沖野上","staff":"友滝","contractDate":"2024-11-09","applyDate":"2024-10-28","status":"契約書類返送完備"},{"property":"アルバ","room":"南201","broker":"中国バス不動産　福山店","staff":"小川","contractDate":"2024-11-14","applyDate":"2024-10-11","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"A107","broker":"ピタットハウス新倉敷店","staff":"鳥越","contractDate":"2024-11-20","applyDate":"2024-10-13","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"A106","broker":"ピタットハウス新倉敷店","staff":"松崎","contractDate":"2024-11-20","applyDate":"2024-10-31","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"A103","broker":"株式会社ワイケイ　アパマンショップ沖新店","staff":"上田","contractDate":"2024-11-20","applyDate":"2024-11-07","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"B102","broker":"ピタットハウス新倉敷店","staff":"川上","contractDate":"2024-11-21","applyDate":"2024-10-22","status":"キャンセル"},{"property":"スピネルデュオ⇒AD200","room":"106.0","broker":"大東建託リーシング株式会社","staff":"近藤","contractDate":"2024-11-23","applyDate":"2024-10-28","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"A102","broker":"株式会社アクセスホーム","staff":"藤田","contractDate":"2024-11-23","applyDate":"2024-10-28","status":"契約書類返送完備"},{"property":"セラータ","room":"108.0","broker":"㈱ケイアイホーム　福山駅前店","staff":"矢口","contractDate":"2024-11-28","applyDate":"2024-10-27","status":"契約書類返送完備"},{"property":"ソルトグラス","room":"108.0","broker":"大東建託リーシング","staff":"平田","contractDate":"2024-11-29","applyDate":"2024-10-20","status":"契約書類返送完備"},{"property":"ハイサニー","room":"A105","broker":"佐藤エステート","staff":"大元","contractDate":"2024-11-30","applyDate":"2024-08-24","status":"契約書類返送完備"},{"property":"ハイサニー","room":"B203","broker":"エイブルＮＷ福山蔵王店　株式会社アークス","staff":"兼田","contractDate":"2024-11-30","applyDate":"2024-10-17","status":"契約書類返送完備"},{"property":"ソフィア","room":"106.0","broker":"ケイアイホーム　沖野上","staff":"藤井","contractDate":"2024-11-30","applyDate":"2024-10-31","status":"契約書類返送完備"},{"property":"セラータ","room":"202.0","broker":"中国バス不動産　北店","staff":"野島","contractDate":"2024-11-30","applyDate":"2024-11-08","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"A105","broker":"エイブルネットワークイオンモール倉敷店","staff":"阿部","contractDate":"2024-12-01","applyDate":"2024-10-25","status":"契約書類返送完備"},{"property":"ノブリス","room":"Ｂ101","broker":"中国バス不動産　南店","staff":"高田","contractDate":"2024-12-01","applyDate":"2024-10-13","status":"契約書類返送完備"},{"property":"アルカディア","room":"B301","broker":"ケイアイ沖野上","staff":"大渡","contractDate":"2024-12-01","applyDate":"2024-10-13","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"Ｂ103","broker":"ＩREライフ株式会社","staff":"","contractDate":"2024-12-01","applyDate":"2024-10-28","status":"契約書類返送完備"},{"property":"アルカディア","room":"D201","broker":"大東建託リーシング株式会社","staff":"平田","contractDate":"2024-12-01","applyDate":"2024-11-03","status":"契約書類返送完備"},{"property":"メゾンドリヴァージュ","room":"Ｂ305","broker":"中国バス不動産　北店","staff":"宗政","contractDate":"2024-12-01","applyDate":"2024-11-15","status":"契約書類返送完備"},{"property":"クラリス","room":"105.0","broker":"いえなび","staff":"宮地","contractDate":"2024-12-01","applyDate":"2024-11-13","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"A201","broker":"ピタットハウス新倉敷店","staff":"鳥越","contractDate":"2024-12-12","applyDate":"2024-11-15","status":"契約書類返送完備"},{"property":"ベラカーササウス","room":"802.0","broker":"ホーミィエステート","staff":"矢野","contractDate":"2024-12-13","applyDate":"","status":"契約書類返送完備"},{"property":"アルバ","room":"北206","broker":"穴吹ハウジングサービス","staff":"安部","contractDate":"2024-12-14","applyDate":"2024-11-22","status":"契約書類返送完備"},{"property":"アプリシティ","room":"101.0","broker":"アパマンショップ福山東インター南店","staff":"加藤","contractDate":"2024-12-14","applyDate":"2024-11-23","status":"契約書類返送完備"},{"property":"ノブリス","room":"Ｂ102","broker":"エイブル蔵王","staff":"大塚","contractDate":"2024-12-15","applyDate":"2024-10-19","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"B105","broker":"IREライフ株式会社","staff":"","contractDate":"2024-12-15","applyDate":"2024-10-20","status":"契約書類返送完備"},{"property":"タラッサ","room":"108.0","broker":"ピタットハウス新倉敷店","staff":"川上","contractDate":"2024-12-15","applyDate":"2024-11-03","status":"契約書類返送完備"},{"property":"タリスヴィータ","room":"B102","broker":"株式会社さくらコーポレーション","staff":"久保津","contractDate":"2024-12-15","applyDate":"2024-11-10","status":"契約書類返送完備"},{"property":"スピネルデュオ","room":"102.0","broker":"エイブル　福山蔵王","staff":"井上","contractDate":"2024-12-15","applyDate":"2024-11-10","status":"契約書類返送完備"},{"property":"マーベラス","room":"A105","broker":"大東建託リーシング株式会社","staff":"山田","contractDate":"2024-12-15","applyDate":"2024-10-31","status":"契約書類返送完備"},{"property":"スピネルデュオ","room":"107.0","broker":"ハマ不動産","staff":"藤井","contractDate":"2024-12-20","applyDate":"2024-11-10","status":"契約書類返送完備"},{"property":"カルムコート","room":"西101","broker":"中国バス不動産　南店","staff":"光吉","contractDate":"2024-12-21","applyDate":"2024-11-23","status":"契約書類返送完備"},{"property":"アロモント","room":"B203","broker":"株式会社ケイアイホーム","staff":"水城","contractDate":"2024-12-22","applyDate":"2024-10-20","status":"契約書類返送完備"},{"property":"ミラヴィルタス西","room":"202.0","broker":"ケイアイ　神辺","staff":"坂井","contractDate":"2024-12-22","applyDate":"2024-11-10","status":"契約書類返送完備"},{"property":"アルカディア","room":"A202","broker":"大東建託リーシング株式会社","staff":"山田","contractDate":"2024-12-22","applyDate":"2024-11-24","status":"契約書類返送完備"},{"property":"アプリシティ","room":"106.0","broker":"中国バス不動産　南店","staff":"光吉","contractDate":"2024-12-22","applyDate":"2024-12-15","status":"契約書類返送完備"},{"property":"ハイサニー","room":"B105","broker":"タイヨウエステート","staff":"岡山","contractDate":"2024-12-23","applyDate":"2024-12-11","status":"契約書類返送完備"},{"property":"ルミエール静","room":"B101","broker":"アヤカホーム","staff":"吉岡","contractDate":"2024-12-24","applyDate":"2024-12-17","status":"契約書類返送完備"},{"property":"モデルノ","room":"303.0","broker":"ケイアイホーム　沖野上","staff":"馬場","contractDate":"2024-12-26","applyDate":"2024-11-27","status":"契約書類返送完備"},{"property":"ヒラリアス","room":"101.0","broker":"いえなび","staff":"山本","contractDate":"2025-02-20","applyDate":"2024-12-07","status":"キャンセル"},{"property":"ベラカーサフェリーチェ","room":"201.0","broker":"エイブルNW市役所前店","staff":"木下（代理；茅窪）","contractDate":"","applyDate":"2025-01-05","status":"審査落ち"},{"property":"タリスヴィータ","room":"Ａ105","broker":"㈱さくらコーポレーション","staff":"日名","contractDate":"","applyDate":"2024-10-03","status":"審査落ち"},{"property":"アルバ","room":"北206","broker":"エイブル蔵王","staff":"井上","contractDate":"","applyDate":"2024-10-19","status":"キャンセル"},{"property":"クラリス","room":"105.0","broker":"大東建託リーシング株式会社","staff":"山田","contractDate":"","applyDate":"2024-11-10","status":"審査落ち"},{"property":"メゾンドリヴァージュ","room":"B305","broker":"","staff":"","contractDate":"","applyDate":"2024-11-03","status":"審査落ち"}];
// 履歴は捨てません。下の集計で「この端末が管理している物件」の分だけを使います。
// 履歴の客付時期を取り出す（統計互換）
function _histWhen(h){
  const raw=(h.contractDate||h.applyDate||"");
  const m=String(raw).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if(m){return{year:m[1],disp:m[1]+"/"+m[2].padStart(2,"0")+"/"+m[3].padStart(2,"0"),sort:m[1]+m[2].padStart(2,"0")+m[3].padStart(2,"0")};}
  const m2=String(raw).match(/(\d{4})\D+(\d{1,2})/);
  if(m2){return{year:m2[1],disp:m2[1]+"/"+m2[2].padStart(2,"0"),sort:m2[1]+m2[2].padStart(2,"0")+"00"};}
  return{year:"",disp:"時期不明",sort:"00000000"};
}
// キャンセル判定
function _isCancel(s){ return /キャンセル|解約|取消|中止|審査落ち/.test(String(s||"")); }
// 過去データの状態文字列を「成約 / キャンセル / 審査落ち」に分類する
function _cancelKind(s){
  const t = String(s||"");
  if(/審査落ち|否決|非承認/.test(t)) return "reject";
  if(/キャンセル|解約|取消|中止/.test(t)) return "cancel";
  return "ok";
}
// 率の表示（小数第1位まで。母数0は「—」）
function _rate(n, d){ return (d>0) ? (Math.round(n/d*1000)/10) + "%" : "—"; }
 
// ====== 客付業者 統計 ======
function openBrokerStats(){
  renderBrokerStats();
  document.getElementById('bstat-backdrop').classList.add('active');
  const m = document.getElementById('bstat-modal');
  m.classList.add('active');
  m.setAttribute('aria-hidden','false');
}
function closeBrokerStats(){
  document.getElementById('bstat-backdrop').classList.remove('active');
  const m = document.getElementById('bstat-modal');
  m.classList.remove('active');
  m.setAttribute('aria-hidden','true');
}
// 契約の「客付時期」を取り出す(契約日→なければ申込日)。表示用 & 年フィルタ用の両方を返す
function brokerWhen(c){
  const raw = (c.contractDate || c.applyDate || '');
  const m = String(raw).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if(m){ return { year:m[1], disp:m[1]+'/'+m[2].padStart(2,'0')+'/'+m[3].padStart(2,'0'), sort:m[1]+m[2].padStart(2,'0')+m[3].padStart(2,'0') }; }
  const m2 = String(raw).match(/(\d{4})\D+(\d{1,2})/);
  if(m2){ return { year:m2[1], disp:m2[1]+'/'+m2[2].padStart(2,'0'), sort:m2[1]+m2[2].padStart(2,'0')+'00' }; }
  return { year:'', disp:'時期不明', sort:'00000000' };
}
// 業者名の正規化（全半角スペース・前後空白を吸収して名寄せ）
/* ==== 業者名の名寄せ ====================================================
   「会社名」と「地域名」が同じなら、書き方が違っても同じ店舗として数えます。
     例）ケイアイ沖野上 ／ ケイアイホーム沖野上店 ／ 株式会社ケイアイホーム　沖野上
         → どれも「ケイアイ 沖野上」
   そろえているもの
     ・株式会社／有限会社／㈱／㈲／( )／空白／全角半角
     ・髙→高、﨑→崎 のような異体字
     ・会社名の言い方の違い（ケイアイ＝ケイアイホーム、大東建託＝大東建託リーシング、
       中国バス＝中国バス不動産、さくら＝さくらコーポレーション、穴吹＝あなぶき）
     ・店名に付く「エイブルNW」「アパマンショップ」などのブランド名
     ・店名の頭の市名（福山○○店→○○店）。ただし市名だけの店はそのまま
     ・末尾の「店」「支店」「営業所」
   ★下の _BROKER_STEMS が会社の一覧です。会社を足したいときはここに1行足します。
     （上にあるものから先に照合します。運営会社を上、ブランド名を下に置いてください）
   ====================================================================== */
const _BROKER_STEMS = [
  ['アークス','アークス'],
  ['BRUNO不動産','BRUNO不動産'], ['ブルーノ不動産','BRUNO不動産'],
  ['ワイケイ','ワイケイ'], ['タカハシ','タカハシ'],
  ['さくらコーポレーション','さくら'], ['さくら','さくら'],
  ['穴吹ハウジングサービス','穴吹'], ['あなぶきハウジングサービス','穴吹'],
  ['穴吹','穴吹'], ['あなぶき','穴吹'],
  ['良和ハウス','良和ハウス'],
  ['大東建託リーシング','大東建託'], ['大東リーシング','大東建託'], ['大東建託','大東建託'],
  ['東建コーポレーション','東建コーポレーション'], ['東建','東建コーポレーション'],
  ['中国バス不動産','中国バス'], ['中国バス','中国バス'], ['中バス','中国バス'],
  ['いえなび','いえなび'],
  ['ケイアイホーム','ケイアイ'], ['ケイアイ','ケイアイ'],
  ['タイヨウエステート','タイヨウエステート'], ['トリコム','トリコム'],
  ['ホーミィエステート','ホーミィエステート'], ['ホーミィ','ホーミィエステート'],
  ['不動産の岩原','不動産の岩原'],
  ['佐藤エステート','佐藤エステート'], ['エステート高橋','エステート高橋'],
  ['住まいのクエスト','住まいのクエスト'], ['ネクステージホーム','ネクステージホーム'],
  ['アヤカホーム','アヤカホーム'], ['あかりホーム','あかりホーム'], ['アカリホーム','あかりホーム'],
  ['オリゾン','オリゾン'],
  /* ここから下は岡山（PIVOT3）でよく出てくる会社です */
  ['ホームメイト','ホームメイト'],
  ['SUMIKA','SUMIKA'], ['スミカ','SUMIKA'],
  /* 「ジェイ・フィール Doors岡山駅前店」はジェイフィールの店なので、ドアーズより先に置きます */
  ['ジェイフィール','ジェイフィール'],
  ['ドアーズ','ドアーズ'], ['DOORS','ドアーズ'],
  ['サンホーム','サンホーム'],
  ['ピタットハウス','ピタットハウス'], ['ピタット','ピタットハウス'],
  ['センチュリー','センチュリー'],
  ['リブマックス','リブマックス'],
  ['住まいるプラス','住まいるプラス'],
  ['あびこ不動産','あびこ'], ['あびこ','あびこ'],
  ['ハレルヤ','ハレルヤ'],
  ['シティホーム','シティホーム'], ['シティ','シティホーム'],
  ['コネクトホーム','コネクト'], ['コネクト','コネクト'],
  ['ハイクレスト','ハイクレスト'], ['HYクレスト','ハイクレスト'],
  ['OFCホーム','OFC'], ['OFC','OFC'],
  ['和幸産業','和幸'], ['和幸','和幸'],
  ['二子不動産','二子'], ['二子','二子'],
  ['ウィーク','ウィーク'], ['アーバンザハウス','アーバンザハウス'],
  ['リッチマンエステート','リッチマンエステート'], ['リッチマン','リッチマンエステート'],
  ['エムズクリエイト','エムズクリエイト'],
  ['スマイルエステート','スマイルエステート'], ['キンキ','キンキ'],

  /* 同じ会社が別の書き方で分かれていたものをまとめます。
     ★注意★ 上にあるものから先に当てはめます。
     「一矢三恵不動産」は「三恵不動産」とは別の会社なので、かならず先に置きます。 */
  ['一矢三恵','一矢三恵'],
  ['三恵不動産','三恵'], ['三恵','三恵'],
  ['トーラス岡山','トーラス'], ['TORUS不動産岡山','トーラス'], ['TORUS岡山','トーラス'],
  ['トーラス','トーラス'], ['TORUS','トーラス'],
  ['BULL岡山','BULL'], ['BULL','BULL'],
  ['コザックスグループ','コザックス'], ['コザックス','コザックス'],
  ['ビースタイル','ビースタイル'], ['B-STYLE岡山','ビースタイル'], ['B-STYLE','ビースタイル'], ['BSTYLE','ビースタイル'],
  ['ギャラクシーホーム','ギャラクシーホーム'],
  ['桃太郎不動産','桃太郎不動産'],
  ['アーモンドホーム岡山','アーモンドホーム'], ['アーモンドホーム','アーモンドホーム'],
  ['キャピタルバンク岡山','キャピタルバンク'], ['キャピタルバンク','キャピタルバンク'],
  ['ヒムカコーポレーション岡山','ヒムカ'], ['ヒムカコーポレーション','ヒムカ'], ['ヒムカ','ヒムカ'],
  ['チアーズ岡山','チアーズ'], ['チアーズ','チアーズ'],
  ['山陽地所','山陽地所'],
  ['クローバー不動産','クローバー'], ['クローバー','クローバー'],
  ['後楽不動産','後楽不動産'],
  ['岡山スイキュウ','スイキュウ'], ['スイキュウ','スイキュウ'],
  ['クレオ建設岡山','クレオ建設'], ['クレオ建設','クレオ建設'], ['クレオ','クレオ建設'],
  ['ハート不動産','ハート不動産'],
  ['若葉エステート岡山','若葉エステート'], ['若葉エステート','若葉エステート'],
  ['不動産ショップIZUMI','izumi'], ['IZUMI岡山','izumi'], ['IZUMI','izumi'],
  ['グリーンマネジメント岡山','グリーンマネジメント'], ['グリーンマネジメント','グリーンマネジメント'],
  ['おうち家','おうち家'],
  ['マルヤマ岡山','マルヤマ'], ['マルヤマ','マルヤマ'],
  ['庄エンタープライズ','庄エンター'], ['庄エンター','庄エンター'],
  ['吉備土地開発','吉備土地開発'],
  ['コスモス不動産岡山','コスモス'], ['コスモス岡山','コスモス'], ['コスモス','コスモス'],
  ['浅野不動産','浅野不動産'],
  ['ダイシン','ダイシン'],
  ['つぼみ岡山','つぼみ'], ['つぼみ','つぼみ'],
  ['オージーアイ岡山','オージーアイ'], ['オージーアイ','オージーアイ'],
  ['大吉不動産岡山','大吉不動産'], ['大吉不動産','大吉不動産'],
  ['ワンオンプラス','ワンオンプラス'],
  ['ハマ不動産','ハマ不動産'],
  ['アフィット','アフィット'],
  ['ヘヤサーチ','ヘヤサーチ'],
  ['エルムワン','エルムワン'],
  ['タスティ','タスティ'],
  ['テイクスマイル','テイクスマイル'],
  ['匠エンタープライズ','匠エンタープライズ'],
  ['新都市不動産','新都市不動産'],
  ['大森商事','大森商事'],
  ['フクシマ宅建','フクシマ宅建'],
  ['ルーム高屋','ルーム高屋'],
  ['大成工業','大成工業'],

  /* 「ホームズライフ」は自社ではないので、「ライフ」より先に置きます */
  ['ホームズライフ','ホームズライフ'],
  ['IREライフ','自社（IREライフ）'], ['自社','自社（IREライフ）'], ['ライフ','自社（IREライフ）'],
  ['エイブル','エイブル'], ['アパマンショップ','アパマンショップ'], ['ミニミニ','ミニミニ'],
  /* 「大東岡山東」のような略記も大東建託としてまとめます。上の長い書き方を先に当てるので、ここは最後です */
  ['大東','大東建託']
];

const _BROKER_BRAND = /(エイブルネットワーク|エイブルNW|エイブル|アパマンショップ|ミニミニFC|ミニミニ|ハウジングサービス|リーシング|コーポレーション|ホーム|不動産|ネットワーク|NW|FC)/g;
const _BROKER_CITY  = /^(福山|倉敷|岡山|尾道|三原|広島|府中|総社|津山)(?=.+)/;
const _BROKER_HONTEN = /(本店|本社|本部)$/;      // 「本店」は支店名ではないので落とす
const _KANJI_VAR = { '髙':'高','﨑':'崎','濵':'浜','濱':'浜','德':'徳','眞':'真','靑':'青' };
// 空白・記号・会社の種類・異体字をそろえます
function _normBroker(s){
  let n = String(s||'');
  try{ n = n.normalize('NFKC'); }catch(e){}
  n = n.replace(/[髙﨑濵濱德眞靑]/g, c => _KANJI_VAR[c] || c);
  // 「<info@...>」のようにメールアドレスが混ざっているものは落とします
  n = n.replace(/<[^>]*>?/g, '');
  // 「⇒総社店」のような移転メモは落とし、契約した当時の店舗名で数えます
  n = n.split(/[⇒→]/)[0];
  // 「株式会」のような打ち間違いも会社の種類として落とします
  n = n.replace(/(株式会社|有限会社|合同会社|\(株\)|\(有\)|\(合\)|株式会|有限会|合同会)/g, '');
  /* 記号だけを落とします。「ー」は「インター」「サービス」のような
     ふつうの日本語の伸ばす音なので、ぜったいに落としません。 */
  n = n.replace(/[\s　・,，\.。「」『』()（）\-−―]/g, '').trim();
  /* 「-」「ー」だけしか書いていない欄は、業者名が入っていないのと同じです */
  if(/^[ー]+$/.test(n)) n = '';
  return n;
}
// 業者名を「会社」と「店舗(地域名)」に分けます
function _brokerParts(name){
  const n = _normBroker(name);
  if(!n) return { company:'', branch:'' };
  /* 英字の会社名は「Doors」「DOORS」「doors」のように書き方がまちまちなので、
     大文字小文字を区別せずに探します（位置がずれないよう、長さは変えません）。 */
  const nLower = n.toLowerCase();
  for(let i = 0; i < _BROKER_STEMS.length; i++){
    const p = _normBroker(_BROKER_STEMS[i][0]);
    if(!p) continue;
    const j = nLower.indexOf(p.toLowerCase());
    if(j < 0) continue;
    const rest = (n.slice(0, j) + n.slice(j + p.length))
      .replace(_BROKER_BRAND, '')
      .replace(_BROKER_HONTEN, '')
      .replace(/(支店|営業所|店)$/, '')
      .replace(/^[ー]+$/, '')
      .replace(_BROKER_CITY, '')
      .replace(_BROKER_HONTEN, '')
      .replace(/(支店|営業所|店)$/, '');
    return { company: _BROKER_STEMS[i][1], branch: rest };
  }
  // 一覧に無い会社は、そのままの名前で1社として扱います（「本店」だけ落とします）
  return { company: n.replace(_BROKER_HONTEN, '') || n, branch:'' };
}

// 業者名の名寄せ（会社＋店舗で1つ）。表示名も返す
function _canonBroker(name){
  const p = _brokerParts(name);
  if(!p.company) return { key:'', name:String(name||'').trim() };
  return { key: p.company + '|' + p.branch,
           name: p.company + (p.branch ? ' ' + p.branch : '') };
}
// 担当者名をそろえます（（代理○○）などのメモを外し、異体字をそろえます）
function _normStaff(s){
  let n = String(s||'');
  try{ n = n.normalize('NFKC'); }catch(e){}
  n = n.replace(/[（(][^）)]*[）)]/g, '');
  n = n.replace(/[髙﨑濵濱德眞靑]/g, c => _KANJI_VAR[c] || c);
  return n.replace(/[\s\u3000]+/g, '').trim();
}
 
// 統計データを集計して返す(業者ごと)。現在の契約 ＋ PIVOT導入前の履歴(BROKER_HISTORY)を合算
function computeBrokerStats(){
  const yearInput = document.getElementById('bstat-year');
  const fy = yearInput ? String(yearInput.value||'').trim() : '';
  const fyValid = /^\d{4}$/.test(fy);
  const map = {};      // canonKey -> {broker, count, cancel, reject, items:[], months:{}}
  const yearMap = {};  // year -> {count, cancel, reject}
  const monthAll = {}; // "YYYY-MM" -> {count, cancel, reject} 全業者横断
  const propMap = {};  // 建物名 -> { building, count, brokers:{brokerName:count} } 物件別
  // 担当者別。同じ名字の人が別の会社にもいるので、「会社キー|担当者名」でひとりと数えます。
  const staffMap = {}; // "業者キー|担当者名" -> {broker, staff, count, cancel, reject, bldg, lastSort}
 
  // kind: 'ok'(成約) / 'cancel'(キャンセル) / 'reject'(審査落ち)
  function add(broker, when, propName, building, staff, kind){
    const canon = _canonBroker(broker);
    const key = canon.key;
    if(!key) return;
    if(!map[key]) map[key] = { broker: canon.name, count:0, cancel:0, reject:0, items:[], months:{}, bldg:{} };
    const isCx = (kind === 'cancel'), isRj = (kind === 'reject'), ng = isCx || isRj;
    const ym = (when.sort && when.sort.length>=6 && when.sort.slice(4,6)!=='00') ? (when.sort.slice(0,4)+'-'+when.sort.slice(4,6)) : '';
    if(isCx){ map[key].cancel++; }
    else if(isRj){ map[key].reject++; }
    else {
      map[key].count++;
      if(ym){
        if(!map[key].months[ym]) map[key].months[ym] = { count:0, props:[] };
        map[key].months[ym].count++;
        map[key].months[ym].props.push(propName);
      }
      // 業者ごとの建物別カウント（Best3用・成約のみ）
      if(building){ map[key].bldg[building] = (map[key].bldg[building]||0) + 1; }
    }
    // 全体の月別
    if(ym){
      if(!monthAll[ym]) monthAll[ym] = { count:0, cancel:0, reject:0 };
      if(isCx) monthAll[ym].cancel++; else if(isRj) monthAll[ym].reject++; else monthAll[ym].count++;
    }
    // 物件別（建物名 → 業者別件数。成約のみ）
    if(building && !ng){
      if(!propMap[building]) propMap[building] = { building, count:0, brokers:{} };
      propMap[building].count++;
      propMap[building].brokers[canon.name] = (propMap[building].brokers[canon.name]||0) + 1;
    }
    map[key].items.push({ property: propName, staff:(staff||'').trim(), when: when.disp, sort: when.sort, cancel: ng, kind: (isCx?'cancel':(isRj?'reject':'ok')) });
    // ---- 担当者ごとの集計 ----
    // 担当者は「会社」でひとりと数えます（店舗が変わっても同じ人なので合算）。
    // どの店で決めたかは内訳(store)に残して、カードに出します。
    const _stf = _normStaff(staff);
    if(_stf){
      const _pt  = _brokerParts(broker);
      const _cmp = _pt.company || key;
      const _br  = _pt.branch || '本店';
      const sKey = _cmp + '||' + _stf;
      if(!staffMap[sKey]) staffMap[sKey] = { key:sKey, broker:_cmp, staff:_stf, count:0, cancel:0, reject:0, bldg:{}, store:{}, lastSort:'' };
      const S = staffMap[sKey];
      if(isCx){ S.cancel++; }
      else if(isRj){ S.reject++; }
      else {
        S.count++;
        if(building){ S.bldg[building] = (S.bldg[building]||0) + 1; }
        S.store[_br] = (S.store[_br]||0) + 1;
        if(when.sort && when.sort !== '00000000' && when.sort > S.lastSort){ S.lastSort = when.sort; }
      }
    }
    const yr = when.year || '不明';
    if(!yearMap[yr]) yearMap[yr] = { count:0, cancel:0, reject:0 };
    if(isCx) yearMap[yr].cancel++; else if(isRj) yearMap[yr].reject++; else yearMap[yr].count++;
  }
 
  // 現在の契約カード（完了タブへ移動した確定分だけを集計する）
  Object.values(loadAll()).forEach(c => {
    if(!c.archived) return;                    // 完了タブに入るまでは集計しない
    const broker = (c.broker || '').trim(); if(!broker) return;
    const w = brokerWhen(c);
    if(fyValid && w.year !== fy) return;
    const roomNo = c.room ? String(c.room).replace(/^P/i,'') : '';
    const bldg = (c.property||'(物件未入力)').trim();
    add(broker, w, bldg + (roomNo ? ' '+roomNo+'号' : ''), bldg, c.staff,
        (c.dealStatus === 'cancel') ? 'cancel' : (c.dealStatus === 'rejected') ? 'reject' : 'ok');
  });
 
    // PIVOT導入前の履歴（カード化しない分析専用データ）
  // この端末の物件一覧(物件マスタ)に載っている物件の分だけを使います。
  // PIVOT2 は自分が持つ物件、PIVOT3 は自分が持つ物件——と、
  // 同じコードのまま、それぞれの担当分だけが集計されます。
  const _myBld = {};
  try{
    const _allBld = (typeof pbLoadAll === 'function') ? (pbLoadAll() || {}) : {};
    Object.keys(_allBld).forEach(k => {
      const nm = String((_allBld[k] || {}).name || '').replace(/[\s　]+/g, '');
      if(nm) _myBld[nm] = 1;
    });
  }catch(e){}
  (typeof BROKER_HISTORY !== 'undefined' ? BROKER_HISTORY : []).forEach(h => {
    /* 元データの打ち間違いをここで直します（直したいものが増えたら、ここに足してください） */
    let _hb = String(h.broker || '').trim();
    if(/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(_hb)) _hb = '';        // 業者名の欄に日付が入っていた
    if(/^(名義変更|更新|再契約|自動更新)$/.test(_hb)) _hb = '';      // 業者ではない（客付けではないので数えない）
    _hb = _hb.replace(/[\s　]*見ない点[\s　]*$/, '');                 // 店舗名の打ち間違い。会社名だけで数える
    const broker = _hb.trim(); if(!broker) return;

    if(!_myBld[String(h.property || '').replace(/[\s　]+/g, '')]) return;  // 自分の物件だけ

    const w = _histWhen(h);
    if(fyValid && w.year !== fy) return;
    const roomNo = h.room ? String(h.room).replace(/^P/i,'').replace(/\.0$/,'') : '';
    const bldg = (h.property||'(物件未入力)').trim();
    add(broker, w, bldg + (roomNo ? ' '+roomNo+'号' : ''), bldg, h.staff, _cancelKind(h.status));
  });

  /* 岡山（PIVOT3）の契約履歴  js/history-okayama.js
     このExcelの物件名はローマ字で、物件一覧のカタカナ名と書き方が違います。
     取り違えると集計が壊れるので、物件でのしぼり込みはしません。
     ファイルを置いていない端末（PIVOT2）では、何も起きません。 */
  if(typeof OKAYAMA_HISTORY_RAW !== 'undefined'){
    OKAYAMA_HISTORY_RAW.forEach(a => {
      const ob = String(a[2] || '').trim(); if(!ob) return;
      const oh = { property:a[0], room:a[1], broker:ob, staff:a[3],
                   contractDate:/^\d{4}-\d{2}-\d{2}$/.test(a[4] || '') ? a[4] : '',
                   applyDate:a[5], status:a[6] };
      const ow = _histWhen(oh);
      if(fyValid && ow.year !== fy) return;
      const oRoom = oh.room ? String(oh.room).replace(/^P/i,'').replace(/\.0$/,'') : '';
      const oBldg = (oh.property || '(物件未入力)').trim();
      add(ob, ow, oBldg + (oRoom ? ' '+oRoom+'号' : ''), oBldg, oh.staff, _cancelKind(oh.status));
    });
  }
 
  const rows = Object.values(map);
  rows.forEach(r => {
    r.items.sort((a,b)=>b.sort.localeCompare(a.sort));
    // よく客付けする物件 Best3（建物名・件数順）
    r.top3 = Object.keys(r.bldg||{}).map(b=>({ name:b, count:r.bldg[b] }))
      .sort((a,b)=> b.count - a.count || a.name.localeCompare(b.name,'ja')).slice(0,3);
  });
  rows.sort((a,b)=> b.count - a.count || a.broker.localeCompare(b.broker,'ja'));
  // 各業者の母数(=申込総数)と率を計算
  rows.forEach(r => {
    r.base = r.count + r.cancel + r.reject;
    r.cancelRate = _rate(r.cancel, r.base);
    r.rejectRate = _rate(r.reject, r.base);
  });
  const total = rows.reduce((s,r)=>s+r.count,0);
  const totalCancel = rows.reduce((s,r)=>s+r.cancel,0);
  const totalReject = rows.reduce((s,r)=>s+r.reject,0);
  const totalBase = total + totalCancel + totalReject;
  const cancelRate = _rate(totalCancel, totalBase);
  const rejectRate = _rate(totalReject, totalBase);
  // 年別サマリー（新しい年順）
  const years = Object.keys(yearMap).filter(y=>y!=='不明').sort((a,b)=>b.localeCompare(a))
    .map(y=>({ year:y, count:yearMap[y].count, cancel:yearMap[y].cancel, reject:yearMap[y].reject }));
  // 月別（全体・古い順）
  const monthsAll = Object.keys(monthAll).sort().map(ym=>({ ym, count:monthAll[ym].count, cancel:monthAll[ym].cancel, reject:monthAll[ym].reject }));
  // 物件別ランキング（件数順）：各物件 → 業者別内訳
  const props = Object.values(propMap).map(p=>{
    const brokers = Object.keys(p.brokers).map(b=>({ broker:b, count:p.brokers[b] }))
      .sort((a,b)=> b.count - a.count || a.broker.localeCompare(b.broker,'ja'));
    return { building:p.building, count:p.count, brokers };
  }).sort((a,b)=> b.count - a.count || a.building.localeCompare(b.building,'ja'));
  // 担当者ランキング（成約数の多い順）。会社名つきなので、同姓の別人も区別できます。
  const staffs = Object.values(staffMap).map(s => {
    s.base = s.count + s.cancel + s.reject;
    s.cancelRate = _rate(s.cancel, s.base);
    s.rejectRate = _rate(s.reject, s.base);
    s.top3 = Object.keys(s.bldg||{}).map(b => ({ name:b, count:s.bldg[b] }))
      .sort((a,b) => b.count - a.count || a.name.localeCompare(b.name,'ja')).slice(0,3);
    // どの店で決めたか（多い順）
    s.stores = Object.keys(s.store||{}).map(b => ({ name:b, count:s.store[b] }))
      .sort((a,b) => b.count - a.count || a.name.localeCompare(b.name,'ja'));
    return s;
  }).sort((a,b) => b.count - a.count || a.staff.localeCompare(b.staff,'ja'));
  return { rows, fyValid, fy, total, totalCancel, totalReject, totalBase, cancelRate, rejectRate, years, monthsAll, props, staffs };
}
let _brokerStatMode = 'broker'; // 'broker' | 'property' | 'staff'
function setBrokerStatMode(m){
  if(_brokerStatMode === m) return;
  _brokerStatMode = m;
  /* ★押した瞬間に、まずタブの色だけ先に変えます。
     一覧の作り直しは、画面が一度更新されてからに回します。
     これで「押しても何も起きない」時間がなくなります。 */
  const _body = document.getElementById('bstat-body');
  try{
    document.querySelectorAll('.bstat-mode .bmode').forEach(function(b){
      b.classList.toggle('on', b.getAttribute('data-bmode') === m);
    });
  }catch(e){}
  if(_body) _body.style.opacity = '0.45';
  /* 30ms（画面2コマ分）だけ待ってから作り直します。
     この間に、押したタブの色が先に画面へ出ます。
     ※ requestAnimationFrame は画面が止まっているときに動かないことが
       あるので、確実に動く setTimeout にしています。 */
  setTimeout(function(){
    try{ renderBrokerStats(); } finally { if(_body) _body.style.opacity = ''; }
  }, 30);
}
/* 年の欄は1文字打つごとに作り直していました（「2026」で 4回）。
   手が止まってから 1回だけにします。 */
let _bstatYearTimer = null;
function renderBrokerStatsSoon(){
  if(_bstatYearTimer) clearTimeout(_bstatYearTimer);
  _bstatYearTimer = setTimeout(function(){ _bstatYearTimer = null; renderBrokerStats(); }, 300);
}
/* PDFの中にしか無かった ①TOP20 ②掘り起こし候補 を、画面にも出す。
   計算の考え方は exportBrokerStatsPdf と同じ（最終客付けからの経過月数）。 */
function brokerInsightHtml(rows){
  const now = new Date();
  const fmt = s => (s && s.length>=8) ? (s.slice(0,4)+'/'+s.slice(4,6)+'/'+s.slice(6,8))
                 : (s && s.length>=6) ? (s.slice(0,4)+'/'+s.slice(4,6)) : '';
  const info = rows.map(r => {
    const last = (r.items||[]).find(it => !it.cancel);
    const ls = last ? last.sort : '';
    let gap = '';
    if(ls && ls.length>=6){
      const y = +ls.slice(0,4), mo = +ls.slice(4,6);
      const g = (now.getFullYear()-y)*12 + (now.getMonth()+1 - mo);
      gap = g < 0 ? 0 : g;
    }
    return { r, gap, lastDisp: fmt(ls),
             best3: (r.top3||[]).map(t => esc(t.name)+'('+t.count+')').join(' / ') };
  });
 
  /* ① よく客付けしてくれる業者 TOP20 */
  let topRows = '';
  info.slice(0,20).forEach((x,i) => {
    topRows += '<tr class="' + (i<3 ? 'bi-top3' : '') + '">'
      + '<td class="bi-c bi-rank">' + (i+1) + '</td>'
      + '<td class="bi-nm">' + esc(x.r.broker) + '</td>'
      + '<td class="bi-c"><b>' + x.r.count + '</b></td>'
      + '<td class="bi-c">' + (x.r.cancel || '\u2014') + '</td>'
      + '<td class="bi-c">' + (x.lastDisp || '\u2014') + '</td>'
      + '<td class="bi-b3">' + x.best3 + '</td></tr>';
  });
 
  /* ② 掘り起こし候補（3件以上・6ヶ月以上あいている・経過の長い順） */
  const dig = info.filter(x => x.gap !== '' && x.gap >= 6 && x.r.count >= 3)
                  .sort((a,b) => b.gap - a.gap);
  let digRows = '';
  dig.forEach(x => {
    const lv = (x.gap >= 24) ? 'bi-crit' : (x.gap >= 12) ? 'bi-hot' : 'bi-warn';
    digRows += '<tr class="' + lv + '">'
      + '<td class="bi-nm">' + esc(x.r.broker) + '</td>'
      + '<td class="bi-c">' + x.r.count + ' 件</td>'
      + '<td class="bi-c">' + x.lastDisp + '</td>'
      + '<td class="bi-c bi-gap">' + x.gap + 'ヶ月</td>'
      + '<td class="bi-b3">'
        + (x.r.top3||[]).slice(0,2).map(t => esc(t.name)+'('+t.count+')').join(' / ')
      + '</td></tr>';
  });
 
  return '<div class="bstat-insight">'
    + '<div class="bi-card">'
      + '<div class="bi-h">\u{1F3C6} よく客付けしてくれる業者 TOP20</div>'
      + '<div class="bi-wrap"><table class="bi-table">'
        + '<thead><tr><th>順</th><th>業者</th><th>客付</th><th>ｷｬﾝｾﾙ</th>'
        + '<th>最終客付</th><th>よく決める物件 Best3</th></tr></thead>'
        + '<tbody>' + topRows + '</tbody></table></div>'
    + '</div>'
    + '<div class="bi-card">'
      + '<div class="bi-h">\u{1F514} 掘り起こし候補（広告・再アプローチ対象）'
        + '<span class="bi-sub">3件以上の実績があり、6ヶ月以上あいている業者　'
        + dig.length + ' 社</span></div>'
      + (dig.length
          ? '<div class="bi-wrap"><table class="bi-table">'
            + '<thead><tr><th>業者</th><th>これまでの実績</th><th>最終客付</th>'
            + '<th>経過</th><th>よく決める物件</th></tr></thead>'
            + '<tbody>' + digRows + '</tbody></table></div>'
          : '<div class="bi-none">該当なし。実績のある業者とは、いずれも6ヶ月以内に取引があります。</div>')
    + '</div>'
    + '</div>';
}
 
/* ===== 業者カードの明細を、開いたときに作る仕組み ===== */
let _bcardItems = {};
function _brokerPropsHtml(items){
  return (items||[]).map(it =>
    '<div class="bstat-prop-row' + (it.cancel ? ' is-cancel' : '') + '">' +
      '<span class="pdot">' + (it.kind === 'reject' ? '📕' : (it.cancel ? '🚫' : '●')) + '</span>' +
      '<span class="pname">' + esc(it.property) + (it.kind === 'reject' ? ' <span class="cxtag rjtag">審査落ち</span>' : (it.cancel ? ' <span class="cxtag">ｷｬﾝｾﾙ</span>' : '')) + '</span>' +
      (it.staff ? '<span class="pstaff">' + esc(it.staff) + '</span>' : '') +
      '<span class="pwhen">' + esc(it.when) + '</span>' +
    '</div>'
  ).join('');
}
function _fillBrokerProps(card, i){
  if(!card) return null;
  const box = card.querySelector('.bstat-props');
  if(box && box.getAttribute('data-lazy') === '1'){
    box.innerHTML = _brokerPropsHtml(_bcardItems[i]);
    box.removeAttribute('data-lazy');
  }
  return box;
}
function renderBrokerStats(){
  const { rows, fyValid, fy, total, totalCancel, totalReject, totalBase, cancelRate, rejectRate, years, monthsAll, props: propRanking, staffs: staffRanking } = computeBrokerStats();
  const _now = new Date();
  const THIS_YM = _now.getFullYear() + '-' + String(_now.getMonth()+1).padStart(2,'0'); // 今月 YYYY-MM
  const body = document.getElementById('bstat-body');
  if(rows.length === 0){
    body.innerHTML = '<div class="bstat-empty"><span class="be-ico">🏢</span>' +
      (fyValid ? (fy + '年に客付業者が入力された契約はありません。')
               : '客付業者(仲介業者)が入力された契約がありません。<br>契約カードの「仲介・担当」に業者名を入れると集計されます。') +
      '</div>';
    return;
  }
  const period = fyValid ? (fy + '年') : '全期間(2023〜)';
  const modeTabs = '<div class="bstat-mode">' +
    '<button class="bmode'+(_brokerStatMode==='broker'?' on':'')+'" data-bmode="broker" onclick="KB.setBrokerStatMode(\'broker\')">業者別</button>' +
    '<button class="bmode'+(_brokerStatMode==='property'?' on':'')+'" data-bmode="property" onclick="KB.setBrokerStatMode(\'property\')">物件別</button>' +
    '<button class="bmode'+(_brokerStatMode==='staff'?' on':'')+'" data-bmode="staff" onclick="KB.setBrokerStatMode(\'staff\')">担当者別</button>' +
    '</div>';
  // 集計は、契約画面の黒い件数バーと同じ見た目にそろえる（モノクロ・絵文字なし）
  let html = modeTabs + '<div class="stats-bar bstat-bar">' +
    '<div class="stat-pill bs-period"><span class="num">' + esc(fyValid ? fy : '全期間') + '</span>' +
      '<span class="lbl">' + (fyValid ? '年' : '2023〜') + '</span></div>' +
    (_brokerStatMode==='broker'
      ? '<div class="stat-pill"><span class="num">' + rows.length + '</span><span class="lbl">業者</span></div>'
      : _brokerStatMode==='staff'
      ? '<div class="stat-pill"><span class="num">' + staffRanking.length + '</span><span class="lbl">担当者</span></div>'
      : '<div class="stat-pill"><span class="num">' + propRanking.length + '</span><span class="lbl">物件</span></div>') +
    '<div class="stat-pill"><span class="num">' + total + '</span><span class="lbl">客付</span></div>' +
    '<div class="stat-pill warn"><span class="num">' + totalCancel + '</span><span class="lbl">キャンセル ' + cancelRate + '</span></div>' +
    '<div class="stat-pill"><span class="num">' + totalReject + '</span><span class="lbl">審査落ち ' + rejectRate + '</span></div>' +
    '<div class="stat-pill success"><span class="num">' + totalBase + '</span><span class="lbl">申込総数</span></div>' +
    '</div>' +
    '<div class="bstat-ratenote">率の母数は「成約＋キャンセル＋審査落ち」＝申込総数です。</div>';
 
  // ===== 担当者別ビュー =====
  // 「会社名 ＋ 担当者名」でひとりと数えています。
  // 同じ名字の人が別の会社にいても、混ざらないようにするためです。
  if(_brokerStatMode === 'staff'){
    if(staffRanking.length === 0){
      body.innerHTML = html + '<div class="bstat-empty"><span class="be-ico">👤</span>担当者名の入っているデータがありません。<br>契約カードの「担当」に名前を入れると集計されます。</div>';
      return;
    }
    staffRanking.forEach((s, i) => {
      const rankCls = i < 3 ? ' rk' + (i+1) : '';
      const lastDisp = (s.lastSort && s.lastSort.length>=8)
        ? (s.lastSort.slice(0,4)+'/'+s.lastSort.slice(4,6)+'/'+s.lastSort.slice(6,8))
        : (s.lastSort && s.lastSort.length>=6 ? (s.lastSort.slice(0,4)+'/'+s.lastSort.slice(4,6)) : '');
      const bestRows = (s.top3||[]).length
        ? (s.top3||[]).map((t, bi) =>
            '<div class="pb-row'+(bi===0?' pb-strong':'')+'"><span class="pb-dot">'+(bi===0?'⭐':'●')+'</span><span class="pb-nm">'+esc(t.name)+'</span><span class="pb-ct">'+t.count+'件</span></div>'
          ).join('')
        : '<div class="pb-row"><span class="pb-nm">（物件の記録がありません）</span></div>';
      html += '<div class="bstat-card'+rankCls+'" data-scard="'+i+'">'+
        '<div class="bstat-top bstat-toggle" onclick="KB.toggleStaffCard('+i+')">'+
          '<div class="bstat-medal">'+(i+1)+'</div>'+
          '<div class="bstat-name">'+esc(s.staff)+'</div>'+
          '<div class="bstat-badge"><span class="bnum">'+s.count+'</span><span class="blbl">件</span></div>'+
          '<span class="pb-sub">'+esc(s.broker)+'</span>'+
          '<span class="bstat-caret">▾</span>'+
        '</div>'+
        '<div class="pb-strong-badge">'+
          ((s.stores||[]).length ? '店舗：' + (s.stores||[]).map(x => esc(x.name)+' <b>'+x.count+'</b>').join('／') + '　' : '')+
          'キャンセル <b>'+s.cancel+'</b> 件（'+s.cancelRate+'）／ 審査落ち <b>'+(s.reject||0)+'</b> 件（'+s.rejectRate+'）'+
          (lastDisp ? ' ／ 最終客付け <b>'+lastDisp+'</b>' : '')+
        '</div>'+
        '<div class="bstat-props pb-list bstat-collapsed">'+bestRows+'</div>'+
      '</div>';
    });
    body.innerHTML = html;
    return;
  }

  // ===== 物件別ビュー =====
  if(_brokerStatMode === 'property'){
    if(propRanking.length === 0){ body.innerHTML = html + '<div class="bstat-empty"><span class="be-ico">🏠</span>物件データがありません。</div>'; return; }
    propRanking.forEach((p, i) => {
      const rankCls = i < 3 ? ' rk' + (i+1) : '';
      const topBroker = p.brokers[0];                       // その物件で最多客付けの業者＝強い業者
      const share = topBroker ? Math.round(topBroker.count / p.count * 100) : 0;
      const brokerRows = p.brokers.map((b, bi) =>
        '<div class="pb-row'+(bi===0?' pb-strong':'')+'"><span class="pb-dot">'+(bi===0?'⭐':'●')+'</span><span class="pb-nm">'+esc(b.broker)+'</span><span class="pb-ct">'+b.count+'件</span></div>'
      ).join('');
      // この物件に強い業者バッジ
      const strongBadge = topBroker
        ? '<div class="pb-strong-badge">💪 この物件に強い業者：<b>'+esc(topBroker.broker)+'</b> <span class="pb-share">'+topBroker.count+'件・'+share+'%</span></div>'
        : '';
      html += '<div class="bstat-card'+rankCls+'" data-pcard="'+i+'">'+
        '<div class="bstat-top bstat-toggle" onclick="KB.togglePropCard('+i+')">'+
          '<div class="bstat-medal">'+(i+1)+'</div>'+
          '<div class="bstat-name">'+esc(p.building)+'</div>'+
          '<div class="bstat-badge"><span class="bnum">'+p.count+'</span><span class="blbl">件</span></div>'+
          '<span class="pb-sub">業者'+p.brokers.length+'社</span>'+
          '<span class="bstat-caret">▾</span>'+
        '</div>'+
        strongBadge +
        '<div class="bstat-props pb-list bstat-collapsed">'+brokerRows+'</div>'+
      '</div>';
    });
    body.innerHTML = html;
    return;
  }
 
  // ① TOP20 と ② 掘り起こし候補（今までPDFの中にしか無かったもの）
  html += brokerInsightHtml(rows);
 
  // 全体：年別グラフ（全期間表示のとき）
  if(!fyValid && years.length > 1){
    const ys = years.slice().sort((a,b)=>a.year.localeCompare(b.year)); // 古い順
    const maxc = Math.max(1, ...ys.map(y=>y.count));
    html += '<div class="ov-chart"><div class="ov-h">📅 年ごとの客付け件数</div><div class="ov-bars ov-year">';
    ys.forEach(y=>{
      const h = Math.round(y.count/maxc*100);
      html += '<div class="ovb" title="'+y.year+'年：'+y.count+'件'+(y.cancel?' / ｷｬﾝｾﾙ'+y.cancel:'')+'">'+
        '<div class="ovb-col"><span class="ovb-v">'+y.count+'</span><i style="height:'+Math.max(6,h)+'%"></i></div>'+
        '<button class="ovb-x" onclick="KB.filterBrokerYear(\''+y.year+'\')">'+y.year+'</button></div>';
    });
    html += '</div></div>';
  }
 
  // 全体：月別グラフ（成約件数の推移）
  // ★横に一直線だと毎回スクロールが要るので、年で改行して1年ずつ並べます。
  //   棒の高さは全期間の最大値でそろえてあるので、年をまたいでも高さを比べられます。
  if(monthsAll.length >= 2){
    const maxm = Math.max(1, ...monthsAll.map(m=>m.count));
    const byYear = {};
    monthsAll.forEach(m => { const y = m.ym.slice(0,4); (byYear[y] = byYear[y] || []).push(m); });
    const yearKeys = Object.keys(byYear).sort();
    html += '<div class="ov-chart"><div class="ov-h">📊 月ごとの客付け件数'
          + (fyValid ? '（'+fy+'年）' : '（年ごと）') + '</div>';
    const nowY = _now.getFullYear(), nowM = _now.getMonth()+1;
    yearKeys.forEach(y => {
      const ms = byYear[y];
      const sum = ms.reduce((a,m) => a + m.count, 0);
      /* 年をまたいで月の位置がそろうよう、1月〜12月の枠を必ず並べます。
         記録の無い月は0、まだ来ていない月は空欄にします。 */
      const map = {};
      ms.forEach(m => { map[+m.ym.slice(5)] = m; });
      html += '<div class="ovy-row">'
        + '<div class="ovy-h">' + y + '年 <b>' + sum + '</b> 件</div>'
        + '<div class="ov-bars ov-month">';
      for(let mo = 1; mo <= 12; mo++){
        const mm = String(mo).padStart(2,'0');
        const ym = y + '-' + mm;
        const isNow = (ym === THIS_YM);
        const future = (+y > nowY) || (+y === nowY && mo > nowM);
        if(future){
          html += '<div class="ovb ovb-future"><div class="ovb-col"></div>'
                + '<span class="ovb-x">' + mm + '月</span></div>';
          continue;
        }
        const m = map[mo];
        const cnt = m ? m.count : 0;
        const h = Math.round(cnt/maxm*100);
        html += '<div class="ovb'+(isNow?' ovb-now':'')+(cnt===0?' ovb-zero':'')+'"'
          + ' title="'+ym+'：'+cnt+'件'+((m&&m.cancel)?' / ｷｬﾝｾﾙ'+m.cancel:'')+'">'
          + '<div class="ovb-col"><span class="ovb-v">'+(cnt===0?'':cnt)+'</span>'
          + '<i style="height:'+(cnt===0?2:Math.max(6,h))+'%"></i></div>'
          + '<span class="ovb-x">'+(isNow?'今月':(mm+'月'))+'</span></div>';
      }
      html += '</div></div>';
    });
    html += '</div>';
  }
 
  _bcardItems = {};
  rows.forEach((r, i) => {
    const rankCls = i < 3 ? ' rk' + (i+1) : '';
    const medal = (i+1);
    /* ★明細（客付けの一覧）は、カードを開くまで作りません。
       401社ぶんを先に作ると、目に見えない部品が 24,000個 できてしまい、
       タブを押したときの反応が遅くなっていました。
       開いたときに _fillBrokerProps() が作ります。 */
    _bcardItems[i] = r.items;
    // 月別グラフ（成約のみ・時系列。件数が2以上の業者に表示）
    let monthChart = '';
    const mkeys = Object.keys(r.months).sort();
    if(mkeys.length >= 1 && r.count >= 2){
      const maxm = Math.max(1, ...mkeys.map(k=>r.months[k].count));
      const bars = mkeys.map(k=>{
        const cnt = r.months[k].count;
        const h = Math.round(cnt/maxm*100);
        const lbl = k.slice(2).replace('-','/'); // YY/MM
        const isNow = (k === THIS_YM);
        const isPeak = (cnt === maxm && maxm >= 2);   // その業者で最多件数の月＝比較的多い月
        const plist = (r.months[k].props||[]).join(' / ');
        const cls = isNow ? 'mbar mbar-now' : (isPeak ? 'mbar mbar-peak' : 'mbar');
        return '<div class="'+cls+'">'+
          '<div class="mbar-col" data-tip-ym="'+k+'" data-tip-cnt="'+cnt+'" data-tip-props="'+esc(plist).replace(/"/g,'&quot;')+'"><span class="mbar-v">'+cnt+'</span><i style="height:'+Math.max(8,h)+'%"></i></div>'+
          '<span class="mbar-x">'+(isNow?'今月':lbl)+'</span></div>';
      }).join('');
      monthChart = '<div class="bstat-months"><div class="bm-h">📊 月別の客付け（棒にカーソルで物件一覧）</div><div class="bm-chart">'+bars+'</div></div>';
    }
    // よく客付けする物件 Best3
    let top3html = '';
    if(r.top3 && r.top3.length){
      const medals3 = ['🥇','🥈','🥉'];
      top3html = '<div class="bstat-top3"><div class="bt3-h">🏆 よく客付けする物件</div><div class="bt3-list">' +
        r.top3.map((t,ti)=>'<div class="bt3-item"><span class="bt3-rk">'+medals3[ti]+'</span><span class="bt3-nm">'+esc(t.name)+'</span><span class="bt3-ct">'+t.count+'件</span></div>').join('') +
        '</div></div>';
    }
    html += '<div class="bstat-card' + rankCls + '" data-bcard="'+i+'">' +
      '<div class="bstat-top bstat-toggle" onclick="KB.toggleBrokerCard('+i+')">' +
        '<div class="bstat-medal">' + medal + '</div>' +
        '<div class="bstat-name">' + esc(r.broker) + '</div>' +
        '<div class="bstat-badge"><span class="bnum">' + r.count + '</span><span class="blbl">件</span></div>' +
        (r.cancel ? '<div class="bstat-badge bstat-badge-cx" onclick="event.stopPropagation();KB.showBrokerCancels('+i+')" title="キャンセル分だけ表示"><span class="bnum">' + r.cancel + '</span><span class="blbl">ｷｬﾝｾﾙ</span></div>' : '') +
        (r.reject ? '<div class="bstat-badge bstat-badge-rj" title="審査落ち"><span class="bnum">' + r.reject + '</span><span class="blbl">審査落ち</span></div>' : '') +
        '<span class="bstat-caret">▾</span>' +
      '</div>' +
      '<div class="bstat-rate">申込 <b>' + r.base + '</b> 件　／　キャンセル率 <b class="rt-cx">' + r.cancelRate + '</b>　／　審査落ち率 <b class="rt-rj">' + r.rejectRate + '</b></div>' +
      top3html +
      monthChart +
      '<div class="bstat-props bstat-collapsed" data-lazy="1"></div>' +
    '</div>';
  });
  body.innerHTML = html;
  _attachBmTips();
}
// 月グラフの棒ホバーで物件一覧ツールチップを表示
/* ★以前は、棒 1本ずつに合図を 3つ付けていました。
   棒は 2,500本 あるので、タブを押すたびに 7,600個 付け直していました。
   いまは #bstat-body に 1組だけ付けて、押された棒を見に行きます。
   見た目も動きもこれまでと同じです。 */
let _bmTipBound = false;
function _attachBmTips(){
  const host = document.getElementById('bstat-body');
  if(!host || _bmTipBound) return;
  _bmTipBound = true;
  let tip = document.getElementById('bm-floating-tip');
  if(!tip){
    tip = document.createElement('div');
    tip.id = 'bm-floating-tip';
    tip.style.cssText = 'position:fixed;z-index:99999;display:none;max-width:320px;background:#1c1c1e;color:#fff;font-size:12px;line-height:1.6;padding:10px 12px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.28);pointer-events:none;';
    document.body.appendChild(tip);
  }
  let hideTimer = null;
  const pick = (e) => {
    const t = e.target;
    return (t && t.closest) ? t.closest('.mbar-col[data-tip-ym]') : null;
  };
  const show = (col) => {
    const ym = col.dataset.tipYm, cnt = col.dataset.tipCnt, props = col.dataset.tipProps || '';
    const list = props ? props.split(' / ').map(p=>'・'+p).join('<br>') : '(物件名なし)';
    tip.innerHTML = '<div style="font-weight:800;margin-bottom:5px;color:#7dd3fc">'+ym+'　'+cnt+'件</div>'+list;
    tip.style.display = 'block';
    const r = col.getBoundingClientRect();
    let x = r.left + r.width/2 - tip.offsetWidth/2;
    let y = r.top - tip.offsetHeight - 8;
    x = Math.max(8, Math.min(x, window.innerWidth - tip.offsetWidth - 8));
    if(y < 8) y = r.bottom + 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  };
  const hide = () => { tip.style.display = 'none'; };
  host.addEventListener('mouseover', (e) => { const c = pick(e); if(c) show(c); });
  host.addEventListener('mouseout',  (e) => { if(pick(e)) hide(); });
  host.addEventListener('click', (e) => {
    const c = pick(e);
    if(!c) return;
    e.stopPropagation();
    show(c);
    if(hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 3500);   // タップでも一時表示
  });
}
function filterBrokerYear(y){
  const inp = document.getElementById('bstat-year');
  if(inp){ inp.value = y; renderBrokerStats(); }
}
// 物件カードの業者内訳を開閉
function togglePropCard(i){
  const card = document.querySelector('[data-pcard="'+i+'"]');
  if(!card) return;
  const list = card.querySelector('.bstat-props');
  const caret = card.querySelector('.bstat-caret');
  if(list){ list.classList.toggle('bstat-collapsed'); }
  if(caret){ caret.textContent = (list && list.classList.contains('bstat-collapsed')) ? '▾' : '▴'; }
}
// 担当者カードの「よく決める物件」を開閉
function toggleStaffCard(i){
  const card = document.querySelector('[data-scard="'+i+'"]');
  if(!card) return;
  const list = card.querySelector('.bstat-props');
  const caret = card.querySelector('.bstat-caret');
  if(list){ list.classList.toggle('bstat-collapsed'); }
  if(caret){ caret.textContent = (list && list.classList.contains('bstat-collapsed')) ? '▾' : '▴'; }
}
// 業者カードの物件明細を開閉
function toggleBrokerCard(i){
  const card = document.querySelector('[data-bcard="'+i+'"]');
  if(!card) return;
  const props = _fillBrokerProps(card, i);
  const caret = card.querySelector('.bstat-caret');
  // キャンセル絞り込みが効いていたら解除して全件表示に戻す
  if(props){ props.classList.remove('cx-only'); }
  if(props){ props.classList.toggle('bstat-collapsed'); }
  if(caret){ caret.textContent = (props && props.classList.contains('bstat-collapsed')) ? '▾' : '▴'; }
}
// キャンセルバッジ：その業者のカードを開き、キャンセル分だけ表示
function showBrokerCancels(i){
  const card = document.querySelector('[data-bcard="'+i+'"]');
  if(!card) return;
  const props = _fillBrokerProps(card, i);
  const caret = card.querySelector('.bstat-caret');
  if(props){
    props.classList.remove('bstat-collapsed');   // 開く
    props.classList.add('cx-only');               // キャンセルのみ表示
  }
  if(caret){ caret.textContent = '▴'; }
  // その位置までスクロール
  try{ card.scrollIntoView({behavior:'smooth', block:'nearest'}); }catch(e){}
}
/* ===== CSV／PDF のボタンに、押した合図を出します ==========================
   どちらも 4,600件を数え直してから作るので、少し時間がかかります。
   これまでは押しても見た目が変わらず、効いていないように見えていました。
   押した瞬間にボタンの字を変え、作り終わったら元に戻します。
   二重に押しても、1回しか走りません。
   ======================================================================== */
function _bstatBusy(id, label, run){
  const b = document.getElementById(id);
  if(b && b.dataset.busy) return;              // 連打よけ
  const keep = b ? b.textContent : '';
  if(b){ b.dataset.busy = '1'; b.textContent = label; b.style.opacity = '0.6'; }
  setTimeout(function(){
    try{ run(); }
    finally{
      if(b){ delete b.dataset.busy; b.textContent = keep; b.style.opacity = ''; }
    }
  }, 30);
}
function exportBrokerStatsCsv(){ _bstatBusy('bstat-csv', '作成中…', _doExportBrokerStatsCsv); }
function exportBrokerStatsPdf(){ _bstatBusy('bstat-pdf', '作成中…', _doExportBrokerStatsPdf); }
function _doExportBrokerStatsCsv(){
  const { rows, fyValid, fy } = computeBrokerStats();
  if(rows.length === 0){ alert('出力できる統計データがありません。'); return; }
 
  // "YYYYMMDD" を "YYYY-MM-DD" に整形
  const fmtSort = (s) => (s && s.length>=8) ? (s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8))
                       : (s && s.length>=6) ? (s.slice(0,4)+'-'+s.slice(4,6)) : '';
  // 2つの日付(YYYYMMDD)の差を「およその月数」で返す
  const monthsSince = (sort) => {
    if(!sort || sort.length < 6) return '';
    const y = parseInt(sort.slice(0,4),10), m = parseInt(sort.slice(4,6),10);
    if(isNaN(y)||isNaN(m)) return '';
    const now = new Date();
    return (now.getFullYear()-y)*12 + (now.getMonth()+1 - m);
  };
 
  const header = ['順位','客付業者','成約数','キャンセル数','審査落ち数','申込総数',
                  'キャンセル率','審査落ち率',
                  '最終客付け日','客付けなし(ヶ月)','広告おすすめ',
                  'よく客付けする物件Best3'];
  const lines = [header];
 
  rows.forEach((r, i) => {
    // 成約のみの最新客付け（items は新しい順ソート済み）
    const lastDeal = (r.items||[]).find(it => !it.cancel);
    const lastSort = lastDeal ? lastDeal.sort : '';
    const gap = monthsSince(lastSort);
    // 6ヶ月以上客付けなし＝掘り起こし候補として印
    const reco = (gap !== '' && gap >= 6) ? `★${gap}ヶ月ぶり掘り起こし` : '';
    const best3 = (r.top3||[]).map(t=>`${t.name}(${t.count})`).join(' / ');
    lines.push([
      String(i+1), r.broker, String(r.count), String(r.cancel), String(r.reject||0), String(r.base||0),
      String(r.cancelRate||'—'), String(r.rejectRate||'—'),
      fmtSort(lastSort), (gap===''?'':String(gap)), reco, best3
    ]);
  });
 
  const csv = lines.map(row => row.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\r\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '客付業者統計_' + (fyValid ? fy+'年' : '全期間') + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
// 社長向けPDF資料を出力（印刷ダイアログ方式）。
// ①ランキングTOP20 ＋ ②掘り起こし候補 ＋ ③担当者ランキング（会社名つき）
function _doExportBrokerStatsPdf(){
  const { rows, fyValid, fy, staffs } = computeBrokerStats();
  if(rows.length === 0){ alert('出力できる統計データがありません。'); return; }
  const esc = (s)=> String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 
  // 集計期間（客付け日の最古〜最新）
  let allSort = [];
  rows.forEach(r => (r.items||[]).forEach(it => { if(it.sort && it.sort!=='00000000') allSort.push(it.sort); }));
  allSort.sort();
  const fmtSort = (s)=> (s && s.length>=8) ? (s.slice(0,4)+'/'+s.slice(4,6)+'/'+s.slice(6,8))
                     : (s && s.length>=6) ? (s.slice(0,4)+'/'+s.slice(4,6)) : '';
  const period = allSort.length ? (fmtSort(allSort[0]) + ' 〜 ' + fmtSort(allSort[allSort.length-1])) : '全期間';
 
  // 各業者の最終客付け・経過月数・Best3を用意
  const now = new Date();
 
  // 物件名 → 住所エリア判定用マップ
  const bAll = (typeof loadAll==='function') ? loadAll() : {};
  const addrByName = {};
  Object.values(bAll).forEach(b => { if(b && b.name) addrByName[String(b.name).trim()] = b.addr || ''; });
  // エリア色（福山=紫 / 倉敷=青 / 岡山=緑 / その他=灰）
  const areaOf = (addr)=>{
    const a = String(addr||'');
    if(/福山/.test(a)) return {key:'福山', color:'#7c3aed', bg:'#f5f3ff'};
    if(/倉敷/.test(a)) return {key:'倉敷', color:'#1d4ed8', bg:'#eff6ff'};
    if(/岡山/.test(a)) return {key:'岡山', color:'#047857', bg:'#ecfdf5'};
    if(/広島/.test(a)) return {key:'広島', color:'#b7791f', bg:'#fdf3e0'};
    return {key:'', color:'#555', bg:'#f4f6f8'};
  };
  // 業者の代表エリア = Best3の1位物件のエリア
  const brokerArea = (r)=>{
    const top = (r.top3 && r.top3[0]) ? r.top3[0].name : '';
    return areaOf(addrByName[top] || '');
  };
 
  rows.forEach(r => {
    const lastDeal = (r.items||[]).find(it => !it.cancel);
    r._lastSort = lastDeal ? lastDeal.sort : '';
    if(r._lastSort && r._lastSort.length>=6){
      const y=+r._lastSort.slice(0,4), mo=+r._lastSort.slice(4,6);
      let g=(now.getFullYear()-y)*12 + (now.getMonth()+1 - mo);
      r._gap = g<0 ? 0 : g;
      r._lastDisp = fmtSort(r._lastSort);
    } else { r._gap=''; r._lastDisp=''; }
    r._best3 = (r.top3||[]).map(t=>esc(t.name)+'('+t.count+')').join(' / ');
    r._area = brokerArea(r);
  });
 
  // ① ランキングTOP20（業者名を地域色・地域ドット付き）
  let rankRows = '';
  rows.slice(0,20).forEach((r,i)=>{
    const cls = (i<3) ? ' class="top3"' : (i%2===1 ? ' class="alt"' : '');
    const dot = `<span class="dot" style="background:${r._area.color}"></span>`;
    const nm = `<span style="color:${r._area.color};font-weight:700">${dot}${esc(r.broker)}</span>`;
    rankRows += `<tr${cls}>
      <td class="c">${i+1}</td>
      <td>${nm}</td>
      <td class="c">${r.count}</td>
      <td class="c">${r.cancel||'－'}</td>
      <td class="c">${r._lastDisp||'－'}</td>
      <td>${r._best3}</td></tr>`;
  });
 
  // ② 掘り起こし候補（3件以上・6ヶ月以上・経過の長い順）
  const dig = rows.filter(r=> r._gap!=='' && r._gap>=6 && r.count>=3).sort((a,b)=> b._gap - a._gap);
  let digRows = '';
  dig.forEach(r=>{
    // 緊急度クラス：6-11ヶ月=warn(黄) / 12-23ヶ月=hot(橙) / 24ヶ月以上=crit(赤)
    const lv = (r._gap>=24) ? ' class="crit"' : (r._gap>=12) ? ' class="hot"' : ' class="warn"';
    const dot = `<span class="dot" style="background:${r._area.color}"></span>`;
    const nm = `<span style="color:${r._area.color};font-weight:700">${dot}${esc(r.broker)}</span>`;
    const b2 = (r.top3||[]).slice(0,2).map(t=>esc(t.name)+'('+t.count+')').join(' / ');
    digRows += `<tr${lv}>
      <td>${nm}</td>
      <td class="c">${r.count} 件</td>
      <td class="c">${r._lastDisp}</td>
      <td class="c gap">${r._gap}ヶ月</td>
      <td>${b2}</td></tr>`;
  });
 
  // ③ 担当者ランキング（会社名つき。同姓の別人が混ざらないよう会社名を必ず添えます）
  let staffRows = '';
  (staffs||[]).slice(0,30).forEach((s,i)=>{
    const cls = (i<3) ? ' class="top3"' : (i%2===1 ? ' class="alt"' : '');
    const ar = areaOf(addrByName[(s.top3&&s.top3[0])?s.top3[0].name:''] || '');
    const dot = `<span class="dot" style="background:${ar.color}"></span>`;
    const last = (s.lastSort && s.lastSort.length>=8)
      ? (s.lastSort.slice(0,4)+'/'+s.lastSort.slice(4,6)+'/'+s.lastSort.slice(6,8))
      : (s.lastSort && s.lastSort.length>=6 ? (s.lastSort.slice(0,4)+'/'+s.lastSort.slice(4,6)) : '－');
    const b3 = (s.top3||[]).map(t=>esc(t.name)+'('+t.count+')').join(' / ');
    staffRows += `<tr${cls}>
      <td class="c">${i+1}</td>
      <td class="b">${dot}${esc(s.staff)}</td>
      <td style="color:${ar.color}">${esc(s.broker)}${(s.stores&&s.stores.length)?' <span style="color:#666">('+s.stores.map(x=>esc(x.name)+x.count).join('/')+')</span>':''}</td>
      <td class="c">${s.count}</td>
      <td class="c">${s.cancel||'－'}</td>
      <td class="c">${last}</td>
      <td>${b3}</td></tr>`;
  });

  /* 行数が多いと1枚に入りきらないので、行数に応じて字の大きさを落とします。
     （22行までは今までどおり。30行までは9px、それ以上は8px） */
  const _shrink = (n) => (n <= 22) ? '' : (n <= 30) ? ' class="s9"' : ' class="s8"';
  const _rankN  = Math.min(rows.length, 20);
  const _digN   = dig.length;
  const _stfN   = Math.min((staffs||[]).length, 30);

  const today = new Date();
  const dstr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
 
  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>客付業者分析レポート</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif; color:#222; margin:0; }
  h1 { font-size:22px; color:#1f3a5f; margin:0 0 4px; }
  .sub { font-size:11px; color:#555; margin:0 0 6px; }
  .rule { height:2px; background:#1f3a5f; margin:6px 0 14px; }
  h2 { font-size:15px; color:#1f3a5f; margin:18px 0 4px; }
  .note { font-size:10px; color:#666; margin:2px 0 8px; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  th { background:#1f3a5f; color:#fff; font-weight:700; padding:5px 6px; text-align:left; border:0.5px solid #cfd6de; }
  td { padding:5px 6px; border:0.5px solid #cfd6de; vertical-align:middle; }
  td.c { text-align:center; }
  td.b { font-weight:700; }
  tr.alt td { background:#f4f6f8; }
  tr.top3 td { background:#e8f0fb; }
  #dig th { background:#b7791f; }
  #stf th { background:#155e75; }
  tr.warn td { background:#fdf6e3; }   /* 6-11ヶ月：黄 */
  tr.hot  td { background:#fdecd7; }   /* 12-23ヶ月：橙 */
  tr.crit td { background:#fde0dd; }   /* 24ヶ月以上：赤 */
  td.gap { color:#c0392b; font-weight:700; }
  tr.crit td.gap { color:#7a1f16; }
  .dot { display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:5px; vertical-align:middle; }
  .legend { font-size:9px; color:#555; margin:4px 0 8px; }
  .legend span { display:inline-block; margin-right:10px; }
  .lg { display:inline-block; width:9px; height:9px; border-radius:2px; margin-right:3px; vertical-align:middle; }
  table.s9 { font-size:9px; }  table.s9 th, table.s9 td { padding:3px 5px; }
  table.s8 { font-size:8px; }  table.s8 th, table.s8 td { padding:2px 4px; }
    .pagebreak { page-break-before: always; }
  /* ①②③ は、それぞれ必ず新しいページの頭から始めます。 */
  .page { page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  /* 表は途中で改ページしてかまいません。ただし、
     ・1行の途中では切らない
     ・次のページにも見出し行（青い帯）をくり返す
     ・見出しだけが1枚に取り残されないようにする
     という決まりにします。
     （以前は table ごと break-inside:avoid にしていたため、
     長い表が丸ごと次のページに押し出され、
     見出しだけの白いページができていました） */
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  h1, h2, .note, .legend, .sub, .rule { page-break-after: avoid; break-after: avoid; }
  @media print {
    .noprint { display:none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  .noprint { position:fixed; top:10px; right:10px; }
  .noprint button { font-size:14px; font-weight:700; padding:8px 16px; border:none; border-radius:8px; background:#1f3a5f; color:#fff; cursor:pointer; }
</style></head><body>
<div class="noprint"><button onclick="window.print()">🖨 PDFとして保存 / 印刷</button></div>
<div class="page">
<h1>客付業者 分析レポート</h1>
<div class="sub">作成日：${dstr} ／ 集計期間：${period}（全客付け実績）${fyValid?'／年絞り込み: '+fy+'年':''}</div>
<div class="rule"></div>
 
<h2>① よく客付けしてくれる業者 TOP20</h2>
<div class="note">成約実績の多い順。感謝を伝えつつ関係を維持したい主力業者です。上位3社は青で強調しています。</div>
<div class="legend">エリア色：<span><i class="lg" style="background:#7c3aed"></i>福山</span><span><i class="lg" style="background:#1d4ed8"></i>倉敷</span><span><i class="lg" style="background:#047857"></i>岡山</span><span><i class="lg" style="background:#b7791f"></i>広島(その他)</span></div>
<table${_shrink(_rankN)}>
  <thead><tr><th style="width:8%">順位</th><th style="width:20%">客付業者</th><th style="width:10%">客付け数</th><th style="width:8%">ｷｬﾝｾﾙ</th><th style="width:14%">最終客付け</th><th>よく客付けする物件 Best3</th></tr></thead>
  <tbody>${rankRows}</tbody>
</table>
</div>

<div class="page">
<h2 id="digttl">② 掘り起こし候補（広告・再アプローチ対象）</h2>
<div class="note">過去に客付け実績（3件以上）がありながら、6ヶ月以上 紹介の途絶えている業者。経過の長い順。色が濃いほど再アプローチの優先度が高い業者です。</div>
<div class="legend">緊急度：<span><i class="lg" style="background:#fdf6e3;border:0.5px solid #cfc"></i>6〜11ヶ月</span><span><i class="lg" style="background:#fdecd7;border:0.5px solid #e5b"></i>1年以上</span><span><i class="lg" style="background:#fde0dd;border:0.5px solid #d88"></i>2年以上(最優先)</span>／ 業者名の色はエリア（福山=紫・倉敷=青・岡山=緑）</div>
<table id="dig"${_shrink(_digN)}>
  <thead><tr><th style="width:24%">業者名</th><th style="width:14%">過去の客付け</th><th style="width:16%">最終客付け</th><th style="width:14%">客付けなし</th><th>得意物件（過去実績）</th></tr></thead>
  <tbody>${digRows || '<tr><td colspan="5" class="c">該当なし</td></tr>'}</tbody>
</table>
</div>

<div class="page">
<h2 id="stfttl">③ 担当者ランキング（会社名つき）</h2>
<div class="note">仲介会社の担当者ひとりずつの成績です。同じ名字の方が別の会社にいても混ざらないよう、<b>会社名とセット</b>で数えています。成約数の多い順・上位30名。</div>
<table id="stf"${_shrink(_stfN)}>
  <thead><tr><th style="width:7%">順位</th><th style="width:14%">担当者</th><th style="width:22%">会社名</th><th style="width:9%">客付け数</th><th style="width:8%">ｷｬﾝｾﾙ</th><th style="width:13%">最終客付け</th><th>よく決める物件 Best3</th></tr></thead>
  <tbody>${staffRows || '<tr><td colspan="7" class="c">担当者名の入っているデータがありません</td></tr>'}</tbody>
</table>

</div>
</body></html>`;
 
    // iPhone / iPad は別ウィンドウでの印刷が働かないので、
  // この画面の中に重ねて出します（js/core.js の PV_PRINT_HTML）。
  // パソコンと Android は、これまでどおり別ウィンドウのままです。
  if(window.PV_IS_IOS && window.PV_PRINT_HTML){ window.PV_PRINT_HTML(html); return; }
  const w = window.open('', '_blank');

  if(!w){ alert('ポップアップがブロックされました。このサイトのポップアップを許可してください。'); return; }
  w.document.write(html); w.document.close();
  setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} }, 500);
}
// 日付文字列(YYYY-MM-DD…)から日本の年度を求める。4月始まり〜翌3月。
function fiscalYearOf(dateStr){
  if(!dateStr) return '';
  const y = parseInt(String(dateStr).slice(0,4),10);
  const m = parseInt(String(dateStr).slice(5,7),10);
  if(isNaN(y)||isNaN(m)) return '';
  return String(m <= 3 ? y-1 : y);
}
function renderDoneList(){
  let list = Object.values(loadAll()).filter(c => c.archived);
  // 年度の手入力(4桁)で絞り込み。空欄なら全年度。
  const yearInput = document.getElementById('done-year');
  const fy = yearInput ? String(yearInput.value||'').trim() : '';
  const fyValid = /^\d{4}$/.test(fy);
  if(fyValid){ list = list.filter(c => doneYearOf(c) === fy); }
  list.sort((a,b) => (b.archivedAt||'').localeCompare(a.archivedAt||''));
  const body = document.getElementById('done-body');
  if(list.length === 0){
    body.innerHTML = '<div class="done-empty">' +
      (fyValid ? (fy + '年に完了した契約はありません。')
               : (fy ? '年度は4桁の数字で入力してください（例: 2026）。' : 'まだ完了タブに移動した契約はありません。')) + '</div>';
    updateDoneSelCount();
    return;
  }
  body.innerHTML = list.map(c => {
    const roomNo = c.room ? String(c.room).replace(/^P/i,'') : '';
    const dDate = c.archivedAt ? c.archivedAt.slice(0,10).replace(/-/g,'/') : '';
    // 完了済みカードの確定ステータス: キャンセル/審査落ち or 契約完了
    let stKey, stLabel, stRowClass, dateLabel;
    if(c.dealStatus === 'cancel'){ stKey='cancel'; stLabel='キャンセル'; stRowClass='di-done-cancel'; dateLabel='キャンセル'; }
    else if(c.dealStatus === 'rejected'){ stKey='rejected'; stLabel='審査落ち'; stRowClass='di-done-cancel'; dateLabel='審査落ち'; }
    else if(c.dealStatus === 'monthly'){ stKey='monthly'; stLabel='マンスリー(完了)'; stRowClass='di-done-monthly'; dateLabel='完了'; }
    else { stKey='complete'; stLabel='契約処理完了'; stRowClass='di-done-complete'; dateLabel='完了'; }
    return '<div class="done-item ' + stRowClass + '">' +
      '<input type="checkbox" class="di-check" value="' + c.id + '" onclick="event.stopPropagation();KB.updateDoneSelCount()" style="width:20px;height:20px;margin-right:12px;flex:0 0 auto;cursor:pointer;accent-color:#d32f2f;">' +
      '<div class="di-main" onclick="KB.openFromDone(\'' + c.id + '\')" style="cursor:pointer;">' +
        '<div class="di-title">' + esc(c.property || '(物件未入力)') + (roomNo ? ' ' + esc(roomNo) + '号' : '') + '</div>' +
        '<div class="di-sub">' + esc(c.contractor || '(契約者未入力)') + (c.staff ? ' / 担当 ' + esc(c.staff) : '') + '</div>' +
        '<span class="di-status">' + stLabel + '</span>' +
      '</div>' +
      (dDate ? '<div class="di-date">' + dateLabel + ' ' + dDate + '</div>' : '') +
      '<button class="di-back" onclick="KB.returnToBoard(event,\'' + c.id + '\')" title="一覧へ戻す">↩ 一覧へ戻す</button>' +
      '<button class="di-del" onclick="KB.deleteFromDone(event,\'' + c.id + '\')" title="この契約を削除" style="border:none; background:#fdecec; color:#d32f2f; font-size:13px; font-weight:800; padding:8px 14px; border-radius:10px; cursor:pointer; font-family:inherit; white-space:nowrap; margin-left:8px;">🗑 削除</button>' +
    '</div>';
  }).join('');
  updateDoneSelCount();
}
// 完了タブから一覧へ戻す(完了状態はそのまま)
function returnToBoard(event, id){
  event.stopPropagation();
  const all = loadAll();
  const c = all[id];
  if(!c) return;
  c.archived = false;
  c.updatedAt = new Date().toISOString();
  saveAll(all);
  renderDoneList();
  renderAll();
  toast('「' + (c.property||'契約') + '」を一覧へ戻しました');
}
function openFromDone(id){
  closeDoneModal();
  openSheet(id);  // 完了一覧からも直接編集フォームを開く
}
// 完了一覧から1件削除
function deleteFromDone(event, id){
  if(event){ try{ event.stopPropagation(); }catch(e){} }
  const all = loadAll();
  const c = all[id];
  if(!c) return;
  const label = (c.property||'') + (c.contractor ? '(' + c.contractor + ')' : '');
  if(!confirm('この完了済み契約を削除しますか?\n' + label + '\n\n※削除すると元に戻せません。')) return;
  delete all[id];
  deleteFromCloud(id);
  saveAll(all);
  renderDoneList();
  renderAll();
  toast('削除しました');
}
// 選択した完了契約を削除
function deleteSelectedDone(){
  const checks = Array.from(document.querySelectorAll('#done-body .di-check:checked'));
  const ids = checks.map(ch => ch.value);
  if(ids.length === 0){ toast('削除する契約を選択してください'); return; }
  if(!confirm('選択した ' + ids.length + '件 の完了済み契約を削除しますか?\n※削除すると元に戻せません。')) return;
  const all = loadAll();
  ids.forEach(id => { delete all[id]; deleteFromCloud(id); });
  saveAll(all);
  renderDoneList();
  renderAll();
  toast(ids.length + '件を削除しました');
}
// すべて選択 / すべて解除 を切り替え
function toggleSelectAllDone(){
  const checks = Array.from(document.querySelectorAll('#done-body .di-check'));
  if(checks.length === 0) return;
  const allChecked = checks.every(ch => ch.checked);
  checks.forEach(ch => { ch.checked = !allChecked; });
  updateDoneSelCount();
}
// 選択数をボタン表示に反映
function updateDoneSelCount(){
  const checks = Array.from(document.querySelectorAll('#done-body .di-check'));
  const sel = checks.filter(ch => ch.checked).length;
  const delBtn = document.getElementById('done-del-selected');
  if(delBtn){ delBtn.textContent = sel > 0 ? ('🗑 選択削除 (' + sel + ')') : '🗑 選択削除'; }
  const csvBtn = document.getElementById('done-csv');
  if(csvBtn){ csvBtn.textContent = sel > 0 ? ('⬇ CSV出力 (' + sel + ')') : '⬇ CSV出力'; }
  const allBtn = document.getElementById('done-select-all');
  if(allBtn){
    const allChecked = checks.length > 0 && checks.every(ch => ch.checked);
    allBtn.textContent = allChecked ? '☐ 全解除' : '☑ 全選択';
  }
}
 
// 選択した完了済み契約をCSV出力(未選択時は表示中の全件)
function exportSelectedDoneCsv(){
  const all = loadAll();
  const checks = Array.from(document.querySelectorAll('#done-body .di-check'));
  let ids = checks.filter(ch => ch.checked).map(ch => ch.value);
  if(ids.length === 0){
    // 未選択なら、いま画面に表示されている全件(年フィルタ適用後)を出力
    ids = checks.map(ch => ch.value);
  }
  if(ids.length === 0){ toast('出力する契約がありません'); return; }
 
  const q = v => {
    const s = (v==null) ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  };
  const header = ['ステータス','完了日','種別','申込日','契約日','物件名','部屋番号','契約者','仲介','担当','駐車場',
    '火災保険','駆け付け','電気','請求書','鍵渡しメール','鍵交換','ペット','契約書送付','電子署名','契約書返送','保証電子印','入金','鍵渡し','ひな形送付済み','備考'];
  const rows = ids.map(id => {
    const c = all[id]; if(!c) return null;
    const done = c.archivedAt ? c.archivedAt.slice(0,10) : '';
    const stLabel = (c.dealStatus === 'cancel') ? 'キャンセル'
                  : (c.dealStatus === 'rejected') ? '審査落ち'
                  : '契約処理完了';
    return [
      stLabel,
      done, c.type||'', c.applyDate||'', c.contractDate||'', c.property||'',
      (c.room ? String(c.room).replace(/^P/i,'') : ''), c.contractor||'', c.broker||'', c.staff||'', c.parking||'',
      c.insurance||'', c.rescue||'', c.electric||'', c.invoice||'', c.keyMail||'', c.keyExchange||'',
      c.pet||'', c.sendDate||'', c.esignDate||'', c.returnDate||'', c.guaranteeDate||'',
      c.paymentDate||'', c.keyHandover||'', c.hinagata||'', c.memo||''
    ].map(q).join(',');
  }).filter(Boolean);
 
  const csv = '\uFEFF' + header.map(q).join(',') + '\n' + rows.join('\n') + '\n';
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const yearInput = document.getElementById('done-year');
  const fyVal = yearInput ? String(yearInput.value||'').trim() : '';
  const fy = /^\d{4}$/.test(fyVal) ? fyVal + '年度' : '全年度';
  const today = new Date();
  const stamp = today.getFullYear() + String(today.getMonth()+1).padStart(2,'0') + String(today.getDate()).padStart(2,'0');
  a.download = '完了済み契約_' + fy + '_' + stamp + '.csv';
  a.click();
  toast(rows.length + '件をCSV出力しました');
}
 
// ホバーで編集フォームを開く(PCのみ・ドラッグ中は無視・誤反応防止に短い遅延)
function onCardHover(event, id){ /* ホバーでの自動オープンは無効化(クリックで開く) */ }
function onCardLeave(event){ clearTimeout(_hoverTimer); }
 
// クリック/タップでも開く(ドラッグ直後は無視)
function onCardClick(event, id){
  if(_justDragged) return;   // ドラッグ直後の誤クリックを無視
  clearTimeout(_hoverTimer);
  openSheet(id);            // 閲覧ポップアップを介さず直接編集フォームを開く
}
 
// ====== ドラッグ&ドロップ ======
let _justDragged = false;
function onCardDragStart(e, id){
  _draggingId = id;
  _justDragged = true;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
  // カラムのグレーアウト(通過済み)を反映するため再描画
  setTimeout(() => renderBoard(), 0);
}
function onCardDragEnd(e){
  _draggingId = null;
  document.querySelectorAll('.column.drag-over').forEach(el => el.classList.remove('drag-over'));
  renderBoard();
  // ドラッグ直後のクリックを無視する短いガード
  setTimeout(() => { _justDragged = false; }, 80);
}
function onColDragOver(e){ e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function onColDragLeave(e){
  if(!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('drag-over');
}
function onColDrop(e, stageKey){
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if(!_draggingId) return;
  const all = loadAll();
  const c = all[_draggingId];
  if(!c){ _draggingId = null; return; }
 
  const prevStage = c.stage || '申込';
  if(prevStage === stageKey){ _draggingId = null; renderBoard(); return; }
 
  if(!c.stageReached) c.stageReached = {};
 
  const newIdx = stageIndex(stageKey);
  const prevIdx = stageIndex(prevStage);
 
  if(newIdx > prevIdx){
    // 前進: ここまでの全ステージに到達日を記録(まだ無いものは今日の日付)
    for(let i = 0; i <= newIdx; i++){
      const sk = STAGES[i].key;
      if(!c.stageReached[sk]) c.stageReached[sk] = today();
    }
    toast('「' + (c.property||'契約') + '」を ' + stageKey + ' へ進めました(' + today().slice(5).replace('-','/') + ')');
  } else {
    // 後退: 移動先より後のステージの到達記録を解除(タスクが未完了に戻る)
    STAGES.forEach((s, i) => {
      if(i > newIdx) delete c.stageReached[s.key];
    });
    // 移動先までは到達済みにする
    for(let i = 0; i <= newIdx; i++){
      const sk = STAGES[i].key;
      if(!c.stageReached[sk]) c.stageReached[sk] = today();
    }
    if(stageKey === '申込'){
      // 申込まで戻した場合は、申込以降の全ステージ記録をリセット(申込のみ到達)
      c.stageReached = { '申込': c.stageReached['申込'] || today() };
      toast('「' + (c.property||'契約') + '」を 申込 に戻しました(すべての記録をリセット)');
    } else {
      toast('「' + (c.property||'契約') + '」を ' + stageKey + ' に戻しました(以降の記録を解除)');
    }
  }
 
  c.stage = stageKey;
  c.updatedAt = new Date().toISOString();
  saveAll(all);
  _draggingId = null;
  renderAll();
}
 
// ====== シート ======
function openSheet(id){
  hidePreview();
  _sheetOpenedAt = Date.now();
  _editingId = id || null;
  const c = id ? loadAll()[id] : null;
  document.getElementById('sheet-title').textContent = id ? '契約の編集' : '新規契約';
  _editingMonthly = !!(c && c.dealStatus === 'monthly');
  var _delBtn = document.getElementById('btn-delete');
  if(_delBtn){ _delBtn.style.display = id ? 'inline-block' : 'none'; }
  _editingReached = c && c.stageReached ? Object.assign({}, c.stageReached) : {};
  if(!id){
    // 新規は申込に到達済みとして初期化
    _editingReached = {'申込': today()};
  }
  // 編集中のアイテム取得日(既存を引き継ぐ)
  _editingItemDates = c && c.itemDates ? Object.assign({}, c.itemDates) : {};
  // 編集中のアイテム値(プルダウン廃止のため内部で保持)
  _editingItemValues = {};
  if(c){
    ITEMS.forEach(it => { _editingItemValues[it.key] = c[it.key] || ''; });
  }
  // 編集中の日付項目
  _editingDateValues = {};
  if(c){
    DATE_ITEMS.forEach(it => { _editingDateValues[it.key] = c[it.key] || ''; });
  }
  fillForm(c || {stage:'申込'});
  // 駐車場契約者: 既存データで法人名と異なる(=手入力された)場合は手動扱い
  _carContractorManual = !!(c && c.carContractor && c.carContractor !== c.contractor);
  switchType((c && c.type) || '個人');
  switchWarn((c && c.warn) ? 1 : 0);
  _infoEditingKey = null;
  _autoSaveWasComplete = c ? isContractComplete(c) : false;
  // 開いた時点で既に契約者+契約確定日が揃っているなら、再確認は出さない(true扱い)
  _autoSaveWasLinkable = !!(c && c.contractor && c.contractDate);
  const ieBox = document.getElementById('info-popup'); if(ieBox){ ieBox.classList.remove('active'); }
  renderInfoIcons();
  autoCompleteCheck();
  renderStageTimeline();
  renderSheetItemSummary();
  renderSheetDateSummary();
  updateSheetStatusBg();
  // 開いた時点の駐車場・契約日を前回値として先に記録(初回の不要なダイアログを防ぐ)
  try{
    _lastPromptParking = (c && c.parking) ? c.parking : '';
    _lastPromptContractDate = (c && c.contractDate) ? c.contractDate : '';
    _autoLinkPromptDismissed = null;
  }catch(e){}
  document.getElementById('sheet-backdrop').classList.add('active');
  document.getElementById('sheet').classList.add('active');
}
// 基本情報の見出しを、不備の有無で「基本情報不備あり(赤)」「基本情報完了(緑)」に切替
function updateSheetStatusBg(){
  const h = document.getElementById('basic-info-heading');
  if(!h) return;
  const c = buildContractObject();
  if(basicInfoComplete(c)){
    h.textContent = '基本情報完了';
    h.classList.remove('bih-defect');
    h.classList.add('bih-ok');
  } else {
    h.textContent = '基本情報不備あり';
    h.classList.remove('bih-ok');
    h.classList.add('bih-defect');
  }
}
 
// 日付項目サマリー描画
function renderSheetDateSummary(){
  const elc = document.getElementById('sheet-date-summary');
  if(!elc) return;
  const colYellow = '#f2d24b';
  elc.innerHTML =
    '<div class="sis-icons">' + DATE_ITEMS.map(it => {
      const v = _editingDateValues[it.key] || '';
      const got = !!v && String(v).trim() !== '';
      const dtxt = got ? formatDateShort(v) : '—';
      const tip = it.label + (got ? ': ' + dtxt : ': 未記録') + '(クリックで記録)';
      const styleAttr = got ? ' style="background:' + hexA(colYellow,0.16) + ';border-color:' + colYellow + ';"' : '';
      const imgStyle = got ? ' style="filter:none;"' : '';
      const dateStyle = got ? ' style="color:' + colYellow + ';"' : '';
      return '<span class="sis-item' + (got ? ' got' : '') + '"' + styleAttr + ' title="' + tip + '" onclick="KB.toggleSheetDate(\'' + it.key + '\')">' +
        '<img src="' + DATE_ICON[it.icon] + '" alt="' + it.label + '"' + imgStyle + '>' +
        '<span class="sis-label">' + it.label + '</span>' +
        '<span class="sis-date"' + dateStyle + '>' + dtxt + '</span>' +
        (got ? '<span class="sis-note"' + dateStyle + '>完了</span>' : '') +
      '</span>';
    }).join('') + '</div>';
}
// 日付の表示用フォーマット(MM/DD)
function formatDateShort(v){
  if(!v) return '';
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[2] + '/' + m[3];
  return s; // 自由文字(例: '2/16郵送')はそのまま
}
// 日付アイコンクリックで記録/解除(ダイアログなし・即切替)
function toggleSheetDate(key){
  const cur = _editingDateValues[key] || '';
  if(cur){
    _editingDateValues[key] = '';   // 即解除
  } else {
    _editingDateValues[key] = today();  // 即・今日を記録
  }
  renderSheetDateSummary();
}
 
// 編集シート内のアイテム取得サマリー(フォーム値から判定して点灯)
function renderSheetItemSummary(){
  const elc = document.getElementById('sheet-item-summary');
  if(!elc) return;
  const get = (id) => (document.getElementById(id) ? (document.getElementById(id).value||'').trim() : '');
  // 内部値 + P区画はフォームから(入力欄あり)
  const tmp = {};
  ITEMS.forEach(it => { tmp[it.key] = _editingItemValues[it.key] || ''; });
  tmp.parking = get('f-parking');   // P区画は入力欄から
  tmp.parkingPrice = get('f-parkingPrice');
  tmp.type = _editingType;          // 法人専用アイテムの表示判定に使う
  // 内部にもP区画値を反映
  _editingItemValues.parking = tmp.parking;
  const shownItems = displayItems(tmp);              // AD等の表示専用も出す
  const gotCount = applicableItems(tmp).filter(it => itemGot(tmp, it)).length;  // 取得数は達成項目のみ
  // フォーム値と取得日を同期(手入力で変えた場合も反映)
  applicableItems(tmp).forEach(it => {
    if(itemGot(tmp, it)){
      if(!_editingItemDates[it.key]) _editingItemDates[it.key] = today();
    } else {
      delete _editingItemDates[it.key];
    }
  });
  // 各アイテムのHTMLを生成(タップで取得⇄解除、取得済みは状態色で表示)
  const itemHtml = (it) => {
    // AD: 取得/未取得ではなく、金額(%)を表示。タップで巡回。未設定は既定100%。
    if(it.key === 'ad'){
      const adn = adValue(tmp.ad);
      const adGot = adn > 0;
      const adCol = adGot ? '#0d9488' : '#9aa0a6';
      const adStyle = adGot
        ? ' style="background:' + hexA(adCol,0.16) + ';border-color:' + adCol + ';color:' + adCol + ';"'
        : ' style="background:#fff;border-color:' + adCol + ';color:' + adCol + ';"';
      return '<div class="dd-item zone-fill' + (adGot?'':' zone-outline') + '"' + adStyle +
        ' onclick="cycleZoneItem(\'ad\')" title="AD(広告料): タップで 0→50→…→300 と切替">' +
        '<div class="dd-iconwrap"><img src="' + ITEM_ICON.ad + '" alt="AD"></div>' +
        '<span class="dd-label">AD</span>' +
        '<span class="dd-ok" style="color:' + adCol + ';">' + esc(String(adn)) + '%</span>' +
        '<span class="dd-cycle-hint">タップで切替</span>' +
      '</div>';
    }
    const isParking = (it.key === 'parking');
    const isPet = (it.key === 'pet');
    let got = itemGot(tmp, it);
    const d = _editingItemDates[it.key];
    const dtxt = d ? d.slice(5).replace('-','/') : '';
    // 駐車場/ペットで未入力 → 「不要(赤)」扱いとして表示する
    const parkingEmpty = isParking && !got;
    const petEmpty = isPet && !got;
    const emptyRed = parkingEmpty || petEmpty;
    let col = got ? (itemColor(tmp, it) || '#f5c000') : null;
    if(emptyRed){ col = '#e60012'; }   // 未入力の駐車場/ペットは赤(不要)
    const note = (got && it.note) ? it.note(tmp[it.key]) : '';
    const isRed = (got && col && col.toLowerCase() === '#e60012') || emptyRed;
    const isGray = got && col && (col.toLowerCase() === '#9aa0a6');
    // 赤(不要)・グレー(他保険)= 白背景＋その色の文字/枠/× / それ以外 = 薄い色背景＋色文字
    let styleAttr = '', variantClass = '';
    if(isRed || isGray){
      styleAttr = ' style="background:#fff;border-color:' + col + ';color:' + col + ';"';
      variantClass = ' zone-outline' + (isRed ? ' is-red' : ' is-gray');
    } else if(got){
      styleAttr = ' style="background:' + hexA(col,0.16) + ';border-color:' + col + ';color:' + col + ';"';
      variantClass = ' zone-fill';
    }
    const cycleHint = (got && it.cycle && !isParking) ? '<span class="dd-cycle-hint">タップで切替</span>' : '';
    const tip = isParking
      ? (got ? '駐車場: 区画番号入力済み(番号は上の「P区画」欄で変更)' : '駐車場: 区画番号を入力してください(現在: 不要)')
      : (got
        ? it.label + ': 取得済み' + (it.cycle ? '(タップで状態切替 / もう一度で解除)' : '(タップで解除)')
        : it.label + ': 未取得(タップで取得)');
    // タップ動作: 駐車場はトグル不可(空なら警告・あれば入力欄へ) / 他は従来どおり
    const onclick = isParking
      ? 'onParkingTap()'
      : (got
        ? (it.cycle ? 'cycleZoneItem(\'' + it.key + '\')' : 'setItemGot(\'' + it.key + '\',false)')
        : 'setItemGot(\'' + it.key + '\',true)');
    // 赤×オーバーレイ(不要 / 番号なし駐車場)
    const redCross = isRed ? '<span class="dd-cross">✕</span>' : '';
    // 完了時のアイコン差し替え(iconGotがあれば)
    const iconKey = (got && it.iconGot) ? it.iconGot : it.icon;
    // 「完了」「済」相当の取得状態は大きく「OK」と表示する
    const isOkState = got && !isRed && !isGray && !isParking &&
                      (note === '' || note === '完了' || note === '済' || note === '回収' || note === 'あり');
    // 本文
    let bodyHtml;
    if(isParking && got){
      bodyHtml = '<span class="dd-pnum">P' + String(tmp.parking).replace(/^P[-\s]?/i,'') + '</span>';
    } else if(emptyRed){
      bodyHtml = '<span class="dd-ok-red">不要</span>';
    } else if(isOkState){
      bodyHtml = (got ? '<span class="dd-date">' + (dtxt ? dtxt : '') + '</span>' : '') +
                 '<span class="dd-ok">OK</span>';
    } else {
      bodyHtml = (got ? '<span class="dd-date">' + (dtxt ? dtxt : '取得') + '</span>' : '') +
                 (got && note ? '<span class="dd-note">' + note + '</span>' : '') +
                 cycleHint;
    }
    const shownClass = (got || emptyRed) ? 'in-zone' : 'in-tray';
    // 取得済みアイテム(駐車場・ペット以外)は取得日を手入力できる小さな日付欄を表示
    const showDateEdit = got && !isParking && !isPet;
    const dateEdit = showDateEdit
      ? '<input type="date" class="dd-date-edit" value="' + (d || '') + '"' +
        ' onclick="event.stopPropagation();"' +
        ' onchange="event.stopPropagation();KB.setItemDate(\'' + it.key + '\', this.value)"' +
        ' title="取得日を変更できます">'
      : '';
    return '<div class="dd-item ' + shownClass + variantClass + '"' + styleAttr +
      ' data-key="' + it.key + '" title="' + tip + '"' +
      ' onclick="' + onclick + '">' +
      '<div class="dd-iconwrap"><img src="' + ITEM_ICON[iconKey] + '" alt="' + it.label + '">' + redCross + '</div>' +
      '<span class="dd-label">' + it.label + '</span>' +
      bodyHtml +
      dateEdit +
    '</div>';
  };
  elc.innerHTML =
    '<div class="sis-count">' + gotCount + ' / ' + applicableItems(tmp).length + ' 取得 ' +
      '<span style="font-weight:500;color:#999;">(アイコンをタップで取得 / もう一度タップで解除)</span></div>' +
    '<div class="dd-grid">' +
      shownItems.map(it => itemHtml(it)).join('') +
    '</div>';
}
// 駐車場アイコンのタップ: トグルしない。番号が空なら警告して入力欄へフォーカス
function onParkingTap(){
  const el = document.getElementById('f-parking');
  const val = el ? el.value.trim() : '';
  if(!val){
    alert('区画番号を入力してください（例: P-12）');
    if(el){ el.focus(); }
    return;
  }
  // 番号があれば入力欄へフォーカスして編集を促す(取得状態は番号連動なので変更しない)
  if(el){ el.focus(); el.select(); }
}
// ===== アイテム取得/解除 =====
function setItemGot(key, makeGot){
  const it = ITEMS.find(x => x.key === key);
  if(!it) return;
  if(makeGot){
    // 取得にする
    if(it.cycle){
      // cycleの先頭の「取得扱い」値を使う(空以外の最初)
      const v = it.cycle.find(x => it.got(x)) || it.on || '完了';
      _editingItemValues[key] = v;
    } else if(it.key === 'pet'){
      _editingItemValues.pet = 'あり';
    } else if(it.key === 'parking'){
      const el = document.getElementById('f-parking');
      const cur = (el && el.value.trim()) ? el.value.trim() : '済';
      _editingItemValues.parking = cur;
      if(el && !el.value.trim()){ el.value = cur; }
    } else {
      _editingItemValues[key] = it.on || '完了';
    }
    if(!_editingItemDates[key]) _editingItemDates[key] = today();
  } else {
    // 解除する
    if(it.key === 'parking'){
      _editingItemValues.parking = '';
      const el = document.getElementById('f-parking'); if(el) el.value = '';
    } else {
      _editingItemValues[key] = it.off || '';
    }
    delete _editingItemDates[key];
  }
  // ★ ひな形送付済みアイテムの取得/解除で、状況プルダウンを自動連動させる
  if(key === 'hinagata' && _editingId){
    try{
      const all2 = loadAll();
      const c2 = all2[_editingId];
      if(c2){
        if(makeGot){
          if(c2.dealStatus !== 'cancel' && c2.dealStatus !== 'rejected'){ c2.dealStatus = 'hinagata'; }
        } else {
          if(c2.dealStatus === 'hinagata'){ c2.dealStatus = 'apply'; }
        }
        all2[_editingId] = c2;
        saveAll(all2);
      }
    }catch(e){}
  }
  renderSheetItemSummary();
  autoSave();
}
// アイテムの取得日を手入力で変更する
function setItemDate(key, val){
  if(!key) return;
  const v = String(val||'').trim();
  if(v){ _editingItemDates[key] = v; }
  else { /* 空にしても取得状態は維持。日付だけ消す */ delete _editingItemDates[key]; }
  renderSheetItemSummary();
  autoSave();
}
function cycleZoneItem(key){
  const it = ITEMS.find(x => x.key === key);
  if(!it || !it.cycle) return;
  // AD は 0 も有効値。0/50/…/300 を単純に巡回する（解除には戻さない）
  if(key === 'ad'){
    const cur = String(adValue(_editingItemValues.ad));
    let idx = it.cycle.indexOf(cur); if(idx < 0) idx = it.cycle.indexOf('100');
    const next = it.cycle[(idx + 1) % it.cycle.length];
    _editingItemValues.ad = next;
    if(!_editingItemDates.ad) _editingItemDates.ad = today();
    renderSheetItemSummary();
    autoSave();
    return;
  }
  const cur = _editingItemValues[key] || '';
  // 取得状態の値 + 末尾に「解除('')」を加えて巡回
  const gotVals = it.cycle.filter(x => it.got(x));
  const seq = gotVals.concat(['']);   // 最後に未選択へ戻る
  let gi = seq.indexOf(cur); if(gi < 0) gi = 0;
  const next = seq[(gi + 1) % seq.length];
  if(next === ''){
    setItemGot(key, false);           // トレイへ戻す(解除)
  } else {
    _editingItemValues[key] = next;
    if(!_editingItemDates[key]) _editingItemDates[key] = today();
    renderSheetItemSummary();
    autoSave();
  }
}
let _ddKey = null;
function ddBindDrag(){
  document.querySelectorAll('#sheet-item-summary .dd-item').forEach(el => {
    el.addEventListener('dragstart', e => {
      _ddKey = el.getAttribute('data-key');
      el.classList.add('dragging');
      if(e.dataTransfer){ e.dataTransfer.setData('text/plain', _ddKey); e.dataTransfer.effectAllowed='move'; }
    });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); _ddKey = null; });
    // タッチ操作
    el.addEventListener('touchstart', ddTouchStart, {passive:false});
  });
}
function ddOver(e, zone){ e.preventDefault(); zone.classList.add('dragover'); if(e.dataTransfer) e.dataTransfer.dropEffect='move'; }
function ddLeave(zone){ zone.classList.remove('dragover'); }
function ddDrop(e, intoZone){
  e.preventDefault();
  const z = e.currentTarget; if(z) z.classList.remove('dragover');
  const key = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || _ddKey;
  if(!key) return;
  setItemGot(key, intoZone);
}
// --- タッチ用ドラッグ ---
let _touchGhost = null, _touchKey = null;
function ddTouchStart(e){
  const el = e.currentTarget;
  _touchKey = el.getAttribute('data-key');
  const t = e.touches[0];
  _touchGhost = el.cloneNode(true);
  _touchGhost.classList.add('dd-ghost');
  _touchGhost.style.width = el.offsetWidth + 'px';
  document.body.appendChild(_touchGhost);
  moveGhost(t.clientX, t.clientY);
  el.classList.add('dragging');
  document.addEventListener('touchmove', ddTouchMove, {passive:false});
  document.addEventListener('touchend', ddTouchEnd, {passive:false});
  e.preventDefault();
}
function moveGhost(x,y){ if(_touchGhost){ _touchGhost.style.left=x+'px'; _touchGhost.style.top=y+'px'; } }
function ddTouchMove(e){
  const t = e.touches[0]; moveGhost(t.clientX, t.clientY);
  const zone = document.getElementById('dd-zone'), tray = document.getElementById('dd-tray');
  [zone,tray].forEach(z => z && z.classList.remove('dragover'));
  const under = document.elementFromPoint(t.clientX, t.clientY);
  const z = under && under.closest('#dd-zone, #dd-tray');
  if(z) z.classList.add('dragover');
  e.preventDefault();
}
function ddTouchEnd(e){
  document.removeEventListener('touchmove', ddTouchMove);
  document.removeEventListener('touchend', ddTouchEnd);
  const t = e.changedTouches[0];
  if(_touchGhost){ _touchGhost.remove(); _touchGhost = null; }
  document.querySelectorAll('#sheet-item-summary .dd-item.dragging').forEach(el=>el.classList.remove('dragging'));
  const zone = document.getElementById('dd-zone'), tray = document.getElementById('dd-tray');
  [zone,tray].forEach(z => z && z.classList.remove('dragover'));
  const under = document.elementFromPoint(t.clientX, t.clientY);
  const z = under && under.closest('#dd-zone, #dd-tray');
  if(z && _touchKey){ setItemGot(_touchKey, z.id === 'dd-zone'); }
  _touchKey = null;
}
// アイコンクリックで取得/解除を切り替え(対応する入力欄も更新、取得日も記録)
function toggleSheetItem(key){
  const it = ITEMS.find(x => x.key === key);
  if(!it) return;
  // auto項目(駐車場・ペット)は専用フィールドを切り替え
  if(it.auto){
    if(key === 'pet'){
      const cur = _editingItemValues.pet || '';
      const nowGot = it.got(cur);
      _editingItemValues.pet = nowGot ? '' : 'あり';
      if(nowGot) delete _editingItemDates['pet'];
      else if(!_editingItemDates['pet']) _editingItemDates['pet']=today();
    } else if(key === 'parking'){
      // 番号入力欄にフォーカスを当てる(ダイアログは使わない)
      const el = document.getElementById('f-parking');
      if(el){ el.focus(); el.select && el.select(); }
    }
    renderSheetItemSummary();
    autoSave();
    return;
  }
  // cycle 定義があれば順送り(完了→ホープ→他保険→未…)
  if(it.cycle){
    const cur = _editingItemValues[key] || '';
    let idx = it.cycle.indexOf(cur);
    if(idx < 0) idx = 0;
    const nextVal = it.cycle[(idx + 1) % it.cycle.length];
    _editingItemValues[key] = nextVal;
    if(it.got(nextVal)){
      if(!_editingItemDates[key]) _editingItemDates[key] = today();
    } else {
      delete _editingItemDates[key];
    }
    renderSheetItemSummary();
    autoSave();
    return;
  }
  // それ以外: 取得/解除トグル(電気・鍵渡しメール・鍵交換 など)
  const cur = _editingItemValues[key] || '';
  const tmp = {}; tmp[key] = cur;
  const currentlyGot = itemGot(tmp, it);
  if(currentlyGot){
    _editingItemValues[key] = it.off || '';
    delete _editingItemDates[key];
  } else {
    _editingItemValues[key] = it.on || '完了';
    if(!_editingItemDates[key]) _editingItemDates[key] = today();
  }
  // ★ ひな形送付済みアイテムを取得したら、状況プルダウンを自動で「ひな形送付済み」にする。
  //    解除したら、ひな形になっていた場合のみ「申込」に戻す。
  if(key === 'hinagata' && _editingId){
    try{
      const all2 = loadAll();
      const c2 = all2[_editingId];
      if(c2){
        const nowGot = itemGot({ hinagata: _editingItemValues.hinagata }, it);
        if(nowGot){
          // すでにキャンセル/審査落ち/完了でなければ、ひな形送付済みに切り替え
          if(c2.dealStatus !== 'cancel' && c2.dealStatus !== 'rejected'){ c2.dealStatus = 'hinagata'; }
        } else {
          if(c2.dealStatus === 'hinagata'){ c2.dealStatus = 'apply'; }
        }
        all2[_editingId] = c2;
        saveAll(all2);
      }
    }catch(e){}
  }
  renderSheetItemSummary();
  autoSave();
}
function closeSheet(){
  document.getElementById('sheet-backdrop').classList.remove('active');
  document.getElementById('sheet').classList.remove('active');
  _editingId = null;
  // 閉じた直後、マウスがカード上にあってもすぐ再オープンしないよう一瞬抑制
  clearTimeout(_hoverTimer);
  _suppressHoverUntil = Date.now() + 600;
}
 
// シート内のステージ到達履歴(チェック+日付)
function renderStageTimeline(){
  const el = document.getElementById('stage-timeline');
  if(!el) return;
  el.innerHTML = '<div class="sis-icons">' + STAGES.map(s => {
    const reached = !!_editingReached[s.key];
    const date = _editingReached[s.key] || '';
    const dtxt = reached ? formatDateShort(date) : '—';
    const col = s.color;
    const styleAttr = reached ? ' style="background:' + hexA(col,0.16) + ';border-color:' + col + ';"' : '';
    const imgStyle = reached ? ' style="filter:none;"' : '';
    const dateStyle = reached ? ' style="color:' + col + ';"' : '';
    return '<span class="sis-item' + (reached ? ' got' : '') + '"' + styleAttr +
      ' title="' + s.name + (reached ? ': 到達済(クリックで未到達に)' : ': 未到達(クリックで到達)') + '"' +
      ' onclick="KB.toggleStageReached(\'' + s.key + '\')">' +
      '<img src="' + STAGE_ICON[s.icon] + '" alt="' + s.name + '"' + imgStyle + '>' +
      '<span class="sis-label">' + s.name + '</span>' +
      '<span class="sis-date"' + dateStyle + '>' + dtxt + '</span>' +
      (reached ? '<span class="sis-note"' + dateStyle + '>完了</span>' : '') +
    '</span>';
  }).join('') + '</div>';
}
function toggleStageReached(key){
  // 完了は手動切替不可(他がすべて揃えば自動点灯)
  if(key === '完了'){
    alert('「完了」は、申込〜鍵渡しがすべて完了すると自動で点灯します。');
    return;
  }
  if(_editingReached[key]){
    delete _editingReached[key];
  } else {
    // 契約日確定は「契約日」が入っていないと完了にできない
    if(key === '契約日確定'){
      const el = document.getElementById('f-contractDate');
      const v = el ? el.value.trim() : '';
      if(!v){
        alert('契約日を入力してください。契約日を入れると「契約日確定」が完了になります。');
        if(el){ el.focus(); if(el.showPicker){ try{ el.showPicker(); }catch(e){} } }
        return;
      }
      _editingReached[key] = v;   // 契約日をそのまま到達日に
    } else {
      _editingReached[key] = today();
    }
  }
  autoCompleteCheck();
  renderStageTimeline();
}
// 申込〜鍵渡しが全て到達したら「完了」を自動点灯(その日付)/ 崩れたら自動消灯
function autoCompleteCheck(){
  const required = STAGES.filter(s => s.key !== '完了').map(s => s.key);
  const allDone = required.every(k => !!_editingReached[k]);
  if(allDone){
    if(!_editingReached['完了']) _editingReached['完了'] = today();
  } else {
    if(_editingReached['完了']) delete _editingReached['完了'];
  }
}
// 契約日が変わったとき: 契約日確定が完了済みなら到達日を更新。空にしたら契約日確定を解除。
function onContractDateChange(){
  const el = document.getElementById('f-contractDate');
  const v = el ? el.value.trim() : '';
  if(_editingReached['契約日確定']){
    if(v){ _editingReached['契約日確定'] = v; }
    else { delete _editingReached['契約日確定']; }  // 契約日を消したら未完了に戻す
    autoCompleteCheck();
    renderStageTimeline();
  }
  if(v === ''){
    let oldDate = '';
    try{
      const all = loadAll();
      const c = _editingId ? all[_editingId] : null;
      if(c){ oldDate = c.contractDate || ''; }
    }catch(e){}
    maybeUnlinkOnClear('契約日が未入力になりました', function(){
      if(oldDate && el){
        el.value = oldDate;
        if(_editingReached){ _editingReached['契約日確定'] = oldDate; }
        try{ renderInfoIcons(); }catch(e){}
        try{ renderStageTimeline(); }catch(e){}
        autoSave();
        toast('契約日を元に戻しました');
      }
    });
  }
}
// 契約日/駐車場を空にしたとき、紐づく駐車場予約の削除を確認する共通処理(二重確認防止つき)
let _unlinkPromptBusy = false;
let _parkingBeforeEdit = '';
function maybeUnlinkOnClear(reasonMsg, onCancelRestore){
  if(_unlinkPromptBusy) return;
  try{
    const all = loadAll();
    const c = _editingId ? all[_editingId] : null;
    if(c && typeof window.PV_hasReservation === 'function'
       && typeof window.PV_unlinkReservation === 'function'){
      const info = { contractor: c.contractor, carContractor: c.carContractor, srcKey: c.id, property: c.property, parking: c.parking };
      if(window.PV_hasReservation(info)){
        _unlinkPromptBusy = true;
        const ok = confirm(reasonMsg + '。\n紐づいている駐車場予約も削除しますか?\n\nOK: 予約を削除\nキャンセル: 入力の取り消し(元に戻す)');
        if(ok){
          const r = window.PV_unlinkReservation(info);
          if(r && r.removed > 0){ toast('駐車場予約を削除しました'); }
        } else {
          if(typeof onCancelRestore === 'function'){ try{ onCancelRestore(); }catch(e){} }
        }
        setTimeout(() => { _unlinkPromptBusy = false; }, 600);
      }
    }
  }catch(e){ _unlinkPromptBusy = false; }
}
 
function switchType(type){
  _editingType = type;
  document.querySelectorAll('#type-seg button').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  const isCorp = (type === '法人');
  const lbl = document.getElementById('lbl-contractor');
  if(lbl) lbl.textContent = isCorp ? '法人名' : '契約者(個人)';
  document.querySelectorAll('.corp-only').forEach(el => el.style.display = isCorp ? 'flex' : 'none');
  // 駐車場契約者欄の同期: 法人で空なら法人名をセット / 個人なら使わない
  const carEl = document.getElementById('f-carContractor');
  const conEl = document.getElementById('f-contractor');
  if(carEl){
    if(isCorp){
      if(!_carContractorManual && (carEl.value.trim() === '') && conEl){ carEl.value = conEl.value; }
    } else {
      // 個人契約では駐車場契約者は使わない(空に)
      carEl.value = '';
      _carContractorManual = false;
    }
  }
  if(typeof renderInfoIcons === 'function') renderInfoIcons();
  if(typeof renderSheetItemSummary === 'function') renderSheetItemSummary();
}
function switchWarn(v){
  _editingWarn = v;
  const seg = document.getElementById('warn-seg');
  if(seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', String(b.dataset.warn) === String(v)));
}
 
// ===== アイコン式 基本情報フィールド =====
const INFO_ICON = {
  apply: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  cdate: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/><path d="M9 14l2 2 4-4"/></svg>',
  type: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><rect x="15" y="9" width="6" height="11" rx="1"/><path d="M17 12h2M17 15h2"/></svg>',
  building: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/><path d="M5 21h14"/></svg>',
  person: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
  agency: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l4-4 4 3 4-4 6 5"/><path d="M3 12v7a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-7"/><path d="M9 20v-5h6v5"/></svg>',
  car: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13l1.6-4.2C5.9 8 6.6 7.5 7.4 7.5h9.2c.8 0 1.5.5 1.8 1.3L20 13"/><path d="M3.5 13h17v4.2c0 .5-.4.8-.8.8h-1.6c-.5 0-.8-.4-.8-.8V17H6.5v.2c0 .5-.4.8-.8.8H4.1c-.5 0-.8-.4-.8-.8V13z"/><circle cx="7" cy="14.8" r="0.8" fill="currentColor" stroke="none"/><circle cx="17" cy="14.8" r="0.8" fill="currentColor" stroke="none"/></svg>',
};
// フィールド定義(各アイコンに紐づく入力欄)
const INFO_FIELDS = [
  { key:'monthly',  icon:'building',  label:'マンスリー', monthly:true,
    value:() => '' },
  { key:'property', icon:'building', label:'物件',
    wide:true,
    inputs:[{id:'f-property', label:'物件名', type:'text'},{id:'f-tou', label:'棟', type:'tou-select', ph:'棟を選択'},{id:'f-room', label:'号数', type:'text', ph:'例: 101'}],
    value:() => { const p=gv('f-property'), t=gv('f-tou'), r=gv('f-room'); return (p||'') + (t? ' '+t+'棟':'') + (r? ' '+r+'号':''); } },
  { key:'apply',    icon:'apply',    label:'申込日',
    inputs:[{id:'f-applyDate', label:'申込日', type:'date'}],
    value:() => fmtDateVal(gv('f-applyDate')) },
  { key:'cdate',    icon:'cdate',    label:'契約日',
    inputs:[{id:'f-contractDate', label:'契約日', type:'date'}],
    value:() => fmtDateVal(gv('f-contractDate')) },
  { key:'contractor', icon:'person', label:'契約者',
    inputs:() => (_editingType==='法人'
        ? [{id:'f-contractor', label:'法人名', type:'text'},
           {id:'f-carContractor', label:'駐車場契約者(空欄なら法人名と同じ)', type:'text', ph:'入居者名など'},
           {id:'f-agent', label:'代行会社', type:'text', ph:'例: ○○管理'}]
        : [{id:'f-contractor', label:'契約者(個人)', type:'text'}]),
    value:() => gv('f-contractor') },
  { key:'agency',   icon:'agency',   label:'仲介・担当',
    inputs:[{id:'f-broker', label:'仲介業者', type:'text'},{id:'f-staff', label:'担当者', type:'text'}],
    value:() => { const b=gv('f-broker'), s=gv('f-staff'); return [b,s].filter(Boolean).join(' / '); } },
  { key:'parking',  icon:'car',      label:'駐車場',
    inputs:[{id:'f-parking', label:'区画番号', type:'text', ph:'例: P-12'},{id:'f-parkingPrice', label:'駐車場の月額(円・任意)', type:'text', ph:'例: 4400'}],
    value:() => { const p=gv('f-parking'); return p ? ('P' + String(p).replace(/^P[-\s]?/i,'')) : ''; } },
];
function gv(id){ const el=document.getElementById(id); return el ? (el.value||'').trim() : ''; }
function fmtDateVal(v){ return v ? v.slice(5).replace('-','/') : ''; }
let _infoEditingKey = null;
function renderInfoIcons(){
  const wrap = document.getElementById('info-icons');
  if(!wrap) return;
  wrap.innerHTML = INFO_FIELDS.map(f => {
    const val = f.value();
    const filled = !!val;
    const clickAction = f.monthly ? 'toggleMonthlyField()' : (f.seg ? 'toggleTypeField()' : 'openInfoEdit(\'' + f.key + '\')');
    const tip = f.monthly ? 'マンスリー契約かどうか (クリックで切替)' : (f.seg ? f.label + ' (クリックで個人⇄法人を切替)' : f.label + ' (クリックで入力)');
    // 値の表示HTML(物件・仲介は改行、日付は大きく)
    let valBlock;
    let extraClass = '';
    let crossHtml = '';
    const isMonthlyCard = !!f.monthly;
    const monthlyOn = isMonthlyCard && (_editingMonthly === true);
    const parkingEmpty = (f.key === 'parking' && !filled);
    if(isMonthlyCard){
      if(monthlyOn){
        extraClass = ' info-monthly-on';
        valBlock = '<span class="info-ico-val info-monthly-val">マンスリー契約</span>';
      } else {
        valBlock = '<span class="info-ico-val info-monthly-off">マンスリーではない</span>';
      }
    } else if(parkingEmpty){
      // 駐車場未入力=不要(赤×)
      extraClass = ' info-red';
      crossHtml = '<span class="info-cross">✕</span>';
      valBlock = '<span class="info-ico-val info-red-val">不要</span>';
    } else if(!filled){
      valBlock = '<span class="info-ico-val empty">未入力</span>';
    } else if(f.key === 'property'){
      const p = esc(gv('f-property')), t = gv('f-tou'), r = gv('f-room');
      valBlock = '<span class="info-ico-val">' + p + (t ? '<br>' + esc(t) + '棟' : '') + (r ? (t ? ' ' : '<br>') + esc(r) + '号' : '') + '</span>';
    } else if(f.key === 'agency'){
      const bk = gv('f-broker'), st = gv('f-staff');
      const lines = [bk, st].filter(Boolean).map(x => esc(x)).join('<br>');
      valBlock = '<span class="info-ico-val">' + lines + '</span>';
    } else if(f.key === 'contractor'){
      // 契約者名の上に、選択中の種別(個人/法人)を表示
      const t = _editingType || '個人';
      const isCorp = (t === '法人');
      extraClass = isCorp ? ' type-corp' : ' type-person';
      const typeBadge = '<span class="info-ico-type">' + esc(t) + '</span>';
      valBlock = typeBadge + '<span class="info-ico-val">' + (filled ? esc(val) : '<span class="empty">未入力</span>') + '</span>';
    } else if(f.key === 'type'){
      // 個人=青 / 法人=緑
      const isCorp = (val === '法人');
      extraClass = isCorp ? ' type-corp' : ' type-person';
      valBlock = '<span class="info-ico-val type-val">' + esc(val) + '</span>';
    } else if(f.key === 'apply' || f.key === 'cdate'){
      valBlock = '<span class="info-ico-val is-date">' + esc(val) + '</span>';
    } else if(f.key === 'parking'){
      valBlock = '<span class="info-ico-val is-park">' + esc(val) + '</span>';
    } else {
      valBlock = '<span class="info-ico-val">' + esc(val) + '</span>';
    }
    const cardFilled = isMonthlyCard ? monthlyOn : filled;
    return '<div class="info-icon' + (cardFilled ? ' filled' : '') + extraClass + (f.wide ? ' info-icon-wide' : '') + (f.key===_infoEditingKey?' editing':'') + '"' +
      ' title="' + tip + '"' +
      ' onclick="' + clickAction + '">' +
      '<div class="info-ico-svg">' + INFO_ICON[f.icon] + crossHtml + '</div>' +
      '<span class="info-ico-label">' + f.label + '</span>' +
      valBlock +
    '</div>';
  }).join('');
}
// マンスリー: クリックでマンスリー契約⇄マンスリーではないを切り替え
let _editingMonthly = false;
function toggleMonthlyField(){
  _editingMonthly = !_editingMonthly;
  renderInfoIcons();
  autoSave();
}
// 契約者種別: クリックで個人⇄法人を切り替え
function toggleTypeField(){
  switchType((_editingType === '法人') ? '個人' : '法人');
  renderInfoIcons();
  autoSave();
}
// 契約者ポップアップのプルダウンから種別(個人/法人)を選択
function setContractorType(type){
  switchType(type);
  autoSave();
  // 法人なら代表者・部署欄が増えるので、ポップアップを作り直して反映
  openInfoEdit('contractor');
}
function openInfoEdit(key){
  const f = INFO_FIELDS.find(x => x.key === key);
  if(!f) return;
  // 日付フィールドは隠し入力のカレンダーを直接開く(ポップアップ不要)
  if(key === 'apply' || key === 'cdate'){
    const id = (key === 'apply') ? 'f-applyDate' : 'f-contractDate';
    const el = document.getElementById(id);
    if(el){
      el.focus();
      if(el.showPicker){ try{ el.showPicker(); }catch(e){} }
    }
    return;
  }
  // それ以外は中央ポップアップで入力
  _infoEditingKey = key;
  if(key === 'parking'){ const pe = document.getElementById('f-parking'); _parkingBeforeEdit = pe ? pe.value : ''; }
  const ov = document.getElementById('info-popup');
  const body = document.getElementById('info-popup-body');
  if(!ov || !body) return;
  document.getElementById('info-popup-title').textContent = f.label + 'を入力';
  const inputs = (typeof f.inputs === 'function') ? f.inputs() : f.inputs;
  let bodyHtml = '';
  // 契約者ポップアップには、先頭に「個人/法人」プルダウンを追加
  if(key === 'contractor'){
    const t = _editingType || '個人';
    bodyHtml +=
      '<div class="info-edit-row"><label>契約者種別</label>' +
      '<select onchange="KB.setContractorType(this.value)" style="padding:9px 12px;font-size:15px;border:1.5px solid #c7c7cc;border-radius:8px;width:100%;font-family:inherit;">' +
        '<option value="個人"' + (t==='個人'?' selected':'') + '>個人</option>' +
        '<option value="法人"' + (t==='法人'?' selected':'') + '>法人</option>' +
      '</select></div>';
  }
  bodyHtml += inputs.map(inp => {
    if(inp.type === 'tou-select'){
      const propName = gv('f-property');
      let touList = [];
      try{ if(typeof window.PV_getTouList === 'function'){ touList = window.PV_getTouList(propName) || []; } }catch(e){}
      const cur = gv(inp.id);
      // 現在値が一覧に無ければ加える(手入力済みデータの保持)
      if(cur && touList.indexOf(cur) < 0){ touList = [cur].concat(touList); }
      if(touList.length === 0){
        // 棟が未登録の物件はテキスト入力にフォールバック
        return '<div class="info-edit-row"><label>' + inp.label + '(任意)</label>' +
          '<input type="text" value="' + esc(cur) + '"' +
          (inp.ph ? ' placeholder="' + inp.ph + '"' : '') +
          ' oninput="KB.syncInfoInput(\'' + inp.id + '\', this.value)"></div>';
      }
      const opts = ['<option value="">(棟なし)</option>']
        .concat(touList.map(t => '<option value="' + esc(t) + '"' + (t===cur?' selected':'') + '>' + esc(t) + '棟</option>'))
        .join('');
      return '<div class="info-edit-row"><label>' + inp.label + '</label>' +
        '<select onchange="KB.syncInfoInput(\'' + inp.id + '\', this.value)" style="padding:9px 12px;font-size:15px;border:1.5px solid #c7c7cc;border-radius:8px;width:100%;font-family:inherit;">' +
        opts + '</select></div>';
    }
    return '<div class="info-edit-row"><label>' + inp.label + '</label>' +
      '<input type="' + inp.type + '" value="' + esc(gv(inp.id)) + '"' +
        (inp.ph ? ' placeholder="' + inp.ph + '"' : '') +
        ' oninput="KB.syncInfoInput(\'' + inp.id + '\', this.value)"></div>';
  }).join('');
  body.innerHTML = bodyHtml;
  ov.classList.add('active');
  renderInfoIcons();
  const first = body.querySelector('input');
  if(first){ first.focus(); }
}
function closeInfoEdit(){
  const closedKey = _infoEditingKey;   // 閉じる直前に編集していた項目
  _infoEditingKey = null;
  const ov = document.getElementById('info-popup');
  if(ov){ ov.classList.remove('active'); }
  renderInfoIcons();
  // ポップアップ中に完了していたら、閉じたタイミングでお祝い演出
  const c = buildContractObject();
  const nowComplete = isContractComplete(c);
  if(nowComplete && !_autoSaveWasComplete){
    celebrateComplete(c);
  }
  _autoSaveWasComplete = nowComplete;
  // 駐車場(区画)の入力ポップアップを閉じたとき、区画が空なら予約削除を確認する
  if(closedKey === 'parking'){
    const pEl = document.getElementById('f-parking');
    const pv = pEl ? pEl.value.trim() : '';
    if(pv === '' && typeof maybeUnlinkOnClear === 'function'){
      const oldParking = _parkingBeforeEdit || '';
      maybeUnlinkOnClear('駐車場(区画)が未入力になりました', function(){
        if(oldParking && pEl){
          pEl.value = oldParking;
          try{ renderInfoIcons(); }catch(e){}
          try{ renderSheetItemSummary(); }catch(e){}
          autoSave();
          toast('駐車場(区画)を元に戻しました');
        }
      });
      return;
    }
  }
  // 契約日とP区画がそろっていれば、ポップアップを閉じたこのタイミングで予約登録を案内する
  if(typeof maybeAutoLinkPrompt === 'function'){ maybeAutoLinkPrompt(c, false); }
}
function refreshInfoEdit(){ /* ポップアップ式では不要 */ }
// 駐車場契約者を手入力で変えたかどうか(手入力されたら自動同期しない)
let _carContractorManual = false;
function syncInfoInput(id, val){
  const el = document.getElementById(id);
  const carEl = document.getElementById('f-carContractor');
  if(id === 'f-carContractor'){
    // ユーザーが駐車場契約者を直接入力 → 以後は自動同期しない(空にすれば自動同期に戻る)
    _carContractorManual = (val.trim() !== '');
  }
  if(el){ el.value = val; }
  // 法人名が変わったら、駐車場契約者が空 or 自動同期中のときは同じ名前を入れる
  if(id === 'f-contractor' && _editingType === '法人' && carEl){
    if(!_carContractorManual || carEl.value.trim() === ''){
      carEl.value = val;
      // ポップアップ表示中の駐車場契約者入力欄にも反映
      try{
        const popInputs = document.querySelectorAll('#info-popup-body input');
        popInputs.forEach(pi => {
          if(pi.getAttribute('oninput') && pi.getAttribute('oninput').indexOf('f-carContractor') >= 0){ pi.value = val; }
        });
      }catch(e){}
    }
  }
  // 契約日・P区画など連動が必要なものはイベントを発火
  if(id === 'f-contractDate'){ onContractDateChange(); }
  if(id === 'f-parking'){ renderSheetItemSummary(); }
  // 物件名が変わったら、棟プルダウンの候補だけ作り直す(物件ポップアップ表示中のみ・フォーカスは維持)
  if(id === 'f-property' && _infoEditingKey === 'property'){
    try{
      const touSel = document.querySelector('#info-popup-body select[onchange*="f-tou"]');
      if(touSel){
        let touList = [];
        if(typeof window.PV_getTouList === 'function'){ touList = window.PV_getTouList(val) || []; }
        const cur = gv('f-tou');
        if(cur && touList.indexOf(cur) < 0){ touList = [cur].concat(touList); }
        touSel.innerHTML = '<option value="">(棟なし)</option>' +
          touList.map(t => '<option value="' + esc(t) + '"' + (t===cur?' selected':'') + '>' + esc(t) + '棟</option>').join('');
      }
    }catch(e){}
  }
  renderInfoIcons();
  autoSave();
  // ★ 契約日 または 駐車場(P区画)を「空」にした場合、紐づいている駐車場予約の削除を確認する
  if(String(val||'').trim() === ''){
    if(id === 'f-contractDate'){ maybeUnlinkOnClear('契約日が未入力になりました'); }
    // 注: 駐車場(f-parking)は入力途中で一瞬空になることがあるため、ここでは確認しない。
    //     区画入力ポップアップを閉じたタイミング(closeInfoEdit)でまとめて判定する。
  }
}
function fillForm(c){
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ''; };
  set('f-applyDate', c.applyDate);
  set('f-contractDate', c.contractDate);
  set('f-property', c.property);
  set('f-room', c.room);
  set('f-tou', c.tou);
  set('f-parking', c.parking);
  set('f-parkingPrice', c.parkingPrice || '');
  set('f-pet', c.pet);
  set('f-contractor', c.contractor);
  set('f-carContractor', c.carContractor);
  set('f-corpRep', c.corpRep);
  set('f-corpDept', c.corpDept);
  set('f-agent', c.agent);
  set('f-broker', c.broker);
  set('f-staff', c.staff);
  set('f-insurance', c.insurance);
  set('f-invoice', c.invoice);
  set('f-keyExchange', c.keyExchange);
  set('f-rescue', c.rescue);
  set('f-electric', c.electric);
  set('f-keyMail', c.keyMail);
  set('f-rescueFax', c.rescueFax);
  set('f-sendDate', c.sendDate);
  set('f-esignDate', c.esignDate);
  set('f-returnDate', c.returnDate);
  set('f-guaranteeDate', c.guaranteeDate);
  set('f-keyHandover', c.keyHandover);
  set('f-paymentDate', c.paymentDate);
  set('f-memo', c.memo);
}
// 編集中の入力からデータオブジェクトを組み立て
function buildContractObject(){
  const get = (id) => { const el=document.getElementById(id); return el ? (el.value || '').trim() : ''; };
  const property = get('f-property'), contractor = get('f-contractor');
  let currentStage = '申込';
  STAGES.forEach(s => { if(_editingReached[s.key]) currentStage = s.key; });
  const all = loadAll();
  const existing = _editingId ? all[_editingId] : null;
  const c = Object.assign({}, existing || {}, {
    id: _editingId || genId(),
    type: _editingType,
    warn: _editingWarn ? 1 : 0,
    stage: currentStage,
    stageReached: _editingReached,
    applyDate: get('f-applyDate'),
    contractDate: get('f-contractDate'),
    property: property,
    tou: get('f-tou'),
    room: get('f-room'),
    parking: get('f-parking'),
    parkingPrice: get('f-parkingPrice'),
    pet: _editingItemValues.pet || '',
    contractor: contractor,
    carContractor: get('f-carContractor'),
    corpRep: get('f-corpRep'),
    corpDept: get('f-corpDept'),
    agent: get('f-agent'),
    broker: get('f-broker'),
    staff: get('f-staff'),
    insurance: _editingItemValues.insurance || '',
    invoice: _editingItemValues.invoice || '',
    keyExchange: _editingItemValues.keyExchange || '',
    rescue: _editingItemValues.rescue || '',
    electric: _editingItemValues.electric || '',
    keyMail: _editingItemValues.keyMail || '',
    rescueFax: '',
    memo: get('f-memo'),
    updatedAt: new Date().toISOString()
  });
  ITEMS.forEach(it => {
    if(it.key === 'parking' || it.key === 'pet') return;
    c[it.key] = _editingItemValues[it.key] || '';
  });
  c.itemDates = Object.assign({}, _editingItemDates || {});
  ITEMS.forEach(it => {
    if(itemGot(c, it)){
      if(!c.itemDates[it.key]) c.itemDates[it.key] = today();
    } else {
      delete c.itemDates[it.key];
    }
  });
  // マンスリーカードの状態を dealStatus に反映
  if(_editingMonthly){
    if(c.dealStatus !== 'cancel' && c.dealStatus !== 'rejected'){ c.dealStatus = 'monthly'; }
  } else if(c.dealStatus === 'monthly'){
    c.dealStatus = 'apply';
  }
  return c;
}
// 自動保存(入力のたびに呼ばれる)。完了になった瞬間にお祝い。
let _autoSaveWasComplete = false;
let _autoSaveWasLinkable = false;
function autoSave(){
  if(!document.getElementById('sheet').classList.contains('active')) return;
  const c = buildContractObject();
  // 物件名も契約者も空なら保存しない(新規の空フォーム)
  if(!(c.property || c.contractor) && !c.applyDate && !c.contractDate) return;
  const all = loadAll();
  if(typeof c.order !== 'number'){
    const maxOrder = Object.values(all).reduce((m,x) => Math.max(m, (typeof x.order==='number'?x.order:-1)), -1);
    c.order = maxOrder + 1;
  }
  all[c.id] = c;
  saveAll(all);
  if(!_editingId){ _editingId = c.id; }  // 新規→以後は同一IDを更新
  renderAll();
  updateSheetStatusBg();
  const nowComplete = isContractComplete(c);
  // 基本情報の入力ポップアップが開いている間は演出を出さない(入力の邪魔になるため)。
  // ポップアップを閉じたときに改めて判定する。
  const popupOpen = _infoEditingKey != null;
  if(nowComplete && !_autoSaveWasComplete && !popupOpen){
    celebrateComplete(c);
  }
  if(!popupOpen){ _autoSaveWasComplete = nowComplete; }
  // ===== 契約管理→PIVOT 予約連携(自動) =====
  // 【無効化】自動で区画へ予約を書き込むと、物件側で予約を削除しても
  // 再入力・再表示のたびに書き戻されて「削除しても復活する」問題が起きるため、
  // 自動紐づけは行わない。紐づけは手動ボタン(区画に予約として紐づける)のときだけ実行する。
  const linkable = !!(c.contractor && c.contractDate);
  if(linkable){ _autoSaveWasLinkable = true; }   // 手動側の状態整合のため維持
  else { _autoSaveWasLinkable = false; }
  // ★ 契約日とP区画が両方そろったら「予約として登録しますか?」を自動で案内する。
  //   (入力ポップアップ/カレンダーが開いている間は出さない。すでに紐づけ済みなら出さない)
  maybeAutoLinkPrompt(c, popupOpen);
}
let _autoLinkPromptBusy = false;
let _lastPromptParking = null;      // 前回時点の駐車場区画(変化検出用)
let _lastPromptContractDate = null; // 前回時点の契約日(変化検出用)
let _autoLinkPromptDismissed = null;// 一度キャンセルした組み合わせ(再表示抑止)
function maybeAutoLinkPrompt(c, popupOpen){
  try{
    if(popupOpen) return;                 // 入力中は邪魔しない
    if(_autoLinkPromptBusy) return;       // ダイアログの多重表示を防ぐ
    if(!c || !c.property || !c.parking || !c.contractDate) return;  // 両方そろっていない
    // 駐車場(区画)または契約日が今まさに変化したときだけ案内する(無関係なアイテム操作では出さない)
    const curParking = c.parking || '';
    const curDate = c.contractDate || '';
    const changed = (curParking !== _lastPromptParking) || (curDate !== _lastPromptContractDate);
    _lastPromptParking = curParking;
    _lastPromptContractDate = curDate;
    if(!changed) return;
    const combo = c.id + '|' + curParking + '|' + curDate;
    if(_autoLinkPromptDismissed === combo) return;
    if(typeof window.PV_hasReservation !== 'function' || typeof window.PV_linkReservation !== 'function') return;
    const resName = (c.type === '法人' && c.carContractor && c.carContractor.trim())
      ? c.carContractor.trim() : c.contractor;
    const info = { contractor: resName, carContractor: c.carContractor, srcKey: c.id, property: c.property, parking: c.parking };
    // すでにこの契約の予約が紐づいているなら、もう案内しない
    if(window.PV_hasReservation(info)) return;
    _autoLinkPromptBusy = true;
    setTimeout(() => {
      try{
        if(confirm('契約日と駐車場(区画)が入力されました。\nこの区画に予約として登録しますか?')){
          if(typeof linkCurrentToSpot === 'function'){ linkCurrentToSpot(); }
        } else {
          _autoLinkPromptDismissed = combo;
        }
      }catch(e){}
      setTimeout(() => { _autoLinkPromptBusy = false; }, 400);
    }, 50);
  }catch(e){ _autoLinkPromptBusy = false; }
}
function saveContract(){ autoSave(); closeSheet(); }
// 手動: 現在編集中の契約を区画の予約欄へ紐づける(ボタンから呼ばれる)
function linkCurrentToSpot(){
  const c = buildContractObject();
  if(!c.contractor || !c.contractDate){
    alert('契約者名と契約確定日の両方を入力してください');
    return;
  }
  if(!c.property || !c.parking){
    alert('物件名と区画番号(P区画)を入力してください');
    return;
  }
  if(!window.PV_linkReservation){
    alert('物件管理が読み込まれていません。再読み込みしてください');
    return;
  }
  // 予約に反映する名前: 駐車場契約者があればそれ、空なら契約者名(法人名)
  const resName = (c.type === '法人' && c.carContractor && c.carContractor.trim())
    ? c.carContractor.trim() : c.contractor;
  // 契約日が今日以前(過去日)なら確認の上「使用中」で登録する
  const cdRaw = String(c.contractDate||'').trim();
  let cdN = '';
  const cm = cdRaw.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
  if(cm){ cdN = cm[1] + '-' + String(parseInt(cm[2])).padStart(2,'0') + '-' + String(parseInt(cm[3])).padStart(2,'0'); }
  const _t = new Date();
  const todayN = _t.getFullYear() + '-' + String(_t.getMonth()+1).padStart(2,'0') + '-' + String(_t.getDate()).padStart(2,'0');
  let useNow = false;
  if(cdN && cdN <= todayN){
    if(!confirm('契約日(' + cdN + ')は今日以前の日付です。よろしいですか?\n\nOK: 予約ではなく「使用中」として区画に登録します(使用者名も記入)。\nキャンセル: 中止します。')){
      return;
    }
    useNow = true;
  }
  const res = window.PV_linkReservation({
    property: c.property,
    tou: c.tou,
    parking: c.parking,
    room: c.room,
    contractor: resName,
    contractDate: c.contractDate,
    srcKey: c.id,
    useNow: useNow,
    price: c.parkingPrice
  });
  if(res && res.ok){
    _autoSaveWasLinkable = true;
    const noStr = String(res.no).split('・').map(n => 'P'+String(n).padStart(2,'0')).join('・');
    const cntStr = (res.count && res.count > 1) ? ('(' + res.count + '区画)') : '';
    if(res.useNow){
      alert('「'+res.bldName+'」' + noStr + cntStr + ' を「使用中」として登録しました。\n使用開始日: ' + (res.resDate || '') + '\n使用者: ' + resName);
    } else {
      alert('「'+res.bldName+'」' + noStr + cntStr + ' の予約欄に予約中として登録しました。\n予約日: ' + (res.resDate || '') + '(契約確定日と同じ日付で登録)');
    }
  } else if(res && res.reason === 'cancelled'){
    /* ユーザーが確認ダイアログでキャンセル: 何もしない */
  } else if(res && res.reason === 'already'){
    alert('変更がありません。\nこの内容ではすでにこの区画へ予約済みです。');
  } else if(res && res.msg){
    alert(res.msg);
  } else {
    alert('紐づけ処理を実行しましたが、結果を判定できませんでした。区画が物件管理に登録されているかご確認ください。');
  }
}
// 🎉 完了お祝い演出(画面全体)
function celebrateComplete(c){
  const name = (c.property || '') + (c.room ? ' ' + String(c.room).replace(/^P/i,'') + '号' : '');
  const ov = document.createElement('div');
  ov.className = 'celebrate-overlay';
  ov.innerHTML =
    '<div class="celebrate-card">' +
      '<div class="celebrate-trophy">🏆</div>' +
      '<div class="celebrate-title">契約 完了！</div>' +
      '<div class="celebrate-sub">' + esc(name || c.contractor || '') + '</div>' +
      '<div class="celebrate-msg">すべてのステップが完了しました 🎉</div>' +
      '<button class="celebrate-btn" onclick="this.closest(\'.celebrate-overlay\').remove()">閉じる</button>' +
    '</div>';
  // 紙吹雪
  const conf = document.createElement('div');
  conf.className = 'confetti-layer';
  const colors = ['#ff5252','#ffd400','#34c759','#5856d6','#007aff','#ff9500','#ff2d55'];
  for(let i=0;i<120;i++){
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    p.style.left = Math.random()*100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random()*0.6) + 's';
    p.style.animationDuration = (1.8 + Math.random()*1.4) + 's';
    p.style.transform = 'rotate(' + (Math.random()*360) + 'deg)';
    conf.appendChild(p);
  }
  ov.appendChild(conf);
  document.body.appendChild(ov);
  // 効果音(あれば)/ 自動クローズ
  setTimeout(() => { if(ov.parentNode){ ov.classList.add('fade'); setTimeout(()=>ov.remove(), 600); } }, 5000);
}
function deleteContract(){
  if(!_editingId) return;
  if(!confirm('この契約を削除しますか?')) return;
  const all = loadAll();
  deleteFromCloud(_editingId);
  delete all[_editingId];
  saveAll(all);
  toast('削除しました');
  closeSheet();
  renderAll();
}
// 一覧カードの右上「×」から契約を削除する
function deleteCardContract(event, id){
    if(event){ try{ event.stopPropagation(); }catch(e){} }
    if(!id) return;
    const all = loadAll();
    const c = all[id];
    const label = c ? ((c.property||'') + (c.contractor ? '（' + c.contractor + '）' : '')) : '';
    if(!confirm('この契約を削除しますか?\n' + label)) return;
    // 紐づいた駐車場予約も自動で解除(この契約の予約だけ。他人の予約は残す)
    try{
      if(c && typeof window.PV_unlinkReservation === 'function'){
        window.PV_unlinkReservation({ contractor: c.contractor, carContractor: c.carContractor, srcKey: c.id, property: c.property });
      }
    }catch(e){}
    delete all[id];
    deleteFromCloud(id);
    saveAll(all);
    toast('削除しました');
    renderAll();
  }
  // クラウドから契約を1件削除
function deleteFromCloud(id){
  try{
    const url = (typeof getCloudUrl === 'function') ? getCloudUrl() : '';
    if(!url || !id) return;
    fetch(url, { method:'POST', body: JSON.stringify({ action:'deleteContract', id: id }) });
  }catch(e){}
}
function toast(m){
  const el = document.getElementById('kb-toast');
  el.textContent = m;
  el.classList.add('show');
  clearTimeout(window._toastT);
  window._toastT = setTimeout(()=>el.classList.remove('show'), 2400);
}
function renderAll(){ renderStats(); renderBoard(); }
 
function seed(){
  const all = loadAll();
  if(Object.keys(all).length > 0) return;
  const mk = (stage, reachedList) => {
    const r = {};
    reachedList.forEach((d, i) => { r[STAGES[i].key] = d; });
    return r;
  };
  const samples = [
    {type:'法人', warn:1, stage:'契約書送付', property:'ベラカーササウス', room:'201', parking:'P-12', pet:'あり', rescue:'○', contractor:'株式会社大和証券グループ本社', broker:'東建コーポレーション', staff:'山崎',
      stageReached:{'申込':'2026-01-20','契約日確定':'2026-02-10','契約書送付':'2026-02-17'}, applyDate:'2026-01-20', contractDate:'2026-03-07'},
    {type:'個人', warn:1, stage:'契約日確定', property:'ベラカーサノース', room:'705', parking:'P-3', contractor:'吉村　洸哉', broker:'穴吹ハウジング', staff:'矢野',
      stageReached:{'申込':'2026-03-18','契約日確定':'2026-04-01'}, applyDate:'2026-03-18', contractDate:'2026-04-15'},
    {type:'個人', warn:0, stage:'入金', property:'エバーグリーン福山西町', room:'302', contractor:'山田　太郎', broker:'アパマンショップ福山駅前店', staff:'松尾',
      stageReached:{'申込':'2026-04-17','契約日確定':'2026-04-20','契約書送付':'2026-04-27','契約書返送':'2026-05-16','入金':'2026-05-18'}, insurance:'ホープ', invoice:'要'},
    {type:'法人', warn:0, stage:'完了', property:'ベラカーササウス', room:'206', contractor:'㈱ハウスメートパートナーズ', broker:'ワイケイ倉敷沖新店', staff:'藤原',
      stageReached:{'申込':'2026-02-21','契約日確定':'2026-03-01','契約書送付':'2026-03-05','契約書返送':'2026-03-20','入金':'2026-04-18','鍵渡し':'2026-04-25','完了':'2026-04-28'}, insurance:'完了', invoice:'不要'},
    {type:'個人', warn:0, stage:'申込', property:'アプリシティ', room:'101', contractor:'宇根　健太', broker:'ケイアイホーム沖野上店', staff:'井上',
      stageReached:{'申込':'2026-04-30'}, applyDate:'2026-04-30'},
  ];
  samples.forEach(s => { s.id = genId(); s.updatedAt = new Date().toISOString(); all[s.id] = s; });
  saveAll(all);
}
 
// seed();
renderAll();
 
// プレビュー: バックドロップのクリックで閉じる
document.getElementById('preview-backdrop').addEventListener('click', () => hidePreview());
document.getElementById('done-backdrop').addEventListener('click', () => closeDoneModal());
document.getElementById('bstat-backdrop').addEventListener('click', () => closeBrokerStats());
// Escで閉じる
document.addEventListener('keydown', (e) => { if(e.key === 'Escape'){ hidePreview(); closeDoneModal(); closeBrokerStats(); } });
 
// 編集シートからカーソルが外れたら閉じる(PCのみ・少し待って誤作動防止・戻れば取消)
let _sheetLeaveTimer = null;
let _sheetOpenedAt = 0;
(function bindSheetAutoClose(){
  // マウスがシート外に出ても自動で閉じない。閉じるのは「閉じる」「×」ボタンのみ。
  return;
})();
 
 
/* =========================================================
 *  スマホの誤タップ対策
 *  ・指が動いた（スワイプした）ときは、そのあとのタップを無効にする
 *  ・スクロール直後のタップも無効にする（勢いを止めた指が反応するのを防ぐ）
 *  ・触って操作する端末では、カードのドラッグ移動を切る
 * ======================================================= */
(function(){
  if(!('ontouchstart' in window)) return;          // 触って操作する端末だけ
  var sx = 0, sy = 0, moved = false, lastScroll = 0;
  var MOVE = 12;        // これ以上動いたらスワイプとみなす（px）
  var AFTER_SCROLL = 350;  // スクロールが止まってから、この時間はタップを無視（ミリ秒）
 
  document.addEventListener('touchstart', function(e){
    var t = e.touches && e.touches[0]; if(!t) return;
    sx = t.clientX; sy = t.clientY; moved = false;
  }, {passive:true, capture:true});
 
  document.addEventListener('touchmove', function(e){
    var t = e.touches && e.touches[0]; if(!t) return;
    if(Math.abs(t.clientX - sx) > MOVE || Math.abs(t.clientY - sy) > MOVE) moved = true;
  }, {passive:true, capture:true});
 
  document.addEventListener('scroll', function(){ lastScroll = Date.now(); },
    {passive:true, capture:true});
 
  document.addEventListener('click', function(e){
    var recent = (Date.now() - lastScroll) < AFTER_SCROLL;
    if(!moved && !recent) return;                  // 素直なタップは通す
    e.stopPropagation();
    e.preventDefault();
    // 入力欄に指が触れてキーボードが出るのも防ぐ
    if(document.activeElement && document.activeElement.blur) {
      try{ document.activeElement.blur(); }catch(_){}
    }
  }, true);
 
  // 触って操作する端末では、カードのドラッグ移動を無効にする（スクロールと干渉するため）
  document.addEventListener('DOMContentLoaded', function(){
    var css = document.createElement('style');
    css.textContent = '.ct-card{ -webkit-user-drag:none; }';
    document.head.appendChild(css);
  });
})();
;window.KB = window.KB || {};
try{window.KB.setStatFilter=setStatFilter;}catch(e){}
try{window.KB.toggleViewMode=toggleViewMode;}catch(e){}
try{window.KB.setViewMode=setViewMode;}catch(e){}
try{window.KB.archiveYearCsv=archiveYearCsv;}catch(e){}
try{window.KB.drawArchiveNotice=drawArchiveNotice;}catch(e){}
try{window.KB.autoCompleteCheck=autoCompleteCheck;}catch(e){}
try{window.KB.autoSave=autoSave;}catch(e){}
try{window.KB.basicDone=basicDone;}catch(e){}
try{window.KB.basicInfoComplete=basicInfoComplete;}catch(e){}
try{window.KB.bindCardDrag=bindCardDrag;}catch(e){}
try{window.KB.bindSheetAutoClose=bindSheetAutoClose;}catch(e){}
try{window.KB.buildContractObject=buildContractObject;}catch(e){}
try{window.KB.cardStatus=cardStatus;}catch(e){}
try{window.KB.linkCurrentToSpot=linkCurrentToSpot;}catch(e){}
try{window.KB.cdateHtml=cdateHtml;}catch(e){}
try{window.KB.celebrateComplete=celebrateComplete;}catch(e){}
try{window.KB.closeDoneModal=closeDoneModal;}catch(e){}
try{window.KB.closeInfoEdit=closeInfoEdit;}catch(e){}
try{window.KB.closeSheet=closeSheet;}catch(e){}
try{window.KB.contractProgress=contractProgress;}catch(e){}
try{window.KB.currentStageIndex=currentStageIndex;}catch(e){}
try{window.KB.cycleSortNone=cycleSortNone;}catch(e){}
try{window.KB.cycleZoneItem=cycleZoneItem;}catch(e){}
try{window.KB.damageLevel=damageLevel;}catch(e){}
try{window.KB.ddBindDrag=ddBindDrag;}catch(e){}
try{window.KB.ddDrop=ddDrop;}catch(e){}
try{window.KB.ddLeave=ddLeave;}catch(e){}
try{window.KB.ddOver=ddOver;}catch(e){}
try{window.KB.ddTouchEnd=ddTouchEnd;}catch(e){}
try{window.KB.ddTouchMove=ddTouchMove;}catch(e){}
try{window.KB.ddTouchStart=ddTouchStart;}catch(e){}
try{window.KB.deleteContract=deleteContract;}catch(e){}
try{window.KB.deleteCardContract=deleteCardContract;}catch(e){}
try{window.KB.esc=esc;}catch(e){}
try{window.KB.fillForm=fillForm;}catch(e){}
try{window.KB.fmtDateVal=fmtDateVal;}catch(e){}
try{window.KB.formatDateShort=formatDateShort;}catch(e){}
try{window.KB.genId=genId;}catch(e){}
try{window.KB.getReachedStages=getReachedStages;}catch(e){}
try{window.KB.getRemainingStages=getRemainingStages;}catch(e){}
try{window.KB.gv=gv;}catch(e){}
try{window.KB.hexA=hexA;}catch(e){}
try{window.KB.hidePreview=hidePreview;}catch(e){}
try{window.KB.iconForStep=iconForStep;}catch(e){}
try{window.KB.isContractComplete=isContractComplete;}catch(e){}
try{window.KB.itemColor=itemColor;}catch(e){}
try{window.KB.itemGot=itemGot;}catch(e){}
try{window.KB.loadAll=loadAll;}catch(e){}
try{window.KB.missingLabels=missingLabels;}catch(e){}
try{window.KB.moveGhost=moveGhost;}catch(e){}
try{window.KB.moveToDone=moveToDone;}catch(e){}
try{window.KB.revertToApply=revertToApply;}catch(e){}
try{window.KB.onCardStatusChange=onCardStatusChange;}catch(e){}
try{window.KB.promptStatusDate=promptStatusDate;}catch(e){}
try{window.KB.onMonthlyToggle=onMonthlyToggle;}catch(e){}
try{window.KB.onCardClick=onCardClick;}catch(e){}
try{window.KB.onCardDragEnd=onCardDragEnd;}catch(e){}
try{window.KB.onCardDragStart=onCardDragStart;}catch(e){}
try{window.KB.onCardHover=onCardHover;}catch(e){}
try{window.KB.onCardLeave=onCardLeave;}catch(e){}
try{window.KB.onColDragLeave=onColDragLeave;}catch(e){}
try{window.KB.onColDragOver=onColDragOver;}catch(e){}
try{window.KB.onColDrop=onColDrop;}catch(e){}
try{window.KB.onContractDateChange=onContractDateChange;}catch(e){}
try{window.KB.onDefectFilter=onDefectFilter;}catch(e){}
try{window.KB.onParkingTap=onParkingTap;}catch(e){}
try{window.KB.openDoneModal=openDoneModal;}catch(e){}
try{window.KB.openBrokerStats=openBrokerStats;}catch(e){}
try{window.KB.closeBrokerStats=closeBrokerStats;}catch(e){}
try{window.KB.renderBrokerStats=renderBrokerStats;}catch(e){}
try{window.KB.renderBrokerStatsSoon=renderBrokerStatsSoon;}catch(e){}
try{window.KB.exportBrokerStatsCsv=exportBrokerStatsCsv;}catch(e){}
try{window.KB.exportBrokerStatsPdf=exportBrokerStatsPdf;}catch(e){}
try{window.KB.filterBrokerYear=filterBrokerYear;}catch(e){}
try{window.KB.toggleBrokerCard=toggleBrokerCard;}catch(e){}
try{window.KB.showBrokerCancels=showBrokerCancels;}catch(e){}
try{window.KB.setBrokerStatMode=setBrokerStatMode;}catch(e){}
try{window.KB.togglePropCard=togglePropCard;}catch(e){}
try{window.KB.toggleStaffCard=toggleStaffCard;}catch(e){}
try{window.KB.openFromDone=openFromDone;}catch(e){}
try{window.KB.openInfoEdit=openInfoEdit;}catch(e){}
try{window.KB.openSheet=openSheet;}catch(e){}
try{window.KB.persistCardOrder=persistCardOrder;}catch(e){}
try{window.KB.progressCurrentIndex=progressCurrentIndex;}catch(e){}
try{window.KB.refreshInfoEdit=refreshInfoEdit;}catch(e){}
try{window.KB.renderAll=renderAll;}catch(e){}
try{window.KB.renderBoard=renderBoard;}catch(e){}
try{window.KB.renderCard=renderCard;}catch(e){}
try{window.KB.renderDoneList=renderDoneList;}catch(e){}
try{window.KB.exportSelectedDoneCsv=exportSelectedDoneCsv;}catch(e){}
try{window.KB.renderInfoIcons=renderInfoIcons;}catch(e){}
try{window.KB.renderSheetDateSummary=renderSheetDateSummary;}catch(e){}
try{window.KB.renderSheetItemSummary=renderSheetItemSummary;}catch(e){}
try{window.KB.renderStageTimeline=renderStageTimeline;}catch(e){}
try{window.KB.renderStats=renderStats;}catch(e){}
try{window.KB.returnToBoard=returnToBoard;}catch(e){}
try{window.KB.deleteFromDone=deleteFromDone;}catch(e){}
try{window.KB.deleteSelectedDone=deleteSelectedDone;}catch(e){}
try{window.KB.toggleSelectAllDone=toggleSelectAllDone;}catch(e){}
try{window.KB.updateDoneSelCount=updateDoneSelCount;}catch(e){}
try{window.KB.saveAll=saveAll;}catch(e){}
try{window.KB.saveContract=saveContract;}catch(e){}
try{window.KB.seed=seed;}catch(e){}
try{window.KB.setItemGot=setItemGot;}catch(e){}
try{window.KB.setItemDate=setItemDate;}catch(e){}
try{window.KB.setSortMode=setSortMode;}catch(e){}
try{window.KB.showPreview=showPreview;}catch(e){}
try{window.KB.stageIcon=stageIcon;}catch(e){}
try{window.KB.stageIndex=stageIndex;}catch(e){}
try{window.KB.switchType=switchType;}catch(e){}
try{window.KB.switchWarn=switchWarn;}catch(e){}
try{window.KB.syncInfoInput=syncInfoInput;}catch(e){}
try{window.KB.toast=toast;}catch(e){}
try{window.KB.today=today;}catch(e){}
try{window.KB.toggleSheetDate=toggleSheetDate;}catch(e){}
try{window.KB.toggleSheetItem=toggleSheetItem;}catch(e){}
try{window.KB.toggleStageReached=toggleStageReached;}catch(e){}
try{window.KB.toggleTypeField=toggleTypeField;}catch(e){}
try{window.KB.toggleMonthlyField=toggleMonthlyField;}catch(e){}
try{window.KB.setContractorType=setContractorType;}catch(e){}
try{window.KB.updateSortButtons=updateSortButtons;}catch(e){}
 
 
/* expose kanban handlers as globals (non-colliding only) */
try{window.autoCompleteCheck=autoCompleteCheck;}catch(e){}
try{window.autoSave=autoSave;}catch(e){}
try{window.basicDone=basicDone;}catch(e){}
try{window.basicInfoComplete=basicInfoComplete;}catch(e){}
try{window.bindCardDrag=bindCardDrag;}catch(e){}
try{window.bindSheetAutoClose=bindSheetAutoClose;}catch(e){}
try{window.buildContractObject=buildContractObject;}catch(e){}
try{window.cardStatus=cardStatus;}catch(e){}
try{window.cdateHtml=cdateHtml;}catch(e){}
try{window.celebrateComplete=celebrateComplete;}catch(e){}
try{window.closeDoneModal=closeDoneModal;}catch(e){}
try{window.closeInfoEdit=closeInfoEdit;}catch(e){}
try{window.closeSheet=closeSheet;}catch(e){}
try{window.contractProgress=contractProgress;}catch(e){}
try{window.currentStageIndex=currentStageIndex;}catch(e){}
try{window.cycleSortNone=cycleSortNone;}catch(e){}
try{window.cycleZoneItem=cycleZoneItem;}catch(e){}
try{window.damageLevel=damageLevel;}catch(e){}
try{window.ddBindDrag=ddBindDrag;}catch(e){}
try{window.ddDrop=ddDrop;}catch(e){}
try{window.ddLeave=ddLeave;}catch(e){}
try{window.ddOver=ddOver;}catch(e){}
try{window.ddTouchEnd=ddTouchEnd;}catch(e){}
try{window.ddTouchMove=ddTouchMove;}catch(e){}
try{window.ddTouchStart=ddTouchStart;}catch(e){}
try{window.deleteContract=deleteContract;}catch(e){}
try{window.esc=esc;}catch(e){}
try{window.fillForm=fillForm;}catch(e){}
try{window.fmtDateVal=fmtDateVal;}catch(e){}
try{window.formatDateShort=formatDateShort;}catch(e){}
try{window.getReachedStages=getReachedStages;}catch(e){}
try{window.getRemainingStages=getRemainingStages;}catch(e){}
try{window.gv=gv;}catch(e){}
try{window.hexA=hexA;}catch(e){}
try{window.hidePreview=hidePreview;}catch(e){}
try{window.iconForStep=iconForStep;}catch(e){}
try{window.isContractComplete=isContractComplete;}catch(e){}
try{window.itemColor=itemColor;}catch(e){}
try{window.itemGot=itemGot;}catch(e){}
try{window.missingLabels=missingLabels;}catch(e){}
try{window.moveGhost=moveGhost;}catch(e){}
try{window.moveToDone=moveToDone;}catch(e){}
try{window.onCardClick=onCardClick;}catch(e){}
try{window.onCardDragEnd=onCardDragEnd;}catch(e){}
try{window.onCardDragStart=onCardDragStart;}catch(e){}
try{window.onCardHover=onCardHover;}catch(e){}
try{window.onCardLeave=onCardLeave;}catch(e){}
try{window.onColDragLeave=onColDragLeave;}catch(e){}
try{window.onColDragOver=onColDragOver;}catch(e){}
try{window.onColDrop=onColDrop;}catch(e){}
try{window.onContractDateChange=onContractDateChange;}catch(e){}
try{window.onDefectFilter=onDefectFilter;}catch(e){}
try{window.onParkingTap=onParkingTap;}catch(e){}
try{window.openDoneModal=openDoneModal;}catch(e){}
try{window.openFromDone=openFromDone;}catch(e){}
try{window.openInfoEdit=openInfoEdit;}catch(e){}
try{window.openSheet=openSheet;}catch(e){}
try{window.persistCardOrder=persistCardOrder;}catch(e){}
try{window.progressCurrentIndex=progressCurrentIndex;}catch(e){}
try{window.refreshInfoEdit=refreshInfoEdit;}catch(e){}
try{window.renderBoard=renderBoard;}catch(e){}
try{window.renderCard=renderCard;}catch(e){}
try{window.renderDoneList=renderDoneList;}catch(e){}
try{window.renderInfoIcons=renderInfoIcons;}catch(e){}
try{window.renderSheetDateSummary=renderSheetDateSummary;}catch(e){}
try{window.renderSheetItemSummary=renderSheetItemSummary;}catch(e){}
try{window.renderStageTimeline=renderStageTimeline;}catch(e){}
try{window.renderStats=renderStats;}catch(e){}
try{window.returnToBoard=returnToBoard;}catch(e){}
try{window.saveContract=saveContract;}catch(e){}
try{window.seed=seed;}catch(e){}
try{window.setItemGot=setItemGot;}catch(e){}
try{window.setSortMode=setSortMode;}catch(e){}
try{window.showPreview=showPreview;}catch(e){}
try{window.stageIcon=stageIcon;}catch(e){}
try{window.stageIndex=stageIndex;}catch(e){}
try{window.switchType=switchType;}catch(e){}
try{window.switchWarn=switchWarn;}catch(e){}
try{window.syncInfoInput=syncInfoInput;}catch(e){}
try{window.toast=toast;}catch(e){}
try{window.today=today;}catch(e){}
try{window.toggleSheetDate=toggleSheetDate;}catch(e){}
try{window.toggleSheetItem=toggleSheetItem;}catch(e){}
try{window.toggleStageReached=toggleStageReached;}catch(e){}
try{window.toggleTypeField=toggleTypeField;}catch(e){}
try{window.toggleMonthlyField=toggleMonthlyField;}catch(e){}
try{window.updateSortButtons=updateSortButtons;}catch(e){}
})();

