/* BTFW — feature:player (streamlined VideoJS look + tech guards) */
BTFW.define("feature:player", ["feature:layout"], async ({}) => {
  const CUSTOM_THEME_CLASS = "btfw-videojs-themed";
  const DEFAULT_SKIN_CLASS = "vjs-default-skin";
  const DEFAULT_STYLES_LINK_ID = "btfw-videojs-default-css";
  const DEFAULT_STYLES_URL = "https://vjs.zencdn.net/7.20.3/video-js.css";

  function ensureDefaultStylesheet() {
    const doc = document;
    if (!doc || !doc.head) return;
    if (doc.getElementById(DEFAULT_STYLES_LINK_ID)) return;

    const existing = doc.querySelector(
      'link[href*="video-js"], link[href*="videojs"], style[data-vjs-styles]' 
    );
    if (existing) return;

    const link = doc.createElement("link");
    link.id = DEFAULT_STYLES_LINK_ID;
    link.rel = "stylesheet";
    link.href = DEFAULT_STYLES_URL;
    doc.head.appendChild(link);
  }

  function defaultSkinAppearsActive() {
    if (typeof window === "undefined" || !document.body) return false;
    const probe = document.createElement("div");
    probe.className = `video-js ${DEFAULT_SKIN_CLASS}`;
    probe.style.position = "absolute";
    probe.style.opacity = "0";
    probe.style.pointerEvents = "none";
    probe.style.width = "1px";
    probe.style.height = "1px";
    document.body.appendChild(probe);
    const fontSize = window.getComputedStyle(probe).fontSize;
    probe.remove();
    return fontSize && Math.abs(parseFloat(fontSize) - 10) < 0.2;
  }

  function ensureDefaultSkin() {
    document.querySelectorAll(".video-js").forEach((player) => {
      player.classList.remove(CUSTOM_THEME_CLASS);
      if (!player.classList.contains(DEFAULT_SKIN_CLASS)) {
        player.classList.add(DEFAULT_SKIN_CLASS);
      }
    });
  }

  function applyStreamlinedTheme() {
    if (!defaultSkinAppearsActive()) {
      ensureDefaultStylesheet();
    }
    ensureDefaultSkin();
    document.querySelectorAll(".video-js").forEach((player) => {
      if (!player.classList.contains(CUSTOM_THEME_CLASS)) {
        player.classList.add(CUSTOM_THEME_CLASS);
      }
    });
  }

  /* ===== Guard: block context menu + surface click-to-pause ===== */
  const GUARD_MARK = "_btfwGuarded";

  function shouldAllowClick(target) {
    if (!target) return false;
    if (target.closest(".vjs-control-bar,.vjs-control,.vjs-menu,.vjs-menu-content,.vjs-slider,.vjs-volume-panel")) {
      return true;
    }
    return false;
  }

  function attachGuardsTo(el) {
    if (!el || el[GUARD_MARK]) return;
    el[GUARD_MARK] = true;

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, true);

    const block = (e) => {
      if (shouldAllowClick(e.target)) return;
      if (e.type === "click" && e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    el.addEventListener("click", block, true);
    el.addEventListener("pointerdown", (e) => {
      if (!shouldAllowClick(e.target) && e.button === 0) e.preventDefault();
    }, true);
    el.addEventListener("touchstart", block, true);
  }

  function attachGuards() {
    const candidates = [
      ...document.querySelectorAll("#ytapiplayer"),
      ...document.querySelectorAll(".video-js"),
      ...document.querySelectorAll(".video-js .vjs-tech"),
      ...document.querySelectorAll(".video-js .vjs-poster"),
      ...document.querySelectorAll(".video-js .vjs-loading-spinner")
    ];
    candidates.forEach(attachGuardsTo);
  }

  function watchPlayerMount() {
    const target = document.getElementById("videowrap") || document.body;
    if (!target) return;
    if (watchPlayerMount._mo) {
      try { watchPlayerMount._mo.disconnect(); } catch (_) {}
    }
    const mo = new MutationObserver(() => {
      applyStreamlinedTheme();
      attachGuards();
    });
    mo.observe(target, { childList: true, subtree: true });
    watchPlayerMount._mo = mo;
  }

  function watchHead() {
    const head = document.head;
    if (!head || watchHead._mo) return;
    const mo = new MutationObserver(() => {
      if (!defaultSkinAppearsActive()) {
        ensureDefaultStylesheet();
      }
    });
    mo.observe(head, { childList: true });
    watchHead._mo = mo;
  }

  function boot() {
    applyStreamlinedTheme();
    attachGuards();
    watchPlayerMount();
    watchHead();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  document.addEventListener("btfw:layoutReady", () => setTimeout(boot, 0));

  return {
    name: "feature:player",
    applyStreamlinedTheme,
    attachGuards
  };
});
