/* ★ PIVOT v21）クラウドを読む回数が減っているか／中身が壊れないか */
/* どこでも動くように：playwright があればそれを、無ければ playwright-core を使います */
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));   /* 相対パスで渡されても file:// が壊れないよう、必ず絶対パスに直します */
let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };

/* にせの Firestore。読んだ件数を数えます */
const FAKE = `
(function(){
  var DB = { docs:{} };          /* "path/id" -> data */
  window.__fs = { reads:0, writes:0, calls:[] };
  function cnt(kind, n, path){ window.__fs[kind] += n; window.__fs.calls.push(kind+':'+n+' '+path); }
  function snapOf(path, id, d){ return { id:id, exists:!!d, data:function(){ return d; } }; }
  function colRef(path){
    return {
      __path: path,
      doc: function(id){ return docRef(path + '/' + (id || ('auto'+Math.random()))); },
      where: function(f, op, v){
        return { get: function(){
          var out = [], k;
          for(k in DB.docs){
            if(k.indexOf(path + '/') !== 0) continue;
            if(k.slice(path.length + 1).indexOf('/') >= 0) continue;
            var d = DB.docs[k];
            if(op === '>' && !(String(d[f] || '') > String(v))) continue;
            out.push(snapOf(k, k.split('/').pop(), d));
          }
          cnt('reads', Math.max(out.length, 1), path + ' where');
          return Promise.resolve(qs(out));
        } };
      },
      get: function(){
        var out = [], k;
        for(k in DB.docs){
          if(k.indexOf(path + '/') !== 0) continue;
          if(k.slice(path.length + 1).indexOf('/') >= 0) continue;
          out.push(snapOf(k, k.split('/').pop(), DB.docs[k]));
        }
        cnt('reads', Math.max(out.length, 1), path + ' get');
        return Promise.resolve(qs(out));
      },
      onSnapshot: function(cb, eb){ try{ cb(qs([])); }catch(e){} return function(){}; }
    };
  }
  function qs(arr){
    return { size:arr.length, empty:arr.length===0,
             forEach:function(f){ for(var i=0;i<arr.length;i++) f(arr[i]); } };
  }
  /* 本物の Firestore と同じように、「spots.3」のような指定で
     その欄だけを書き替えられるようにします。 */
  var DELMARK = '__pv_delete__';
  function applyPatch(path, patch){
    var cur = DB.docs[path] ? JSON.parse(JSON.stringify(DB.docs[path])) : {};
    for(var k in patch){
      if(!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      var parts = String(k).split('.'), o = cur, i;
      for(i = 0; i < parts.length - 1; i++){
        if(!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
        o = o[parts[i]];
      }
      var last = parts[parts.length - 1];
      if(patch[k] === DELMARK) delete o[last];
      else o[last] = JSON.parse(JSON.stringify(patch[k]));
    }
    DB.docs[path] = cur;
  }
  /* ★ 呼び鈴（realtime.js）のために、書類ごとの見張りを持てるようにします。
     本物の Firestore は、書類が書き替わると見張りに知らせます。
     にせクラウドも、同じようにします。 */
  var watchers = {};                 /* "path/id" -> [ {cb, eb} ] */
  function notify(path){
    var ws = watchers[path];
    if(!ws || !ws.length) return;
    var list = ws.slice();
    setTimeout(function(){
      for(var i = 0; i < list.length; i++){
        try{ list[i].cb(snapOf(path, path.split('/').pop(), DB.docs[path])); }catch(e){}
      }
    }, 0);
  }
  function docRef(path){
    return {
      __path: path,
      collection: function(n){ return colRef(path + '/' + n); },
      get: function(){ cnt('reads',1,path); return Promise.resolve(snapOf(path, path.split('/').pop(), DB.docs[path])); },
      set: function(d){ cnt('writes',1,path); DB.docs[path] = JSON.parse(JSON.stringify(d)); notify(path); return Promise.resolve(); },
      update: function(d){ cnt('writes',1,path);
        if(!DB.docs[path]) return Promise.reject(new Error('not-found'));
        applyPatch(path, d); notify(path); return Promise.resolve(); },
      delete: function(){ cnt('writes',1,path); delete DB.docs[path]; notify(path); return Promise.resolve(); },
      onSnapshot: function(cb, eb){
        if(typeof cb !== 'function') return function(){};
        if(!watchers[path]) watchers[path] = [];
        var w = { cb: cb, eb: (typeof eb === 'function' ? eb : null) };
        watchers[path].push(w);
        cnt('reads', 1, path + ' onSnapshot');
        setTimeout(function(){
          try{ cb(snapOf(path, path.split('/').pop(), DB.docs[path])); }catch(e){}
        }, 0);
        return function(){
          var a = watchers[path] || [], i = a.indexOf(w);
          if(i >= 0) a.splice(i, 1);
        };
      }
    };
  }
  var db = {
    collection: function(n){ return colRef(n); },
    runTransaction: function(fn){
      var tx = {
        get: function(ref){ cnt('reads',1,ref.__path); return Promise.resolve(snapOf(ref.__path, ref.__path.split('/').pop(), DB.docs[ref.__path])); },
        set: function(ref, d){ cnt('writes',1,ref.__path); DB.docs[ref.__path] = JSON.parse(JSON.stringify(d)); notify(ref.__path); },
        update: function(ref, d){ cnt('writes',1,ref.__path);
          if(!DB.docs[ref.__path]) throw new Error('not-found');
          applyPatch(ref.__path, d); notify(ref.__path); },
        delete: function(ref){ cnt('writes',1,ref.__path); delete DB.docs[ref.__path]; notify(ref.__path); }
      };
      return Promise.resolve(fn(tx));
    }
  };
  var authCbs = [];
  var FS = function(){ return db; };
  FS.FieldValue = { delete: function(){ return DELMARK; },
                    serverTimestamp: function(){ return new Date().toISOString(); } };
  window.firebase = {
    firestore: FS,
    auth: function(){ return { currentUser:{uid:'u1'},
      onAuthStateChanged: function(cb){ authCbs.push(cb); setTimeout(function(){ cb({uid:'u1'}); }, 50); } }; }
  };
  window.__seed = function(path, id, d){ DB.docs[path + '/' + id] = d; };
  window.__set  = function(path, id, d){ DB.docs[path + '/' + id] = d; notify(path + '/' + id); };
  window.__del  = function(path, id){ delete DB.docs[path + '/' + id]; notify(path + '/' + id); };
  window.__all  = function(){ return JSON.parse(JSON.stringify(DB.docs)); };
  window.__zero = function(){ window.__fs.reads=0; window.__fs.writes=0; window.__fs.calls=[]; };
})();
`;

(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,200)));
 pg.on('dialog',d=>d.accept());
 const GAS='https://example.invalid/gas';
 await pg.route('**://**', r=>{ const u=r.request().url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid') >= 0){
     return r.fulfill({status:200, contentType:'application/json',
       body: JSON.stringify({ ok:true, version:'test',
         payload:{ buildings:{}, contracts:{}, owners:[] } })});
   }
   return r.fulfill({status:200, contentType:'application/javascript', body:'/* stub */'}); });
 await pg.addInitScript(FAKE);
 await pg.addInitScript((g)=>{ try{
   var k = (localStorage.getItem('__pfx') || 'pivot_') + 'cloud_url';
   /* insPrefix() はまだ無いので、あとで入れ直します */
   window.__gas = g;
 }catch(e){} }, GAS);
 await pg.goto('file://'+DIR+'/index.html');
 await pg.waitForTimeout(1200);
 /* GAS のあて先を入れて、開き直します */
 await pg.evaluate((g)=>{ try{
   localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_') + 'cloud_url', g);
 }catch(e){} }, GAS);
 await pg.reload();
 await pg.waitForTimeout(2500);

 const pre = await pg.evaluate(()=>(typeof insPrefix==='function'?insPrefix():'pivot_'));
 const BP = pre.replace(/_+$/,'') + '/data/buildings';

 /* 物件を70件、クラウドに置きます */
 await pg.evaluate((p)=>{
   for(var i=1;i<=70;i++){
     window.__seed(p, 'b'+i, { id:'b'+i, name:'物件'+i, addr:'住所'+i, spots:{},
       rev:1, updatedAt:'2026-09-01T00:00:00.000Z', updatedBy:'誰か' });
   }
 }, BP);

 /* 画面を開いたときの読み込みを、ひととおり通します */
 await pg.evaluate(()=>window.postToGas('x', { action:'load' }, 5000));
 await pg.waitForTimeout(1200);
 const loadedN = await pg.evaluate(()=>{
   try{ return Object.keys((typeof pbLoadAll==='function') ? (pbLoadAll()||{}) : {}).length; }catch(e){ return -1; } });
 ok('（下ごしらえ）画面を開く流れが最後まで通った',
    (await pg.evaluate(()=>typeof window.__pvSyncNow))==='function');
 ok('（下ごしらえ）じゃまするものが出ていない',
    await pg.evaluate(()=>{ var m=document.querySelectorAll('.modal,.overlay,.sheet,[id*="modal"],[class*="modal"]');
      for(var i=0;i<m.length;i++){ if(m[i].offsetParent!==null && m[i].getBoundingClientRect().height>40) return false; }
      return true; }));

 /* 開いた直後は、まだ内部でいろいろ動いています。落ち着くまで待ちます */
 await pg.waitForTimeout(3500);

 console.log('\n❶ はじめの1回は、全部を読む');
 /* 開いた直後は、内部の片づけが動いていて読みを見送ることがあります。
    目印が入るまで、何度か声をかけます（検査を安定させるためです）。 */
 let r1 = 0;
 for(let i = 0; i < 6; i++){
   /* 「画面を開いたとき」の流れが終わっていないと、様子見は動きません。
      終わっていなければ、もう一度そこから通します。 */
   await pg.evaluate(()=>window.postToGas('https://example.invalid/gas', { action:'load' }, 5000));
   await pg.waitForTimeout(1200);
   await pg.evaluate(()=>{ window.__zero(); });
   await pg.evaluate(()=>window.__pvSyncNow && window.__pvSyncNow());
   await pg.waitForTimeout(1200);
   r1 = await pg.evaluate(()=>window.__fs.reads);
   const done = await pg.evaluate(()=>{ try{
     return !!localStorage.getItem((typeof insPrefix==='function'?insPrefix():'pivot_') + 'fs_seen'); }catch(e){ return false; } });
   if(done && r1 >= 60) break;
 }
 ok('★ 70件ぶん読む（土台づくり）', r1>=70, r1);

 const seenAfter = await pg.evaluate(()=>{ try{
   return localStorage.getItem((typeof insPrefix==='function'?insPrefix():'pivot_') + 'fs_seen'); }catch(e){ return 'x'; } });
 console.log('   （目印：fs_seen = ' + seenAfter + '）');

 console.log('\n❷ 2回目からは、直されたものだけ');
 await pg.evaluate(()=>{ window.__zero(); });
 await pg.evaluate(()=>window.__pvSyncNow && window.__pvSyncNow());
 await pg.waitForTimeout(900);
 let r2 = await pg.evaluate(()=>window.__fs.reads);
 /* ★ オーナーと契約の読み直しを足したぶん、2回ふえて4回になりました。
      内わけは「消した目印」「直された物件」「オーナー一覧」「直された契約」です。
      オーナーは1件の書類なので、何人いても1回。
      契約も「直されたものだけ」を読むので、何件あってもふだんは1回です。
      どちらもこれまで、ページを開いたときしか読んでいませんでした。 */
 ok('★ 何も直っていなければ、読むのは4回だけ（目印＋物件＋オーナー＋契約）', r2<=4, r2);
 ok('★ 70回が1回になっている（70分の1）', r2 < r1/10, [r1, r2]);

 console.log('\n❸ ほかの端末が直したら、ちゃんと気づく');
 await pg.evaluate((p)=>{ window.__zero();
   window.__set(p, 'b7', { id:'b7', name:'★直されました', addr:'新しい住所', spots:{},
     rev:2, updatedAt:'2026-09-20T00:00:00.000Z', updatedBy:'ほかの端末' }); }, BP);
 await pg.evaluate(()=>window.__pvSyncNow && window.__pvSyncNow());
 await pg.waitForTimeout(1200);
 let r3 = await pg.evaluate(()=>window.__fs.reads);
 ok('★ 読むのは、目印1回＋直された1件＋オーナー1回＋契約1回', r3<=4, r3);
 const got = await pg.evaluate(()=>{
   try{ var all = (typeof pbLoadAll==='function') ? pbLoadAll() : {}; return (all['b7']||{}).name || ''; }catch(e){ return 'よめない'; } });
 ok('★ 手元にも取り込まれている', got==='★直されました', got);

 console.log('\n❹ 読まなかった物件の控えが、消えていないか');
 const sigN = await pg.evaluate((p)=>{
   var k = (typeof insPrefix==='function'?insPrefix():'pivot_') + 'fs_sig';
   try{ var m = JSON.parse(localStorage.getItem(k)||'{}'); return Object.keys(m).length; }catch(e){ return -1; } }, BP);
 ok('★ 70件ぶんの控えが、そのまま残っている（消えると全部が衝突になります）',
    sigN===70, sigN);
 const revN = await pg.evaluate(()=>{
   var k = (typeof insPrefix==='function'?insPrefix():'pivot_') + 'fs_rev';
   try{ var m = JSON.parse(localStorage.getItem(k)||'{}'); return Object.keys(m).length; }catch(e){ return -1; } });
 ok('★ 版番号の控えも、そのまま', revN===70, revN);
 const rev7 = await pg.evaluate(()=>{
   var k = (typeof insPrefix==='function'?insPrefix():'pivot_') + 'fs_rev';
   try{ return (JSON.parse(localStorage.getItem(k)||'{}'))['b7']; }catch(e){ return -1; } });
 ok('★ 直された1件の版番号だけ、新しくなっている', rev7===2, rev7);

 console.log('\n❺ 直されたぶんだけ読んだときに、物件を消してしまわないか');
 const n = await pg.evaluate(()=>{
   try{ return Object.keys((typeof pbLoadAll==='function') ? (pbLoadAll()||{}) : {}).length; }catch(e){ return -1; } });
 ok('★ 70件そのまま（1件も消えていない）', n===70, n);

 console.log('\n❻ 続けて何度も呼んでも、読みにいかない');
 await pg.evaluate(()=>{ window.__zero(); });
 for(let i=0;i<8;i++){ await pg.evaluate(()=>{
   document.dispatchEvent(new Event('visibilitychange')); }); await pg.waitForTimeout(120); }
 await pg.waitForTimeout(2200);
 const r4 = await pg.evaluate(()=>window.__fs.reads);
 /* オーナーは1分に1回まで、契約は5分に1回までにしているので、
      短いあいだに何度行き来しても、読む回数はほとんど増えません。 */
 ok('★ タブを8回行き来しても、読むのは多くて4回', r4<=4, r4);

 console.log('\n❼ 直されたぶんだけ読んだあとでも、ふつうに保存できる');
 /* いちばん怖いのは「控えが食い違って、全部が衝突になる」ことです。
    直されたぶんだけ読んだあとに保存して、通ることを確かめます。 */
 await pg.evaluate(()=>{ window.__zero(); });
 const sv = await pg.evaluate(async ()=>{
   var all = (typeof pbLoadAll === 'function') ? (pbLoadAll() || {}) : {};
   var one = all['b12'];
   if(!one) return { err:'b12 がありません' };
   one.name = '★ここで直しました';
   all['b12'] = one;
   try{
     var r = await window.postToGas('https://example.invalid/gas',
       { action:'save', payload:{ buildings: all, contracts:{}, owners:[] } }, 8000);
     return { ok:!!(r && r.ok !== false), r:(r && r.error) || '' };
   }catch(e){ return { err:String(e && e.message || e) }; }
 });
 ok('★ 保存が通る（衝突にならない）', sv && sv.ok === true, sv);
 const saved = await pg.evaluate((p)=>{
   var d = window.__all()[p + '/b12'] || {};
   return { name:d.name, rev:d.rev }; }, BP);
 ok('★ クラウドにも、直した内容が入る', saved.name === '★ここで直しました', saved);
 ok('★ 版番号が1つ上がる', saved.rev === 2, saved);
 const other = await pg.evaluate((p)=>{
   var d = window.__all()[p + '/b30'] || {}; return { name:d.name, rev:d.rev }; }, BP);
 ok('★ 直していない物件は、そのまま', other.name === '物件30' && other.rev === 1, other);

 console.log('\n❽ ほかの端末が物件を消したら、すぐ気づく');
 /* 消した端末は目印を書きます。こちらはそれを見て、全部を読み直します */
 await pg.evaluate((p)=>{
   window.__zero();
   window.__del(p, 'b60');
   window.__set(p.replace('/data/buildings','/data/misc'), 'meta',
     { delAt:'2026-09-20T10:00:00.000Z', delBy:'ほかの端末' });
 }, BP);
 await pg.evaluate(()=>window.__pvSyncNow && window.__pvSyncNow());
 await pg.waitForTimeout(1500);
 const rd = await pg.evaluate(()=>window.__fs.reads);
 ok('★ 目印が変わったので、全部を読み直す', rd >= 60, rd);
 const g0 = await pg.evaluate(()=>{
   try{ var all = (typeof pbLoadAll==='function') ? (pbLoadAll()||{}) : {};
     return { has60: !!all['b60'], n: Object.keys(all).length }; }catch(e){ return {}; } });
 ok('★ 消された物件が、手元からも消える', g0.has60 === false, g0);
 ok('★ ほかの物件は残る', g0.n === 69, g0);

 await pg.evaluate(()=>{ window.__zero(); });
 await pg.evaluate(()=>window.__pvSyncNow && window.__pvSyncNow());
 await pg.waitForTimeout(1200);
 const rd2 = await pg.evaluate(()=>window.__fs.reads);
 ok('★ 次からは、また軽い読みに戻る（目印＋差分＋オーナー＋契約の4回）', rd2 <= 4, rd2);

 console.log('\n❽-2 念のため、1時間に1回も全部を読む');
 /* 目印を消すと、次は全部読みになります（1時間たったのと同じです） */
 await pg.evaluate((p)=>{
   window.__zero();
   window.__del(p, 'b50');                        /* 目印を書かない古い端末が消した場合 */
   try{ localStorage.removeItem((typeof insPrefix==='function'?insPrefix():'pivot_') + 'fs_seen'); }catch(e){}
 }, BP);
 await pg.evaluate(()=>window.__pvSyncNow && window.__pvSyncNow());
 await pg.waitForTimeout(1500);
 const r5 = await pg.evaluate(()=>window.__fs.reads);
 ok('★ このときは、全部を読む', r5 >= 60, r5);
 const gone = await pg.evaluate(()=>{
   try{ var all = (typeof pbLoadAll==='function') ? (pbLoadAll()||{}) : {};
     return { has50: !!all['b50'], n: Object.keys(all).length }; }catch(e){ return {}; } });
 ok('★ 消された物件に気づいて、手元からも消える', gone.has50 === false, gone);
 ok('★ ほかの物件は残る', gone.n === 68, gone);

 console.log('\n❾ 使った回数が、数えられている');
 const u = await pg.evaluate(()=>window.pvUsage && window.pvUsage());
 ok('★ pvUsage() で見られる', !!u, u);
 ok('★ 読んだ回数が入っている', Number(u.read)>0, u.read);
 ok('★ どこで使ったかも分かる', u.why && Object.keys(u.why).length>0, u.why);

 console.log('\n画面のエラー: ' + (errs.length ? errs.join(' / ') : 'なし'));
 ok('★ 画面のエラーなし', errs.length===0, errs);
 await b.close();
 console.log('\n' + (F ? '❌' : '✅') + ' PASS=' + P + '  ❌ FAIL=' + F);
})();
