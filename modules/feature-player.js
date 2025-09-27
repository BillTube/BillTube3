/* BTFW — feature:player (restore default VideoJS look and apply tech guards) */
BTFW.define("feature:player", ["feature:layout"], async ({}) => {
  const THEME_ID = "btfw-videojs-streamlined-theme";
  const CUSTOM_THEME_CLASS = "btfw-videojs-themed";
  const DEFAULT_SKIN_CLASS = "vjs-default-skin";

  function removeCustomThemeStyle() {
    const style = document.getElementById(THEME_ID);
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }

  function applyDefaultSkin() {
    document.querySelectorAll(".video-js").forEach((player) => {
      player.classList.remove(CUSTOM_THEME_CLASS);
      if (!player.classList.contains(DEFAULT_SKIN_CLASS)) {
        player.classList.add(DEFAULT_SKIN_CLASS);
      }
    });
  }

  function applyDefaultTheme() {
    removeCustomThemeStyle();
    applyDefaultSkin();
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
      applyDefaultTheme();
      attachGuards();
    });
    mo.observe(target, { childList: true, subtree: true });
    watchPlayerMount._mo = mo;
  }

  function watchHead() {
    const head = document.head;
    if (!head || watchHead._mo) return;
    const mo = new MutationObserver(() => removeCustomThemeStyle());
    mo.observe(head, { childList: true });
    watchHead._mo = mo;
  }

  function boot() {
    applyDefaultTheme();
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
    applyDefaultTheme,
    attachGuards
  };
});
