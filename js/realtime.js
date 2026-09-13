/* PIVOT2 realtime bell v29
 * 目的:
 *  - データ本体は監視しない
 *  - sync_bell という1ドキュメントだけを監視
 *  - 呼び鈴が鳴ったら、既存の forcePullLatest() を呼ぶ
 *  - 新しい取り込みロジックは作らない
 *  - 呼び鈴が届かなかった場合は、3分ごとに呼び鈴1枚だけを確認
 */
(function(){
  'use strict';

  var PFX = (typeof insPrefix === 'function') ? insPrefix() : 'pivot2_';
  var INS = PFX.replace(/_+$/, '') || 'pivot2';

  var RTK = PFX + 'rt_client_id';
  var RTUSE = PFX + 'rt_use';

  function randId(){
    return 'rt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,10);
  }

  var clientId = '';
  try{
    clientId = sessionStorage.getItem(RTK) || '';
    if(!clientId){
      clientId = randId();
      sessionStorage.setItem(RTK, clientId);
    }
  }catch(e){
    clientId = randId();
  }

  function readUse(){
    try{
      return JSON.parse(localStorage.getItem(RTUSE) || '{}') || {};
    }catch(e){ return {}; }
  }

  function hit(k){
    try{
      var u = readUse();
      var d = new Date().toISOString().slice(0,10);
      if(u.day !== d) u = {day:d, bellEvents:0, bellWrites:0, fallbackReads:0, pulls:0, errors:0};
      u[k] = Number(u[k] || 0) + 1;
      localStorage.setItem(RTUSE, JSON.stringify(u));
    }catch(e){}
  }

  try{
    window.pvRealtimeUsage = function(){
      var u = readUse();
      console.log('── PIVOT2 高速同期（呼び鈴）──');
      console.log('呼び鈴イベント:', u.bellEvents || 0);
      console.log('呼び鈴書込み:', u.bellWrites || 0);
      console.log('3分保険の確認:', u.fallbackReads || 0);
      console.log('実際の再読込:', u.pulls || 0);
      console.log('エラー:', u.errors || 0);
      return u;
    };
  }catch(e){}

  var firebaseOK = false;
  try{
    firebaseOK = !!(window.firebase && firebase.firestore && firebase.auth);
  }catch(e){ firebaseOK = false; }

  if(!firebaseOK){
    try{ console.warn('[RT] Firebase未読込のため高速同期は無効です'); }catch(e){}
    return;
  }

  var db = firebase.firestore();
  var bell = db.collection(INS).doc('data').collection('misc').doc('sync_bell');

  var lastToken = '';
  var started = false;
  var pullTimer = null;
  var ringTimer = null;
  var ringAction = '';
  var stopped = false;

  function schedulePull(reason){
    if(stopped) return;
    if(pullTimer) clearTimeout(pullTimer);
    pullTimer = setTimeout(function(){
      pullTimer = null;
      try{
        if(typeof window.__pvFsDrop === 'function') window.__pvFsDrop();
      }catch(e){}
      try{
        if(typeof window.forcePullLatest === 'function'){
          hit('pulls');
          console.log('[RT] 呼び鈴を受けたので既存の読込処理を実行:', reason || '');
          window.forcePullLatest();
        }
      }catch(e){
        hit('errors');
        try{ console.warn('[RT] 再読込に失敗', e); }catch(x){}
      }
    }, 350);
  }

  function ringNow(action){
    var token = clientId + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7);
    lastToken = token;

    return bell.set({
      token: token,
      sender: clientId,
      action: action || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true}).then(function(){
      hit('bellWrites');
      console.log('[RT] 呼び鈴を鳴らしました:', action || '');
      return true;
    }).catch(function(e){
      hit('errors');
      console.warn('[RT] 呼び鈴の書込みに失敗。通常保存は完了しています。', e);
      return false;
    });
  }

  function ring(action){
    ringAction = action || ringAction || '';
    if(ringTimer) clearTimeout(ringTimer);
    ringTimer = setTimeout(function(){
      ringTimer = null;
      var a = ringAction;
      ringAction = '';
      ringNow(a);
    }, 700);
  }

  function startListener(){
    if(started || stopped) return;
    started = true;

    bell.onSnapshot(function(snap){
      hit('bellEvents');

      var d = snap.exists ? (snap.data() || {}) : {};
      var token = String(d.token || '');
      var sender = String(d.sender || '');

      if(!lastToken){
        lastToken = token;
        console.log('[RT] 呼び鈴監視を開始しました');
        return;
      }

      if(!token || token === lastToken) return;
      lastToken = token;

      if(sender === clientId) return;
      schedulePull('realtime');
    }, function(err){
      hit('errors');
      console.warn('[RT] 呼び鈴監視エラー。3分保険で継続します。', err);
    });
  }

  function fallbackCheck(){
    if(stopped) return;
    bell.get({source:'server'}).then(function(snap){
      hit('fallbackReads');

      var d = snap.exists ? (snap.data() || {}) : {};
      var token = String(d.token || '');
      var sender = String(d.sender || '');

      if(!lastToken){
        lastToken = token;
        return;
      }
      if(!token || token === lastToken) return;

      lastToken = token;
      if(sender === clientId) return;
      schedulePull('3min-fallback');
    }).catch(function(e){
      hit('errors');
      console.warn('[RT] 3分保険の呼び鈴確認に失敗', e);
    });
  }

  try{
    var prev = window.postToGas;
    if(typeof prev === 'function'){
      window.postToGas = function(url, body, timeoutMs){
        var act = body && body.action;
        var writeAct = {
          save:1,
          saveBuildings:1,
          saveContractsOnly:1,
          saveOwnersOnly:1,
          deleteContract:1
        };

        return Promise.resolve(prev(url, body, timeoutMs)).then(function(r){
          if(writeAct[act] && r && r.ok){
            ring(act);
          }
          return r;
        });
      };
    }
  }catch(e){
    hit('errors');
    console.warn('[RT] postToGas連携に失敗', e);
  }

  startListener();

  setInterval(fallbackCheck, 180000);

  try{
    window.__pvRealtime = {
      stop:function(){ stopped = true; },
      ring:function(){ return ringNow('manual-test'); },
      pull:function(){ schedulePull('manual-test'); },
      fallback:fallbackCheck,
      clientId:function(){ return clientId; }
    };
  }catch(e){}

})();
