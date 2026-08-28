/* ==================================================================
 * BUILDINGS 1 / 定数・日付ユーティリティ・自動切替・保存
 * ================================================================== */

// ==============================
// データモデル
// ==============================
// localStorage キー: pivot_blds
// 構造: { "物件ID": { id, name, addr, spots: [ {no, type, tou, room, user, price, status, note} ] } }

const STORAGE_KEY = (typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + 'blds';
const STATUS_LIST = ['借','空','解','予','退','募停','申'];
const STATUS_LABELS = {
  '借':'使用中', '空':'空き', '解':'解約中', '予':'予約中',
  '退':'退去済', '募停':'募集停止', '申':'申込中'
};
const TYPE_LIST = ['並','縦','軽','機'];
const TYPE_LABELS = { '並':'並列', '縦':'縦列', '軽':'軽専用', '機':'機械式' };
const TYPE_DEFAULT_PRICE = { '並':3300, '縦':5500, '軽':3300, '機':5500 };

let currentEditId = null;
let _modalDirty = false;  // 物件編集モーダルで未保存の変更があるか

// ==============================
// 自動切替: 解約日・予約日到来チェック
// ==============================

// 日付を YYYY-MM-DD 形式で取得(タイムゾーン安全)
function todayStr(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return y + '-' + m + '-' + day;
}

// 日付文字列を比較しやすい形に正規化("2026/05/26" や "2026-5-26" → "2026-05-26")
function normalizeDate(s){
  if(!s) return '';
  const str = String(s).trim();
  // クラウド(GAS/スプレッドシート)が日付を Date型に変換して返すと
  // "2026-06-30T15:00:00.000Z" のような UTC日時文字列になり、頭3つの数字を取ると
  // 1日前(6/30)になってしまう。時刻付き(T や Z や コロン)の場合はローカル日付に直す。
  if(/T\d|Z$|\d{2}:\d{2}/.test(str)){
    const d = new Date(str);
    if(!isNaN(d.getTime())){
      const y = d.getFullYear();
      const mo = String(d.getMonth()+1).padStart(2,'0');
      const da = String(d.getDate()).padStart(2,'0');
      return y + '-' + mo + '-' + da;
    }
  }
  // 通常の YYYY-M-D, YYYY/M/D, YYYY.M.D は文字列のまま統一(タイムゾーン変換しない)
  const m = str.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
  if(!m) return '';
  return m[1] + '-' + String(parseInt(m[2])).padStart(2,'0') + '-' + String(parseInt(m[3])).padStart(2,'0');
}

// 切替対象を「事前に」抽出する関数(実行はまだしない)
function findAutoSwitchTargets(){
  const all = loadAll();
  const today = todayStr();
  const targets = []; // {bldId, bldName, spotIdx, spotNo, type, oldStatus, newStatus, msg}

  Object.values(all).forEach(b => {
    (b.spots||[]).forEach((s, i) => {
      // ❶ 解約日到来チェック: 状況=「解」 かつ 解約日 ≤ 今日
      if(s.status === '解' && s.end_date){
        const endN = normalizeDate(s.end_date);
        if(endN && endN <= today){
          targets.push({
            bldId: b.id,
            bldName: b.name,
            spotIdx: i,
            spotNo: 'P'+String(s.no||(i+1)).padStart(2,'0'),
            type: 'end', // 解約→退去済
            oldStatus: '解',
            newStatus: '退',
            userName: s.user || '(使用者なし)',
            endDate: s.end_date
          });
        }
      }
      // ❷ 予約日到来チェック: 予約者と予約日が登録されていれば状況不問でチェック
      //   (解約中の区画に追加された予約も対象)
      if(s.res_user && s.res_date){
        const resN = normalizeDate(s.res_date);
        if(resN && resN <= today){
          targets.push({
            bldId: b.id,
            bldName: b.name,
            spotIdx: i,
            spotNo: 'P'+String(s.no||(i+1)).padStart(2,'0'),
            type: 'reservation', // 予約→使用中
            oldStatus: s.status,
            newStatus: '借',
            userName: s.res_user,
            resDate: s.res_date
          });
        }
      }
    });
  });
  return targets;
}

// 切替を実際に実行する
function applyAutoSwitch(targets){
  if(!targets || targets.length === 0) return 0;
  const all = loadAll();
  let count = 0;

  // 同一区画で「解約日と予約日が同時到来」の場合、解約→退去済 → 予約→使用中 の順で処理
  // そのために targets を「同一区画かどうか」でグルーピング
  const grouped = {};
  targets.forEach(t => {
    const key = t.bldId + '|' + t.spotIdx;
    if(!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  Object.values(grouped).forEach(group => {
    // 解約系を先に、予約系を後に処理
    group.sort((a,b) => {
      if(a.type === 'end' && b.type !== 'end') return -1;
      if(a.type !== 'end' && b.type === 'end') return 1;
      return 0;
    });

    group.forEach(t => {
      // 物件は id で探す(オブジェクトのキーと id が一致しない場合に備える)
      let b = all[t.bldId];
      if(!b || b.id !== t.bldId){
        b = Object.values(all).find(x => x && x.id === t.bldId) || b;
      }
      if(!b || !b.spots || !b.spots[t.spotIdx]) return;
      const s = b.spots[t.spotIdx];

      if(t.type === 'end'){
        // 解約→退去済: 状況のみ変更
        // ただし、同じ区画に「予約」もあれば、退去済データはサブ行に退避する必要がある
        // それは reservation 処理時に実施するので、ここでは status のみ更新
        s.status = '退';
        count++;
      } else if(t.type === 'reservation'){
        // 予約者をメインに昇格する前に、現在の使用者がいれば「退去済」として履歴に退避する。
        // (前契約者の状況に関わらず、予約到来時は退去済扱いにする)
        if(s.user){
          if(!s.previous_users) s.previous_users = [];
          s.previous_users.unshift({
            user: s.user || '',
            tou: s.tou || '',
            room: s.room || '',
            price: s.price || 0,
            note: s.note || '',
            end_date: s.end_date || t.resDate || '',
            status: '退'   // 退去済
          });
        }
        // 予約者をメインに昇格(使用中)
        s.user = s.res_user || '';
        s.tou = s.res_tou || '';
        s.room = s.res_room || '';
        s.price = s.res_price || 0;
        s.note = s.res_note || '';
        s.status = '借';
        // 予約情報・解約日をクリア(新しい主のデータに置き換わったため)
        delete s.res_user;
        delete s.res_date;
        delete s.res_tou;
        delete s.res_room;
        delete s.res_price;
        delete s.res_note;
        delete s.end_date;
        delete s.res_srcKey;
        delete s.res_autoCancel;
        count++;
      }
    });
  });

  saveAll(all);
  return count;
}

// 自動切替を実行(確認ダイアログ付き)
// userTriggered: true=ボタンから手動実行 / false=起動時の自動実行
function runAutoSwitch(userTriggered){
  const targets = findAutoSwitchTargets();
  if(targets.length === 0){
    if(userTriggered){
      alert('自動切替の対象はありません。');
    }
    return;
  }

  // 対象一覧のメッセージを作る
  const lines = targets.map(t => {
    if(t.type === 'end'){
      return '[退去済] ' + t.bldName + ' ' + t.spotNo + ': ' + t.userName + '(解約日 ' + t.endDate + ')';
    } else {
      return '[予約到来→使用中] ' + t.bldName + ' ' + t.spotNo + ': ' + t.userName + '(予約日 ' + t.resDate + ') ※前契約者は退去済に移動';
    }
  });

  const msg = '本日までに到来した切替対象が ' + targets.length + ' 件あります。\n\n' +
              lines.join('\n') + '\n\n' +
              '予約到来分は、前契約者を退去済にして、予約者を使用中に切り替えます。\n今すぐ切替しますか?';

  if(!confirm(msg)){
    console.log('[自動切替] ユーザーがキャンセル');
    return;
  }

  const count = applyAutoSwitch(targets);
  showNoticeBar('✅ 本日までに到来した自動切替: ' + count + ' 件 (' + lines.join(' / ') + ')');
  renderAll();
}

// 通知バナーを表示
function showNoticeBar(msg){
  const bar = document.getElementById('notice-bar');
  const msgEl = document.getElementById('notice-msg');
  msgEl.textContent = msg;
  bar.style.display = 'flex';
}
function closeNotice(){
  document.getElementById('notice-bar').style.display = 'none';
}

// ==============================
// データ読み書き
// ==============================
function loadAll(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  }catch(e){
    console.error('loadAll error:', e);
    return {};
  }
}
function saveAll(data){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    scheduleAutoPush();   // 変更があったらクラウドへ自動送信(まとめて)
    try{ if(typeof window.pushFeatureToCloud==='function'){ window.pushFeatureToCloud('buildings'); } }catch(e){}
    return true;
  }catch(e){
    console.error('saveAll error:', e);
    alert('保存に失敗しました: ' + e.message);
    return false;
  }
}


/* ==================================================================
 * BUILDINGS 2 / 郵便番号・物件一覧・承諾書/契約書/請求書
 * ================================================================== */

// ==============================
// 郵便番号 → 住所 自動検索 (zipcloud API)
// ==============================
const _zipCache = {};  // {zip: addr} 一度引いた郵便番号はキャッシュ
let _zipLookupTimer = null;

// 入力中に7桁揃ったら自動検索(ハイフン有無不問)
function onZipInput(zipId, addrId){
  const zipEl = document.getElementById(zipId);
  if(!zipEl) return;
  const raw = (zipEl.value || '').replace(/[^0-9]/g, '');
  // ちょうど7桁になった時にトリガー(遅延500ms)
  if(raw.length === 7){
    clearTimeout(_zipLookupTimer);
    _zipLookupTimer = setTimeout(() => lookupZipForField(zipId, addrId), 400);
  }
}

// 郵便番号から住所を引いて指定欄にセット
async function lookupZipForField(zipId, addrId){
  const zipEl = document.getElementById(zipId);
  const addrEl = document.getElementById(addrId);
  if(!zipEl || !addrEl) return;
  const raw = (zipEl.value || '').replace(/[^0-9]/g, '');
  if(raw.length !== 7) return;
  // 表示はハイフン付きに整形(123-4567)
  const formatted = raw.substring(0,3) + '-' + raw.substring(3);
  zipEl.value = formatted;
  // 既存住所のチェック
  const existing = (addrEl.value || '').trim();
  const wasAutofilled = addrEl.dataset.autofilled === '1';
  // 手入力された住所(自動入力フラグなし)は上書きしない
  if(existing && !wasAutofilled){
    return;
  }
  // キャッシュ確認
  if(_zipCache[raw]){
    addrEl.value = _zipCache[raw];
    addrEl.dataset.autofilled = '1';
    addrEl.focus();
    addrEl.setSelectionRange(addrEl.value.length, addrEl.value.length);
    return;
  }
  // API検索
  try{
    addrEl.placeholder = '住所を検索中...';
    const url = 'https://zipcloud.ibsnet.co.jp/api/search?zipcode=' + encodeURIComponent(raw);
    const res = await fetch(url);
    if(!res.ok){ throw new Error('HTTP ' + res.status); }
    const data = await res.json();
    if(data.status !== 200 || !data.results || data.results.length === 0){
      // 見つからない場合
      addrEl.placeholder = '※ 郵便番号が見つかりませんでした。手入力してください';
      setTimeout(() => { addrEl.placeholder = '例: 広島県福山市〇〇1-2-3'; }, 3000);
      return;
    }
    const r = data.results[0];
    const addr = (r.address1||'') + (r.address2||'') + (r.address3||'');
    _zipCache[raw] = addr;
    addrEl.value = addr;
    addrEl.dataset.autofilled = '1';
    addrEl.placeholder = '例: 広島県福山市〇〇1-2-3';
    // フォーカスを末尾に(続きの番地を入力できるよう)
    addrEl.focus();
    addrEl.setSelectionRange(addrEl.value.length, addrEl.value.length);
  } catch(e){
    console.warn('郵便番号検索失敗:', e);
    addrEl.placeholder = '※ 検索失敗(オフライン?)。手入力してください';
    setTimeout(() => { addrEl.placeholder = '例: 広島県福山市〇〇1-2-3'; }, 3000);
  }
}

// 住所欄を手動で編集された場合、自動入力フラグをクリア(以降は上書きされない)
function markAddrManual(addrId){
  const addrEl = document.getElementById(addrId);
  if(addrEl) addrEl.dataset.autofilled = '';
}

// ==============================
// レンダリング: 一覧と統計
// ==============================
function renderAll(){
  renderList();
}
// 住所から都道府県を判定
function prefOf(b){
  const addr = (b && b.addr) || '';
  if(addr.indexOf('広島県') >= 0) return '広島県';
  if(addr.indexOf('岡山県') >= 0) return '岡山県';
  return 'その他';
}

// 折りたたみ状態(都道府県名 -> true:閉じている)
let _prefCollapsed = {};
function togglePref(pref){
  _prefCollapsed[pref] = !_prefCollapsed[pref];
  const el = document.querySelector('.pref-folder[data-pref="'+CSS.escape(pref)+'"]');
  if(el) el.classList.toggle('collapsed', !!_prefCollapsed[pref]);
}

function _bldCardHtml(b){
  const total = (b.spots||[]).length;
  const used = (b.spots||[]).filter(s => s.status === '借').length;
  return '<div class="bld-card" onclick="openModal(\''+b.id+'\')">' +
    '<div class="bld-card-info">' +
      '<div class="bld-name">' + escapeHtml(b.name||'(名称未設定)') + '</div>' +
      '<div class="bld-meta">' +
        (b.addr ? escapeHtml(b.addr) + ' / ' : '') +
        '全' + total + '区画 (使用中 ' + used + ')' +
      '</div>' +
    '</div>' +
    '<button class="bld-card-del" onclick="event.stopPropagation();deleteBldFromList(\''+b.id+'\')" title="この物件を削除">🗑</button>' +
  '</div>';
}

function renderList(){
  const all = loadAll();
  const q = (document.getElementById('search').value || '').trim().toLowerCase();
  let bldList = Object.values(all);
  if(q){
    bldList = bldList.filter(b =>
      (b.name||'').toLowerCase().includes(q) ||
      (b.addr||'').toLowerCase().includes(q)
    );
  }

  const listEl = document.getElementById('list');
  if(bldList.length === 0){
    listEl.innerHTML =
      '<div class="empty">' +
        '<div class="empty-icon">📁</div>' +
        '<div class="empty-text">' + (q ? '該当する物件がありません' : '物件がまだありません') + '</div>' +
        (!q ? '<button class="btn" onclick="openModal()">+ 最初の物件を追加</button>' : '') +
      '</div>';
    return;
  }

  // 都道府県でグループ化
  const groups = {};
  bldList.forEach(b => {
    const p = prefOf(b);
    (groups[p] = groups[p] || []).push(b);
  });
  // 表示順: 広島県 → 岡山県 → その他。広島・岡山は0件でも枠を表示
  const prefDefs = [
    { key: '広島県', label: 'HIROSHIMA', always: true },
    { key: '岡山県', label: 'OKAYAMA', always: true },
    { key: 'その他', label: 'その他', always: false }
  ];

  let html = '<div class="pref-grid">';
  prefDefs.forEach(def => {
    const items = (groups[def.key] || []).sort((a,b) => (a.name||'').localeCompare(b.name||'', 'ja'));
    if(items.length === 0 && !def.always) return;
    const collapsed = _prefCollapsed[def.key] ? ' collapsed' : '';
    html += '<div class="pref-folder' + collapsed + '" data-pref="' + escapeHtml(def.key) + '">' +
      '<div class="pref-header" onclick="togglePref(\'' + def.key + '\')">' +
        '<span class="pref-arrow">▼</span>' +
        '<span>' + escapeHtml(def.label) + '</span>' +
        '<span class="pref-count">' + items.length + '件</span>' +
      '</div>' +
      '<div class="pref-body">' +
        (items.length ? items.map(_bldCardHtml).join('') : '<div class="empty-folder">物件がありません</div>') +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  listEl.innerHTML = html;
}

// 物件を一覧画面から削除
function deleteBldFromList(id){
  const all = loadAll();
  const b = all[id];
  if(!b){ alert('物件が見つかりません'); return; }
  const total = (b.spots||[]).length;
  const used = (b.spots||[]).filter(s => s.status === '借').length;
  let msg = '物件「' + b.name + '」を削除します。\n';
  msg += '区画数: ' + total + ' (うち使用中: ' + used + ')\n\n';
  if(used > 0){
    msg += '⚠ 使用中の区画が ' + used + ' 件あります。本当に削除しますか？';
  } else {
    msg += 'よろしいですか？';
  }
  if(!confirm(msg)) return;
  // 二段階確認(誤操作防止)
  if(!confirm('⚠ 最終確認: 「' + b.name + '」と全' + total + '区画のデータが完全に削除されます。\nこの操作は取り消せません。\n本当に削除しますか？')) return;
  delete all[id];
  const ok = saveAll(all);
  if(ok){
    showToast('削除しました');
    renderAll();
  }
}

// ==============================
// モーダル: 開く/閉じる
// ==============================
// Googleマップを別タブで開く(物件住所)
function openMapForAddr(){
  const addr = (document.getElementById('f-addr').value || '').trim();
  if(!addr){
    alert('住所が入力されていません。\n先に住所を入力してください。');
    return;
  }
  const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);
  window.open(url, '_blank', 'noopener');
}

// ==============================
// 保管場所使用承諾書(発行モーダル)
// ==============================
let _shoudakuTargetSpotIdx = null;

function openShoudakuModal(spotIdx){
  _shoudakuTargetSpotIdx = spotIdx;
  // 編集中物件情報(モーダルから現在の値を取得)
  const bldName = document.getElementById('f-name').value.trim();
  const bldZip = document.getElementById('f-zip').value.trim();
  const bldAddr = document.getElementById('f-addr').value.trim();

  if(!bldName || !bldAddr){
    alert('物件名と住所を入力してから発行してください。');
    return;
  }

  // 区画情報をフォームから取得
  const spots = collectSpotsFromForm();
  // 区画番号で探す(並び替えに対応)
  const trList = document.querySelectorAll('#spots-tbody tr.spot-row');
  const tr = trList[spotIdx];
  if(!tr){
    alert('区画が見つかりません');
    return;
  }
  const noEl = tr.querySelector('[data-field="no"]');
  const noVal = parseInt(noEl ? noEl.value : 0);
  const spot = spots.find(s => s.no === noVal);
  if(!spot){
    alert('区画情報が取得できません');
    return;
  }
  if(!spot.user){
    if(!confirm('使用者が未入力です。空欄のまま続けますか?')){
      return;
    }
  }

  // 棟別住所のルックアップ
  // 区画の棟欄が「棟マスター」の棟と一致 → 棟マスターの住所を使用
  // それ以外(空白 or メイン棟ラベル一致 or 未登録の棟値) → 物件メイン住所
  let useZip = bldZip;
  let useAddr = bldAddr;
  if(spot.tou && Array.isArray(_touAddrs) && _touAddrs.length > 0){
    const touMatch = _touAddrs.find(ta => (ta.tou||'').trim() === spot.tou.trim());
    if(touMatch){
      if(touMatch.addr) useAddr = touMatch.addr;
      if(touMatch.zip) useZip = touMatch.zip;
    }
  }

  // 物件情報を表示
  document.getElementById('sd-bld-name').value = bldName;
  document.getElementById('sd-bld-zip').value = useZip;
  document.getElementById('sd-bld-addr').value = useAddr;
  document.getElementById('sd-spot-no').value = 'P' + String(spot.no).padStart(2,'0') +
    (spot.tou ? ' ' + spot.tou : '');
  // 使用者情報(住所は物件住所と同じ、住所=自動)
  document.getElementById('sd-user-zip').value = useZip;
  document.getElementById('sd-user-addr').value = useAddr;
  document.getElementById('sd-user-name').value = spot.user || '';
  document.getElementById('sd-user-tel').value = '';
  // 期間: デフォルトで今日〜2年後
  const today = new Date();
  const yr2 = new Date(today.getFullYear()+2, today.getMonth(), today.getDate());
  document.getElementById('sd-period-from').value = formatDateISO(today);
  document.getElementById('sd-period-to').value = formatDateISO(yr2);

  // 会社情報プレビュー(住所・氏名・電話のみ)
  const cmp = getCompanyInfo();
  let cmpHtml = '';
  if(cmp.zip) cmpHtml += '〒' + escapeHtml(cmp.zip) + '<br>';
  cmpHtml += escapeHtml(cmp.addr || '') + '<br>';
  cmpHtml += '<strong>' + escapeHtml(cmp.name || '') + '</strong>';
  if(cmp.tel) cmpHtml += '<br>電話: ' + escapeHtml(cmp.tel);
  document.getElementById('sd-company-preview').innerHTML = cmpHtml;

  // 所在図エリアをリセット
  clearShozaizu();

  // 配置図プレビュー表示(画像のみ。PDFスロットは飛ばして画像スロットを使う)
  let layoutUrl = '';
  const _mime = _currentImages.mime || {};
  const _isImg = (idv) => idv && _mime[idv] !== 'application/pdf' && !/pdf/i.test(idv);
  if(_isImg(_currentImages.layout_id)){
    layoutUrl = _currentImages.layout_url || _imgCache[_currentImages.layout_id] || '';
  } else if(_isImg(_currentImages.layout2_id)){
    layoutUrl = _currentImages.layout2_url || _imgCache[_currentImages.layout2_id] || '';
  }
  const haichiPrev = document.getElementById('sd-haichizu-preview');
  const haichiEmpty = document.getElementById('sd-haichizu-empty');
  if(layoutUrl){
    haichiPrev.src = layoutUrl;
    haichiPrev.style.display = '';
    haichiEmpty.style.display = 'none';
  } else {
    haichiPrev.src = '';
    haichiPrev.style.display = 'none';
    haichiEmpty.style.display = '';
  }

  document.getElementById('shoudaku-modal').classList.add('active');
}

// 所在図画像(モーダル発行ごとに一時保存)
let _shozaizuDataUrl = '';

// ドラッグオーバー
function onShozaizuDragOver(e){
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.background = '#e0f2fe';
  e.currentTarget.style.borderColor = '#0284c7';
}

function onShozaizuDragLeave(e){
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.background = '#f0f9ff';
  e.currentTarget.style.borderColor = '#0ea5e9';
}

// ドロップ
function onShozaizuDrop(e){
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.background = '#f0f9ff';
  e.currentTarget.style.borderColor = '#0ea5e9';
  const files = e.dataTransfer.files;
  if(files && files.length > 0){
    handleShozaizuFile(files[0]);
  }
}

// ファイル選択
function onShozaizuFileSelected(e){
  const file = e.target.files[0];
  if(!file) return;
  e.target.value = '';
  handleShozaizuFile(file);
}

// ファイル処理(共通)
function handleShozaizuFile(file){
  if(!file.type.startsWith('image/')){
    alert('画像ファイルを選んでください');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    setShozaizuImage(e.target.result);
  };
  reader.onerror = () => alert('画像の読込に失敗しました');
  reader.readAsDataURL(file);
}

// 画像をプレビュー表示
function setShozaizuImage(dataUrl){
  _shozaizuDataUrl = dataUrl;
  const img = document.getElementById('sd-shozaizu-preview');
  const ph = document.getElementById('sd-shozaizu-placeholder');
  const clr = document.getElementById('sd-shozaizu-clear');
  img.src = dataUrl;
  img.style.display = '';
  if(ph) ph.style.display = 'none';
  if(clr) clr.style.display = '';
}

// 所在図クリア
function clearShozaizu(){
  _shozaizuDataUrl = '';
  const img = document.getElementById('sd-shozaizu-preview');
  const ph = document.getElementById('sd-shozaizu-placeholder');
  const clr = document.getElementById('sd-shozaizu-clear');
  if(img){ img.src = ''; img.style.display = 'none'; }
  if(ph) ph.style.display = '';
  if(clr) clr.style.display = 'none';
}

// 承諾書モーダルの中だけで、Ctrl+V で画像を貼り付け
document.addEventListener('paste', function(e){
  const modal = document.getElementById('shoudaku-modal');
  if(!modal || !modal.classList.contains('active')) return;
  // 入力欄にフォーカスがある場合は通常のペースト(無視)
  const active = document.activeElement;
  if(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
  const items = (e.clipboardData || window.clipboardData).items;
  if(!items) return;
  for(let i = 0; i < items.length; i++){
    if(items[i].type.indexOf('image') >= 0){
      const file = items[i].getAsFile();
      if(file){
        e.preventDefault();
        handleShozaizuFile(file);
        showToast('✅ 所在図に貼り付けました');
        break;
      }
    }
  }
});

// Googleマップを開く(承諾書モーダルから)
function openMapFromShoudaku(){
  const addr = (document.getElementById('sd-bld-addr').value || '').trim();
  if(!addr){
    alert('住所がありません');
    return;
  }
  const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);
  window.open(url, '_blank', 'noopener');
}

function closeShoudakuModal(){
  document.getElementById('shoudaku-modal').classList.remove('active');
}

function formatDateISO(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return y + '-' + m + '-' + dd;
}

function formatDateJp(isoStr){
  if(!isoStr) return '';
  const parts = isoStr.split('-');
  if(parts.length !== 3) return isoStr;
  return parts[0] + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
}

// 印刷プレビュー
function printShoudaku(){
  const tel = document.getElementById('sd-user-tel').value.trim();
  const fromDate = document.getElementById('sd-period-from').value;
  const toDate = document.getElementById('sd-period-to').value;
  if(!tel){
    if(!confirm('使用者の電話番号が未入力です。空欄のまま続けますか?')){
      return;
    }
  }
  if(!fromDate || !toDate){
    alert('使用期間(開始日・終了日)を入力してください');
    return;
  }
  // 印刷用ウィンドウを開く
  generateShoudakuPrint({
    bldName: document.getElementById('sd-bld-name').value,
    bldZip: document.getElementById('sd-bld-zip').value,
    bldAddr: document.getElementById('sd-bld-addr').value,
    spotNo: document.getElementById('sd-spot-no').value,
    userName: document.getElementById('sd-user-name').value,
    userTel: tel,
    periodFrom: fromDate,
    periodTo: toDate,
    company: getCompanyInfo(),
    layoutImageUrl: (function(){
      const m = _currentImages.mime || {};
      const isImg = (idv) => idv && m[idv] !== 'application/pdf' && !/pdf/i.test(idv);
      if(isImg(_currentImages.layout_id)) return _currentImages.layout_url || _imgCache[_currentImages.layout_id] || '';
      if(isImg(_currentImages.layout2_id)) return _currentImages.layout2_url || _imgCache[_currentImages.layout2_id] || '';
      return '';
    })(),
    shozaizuImageUrl: _shozaizuDataUrl || ''
  });
}

function generateShoudakuPrint(data){
  const today = new Date();
  const todayJp = today.getFullYear()+'年'+(today.getMonth()+1)+'月'+today.getDate()+'日';
  const cmp = data.company;
  const cmpHeader = cmp.zip ? '〒'+cmp.zip+'<br>' : '';

  // 期間日付を年/月/日に分解(標準書式用)
  function splitYMD(dateStr){
    if(!dateStr) return {y:'　　', m:'　　', d:'　　'};
    const m = String(dateStr).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(!m) return {y:'　　', m:'　　', d:'　　'};
    return {y: m[1], m: m[2], d: m[3]};
  }
  const periodFromYMD = splitYMD(data.periodFrom);
  const periodToYMD = splitYMD(data.periodTo);

  const layoutImgHtml = data.layoutImageUrl
    ? '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><img src="'+data.layoutImageUrl+'" style="max-width:100%;max-height:420px;object-fit:contain;"></div>'
    : '<div style="color:#999;text-align:center;padding-top:80px;">(配置図未登録)</div>';

  // 所在図(スクショ貼付)
  const shozaizuImgHtml = data.shozaizuImageUrl
    ? '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><img src="'+data.shozaizuImageUrl+'" style="max-width:100%;max-height:420px;object-fit:contain;"></div>'
    : '<div style="color:#999;text-align:center;">(Googleマップのスクリーンショットを<br>貼付してください)</div>';

  const html = '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>保管場所使用承諾書</title>' +
    '<style>' +
    '@page{size:A4 landscape;margin:8mm 12mm;}' +
    'body{font-family:"MS Gothic","Yu Gothic",sans-serif;font-size:11pt;color:#000;line-height:1.5;margin:0;}' +
    '.page-break{page-break-after:always;break-after:page;height:0;display:block;}' +
    '.page{padding:0;}' +
    '.page-shoudaku{}' +
    '.page-shozai{page-break-inside:avoid;page-break-before:always;break-before:page;}' +
    'h1{font-size:18pt;text-align:center;border:1.5px solid #000;padding:8px;margin:0 0 10px;letter-spacing:6px;}' +
    'h2{font-size:14pt;text-align:center;margin:4px 0 8px;font-weight:700;letter-spacing:4px;}' +
    '.section-title{font-size:11pt;text-align:right;margin-bottom:4px;}' +
    'table.shoudaku{width:100%;border-collapse:collapse;margin:6px 0;}' +
    'table.shoudaku td{border:1.5px solid #000;padding:8px 12px;vertical-align:middle;font-size:11pt;}' +
    'table.shoudaku .label{width:130px;background:#f5f5f5;font-weight:700;text-align:center;white-space:nowrap;}' +
    /* 標準書式用 詳細スタイル */
    'table.shoudaku-std td.val{height:32px;}' +
    'table.shoudaku-std .val-period{padding:10px 12px;}' +
    '.period-row{display:flex;align-items:center;gap:4px;margin:3px 0;font-size:11pt;white-space:nowrap;}' +
    '.period-date{display:inline-block;min-width:48px;text-align:center;border-bottom:1px solid #000;padding:0 4px;}' +
    '.period-conn{margin-left:14px;font-weight:700;}' +
    'table.shoudaku-std .val-person{padding:10px 12px;}' +
    '.row-zip{font-size:10.5pt;margin-bottom:4px;white-space:nowrap;}' +
    '.row-line{font-size:11pt;margin:3px 0;display:flex;align-items:center;white-space:nowrap;}' +
    '.row-label{display:inline-block;width:72px;font-weight:700;letter-spacing:6px;flex-shrink:0;}' +
    '.confirm-text{margin:14px 0;font-size:11pt;}' +
    '.right{text-align:right;}' +
    '.center{text-align:center;}' +
    /* 別記様式第2号(所在図ページ) */
    '.youshiki-table{width:100%;border-collapse:collapse;margin-top:6px;}' +
    '.youshiki-table th{border:2px solid #000;padding:5px;background:#f5f5f5;font-size:11pt;text-align:center;}' +
    '.youshiki-table td{border:2px solid #000;height:320px;vertical-align:middle;padding:6px;text-align:center;}' +
    '.shutter-label{font-size:9.5pt;margin-top:6px;}' +
    '.notes{font-size:8pt;line-height:1.4;margin-top:6px;}' +
    '</style></head><body>' +

    /* 1枚目: 保管場所使用承諾証明書(A4縦向き・標準書式 別記様式第2) */
    '<div class="page page-shoudaku">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:4px;">' +
      '<span style="font-size:9pt;">別記様式第２</span>' +
      '<span style="font-size:9pt;">警察署長提出用</span>' +
    '</div>' +
    '<h1>保 管 場 所 使 用 承 諾 証 明 書</h1>' +

    /* 標準書式: 縦1カラム積み上げ */
    '<table class="shoudaku shoudaku-std">' +
      /* 保管場所の位置 */
      '<tr>' +
        '<td class="label" rowspan="1">保管場所の位置</td>' +
        '<td class="val" colspan="3">'+escapeHtml(data.bldAddr)+'</td>' +
      '</tr>' +
      /* 駐車場の名称 */
      '<tr>' +
        '<td class="label">駐車場の名称</td>' +
        '<td class="val" colspan="3">'+escapeHtml(data.bldName)+'</td>' +
      '</tr>' +
      /* 使用期間: 年月日罫線スタイル */
      '<tr>' +
        '<td class="label">使用期間</td>' +
        '<td class="val val-period" colspan="3">' +
          '<div class="period-row">' +
            '<span class="period-date">'+periodFromYMD.y+'</span>年' +
            '<span class="period-date">'+periodFromYMD.m+'</span>月' +
            '<span class="period-date">'+periodFromYMD.d+'</span>日' +
            '<span class="period-conn">から</span>' +
          '</div>' +
          '<div class="period-row">' +
            '<span class="period-date">'+periodToYMD.y+'</span>年' +
            '<span class="period-date">'+periodToYMD.m+'</span>月' +
            '<span class="period-date">'+periodToYMD.d+'</span>日' +
            '<span class="period-conn">まで</span>' +
          '</div>' +
        '</td>' +
      '</tr>' +
      /* 使用者 */
      '<tr>' +
        '<td class="label">使用者</td>' +
        '<td class="val val-person" colspan="3">' +
          '<div class="row-zip">〒（' + (data.bldZip ? escapeHtml(data.bldZip) : '　　　－　　　　') + '）</div>' +
          '<div class="row-line"><span class="row-label">住　所</span>'+escapeHtml(data.bldAddr)+'</div>' +
          '<div class="row-line"><span class="row-label">氏　名</span>'+escapeHtml(data.userName)+'</div>' +
          '<div class="row-line"><span class="row-label">電　話</span>'+escapeHtml(data.userTel)+'</div>' +
        '</td>' +
      '</tr>' +
      /* 承諾者(貸主) */
      '<tr>' +
        '<td class="label">承諾者</td>' +
        '<td class="val val-person" colspan="3">' +
          '<div class="row-zip">〒（' + (cmp.zip ? escapeHtml(cmp.zip) : '　　　－　　　　') + '）</div>' +
          '<div class="row-line"><span class="row-label">住　所</span>'+escapeHtml(cmp.addr || '')+'</div>' +
          '<div class="row-line"><span class="row-label">氏　名</span>'+escapeHtml(cmp.name || '')+'</div>' +
          '<div class="row-line"><span class="row-label">電　話</span>'+escapeHtml(cmp.tel || '')+'</div>' +
        '</td>' +
      '</tr>' +
    '</table>' +

    '<p class="confirm-text" style="margin-top:14px;">　　上記のとおり自動車の保管場所としての使用を承諾したことを証明する。</p>' +
    '<p class="right" style="margin-top:18px;margin-right:40px;">'+todayJp+'</p>' +
    '<p style="font-size:9pt;margin-top:14px;">注　共有の場合は、必要な共有者全員の住所・氏名を記入してください。</p>' +
    '<p style="font-size:9pt;margin-top:4px;">備考　用紙の大きさは、日本産業規格Ａ４とする。</p>' +
    '</div>' +

    /* 2枚目: 別記様式第2号(A4横向き) */
    '<div class="page page-shozai">' +
    '<div style="text-align:right;font-size:9pt;margin-bottom:4px;">別記様式第2号</div>' +
    '<h2>保管場所の所在図・配置図</h2>' +
    '<table class="youshiki-table">' +
    '<tr><th style="width:50%;">所在図記載欄</th><th style="width:50%;">配置図記載欄</th></tr>' +
    '<tr>' +
    '<td>'+shozaizuImgHtml+'</td>' +
    '<td>'+layoutImgHtml+'</td>' +
    '</tr>' +
    '</table>' +
    '<p class="shutter-label">シャッターの有無    有 ・ 無</p>' +
    '<div class="notes">' +
      '1 使用の本拠の位置が旧自動車に係る使用の本拠の位置と同一であり、かつ、保管場所が旧自動車の保管場所である場合又は使用の本拠の位置が保管場所と同一である場合には、所在図を省略することができます。<br>' +
      '2 所在図には、保管場所付近の道路及び目標となる地物を表示するほか、自動車の使用の本拠の位置及び保管場所の位置を明記し、これらの位置を直線で結んだ上で、その間の距離を明記してください。<br>' +
      '3 所在図は、本様式に記載せず、保管場所付近の道路及び目標となる地物が確認できる既存の地図の写しを用いても構いません。<br>' +
      '4 配置図には、保管場所並びに保管場所の周囲の建物、空地及び道路を表示するほか、保管場所にあってはその平面の寸法、保管場所に接する道路にあってはその幅員を明記してください。' +
    '</div>' +
    '</div>' +

    '<scr'+'ipt>' +
    'window.addEventListener("load", function(){' +
      /* 画像があれば全て読み込み完了を待ってから印刷ダイアログを開く */
      'var imgs = document.querySelectorAll("img");' +
      'if(imgs.length === 0){' +
        'setTimeout(function(){window.print();}, 200);' +
        'return;' +
      '}' +
      'var loaded = 0, total = imgs.length;' +
      'var checkDone = function(){' +
        'loaded++;' +
        'if(loaded >= total){ setTimeout(function(){window.print();}, 300); }' +
      '};' +
      'imgs.forEach(function(img){' +
        'if(img.complete){ checkDone(); }' +
        'else{ img.addEventListener("load", checkDone); img.addEventListener("error", checkDone); }' +
      '});' +
      /* 最大3秒経ったら強制印刷(画像読込が失敗した場合のフェイルセーフ) */
      'setTimeout(function(){ if(loaded < total){ window.print(); } }, 3000);' +
    '});' +
    '<\/scr'+'ipt>' +

    '<\/body><\/html>';
  // 承諾書は新しいタブで開いて印刷する(A4横2枚の改ページを確実にするため)
  try{
    if(window.PV_IS_IOS){ showDocOverlay(html, '保管場所使用承諾書'); return; }
    const w = window.open('', '_blank');
    if(w && w.document){
      w.document.open();
      w.document.write(html);
      w.document.close();
    } else {
      // ポップアップがブロックされた場合はオーバーレイ表示にフォールバック
      showDocOverlay(html, '保管場所使用承諾書');
    }
  }catch(e){
    showDocOverlay(html, '保管場所使用承諾書');
  }
}

// ==============================
// 書類を画面内オーバーレイで表示(印刷時は書類だけを残し、後ろの本体は隠す)
// ==============================
function showDocOverlay(html, title){
  // iPhone / iPad は、はじめから見やすい画面で出します。
  // (黒い帯の画面をもう一枚重ねると、押す回数が増えるため)
  if(window.PV_IS_IOS && window.PV_PRINT_HTML){
    window.PV_PRINT_HTML(html, String(title||'').replace(/[^ぁ-んァ-ヶ一-龠A-Za-z0-9]/g,''));
    return;
  }
  closeDocOverlay();
  let styleHtml = '';
  const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
  if(styleMatches){ styleHtml = styleMatches.join('\n'); }
  let bodyHtml = '';
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if(bodyMatch){ bodyHtml = bodyMatch[1]; } else { bodyHtml = html; }
  bodyHtml = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
  const ov = document.createElement('div');
  ov.id = 'doc-overlay';
  ov.innerHTML =
    '<div class="doc-ov-bar">' +
      '<span class="doc-ov-title">' + (title || '書類') + '</span>' +
      '<div class="doc-ov-actions">' +
        '<button type="button" class="doc-ov-btn doc-ov-print" onclick="printDocOverlay()">PDF保存 / 印刷</button>' +
        '<button type="button" class="doc-ov-btn doc-ov-close" onclick="closeDocOverlay()">✕ 閉じる</button>' +
      '</div>' +
    '</div>' +
    '<div class="doc-ov-body"><div id="doc-ov-content" class="doc-ov-content">' + styleHtml + bodyHtml + '</div></div>';
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
}
function printDocOverlay(){
  document.body.classList.add('doc-printing');
  const cleanup = function(){ document.body.classList.remove('doc-printing'); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(function(){ try{ window.print(); }catch(e){} }, 100);
  setTimeout(cleanup, 60000);
}
function closeDocOverlay(){
  const ov = document.getElementById('doc-overlay');
  if(ov){ ov.remove(); }
  document.body.classList.remove('doc-printing');
  document.body.style.overflow = '';
}
try{ window.printDocOverlay = printDocOverlay; window.closeDocOverlay = closeDocOverlay; }catch(e){}

// ==============================
// 駐車場賃貸借契約書(発行モーダル)
// ==============================
const INKAN_BASE64 = 'data:image/png;base64,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'; // IREライフ丸印
const LOGO_BASE64 = 'data:image/png;base64,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'; // IRE Life ロゴ
let _keiyakuTargetSpotIdx = null;

function openKeiyakuModal(spotIdx){
  _keiyakuTargetSpotIdx = spotIdx;
  const bldId = currentEditId;
  if(!bldId){ alert('物件IDが見つかりません'); return; }
  const all = loadAll();
  const bld = all[bldId];
  if(!bld){ alert('物件情報が見つかりません'); return; }
  const spots = collectSpotsFromForm();
  const spot = spots[spotIdx];
  if(!spot){ alert('区画情報が見つかりません'); return; }
  // 自動セット
  document.getElementById('ky-bld-name').value = bld.name || '';
  // 駐車場の所在地: 物件住所の末尾に「物件名 号室」を追記
  // (号室は区画の号室があれば使用。予約中なら res_room を使用)
  var _bldAddr = bld.addr || '';
  var _bldSuffix = bld.name ? (' ' + bld.name) : '';
  var _bldRm = (spot.room || spot.res_room || '');
  if(_bldRm) _bldSuffix += ' ' + _bldRm + '号室';
  document.getElementById('ky-bld-addr').value = (_bldAddr + _bldSuffix).trim();
  const spotNoStr = 'P' + String(spot.no || (spotIdx+1)).padStart(2,'0') + (spot.tou ? ' '+spot.tou+'棟' : '');
  document.getElementById('ky-spot-no').value = spotNoStr;
  document.getElementById('ky-price').value = (Number(spot.price)||0).toLocaleString();
  document.getElementById('ky-tax-rate').value = '10';
  // 賃借人:区画の使用者を初期値に
  document.getElementById('ky-user-name').value = spot.user || '';
  // 借主住所: 物件住所の末尾に「物件名 号室」を追記
  // (号室は区画の号室があれば使用。棟があれば棟も付ける)
  var _addr = bld.addr || '';
  var _suffix = bld.name ? (' ' + bld.name) : '';
  var _rm = (spot.room || spot.res_room || '');
  var _to2 = (spot.tou || spot.res_tou || '');
  if(_to2) _suffix += ' ' + _to2 + '棟';
  if(_rm) _suffix += ' ' + _rm + '号';
  document.getElementById('ky-user-addr').value = (_addr + _suffix).trim();
  // 契約日:今日、期間:今日〜2年後の前日
  const today = new Date();
  const isoDate = (d) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  document.getElementById('ky-contract-date').value = isoDate(today);
  document.getElementById('ky-period-from').value = isoDate(today);
  const to = new Date(today); to.setFullYear(to.getFullYear()+2); to.setDate(to.getDate()-1);
  document.getElementById('ky-period-to').value = isoDate(to);
  document.getElementById('keiyaku-modal').classList.add('active');
}

function closeKeiyakuModal(){
  document.getElementById('keiyaku-modal').classList.remove('active');
  _keiyakuTargetSpotIdx = null;
}

// 開始日変更時に終了日を2年後に自動セット
function onKeiyakuPeriodFromChange(){
  const fromVal = document.getElementById('ky-period-from').value;
  if(!fromVal) return;
  const d = new Date(fromVal);
  if(isNaN(d.getTime())) return;
  d.setFullYear(d.getFullYear()+2);
  d.setDate(d.getDate()-1);
  const iso = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  document.getElementById('ky-period-to').value = iso;
}

function printKeiyaku(){
  const userName = document.getElementById('ky-user-name').value.trim();
  let userAddr = document.getElementById('ky-user-addr').value.trim();
  let bldAddrVal = document.getElementById('ky-bld-addr').value.trim();
  // 印刷時の補完: 物件名・号室がまだ住所に含まれていなければ追記(既存契約でも確実に付く/二重付与しない)
  try{
    const _bn = (document.getElementById('ky-bld-name').value || '').trim();
    let _rm = '', _to = '';
    if(typeof _keiyakuTargetSpotIdx !== 'undefined' && _keiyakuTargetSpotIdx != null && typeof collectSpotsFromForm === 'function'){
      const _spots = collectSpotsFromForm();
      const _sp = _spots && _spots[_keiyakuTargetSpotIdx];
      if(_sp){ _rm = (_sp.room || _sp.res_room || ''); _to = (_sp.tou || _sp.res_tou || ''); }
    }
    let _suf = '';
    if(_bn && userAddr.indexOf(_bn) < 0) _suf += ' ' + _bn;
    if(_to && userAddr.indexOf(_to + '棟') < 0) _suf += ' ' + _to + '棟';
    if(_rm && userAddr.indexOf(_rm + '号') < 0) _suf += ' ' + _rm + '号';
    if(_suf) userAddr = (userAddr + _suf).trim();
    let _suf2 = '';
    if(_bn && bldAddrVal.indexOf(_bn) < 0) _suf2 += ' ' + _bn;
    if(_rm && bldAddrVal.indexOf(_rm + '号室') < 0) _suf2 += ' ' + _rm + '号室';
    if(_suf2) bldAddrVal = (bldAddrVal + _suf2).trim();
  }catch(e){}
  const periodFrom = document.getElementById('ky-period-from').value;
  const periodTo = document.getElementById('ky-period-to').value;
  if(!userName){ alert('賃借人(乙)の氏名を入力してください(契約書本文の識別に使用)'); return; }
  if(!periodFrom || !periodTo){ alert('賃貸借期間を入力してください'); return; }
  generateKeiyakuPrint({
    bldName: document.getElementById('ky-bld-name').value,
    bldAddr: bldAddrVal,
    spotNo: document.getElementById('ky-spot-no').value,
    price: parseInt(String(document.getElementById('ky-price').value).replace(/[^0-9]/g,''),10) || 0,
    taxRate: parseFloat(document.getElementById('ky-tax-rate').value) || 10,
    userName: userName,
    userAddr: userAddr,
    periodFrom: periodFrom,
    periodTo: periodTo,
    contractDate: document.getElementById('ky-contract-date').value,
    company: getCompanyInfo()
  });
}

function generateKeiyakuPrint(data){
  // 日付フォーマッタ
  const fmtJp = (dateStr) => {
    if(!dateStr) return '　　　年　　月　　日';
    const m = String(dateStr).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(!m) return dateStr;
    return m[1]+'年'+parseInt(m[2],10)+'月'+parseInt(m[3],10)+'日';
  };

  // 賃料・税額計算
  const price = data.price;
  const taxRate = data.taxRate;
  const taxAmount = Math.round(price - price/(1+taxRate/100));
  const formatYen = (n) => n.toLocaleString();

  const cmp = data.company;
  const cmpName = cmp.name || 'IREライフ株式会社';
  const cmpAddr = cmp.addr || '広島県福山市南手城町2丁目15-6';
  const cmpRepTitle = cmp.rep_title || '代表取締役';
  const cmpRepName = cmp.rep_name || '淺野 充弘';
  const cmpInvoice = cmp.invoice_no || 'T9240001050012';

  const contractDateJp = fmtJp(data.contractDate);

  const html = '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>駐車場賃貸借契約書</title>' +
    '<style>' +
    '@page{size:A3 landscape;margin:7mm 8mm;}' +
    'html,body{margin:0;padding:0;}' +
    'body{font-family:"MS Mincho","Yu Mincho",serif;font-size:12.5pt;color:#000;line-height:1.7;margin:0;}' +
    '.sheet{width:100%;page-break-inside:avoid;break-inside:avoid;page-break-after:avoid;break-after:avoid;overflow:hidden;}' +
    '@media print{.sheet{page-break-after:avoid;break-after:avoid;} .sheet *{page-break-inside:avoid;}}' +
    '.title{font-size:26pt;text-align:center;font-weight:700;letter-spacing:14px;margin:8px 0 40px 0;}' +
    '.cols{display:grid;grid-template-columns:1fr 1fr;gap:12mm;}' +
    '.col{}' +
    '.lead{font-size:12.5pt;margin:0 0 6px;line-height:1.75;}' +
    '.clause-title{font-size:13.5pt;font-weight:700;margin:4px 0 2px;}' +
    '.clause-body{font-size:12.5pt;margin:0 0 2px;text-indent:0;line-height:1.7;}' +
    '.clause-body ol{margin:1px 0 2px 30px;padding:0;}' +
    '.clause-body ol li{margin:0;}' +
    '.bld-info{margin:2px 0 4px 18px;font-size:12.5pt;line-height:1.8;}' +
    '.sign-block{margin-top:8px;border-top:1px solid #000;padding-top:7px;font-size:12.5pt;line-height:1.85;position:relative;}' +
    '.sign-line{display:flex;align-items:baseline;margin-bottom:1px;}' +
    '.sign-label{display:inline-block;width:68px;font-weight:700;flex-shrink:0;}' +
    '.sign-val{flex:1;border-bottom:1px solid #000;padding:0 8px;min-height:22px;position:relative;}' +
    '.sign-val.nodash{border-bottom:none;}' +
    '.party-label{font-weight:700;font-size:12.5pt;margin-top:4px;}' +
    '.inkan-wrap{position:absolute;right:36px;top:18px;width:88px;height:88px;}' +
    '.inkan-wrap img{width:100%;height:100%;object-fit:contain;}' +
    /* 「印」テキストマーク: 行の右端に固定配置(会社印画像と縦に揃える) */
    '.inkan-mark{position:absolute;right:44px;top:0;font-weight:700;color:#000;}' +
    '.inkan-mark-kou{right:44px;}' +
    '.sign-name-otsu{display:flex;align-items:center;}' +
    '.tail-text{font-size:12.5pt;margin:6px 0 3px;line-height:1.8;}' +
    '</style></head><body>' +
    '<div class="sheet">' +
      '<h1 class="title">駐車場賃貸借契約書</h1>' +
      '<div class="cols">' +
        /* 左ページ */
        '<div class="col">' +
          '<p class="lead">' +
            '賃貸代理人：' + escapeHtml(cmpName) + '(以下、「甲」という。)と賃借人 ' + escapeHtml(data.userName) + '(以下、「乙」という。)は、以下のとおり駐車場賃貸借契約(以下、「本契約」という。)を締結する。' +
          '</p>' +
          '<div class="clause-title">目的：第1条</div>' +
          '<p class="clause-body">甲は下記記載の駐車場の専有部分(以下、「本件駐車場」という。)を、乙が賃借する下記物件の駐車場として、本契約書に記載の条件にて乙に賃貸する。</p>' +
          '<div class="bld-info">' +
            '駐車場の表示：' + escapeHtml(data.bldName) + '<br>' +
            '駐車場の所在地：' + escapeHtml(data.bldAddr) + '<br>' +
            '専用区画1台「' + escapeHtml(data.spotNo) + '」' +
          '</div>' +
          '<div class="clause-title">賃料：第2条</div>' +
          '<p class="clause-body">賃料は月額金 ' + formatYen(price) + ' 円(消費税率' + taxRate + '%、うち消費税' + formatYen(taxAmount) + '円)とし、毎月27日に翌月分を口座振替にて支払うものとする。</p>' +
          '<div class="clause-title">賃貸借期間：第3条</div>' +
          '<p class="clause-body">本契約の有効期間は、' + fmtJp(data.periodFrom) + 'から' + fmtJp(data.periodTo) + 'までの満2年間とする。<br>' +
          '前項の期間満了1ヶ月前迄に甲または乙どちらかの相手方に対する解約の申し入れがない場合は、自動的に同条件にて2年間契約を更新し、以後も同様とする。</p>' +
          '<div class="clause-title">禁止事項：第4条</div>' +
          '<p class="clause-body">乙は、次に掲げる行為をすることができない。</p>' +
          '<div class="clause-body"><ol>' +
            '<li>本件駐車場を第三者に賃貸し、又は第三者に賃借権を譲渡すること</li>' +
            '<li>本件駐車場に建物その他の工作物を設置し、又は現状に変更を加えること</li>' +
            '<li>本件駐車場を駐車場以外の目的で利用してはいけない</li>' +
          '</ol></div>' +
          '<div class="clause-title">甲の免責事項：第5条</div>' +
          '<p class="clause-body">不可抗力、第三者の行為、その他甲の責めに帰すべき事由以外の事由により、乙の利用車両から生じた損害については、甲は一切責任を負わないものとする。</p>' +
          '<div class="clause-title">解約：第6条</div>' +
          '<div class="clause-body"><ol>' +
            '<li>甲乙は、いずれかの一方から本契約の解約を申し入れることができる。ただし、1ヶ月以上前に相手方に対して書面で通知すべきものとする。</li>' +
            '<li>乙が、前項の通知なく解約をなす場合には、1ヶ月分の賃料に相当する金員を甲に支払うものとする。</li>' +
            '<li>第1項に基づく中途解約が行われる場合、当該中途解約の日が属する月に係る賃料については、日割りにて精算する。</li>' +
          '</ol></div>' +
        '</div>' +
        /* 右ページ */
        '<div class="col">' +
          '<div class="clause-title">契約解除：第7条</div>' +
          '<p class="clause-body">甲は、乙が本契約に違反したときは、何らの催告をしないで直ちに本契約を解除することができる。</p>' +
          '<div class="clause-title">明け渡し：第8条</div>' +
          '<p class="clause-body">本契約が期間の満了により終了し、又は前条により解除されたときは、乙は直ちに本件駐車場を甲に返還するものとする。</p>' +
          '<div class="clause-title">協議：第9条</div>' +
          '<p class="clause-body">甲及び乙は、本契約に定めのない事項が生じたときや、本契約の各条項の解釈につき疑義が生じたときは、信義誠実の原則に従い協議し、円満に解決を図るものとする。</p>' +
          '<div class="clause-title">特約事項：第10条</div>' +
          '<div class="clause-body"><ol>' +
            '<li>乙の希望により、各種証明書等が必要な場合は金3,300 円(消費税率10%、うち消費税300円)にて甲が交付するものとする。</li>' +
            '<li>賃料及び証明書等発行料は、税法の改正により消費税等の税率が増減した場合は、改正税法施行日以降における増減後の税率により計算した税額とする。</li>' +
            '<li>甲乙共に反社会的勢力でないことを確約し、これに違反した場合、相手方は無催告で本契約を解除することができる。</li>' +
          '</ol></div>' +
          '<p class="tail-text">以上のとおり契約が成立したことを証するため、本書2通を作成し、甲乙各自署名のうえ、甲乙各自その1通を保有する。</p>' +
          '<p style="text-align:right;font-size:9.5pt;margin:8px 0 4px;">' + contractDateJp + '</p>' +
          '<div class="sign-block">' +
            '<div class="inkan-wrap"><img src="' + INKAN_BASE64 + '" alt="印"></div>' +
            '<div class="party-label">賃貸代理人(甲)</div>' +
            '<div class="sign-line"><span class="sign-label">住所</span><span class="sign-val">' + escapeHtml(cmpAddr) + '</span></div>' +
            '<div class="sign-line"><span class="sign-label">氏名</span><span class="sign-val sign-name-kou">' + escapeHtml(cmpName) + '<span class="inkan-mark inkan-mark-kou">印</span></span></div>' +
            '<div class="sign-line"><span class="sign-label">　</span><span class="sign-val nodash">' + escapeHtml(cmpRepTitle) + '　' + escapeHtml(cmpRepName) + '</span></div>' +
            '<div class="sign-line"><span class="sign-label">登録番号</span><span class="sign-val">' + escapeHtml(cmpInvoice) + '</span></div>' +
            '<div class="party-label" style="margin-top:14px;">賃借人(乙)</div>' +
            '<div class="sign-line"><span class="sign-label">住所</span><span class="sign-val">' + escapeHtml(data.bldAddr) + '</span></div>' +
            '<div class="sign-line"><span class="sign-label">氏名</span><span class="sign-val sign-name-otsu">&nbsp;<span class="inkan-mark">印</span></span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<scr'+'ipt>' +
    'window.addEventListener("load", function(){' +
      'var imgs = document.querySelectorAll("img");' +
      'if(imgs.length === 0){ setTimeout(function(){window.print();}, 200); return; }' +
      'var loaded = 0, total = imgs.length;' +
      'var checkDone = function(){ loaded++; if(loaded >= total){ setTimeout(function(){window.print();}, 300); } };' +
      'imgs.forEach(function(img){ if(img.complete){ checkDone(); } else{ img.addEventListener("load", checkDone); img.addEventListener("error", checkDone); } });' +
      'setTimeout(function(){ if(loaded < total){ window.print(); } }, 3000);' +
    '});' +
    '<\/scr'+'ipt>' +
    '<\/body><\/html>';
  showDocOverlay(html, '駐車場賃貸借契約書');

}

// ==============================
// 請求書(発行モーダル)
// ==============================
let _seikyuTargetSpotIdx = null;
let _seikyuItems = [];  // 請求項目配列
let _seikyuContext = {bldName:'', spotNoStr:'', monthlyTaxIncluded:0, monthlyNoTax:0};  // モーダル開いてる間の物件情報

function openSeikyuModal(spotIdx){
  _seikyuTargetSpotIdx = spotIdx;
  const bldId = currentEditId;
  if(!bldId){ alert('物件IDが見つかりません'); return; }
  const all = loadAll();
  const bld = all[bldId];
  if(!bld){ alert('物件情報が見つかりません'); return; }
  const spots = collectSpotsFromForm();
  const spot = spots[spotIdx];
  if(!spot){ alert('区画情報が見つかりません'); return; }

  // 宛先初期値: 使用者
  document.getElementById('sk-to-name').value = spot.user || '';
  document.getElementById('sk-to-title').value = '様';
  document.getElementById('sk-to-addr').value = '';

  // 請求日:今日、支払期限:翌月末
  const today = new Date();
  const isoDate = (d) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  document.getElementById('sk-issue-date').value = isoDate(today);
  // 支払期限: 翌月27日(賃料口座振替に合わせる)
  const due = new Date(today);
  due.setMonth(due.getMonth() + 1);
  due.setDate(27);
  document.getElementById('sk-due-date').value = isoDate(due);
  // 請求書番号: INV-YYYYMM-XXX(自動)
  const ym = today.getFullYear() + String(today.getMonth()+1).padStart(2,'0');
  const rand = String(Math.floor(Math.random()*900)+100);
  document.getElementById('sk-invoice-no').value = 'INV-'+ym+'-'+rand;

  // 件名初期値: ○月分 駐車場使用料
  const m = today.getMonth() + 1;
  document.getElementById('sk-subject').value = m + '月分 駐車場使用料';

  // 請求項目: 駐車場使用料を初期セット
  // 月額(税込)からの税抜換算
  const taxIncluded = Number(spot.price) || 0;
  const unitPriceNoTax = Math.round(taxIncluded / 1.1);
  const spotNoStr = 'P' + String(spot.no || (spotIdx+1)).padStart(2,'0') + (spot.tou ? ' '+spot.tou+'棟' : '') + (spot.room ? ' '+spot.room : '');
  _seikyuItems = [{
    label: bld.name + ' / ' + spotNoStr + ' 駐車場使用料',
    qty: 1,
    unitPrice: unitPriceNoTax,
    taxRate: 10
  }];
  // 契約開始日初期値: 今日(月初の請求ならユーザーが調整可能)
  document.getElementById('sk-contract-start').value = isoDate(today);
  // 月額(税込)・物件情報・区画番号をモーダル全体で参照できるよう保持
  _seikyuContext = {
    bldName: bld.name || '',
    spotNoStr: spotNoStr,
    monthlyTaxIncluded: taxIncluded,
    monthlyNoTax: unitPriceNoTax
  };
  renderSeikyuItems();

  document.getElementById('sk-pay-method').value = 'bank';
  document.getElementById('sk-note').value = '';

  document.getElementById('seikyu-modal').classList.add('active');
}

function closeSeikyuModal(){
  document.getElementById('seikyu-modal').classList.remove('active');
  _seikyuTargetSpotIdx = null;
  _seikyuItems = [];
  _seikyuContext = {bldName:'', spotNoStr:'', monthlyTaxIncluded:0, monthlyNoTax:0};
}

// ===== 日割り計算ヘルパー =====
function calcNissariUnitPrice(){
  // 契約開始日から その月の月末まで の日割り(税抜単価ベース)
  const startStr = document.getElementById('sk-contract-start').value;
  if(!startStr) return null;
  const start = new Date(startStr);
  if(isNaN(start.getTime())) return null;
  const year = start.getFullYear();
  const month = start.getMonth();  // 0-indexed
  // その月の日数
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // 開始日から月末までの日数
  const day = start.getDate();
  const billDays = daysInMonth - day + 1;
  // 日割り単価(税抜) = 月額税抜 × (billDays / daysInMonth)
  // 月額は、まず物件に登録された月額(monthlyNoTax)を使う。
  // 0円の場合は、請求項目の「駐車場使用料」行に入力された単価を月額とみなす。
  let monthlyNoTax = _seikyuContext.monthlyNoTax || 0;
  if(monthlyNoTax <= 0){
    // 日割り行・手数料行ではない最初の項目(=駐車場使用料)の単価を使う
    const base = _seikyuItems.find(it => it._kind !== 'nissari' && it._kind !== 'chukai' && it._kind !== 'meigi' && it._kind !== 'shoudaku' && (Number(it.unitPrice) > 0));
    if(base){ monthlyNoTax = Number(base.unitPrice) || 0; }
  }
  if(monthlyNoTax <= 0) return null;
  const nissariNoTax = Math.round(monthlyNoTax * billDays / daysInMonth);
  return {
    nissariNoTax: nissariNoTax,
    billDays: billDays,
    daysInMonth: daysInMonth,
    startStr: startStr,
    year: year,
    month: month + 1,
    day: day
  };
}

// 契約開始日を変更したら、既存の日割り行があれば再計算
function onSeikyuStartDateChange(){
  // 既存の「日割り賃料」を含むラベルの行を探して再計算
  let changed = false;
  _seikyuItems.forEach((it, i) => {
    if(it._kind === 'nissari'){
      const calc = calcNissariUnitPrice();
      if(calc){
        it.unitPrice = calc.nissariNoTax;
        it.label = _seikyuContext.bldName + ' / ' + _seikyuContext.spotNoStr + ' 日割り賃料(' + calc.year + '/' + calc.month + '/' + calc.day + '〜' + calc.year + '/' + calc.month + '/' + calc.daysInMonth + ' = ' + calc.billDays + '日/' + calc.daysInMonth + '日)';
        changed = true;
      }
    }
  });
  if(changed) renderSeikyuItems();
}

// テンプレ: 日割り賃料を追加
function addTplNissari(){
  const calc = calcNissariUnitPrice();
  if(!calc){
    alert('区画の月額が0円のため計算できません。\n単価欄に月額を入力してから、もう一度お試しください。');
    return;
  }
  // 既存の日割り行があれば置き換える
  const existingIdx = _seikyuItems.findIndex(it => it._kind === 'nissari');
  const newItem = {
    _kind: 'nissari',
    label: _seikyuContext.bldName + ' / ' + _seikyuContext.spotNoStr + ' 日割り賃料(' + calc.year + '/' + calc.month + '/' + calc.day + '〜' + calc.year + '/' + calc.month + '/' + calc.daysInMonth + ' = ' + calc.billDays + '日/' + calc.daysInMonth + '日)',
    qty: 1,
    unitPrice: calc.nissariNoTax,
    taxRate: 10
  };
  if(existingIdx >= 0){
    _seikyuItems[existingIdx] = newItem;
  } else {
    _seikyuItems.push(newItem);
  }
  renderSeikyuItems();
}

// テンプレ: 仲介手数料(月額税込と同額)
function addTplChukai(){
  const monthlyTaxIncluded = _seikyuContext.monthlyTaxIncluded || 0;
  if(monthlyTaxIncluded <= 0){
    alert('区画の月額が0円の場合は仲介手数料を計算できません。');
    return;
  }
  const existingIdx = _seikyuItems.findIndex(it => it._kind === 'chukai');
  const noTax = Math.round(monthlyTaxIncluded / 1.1);
  const newItem = {
    _kind: 'chukai',
    label: '仲介手数料(月額相当)',
    qty: 1,
    unitPrice: noTax,
    taxRate: 10
  };
  if(existingIdx >= 0){
    _seikyuItems[existingIdx] = newItem;
  } else {
    _seikyuItems.push(newItem);
  }
  renderSeikyuItems();
}

// テンプレ: 名義変更手数料(月額税込と同額)
function addTplMeigi(){
  const monthlyTaxIncluded = _seikyuContext.monthlyTaxIncluded || 0;
  if(monthlyTaxIncluded <= 0){
    alert('区画の月額が0円の場合は名義変更手数料を計算できません。');
    return;
  }
  const existingIdx = _seikyuItems.findIndex(it => it._kind === 'meigi');
  const noTax = Math.round(monthlyTaxIncluded / 1.1);
  const newItem = {
    _kind: 'meigi',
    label: '名義変更手数料(月額相当)',
    qty: 1,
    unitPrice: noTax,
    taxRate: 10
  };
  if(existingIdx >= 0){
    _seikyuItems[existingIdx] = newItem;
  } else {
    _seikyuItems.push(newItem);
  }
  renderSeikyuItems();
}

// テンプレ: 翌月分の月額(契約開始日の翌月分・満額)
function addTplNextMonth(){
  const startStr = document.getElementById('sk-contract-start').value;
  if(!startStr){ alert('契約開始日を入力してください'); return; }
  const start = new Date(startStr);
  if(isNaN(start.getTime())){ alert('契約開始日が不正です'); return; }
  const monthlyNoTax = _seikyuContext.monthlyNoTax || 0;
  if(monthlyNoTax <= 0){
    alert('区画の月額が0円の場合は計算できません。');
    return;
  }
  // 翌月の年月を算出
  const nextY = start.getMonth() === 11 ? start.getFullYear()+1 : start.getFullYear();
  const nextM = start.getMonth() === 11 ? 1 : start.getMonth()+2;  // 1-indexed
  const existingIdx = _seikyuItems.findIndex(it => it._kind === 'nextmonth');
  const newItem = {
    _kind: 'nextmonth',
    label: _seikyuContext.bldName + ' / ' + _seikyuContext.spotNoStr + ' ' + nextY + '年' + nextM + '月分 駐車場使用料',
    qty: 1,
    unitPrice: monthlyNoTax,
    taxRate: 10
  };
  if(existingIdx >= 0){
    _seikyuItems[existingIdx] = newItem;
  } else {
    _seikyuItems.push(newItem);
  }
  renderSeikyuItems();
}

// テンプレ: 保管場所使用承諾書発行手数料(税抜3,000円・税率10%)
function addTplShoudaku(){
  const existingIdx = _seikyuItems.findIndex(it => it._kind === 'shoudaku');
  const newItem = {
    _kind: 'shoudaku',
    label: '保管場所使用承諾書 発行手数料',
    qty: 1,
    unitPrice: 3000,
    taxRate: 10
  };
  if(existingIdx >= 0){
    _seikyuItems[existingIdx] = newItem;
  } else {
    _seikyuItems.push(newItem);
  }
  renderSeikyuItems();
}

// テンプレ: 初回請求セット = 日割り賃料 + 翌月分月額 + 仲介手数料
function addTplShokai(){
  const calc = calcNissariUnitPrice();
  if(!calc){
    alert('区画の月額が0円のため計算できません。\n単価欄に月額を入力してから、もう一度お試しください。');
    return;
  }
  // 既存の駐車場使用料行(_kindなし、初期セット行)は削除
  _seikyuItems = _seikyuItems.filter(it => it._kind);
  // 順番: 日割り賃料 → 翌月分月額 → 仲介手数料
  addTplNissari();
  addTplNextMonth();
  addTplChukai();
  // 件名を初回請求に変更
  const ymd = calc.year + '年' + calc.month + '月' + calc.day + '日';
  document.getElementById('sk-subject').value = ymd + '〜 ご契約 初回ご請求分';
}

function renderSeikyuItems(){
  const tbody = document.getElementById('sk-items-tbody');
  if(!tbody) return;
  tbody.innerHTML = _seikyuItems.map((it, i) => (
    '<tr>' +
      '<td style="padding:4px;border:1px solid #ccc;"><input type="text" value="'+escapeHtml(it.label||'')+'" oninput="updateSeikyuItem('+i+',\'label\',this.value)" style="width:100%;padding:4px;font-size:12px;"></td>' +
      '<td style="padding:4px;border:1px solid #ccc;"><input type="number" value="'+(it.qty||1)+'" min="0" step="1" oninput="updateSeikyuItem('+i+',\'qty\',this.value)" style="width:100%;padding:4px;font-size:12px;text-align:right;"></td>' +
      '<td style="padding:4px;border:1px solid #ccc;"><input type="number" value="'+(it.unitPrice||0)+'" min="0" step="1" oninput="updateSeikyuItem('+i+',\'unitPrice\',this.value)" style="width:100%;padding:4px;font-size:12px;text-align:right;"></td>' +
      '<td style="padding:4px;border:1px solid #ccc;"><select oninput="updateSeikyuItem('+i+',\'taxRate\',this.value)" style="width:100%;padding:4px;font-size:12px;">' +
        '<option value="10"'+(it.taxRate===10?' selected':'')+'>10%</option>' +
        '<option value="8"'+(it.taxRate===8?' selected':'')+'>8%(軽減)</option>' +
        '<option value="0"'+(it.taxRate===0?' selected':'')+'>非課税</option>' +
      '</select></td>' +
      '<td style="padding:4px;border:1px solid #ccc;text-align:center;"><button type="button" onclick="removeSeikyuItem('+i+')" style="background:transparent;border:1px solid #dc2626;color:#dc2626;width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:12px;font-weight:700;">×</button></td>' +
    '</tr>'
  )).join('');
  updateSeikyuPreview();
}

function updateSeikyuItem(i, field, val){
  if(!_seikyuItems[i]) return;
  if(field === 'qty' || field === 'unitPrice' || field === 'taxRate'){
    _seikyuItems[i][field] = Number(val) || 0;
  } else {
    _seikyuItems[i][field] = val;
  }
  updateSeikyuPreview();
}

function addSeikyuItem(){
  _seikyuItems.push({label:'', qty:1, unitPrice:0, taxRate:10});
  renderSeikyuItems();
}

function removeSeikyuItem(i){
  if(_seikyuItems.length <= 1){ alert('最低1項目は必要です'); return; }
  _seikyuItems.splice(i,1);
  renderSeikyuItems();
}

function calcSeikyuTotals(){
  let subtotal = 0;
  let tax10 = 0, tax8 = 0, taxFree = 0;
  let base10 = 0, base8 = 0;
  _seikyuItems.forEach(it => {
    const amount = (Number(it.qty)||0) * (Number(it.unitPrice)||0);
    subtotal += amount;
    if(it.taxRate === 10){ base10 += amount; tax10 += Math.round(amount * 0.1); }
    else if(it.taxRate === 8){ base8 += amount; tax8 += Math.round(amount * 0.08); }
    else { taxFree += amount; }
  });
  const totalTax = tax10 + tax8;
  const total = subtotal + totalTax;
  return {subtotal, base10, base8, taxFree, tax10, tax8, totalTax, total};
}

function updateSeikyuPreview(){
  const t = calcSeikyuTotals();
  const fmt = (n) => n.toLocaleString();
  let html = '小計(税抜): ¥' + fmt(t.subtotal);
  if(t.tax10 > 0) html += '　／ 消費税(10%): ¥' + fmt(t.tax10);
  if(t.tax8 > 0) html += '　／ 消費税(8%): ¥' + fmt(t.tax8);
  if(t.taxFree > 0) html += '　／ 非課税: ¥' + fmt(t.taxFree);
  html += '<br><strong style="font-size:15px;">合計(税込): ¥' + fmt(t.total) + '</strong>';
  document.getElementById('sk-preview-totals').innerHTML = html;
}

function printSeikyu(){
  const toName = document.getElementById('sk-to-name').value.trim();
  if(!toName){ alert('請求先の宛名を入力してください'); return; }
  const issueDate = document.getElementById('sk-issue-date').value;
  if(!issueDate){ alert('請求日を入力してください'); return; }
  if(_seikyuItems.length === 0){ alert('請求項目を最低1件入力してください'); return; }

  generateSeikyuPrint({
    toName: toName,
    toTitle: document.getElementById('sk-to-title').value,
    toAddr: document.getElementById('sk-to-addr').value.trim(),
    issueDate: issueDate,
    dueDate: document.getElementById('sk-due-date').value,
    invoiceNo: document.getElementById('sk-invoice-no').value.trim(),
    subject: document.getElementById('sk-subject').value.trim(),
    items: _seikyuItems.slice(),
    payMethod: document.getElementById('sk-pay-method').value,
    note: document.getElementById('sk-note').value.trim(),
    company: getCompanyInfo()
  });
}

function generateSeikyuPrint(data){
  const fmtJp = (dateStr) => {
    if(!dateStr) return '';
    const m = String(dateStr).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(!m) return dateStr;
    return m[1]+'年'+parseInt(m[2],10)+'月'+parseInt(m[3],10)+'日';
  };
  const fmtYen = (n) => '¥' + (Number(n)||0).toLocaleString();

  const t = (() => {
    let subtotal = 0;
    let tax10 = 0, tax8 = 0, taxFree = 0;
    let base10 = 0, base8 = 0;
    data.items.forEach(it => {
      const amount = (Number(it.qty)||0) * (Number(it.unitPrice)||0);
      subtotal += amount;
      if(it.taxRate === 10){ base10 += amount; tax10 += Math.round(amount * 0.1); }
      else if(it.taxRate === 8){ base8 += amount; tax8 += Math.round(amount * 0.08); }
      else { taxFree += amount; }
    });
    return {subtotal, base10, base8, taxFree, tax10, tax8, total: subtotal + tax10 + tax8};
  })();

  const cmp = data.company;
  const cmpName = cmp.name || 'IREライフ株式会社';
  const cmpZip = cmp.zip || '721-0963';
  const cmpAddr = cmp.addr || '広島県福山市南手城町2丁目15-6';
  const cmpRepTitle = cmp.rep_title || '代表取締役';
  const cmpRepName = cmp.rep_name || '淺野 充弘';
  const cmpInvoice = cmp.invoice_no || 'T9240001050012';
  const cmpTel = cmp.tel || '';
  const cmpMail = cmp.mail || '';

  // 振込先(銀行振込固定・横長フル幅)
  const bankInfoHtml =
    '<div class="bank-box">' +
      '<div class="bank-title">お振込先</div>' +
      '<div class="bank-inner">' +
        '<table class="bank-table">' +
          '<tr><th>銀行名</th><td>笠岡信用組合（2674）</td><th class="th-right">預金種目</th><td>普通</td></tr>' +
          '<tr><th>支店名</th><td>福山支店（016）</td><th class="th-right">口座番号</th><td>4314842</td></tr>' +
          '<tr><th>口座名義</th><td colspan="3">IREライフ株式会社<span class="kana">（ｱｲｱｰﾙｲｰﾗｲﾌ(ｶ）</span></td></tr>' +
        '</table>' +
        '<div class="bank-inkan"><img src="' + INKAN_BASE64 + '" alt="印"></div>' +
      '</div>' +
      '<div class="bank-note">※ 恐れ入りますが、振込手数料はご負担ください。</div>' +
    '</div>';

  // 明細行
  const itemRowsHtml = data.items.map(it => {
    const amount = (Number(it.qty)||0) * (Number(it.unitPrice)||0);
    const taxLabel = it.taxRate === 0 ? '非課税' : (it.taxRate + '%');
    return '<tr>' +
      '<td>' + escapeHtml(it.label||'') + '</td>' +
      '<td class="num">' + (Number(it.qty)||0).toLocaleString() + '</td>' +
      '<td class="num">' + (Number(it.unitPrice)||0).toLocaleString() + '</td>' +
      '<td class="num small">' + taxLabel + '</td>' +
      '<td class="num">' + amount.toLocaleString() + '</td>' +
    '</tr>';
  }).join('');

  // 合計行
  let totalsHtml = '';
  totalsHtml += '<tr class="t-subtotal"><th colspan="4">小計(税抜)</th><td class="num">' + t.subtotal.toLocaleString() + '</td></tr>';
  if(t.tax10 > 0){
    totalsHtml += '<tr><th colspan="4">消費税(10%)</th><td class="num">' + t.tax10.toLocaleString() + '</td></tr>';
  }
  if(t.tax8 > 0){
    totalsHtml += '<tr><th colspan="4">消費税(8%軽減)</th><td class="num">' + t.tax8.toLocaleString() + '</td></tr>';
  }
  if(t.taxFree > 0){
    totalsHtml += '<tr><th colspan="4">非課税</th><td class="num">' + t.taxFree.toLocaleString() + '</td></tr>';
  }
  totalsHtml += '<tr class="t-total"><th colspan="4">合計金額(税込)</th><td class="num">¥ ' + t.total.toLocaleString() + '</td></tr>';

  const html = '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>請求書</title>' +
    '<style>' +
    '@page{size:A4 portrait;margin:10mm 14mm;}' +
    'html,body{height:100%;}' +
    'body{font-family:"Yu Mincho","MS Mincho",serif;font-size:11pt;color:#000 !important;line-height:1.55;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
    /* 印刷時も全ての背景色・文字色を維持 */
    '@media print{*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important;}html,body{height:auto;}}' +
    /* sheet全体を縦flexに: 上から請求書本体、最下段に下ボックスを押し出す */
    '.sheet{width:100%;min-height:auto;display:flex;flex-direction:column;page-break-inside:avoid;color:#000;box-sizing:border-box;}' +
    '@media print{.sheet{min-height:auto;page-break-after:avoid;page-break-inside:avoid;}}' +
    '.sheet-main{flex:0 0 auto;}' +
    '.sheet-bottom{margin-top:auto;padding-top:10mm;}' +
    '.title{font-size:26pt;text-align:center;font-weight:700;letter-spacing:18px;margin:0 0 10px 0;border-bottom:3px double #000;padding-bottom:6px;color:#000 !important;}' +
    '.logo-bar{margin-bottom:4px;text-align:left;}' +
    '.logo-img{height:28px;width:auto;display:block;}' +
    '.head-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;color:#000;}' +
    '.to-block{flex:1;color:#000;}' +
    '.to-name{font-size:17pt;font-weight:700;border-bottom:1px solid #000;padding:5px 4px 5px 0;display:inline-block;min-width:260px;color:#000 !important;}' +
    '.to-title{font-size:13pt;margin-left:6px;color:#000 !important;}' +
    '.to-addr{font-size:10pt;margin-top:4px;color:#000 !important;}' +
    '.meta-block{text-align:right;font-size:10.5pt;line-height:1.7;color:#000 !important;}' +
    '.meta-block .lbl{display:inline-block;font-weight:700;width:80px;text-align:right;margin-right:4px;color:#000 !important;}' +
    '.meta-block .issuer-inline{font-size:10.5pt;line-height:1.45;margin-bottom:3px;color:#000 !important;}' +
    '.meta-block .issuer-inline strong{font-size:12.5pt;color:#000 !important;}' +
    '.meta-block .invoice-no-line{font-size:9.5pt;letter-spacing:1px;color:#000 !important;}' +
    '.meta-block .meta-divider{border-top:1px solid #000;margin:4px 0 4px auto;width:220px;}' +
    '.subject-line{font-size:12pt;margin:6px 0 10px;font-weight:700;color:#000 !important;}' +
    '.lead-text{font-size:11pt;margin:0 0 10px;color:#000 !important;}' +
    /* 合計バナー: 黒背景が印刷されない環境にも対応するため2px枠+太字でも識別可能に */
    '.total-banner{background:#000;color:#fff;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border:2px solid #000;}' +
    '.total-banner .lbl{font-size:13pt;font-weight:700;letter-spacing:5px;color:#fff !important;}' +
    '.total-banner .amt{font-size:22pt;font-weight:700;letter-spacing:2px;color:#fff !important;}' +
    'table.detail{width:100%;border-collapse:collapse;margin-bottom:0;}' +
    'table.detail th{background:#000;color:#fff !important;padding:5px 6px;font-size:10.5pt;font-weight:700;text-align:left;border:1px solid #000;}' +
    'table.detail td{padding:5px 6px;font-size:10.5pt;border:1px solid #000;background:#fff;color:#000 !important;line-height:1.4;}' +
    'table.detail td.num{text-align:right;font-variant-numeric:tabular-nums;color:#000 !important;}' +
    'table.detail td.small{font-size:9.5pt;color:#000 !important;}' +
    'table.detail tr.t-subtotal th{background:#e8e8e8;color:#000 !important;font-weight:700;}' +
    'table.detail tr.t-subtotal td{background:#e8e8e8;color:#000 !important;font-weight:700;}' +
    'table.detail tr.t-total th{background:#000;color:#fff !important;font-size:12pt;}' +
    'table.detail tr.t-total td{background:#000;color:#fff !important;font-size:13pt;font-weight:700;}' +
    /* 振込先フル幅レイアウト */
    '.bank-fullwidth{width:100%;}' +
    '.bank-box{border:2px solid #000;padding:10px 14px;color:#000;width:100%;box-sizing:border-box;}' +
    '.bank-title{font-size:12pt;font-weight:700;border-bottom:1.5px solid #000;padding-bottom:5px;margin-bottom:8px;letter-spacing:3px;text-align:center;color:#000 !important;}' +
    '.bank-inner{display:flex;align-items:center;gap:16px;position:relative;}' +
    '.bank-table{flex:1;border-collapse:collapse;font-size:11pt;color:#000;}' +
    '.bank-table th{text-align:left;padding:3px 10px 3px 0;width:76px;font-weight:700;color:#000 !important;vertical-align:middle;white-space:nowrap;}' +
    '.bank-table th.th-right{padding-left:16px;width:86px;}' +
    '.bank-table td{padding:3px 10px 3px 0;color:#000 !important;vertical-align:middle;font-size:11pt;}' +
    '.bank-table td .kana{margin-left:10px;font-size:9.5pt;color:#000 !important;letter-spacing:1px;}' +
    '.bank-inkan{width:80px;height:80px;flex-shrink:0;}' +
    '.bank-inkan img{width:100%;height:100%;object-fit:contain;}' +
    '.bank-note{font-size:9.5pt;color:#000 !important;margin-top:6px;border-top:1px dashed #000;padding-top:4px;}' +
    '.note-box{margin-top:10px;font-size:10pt;padding:8px 12px;background:#f5f5f5;border-left:4px solid #000;color:#000 !important;}' +
    '</style></head><body>' +
    '<div class="sheet">' +
      '<div class="sheet-main">' +
      '<h1 class="title">請求書</h1>' +
      '<div class="head-row">' +
        '<div class="to-block">' +
          '<div><span class="to-name">' + escapeHtml(data.toName) + '</span><span class="to-title">' + escapeHtml(data.toTitle||'') + '</span></div>' +
        '</div>' +
        '<div class="meta-block">' +
          '<div class="issuer-inline">' +
            '<strong>' + escapeHtml(cmpName) + '</strong><br>' +
            '<span class="invoice-no-line">登録番号 ' + escapeHtml(cmpInvoice) + '</span>' +
          '</div>' +
          '<div class="meta-divider"></div>' +
          '<div><span class="lbl">請求日</span>' + fmtJp(data.issueDate) + '</div>' +
          (data.dueDate ? '<div><span class="lbl">お支払期限</span>' + fmtJp(data.dueDate) + '</div>' : '') +
          (data.invoiceNo ? '<div><span class="lbl">請求書番号</span>' + escapeHtml(data.invoiceNo) + '</div>' : '') +
        '</div>' +
      '</div>' +
      (data.subject ? '<div class="subject-line">件名：' + escapeHtml(data.subject) + '</div>' : '') +
      '<p class="lead-text">下記のとおりご請求申し上げます。</p>' +
      '<div class="total-banner">' +
        '<span class="lbl">ご請求金額</span>' +
        '<span class="amt">¥ ' + t.total.toLocaleString() + '-</span>' +
      '</div>' +
      '<table class="detail">' +
        '<thead><tr>' +
          '<th style="width:auto;">品　目</th>' +
          '<th style="width:70px;text-align:right;">数量</th>' +
          '<th style="width:110px;text-align:right;">単価(税抜)</th>' +
          '<th style="width:80px;text-align:right;">税率</th>' +
          '<th style="width:120px;text-align:right;">金額</th>' +
        '</tr></thead>' +
        '<tbody>' + itemRowsHtml + '</tbody>' +
        '<tfoot>' + totalsHtml + '</tfoot>' +
      '</table>' +
      '</div>' + /* /sheet-main */
      '<div class="sheet-bottom">' +
      '<div class="bank-fullwidth">' +
        bankInfoHtml +
      '</div>' +
      (data.note ? '<div class="note-box">【備考】<br>' + escapeHtml(data.note).replace(/\n/g,'<br>') + '</div>' : '') +
      '</div>' + /* /sheet-bottom */
    '</div>' +
    '<scr'+'ipt>' +
    'window.addEventListener("load", function(){' +
      'var imgs = document.querySelectorAll("img");' +
      'if(imgs.length === 0){ setTimeout(function(){window.print();}, 200); return; }' +
      'var loaded = 0, total = imgs.length;' +
      'var checkDone = function(){ loaded++; if(loaded >= total){ setTimeout(function(){window.print();}, 300); } };' +
      'imgs.forEach(function(img){ if(img.complete){ checkDone(); } else{ img.addEventListener("load", checkDone); img.addEventListener("error", checkDone); } });' +
      'setTimeout(function(){ if(loaded < total){ window.print(); } }, 3000);' +
    '});' +
    '<\/scr'+'ipt>' +
    '<\/body><\/html>';
  showDocOverlay(html, '請求書');

}

function openModal(id){
  currentEditId = id || null;
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const delBtn = document.getElementById('del-btn') || { style:{} };  // 削除ボタンは廃止。無くても落ちないようにする

  // 画像状態をリセット
  _currentImages = { layout_id: '', layout_url: '', layout2_id: '', layout2_url: '', photo_ids: [], photo_urls: {}, mime: {} };
  _imgFailed = {};

  if(id){
    const all = loadAll();
    const b = all[id];
    if(!b){
      alert('物件が見つかりません');
      return;
    }
    title.textContent = '物件編集: ' + (b.name || '');
    document.getElementById('f-name').value = b.name || '';
    document.getElementById('f-zip').value = b.zip || '';
    document.getElementById('f-addr').value = b.addr || '';
    document.getElementById('f-addr').dataset.autofilled = '';
    document.getElementById('f-main-tou').value = b.main_tou || '';
    document.getElementById('f-count').value = (b.spots||[]).length;
    // 画像データロード
    _currentImages.layout_id = b.layout_id || '';
    _currentImages.layout2_id = b.layout2_id || '';
    _currentImages.mime = Object.assign({}, b.mime || {});
    _currentImages.photo_ids = (b.photo_ids || []).slice();
    // 棟別住所のロード
    _touAddrs = Array.isArray(b.tou_addrs) ? b.tou_addrs.slice() : [];
    // 退去済データを編集中変数にロード
    _currentPreviousUsers = {};
    (b.spots||[]).forEach(s => {
      if(Array.isArray(s.previous_users) && s.previous_users.length > 0){
        _currentPreviousUsers[Number(s.no)] = s.previous_users.map(pu => Object.assign({}, pu));
      }
    });
    renderTouAddrs();
    renderSpotsTable(b.spots || []);
    delBtn.style.display = 'inline-block';
  } else {
    title.textContent = '物件登録';
    // 検索ボックスに入力済みの内容があれば、物件名に自動入力(二度入力を避ける)
    const searchVal = (document.getElementById('search').value || '').trim();
    document.getElementById('f-name').value = searchVal;
    document.getElementById('f-zip').value = '';
    document.getElementById('f-addr').value = '';
    document.getElementById('f-addr').dataset.autofilled = '';
    document.getElementById('f-main-tou').value = '';
    document.getElementById('f-count').value = 0;
    _touAddrs = [];
    _currentPreviousUsers = {};
    renderTouAddrs();
    renderSpotsTable([]);
    delBtn.style.display = 'none';
  }
  // 画像セクション描画
  renderImageSection();
  // アップロード状態リセット(保存ボタンを通常状態に戻す)
  _uploadingCount = 0;
  updateSaveBtnState();
  // 一括設定の入力行を初期化(常に1行から)
  initBulkRows();
  modal.classList.add('active');
  // 開いた直後は「未保存の変更なし」状態にし、変更検知を仕込む
  _modalDirty = false;
  setupDirtyTracking();
  resetUndo();  // 「↺ 戻る」の履歴を初期化(この時点を基準にする)
  // 開いた直後は必ず最上部から表示する(前回のスクロール位置を引き継がない)
  modal.scrollTop = 0;
  modal.querySelectorAll('.modal, .modal-body').forEach(el => { el.scrollTop = 0; });
  window.scrollTo(0, 0);
  if(document.scrollingElement) document.scrollingElement.scrollTop = 0;
  // モーダル表示後、レイアウト確定を待ってスライダーを更新
  requestAnimationFrame(() => {
    // レンダリング確定後にもう一度最上部へ(中身の高さ確定後の保険)
    modal.scrollTop = 0;
    const mb = modal.querySelector('.modal-body'); if(mb) mb.scrollTop = 0;
    setupSpotsTableScrollSync();
    setTimeout(setupSpotsTableScrollSync, 100);
    setTimeout(setupSpotsTableScrollSync, 300);
  });
}

// ===== 棟別住所の管理 =====
let _touAddrs = [];  // [{tou: 'A', zip: '...', addr: '...'}, ...]
let _currentPreviousUsers = {};  // {区画番号(no): [{user, end_date, ...}]} 編集中の退去済データ

function renderTouAddrs(){
  const listEl = document.getElementById('tou-addr-list');
  if(!listEl) return;
  if(_touAddrs.length === 0){
    listEl.innerHTML = '<div style="font-size:11px;color:#888;padding:4px 0;">(棟別住所は未登録。物件のメイン住所が全区画に適用されます)</div>';
    return;
  }
  listEl.innerHTML = _touAddrs.map((ta, i) => {
    const zipId = 'tou-zip-' + i;
    const addrId = 'tou-addr-' + i;
    return '<div style="display:flex;gap:6px;margin-bottom:4px;align-items:center;">' +
      '<label style="font-size:11px;width:36px;flex-shrink:0;">棟:</label>' +
      '<input type="text" value="'+escapeHtml(ta.tou||'')+'" oninput="updateTouAddr('+i+',\'tou\',this.value)" placeholder="A" style="width:60px;padding:5px 8px;font-size:12px;border:1px solid #888;">' +
      '<label style="font-size:11px;width:50px;flex-shrink:0;">〒:</label>' +
      '<input type="text" id="'+zipId+'" value="'+escapeHtml(ta.zip||'')+'" oninput="updateTouAddr('+i+',\'zip\',this.value);onZipInput(\''+zipId+'\',\''+addrId+'\')" onchange="lookupZipForField(\''+zipId+'\',\''+addrId+'\')" placeholder="721-0963" style="width:100px;padding:5px 8px;font-size:12px;border:1px solid #888;">' +
      '<label style="font-size:11px;width:36px;flex-shrink:0;">住所:</label>' +
      '<input type="text" id="'+addrId+'" value="'+escapeHtml(ta.addr||'')+'" oninput="updateTouAddr('+i+',\'addr\',this.value);markAddrManual(\''+addrId+'\')" placeholder="広島県福山市〇〇1-2-3" style="flex:1;padding:5px 8px;font-size:12px;border:1px solid #888;">' +
      '<button type="button" onclick="removeTouAddr('+i+')" style="background:transparent;border:1px solid #dc2626;color:#dc2626;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:12px;">×</button>' +
    '</div>';
  }).join('');
}

function addTouAddr(){
  _touAddrs.push({tou:'', zip:'', addr:''});
  renderTouAddrs();
  refreshTouDropdownsInSpots();
}

function updateTouAddr(i, field, val){
  if(!_touAddrs[i]) return;
  _touAddrs[i][field] = val;
  // 棟名(tou)が変わった場合のみ区画テーブルの棟プルダウンを更新
  if(field === 'tou'){
    refreshTouDropdownsInSpots();
  }
  // 即時renderすると入力中フォーカスが外れるのでrenderしない
}

function removeTouAddr(i){
  _touAddrs.splice(i, 1);
  renderTouAddrs();
  refreshTouDropdownsInSpots();
}

// 棟マスターが変わったら、区画一覧の棟入力欄をプルダウンorテキスト形式に切替
function refreshTouDropdownsInSpots(){
  // 現在の区画データを取得して再描画(棟マスターの状態でプルダウン化判定)
  const currentSpots = collectSpotsFromForm();
  renderSpotsTable(currentSpots);
}

// メイン棟ラベルが変わったら区画テーブルの棟プルダウンを更新
function onMainTouChange(){
  refreshTouDropdownsInSpots();
}

// 棟マスター + メイン棟ラベル を統合した「有効な棟リスト」を返す
function getEffectiveTous(){
  const list = [];
  const mainTou = (document.getElementById('f-main-tou').value || '').trim();
  if(mainTou){
    list.push({ tou: mainTou, isMain: true });
  }
  if(Array.isArray(_touAddrs)){
    _touAddrs.forEach(ta => {
      const t = (ta.tou||'').trim();
      if(t && !list.find(x => x.tou === t)){
        list.push({ tou: t, isMain: false });
      }
    });
  }
  return list;
}

// 棟セル(td内側のinput/select)を生成
// 棟マスター or メイン棟ラベルに有効な棟が1つ以上あればプルダウン、なければテキスト入力
function renderTouCell(currentVal, fieldName){
  fieldName = fieldName || 'tou';
  const effective = getEffectiveTous();
  if(effective.length === 0){
    // 棟が一切登録されていない → 従来通りテキスト入力
    return '<input type="text" data-field="'+fieldName+'" value="'+escapeHtml(currentVal||'')+'" placeholder="棟">';
  }
  // プルダウン(シンプル表記: 棟名のみ + メインは★マーク)
  const cur = (currentVal||'').trim();
  const touNames = effective.map(e => e.tou);
  let html = '<select data-field="'+fieldName+'" title="棟を選択">' +
    '<option value=""'+(cur===''?' selected':'')+'>-</option>' +
    effective.map(e => {
      const label = e.isMain ? e.tou + '★' : e.tou;
      return '<option value="'+escapeHtml(e.tou)+'"'+(e.tou===cur?' selected':'')+' title="'+(e.isMain?'メイン棟':'')+'">'+escapeHtml(label)+'</option>';
    }).join('');
  // 現在値がリストに無ければカスタムオプションとして追加(既存データの互換性)
  if(cur && !touNames.includes(cur)){
    html += '<option value="'+escapeHtml(cur)+'" selected>'+escapeHtml(cur)+'</option>';
  }
  html += '</select>';
  return html;
}
// 「キャンセル」ボタン用: 編集を破棄する意思が明確なので確認なしで閉じる
function cancelModal(){
  _modalDirty = false;
  document.getElementById('modal').classList.remove('active');
  currentEditId = null;
}

function closeModal(){
  // 未保存の変更がある場合は「保存しますか?」を独自ダイアログで確認(保存しない / 保存)
  if(_modalDirty){
    showUnsavedDialog();
    return; // ダイアログの選択に処理を委ねる
  }
  _modalDirty = false;
  document.getElementById('modal').classList.remove('active');
  currentEditId = null;
}
// 未保存確認ダイアログ(誤操作防止のため 左:保存しない / 右:保存)
function showUnsavedDialog(){
  let ov = document.getElementById('unsaved-dialog');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'unsaved-dialog';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);';
    ov.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:24px 26px;width:380px;max-width:90vw;box-shadow:0 16px 48px rgba(0,0,0,0.28);">' +
        '<div style="font-size:16px;font-weight:800;color:#111;margin-bottom:10px;">保存しますか?</div>' +
        '<div style="font-size:13px;color:#555;line-height:1.6;margin-bottom:20px;">この物件に保存していない変更があります。<br>「保存」を押すと変更を保存して閉じます。<br>「保存しない」を押すと変更を破棄して閉じます。</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:10px;">' +
          '<button id="unsaved-discard" style="padding:10px 18px;border-radius:999px;border:1.5px solid #c7c7cc;background:#fff;color:#555;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">保存しない</button>' +
          '<button id="unsaved-save" style="padding:10px 22px;border-radius:999px;border:none;background:#111;color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">保存</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
  }
  ov.style.display = 'flex';
  const close = () => { ov.style.display = 'none'; };
  // 保存しない: 破棄して閉じる
  ov.querySelector('#unsaved-discard').onclick = () => {
    close();
    _modalDirty = false;
    document.getElementById('modal').classList.remove('active');
    currentEditId = null;
  };
  // 保存: 保存処理を実行してから閉じる(saveBldは編集時モーダルを開いたままにするため、保存後に閉じる)
  ov.querySelector('#unsaved-save').onclick = () => {
    close();
    if(typeof saveBld === 'function'){ saveBld(); }
    // saveBldが成功すると _modalDirty=false になるので、ここで閉じる
    if(!_modalDirty){
      document.getElementById('modal').classList.remove('active');
      currentEditId = null;
    }
  };
  // 背景クリックでは閉じない(誤操作防止)
}

// PIVOTロゴ: トップページ(物件一覧)へ戻る
function goToTop(){
  closeModal();
  if(document.getElementById('modal') && document.getElementById('modal').classList.contains('active')){ return; }
  if(document.body.classList.contains('tab-kanban')){
    if(typeof switchApp === 'function'){ switchApp('pivot'); }
  }
  window.scrollTo(0, 0);
  // ロゴをタップしたら最新をクラウドから取り込む。
  // forcePullLatest は「未送信があれば先に送ってから取得 → 勤怠は上書きせず日付単位でマージ」
  // という安全設計なので、入力直後のデータが戻る事故は起きない。
  try{ if(typeof forcePullLatest === 'function'){ forcePullLatest(); } }catch(e){}
}

// ===== 契約管理→PIVOT 連携: 区画の予約行に「予約中」を書き込む =====
// info = { property(物件名), parking(区画番号/Pラベル), contractor(契約者名), contractDate(契約確定日=予約日), srcKey }
// ・対象区画は「物件名が一致 かつ 区画番号が一致」で探す。
// ・予約行(res_user/res_date等)にだけ書き込み、メイン行(現使用者・状況)には触れない。
// ・確認ダイアログでOKのときだけ書き込む。
// ・既に同じ srcKey で書き込み済みの区画があれば二重書き込みしない。
function linkReservationToSpot(info){
  info = info || {};
  if(!info.contractor || !info.contractDate) return { ok:false, reason:'incomplete' };
  // 区画番号を数値に正規化(例 "P-12" "P12" "12" → 12)
  const parseNo = (v) => {
    const m = String(v||'').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  };
  // 区画番号を複数解釈する。区切りで意味が変わる:
  //  ・ハイフン "8-9" "8〜9" → 連番(8,9)に展開
  //  ・中黒/カンマ/スペース "6・9" "6,9" "6 9" → その番号だけ(間は含めない)
  //  ・混在 "1・5-7" → 1,5,6,7
  const parseNoList = (v) => {
    const s = String(v||'').replace(/[ＰｐP\-－―ー〜～]/g, m => {
      // 全角ハイフン・波ダッシュ類は半角ハイフンへ。P/Ｐは除去用に空白化。
      if(/[ＰｐP]/.test(m)) return ' ';
      if(/[〜～]/.test(m)) return '-';
      return '-';
    });
    // 中黒・カンマ・スペースで「グループ」に分割
    const groups = s.split(/[・,，、\s]+/).filter(Boolean);
    const out = [];
    groups.forEach(g => {
      const range = g.match(/^(\d+)\s*-\s*(\d+)$/);  // 連番指定
      if(range){
        let a = parseInt(range[1],10), b = parseInt(range[2],10);
        if(!isNaN(a) && !isNaN(b)){
          if(a > b){ const t=a; a=b; b=t; }
          for(let n=a; n<=b; n++) out.push(n);
        }
      } else {
        const m = g.match(/\d+/);
        if(m) out.push(parseInt(m[0],10));
      }
    });
    // 重複除去
    return out.filter((n,i) => out.indexOf(n) === i);
  };
  const wantNos = parseNoList(info.parking);
  const wantProp = String(info.property||'').trim();
  if(!wantProp || wantNos.length === 0){
    return { ok:false, reason:'no-key', msg:'物件名または区画番号が未入力のため、区画に紐づけできません。' };
  }
  const all = loadAll();
  const blds = Object.values(all);
  const norm = s => String(s||'').replace(/\s+/g,'').trim();
  const wp = norm(wantProp);
  // 物件を特定する。
  //  ① 完全一致を最優先
  //  ② 部分一致が複数ある場合は、希望する区画番号(wantNos)を最も多く持つ物件を選ぶ
  //     (同名・似名の別棟がある場合に、P6だけ別棟へ等の取り違えを防ぐ)
  const countHas = (b) => {
    if(!b || !Array.isArray(b.spots)) return 0;
    let c = 0;
    wantNos.forEach(no => { if(b.spots.some(sp => parseNo(sp.no) === no)) c++; });
    return c;
  };
  let bld = null;
  // ① 完全一致(複数あれば区画を多く持つ方)
  let exactCands = blds.filter(b => b && norm(b.name) === wp);
  if(exactCands.length){
    bld = exactCands.sort((a,b) => countHas(b) - countHas(a))[0];
  }
  // ② 部分一致(区画番号を最も多く持つ物件を採用)
  if(!bld){
    let partialCands = blds.filter(b => {
      if(!b) return false; const nb = norm(b.name);
      return nb && (nb.includes(wp) || wp.includes(nb));
    });
    if(partialCands.length){
      partialCands.sort((a,b) => {
        const d = countHas(b) - countHas(a);
        if(d !== 0) return d;
        // 同点なら名前が短い(より一致度が高い)方を優先
        return norm(a.name).length - norm(b.name).length;
      });
      bld = partialCands[0];
    }
  }
  if(!bld || !Array.isArray(bld.spots)){
    return { ok:false, reason:'not-found',
      msg:'「'+wantProp+'」が物件管理に見つかりませんでした。\n物件名が物件管理側と一致しているか確認してください。' };
  }
  const bldName = bld.name || wantProp;
  // 各番号に対応する区画を集める。棟(info.tou)が指定されていれば、同じ棟の区画を優先する。
  const wantTou = String(info.tou || '').trim();
  const targets = [];
  const missing = [];
  wantNos.forEach(no => {
    const matches = bld.spots.filter(sp => parseNo(sp.no) === no);
    if(matches.length === 0){ missing.push(no); return; }
    let pick = matches[0];
    if(wantTou){
      const sameTou = matches.find(sp => String(sp.tou||'').trim() === wantTou);
      if(sameTou) pick = sameTou;
    }
    targets.push(pick);
  });
  if(targets.length === 0){
    return { ok:false, reason:'not-found',
      msg:'「'+wantProp+'」の区画番号 '+wantNos.join('・')+' が物件管理に見つかりませんでした。\n区画番号が物件管理側と一致しているか確認してください。' };
  }
  // すべての対象区画が「同じ契約・同じ予約者・同じ予約日」で既に紐づけ済みなら何もしない。
  // (予約日=契約日が変わっている場合は、下の確認ダイアログで上書きできるようにする)
  // 日付は表記ゆれ(2026/06/25 と 2026-06-25 など)を吸収して比較する。
  const nd = (v) => (typeof normalizeDate === 'function') ? (normalizeDate(v) || String(v||'').trim()) : String(v||'').trim();
  const wantDate = nd(info.contractDate);
  // 既に「この契約」または「同じ予約者名」でこの区画に予約が入っているかを判定する。
  // res_srcKey が(同期等で)失われていても、予約者名が一致すれば「紐づけ済み」とみなす。
  const sameLink = (t) => {
    const bySrc  = !!(info.srcKey && t.res_srcKey && t.res_srcKey === info.srcKey);
    const byName = !!(t.res_user && info.contractor && t.res_user === info.contractor);
    return bySrc || byName;
  };
  // すべての対象区画が「同じ予約・同じ予約日」で既に入っていれば、変更なし扱いで拒否。
  const allSameAlready = targets.every(t => sameLink(t) && nd(t.res_date) === wantDate);
  if(allSameAlready){
    return { ok:false, reason:'already', msg:'この契約はすでに同じ内容でこの区画へ紐づけ済みです。' };
  }
  // 同じ予約だが内容(予約日など)が違う → 上書き確認
  const isReLink = targets.some(t => sameLink(t));
  // 確認ダイアログ: 対象区画の現状を見せる
  const noLabel = targets.map(t => 'P' + String(t.no).padStart(2,'0')).join('・');
  const existingResList = targets
    .filter(t => t.res_user && t.res_user !== info.contractor)
    .map(t => 'P'+String(t.no).padStart(2,'0')+'「'+t.res_user+'」');
  const existingRes = existingResList.length
    ? ('\n※既存の予約者がいます(上書き): ' + existingResList.join(', ')) : '';
  const curStates = targets.map(t =>
    'P'+String(t.no).padStart(2,'0')+': ' +
    (t.user ? ('使用者「'+t.user+'」/ ') : '') +
    (STATUS_LABELS[t.status] || t.status || '空き')).join('\n');
  const missingNote = missing.length
    ? ('\n(見つからない区画: ' + missing.join('・') + ' は対象外)') : '';
  // 上書き時、既存の予約日が違っていれば「変更前→変更後」を見せる(6/24→6/25 等の修正が分かるように)
  const dateChangeNotes = targets
    .filter(t => sameLink(t) && nd(t.res_date) !== wantDate)
    .map(t => 'P'+String(t.no).padStart(2,'0')+': 予約日 ' + (t.res_date || '(未設定)') + ' → ' + (nd(info.contractDate) || info.contractDate));
  const dateChange = dateChangeNotes.length
    ? ('\n\n■ 予約日の変更:\n' + dateChangeNotes.join('\n')) : '';
  // ★ 別の予約者が既に入っている区画への上書き警告(誤入力対策)
  const otherResList = targets
    .filter(t => t.res_user && t.res_user !== info.contractor)
    .map(t => 'P'+String(t.no).padStart(2,'0')+'「'+t.res_user+'」' + (t.res_date ? '(予約日 ' + t.res_date + ')' : ''));
  const overwriteWarn = otherResList.length
    ? ('⚠️ すでに別の予約が入っています。\n間違いありませんか?\n続行すると、下記の前の予約は上書きされ削除されます:\n' + otherResList.join('\n') + '\n\n')
    : '';
  const msg = overwriteWarn +
    (isReLink ? '【すでに紐づけ済み — 上書き確認】\n\nこの契約はすでにこの区画へ紐づけられています。\n内容に変更があります。新しい内容で上書きしますか?' + dateChange + '\n\n' : '【予約として紐づけ確認】\n\n') +
    '物件: ' + bldName + '\n' +
    '区画: ' + noLabel + (targets.length>1 ? '(' + targets.length + '区画同時)' : '') + '\n' +
    '予約者: ' + info.contractor + '\n' +
    '予約日(契約確定日): ' + info.contractDate + '\n\n' +
    '現在の状況:\n' + curStates + '\n\n' +
    'これらの区画の予約欄に上記を「予約中」として書き込みます。\n' +
    '(現在の使用者・状況は変更しません)' + missingNote + '\n\nよろしいですか?';
  // silent(復活など)でも、別の予約者を上書きする場合だけは確認する
  if(info.silent){
    if(overwriteWarn && !confirm(overwriteWarn + 'この区画に予約を復活します。よろしいですか?')){
      return { ok:false, reason:'cancelled' };
    }
  } else {
    if(!confirm(msg)){ return { ok:false, reason:'cancelled' }; }
  }
  // ★ 別の予約者を上書きする場合は、読み飛ばし防止のため もう一度だけ念押し確認する(計2回)
  if(overwriteWarn){
    const others = otherResList.join('\n');
    if(!confirm('【重要・再確認】\n選んだ区画には、すでに別の予約が入っています:\n' + others + '\n\nこのまま進めると、上記の予約は完全に削除され、元に戻せません。\n区画番号の入力ミスではありませんか?\n上書きしてよければ「OK」を押してください。')){
      return { ok:false, reason:'cancelled' };
    }
  }
  // 予約行にだけ書き込み(メイン行は触らない)
  // info.room(例「東105」「A101」)を、棟(先頭の漢字1文字またはアルファベット1文字)と
  // 号室(残りの数字部分)に分けて、それぞれ res_tou / res_room に振り分ける。
  const splitTouRoom = (raw) => {
    const s = String(raw || '').trim();
    if(!s) return { tou:'', room:'' };
    const m = s.match(/^([東西南北]|[A-Za-z])\s*(.*)$/);
    if(m){ return { tou: m[1], room: (m[2]||'').trim() }; }
    return { tou:'', room: s };
  };
  let writtenDate = '';
  // ★ 区画番号を変更した場合に備え、今回の対象区画(targets)以外に残っている
  //    この契約の予約を先に解除する(古い区画の予約が二重に残らないように)。
  const targetSet = new Set(targets);
  const srcKey = info.srcKey || '';
  const contractor = String(info.contractor || '').trim();
  Object.values(all).forEach(bb => {
    if(!bb || !Array.isArray(bb.spots)) return;
    const sameBuilding = (bb === bld);
    bb.spots.forEach(sp => {
      if(!sp || targetSet.has(sp)) return;   // 今回書き込む区画は対象外
      const hasRes = !!(sp.res_user || sp.res_date || sp.res_srcKey);
      if(!hasRes) return;
      // srcKeyが一致すれば確実にこの契約の旧予約 → どの物件でも解除。
      // srcKeyが無い場合のみ、同じ物件内で予約者名が一致するものを解除(別物件の同名は触らない)。
      const bySrc  = !!(srcKey && sp.res_srcKey && sp.res_srcKey === srcKey);
      const byName = !srcKey && sameBuilding && !!(contractor && sp.res_user && sp.res_user === contractor);
      if(bySrc || byName){
        if(sp.res_autoCancel && sp.status === '解'){ sp.status = '借'; delete sp.end_date; }
        delete sp.res_autoCancel;
        delete sp.res_user; delete sp.res_date; delete sp.res_srcKey;
        delete sp.res_tou; delete sp.res_room; delete sp.res_price; delete sp.res_note;
      }
    });
  });
  // 契約日が今日以前(過去日)なら「予約」ではなく「使用中」で登録する。
  // (info.useNow は契約管理側で過去日確認OK時に渡される)
  const normContract = (typeof normalizeDate === 'function') ? normalizeDate(info.contractDate) : info.contractDate;
  const todayN = (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0,10);
  const isPastOrToday = !!(normContract && normContract <= todayN);
  const useNow = !!(info.useNow && isPastOrToday);
  targets.forEach(t => {
    if(useNow){
      // 使用中として登録: メイン行に使用者名を書き込み、状況を「使用中(借)」に。
      t.user = info.contractor;
      t.status = '借';
      // 駐車場の月額が手入力されていれば、使用中の金額に反映
      {
        const pp = parseInt(String(info.price == null ? '' : info.price).replace(/[^0-9]/g, ''), 10);
        if(!isNaN(pp) && pp > 0){ t.price = pp; }
      }
      // 予約欄は使わないのでクリア(紐づけ解除判定用に res_srcKey だけ残す)
      delete t.res_user; delete t.res_date; delete t.res_tou; delete t.res_room; delete t.res_price; delete t.res_note;
      if(info.srcKey) t.res_srcKey = info.srcKey;
      writtenDate = normContract || info.contractDate;
      if(info.room){ const sp = splitTouRoom(info.room); if(!t.tou) t.tou = sp.tou; if(!t.room) t.room = sp.room; }
    } else {
      t.res_user = info.contractor;
      const normDate = (typeof normalizeDate === 'function') ? normalizeDate(info.contractDate) : info.contractDate;
      t.res_date = normDate || info.contractDate;
      writtenDate = t.res_date;
      if(info.srcKey) t.res_srcKey = info.srcKey;
      // 駐車場の月額が手入力されていれば予約金額に反映(到来時に使用中金額へ移る)
      {
        const pp = parseInt(String(info.price == null ? '' : info.price).replace(/[^0-9]/g, ''), 10);
        if(!isNaN(pp) && pp > 0){ t.res_price = pp; }
      }
      if(info.room){
        const sp = splitTouRoom(info.room);
        t.res_tou = sp.tou;
        t.res_room = sp.room;
      }
      // ★ 現在「使用中(借)」で誰かが入っている区画に予約を入れたら、
      //    予約日(契約確定日)を解約日として「解約中(解)」に切り替える。
      //    すでに解約中(解)・退去済(退)などの場合はそのまま。
      if(t.status === '借' && t.user){
        t.status = '解';
        if(!t.end_date){ t.end_date = t.res_date; }   // 解約日 = 予約日
        t.res_autoCancel = true;   // この予約によって解約中にしたという目印(キャンセル時に戻す)
      }
    }
  });
  saveAll(all);
  // 予約の書き込みは即座にクラウドへ送信(後からの取り込みで消えないように)
  try{ if(typeof window.__pushNow === 'function'){ window.__pushNow(); } }catch(e){}
  if(typeof renderList === 'function'){ try{ renderList(); }catch(e){} }
  // 物件管理タブで同じ物件を開いていれば最新データで開き直して同期。
  try{
    if(typeof currentEditId !== 'undefined' && currentEditId === bld.id
        && typeof openModal === 'function'){
      const m = document.getElementById('modal');
      const isOpen = m && (m.style.display === 'flex' || m.style.display === 'block'
                            || (m.offsetParent !== null));
      if(isOpen){ openModal(bld.id); }
    }
  }catch(e){}
  return { ok:true, bldName: bldName, no: targets.map(t=>t.no).join('・'), count: targets.length, resDate: writtenDate, useNow: useNow };
}
// 契約管理(別IIFE)から呼べるよう公開
window.PV_linkReservation = linkReservationToSpot;

// ===== 契約削除・キャンセル時: その契約の駐車場予約を解除 =====
// info = { contractor, srcKey, property?, parking? }
// ・対象は「res_srcKey が一致」または「予約者名が一致」する予約行。
// ・他人の予約(予約者名が違う)は残す。メイン行(現使用者)には触れない。
function unlinkReservationFromSpots(info){
  info = info || {};
  const srcKey = info.srcKey || '';
  const contractor = String(info.contractor || '').trim();
  const carName = String(info.carContractor || '').trim();
  if(!srcKey && !contractor && !carName) return { ok:false, removed:0 };
  const all = loadAll();
  let removed = 0;
  const norm = s => String(s||'').replace(/\s+/g,'').trim();
  const wantProp = norm(info.property || '');
  Object.values(all).forEach(b => {
    if(!b || !Array.isArray(b.spots)) return;
    if(wantProp){
      const nb = norm(b.name);
      if(!(nb === wantProp || nb.includes(wantProp) || wantProp.includes(nb))) return;
    }
    b.spots.forEach(s => {
      if(!s) return;
      const hasRes = !!(s.res_user || s.res_date || s.res_srcKey);
      if(!hasRes) return;
      const bySrc  = !!(srcKey && s.res_srcKey && s.res_srcKey === srcKey);
      const byName = !!(s.res_user && ((contractor && s.res_user === contractor) || (carName && s.res_user === carName)));
      if(bySrc || byName){
        // この予約によって解約中(解)にしていた場合は、使用中(借)に戻す。
        // (もともと解約中だった区画=res_autoCancelが無い場合は、そのまま)
        if(s.res_autoCancel && s.status === '解'){
          s.status = '借';
          delete s.end_date;
        }
        delete s.res_autoCancel;
        delete s.res_user; delete s.res_date; delete s.res_srcKey;
        delete s.res_tou; delete s.res_room; delete s.res_price; delete s.res_note;
        removed++;
      }
    });
  });
  if(removed > 0){
    saveAll(all);
    try{ if(typeof window.__pushNow === 'function'){ window.__pushNow(); } }catch(e){}
    if(typeof renderList === 'function'){ try{ renderList(); }catch(e){} }
    try{
      if(typeof currentEditId !== 'undefined' && currentEditId && typeof openModal === 'function'){
        const m = document.getElementById('modal');
        const isOpen = m && (m.style.display === 'flex' || m.style.display === 'block' || (m.offsetParent !== null));
        if(isOpen){ openModal(currentEditId); }
      }
    }catch(e){}
  }
  return { ok:true, removed: removed };
}
window.PV_unlinkReservation = unlinkReservationFromSpots;

// この契約に紐づく駐車場予約が存在するか(確認ダイアログを無駄に出さないため)
// 予約(res_)だけでなく「使用中(user)」での紐づけも検出する。
// 判定は広めに取り、少しでも一致すれば「紐づけ済み」とみなす(未紐づけ警告の誤検知を防ぐ)。
function hasLinkedReservation(info){
  info = info || {};
  const srcKey = info.srcKey || '';
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, '').trim();
  const contractor = norm(info.contractor);
  const carName = norm(info.carContractor);
  if(!srcKey && !contractor && !carName) return false;
  const all = loadAll();
  let found = false;
  Object.values(all).forEach(b => {
    if(found || !b || !Array.isArray(b.spots)) return;
    b.spots.forEach(s => {
      if(found || !s) return;
      // srcKey 一致(予約・使用中どちらでも res_srcKey は残る)
      if(srcKey && s.res_srcKey && s.res_srcKey === srcKey){ found = true; return; }
      // 予約者名 一致
      const ru = norm(s.res_user);
      if(ru && ((contractor && ru === contractor) || (carName && ru === carName))){ found = true; return; }
      // 使用中の使用者名 一致(過去日で「使用中」登録された場合)
      const su = norm(s.user);
      if(su && ((contractor && su === contractor) || (carName && su === carName))){ found = true; return; }
    });
  });
  return found;
}
window.PV_hasReservation = hasLinkedReservation;

// ある物件名にマッチする物件の「棟」一覧を返す(契約側の棟プルダウン用)
//  物件名は完全一致優先→部分一致。spots の tou と、棟マスター(_touAddrs)、メイン棟ラベルを統合。
function getTouListForProperty(propertyName){
  const wp = String(propertyName||'').replace(/\s+/g,'').trim();
  if(!wp) return [];
  const all = loadAll();
  const blds = Object.values(all).filter(Boolean);
  const norm = s => String(s||'').replace(/\s+/g,'').trim();
  // マッチする物件をすべて集める(同名別棟も考慮)
  let cands = blds.filter(b => norm(b.name) === wp);
  if(!cands.length){ cands = blds.filter(b => { const nb = norm(b.name); return nb && (nb.includes(wp) || wp.includes(nb)); }); }
  const set = [];
  const add = (t) => { const v = String(t||'').trim(); if(v && !set.includes(v)) set.push(v); };
  cands.forEach(b => {
    if(Array.isArray(b.spots)) b.spots.forEach(s => { if(s && s.tou) add(s.tou); });
    if(Array.isArray(b.touAddrs)) b.touAddrs.forEach(ta => add(ta && ta.tou));
    if(b.mainTou) add(b.mainTou);
  });
  return set;
}
window.PV_getTouList = getTouListForProperty;




// 物件編集モーダル内の入力変更を検知して未保存フラグを立てる
function setupDirtyTracking(){
  const modal = document.getElementById('modal');
  if(!modal) return;
  if(modal._dirtyBound) return; // 二重登録防止(初回のみ実バインド)
  modal._dirtyBound = true;
  const onEdit = () => {
    _modalDirty = true;
    pushUndoSnapshot();  // 変更のたびに「戻る」用の状態を記録
  };
  // 入力系の変更すべてを拾う(テキスト入力・プルダウン・チェック等)
  modal.addEventListener('input', onEdit, true);
  modal.addEventListener('change', onEdit, true);
}

// ===== 元に戻す(Undo) / やり直し(Redo) =====
let _undoStack = [];           // 変更前の状態スナップショット履歴
let _redoStack = [];           // やり直し用(Undoで戻した状態を積む)
let _lastState = null;         // 直近で確定している状態(次の変更時にこれを履歴へ積む)
let _undoApplying = false;     // Undo/Redo適用中フラグ
const _UNDO_MAX = 60;          // 履歴の上限
let _undoCommitTimer = null;

// 現在のフォーム全体の状態を1つのオブジェクトにまとめる
function captureFormState(){
  const g = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
  let spots = [];
  try { spots = collectSpotsFromForm(); } catch(e) { spots = []; }
  return {
    name: g('f-name'),
    zip:  g('f-zip'),
    addr: g('f-addr'),
    mainTou: g('f-main-tou'),
    count: g('f-count'),
    spots: JSON.parse(JSON.stringify(spots)),
    images: JSON.parse(JSON.stringify(_currentImages || {})),
    touAddrs: JSON.parse(JSON.stringify(_touAddrs || [])),
    prevUsers: JSON.parse(JSON.stringify(_currentPreviousUsers || {}))
  };
}

// スナップショットをフォームへ復元する
function applyFormState(s){
  if(!s) return;
  _undoApplying = true;
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
  set('f-name', s.name);
  set('f-zip', s.zip);
  set('f-addr', s.addr);
  set('f-main-tou', s.mainTou);
  set('f-count', s.count);
  _currentImages = JSON.parse(JSON.stringify(s.images || {}));
  _touAddrs = JSON.parse(JSON.stringify(s.touAddrs || []));
  _currentPreviousUsers = JSON.parse(JSON.stringify(s.prevUsers || {}));
  try { renderSpotsTable(s.spots || []); } catch(e){}
  try { renderImageSection(); } catch(e){}
  try { renderTouAddrs(); } catch(e){}
  // 復元後の状態を「直近の確定状態」として保持
  _lastState = JSON.parse(JSON.stringify(s));
  setTimeout(() => { _undoApplying = false; }, 0);
}

// Undo履歴を初期化(モーダルを開いた時に呼ぶ)
function resetUndo(){
  _undoStack = [];
  _redoStack = [];
  _lastState = captureFormState();  // 開いた直後の状態を基準に
  updateUndoBtn();
}

// 変更を検知したら、「変更前の状態(_lastState)」を履歴に積み、現在状態を新たな基準にする
// 連続入力(1文字ずつ等)を1ステップにまとめるため、確定はデバウンスする
function pushUndoSnapshot(){
  if(_undoApplying) return;
  // 新しい変更が入ったら、やり直し(Redo)履歴は無効になる
  if(_redoStack.length){ _redoStack = []; updateUndoBtn(); }
  // 変更前の状態をまだ積んでいなければ積む(連続入力中は1回だけ積む)
  if(_lastState && !_undoCommitTimer){
    const lastSnapStr = _undoStack.length ? JSON.stringify(_undoStack[_undoStack.length-1]) : null;
    const curStr = JSON.stringify(_lastState);
    // 直前に積んだ状態と同一なら積まない(無駄打ち防止)
    if(lastSnapStr !== curStr){
      _undoStack.push(JSON.parse(curStr));
      if(_undoStack.length > _UNDO_MAX) _undoStack.shift();
      updateUndoBtn();
    }
  }
  // 入力が続く間はまとめ、落ち着いたら現在状態を新基準に更新
  if(_undoCommitTimer) clearTimeout(_undoCommitTimer);
  _undoCommitTimer = setTimeout(() => {
    _lastState = captureFormState();
    _undoCommitTimer = null;
  }, 500);
}

// 「← 戻る」ボタン: 直前の状態に戻す(1回で必ず1操作分の変化を起こす)
function undoLastChange(){
  // 入力途中(デバウンス確定待ち)があれば、まず現在状態を確定
  if(_undoCommitTimer){
    clearTimeout(_undoCommitTimer); _undoCommitTimer = null;
    _lastState = captureFormState();
  }
  if(_undoStack.length === 0){ showToast('これ以上戻せません'); return; }
  const before = JSON.stringify(captureFormState());
  // 戻る前の現在状態を「やり直し」用に保存
  _redoStack.push(JSON.parse(before));
  if(_redoStack.length > _UNDO_MAX) _redoStack.shift();
  let prev = _undoStack.pop();
  // 戻しても見た目が変わらない(同一状態)なら、変化が出るまでさらに戻す
  while(_undoStack.length > 0 && JSON.stringify(prev) === before){
    prev = _undoStack.pop();
  }
  applyFormState(prev);   // applyFormState内で _lastState = prev に更新される
  _modalDirty = true;
  updateUndoBtn();
  showToast('← 元に戻しました');
}

// 「→ 進む」ボタン: Undoで戻した内容をやり直す(1回で1操作分先へ)
function redoLastChange(){
  if(_undoCommitTimer){ clearTimeout(_undoCommitTimer); _undoCommitTimer = null; _lastState = captureFormState(); }
  if(_redoStack.length === 0){ showToast('これ以上進めません'); return; }
  const before = JSON.stringify(captureFormState());
  // 進む前の現在状態を「戻る」用に保存
  _undoStack.push(JSON.parse(before));
  if(_undoStack.length > _UNDO_MAX) _undoStack.shift();
  let next = _redoStack.pop();
  while(_redoStack.length > 0 && JSON.stringify(next) === before){
    next = _redoStack.pop();
  }
  applyFormState(next);
  _modalDirty = true;
  updateUndoBtn();
  showToast('→ やり直しました');
}

// 履歴の有無で戻る/進むボタンの活性・濃淡を切り替え
function updateUndoBtn(){
  const u = document.getElementById('undo-btn');
  const r = document.getElementById('redo-btn');
  const setBtn = (btn, can) => {
    if(!btn) return;
    btn.disabled = !can;
    // 操作できる時は黒くはっきり / できない時は薄いグレー
    btn.style.color = can ? '#111' : '#c8c8c8';
    btn.style.borderColor = can ? '#999' : '#e2e2e2';
    btn.style.background = can ? '#fff' : '#fafafa';
    btn.style.cursor = can ? 'pointer' : 'default';
  };
  setBtn(u, _undoStack.length > 0);
  setBtn(r, _redoStack.length > 0);
}

// 画像の追加/削除/入れ替えの「直前」に呼ぶ: 現在状態を履歴へ確定して積む
function snapshotBeforeImageChange(){
  if(_undoApplying) return;
  if(_redoStack.length){ _redoStack = []; }  // 新しい変更なのでredo無効
  if(_undoCommitTimer){ clearTimeout(_undoCommitTimer); _undoCommitTimer = null; }
  const cur = _lastState || captureFormState();
  _undoStack.push(cur);
  if(_undoStack.length > _UNDO_MAX) _undoStack.shift();
  _lastState = captureFormState();
  updateUndoBtn();
}

// ==============================
// 区画テーブル
// ==============================
function regenSpots(){
  const newCount = parseInt(document.getElementById('f-count').value) || 0;
  if(newCount < 0 || newCount > 200){
    alert('区画数は0〜200で入力してください');
    return;
  }
  // 既存のフォーム入力値を取得
  const current = collectSpotsFromForm();
  const newSpots = [];
  for(let i = 1; i <= newCount; i++){
    const existing = current.find(s => s.no === i);
    if(existing){
      newSpots.push(existing);
    } else {
      newSpots.push({
        no: i, type: '並', tou: '', room: '',
        user: '', price: 3300, status: '空', note: ''
      });
    }
  }
  renderSpotsTable(newSpots);
}
function renderSpotsTable(spots){
  const tbody = document.getElementById('spots-tbody');
  if(!spots || spots.length === 0){
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#666;">区画がありません。「+ 区画追加」で追加してください。</td></tr>';
    setupSpotsTableScrollSync();
    return;
  }
  tbody.innerHTML = spots.map((s, i) => renderSpotRowGroup(s, i)).join('');
  setupSpotsTableScrollSync();
}

// 区画テーブルのカスタム横スライダー同期セットアップ
function setupSpotsTableScrollSync(){
  const slider = document.getElementById('spots-table-slider');
  const thumb = document.getElementById('spots-table-slider-thumb');
  const wrap = document.getElementById('spots-table-wrap');
  const table = document.getElementById('spots-table');
  if(!slider || !thumb || !wrap || !table) return;

  // thumbの幅と位置を「現在のスクロール状態」に同期させる関数
  const updateThumb = () => {
    const scrollWidth = wrap.scrollWidth;
    const clientWidth = wrap.clientWidth;
    const sliderWidth = slider.clientWidth;
    // スライダー幅が0の時(モーダル未表示など)は何もしない
    if(sliderWidth <= 0) return;
    // 常にツマミを表示。スクロール不要時もうっすらツマミを置く
    thumb.style.display = '';
    slider.style.opacity = '1';
    if(scrollWidth <= clientWidth){
      // スクロール不要: ツマミをフル幅にして「スクロール不要」を視覚化
      thumb.style.width = sliderWidth + 'px';
      thumb.style.left = '0px';
      return;
    }
    // thumb幅 = (見えてる比率) × スライダー幅(下限40px)
    const ratio = clientWidth / scrollWidth;
    const thumbWidth = Math.max(40, Math.floor(sliderWidth * ratio));
    thumb.style.width = thumbWidth + 'px';
    // thumb位置 = (現在のスクロール位置 / 最大スクロール) × (スライダー幅 - thumb幅)
    const maxScroll = scrollWidth - clientWidth;
    const maxThumbLeft = sliderWidth - thumbWidth;
    const left = maxScroll > 0 ? (wrap.scrollLeft / maxScroll) * maxThumbLeft : 0;
    thumb.style.left = left + 'px';
  };

  // 既にバインド済みなら、widthのみ更新して終了
  if(slider.dataset.scrollSyncBound === '1'){
    updateThumb();
    return;
  }
  slider.dataset.scrollSyncBound = '1';

  // wrap→thumb 同期
  wrap.addEventListener('scroll', updateThumb);

  // ドラッグ操作: thumbをマウスでつかんでスライド
  let dragging = false;
  let dragStartX = 0;
  let dragStartLeft = 0;
  thumb.addEventListener('mousedown', (e) => {
    dragging = true;
    dragStartX = e.clientX;
    dragStartLeft = parseFloat(thumb.style.left || '0');
    thumb.classList.add('dragging');
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if(!dragging) return;
    const dx = e.clientX - dragStartX;
    const sliderWidth = slider.clientWidth;
    const thumbWidth = thumb.offsetWidth;
    const maxThumbLeft = sliderWidth - thumbWidth;
    let newLeft = Math.max(0, Math.min(maxThumbLeft, dragStartLeft + dx));
    // newLeft → wrap.scrollLeft に変換
    const scrollWidth = wrap.scrollWidth;
    const clientWidth = wrap.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    const ratio = maxThumbLeft > 0 ? newLeft / maxThumbLeft : 0;
    wrap.scrollLeft = ratio * maxScroll;
    // updateThumbが自動でleftを更新
  });
  document.addEventListener('mouseup', () => {
    if(dragging){
      dragging = false;
      thumb.classList.remove('dragging');
    }
  });

  // タッチデバイス対応
  thumb.addEventListener('touchstart', (e) => {
    dragging = true;
    dragStartX = e.touches[0].clientX;
    dragStartLeft = parseFloat(thumb.style.left || '0');
    thumb.classList.add('dragging');
  }, {passive:true});
  document.addEventListener('touchmove', (e) => {
    if(!dragging) return;
    const dx = e.touches[0].clientX - dragStartX;
    const sliderWidth = slider.clientWidth;
    const thumbWidth = thumb.offsetWidth;
    const maxThumbLeft = sliderWidth - thumbWidth;
    let newLeft = Math.max(0, Math.min(maxThumbLeft, dragStartLeft + dx));
    const scrollWidth = wrap.scrollWidth;
    const clientWidth = wrap.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    const ratio = maxThumbLeft > 0 ? newLeft / maxThumbLeft : 0;
    wrap.scrollLeft = ratio * maxScroll;
  }, {passive:true});
  document.addEventListener('touchend', () => {
    if(dragging){
      dragging = false;
      thumb.classList.remove('dragging');
    }
  });

  // スライダーバー上でクリック: クリック位置に移動
  slider.addEventListener('click', (e) => {
    if(e.target === thumb) return;
    const rect = slider.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const sliderWidth = slider.clientWidth;
    const thumbWidth = thumb.offsetWidth;
    let newLeft = Math.max(0, Math.min(sliderWidth - thumbWidth, clickX - thumbWidth/2));
    const maxThumbLeft = sliderWidth - thumbWidth;
    const scrollWidth = wrap.scrollWidth;
    const clientWidth = wrap.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    const ratio = maxThumbLeft > 0 ? newLeft / maxThumbLeft : 0;
    wrap.scrollLeft = ratio * maxScroll;
  });

  // リサイズで再計算
  window.addEventListener('resize', updateThumb);
  // 初回更新: レンダリング・レイアウト・モーダル開閉のタイミング差を吸収するため複数回呼ぶ
  updateThumb();
  requestAnimationFrame(updateThumb);
  setTimeout(updateThumb, 50);
  setTimeout(updateThumb, 200);
}

// 1区画分の行グループ(メイン行 + 解約日行 or 予約行)を生成
function renderSpotRowGroup(s, i){
  const status = s.status || '空';
  const statusClass = 'st-' + status;
  // 区画番号はデータの no を使う(並び替えしても固定)
  const noNum = s.no || (i+1);
  const spotNo = String(noNum).padStart(2,'0');

  // メイン行(ドラッグ可能。ハンドルは区画番号セルのみ)
  let html = '<tr class="'+statusClass+' spot-row" data-idx="'+i+'" data-no="'+spotNo+'">' +
    '<td class="spot-no-cell" draggable="true"' +
    '  ondragstart="onSpotDragStart(event,'+i+')"' +
    '  ondragend="onSpotDragEnd(event)"' +
    '  ondragover="onSpotDragOver(event)"' +
    '  ondragleave="onSpotDragLeave(event)"' +
    '  ondrop="onSpotDrop(event,'+i+')"' +
    '  title="ドラッグで並び替え">' +
      '<button type="button" class="spot-remove-btn" onclick="removeSpot('+i+')" title="この区画を削除">×</button>' +
      '<span class="spot-no-label">P'+spotNo+'</span>' +
      '<span class="spot-drag-icon" title="ドラッグで並び替え">⋮⋮</span>' +
      '<input type="hidden" data-field="no" value="'+noNum+'">' +
    '</td>' +
    '<td><select data-field="type" onchange="onTypeChange(this)">' +
      TYPE_LIST.map(t => '<option value="'+t+'"'+(s.type===t?' selected':'')+'>'+TYPE_LABELS[t]+'</option>').join('') +
    '</select></td>' +
    '<td>' + renderTouCell(s.tou||'') + '</td>' +
    '<td><input type="text" data-field="room" value="'+escapeHtml(s.room||'')+'" placeholder="号室"></td>' +
    '<td><input type="text" data-field="user" value="'+escapeHtml(s.user||'')+'" placeholder="使用者名" oninput="onUserInput(this)"></td>' +
    '<td><input type="text" data-field="price" value="'+formatPrice(s.price||0)+'" placeholder="0" oninput="onPriceInput(this)" inputmode="numeric" style="text-align:right;"></td>' +
    '<td><select data-field="status" onchange="onStatusChange(this)">' +
      STATUS_LIST.map(st => '<option value="'+st+'"'+(status===st?' selected':'')+'>'+STATUS_LABELS[st]+'</option>').join('') +
    '</select></td>' +
    '<td><input type="text" data-field="note" value="'+escapeHtml(s.note||'')+'" placeholder="備考"></td>' +
    '<td style="text-align:center;padding:4px;white-space:nowrap;">' +
      '<button type="button" class="btn-doc" onclick="openSeikyuModal('+i+')" title="請求書を発行" style="margin-right:4px;">請求書</button>' +
      '<button type="button" class="btn-doc" onclick="openKeiyakuModal('+i+')" title="駐車場賃貸借契約書を発行" style="margin-right:4px;">契約書</button>' +
      '<button type="button" class="btn-doc" onclick="openShoudakuModal('+i+')" title="保管場所使用承諾書を発行">承諾書</button>' +
    '</td>' +
  '</tr>';

  // 解約中、または退去済(解約日あり)なら、解約日行を表示
  if(status === '解' || (status === '退' && s.end_date)){
    const subClass = status === '退' ? 'st-退' : 'st-解';
    const labelText = status === '退' ? '└ 解約日(退去済):' : '└ 解約日:';
    html += '<tr class="'+subClass+' sub-row" data-sub-of="'+i+'" data-sub-type="end">' +
      '<td colspan="2" style="text-align:right;font-size:11px;color:#666;padding-right:10px;">'+labelText+'</td>' +
      '<td colspan="6"><input type="date" data-field="end_date" value="'+escapeHtml(s.end_date||'')+'" style="width:auto;"></td>' +
      '<td></td>' +
    '</tr>';
  }

  // 予約行を表示する条件: 予約者・予約日があれば状況に関わらず表示する。
  // (使用中の区画に「次の入居予定者」を予約として紐づけた場合も見えるようにする)
  // 解約中で予約がまだ無い場合は「予約を追加」ボタンを出す。
  const hasReservation = !!(s.res_user || s.res_date);
  const showReservation = hasReservation || (status === '予');
  const showAddResBtn = (status === '解' && !hasReservation);

  if(showReservation){
    // 1段目: 予約者情報(× ボタン+棟・号室・予約者名・金額・予約中・備考)
    html += '<tr class="st-予 sub-row" data-sub-of="'+i+'" data-sub-type="reservation-info">' +
      '<td style="text-align:center;font-size:11px;color:#1e40af;font-weight:700;white-space:nowrap;">' +
        '<button type="button" onclick="cancelReservation('+i+')" title="予約取り消し" class="cancel-res-btn">×</button>' +
        '<span style="margin-left:4px;">予約</span>' +
      '</td>' +
      '<td></td>' +
      '<td>' + renderTouCell(s.res_tou||'', 'res_tou') + '</td>' +
      '<td><input type="text" data-field="res_room" value="'+escapeHtml(s.res_room||'')+'" placeholder="号室"></td>' +
      '<td><input type="text" data-field="res_user" value="'+escapeHtml(s.res_user||'')+'" placeholder="予約者名"></td>' +
      '<td><input type="text" data-field="res_price" value="'+formatPrice(s.res_price || s.price || 0)+'" placeholder="0" oninput="onPriceInput(this)" inputmode="numeric" style="text-align:right;" title="予約時の月額(既定は区画の月額)"></td>' +
      '<td style="text-align:center;font-size:10px;color:#1e40af;">予約中</td>' +
      '<td><input type="text" data-field="res_note" value="'+escapeHtml(s.res_note||'')+'" placeholder="予約備考"></td>' +
      '<td></td>' +
    '</tr>' +
    // 2段目: 予約日(解約日と同じシンプルな構造)
    '<tr class="st-予 sub-row" data-sub-of="'+i+'" data-sub-type="reservation-date">' +
      '<td colspan="2" style="text-align:right;font-size:11px;color:#1e40af;padding-right:10px;">└ 予約日:</td>' +
      '<td colspan="6"><input type="date" data-field="res_date" value="'+escapeHtml((typeof normalizeDate==='function'?normalizeDate(s.res_date):s.res_date)||'')+'" title="予約開始日" style="width:auto;"></td>' +
      '<td></td>' +
    '</tr>';
  } else if(showAddResBtn){
    html += '<tr class="st-解 sub-row" data-sub-of="'+i+'" data-sub-type="add-res-btn">' +
      '<td colspan="9" style="text-align:center;padding:6px;background:#fef2f2;">' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="addReservationToSpot('+i+')" style="font-size:11px;padding:4px 12px;">+ 予約者を追加</button>' +
      '</td>' +
    '</tr>';
  }

  // 過去の退去済使用者を最下段にサブ行として表示(_currentPreviousUsersから読む)
  const previousUsers = _currentPreviousUsers && _currentPreviousUsers[Number(s.no)] ? _currentPreviousUsers[Number(s.no)] : [];
  if(Array.isArray(previousUsers) && previousUsers.length > 0){
    previousUsers.forEach((pu, puIdx) => {
      html += '<tr class="st-退 sub-row" data-sub-of="'+i+'" data-sub-type="previous-user" data-prev-idx="'+puIdx+'" style="background:#e5e5e5;color:#666;">' +
        '<td style="text-align:center;font-size:11px;color:#666;font-weight:700;white-space:nowrap;">' +
          '<button type="button" onclick="removePreviousUser('+Number(s.no)+','+puIdx+')" title="この退去済データを削除" style="background:transparent;border:1px solid #888;color:#888;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;">×</button>' +
          '<span style="margin-left:4px;">退去済</span>' +
        '</td>' +
        '<td></td>' +
        '<td style="color:#666;">' + escapeHtml(pu.tou || '') + '</td>' +
        '<td style="color:#666;">' + escapeHtml(pu.room || '') + '</td>' +
        '<td style="color:#666;">' + escapeHtml(pu.user || '') + '</td>' +
        '<td style="text-align:right;color:#666;font-variant-numeric:tabular-nums;">' + formatPrice(pu.price || 0) + '</td>' +
        '<td style="text-align:center;font-size:10px;color:#666;">' + (pu.end_date ? '解約日 ' + pu.end_date : '退去済') + '</td>' +
        '<td style="color:#666;font-size:11px;">' + escapeHtml(pu.note || '') + '</td>' +
        '<td></td>' +
      '</tr>';
    });
  }

  return html;
}

// 退去済データ削除(_currentPreviousUsersから直接削除して再描画)
function removePreviousUser(spotNo, prevIdx){
  if(!confirm('この退去済データを削除します。\nよろしいですか？(この操作は取り消せません)')) return;
  if(!_currentPreviousUsers || !_currentPreviousUsers[spotNo]) return;
  _currentPreviousUsers[spotNo].splice(prevIdx, 1);
  if(_currentPreviousUsers[spotNo].length === 0){
    delete _currentPreviousUsers[spotNo];
  }
  // 現在の区画状態を保持したまま再描画
  const currentSpots = collectSpotsFromForm();
  renderSpotsTable(currentSpots);
}

// 「+ 予約者を追加」ボタンのハンドラ
function addReservationToSpot(idx){
  const currentSpots = collectSpotsFromForm();
  if(currentSpots[idx]){
    // 予約データの初期値を入れる(空でも)
    if(!currentSpots[idx].res_user) currentSpots[idx].res_user = '';
    if(!currentSpots[idx].res_date) currentSpots[idx].res_date = '';
    if(!currentSpots[idx].res_price) currentSpots[idx].res_price = currentSpots[idx].price || 0;
    if(!currentSpots[idx].res_note) currentSpots[idx].res_note = '';
    // 予約者名を「(予約)」にして hasReservation を true に
    currentSpots[idx].res_user = currentSpots[idx].res_user || ' ';
  }
  renderSpotsTable(currentSpots);
  // 追加した予約行の予約者名にフォーカス
  setTimeout(() => {
    const subRow = document.querySelector('#spots-tbody tr.sub-row[data-sub-of="'+idx+'"][data-sub-type="reservation-info"]');
    if(subRow){
      const userEl = subRow.querySelector('[data-field="res_user"]');
      if(userEl){
        userEl.value = '';  // ダミー値を消す
        userEl.focus();
      }
    }
  }, 50);
}

// ==============================
// 状況変更時のハンドラ
// ==============================
function onStatusChange(selectEl){
  const tr = selectEl.closest('tr');
  if(!tr) return;
  const newStatus = selectEl.value;

  // 「空き」を選んだら、入力欄をクリア
  if(newStatus === '空'){
    if(!confirm('「空き」に変更すると、棟・号室・使用者・月額・備考がクリアされます。\nよろしいですか?')){
      // ロールバック: 現在の色クラスから元の状態を推測して戻す
      const prevStatus = Array.from(tr.classList).find(c => c.startsWith('st-'));
      if(prevStatus){
        selectEl.value = prevStatus.replace('st-','');
      }
      return;
    }
    ['tou','room','user','price','note'].forEach(f => {
      const el = tr.querySelector('[data-field="'+f+'"]');
      if(el) el.value = '';
    });
  }

  // テーブル全体を再描画(解約日・予約行の追加/削除のため)
  // ただし、現在の入力内容を保持
  const currentSpots = collectSpotsFromForm();
  const idx = parseInt(tr.dataset.idx);
  if(currentSpots[idx]){
    currentSpots[idx].status = newStatus;
  }
  renderSpotsTable(currentSpots);
}

// 使用者を入力した時、状況が「空き」なら自動で「使用中」に
function onUserInput(inputEl){
  const tr = inputEl.closest('tr');
  if(!tr) return;
  const statusEl = tr.querySelector('[data-field="status"]');
  if(!statusEl) return;
  // 使用者名に文字が入って、かつ現状況が「空」なら「借」に
  if(inputEl.value.trim() && statusEl.value === '空'){
    statusEl.value = '借';
    // 色クラスも更新
    STATUS_LIST.forEach(st => tr.classList.remove('st-'+st));
    tr.classList.add('st-借');
  }
}

// 種別を変更した時、月額を自動セット
// (手入力で上書き可能。種別を再度変えるとまた自動セット)
function onTypeChange(selectEl){
  const tr = selectEl.closest('tr');
  if(!tr) return;
  const newType = selectEl.value;
  const defaultPrice = TYPE_DEFAULT_PRICE[newType];
  if(defaultPrice === undefined) return;
  const priceEl = tr.querySelector('[data-field="price"]');
  if(priceEl){
    priceEl.value = defaultPrice.toLocaleString('ja-JP');
  }
}

// ==============================
// 一括設定: 動的な複数行管理
// ==============================
let _bulkRowSeq = 0; // 行のユニークIDカウンタ

// 1行分のHTMLを生成
function makeBulkRowHtml(rowId){
  return '<div class="bulk-row" data-bulk-row="'+rowId+'">' +
    '<div class="bulk-field-inline">' +
      '<label>範囲</label>' +
      '<span style="font-size:11px;">P</span>' +
      '<input type="number" data-bf="from" min="1" max="200" value="1">' +
      '<span style="font-size:11px;">〜 P</span>' +
      '<input type="number" data-bf="to" min="1" max="200" value="1">' +
    '</div>' +
    '<div class="bulk-field-inline">' +
      '<label>種別</label>' +
      '<select data-bf="type" onchange="onBulkTypeChangeRow(this)">' +
        '<option value="並" selected>並列</option>' +
        '<option value="縦">縦列</option>' +
        '<option value="軽">軽専用</option>' +
        '<option value="機">機械式</option>' +
      '</select>' +
    '</div>' +
    '<div class="bulk-field-inline">' +
      '<label>月額</label>' +
      '<input type="text" data-bf="price" value="3,300" inputmode="numeric" oninput="onPriceInput(this)" style="text-align:right;">' +
    '</div>' +
    '<div class="bulk-field-inline">' +
      '<label>状況</label>' +
      '<select data-bf="status">' +
        '<option value="空" selected>空き</option>' +
        '<option value="借">使用中</option>' +
        '<option value="解">解約中</option>' +
        '<option value="予">予約中</option>' +
        '<option value="退">退去済</option>' +
        '<option value="募停">募集停止</option>' +
        '<option value="申">申込中</option>' +
      '</select>' +
    '</div>' +
    '<div class="bulk-row-actions">' +
      '<button type="button" class="btn-mini" onclick="applyBulkRow('+rowId+')" title="この行の設定を範囲の区画に適用">▶ 適用</button>' +
      '<button type="button" class="bulk-row-remove" onclick="removeBulkRow('+rowId+')" title="この行を削除">×</button>' +
    '</div>' +
  '</div>';
}

// 一括設定の初期表示(1行)
function initBulkRows(){
  _bulkRowSeq = 0;
  const container = document.getElementById('bulk-rows-container');
  if(container){
    container.innerHTML = '';
    addBulkRow();
  }
  // 一括設定は初期は閉じている
  const setContainer = document.getElementById('bulk-set-container');
  const toggleIcon = document.getElementById('bulk-toggle-icon');
  if(setContainer){
    setContainer.style.display = 'none';
  }
  if(toggleIcon){
    toggleIcon.textContent = '▼';
  }
}

// 一括設定セクションの開閉
function toggleBulkSet(){
  const setContainer = document.getElementById('bulk-set-container');
  const toggleIcon = document.getElementById('bulk-toggle-icon');
  if(!setContainer) return;
  const isOpen = setContainer.style.display !== 'none';
  if(isOpen){
    setContainer.style.display = 'none';
    if(toggleIcon) toggleIcon.textContent = '▼';
  } else {
    setContainer.style.display = '';
    if(toggleIcon) toggleIcon.textContent = '▲';
  }
}

// 一括設定行を追加
function addBulkRow(){
  _bulkRowSeq++;
  const container = document.getElementById('bulk-rows-container');
  if(!container) return;
  container.insertAdjacentHTML('beforeend', makeBulkRowHtml(_bulkRowSeq));
}

// 一括設定行を削除
function removeBulkRow(rowId){
  const row = document.querySelector('.bulk-row[data-bulk-row="'+rowId+'"]');
  if(!row) return;
  const allRows = document.querySelectorAll('.bulk-row');
  if(allRows.length <= 1){
    alert('最後の1行は削除できません');
    return;
  }
  row.remove();
}

// 一括設定の種別変更時、その行の月額も連動
function onBulkTypeChangeRow(selectEl){
  const row = selectEl.closest('.bulk-row');
  if(!row) return;
  const type = selectEl.value;
  const defaultPrice = TYPE_DEFAULT_PRICE[type];
  if(defaultPrice === undefined) return;
  const priceEl = row.querySelector('[data-bf="price"]');
  if(priceEl) priceEl.value = defaultPrice.toLocaleString('ja-JP');
}

// 1行の設定を適用
function applyBulkRow(rowId){
  const row = document.querySelector('.bulk-row[data-bulk-row="'+rowId+'"]');
  if(!row) return;

  const spots = collectSpotsFromForm();
  if(spots.length === 0){
    alert('区画がありません。先に「+ 区画追加」で区画を作ってください。');
    return;
  }

  const fromVal = parseInt(row.querySelector('[data-bf="from"]').value) || 1;
  const toVal = parseInt(row.querySelector('[data-bf="to"]').value) || 1;
  let from = fromVal, to = toVal;
  if(from > to){ const tmp = from; from = to; to = tmp; }

  const maxNo = Math.max(...spots.map(s => s.no || 0));
  if(from < 1 || to > maxNo){
    alert('指定範囲が区画数を超えています。\n現在の区画は P01〜P' + String(maxNo).padStart(2,'0') + ' です。');
    return;
  }

  const type = row.querySelector('[data-bf="type"]').value;
  const price = parseInt((row.querySelector('[data-bf="price"]').value || '0').replace(/[^0-9]/g, '')) || 0;
  const status = row.querySelector('[data-bf="status"]').value;
  const statusLabel = { '借':'使用中','空':'空き','解':'解約中','予':'予約中','退':'退去済','募停':'募集停止','申':'申込中' }[status] || status;
  const rangeLabel = 'P' + String(from).padStart(2,'0') + '〜P' + String(to).padStart(2,'0');

  const msg = rangeLabel + ' に以下を適用します:\n\n' +
              '種別: ' + TYPE_LABELS[type] + '\n' +
              '月額: ' + price.toLocaleString() + '円\n' +
              '状況: ' + statusLabel + '\n\n' +
              'よろしいですか?';
  if(!confirm(msg)) return;

  spots.forEach(s => {
    if(s.no >= from && s.no <= to){
      s.type = type;
      s.price = price;
      s.status = status;
    }
  });
  renderSpotsTable(spots);
  showToast('✅ ' + rangeLabel + ' に適用しました');
}

// すべての一括設定行を順番に適用
function applyAllBulkRows(){
  const rows = document.querySelectorAll('.bulk-row');
  if(rows.length === 0) return;
  let spots = collectSpotsFromForm();
  if(spots.length === 0){
    alert('区画がありません。先に「+ 区画追加」で区画を作ってください。');
    return;
  }

  // 各行の内容を収集してプレビュー
  const previewLines = [];
  const rules = [];
  let hasError = false;
  rows.forEach((row, idx) => {
    const fromVal = parseInt(row.querySelector('[data-bf="from"]').value) || 1;
    const toVal = parseInt(row.querySelector('[data-bf="to"]').value) || 1;
    let from = fromVal, to = toVal;
    if(from > to){ const tmp = from; from = to; to = tmp; }
    const type = row.querySelector('[data-bf="type"]').value;
    const price = parseInt((row.querySelector('[data-bf="price"]').value || '0').replace(/[^0-9]/g, '')) || 0;
    const status = row.querySelector('[data-bf="status"]').value;
    const statusLabel = { '借':'使用中','空':'空き','解':'解約中','予':'予約中','退':'退去済','募停':'募集停止','申':'申込中' }[status] || status;

    const maxNo = Math.max(...spots.map(s => s.no || 0));
    if(from < 1 || to > maxNo){
      alert('行' + (idx+1) + ' の範囲が区画数を超えています(P01〜P' + String(maxNo).padStart(2,'0') + ')。');
      hasError = true;
      return;
    }
    const rangeLabel = 'P' + String(from).padStart(2,'0') + '〜P' + String(to).padStart(2,'0');
    previewLines.push('行'+(idx+1)+': ' + rangeLabel + ' = ' + TYPE_LABELS[type] + ' / ' + price.toLocaleString() + '円 / ' + statusLabel);
    rules.push({ from, to, type, price, status });
  });
  if(hasError) return;

  const msg = '以下の ' + rules.length + ' 行をまとめて適用します:\n\n' +
              previewLines.join('\n') + '\n\n' +
              'よろしいですか?';
  if(!confirm(msg)) return;

  // 順番に適用(後の行が前の行を上書きする可能性あり)
  rules.forEach(r => {
    spots.forEach(s => {
      if(s.no >= r.from && s.no <= r.to){
        s.type = r.type;
        s.price = r.price;
        s.status = r.status;
      }
    });
  });
  renderSpotsTable(spots);
  showToast('✅ ' + rules.length + '行を一括適用しました');
}

// ==============================
// 区画のドラッグ&ドロップ並び替え
// ==============================
let _draggedSpotIdx = null;

function onSpotDragStart(e, idx){
  _draggedSpotIdx = idx;
  const tr = e.currentTarget.closest('tr');
  if(tr) tr.classList.add('dragging');
  // 最低限のデータ転送(Firefoxで必要)
  try{ e.dataTransfer.setData('text/plain', String(idx)); }catch{}
  e.dataTransfer.effectAllowed = 'move';
}

function onSpotDragEnd(e){
  document.querySelectorAll('tr.spot-row').forEach(tr => {
    tr.classList.remove('dragging','drag-over-top','drag-over-bottom');
  });
  _draggedSpotIdx = null;
}

function onSpotDragOver(e){
  e.preventDefault(); // dropを許可するために必要
  if(_draggedSpotIdx === null) return;
  const tr = e.currentTarget.closest('tr');
  if(!tr) return;
  // ドラッグ中行と同じならハイライトしない
  const targetIdx = parseInt(tr.dataset.idx);
  if(targetIdx === _draggedSpotIdx) return;
  // 既存ハイライトをクリア
  document.querySelectorAll('tr.spot-row').forEach(t => {
    t.classList.remove('drag-over-top','drag-over-bottom');
  });
  // 上半分か下半分か判定
  const rect = tr.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  if(e.clientY < midY){
    tr.classList.add('drag-over-top');
  } else {
    tr.classList.add('drag-over-bottom');
  }
  e.dataTransfer.dropEffect = 'move';
}

function onSpotDragLeave(e){
  // 行を離れたらハイライト解除(ただし子要素から離れる時を除く)
  const tr = e.currentTarget.closest('tr');
  if(!tr) return;
  // relatedTargetが同じ行内にいるなら無視
  if(tr.contains(e.relatedTarget)) return;
  tr.classList.remove('drag-over-top','drag-over-bottom');
}

function onSpotDrop(e, targetIdx){
  e.preventDefault();
  if(_draggedSpotIdx === null) return;
  if(_draggedSpotIdx === targetIdx) return;

  const tr = e.currentTarget.closest('tr');
  if(!tr) return;
  const rect = tr.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const insertBefore = e.clientY < midY; // 上半分なら挿入位置はtarget、下半分ならtarget+1

  // 現在の区画データを取得して並び替え
  const spots = collectSpotsFromForm();
  const moved = spots.splice(_draggedSpotIdx, 1)[0];
  // 削除した分でインデックスがずれる可能性に対応
  let newIdx = insertBefore ? targetIdx : targetIdx + 1;
  if(_draggedSpotIdx < targetIdx) newIdx -= 1; // 元位置より後ろに移動 → 1個ずれる
  spots.splice(newIdx, 0, moved);

  // 並び替えても番号は振り直さない(各区画の本来の番号を保持)
  _draggedSpotIdx = null;
  renderSpotsTable(spots);
  showToast('🔀 区画を並び替えました');
}

// ==============================
// 区画のドラッグ&ドロップ並び替え ここまで
// ==============================

// 個別の区画を削除
// 直近削除した区画(元に戻す用)
let _lastRemovedSpot = null;
let _lastRemovedSpotIdx = null;
let _undoTimer = null;

function removeSpot(idx){
  const currentSpots = collectSpotsFromForm();
  if(idx < 0 || idx >= currentSpots.length) return;
  const s = currentSpots[idx];
  const spotNo = 'P' + String(s.no||(idx+1)).padStart(2,'0');
  const info = s.user ? '(' + s.user + ')' : '';

  // 直接削除(確認ダイアログなし)
  _lastRemovedSpot = JSON.parse(JSON.stringify(s));  // 深いコピー
  _lastRemovedSpotIdx = idx;
  currentSpots.splice(idx, 1);
  document.getElementById('f-count').value = currentSpots.length;
  renderSpotsTable(currentSpots);

  // 元に戻すトースト(5秒)
  showUndoToast('' + spotNo + ' ' + info + ' を削除', 5000);
}

// 削除を元に戻すトースト表示
function showUndoToast(message, durationMs){
  // 既存のトーストを消す
  const oldToast = document.getElementById('undo-toast');
  if(oldToast) oldToast.remove();
  if(_undoTimer){ clearTimeout(_undoTimer); _undoTimer = null; }

  const toast = document.createElement('div');
  toast.id = 'undo-toast';
  toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
    'background:#1f2937;color:#fff;padding:12px 18px;border-radius:6px;' +
    'box-shadow:0 6px 20px rgba(0,0,0,0.3);z-index:9999;font-size:13px;' +
    'display:flex;align-items:center;gap:14px;animation:fadeInUp 0.2s ease-out;';
  toast.innerHTML = '<span>' + message + '</span>' +
    '<button type="button" id="undo-toast-btn" style="background:#fbbf24;color:#000;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:700;font-size:13px;">↶ 元に戻す</button>';
  document.body.appendChild(toast);
  document.getElementById('undo-toast-btn').addEventListener('click', undoRemoveSpot);

  _undoTimer = setTimeout(() => {
    if(toast.parentNode){ toast.remove(); }
    // タイマー切れたら確定(_lastRemovedをクリア)
    _lastRemovedSpot = null;
    _lastRemovedSpotIdx = null;
    _undoTimer = null;
  }, durationMs);
}

function undoRemoveSpot(){
  if(_lastRemovedSpot === null || _lastRemovedSpotIdx === null) return;
  const currentSpots = collectSpotsFromForm();
  // 元の位置に挿入(範囲外なら末尾)
  const insertAt = Math.min(_lastRemovedSpotIdx, currentSpots.length);
  currentSpots.splice(insertAt, 0, _lastRemovedSpot);
  document.getElementById('f-count').value = currentSpots.length;
  renderSpotsTable(currentSpots);

  // トースト削除+変数クリア
  const toast = document.getElementById('undo-toast');
  if(toast) toast.remove();
  if(_undoTimer){ clearTimeout(_undoTimer); _undoTimer = null; }
  _lastRemovedSpot = null;
  _lastRemovedSpotIdx = null;
  showToast('✅ 削除を取り消しました');
}

// 区画を追加(区画一覧の見出し横ボタン)
function addSpots(){
  const addCount = parseInt(document.getElementById('add-spot-count').value) || 0;
  if(addCount < 1){
    alert('追加する区画数を入力してください(1以上)');
    return;
  }
  const currentSpots = collectSpotsFromForm();
  const currentCount = currentSpots.length;
  const newCount = currentCount + addCount;
  if(newCount > 200){
    alert('合計区画数が200を超えます(現在 ' + currentCount + ' + 追加 ' + addCount + ' = ' + newCount + ')');
    return;
  }
  // 現在の最大番号の次から連番で追加(欠番は埋めない)
  const maxNo = currentCount > 0 ? Math.max(...currentSpots.map(s => s.no || 0)) : 0;
  for(let i = 1; i <= addCount; i++){
    currentSpots.push({
      no: maxNo + i, type: '並', tou: '', room: '',
      user: '', price: 3300, status: '空', note: ''
    });
  }
  document.getElementById('f-count').value = newCount;
  renderSpotsTable(currentSpots);
  showToast('✅ ' + addCount + '区画を追加しました (合計 ' + newCount + '区画)');
}

// 予約取り消し
function cancelReservation(idx){
  if(!confirm('予約を取り消します。\n予約者・予約日・金額・棟・号室・備考が削除されます。\nよろしいですか?')){
    return;
  }
  const currentSpots = collectSpotsFromForm();
  if(currentSpots[idx]){
    delete currentSpots[idx].res_user;
    delete currentSpots[idx].res_date;
    delete currentSpots[idx].res_tou;
    delete currentSpots[idx].res_room;
    delete currentSpots[idx].res_price;
    delete currentSpots[idx].res_note;
    // 状況が「予約中」だった場合は「空き」に戻す
    if(currentSpots[idx].status === '予'){
      currentSpots[idx].status = '空';
    }
  }
  renderSpotsTable(currentSpots);
  _modalDirty = true;  // 予約削除も「未保存の変更」として扱う(保存せず閉じると確認が出る)
}

function updateRowColor(selectEl){
  const tr = selectEl.closest('tr');
  if(!tr) return;
  STATUS_LIST.forEach(st => tr.classList.remove('st-'+st));
  tr.classList.add('st-' + selectEl.value);
}

function collectSpotsFromForm(){
  // メイン行だけを対象(data-idx属性があるもの)
  const mainRows = document.querySelectorAll('#spots-tbody tr[data-idx]');
  const spots = [];
  // 元データ取得(previous_users保持のため)
  const all = loadAll();
  const origBld = currentEditId ? all[currentEditId] : null;
  const origSpots = (origBld && Array.isArray(origBld.spots)) ? origBld.spots : [];

  mainRows.forEach((tr, i) => {
    // 区画番号は hidden input から(並び替えしても固定)
    const noEl = tr.querySelector('[data-field="no"]');
    const no = parseInt(noEl ? noEl.value : '') || (i + 1);
    const idx = parseInt(tr.dataset.idx);
    const spot = {
      no: no,
      type: tr.querySelector('[data-field="type"]').value || '並',
      tou: tr.querySelector('[data-field="tou"]').value.trim(),
      room: tr.querySelector('[data-field="room"]').value.trim(),
      user: tr.querySelector('[data-field="user"]').value.trim(),
      price: parseInt((tr.querySelector('[data-field="price"]').value || '0').replace(/[^0-9]/g, '')) || 0,
      status: tr.querySelector('[data-field="status"]').value || '空',
      note: tr.querySelector('[data-field="note"]').value.trim()
    };
    // previous_users は編集中専用変数(_currentPreviousUsers)から引き継ぐ
    // 削除操作が永続化されるよう、画面の状態を信頼する
    if(_currentPreviousUsers && _currentPreviousUsers[no] && Array.isArray(_currentPreviousUsers[no]) && _currentPreviousUsers[no].length > 0){
      spot.previous_users = _currentPreviousUsers[no].slice();
    }

    // サブ行(解約日 or 予約)を探す
    // サブ行(解約日 / 予約)は両方存在し得るので全て処理
    const subRows = document.querySelectorAll('#spots-tbody tr.sub-row[data-sub-of="'+idx+'"]');
    let sawReservationRow = false;
    subRows.forEach(subRow => {
      const subType = subRow.dataset.subType;
      if(subType === 'end'){
        const endEl = subRow.querySelector('[data-field="end_date"]');
        if(endEl) spot.end_date = endEl.value || '';
      } else if(subType && subType.indexOf('reservation') === 0){
        sawReservationRow = true;
        // 予約日行 or 予約詳細行 — 該当inputがあれば各自取得
        const resDateEl = subRow.querySelector('[data-field="res_date"]');
        const resTouEl = subRow.querySelector('[data-field="res_tou"]');
        const resRoomEl = subRow.querySelector('[data-field="res_room"]');
        const resUserEl = subRow.querySelector('[data-field="res_user"]');
        const resPriceEl = subRow.querySelector('[data-field="res_price"]');
        const resNoteEl = subRow.querySelector('[data-field="res_note"]');
        if(resDateEl) spot.res_date = resDateEl.value || '';
        if(resTouEl) spot.res_tou = resTouEl.value.trim();
        if(resRoomEl) spot.res_room = resRoomEl.value.trim();
        if(resUserEl) spot.res_user = resUserEl.value.trim();
        if(resPriceEl) spot.res_price = parseInt((resPriceEl.value || '0').replace(/[^0-9]/g, '')) || 0;
        if(resNoteEl) spot.res_note = resNoteEl.value.trim();
      }
      // 'add-res-btn' は無視(ボタン行なのでデータなし)
    });
    // 予約の紐づけキー(res_srcKey)は画面に入力欄が無いので、元データから引き継ぐ。
    // ただし「予約行が画面にある(=予約が生きている)」ときだけ。
    // 予約行が無い場合は、ユーザーが削除した/もともと無い状態なので、
    // 元データから予約情報を復活させない(削除を確実に反映する)。
    if(sawReservationRow){
      const origSpot = origSpots.find(os => parseInt(String(os.no).replace(/\D/g,''),10) === no
                                          || String(os.no) === String(no));
      if(origSpot && origSpot.res_srcKey) spot.res_srcKey = origSpot.res_srcKey;
    }
    spots.push(spot);
  });
  return spots;
}

// ==============================
// 保存
// ==============================
function saveBld(){
  // 画像アップロード中は保存させない(temp_ のまま保存される事故を防ぐ)
  if(_uploadingCount > 0){
    showToast('画像のクラウド保存中です。完了までお待ちください (' + _uploadingCount + '枚)');
    return;
  }
  const name = document.getElementById('f-name').value.trim();
  const zip = document.getElementById('f-zip').value.trim();
  const addr = document.getElementById('f-addr').value.trim();
  if(!name){
    alert('物件名を入力してください');
    return;
  }
  const spots = collectSpotsFromForm();
  // 縦列ペア連動: 種別が「縦」で号室が同じ区画どうしをペアとみなし、
  // 片方に予約が入っていればもう片方にも同じ予約(予約者・予約日・金額・棟・備考)を反映する。
  // 片方の予約を消した場合は、ペア側の同一予約も消す。
  (function syncVerticalPairReservations(){
    for(let a=0; a<spots.length; a++){
      const sa = spots[a];
      if(sa.type !== '縦') continue;
      const roomA = String(sa.room||'').trim();
      if(!roomA) continue;  // 号室が空のものはペア判定しない
      for(let b=0; b<spots.length; b++){
        if(b===a) continue;
        const sb = spots[b];
        if(sb.type !== '縦') continue;
        if(String(sb.room||'').trim() !== roomA) continue;  // 同じ号室がペア
        const aHasRes = !!(sa.res_user || sa.res_date);
        const bHasRes = !!(sb.res_user || sb.res_date);
        if(aHasRes && !bHasRes){
          // a の予約を b にコピー
          sb.res_user = sa.res_user || '';
          sb.res_date = sa.res_date || '';
          sb.res_tou  = sa.res_tou  || '';
          sb.res_room = sa.res_room || '';
          sb.res_price= (sa.res_price != null ? sa.res_price : (sb.price||0));
          sb.res_note = sa.res_note || '';
          if(sa.res_srcKey) sb.res_srcKey = sa.res_srcKey;
        }
      }
    }
  })();
  const all = loadAll();

  // 画像アップロード未完了(仮ID temp_)のチェック
  const pendingTemp = [];
  if(_currentImages.layout_id && _currentImages.layout_id.startsWith('temp_')) pendingTemp.push('配置図1');
  if(_currentImages.layout2_id && _currentImages.layout2_id.startsWith('temp_')) pendingTemp.push('配置図2');
  (_currentImages.photo_ids || []).forEach((pid, i) => {
    if(pid && pid.startsWith('temp_')) pendingTemp.push('現地写真' + (i+1));
  });
  if(pendingTemp.length > 0){
    const ok = confirm(
      '⚠️ 次の画像のクラウド保存が完了していません:\n' +
      '  ' + pendingTemp.join(', ') + '\n\n' +
      'このまま保存すると、これらの画像は次回開いたとき表示できません。\n' +
      '(クラウドにアップロードされていないため)\n\n' +
      '【OK】未完了の画像を取り除いて保存\n' +
      '【キャンセル】保存せず戻る(画像を入れ直してください)'
    );
    if(!ok) return;
    // 未完了の仮IDを取り除く
    if(_currentImages.layout_id && _currentImages.layout_id.startsWith('temp_')){
      _currentImages.layout_id = '';
      _currentImages.layout_url = '';
    }
    if(_currentImages.layout2_id && _currentImages.layout2_id.startsWith('temp_')){
      _currentImages.layout2_id = '';
      _currentImages.layout2_url = '';
    }
    _currentImages.photo_ids = (_currentImages.photo_ids || []).filter(pid => !(pid && pid.startsWith('temp_')));
    renderImageSection();
  }

  let id;
  if(currentEditId){
    // 編集
    id = currentEditId;
  } else {
    // 新規 - 重複チェック(名前+住所)
    const dup = Object.values(all).find(b =>
      (b.name||'') === name && (b.addr||'') === addr
    );
    if(dup){
      if(!confirm('同じ名前・住所の物件が既に存在します。\n別物件として登録しますか?')){
        return;
      }
    }
    id = genId();
  }

  all[id] = {
    id, name, zip, addr, spots,
    main_tou: (document.getElementById('f-main-tou').value || '').trim(),
    layout_id: _currentImages.layout_id || '',
    layout2_id: _currentImages.layout2_id || '',
    mime: Object.assign({}, _currentImages.mime || {}),
    photo_ids: (_currentImages.photo_ids || []).slice(),
    tou_addrs: (Array.isArray(_touAddrs) ? _touAddrs.filter(ta => (ta.tou||'').trim() || (ta.addr||'').trim()) : [])
  };
  if(saveAll(all)){
    const wasNew = !currentEditId;
    _modalDirty = false;  // 保存できたので未保存状態を解除
    showToast(wasNew ? '✅ 新規登録しました' : '✅ 編集を保存しました');
    showSaveToast(wasNew ? '✅ 新規登録しました' : '✅ 保存しました');
    if(wasNew){
      // 新規登録時のみ閉じて一覧に戻る
      closeModal();
      // 検索ボックスもクリア(二重入力防止用に入っていた値を消す)
      const searchEl = document.getElementById('search');
      if(searchEl) searchEl.value = '';
      renderAll();
    } else {
      // 編集時はモーダルを開いたまま、currentEditIdを保持して再ロード
      // 物件名のタイトルだけ更新(他のフォーム値はそのまま)
      const titleEl = document.getElementById('modal-title');
      if(titleEl) titleEl.textContent = '物件編集: ' + (name || '');
      // 一覧画面の方も裏で更新しておく(モーダル閉じた時に最新が見える)
      renderAll();
    }
  }
}

// ==============================
// 削除
// ==============================
function deleteBld(){
  if(!currentEditId) return;
  const all = loadAll();
  const b = all[currentEditId];
  if(!b) return;
  if(!confirm('物件「' + (b.name||'') + '」を削除します。\nこの操作は取り消せません。本当に削除しますか?')){
    return;
  }
  delete all[currentEditId];
  if(saveAll(all)){
    showToast('削除しました');
    _modalDirty = false;  // 削除済みなので未保存確認は不要
    closeModal();
    renderAll();
  }
}

// ==============================
// バックアップ・復元
// ==============================
function downloadBackup(){
  const all = loadAll();
  let contracts = {};
　try{ contracts = JSON.parse(localStorage.getItem(ctKey()) || '{}'); }catch(e){}
  let owners = [];
  try{ owners = JSON.parse(localStorage.getItem((typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + 'rent_owner_send_owners_v1') || '[]'); }catch(e){}
  const data = {
    version: '1.1',
    exportedAt: new Date().toISOString(),
    buildings: all,
    contracts: contracts,   // ★契約も含める（Contractタブのカード）
    owners: owners
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dt = new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
  a.download = 'PIVOT_backup_' + dt + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('バックアップをダウンロードしました（物件・契約）');
}

// 緊急復元：起動時の自動退避（pivot_emergency_backup）から、直前の状態に戻す
function restoreEmergencyBackup(){
  let snap = null;
  try{ snap = JSON.parse(localStorage.getItem((typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + 'emergency_backup') || 'null'); }catch(e){ snap = null; }
  if(!snap){ alert('緊急バックアップが見つかりませんでした。'); return; }
  let bc=0, cc=0;
  try{ bc = Object.keys(JSON.parse(snap.buildings||'{}')).length; }catch(e){}
  try{ cc = Object.keys(JSON.parse(snap.contracts||'{}')).length; }catch(e){}
  const when = snap.at ? new Date(snap.at).toLocaleString('ja-JP') : '不明';
  if(!confirm('起動直前の状態に戻します。\n\n退避時刻: '+when+'\n物件: '+bc+'件 ／ 契約: '+cc+'件\n\n現在のデータは、この退避内容で上書きされます。よろしいですか？')) return;
  try{
    if(snap.buildings) localStorage.setItem(STORAGE_KEY, snap.buildings);
    if(snap.contracts) localStorage.setItem(ctKey(), snap.contracts);
    alert('復元しました。ページを再読み込みします。');
    location.reload();
  }catch(e){ alert('復元中にエラーが発生しました: '+e); }
}
try{ if(typeof window!=='undefined'){ window.restoreEmergencyBackup = restoreEmergencyBackup; } }catch(e){}

function restoreBackup(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const data = JSON.parse(e.target.result);
      if(!data.buildings){
        alert('このファイルは PIVOT のバックアップではないようです');
        return;
      }
      const count = Object.keys(data.buildings).length;
      const ccount = data.contracts ? Object.keys(data.contracts).length : 0;
      if(!confirm('バックアップから物件 ' + count + ' 件' + (ccount?('・契約 '+ccount+' 件'):'') + ' を復元します。\nこの端末の現在データは上書きされます。\n本当に復元しますか?')){
        return;
      }
      if(saveAll(data.buildings)){
        if(data.contracts && typeof data.contracts === 'object'){
          try{ localStorage.setItem(ctKey(), JSON.stringify(data.contracts)); }catch(e){}
          try{ if(window.KB && window.KB.renderAll) window.KB.renderAll(); }catch(e){}
        }
        if(data.owners && typeof window.applyCloudOwners === 'function'){ try{ window.applyCloudOwners(data.owners); }catch(e){} }
        showToast('✅ 物件' + count + '件' + (ccount?('・契約'+ccount+'件'):'') + 'を復元しました');
        renderAll();
      }
    }catch(err){
      alert('ファイル読み込みエラー: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // 同じファイルを再選択できるように
}

// ==============================
// ユーティリティ
// ==============================
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function formatPrice(n){
  const num = parseInt(n) || 0;
  if(num === 0) return '';
  return num.toLocaleString('ja-JP');
}
function onPriceInput(inputEl){
  // 入力中: 数字以外を除去してカンマ付きで再表示
  const raw = (inputEl.value || '').replace(/[^0-9]/g, '');
  const num = parseInt(raw) || 0;
  inputEl.dataset.raw = String(num);
  inputEl.value = num === 0 ? '' : num.toLocaleString('ja-JP');
}
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// 保存完了専用のはっきり目立つ通知(画面中央・大きめ・約2秒)
function showSaveToast(msg){
  let el = document.getElementById('save-toast-center');
  if(!el){
    el = document.createElement('div');
    el.id = 'save-toast-center';
    el.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.9);' +
      'z-index:99999;background:rgba(17,17,17,0.95);color:#fff;' +
      'padding:22px 38px;border-radius:16px;font-size:20px;font-weight:800;' +
      'font-family:inherit;box-shadow:0 10px 40px rgba(0,0,0,0.35);' +
      'border:2px solid #34c759;opacity:0;pointer-events:none;' +
      'transition:opacity .18s ease, transform .18s ease;text-align:center;white-space:nowrap;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1)';
  });
  clearTimeout(window._saveToastTimer);
  window._saveToastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%,-50%) scale(0.9)';
  }, 1800);
}

// ==============================
// 画像機能(配置図・現地写真)
// ==============================
// 現在編集中の画像データ(物件編集モーダル内)
let _currentImages = { layout_id: '', layout_url: '', layout2_id: '', layout2_url: '', photo_ids: [], photo_urls: {}, mime: {} };

// 編集中の画像URL一時キャッシュ(画像IDから表示用base64データへ)
const _imgCache = {};

// ==============================
// 画像の永続キャッシュ (IndexedDB)
// 一度クラウドから取得した画像を端末に保存し、2回目以降は即表示する
// ==============================
const IMGDB_NAME = (typeof insPrefix === 'function' ? insPrefix() : 'pivot_') + 'img_cache';
const IMGDB_STORE = 'images';
let _imgDbPromise = null;
function openImgDb(){
  if(_imgDbPromise) return _imgDbPromise;
  _imgDbPromise = new Promise((resolve, reject) => {
    if(!window.indexedDB){ resolve(null); return; }
    const req = indexedDB.open(IMGDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(IMGDB_STORE)){
        db.createObjectStore(IMGDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { console.warn('IndexedDB open失敗:', req.error); resolve(null); };
  });
  return _imgDbPromise;
}
async function idbGetImage(id){
  try{
    const db = await openImgDb();
    if(!db) return null;
    return await new Promise((resolve) => {
      const tx = db.transaction(IMGDB_STORE, 'readonly');
      const r = tx.objectStore(IMGDB_STORE).get(id);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    });
  }catch(e){ return null; }
}
async function idbPutImage(id, dataUrl){
  try{
    const db = await openImgDb();
    if(!db) return;
    const tx = db.transaction(IMGDB_STORE, 'readwrite');
    tx.objectStore(IMGDB_STORE).put(dataUrl, id);
  }catch(e){ /* 保存失敗は無視(表示には影響しない) */ }
}
async function idbDeleteImage(id){
  try{
    const db = await openImgDb();
    if(!db) return;
    const tx = db.transaction(IMGDB_STORE, 'readwrite');
    tx.objectStore(IMGDB_STORE).delete(id);
  }catch(e){ /* 無視 */ }
}
// 取得済み画像をメモリ+IndexedDBの両方に保存
function cacheImage(id, dataUrl){
  if(!id || id.startsWith('temp_')) { _imgCache[id] = dataUrl; return; }
  _imgCache[id] = dataUrl;
  idbPutImage(id, dataUrl);
}

// ==============================
// 画像チェック(クラウド未保存 temp_ の洗い出し)
// ==============================
function openImgDiagModal(){
  document.getElementById('img-diag-modal').classList.add('active');
  runImgDiag();
}
function closeImgDiagModal(){
  document.getElementById('img-diag-modal').classList.remove('active');
}
function runImgDiag(){
  const body = document.getElementById('img-diag-body');
  const all = loadAll();
  const broken = [];
  Object.values(all).forEach(b => {
    const items = [];
    if(b.layout_id && b.layout_id.startsWith('temp_')) items.push('配置図1');
    if(b.layout2_id && b.layout2_id.startsWith('temp_')) items.push('配置図2');
    (b.photo_ids || []).forEach((pid, i) => {
      if(pid && pid.startsWith('temp_')) items.push('写真'+(i+1));
    });
    if(items.length > 0){
      broken.push({ id: b.id, name: b.name || '(名称未設定)', items: items });
    }
  });

  if(broken.length === 0){
    body.innerHTML = '<div style="color:#16a34a;font-weight:700;padding:8px 0;">✅ クラウド未保存の画像はありません。すべて正常です。</div>';
    return;
  }

  let html = '<div style="color:#b45309;font-weight:700;margin-bottom:10px;">⚠ 次の ' + broken.length + ' 件に、クラウドに保存されていない画像があります。</div>' +
    '<div style="font-size:12px;color:#666;margin-bottom:14px;">これらは実データがクラウドに存在しないため表示できません。各物件を開き、該当画像を×で削除して元画像を入れ直してください(「✅クラウド保存完了」を確認してから保存)。</div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<tr style="border-bottom:1px solid #000;text-align:left;"><th style="padding:6px 4px;">物件名</th><th style="padding:6px 4px;">未保存の画像</th><th style="padding:6px 4px;width:70px;"></th></tr>';
  broken.forEach(b => {
    html += '<tr style="border-bottom:1px solid #ddd;">' +
      '<td style="padding:6px 4px;font-weight:700;">' + escapeHtml(b.name) + '</td>' +
      '<td style="padding:6px 4px;color:#b45309;">' + b.items.join(', ') + '</td>' +
      '<td style="padding:6px 4px;"><button class="btn btn-sm" style="font-size:11px;padding:4px 10px;" onclick="openFromDiag(\'' + b.id + '\')">開く</button></td>' +
    '</tr>';
  });
  html += '</table>';
  body.innerHTML = html;
}
function openFromDiag(id){
  closeImgDiagModal();
  openModal(id);
}

// 一覧表示時に全物件の画像を裏で先読み(端末に無いものだけクラウド取得)
let _prefetchRunning = false;
async function prefetchAllImages(){
  if(_prefetchRunning) return;
  _prefetchRunning = true;
  try{
    const url = getCloudUrl();
    const all = loadAll();
    // 全画像IDを収集(temp_ は除外)
    const ids = [];
    Object.values(all).forEach(b => {
      if(b.layout_id && !b.layout_id.startsWith('temp_')) ids.push(b.layout_id);
      if(b.layout2_id && !b.layout2_id.startsWith('temp_')) ids.push(b.layout2_id);
      (b.photo_ids || []).forEach(pid => {
        if(pid && !pid.startsWith('temp_')) ids.push(pid);
      });
    });
    // 端末に無いものだけ残す
    const missing = [];
    for(const id of ids){
      if(_imgCache[id]) continue;
      const cached = await idbGetImage(id);
      if(cached){ _imgCache[id] = cached; }
      else { missing.push(id); }
    }
    if(!url || missing.length === 0) return;
    // サーバー負荷を抑え、3件ずつ順番に取得
    const BATCH = 3;
    for(let i = 0; i < missing.length; i += BATCH){
      const chunk = missing.slice(i, i + BATCH);
      await Promise.all(chunk.map(id =>
        postToGas(url, { action: 'getImageUrl', fileId: id }, 25000)
          .then(r => {
            if(r && r.ok && r.base64){
              cacheImage(id, 'data:'+r.mimeType+';base64,'+r.base64);
            }
          })
          .catch(() => { /* 先読み失敗は無視。開いたとき個別に再取得される */ })
      ));
    }
  } finally {
    _prefetchRunning = false;
  }
}

// 画像セクションを描画
function renderImageSection(){
  renderLayoutArea();
  renderPhotosArea();
  // 読み込み待ち画像があれば、並列で一気に取得
  preloadMissingImages();
}

// 未読込の画像を並列で一気に取得
let _preloadPromises = {};
// 読込に失敗した画像ID(再試行用)
let _imgFailed = {};
async function preloadMissingImages(){
  const url = getCloudUrl();
  const idsToLoad = [];
  if(_currentImages.layout_id && !_currentImages.layout_id.startsWith('temp_') && !_imgCache[_currentImages.layout_id] && !_preloadPromises[_currentImages.layout_id]){
    idsToLoad.push(_currentImages.layout_id);
  }
  if(_currentImages.layout2_id && !_currentImages.layout2_id.startsWith('temp_') && !_imgCache[_currentImages.layout2_id] && !_preloadPromises[_currentImages.layout2_id]){
    idsToLoad.push(_currentImages.layout2_id);
  }
  (_currentImages.photo_ids || []).forEach(id => {
    if(id && !id.startsWith('temp_') && !_imgCache[id] && !_preloadPromises[id]){
      idsToLoad.push(id);
    }
  });
  if(idsToLoad.length === 0) return;

  idsToLoad.forEach(id => {
    delete _imgFailed[id];
    // ❶ まず端末(IndexedDB)を確認 → あればクラウドを叩かず即表示
    _preloadPromises[id] = idbGetImage(id).then(cached => {
      if(cached){
        _imgCache[id] = cached;
        if(id === _currentImages.layout_id) _currentImages.layout_url = cached;
        if(id === _currentImages.layout2_id) _currentImages.layout2_url = cached;
        if((_currentImages.photo_ids || []).indexOf(id) >= 0) _currentImages.photo_urls[id] = cached;
        delete _preloadPromises[id];
        renderLayoutArea();
        renderPhotosArea();
        return;
      }
      // ❷ 端末になければクラウドから取得
      if(!url){
        delete _preloadPromises[id];
        return;
      }
      return postToGas(url, { action: 'getImageUrl', fileId: id }, 25000)
        .then(r => {
          if(r && r.ok && r.base64){
            const dataUrl = 'data:'+r.mimeType+';base64,'+r.base64;
            cacheImage(id, dataUrl);   // メモリ + 端末に保存
            _currentImages.mime = _currentImages.mime || {};
            if(r.mimeType) _currentImages.mime[id] = r.mimeType;
            if(id === _currentImages.layout_id) _currentImages.layout_url = dataUrl;
            if(id === _currentImages.layout2_id) _currentImages.layout2_url = dataUrl;
            if((_currentImages.photo_ids || []).indexOf(id) >= 0) _currentImages.photo_urls[id] = dataUrl;
          } else {
            _imgFailed[id] = (r && r.message) ? r.message : '画像が見つかりません';
            console.warn('画像読込失敗:', id, _imgFailed[id]);
          }
          delete _preloadPromises[id];
          renderLayoutArea();
          renderPhotosArea();
        });
    }).catch(e => {
      _imgFailed[id] = e.message || '読込エラー';
      console.warn('画像読込失敗:', id, e.message);
      delete _preloadPromises[id];
      renderLayoutArea();
      renderPhotosArea();
    });
  });
}

// 1枚だけ再試行
function retryImage(fileId){
  if(!fileId) return;
  delete _imgFailed[fileId];
  // 「読込中」に戻す
  renderLayoutArea();
  renderPhotosArea();
  preloadMissingImages();
}

function _layoutSlotHtml(slot){
  // slot: 1 or 2
  const id = slot === 1 ? _currentImages.layout_id : _currentImages.layout2_id;
  const urlField = slot === 1 ? _currentImages.layout_url : _currentImages.layout2_url;
  if(!id) return '';
  const url = urlField || _imgCache[id] || '';
  const mime = (_currentImages.mime && _currentImages.mime[id]) || '';
  const isPdf = mime === 'application/pdf' || (id && /pdf/i.test(id));
  let inner;
  if(isPdf){
    // PDFはサムネイル表示できないのでアイコン+クリックで開く
    inner = '<div class="img-thumb-pdf" onclick="openPdf(\''+slot+'\')" title="クリックでPDFを開く">' +
      '<div style="font-size:34px;">📄</div>' +
      '<div style="font-size:11px;font-weight:700;margin-top:4px;">PDF配置図</div>' +
      '<div style="font-size:10px;color:#888;">クリックで開く</div>' +
    '</div>';
    return '<div class="img-thumb">' +
      '<button class="img-thumb-remove" onclick="removeLayoutSlot(event,'+slot+')" title="削除">×</button>' +
      inner +
    '</div>';
  }
  if(url){
    inner = '<img src="'+url+'" alt="配置図'+slot+'">';
  } else if(id.startsWith('temp_')){
    inner = '<div class="img-thumb-loading is-unsaved"><div>⚠ クラウド未保存</div><div>×で削除し<br>入れ直してください</div></div>';
  } else if(_imgFailed[id]){
    inner = '<div class="img-thumb-loading is-error" onclick="event.stopPropagation();retryImage(\''+id+'\')"><div>⚠ 読込失敗</div><button class="img-thumb-retry-btn" onclick="event.stopPropagation();retryImage(\''+id+'\')">再試行</button></div>';
  } else {
    inner = '<div class="img-thumb-loading">読込中...</div>';
  }
  return '<div class="img-thumb" onclick="openImgZoom(this.querySelector(\'img\') ? this.querySelector(\'img\').src : \'\')">' +
    '<button class="img-thumb-remove" onclick="removeLayoutSlot(event,'+slot+')" title="削除">×</button>' +
    inner +
  '</div>';
}

function renderLayoutArea(){
  const area = document.getElementById('layout-area');
  if(!area) return;
  const count = (_currentImages.layout_id ? 1 : 0) + (_currentImages.layout2_id ? 1 : 0);
  let html = '';
  html += _layoutSlotHtml(1);
  html += _layoutSlotHtml(2);

  if(count === 0){
    // 未登録: 大きなアップロード枠
    html += '<label class="img-upload-btn" title="配置図をアップロード(画像またはPDF・クリック/ドラッグ&ドロップ・最大2件)">' +
      '<span>📐</span><span>+ 配置図を追加</span>' +
      '<span style="font-size:10px;color:#888;">画像/PDF・クリック/ドラッグ&ドロップ</span>' +
      '<input type="file" accept="image/*" style="display:none" onchange="onLayoutSelected(event)">' +
    '</label>';
  } else if(count === 1){
    // 1枚だけ: 画像を大きく見せたいので、追加は小さなリンクのみ
    html += '<label class="img-add-link" title="2枚目の配置図を追加(画像/PDF)">' +
      '<span>＋ 2枚目を追加</span>' +
      '<input type="file" accept="image/*" style="display:none" onchange="onLayoutSelected(event)">' +
    '</label>';
  }
  // count === 2 はアップロードボタンなし
  area.innerHTML = html;
  area.classList.toggle('layout-single', count === 1);
}

// PDFを別タブで開く
function openPdf(slot){
  slot = Number(slot);
  const id = slot === 1 ? _currentImages.layout_id : _currentImages.layout2_id;
  const url = (slot === 1 ? _currentImages.layout_url : _currentImages.layout2_url) || _imgCache[id] || '';
  if(!url){ showToast('PDFを読込中です。少し待ってから再度お試しください'); return; }
  // data URL を新規タブで開く
  const w = window.open();
  if(w){
    w.document.write('<iframe src="'+url+'" style="border:0;position:fixed;inset:0;width:100%;height:100%"></iframe>');
  } else {
    // ポップアップブロック時はダウンロード的に開く
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.click();
  }
}

function renderPhotosArea(){
  const area = document.getElementById('photos-area');
  if(!area) return;
  const photos = _currentImages.photo_ids || [];
  let html = '';
  photos.forEach((id, idx) => {
    const url = _currentImages.photo_urls[id] || _imgCache[id] || '';
    let inner;
    if(url){
      inner = '<img src="'+url+'" alt="現地写真'+(idx+1)+'">';
    } else if(id.startsWith('temp_')){
      inner = '<div class="img-thumb-loading is-unsaved">' +
        '<div>⚠ クラウド未保存</div>' +
        '<div>×で削除し<br>入れ直してください</div>' +
      '</div>';
    } else if(_imgFailed[id]){
      inner = '<div class="img-thumb-loading is-error" onclick="event.stopPropagation();retryImage(\''+id+'\')">' +
        '<div>⚠ 読込失敗</div>' +
        '<button class="img-thumb-retry-btn" onclick="event.stopPropagation();retryImage(\''+id+'\')">再試行</button>' +
      '</div>';
    } else {
      inner = '<div class="img-thumb-loading">読込中...</div>';
    }
    html += '<div class="img-thumb" onclick="openImgZoom(this.querySelector(\'img\') ? this.querySelector(\'img\').src : \'\')">' +
      '<button class="img-thumb-remove" onclick="removePhoto(event,\''+id+'\')" title="削除">×</button>' +
      inner +
    '</div>';
  });
  // アップロードボタン(5枚未満なら)
  if(photos.length < 5){
    const remaining = 5 - photos.length;
    html += '<label class="img-upload-btn" title="現地写真をアップロード(クリック または ドラッグ&ドロップ・最大'+remaining+'枚)">' +
      '<span>📷</span><span>+ 現地写真 (残'+remaining+')</span>' +
      '<span style="font-size:10px;color:#888;">クリック / ドラッグ&ドロップ</span>' +
      '<input type="file" accept="image/*" multiple style="display:none" onchange="onPhotoSelected(event)">' +
    '</label>';
  }
  area.innerHTML = html;
}

// クラウドから画像を読み込み(キャッシュにも保存)
async function loadImageFromCloud(fileId, kind){
  const url = getCloudUrl();
  if(!url || !fileId) return;
  try {
    const r = await postToGas(url, { action: 'getImageUrl', fileId: fileId });
    if(r.ok){
      const dataUrl = 'data:'+r.mimeType+';base64,'+r.base64;
      _imgCache[fileId] = dataUrl;
      if(kind === 'layout'){
        _currentImages.layout_url = dataUrl;
      } else {
        _currentImages.photo_urls[fileId] = dataUrl;
      }
      // 再描画
      renderImageSection();
    }
  } catch(e){
    console.warn('画像読込失敗:', fileId, e.message);
  }
}

// ファイル選択時(配置図) — 画像/PDF 最大2件
async function onLayoutSelected(event){
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  await addLayoutFiles(files);
}

// 配置図に複数ファイルを空きスロットへ追加
async function addLayoutFiles(files){
  // PDFは受け付けない(JPEG等の画像のみ)
  const hadPdf = files.some(f => f.type === 'application/pdf');
  const valid = files.filter(f => f.type.startsWith('image/'));
  if(valid.length === 0){ showToast(hadPdf ? 'PDFは使えません。JPEGなどの画像を選んでください' : '画像を選んでください'); return; }
  if(hadPdf){ showToast('PDFは登録できないため除外しました(JPEGのみ対応)'); }
  for(const f of valid){
    const freeSlot = !_currentImages.layout_id ? 1 : (!_currentImages.layout2_id ? 2 : 0);
    if(freeSlot === 0){ showToast('配置図は最大2件までです'); break; }
    await uploadLayoutFile(f, freeSlot);
  }
}

// ===== ドラッグ&ドロップ対応 =====
// ドラッグ中の見た目(枠ハイライト)
function onImgDragOver(event){
  event.preventDefault();
  event.stopPropagation();
  const t = event.currentTarget;
  t.classList.add('img-drag-over');
}
function onImgDragLeave(event){
  event.preventDefault();
  event.stopPropagation();
  // 子要素へ移動しただけの場合は外さない
  if(event.currentTarget.contains(event.relatedTarget)) return;
  event.currentTarget.classList.remove('img-drag-over');
}
// 配置図エリアにドロップ(画像/PDF・最大2件)
async function onLayoutDrop(event){
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('img-drag-over');
  const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
  if(files.length === 0){ return; }
  await addLayoutFiles(files);
}
// 現地写真エリアにドロップ(複数可)
async function onPhotosDrop(event){
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('img-drag-over');
  const files = Array.from(event.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
  if(files.length === 0) return;
  const currentCount = (_currentImages.photo_ids || []).length;
  const remaining = 5 - currentCount;
  if(remaining <= 0){ alert('現地写真は最大5枚までです'); return; }
  const filesToUpload = files.slice(0, remaining);
  if(files.length > remaining){
    alert((files.length - remaining) + '枚は上限を超えるためスキップします。\n('+ remaining +'枚だけアップロードします)');
  }
  for(let i = 0; i < filesToUpload.length; i++){
    try { await uploadImageOptimistic(filesToUpload[i], 'photo'); }
    catch(e){ alert((i+1) + '枚目の処理失敗: ' + e.message); break; }
  }
}

// ファイル選択時(現地写真) - 複数枚対応 + 楽観的UI
async function onPhotoSelected(event){
  const files = Array.from(event.target.files || []);
  if(files.length === 0) return;
  event.target.value = '';

  const currentCount = (_currentImages.photo_ids || []).length;
  const remaining = 5 - currentCount;
  if(remaining <= 0){
    alert('現地写真は最大5枚までです');
    return;
  }

  // 上限超えていたら、最初の数枚だけアップロード
  const filesToUpload = files.slice(0, remaining);
  if(files.length > remaining){
    alert((files.length - remaining) + '枚は上限を超えるためスキップします。\n('+ remaining +'枚だけアップロードします)');
  }

  // ❶ まず全部圧縮&即表示(待ちなしで一気に)
  for(let i = 0; i < filesToUpload.length; i++){
    try {
      await uploadImageOptimistic(filesToUpload[i], 'photo');
    } catch(e){
      alert((i+1) + '枚目の処理失敗: ' + e.message);
      break;
    }
  }
}

// 配置図ファイル(画像/PDF)を指定スロットへアップロード
async function uploadLayoutFile(file, slot){
  const url = getCloudUrl();
  if(!url){
    alert('クラウドURL が設定されていません。\nクラウド ボタンから設定してください。');
    return;
  }
  if(!currentEditId && !document.getElementById('f-name').value.trim()){
    alert('先に物件名を入力してください');
    return;
  }
  let bldId = currentEditId;
  let bldName = document.getElementById('f-name').value.trim();
  if(!bldId){
    bldId = 'bld_' + Date.now() + '_' + Math.floor(Math.random()*1000);
    currentEditId = bldId;
  }

  const isPdf = file.type === 'application/pdf';
  let dataUrl, fileName, mimeType;
  if(isPdf){
    dataUrl = await readFileAsDataURL(file);   // PDFは圧縮せずそのまま
    fileName = 'layout_' + Date.now() + '.pdf';
    mimeType = 'application/pdf';
  } else {
    dataUrl = await compressImage(file, 1200, 0.85);
    fileName = 'layout_' + Date.now() + '.jpg';
    mimeType = 'image/jpeg';
  }

  const tempId = 'temp_' + Date.now() + '_' + Math.floor(Math.random()*10000);
  _imgCache[tempId] = dataUrl;
  _currentImages.mime = _currentImages.mime || {};
  _currentImages.mime[tempId] = mimeType;

  const oldId = slot === 1 ? _currentImages.layout_id : _currentImages.layout2_id;
  snapshotBeforeImageChange();  // 変更前の状態をUndo履歴へ
  if(slot === 1){
    _currentImages.layout_id = tempId;
    _currentImages.layout_url = dataUrl;
  } else {
    _currentImages.layout2_id = tempId;
    _currentImages.layout2_url = dataUrl;
  }
  _modalDirty = true;  // 配置図を追加/入れ替えた → 未保存
  renderImageSection();
  uploadLayoutInBackground(url, bldId, bldName, fileName, dataUrl, mimeType, slot, tempId, oldId);
}

function readFileAsDataURL(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = () => reject(new Error('ファイル読込失敗'));
    r.readAsDataURL(file);
  });
}

// 配置図スロットのバックグラウンドアップロード
async function uploadLayoutInBackground(url, bldId, bldName, fileName, dataUrl, mimeType, slot, tempId, oldId){
  _uploadingCount++;
  updateSaveBtnState();
  try {
    showToast('バックアップ中...', true);
    const r = await postToGas(url, {
      action: 'uploadImage',
      bldId: bldId,
      bldName: bldName,
      fileName: fileName,
      mimeType: mimeType,
      base64: dataUrl
    });
    if(r.ok){
      _imgCache[r.fileId] = dataUrl;
      delete _imgCache[tempId];
      cacheImage(r.fileId, dataUrl);
      _currentImages.mime = _currentImages.mime || {};
      _currentImages.mime[r.fileId] = mimeType;
      delete _currentImages.mime[tempId];
      // 古いファイルがあれば裏で削除
      if(oldId && !oldId.startsWith('temp_')){
        postToGas(url, { action: 'deleteImage', fileId: oldId }).catch(()=>{});
        idbDeleteImage(oldId);
      }
      if(slot === 1){
        _currentImages.layout_id = r.fileId;
        _currentImages.layout_url = dataUrl;
      } else {
        _currentImages.layout2_id = r.fileId;
        _currentImages.layout2_url = dataUrl;
      }
      renderImageSection();
      showToast('✅ クラウド保存完了');
    } else {
      throw new Error(r.message || '不明');
    }
  } catch(e){
    showToast('⚠️ クラウド保存失敗(表示中): ' + e.message);
    console.error('配置図アップロード失敗:', e);
  } finally {
    _uploadingCount = Math.max(0, _uploadingCount - 1);
    updateSaveBtnState();
  }
}

// 楽観的UI版アップロード: 圧縮→即表示→裏でGAS送信
async function uploadImageOptimistic(file, kind){
  const url = getCloudUrl();
  if(!url){
    alert('クラウドURL が設定されていません。\nクラウド ボタンから設定してください。');
    return;
  }
  if(!currentEditId && !document.getElementById('f-name').value.trim()){
    alert('先に物件名を入力してください');
    return;
  }

  // ID未確定なら、仮IDを発行
  let bldId = currentEditId;
  let bldName = document.getElementById('f-name').value.trim();
  if(!bldId){
    bldId = 'bld_' + Date.now() + '_' + Math.floor(Math.random()*1000);
    currentEditId = bldId;
  }

  // ❶ 圧縮(これだけ待つ。0.5秒程度)
  const compressed = await compressImage(file, 1200, 0.85);
  const fileName = (kind === 'layout' ? 'layout' : 'photo') + '_' + Date.now() + '.jpg';

  // ❷ 仮IDで即サムネイル表示(過去と同じ即時体感)
  const tempId = 'temp_' + Date.now() + '_' + Math.floor(Math.random()*10000);
  _imgCache[tempId] = compressed;

  snapshotBeforeImageChange();  // 変更前の状態をUndo履歴へ
  _modalDirty = true;  // 画像を追加/入れ替え → 未保存
  if(kind === 'layout'){
    // 既存配置図があれば一旦記憶しておく
    const oldId = _currentImages.layout_id;
    _currentImages.layout_id = tempId;
    _currentImages.layout_url = compressed;
    renderImageSection();
    // 裏でアップロード
    uploadInBackground(url, bldId, bldName, fileName, compressed, 'layout', tempId, oldId);
  } else {
    _currentImages.photo_ids = _currentImages.photo_ids || [];
    _currentImages.photo_ids.push(tempId);
    _currentImages.photo_urls[tempId] = compressed;
    renderImageSection();
    // 裏でアップロード
    uploadInBackground(url, bldId, bldName, fileName, compressed, 'photo', tempId, null);
  }
}

// アップロード中の画像枚数(0より大きい間は保存ボタンを無効化)
let _uploadingCount = 0;
function updateSaveBtnState(){
  const btn = document.getElementById('save-bld-btn');
  if(!btn) return;
  if(_uploadingCount > 0){
    btn.disabled = true;
    btn.dataset.savingImg = '1';
    btn.textContent = '画像保存中… (' + _uploadingCount + '枚)';
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
  } else {
    btn.disabled = false;
    btn.dataset.savingImg = '';
    btn.textContent = '保存';
    btn.style.opacity = '';
    btn.style.cursor = '';
  }
}

// バックグラウンドでGASにアップロード(完了したら仮IDを正式IDに差し替え)
async function uploadInBackground(url, bldId, bldName, fileName, compressed, kind, tempId, oldLayoutId){
  _uploadingCount++;
  updateSaveBtnState();
  try {
    showToast('バックアップ中...', true);
    const r = await postToGas(url, {
      action: 'uploadImage',
      bldId: bldId,
      bldName: bldName,
      fileName: fileName,
      base64: compressed
    });
    if(r.ok){
      // 仮IDを正式IDに差し替え
      _imgCache[r.fileId] = compressed;
      delete _imgCache[tempId];
      cacheImage(r.fileId, compressed);   // 端末(IndexedDB)にも保存

      if(kind === 'layout'){
        // 古い配置図があれば削除(裏で)
        if(oldLayoutId && !oldLayoutId.startsWith('temp_')){
          postToGas(url, { action: 'deleteImage', fileId: oldLayoutId }).catch(()=>{});
          idbDeleteImage(oldLayoutId);     // 端末キャッシュからも削除
        }
        _currentImages.layout_id = r.fileId;
        _currentImages.layout_url = compressed;
      } else {
        // photo_ids の中の仮ID を正式ID に置き換え
        const idx = (_currentImages.photo_ids || []).indexOf(tempId);
        if(idx >= 0){
          _currentImages.photo_ids[idx] = r.fileId;
        }
        delete _currentImages.photo_urls[tempId];
        _currentImages.photo_urls[r.fileId] = compressed;
      }
      renderImageSection();
      showToast('✅ クラウド保存完了');
    } else {
      throw new Error(r.message || '不明');
    }
  } catch(e){
    showToast('⚠️ クラウド保存失敗(画像は表示中): ' + e.message);
    console.error('アップロード失敗:', e);
    // 仮IDのまま残るので、後で「保存」時に再試行する余地あり
  } finally {
    _uploadingCount = Math.max(0, _uploadingCount - 1);
    updateSaveBtnState();
  }
}

// 画像をアップロード(旧版・配置図用)
async function uploadImage(file, kind, currentNo, totalCount){
  // 配置図など、楽観的UIを使わない場合のため残しておく(現在は使われていない)
  return uploadImageOptimistic(file, kind);
}

// 画像圧縮: 最大幅maxWidth, JPEG quality
function compressImage(file, maxWidth, quality){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if(w > maxWidth){
          h = Math.round(h * maxWidth / w);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('画像の読込失敗'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('ファイルの読込失敗'));
    reader.readAsDataURL(file);
  });
}

// 配置図削除(スロット指定・UI即時更新、サーバー削除はバックグラウンド)
function removeLayoutSlot(event, slot){
  event.stopPropagation();
  slot = Number(slot);
  const url = getCloudUrl();
  const fileId = slot === 1 ? _currentImages.layout_id : _currentImages.layout2_id;
  snapshotBeforeImageChange();  // 変更前の状態をUndo履歴へ
  if(slot === 1){
    // スロット1を消す場合、スロット2を繰り上げる
    _currentImages.layout_id = _currentImages.layout2_id || '';
    _currentImages.layout_url = _currentImages.layout2_url || '';
    _currentImages.layout2_id = '';
    _currentImages.layout2_url = '';
  } else {
    _currentImages.layout2_id = '';
    _currentImages.layout2_url = '';
  }
  if(fileId && _currentImages.mime) delete _currentImages.mime[fileId];
  _modalDirty = true;  // 配置図を削除 → 未保存
  renderImageSection();
  showToast('配置図を削除しました');
  if(fileId){ delete _imgCache[fileId]; idbDeleteImage(fileId); }
  if(fileId && url){
    postToGas(url, { action: 'deleteImage', fileId: fileId }).catch(e => {
      console.warn('配置図のサーバー削除に失敗:', e);
    });
  }
}

// 現地写真削除(UI即時更新、サーバー削除はバックグラウンド)
function removePhoto(event, fileId){
  event.stopPropagation();
  const url = getCloudUrl();
  snapshotBeforeImageChange();  // 変更前の状態をUndo履歴へ
  // UIを即時更新(サーバー応答を待たない)
  _currentImages.photo_ids = (_currentImages.photo_ids || []).filter(id => id !== fileId);
  delete _currentImages.photo_urls[fileId];
  _modalDirty = true;  // 写真を削除 → 未保存
  renderImageSection();
  showToast('写真を削除しました');
  if(fileId){ delete _imgCache[fileId]; idbDeleteImage(fileId); }
  // サーバー側削除はバックグラウンドで実行(失敗しても無視)
  if(fileId && url){
    postToGas(url, { action: 'deleteImage', fileId: fileId }).catch(e => {
      console.warn('写真のサーバー削除に失敗:', e);
    });
  }
}

// 画像拡大表示
function openImgZoom(src){
  if(!src) return;
  document.getElementById('img-zoom-target').src = src;
  document.getElementById('img-zoom').classList.add('active');
}
function closeImgZoom(event){
  if(event && event.target.tagName === 'IMG' && event.target.id === 'img-zoom-target') return;
  document.getElementById('img-zoom').classList.remove('active');
}

// ==============================
// CSV一括インポート機能
// ==============================
const CSV_VALID_TYPES = ['並','縦','軽','機'];
const CSV_VALID_STATUS = ['借','空','解','予','退','募停','申'];

function openCsvImportModal(){
  document.getElementById('csv-bld-name').value = '';
  document.getElementById('csv-bld-zip').value = '';
  document.getElementById('csv-bld-addr').value = '';
  document.getElementById('csv-bld-addr').dataset.autofilled = '';
  document.getElementById('csv-bld-note').value = '';
  document.getElementById('csv-spots-input').value = '';
  document.getElementById('csv-preview-result').innerHTML = '';
  document.getElementById('csv-import-modal').classList.add('active');
}

function closeCsvImportModal(){
  const modal = document.getElementById('csv-import-modal');
  modal.classList.remove('active');
  // 登録後・次回表示時に最上部から見えるよう、スクロール位置をリセット
  modal.querySelectorAll('.modal, .modal-body').forEach(el => { el.scrollTop = 0; });
  // ページ全体も最上部へ戻す
  window.scrollTo(0, 0);
  if(document.scrollingElement) document.scrollingElement.scrollTop = 0;
}

function csvClear(){
  document.getElementById('csv-spots-input').value = '';
  document.getElementById('csv-preview-result').innerHTML = '';
}

function csvLoadSample(){
  document.getElementById('csv-bld-name').value = 'アイディール';
  document.getElementById('csv-bld-addr').value = '広島県福山市今津町6丁目18-17';
  document.getElementById('csv-spots-input').value = 
    '1,3300,軽,,107,井村 百花,借,\n' +
    '2,2750,軽,,103,小坂 城司,借,\n' +
    '3,2750,軽,,202,日野 洵,借,\n' +
    '4,2750,軽,,106,戸高 珠樺,借,\n' +
    '5,3300,並,,201,本田 磨紀,借,\n' +
    '6,3300,並,,102,箱崎 千夏,解,\n' +
    '7,3300,並,,105,入川 あいら,借,\n' +
    '8,3300,並,,203,小川 知佳子,借,\n' +
    '9,3300,並,,101,保田 麻紀,借,\n' +
    '10,3300,並,,206,住田 千花,借,\n' +
    '11,3300,軽,,205,西田 空,借,\n' +
    '12,2750,軽,,207,株式会社日米クック,借,';
  csvPreview();
}

function csvParseSpots(text){
  const lines = text.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  const spots = [];
  const errors = [];
  lines.forEach((line, lineIdx) => {
    const cols = line.split(',').map(s => s.trim());
    const noStr = cols[0] || '';
    const priceStr = cols[1] || '';
    const typeStr = cols[2] || '';
    const tou = cols[3] || '';
    const room = cols[4] || '';
    const user = cols[5] || '';
    const statusStr = cols[6] || '';
    const note = cols[7] || '';

    const no = parseInt(noStr, 10);
    if(!no || no < 1){
      errors.push('行' + (lineIdx+1) + ': 区画番号が不正(' + noStr + ')');
      return;
    }
    const price = priceStr ? parseInt(priceStr.replace(/[^0-9]/g,''), 10) : 0;
    let type = typeStr || '並';
    if(!CSV_VALID_TYPES.includes(type)){
      errors.push('行' + (lineIdx+1) + ': 仕様「' + type + '」が不正 → 「並」にします');
      type = '並';
    }
    let status = statusStr || '空';
    if(!CSV_VALID_STATUS.includes(status)){
      errors.push('行' + (lineIdx+1) + ': 状況「' + status + '」が不正 → 「空」にします');
      status = '空';
    }
    spots.push({
      no: no,
      type: type,
      tou: tou,
      room: room,
      user: user,
      price: price,
      status: status,
      start_date: '',
      end_date: '',
      note: note,
      // マージ用: 元CSVでの空欄判定 (true=空欄/省略, false=明示指定)
      _raw: {
        price: priceStr === '',
        type: typeStr === '',
        tou: tou === '',
        room: room === '',
        user: user === '',
        status: statusStr === '',
        note: note === ''
      }
    });
  });
  return {spots, errors};
}

function csvPreview(){
  const name = document.getElementById('csv-bld-name').value.trim();
  const addr = document.getElementById('csv-bld-addr').value.trim();
  const text = document.getElementById('csv-spots-input').value;

  let html = '';
  if(!name){
    html += '<div style="background:#fee2e2;border:1px solid #dc2626;padding:8px 12px;border-radius:4px;font-size:12px;margin-bottom:10px;color:#991b1b;">⚠ 物件名を入力してください</div>';
  }
  const {spots, errors} = csvParseSpots(text);

  if(errors.length){
    html += '<div style="background:#fee2e2;border:1px solid #dc2626;padding:8px 12px;border-radius:4px;font-size:12px;margin-bottom:10px;color:#991b1b;line-height:1.6;"><strong>⚠ エラー / 警告</strong><br>' + errors.join('<br>') + '</div>';
  }

  if(spots.length === 0){
    html += '<div style="font-size:12px;color:#666;">区画を入力してください。</div>';
    document.getElementById('csv-preview-result').innerHTML = html;
    return;
  }

  // 集計
  const total = spots.reduce((sum, s) => sum + (Number(s.price)||0), 0);
  const occupied = spots.filter(s => s.status === '借').length;
  const vacant = spots.filter(s => s.status === '空').length;
  const cancelling = spots.filter(s => s.status === '解').length;
  const monthlyRevenue = spots.filter(s => s.status === '借').reduce((sum, s) => sum + (Number(s.price)||0), 0);

  html += '<div style="background:#f5f5f5;border:1px solid #ccc;padding:10px 14px;border-radius:4px;font-size:12px;margin-bottom:10px;line-height:1.8;">' +
    '<strong>集計</strong><br>' +
    '物件: <strong>' + escapeHtml(name||'(未入力)') + '</strong> ' + (addr ? '/ '+escapeHtml(addr) : '') + '<br>' +
    '区画総数: <strong>' + spots.length + '</strong>区画 (使用中:' + occupied + ' / 空き:' + vacant + ' / 解約中:' + cancelling + ')<br>' +
    '月額合計: <strong>¥' + total.toLocaleString() + '</strong> / 使用中分の月額: <strong>¥' + monthlyRevenue.toLocaleString() + '</strong>' +
    '</div>';

  html += '<table style="width:100%;border-collapse:collapse;font-size:11.5px;">' +
    '<thead><tr style="background:#000;color:#fff;">' +
      '<th style="padding:5px 6px;text-align:left;">区画</th>' +
      '<th style="padding:5px 6px;text-align:right;">金額</th>' +
      '<th style="padding:5px 6px;text-align:center;">仕様</th>' +
      '<th style="padding:5px 6px;text-align:left;">棟</th>' +
      '<th style="padding:5px 6px;text-align:left;">号数</th>' +
      '<th style="padding:5px 6px;text-align:left;">使用者</th>' +
      '<th style="padding:5px 6px;text-align:center;">状況</th>' +
      '<th style="padding:5px 6px;text-align:left;">備考</th>' +
    '</tr></thead><tbody>';
  spots.forEach(s => {
    const stClass = s.status === '解' ? 'background:#1f2937;color:#fff;' : (s.status === '借' ? 'background:#fef2f2;' : 'background:#fff;');
    html += '<tr style="border-bottom:1px solid #ddd;' + stClass + '">' +
      '<td style="padding:4px 6px;">P' + String(s.no).padStart(2,'0') + '</td>' +
      '<td style="padding:4px 6px;text-align:right;font-variant-numeric:tabular-nums;">' + (s.price ? s.price.toLocaleString() : '-') + '</td>' +
      '<td style="padding:4px 6px;text-align:center;">' + s.type + '</td>' +
      '<td style="padding:4px 6px;">' + escapeHtml(s.tou || '-') + '</td>' +
      '<td style="padding:4px 6px;">' + escapeHtml(s.room || '-') + '</td>' +
      '<td style="padding:4px 6px;">' + escapeHtml(s.user || '-') + '</td>' +
      '<td style="padding:4px 6px;text-align:center;font-weight:700;">' + s.status + '</td>' +
      '<td style="padding:4px 6px;">' + escapeHtml(s.note || '-') + '</td>' +
      '</tr>';
  });
  html += '</tbody></table>';

  document.getElementById('csv-preview-result').innerHTML = html;
}

function csvImport(){
  const name = document.getElementById('csv-bld-name').value.trim();
  const zip = document.getElementById('csv-bld-zip').value.trim();
  const addr = document.getElementById('csv-bld-addr').value.trim();
  const note = document.getElementById('csv-bld-note').value.trim();
  const text = document.getElementById('csv-spots-input').value;

  if(!name){ alert('物件名を入力してください'); return; }
  const {spots, errors} = csvParseSpots(text);
  if(spots.length === 0){ alert('区画を1件以上入力してください'); return; }

  // 既存物件名+住所チェック(住所も一致した場合のみ重複扱い)
  // 住所は表記揺れ防止のため正規化: 全半角空白除去、ハイフン統一、全角数字→半角
  const normalizeAddr = (s) => {
    if(!s) return '';
    return String(s)
      .replace(/[\s　]/g, '')           // 全半角スペース除去
      .replace(/[ー−―‐]/g, '-')          // ハイフン類を統一
      .replace(/[0-9]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))  // 全角数字→半角
      .replace(/[A-Za-z]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)) // 全角英→半角
      .toLowerCase();
  };
  const inputAddrN = normalizeAddr(addr);
  const all = loadAll();
  // 物件名一致するもの全部を取得
  const sameNameBlds = Object.values(all).filter(b => (b.name||'').trim() === name);
  // その中で「住所も一致する」もの = 真の重複
  let dupBld = sameNameBlds.find(b => normalizeAddr(b.addr||'') === inputAddrN);
  let dupSpots = dupBld ? (dupBld.spots||[]) : [];

  // CSVインポートは常に「完全置換(overwrite)」に統一する。
  //  ・同名+同住所が1件 → その物件を完全置換
  //  ・同名で複数(住所違い含む) → どの住所の物件に置換するか番号で選ぶ
  //  ・同名なし → 新規登録
  let mode = 'new'; // 'new' | 'overwrite'
  if(dupBld){
    mode = 'overwrite';
  } else if(sameNameBlds.length === 1){
    const b0 = sameNameBlds[0];
    if(confirm(
      '同じ物件名「' + name + '」が登録されています。\n\n' +
      '既存の住所: ' + (b0.addr || '(住所未入力)') + ' (区画 ' + ((b0.spots||[]).length) + '件)\n' +
      '今回の住所: ' + (addr || '(住所未入力)') + '\n\n' +
      'この既存物件を、今回のCSV内容で完全に置き換えますか?\n' +
      '【OK】既存物件に置換　【キャンセル】別物件として新規登録'
    )){
      dupBld = b0;
      dupSpots = dupBld.spots || [];
      mode = 'overwrite';
    } else {
      mode = 'new';
    }
  } else if(sameNameBlds.length > 1){
    const list = sameNameBlds.map((b, k) => '  ' + (k+1) + ' = ' + (b.addr || '(住所未入力)') + ' (区画 ' + ((b.spots||[]).length) + '件)').join('\n');
    const choice = prompt(
      '同じ物件名「' + name + '」が ' + sameNameBlds.length + ' 件あります。\n' +
      'どの住所の物件に置き換えますか? 番号を入力してください:\n\n' +
      list + '\n' +
      '  0 = 別物件として新規登録\n' +
      '  c = 中止',
      '0'
    );
    if(choice === null) return;
    const c = choice.trim().toLowerCase();
    if(c === 'c' || c === '') return;
    if(c === '0'){ mode = 'new'; }
    else if(/^[0-9]+$/.test(c)){
      const idx = parseInt(c, 10) - 1;
      if(idx < 0 || idx >= sameNameBlds.length){ alert('無効な番号です。中止しました。'); return; }
      dupBld = sameNameBlds[idx];
      dupSpots = dupBld.spots || [];
      mode = 'overwrite';
    } else {
      alert('無効な入力です。中止しました。'); return;
    }
  }

  if(errors.length > 0){
    if(!confirm('以下のエラーがあります:\n\n' + errors.join('\n') + '\n\nそれでも登録を続行しますか？')){
      return;
    }
  }

  // _raw は内部用フィールドなので保存前に除去するヘルパー(使用前に定義)
  const stripRaw = (s) => {
    const copy = Object.assign({}, s);
    delete copy._raw;
    return copy;
  };
  // 最終確認メッセージをモードに合わせて変える
  let finalMsg = '';
  if(mode === 'overwrite'){
    finalMsg = '⚠ 物件「' + name + '」を上書き登録します。\n既存の ' + ((dupBld.spots||[]).length) + ' 区画は削除され、新しい ' + spots.length + ' 区画で置き換わります。\nこの操作は取り消せません。よろしいですか？';
  } else if(mode === 'append'){
    finalMsg = '物件「' + name + '」に区画を追加します。\n既存: ' + ((dupBld.spots||[]).length) + ' 区画 + 新規: ' + spots.length + ' 区画\n区画番号が衝突する場合、新しいデータで上書きされます。\nよろしいですか？';
  } else if(mode === 'merge'){
    finalMsg = '物件「' + name + '」にマージ登録します。\n既存: ' + ((dupBld.spots||[]).length) + ' 区画\nCSV: ' + spots.length + ' 区画\n\nCSVに書いた項目だけ既存データに反映します。\n空欄の項目は既存値を維持します。\nCSVに書いていない区画はそのまま残ります。\n\nよろしいですか？';
  } else {
    finalMsg = '物件「' + name + '」を登録します。\n区画数: ' + spots.length + '\nよろしいですか？';
  }
  if(!confirm(finalMsg)) return;

  if(mode === 'overwrite'){
    // 既存物件のIDを保持しつつ、内容を全て置き換える(同じIDのまま上書き)
    dupBld.name = name;
    dupBld.zip = zip;
    dupBld.addr = addr;
    dupBld.note = note;
    dupBld.spots = spots.map(stripRaw);
    // layout_id, photo_ids は既存のままにする(画像は残す)
    const ok = saveAll(all);
    if(ok){
      alert('✅ 上書き登録完了: ' + name + ' (' + spots.length + '区画)');
      closeCsvImportModal();
      renderAll();
    }
    return;
  }


  if(mode === 'merge'){
    // 既存物件に区画を「項目単位で」マージ
    // - CSVに書いた区画のみ対象。書かれていない区画はそのまま残す
    // - 各項目について、CSVが空欄なら既存値を維持、明示指定なら更新
    const existingSpots = dupBld.spots || [];
    const spotMap = {};
    existingSpots.forEach(s => { spotMap[Number(s.no)] = s; });
    spots.forEach(ns => {
      const raw = ns._raw || {};
      const existing = spotMap[Number(ns.no)];
      if(existing){
        // 既存区画とマージ: 空欄項目は既存値を維持
        const merged = Object.assign({}, existing);
        if(!raw.type) merged.type = ns.type;
        if(!raw.tou) merged.tou = ns.tou;
        if(!raw.room) merged.room = ns.room;
        if(!raw.user) merged.user = ns.user;
        if(!raw.price) merged.price = ns.price;
        if(!raw.status) merged.status = ns.status;
        if(!raw.note) merged.note = ns.note;
        spotMap[Number(ns.no)] = merged;
      } else {
        // 既存に無い区画番号は新規追加(空欄は既定値のまま)
        spotMap[Number(ns.no)] = stripRaw(ns);
      }
    });
    const merged = Object.values(spotMap).map(stripRaw).sort((a,b) => Number(a.no) - Number(b.no));
    dupBld.spots = merged;
    // 物件レベルの項目はマージ動作では基本的に既存維持。住所が空の場合のみ補完
    if(!dupBld.addr && addr) dupBld.addr = addr;
    if(!dupBld.zip && zip) dupBld.zip = zip;
    if(!dupBld.note && note) dupBld.note = note;
    const ok = saveAll(all);
    if(ok){
      alert('✅ マージ完了: ' + name + ' (既存に ' + spots.length + ' 区画分の更新を反映)');
      closeCsvImportModal();
      renderAll();
    }
    return;
  }

  if(mode === 'append'){
    // 既存物件に区画を追加(同じ区画番号は新しいデータで上書き)
    const existingSpots = dupBld.spots || [];
    // 既存をmapに変換(noキー)
    const spotMap = {};
    existingSpots.forEach(s => { spotMap[Number(s.no)] = s; });
    // 新規区画を上書き or 追加
    spots.forEach(ns => {
      spotMap[Number(ns.no)] = stripRaw(ns);
    });
    // 配列に戻して番号順ソート
    const merged = Object.values(spotMap).sort((a,b) => Number(a.no) - Number(b.no));
    dupBld.spots = merged;
    // 物件情報のzip/addrは既存優先(空ならインポート値で上書き)
    if(!dupBld.zip && zip) dupBld.zip = zip;
    if(!dupBld.addr && addr) dupBld.addr = addr;
    if(!dupBld.note && note) dupBld.note = note;
    const ok = saveAll(all);
    if(ok){
      alert('✅ 追加登録完了: ' + name + ' (合計 ' + merged.length + '区画)');
      closeCsvImportModal();
      renderAll();
    }
    return;
  }

  // 物件オブジェクト作成(新規)
  const newBld = {
    id: genId(),
    name: name,
    zip: zip,
    addr: addr,
    note: note,
    spots: spots.map(stripRaw),
    layout_id: '',
    photo_ids: []
  };

  all[newBld.id] = newBld;
  const ok = saveAll(all);
  if(ok){
    closeCsvImportModal();
    renderAll();
    // 登録した物件の編集ページに遷移
    openModal(newBld.id);
    showToast('✅ 登録完了: ' + name + ' (' + spots.length + '区画)');
  }
}
document.addEventListener('pivot:toast', e => showToast(e.detail));
document.addEventListener('pivot:save-buildings', e => saveAll(e.detail));
