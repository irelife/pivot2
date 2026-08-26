# PIVOT2 — 左メニュー版・ファイル分離済み

PIVOT2ブランディング＋左メニュー版の index.html（14,285行）を機能ごとに分割したもの。
**コードは1行も書き換えていない。** 範囲で切り出して並べ替え、GAS URLだけ検証用に差し替えた。

## 元ファイルからの変更点
- GAS URL を検証用（AKfycbxJQZ...）に差し替え **2箇所**（core.js / ownermail.js）
- 本番URL（AKfycbzXof / AKfycbziyf）の残存 **0件**

## 構成
```
index.html              1,073行
css/base.css            1,939行
css/mobile-fix.css         46行
css/refine.css            407行
css/sidebar.css            50行   ← 左メニュー(新規)
js/firebase-config.js      31行
js/core.js              1,076行   同期・認証・GAS通信・設定・タブ切替
js/buildings.js         4,906行   物件管理・帳票
js/ownermail.js         1,332行   家賃明細送信 (window.RENT)
js/contracts.js         3,395行   契約カンバン (window.KB)
js/sidebar.js              54行   左メニュー(新規・IIFE)
```

## 読み込み順（変更禁止）
firebase-config → core → buildings → ownermail → contracts → sidebar
`defer` / `type="module"` は付けないこと。`</body>` 直前に置く。

## 検証済み
- 全JSが `node --check` を通過
- core + buildings 連結でも `const` 重複宣言なし

## 残作業：core → buildings の逆流 22行
renderAll / loadAll / STORAGE_KEY / showToast / saveAll /
onLayoutDrop / onPhotosDrop / runAutoSwitch / prefetchAllImages
→ イベント方式に置き換える

検証環境。本番は irelife.github.io/pivot
