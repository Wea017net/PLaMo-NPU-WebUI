// 共通の小さなヘルパー

export const $ = (id) => document.getElementById(id);

// localStorage はプライベートモードなどで使えないことがあるので、失敗しても動くようにする
export const store = {
  get(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* 保存できなくても動作は続ける */ }
  },
};

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ボタン類のリップル（Material 2）
export function initRipple() {
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".ripple, .tab");
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const w = document.createElement("span");
    w.className = "ripple-wave";
    w.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.style.overflow = "hidden";
    el.appendChild(w);
    w.addEventListener("animationend", () => w.remove());
  });
}

// 開いているメニュー（言語選択・表示言語）をすべて閉じる
export function closeMenus() {
  for (const m of document.querySelectorAll(".menu")) m.hidden = true;
  for (const b of document.querySelectorAll("[aria-haspopup='menu']")) b.setAttribute("aria-expanded", "false");
}

export function initMenus() {
  document.addEventListener("click", (e) => { if (!e.target.closest(".menu")) closeMenus(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenus(); });
}

// メニューを開閉する（ボタンのクリックで呼ぶ）
export function toggleMenu(menu, button, onOpen) {
  const open = menu.hidden;
  closeMenus();
  if (!open) return;
  onOpen?.();
  menu.hidden = false;
  button.setAttribute("aria-expanded", "true");
  menu.querySelector('[aria-checked="true"]')?.focus();
}
