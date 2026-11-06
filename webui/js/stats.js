// 統計（デバイス・メモリ・速度・累計・モデル）と、上部の接続状態チップ

import { $, store, escapeHtml } from "./util.js";
import { t, nf, locale } from "./i18n.js";
import { BACKEND, DEVICE_LABEL, START_CMD, STATS_URL } from "./config.js";

const HISTORY = 60;          // 使用率グラフに残す点の数（2 秒ごと → 2 分）
const utilHistory = [];
let lastRun = null;          // 直近の翻訳の timings
let deviceName = "";
let statusKey = "st_checking";
let isBusy = () => false;    // 翻訳中かどうか（translator.js から渡される）
let statsOpen = store.get("plamo.stats", "open") !== "closed";

const gb = (b) => (b / 1024 ** 3).toFixed(b >= 10 * 1024 ** 3 ? 1 : 2);
const pct = (a, b) => (b ? Math.min(100, (a / b) * 100) : 0);
const setBar = (id, p) => { $(id).style.width = `${Math.max(0, p)}%`; };
const prettyDevice = (n) => n.replace(/\(R\)/g, "®").replace(/\(TM\)/g, "™");

export const processLabel = () => (BACKEND === "npu" ? t("tr_server") : "llama-server");

function prettyModel(file) {
  const m = /plamo-?3(?:-translate)?-(\d+(?:\.\d+)?b)/i.exec(file || "");
  return m ? `PLaMo 3 Translate ${m[1].toUpperCase()}` : "";
}

export function setLastRun(timings) {
  lastRun = timings;
  $("gen-speed").textContent = timings.predicted_per_second.toFixed(1);
  $("prompt-speed").textContent = timings.prompt_per_second.toFixed(0);
}

function renderSpark() {
  const n = utilHistory.length;
  if (n < 2) return;
  const step = 100 / (HISTORY - 1);
  const x0 = 100 - (n - 1) * step;
  const p = utilHistory.map((v, i) => [x0 + i * step, 38 - (v / 100) * 36]);
  const line = "M" + p.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L");
  $("spark-line").setAttribute("d", line);
  $("spark-area").setAttribute("d", `${line} L${p[n - 1][0]},40 L${p[0][0]},40 Z`);
}

function setStatus(state, key) {
  statusKey = key;
  $("status").dataset.state = state;
  $("status-text").textContent = t(key);
  $("status").title = t(key);
  $("banner").classList.toggle("show", state === "offline");
}

export async function pollStats() {
  let s;
  try {
    const r = await fetch(STATS_URL, { cache: "no-store" });
    s = await r.json();
  } catch {
    setStatus("offline", "st_nostats");
    return;
  }
  const L = s.llama || {}, P = s.process || {}, S = s.system || {}, G = s.gpu || {};
  const M = L.metrics || {};

  if (L.loading) setStatus("checking", "st_loading");
  else if (!L.online) setStatus("offline", L.error ? "st_failed" : "st_offline");
  else if (isBusy() || M.requests_processing > 0) setStatus("busy", "st_busy");
  else setStatus("online", "st_online");

  // モデル名・デバイス名
  const name = G.name ? prettyDevice(G.name) : "";
  $("model-top").textContent = [prettyModel(L.model), name.replace(/\s*\(\d+GB\)$/, "")].filter(Boolean).join(" · ");
  if (name) {
    deviceName = name;
    $("gpu-name").textContent = name;
    const meta = [];
    if (G.device) meta.push(G.device);
    if (G.driver) meta.push(t("driver", { v: G.driver }));
    if (G.total) meta.push(t("alloc", { v: gb(G.total) }));
    $("gpu-meta").textContent = meta.join(" · ") || "—";
  }

  // デバイスのメモリ（共有 + 専用）
  if (P.gpu_shared != null) {
    const used = (P.gpu_shared || 0) + (P.gpu_dedicated || 0);
    const cap = G.total || S.total;
    $("gpu-mem").innerHTML = `${gb(used)}<small>GB</small>`;
    $("gpu-mem-sub").textContent = t("mem_sub", { s: gb(P.gpu_shared), d: gb(P.gpu_dedicated || 0), c: gb(cap), p: pct(used, cap).toFixed(0) });
    setBar("gpu-mem-bar", pct(used, cap));
  } else {
    $("gpu-mem").textContent = "—";
    $("gpu-mem-sub").textContent = L.online ? t("fetching") : "—";
    setBar("gpu-mem-bar", 0);
  }

  // デバイスの使用率
  if (P.gpu_util != null) {
    const u = Math.round(P.gpu_util);
    $("gpu-util").innerHTML = `${u}<small>%</small>`;
    utilHistory.push(u);
    if (utilHistory.length > HISTORY) utilHistory.shift();
    renderSpark();
  } else {
    $("gpu-util").textContent = "—";
  }

  // メモリ
  if (P.working_set != null) {
    $("proc-ws").textContent = `${gb(P.working_set)} GB`;
    setBar("proc-bar", pct(P.working_set, S.total));
  } else {
    $("proc-ws").textContent = "—";
    setBar("proc-bar", 0);
  }
  if (S.total) {
    $("sys-mem").textContent = `${gb(S.used)} / ${gb(S.total)} GB`;
    setBar("sys-bar", pct(S.used, S.total));
  }

  // 累計
  const num = (v) => (v != null ? nf.format(v) : "—");
  $("tot-prompt").textContent = num(M.prompt_tokens_total);
  $("tot-pred").textContent = num(M.tokens_predicted_total);
  $("req-proc").textContent = num(M.requests_processing);
  if (!lastRun && M.predicted_tokens_seconds > 0) {
    $("gen-speed").textContent = M.predicted_tokens_seconds.toFixed(1);
    $("prompt-speed").textContent = M.prompt_tokens_seconds.toFixed(0);
  }

  // モデル
  $("m-file").textContent = L.model || "—";
  $("m-ftype").textContent = L.ftype || "—";
  $("m-ctx").textContent = L.n_ctx ? `${nf.format(L.n_ctx)} tok` : "—";
  $("m-slots").textContent = L.slots ?? "—";

  $("updated").textContent = t("updated", { t: new Date().toLocaleTimeString(locale) });
}

// 統計の折りたたみ（閉じている間は更新時刻も隠す）
function renderCollapse() {
  const btn = $("stats-toggle");
  btn.setAttribute("aria-expanded", String(statsOpen));
  btn.title = t(statsOpen ? "stats_hide" : "stats_show");
  $("stats-body").classList.toggle("closed", !statsOpen);
  $("stats-body").inert = !statsOpen;
  $("updated").hidden = !statsOpen;
}

// 表示言語が変わったときに描き直す部分
export function renderStats() {
  for (const el of document.querySelectorAll(".dev-name")) el.textContent = DEVICE_LABEL;
  for (const el of document.querySelectorAll(".proc-name")) el.textContent = processLabel();
  $("banner-text").innerHTML = t(`banner_${BACKEND}`, { cmd: `<code>${escapeHtml(START_CMD)}</code>` });
  if (!deviceName) $("gpu-name").textContent = t("detecting");
  setStatus($("status").dataset.state, statusKey);
  renderCollapse();
}

export function initStats(opts = {}) {
  if (opts.isBusy) isBusy = opts.isBusy;
  $("stats-toggle").onclick = () => {
    statsOpen = !statsOpen;
    store.set("plamo.stats", statsOpen ? "open" : "closed");
    renderCollapse();
  };
  pollStats();
  setInterval(pollStats, 2000);
}
