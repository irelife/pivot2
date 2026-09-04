/* ============================================================
 *  store.js  ―  Firestore への控え（第1段-B）
 *
 *  いまの役割は「控えを取るだけ」です。
 *    ・画面が表示する内容は、これまでどおりスプレッドシート由来です
 *    ・保存の動きも、これまでどおりです
 *    ・そのうえで、変わった物件だけを Firestore にも書き写します
 *
 *  つまり、このファイルに不具合があっても
 *  「Firestore 側の控えがずれる」だけで、実データは無傷です。
 *
 *  1〜2週間、毎朝の点検でスプレッドシートと Firestore を突き合わせ、
 *  差が出ないことを確認してから、第1段-D で読み書きを切り替えます。
 * ============================================================ */
(function(){
  'use strict';

  /* Firestore が読み込めていなければ、何もしません */
  var ok = false;
  try{ ok = !!(window.firebase && firebase.firestore && firebase.auth); }catch(e){ ok = false; }
  if(!ok){ return; }

  function pfx(){ return (typeof insPrefix === 'function') ? insPrefix() : 'pivot_'; }
  function bKey(){ return (typeof pbKey === 'function') ? pbKey() : pfx() + 'blds'; }
  var INS = pfx().replace(/_+$/, '') || 'pivot';
  function mirrorKey(){ return pfx() + 'fs_mirror'; }

  function col(){
    return firebase.firestore().collection(INS).doc('data').collection('buildings');
  }
  function me(){
    try{ return (firebase.auth().currentUser || {}).email || ''; }catch(e){ return ''; }
  }
  function signedIn(){
    try{ return !!firebase.auth().currentUser; }catch(e){ return false; }
  }

  function readLocal(){
    try{ return JSON.parse(localStorage.getItem(bKey()) || '{}') || {}; }catch(e){ return {}; }
  }
  function readMirror(){
    try{ return JSON.parse(localStorage.getItem(mirrorKey()) || '{}') || {}; }catch(e){ return {}; }
  }
  function writeMirror(m){
    try{ localStorage.setItem(mirrorKey(), JSON.stringify(m)); }catch(e){}
  }

  /* 区画の配列 → 番号をキーにした入れ物 */
  function spotsToMap(spots){
    var m = {};
    (spots || []).forEach(function(s){
      var k = String(s && s.no != null ? s.no : '');
      if(!k || m[k]) return;                       /* 同じ番号は最初の1件だけ */
      var o = {
        no: s.no, type: s.type || '並', tou: s.tou || '',
        room: s.room == null ? '' : s.room, user: s.user || '',
        price: s.price || 0, status: s.status || '空', note: s.note || ''
      };
      ['end_date','res_date','res_tou','res_room','res_user','res_price','res_note'].forEach(function(f){
        if(s[f] != null && s[f] !== '') o[f] = s[f];
      });
      m[k] = o;
    });
    return m;
  }

  function docOf(b){
    var d = {
      id:    b.id || '',
      name:  b.name || '',
      addr:  b.addr || '',
      spots: spotsToMap(b.spots)
    };
    if(b.layout_id)  d.layout_id  = b.layout_id;
    if(b.layout2_id) d.layout2_id = b.layout2_id;
    if(b.photo_ids)  d.photo_ids  = b.photo_ids;
    if(b.mime)       d.mime       = b.mime;
    return d;
  }

  function sig(o){ try{ return JSON.stringify(o); }catch(e){ return ''; } }

  /* ---- 書き写し（変わった物件だけ） ---- */
  var _timer = null, _busy = false;

  function schedule(ms){
    if(_timer) clearTimeout(_timer);
    _timer = setTimeout(run, typeof ms === 'number' ? ms : 2500);
  }

  function run(){
    if(_busy){ schedule(4000); return; }
    if(!signedIn()){ return; }                     /* 未ログインなら何もしません */

    var local, mirror;
    try{ local = readLocal(); mirror = readMirror(); }catch(e){ return; }

    var changed = [], removed = [];
    Object.keys(local).forEach(function(id){
      var b = local[id]; if(!b) return;
      var d = docOf(b), s = sig(d);
      if(mirror[id] !== s) changed.push({ id: id, doc: d, sig: s });
    });
    Object.keys(mirror).forEach(function(id){
      if(!Object.prototype.hasOwnProperty.call(local, id)) removed.push(id);
    });
    if(!changed.length && !removed.length) return;

    _busy = true;
    var now = new Date().toISOString(), who = me();
    var db = firebase.firestore();
    var jobs = [], i, batch = db.batch(), n = 0;

    function flush(){
      if(n){ jobs.push(batch.commit()); batch = db.batch(); n = 0; }
    }
    for(i = 0; i < changed.length; i++){
      var c = changed[i], d2 = {};
      Object.keys(c.doc).forEach(function(k){ d2[k] = c.doc[k]; });
      d2.updatedAt = now; d2.updatedBy = who; d2.shadow = true;
      batch.set(col().doc(c.id), d2);
      if(++n >= 400) flush();
    }
    for(i = 0; i < removed.length; i++){
      batch.delete(col().doc(removed[i]));
      if(++n >= 400) flush();
    }
    flush();

    Promise.all(jobs).then(function(){
      changed.forEach(function(c){ mirror[c.id] = c.sig; });
      removed.forEach(function(id){ delete mirror[id]; });
      writeMirror(mirror);
      _busy = false;
      try{
        console.log('[store] Firestore に控えました　更新 ' + changed.length +
                    '件 / 削除 ' + removed.length + '件');
      }catch(e){}
    }).catch(function(e){
      _busy = false;
      try{ console.warn('[store] 控えに失敗しました（実データには影響しません）:', e); }catch(e2){}
      schedule(60000);                              /* 1分後にもう一度 */
    });
  }

  /* ---- 保存のたびに控えます（元の動きはそのまま） ---- */
  try{
    var S = window.saveAll;
    if(typeof S === 'function'){
      window.saveAll = function(){
        var r = S.apply(this, arguments);
        try{ schedule(); }catch(e){}
        return r;
      };
    }
  }catch(e){}

  try{
    var P = window.pbSaveRaw;
    if(typeof P === 'function'){
      window.pbSaveRaw = function(){
        var r = P.apply(this, arguments);
        try{ schedule(); }catch(e){}
        return r;
      };
    }
  }catch(e){}

  /* ---- ログインしたとき／起動したときにも1回 ---- */
  try{
    firebase.auth().onAuthStateChanged(function(u){ if(u) schedule(6000); });
  }catch(e){}

  /* 手で確かめたいとき用（開発者ツールから __fsMirrorNow() ） */
  try{ window.__fsMirrorNow = function(){ _busy = false; run(); return '控えを試みました'; }; }catch(e){}
})();
