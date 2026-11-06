// エントリーポイント: 各部品を初期化し、表示言語が変わったら全体を描き直す

import { $, initRipple, initMenus, toggleMenu, closeMenus } from "./util.js";
import { t, ui, UI_LANGS, applyStatic, setUiLang, onUiLangChange } from "./i18n.js";
import { APP_VERSION, BACKEND, DEVICE_LABEL } from "./config.js";
import { initTheme, renderTheme } from "./theme.js";
import { initStats, renderStats, pollStats, setLastRun, processLabel } from "./stats.js";
import { initTranslator, renderTranslator, isTranslating } from "./translator.js";
import { initAbout, renderAbout } from "./about.js";

/* ---------------- snackbar ---------------- */
let snackTimer;
function snackbar(msg) {
  const s = $("snackbar");
  s.textContent = msg;
  s.classList.add("show");
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => s.classList.remove("show"), 2500);
}

/* ---------------- 表示言語メニュー ---------------- */
function buildUiMenu() {
  $("ui-menu").replaceChildren(...UI_LANGS.map(([code, name]) => {
    const it = document.createElement("button");
    it.className = "menu-item";
    it.setAttribute("role", "menuitemradio");
    it.setAttribute("aria-checked", String(code === ui));
    it.lang = code === "zh" ? "zh-CN" : code;     // 各言語の名前はその言語の書体で表示
    it.innerHTML = '<span class="mi">check</span><span></span>';
    it.lastChild.textContent = name;
    it.onclick = () => { closeMenus(); setUiLang(code); };
    return it;
  }));
}

function renderAll() {
  applyStatic({ dev: DEVICE_LABEL, proc: processLabel() });
  document.title = t("app") + (BACKEND === "npu" ? " (NPU)" : "");
  $("backend-tag").hidden = BACKEND !== "npu";
  renderTheme();
  renderTranslator();
  renderStats();
  if ($("about").open) renderAbout();
}

$("app-version").textContent = `v${APP_VERSION}`;
initRipple();
initMenus();
initTheme();
initAbout();
initTranslator({ onDone: pollStats, onTimings: setLastRun, snackbar });
initStats({ isBusy: isTranslating });

$("ui-lang").onclick = (e) => {
  e.stopPropagation();
  toggleMenu($("ui-menu"), $("ui-lang"), buildUiMenu);
};
onUiLangChange(() => { renderAll(); pollStats(); });

renderAll();
