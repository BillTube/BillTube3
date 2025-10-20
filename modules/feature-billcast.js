BTFW.define("feature:billcast", [], async () => {
  const KEY  = "btfw:billcast:enabled";  // persisted toggle
  const BASE = (window.BTFW && BTFW.BASE ? BTFW.BASE.replace(/\/+$/, "") : "");
  const SRC  = BASE + "/modules/feature-billcaster.js";

  function getMediaType() {
    try {
      return window.PLAYER?.mediaType || null;
    } catch (_) {
      return null;
    }
  }

  function isDirectMedia() {
    const type = (getMediaType() || "").toLowerCase();
    return type === "fi" || type === "gd";
  }

  function isEnabled() {
    try {
      const v = localStorage.getItem(KEY);
      return (v === null) ? true : v === "1"; // default ON
    } catch (_) {
      return true;
    }
  }
  function setEnabled(on) {
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch(_){}
  }

  function loadScriptOnce() {
    return new Promise((resolve, reject) => {
      if (window.__BTFW_BILLCAST_LOADED) return resolve(true);
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => { window.__BTFW_BILLCAST_LOADED = true; resolve(true); };
      s.onerror = () => reject(new Error("Failed to load " + SRC));
      document.head.appendChild(s);
    });
  }

  async function enable() {
    if (window.__BTFW_BILLCAST_LOADED) return true;
    try {
      await loadScriptOnce();
      console.log("[billcast] loaded");
      return true;
    } catch (e) {
      console.warn("[billcast] load failed:", e && e.message || e);
      return false;
    }
  }

  function disable() {
    // We can't safely unload the Cast sender once injected,
    // but we can hide/remove UI bits created by billcast.js.
    const castBtn = document.getElementById("castButton");
    const fbBtn   = document.getElementById("fallbackButton");
    if (castBtn) castBtn.remove();
    if (fbBtn)   fbBtn.remove();
    console.log("[billcast] disabled (UI hidden; script not reloaded again)");
  }

  // Theme Settings integration (expects your TS to dispatch this with values.billcastEnabled)
  function onThemeApply(ev) {
    const values = ev && ev.detail && ev.detail.values || {};
    if (typeof values.billcastEnabled === "boolean") {
      setEnabled(values.billcastEnabled);
      applyMediaState();
    }
  }

  function applyMediaState() {
    if (!isEnabled()) {
      disable();
      return;
    }
    if (isDirectMedia()) {
      enable();
    } else {
      disable();
    }
  }

  function boot() {
    document.addEventListener("btfw:themeSettings:apply", onThemeApply);
    applyMediaState();

    try {
      if (window.socket && typeof socket.on === "function") {
        socket.on("changeMedia", () => {
          setTimeout(() => applyMediaState(), 0);
        });
      }
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { name: "feature:billcast", enable, disable };
});