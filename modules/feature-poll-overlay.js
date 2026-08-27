/* BTFW — feature:poll-overlay (video overlay display for CyTube polls) */
BTFW.define("feature:poll-overlay", [], async () => {
  "use strict";

  const anime = await BTFW.init("util:anime");
  const CSS_ID = "btfw-poll-overlay-styles";
  const POLL_OVERLAY_CSS = `
    /* Poll Display Overlay on Video */
    /* The overlay fades and the card rises on entry (exit is faster). Browsers
       without allow-discrete display transitions just snap, as before. */
    #btfw-poll-video-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1500;
      pointer-events: none;
      display: none;
      opacity: 0;
      transition: opacity var(--btfw-motion-fast, 150ms) var(--btfw-ease-out, ease-out),
                  display var(--btfw-motion-fast, 150ms) allow-discrete;
    }

    :root.btfw-poll-overlay-disabled #btfw-poll-video-overlay {
      display: none !important;
    }

    #btfw-poll-video-overlay.btfw-poll-active {
      display: block;
      opacity: 1;
      transition: opacity var(--btfw-motion-base, 220ms) var(--btfw-ease-out, ease-out),
                  display var(--btfw-motion-base, 220ms) allow-discrete;
    }
    @starting-style {
      #btfw-poll-video-overlay.btfw-poll-active { opacity: 0; }
    }

    .btfw-poll-video-content {
      position: absolute;
      top: 30px;
      left: 20px;
      right: 20px;
      pointer-events: auto;
      background: var(--btfw-overlay-bg);
      backdrop-filter: saturate(130%) blur(2px);
      border: 1px solid var(--btfw-overlay-border);
      border-radius: calc(var(--btfw-radius) + 6px);
      padding: 20px;
      box-shadow: var(--btfw-overlay-shadow);
      color: var(--btfw-color-text);
      max-width: 800px;
      margin: 0 auto;
      transform: translateY(-8px) scale(0.98);
      transition: transform var(--btfw-motion-fast, 150ms) var(--btfw-ease-out, ease-out);
    }
    #btfw-poll-video-overlay.btfw-poll-active .btfw-poll-video-content {
      transform: none;
      transition: transform var(--btfw-motion-base, 220ms) var(--btfw-ease-out, ease-out);
    }
    @starting-style {
      #btfw-poll-video-overlay.btfw-poll-active .btfw-poll-video-content {
        transform: translateY(-8px) scale(0.98);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .btfw-poll-video-content { transform: none !important; transition: none !important; }
      #btfw-poll-video-overlay { transition: opacity 150ms ease, display 150ms allow-discrete; }
    }

    .btfw-poll-video-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .btfw-poll-video-title {
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--btfw-color-text);
      margin: 0;
      flex: 1;
    }

    .btfw-poll-video-close {
      background: none;
      border: none;
      font-size: 1.2rem;
      color: var(--btfw-color-text);
      cursor: pointer;
      padding: 4px;
      opacity: 0.7;
      margin-left: 12px;
    }

    .btfw-poll-video-close:hover {
      opacity: 1;
    }

    .btfw-poll-options-grid {
    display: flex !important;
    flex-direction: row !important;
    gap: 1rem !important;
    align-items: stretch;
    margin: 20px 0 !important;
    justify-content: center;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    }

    .btfw-poll-option-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btfw-poll-option-btn {
      background: color-mix(in srgb, var(--btfw-color-panel) 86%, transparent 14%);
      border: 2px solid var(--btfw-border);
      border-radius: 6px;
      padding: 6px 12px;
      color: var(--btfw-color-text);
      cursor: pointer;
      transition: background var(--btfw-motion-fast, 150ms) ease,
                  border-color var(--btfw-motion-fast, 150ms) ease,
                  color var(--btfw-motion-fast, 150ms) ease;
      font-weight: 500;
      min-width: 60px;
      text-align: center;
      font-size: 0.9rem;
    }

    .btfw-poll-option-btn:hover {
      background: color-mix(in srgb, var(--btfw-color-accent) 20%, transparent 80%);
      border-color: var(--btfw-color-accent);
    }

    .btfw-poll-option-btn.active {
      background: color-mix(in srgb, var(--btfw-color-accent) 32%, transparent 68%);
      border-color: var(--btfw-color-accent);
      color: var(--btfw-color-on-accent);
    }

    .btfw-poll-option-text {
      flex: 1;
      color: var(--btfw-color-text);
      font-weight: 500;
    }

    .btfw-poll-footer {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      gap: 12px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid color-mix(in srgb, var(--btfw-border) 60%, transparent 40%);
    }

    .btfw-poll-info {
      justify-self: start;
      font-size: 0.85rem;
      color: color-mix(in srgb, var(--btfw-color-text) 70%, transparent 30%);
    }

    .btfw-poll-countdown {
      display: inline-flex;
      align-items: center;
      justify-self: center;
      gap: 6px;
      min-width: 64px;
      color: var(--btfw-color-text);
      font-size: 0.9rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }

    .btfw-poll-countdown[hidden] {
      display: none !important;
    }

    .btfw-poll-countdown .fa {
      color: var(--btfw-color-accent);
      font-size: 0.85em;
      opacity: 0.9;
    }

    .btfw-poll-end-btn {
      justify-self: end;
      background: var(--btfw-color-error, #e74c3c);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .btfw-poll-end-btn:hover {
      opacity: 0.9;
    }

    @media (max-width: 768px) {
      .btfw-poll-video-content {
        left: 12px;
        right: 12px;
        top: 20px;
        padding: 16px;
      }
    }

    /* Random movie poll builder — lives in the native Polls & Voting panel. */
    #pollwrap .btfw-random-poll-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin: 0;
      padding: 8px 18px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--btfw-color-surface) 80%, var(--btfw-color-accent) 20%);
      border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 45%, transparent 55%);
      color: var(--btfw-color-text);
    }

    #pollwrap .btfw-random-poll-btn:disabled {
      opacity: .5;
      cursor: not-allowed;
    }

    #pollwrap .btfw-auto-credits-poll-control {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-left: 10px;
      color: color-mix(in srgb, var(--btfw-color-text) 78%, transparent 22%);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
    }

    #pollwrap .btfw-auto-credits-poll-control input {
      margin: 0;
      accent-color: var(--btfw-color-accent);
    }

    #pollwrap .btfw-auto-credits-poll-control:has(input:checked) {
      color: var(--btfw-color-text);
    }

    #pollwrap .btfw-random-poll-builder {
      box-sizing: border-box;
      width: 100%;
      max-width: 700px;
      padding: 18px;
      border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 34%, transparent 66%);
      border-radius: var(--btfw-radius, 14px);
      background: linear-gradient(145deg,
        color-mix(in srgb, var(--btfw-color-panel) 92%, transparent 8%),
        color-mix(in srgb, var(--btfw-color-accent) 14%, var(--btfw-color-surface) 86%));
      box-shadow: 0 18px 44px color-mix(in srgb, var(--btfw-color-bg) 34%, transparent 66%);
    }

    .btfw-random-poll-head,
    .btfw-random-poll-settings,
    .btfw-random-poll-actions {
      display: flex;
      align-items: center;
    }

    .btfw-random-poll-head {
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .btfw-random-poll-head h3 {
      margin: 0;
      color: var(--btfw-color-text);
      font-size: 1.15rem;
      font-weight: 700;
    }

    .btfw-random-poll-close {
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid var(--btfw-border);
      border-radius: 9px;
      background: var(--btfw-color-surface);
      color: var(--btfw-color-text-muted);
      font-size: 20px;
    }

    .btfw-random-poll-settings {
      align-items: stretch;
      gap: 10px;
    }

    .btfw-random-poll-setting {
      display: flex;
      flex: 1 1 0;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid color-mix(in srgb, var(--btfw-border) 68%, transparent 32%);
      border-radius: 11px;
      background: color-mix(in srgb, var(--btfw-color-surface) 86%, transparent 14%);
      color: var(--btfw-color-text);
      font-size: 13px;
      font-weight: 650;
    }

    .btfw-random-poll-stepper {
      display: inline-flex;
      align-items: center;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 34%, var(--btfw-border) 66%);
      border-radius: 9px;
    }

    .btfw-random-poll-stepper button,
    .btfw-random-poll-stepper input {
      height: 30px;
      border: 0;
      background: transparent;
      color: var(--btfw-color-text);
      text-align: center;
    }

    .btfw-random-poll-stepper button {
      width: 30px;
      padding: 0;
      color: var(--btfw-color-accent);
      font-size: 17px;
      font-weight: 700;
    }

    .btfw-random-poll-stepper input {
      width: 38px;
      padding: 0;
      border-right: 1px solid var(--btfw-border);
      border-left: 1px solid var(--btfw-border);
      font: inherit;
      -moz-appearance: textfield;
    }

    .btfw-random-poll-stepper input::-webkit-inner-spin-button,
    .btfw-random-poll-stepper input::-webkit-outer-spin-button {
      -webkit-appearance: none;
    }

    .btfw-random-poll-unit {
      padding-right: 6px;
      color: var(--btfw-color-text-muted);
      font-size: 11px;
    }

    .btfw-random-poll-eligible {
      margin: 10px 2px 8px;
      color: var(--btfw-color-text-muted);
      font-size: 12px;
    }

    .btfw-random-poll-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .btfw-random-poll-list li {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
      padding: 9px 10px;
      border: 1px solid color-mix(in srgb, var(--btfw-border) 62%, transparent 38%);
      border-radius: 10px;
      background: color-mix(in srgb, var(--btfw-color-surface) 88%, transparent 12%);
      color: var(--btfw-color-text);
    }

    .btfw-random-poll-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 23px;
      height: 23px;
      flex: 0 0 23px;
      border-radius: 7px;
      background: color-mix(in srgb, var(--btfw-color-accent) 24%, transparent 76%);
      color: var(--btfw-color-accent);
      font-size: 11px;
      font-weight: 800;
    }

    .btfw-random-poll-movie-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 550;
    }

    .btfw-random-poll-warning {
      margin: 9px 0 0;
      color: #ffbd59;
      font-size: 12px;
    }

    .btfw-random-poll-actions {
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 13px;
    }

    #pollwrap .btfw-random-poll-actions .button {
      margin: 0;
      border-radius: 9px;
    }

    #pollwrap .btfw-random-poll-start {
      background: var(--btfw-color-accent);
      color: var(--btfw-color-on-accent);
      font-weight: 700;
    }

    @media (max-width: 600px) {
      .btfw-random-poll-settings,
      .btfw-random-poll-actions {
        align-items: stretch;
        flex-direction: column;
      }

      .btfw-random-poll-list { grid-template-columns: 1fr; }
      #pollwrap .btfw-random-poll-actions .button { width: 100%; }
    }
  `;

  let videoOverlay = null;
  let currentPoll = null;
  let socketEventsWired = false;
  let userVotes = new Set(); // Track which options user voted for
  let pollDomObserver = null;
  let observedPollElement = null;
  let pollCountdownTimer = null;

  const ENTITY_DECODER = document.createElement("textarea");

  function decodeHtmlEntities(value) {
    if (typeof value !== "string") {
      if (value == null) return "";
      return String(value);
    }
    if (value.length === 0) {
      return "";
    }
    ENTITY_DECODER.innerHTML = value;
    return ENTITY_DECODER.value;
  }

  function resolvePollTitle(rawTitle) {
    const decoded = decodeHtmlEntities(rawTitle);
    if (typeof decoded === "string") {
      const trimmed = decoded.trim();
      if (trimmed.length) {
        return trimmed;
      }
    }
    return "Poll";
  }

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement("style");
    style.id = CSS_ID;
    style.textContent = POLL_OVERLAY_CSS;
    document.head.appendChild(style);
  }

  /* ---------- Random movie poll ---------- */
  const RANDOM_POLL_TITLE = "What should we watch next?";
  const RANDOM_POLL_TIMER_RE = /\s*[·•]\s*(\d{1,2})\s*min(?:ute)?s?\s*$/i;
  const RANDOM_POLL_DEFAULT_COUNT = 5;
  const RANDOM_POLL_DEFAULT_MINUTES = 2;
  const AUTO_POLL_TRIGGER_SECONDS = 4 * 60;
  const AUTO_POLL_MIN_DURATION_SECONDS = 30 * 60;
  const AUTO_POLL_MIN_REMAINING_SECONDS = RANDOM_POLL_DEFAULT_MINUTES * 60 + 10;
  let randomPollDraft = null;
  let automaticPoll = null;
  let randomPollTimer = null;
  let autoCreditsPollTimer = null;
  let autoCreditsPollChecking = false;
  const autoCreditsMedia = {
    key: "",
    provider: "",
    duration: 0,
    currentTime: 0,
    sampledAt: 0,
    paused: true
  };

  function hasChannelPermission(permission) {
    try {
      return typeof window.hasPermission === "function" && !!window.hasPermission(permission);
    } catch (_) {
      return false;
    }
  }

  function isChannelOwner() {
    const rank = Number(window.CLIENT?.rank);
    return Number.isFinite(rank) && rank >= 3;
  }

  function channelStorageName() {
    const configured = String(window.CHANNEL?.name || window.CHANNELNAME || "").trim();
    if (configured) return configured.toLocaleLowerCase();
    const match = location.pathname.match(/\/r\/([^/?#]+)/i);
    return decodeURIComponent(match?.[1] || "channel").toLocaleLowerCase();
  }

  function autoCreditsEnabledKey() {
    return `btfw:auto-credits-poll:enabled:${channelStorageName()}`;
  }

  function autoCreditsClaimKey() {
    return `btfw:auto-credits-poll:claim:${channelStorageName()}`;
  }

  function readAutoCreditsEnabled() {
    if (!isChannelOwner()) return false;
    try { return localStorage.getItem(autoCreditsEnabledKey()) === "1"; }
    catch (_) { return false; }
  }

  function setAutoCreditsEnabled(enabled) {
    try { localStorage.setItem(autoCreditsEnabledKey(), enabled ? "1" : "0"); }
    catch (_) {}
  }

  function playlistUid(row) {
    const match = String(row?.className || "").match(/\bpluid-(\d+)\b/);
    return match ? Number.parseInt(match[1], 10) : null;
  }

  function playlistTitle(row) {
    const title = row?.querySelector(".qe_title") || row?.querySelector("a");
    return String(title?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function movieKey(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
  }

  function eligiblePlaylistMovies() {
    const activeUid = playlistUid(document.querySelector("#queue > .queue_active"));
    const seen = new Set();
    const movies = [];

    document.querySelectorAll("#queue > .queue_entry").forEach((row) => {
      const uid = playlistUid(row);
      const title = playlistTitle(row);
      const key = movieKey(title);
      if (uid == null || uid === activeUid || !title || seen.has(key)) return;
      seen.add(key);
      movies.push({ uid, title, key });
    });
    return movies;
  }

  function randomChoice(items) {
    return items.length ? items[Math.floor(Math.random() * items.length)] : null;
  }

  function sampleMovies(items, count) {
    const pool = items.slice();
    const result = [];
    while (pool.length && result.length < count) {
      result.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return result;
  }

  function boundedInteger(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }

  function timedRandomPollTitle(minutes) {
    return `${RANDOM_POLL_TITLE} · ${minutes} min`;
  }

  function activePlaylistRow() {
    return document.querySelector("#queue > .queue_entry.queue_active");
  }

  function autoMediaKey(media) {
    const row = activePlaylistRow();
    const uid = playlistUid(row);
    if (uid != null) return `playlist:${uid}`;
    const provider = String(media?.type || media?.mediaType || media?.provider || "").trim().toLocaleLowerCase();
    const id = String(media?.id || media?.videoId || media?.vid || "").trim();
    const title = movieKey(media?.title || playlistTitle(row));
    return provider && id ? `${provider}:${id}` : title ? `title:${title}` : "";
  }

  function isYouTubeMedia() {
    const provider = autoCreditsMedia.provider.toLocaleLowerCase();
    if (provider === "yt" || provider === "youtube" || provider.startsWith("youtube")) return true;

    const href = activePlaylistRow()?.querySelector(".qe_title")?.href || "";
    try {
      const host = new URL(href, location.href).hostname.toLocaleLowerCase();
      if (host === "youtu.be" || host.endsWith(".youtube.com") || host === "youtube.com") return true;
    } catch (_) {}

    const frameSource = document.querySelector("#videowrap iframe")?.src || "";
    return /(?:youtube\.com|youtube-nocookie\.com)\//i.test(frameSource);
  }

  function finitePlaybackNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
  }

  function readAutoCreditsPlayback() {
    const videos = document.querySelectorAll("#videowrap video, video");
    for (const video of videos) {
      const duration = finitePlaybackNumber(video.duration);
      const currentTime = finitePlaybackNumber(video.currentTime);
      if (duration > 0 && currentTime >= 0) {
        return { duration, currentTime, paused: Boolean(video.paused) };
      }
    }

    const player = window.PLAYER;
    const readFirst = (readers, valid) => {
      for (const read of readers) {
        try {
          const value = finitePlaybackNumber(read());
          if (valid(value)) return value;
        } catch (_) {}
      }
      return NaN;
    };
    const duration = readFirst([
      () => player?.getDuration?.(),
      () => player?.getLength?.(),
      () => player?.media?.seconds,
      () => player?.media?.duration,
      () => player?.player?.getDuration?.(),
      () => player?.player?.duration?.(),
      () => player?.videojs?.duration?.()
    ], (value) => value > 0);
    const currentTime = readFirst([
      () => player?.getTime?.(),
      () => player?.getCurrentTime?.(),
      () => player?.currentTime?.(),
      () => player?.player?.getCurrentTime?.(),
      () => player?.player?.currentTime?.(),
      () => player?.videojs?.currentTime?.()
    ], (value) => value >= 0);
    if (duration > 0 && currentTime >= 0) return { duration, currentTime, paused: false };

    let fallbackTime = autoCreditsMedia.currentTime;
    if (!autoCreditsMedia.paused && autoCreditsMedia.sampledAt) {
      fallbackTime += Math.max(0, performance.now() - autoCreditsMedia.sampledAt) / 1000;
    }
    return {
      duration: autoCreditsMedia.duration,
      currentTime: fallbackTime,
      paused: autoCreditsMedia.paused
    };
  }

  function updateAutoCreditsMedia(data, reset = false) {
    if (data && typeof data === "object") {
      const key = autoMediaKey(data);
      if (reset && key && key !== autoCreditsMedia.key) {
        autoCreditsMedia.duration = 0;
        autoCreditsMedia.currentTime = 0;
        autoCreditsMedia.provider = "";
      }
      if (key) autoCreditsMedia.key = key;
      const provider = String(data.type || data.mediaType || data.provider || "").trim();
      if (provider) autoCreditsMedia.provider = provider;
      const duration = [data.seconds, data.duration, data.length]
        .map(finitePlaybackNumber).find((value) => value > 0);
      const currentTime = [data.currentTime, data.time, data.position]
        .map(finitePlaybackNumber).find((value) => value >= 0);
      if (Number.isFinite(duration)) autoCreditsMedia.duration = duration;
      if (Number.isFinite(currentTime)) autoCreditsMedia.currentTime = currentTime;
      if (typeof data.paused === "boolean") autoCreditsMedia.paused = data.paused;
      autoCreditsMedia.sampledAt = performance.now();

      // A replay of the same playlist entry is a new movie session. Clear its
      // previous claim near the beginning. A short age guard preserves the
      // claim when a late viewer refresh initially reports position zero.
      if (reset && key && Number.isFinite(currentTime) && currentTime < 60) {
        const claim = readAutoCreditsClaim();
        if (claim?.mediaKey === key && Date.now() - Number(claim.claimedAt || 0) > 3 * 60 * 1000) {
          releaseAutoCreditsClaim(key);
        }
      }
    } else {
      const key = autoMediaKey(null);
      if (key) autoCreditsMedia.key = key;
    }
  }

  function readAutoCreditsClaim() {
    try { return JSON.parse(localStorage.getItem(autoCreditsClaimKey()) || "null"); }
    catch (_) { return null; }
  }

  function releaseAutoCreditsClaim(mediaKey, token = "") {
    try {
      const claim = readAutoCreditsClaim();
      if (!claim || claim.mediaKey !== mediaKey || (token && claim.token !== token)) return;
      localStorage.removeItem(autoCreditsClaimKey());
    } catch (_) {}
  }

  async function claimAutoCreditsPoll(mediaKey) {
    const existing = readAutoCreditsClaim();
    if (existing?.mediaKey === mediaKey) return "";
    const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    try {
      localStorage.setItem(autoCreditsClaimKey(), JSON.stringify({ mediaKey, token, claimedAt: Date.now() }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      return readAutoCreditsClaim()?.token === token ? token : "";
    } catch (_) {
      return token;
    }
  }

  function pollNotice(message, kind = "info") {
    try {
      const notifications = window.BTFW_notify;
      if (notifications && typeof notifications[kind] === "function") {
        const safe = String(message).replace(/[&<>"']/g, (character) => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[character]);
        notifications[kind]({
          title: "Random movie poll",
          html: `<span>${safe}</span>`,
          icon: kind === "success" ? "✅" : kind === "warn" ? "⚠️" : "🎬",
          timeout: 5200
        });
        return;
      }
    } catch (_) {}
    console.log("[poll-overlay]", message);
  }

  function activeNativePoll() {
    return !!document.querySelector("#pollwrap .well.active");
  }

  function closeRandomPollBuilder() {
    document.querySelector("#pollwrap .btfw-random-poll-builder")?.remove();
    randomPollDraft = null;
    syncRandomPollButton();
  }

  function renderRandomPollBuilder() {
    const builder = document.querySelector("#pollwrap .btfw-random-poll-builder");
    if (!builder || !randomPollDraft) return;

    const eligible = eligiblePlaylistMovies();
    const list = builder.querySelector(".btfw-random-poll-list");
    const countInput = builder.querySelector("#btfw-random-poll-count");
    const minutesInput = builder.querySelector("#btfw-random-poll-minutes");
    const startButton = builder.querySelector(".btfw-random-poll-start");

    if (countInput) countInput.value = String(randomPollDraft.count);
    if (minutesInput) minutesInput.value = String(randomPollDraft.minutes);
    builder.querySelector(".btfw-random-poll-eligible").textContent =
      `${eligible.length} eligible movie${eligible.length === 1 ? "" : "s"} · currently playing excluded`;

    list.innerHTML = "";
    randomPollDraft.movies.forEach((movie, index) => {
      const item = document.createElement("li");
      const number = document.createElement("span");
      const title = document.createElement("span");
      number.className = "btfw-random-poll-number";
      title.className = "btfw-random-poll-movie-title";
      number.textContent = String(index + 1);
      title.textContent = movie.title;
      item.append(number, title);
      list.appendChild(item);
    });

    const canMove = hasChannelPermission("playlistmove");
    const warning = builder.querySelector(".btfw-random-poll-warning");
    warning.hidden = canMove;
    startButton.textContent = `Start ${randomPollDraft.minutes}-Minute Poll`;
    startButton.disabled = !canMove || randomPollDraft.movies.length < 2 || activeNativePoll();
  }

  function rerollRandomMovies() {
    if (!randomPollDraft) return;
    randomPollDraft.movies = sampleMovies(eligiblePlaylistMovies(), randomPollDraft.count);
    renderRandomPollBuilder();
  }

  function changeRandomPollSetting(setting, delta) {
    if (!randomPollDraft) return;
    if (setting === "count") {
      randomPollDraft.count = boundedInteger(randomPollDraft.count + delta, 2, 10, RANDOM_POLL_DEFAULT_COUNT);
      rerollRandomMovies();
    } else {
      randomPollDraft.minutes = boundedInteger(randomPollDraft.minutes + delta, 1, 15, RANDOM_POLL_DEFAULT_MINUTES);
      renderRandomPollBuilder();
    }
  }

  function openRandomPollBuilder() {
    if (!hasChannelPermission("pollctl")) return;
    if (activeNativePoll()) {
      pollNotice("End the active poll first.", "warn");
      return;
    }
    if (document.querySelector("#pollwrap .poll-menu")) {
      pollNotice("Close the standard New Poll form first.", "warn");
      return;
    }

    closeRandomPollBuilder();
    const wrap = document.getElementById("pollwrap");
    const controls = wrap?.querySelector(".poll-controls");
    if (!wrap) return;

    const builder = document.createElement("section");
    builder.className = "btfw-random-poll-builder";
    builder.setAttribute("aria-labelledby", "btfw-random-poll-heading");
    builder.innerHTML = `
      <div class="btfw-random-poll-head">
        <h3 id="btfw-random-poll-heading">Random Movie Poll</h3>
        <button class="btfw-random-poll-close" type="button" aria-label="Close random movie poll">&times;</button>
      </div>
      <div class="btfw-random-poll-settings">
        <div class="btfw-random-poll-setting">
          <label for="btfw-random-poll-count">Movies</label>
          <span class="btfw-random-poll-stepper">
            <button type="button" data-setting="count" data-delta="-1" aria-label="Use one fewer movie">−</button>
            <input id="btfw-random-poll-count" type="number" min="2" max="10" step="1" value="5">
            <button type="button" data-setting="count" data-delta="1" aria-label="Use one more movie">+</button>
          </span>
        </div>
        <div class="btfw-random-poll-setting">
          <label for="btfw-random-poll-minutes">Poll time</label>
          <span class="btfw-random-poll-stepper">
            <button type="button" data-setting="minutes" data-delta="-1" aria-label="Make the poll one minute shorter">−</button>
            <input id="btfw-random-poll-minutes" type="number" min="1" max="15" step="1" value="2">
            <span class="btfw-random-poll-unit">min</span>
            <button type="button" data-setting="minutes" data-delta="1" aria-label="Make the poll one minute longer">+</button>
          </span>
        </div>
      </div>
      <p class="btfw-random-poll-eligible" aria-live="polite"></p>
      <ol class="btfw-random-poll-list"></ol>
      <p class="btfw-random-poll-warning" hidden>Playlist move permission is required to queue the winner.</p>
      <div class="btfw-random-poll-actions">
        <button class="button is-small btfw-random-poll-reroll" type="button"><i class="fa fa-shuffle" aria-hidden="true"></i> Reroll Movies</button>
        <button class="button is-small btfw-random-poll-cancel" type="button">Cancel</button>
        <button class="button is-small btfw-random-poll-start" type="button">Start 2-Minute Poll</button>
      </div>`;

    wrap.insertBefore(builder, controls || wrap.firstChild);
    randomPollDraft = {
      count: RANDOM_POLL_DEFAULT_COUNT,
      minutes: RANDOM_POLL_DEFAULT_MINUTES,
      movies: sampleMovies(eligiblePlaylistMovies(), RANDOM_POLL_DEFAULT_COUNT)
    };

    builder.querySelector(".btfw-random-poll-close").addEventListener("click", closeRandomPollBuilder);
    builder.querySelector(".btfw-random-poll-cancel").addEventListener("click", closeRandomPollBuilder);
    builder.querySelector(".btfw-random-poll-reroll").addEventListener("click", rerollRandomMovies);
    builder.querySelector(".btfw-random-poll-start").addEventListener("click", startAutomaticPoll);
    builder.querySelectorAll("[data-setting]").forEach((button) => {
      button.addEventListener("click", () => {
        changeRandomPollSetting(button.dataset.setting, Number.parseInt(button.dataset.delta, 10) || 0);
      });
    });
    builder.querySelector("#btfw-random-poll-count").addEventListener("change", (event) => {
      randomPollDraft.count = boundedInteger(event.target.value, 2, 10, RANDOM_POLL_DEFAULT_COUNT);
      rerollRandomMovies();
    });
    builder.querySelector("#btfw-random-poll-minutes").addEventListener("change", (event) => {
      randomPollDraft.minutes = boundedInteger(event.target.value, 1, 15, RANDOM_POLL_DEFAULT_MINUTES);
      renderRandomPollBuilder();
    });
    renderRandomPollBuilder();
  }

  function startAutomaticPoll() {
    if (!randomPollDraft || automaticPoll) return false;
    return launchAutomaticPoll({
      movies: randomPollDraft.movies,
      minutes: randomPollDraft.minutes,
      quiet: false
    });
  }

  function launchAutomaticPoll({ movies, minutes, quiet = false, mediaKey = "", claimToken = "" }) {
    if (automaticPoll) return false;
    if (!hasChannelPermission("pollctl") || !hasChannelPermission("playlistmove")) {
      if (!quiet) pollNotice("Poll and playlist move permissions are required.", "warn");
      return false;
    }
    if (activeNativePoll() || document.querySelector("#pollwrap .poll-menu")) {
      if (!quiet) pollNotice("Close the existing poll or poll form first.", "warn");
      return false;
    }
    if (quiet && document.querySelector("#pollwrap .btfw-random-poll-builder")) return false;
    if (!Array.isArray(movies) || movies.length < 2) {
      if (!quiet) pollNotice("At least two eligible playlist movies are required.", "warn");
      return false;
    }
    if (!window.socket || typeof window.socket.emit !== "function") {
      if (!quiet) pollNotice("CyTube is not connected.", "warn");
      return false;
    }

    const pollMinutes = boundedInteger(minutes, 1, 15, RANDOM_POLL_DEFAULT_MINUTES);
    const pollMovies = movies.map((movie) => ({ ...movie }));
    const pollTitle = timedRandomPollTitle(pollMinutes);
    automaticPoll = {
      phase: "opening",
      title: pollTitle,
      minutes: pollMinutes,
      movies: pollMovies,
      counts: new Array(pollMovies.length).fill(0),
      source: quiet ? "credits" : "manual",
      mediaKey,
      claimToken
    };
    const button = quiet ? null : document.querySelector(".btfw-random-poll-start");
    if (button) {
      button.disabled = true;
      button.textContent = "Starting…";
    }

    window.socket.emit("newPoll", {
      title: pollTitle,
      opts: automaticPoll.movies.map((movie) => movie.title),
      obscured: false,
      retainVotes: true,
      timeout: automaticPoll.minutes * 60
    }, (result) => {
      if (!result?.error) return;
      pollNotice(result.error.message || "CyTube could not create the poll.", "warn");
      if (automaticPoll?.mediaKey) {
        releaseAutoCreditsClaim(automaticPoll.mediaKey, automaticPoll.claimToken);
      }
      automaticPoll = null;
      renderRandomPollBuilder();
    });
    return true;
  }

  function automaticPollMatches(poll) {
    if (!automaticPoll || !poll || !Array.isArray(poll.options)) return false;
    if (resolvePollTitle(poll.title) !== automaticPoll.title) return false;
    return poll.options.length === automaticPoll.movies.length && poll.options.every((option, index) => {
      return movieKey(decodeHtmlEntities(option)) === automaticPoll.movies[index].key;
    });
  }

  function trackAutomaticPoll(poll) {
    if (!automaticPoll || !automaticPollMatches(poll)) return;
    if (automaticPoll.phase === "opening") {
      automaticPoll.phase = "active";
      closeRandomPollBuilder();
      pollNotice(
        automaticPoll.source === "credits"
          ? `Credits poll started for ${automaticPoll.movies.length} movies.`
          : `Poll started for ${automaticPoll.movies.length} movies.`,
        "success"
      );
    }
    if (Array.isArray(poll.counts) && poll.counts.length === automaticPoll.movies.length) {
      automaticPoll.counts = poll.counts.map((count) => Number.parseInt(count, 10) || 0);
    }
  }

  function queueWinningMovie(movie) {
    if (!hasChannelPermission("playlistmove")) {
      pollNotice(`“${movie.title}” won, but playlist move permission is no longer available.`, "warn");
      return;
    }
    const rows = Array.from(document.querySelectorAll("#queue > .queue_entry"));
    const winner = rows.find((row) => playlistUid(row) === movie.uid)
      || rows.find((row) => movieKey(playlistTitle(row)) === movie.key);
    const active = document.querySelector("#queue > .queue_active");
    const winnerUid = playlistUid(winner);
    const activeUid = playlistUid(active);
    if (winnerUid == null || activeUid == null) {
      pollNotice(`“${movie.title}” won, but its playlist position could not be resolved.`, "warn");
      return;
    }
    if (winnerUid === activeUid) {
      pollNotice(`“${movie.title}” won and is already playing.`, "success");
      return;
    }
    if (active.nextElementSibling === winner) {
      pollNotice(`“${movie.title}” won and is already queued next.`, "success");
      return;
    }
    window.socket.emit("moveMedia", { from: winnerUid, after: activeUid });
    pollNotice(`“${movie.title}” won and was queued next.`, "success");
  }

  function finishAutomaticPoll() {
    if (!automaticPoll || automaticPoll.phase !== "active") return;
    const finished = automaticPoll;
    automaticPoll = null;
    const highest = Math.max(0, ...finished.counts);
    const finalists = finished.movies.filter((_, index) => finished.counts[index] === highest);
    const winner = randomChoice(finalists.length ? finalists : finished.movies);
    if (!winner) return;
    if (highest === 0) pollNotice(`No votes were cast, so “${winner.title}” was picked at random.`);
    else if (finalists.length > 1) pollNotice(`The poll tied; “${winner.title}” won the random tiebreak.`);
    queueWinningMovie(winner);
  }

  function syncRandomPollButton() {
    const wrap = document.getElementById("pollwrap");
    const controls = wrap?.querySelector(".poll-controls");
    let button = document.getElementById("btfw-random-poll-btn");
    if (!hasChannelPermission("pollctl")) {
      button?.remove();
      document.querySelector("#pollwrap .btfw-random-poll-builder")?.remove();
      randomPollDraft = null;
      return;
    }
    if (!controls) return;
    if (!button) {
      button = document.createElement("button");
      button.id = "btfw-random-poll-btn";
      button.type = "button";
      button.className = "btn btn-sm btn-default button is-small btfw-random-poll-btn";
      button.innerHTML = '<i class="fa fa-shuffle" aria-hidden="true"></i><span>Random Movie Poll</span>';
      button.addEventListener("click", openRandomPollBuilder);
      controls.appendChild(button);
    }
    button.disabled = activeNativePoll() || !!automaticPoll;
    button.title = button.disabled ? "End the active poll first" : "Poll random movies from the playlist";
  }

  function syncAutoCreditsPollControl() {
    const wrap = document.getElementById("pollwrap");
    const controls = wrap?.querySelector(".poll-controls");
    let control = document.getElementById("btfw-auto-credits-poll-control");
    if (!isChannelOwner() || !hasChannelPermission("pollctl") || !hasChannelPermission("playlistmove")) {
      control?.remove();
      return;
    }
    if (!controls) return;
    if (!control) {
      control = document.createElement("label");
      control.id = "btfw-auto-credits-poll-control";
      control.className = "btfw-auto-credits-poll-control";
      control.title = "Automatically start a 5-movie poll when four minutes remain";
      control.innerHTML = '<input type="checkbox"><span>Auto credits polls</span>';
      control.querySelector("input").addEventListener("change", (event) => {
        const enabled = Boolean(event.target.checked);
        setAutoCreditsEnabled(enabled);
        pollNotice(
          enabled ? "Automatic credits polls enabled on this browser." : "Automatic credits polls disabled.",
          enabled ? "success" : "info"
        );
        if (enabled) evaluateAutoCreditsPoll();
      });
      controls.appendChild(control);
    }
    const toggle = control.querySelector("input");
    if (toggle) toggle.checked = readAutoCreditsEnabled();
  }

  function setupRandomPollControls() {
    syncRandomPollButton();
    syncAutoCreditsPollControl();
    const wrap = document.getElementById("pollwrap");
    if (wrap && !wrap._btfwRandomPollObserver) {
      wrap._btfwRandomPollObserver = new MutationObserver(syncRandomPollButton);
      wrap._btfwRandomPollObserver.observe(wrap, { childList: true, subtree: true });
    }
    if (!randomPollTimer) randomPollTimer = window.setInterval(setupRandomPollControls, 2000);
  }

  async function evaluateAutoCreditsPoll() {
    if (autoCreditsPollChecking || !readAutoCreditsEnabled() || !isChannelOwner()) return;
    if (!hasChannelPermission("pollctl") || !hasChannelPermission("playlistmove")) return;
    if (automaticPoll || activeNativePoll() || document.querySelector("#pollwrap .poll-menu, #pollwrap .btfw-random-poll-builder")) return;

    const currentKey = autoMediaKey(null);
    if (currentKey && currentKey !== autoCreditsMedia.key) {
      autoCreditsMedia.key = currentKey;
      autoCreditsMedia.provider = "";
    }
    if (!autoCreditsMedia.key || isYouTubeMedia()) return;

    const playback = readAutoCreditsPlayback();
    if (!(playback.duration >= AUTO_POLL_MIN_DURATION_SECONDS) || !(playback.currentTime >= 0)) return;
    const remaining = playback.duration - playback.currentTime;
    if (remaining > AUTO_POLL_TRIGGER_SECONDS || remaining < AUTO_POLL_MIN_REMAINING_SECONDS) return;

    const movies = sampleMovies(eligiblePlaylistMovies(), RANDOM_POLL_DEFAULT_COUNT);
    if (movies.length < 2) return;

    autoCreditsPollChecking = true;
    const mediaKey = autoCreditsMedia.key;
    const claimToken = await claimAutoCreditsPoll(mediaKey);
    try {
      if (!claimToken || !readAutoCreditsEnabled() || mediaKey !== autoCreditsMedia.key) return;
      const latest = readAutoCreditsPlayback();
      const latestRemaining = latest.duration - latest.currentTime;
      if (latestRemaining > AUTO_POLL_TRIGGER_SECONDS || latestRemaining < AUTO_POLL_MIN_REMAINING_SECONDS) {
        releaseAutoCreditsClaim(mediaKey, claimToken);
        return;
      }
      const started = launchAutomaticPoll({
        movies,
        minutes: RANDOM_POLL_DEFAULT_MINUTES,
        quiet: true,
        mediaKey,
        claimToken
      });
      if (!started) releaseAutoCreditsClaim(mediaKey, claimToken);
    } finally {
      autoCreditsPollChecking = false;
    }
  }

  function setupAutoCreditsPolling() {
    updateAutoCreditsMedia(null);
    if (!autoCreditsPollTimer) {
      autoCreditsPollTimer = window.setInterval(evaluateAutoCreditsPoll, 2000);
    }
    evaluateAutoCreditsPoll();
  }

  function createVideoOverlay() {
    if (videoOverlay) return videoOverlay;

    const videowrap = document.getElementById("videowrap");
    if (!videowrap) return null;

    const overlay = document.createElement("div");
    overlay.id = "btfw-poll-video-overlay";
    overlay.innerHTML = `
      <div class="btfw-poll-video-content">
        <div class="btfw-poll-video-header">
          <h3 class="btfw-poll-video-title">Poll Title</h3>
          <button class="btfw-poll-video-close" type="button">&times;</button>
        </div>
        <div class="btfw-poll-options-grid">
          <!-- Options populated by JS -->
        </div>
        <div class="btfw-poll-footer">
          <div class="btfw-poll-info">
            <span class="btfw-poll-votes">0 votes</span>
          </div>
          <div class="btfw-poll-countdown" hidden aria-label="Poll time remaining">
            <i class="fa fa-clock-o" aria-hidden="true"></i>
            <span class="btfw-poll-countdown-time">0:00</span>
          </div>
          <button class="btfw-poll-end-btn" style="display: none;">End Poll</button>
        </div>
      </div>
    `;

    videowrap.appendChild(overlay);
    videoOverlay = overlay;

    // Wire up close button
    const closeBtn = overlay.querySelector(".btfw-poll-video-close");
    closeBtn.addEventListener("click", hideVideoOverlay);

    // Wire up end poll button
    const endBtn = overlay.querySelector(".btfw-poll-end-btn");
    endBtn.addEventListener("click", () => {
      if (window.socket && window.socket.emit) {
        try {
          window.socket.emit("closePoll");
        } catch (e) {
          console.error("Failed to end poll:", e);
        }
      }
    });

    return overlay;
  }

  function canEndPoll() {
    // Show end poll button if user has sufficient rank (usually rank 2+ can end polls)
    return window.CLIENT && window.CLIENT.rank >= 2;
  }

  function getOriginalPollButtons() {
    // Only look at the active poll (previous polls remain in the DOM as history)
    // Using .well without the .active qualifier would pick up historical poll
    // buttons too, which changes the length of the NodeList once a poll has
    // been closed. That caused syncOverlayFromDom to abort on subsequent polls
    // because the overlay button count and source button count no longer
    // matched, leaving vote counts frozen until a page refresh.
    return document.querySelectorAll("#pollwrap .well.active .option button");
  }

  function stopPollDomObserver() {
    if (pollDomObserver) {
      pollDomObserver.disconnect();
      pollDomObserver = null;
      observedPollElement = null;
    }
  }

  function startPollDomObserver() {
    stopPollDomObserver();

    if (!videoOverlay || !videoOverlay.classList.contains("btfw-poll-active")) {
      return;
    }

    const pollWell = document.querySelector("#pollwrap .well.active");
    if (!pollWell) {
      setTimeout(() => {
        if (!pollDomObserver) {
          startPollDomObserver();
        }
      }, 150);
      return;
    }

    observedPollElement = pollWell;
    pollDomObserver = new MutationObserver(() => {
      if (observedPollElement && !document.contains(observedPollElement)) {
        stopPollDomObserver();
        setTimeout(() => {
          if (!pollDomObserver) {
            startPollDomObserver();
          }
        }, 120);
        return;
      }

      syncOverlayFromDom();
    });

    pollDomObserver.observe(pollWell, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });

    // Sync immediately in case the poll was updated before we attached
    syncOverlayFromDom();
  }

  function syncOverlayFromDom() {
    if (!videoOverlay) return;

    const overlayButtons = videoOverlay.querySelectorAll(".btfw-poll-option-btn");
    const originalButtons = getOriginalPollButtons();
    if (!overlayButtons.length || overlayButtons.length !== originalButtons.length) {
      return;
    }

    const newVotes = [];

    overlayButtons.forEach((button, index) => {
      const originalButton = originalButtons[index];
      const voteCount = parseInt(originalButton?.textContent) || 0;
      button.textContent = voteCount.toString();

      if (originalButton?.classList.contains("active")) {
        button.classList.add("active");
        userVotes.add(index);
      } else {
        button.classList.remove("active");
        userVotes.delete(index);
      }

      newVotes.push(voteCount);
    });

    if (newVotes.length) {
      const votesSpan = videoOverlay.querySelector(".btfw-poll-votes");
      if (votesSpan) {
        const totalVotes = newVotes.reduce((sum, count) => sum + count, 0);
        votesSpan.textContent = `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`;
      }

      if (currentPoll) {
        currentPoll.votes = newVotes;
      }
    }
  }

  function attemptVote(optionIndex, attempt = 0) {
    const originalButtons = getOriginalPollButtons();
    if (originalButtons && originalButtons[optionIndex]) {
      originalButtons[optionIndex].click();

      setTimeout(() => {
        syncOverlayFromDom();
      }, 120);
      return;
    }

    if (attempt >= 4) {
      emitVoteFallback(optionIndex);
      return;
    }

    setTimeout(() => {
      attemptVote(optionIndex, attempt + 1);
    }, 100);
  }

  function emitVoteFallback(optionIndex) {
    if (!window.socket || typeof window.socket.emit !== "function") {
      return false;
    }

    const pollId = currentPoll && (currentPoll.id ?? currentPoll.pollId ?? currentPoll.pollID ?? currentPoll.poll_id);
    const attempts = [];

    const basePayloads = [optionIndex, { option: optionIndex }];
    if (pollId != null) {
      basePayloads.push({ poll: pollId, option: optionIndex });
      basePayloads.push({ id: pollId, option: optionIndex });
    }

    const events = ["vote", "votePoll"];

    events.forEach((event) => {
      basePayloads.forEach((payload) => {
        attempts.push({ event, payload });
      });
    });

    attempts.forEach(({ event, payload }, index) => {
      setTimeout(() => {
        try {
          window.socket.emit(event, payload);
        } catch (err) {
          if (index === attempts.length - 1) {
            console.warn("[poll-overlay] Failed to emit vote via socket", err);
          }
        }
      }, index * 25);
    });

    setTimeout(() => {
      syncOverlayFromDom();
    }, attempts.length * 25 + 150);

    return attempts.length > 0;
  }

  function pollTiming(poll) {
    const rawTitle = resolvePollTitle(poll?.title);
    const titleMatch = rawTitle.match(RANDOM_POLL_TIMER_RE);
    const title = titleMatch ? rawTitle.replace(RANDOM_POLL_TIMER_RE, "").trim() : rawTitle;
    let durationSeconds = Number(poll?.timeout);

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      durationSeconds = titleMatch ? Number.parseInt(titleMatch[1], 10) * 60 : 0;
    }

    let openedAt = Number(poll?.timestamp);
    if (openedAt > 0 && openedAt < 1e12) openedAt *= 1000;

    return {
      title,
      deadline: durationSeconds > 0 && Number.isFinite(openedAt) && openedAt > 0
        ? openedAt + durationSeconds * 1000
        : null
    };
  }

  function stopPollCountdown() {
    if (pollCountdownTimer) {
      window.clearInterval(pollCountdownTimer);
      pollCountdownTimer = null;
    }
  }

  function startPollCountdown(deadline) {
    stopPollCountdown();
    const countdown = videoOverlay?.querySelector(".btfw-poll-countdown");
    const time = countdown?.querySelector(".btfw-poll-countdown-time");
    if (!countdown || !time || !Number.isFinite(deadline)) {
      if (countdown) countdown.hidden = true;
      return;
    }

    countdown.hidden = false;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;
      time.textContent = hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : `${minutes}:${String(seconds).padStart(2, "0")}`;
      countdown.setAttribute("aria-label", `Poll time remaining: ${time.textContent}`);
      if (remaining === 0) stopPollCountdown();
    };

    update();
    if (deadline > Date.now()) pollCountdownTimer = window.setInterval(update, 250);
  }

  function showVideoOverlay(poll) {
    const overlay = createVideoOverlay();
    if (!overlay || !poll) return;

    // FIXED: Create fresh poll data without contamination from previous polls
    const timing = pollTiming(poll);
    const resolvedTitle = timing.title;

    currentPoll = {
      ...poll,
      title: resolvedTitle,
      votes: poll.votes ? [...poll.votes] : new Array(poll.options?.length || 0).fill(0)
    };
    userVotes.clear(); // Reset user votes for new poll
    
    // Update overlay content
    const title = overlay.querySelector(".btfw-poll-video-title");
    const optionsGrid = overlay.querySelector(".btfw-poll-options-grid");
    const votesSpan = overlay.querySelector(".btfw-poll-votes");
    const endBtn = overlay.querySelector(".btfw-poll-end-btn");

    if (title) title.textContent = resolvedTitle;
    
    // Show/hide end poll button based on permissions
    if (endBtn) {
      endBtn.style.display = canEndPoll() ? "block" : "none";
    }
    
    if (optionsGrid && poll.options) {
      optionsGrid.innerHTML = "";
      poll.options.forEach((option, index) => {
        const optionRow = document.createElement("div");
        optionRow.className = "btfw-poll-option-row";
        
        const btn = document.createElement("button");
        btn.className = "btfw-poll-option-btn";
        btn.dataset.optionIndex = index;
        
        const optionText = document.createElement("span");
        optionText.className = "btfw-poll-option-text";
        optionText.textContent = decodeHtmlEntities(option);
        
        // FIXED: Use currentPoll.votes (cleaned data) instead of poll.votes
        const voteCount = currentPoll.votes[index] || 0;
        btn.textContent = voteCount.toString();
        
        btn.addEventListener("click", () => {
          try {
            attemptVote(index);
          } catch (e) {
            console.error("Failed to trigger poll vote:", e);
          }

          // Track user vote for visual feedback
          if (poll.multi) {
            // Multi-choice: toggle selection
            if (userVotes.has(index)) {
              userVotes.delete(index);
              btn.classList.remove("active");
            } else {
              userVotes.add(index);
              btn.classList.add("active");
            }
          } else {
            // Single choice: clear others and select this one
            userVotes.clear();
            optionsGrid.querySelectorAll(".btfw-poll-option-btn").forEach(b => {
              b.classList.remove("active");
            });
            userVotes.add(index);
            btn.classList.add("active");
          }
        });
        
        optionRow.appendChild(btn);
        optionRow.appendChild(optionText);
        optionsGrid.appendChild(optionRow);
      });
    }

    // FIXED: Use currentPoll instead of poll parameter
    updateVoteDisplay(currentPoll);
    startPollCountdown(timing.deadline);

    overlay.classList.add("btfw-poll-active");

    // Stagger the option rows in as the poll appears.
    if (anime && anime.staggerIn) {
      anime.staggerIn(overlay.querySelectorAll(".btfw-poll-option-row"), { stagger: 55, dy: 12, duration: 440, max: 16 });
    }

    // Ensure overlay stays in sync with the native poll controls once they mount
    setTimeout(() => {
      syncOverlayFromDom();
      startPollDomObserver();
    }, 200);
  }

  function hideVideoOverlay() {
    stopPollCountdown();
    if (videoOverlay) {
      videoOverlay.classList.remove("btfw-poll-active");
      currentPoll = null;
      userVotes.clear();
      stopPollDomObserver();
    }
  }

  function updateVoteDisplay(poll) {
    if (!videoOverlay || !poll) return;

    // FIXED: Don't merge with old currentPoll data - just update votes
    if (currentPoll && poll.votes) {
      currentPoll.votes = [...poll.votes]; // Fresh copy, no contamination
    }
    
    const votesSpan = videoOverlay.querySelector(".btfw-poll-votes");
    const optionsGrid = videoOverlay.querySelector(".btfw-poll-options-grid");
    
    // Update vote counts on buttons to match original poll
    if (optionsGrid && poll.votes) {
      const buttons = optionsGrid.querySelectorAll(".btfw-poll-option-btn");
      const originalPollButtons = getOriginalPollButtons();
      let mirroredActiveState = false;

      buttons.forEach((btn, index) => {
        const voteCount = poll.votes[index] || 0;
        btn.textContent = voteCount.toString();
        btn.classList.remove("active");
      });

      if (originalPollButtons.length === buttons.length) {
        buttons.forEach((btn, index) => {
          const originalBtn = originalPollButtons[index];
          if (originalBtn && originalBtn.classList.contains("active")) {
            btn.classList.add("active");
            userVotes.add(index);
            mirroredActiveState = true;
          } else {
            userVotes.delete(index);
          }
        });
      }

      if (!mirroredActiveState && userVotes.size) {
        userVotes.forEach((voteIndex) => {
          const btn = buttons[voteIndex];
          if (btn) {
            btn.classList.add("active");
          }
        });
      }
    }
    
    // Update total vote count
    if (votesSpan && poll.votes) {
      const totalVotes = poll.votes.reduce((sum, count) => sum + (count || 0), 0);
      votesSpan.textContent = `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`;
    }

    if (!pollDomObserver && videoOverlay && videoOverlay.classList.contains("btfw-poll-active")) {
      startPollDomObserver();
    }
  }

  function checkForExistingPoll() {
    // Check if there's already an active poll when the module loads
    const existingPoll = document.querySelector('#pollwrap .well.active');
    if (existingPoll) {
      console.log("Found existing active poll, extracting data...");
      
      // Extract poll data from the existing DOM
      const titleElement = existingPoll.querySelector('h3');
      const optionElements = existingPoll.querySelectorAll('.option');
      
      if (titleElement && optionElements.length > 0) {
        const nativeTimestamp = existingPoll.querySelector(".label.label-default.pull-right");
        let timestamp = Number(nativeTimestamp?.dataset?.timestamp);
        try {
          if ((!Number.isFinite(timestamp) || timestamp <= 0) && window.jQuery && nativeTimestamp) {
            timestamp = Number(window.jQuery(nativeTimestamp).data("timestamp"));
          }
        } catch (_) {}
        const pollData = {
          title: titleElement.textContent.trim(),
          options: [],
          votes: [],
          timestamp: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined,
          multi: false // Default, will be updated if we can detect it
        };
        
        optionElements.forEach((option, index) => {
          const button = option.querySelector('button');
          const optionText = option.textContent.replace(button ? button.textContent : '', '').trim();
          const voteCount = button ? parseInt(button.textContent) || 0 : 0;
          
          pollData.options.push(optionText);
          pollData.votes.push(voteCount);
        });
        
        console.log("Extracted poll data:", pollData);
        showVideoOverlay(pollData);
        return true;
      }
    }
    return false;
  }

  function wireSocketEvents() {
    if (socketEventsWired || !window.socket) return;

    try {
      // Listen for new polls
      window.socket.on("newPoll", (poll) => {
        if (poll) {
          showVideoOverlay(poll);
          trackAutomaticPoll(poll);
        }
      });

      // Listen for poll updates (vote counts)
      window.socket.on("updatePoll", (poll) => {
        if (poll && currentPoll) {
          updateVoteDisplay(poll);
        }
        if (poll) trackAutomaticPoll(poll);
      });

      // Listen for poll closure
      window.socket.on("closePoll", () => {
        hideVideoOverlay();
        finishAutomaticPoll();
      });

      window.socket.on("changeMedia", (media) => {
        updateAutoCreditsMedia(media, true);
        setTimeout(evaluateAutoCreditsPoll, 500);
      });

      window.socket.on("setCurrent", (media) => {
        updateAutoCreditsMedia(media, false);
      });

      window.socket.on("mediaUpdate", (media) => {
        updateAutoCreditsMedia(media, false);
      });

      // Handle socket reconnection
      window.socket.on("connect", () => {
        console.log("[poll-overlay] Socket reconnected, re-wiring events");
        socketEventsWired = false;
        setTimeout(() => {
          wireSocketEvents();
        }, 500);
      });

      socketEventsWired = true;
    } catch (e) {
      console.warn("[poll-overlay] Socket event wiring failed:", e);
    }
  }

  function waitForSocket() {
    return new Promise((resolve) => {
      if (window.socket && window.socket.on) {
        resolve();
        return;
      }

      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max
      const checkSocket = () => {
        attempts++;
        if (window.socket && window.socket.on) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(checkSocket, 100);
        } else {
          console.warn("[poll-overlay] Socket not available after 5 seconds");
          resolve(); // Continue anyway
        }
      };

      setTimeout(checkSocket, 100);
    });
  }

  async function boot() {
    try {
      injectCSS();
      
      // Wait for socket to be available before wiring events
      await waitForSocket();
      wireSocketEvents();
      setupRandomPollControls();
      setupAutoCreditsPolling();
      
      // Check for existing poll after a short delay to ensure DOM is ready
      setTimeout(() => {
        checkForExistingPoll();
      }, 500);
      
    } catch (e) {
      console.error("[poll-overlay] Boot failed:", e);
    }
  }

  // Boot when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    setTimeout(boot, 0); // Async to avoid blocking
  }

  // Also boot on layout ready event (with delay to ensure everything is settled)
  document.addEventListener("btfw:layoutReady", () => {
    setTimeout(boot, 200);
  });

  return {
    name: "feature:poll-overlay",
    showOverlay: showVideoOverlay,
    hideOverlay: hideVideoOverlay,
    openRandomMoviePoll: openRandomPollBuilder
  };
});
