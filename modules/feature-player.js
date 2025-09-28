/* BTFW — feature:player (Video.js theme + tech guards) */
BTFW.define("feature:player", ["feature:layout"], async ({}) => {
  const PLAYER_SELECTOR = "#videowrap .video-js";
  const DEFAULT_SKIN_CLASS = "vjs-default-skin";
  const CITY_THEME_CLASS = "vjs-theme-city";
  const BIG_PLAY_CLASS = "vjs-big-play-centered";
  const BASE_STYLES_LINK_ID = "btfw-videojs-base-css";
  const CITY_STYLES_LINK_ID = "btfw-videojs-city-css";
  const BASE_STYLES_URLS = ["https://vjs.zencdn.net/7.20.3/video-js.css"];
  const CITY_STYLES_URLS = [
    "https://cdn.jsdelivr.net/npm/@videojs/themes@1/dist/city/index.css",
    "https://unpkg.com/@videojs/themes@1/dist/city/index.css"
  ];

  function ensureStylesheet(id, urls) {
    const doc = document;
    if (!doc || !doc.head) return;
    if (doc.getElementById(id)) return;

    const link = doc.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    const sources = Array.isArray(urls) ? urls.slice() : [urls];
    const tryNext = () => {
      if (!sources.length) return false;
      const href = sources.shift();
      if (!href) return tryNext();
      link.href = href;
      return true;
    };
    link.addEventListener("error", () => {
      if (tryNext()) return;
      link.remove();
    });
    if (tryNext()) {
      doc.head.appendChild(link);
    }
  }

  function baseStylesActive() {
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

  function ensureBaseStylesheet() {
    if (baseStylesActive()) return;
    const existing = document.querySelector(
      'link[href*="video-js"], link[href*="videojs"], style[data-vjs-styles]'
    );
    if (existing) return;
    ensureStylesheet(BASE_STYLES_LINK_ID, BASE_STYLES_URLS);
  }

  function ensureCityStylesheet() {
    const existing = document.querySelector(
      'link[href*="videojs" i][href*="city" i], link[href*="@videojs/themes" i][href*="city" i]'
    );
    if (existing) return;
    ensureStylesheet(CITY_STYLES_LINK_ID, CITY_STYLES_URLS);
  }

  function applyCityTheme() {
    ensureBaseStylesheet();
    ensureCityStylesheet();
    document.querySelectorAll(PLAYER_SELECTOR).forEach((player) => {
      if (player.classList.contains(DEFAULT_SKIN_CLASS)) {
        player.classList.remove(DEFAULT_SKIN_CLASS);
      }
      Array.from(player.classList).forEach((cls) => {
        if (cls.startsWith("vjs-theme-") && cls !== CITY_THEME_CLASS) {
          player.classList.remove(cls);
        }
      });
      if (!player.classList.contains(CITY_THEME_CLASS)) {
        player.classList.add(CITY_THEME_CLASS);
      }
      if (!player.classList.contains(BIG_PLAY_CLASS)) {
        player.classList.add(BIG_PLAY_CLASS);

      }
    });
  }

  /* ===== Guard: block context menu + surface click-to-pause ===== */
  const GUARD_MARK = "_btfwGuarded";

  function shouldAllowClick(target) {
    if (!target) return false;

    const allowSelectors = [
      ".vjs-control-bar",
      ".vjs-control",
      ".vjs-menu",
      ".vjs-menu-content",
      ".vjs-slider",
      ".vjs-volume-panel",
      ".vjs-tech .alert",
      ".vjs-tech [role=\"alert\"]",
      ".vjs-tech [role=\"dialog\"]",
      ".vjs-tech .modal",
      ".vjs-tech .modal-dialog"
    ].join(",");

    if (target.closest(allowSelectors)) {
      return true;
    }

    return false;
  }

  function attachGuardsTo(el) {
    if (!el || el[GUARD_MARK]) return;
    el[GUARD_MARK] = true;

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
      applyCityTheme();

      attachGuards();
    });
    mo.observe(target, { childList: true, subtree: true });
    watchPlayerMount._mo = mo;
  }

  function watchHead() {
    const head = document.head;
    if (!head || watchHead._mo) return;
    const mo = new MutationObserver(() => {
      ensureBaseStylesheet();
      ensureCityStylesheet();

    });
    mo.observe(head, { childList: true });
    watchHead._mo = mo;
  }

  function boot() {
    applyCityTheme();
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
    applyCityTheme,
    attachGuards
  };
});
