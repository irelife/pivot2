/* ==================================================================
 * SIDEBAR / 左メニュー (IIFE)
 * ================================================================== */

(function pvSide(){
  var ICON = {
    pivot:  '<path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-7h6v7"/>',
    kanban: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>'
          + '<path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
    rent:   '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'
  };
  var NAV = [
    { k:'pivot',  t:'\u7269\u4EF6' },                       /* 物件 */
    { k:'kanban', t:'\u5951\u7D04' },                       /* 契約 */
    { k:'rent',   t:'\u30AA\u30FC\u30CA\u30FC\u30E1\u30FC\u30EB' }  /* オーナーメール */
  ];

  function svg(d){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"'
         + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  function build(){
    if (document.getElementById('pv-side')) return;
    var n = document.createElement('nav');
    n.id = 'pv-side';
    n.setAttribute('aria-label', '\u753B\u9762\u306E\u5207\u308A\u66FF\u3048');
    n.innerHTML =
      '<div class="lg" title="PIVOT2\u30C8\u30C3\u30D7\u3078">PIVOT2'
    +   '<span>IRE\u30E9\u30A4\u30D5\u682A\u5F0F\u4F1A\u793E</span></div>'
    + '<div class="grp">\u7BA1\u7406</div>'
    + NAV.map(function (v) {
        return '<a href="#" data-k="' + v.k + '">' + svg(ICON[v.k]) + v.t + '</a>';
      }).join('');

    document.body.insertBefore(n, document.body.firstChild);

    n.querySelector('.lg').addEventListener('click', function () {
      if (typeof window.goToTop === 'function') window.goToTop();
    });
    Array.prototype.forEach.call(n.querySelectorAll('a[data-k]'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof window.switchApp === 'function') window.switchApp(a.dataset.k);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
