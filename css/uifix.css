/* ============================================================
   こまかい直し  uifix 2026-08-31a
   ・これから先の「ちょっとした見た目の直し」は、この1枚に足していきます。
   ・元に戻すときは index.html のこの1行を消すだけです。
   ============================================================ */

/* ------------------------------------------------------------
   ① オーナーメール「別管理」の見出しが、スマホで縦に折れる
      　森本  →  森本
      　将行      将行
      名前・バッジ・「閲覧のみ」を、それぞれ1行に収めます。
   ------------------------------------------------------------ */
@media (max-width:760px){
  #rent-view .pv-head{
    flex-wrap:wrap;
    row-gap:8px;
    column-gap:8px;
  }
  /* 名前は1行め全部を使います。長ければ … で切ります */
  #rent-view .pv-head .nm{
    flex:1 1 100%;
    min-width:0;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  /* バッジ・状態・ボタンは、縦に折らずに横のまま */
  #rent-view .pv-head .pill,
  #rent-view .pv-head .vac,
  #rent-view .pv-head .mail,
  #rent-view .pv-head button{
    flex:0 0 auto;
    white-space:nowrap;
  }
  #rent-view .pv-head .spacer{ flex:1 1 auto; }
  #rent-view .pv-head button{ margin-left:0 !important; }
}

/* ------------------------------------------------------------
   ② 「ほか ◯件（押すと全部出ます）」を、押せるように見せます
      （実際に押したときの動きは js/uifix.js が付けます）
   ------------------------------------------------------------ */
.sw-more{
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
  -webkit-user-select:none; user-select:none;
}
.sw-more:hover{ color:#3d3d42; background:rgba(0,0,0,.03); }
.sw-more:active{ background:rgba(0,0,0,.06); }

/* ------------------------------------------------------------
   ③ 契約の一覧表（リスト表示）の角を丸くします
   ------------------------------------------------------------ */
#kb-view .lv-wrap{
  border-radius:18px;
  overflow:hidden;
}
@media (max-width:760px){
  #kb-view .lv-wrap{ border-radius:16px; }
}


/* ------------------------------------------------------------
   ④ 区画を見るとき、上の配置図を「区画の並び」に寄せて大きく出す
      ・シートを下にスクロールし始めたら、貼りついている配置図を
        いっぱいに広げて、区画の番号が並んでいる所を映します。
        （どこに並んでいるかは js/uifix.js が画像から探します）
      ・いちばん上まで戻すと、元の「全体が入る」表示に戻ります。
      ・指でつまんで大きくしているときは、じゃましません。
   ------------------------------------------------------------ */
#pv-pin.ims-zoom .pv-pin-view img{
  object-fit:cover !important;
  /* どこを映すかは js/uifix.js が決めます（object-position を直接入れます） */
  /* 大きくしている間は、指の動きを画像のほうで受け取ります（上下左右に動かせます）。
     いちばん上の端で下へ払うと、元の全体表示にもどります。 */
  touch-action:none !important;
}
#pv-pin .pv-pin-view img{ transition:none; }
