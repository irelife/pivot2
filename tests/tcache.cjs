/* ★★ 9/13 の事故の検査：スマホで契約だけ全部消えた
 *
 *   Firebase は、クラウドへ届かないときエラーを出しません。
 *   端末の中の控え（キャッシュ）から、そっと返してきます。
 *   控えが空なら「0件」が、成功として返ります。
 *
 *   いまのコードはそれを「ほかの端末で全部消された」と取りちがえて、
 *   この端末の契約をぜんぶ消していました。
 *   物件にだけ守りがあり、契約にはありませんでした。              */
const fs=require('fs');
/* どこでも動くように：playwright があればそれを、無ければ playwright-core を使います */
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));   /* 相対パスで渡されても file:// が壊れないよう、必ず絶対パスに直します */
let FAKE=eval(fs.readFileSync(__dirname+'/tquota.cjs','utf8').match(/const FAKE = (`[\s\S]*?`);\n/)[1]);

/* にせクラウドを、reload でも消えないようにします */
FAKE = FAKE.replace('var DB = { docs:{} };', [
  "var _raw=(function(){ try{ return JSON.parse(sessionStorage.getItem('__fakedb')||'{}'); }catch(e){ return {}; } })();",
  "var _save=function(){ try{ sessionStorage.setItem('__fakedb', JSON.stringify(_raw)); }catch(e){} };",
  "var DB = { docs: new Proxy(_raw, { set:function(t,k,v){ t[k]=v; _save(); return true; },",
  "  deleteProperty:function(t,k){ delete t[k]; _save(); return true; } }) };"].join('\n'));

/* ★ ここが今回のキモ：電波が無いときの Firebase のふるまいを、そのまま真似します
     ・エラーにならない
     ・端末の中の控えから返る（＝ここでは0件）
     ・metadata.fromCache が true になる                              */
FAKE = "(function(){ try{ Object.defineProperty(window,'__offline',{" +
       "get:function(){ try{ return sessionStorage.getItem('__off')==='1'; }catch(e){ return false; } }," +
       "set:function(v){ try{ sessionStorage.setItem('__off', v?'1':'0'); }catch(e){} }}); }catch(e){} })();\n" + FAKE;
FAKE = FAKE.replace(
  "  function qs(arr){\n    return { size:arr.length, empty:arr.length===0,\n             forEach:function(f){ for(var i=0;i<arr.length;i++) f(arr[i]); } };\n  }",
  [ "  function qs(arr){",
    "    if(window.__offline){ arr = []; }",
    "    return { size:arr.length, empty:arr.length===0,",
    "             metadata:{ fromCache: !!window.__offline },",
    "             forEach:function(f){ for(var i=0;i<arr.length;i++) f(arr[i]); } };",
    "  }" ].join('\n'));
FAKE = FAKE.replace(
  "  function snapOf(path, id, d){ return { id:id, exists:!!d, data:function(){ return d; } }; }",
  "  function snapOf(path, id, d){ if(window.__offline) d = null;\n" +
  "    return { id:id, exists:!!d, metadata:{ fromCache: !!window.__offline }, data:function(){ return d; } }; }");
/* 本物の Firestore は、電波が無いと runTransaction を必ず失敗させます
   （書き込みはサーバーに届かないと決められないため）。そこも真似します */
FAKE = FAKE.replace(
  "      return Promise.resolve(fn(tx));",
  "      if(window.__offline) return Promise.reject(new Error('unavailable'));\n" +
  "      return Promise.resolve(fn(tx));");

let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };

(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:390,height:844}});    /* スマホの大きさ */
 const dlg=[]; pg.on('dialog',d=>{ dlg.push(d.message().slice(0,60).replace(/\n/g,' ')); d.dismiss(); });
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 const GAS='https://example.invalid/gas';
 const posts=[];
 await pg.route('**://**', r=>{ const q=r.request(); const u=q.url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0){
     let a='?'; try{ a=(JSON.parse(q.postData()||'{}').action)||'?'; }catch(e){}
     posts.push(a);
     return r.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({ok:true,version:'t',payload:{buildings:{},contracts:{},owners:[]}})});
   }
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 await pg.addInitScript(FAKE);
 await pg.goto('file://'+DIR+'/index.html'); await pg.waitForTimeout(1200);
 await pg.evaluate((g)=>{ localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_')+'cloud_url', g); }, GAS);
 await pg.reload(); await pg.waitForTimeout(2500);

 const pre=await pg.evaluate(()=>(typeof insPrefix==='function'?insPrefix():'pivot_'));
 const BP=pre.replace(/_+$/,'')+'/data/buildings';
 const CT=pre.replace(/_+$/,'')+'/data/contracts';
 const LS=pre+'contract_kanban_v2';

 await pg.evaluate((a)=>{ var sp={};
   for(var i=1;i<=3;i++) sp[String(i)]={no:String(i),type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''};
   window.__seed(a[0],'b1',{id:'b1',name:'ナディア',addr:'広島市中区',spots:sp,
     rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'});
   var at='2026-09-01T00:00:00.000Z';
   ['c1','c2','c3'].forEach(function(id,i){ window.__seed(a[1],id,{id:id,property:'ナディア',room:'10'+(i+1),
     contractor:id+'の人',rev:1,updatedAt2:at}); });
 }, [BP,CT]);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(3500);
 await pg.evaluate(()=>{ try{ return window.__pvSyncContracts(); }catch(e){} }); await pg.waitForTimeout(1500);

 const localCts=()=>pg.evaluate((k)=>{ try{ return Object.keys(JSON.parse(localStorage.getItem(k)||'{}')).sort(); }
                                       catch(e){ return [String(e)]; } }, LS);
 const localBlds=()=>pg.evaluate(()=>{ try{ return Object.keys(pbLoadAll()||{}).sort(); }catch(e){ return [String(e)]; } });
 const ctSig=()=>pg.evaluate((p)=>{ try{ return Object.keys(JSON.parse(localStorage.getItem(p+'fs_ct_sig')||'{}')).length; }catch(e){ return -1; } }, pre);
 const off=(v)=>pg.evaluate((x)=>{ window.__offline=x; }, v);

 console.log('\n❶ 下ごしらえ（スマホに、契約3件と物件1件がある状態）');
 ok('★ 契約3件', (await localCts()).join()==='c1,c2,c3', await localCts());
 ok('★ 物件1件', (await localBlds()).join()==='b1', await localBlds());
 ok('★ 控えも3件ぶんある', (await ctSig())===3, await ctSig());

 console.log('\n❷ ★ 今回の事故：電波の悪いスマホで、PIVOTを開き直す');
 await off(true);
 await pg.reload(); await pg.waitForTimeout(4000);      /* 開き直し → 「全部読み」が走ります */
 await pg.evaluate(()=>{ try{ return window.__pvSyncContracts(); }catch(e){} }); await pg.waitForTimeout(2500);
 ok('★★ 契約が消えない（ここが9/13に消えたところ）',
    (await localCts()).join()==='c1,c2,c3', await localCts());
 ok('★ 控え（fs_ct_sig）も消えない', (await ctSig())===3, await ctSig());
 ok('★ 物件も消えない', (await localBlds()).join()==='b1', await localBlds());

 console.log('\n❸ 電波が無いあいだ、何度くり返しても消えない');
 for(let i=0;i<3;i++){
   await pg.evaluate(()=>{ try{ return window.__pvSyncContracts(); }catch(e){} });
   await pg.waitForTimeout(800);
 }
 ok('★ 3回くり返しても、契約3件のまま', (await localCts()).join()==='c1,c2,c3', await localCts());

 console.log('\n❹ 電波が無いときは、直しても控えの表へ送らない（確かめられないので）');
 posts.length=0;
 await pg.evaluate(()=>{ var all=pbLoadAll();
   all['b1'].spots.forEach(function(s){ if(String(s.no)==='1') s.user='★電波なしで入力'; });
   pbSaveRaw(all); try{ window.__pushNow(); }catch(e){} });
 await pg.waitForTimeout(6000);
 ok('★ 控えの表（GAS）へ save を送っていない',
    posts.filter(x=>x==='save').length===0, posts.slice(0,8));
 ok('★ 入力そのものは、手元に残っている',
    (await pg.evaluate(()=>{ try{ var a=pbLoadAll()['b1'].spots.filter(function(s){return String(s.no)==='1';})[0];
      return a && a.user; }catch(e){ return String(e); } }))==='★電波なしで入力');
 /* ★ v30）一瞬の通信切れでは、すぐには印を出しません（25秒は黙ります）。
    見た目は出しませんが、「送れていない」ことは必ず覚えています。
    ここでは「覚えているか」を見ます。 */
 ok('★ 送れていないことを覚えている（見た目は、まだ出さない）',
    (await pg.evaluate(()=>{
       var k=Object.keys(localStorage).filter(x=>/unsent$/.test(x))[0];
       if(!k) return null;
       var v=null; try{ v=JSON.parse(localStorage.getItem(k)); }catch(e){}
       return v && v.kind ? v.kind : null;
     }))!==null);
 ok('★ すぐには、画面に印を出さない',
    (await pg.evaluate(()=>!!document.getElementById('pv-unsent-badge')))===false);
 /* 長く送れないままなら、ちゃんと印が出ることも見ます */
 await pg.evaluate(()=>{ var k=Object.keys(localStorage).filter(x=>/unsent$/.test(x))[0];
   var v=JSON.parse(localStorage.getItem(k)); v.from=Date.now()-120000;
   localStorage.setItem(k, JSON.stringify(v)); window.__pvUnsent.mark(v.kind); });
 await pg.waitForTimeout(600);
 ok('★ 長く送れないままなら、印が出る',
    (await pg.evaluate(()=>!!document.getElementById('pv-unsent-badge')))===true);

 console.log('\n❺ 電波が戻ったら「まず読み込む → それから送る」');
 await off(false);
 posts.length=0;
 await pg.evaluate(()=>{ try{ window.__pushNow(); }catch(e){} });
 await pg.waitForTimeout(6000);
 ok('★ 読み込む前は、まだ送らない（古い内容で上書きしないため）',
    posts.filter(x=>x==='save').length===0, posts.slice(0,8));

 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(5000);
 posts.length=0;
 await pg.evaluate(()=>{ try{ window.__pushNow(); }catch(e){} });
 await pg.waitForTimeout(7000);
 ok('★ 読み込んだあとは、たまっていた直しが送られる',
    posts.filter(x=>x==='save').length>=1, posts.slice(0,8));
 ok('★ 電波なしで入れた入力は、消えていない',
    (await pg.evaluate(()=>{ try{ var a=pbLoadAll()['b1'].spots.filter(function(s){return String(s.no)==='1';})[0];
      return a && a.user; }catch(e){ return String(e); } }))==='★電波なしで入力');
 ok('★ 赤い札が消えた',
    (await pg.evaluate(()=>!!document.getElementById('pv-unsent-badge')))===false);

 console.log('\n❻ 手元が空になっていても、開き直せば戻ってくる（差分読みで固まらない）');
 await pg.evaluate((k)=>{ localStorage.setItem(k,'{}'); }, LS);      /* 消えてしまった状態から */
 await pg.evaluate(()=>{ try{ return window.__pvSyncContracts(); }catch(e){} }); await pg.waitForTimeout(3000);
 ok('★ 契約3件が戻ってくる', (await localCts()).join()==='c1,c2,c3', await localCts());

 console.log('\n❼ 本当にクラウドが0件のときも、黙って消さない');
 await pg.evaluate((p)=>{ ['c1','c2','c3'].forEach(function(id){ window.__del(p,id); }); }, CT);
 await pg.evaluate(()=>{ try{ return window.__pvSyncContracts(); }catch(e){} }); await pg.waitForTimeout(2500);
 ok('★ クラウドが0件に見えても、手元は消さない',
    (await localCts()).join()==='c1,c2,c3', await localCts());

 console.log('\n❽ ほかの端末が1件だけ消したときは、ちゃんと消える（消せなくなっていないか）');
 await pg.evaluate((a)=>{ var at='2026-09-14T00:00:00.000Z';
   ['c1','c2','c3'].forEach(function(id,i){ window.__seed(a[0],id,{id:id,property:'ナディア',room:'10'+(i+1),
     contractor:id+'の人',rev:1,updatedAt2:at}); }); }, [CT]);
 await pg.evaluate(()=>{ try{ return window.__pvSyncContracts(); }catch(e){} }); await pg.waitForTimeout(2000);
 await pg.evaluate((p)=>{ window.__del(p,'c2'); }, CT);
 /* 消えたことが分かるのは「全部読み」のときだけです（1時間に1回、または開き直し）。
    ここでは開き直して、その全部読みをさせます。 */
 await pg.reload(); await pg.waitForTimeout(3000);
 await pg.evaluate(()=>{ try{ return window.__pvSyncContracts(); }catch(e){} }); await pg.waitForTimeout(2500);
 ok('★ 1件だけ消したのは、ちゃんと伝わる', (await localCts()).join()==='c1,c3', await localCts());

 console.log('\n❾ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);
 await b.close();
 console.log('\n'+(F?'❌':'✅')+' PASS='+P+'  ❌ FAIL='+F);
})();
