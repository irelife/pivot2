/* ==================================================================
 * Firebase 接続情報
 * ================================================================== */

// PIVOT の Firebase 接続情報(公開前提の情報。秘密ではない)
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyBQw442ppH7s_UWxK5cB0AFdojG_A3hjMs",
  authDomain: "pivot-3e851.firebaseapp.com",
  projectId: "pivot-3e851",
  storageBucket: "pivot-3e851.firebasestorage.app",
  messagingSenderId: "330414645523",
  appId: "1:330414645523:web:28aac914593105b179fae6"
};
// Firebase 初期化(SDKが読み込めていれば実行)
var _firebaseReady = false;
try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    firebase.initializeApp(FIREBASE_CONFIG);
    _firebaseReady = true;
    // ログイン維持: ブラウザを閉じても保持(次回から自動ログイン)。ログアウトで解除。
    try{
      if(firebase.auth && firebase.auth.Auth && firebase.auth.Auth.Persistence){
        // LOCAL＝ブラウザを閉じても保持。SESSION だとタブを閉じるたびに再ログインになる。
        // 「1時間操作なし／日付が変わったら再ログイン」の制限は isSessionExpired() 側で効いている。
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      }
    }catch(e){ console.warn('persistence設定に失敗:', e); }
  }
} catch (e) {
  console.error('Firebase初期化に失敗:', e);
}
