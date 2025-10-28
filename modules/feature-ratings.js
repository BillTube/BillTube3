/* BTFW — feature:ratings (public media rating UI with Worker backend)
   Merged & improved version

   Key improvements vs. earlier draft:
   - Safer socket references (no bare `socket` reads)
   - Default eligibility now public (minRank defaults to 0; configurable)
   - Clear stats timer on media change to avoid late updates
   - Robust userScore parsing from /stats
   - Optional local self-vote cache for optimistic UX
   - Defensive endpoint discovery & UI states
*/

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

  const STAR_VALUES = [1, 2, 3, 4, 5];
  const DEFAULT_MIN_RANK = 0; // Allow everyone by default; override via BTFW_CONFIG.ratings.minRank
  const CHECK_INTERVAL_MS = 1200;
  const STATS_DEBOUNCE_MS = 400;
  const STATS_REFRESH_INTERVAL_MS = 20000;
  const LS_ANON_ID_KEY = "btfw:ratings:anonid";
  const LS_SELF_PREFIX = "btfw:ratings:self:"; // + mediaKey

  const state = {
    enabled: false,
    container: null,
    stars: [],
    statusNode: null,
    selfNode: null,
    errorNode: null,

    lookup: null,
    currentMedia: null,
    currentKey: "",

    stats: null,
    lastVote: null,
    isSubmitting: false,
    lastStatsRequest: 0,
    statsTimer: null,

    endpoint: configuredEndpoint || null,
    channel: null,
  };

  // ---------- Small helpers ----------
  function $(sel, root = document) { return root.querySelector(sel); }

  function getClient() {
    try { return window.CLIENT || window.client || null; } catch { return null; }
  }

  function getChannelObj() {
    try { return window.CHANNEL || window.channel || null; } catch { return null; }
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
    return ranks.length ? Math.max(...ranks) : DEFAULT_MIN_RANK;
  }

  function getClientRank() {
    const c = getClient();
    const r = Number(c?.rank);
    return Number.isFinite(r) ? r : NaN;
  }

  function isEligible() {
    // Public by default; keep rank gate if desired
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

    // If minRank is 0 and rank is NaN (guest), still allow
    if (minRank === 0 && !Number.isFinite(rank)) return true;
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
      #btfw-ratings { display:inline-flex; align-items:center; gap:6px; margin-left:12px;
        font-size:13px; font-family:inherit; color: var(--btfw-chat-dim, rgba(222,229,255,.72)); position:relative; }
      #btfw-ratings[hidden] { display:none !important; }
      #btfw-ratings .btfw-ratings__label { font-size:12px; opacity:.74; letter-spacing:.02em; }
      #btfw-ratings .btfw-ratings__stars { display:inline-flex; align-items:center; gap:2px; }
      #btfw-ratings .btfw-ratings__stars button { appearance:none; border:none; background:none; color:rgba(255,255,255,.32);
        cursor:pointer; padding:0 2px; font-size:18px; line-height:1; transition:color .15s ease; }
      #btfw-ratings[data-loading="true"] .btfw-ratings__stars button,
      #btfw-ratings[data-disabled="true"] .btfw-ratings__stars button { cursor:default; pointer-events:none; opacity:.55; }
      #btfw-ratings .btfw-ratings__stars button[data-active="true"],
      #btfw-ratings .btfw-ratings__stars button:hover,
      #btfw-ratings .btfw-ratings__stars button:focus-visible { color: var(--btfw-rating-accent, #ffd166); }
      #btfw-ratings .btfw-ratings__meta { font-size:12px; opacity:.78; white-space:nowrap; }
      #btfw-ratings .btfw-ratings__self { font-size:12px; opacity:.88; color: var(--btfw-rating-accent, #ffd166); }
      #btfw-ratings .btfw-ratings__error { position:absolute; bottom:-1.6em; left:0; font-size:11px; color:#ff879d; white-space:nowrap; }
      #btfw-ratings .btfw-ratings__refresh { appearance:none; border:none; background:none; color:rgba(255,255,255,.4);
        cursor:pointer; padding:0 4px; font-size:14px; line-height:1; transition:color .15s ease; }
      #btfw-ratings .btfw-ratings__refresh:hover, #btfw-ratings .btfw-ratings__refresh:focus-visible { color:rgba(255,255,255,.8); }
      @media (max-width: 720px) {
        #btfw-ratings { margin-left:6px; font-size:12px; }
        #btfw-ratings .btfw-ratings__label { display:none; }
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

  function deriveMediaKey(media, fallbackTitle) {
    if (!media || typeof media !== "object") {
      if (fallbackTitle) return `title:${hashString(fallbackTitle)}`;
      return "";
    }
    const parts = [];
    const type = (media.type || media.mediaType || media.provider || "").toString().trim();
    const id = (media.id || media.videoId || media.vid || media.ytId || media.uid || "").toString().trim();
    if (type && id) parts.push(`${type}:${id}`);
    if (media.uid && String(media.uid).length) parts.push(`uid:${media.uid}`);
    if (media.queue?.uid) parts.push(`qu:${media.queue.uid}`);
    if (media.uniqueID) parts.push(`uniq:${media.uniqueID}`);

    if (!parts.length) {
      const duration = Number(media.seconds ?? media.duration ?? media.length ?? 0) || 0;
      const baseTitle = stripTitlePrefix(media.title || fallbackTitle || "");
      if (baseTitle) parts.push(`title:${hashString(`${baseTitle}::${duration}`)}`);
    }
    return parts.join("|");
  }

  function normalizeMediaData(media) {
    if (!media || typeof media !== "object") return null;
    const lookupTitle = state.lookup?.canonical || state.lookup?.query || state.lookup?.original || "";
    const rawTitle = stripTitlePrefix(media.title || lookupTitle || "");
    const duration = Number(media.seconds ?? media.duration ?? media.length ?? 0) || 0;
    const key = deriveMediaKey(media, rawTitle || lookupTitle);
    if (!key) return null;
    return { key, title: rawTitle, duration,
      provider: (media.type || media.mediaType || media.provider || "").toString().trim(),
      id: (media.id || media.videoId || media.vid || media.uid || "").toString().trim() };
  }

  function ensureUI() {
    if (state.container?.isConnected) return state.container;
    ensureStyles();

    const slot = $("#btfw-nowplaying-slot") || $("#chatwrap .btfw-chat-topbar") || $("#chatwrap") || document.body;
    const el = document.createElement("span");
    el.id = "btfw-ratings";
    el.hidden = true;
    el.innerHTML = `
      <span class="btfw-ratings__label">Rate</span>
      <span class="btfw-ratings__stars" role="group" aria-label="Rate current media">
        ${STAR_VALUES.map(v => `<button type="button" data-score="${v}" aria-label="Rate ${v} star${v===1?"":"s"}">★</button>`).join("")}
      </span>
      <span class="btfw-ratings__meta" aria-live="polite"></span>
      <span class="btfw-ratings__self" hidden></span>
      <button type="button" class="btfw-ratings__refresh" title="Refresh rating" aria-label="Refresh rating">⟳</button>
      <span class="btfw-ratings__error" hidden></span>
    `;
    slot.appendChild(el);

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

  function updateVisibility() {
    if (!state.container) return;
    const endpoint = ensureEndpoint();
    if (!endpoint) {
      state.container.hidden = true;
      return;
    }
    if (!state.currentKey) {
      state.container.hidden = false;
      state.container.dataset.disabled = "true";
      setStatus("Waiting for media…");
      setSelfStatus("");
      highlightStars(0);
      return;
    }

    state.container.hidden = false;
    state.container.dataset.disabled = "false";

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

  function handleLookupEvent(event) {
    if (!event?.detail) return;
    state.lookup = { ...event.detail };
    if (!state.currentMedia && state.lookup?.original) {
      state.currentMedia = { key: `title:${hashString(state.lookup.original)}`, title: stripTitlePrefix(state.lookup.original), duration: 0, provider: "", id: "" };
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
    const normalized = normalizeMediaData(media);
    if (!normalized) return;

    // clear pending timers from previous media
    if (state.statsTimer) { clearTimeout(state.statsTimer); state.statsTimer = null; }

    state.currentMedia = normalized;
    state.currentKey = normalized.key;
    state.stats = null;
    state.lastVote = null;
    setSelfStatus("");
    highlightStars(0);
    updateVisibility();
    refreshStats(true);
  }

  function handleMediaUpdate(data) {
    if (!data) return;
    if (data.title && state.currentMedia) state.currentMedia.title = stripTitlePrefix(data.title);
    if (data.seconds && state.currentMedia) state.currentMedia.duration = Number(data.seconds) || state.currentMedia.duration;
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

  return { name: "feature:ratings", refresh: () => refreshStats(true) };
});
