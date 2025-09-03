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
html[data-btfw-theme="dark"], html[data-btfw-theme="dark"] body { background:#0f131a; color:#e6edf3; }

/* Text/surfaces (Bulma) */
html[data-btfw-theme="dark"] .content,
html[data-btfw-theme="dark"] .title,
html[data-btfw-theme="dark"] .subtitle,
html[data-btfw-theme="dark"] p,
html[data-btfw-theme="dark"] small { color:#e6edf3; }

html[data-btfw-theme="dark"] .box,
html[data-btfw-theme="dark"] .card,
html[data-btfw-theme="dark"] .panel,
html[data-btfw-theme="dark"] .menu,
html[data-btfw-theme="dark"] .notification,
html[data-btfw-theme="dark"] .dropdown-content,
html[data-btfw-theme="dark"] .modal-card {
  background:#141a22 !important;
  color:#e6edf3 !important;
  border:1px solid #253142 !important;
  box-shadow: 0 12px 38px rgba(0,0,0,.6);
}

html[data-btfw-theme="dark"] .tabs.is-boxed li a { background:transparent; border-color:transparent; color:#c8d4e0; }
html[data-btfw-theme="dark"] .tabs.is-boxed li.is-active a { background:#0f1620; color:#fff; border-color:#253142; }

/* Inputs */
html[data-btfw-theme="dark"] .input,
html[data-btfw-theme="dark"] .textarea,
html[data-btfw-theme="dark"] .select select {
  background:#0f1620 !important;
  color:#e6edf3 !important;
  border-color:#2b3a4a !important;
}
html[data-btfw-theme="dark"] .input::placeholder,
html[data-btfw-theme="dark"] .textarea::placeholder { color:#9fb0c2 !important; }

/* Buttons */
html[data-btfw-theme="dark"] .button {
  background:#1a2230; color:#e6edf3; border:1px solid rgba(255,255,255,.10);
}
html[data-btfw-theme="dark"] .button:hover { filter:brightness(1.08); }
html[data-btfw-theme="dark"] .button.is-link,
html[data-btfw-theme="dark"] .button.is-primary {
  background:#2563eb !important; border-color:#2159d3 !important; color:#fff !important;
}

/* Chat/stack surfaces you themed */
html[data-btfw-theme="dark"] #main,
html[data-btfw-theme="dark"] .container-fluid,
html[data-btfw-theme="dark"] .well,
html[data-btfw-theme="dark"] .btfw-stack,
html[data-btfw-theme="dark"] .btfw-topbar { background:#0f131a; color:#e6edf3; }
html[data-btfw-theme="dark"] #chatwrap,
html[data-btfw-theme="dark"] #messagebuffer { background:transparent; }

/* --- Bulma modal dark --- */
html[data-btfw-theme="dark"] .modal { z-index: 6000 !important; }
html[data-btfw-theme="dark"] .modal .modal-background { background-color: rgba(8,10,14,.8) !important; }
html[data-btfw-theme="dark"] .modal-card-head,
html[data-btfw-theme="dark"] .modal-card-foot {
  background-color:#0f1620 !important; border-color:#253142 !important; color:#e6edf3 !important;
}
html[data-btfw-theme="dark"] .modal-card { background-color:#141a22 !important; color:#e6edf3 !important; }
html[data-btfw-theme="dark"] .modal-card-title { color:#e6edf3 !important; }

/* --- Bootstrap/CyTube modal bridge (skin Bootstrap modals to match Bulma dark) --- */
html[data-btfw-theme="dark"] .modal.fade,
html[data-btfw-theme="dark"] .modal.in,
html[data-btfw-theme="dark"] .modal { z-index: 6000 !important; }
html[data-btfw-theme="dark"] .modal-backdrop {
  background-color: rgba(8,10,14,.8) !important; z-index: 5999 !important;
}
html[data-btfw-theme="dark"] .modal-dialog { max-width: 880px; }
html[data-btfw-theme="dark"] .modal-content {
  background-color:#141a22 !important; color:#e6edf3 !important; border:1px solid #253142 !important;
}
html[data-btfw-theme="dark"] .modal-header,
html[data-btfw-theme="dark"] .modal-footer {
  background-color:#0f1620 !important; border-color:#253142 !important; color:#e6edf3 !important;
}
html[data-btfw-theme="dark"] .modal-title { color:#e6edf3 !important; }
html[data-btfw-theme="dark"] .modal .btn-primary {
  background:#2563eb !important; border-color:#2159d3 !important; color:#fff !important;
}
html[data-btfw-theme="dark"] .modal .btn-default {
  background:#1c2530 !important; border-color:#2b3a4a !important; color:#e6edf3 !important;
}
/* Scroll lock (Bootstrap) */
body.modal-open { overflow: hidden; }
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
