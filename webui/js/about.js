// 「ライセンスと注意事項」ダイアログ
// 外部へのリンクはクリックしたときだけ開く（ページの表示に外部通信は使わない）。

import { $, escapeHtml } from "./util.js";
import { t } from "./i18n.js";

const PLAMO_LICENSE = "https://plamo.preferredai.jp/info/plamo-community-license-en";
const PLAMO_MODEL = "https://huggingface.co/pfnet/plamo-3-translate-2b";

// [名前, ライセンス, 著作権者, 補足（i18n キー）, リンク]
const COMPONENTS = [
  ["PLaMo NPU WebUI", "Apache License 2.0", "Wea017net", "lic_app", null],
  ["PLaMo 3 Translate 2B (pfnet/plamo-3-translate-2b)", "PLaMo Community License", "Preferred Networks, Inc.", "lic_model", PLAMO_LICENSE],
  ["Material Symbols", "Apache License 2.0", "Google LLC", "lic_bundled", "assets/fonts/LICENSE-MaterialSymbols.txt"],
  ["Noto Sans / Noto Sans JP / SC / KR", "SIL Open Font License 1.1", "Google LLC", "lic_system", null],
  ["OpenVINO™ / OpenVINO GenAI / NNCF / Optimum Intel", "Apache License 2.0", "Intel Corporation", "lic_runtime", null],
  ["Hugging Face Transformers", "Apache License 2.0", "The Hugging Face Team", "lic_runtime", null],
  ["PyTorch", "BSD-3-Clause", "Meta Platforms, Inc. and affiliates", "lic_runtime", null],
];

const link = (href, text) => {
  const external = /^https?:/.test(href);
  return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ' target="_blank"'}>${escapeHtml(text)}</a>`;
};

export function renderAbout() {
  const notices = [t("unofficial"), t("mt_notice"), t("notice_output"), t("notice_decision"), t("notice_commercial")];
  const comps = COMPONENTS.map(([name, lic, owner, note, href]) => `
    <h3>${escapeHtml(name)}</h3>
    <p>${escapeHtml(lic)}${href ? ` · ${link(href, t("full_text"))}` : ""} — © ${escapeHtml(owner)}</p>
    <p>${escapeHtml(t(note))}</p>`).join("");
  $("about-body").innerHTML = `
    <div class="notice">
      <p><strong>Built with PLaMo</strong> · ${link(PLAMO_MODEL, "pfnet/plamo-3-translate-2b")}</p>
      <ul>${notices.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
    </div>
    <h3 style="margin-top:20px;font-size:16px">${escapeHtml(t("components"))}</h3>
    ${comps}`;
}

export function initAbout() {
  const dlg = $("about");
  $("about-btn").onclick = () => { renderAbout(); dlg.showModal(); };
  $("about-close").onclick = () => dlg.close();
  // ダイアログの外側（背景）をクリックしたら閉じる
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
}
