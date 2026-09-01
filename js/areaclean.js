/* =====================================================================
   よそのエリアの「からっぽの物件」を片づける道具

   何のためのものか
     PIVOT2（広島）に、岡山の物件が入りこんでしまうことがあります。
     入りこむのは たいてい「区画0・契約なし・画像なし」の
     名前だけの物件です。これを見つけて、まとめて消します。

   消すのは、次の4つを すべて満たすものだけです。
     ① 住所が、この端末のエリアではない
     ② 区画が 0 件
     ③ 契約（進行中・履歴とも）に、その物件名が出てこない
     ④ 配置図も現地写真も入っていない
   ひとつでも当てはまらないものは、絶対に消しません。
   （例：エスプレイスビルドは 総社市ですが 区画が33件あるので残ります）

   ※ これは「いま画面にあるものを片づける」道具です。
     入りこむ おおもとの原因（同じGAS URLを2と3の両方に入れている等）
     が残っていると、また入ってきます。
   ===================================================================== */
(function(){
  'use strict';

  /* この端末はどちらのエリアか */
  function myArea(){
    try{
      var p = String(location.pathname || '').toLowerCase();
      if(p.indexOf('pivot3') >= 0) return 'okayama';
    }catch(e){}
    return 'hiroshima';
  }

  /* 住所からエリアを見る。
     ownerimport.js と同じ考え方にそろえています。 */
  /* 倉敷市老松町 は、住所は岡山県ですが PIVOT2（広島）の担当です。
     ベラカーサ3棟・アンティカベラカーサ がここにあります。
     まちがって消さないよう、こちら側として数えます。
     （総社市は PIVOT3 に移したので、ここには入れていません。
       エスプレイスビルドは 区画33件あるので、それで守られます） */
  var HIROSHIMA = ['広島県', '倉敷市老松町'];
  var OKAYAMA   = ['岡山県'];
  function norm(s){ return String(s||'').normalize('NFKC').replace(/[\s　]/g,''); }
  function areaOf(addr){
    var a = norm(addr);
    if(!a) return 'unknown';
    for(var i=0;i<HIROSHIMA.length;i++) if(a.indexOf(norm(HIROSHIMA[i]))>=0) return 'hiroshima';
    for(var j=0;j<OKAYAMA.length;j++)   if(a.indexOf(norm(OKAYAMA[j]))>=0)   return 'okayama';
    return 'unknown';
  }
  function key(s){ return norm(s).toLowerCase(); }

  /* 契約に出てくる物件名をぜんぶ集めます（進行中・履歴とも） */
  function contractNames(){
    var out = {};
    function walk(o, d){
      if(!o || d > 6) return;
      if(Array.isArray(o)){ for(var i=0;i<o.length;i++) walk(o[i], d+1); return; }
      if(typeof o !== 'object') return;
      if(o.property) out[key(o.property)] = 1;
      for(var k in o){ var v = o[k]; if(v && typeof v === 'object') walk(v, d+1); }
    }
    try{ walk(JSON.parse(localStorage.getItem(window.ctKey ? ctKey() : '') || '{}'), 0); }catch(e){}
    try{ if(Array.isArray(window.BROKER_HISTORY)) walk(window.BROKER_HISTORY, 0); }catch(e){}
    return out;
  }

  /* 消してよいものを探します */
  function findTargets(){
    var all = (typeof pbLoadAll === 'function') ? (pbLoadAll() || {}) : {};
    var mine = myArea();
    var used = contractNames();
    var hit = [], keep = [];
    Object.keys(all).forEach(function(id){
      var b = all[id] || {};
      var a = areaOf(b.addr);
      var spots = (b.spots || []).length;
      var imgs  = !!(b.layout_id || b.layout2_id || (b.photo_ids || []).length);
      var inCt  = !!used[key(b.name)];
      var reasonKeep = [];
      if(a === mine || a === 'unknown') reasonKeep.push('このエリア');
      if(spots > 0) reasonKeep.push('区画 ' + spots + '件');
      if(inCt)      reasonKeep.push('契約あり');
      if(imgs)      reasonKeep.push('画像あり');
      if(reasonKeep.length === 0) hit.push({ id:id, name:b.name||'(名前なし)', addr:b.addr||'' });
      else if(a !== mine && a !== 'unknown') keep.push({ name:b.name||'', why:reasonKeep.join('・') });
    });
    hit.sort(function(x,y){ return String(x.name).localeCompare(String(y.name),'ja'); });
    keep.sort(function(x,y){ return String(x.name).localeCompare(String(y.name),'ja'); });
    return { hit:hit, keep:keep, total:Object.keys(all).length, mine:mine };
  }

  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  /* 画面を出します */
  window.openAreaClean = function(){
    var r = findTargets();
    var mineLabel = (r.mine === 'okayama') ? '岡山' : '広島';
    var otherLabel = (r.mine === 'okayama') ? '広島' : '岡山';

    var old = document.getElementById('ac-ov'); if(old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'ac-ov';
    ov.setAttribute('style',
      'position:fixed;inset:0;z-index:190000;background:rgba(0,0,0,.45);' +
      'display:flex;align-items:center;justify-content:center;padding:16px;');

    var list = r.hit.length
      ? r.hit.map(function(x){
          return '<div class="ac-r"><b>' + esc(x.name) + '</b><span>' + esc(x.addr) + '</span></div>';
        }).join('')
      : '<div class="ac-none">片づけるものはありません。</div>';

    var kept = r.keep.length
      ? '<div class="ac-h2">' + otherLabel + 'の住所だけれど、残すもの（' + r.keep.length + '件）</div>' +
        '<div class="ac-keep">' + r.keep.map(function(x){
          return '<div class="ac-r2"><b>' + esc(x.name) + '</b><span>' + esc(x.why) + '</span></div>';
        }).join('') + '</div>'
      : '';

    ov.innerHTML =
      '<div class="ac-box">' +
        '<div class="ac-hd">よそのエリアの、からっぽの物件を片づける</div>' +
        '<div class="ac-lead">' +
          'この端末は <b>' + mineLabel + '</b> です。登録は全部で ' + r.total + '件。<br>' +
          '下の <b>' + r.hit.length + '件</b> は、' + otherLabel + 'の住所で、区画0・契約なし・画像なし です。<br>' +
          'これらを消します。ひとつでも中身があるものは、消しません。' +
        '</div>' +
        '<div class="ac-h2">消すもの（' + r.hit.length + '件）</div>' +
        '<div class="ac-list">' + list + '</div>' +
        kept +
        '<div class="ac-note">' +
          '<b>消したあとに、かならずしてください</b><br>' +
          '設定 → クラウド同期 → <b>⬆️（クラウドへ送信）</b> を押す。<br>' +
          'ここで消えるのは この端末の中だけです。クラウドには残っているので、' +
          '押さないと 次にログインしたとき また戻ってきます。<br>' +
          '（起動時の自動取り込みは、クラウドの方が新しければ' +
          ' そのまま手元を置きかえる作りです）<br><br>' +
          '※「安全のため同期を中止しました」と出ることがありますが、' +
          'それは自動同期の話です。⬆️ のボタンは止まりません。' +
        '</div>' +
        '<div class="ac-btns">' +
          '<button type="button" id="ac-cancel">閉じる</button>' +
          '<button type="button" id="ac-go"' + (r.hit.length ? '' : ' disabled') + '>' +
            'この ' + r.hit.length + '件を消す</button>' +
        '</div>' +
      '</div>';

    var st = document.createElement('style');
    st.textContent = [
      '#ac-ov .ac-box{background:#fff;border-radius:16px;width:640px;max-width:100%;max-height:86vh;',
      '  overflow-y:auto;padding:20px 22px;box-shadow:0 18px 50px rgba(0,0,0,.3);',
      '  font-family:inherit;color:#17171a;}',
      '#ac-ov .ac-hd{font-size:17px;font-weight:800;margin-bottom:8px;}',
      '#ac-ov .ac-lead{font-size:13px;line-height:1.8;color:#3f3f46;margin-bottom:14px;}',
      '#ac-ov .ac-h2{font-size:12px;font-weight:800;letter-spacing:.06em;color:#71717a;margin:14px 0 6px;}',
      '#ac-ov .ac-list,#ac-ov .ac-keep{border:1px solid #e4e4e7;border-radius:10px;',
      '  max-height:34vh;overflow-y:auto;background:#fafafa;}',
      '#ac-ov .ac-r,#ac-ov .ac-r2{display:flex;gap:10px;align-items:baseline;',
      '  padding:7px 11px;border-bottom:1px solid #ececef;font-size:13px;}',
      '#ac-ov .ac-r:last-child,#ac-ov .ac-r2:last-child{border-bottom:0;}',
      '#ac-ov .ac-r b,#ac-ov .ac-r2 b{font-weight:700;flex:0 0 auto;}',
      '#ac-ov .ac-r span,#ac-ov .ac-r2 span{color:#71717a;font-size:11.5px;flex:1;min-width:0;}',
      '#ac-ov .ac-none{padding:16px;text-align:center;color:#71717a;font-size:13px;}',
      '#ac-ov .ac-note{font-size:11.5px;color:#71717a;line-height:1.8;margin-top:14px;',
      '  background:#f5f5f6;border-radius:10px;padding:10px 12px;}',
      '#ac-ov .ac-btns{display:flex;gap:10px;margin-top:16px;}',
      '#ac-ov .ac-btns button{flex:1;padding:13px;border-radius:11px;border:1.5px solid #d4d4d8;',
      '  background:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;}',
      '#ac-ov #ac-go{background:#b23a28;border-color:#b23a28;color:#fff;}',
      '#ac-ov #ac-go[disabled]{opacity:.4;cursor:default;}'
    ].join('');
    ov.appendChild(st);
    document.body.appendChild(ov);

    ov.querySelector('#ac-cancel').onclick = function(){ ov.remove(); };
    ov.querySelector('#ac-go').onclick = function(){
      if(!r.hit.length) return;
      if(!confirm(r.hit.length + '件を消します。よろしいですか？\n\n' +
                  '※ 消したあと、クラウドへ上げるまでは この端末だけの変更です。')) return;
      var all = pbLoadAll() || {};
      var n = 0;
      r.hit.forEach(function(x){ if(all[x.id]){ delete all[x.id]; n++; } });
      pbSaveRaw(all);
      try{ if(typeof touchLocalMtime === 'function') touchLocalMtime(); }catch(e){}
      try{ if(typeof renderAll === 'function') renderAll(); }catch(e){}
      try{ requestRender('buildings'); }catch(e){}
      ov.remove();
      alert(
        n + '件を消しました。\n\n' +
        '★ このあと かならず\n' +
        '　 設定 → クラウド同期 → ⬆️（クラウドへ送信）\n' +
        '　 を押してください。\n\n' +
        'いま消えたのは この端末の中だけです。\n' +
        'クラウドには まだ残っているので、押さないと\n' +
        '次にログインしたとき また戻ってきます。\n\n' +
        '※ 途中で「安全のため同期を中止しました」と出ることが\n' +
        '　 ありますが、それは自動同期の話です。\n' +
        '　 ⬆️ のボタンは止まりませんので、そのまま押してください。');
    };
  };
})();
