/* BillTube Framework — feature:bulma-layer
   Loads/bridges Bulma and applies a theme layer (light | dark | auto).
   Dark mode is implemented here so Bulma renders dark surfaces everywhere.
*/
BTFW.define("feature:bulma-layer", [], async () => {
  const LS_KEY = "btfw:bulma:theme"; // "dark" | "light" | "auto"
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  let styleEl;

  // Bulma dark overrides (scoped; injected only when dark is active)
  const DARK_CSS = `
  html.btfw-dark, body.btfw-dark { background:#0f131a; color:#e8ecf6; }
  html.btfw-dark, html.btfw-dark body { color-scheme:dark; }

  html.btfw-dark .content, html.btfw-dark .title, html.btfw-dark .subtitle,
  html.btfw-dark p, html.btfw-dark small { color:#e8ecf6; }

  html.btfw-dark .box, html.btfw-dark .card, html.btfw-dark .modal-card,
  html.btfw-dark .dropdown-content, html.btfw-dark .menu, html.btfw-dark .panel,
  html.btfw-dark .notification {
    background:#121821; color:#e8ecf6; border:1px solid rgba(255,255,255,.08);
  }

  html.btfw-dark .tabs.is-boxed li a { background:transparent; border-color:transparent; color:#cfd7e6; }
  html.btfw-dark .tabs.is-boxed li.is-active a { background:#171d26; color:#fff; border-color:rgba(255,255,255,.15); }

  html.btfw-dark .input, html.btfw-dark .textarea, html.btfw-dark .select select {
    background:#0f141c; color:#e8ecf6; border-color:rgba(255,255,255,.14);
  }
  html.btfw-dark .input:focus, html.btfw-dark .textarea:focus, html.btfw-dark .select select:focus {
    border-color:#6d4df6; box-shadow:0 0 0 .125em rgba(109,77,246,.25);
  }

  html.btfw-dark .dropdown-item { color:#e8ecf6; }
  html.btfw-dark .dropdown-item:hover, html.btfw-dark .dropdown-item.is-active {
    background:rgba(255,255,255,.06); color:#fff;
  }

  html.btfw-dark .modal-background { background:rgba(0,0,0,.6); }
  html.btfw-dark .modal-card-head, html.btfw-dark .modal-card-foot {
    background:#121821; border-color:rgba(255,255,255,.08);
  }
  html.btfw-dark .modal-card-title { color:#fff; }

  html.btfw-dark .button { background:#1a2230; color:#e8ecf6; border:1px solid rgba(255,255,255,.10); }
  html.btfw-dark .button:hover { filter:brightness(1.08); }
  html.btfw-dark .button.is-link, html.btfw-dark .button.is-primary {
    background:linear-gradient(90deg,#6d4df6 0%,#9a63ff 100%); border:0; color:#fff;
  }

  /* Our surfaces */
  html.btfw-dark #main, html.btfw-dark .container-fluid,
  html.btfw-dark .well, html.btfw-dark .btfw-stack, html.btfw-dark .btfw-topbar {
    background:#0f131a; color:#e8ecf6;
  }

  html.btfw-dark .label{color:#cfd7e6;} html.btfw-dark .help{color:#a6b0c2;}
  html.btfw-dark #chatwrap, html.btfw-dark #messagebuffer { background:transparent; }
  `;

  function ensureStyle() {
    if (styleEl) return styleEl;
    styleEl = document.createElement("style");
    styleEl.id = "btfw-bulma-theme";
    document.head.appendChild(styleEl);
    return styleEl;
  }

  function setColorSchemeMeta(mode) {
    let meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "color-scheme");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", mode === "dark" ? "dark" : "light");
  }

  function compute(mode) {
    if (mode === "auto") {
      return (mq && mq.matches) ? "dark" : "light";
    }
    return mode || "dark";
  }

  function apply(mode) {
    const eff = compute(mode);
    const root = document.documentElement;
    root.classList.toggle("btfw-dark", eff === "dark");
    document.body && document.body.classList.toggle("btfw-dark", eff === "dark");
    setColorSchemeMeta(eff);
    ensureStyle().textContent = (eff === "dark") ? DARK_CSS : "";
  }

  function setTheme(mode) {
    try { localStorage.setItem(LS_KEY, mode); } catch(e){}
    apply(mode);
  }
  function getTheme() {
    try { return localStorage.getItem(LS_KEY) || "dark"; } catch(e){ return "dark"; }
  }
/* BTFW — feature:bulma-layer (dark/light switch + persistence) */
BTFW.define("feature:bulma-layer", [], async () => {
  const KEY = "btfw:theme:mode"; // "auto" | "dark" | "light"

  function readPref() {
    try { return localStorage.getItem(KEY) || "dark"; } catch (_) { return "dark"; }
  }
  function writePref(v) {
    try { localStorage.setItem(KEY, v); } catch (_) {}
  }

  function resolveAuto() {
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
      ? "dark" : "light";
  }

  function apply(mode) {
    const html = document.documentElement;
    const finalMode = (mode === "auto") ? resolveAuto() : mode;
    html.setAttribute("data-btfw-theme", finalMode);
    html.classList.toggle("btfw-theme-dark", finalMode === "dark");
  }

  function setTheme(mode) {
    const m = (mode === "auto" || mode === "dark" || mode === "light") ? mode : "dark";
    writePref(m);
    apply(m);
  }

  function getTheme() { return readPref(); }

  function boot() {
    apply(readPref());
    // if system scheme changes and we're in auto, reflect it
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener?.("change", () => {
        if (readPref() === "auto") apply("auto");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { name: "feature:bulma-layer", setTheme, getTheme };
});

  // react to OS theme if in auto
  if (mq && mq.addEventListener) {
    mq.addEventListener("change", () => { if (getTheme()==="auto") apply("auto"); });
  }

  // boot (default to dark if unset)
  apply(getTheme());

  return { name: "feature:bulma-layer", setTheme, getTheme, isDark: () => document.documentElement.classList.contains("btfw-dark") };
});
/* Compatibility alias so code that calls init("feature:bulma") keeps working */
BTFW.define("feature:bulma", ["feature:bulma-layer"], async ({}) => ({ name: "feature:bulma" }));
