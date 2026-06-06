/* BTFW — feature:bulma-layer (dark/light/auto + Bulma dark overrides + Bootstrap modal bridge) */
BTFW.define("feature:bulma-layer", [], async () => {
  // Persisted preference (kept for Theme Settings compatibility)
  const KEY = "btfw:theme:mode";                     // "auto" | "dark" | "light"
  const KEY_OLD = "btfw:bulma:theme";                // legacy key support
  const mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");

  // Single style injector for all dark-scope rules
  let styleEl;
  function ensureStyle() {
    if (styleEl) return styleEl;
    styleEl = document.createElement("style");
    styleEl.id = "btfw-bulma-dark-bridge";
    document.head.appendChild(styleEl);
    return styleEl;
  }

  // Dark theme CSS (Bulma surfaces + Bootstrap/CyTube modal bridge), scoped to data-btfw-theme="dark"
  const DARK_CSS = `
/* --- Global dark scope --- */
html[data-btfw-theme="dark"] { color-scheme: dark; }
html[data-btfw-theme="dark"], html[data-btfw-theme="dark"] body {
  background: var(--btfw-color-bg);
  color: var(--btfw-color-text);
}
html[data-btfw-theme="dark"] body {
  background-image: none;
}

/* Text/surfaces (Bulma) */
html[data-btfw-theme="dark"] .content,
html[data-btfw-theme="dark"] .title,
html[data-btfw-theme="dark"] .subtitle,
html[data-btfw-theme="dark"] p,
html[data-btfw-theme="dark"] small {
  color: var(--btfw-color-text);
}

html[data-btfw-theme="dark"] .box,
html[data-btfw-theme="dark"] .card,
html[data-btfw-theme="dark"] .panel,
html[data-btfw-theme="dark"] .menu,
html[data-btfw-theme="dark"] .notification,
html[data-btfw-theme="dark"] .dropdown-content,
html[data-btfw-theme="dark"] .modal-card {
  background: color-mix(in srgb, var(--btfw-color-surface) 92%, transparent 8%) !important;
  color: var(--btfw-color-text) !important;
  border: 1px solid var(--btfw-border) !important;
  box-shadow: 0 18px 42px color-mix(in srgb, var(--btfw-color-bg) 55%, transparent 45%);
}

html[data-btfw-theme="dark"] .tabs.is-boxed li a { background:transparent; border-color:transparent; color:#c8d4e0; }
html[data-btfw-theme="dark"] .tabs.is-boxed li.is-active a {
  background: color-mix(in srgb, var(--btfw-color-panel) 82%, transparent 18%);
  color: var(--btfw-color-text);
  border-color: var(--btfw-border);
}

/* Inputs */
html[data-btfw-theme="dark"] .input,
html[data-btfw-theme="dark"] .textarea,
html[data-btfw-theme="dark"] .select select {
  background: color-mix(in srgb, var(--btfw-color-panel) 94%, transparent 6%) !important;
  color: var(--btfw-color-text) !important;
  border-color: color-mix(in srgb, var(--btfw-border) 80%, transparent 20%) !important;
}
html[data-btfw-theme="dark"] .input::placeholder,
html[data-btfw-theme="dark"] .textarea::placeholder {
  color: color-mix(in srgb, var(--btfw-color-text) 55%, transparent 45%) !important;
}

/* Buttons */
html[data-btfw-theme="dark"] .button,
html[data-btfw-theme="dark"] .btn {
  background: color-mix(in srgb, var(--btfw-color-panel) 88%, transparent 12%);
  color: var(--btfw-color-text);
  border: 1px solid color-mix(in srgb, var(--btfw-border) 70%, transparent 30%);
}
html[data-btfw-theme="dark"] .button:hover,
html[data-btfw-theme="dark"] .btn:hover {
  filter: brightness(1.05);
}
html[data-btfw-theme="dark"] .button.is-link,
html[data-btfw-theme="dark"] .button.is-primary {
  background: color-mix(in srgb, var(--btfw-color-accent) 82%, transparent 18%) !important;
  border-color: color-mix(in srgb, var(--btfw-color-accent) 68%, transparent 32%) !important;
  color: var(--btfw-color-on-accent) !important;
}

/* Chat/stack surfaces you themed */
html[data-btfw-theme="dark"] #chatwrap,
html[data-btfw-theme="dark"] #messagebuffer { background:transparent; }

/* --- Bulma modal dark --- */
html[data-btfw-theme="dark"] .modal { z-index: 6000 !important; }
html[data-btfw-theme="dark"] .modal .modal-background { background-color: color-mix(in srgb, var(--btfw-color-bg) 88%, transparent 12%) !important; }
html[data-btfw-theme="dark"] .modal-card-head,
html[data-btfw-theme="dark"] .modal-card-foot {
  background-color: color-mix(in srgb, var(--btfw-color-panel) 92%, transparent 8%) !important;
  border-color: var(--btfw-border) !important;
  color: var(--btfw-color-text) !important;
}
html[data-btfw-theme="dark"] .modal-card {
  background-color: color-mix(in srgb, var(--btfw-color-surface) 94%, transparent 6%) !important;
  color: var(--btfw-color-text) !important;
}
html[data-btfw-theme="dark"] .modal-card-title { color: var(--btfw-color-text) !important; }

/* --- Bootstrap/CyTube modal bridge (skin Bootstrap modals to match Bulma dark) --- */
html[data-btfw-theme="dark"] .modal.fade,
html[data-btfw-theme="dark"] .modal.in,
html[data-btfw-theme="dark"] .modal { z-index: 6000 !important; }
html[data-btfw-theme="dark"] .modal-backdrop {
  background-color: color-mix(in srgb, var(--btfw-color-bg) 88%, transparent 12%) !important; z-index: 0 !important;
}
html[data-btfw-theme="dark"] .modal-dialog { max-width: 880px; }
html[data-btfw-theme="dark"] .modal-content {
  background-color: color-mix(in srgb, var(--btfw-color-surface) 94%, transparent 6%) !important;
  color: var(--btfw-color-text) !important;
  border:1px solid var(--btfw-border) !important;
}
@media screen and (min-width: 769px) {
  .modal-card, .modal-content {
    width: auto;
    max-width: 55rem;
  }
}
html[data-btfw-theme="dark"] .modal-header,
html[data-btfw-theme="dark"] .modal-footer {
  background-color: color-mix(in srgb, var(--btfw-color-panel) 92%, transparent 8%) !important;
  border-color: var(--btfw-border) !important;
  color: var(--btfw-color-text) !important;
}
html[data-btfw-theme="dark"] .modal-title { color: var(--btfw-color-text) !important; }
html[data-btfw-theme="dark"] .modal .btn-primary {
  background: color-mix(in srgb, var(--btfw-color-accent) 82%, transparent 18%) !important;
  border-color: color-mix(in srgb, var(--btfw-color-accent) 68%, transparent 32%) !important;
  color: var(--btfw-color-on-accent) !important;
}
html[data-btfw-theme="dark"] .modal .btn-default {
  background: color-mix(in srgb, var(--btfw-color-panel) 88%, transparent 12%) !important;
  border-color: color-mix(in srgb, var(--btfw-border) 70%, transparent 30%) !important;
  color: var(--btfw-color-text) !important;
}
/* Scroll lock (Bootstrap) */
body.modal-open { overflow: hidden; }

/* ===================================================================
   Bulma neutralizing layer
   Bulma 0.9.x is Sass-compiled with hard-coded light-theme colours (blue
   links/arrows/focus rings, grey native controls). Wherever a component
   isn't explicitly re-themed, those defaults leak through. The rules below
   redirect Bulma's common surfaces to our theme tokens so new Bulma markup
   inherits the theme instead of fighting it. Scoped to the dark theme; the
   per-component modal overrides still win via higher specificity.
   =================================================================== */

/* Select dropdowns — themed arrow + control everywhere (not just the modal). */
html[data-btfw-theme="dark"] .select:not(.is-multiple):not(.is-loading)::after{
  border-color: var(--btfw-color-accent) !important;
}
html[data-btfw-theme="dark"] .select select{
  background: color-mix(in srgb, var(--btfw-color-panel) 88%, transparent 12%) !important;
  color: var(--btfw-color-text) !important;
  border-color: color-mix(in srgb, var(--btfw-border) 70%, transparent 30%) !important;
}
html[data-btfw-theme="dark"] .select select option{
  background: var(--btfw-color-surface);
  color: var(--btfw-color-text);
}

/* Focus rings — replace Bulma's blue glow with the theme accent. */
html[data-btfw-theme="dark"] .input:focus,
html[data-btfw-theme="dark"] .input.is-focused,
html[data-btfw-theme="dark"] .textarea:focus,
html[data-btfw-theme="dark"] .select select:focus,
html[data-btfw-theme="dark"] .button:focus,
html[data-btfw-theme="dark"] .button.is-focused{
  border-color: color-mix(in srgb, var(--btfw-color-accent) 55%, transparent 45%) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--btfw-color-accent) 22%, transparent 78%) !important;
  outline: none !important;
}

/* Range inputs + native checkboxes/radios — theme the native accent so they
   aren't grey/blue OS defaults. (The Theme Settings modal fully custom-styles
   its checkboxes; this covers everything else, e.g. CyTube's own options.) */
html[data-btfw-theme="dark"] input[type="range"],
html[data-btfw-theme="dark"] input[type="checkbox"],
html[data-btfw-theme="dark"] input[type="radio"]{ accent-color: var(--btfw-color-accent); }

/* Tabs (non-boxed) — Bulma colours hover/active blue with a blue underline. */
html[data-btfw-theme="dark"] .tabs a{
  border-bottom-color: transparent;
  color: color-mix(in srgb, var(--btfw-color-text) 78%, transparent 22%);
}
html[data-btfw-theme="dark"] .tabs a:hover{
  border-bottom-color: color-mix(in srgb, var(--btfw-color-accent) 60%, transparent 40%);
  color: var(--btfw-color-text);
}
html[data-btfw-theme="dark"] .tabs li.is-active a{
  border-bottom-color: var(--btfw-color-accent);
  color: var(--btfw-color-accent);
}

/* Tags — neutral grey-blue tags inherit the panel surface. */
html[data-btfw-theme="dark"] .tag:not(.is-primary):not(.is-link):not(.is-info):not(.is-success):not(.is-warning):not(.is-danger){
  background: color-mix(in srgb, var(--btfw-color-panel) 86%, transparent 14%);
  color: var(--btfw-color-text);
}

/* Checkbox / radio hover (Bulma turns the label blue). */
html[data-btfw-theme="dark"] .checkbox:hover,
html[data-btfw-theme="dark"] .radio:hover{ color: var(--btfw-color-text); }

/* Inline links inside themed surfaces — kept scoped (not a global 'a') so chat
   usernames / message links keep their own colours. */
html[data-btfw-theme="dark"] .modal a:not(.button):not(.tag),
html[data-btfw-theme="dark"] .box a:not(.button):not(.tag),
html[data-btfw-theme="dark"] .panel a:not(.button):not(.tag),
html[data-btfw-theme="dark"] .notification a:not(.button):not(.tag){
  color: var(--btfw-color-accent);
}
html[data-btfw-theme="dark"] .modal a:not(.button):not(.tag):hover,
html[data-btfw-theme="dark"] .box a:not(.button):not(.tag):hover{
  color: color-mix(in srgb, var(--btfw-color-accent) 80%, white 20%);
}
`;

  // Color-scheme meta for proper form controls on some browsers
  function ensureColorSchemeMeta(mode) {
    const desired = (mode === "dark") ? "dark" : "light";
    let meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "color-scheme");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desired);
  }

  // Pref read/write (with backward compatibility)
  function readPref() {
    try {
      const v = localStorage.getItem(KEY);
      if (v) return v;
      const legacy = localStorage.getItem(KEY_OLD);
      return legacy || "dark";
    } catch (_) { return "dark"; }
  }
  function writePref(v) { try { localStorage.setItem(KEY, v); } catch(_){} }

  // Compute effective mode if "auto"
  function resolveAuto() {
    return (mq && mq.matches) ? "dark" : "light";
  }

  // Apply theme & CSS bridge
  function apply(mode) {
    const effective = (mode === "auto") ? resolveAuto() : (mode || "dark");
    const html = document.documentElement;
    html.setAttribute("data-btfw-theme", effective);
    html.classList.toggle("btfw-theme-dark", effective === "dark"); // keep compatibility with your CSS
    ensureColorSchemeMeta(effective);

    // Inject or clear dark CSS
    const st = ensureStyle();
    st.textContent = (effective === "dark") ? DARK_CSS : "";
  }

  // Public API
  function setTheme(mode) {
    const m = (mode === "auto" || mode === "dark" || mode === "light") ? mode : "dark";
    writePref(m);
    apply(m);
  }
  function getTheme() { return readPref(); }

  // React to OS scheme while in Auto
  function wireAutoWatcher() {
    if (!mq || !mq.addEventListener) return;
    mq.addEventListener("change", () => {
      if (getTheme() === "auto") apply("auto");
    });
  }

  // Boot
  function boot() {
    apply(readPref());     // default dark if unset
    wireAutoWatcher();     // live-update if system scheme changes
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:bulma-layer", setTheme, getTheme };
});

/* Compatibility alias so init("feature:bulma") still works in your loader */
BTFW.define("feature:bulma", ["feature:bulma-layer"], async ({}) => ({ name: "feature:bulma" }));
