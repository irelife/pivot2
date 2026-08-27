/* ==================================================================
 * CORE 1 / クラウド同期エンジン (mtime ベースの push / pull)
 * ================================================================== */
 
// 画面の再描画を依頼する唯一の窓口。
// core から buildings/KB/KT を直接呼ばないための集約点。
/* ---- buildings.js の保存領域への窓口。core から直接触らないための集約点 ---- */
function pbKey(){
  return 'pivot2_blds';
}
function pbLoadAll(){
  try{
    if(window.PB && typeof window.PB.loadAll === 'function') return window.PB.loadAll() || {};
    if(typeof loadAll === 'function') return loadAll() || {};
    return JSON.parse(localStorage.getItem(pbKey()) || '{}');
  }catch(e){ return {}; }
}
function pbSaveRaw(obj){
  try{ localStorage.setItem(pbKey(), JSON.stringify(obj || {})); }catch(e){}
}
try{ window.pbKey = pbKey; window.pbLoadAll = pbLoadAll; window.pbSaveRaw = pbSaveRaw; }catch(e){}
/* ---- 契約データの保存キー。1(本番)と2(検証)を分けるための窓口 ---- */
function ctKey(){ return 'pivot2_contract_kanban_v2'; }
try{ window.ctKey = ctKey; }catch(e){}
/* ---- buildings.js の機能への窓口。未読込でも落ちないようにする ---- */
function pbCall(name, arg){
  try{
    if(window.PB && typeof window.PB[name] === 'function') return window.PB[name](arg);
    if(typeof window[name] === 'function') return window[name](arg);
  }catch(e){}
  return undefined;
}
try{ window.pbCall = pbCall; }catch(e){}
function requestRender(target){
  target = target || 'all';
  if(target === 'all' || target === 'buildings'){
    try{ if(typeof renderAll === 'function') renderAll(); }catch(e){}
  }
  if(target === 'all' || target === 'kanban'){
    try{ if(window.KB && window.KB.renderAll) window.KB.renderAll(); }catch(e){}
  }
  if(target === 'all' || target === 'kintai'){
    try{ if(window.KT && window.KT.reload) window.KT.reload(); }catch(e){}
  }
}
try{ window.requestRender = requestRender; }catch(e){}
// ===== 自動クラウド同期(一人運用向け) =====
// 仕組み: データ保存のたびに少し待ってまとめて送信(デバウンス)。起動時は自動読込。
let _autoPushTimer = null;
let _autoPushInFlight = false;
let _autoPushPending = false;
let _autoPushStartedAt = 0;   // 送信ロックを取得した時刻(固まり検知用)
// スマホがバックグラウンドで送信を中断し、ロックが解除されないまま固まった場合の保険。
// 90秒以上ロックが続いていたら異常とみなして強制解除する。
function _clearStalePushLock(){
  if(_autoPushInFlight && _autoPushStartedAt && (Date.now() - _autoPushStartedAt > 90000)){
    _autoPushInFlight = false;
    _autoPushPending = false;
  }
}
 
function setSyncStatus(state, text){
  const el = document.getElementById('sync-status');
  if(!el) return;
  el.textContent = text;
  el.dataset.state = state;
  el.style.display = text ? 'inline-flex' : 'none';
}
 
// ===== 時刻ベースの自動同期(一人運用・複数端末でも復活しない) =====
// 仕組み: 保存のたびにローカル更新時刻を記録し、自動でクラウドへ送信(時刻も一緒に送る)。
// 起動時はクラウドを読み、クラウドの時刻が自分より新しいときだけ取り込む(古い物で上書きしない)。
const MTIME_KEY = 'pivot_local_mtime';
let _hasUnsavedChanges = false;
 
function touchLocalMtime(){
  const t = Date.now();
  try{ localStorage.setItem(MTIME_KEY, String(t)); }catch(e){}
  return t;
}
function getLocalMtime(){
  const v = parseInt(localStorage.getItem(MTIME_KEY) || '0', 10);
  return isNaN(v) ? 0 : v;
}
try{ window.__touchLocalMtime = touchLocalMtime; }catch(e){}
 
// 保存のたびに呼ばれる。更新時刻を進めて、少し待ってから自動送信。
function scheduleAutoPush(){
  const url = (typeof getCloudUrl === 'function') ? getCloudUrl() : '';
  if(!url) return;
  touchLocalMtime();             // この端末の更新が最新であることを記録
  _hasUnsavedChanges = true;
  setSyncStatus('saving', '⏳ 保存中…');
  if(_autoPushTimer) clearTimeout(_autoPushTimer);
  _autoPushTimer = setTimeout(doAutoPush, 1200);
}
try{ window.__scheduleAutoPush = scheduleAutoPush; }catch(e){}
 
// 重要な変更(契約の削除・追加など)で即時にクラウドへ送るための関数。
// デバウンス(1.2秒待ち)を挟まず、すぐに送信する。
function pushNow(){
  if(_autoPushTimer){ clearTimeout(_autoPushTimer); _autoPushTimer = null; }
  touchLocalMtime();
  _hasUnsavedChanges = true;
  setSyncStatus('saving', '⏳ 保存中…');
  doAutoPush();
}
try{ window.__pushNow = pushNow; }catch(e){}
 
// ===== 勤怠データの安全なマージ(複数端末で打刻が消えないように) =====
// 勤怠は { "2026-06-11":{in,out,...}, ... } の日付キー構造。
// クラウドとローカルを日付単位で統合する。同じ日付が両方にある場合は、
// 情報量が多い方(in/outが揃っている方)を残し、同点なら既存(ローカル=自分の打刻)を優先。
function mergeKintai(localK, cloudK){
  // 日付キーを "YYYY-MM-DD" に正規化(「Fri Jun 12 2026」形式や先頭'付きも統一)
  function pad2(n){ return String(n).padStart(2,"0"); }
  function normKeys(obj){
    const MON={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
    function one(k){
      let d=String(k).replace(/^'/, "").trim();
      if(/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      const m=d.match(/([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4})/);
      if(m && MON[m[1]]){ return m[3]+"-"+pad2(MON[m[1]])+"-"+pad2(parseInt(m[2],10)); }
      const p=new Date(d);
      if(!isNaN(p.getTime())){ return p.getFullYear()+"-"+pad2(p.getMonth()+1)+"-"+pad2(p.getDate()); }
      return d;
    }
    const out={};
    Object.keys(obj||{}).forEach(k=>{
      const d=one(k);
      if(out[d]){
        const sNew=Object.keys(obj[k]||{}).filter(x=>obj[k][x]!==""&&obj[k][x]!=null).length;
        const sOld=Object.keys(out[d]||{}).filter(x=>out[d][x]!==""&&out[d][x]!=null).length;
        if(sNew>sOld) out[d]=obj[k];
      } else { out[d]=obj[k]; }
    });
    return out;
  }
  const a = normKeys((localK && typeof localK==='object') ? localK : {});
  const b = normKeys((cloudK && typeof cloudK==='object') ? cloudK : {});
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  function score(rec){
    if(!rec || typeof rec!=='object') return -1;
    let s=0; for(const k in rec){ const v=rec[k]; if(v!==''&&v!=null) s++; } return s;
  }
  keys.forEach(day=>{
    const la=a[day], lb=b[day];
    if(la && !lb){ out[day]=la; }
    else if(!la && lb){ out[day]=lb; }
    else { out[day] = (score(lb) > score(la)) ? lb : la; }
  });
  return out;
}
// クラウド取込時に呼ぶ: ローカルとクラウドをマージして保存。消えない・上書きしない。
function applyCloudKintai(cloudKintai){
  let localKintai = {};
  try{ localKintai = JSON.parse(localStorage.getItem('pivot_kintai_v1')||'{}'); }catch(e){ localKintai = {}; }
  const merged = mergeKintai(localKintai, cloudKintai);
  try{
    localStorage.setItem('pivot_kintai_v1', JSON.stringify(merged));
    localStorage.setItem('pivot_kintai_v1_bak', JSON.stringify(merged));
  }catch(e){}
  try{
    const cloudKeys = cloudKintai && typeof cloudKintai==='object' ? Object.keys(cloudKintai).length : 0;
    if(Object.keys(merged).length > cloudKeys && typeof scheduleAutoPush==='function'){ scheduleAutoPush(); }
  }catch(e){}
  return merged;
}
try{ window.__mergeKintai = mergeKintai; window.__applyCloudKintai = applyCloudKintai; }catch(e){}
 
 
async function doAutoPush(){
  const url = (typeof getCloudUrl === 'function') ? getCloudUrl() : '';
  if(!url) return;
  _clearStalePushLock();   // 固まったロックがあれば解除
  if(_autoPushInFlight){ _autoPushPending = true; return; }
  _autoPushInFlight = true;
  _autoPushStartedAt = Date.now();
  setSyncStatus('saving', '☁️ 同期中…');
  try{
    const all = pbLoadAll();
    let contracts = {};
    try{ contracts = JSON.parse(localStorage.getItem(ctKey()) || '{}'); }catch(e){ contracts = {}; }
    let kintai = {};
    try{ kintai = JSON.parse(localStorage.getItem('pivot_kintai_v1') || '{}'); }catch(e){ kintai = {}; }
    let ownersData = [];
    try{ ownersData = JSON.parse(localStorage.getItem('rent_owner_send_owners_v1') || '[]'); }catch(e){ ownersData = []; }
    // ===== 安全装置: 手元の物件が空/極端に少ないのにクラウドに多数ある場合は上書きしない =====
    // (別端末の空データや読込前の状態で、クラウドの正しいデータを消す事故を防ぐ)
    const localCount = all && typeof all==='object' ? Object.keys(all).length : 0;
    const localContractCount = contracts && typeof contracts==='object' ? Object.keys(contracts).length : 0;
    try{
      const chk = await postToGas(url, { action:'load' });
      if(chk && chk.ok){
        const cloudAll = (chk.payload && chk.payload.buildings) ? chk.payload.buildings : {};
        const cloudCount = Object.keys(cloudAll).length;
        // クラウドに3件以上あるのに、手元がその半分未満 → 異常とみなして送信中止
        if(cloudCount >= 3 && localCount < cloudCount * 0.5){
          setSyncStatus('error', '⚠️ 安全のため同期を中止(データ保護)');
          alert('同期を安全のため中止しました。\n\nこの端末の物件数('+localCount+'件)が、クラウド('+cloudCount+'件)より大幅に少ないため、クラウドの正しいデータを誤って消さないよう保護しました。\n\nまずページを再読み込みして、クラウドから最新データを取り込んでください。');
          _autoPushInFlight = false;
          return;
        }
        // 契約の安全装置: 手元の契約がクラウドより大幅に少なければ上書きしない
        const cloudContracts = (chk.payload && chk.payload.contracts) ? chk.payload.contracts : {};
        const cloudContractCount = Object.keys(cloudContracts).length;
        if(cloudContractCount >= 3 && localContractCount < cloudContractCount * 0.5){
          setSyncStatus('error', '⚠️ 安全のため同期を中止(契約データ保護)');
          alert('同期を安全のため中止しました。\n\nこの端末の契約数('+localContractCount+'件)が、クラウド('+cloudContractCount+'件)より大幅に少ないため、クラウドの正しい契約データ(完了カードなど)を誤って消さないよう保護しました。\n\nまずページを再読み込みして、クラウドから最新データを取り込んでください。');
          _autoPushInFlight = false;
          return;
        }
      }
    }catch(e){ /* 確認に失敗しても通常の保存は続行 */ }
    const mtime = getLocalMtime() || touchLocalMtime();
    const r = await postToGas(url, { action:'save', payload:{ buildings: all, contracts: contracts, kintai: kintai, owners: ownersData, mtime: mtime } });
    if(r && r.ok){
      _hasUnsavedChanges = false;
      setSyncStatus('saved', '✅ 同期済み');
      setTimeout(() => { const e=document.getElementById('sync-status'); if(e && e.dataset.state==='saved') setSyncStatus('idle',''); }, 2000);
    } else {
      setSyncStatus('error', '⚠️ 同期失敗');
    }
  }catch(e){
    setSyncStatus('error', '⚠️ 同期失敗(通信)');
  }finally{
    _autoPushInFlight = false;
    if(_autoPushPending){ _autoPushPending = false; setTimeout(doAutoPush, 200); }
  }
}
 
// 起動時: クラウドを読み、クラウドの時刻が自分より新しいときだけ取り込む。
async function autoPullOnStart(){
  const url = (typeof getCloudUrl === 'function') ? getCloudUrl() : '';
  if(!url) return;
  if(_hasUnsavedChanges || _autoPushInFlight){ return; }
  // ===== 起動時の自動退避 =====
  // 取り込みで万一上書きされても戻せるよう、現在のローカルを緊急バックアップとして残す。
  try{
    const snap = {
      at: new Date().toISOString(),
      buildings: localStorage.getItem(pbKey()) || '{}',
      contracts: localStorage.getItem(ctKey()) || '{}',
      kintai: localStorage.getItem('pivot_kintai_v1') || '{}',
    };
    // 契約か物件が入っているときだけ退避（空を退避して上書きしない）
    const hasC = Object.keys(JSON.parse(snap.contracts)).length > 0;
    const hasB = Object.keys(JSON.parse(snap.buildings)).length > 0;
    if(hasC || hasB){ localStorage.setItem('pivot_emergency_backup', JSON.stringify(snap)); }
  }catch(e){ /* 退避失敗しても本処理は続行 */ }
  setSyncStatus('loading', '☁️ 確認中…');
  try{
    const r = await postToGas(url, { action:'load' });
    if(r && r.ok){
      if(_hasUnsavedChanges || _autoPushInFlight){ setSyncStatus('idle',''); return; }
      const payload = r.payload || {};
      const buildings = payload.buildings || {};
      const contracts = payload.contracts || {};
      const kintai = payload.kintai || {};
      const cloudMtime = parseInt(payload.mtime || '0', 10) || 0;
      const localMtime = getLocalMtime();
      // 判定: クラウドの方が新しい(または、ローカルにまだ時刻記録がない初回)なら取り込む。
      // 自分のローカルの方が新しい場合は取り込まない(自分の削除・編集を守る)。
      const localHasData = (Object.keys(pbLoadAll()).length > 0) ||
        (Object.keys((function(){try{return JSON.parse(localStorage.getItem(ctKey())||'{}');}catch(e){return {};}})()).length > 0) ||
        (Object.keys((function(){try{return JSON.parse(localStorage.getItem('pivot_kintai_v1')||'{}');}catch(e){return {};}})()).length > 0);
      const shouldPull = (!localHasData) || (cloudMtime > localMtime);
      if(shouldPull){
        // ===== 物件データ保護ガード（取り込み時）=====
        let localBuildings = {};
        try{ localBuildings = pbLoadAll() || {}; }catch(e){ localBuildings = {}; }
        const localBC = Object.keys(localBuildings).length;
        const cloudBC = Object.keys(buildings || {}).length;
        if(localBC >= 3 && cloudBC < localBC * 0.5){
          // クラウドの物件が異常に少ない → 物件は取り込まず手元を守り、手元をクラウドへ送る
          setSyncStatus('error', '⚠️ 物件データを保護しました');
          scheduleAutoPush();
        } else if(buildings && Object.keys(buildings).length >= 0){
        pbSaveRaw(buildings);
        }
        // ===== 契約データ保護ガード（取り込み時）=====
        // クラウドの契約がローカルより大幅に少ない/空なら、ローカルの契約を消さない。
        // (クラウド側が空・古い状態で起動したときに、手元の正しい契約を上書き消失する事故を防ぐ)
        let localContracts = {};
        try{ localContracts = JSON.parse(localStorage.getItem(ctKey()) || '{}'); }catch(e){ localContracts = {}; }
        const localCC = Object.keys(localContracts).length;
        const cloudCC = Object.keys(contracts || {}).length;
        if(localCC >= 3 && cloudCC < localCC * 0.5){
          // クラウド側が異常に少ない → 契約は取り込まず、手元を守る。手元をクラウドへ送って復旧。
          setSyncStatus('error', '⚠️ 契約データを保護しました');
          alert('クラウドの契約数('+cloudCC+'件)が、この端末('+localCC+'件)より大幅に少なかったため、\n手元の契約データを保護し、クラウドの内容では上書きしませんでした。\n\nこの端末の契約をクラウドへ送って復旧します。');
          scheduleAutoPush();
        } else {
          localStorage.setItem(ctKey(), JSON.stringify(contracts || {}));
        }
        {
          // 勤怠は上書きせず、ローカルとクラウドを日付単位でマージ(複数端末で消えない)
          applyCloudKintai(kintai);
        }
        if(typeof window.applyCloudOwners === 'function'){ window.applyCloudOwners(payload.owners); }
        if(cloudMtime) { try{ localStorage.setItem(MTIME_KEY, String(cloudMtime)); }catch(e){} }
        requestRender();
        // クラウド取り込み後に自動切替をチェック（起動時の1秒後では間に合わないため）
        try{ pbCall('runAutoSwitch', false); }catch(e){}
        setSyncStatus('saved', '✅ 最新です');
      } else {
        // ローカルが新しい → 取り込まず、こちらをクラウドへ送って揃える
        setSyncStatus('idle','');
        scheduleAutoPush();
      }
      setTimeout(() => { const e=document.getElementById('sync-status'); if(e && e.dataset.state==='saved') setSyncStatus('idle',''); }, 2000);
    } else {
      setSyncStatus('error', '⚠️ 取得失敗');
    }
  }catch(e){
    setSyncStatus('error', '⚠️ 取得失敗(通信)');
  }
}
// 起動時は自動で読み込まない。ログイン画面を出し、「ログイン」を押したときだけ最新を読み込む。
// ただしログイン記憶がある場合は、入力画面を出さずに自動でログイン状態に入る。
window.addEventListener('DOMContentLoaded', () => {
  (function(){
    try{
      if(_firebaseReady && firebase.auth){
        var _booted = false;
        firebase.auth().onAuthStateChanged(async function(user){
          if(_booted) return;
          if(user && user.email){
            // 自動入室の前に「1時間経過/日付変更」をチェック。期限切れなら再ログイン。
            if(isSessionExpired()){
              _booted = true;
              try{ firebase.auth().signOut(); }catch(e){}
              try{ localStorage.removeItem(LS_LASTSEEN); }catch(e){}
              showLoginScreen();
              return;
            }
            // ログイン記憶あり: 入力画面を出さずに自動入室
            _booted = true;
            try{ var ex = document.getElementById('pivot-login'); if(ex) ex.remove(); }catch(e){}
            try{ recordLoginHistory(user.email); }catch(e){}
            try{ _pivotCurrentUser = user.email; updateLoginUserLabel(); markActivity(); }catch(e){}
            showLocalFirst();     // 端末に残っている内容で、すぐ画面を出す
            backgroundPull();     // 最新はうしろで取り込む（待たない）
          } else {
            // 未ログイン: 通常どおりログイン画面を表示
            _booted = true;
            showLoginScreen();
          }
        });
        // 認証状態の確認が遅い場合の保険(2秒後にまだ判定が来なければ画面表示)
        setTimeout(function(){ if(!_booted){ _booted = true; showLoginScreen(); } }, 2000);
      } else {
        showLoginScreen();
      }
    }catch(e){ showLoginScreen(); }
  })();
});
window.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden'){
    if(_autoPushTimer){ clearTimeout(_autoPushTimer); _autoPushTimer = null; }
    if(_hasUnsavedChanges){ doAutoPush(); }
  }
});
 
// ============================================================
// ★★★ ログイン認証について ★★★
//
// ログインは Firebase Authentication(メール+パスワード)で行います。
// ログインできる人の追加・削除は、コードではなく
// Firebaseコンソールの Authentication →「ユーザー」タブで行います。
//   ・追加: 「ユーザーを追加」でメールアドレスと仮パスワードを登録
//   ・退職者の締め出し: その人の行の「⋮」→「ユーザーを削除」(または無効化)
//
// 下の LOGIN_ACCOUNTS は旧・簡易ログインの名残で、現在は使用していません
// (将来の参照エラーを避けるため、空配列として残しています)。
// ============================================================
const LOGIN_ACCOUNTS = [];
// ============================================================
 
// 現在ログイン中のユーザーID
let _pivotCurrentUser = '';
 
// ログアウトボタンの表示・非表示を更新(ログイン中はボタンを出す)
function updateLoginUserLabel(){
  const logoutWrap = document.getElementById('logout-wrap');
  if(_pivotCurrentUser){
    if(logoutWrap){ logoutWrap.style.display = 'inline-block'; }
  } else {
    if(logoutWrap){ logoutWrap.style.display = 'none'; }
  }
}
 
// ログアウト: ログイン中表示を消して、ログイン画面に戻す
function pivotLogout(){
  if(!confirm('ログアウトしますか？\nもう一度メールアドレス・パスワードの入力が必要になります。')) return;
  _pivotCurrentUser = '';
  updateLoginUserLabel();
  // Firebaseからもサインアウト
  try{ if(_firebaseReady && firebase.auth){ firebase.auth().signOut(); } }catch(e){}
  // ログイン画面を再表示
  if(typeof showLoginScreen === 'function'){ showLoginScreen(); }
}
try{ window.pivotLogout = pivotLogout; }catch(e){}
 
// ===== 自動ログアウト(1時間操作なし / 日付が変わったら 再ログイン) =====
const LS_LASTSEEN = 'pivot_lastseen_v1';
const IDLE_LIMIT_MS = 60 * 60 * 1000;  // 1時間
 
// 最終操作時刻と日付を記録
function markActivity(){
  try{
    localStorage.setItem(LS_LASTSEEN, JSON.stringify({ t: Date.now(), d: new Date().toDateString() }));
  }catch(e){}
}
 
// 「1時間経過」または「日付が変わった」を判定
function isSessionExpired(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_LASTSEEN) || 'null');
    if(!s) return false;
    const now = Date.now(), today = new Date().toDateString();
    if(now - s.t > IDLE_LIMIT_MS) return true;
    if(s.d && s.d !== today) return true;
  }catch(e){}
  return false;
}
 
// 期限切れならログアウトしてログイン画面へ
function checkAutoLogout(){
  if(!_pivotCurrentUser) return;          // 未ログインなら何もしない
  if(isSessionExpired()){
    _pivotCurrentUser = '';
    try{ updateLoginUserLabel(); }catch(e){}
    try{ if(_firebaseReady && firebase.auth){ firebase.auth().signOut(); } }catch(e){}
    try{ localStorage.removeItem(LS_LASTSEEN); }catch(e){}
    if(typeof showLoginScreen === 'function'){ showLoginScreen(); }
  }
}
 
// 操作のたびに最終操作時刻を更新(ログイン中のみ)
['click','keydown','scroll','touchstart','mousemove'].forEach(function(ev){
  try{ document.addEventListener(ev, function(){ if(_pivotCurrentUser) markActivity(); }, { passive:true }); }catch(e){}
});
// 1分ごと、およびタブに戻ったときに期限をチェック
try{ setInterval(checkAutoLogout, 60 * 1000); }catch(e){}
try{ document.addEventListener('visibilitychange', function(){ if(!document.hidden) checkAutoLogout(); }); }catch(e){}
 
// ===== ログイン履歴(GASスプレッドシートに記録) =====
// ログイン成功時に「誰が・いつ」をクラウドに1行追記する。
// 失敗してもログイン自体は妨げない(履歴は補助機能のため)。
async function recordLoginHistory(email){
  try{
    const url = (typeof getCloudUrl === 'function') ? getCloudUrl() : '';
    if(!url) return;
    await postToGas(url, {
      action: 'logLogin',
      email: email || '',
      at: new Date().toISOString(),
      ua: (navigator && navigator.userAgent) ? navigator.userAgent.slice(0, 200) : ''
    }, 15000);
  }catch(e){ /* 履歴記録の失敗は無視 */ }
}
 
// クラウドからログイン履歴を取得して返す(配列)。新しい順。
async function fetchLoginHistory(limit){
  const url = (typeof getCloudUrl === 'function') ? getCloudUrl() : '';
  if(!url) throw new Error('クラウドURLが未設定です');
  const r = await postToGas(url, { action:'getLoginHistory', limit: (limit||200) }, 20000);
  if(!(r && r.ok)) throw new Error((r && r.message) || '履歴取得に失敗しました');
  return Array.isArray(r.history) ? r.history : [];
}
try{ window.fetchLoginHistory = fetchLoginHistory; }catch(e){}
 
// ログイン履歴モーダルを開いて、履歴を読み込んで表示する
async function openLoginHistory(){
  const modal = document.getElementById('login-history-modal');
  const body = document.getElementById('login-history-body');
  if(!modal || !body) return;
  modal.classList.add('active');
  body.innerHTML = '<div style="color:#666;">読み込み中...</div>';
  try{
    const list = await fetchLoginHistory(300);
    if(!list.length){
      body.innerHTML = '<div style="color:#888;">まだログイン履歴がありません。</div>';
      return;
    }
    // 日時を見やすく整形
    const fmt = (iso) => {
      try{
        const d = new Date(iso);
        if(isNaN(d.getTime())) return iso || '';
        const p = (n) => String(n).padStart(2,'0');
        return d.getFullYear() + '/' + p(d.getMonth()+1) + '/' + p(d.getDate()) +
               ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
      }catch(e){ return iso || ''; }
    };
    let html = '<table style="width:100%;border-collapse:collapse;">';
    html += '<thead><tr style="border-bottom:2px solid #ddd;text-align:left;">' +
            '<th style="padding:8px 6px;white-space:nowrap;">日時</th>' +
            '<th style="padding:8px 6px;">メールアドレス</th></tr></thead><tbody>';
    list.forEach((row) => {
      const at = fmt(row.at || row.time || '');
      const email = (row.email || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      html += '<tr style="border-bottom:1px solid #eee;">' +
              '<td style="padding:8px 6px;white-space:nowrap;color:#444;">' + at + '</td>' +
              '<td style="padding:8px 6px;">' + email + '</td></tr>';
    });
    html += '</tbody></table>';
    body.innerHTML = html;
  }catch(e){
    body.innerHTML = '<div style="color:#d33;">履歴の取得に失敗しました。<br>' +
      (e && e.message ? e.message : '') +
      '<br><br>GAS側に履歴記録の処理が追加されているか確認してください。</div>';
  }
}
function closeLoginHistory(){
  const modal = document.getElementById('login-history-modal');
  if(modal){ modal.classList.remove('active'); }
}
try{ window.openLoginHistory = openLoginHistory; window.closeLoginHistory = closeLoginHistory; }catch(e){}
 
// ===== ログイン画面(=クラウドから最新を読み込ませる強制ステップ) =====
function showLoginScreen(){
  const url = (typeof getCloudUrl === 'function') ? getCloudUrl() : '';
  // クラウド未設定なら、ログインせずそのまま使う(ローカルのみ運用)
  if(!url){ return; }
  if(document.getElementById('pivot-login')) return;
  const ov = document.createElement('div');
  ov.id = 'pivot-login';
  ov.style.cssText = 'position:fixed;inset:0;z-index:200000;display:flex;align-items:center;justify-content:center;background:#f5f5f7;';
  ov.innerHTML =
    '<div style="text-align:center;padding:40px 32px;max-width:340px;width:90%;">' +
      '<div style="font-size:46px;font-weight:900;letter-spacing:2px;color:#111;margin-bottom:6px;">PIVOT2</div>' +
      '<div style="font-size:13px;color:#888;margin-bottom:28px;">物件・契約 管理</div>' +
      '<form id="pivot-login-form" autocomplete="on" style="margin:0;">' +
        '<input id="pivot-login-id" name="username" type="email" autocomplete="username" placeholder="メールアドレス" style="width:100%;padding:13px 14px;border:1.5px solid #d8d8dc;border-radius:12px;font-size:15px;margin-bottom:10px;font-family:inherit;box-sizing:border-box;">' +
        '<input id="pivot-login-pass" name="current-password" type="password" autocomplete="current-password" placeholder="パスワード" style="width:100%;padding:13px 14px;border:1.5px solid #d8d8dc;border-radius:12px;font-size:15px;margin-bottom:18px;font-family:inherit;box-sizing:border-box;">' +
        '<button id="pivot-login-btn" type="submit" style="width:100%;padding:16px;border:none;border-radius:14px;background:#111;color:#fff;font-size:17px;font-weight:800;cursor:pointer;font-family:inherit;">ログイン</button>' +
      '</form>' +
      '<div id="pivot-login-msg" style="font-size:12px;color:#999;margin-top:16px;min-height:18px;"></div>' +
      '<div style="margin-top:14px;"><a id="pivot-login-reset" href="#" style="font-size:12px;color:#3367d6;text-decoration:none;">パスワードを忘れた方はこちら</a></div>' +
    '</div>';
  document.body.appendChild(ov);
  const msg = ov.querySelector('#pivot-login-msg');
  const btn = ov.querySelector('#pivot-login-btn');
  const idInput = ov.querySelector('#pivot-login-id');
  const passInput = ov.querySelector('#pivot-login-pass');
  const resetLink = ov.querySelector('#pivot-login-reset');
 
  // Firebaseが読み込めていない場合の保険
  if(!_firebaseReady || typeof firebase === 'undefined' || !firebase.auth){
    msg.style.color = '#d33';
    msg.textContent = '認証システムの読み込みに失敗しました。通信環境を確認し、ページを再読み込みしてください。';
    btn.disabled = true; btn.style.opacity = '0.6';
    return;
  }
 
  // Firebaseのエラーコードを日本語の分かりやすい文に変換
  const firebaseErrText = (code) => {
    switch(code){
      case 'auth/invalid-email': return 'メールアドレスの形式が正しくありません。';
      case 'auth/user-disabled': return 'このアカウントは無効化されています。管理者にお問い合わせください。';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': return 'メールアドレスまたはパスワードが正しくありません。';
      case 'auth/too-many-requests': return '試行回数が多すぎます。しばらく待ってから、もう一度お試しください。';
      case 'auth/network-request-failed': return '通信に失敗しました。ネット接続を確認してください。';
      default: return 'ログインに失敗しました。(' + code + ')';
    }
  };
 
  const doLogin = async () => {
    const email = (idInput.value || '').trim();
    const pass = passInput.value || '';
    if(!email || !pass){
      msg.style.color = '#d33';
      msg.textContent = 'メールアドレスとパスワードを入力してください。';
      return;
    }
    msg.style.color = '#999';
    btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = '確認中…';
    msg.textContent = 'ログインを確認しています…';
    try{
      // ログイン記憶: 一度ログインすれば次回以降は入力不要(この端末・このブラウザで保持)
      try{ await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){}
      // Firebaseでメール+パスワード認証
      const cred = await firebase.auth().signInWithEmailAndPassword(email, pass);
      const loggedInEmail = (cred && cred.user && cred.user.email) ? cred.user.email : email;
      // ログイン履歴を記録(失敗してもログインは続行)
      try{ recordLoginHistory(loggedInEmail); }catch(e){}
      try{ _pivotCurrentUser = loggedInEmail; updateLoginUserLabel(); markActivity(); }catch(e){}
      ov.remove();          // 待たずに画面を開く
      showLocalFirst();     // 端末に残っている内容をすぐ表示
      backgroundPull();     // 最新はうしろで取り込む
    }catch(e){
      const code = (e && e.code) ? e.code : '';
      if(code){
        msg.style.color = '#d33';
        msg.textContent = firebaseErrText(code);
      } else {
        msg.style.color = '#d33';
        msg.textContent = 'データ取得に失敗しました。通信を確認して、もう一度お試しください。';
      }
      btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'ログイン';
    }
  };
 
  // パスワード再設定メールの送信
  const doReset = async () => {
    const email = (idInput.value || '').trim();
    if(!email){
      msg.style.color = '#d33';
      msg.textContent = '上のメールアドレス欄に、登録済みのアドレスを入力してから押してください。';
      idInput.focus();
      return;
    }
    if(!confirm(email + ' 宛に、パスワード再設定メールを送ります。よろしいですか？')) return;
    msg.style.color = '#999';
    msg.textContent = 'メールを送信しています…';
    try{
      await firebase.auth().sendPasswordResetEmail(email);
      msg.style.color = '#2a8a3e';
      msg.textContent = '再設定メールを送りました。受信トレイ(迷惑メールも)をご確認ください。';
    }catch(e){
      const code = (e && e.code) ? e.code : '';
      msg.style.color = '#d33';
      msg.textContent = firebaseErrText(code);
    }
  };
 
  const loginForm = ov.querySelector('#pivot-login-form');
  if(loginForm){
    loginForm.addEventListener('submit', (e) => { e.preventDefault(); doLogin(); });
  } else {
    btn.onclick = doLogin;
  }
  resetLink.onclick = (e) => { e.preventDefault(); doReset(); };
  // パスワード欄でEnterキーでもログイン
  passInput.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ doLogin(); } });
  idInput.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ passInput.focus(); } });
}
 
// ログイン時のクラウド読込(クラウドのデータでローカルを置き換える)
/* まず端末に残っている内容で画面を出し、最新はうしろで取り込む。
   毎回クラウドの返事を待ってから画面を出していたため、開くのに時間がかかっていた。 */
function showLocalFirst(){
  requestRender();
}
/* うしろで最新を取り込む。取り込み中に編集していたら、その内容を消さない。 */
function backgroundPull(){
  try{ setSyncStatus('loading', '☁️ 最新を確認中…'); }catch(e){}
  return loginPull({ keepLocalEdits:true }).catch(function(){
    try{ setSyncStatus('error', '⚠️ 最新の取り込みに失敗（端末の内容を表示中）'); }catch(e){}
  });
}
 
async function loginPull(opt){
  const url = (typeof getCloudUrl === 'function') ? getCloudUrl() : '';
  if(!url) return;
  const r = await postToGas(url, { action:'load' });
  if(!(r && r.ok)) throw new Error('load failed');
  const payload = r.payload || {};
  const buildings = payload.buildings || {};
  const contracts = payload.contracts || {};
  // うしろで取り込んでいる間に編集していたら、その内容を消さずに送信側へ回す
  if(opt && opt.keepLocalEdits && (_hasUnsavedChanges || _autoPushInFlight)){
    try{ setSyncStatus('idle',''); }catch(e){}
    try{ if(typeof pushNow === 'function') pushNow(); }catch(e){}
    return;
  }
  pbSaveRaw(buildings);
  localStorage.setItem(ctKey(), JSON.stringify(contracts));
  // 勤怠: クラウドが勤怠を保持していない(キー無し or 空)場合は、ローカルの勤怠を消さずに守る。
  // (クラウド側がまだ勤怠フィールドに未対応でも、この端末の打刻を失わないため)
  {
    // 勤怠は上書きせず、ローカルとクラウドを日付単位でマージ(複数端末で消えない)
    applyCloudKintai(payload.kintai);
  }
  if(typeof window.applyCloudOwners === 'function'){ window.applyCloudOwners(payload.owners); }
  const cloudMtime = parseInt(payload.mtime || '0', 10) || Date.now();
  try{ localStorage.setItem(MTIME_KEY, String(cloudMtime)); }catch(e){}
  _hasUnsavedChanges = false;
  requestRender();
  // クラウド取り込み後に自動切替をチェック（起動時の1秒後では間に合わないため）
  try{ pbCall('runAutoSwitch', false); }catch(e){}
  setSyncStatus('saved', '✅ ログイン済み(最新)');
  setTimeout(() => { const e=document.getElementById('sync-status'); if(e && e.dataset.state==='saved') setSyncStatus('idle',''); }, 2500);
}
 
// タブ・ロゴから呼ぶ「最新を取り込む」関数。
// 時刻判定をせず、必ずクラウドの内容で画面を更新する(クラウドが更新時刻を返さない環境でも確実に反映)。
// ただし未保存の変更があるときは、上書きで消えないよう確認してから取り込む。
async function forcePullLatest(){
  const url = (typeof getCloudUrl === 'function') ? getCloudUrl() : '';
  if(!url) return;
  _clearStalePushLock();   // 固まったロックがあれば解除(ロゴ取り込みが詰まらないように)
  // 未保存の変更があれば、確認を出さずに、まず保存(送信)を済ませてから最新を取り込む。
  // (自動保存される仕組みなので、いちいち確認は出さない)
  if(_hasUnsavedChanges || _autoPushInFlight){
    try{ if(typeof pushNow === 'function'){ pushNow(); } }catch(e){}
    // 送信完了を少し待つ(最大3秒)
    for(let i=0; i<15 && (_hasUnsavedChanges || _autoPushInFlight); i++){
      await new Promise(r=>setTimeout(r, 200));
    }
  }
  setSyncStatus('loading', '☁️ 確認中…');
  try{
    const r = await postToGas(url, { action:'load' });
    if(r && r.ok){
      const payload = r.payload || {};
      const buildings = payload.buildings || {};
      const contracts = payload.contracts || {};
      pbSaveRaw(buildings);
      localStorage.setItem(ctKey(), JSON.stringify(contracts || {}));
      {
        // 勤怠は上書きせず、ローカルとクラウドを日付単位でマージ(複数端末で消えない)
        applyCloudKintai(payload.kintai);
      }
      if(typeof window.applyCloudOwners === 'function'){ window.applyCloudOwners(payload.owners); }
      const cloudMtime = parseInt(payload.mtime || '0', 10) || Date.now();
      try{ localStorage.setItem(MTIME_KEY, String(cloudMtime)); }catch(e){}
      _hasUnsavedChanges = false;
      requestRender();
      setSyncStatus('saved', '✅ 最新です');
      setTimeout(() => { const e=document.getElementById('sync-status'); if(e && e.dataset.state==='saved') setSyncStatus('idle',''); }, 2000);
    } else {
      setSyncStatus('error', '⚠️ 取得失敗');
    }
  }catch(e){
    setSyncStatus('error', '⚠️ 取得失敗(通信)');
  }
}
try{ window.forcePullLatest = forcePullLatest; }catch(e){}
 
function genId(){
  return 'bld_' + Date.now() + '_' + Math.floor(Math.random()*1000);
}
 
/* ==================================================================
 * CORE 2 / 会社情報・設定・GAS 通信レイヤ・起動処理
 * ================================================================== */
 
// ==============================
// 会社情報の管理(localStorage + クラウド同期)
// ==============================
const COMPANY_INFO_KEY = 'pivot_company_info';
 
function getCompanyInfo(){
  try {
    const raw = localStorage.getItem(COMPANY_INFO_KEY);
    if(!raw) return getDefaultCompanyInfo();
    const info = JSON.parse(raw);
    // 不足項目を補完
    return Object.assign(getDefaultCompanyInfo(), info);
  } catch(e){
    return getDefaultCompanyInfo();
  }
}
 
function getDefaultCompanyInfo(){
  // 初期値(過去PIVOTの情報)
  return {
    name: 'IREライフ株式会社',
    zip: '721-0963',
    addr: '広島県福山市南手城町2丁目15-6',
    rep_title: '代表取締役',
    rep_name: '淺野 充弘',
    tel: '',
    fax: '',
    mail: '',
    invoice_no: ''
  };
}
 
function saveCompanyInfo(info){
  try {
    localStorage.setItem(COMPANY_INFO_KEY, JSON.stringify(info));
    return true;
  } catch(e){
    alert('会社情報の保存に失敗しました: ' + e.message);
    return false;
  }
}
 
// 設定メニュー(歯車)の開閉
function toggleSettingsMenu(e){
  if(e){ e.stopPropagation(); }
  const m = document.getElementById('settings-menu');
  if(m) m.classList.toggle('open');
}
function closeSettingsMenu(){
  const m = document.getElementById('settings-menu');
  if(m) m.classList.remove('open');
}
// メニュー外クリックで閉じる
document.addEventListener('click', function(e){
  const wrap = e.target.closest && e.target.closest('.settings-wrap');
  if(!wrap){ closeSettingsMenu(); }
});
 
// 会社情報モーダル: 開く
function openCompanyModal(){
  const info = getCompanyInfo();
  document.getElementById('cmp-name').value = info.name || '';
  document.getElementById('cmp-zip').value = info.zip || '';
  document.getElementById('cmp-addr').value = info.addr || '';
  document.getElementById('cmp-rep-title').value = info.rep_title || '';
  document.getElementById('cmp-rep-name').value = info.rep_name || '';
  document.getElementById('cmp-tel').value = info.tel || '';
  document.getElementById('cmp-fax').value = info.fax || '';
  document.getElementById('cmp-mail').value = info.mail || '';
  document.getElementById('cmp-invoice').value = info.invoice_no || '';
  document.getElementById('company-modal').classList.add('active');
}
 
function closeCompanyModal(){
  document.getElementById('company-modal').classList.remove('active');
}
 
function saveCompany(){
  const name = document.getElementById('cmp-name').value.trim();
  const addr = document.getElementById('cmp-addr').value.trim();
  if(!name){
    alert('会社名は必須です');
    return;
  }
  if(!addr){
    alert('住所は必須です');
    return;
  }
  const info = {
    name: name,
    zip: document.getElementById('cmp-zip').value.trim(),
    addr: addr,
    rep_title: document.getElementById('cmp-rep-title').value.trim(),
    rep_name: document.getElementById('cmp-rep-name').value.trim(),
    tel: document.getElementById('cmp-tel').value.trim(),
    fax: document.getElementById('cmp-fax').value.trim(),
    mail: document.getElementById('cmp-mail').value.trim(),
    invoice_no: document.getElementById('cmp-invoice').value.trim()
  };
  if(saveCompanyInfo(info)){
    document.dispatchEvent(new CustomEvent('pivot:toast', { detail: '✅ 会社情報を保存しました' }));
    closeCompanyModal();
  }
}
 
// ==============================
// クラウド同期(Google Apps Script 連携)
// ==============================
const CLOUD_URL_KEY = 'pivot_cloud_url';
 
function getCloudUrl(){
  return (localStorage.getItem(CLOUD_URL_KEY) || '').trim();
}
function setCloudUrl(url){
  localStorage.setItem(CLOUD_URL_KEY, (url||'').trim());
}
 
function openCloudModal(){
  document.getElementById('cloud-url').value = getCloudUrl();
  document.getElementById('cloud-log').style.display = 'none';
  document.getElementById('cloud-log').textContent = '';
  document.getElementById('cloud-modal').classList.add('active');
}
function closeCloudModal(){
  // 入力中のURLを保存
  const _el = document.getElementById('cloud-url');
  const url = (_el && _el.value.trim()) ? _el.value.trim() : getCloudUrl();
  setCloudUrl(url);
  document.getElementById('cloud-modal').classList.remove('active');
}
 
// ログ表示エリアに追記
function cloudLog(msg, type){
  const logEl = document.getElementById('cloud-log');
  logEl.style.display = 'block';
  const ts = new Date().toLocaleTimeString('ja-JP');
  const prefix = type === 'error' ? '❌ ' : (type === 'success' ? '✅ ' : '• ');
  logEl.textContent += '[' + ts + '] ' + prefix + msg + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}
 
// GASにPOST送信
async function postToGas(url, body, timeoutMs){
  // text/plain で送信(CORS preflight 回避)
  const ctrl = new AbortController();
  const ms = (typeof timeoutMs === 'number' && timeoutMs > 0) ? timeoutMs : 60000;
  const timer = setTimeout(() => ctrl.abort(), ms);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: ctrl.signal
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new Error('タイムアウト(' + Math.round(ms/1000) + '秒以内に応答なし)');
    }
    throw new Error('通信エラー: ' + e.message);
  }
  clearTimeout(timer);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('GASからの応答が不正: ' + text.slice(0, 200));
  }
}
 
// ===== 機能別の独立保存(まとめ送信とは別に、各機能を単独でクラウドへ保存) =====
// feature: 'buildings' | 'contracts' | 'owners'
// 既存のまとめ送信(doAutoPush)はそのまま残し、これは「巻き添え防止の補助経路」として併用する。
// 失敗しても握りつぶす(本線はまとめ送信なので、補助が落ちても全体は壊さない)。
async function pushFeatureToCloud(feature){
  try{
    // 保存済みのURLを使う。設定画面を開いていなくても動くようにする。
    const url = getCloudUrl();
    if(!url) return;
    let action = '', payload = {};
    if(feature === 'buildings'){
      let blds = {};
      try{ blds = JSON.parse(localStorage.getItem(pbKey()) || '{}'); }catch(e){ blds = {}; }
      // 物件0件は送らない(誤って空で上書きしないため。GAS側にも安全装置あり)
      if(!blds || Object.keys(blds).length === 0) return;
      action = 'saveBuildings';
      payload = { buildings: blds };
    } else if(feature === 'contracts'){
      let cts = {};
      try{ cts = JSON.parse(localStorage.getItem(ctKey()) || '{}'); }catch(e){ cts = {}; }
      action = 'saveContractsOnly';
      payload = { contracts: cts };
    } else if(feature === 'owners'){
      let ow = [];
      try{ ow = JSON.parse(localStorage.getItem('rent_owner_send_owners_v1') || '[]'); }catch(e){ ow = []; }
      action = 'saveOwnersOnly';
      payload = { owners: ow };
    } else {
      return;
    }
    await postToGas(url, { action: action, payload: payload }, 30000);
  }catch(e){
    // 補助経路なのでエラーは握りつぶす(本線のまとめ送信が別途走る)
    if(typeof console !== 'undefined') console.warn('pushFeatureToCloud(' + feature + ') skipped:', e && e.message);
  }
}
if(typeof window !== 'undefined'){ window.pushFeatureToCloud = pushFeatureToCloud; }
 
// 接続テスト
async function testCloudPing(){
  const _el = document.getElementById('cloud-url');
  const url = (_el && _el.value.trim()) ? _el.value.trim() : getCloudUrl();
  if(!url){
    cloudLog('GAS URL を入力してください', 'error');
    return;
  }
  setCloudUrl(url);
  cloudLog('接続テスト開始...');
  try {
    const r = await postToGas(url, { action: 'ping' });
    if(r.ok){
      cloudLog('GAS接続成功 (' + (r.version || 'v?') + ')', 'success');
    } else {
      cloudLog('GAS応答エラー: ' + (r.message || '不明'), 'error');
    }
  } catch(e){
    cloudLog('通信エラー: ' + e.message, 'error');
    cloudLog('  → URLが正しいか、GASのデプロイが「全員」になっているか確認', 'error');
  }
}
 
// クラウドへ全データを送信
async function cloudSaveAll(){
  const _el = document.getElementById('cloud-url');
  const url = (_el && _el.value.trim()) ? _el.value.trim() : getCloudUrl();
  if(!url){
    cloudLog('GAS URL を入力してください', 'error');
    return;
  }
  setCloudUrl(url);
 
  const all = pbLoadAll();
  const bldCount = Object.keys(all).length;
  if(bldCount === 0){
    if(!confirm('現在ローカルに物件データがありません。\n空のデータをクラウドに送信しますか?\n(クラウドのデータが上書きされます)')){
      return;
    }
  } else {
    if(!confirm('現在の全データ('+bldCount+'物件)をクラウドに送信します。\n\n※ クラウド側の現在データはバックアップシートに退避された上で上書きされます。\n\nよろしいですか?')){
      return;
    }
  }
 
  // ボタン無効化
  const btn = document.getElementById('cloud-upload-btn');
  if(btn) btn.disabled = true;
  cloudLog('送信中... ('+bldCount+'物件)');
 
  try {
    const r = await postToGas(url, { action: 'save', payload: { buildings: all } });
    if(r.ok){
      cloudLog('送信成功: 物件 '+r.buildingCount+'件 / 区画 '+r.spotCount+'件', 'success');
      cloudLog('  → スプレッドシートを確認してください', 'success');
      document.dispatchEvent(new CustomEvent('pivot:toast', { detail: '☁ クラウドへ送信完了' }));
    } else {
      cloudLog('送信失敗: ' + (r.message || '不明'), 'error');
    }
  } catch(e){
    cloudLog('通信エラー: ' + e.message, 'error');
  } finally {
    if(btn) btn.disabled = false;
  }
}
 
// クラウドから全データを読込
async function cloudLoadAll(){
  const _el = document.getElementById('cloud-url');
  const url = (_el && _el.value.trim()) ? _el.value.trim() : getCloudUrl();
  if(!url){
    cloudLog('GAS URL を入力してください', 'error');
    return;
  }
  setCloudUrl(url);
 
  if(!confirm('クラウドからデータを読み込みます。\n\n⚠️ 現在のローカルデータは上書きされます。\n(クラウドが空でも上書きされます)\n\nよろしいですか?')){
    return;
  }
 
  const btn = document.getElementById('cloud-download-btn');
  if(btn) btn.disabled = true;
  cloudLog('クラウドから読込中...');
 
  try {
    const r = await postToGas(url, { action: 'load' });
    if(r.ok){
      const payload = r.payload || {};
      const buildings = payload.buildings || {};
      document.dispatchEvent(new CustomEvent('pivot:save-buildings', { detail: buildings }));
      cloudLog('読込成功: 物件 '+(r.buildingCount||0)+'件', 'success');
      document.dispatchEvent(new CustomEvent('pivot:toast', { detail: '☁ クラウドから読込完了' }));
      requestRender('buildings');
    } else {
      cloudLog('読込失敗: ' + (r.message || '不明'), 'error');
    }
  } catch(e){
    cloudLog('通信エラー: ' + e.message, 'error');
  } finally {
    if(btn) btn.disabled = false;
  }
}
 
// ==============================
// 初期化
// ==============================
window.addEventListener('DOMContentLoaded', () => {
  // GAS URL の初期値(未設定時のみ)
  if(!getCloudUrl()){
  setCloudUrl('https://script.google.com/macros/s/AKfycbxJQZwtUy1gMVBxszZjkgSQVg-yy6xbDrAct1fRzvglDoEC1_1qMN27jL394XvOVnXdZQ/exec');
  }
  requestRender('buildings');
  console.log('[PIVOT Simple v8.5] 起動完了');
 
  // ブラウザが画像/PDFを開いてしまうのを防ぐ(ドロップ領域外に落とした場合)
  ['dragover','drop'].forEach(ev => {
    window.addEventListener(ev, (e) => {
      // ドロップ領域内なら各ハンドラに任せる
      const inZone = e.target.closest && e.target.closest('#layout-area, #photos-area');
      if(!inZone){ e.preventDefault(); }
    }, false);
  });
 
  // 配置図/写真エリアに確実な D&D リスナーを付与(onattr が効かない環境の保険)
  const bindDrop = (el, dropFn) => {
    if(!el) return;
    el.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('img-drag-over'); });
    el.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('img-drag-over'); });
    el.addEventListener('dragleave', (e) => {
      e.preventDefault(); e.stopPropagation();
      if(el.contains(e.relatedTarget)) return;
      el.classList.remove('img-drag-over');
    });
    el.addEventListener('drop', (e) => { dropFn(e); });
  };
  bindDrop(document.getElementById('layout-area'), (e)=>pbCall('onLayoutDrop', e));
  bindDrop(document.getElementById('photos-area'), (e)=>pbCall('onPhotosDrop', e));
 
  // 起動から少し遅らせて自動切替チェック(画面表示が落ち着いてから)
  setTimeout(() => {
    pbCall('runAutoSwitch', false);
  }, 1000);
  // 一覧の全画像を裏で先読み(端末キャッシュを温めておく)
  setTimeout(() => {
    pbCall('prefetchAllImages');
  }, 1500);
});
 
/* ==================================================================
 * CORE 3 / タブ切替
 * ================================================================== */
 
function switchApp(which){
  document.body.classList.toggle('tab-kanban', which==='kanban');
  document.body.classList.toggle('tab-rent', which==='rent');
  document.getElementById('tab-pivot').classList.toggle('active', which==='pivot');
  document.getElementById('tab-kanban').classList.toggle('active', which==='kanban');
  document.getElementById('tab-rent').classList.toggle('active', which==='rent');
  if(which==='kanban'){ requestRender('kanban'); }
  if(which==='rent' && window.RENT && window.RENT.activate){ try{ window.RENT.activate(); }catch(e){} }
  // 注意: タブ切替ではクラウドからの取り込み(上書き)を行わない。
  // (取り込むと、入力直後・送信前のデータが古いクラウド内容で上書きされ「消えた・戻った」が起きるため)
  // 未送信の変更があれば送信だけ行う(取り込みはしない)。
  try{ if(typeof window.__pushNow === 'function'){ window.__pushNow(); } }catch(e){}
}
