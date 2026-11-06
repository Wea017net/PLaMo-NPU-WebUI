// ライト / ダークの切り替え（保存がなければ OS の設定に従う）

import { $, store } from "./util.js";
import { t } from "./i18n.js";

const darkMq = matchMedia("(prefers-color-scheme: dark)");

const isDark = () => {
  const theme = document.documentElement.dataset.theme;
  return theme ? theme === "dark" : darkMq.matches;
};

// ボタンには「今のテーマ」のアイコンを出し、ラベルは切り替え先を説明する
export function renderTheme() {
  const dark = isDark();
  const label = t(dark ? "to_light" : "to_dark");
  const btn = $("theme");
  btn.querySelector(".mi").textContent = dark ? "dark_mode" : "light_mode";
  btn.title = label;
  btn.setAttribute("aria-label", label);
}

export function initTheme() {
  $("theme").onclick = () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("plamo.theme", next);
    renderTheme();
  };
  darkMq.addEventListener("change", renderTheme);
}
