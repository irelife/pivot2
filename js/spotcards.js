/* ===========================================================
   スマホの区画一覧を「1区画＝1カード」にして、
   上に「空き／使用中／解約」の数・絞り込み・検索を出します。

   ・いまある HTML の id は1つも変えません。
   ・区画の入力欄（data-field）はそのまま使います。
     つまり保存・印刷・並び替えの仕組みには手を触れていません。
   ・760px より広い画面では、何もしません（パソコンは今までどおり）。
   ・電話中の書き換え事故を防ぐため、はじめは「見るだけ」です。
     「編集」を押したときだけ、入力できるようになります。
   =========================================================== */
(function(){
  'use strict';

  var MQ = window.matchMedia('(max-width: 760px)');

  /* 絞り込みの種類。status の値と、画面に出す名前。 */
  var KINDS = [
    { key:'',    label:'すべて' },
    { key:'空',   label:'空き' },
    { key:'借',   label:'使用中' },
    { key:'解',   label:'解約中' },
    { key:'予',   label:'予約中' },
    { key:'申',   label:'申込中' },
    { key:'募停', label:'募集停止' },
    { key:'退',   label:'退去済' }
  ];

  var on = false, modal, body, bar, chips, findBox, empty, obs;
  var kind = '', word = '';

  function q(s, r){ return (r || document).querySelector(s); }
  function qa(s, r){ return (r || document).querySelectorAll(s); }

  /* ---------- 組み立て ---------- */
  function build(){
    if(on) return;
    modal = document.getElementById('modal'); if(!modal) return;
    body  = q('.modal-body', modal);          if(!body) return;
    if(!document.getElementById('spots-table')) return;

    bar = document.createElement('div');
    bar.id = 'pvc-bar';
    bar.innerHTML =
      '<div class="pvc-head"><b>区画</b><span id="pvc-sum"></span></div>' +
      '<div id="pvc-chips"></div>' +
      '<div id="pvc-find">' +
        '<input type="search" id="pvc-word" placeholder="区画番号・お名前・号室で探す" ' +
               'autocomplete="off" enterkeyhint="search" aria-label="区画をさがす">' +
        '<button type="button" id="pvc-map" title="この物件の住所を地図で開きます">地図</button>' +
        '<button type="button" id="pvc-edit" aria-pressed="false">編集</button>' +
      '</div>';

    /* #pv-pin（配置図の貼りつけ板）があれば、そのすぐ下に置きます */
    var pin = document.getElementById('pv-pin');
    if(pin && pin.parentNode === body) body.insertBefore(bar, pin.nextSibling);
    else body.insertBefore(bar, body.firstChild);

    chips   = q('#pvc-chips', bar);
    findBox = q('#pvc-word', bar);

    empty = document.createElement('div');
    empty.id = 'pvc-empty';
    empty.textContent = 'あてはまる区画がありません。';
    var wrap = document.getElementById('spots-table-wrap');
    if(wrap && wrap.parentNode) wrap.parentNode.insertBefore(empty, wrap);

    /* クラスは .modal-body に付けます。#modal に付けると、
       スマホシート側（mobilesheet.js）がクラス変化を見張っているため、
       絞り込みを押すたびにシートが半分の高さに戻ってしまいます。 */
    body.classList.add('pvc-on');
    on = true;

    chips.addEventListener('click', onChip);
    findBox.addEventListener('input', onWord);
    findBox.addEventListener('search', onWord);
    q('#pvc-edit', bar).addEventListener('click', onEdit);
    q('#pvc-map', bar).addEventListener('click', onMap);

    var tb = document.getElementById('spots-tbody');
    if(tb && window.MutationObserver){
      obs = new MutationObserver(function(){ refreshSoon(); });
      obs.observe(tb, { childList:true, subtree:true });
    }
    /* 状況を変えたら、数と絞り込みを直します */
    document.addEventListener('change', onAnyChange, true);

    refresh();
  }

  function teardown(){
    if(!on) return;
    if(obs){ obs.disconnect(); obs = null; }
    chips.removeEventListener('click', onChip);
    findBox.removeEventListener('input', onWord);
    findBox.removeEventListener('search', onWord);
    document.removeEventListener('change', onAnyChange, true);
    if(bar && bar.parentNode) bar.parentNode.removeChild(bar);
    if(empty && empty.parentNode) empty.parentNode.removeChild(empty);
    qa('#spots-table tr.pvc-hide').forEach(function(t){ t.classList.remove('pvc-hide'); });
    body.classList.remove('pvc-on', 'pvc-edit-on', 'pvc-no-hit');
    bar = chips = findBox = empty = null;
    kind = ''; word = '';
    on = false;
  }

  /* ---------- 区画を読む ---------- */
  function rows(){ return qa('#spots-tbody tr.spot-row'); }

  function statusOf(tr){
    var s = q('select[data-field="status"]', tr);
    if(s) return s.value || '空';
    var m = String(tr.className).match(/st-(募停|[借空解予退申])/);
    return m ? m[1] : '空';
  }
  function textOf(tr){
    var t = (tr.getAttribute('data-no') || '') + ' ';
    ['no','room','user','note','res_room','res_user','res_note'].forEach(function(f){
      var el = q('[data-field="' + f + '"]', tr);
      if(el && el.value) t += el.value + ' ';
    });
    /* 予約・退去済の行は、この区画のものとして一緒に探せるようにします */
    var idx = tr.getAttribute('data-idx');
    if(idx != null){
      qa('#spots-tbody tr.sub-row[data-sub-of="' + idx + '"]').forEach(function(sr){
        qa('input[data-field]', sr).forEach(function(el){ if(el.value) t += el.value + ' '; });
      });
    }
    return t.toLowerCase();
  }

  /* ---------- 数をかぞえる ---------- */
  function refresh(){
    if(!on) return;
    var list = rows(), n = {}, total = 0;
    list.forEach(function(tr){ var s = statusOf(tr); n[s] = (n[s] || 0) + 1; total++; });

    var sum = q('#pvc-sum', bar);
    if(sum){
      sum.textContent = total
        ? ('全' + total + '区画 ／ 空き ' + (n['空'] || 0) + ' ・ 使用中 ' + (n['借'] || 0))
        : '区画がまだありません';
    }

    /* つまみは「1件でもある種類」だけ出します */
    var want = KINDS.filter(function(k){ return k.key === '' || n[k.key]; });
    if(!want.some(function(k){ return k.key === kind; })) kind = '';
    var html = want.map(function(k){
      var c = (k.key === '') ? total : n[k.key];
      return '<button type="button" data-kind="' + k.key + '" aria-pressed="' +
             (k.key === kind ? 'true' : 'false') + '">' + k.label + '<i>' + c + '</i></button>';
    }).join('');
    if(chips.innerHTML !== html) chips.innerHTML = html;

    apply();
  }
  var timer = null;
  function refreshSoon(){
    if(timer) clearTimeout(timer);
    timer = setTimeout(function(){ timer = null; refresh(); }, 60);
  }

  /* ---------- 絞り込みを当てる ---------- */
  function apply(){
    if(!on) return;
    var hit = 0;
    rows().forEach(function(tr){
      var ok = true;
      if(kind && statusOf(tr) !== kind) ok = false;
      if(ok && word && textOf(tr).indexOf(word) < 0) ok = false;
      tr.classList.toggle('pvc-hide', !ok);
      var idx = tr.getAttribute('data-idx');
      if(idx != null){
        qa('#spots-tbody tr.sub-row[data-sub-of="' + idx + '"]').forEach(function(sr){
          sr.classList.toggle('pvc-hide', !ok);
        });
      }
      if(ok) hit++;
    });
    body.classList.toggle('pvc-no-hit', hit === 0 && rows().length > 0);
  }

  /* ---------- 操作 ---------- */
  function onChip(e){
    var b = e.target.closest ? e.target.closest('button[data-kind]') : null;
    if(!b) return;
    kind = (b.getAttribute('data-kind') === kind) ? '' : b.getAttribute('data-kind');
    qa('button[data-kind]', chips).forEach(function(x){
      x.setAttribute('aria-pressed', x.getAttribute('data-kind') === kind ? 'true' : 'false');
    });
    apply();
    scrollToSpots();
  }
  function onWord(){
    word = String(findBox.value || '').trim().toLowerCase();
    apply();
    if(word) scrollToSpots();
  }
  function onEdit(){
    var edit = body.classList.toggle('pvc-edit-on');
    this.setAttribute('aria-pressed', edit ? 'true' : 'false');
    this.textContent = edit ? '編集中' : '編集';
  }
  function onAnyChange(e){
    if(!on || !e.target) return;
    var f = e.target.getAttribute && e.target.getAttribute('data-field');
    if(f === 'status') refreshSoon();
  }
  /* 絞り込んだあと、<いちばん上に残った区画カード> の先頭へ寄せます。
     ・すべて   … 1番めの区画
     ・空き     … 空きの いちばん上
     ・使用中   … 使用中の いちばん上
     貼りつけた配置図の板は上に居座るので、そのぶん下げて、
     カードが板のかげに隠れないようにします。
     絞り込みで高さが変わるので、描き直しを1回待ってから測ります。 */
  function scrollToSpots(){
    if(!on || !body) return;
    var run = function(){
      var target = q('#spots-tbody tr.spot-row:not(.pvc-hide)') || q('.spots-section');
      if(!target) return;
      var pin = document.getElementById('pv-pin');
      var pinH = 0;
      if(pin && getComputedStyle(pin).display !== 'none'){
        pinH = pin.getBoundingClientRect().height;
      }
      var top = target.getBoundingClientRect().top
              - body.getBoundingClientRect().top
              + body.scrollTop - pinH - 10;
      if(top < 0) top = 0;
      try{ body.scrollTo({ top: top, behavior:'smooth' }); }
      catch(err){ body.scrollTop = top; }
    };
    if(window.requestAnimationFrame) requestAnimationFrame(run); else setTimeout(run, 16);
  }

  /* ---------- 地図（スマホだけ） ---------- */
  function onMap(){
    var a = document.getElementById('f-addr');
    var addr = a ? String(a.value || '').trim() : '';
    var nm = document.getElementById('f-name');
    var name = nm ? String(nm.value || '').trim() : '';
    if(!addr){
      alert('住所が入っていないので、地図を開けません。\n下の「住所(物件メイン)」に入れてください。');
      return;
    }
    /* 物件名も一緒に渡すと、建物名で見つかることがあります */
    var q2 = addr + (name ? ' ' + name : '');
    window.open('https://www.google.com/maps/search/?api=1&query=' +
                encodeURIComponent(q2), '_blank', 'noopener');
  }

  /* ---------- 出入り口 ---------- */
  function start(){
    if(MQ.matches) build(); else teardown();
    if(MQ.addEventListener) MQ.addEventListener('change', function(){ if(MQ.matches) build(); else teardown(); });
    else if(MQ.addListener) MQ.addListener(function(){ if(MQ.matches) build(); else teardown(); });

    /* 物件を開き直したときは、絞り込みと検索をまっさらに戻します。
       「閉じている→開いた」の瞬間だけ動かします。 */
    var m = document.getElementById('modal');
    var wasActive = m ? m.classList.contains('active') : false;
    if(m && window.MutationObserver){
      new MutationObserver(function(){
        var nowActive = m.classList.contains('active');
        var opened = nowActive && !wasActive;
        wasActive = nowActive;
        if(!on) return;
        if(opened){
          kind = ''; word = '';
          if(findBox) findBox.value = '';
          body.classList.remove('pvc-edit-on');
          var eb = document.getElementById('pvc-edit');
          if(eb){ eb.textContent = '編集'; eb.setAttribute('aria-pressed', 'false'); }
          refreshSoon();
        }
      }).observe(m, { attributes:true, attributeFilter:['class'] });
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.PVSpotCards = { refresh: refresh };
})();
