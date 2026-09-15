/* ★★ 大手のアプリと同じ動き：別の区画を同時に触っても、止まらない
 *
 *   ・Aさんが1番区画、Bさんが2番区画 → どちらも通る。確認も出ない
 *   ・同じ区画を2人が触ったときだけ、お知らせが出る
 *   ・送るのは、変わった区画だけ                                    */
const fs=require('fs');
/* どこでも動くように：playwright があればそれを、無ければ playwright-core を使います */
const {chromium}=(function(){ try{ return require('playwright'); }
                              catch(e){ return require('playwright-core'); } })();
const DIR = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));   /* 相対パスで渡されても file:// が壊れないよう、必ず絶対パスに直します */
let FAKE=eval(fs.readFileSync(__dirname+'/tquota.cjs','utf8').match(/const FAKE = (`[\s\S]*?`);\n/)[1]);
FAKE = FAKE.replace('var DB = { docs:{} };', [
  "var _raw=(function(){ try{ return JSON.parse(sessionStorage.getItem('__fakedb')||'{}'); }catch(e){ return {}; } })();",
  "var _save=function(){ try{ sessionStorage.setItem('__fakedb', JSON.stringify(_raw)); }catch(e){} };",
  "var DB = { docs: new Proxy(_raw, { set:function(t,k,v){ t[k]=v; _save(); return true; },",
  "  deleteProperty:function(t,k){ delete t[k]; _save(); return true; } }) };"].join('\n'));
let P=0,F=0; const ok=(n,c,x)=>{ if(c){P++;console.log('  ✅ '+n);} else {F++;console.log('  ❌ '+n+(x!==undefined?('  → '+JSON.stringify(x)):''));} };
(async()=>{
 const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
 const pg=await b.newPage({viewport:{width:1200,height:900}});
 const dlg=[]; pg.on('dialog',d=>{ dlg.push(d.message().slice(0,60).replace(/\n/g,' ')); d.dismiss(); });
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 const GAS='https://example.invalid/gas';
 await pg.route('**://**', r=>{ const u=r.request().url();
   if(u.startsWith('file://')) return r.continue();
   if(u.indexOf('example.invalid')>=0) return r.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({ok:true,version:'t',payload:{buildings:{},contracts:{},owners:[]}})});
   return r.fulfill({status:200,contentType:'application/javascript',body:'/* stub */'}); });
 await pg.addInitScript(FAKE);
 await pg.goto('file://'+DIR+'/index.html'); await pg.waitForTimeout(1200);
 await pg.evaluate((g)=>{ localStorage.setItem((typeof insPrefix==='function'?insPrefix():'pivot_')+'cloud_url', g); }, GAS);
 await pg.reload(); await pg.waitForTimeout(2500);
 const pre=await pg.evaluate(()=>(typeof insPrefix==='function'?insPrefix():'pivot_'));
 const BP=pre.replace(/_+$/,'')+'/data/buildings';
 await pg.evaluate((p)=>{ var sp={};
   for(var i=1;i<=10;i++) sp[String(i)]={no:String(i),type:'並',tou:'',room:'',user:'',price:0,status:'空',note:''};
   window.__seed(p,'b1',{id:'b1',name:'ナディア',addr:'広島市中区',spots:sp,
     rev:1,updatedAt:'2026-09-01T00:00:00.000Z',updatedBy:'x'}); }, BP);
 await pg.evaluate(()=>{ try{ window.forcePullLatest(); }catch(e){} }); await pg.waitForTimeout(3000);

 const spots=()=>pg.evaluate((p)=>{ var d=window.__all()[p+'/b1']||{}; var s=d.spots||{};
   return Object.keys(s).sort(function(a,c){return +a-+c;}).map(k=>k+':'+(s[k].user||'空')); }, BP);
 const rev=()=>pg.evaluate((p)=>((window.__all()[p+'/b1']||{}).rev||0), BP);
 /* 「ほかの端末」が、区画をひとつ直したことにします */
 const other=(no,who)=>pg.evaluate((a)=>{ var d=window.__all()[a[0]+'/b1'];
   d.spots[a[1]]=Object.assign({},d.spots[a[1]],{user:a[2]});
   d.rev=(d.rev||1)+1; d.updatedAt=new Date().toISOString(); d.updatedBy='ほかの人';
   window.__set(a[0],'b1',d); }, [BP,String(no),who]);
 const edit=(no,who)=>pg.evaluate((a)=>{ var all=pbLoadAll();
   all['b1'].spots.forEach(function(s){ if(String(s.no)===a[0]) s.user=a[1]; });
   pbSaveRaw(all); window.__pushNow(); }, [String(no),who]);

 console.log('\n❶ ほかの人が1番区画を直したあとに、こちらが2番区画を直す');
 await other(1,'★Aさん');
 dlg.length=0;
 await edit(2,'★Bさん');
 await pg.waitForTimeout(4000);
 const s1=await spots();
 ok('★ 確認もお知らせも、いっさい出ない', dlg.length===0, dlg);
 ok('★ Aさんの1番が残っている', s1.join().indexOf('1:★Aさん')>=0, s1);
 ok('★ Bさんの2番も入っている', s1.join().indexOf('2:★Bさん')>=0, s1);

 console.log('\n❷ それを3回くり返しても、止まらない');
 for(const [on,ow,mn,mw] of [[3,'★A3',4,'★B4'],[5,'★A5',6,'★B6'],[7,'★A7',8,'★B8']]){
   await other(on,ow);
   dlg.length=0;
   await edit(mn,mw);
   await pg.waitForTimeout(3000);
 }
 const s2=await spots();
 ok('★ 確認は一度も出ない', dlg.length===0, dlg);
 ok('★ 6つぜんぶ入っている',
    ['1:★Aさん','2:★Bさん','3:★A3','4:★B4','5:★A5','6:★B6','7:★A7','8:★B8']
      .every(x=>s2.join().indexOf(x)>=0), s2);

 console.log('\n❸ 送っているのは、変わった区画だけか');
 await pg.evaluate(()=>window.__zero());
 await other(9,'★A9');
 await edit(10,'★B10');
 await pg.waitForTimeout(3500);
 /* ★ 物件への書き込みと、呼び鈴への書き込みを分けて数えます。
    まぜて数えると、どちらが増えたのか分からなくなるためです。 */
 const wb=await pg.evaluate(()=>window.__fs.calls.filter(function(c){
   return c.indexOf('writes')===0 && c.indexOf('/buildings/')>=0; }).length);
 ok('★ 物件の書き込みは1回（変わった区画だけ送っている）', wb===1, wb);
 const wbell=await pg.evaluate(()=>window.__fs.calls.filter(function(c){
   return c.indexOf('writes')===0 && c.indexOf('sync_bell')>=0; }).length);
 ok('★ 呼び鈴は1回だけ鳴る', wbell<=1, wbell);
 const s3=await spots();
 ok('★ 9番も10番も入っている',
    s3.join().indexOf('9:★A9')>=0 && s3.join().indexOf('10:★B10')>=0, s3);

 console.log('\n❹ まったく同じ区画を2人が触ったときだけ、お知らせが出る');
 await other(2,'★あとからAさんが上書き');
 dlg.length=0;
 await edit(2,'★Bさんも同じ2番');
 await pg.waitForTimeout(4000);
 ok('★ お知らせが出る', dlg.length>0, dlg);
 ok('★ 2番区画だと分かる', dlg.join().indexOf('2番区画')>=0, dlg);

 console.log('\n❺ そのとき、ほかの区画は巻きこまれない');
 const s4=await spots();
 ok('★ ほかの区画はそのまま',
    s4.join().indexOf('1:★Aさん')>=0 && s4.join().indexOf('7:★A7')>=0, s4);

 console.log('\n❻ 画面のエラー');
 ok('★ エラーなし', errs.length===0, errs);
 await b.close();
 console.log('\n'+(F?'❌':'✅')+' PASS='+P+'  ❌ FAIL='+F);
 process.exit(F?1:0);
})();
