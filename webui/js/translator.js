// 翻訳カード: 言語タブ・入力欄・即時翻訳スイッチ・ストリーミング翻訳

import { $, store, closeMenus, toggleMenu } from "./util.js";
import { t, nf, locale, langName, LANG_CODES, isLangCode, htmlLang, RTL_LANGS } from "./i18n.js";
import { API_BASE, BACKEND } from "./config.js";

const AUTO = "auto";
const RECENT_N = 3;                      // タブに出す最近使った言語の数
const TAB_EXCLUDE = new Set(["zh-hans", "zh-hant"]);   // 上部のタブには出さない（▼ の全一覧からは選べる）
const KBD = "<kbd>Ctrl</kbd> + <kbd>Enter</kbd>";
// 日本語訳の文体（PLaMo の form 引数。auto は指定しない＝モデル任せ）
const FORMS = ["auto", "polite", "plain"];

// 以前の版で保存した "zh" は簡体字として読み替える
const migrate = (code) => (code === "zh" ? "zh-hans" : code);
let srcLang = migrate(store.get("plamo.src", AUTO));
let dstLang = migrate(store.get("plamo.target", "ja"));
if (srcLang !== AUTO && !isLangCode(srcLang)) srcLang = AUTO;
if (!isLangCode(dstLang)) dstLang = "ja";
let form = store.get("plamo.form", "auto");
if (!FORMS.includes(form)) form = "auto";

let instant = store.get("plamo.instant", "1") === "1";
let controller = null;       // 実行中の翻訳（AbortController）
let timer = null;
let lastKey = "";            // 同じ内容を二重に訳さないためのキー
let lastChips = null;        // 表示言語の切り替え時に描き直すため、所要時間とトークン数を残す
let hooks = { onDone() {}, onTimings() {} };

export const isTranslating = () => controller !== null;

/* ---------------- 言語タブ ---------------- */
const loadRecent = (key, fallback) => {
  try {
    const v = JSON.parse(store.get(key, ""));
    if (Array.isArray(v)) {
      const list = v.filter((c) => isLangCode(c) && !TAB_EXCLUDE.has(c)).slice(0, RECENT_N);
      if (list.length) return list;
    }
  } catch { /* 壊れた値は無視 */ }
  return fallback;
};
// 翻訳元・翻訳先とも「日本語 → 英語」の並び
const recent = {
  src: loadRecent("plamo.tabs.src", ["ja", "en"]),
  dst: loadRecent("plamo.tabs.dst", ["ja", "en"]),
};

function promote(side, code) {
  if (code === AUTO || TAB_EXCLUDE.has(code)) return;
  const list = recent[side];
  if (!list.includes(code)) {
    list.unshift(code);
    list.length = Math.min(list.length, RECENT_N);
    store.set(`plamo.tabs.${side}`, JSON.stringify(list));
  }
}

// 翻訳元と翻訳先が同じ言語になったら、もう片方を自動で変える（日本語なら英語、それ以外なら日本語）
const otherFor = (code) => (code === "ja" ? "en" : "ja");
function resolveConflict(changed) {
  if (srcLang === AUTO || srcLang !== dstLang) return;
  if (changed === "src") dstLang = otherFor(srcLang);
  else srcLang = otherFor(dstLang);
}
function saveLangs() {
  store.set("plamo.src", srcLang);
  store.set("plamo.target", dstLang);
}

function setLang(side, code) {
  if (side === "src") srcLang = code; else dstLang = code;
  resolveConflict(side);
  saveLangs();
  promote(side, code);
  closeMenus();
  renderTabs();
  if (instant) scheduleTranslate(0);
}

const label = (code) => (code === AUTO ? t("detect") : langName(code));

function menuItem(code, current, side) {
  const it = document.createElement("button");
  it.className = "menu-item";
  it.setAttribute("role", "menuitemradio");
  it.setAttribute("aria-checked", String(code === current));
  it.innerHTML = '<span class="mi">check</span><span></span>';
  it.lastChild.textContent = label(code);
  it.onclick = () => setLang(side, code);
  return it;
}

function buildSide(side) {
  const current = side === "src" ? srcLang : dstLang;
  const items = (side === "src" ? [AUTO] : []).concat(recent[side]);
  // タブに出さない言語（中国語）を選んでいるときだけ、選択中だと分かるよう一時的に表示する
  if (current !== AUTO && !items.includes(current)) items.push(current);

  const tabs = items.map((code) => {
    const b = document.createElement("button");
    b.className = "tab";
    b.setAttribute("role", "tab");
    b.textContent = label(code);
    b.setAttribute("aria-selected", String(code === current));
    b.onclick = () => setLang(side, code);
    return b;
  });
  const menu = $(`${side}-menu`);
  const more = document.createElement("button");
  more.className = "tab more";
  more.title = t("all_langs");
  more.setAttribute("aria-label", t("all_langs"));
  more.setAttribute("aria-haspopup", "menu");
  more.setAttribute("aria-expanded", "false");
  more.innerHTML = '<span class="mi">expand_more</span>';
  more.onclick = (e) => { e.stopPropagation(); toggleMenu(menu, more); };
  $(`${side}-tabs`).replaceChildren(...tabs, more);

  const all = (side === "src" ? [AUTO] : []).concat(LANG_CODES);
  menu.replaceChildren(...all.map((code) => menuItem(code, current, side)));
}

function renderTabs() {
  promote("src", srcLang);
  promote("dst", dstLang);
  buildSide("src");
  buildSide("dst");
  $("swap").disabled = srcLang === AUTO || srcLang === dstLang;
  // 入力欄は翻訳元の言語の書体・書字方向で表示する（自動検出なら表示言語の書体で、方向は内容から判断）
  const src = $("src");
  if (srcLang === AUTO) { src.removeAttribute("lang"); src.dir = "auto"; }
  else { src.lang = htmlLang(srcLang); src.dir = RTL_LANGS.has(srcLang) ? "rtl" : "ltr"; }
  renderForm();
}

/* ---------------- 文体（日本語訳のみ） ---------------- */
function renderForm() {
  const wrap = $("form-select");
  wrap.hidden = dstLang !== "ja";
  const btn = $("form-btn");
  const value = t("form_btn", { v: t(`form_${form}`) });
  btn.querySelector(".form-value").textContent = value;
  btn.title = t("form_title");
  btn.setAttribute("aria-label", `${t("form_title")} – ${value}`);
  $("form-menu").replaceChildren(...FORMS.map((f) => {
    const it = document.createElement("button");
    it.className = "menu-item";
    it.setAttribute("role", "menuitemradio");
    it.setAttribute("aria-checked", String(f === form));
    it.innerHTML = '<span class="mi">check</span><span></span>';
    it.lastChild.textContent = t(`form_${f}_full`);
    it.onclick = () => setForm(f);
    return it;
  }));
}

function setForm(f) {
  form = f;
  store.set("plamo.form", f);
  closeMenus();
  renderForm();
  if (instant) scheduleTranslate(0);
}

function swap() {
  if (srcLang === AUTO) return;
  [srcLang, dstLang] = [dstLang, srcLang];
  saveLangs();
  const out = $("out");
  const translated = out.classList.contains("result") ? out.textContent : "";
  const original = $("src").value.trim();
  if (translated) { $("src").value = translated; onSourceChanged(false); }
  renderTabs();
  if (instant) scheduleTranslate(0);
  else if (translated) {           // 即時翻訳オフ: 入れ替え前の原文を訳文側に出しておく
    controller?.abort();
    lastKey = "";
    showResult(original);
    lastChips = null;
    $("chips").replaceChildren();
  }
}

/* ---------------- 入力欄 ---------------- */
function renderCounter() {
  $("counter").textContent = t("chars", { n: nf.format($("src").value.length) });
}

function onSourceChanged(schedule = true) {
  const src = $("src");
  renderCounter();
  $("clear").style.visibility = src.value ? "visible" : "hidden";
  store.set("plamo.draft", src.value);
  $("go").disabled = !src.value.trim();
  if (!schedule) return;
  if (instant) scheduleTranslate(700);
  else if (!src.value.trim()) scheduleTranslate(0);   // 空にしたら訳文も消す
}

/* ---------------- 即時翻訳スイッチ ---------------- */
function renderInstant() {
  $("instant").setAttribute("aria-checked", String(instant));
  $("go").hidden = instant;
  $("hint").innerHTML = t(instant ? "hint_on" : "hint_off", { k: KBD });
}

/* ---------------- 訳文の表示 ---------------- */
function setPlaceholder() {
  const out = $("out");
  out.className = "output placeholder";
  out.removeAttribute("lang");
  out.removeAttribute("dir");
  out.textContent = t("out_ph");
  lastChips = null;
  $("chips").replaceChildren();
  $("copy").disabled = true;
}

// 訳文は翻訳先の言語の書体で表示する
function showResult(text) {
  const out = $("out");
  out.className = "output result";
  out.lang = htmlLang(dstLang);
  out.dir = RTL_LANGS.has(dstLang) ? "rtl" : "ltr";
  out.textContent = text;
}

function chip(icon, text) {
  const el = document.createElement("span");
  el.className = "chip";
  const i = document.createElement("span");
  i.className = "mi";
  i.textContent = icon;
  el.append(i, text);
  return el;
}

function renderChips() {
  if (!lastChips) return;
  const { sec, timings } = lastChips;
  const secText = sec.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const chips = [chip("timer", t("sec", { n: secText }))];
  if (timings) {
    chips.push(chip("input", `${nf.format(timings.prompt_n)} tok`));
    chips.push(chip("output", `${nf.format(timings.predicted_n)} tok`));
    chips.push(chip("bolt", `${timings.predicted_per_second.toFixed(1)} tok/s`));
  }
  $("chips").replaceChildren(...chips);
}

/* ---------------- 翻訳（OpenAI 互換 API・ストリーミング） ---------------- */
function scheduleTranslate(delay) {
  clearTimeout(timer);
  timer = setTimeout(translate, delay);
}

async function translate() {
  const text = $("src").value.trim();
  const useForm = dstLang === "ja" && form !== "auto";   // form は翻訳先が日本語のときだけ有効
  const key = `${srcLang}|${dstLang}|${useForm ? form : ""}|${text}`;
  if (!text) {
    controller?.abort();
    lastKey = "";
    setPlaceholder();
    return;
  }
  if (key === lastKey) return;   // 同じ内容（翻訳中を含む）は再翻訳しない
  controller?.abort();
  lastKey = key;

  const ctrl = new AbortController();
  controller = ctrl;
  const out = $("out");
  let received = "";
  let timings = null;
  $("progress").classList.add("show");
  $("copy").disabled = true;
  const t0 = performance.now();

  const kwargs = { target_lang: dstLang };
  if (srcLang !== AUTO) kwargs.source_lang = srcLang;
  if (useForm) kwargs.form = form;

  try {
    const res = await fetch(API_BASE + "/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: "plamo-3-translate",
        messages: [{ role: "user", content: text }],
        chat_template_kwargs: kwargs,
        stop: ["<|plamo:tag|>", "<|plamo:bos|>"],
        temperature: 0,
        stream: true,
      }),
    });
    if (!res.ok) {
      let msg = await res.text();
      try { msg = JSON.parse(msg).error.message; } catch { /* JSON でなければそのまま */ }
      throw new Error(msg || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        const j = JSON.parse(data);
        if (j.timings) timings = j.timings;
        const delta = j.choices?.[0]?.delta?.content;
        if (delta) {
          received += delta;
          showResult(received.trimStart());
        }
      }
    }
    if (controller !== ctrl) return;
    showResult(received.trim());
    $("copy").disabled = !received.trim();
    lastChips = { sec: (performance.now() - t0) / 1000, timings };
    renderChips();
    if (timings) hooks.onTimings(timings);
  } catch (e) {
    if (e.name === "AbortError") return;          // 新しい入力で置き換えられた
    if (controller !== ctrl) return;
    lastKey = "";
    lastChips = null;
    $("chips").replaceChildren();
    out.className = "output error";
    out.removeAttribute("lang");
    out.removeAttribute("dir");
    out.textContent = t("error") + e.message + "\n" + t(`err_${BACKEND}`);
  } finally {
    if (controller === ctrl) {
      controller = null;
      $("progress").classList.remove("show");
      hooks.onDone();
    }
  }
}

/* ---------------- 初期化・再描画 ---------------- */
export function renderTranslator() {
  renderTabs();
  renderInstant();
  renderCounter();
  renderChips();
  if ($("out").classList.contains("placeholder")) $("out").textContent = t("out_ph");
}

export function initTranslator(opts = {}) {
  hooks = { ...hooks, ...opts };
  const src = $("src");
  src.value = store.get("plamo.draft", "");

  resolveConflict("src");
  saveLangs();
  setPlaceholder();

  src.addEventListener("input", () => onSourceChanged());
  src.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); scheduleTranslate(0); }
  });
  $("clear").onclick = () => { src.value = ""; onSourceChanged(); src.focus(); };
  $("go").onclick = () => scheduleTranslate(0);
  $("swap").onclick = swap;
  $("form-btn").onclick = (e) => { e.stopPropagation(); toggleMenu($("form-menu"), $("form-btn")); };
  $("instant").onclick = () => {
    instant = !instant;
    store.set("plamo.instant", instant ? "1" : "0");
    renderInstant();
    if (instant) scheduleTranslate(0);   // オンにしたら今の入力をすぐ訳す
  };
  $("copy").onclick = async () => {
    try { await navigator.clipboard.writeText($("out").textContent); hooks.snackbar?.(t("copied")); }
    catch { hooks.snackbar?.(t("copy_failed")); }
  };

  onSourceChanged(false);
  if (src.value.trim()) scheduleTranslate(300);
}
