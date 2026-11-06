// 描画前に保存済みのテーマと表示言語を反映する（ちらつき・フォントの切り替わり防止）。
// モジュールより先に <head> で同期的に読み込む。表示言語の決め方は i18n.js の pickUiLang と同じ。
(function () {
  var SUPPORTED = ["ja", "en", "zh", "ko", "fr", "de", "es"];
  var root = document.documentElement;
  try {
    var theme = localStorage.getItem("plamo.theme");
    if (theme === "light" || theme === "dark") root.dataset.theme = theme;
  } catch (e) { /* localStorage が使えない環境では既定のまま */ }
  var ui = null;
  try { ui = localStorage.getItem("plamo.ui"); } catch (e) { /* 同上 */ }
  if (SUPPORTED.indexOf(ui) < 0) {
    ui = "en";
    var langs = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) {
      var c = String(langs[i]).toLowerCase().split("-")[0];
      if (SUPPORTED.indexOf(c) >= 0) { ui = c; break; }
    }
  }
  root.lang = ui === "zh" ? "zh-CN" : ui;
})();
