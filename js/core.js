/* ---- インスタンス識別子。URLのパス名から自動決定する。
       /pivot2/ → "pivot2_"、/pivot3/ → "pivot3_"。
       コピーして別フォルダに置くだけでデータ領域が分かれる。 ---- */
function insPrefix(){
  try{
    var seg = (location.pathname || '').split('/').filter(function(s){ return s; });
    var name = seg.length ? seg[seg.length - 1] : '';
    if(/\.html?$/i.test(name)) name = seg.length > 1 ? seg[seg.length - 2] : '';
    return name ? (name + '_') : 'pivot_';
  }catch(e){ return 'pivot_'; }
}
try{ window.insPrefix = insPrefix; }catch(e){}
/* ==================================================================
 * CORE 1 / クラウド同期エンジン (mtime ベースの push / pull)
 * ================================================================== */
 
// 画面の再描画を依頼する唯一の窓口。
// core から buildings/KB/KT を直接呼ばないための集約点。
/* ---- buildings.js の保存領域への窓口。core から直接触らないための集約点 ---- */
function pbKey(){ return insPrefix() + 'blds'; }
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
function ctKey(){ return insPrefix() + 'contract_kanban_v2'; }
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
const MTIME_KEY = insPrefix() + 'local_mtime';
let _hasUnsavedChanges = false;

/* ==================================================================
 * pv-sync-guard 2026-08-31
 *   古い内容を持った端末が、正しいクラウドを何度でも古い状態へ
 *   戻してしまう事故を止めるための仕組み。
 *
 *   ❶ 前回そろえた時点の物件一覧を覚えておく（last_sync_bld_ids）
 *   ❷ 送信前に「クラウドにあって、手元に無い物件」を調べる
 *      ・前回そろえた時点で手元にあった物件 → その人が消したので、通す
 *      ・一度も手元に無かった物件           → 取りこぼし。送信を中止する
 *   ❸ 取り込みを保護したときに、手元の内容を自動で送り返さない
 * ================================================================== */
const SYNCIDS_KEY = insPrefix() + 'last_sync_bld_ids';
function saveSyncIds(ids){
  try{ localStorage.setItem(SYNCIDS_KEY, JSON.stringify(ids || [])); }catch(e){}
}
function loadSyncIds(){
  try{
    const a = JSON.parse(localStorage.getItem(SYNCIDS_KEY) || 'null');
    return Array.isArray(a) ? a : null;   // null = まだ一度もそろえていない
  }catch(e){ return null; }
}
// クラウドにあって手元に無い物件のうち、「この端末が一度も持っていなかった物件」の名前を返す
function pvMissingFromLocal(cloudBlds, localBlds){
  const known = loadSyncIds();
  const out = [];
  const c = cloudBlds || {}, l = localBlds || {};
  for(const id in c){
    if(!Object.prototype.hasOwnProperty.call(c, id)) continue;
    if(Object.prototype.hasOwnProperty.call(l, id)) continue;       // 手元にもある
    if(known && known.indexOf(id) >= 0) continue;                   // 前は持っていた → 意図した削除
    out.push((c[id] && c[id].name) ? String(c[id].name) : id);
  }
  return out;
}
function pvMissingText(list){
  return '　' + list.slice(0, 8).join('、') + (list.length > 8 ? ('　ほか' + (list.length - 8) + '件') : '');
}
try{ window.pvMissingFromLocal = pvMissingFromLocal; window.saveSyncIds = saveSyncIds; window.loadSyncIds = loadSyncIds; }catch(e){}
 
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
async function doAutoPush(){
  const url = (typeof getCloudUrl === 'function') ? getCloudUrl() : '';
  if(!url) return;
  _clearStalePushLock();   // 固まったロックがあれば解除
  if(_autoPushInFlight){ _autoPushPending = true; return; }
  _autoPushInFlight = true;
  _autoPushStartedAt = Date.now();
  setSyncStatus('saving', '同期中…');
  try{
    const all = pbLoadAll();
    let contracts = {};
    try{ contracts = JSON.parse(localStorage.getItem(ctKey()) || '{}'); }catch(e){ contracts = {}; }
    let ownersData = [];
        try{ ownersData = JSON.parse(localStorage.getItem(insPrefix() + 'rent_owner_send_owners_v1') || '[]'); }catch(e){ ownersData = []; }
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
        // ===== 取りこぼし防止(pv-sync-guard) =====
        // 件数が半分あっても、1件だけ消える押し戻しは今までの安全装置を素通りしていました。
        // クラウドにあって、この端末が一度も持っていない物件があれば、送信そのものを止めます。
        const _miss = pvMissingFromLocal(cloudAll, all);
        if(_miss.length){
          setSyncStatus('error', '⚠️ 送信を中止(消える物件があります)');
          alert('同期を安全のため中止しました。\n\n' +
                'クラウドにあって、この端末に無い物件が ' + _miss.length + '件あります。\n' +
                pvMissingText(_miss) + '\n\n' +
                'このまま送ると、これらが消えてしまいます。\n' +
                '設定 →「⬇️ クラウドから読込」で、先にクラウドの内容を取り込んでください。');
          _autoPushInFlight = false;
          return;
        }
      }
    }catch(e){ /* 確認に失敗しても通常の保存は続行 */ }
    const mtime = getLocalMtime() || touchLocalMtime();
    const r = await postToGas(url, { action:'save', payload:{ buildings: all, contracts: contracts, owners: ownersData, mtime: mtime } });
    if(r && r.ok){
      _hasUnsavedChanges = false;
      try{ saveSyncIds(Object.keys(all)); }catch(e){}   // pv-sync-guard: そろえた時点の一覧
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
    };
    // 契約か物件が入っているときだけ退避（空を退避して上書きしない）
    const hasC = Object.keys(JSON.parse(snap.contracts)).length > 0;
    const hasB = Object.keys(JSON.parse(snap.buildings)).length > 0;
    if(hasC || hasB){ localStorage.setItem(insPrefix() + 'emergency_backup', JSON.stringify(snap)); }
  }catch(e){ /* 退避失敗しても本処理は続行 */ }
  setSyncStatus('loading', '確認中…');
  try{
    const r = await postToGas(url, { action:'load' });
    if(r && r.ok){
      if(_hasUnsavedChanges || _autoPushInFlight){ setSyncStatus('idle',''); return; }
      const payload = r.payload || {};
      const buildings = payload.buildings || {};
      const contracts = payload.contracts || {};
      const cloudMtime = parseInt(payload.mtime || '0', 10) || 0;
      const localMtime = getLocalMtime();
      // 判定: クラウドの方が新しい(または、ローカルにまだ時刻記録がない初回)なら取り込む。
      // 自分のローカルの方が新しい場合は取り込まない(自分の削除・編集を守る)。
      const localHasData = (Object.keys(pbLoadAll()).length > 0) ||
　　　   (Object.keys((function(){try{return JSON.parse(localStorage.getItem(ctKey())||'{}');}catch(e){return {};}})()).length > 0);
      const shouldPull = (!localHasData) || (cloudMtime > localMtime);
      if(shouldPull){
        // ===== 物件データ保護ガード（取り込み時）=====
        let localBuildings = {};
        try{ localBuildings = pbLoadAll() || {}; }catch(e){ localBuildings = {}; }
        const localBC = Object.keys(localBuildings).length;
        const cloudBC = Object.keys(buildings || {}).length;
        if(localBC >= 3 && cloudBC < localBC * 0.5){
          // クラウドの物件が異常に少ない → 物件は取り込まず手元を守る。
          // ★pv-sync-guard: ここで手元をクラウドへ送り返すのはやめました(古い内容の押し戻しの原因)
          setSyncStatus('error', '⚠️ 物件データを保護しました');
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
          // ★pv-sync-guard: 自動で送り返さない
          alert('クラウドの契約数('+cloudCC+'件)が、この端末('+localCC+'件)より大幅に少なかったため、\n手元の契約データを保護し、クラウドの内容では上書きしませんでした。\n\nどちらが正しいかを確かめてから、設定の「⬇️ クラウドから読込」または「⬆️ 全データをクラウドへ送信」を使ってください。');
        } else {
          localStorage.setItem(ctKey(), JSON.stringify(contracts || {}));
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
const LS_LASTSEEN = insPrefix() + 'lastseen_v1';
// 12時間なにも操作しないと、または日付が変わると再ログイン。
// （以前は1時間でしたが、日中に何度も打つことになるため延ばしました。
//   日付が変わると切れる決まりは残してあるので、実質「朝に1回」です。
//   別の端末からは、いずれにせよメールとパスワードが必要です。）
const IDLE_LIMIT_MS = 12 * 60 * 60 * 1000;  // 12時間
 
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
 
// ===== ログイン画面に出す「インスタンスの名前と印の色」 =====
// index.html の <title> から取ります。
//   <title>PIVOT3 OKAYAMA</title> → 名前「PIVOT3」／エリア「OKAYAMA」
// こうしておくと、2・3・4 で core.js を作り分けずに済みます。
// ★localStorage の保存先を決める insPrefix() とは無関係です。触っていません。
function _pvBrand(){
  try{
    var t = (document.title || 'PIVOT').trim().split(/\s+/);
    return { name: t[0] || 'PIVOT', area: t[1] || '' };
  }catch(e){ return { name:'PIVOT', area:'' }; }
}
// 見分けの色。css/tune.css の --pv-ident を読みます。
function _pvIdent(){
  try{
    var c = getComputedStyle(document.documentElement).getPropertyValue('--pv-ident').trim();
    return c || '#111';
  }catch(e){ return '#111'; }
}

// ===== ログイン画面(=クラウドから最新を読み込ませる強制ステップ) =====
function showLoginScreen(){
  const url = (typeof getCloudUrl === 'function') ? getCloudUrl() : '';
  // クラウド未設定なら、ログインせずそのまま使う(ローカルのみ運用)
  if(!url){ return; }
  if(document.getElementById('pivot-login')) return;
  const ov = document.createElement('div');
  ov.id = 'pivot-login';
  ov.style.cssText = 'position:fixed;inset:0;z-index:200000;display:flex;align-items:center;justify-content:center;background:#f5f5f7;';
  const _B = _pvBrand();
  const _IC = _pvIdent();
  ov.innerHTML =
    '<div style="text-align:center;padding:40px 32px;max-width:340px;width:90%;">' +
      '<div style="position:absolute;top:0;left:0;right:0;height:4px;background:' + _IC + ';"></div>' +
    '<div style="font-size:46px;font-weight:900;letter-spacing:2px;color:#111;margin-bottom:6px;">' +
      '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + _IC + ';margin-right:12px;vertical-align:middle;position:relative;top:-4px;"></span>' +
      _B.name +
    '</div>' +
      '<div style="font-size:13px;color:#888;margin-bottom:28px;">' +
        (_B.area ? '<span style="color:' + _IC + ';font-weight:700;letter-spacing:.10em;">' + _B.area + '</span>' + '<span style="margin:0 7px;color:#ccc;">·</span>' : '') +
        '物件・契約 管理</div>' +
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
  try{ setSyncStatus('loading', '最新を確認中…'); }catch(e){}
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
  // ===== 物件データ保護ガード =====
  // クラウドの物件がローカルより大幅に少なければ取り込まず、手元を守ってクラウドへ送り返す。
  let _lb = {};
  try{ _lb = pbLoadAll() || {}; }catch(e){ _lb = {}; }
  const _lbc = Object.keys(_lb).length;
  const _cbc = Object.keys(buildings || {}).length;
  let _guarded = false;
  if(_lbc >= 1 && _cbc < _lbc * 0.5){
    _guarded = true;
  } else {
    pbSaveRaw(buildings);
  }
  // ===== 契約データ保護ガード =====
  let _lc = {};
  try{ _lc = JSON.parse(localStorage.getItem(ctKey()) || '{}'); }catch(e){ _lc = {}; }
  const _lcc = Object.keys(_lc).length;
  const _ccc = Object.keys(contracts || {}).length;
  if(_lcc >= 1 && _ccc < _lcc * 0.5){
    _guarded = true;
  } else {
    localStorage.setItem(ctKey(), JSON.stringify(contracts || {}));
  }
  // ===== 内容が大きく違うとき(pv-sync-guard) =====
  // ★以前はここで、手元の内容をクラウドへ自動で送り返していました。
  //   そのため、古い内容の端末が正しいクラウドを何度でも古い状態に戻していました。
  //   自動では送り返さず、どちらに合わせるかを人に決めてもらいます。
  if(_guarded){
    setSyncStatus('error', '⚠️ 内容が大きく違います');
    const _ok = confirm(
      'この端末の内容と、クラウドの内容が大きく違います。\n\n' +
      '　この端末 : 物件 ' + _lbc + '件 / 契約 ' + _lcc + '件\n' +
      '　クラウド : 物件 ' + _cbc + '件 / 契約 ' + _ccc + '件\n\n' +
      '［OK］ クラウドにそろえる(ほかの端末と同じ内容になります)\n' +
      '［キャンセル］ この端末の内容のまま使う(クラウドへは送りません)'
    );
    if(_ok){
      pbSaveRaw(buildings);
      try{ localStorage.setItem(ctKey(), JSON.stringify(contracts || {})); }catch(e){}
      _guarded = false;
    }
  }
  if(typeof window.applyCloudOwners === 'function'){ window.applyCloudOwners(payload.owners); }
  const cloudMtime = parseInt(payload.mtime || '0', 10) || Date.now();
  try{ localStorage.setItem(MTIME_KEY, String(cloudMtime)); }catch(e){}
  // pv-sync-guard: クラウドにそろえたときだけ、その一覧を「前回そろえた時点」として記録する。
  // (手元を残した場合に記録すると、次の送信で取りこぼしを見逃してしまうため)
  if(!_guarded){ try{ saveSyncIds(Object.keys(buildings || {})); }catch(e){} }
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
  setSyncStatus('loading', '確認中…');
  try{
    const r = await postToGas(url, { action:'load' });
    if(r && r.ok){
      const payload = r.payload || {};
      const buildings = payload.buildings || {};
      const contracts = payload.contracts || {};
      pbSaveRaw(buildings);
      localStorage.setItem(ctKey(), JSON.stringify(contracts || {}));
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
const COMPANY_INFO_KEY = insPrefix() + 'company_info';
 
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
const CLOUD_URL_KEY = insPrefix() + 'cloud_url';
 
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
      try{ ow = JSON.parse(localStorage.getItem(insPrefix() + 'rent_owner_send_owners_v1') || '[]'); }catch(e){ ow = []; }
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
        let _ct = {}; try{ _ct = JSON.parse(localStorage.getItem(ctKey()) || '{}'); }catch(e){ _ct = {}; }
    let _ow = []; try{ _ow = JSON.parse(localStorage.getItem(insPrefix() + 'rent_owner_send_owners_v1') || '[]'); }catch(e){ _ow = []; }
    const _mt = (typeof touchLocalMtime === 'function') ? touchLocalMtime() : Date.now();
    const r = await postToGas(url, { action: 'save', payload: { buildings: all, contracts: _ct, owners: _ow, mtime: _mt } });
    if(r.ok){
      try{ saveSyncIds(Object.keys(all)); }catch(e){}   // pv-sync-guard
      cloudLog('送信成功: 物件 '+r.buildingCount+'件 / 区画 '+r.spotCount+'件', 'success');
      cloudLog('  → スプレッドシートを確認してください', 'success');
      document.dispatchEvent(new CustomEvent('pivot:toast', { detail: 'クラウドへ送信完了' }));
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
      try{ saveSyncIds(Object.keys(buildings)); }catch(e){}   // pv-sync-guard
      cloudLog('読込成功: 物件 '+(r.buildingCount||0)+'件', 'success');
      document.dispatchEvent(new CustomEvent('pivot:toast', { detail: 'クラウドから読込完了' }));
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
// GAS URL は自動設定しない。新しいインスタンスを作ったら設定画面で入力すること。
  if(!getCloudUrl()){
    console.warn('[PIVOT] GAS URL が未設定です。設定画面から入力してください。');
    try{ setSyncStatus('error', '⚠️ GAS URL 未設定'); }catch(e){}
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
   // 画面を切り替えるときは、開いている客付業者ランキングを必ず閉じる
  // （閉じないと、契約や物件を押してもランキングが上に残ったままになります）
  try{ if(window.KB && window.KB.closeBrokerStats){ window.KB.closeBrokerStats(); } }catch(e){}
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


/* ============================================================
   iPhone / iPad で「CSV・PDF が出せない」を直す   pv-ios-export
     ・iPhone の Safari は、ふつうの「ダウンロード」を無視して
       ファイルを画面に映すだけで終わってしまいます。
       そこで iPhone のときだけ「共有シート」を出し、
       そこから「"ファイル"に保存」やメール送信を選べるようにします。
     ・ホーム画面から開いたアプリでは、iOS は印刷そのものを
       受け付けません（window.print が何もしません）。
       そこで「印刷」ではなく、その場で PDF ファイルを作り、
       共有シートに渡します。メールに添付できます。
     ・書類は用紙の幅（A4横・A3横・A4縦）で組み立ててから
       画面の幅に合わせて縮めるので、見た目と PDF が一致します。
     ★パソコンと Android の動きは、これまでと一切変わりません。
     ★他のファイル(contracts.js など)は書き換えず、
       ここから横取りして差し替えています。
   ============================================================ */
(function(){
  // iPad は「Macintosh」と名乗るので、指で触れるかどうかも見ます
  var _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.PV_IS_IOS = _isIOS;

  // PDF を作るための部品。押したときに初めて読み込みます(ふだんは重くなりません)
  var PV_CDN = {
    h2c:   'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
  };
  try{ if(window.PV_CDN_OVERRIDE){ PV_CDN = window.PV_CDN_OVERRIDE; } }catch(e){}

  /* --- ① 作ったファイルの中身を覚えておく ---
     ダウンロード用のリンクは「blob:...」という置き場所しか持っていません。
     あとで共有シートに渡せるよう、中身そのものを控えておきます。 */
  var _keep = {};
  var _create = URL.createObjectURL;
  var _revoke = URL.revokeObjectURL;
  URL.createObjectURL = function(b){
    var u = _create.call(URL, b);
    try{ if(b instanceof Blob) _keep[u] = b; }catch(e){}
    return u;
  };
  URL.revokeObjectURL = function(u){
    // 共有シートが読み終わる前に捨てないよう、少し置いてから忘れます
    setTimeout(function(){ try{ delete _keep[u]; }catch(e){} }, 30000);
    return _revoke.call(URL, u);
  };

  /* --- ② 「保存」の押しかたを iPhone のやり方に差し替える ---
     CSV・PDF・バックアップJSON など、すべての保存がここを通ります。 */
  var _click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){
    if(_isIOS){
      var name = this.getAttribute('download');
      var b = name ? _keep[this.href] : null;
      if(b && typeof File === 'function' && navigator.canShare){
        try{
          var f = new File([b], name, {type: b.type || 'application/octet-stream'});
          if(navigator.canShare({files:[f]})){
            // 「"ファイル"に保存」「メールで送信」などが選べます
            navigator.share({files:[f], title:name}).catch(function(){});
            return;
          }
        }catch(e){ /* だめならふつうのやり方に戻します */ }
      }
    }
    return _click.apply(this, arguments);
  };

  /* --- ③ 部品(html2canvas / jsPDF)の読み込み --- */
  function _loadInto(win, url){
    return new Promise(function(res, rej){
      try{
        var d = win.document;
        var s = d.createElement('script');
        s.src = url;
        s.onload  = function(){ res(); };
        s.onerror = function(){ rej(new Error('部品を読み込めませんでした')); };
        (d.head || d.documentElement).appendChild(s);
      }catch(e){ rej(e); }
    });
  }

  /* --- ④ 書類の「用紙」を読み取る ---
     書類のCSSに書いてある @page{size:A4 landscape; margin:8mm 12mm;} を見ます。 */
  function _toMm(v){
    var n = parseFloat(v) || 0;
    if(/mm$/.test(v)) return n;
    if(/cm$/.test(v)) return n * 10;
    if(/in$/.test(v)) return n * 25.4;
    if(/pt$/.test(v)) return n * 25.4 / 72;
    if(/px$/.test(v)) return n * 25.4 / 96;
    return n;
  }
  function _pageBox(css){
    css = String(css || '');
    var m = /@page[^{]*\{[^}]*size\s*:\s*([a-z0-9]+)\s*(landscape|portrait)?/i.exec(css);
    var fmt = m ? m[1].toLowerCase() : 'a4';
    var ori = (m && m[2]) ? m[2].toLowerCase() : 'portrait';
    var mm = ({a3:[297,420], a4:[210,297], a5:[148,210], b4:[257,364], b5:[182,257]})[fmt] || [210,297];
    var box = {
      fmt: fmt, ori: ori,
      wmm: (ori === 'landscape' ? mm[1] : mm[0]),
      hmm: (ori === 'landscape' ? mm[0] : mm[1]),
      mt: 10, mr: 10, mb: 10, ml: 10
    };
    var g = /@page[^{]*\{[^}]*margin\s*:\s*([^;}]+)/i.exec(css);
    if(g){
      var p = g[1].trim().split(/\s+/).map(_toMm);
      if(p.length === 1){ box.mt = box.mr = box.mb = box.ml = p[0]; }
      else if(p.length === 2){ box.mt = box.mb = p[0]; box.mr = box.ml = p[1]; }
      else if(p.length === 3){ box.mt = p[0]; box.mr = box.ml = p[1]; box.mb = p[2]; }
      else { box.mt = p[0]; box.mr = p[1]; box.mb = p[2]; box.ml = p[3]; }
    }
    return box;
  }
  // 書類の中の「1枚ずつ」を探す。承諾書は2枚、契約書・請求書は1枚。
  //   fixed=true … 書類が「これで1枚」と決めている入れ物。多少はみ出しても
  //                縮めて1枚に収めます(承諾書・契約書・請求書)。
  //   fixed=false… ただの長い書類。用紙の高さで切り分けます(ランキング表)。
  function _pagesIn(doc){
    var l = doc.querySelectorAll('.page');
    if(l.length) return { els: [].slice.call(l), fixed: true };
    l = doc.querySelectorAll('.sheet');
    if(l.length) return { els: [].slice.call(l), fixed: true };
    return { els: [doc.body], fixed: false };
  }

  /* --- ⑤ 用紙の幅で組み立てて、画面の幅に合わせて縮める ---
     縮小には transform を使います。以前は zoom を使っていましたが、
     iPhone の Safari では zoom をかけると文字の位置がずれて
     重なって表示されるためです。transform なら、組み上がった見た目を
     そのまま小さく映すだけなので崩れません。 */
  function _layout(fr, box){
    try{
      var d = fr.contentDocument;
      if(!d || !d.body) return;
      var contentMm = box.wmm - box.ml - box.mr;      // 中身の幅(mm)
      var base = d.getElementById('pv-base');
      if(!base){ base = d.createElement('style'); base.id = 'pv-base';
                 (d.head || d.documentElement).insertBefore(base, (d.head||d.documentElement).firstChild); }
      base.textContent = 'html{background:#fff;overflow-x:hidden;}' +
        'body{margin:0;padding:0;background:#fff;width:' + contentMm + 'mm;}' +
        'img{max-width:100%;}';
      _fit(fr, contentMm);
    }catch(e){}
  }
  // 画面の幅に合わせて縮める（PDFを作るときは _unfit で原寸に戻します）
  function _fit(fr, contentMm){
    try{
      var d = fr.contentDocument;
      if(!d || !d.body) return;
      _unfit(fr);                                     // いったん原寸に戻して測る
      var px = contentMm * 96 / 25.4;                 // 中身の幅(画面の点)
      var k  = fr.clientWidth / px;
      if(!(k > 0) || k >= 1) return;                  // 収まっているなら何もしない
      var h = d.body.scrollHeight;                    // 原寸の高さ
      d.body.style.transformOrigin = '0 0';
      d.body.style.transform = 'scale(' + k.toFixed(4) + ')';
      d.documentElement.style.height = Math.ceil(h * k) + 'px';
    }catch(e){}
  }
  function _unfit(fr){
    try{
      var d = fr.contentDocument;
      if(!d || !d.body) return;
      d.body.style.transform = '';
      d.body.style.transformOrigin = '';
      d.documentElement.style.height = '';
    }catch(e){}
  }

  /* 用紙より中身の背が低いときに、本文の幅をせまくして
     （＝相対的に文字を大きくして）用紙の高さいっぱいまで使います。
     スマホで出したPDFが「上に寄って下が真っ白」になるのを防ぎます。
     幅を戻すのは呼び出し側（_buildPdf の最後）です。 */
  function _growToPage(doc, el, cw, ch){
    try{
      var body = doc.body;
      var full = Math.round(cw * 96 / 25.4);          // 用紙の中身の幅(画面の点)
      var target = ch / cw;                            // 用紙の 高さ÷幅
      function ratioAt(px){
        body.style.width = px + 'px';
        var h = Math.max(el.scrollHeight, el.getBoundingClientRect().height);
        return px > 0 ? (h / px) : 0;
      }
      // 組む幅をせまくすると背が高く、広くすると背が低くなります。
      // 用紙より背が高くならない範囲で、いちばんせまい幅(＝いちばん大きい文字)を選びます。
      //   背が高いまま貼ると、高さに合わせて縮められ、左右に大きな余白ができます。
      var lo = Math.round(full * 0.72);                // これ以上は文字を大きくしない
      var hi = Math.round(full * 1.80);                // これ以上は文字を小さくしない
      if(ratioAt(lo) <= target){ body.style.width = lo + 'px'; return lo; }
      if(ratioAt(hi) >  target){ body.style.width = hi + 'px'; return hi; }
      var best = hi;
      for(var i = 0; i < 9; i++){                      // 二分探索でちょうどの幅を探します
        var mid = Math.round((lo + hi) / 2);
        if(ratioAt(mid) <= target){ best = mid; hi = mid; } else { lo = mid; }
      }
      body.style.width = best + 'px';
      return best;
    }catch(e){ return 0; }
  }

  /* --- ⑥ PDF を作る --- */
  function _crop(win, cv, y, h){
    var c = win.document.createElement('canvas');
    c.width = cv.width; c.height = h;
    c.getContext('2d').drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h);
    return c;
  }
  function _buildPdf(fr, box){
    var win = fr.contentWindow, doc = fr.contentDocument;
    // 画面用の縮小を外して原寸に戻します（PDFは原寸で作ります）
    _unfit(fr);
    var contentMm = box.wmm - box.ml - box.mr;
    var jsPDF, pdf;
    var cw = box.wmm - box.ml - box.mr;                // 中身の幅(mm)
    var ch = box.hmm - box.mt - box.mb;                // 中身の高さ(mm)
    return Promise.resolve()
      .then(function(){ return win.html2canvas ? null : _loadInto(win, PV_CDN.h2c); })
      .then(function(){ return window.jspdf   ? null : _loadInto(window, PV_CDN.jspdf); })
      .then(function(){
        jsPDF = window.jspdf.jsPDF;
        pdf = new jsPDF({ unit:'mm', format: box.fmt, orientation: box.ori });
        var found = _pagesIn(doc), pages = found.els, i = 0, first = true;
        function step(){
          if(i >= pages.length) return pdf.output('blob');
          var el = pages[i++];
          // 1枚ものは、用紙の高さいっぱいまで使うように幅を調整します
          var w  = found.fixed ? _growToPage(doc, el, cw, ch) : 0;
          if(!w) w = Math.max(el.scrollWidth, el.getBoundingClientRect().width) || doc.body.scrollWidth;
          return win.html2canvas(el, {
            scale: 2, backgroundColor:'#ffffff', useCORS:true, logging:false,
            width: w, windowWidth: w         // 用紙の幅で描く(画面の幅ではない)
          }).then(function(cv){
            var full = cw * cv.height / cv.width;      // 原寸なら何mmになるか
            if(full <= ch + 1 || found.fixed){
              // 1枚もの。はみ出す分は縮めて、必ず1枚に収めます。
              var dw = cw, dh = full;
              if(dh > ch){ var k = ch / dh; dw = cw * k; dh = ch; }
              if(!first) pdf.addPage(box.fmt, box.ori);
              first = false;
              pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG',
                           box.ml + (cw - dw) / 2, box.mt, dw, dh);
            }else{
              // 1枚に収まらないときは、用紙の高さで切り分けます
              var slice = Math.floor(cv.width * ch / cw), y = 0;
              while(y < cv.height){
                var h = Math.min(slice, cv.height - y);
                if(!first) pdf.addPage(box.fmt, box.ori);
                first = false;
                pdf.addImage(_crop(win, cv, y, h).toDataURL('image/jpeg', 0.92),
                             'JPEG', box.ml, box.mt, cw, cw * h / cv.width);
                y += h;
              }
            }
            return step();
          });
        }
        return step();
      })
      .then(function(blob){ _restoreWidth(doc); _fit(fr, contentMm); return blob; })
      .catch(function(e){ _restoreWidth(doc); _fit(fr, contentMm); throw e; });
  }

  // _growToPage で変えた本文の幅を、画面表示用に戻します
  function _restoreWidth(doc){
    try{ if(doc && doc.body) doc.body.style.width = ''; }catch(e){}
  }

  /* --- ⑦ 出来た PDF を共有シートへ渡す(メール添付・ファイル保存など) --- */
  function _sharePdf(blob, name){
    var f = null;
    try{ f = new File([blob], name, {type:'application/pdf'}); }catch(e){}
    if(f && navigator.canShare && navigator.canShare({files:[f]})){
      /* true …保存・共有できた ／ false …利用者が「キャンセル」を押した
         （呼び出し側が、画面を閉じてよいか判断できるようにします） */
      return navigator.share({files:[f], title:name})
        .then(function(){ return true; })
        .catch(function(err){
          if(err && err.name === 'AbortError') return false;   // 利用者が閉じただけ
          _download(blob, name);
          return true;
        });
    }
    _download(blob, name);
    return Promise.resolve(true);
  }
  function _download(blob, name){
    var u = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(u); }, 30000);
  }

  /* --- ⑧ 書類を画面いっぱいに出す。ここから PDF を作ります --- */
  window.PV_PRINT_HTML = function(html, name){
    var old = document.getElementById('pv-print-ov');
    if(old && old.parentNode) old.parentNode.removeChild(old);

    var css = (String(html).match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
    var box = _pageBox(css);
    var title = (/<title[^>]*>([^<]*)<\/title>/i.exec(String(html)) || [])[1] || '';
    var d = new Date(), p = function(n){ return ('0' + n).slice(-2); };
    var fname = (name || title || '書類').replace(/[\\\/:*?"<>|\s]+/g, '_') +
                '_' + d.getFullYear() + p(d.getMonth()+1) + p(d.getDate()) + '.pdf';

    var ov = document.createElement('div');
    ov.id = 'pv-print-ov';
    ov.setAttribute('style','position:fixed;top:0;right:0;bottom:0;left:0;z-index:100000;'+
      'background:#fff;display:flex;flex-direction:column;');

    var bar = document.createElement('div');
    bar.setAttribute('style','flex:0 0 auto;display:flex;gap:10px;justify-content:space-between;'+
      'align-items:center;padding:10px 12px;background:#1f3a5f;'+
      'padding-top:calc(10px + env(safe-area-inset-top, 0px));');
    var bs = 'font-size:15px;font-weight:700;padding:10px 16px;border:0;border-radius:9px;cursor:pointer;font-family:inherit;';

    var close = document.createElement('button');
    close.type = 'button'; close.textContent = '✕ 閉じる';
    close.setAttribute('style', bs + 'background:rgba(255,255,255,.18);color:#fff;');

    var pr = document.createElement('button');
    pr.type = 'button'; pr.textContent = '印刷';
    pr.setAttribute('style', bs + 'background:rgba(255,255,255,.18);color:#fff;');

    var go = document.createElement('button');
    go.type = 'button'; go.textContent = 'PDF';
    go.setAttribute('style', bs + 'background:#fff;color:#1f3a5f;');

    /* スマホで「中身を見る」を押したときに使うボタン。ふだんは隠しています。 */
    var back = document.createElement('button');
    back.type = 'button'; back.textContent = '◀ 戻る';
    back.setAttribute('style', bs + 'background:rgba(255,255,255,.18);color:#fff;');
    back.style.display = 'none';

    var saveBar = document.createElement('button');
    saveBar.type = 'button'; saveBar.textContent = '\uD83D\uDCE4 保存・共有';
    saveBar.setAttribute('style', bs + 'background:#fff;color:#1f3a5f;');
    saveBar.style.display = 'none';

    var right = document.createElement('div');
    right.setAttribute('style','display:flex;gap:8px;flex:0 0 auto;');
    right.appendChild(pr); right.appendChild(go);
    right.appendChild(back); right.appendChild(saveBar);
    bar.appendChild(close); bar.appendChild(right);

    var fr = document.createElement('iframe');
    fr.setAttribute('style','flex:1 1 auto;width:100%;border:0;background:#fff;');

    ov.appendChild(bar); ov.appendChild(fr);
    document.body.appendChild(ov);

    close.onclick = function(){ if(ov.parentNode) ov.parentNode.removeChild(ov); };

    // 印刷。パソコンはそのまま印刷、iPhone は印刷が働かないので
    // PDF を作って共有シートへ渡します(その中の「プリント」で印刷できます)。
    pr.onclick = function(){
      if(_isIOS){ go.onclick(); return; }
      try{ fr.contentWindow.focus(); fr.contentWindow.print(); }
      catch(e){ alert('印刷を開けませんでした。「PDF」からお試しください。'); }
    };

    go.onclick = function(){
      if(go.disabled) return;
      go.disabled = true; go.textContent = '⏳ 作成中…'; go.style.opacity = '.7'; pr.disabled = true;
      _buildPdf(fr, box)
        .then(function(blob){ return _sharePdf(blob, fname); })
        .catch(function(e){
          alert('PDFを作れませんでした。\n' + ((e && e.message) || '') +
                '\n\n電波の届く場所で、もう一度お試しください。');
        })
        .then(function(){
          go.disabled = false; go.textContent = 'PDF'; go.style.opacity = '1'; pr.disabled = false;
        });
    };

    /* ===== スマホ(iPhone/iPad)は、確認画面を出さずにそのままPDFを作ります =====
       ・スマホでは印刷ができないので、印刷ボタンは出しません。
       ・確認画面の見え方は実際のPDFと少しずれる(画面幅に合わせて縮めているため)ので、
         かえって紛らわしく、出しません。中身は白い画面で隠します。
       ・出来上がったら「保存・共有」を押してもらいます。
         iPhone の決まりで、共有メニューは“指で押した直後”でないと開けないためです。 */
    var cover = null;
    var pdfBlob = null;          // できあがったPDF。何度でも共有できるよう持っておきます
    function _doShare(){
      if(!pdfBlob) return;
      _sharePdf(pdfBlob, fname);
      /* ★ここでは画面を閉じません。
         以前は共有シートを閉じただけで、この画面ごと消えていました。
         キャンセルしたときに作り直しになってしまうためです。
         閉じるときは、左上の「✕ 閉じる」を押してください。 */
    }
    function _showDoc(on){
      if(!cover) return;
      cover.style.display  = on ? 'none' : '';
      back.style.display    = on ? '' : 'none';
      saveBar.style.display = on ? '' : 'none';
    }
    function _coverHtml(icon, main, sub){
      return '<div style="max-width:280px;">' +
             '<div style="font-size:38px;line-height:1.2;margin-bottom:12px;">' + icon + '</div>' +
             '<div style="font-size:17px;font-weight:700;color:#222;">' + main + '</div>' +
             (sub ? '<div style="font-size:13px;color:#888;margin-top:8px;line-height:1.8;">' + sub + '</div>' : '') +
             '<div id="pv-cover-act" style="margin-top:20px;"></div></div>';
    }
    function _makePdfNow(){
      _showDoc(false);
      cover.innerHTML = _coverHtml('📄', 'PDFを作っています…', 'そのままお待ちください');
      _buildPdf(fr, box)
        .then(function(blob){
          pdfBlob = blob;
          cover.innerHTML = _coverHtml('✅', 'PDFができました',
            fname + '<br><span style="color:#aaa">保存する前に、中身を見て確かめられます</span>');
          var act = cover.querySelector('#pv-cover-act');

          /* ★中身の確認。スマホでは白い画面で隠していたので、
             出来上がったPDFの中身を見られませんでした。
             押すと白い画面を外して、ページごとに区切られた書類を見せます。 */
          var look = document.createElement('button');
          look.type = 'button'; look.textContent = '📄 中身を見る';
          look.setAttribute('style', bs + 'background:#fff;color:#1f3a5f;'+
            'box-shadow:inset 0 0 0 1.5px #1f3a5f;font-size:16px;padding:13px 24px;'+
            'display:block;width:100%;margin-bottom:10px;');
          look.onclick = function(){ _showDoc(true); };

          var save = document.createElement('button');
          save.type = 'button'; save.textContent = '📤 保存・共有';
          save.setAttribute('style', bs + 'background:#1f3a5f;color:#fff;font-size:17px;'+
            'padding:14px 26px;display:block;width:100%;');
          save.onclick = _doShare;

          act.appendChild(look); act.appendChild(save);
        })
        .catch(function(e){
          cover.innerHTML = _coverHtml('⚠️', 'PDFを作れませんでした',
            ((e && e.message) ? String(e.message).replace(/[<>]/g,'') : '') + '<br>電波の届く場所でお試しください');
          var again = document.createElement('button');
          again.type = 'button'; again.textContent = 'もう一度';
          again.setAttribute('style', bs + 'background:#1f3a5f;color:#fff;font-size:16px;padding:13px 24px;');
          again.onclick = _makePdfNow;
          cover.querySelector('#pv-cover-act').appendChild(again);
        });
    }
    back.onclick    = function(){ _showDoc(false); };   // 白い画面（保存の案内）に戻ります
    saveBar.onclick = _doShare;

    if(_isIOS){
      pr.style.display = 'none';                  // 印刷ボタンは出しません
      go.style.display = 'none';                  // PDFボタンも要りません(自動で作ります)
      cover = document.createElement('div');
      cover.setAttribute('style','position:absolute;top:0;right:0;bottom:0;left:0;background:#fff;'+
        'display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;'+
        'font-family:inherit;');
      cover.innerHTML = _coverHtml('📄', 'PDFを作っています…', 'そのままお待ちください');
      ov.appendChild(cover);
      // 上の「✕ 閉じる」は白い画面より前に出しておきます(いつでも閉じられるように)
      bar.style.position = 'relative';
      bar.style.zIndex = '2';
    }

    // 書類じたいが「読み込めたら印刷する」を持っている場合は任せます(二重に出さない)
    var selfPrint = /window\.print\s*\(/.test(String(html));
    fr.onload = function(){
      _layout(fr, box);
      // 画像の読み込みで高さが変わることがあるので、少し後にもう一度合わせます
      setTimeout(function(){ _layout(fr, box); }, 600);
      if(_isIOS){
        // 中身が組み上がるのを待ってから、そのままPDFを作り始めます
        setTimeout(function(){ _makePdfNow(); }, 800);
        return;
      }
      if(!selfPrint) setTimeout(function(){
        try{ fr.contentWindow.focus(); fr.contentWindow.print(); }catch(e){}
      }, 400);
    };

    if('srcdoc' in fr){ fr.srcdoc = html; }
    else{ var dd = fr.contentWindow.document; dd.open(); dd.write(html); dd.close(); }
  };

  /* --- ⑨ 承諾書・契約書・請求書の「PDF保存 / 印刷」を差し替える ---
     いまは書類をアプリの画面の上に重ねて、そのまま印刷しています。
     iPhone ではその印刷が働かないので、上の画面に移して PDF を作ります。
     ★パソコンは今までどおりです。 */
  function _patchDocPrint(){
    if(typeof window.printDocOverlay !== 'function') return;
    if(window.printDocOverlay._pvPatched) return;
    var _orig = window.printDocOverlay;
    var f = function(){
      var c = _isIOS ? document.getElementById('doc-ov-content') : null;
      if(c && window.PV_PRINT_HTML){
        var t = document.querySelector('#doc-overlay .doc-ov-title');
        var nm = t ? t.textContent.replace(/[^　-鿿A-Za-z0-9]/g, '') : '書類';
        // 書類の見た目(style)と中身を、そのまま上の画面へ移します
        window.PV_PRINT_HTML(
          '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">' +
          '<title>' + nm + '</title></head><body>' +
          c.innerHTML + '</body></html>', nm);
        return;
      }
      return _orig.apply(this, arguments);
    };
    f._pvPatched = 1;
    window.printDocOverlay = f;
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _patchDocPrint);
  }else{
    _patchDocPrint();
  }
  window.addEventListener('load', _patchDocPrint);
})();


/* ============================================================
   pv-danger-guard : 取り返しのつかない操作の前に、文字の入力を求める
     ・⬆️ 全データをクラウドへ送信  … 手元の内容でクラウドを上書き
     ・⬇️ クラウドから読込         … クラウドの内容で手元を上書き
   どちらも押し間違いでデータを失う操作なので、
   決められた文字を打たないと進めないようにします。
   （画面側では、この2つを「復旧用の操作」としてたたんであります）
   ★もとの処理には触れていません。手前に確認を1枚はさむだけです。
   ============================================================ */
(function(){
  function _guard(fnName, word, msg){
    var orig = window[fnName];
    if(typeof orig !== 'function') return;
    if(orig._pvGuarded) return;
    var wrapped = function(){
      var ans = window.prompt(msg + '\n\n続ける場合は「' + word + '」と入力して OK を押してください。');
      if(ans === null){ return; }                       // キャンセル
      if(String(ans).trim() !== word){
        alert('入力が違うため、中止しました。\n（何も変わっていません）');
        return;
      }
      return orig.apply(this, arguments);
    };
    wrapped._pvGuarded = 1;
    window[fnName] = wrapped;
  }

  function _apply(){
    _guard('cloudSaveAll', '送信',
      'この端末の内容で、クラウドのデータを上書きします。\n' +
      'クラウドにある正しいデータが失われることがあります。\n\n' +
      'ふだんは自動で同期されているので、この操作は必要ありません。');
    _guard('cloudLoadAll', '読込',
      'クラウドの内容で、この端末のデータを上書きします。\n' +
      'この端末で入力した内容が失われることがあります。\n\n' +
      'ふだんは自動で同期されているので、この操作は必要ありません。');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _apply);
  }else{
    _apply();
  }
  window.addEventListener('load', _apply);
})();


/* ============================================================
   pv-scroll-reset : 区画一覧の横スクロールを、いつも左端から始める
     ・物件を開いたとき／別の物件に移ったとき、前に見ていた位置が
       残っていて「区画番号が見えない」状態から始まることがあったため、
       開くたびに左端へ戻します。
     ★HTML・JS の中身には触れず、開いたことを見張って戻すだけです。
   ============================================================ */
(function(){
  function _resetSpotScroll(){
    try{
      var w = document.getElementById('spots-table-wrap');
      if(!w) return;
      w.scrollLeft = 0;
      // 下のつまみ(スライダー)の位置も合わせます
      try{ w.dispatchEvent(new Event('scroll')); }catch(e){}
    }catch(e){}
  }

  function _watch(){
    var m = document.getElementById('modal');
    if(!m || m._pvScrollWatched) return;
    m._pvScrollWatched = 1;
    var was = m.classList.contains('active');
    try{
      new MutationObserver(function(){
        var now = m.classList.contains('active');
        if(now && !was){                       // いま開いた
          setTimeout(_resetSpotScroll, 0);
          setTimeout(_resetSpotScroll, 250);   // 表の描き終わりを待ってもう一度
        }
        was = now;
      }).observe(m, { attributes:true, attributeFilter:['class'] });
    }catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _watch);
  }else{
    _watch();
  }
  window.addEventListener('load', _watch);
})();
