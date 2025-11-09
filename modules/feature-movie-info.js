/* BTFW – feature:movie-info */
BTFW.define("feature:movie-info", [], async () => {
  const MODULE_ID = "movie-info";
  const CONFIG = {
    CONTAINER_ID: "btfw-movie-header",
    TITLE_SELECTOR: "#currenttitle",
    TOPBAR_SELECTOR: ".btfw-chat-topbar",
    ENABLE_BACKDROP: true,
    ENABLE_RATING: true,
    SHOW_SUMMARY: true
  };
  const STYLE_ID = "btfw-movie-info-style";

  const state = {
    isInitialized: false,
    header: null,
    currentTitle: "",
    hideTimer: null,
    initTimer: null,
    socketRetryTimer: null,
    cleanup: []
  };

  let fetchToken = 0;
  let globalListenersAttached = false;
  let configObserver = null;

  function registerCleanup(fn) {
    if (typeof fn === "function") {
      state.cleanup.push(fn);
    }
  }

  function runCleanup() {
    while (state.cleanup.length) {
      const fn = state.cleanup.pop();
      try { fn(); } catch (_) {}
    }
    if (state.header) {
      state.header.remove();
      state.header = null;
    }
  }

  function cleanupModule() {
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
    if (state.initTimer) {
      clearTimeout(state.initTimer);
      state.initTimer = null;
    }
    if (state.socketRetryTimer) {
      clearTimeout(state.socketRetryTimer);
      state.socketRetryTimer = null;
    }
    fetchToken = 0;
    state.currentTitle = "";
    state.isInitialized = false;
    runCleanup();
  }

  function getTMDBKey() {
    try {
      const cfg = (window.BTFW_CONFIG && typeof window.BTFW_CONFIG === "object") ? window.BTFW_CONFIG : {};
      const admin = (window.BTFW_THEME_ADMIN && typeof window.BTFW_THEME_ADMIN === "object") ? window.BTFW_THEME_ADMIN : {};
      const cfgTmdb = (cfg.tmdb && typeof cfg.tmdb === "object") ? cfg.tmdb : {};
      const adminTmdb = (admin.integrations?.tmdb && typeof admin.integrations.tmdb === "object") ? admin.integrations.tmdb : {};
      const cfgKey = typeof cfgTmdb.apiKey === "string" ? cfgTmdb.apiKey.trim() : "";
      const adminKey = typeof adminTmdb.apiKey === "string" ? adminTmdb.apiKey.trim() : "";
      const legacyCfg = typeof cfg.tmdbKey === "string" ? cfg.tmdbKey.trim() : "";
      let lsKey = "";
      try {
        lsKey = (localStorage.getItem("btfw:tmdb:key") || "").trim();
      } catch (_) {}
      const g = v => (v == null ? "" : String(v)).trim();
      const globalKey = g(window.TMDB_API_KEY) || g(window.BTFW_TMDB_KEY) || g(window.tmdb_key);
      const bodyKey = (document.body?.dataset?.tmdbKey || "").trim();
      const key = adminKey || cfgKey || legacyCfg || lsKey || globalKey || bodyKey;
      return key || null;
    } catch (_) {
      return null;
    }
  }

  function toEnabledValue(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value > 0 : false;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return false;
      return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
    }
    return false;
  }

  function computeEnabled() {
    const checks = [
      () => window.BTFW_THEME_ADMIN?.integrations?.movieInfo?.enabled,
      () => window.BTFW_CONFIG?.integrations?.movieInfo?.enabled,
      () => window.BTFW_CONFIG?.movieInfo?.enabled,
      () => window.BTFW_CONFIG?.movieInfoEnabled,
      () => document?.body?.dataset?.btfwMovieInfoEnabled
    ];
    for (const check of checks) {
      try {
        const value = typeof check === "function" ? check() : check;
        if (toEnabledValue(value)) {
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  function ensureConfigObserver() {
    if (configObserver || typeof MutationObserver !== "function") return;
    const body = document.body;
    if (!body) return;
    configObserver = new MutationObserver(() => evaluateActivation());
    configObserver.observe(body, { attributes: true, attributeFilter: ["data-btfw-movie-info-enabled", "data-tmdb-key"] });
  }

  function attachGlobalListeners() {
    if (globalListenersAttached) return;
    globalListenersAttached = true;
    const refresh = () => evaluateActivation();
    document.addEventListener("btfw:channelIntegrationsChanged", refresh);
    document.addEventListener("btfw:ready", refresh);
  }

  function startInitCycle(delay = 0) {
    if (state.initTimer) {
      clearTimeout(state.initTimer);
      state.initTimer = null;
    }
    state.initTimer = window.setTimeout(() => {
      state.initTimer = null;
      if (!computeEnabled()) return;
      tryInitialize();
    }, Math.max(0, delay));
  }

  function tryInitialize() {
    if (state.isInitialized) return;
    const topbar = document.querySelector(CONFIG.TOPBAR_SELECTOR);
    if (!topbar) {
      startInitCycle(500);
      return;
    }
    try {
      createMovieHeader(topbar);
      injectStyles();
      setupEventListeners();
      state.isInitialized = true;
      setTimeout(() => {
        handleResize();
        handleMediaChange();
      }, 120);
    } catch (error) {
      startInitCycle(800);
    }
  }

  function evaluateActivation() {
    if (computeEnabled()) {
      if (state.isInitialized) {
        handleResize();
        setTimeout(handleMediaChange, 80);
      } else {
        startInitCycle(0);
      }
    } else {
      cleanupModule();
    }
  }

  function createMovieHeader(topbar) {
    if (!topbar) {
      topbar = document.querySelector(CONFIG.TOPBAR_SELECTOR);
      if (!topbar) {
        throw new Error("Chat topbar not found");
      }
    }
    const existing = document.getElementById(CONFIG.CONTAINER_ID);
    if (existing) {
      existing.remove();
    }
    const container = document.createElement("div");
    container.id = CONFIG.CONTAINER_ID;
    container.className = "btfw-movie-header hide";
    container.dataset.module = MODULE_ID;
    topbar.insertAdjacentElement("afterend", container);
    state.header = container;
  }

  function getSocket() {
    try {
      return window.socket || window.SOCKET || null;
    } catch (_) {
      return null;
    }
  }

  function setupEventListeners() {
    setupHoverEffects();
    bindSocketListener();
    const onResize = debounce(handleResize, 250);
    window.addEventListener("resize", onResize);
    registerCleanup(() => window.removeEventListener("resize", onResize));
  }

  function setupHoverEffects() {
    attachTitleListeners();
    attachHeaderListeners();
  }

  function attachTitleListeners() {
    const titleElement = document.querySelector(CONFIG.TITLE_SELECTOR);
    if (titleElement) {
      const onEnter = () => showMovieHeader();
      const onLeave = () => hideMovieHeaderDelayed();
      titleElement.addEventListener("mouseenter", onEnter);
      titleElement.addEventListener("mouseleave", onLeave);
      registerCleanup(() => {
        titleElement.removeEventListener("mouseenter", onEnter);
        titleElement.removeEventListener("mouseleave", onLeave);
      });
    } else if (typeof MutationObserver === "function") {
      const observer = new MutationObserver(() => {
        const el = document.querySelector(CONFIG.TITLE_SELECTOR);
        if (el) {
          observer.disconnect();
          attachTitleListeners();
        }
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
      registerCleanup(() => {
        try { observer.disconnect(); } catch (_) {}
      });
    }
  }

  function attachHeaderListeners() {
    const header = state.header;
    if (!header) return;
    const onEnter = () => cancelHideTimer();
    const onLeave = () => hideMovieHeaderDelayed();
    header.addEventListener("mouseenter", onEnter);
    header.addEventListener("mouseleave", onLeave);
    registerCleanup(() => {
      header.removeEventListener("mouseenter", onEnter);
      header.removeEventListener("mouseleave", onLeave);
    });
  }

  function bindSocketListener() {
    const socket = getSocket();
    if (socket && typeof socket.on === "function") {
      socket.on("changeMedia", handleMediaChange);
      registerCleanup(() => {
        try {
          socket.off?.("changeMedia", handleMediaChange);
        } catch (_) {
          try { socket.removeListener?.("changeMedia", handleMediaChange); } catch (_) {}
        }
      });
      return;
    }
    let attempts = 0;
    const retry = () => {
      if (!computeEnabled()) {
        state.socketRetryTimer = null;
        return;
      }
      const sock = getSocket();
      if (sock && typeof sock.on === "function") {
        sock.on("changeMedia", handleMediaChange);
        registerCleanup(() => {
          try {
            sock.off?.("changeMedia", handleMediaChange);
          } catch (_) {
            try { sock.removeListener?.("changeMedia", handleMediaChange); } catch (_) {}
          }
        });
        state.socketRetryTimer = null;
        return;
      }
      attempts += 1;
      if (attempts > 10) {
        state.socketRetryTimer = null;
        return;
      }
      state.socketRetryTimer = window.setTimeout(retry, 1000);
    };
    state.socketRetryTimer = window.setTimeout(retry, 1200);
    registerCleanup(() => {
      if (state.socketRetryTimer) {
        clearTimeout(state.socketRetryTimer);
        state.socketRetryTimer = null;
      }
    });
  }

  function cancelHideTimer() {
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
  }

  function showMovieHeader() {
    cancelHideTimer();
    if (state.header) {
      state.header.classList.remove("hide");
      state.header.classList.add("show");
    }
  }

  function hideMovieHeaderDelayed() {
    cancelHideTimer();
    state.hideTimer = window.setTimeout(() => {
      if (!state.header) return;
      state.header.classList.remove("show");
      state.header.classList.add("hide");
      setTimeout(() => {
        if (state.header && state.header.classList.contains("hide")) {
          state.header.classList.remove("hide");
        }
      }, 320);
    }, 300);
  }

  function handleResize() {
    if (!state.header) return;
    const isMobile = window.innerWidth <= 768;
    state.header.classList.toggle("btfw-mobile", isMobile);
  }

  async function handleMediaChange() {
    if (!state.isInitialized) return;
    const titleElement = document.querySelector(CONFIG.TITLE_SELECTOR);
    const header = state.header;
    if (!titleElement || !header) {
      return;
    }
    const newTitle = titleElement.textContent?.trim() || "";
    if (!newTitle) {
      state.currentTitle = "";
      resetMovieHeader();
      return;
    }
    if (newTitle === state.currentTitle) {
      return;
    }
    state.currentTitle = newTitle;
    const requestId = ++fetchToken;
    showLoadingState();
    try {
      const movieInfo = await fetchMovieInfo(newTitle);
      if (requestId !== fetchToken) return;
      displayMovieInfo(movieInfo);
    } catch (error) {
      if (requestId !== fetchToken) return;
      if (!getTMDBKey()) {
        console.warn("[movie-info] Enabled without a TMDB API key. Add a key in the Channel Theme Toolkit integrations panel to display metadata.");
      }
      showErrorState();
    }
  }

  function cleanMovieTitle(title) {
    const unwantedWords = ["Extended", "Director's Cut", "Directors Cut", "Unrated", "Theatrical Cut"];
    let cleanTitle = title;
    unwantedWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      cleanTitle = cleanTitle.replace(regex, "");
    });
    return cleanTitle.replace(/\s{2,}/g, " ").trim();
  }

  async function fetchMovieInfo(movieTitle) {
    const apiKey = getTMDBKey();
    if (!apiKey) {
      throw new Error("TMDB API key not configured. Please set it in Theme Settings → Integrations");
    }
    let match = movieTitle.match(/(.+)\s*\((\d{4})\)/);
    let title = match ? match[1].trim() : movieTitle;
    let year = match ? match[2] : "";
    if (!year) {
      match = movieTitle.match(/(.+?)\s+(\d{4})\s*$/);
      if (match) {
        title = match[1].trim();
        year = match[2];
      }
    }
    const cleanTitle = cleanMovieTitle(title);
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(cleanTitle)}&year=${year}`;
    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    if (data?.results?.length > 0) {
      const movie = data.results[0];
      return {
        title: movieTitle,
        backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        summary: movie.overview || "",
        rating: movie.vote_average || 0,
        releaseDate: movie.release_date || "",
        voteCount: movie.vote_count || 0
      };
    }
    return {
      title: movieTitle,
      backdrop: null,
      poster: null,
      summary: "",
      rating: 0,
      releaseDate: "",
      voteCount: 0
    };
  }

  function showLoadingState() {
    if (!state.header) return;
    resetBackdrop();
    state.header.innerHTML = `
      <div class="btfw-movie-content">
        <div class="btfw-movie-loading">
          <i class="fa fa-spinner fa-spin"></i>
          <p>Loading movie information...</p>
        </div>
      </div>
    `;
  }

  function showErrorState() {
    if (!state.header) return;
    resetBackdrop();
    state.header.innerHTML = `
      <div class="btfw-movie-content">
        <div class="btfw-movie-error">
          <i class="fa fa-exclamation-triangle"></i>
          <p>Unable to fetch movie information</p>
          <small>Check TMDB API key in Theme Settings</small>
        </div>
      </div>
    `;
  }

  function resetMovieHeader() {
    if (!state.header) return;
    resetBackdrop();
    state.header.innerHTML = `
      <div class="btfw-movie-content">
        <p>No movie information available</p>
      </div>
    `;
  }

  function resetBackdrop() {
    if (!state.header) return;
    state.header.style.backgroundImage = "";
    state.header.style.backgroundColor = "";
  }

  function displayMovieInfo(movie) {
    if (!state.header) return;
    state.header.innerHTML = "";
    if (CONFIG.ENABLE_BACKDROP && movie.backdrop) {
      state.header.style.backgroundImage = `url(${movie.backdrop})`;
      state.header.style.backgroundSize = "cover";
      state.header.style.backgroundPosition = "center";
    } else {
      resetBackdrop();
    }
    const overlay = document.createElement("div");
    overlay.className = "btfw-movie-overlay";
    state.header.appendChild(overlay);
    const contentDiv = document.createElement("div");
    contentDiv.className = "btfw-movie-content";
    state.header.appendChild(contentDiv);
    if (movie.poster) {
      const posterEl = document.createElement("img");
      posterEl.src = movie.poster;
      posterEl.alt = `${movie.title} Poster`;
      posterEl.className = "btfw-movie-poster";
      contentDiv.appendChild(posterEl);
    }
    const detailsDiv = document.createElement("div");
    detailsDiv.className = "btfw-movie-details";
    contentDiv.appendChild(detailsDiv);
    const titleEl = document.createElement("h2");
    titleEl.textContent = movie.title;
    titleEl.className = "btfw-movie-title";
    detailsDiv.appendChild(titleEl);
    if (CONFIG.SHOW_SUMMARY && movie.summary) {
      const summaryEl = document.createElement("p");
      summaryEl.textContent = movie.summary;
      summaryEl.className = "btfw-movie-summary";
      detailsDiv.appendChild(summaryEl);
    }
    if (CONFIG.ENABLE_RATING && movie.rating > 0) {
      const ratingEl = createRatingElement(movie.rating, movie.voteCount);
      contentDiv.appendChild(ratingEl);
    }
  }

  function createRatingElement(rating, voteCount) {
    const container = document.createElement("div");
    container.className = "btfw-movie-rating";
    const percentage = Math.round(rating * 10);
    const color = getRatingColor(percentage);
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "60");
    svg.setAttribute("height", "60");
    svg.setAttribute("viewBox", "0 0 60 60");
    const radius = 25;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (rating / 10) * circumference;
    const circleBg = document.createElementNS(svgNS, "circle");
    circleBg.setAttribute("cx", "30");
    circleBg.setAttribute("cy", "30");
    circleBg.setAttribute("r", radius.toString());
    circleBg.setAttribute("stroke", "#2a2a2a");
    circleBg.setAttribute("stroke-width", "4");
    circleBg.setAttribute("fill", "#1a1a1a");
    svg.appendChild(circleBg);
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "30");
    circle.setAttribute("cy", "30");
    circle.setAttribute("r", radius.toString());
    circle.setAttribute("stroke", color);
    circle.setAttribute("stroke-width", "3");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke-dasharray", circumference.toString());
    circle.setAttribute("stroke-dashoffset", offset.toString());
    circle.setAttribute("transform", "rotate(-90 30 30)");
    circle.setAttribute("stroke-linecap", "round");
    svg.appendChild(circle);
    const text = document.createElementNS(svgNS, "text");
    text.setAttribute("x", "50%");
    text.setAttribute("y", "50%");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("fill", "#fff");
    text.setAttribute("font-size", "10");
    text.setAttribute("font-weight", "bold");
    text.textContent = `${percentage}%`;
    svg.appendChild(text);
    container.appendChild(svg);
    if (voteCount > 0) {
      const voteEl = document.createElement("div");
      voteEl.className = "btfw-movie-votes";
      voteEl.textContent = `${voteCount.toLocaleString()} votes`;
      container.appendChild(voteEl);
    }
    return container;
  }

  function getRatingColor(rating) {
    const clampedRating = Math.max(0, Math.min(rating, 100));
    if (clampedRating >= 70) return "#4caf50";
    if (clampedRating >= 50) return "#ff9800";
    return "#f44336";
  }

  function debounce(func, wait) {
    let timeout = null;
    return function debounced(...args) {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        timeout = null;
        func(...args);
      }, wait);
    };
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .btfw-movie-header {
        position: absolute;
        top: 44px;
        right: 0;
        height: auto;
        width: 100%;
        max-width: 90vw;
        background: rgba(20, 20, 20, 0.95);
        border-radius: 0 0 12px 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        z-index: 1000;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
        pointer-events: none;
      }
      .btfw-movie-header.show {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
        animation: slideInDown 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
      }
      .btfw-movie-header.hide {
        animation: slideOutUp 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
      }
      @keyframes slideInDown {
        0% {
          opacity: 0;
          transform: translateY(-30px) scale(0.9);
        }
        60% {
          opacity: 0.8;
          transform: translateY(5px) scale(1.02);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes slideOutUp {
        0% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        100% {
          opacity: 0;
          transform: translateY(-25px) scale(0.95);
        }
      }
      .btfw-movie-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.5) 50%, rgba(0, 0, 0, 0.8) 100%);
        z-index: 1;
      }
      .btfw-movie-content {
        position: relative;
        z-index: 2;
        padding: 10px;
        display: flex;
        gap: 15px;
        min-height: 160px;
      }
      .btfw-movie-poster {
        width: 100px;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        flex-shrink: 0;
      }
      .btfw-movie-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .btfw-movie-title {
        color: #fff;
        font-size: 1.2em;
        font-weight: 600;
        margin: 0;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        line-height: 1.3;
      }
      .btfw-movie-summary {
        color: #e0e0e0;
        font-size: 0.85em;
        line-height: 1.5;
        margin: 0;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .btfw-movie-rating {
        position: sticky;
        bottom: 16px;
        right: 16px;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
        justify-content: flex-end;
      }
      .btfw-movie-votes {
        color: #ccc;
        font-size: 0.7em;
        text-align: center;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
      }
      .btfw-movie-loading,
      .btfw-movie-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: #ccc;
        text-align: center;
        min-height: 120px;
      }
      .btfw-movie-loading i,
      .btfw-movie-error i {
        font-size: 2em;
        opacity: 0.7;
      }
      .btfw-movie-error i {
        color: #ff6b6b;
      }
      .btfw-movie-error small {
        font-size: 0.8em;
        color: #aaa;
      }
      @media (max-width: 768px) {
        .btfw-movie-header {
          width: 100%;
          right: 0;
          left: 0;
          border-radius: 0;
        }
        .btfw-movie-content {
          padding: 16px;
          flex-direction: column;
          min-height: auto;
        }
        .btfw-movie-poster {
          width: 80px;
          align-self: center;
        }
        .btfw-movie-rating {
          position: static;
          align-self: center;
          margin-top: 12px;
        }
        .btfw-movie-summary {
          -webkit-line-clamp: 3;
        }
      }
      ${CONFIG.TITLE_SELECTOR}:hover {
        color: #4fc3f7 !important;
        transition: color 0.2s ease;
      }
    `;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function boot() {
    ensureConfigObserver();
    attachGlobalListeners();
    evaluateActivation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  return {
    name: "feature:movie-info",
    refresh: evaluateActivation,
    cleanup: cleanupModule
  };
});
