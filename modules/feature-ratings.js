BTFW.define("feature:ratings", [], async () => {
  const configuredEndpoint = [
    (() => { try { return window.BTFW_THEME_ADMIN?.integrations?.ratings?.endpoint || ""; } catch (_) { return ""; } })(),
    (() => { try { return window.BTFW_CONFIG?.ratings?.endpoint || ""; } catch (_) { return ""; } })(),
    (() => { try { return document?.body?.dataset?.btfwRatingsEndpoint || ""; } catch (_) { return ""; } })(),
    (() => { try { return window.BTFW_RATINGS_ENDPOINT || ""; } catch (_) { return ""; } })()
  ].map((value) => (typeof value === "string" ? value.trim() : ""))
   .find(Boolean) || "";

  const shouldLoad = configuredEndpoint.length > 0;
  if (!shouldLoad) {
    try {
      window.BTFW_CONFIG = window.BTFW_CONFIG || {};
      window.BTFW_CONFIG.shouldLoadRatings = false;
    } catch (_) {}
    return { name: "feature:ratings", disabled: true };
  }

  try {
    window.BTFW_CONFIG = window.BTFW_CONFIG || {};
    if (typeof window.BTFW_CONFIG.ratings !== "object") {
      window.BTFW_CONFIG.ratings = {};
    }
    if (!window.BTFW_CONFIG.ratings.endpoint) {
      window.BTFW_CONFIG.ratings.endpoint = configuredEndpoint;
    }
    window.BTFW_CONFIG.shouldLoadRatings = true;
  } catch (_) {}

  const motion = await BTFW.init("util:motion");

  const STAR_VALUES = [1, 2, 3, 4, 5];
  const DEFAULT_MIN_RANK = 1; // Require at least registered users by default; higher via BTFW_CONFIG.ratings.minRank
  const CHECK_INTERVAL_MS = 1200;
  const STATS_DEBOUNCE_MS = 400;
  const STATS_REFRESH_INTERVAL_MS = 20000;
  const MIN_MEDIA_DURATION_SECONDS = 60 * 60;
  const FINAL_WINDOW_SECONDS = 15 * 60;
  const TIME_TOLERANCE_SECONDS = 1;
  const PLAYBACK_POLL_INTERVAL_MS = 5000;
  const LS_ANON_ID_KEY = "btfw:ratings:anonid";
  const LS_SELF_PREFIX = "btfw:ratings:self:"; // + mediaKey

  const state = {
    enabled: false,
    container: null,
    stars: [],
    statusNode: null,
    selfNode: null,
    errorNode: null,

    ratingVisible: false,
    ratingWindowAnnounced: false,

    lookup: null,
    currentMedia: null,
    currentKey: "",

    stats: null,
    lastVote: null,
    isSubmitting: false,
    lastStatsRequest: 0,
    statsTimer: null,
    playbackTimer: null,

    endpoint: configuredEndpoint || null,
    channel: null,

    playback: {
      currentTime: 0,
      duration: 0,
      lastUpdate: 0,
    },
  };

  const leaderboardState = {
    modal: null,
    scrollEl: null,
    listEl: null,
    loadingEl: null,
    errorEl: null,
    loading: false,
    items: [],
    abortController: null,
    tmdbKey: null,
    tmdbCache: new Map(),
  };

  // ---------- Small helpers ----------
  function $(sel, root = document) { return root.querySelector(sel); }

  function getClient() {
    try { return window.CLIENT || window.client || null; } catch { return null; }
  }

  function getChannelObj() {
    try { return window.CHANNEL || window.channel || null; } catch { return null; }
  }

  function getPlayerInstance() {
    try {
      return window.PLAYER || window.player || window.Player || null;
    } catch (_) {
      return null;
    }
  }

  function safeEvaluate(candidate) {
    if (typeof candidate === "function") {
      try { return candidate(); } catch (_) { return undefined; }
    }
    return candidate;
  }

  function pickLargestPositive(candidates) {
    let best = 0;
    for (const candidate of candidates) {
      const value = safeEvaluate(candidate);
      const num = Number(value);
      if (Number.isFinite(num) && num > best) {
        best = num;
      }
    }
    return best > 0 ? best : NaN;
  }

  function pickFirstNonNegative(candidates) {
    for (const candidate of candidates) {
      const value = safeEvaluate(candidate);
      const num = Number(value);
      if (Number.isFinite(num) && num >= 0) {
        return num;
      }
    }
    return NaN;
  }

  const UNWANTED_TITLE_WORDS = [
    "Extended",
    "Director's Cut",
    "Directors Cut",
    "Unrated",
    "Theatrical Cut",
  ];

  function cleanTitleForSearch(title) {
    if (!title) return "";
    let result = String(title);
    for (const word of UNWANTED_TITLE_WORDS) {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      result = result.replace(regex, "");
    }
    return result.replace(/\s{2,}/g, " ").trim();
  }

  function parseTitleForSearch(originalTitle) {
    const raw = String(originalTitle || "").trim();
    if (!raw) {
      return { title: "", year: "" };
    }

    let title = raw;
    let year = "";

    let match = raw.match(/(.+)\s*\((\d{4})\)/);
    if (match) {
      title = match[1].trim();
      year = match[2];
    }

    if (!year) {
      match = title.match(/(.+?)\s+(\d{4})\s*$/);
      if (match) {
        title = match[1].trim();
        year = match[2];
      }
    }

    return { title: cleanTitleForSearch(title), year };
  }

  function updatePlaybackFromPlayer() {
    const player = getPlayerInstance();
    const media = state.currentMedia;
    let updated = false;

    const duration = pickLargestPositive([
      () => player?.getDuration?.(),
      () => player?.getLength?.(),
      () => player?.mediaLength,
      () => player?.media?.seconds,
      () => player?.media?.duration,
      () => player?.player?.getDuration?.(),
      () => (typeof player?.player?.duration === "function" ? player.player.duration() : player?.player?.duration),
      () => player?.player?.currentMedia?.duration,
      () => player?.videojs?.duration?.(),
      () => (typeof player?.duration === "function" ? player.duration() : player?.duration),
      () => media?.duration,
      () => state.lookup?.duration,
      () => state.lookup?.seconds,
      () => state.playback.duration,
    ]);

    if (Number.isFinite(duration) && duration > 0) {
      if (!Number.isFinite(state.playback.duration) || Math.abs(state.playback.duration - duration) > 0.5) {
        updated = true;
      }
      state.playback.duration = duration;
      if (media) media.duration = duration;
    }

    const currentTime = pickFirstNonNegative([
      () => player?.getTime?.(),
      () => player?.getCurrentTime?.(),
      () => (typeof player?.currentTime === "function" ? player.currentTime() : player?.currentTime),
      () => player?.media?.currentTime,
      () => player?.player?.getCurrentTime?.(),
      () => (typeof player?.player?.currentTime === "function" ? player.player.currentTime() : player?.player?.currentTime),
      () => player?.videojs?.currentTime?.(),
      () => media?.currentTime,
      () => state.playback.currentTime,
    ]);

    if (Number.isFinite(currentTime) && currentTime >= 0) {
      if (!Number.isFinite(state.playback.currentTime) || Math.abs(state.playback.currentTime - currentTime) > 0.3) {
        updated = true;
      }
      state.playback.currentTime = currentTime;
      state.playback.lastUpdate = Date.now();
      if (media) media.currentTime = currentTime;
    }

    return updated;
  }

  function getEffectiveDuration() {
    const duration = pickLargestPositive([
      state.playback.duration,
      state.currentMedia?.duration,
      state.lookup?.duration,
      state.lookup?.seconds,
    ]);
    return Number.isFinite(duration) && duration > 0 ? duration : NaN;
  }

  function getEffectiveCurrentTime(duration) {
    const current = pickFirstNonNegative([
      state.playback.currentTime,
      state.currentMedia?.currentTime,
    ]);
    if (!Number.isFinite(current) || current < 0) return NaN;
    if (Number.isFinite(duration) && duration > 0) {
      return Math.min(current, duration);
    }
    return current;
  }

  function shouldDisplayRatings(duration, currentTime) {
    if (!Number.isFinite(duration) || !Number.isFinite(currentTime)) return false;
    if (duration < MIN_MEDIA_DURATION_SECONDS) return false;
    const remaining = duration - currentTime;
    return remaining <= (FINAL_WINDOW_SECONDS + TIME_TOLERANCE_SECONDS);
  }

  function stopPlaybackPolling() {
    if (state.playbackTimer) {
      clearTimeout(state.playbackTimer);
      state.playbackTimer = null;
    }
  }

  function startPlaybackPolling() {
    stopPlaybackPolling();
    if (!state.currentMedia) return;
    const tick = () => {
      if (!state.currentMedia) { stopPlaybackPolling(); return; }
      updateVisibility();
      state.playbackTimer = setTimeout(tick, PLAYBACK_POLL_INTERVAL_MS);
    };
    state.playbackTimer = setTimeout(tick, PLAYBACK_POLL_INTERVAL_MS);
  }

  function resolveChannelName() {
    if (state.channel) return state.channel;
    const ch = getChannelObj();
    const fromConfig = window.BTFW_CONFIG?.channelName;
    const fromBody = document.body?.dataset?.channel || "";
    const name = (ch?.name || fromConfig || fromBody || window.CHANNELNAME || "").toString().trim();
    state.channel = name || "default";
    return state.channel;
  }

  function getConfiguredMinRank() {
    const cfgRank = Number(window.BTFW_CONFIG?.ratings?.minRank);
    const bodyRank = Number(document.body?.dataset?.btfwRatingsMinRank);
    const ranks = [cfgRank, bodyRank].filter((v) => Number.isFinite(v) && v >= 0);
    return ranks.length ? Math.max(DEFAULT_MIN_RANK, ...ranks) : DEFAULT_MIN_RANK;
  }

  function getClientRank() {
    const c = getClient();
    const r = Number(c?.rank);
    return Number.isFinite(r) ? r : NaN;
  }

  function isEligible() {
    // Registered users by default; allow higher gates via config when desired
    const minRank = getConfiguredMinRank();
    const rank = getClientRank();
    if (Number.isFinite(rank) && rank >= minRank) return true;

    // Also allow if admin/owner by permission API (when present)
    try {
      if (typeof window.hasPermission === "function") {
        if (window.hasPermission("chanadmin") || window.hasPermission("owner")) return true;
      }
    } catch {}
    try {
      const c = getClient();
      if (c?.hasPermission) {
        if (c.hasPermission("chanadmin") || c.hasPermission("owner")) return true;
      }
    } catch {}

    return false;
  }

  function waitForEligibility() {
    if (state.enabled || state.container) return;
    if (isEligible()) { state.enabled = true; boot(); return; }
    setTimeout(waitForEligibility, CHECK_INTERVAL_MS);
  }

  function ensureStyles() {
    if (document.getElementById("btfw-ratings-style")) return;
    const style = document.createElement("style");
    style.id = "btfw-ratings-style";
    style.textContent = `
      #btfw-ratings-wrapper { width: 100%; }
      #btfw-ratings { display: flex; flex-direction: row-reverse; align-items: center; align-content: center; gap: 8px; width: 100%;
        margin: 0; padding-top: 10px; font-size: 13px; font-family: inherit; color: var(--btfw-chat-dim, rgba(222, 229, 255, .72));
        position: relative; border-top: 0px solid rgba(255, 255, 255, .08); }
      #btfw-ratings[hidden] { display:none !important; }
      #btfw-ratings .btfw-ratings__header { display:flex; align-items:center; gap:8px; width:100%; }
      #btfw-ratings .btfw-ratings__label { font-size:12px; opacity:.78; letter-spacing:.02em; text-transform:uppercase; }
      #btfw-ratings .btfw-ratings__actions { margin-left:auto; display:flex; align-items:center; gap:4px; }
      #btfw-ratings .btfw-ratings__actions button { display:inline-flex; align-items:center; justify-content:center; min-width:0; }
      #btfw-ratings .btfw-ratings__stars { display:flex; align-items:center; gap:3px; }
      #btfw-ratings .btfw-ratings__stars button { appearance:none; border:none; background:none; color:rgba(255,255,255,.32);
        cursor:pointer; padding:0 2px; font-size:18px; line-height:1; transition:color .15s ease; }
      #btfw-ratings[data-loading="true"] .btfw-ratings__stars button,
      #btfw-ratings[data-disabled="true"] .btfw-ratings__stars button { cursor:default; pointer-events:none; opacity:.55; }
      #btfw-ratings .btfw-ratings__stars button[data-active="true"],
      #btfw-ratings .btfw-ratings__stars button:hover,
      #btfw-ratings .btfw-ratings__stars button:focus-visible { color: var(--btfw-rating-accent, #ffd166); }
      #btfw-ratings .btfw-ratings__meta-group { display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:12px; opacity:.8; }
      #btfw-ratings .btfw-ratings__meta { white-space:nowrap; }
      #btfw-ratings .btfw-ratings__self { font-size:12px; opacity:.9; color: var(--btfw-rating-accent, #ffd166); }
      #btfw-ratings .btfw-ratings__error { font-size:11px; color:#ff879d; }
      #btfw-ratings .btfw-ratings__refresh,
      #btfw-ratings .btfw-ratings__list { appearance:none; border:none; background:none; color:rgba(255,255,255,.45);
        cursor:pointer; padding:0 4px; font-size:14px; line-height:1; transition:color .15s ease; }
      #btfw-ratings .btfw-ratings__list { font-size:13px; }
      #btfw-ratings .btfw-ratings__refresh:hover,
      #btfw-ratings .btfw-ratings__refresh:focus-visible,
      #btfw-ratings .btfw-ratings__list:hover,
      #btfw-ratings .btfw-ratings__list:focus-visible { color:rgba(255,255,255,.82); }
      #btfw-ratings-modal .modal-card { width: min(92vw, 960px); max-height: 90vh; display:flex; flex-direction:column; }
      #btfw-ratings-modal .modal-card-head,
      #btfw-ratings-modal .modal-card-foot { background: rgba(12, 14, 22, .92); color:#fff; }
      #btfw-ratings-modal .modal-card-head { border-bottom: 1px solid rgba(255,255,255,.08); }
      #btfw-ratings-modal .modal-card-foot { border-top: 1px solid rgba(255,255,255,.08); justify-content:flex-end; }
      #btfw-ratings-modal .modal-card-title { font-size:1.125rem; }
      #btfw-ratings-modal .modal-card-body { background: rgba(12, 14, 22, .88); padding: 18px; color: #f4f6ff; }
      #btfw-ratings-modal .btfw-ratings-modal__scroll { max-height: min(70vh, 640px); overflow-y: auto; padding-right: 6px; }
      #btfw-ratings-modal .btfw-ratings-modal__loading,
      #btfw-ratings-modal .btfw-ratings-modal__error { font-size: 0.95rem; text-align: center; padding: 24px 12px; }
      #btfw-ratings-modal .btfw-ratings-modal__error { color: #ff879d; }
      #btfw-ratings-modal .btfw-ratings-modal__list { display:flex; flex-direction:column; gap:12px; }
      #btfw-ratings-modal .btfw-ratings-modal__list[data-layout="grid"] { display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:16px; }
      #btfw-ratings-modal .btfw-ratings-modal__item { display:flex; gap:12px; background: rgba(255,255,255,0.04); border-radius: 10px; padding:12px; color:inherit; text-decoration:none; min-height:120px; }
      #btfw-ratings-modal .btfw-ratings-modal__list[data-layout="grid"] .btfw-ratings-modal__item { flex-direction:column; min-height:0; }
      #btfw-ratings-modal .btfw-ratings-modal__poster { position:relative; flex:0 0 auto; width:84px; aspect-ratio:2 / 3; border-radius:8px; overflow:hidden; background: rgba(255,255,255,0.07);
        display:flex; align-items:center; justify-content:center; font-weight:600; font-size:1.25rem; color:rgba(255,255,255,0.64); text-transform:uppercase; }
      #btfw-ratings-modal .btfw-ratings-modal__poster img { width:100%; height:100%; object-fit:cover; display:block; }
      #btfw-ratings-modal .btfw-ratings-modal__poster img[hidden] { display:none !important; }
      #btfw-ratings-modal .btfw-ratings-modal__poster[data-has-poster="true"] .btfw-ratings-modal__poster-fallback { display:none !important; }
      #btfw-ratings-modal .btfw-ratings-modal__list[data-layout="grid"] .btfw-ratings-modal__poster { width:100%; }
      #btfw-ratings-modal .btfw-ratings-modal__details { display:flex; flex-direction:column; gap:6px; flex:1 1 auto; }
      #btfw-ratings-modal .btfw-ratings-modal__title { font-size:1rem; font-weight:600; display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
      #btfw-ratings-modal .btfw-ratings-modal__rank { display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.12); color: var(--btfw-rating-accent, #ffd166);
        border-radius:999px; font-size:0.75rem; padding:2px 8px; letter-spacing:0.04em; text-transform:uppercase; }
      #btfw-ratings-modal .btfw-ratings-modal__name { flex:1 1 auto; }
      #btfw-ratings-modal .btfw-ratings-modal__year { opacity:0.7; font-size:0.9rem; }
      #btfw-ratings-modal .btfw-ratings-modal__scoreline { display:flex; align-items:center; gap:8px; font-size:0.95rem; }
      #btfw-ratings-modal .btfw-ratings-modal__avg { font-weight:600; color: var(--btfw-rating-accent, #ffd166); }
      #btfw-ratings-modal .btfw-ratings-modal__votes { font-size:0.85rem; opacity:0.85; }
      #btfw-ratings-modal .btfw-ratings-modal__stars { position:relative; display:inline-block; font-size:0.9rem; line-height:1; letter-spacing:2px; min-width:5ch; }
      #btfw-ratings-modal .btfw-ratings-modal__stars-base { color:rgba(255,255,255,0.18); }
      #btfw-ratings-modal .btfw-ratings-modal__stars-fill { color:var(--btfw-rating-accent, #ffd166); position:absolute; inset:0; overflow:hidden; white-space:nowrap; }
      #btfw-ratings-modal .btfw-ratings-modal__empty { padding:36px 12px; text-align:center; opacity:0.85; font-size:0.95rem; }
      @media (max-width: 720px) {
        #btfw-ratings { padding-top:6px; font-size:12px; }
        #btfw-ratings .btfw-ratings__label { letter-spacing:0.01em; }
        #btfw-ratings .btfw-ratings__header { flex-wrap:wrap; }
        #btfw-ratings .btfw-ratings__actions { width:100%; justify-content:flex-start; margin-left:0; }
        #btfw-ratings .btfw-ratings__actions button { padding:0 2px; }
        #btfw-ratings-modal .modal-card { width:94vw; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureEndpoint() {
    if (state.endpoint) return state.endpoint;
    const cfg = window.BTFW_CONFIG?.ratings || {};
    const candidates = [
      document.body?.dataset?.btfwRatingsEndpoint,
      cfg.endpoint,
      window.BTFW_RATINGS_ENDPOINT,
      window.BTFW_CONFIG?.ratingsEndpoint,
      window.BTFW_RATINGS_API,
      (() => { try { return localStorage.getItem("btfw:ratings:endpoint") || null; } catch { return null; } })()
    ];
    const endpoint = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
    if (endpoint) {
      state.endpoint = endpoint.trim().replace(/\/$/, "");
      return state.endpoint;
    }
    return null;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function sanitizePosterUrl(url) {
    const str = String(url ?? "").trim();
    if (!str) return "";
    if (/^https?:/i.test(str) || /^data:image\//i.test(str) || /^blob:/i.test(str)) return str;
    if (str.startsWith("//")) return `https:${str}`;
    return "";
  }

  function formatVotes(votes) {
    const num = Number(votes);
    const safe = Number.isFinite(num) && num >= 0 ? num : 0;
    let formatted = String(safe);
    try { formatted = safe.toLocaleString(); } catch (_) {}
    return `${formatted} vote${safe === 1 ? "" : "s"}`;
  }

  function buildStarDisplay(avg) {
    const clamped = Math.min(5, Math.max(0, Number(avg) || 0));
    const pct = (clamped / 5) * 100;
    return `
      <span class="btfw-ratings-modal__stars" aria-hidden="true">
        <span class="btfw-ratings-modal__stars-base">★★★★★</span>
        <span class="btfw-ratings-modal__stars-fill" style="width:${pct}%">★★★★★</span>
      </span>
    `;
  }

  function pickString(candidates) {
    for (const candidate of candidates) {
      const value = safeEvaluate(candidate);
      if (value == null) continue;
      const str = String(value).trim();
      if (str) return str;
    }
    return "";
  }

  function pickNumber(candidates) {
    for (const candidate of candidates) {
      const value = safeEvaluate(candidate);
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
    return NaN;
  }

  function extractYear(raw) {
    const yearSource = pickString([
      raw?.year,
      raw?.releaseYear,
      raw?.release_year,
      raw?.releaseDate,
      raw?.release_date,
      raw?.firstAirDate,
      raw?.first_air_date,
      raw?.date,
      raw?.media?.year,
      raw?.media?.releaseDate,
      raw?.media?.released,
      raw?.tmdb?.release_date,
      raw?.tmdb?.first_air_date,
    ]);
    if (!yearSource) return "";
    const match = yearSource.match(/(19|20)\d{2}/);
    return match ? match[0] : "";
  }

  function resolveTMDBKey() {
    try {
      const cfg = (window.BTFW_CONFIG && typeof window.BTFW_CONFIG === "object") ? window.BTFW_CONFIG : {};
      const tmdbObj = (cfg.tmdb && typeof cfg.tmdb === "object") ? cfg.tmdb : {};
      const cfgKey = typeof tmdbObj.apiKey === "string" ? tmdbObj.apiKey.trim() : "";
      const legacyCfg = typeof cfg.tmdbKey === "string" ? cfg.tmdbKey.trim() : "";
      let lsKey = "";
      try { lsKey = (localStorage.getItem("btfw:tmdb:key") || "").trim(); } catch (_) {}
      const g = (v) => (v == null ? "" : String(v)).trim();
      const globalKey = g(window.TMDB_API_KEY) || g(window.BTFW_TMDB_KEY) || g(window.tmdb_key);
      const bodyKey = g(document.body?.dataset?.tmdbKey);
      const key = cfgKey || legacyCfg || lsKey || globalKey || bodyKey;
      return key || null;
    } catch (_) {
      return null;
    }
  }

  function ensureLeaderboardModal() {
    if (leaderboardState.modal?.isConnected) return leaderboardState.modal;
    const modal = document.createElement("div");
    modal.id = "btfw-ratings-modal";
    modal.className = "modal";
    modal.dataset.btfwModalState = "closed";
    modal.setAttribute("hidden", "");
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="modal-background"></div>
      <div class="modal-card btfw-modal" role="dialog" aria-modal="true" aria-labelledby="btfw-ratings-modal-title">
        <header class="modal-card-head">
          <p class="modal-card-title" id="btfw-ratings-modal-title">Community Ratings</p>
          <button class="delete" type="button" aria-label="Close"></button>
        </header>
        <section class="modal-card-body">
          <div class="btfw-ratings-modal__scroll">
            <div class="btfw-ratings-modal__loading">Loading ratings…</div>
            <div class="btfw-ratings-modal__error" hidden></div>
            <div class="btfw-ratings-modal__list" hidden aria-live="polite"></div>
          </div>
        </section>
        <footer class="modal-card-foot">
          <button type="button" class="button is-link btfw-ratings-modal__close">Close</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector(".modal-background")?.addEventListener("click", closeLeaderboardModal);
    modal.querySelector(".delete")?.addEventListener("click", closeLeaderboardModal);
    modal.querySelector(".btfw-ratings-modal__close")?.addEventListener("click", closeLeaderboardModal);
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeLeaderboardModal();
    });

    leaderboardState.modal = modal;
    leaderboardState.scrollEl = modal.querySelector(".btfw-ratings-modal__scroll");
    leaderboardState.listEl = modal.querySelector(".btfw-ratings-modal__list");
    leaderboardState.loadingEl = modal.querySelector(".btfw-ratings-modal__loading");
    leaderboardState.errorEl = modal.querySelector(".btfw-ratings-modal__error");
    return modal;
  }

  function setLeaderboardLoading(isLoading) {
    leaderboardState.loading = !!isLoading;
    if (leaderboardState.loadingEl) {
      leaderboardState.loadingEl.hidden = !isLoading;
    }
    if (isLoading && leaderboardState.listEl) {
      leaderboardState.listEl.setAttribute("hidden", "");
    }
  }

  function setLeaderboardError(message) {
    if (!leaderboardState.errorEl) return;
    if (message) {
      leaderboardState.errorEl.hidden = false;
      leaderboardState.errorEl.textContent = message;
    } else {
      leaderboardState.errorEl.hidden = true;
      leaderboardState.errorEl.textContent = "";
    }
  }

  function normalizeLeaderboardPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    const keys = ["items", "results", "list", "entries", "data", "movies", "records", "leaderboard", "ratings"];
    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value)) return value;
    }
    if (typeof payload === "object") {
      const values = Object.values(payload);
      if (values.length && values.every((item) => item && typeof item === "object")) {
        return values;
      }
    }
    return [];
  }

  function normalizeLeaderboardItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const title = pickString([
      raw.title,
      raw.name,
      raw.mediaTitle,
      raw.displayTitle,
      raw.media?.title,
      raw.lookup?.title,
    ]);
    if (!title) return null;
    const parsedTitle = parseTitleForSearch(title);

    const avg = Math.min(5, Math.max(0, pickNumber([
      raw.avg,
      raw.average,
      raw.score,
      raw.rating,
      raw.mean,
      raw.averageScore,
    ]) || 0));

    const votes = Math.max(0, Math.round(pickNumber([
      raw.votes,
      raw.voteCount,
      raw.count,
      raw.totalVotes,
      raw.ratingCount,
      raw.total,
    ]) || 0));

    const posterPath = pickString([
      raw.posterPath,
      raw.poster_path,
      raw.poster,
      raw.artwork,
      raw.image,
      raw.media?.poster,
      raw.media?.posterPath,
      raw.tmdb?.poster_path,
    ]);

    let posterUrl = pickString([
      raw.posterUrl,
      raw.posterURL,
      raw.imageUrl,
      raw.imageURL,
      raw.art,
    ]);

    if (!posterUrl && posterPath) {
      if (/^https?:/i.test(posterPath)) {
        posterUrl = posterPath;
      } else if (posterPath.startsWith("//")) {
        posterUrl = `https:${posterPath}`;
      } else if (posterPath.startsWith("/")) {
        posterUrl = `https://image.tmdb.org/t/p/w342${posterPath}`;
      }
    }

    const safePoster = sanitizePosterUrl(posterUrl);

    const tmdbId = pickString([raw.tmdbId, raw.tmdb_id, raw.tmdb?.id]);
    const tmdbType = pickString([raw.tmdbType, raw.tmdb_type, raw.type, raw.mediaType, raw.media_type, raw.tmdb?.media_type]);
    let year = extractYear(raw);
    if (!year) {
      year = parsedTitle.year;
    }

    const id = pickString([raw.mediaKey, raw.key, raw.id, raw.media?.id, raw.media?.key]) || title;

    return {
      id,
      title,
      avg: Number.isFinite(avg) ? avg : 0,
      votes: Number.isFinite(votes) ? votes : 0,
      posterUrl: safePoster,
      tmdbId: tmdbId || "",
      tmdbType: tmdbType || "",
      year,
      searchTitle: parsedTitle.title || cleanTitleForSearch(title),
      searchYear: parsedTitle.year || year || "",
    };
  }

  function sortLeaderboardItems(items) {
    return items.sort((a, b) => {
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
  }

  function renderLeaderboardItem(item, index) {
    const title = escapeHtml(item.title);
    const avg = Number(item.avg) || 0;
    const avgText = avg ? avg.toFixed(2) : "0.00";
    const votesText = formatVotes(item.votes);
    const poster = item.posterUrl ? escapeHtml(item.posterUrl) : "";
    const fallback = escapeHtml((item.title || "?").trim().charAt(0) || "?");
    const year = item.year ? `<span class="btfw-ratings-modal__year">(${escapeHtml(item.year)})</span>` : "";
    return `
      <article class="btfw-ratings-modal__item" data-index="${index}">
        <div class="btfw-ratings-modal__poster" data-has-poster="${item.posterUrl ? "true" : "false"}">
          <img src="${poster}" alt="Poster for ${title}" loading="lazy" ${item.posterUrl ? "" : "hidden"}>
          <div class="btfw-ratings-modal__poster-fallback"${item.posterUrl ? " hidden" : ""} aria-hidden="true">${fallback}</div>
        </div>
        <div class="btfw-ratings-modal__details">
          <div class="btfw-ratings-modal__title">
            <span class="btfw-ratings-modal__rank">#${index + 1}</span>
            <span class="btfw-ratings-modal__name">${title}</span>
            ${year}
          </div>
          <div class="btfw-ratings-modal__scoreline">
            ${buildStarDisplay(avg)}
            <span class="btfw-ratings-modal__avg">${avgText}★</span>
          </div>
          <div class="btfw-ratings-modal__votes">${escapeHtml(votesText)}</div>
        </div>
      </article>
    `;
  }

  function renderLeaderboard() {
    const listEl = leaderboardState.listEl;
    if (!listEl) return;
    const items = Array.isArray(leaderboardState.items) ? leaderboardState.items : [];
    const useGrid = !!leaderboardState.tmdbKey || items.some((item) => item.posterUrl);
    listEl.dataset.layout = useGrid ? "grid" : "list";

    if (!items.length) {
      listEl.innerHTML = '<div class="btfw-ratings-modal__empty">No movies have been rated yet.</div>';
      listEl.removeAttribute("hidden");
      return;
    }

    listEl.innerHTML = items.map((item, index) => renderLeaderboardItem(item, index)).join("");
    listEl.removeAttribute("hidden");
  }

  function updatePosterElement(index, url) {
    if (!leaderboardState.modal) return;
    const card = leaderboardState.modal.querySelector(`.btfw-ratings-modal__item[data-index="${index}"]`);
    if (!card) return;
    const poster = card.querySelector(".btfw-ratings-modal__poster");
    if (!poster) return;
    const img = poster.querySelector("img");
    const fallback = poster.querySelector(".btfw-ratings-modal__poster-fallback");

    if (url) {
      if (img) {
        img.src = url;
        img.removeAttribute("hidden");
        const name = card.querySelector(".btfw-ratings-modal__name")?.textContent?.trim() || "movie";
        img.alt = `Poster for ${name}`;
      }
      if (fallback) fallback.setAttribute("hidden", "");
      poster.dataset.hasPoster = "true";
    } else {
      if (img) {
        img.setAttribute("hidden", "");
        img.removeAttribute("src");
      }
      if (fallback) fallback.removeAttribute("hidden");
      poster.dataset.hasPoster = "false";
    }
  }

  async function fetchPosterForItem(item) {
    if (!item || !leaderboardState.tmdbKey) return null;
    const searchTitle = item.searchTitle || cleanTitleForSearch(item.title);
    if (!searchTitle) return null;

    const year = item.searchYear || item.year || "";
    const cacheParts = [];
    if (item.tmdbId) cacheParts.push(`id:${String(item.tmdbId).toLowerCase()}`);
    cacheParts.push(`t:${searchTitle.toLowerCase()}`);
    if (year) cacheParts.push(`y:${year}`);
    const cacheKey = cacheParts.join("::");

    if (leaderboardState.tmdbCache.has(cacheKey)) {
      const cached = leaderboardState.tmdbCache.get(cacheKey);
      return cached || null;
    }

    const key = leaderboardState.tmdbKey;
    const normalizedType = String(item.tmdbType || "").toLowerCase();
    const normalizedId = String(item.tmdbId || "").trim();

    async function fetchPosterById(id, type) {
      if (!id || !type) return null;
      const path = type === "tv" ? `tv/${id}` : type === "movie" ? `movie/${id}` : "";
      if (!path) return null;
      try {
        const url = new URL(`https://api.themoviedb.org/3/${path}`);
        url.searchParams.set("api_key", key);
        const response = await fetch(url.toString());
        if (!response.ok) return null;
        const json = await response.json();
        const posterPath = json?.poster_path;
        if (posterPath) {
          return sanitizePosterUrl(`https://image.tmdb.org/t/p/w342${posterPath}`);
        }
      } catch (error) {
        console.warn("[ratings] tmdb lookup by id failed", error);
      }
      return null;
    }

    if (normalizedId && (normalizedType === "movie" || normalizedType === "tv")) {
      const directPoster = await fetchPosterById(normalizedId, normalizedType);
      if (directPoster) {
        leaderboardState.tmdbCache.set(cacheKey, directPoster);
        return directPoster;
      }
    }

    const searchConfigs = [];
    if (normalizedType === "movie") {
      searchConfigs.push({ path: "search/movie", type: "movie" });
    } else if (normalizedType === "tv") {
      searchConfigs.push({ path: "search/tv", type: "tv" });
    } else {
      searchConfigs.push({ path: "search/movie", type: "movie" });
      searchConfigs.push({ path: "search/tv", type: "tv" });
    }
    searchConfigs.push({ path: "search/multi", type: "multi" });

    for (const config of searchConfigs) {
      try {
        const url = new URL(`https://api.themoviedb.org/3/${config.path}`);
        url.searchParams.set("api_key", key);
        url.searchParams.set("include_adult", "false");
        url.searchParams.set("query", searchTitle);
        if (year) {
          if (config.type === "movie" || config.type === "multi") {
            url.searchParams.set("year", year);
            url.searchParams.set("primary_release_year", year);
          }
          if (config.type === "tv" || config.type === "multi") {
            url.searchParams.set("first_air_date_year", year);
          }
        }
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        const results = Array.isArray(json?.results) ? json.results : [];
        let chosen = null;
        for (const candidate of results) {
          if (!candidate || !candidate.poster_path) continue;
          const candidateId = candidate.id != null ? String(candidate.id) : "";
          if (normalizedId && candidateId === normalizedId) {
            chosen = candidate;
            break;
          }
          if (!chosen) {
            chosen = candidate;
          }
          if (config.type === "movie" || config.type === "tv") {
            break;
          }
          const candidateType = String(candidate.media_type || "").toLowerCase();
          if (normalizedType && candidateType === normalizedType) break;
          if (!normalizedType && (candidateType === "movie" || candidateType === "tv")) break;
        }
        if (chosen?.poster_path) {
          const posterUrl = sanitizePosterUrl(`https://image.tmdb.org/t/p/w342${chosen.poster_path}`);
          leaderboardState.tmdbCache.set(cacheKey, posterUrl);
          return posterUrl;
        }
      } catch (error) {
        console.warn("[ratings] tmdb lookup failed", error);
      }
    }

    leaderboardState.tmdbCache.set(cacheKey, "");
    return null;
  }

  async function hydrateLeaderboardPosters(items) {
    if (!leaderboardState.tmdbKey) return;
    const limit = Math.min(items.length, 60);
    for (let i = 0; i < limit; i += 1) {
      const item = items[i];
      if (!item || item.posterUrl) continue;
      const poster = await fetchPosterForItem(item);
      if (poster) {
        item.posterUrl = poster;
        updatePosterElement(i, poster);
      }
      if (!leaderboardState.modal || leaderboardState.modal.dataset.btfwModalState === "closed") {
        return;
      }
    }
  }

  async function fetchLeaderboardData(signal) {
    const endpoint = ensureEndpoint();
    if (!endpoint) return [];
    const channel = resolveChannelName();
    const params = new URLSearchParams({ channel });
    params.set("limit", "200");
    params.set("min", "1");
    const base = endpoint.replace(/\/$/, "");
    const paths = ["leaderboard", "top", "list", "history", ""];
    let lastError = null;

    for (const path of paths) {
      const url = path ? `${base}/${path}` : base;
      const target = `${url}?${params.toString()}`;
      try {
        const response = await fetch(target, { signal, credentials: "omit" });
        if (response.status === 404 || response.status === 405) {
          continue;
        }
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`HTTP ${response.status} ${text}`.trim());
        }
        const payload = await response.json();
        const normalized = normalizeLeaderboardPayload(payload)
          .map((item) => normalizeLeaderboardItem(item))
          .filter(Boolean)
          .filter((item) => item.votes > 0);
        return sortLeaderboardItems(normalized);
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        lastError = error;
      }
    }

    if (lastError) throw lastError;
    return [];
  }

  async function loadLeaderboard() {
    const modal = ensureLeaderboardModal();
    const endpoint = ensureEndpoint();
    if (!endpoint) {
      setLeaderboardLoading(false);
      setLeaderboardError("Ratings are disabled for this channel.");
      if (leaderboardState.listEl) {
        leaderboardState.listEl.innerHTML = "";
        leaderboardState.listEl.setAttribute("hidden", "");
      }
      return;
    }

    if (leaderboardState.abortController) {
      leaderboardState.abortController.abort();
    }

    const controller = new AbortController();
    leaderboardState.abortController = controller;
    const nextKey = resolveTMDBKey();
    if (nextKey !== leaderboardState.tmdbKey) {
      leaderboardState.tmdbCache.clear();
    }
    leaderboardState.tmdbKey = nextKey;

    if (leaderboardState.loadingEl) leaderboardState.loadingEl.textContent = "Loading ratings…";
    setLeaderboardError("");
    setLeaderboardLoading(true);
    if (leaderboardState.scrollEl) leaderboardState.scrollEl.scrollTop = 0;

    try {
      const items = await fetchLeaderboardData(controller.signal);
      leaderboardState.items = items;
      renderLeaderboard();
      setLeaderboardLoading(false);
      await hydrateLeaderboardPosters(items);
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("[ratings] leaderboard fetch failed", error);
      setLeaderboardLoading(false);
      setLeaderboardError("Unable to load rated movies right now.");
      if (leaderboardState.listEl) {
        leaderboardState.listEl.innerHTML = "";
        leaderboardState.listEl.setAttribute("hidden", "");
      }
    } finally {
      if (leaderboardState.abortController === controller) {
        leaderboardState.abortController = null;
      }
    }

    if (modal) {
      requestAnimationFrame(() => {
        const closeBtn = modal.querySelector(".btfw-ratings-modal__close");
        if (!closeBtn) return;
        try { closeBtn.focus({ preventScroll: true }); }
        catch (_) {
          try { closeBtn.focus(); } catch (_) {}
        }
      });
    }
  }

  function openLeaderboardModal() {
    const modal = ensureLeaderboardModal();
    motion.openModal(modal);
    loadLeaderboard();
  }

  function closeLeaderboardModal() {
    if (leaderboardState.abortController) {
      leaderboardState.abortController.abort();
      leaderboardState.abortController = null;
    }
    if (leaderboardState.modal) {
      motion.closeModal(leaderboardState.modal);
    }
  }

  function ensureAnonId() {
    try {
      let id = localStorage.getItem(LS_ANON_ID_KEY);
      if (id && id.length >= 8) return id;
      const bytes = new Uint8Array(12);
      (window.crypto || window.msCrypto).getRandomValues(bytes);
      id = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(LS_ANON_ID_KEY, id);
      return id;
    } catch {
      return "anon" + Math.random().toString(36).slice(2, 8);
    }
  }

  function hashString(input) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }

  function stripTitlePrefix(title) {
    return String(title || "").replace(/^\s*(?:currently|now)\s*playing\s*[:\-]\s*/i, "").replace(/[\s]+/g, " ").trim();
  }

  function normalizeTitleForKey(raw) {
    // lowercase, strip diacritics, remove punctuation, collapse spaces
    let s = String(raw || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    s = s.replace(/[\[\](){}:;\.,!?'"`~_|\\/+-]+/g, " ");
    s = s.replace(/\s+/g, " ").trim();
    return s;
  }

  function extractYearFromTitle(raw) {
    const s = String(raw || "");
    const m = s.match(/(?:\(|\b)(19|20)\d{2}(?:\)|\b)(?!.*(19|20)\d{2})/);
    return m ? m[0].replace(/[()]/g, "") : "";
  }

  function durationBucket(seconds) {
    const sec = Number(seconds) || 0;
    return Math.round((sec / 60) / 5) * 5;
  }

  function deriveMediaKey(media, fallbackTitle) {
    const duration = Number(media?.seconds ?? media?.duration ?? media?.length ?? 0) || 0;
    const titleRaw = stripTitlePrefix(media?.title || fallbackTitle || "");
    if (!titleRaw) return "";

    const year = extractYearFromTitle(titleRaw);
    const baseTitle = normalizeTitleForKey(
      year ? titleRaw.replace(new RegExp(`\\(?${year}\\)?`), "") : titleRaw
    );

    if (!baseTitle) return "";

    const keyPayload = `t:${baseTitle}|y:${year || "na"}`;
    return `title:${hashString(keyPayload)}`;
  }

  function normalizeMediaData(media) {
    if (!media || typeof media !== "object") return null;
    const lookupTitle = state.lookup?.canonical || state.lookup?.query || state.lookup?.original || "";
    const rawTitle = stripTitlePrefix(media.title || lookupTitle || "");
    const duration = Number(media.seconds ?? media.duration ?? media.length ?? 0) || 0;
    const currentTime = Number(media.currentTime ?? media.time ?? media.position ?? 0) || 0;
    const key = deriveMediaKey(media, rawTitle || lookupTitle);
    if (!key) return null;
    return { key, title: rawTitle, duration, currentTime,
      provider: (media.type || media.mediaType || media.provider || "").toString().trim(),
      id: (media.id || media.videoId || media.vid || media.uid || "").toString().trim() };
  }

  function ensureUI() {
    if (state.container?.isConnected) return state.container;
    ensureStyles();

    const topbarLeft = $("#chatwrap .btfw-chat-topbar .btfw-chat-topbar-left");
    const slot = $("#btfw-nowplaying-slot");
    const host = topbarLeft || slot || $("#chatwrap .btfw-chat-topbar") || $("#chatwrap") || document.body;

    let wrapper = host.querySelector("#btfw-ratings-wrapper");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = "btfw-ratings-wrapper";
      wrapper.className = "btfw-ratings-wrapper";

      if (topbarLeft && slot && slot.parentElement === topbarLeft) {
        slot.insertAdjacentElement("afterend", wrapper);
      } else {
        host.appendChild(wrapper);
      }
    }

    const el = document.createElement("div");
    el.id = "btfw-ratings";
    el.hidden = true;
    el.innerHTML = `
      <div class="btfw-ratings__header">
        <span class="btfw-ratings__label">Rate</span>
        <div class="btfw-ratings__actions">
          <button type="button" class="btfw-ratings__list" title="Show rated movies" aria-label="Show rated movies">≣</button>
          <button type="button" class="btfw-ratings__refresh" title="Refresh rating" aria-label="Refresh rating">⟳</button>
        </div>
      </div>
      <div class="btfw-ratings__stars" role="group" aria-label="Rate current media">
        ${STAR_VALUES.map(v => `<button type="button" data-score="${v}" aria-label="Rate ${v} star${v===1?"":"s"}">★</button>`).join("")}
      </div>
      <div class="btfw-ratings__meta-group">
        <span class="btfw-ratings__meta" aria-live="polite"></span>
        <span class="btfw-ratings__self" hidden></span>
      </div>
      <span class="btfw-ratings__error" hidden></span>
    `;
    wrapper.appendChild(el);

    state.container = el;
    state.stars = Array.from(el.querySelectorAll("button[data-score]"));
    state.statusNode = el.querySelector(".btfw-ratings__meta");
    state.selfNode = el.querySelector(".btfw-ratings__self");
    state.errorNode = el.querySelector(".btfw-ratings__error");

    el.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button[data-score]");
      if (!btn) return;
      const score = Number(btn.dataset.score);
      if (Number.isFinite(score)) submitVote(score);
    });

    el.addEventListener("mousemove", (ev) => {
      const btn = ev.target?.closest?.("button[data-score]");
      if (!btn) return;
      const score = Number(btn.dataset.score);
      if (Number.isFinite(score)) highlightStars(score);
    });

    el.addEventListener("mouseleave", () => highlightStars(state.lastVote || 0));

    el.querySelector(".btfw-ratings__list")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openLeaderboardModal();
    });
    el.querySelector(".btfw-ratings__refresh")?.addEventListener("click", () => refreshStats(true));
    return el;
  }

  function highlightStars(score) {
    state.stars.forEach((star) => {
      const v = Number(star.dataset.score);
      star.dataset.active = v <= score ? "true" : "false";
    });
  }

  function setStatus(text) { if (state.statusNode) state.statusNode.textContent = text || ""; }
  function setSelfStatus(text) {
    if (!state.selfNode) return;
    if (text) { state.selfNode.hidden = false; state.selfNode.textContent = text; }
    else { state.selfNode.hidden = true; state.selfNode.textContent = ""; }
  }
  function setError(message) {
    if (!state.errorNode) return;
    if (message) { state.errorNode.hidden = false; state.errorNode.textContent = message; }
    else { state.errorNode.hidden = true; state.errorNode.textContent = ""; }
  }
  function setLoading(val) { if (state.container) { state.isSubmitting = !!val; state.container.dataset.loading = val?"true":"false"; } }

  function hideRatings() {
    if (!state.container) return;
    state.container.hidden = true;
    state.container.dataset.disabled = "true";
    state.ratingVisible = false;
  }

  function showRatings() {
    if (!state.container) return;
    state.container.hidden = false;
    state.container.dataset.disabled = "false";
    state.ratingVisible = true;

    if (state.stats && typeof state.stats.avg === "number") {
      const avg = state.stats.avg;
      const votes = state.stats.votes || 0;
      const avgText = votes > 0 ? `${avg.toFixed(2)}★ (${votes} vote${votes===1?"":"s"})` : "No ratings yet";
      setStatus(avgText);
    } else {
      setStatus("No ratings yet");
    }

    if (state.lastVote) {
      setSelfStatus(`Your rating: ${state.lastVote}★`);
      highlightStars(state.lastVote);
    } else {
      setSelfStatus("");
      highlightStars(0);
    }
  }

  function updateVisibility() {
    if (!state.container) return;
    const endpoint = ensureEndpoint();
    if (!endpoint || !state.currentKey || !state.currentMedia) {
      hideRatings();
      return;
    }

    updatePlaybackFromPlayer();
    const duration = getEffectiveDuration();
    const currentTime = getEffectiveCurrentTime(duration);

    if (!shouldDisplayRatings(duration, currentTime)) {
      hideRatings();
      return;
    }

    const wasVisible = state.ratingVisible;
    showRatings();

    if (!wasVisible && state.ratingVisible) {
      announceRatingWindow();
    }
  }

  function handleLookupEvent(event) {
    if (!event?.detail) return;
    state.lookup = { ...event.detail };
    if (!state.currentMedia && state.lookup?.original) {
      const baseTitle = stripTitlePrefix(state.lookup.original);
      const key = deriveMediaKey({ title: baseTitle, seconds: 0 }, baseTitle);
      state.currentMedia = { key, title: baseTitle, duration: 0, provider: "", id: "" };
      state.currentKey = state.currentMedia.key;
    }
    updateVisibility();
  }

  function currentUsername() {
    try { return getClient()?.name || ""; } catch { return ""; }
  }

  function currentUserIdentifier() { return currentUsername() || ensureAnonId(); }

  function buildUserKey() {
    const channel = resolveChannelName();
    const identity = currentUserIdentifier();
    return `u_${hashString(`${channel}::${identity}`)}`;
  }

  function scheduleStatsRefresh() {
    if (state.statsTimer) { clearTimeout(state.statsTimer); state.statsTimer = null; }
    state.statsTimer = setTimeout(() => refreshStats(false), STATS_REFRESH_INTERVAL_MS);
  }

  async function refreshStats(force) {
    if (!state.currentKey) return;
    const endpoint = ensureEndpoint();
    if (!endpoint) { updateVisibility(); return; }

    const now = Date.now();
    if (!force && now - state.lastStatsRequest < STATS_DEBOUNCE_MS) return;
    state.lastStatsRequest = now;

    const channel = resolveChannelName();
    const params = new URLSearchParams({ channel, mediaKey: state.currentKey });
    try { params.set("userKey", buildUserKey()); } catch {}
    const url = `${endpoint}/stats?${params.toString()}`;

    try {
      const resp = await fetch(url, { credentials: "omit" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const payload = await resp.json();
      const u = Number(payload?.userScore);
      state.stats = {
        avg: Number(payload?.avg) || 0,
        votes: Number(payload?.votes) || 0,
        user: Number.isFinite(u) ? u : null,
      };
      if (state.stats.user) {
        state.lastVote = state.stats.user;
        // persist optimistic self-vote cache
        try { localStorage.setItem(LS_SELF_PREFIX + state.currentKey, String(state.lastVote)); } catch {}
      } else {
        // attempt to load cached self-vote if any
        try {
          const cached = Number(localStorage.getItem(LS_SELF_PREFIX + state.currentKey));
          if (Number.isFinite(cached) && cached >= 1 && cached <= 5) {
            state.lastVote = cached;
          }
        } catch {}
      }
      setError("");
    } catch (err) {
      console.warn("[ratings] stats fetch failed", err);
      setError("Stats unavailable");
      // fallback: load cached self vote for UI
      try {
        const cached = Number(localStorage.getItem(LS_SELF_PREFIX + state.currentKey));
        if (Number.isFinite(cached) && cached >= 1 && cached <= 5) state.lastVote = cached;
      } catch {}
    }

    updateVisibility();
    scheduleStatsRefresh();
  }

  async function submitVote(score) {
    if (!state.currentKey || state.isSubmitting) return;
    const endpoint = ensureEndpoint();
    if (!endpoint) { updateVisibility(); return; }

    const channel = resolveChannelName();
    const media = state.currentMedia;
    if (!media) return;

    setLoading(true); setError("");

    const payload = {
      channel,
      mediaKey: state.currentKey,
      title: media.title || state.lookup?.canonical || state.lookup?.original || "",
      duration: media.duration || 0,
      userKey: buildUserKey(),
      score
    };

    try {
      const response = await fetch(`${endpoint}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "omit"
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      // optimistic update
      state.lastVote = score;
      try { localStorage.setItem(LS_SELF_PREFIX + state.currentKey, String(score)); } catch {}
      highlightStars(score);
      setSelfStatus(`Your rating: ${score}★`);
      await refreshStats(true);
    } catch (error) {
      console.warn("[ratings] vote failed", error);
      setError("Vote failed, try again");
    } finally {
      setLoading(false);
    }
  }

  function setMedia(media) {
    stopPlaybackPolling();
    if (state.statsTimer) { clearTimeout(state.statsTimer); state.statsTimer = null; }
    const normalized = normalizeMediaData(media);
    if (!normalized) {
      state.currentMedia = null;
      state.currentKey = "";
      state.stats = null;
      state.lastVote = null;
      state.playback.currentTime = 0;
      state.playback.duration = 0;
      state.ratingVisible = false;
      state.ratingWindowAnnounced = false;
      setSelfStatus("");
      highlightStars(0);
      updateVisibility();
      return;
    }

    state.currentMedia = normalized;
    state.currentKey = normalized.key;
    state.stats = null;
    state.lastVote = null;
    state.playback.currentTime = Number(normalized.currentTime) || 0;
    state.playback.duration = Number(normalized.duration) || 0;
    state.playback.lastUpdate = Date.now();
    state.ratingVisible = false;
    state.ratingWindowAnnounced = false;
    setSelfStatus("");
    highlightStars(0);
    updatePlaybackFromPlayer();
    updateVisibility();
    refreshStats(true);
    startPlaybackPolling();
  }

  function handleMediaUpdate(data) {
    if (!data) return;
    if (data.title && state.currentMedia) state.currentMedia.title = stripTitlePrefix(data.title);
    if (state.currentMedia) {
      const durationUpdate = pickLargestPositive([
        Number(data.seconds),
        Number(data.duration),
        Number(data.length),
        state.currentMedia.duration,
        state.playback.duration,
      ]);
      if (Number.isFinite(durationUpdate) && durationUpdate > 0) {
        state.currentMedia.duration = durationUpdate;
        state.playback.duration = durationUpdate;
      }
    }

    const nextCurrent = pickFirstNonNegative([
      Number(data.currentTime),
      Number(data.time),
      Number(data.position),
      state.playback.currentTime,
    ]);
    if (Number.isFinite(nextCurrent) && nextCurrent >= 0) {
      state.playback.currentTime = nextCurrent;
      state.playback.lastUpdate = Date.now();
      if (state.currentMedia) state.currentMedia.currentTime = nextCurrent;
    }

    updateVisibility();
  }

  function bindSocketHandlers() {
    const s = window.socket;
    if (!s || typeof s.on !== "function") return;
    try {
      s.on("changeMedia", setMedia);
      s.on("setCurrent", setMedia);
      s.on("mediaUpdate", handleMediaUpdate);
    } catch (error) {
      console.warn("[ratings] failed to bind socket handlers", error);
    }
  }

  function wrapCallbacks() {
    try {
      if (window.Callbacks && typeof window.Callbacks.changeMedia === "function") {
        const original = window.Callbacks.changeMedia;
        window.Callbacks.changeMedia = function wrapped(media) {
          try { setMedia(media); } catch {}
          return original.apply(this, arguments);
        };
      }
    } catch (error) {
      console.warn("[ratings] unable to wrap Callbacks.changeMedia", error);
    }
  }

  function announceRatingWindow() {
    if (state.ratingWindowAnnounced) return;
    state.ratingWindowAnnounced = true;

    try {
      const notify = window.BTFW_notify;
      if (notify && typeof notify.info === "function") {
        notify.info({ title: "Movie rating has started" });
      } else if (notify && typeof notify.notify === "function") {
        notify.notify({ title: "Movie rating has started", kind: "info" });
      }
    } catch (_) {}
  }

  function announceActivation() {
    if (!state.ratingVisible) return;
    announceRatingWindow();
  }

  function boot() {
    const ui = ensureUI();
    if (!ui) { setTimeout(boot, 800); return; }

    updateVisibility();
    bindSocketHandlers();
    wrapCallbacks();

    document.addEventListener("btfw:nowplayingLookup", handleLookupEvent, { passive: true });

    const s = window.socket;
    if (s && s.connected) {
      try { s.emit("playerReady"); } catch {}
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", waitForEligibility);
  else waitForEligibility();

  return {
    name: "feature:ratings",
    refresh: () => refreshStats(true),
    announceActivation,
  };
});
