// サーバー停止ボタン（上部バー）と確認ダイアログ
// npu_server.py の POST /api/shutdown を呼ぶ。llama-server（BACKEND = "gpu"）にはこの API がないので出さない。

import { $, escapeHtml } from "./util.js";
import { t } from "./i18n.js";
import { API_BASE, BACKEND, START_CMD } from "./config.js";

let hooks = { onStopped() {}, snackbar() {} };

export function renderPower() {
  $("stop-body").innerHTML = t("stop_body", { cmd: `<code>${escapeHtml(START_CMD)}</code>` });
}

async function stopServer() {
  const ok = $("stop-ok");
  ok.disabled = true;
  try {
    const res = await fetch(API_BASE + "/api/shutdown", {
      method: "POST",
      headers: { "X-PLaMo-Action": "shutdown" },   // サーバー側で確認する（他サイトからの要求を防ぐ）
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    $("stop-dialog").close();
    hooks.onStopped();
    hooks.snackbar(t("stopped"));
  } catch {
    $("stop-dialog").close();
    hooks.snackbar(t("stop_failed"));
  } finally {
    ok.disabled = false;
  }
}

export function initPower(opts = {}) {
  hooks = { ...hooks, ...opts };
  if (BACKEND !== "npu") return;
  const dlg = $("stop-dialog");
  $("power").hidden = false;
  $("power").onclick = () => { renderPower(); dlg.showModal(); $("stop-cancel").focus(); };
  $("stop-cancel").onclick = () => dlg.close();
  $("stop-ok").onclick = stopServer;
}
