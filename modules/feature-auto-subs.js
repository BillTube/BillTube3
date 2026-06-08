/* BTFW – feature:auto-subs */
BTFW.define("feature:auto-subs", [], async () => {
  const MODULE_NAME = "feature:auto-subs";
  const WYZIE_API = "https://sub.wyzie.io/search";
  const TMDB_API = "https://api.themoviedb.org/3";
  // CORS proxy for the Stremio OpenSubtitles v3 addon. The raw addon (and its
  // subtitle files) send no CORS headers, so the browser can't read them; this
  // worker mirrors the addon's paths and rewrites subtitle URLs through itself.
  // Override via Theme Toolkit integrations or localStorage "btfw:stremio:subs".
  const STREMIO_DEFAULT_ADDON = "https://subs-proxy.billtube.workers.dev";
  const LOCAL_LABEL_PREFIX = "Local: ";

  function isLocalSubTrack(track) {
    const label = track && typeof track.label === "string" ? track.label : "";
    return label.indexOf(LOCAL_LABEL_PREFIX) === 0;
  }

  const state = {
    active: false,
    tmdbKey: null,
    wyzieKey: null,
    subdlKey: null,
    warnedNoKey: false,
    warnedNoWyzieKey: false,
    currentTitle: "",
    subsCache: new Map(),
    lastAddedTracks: [],
    currentSubtitles: null,
    player: null,
    socket: null,
    socketHandler: null,
    socketDetach: null,
    isFetching: false,
    trackWatcher: null,
    bootInterval: null,
    datasetObserver: null,
    updatingRuntime: false,
    isEvaluating: false
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
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
      () => window.BTFW_THEME_ADMIN?.integrations?.autoSubs?.enabled,
      () => window.BTFW_CONFIG?.integrations?.autoSubs?.enabled,
      () => window.BTFW_CONFIG?.autoSubs?.enabled,
      () => window.BTFW_CONFIG?.autoSubsEnabled,
      () => window.BTFW_CONFIG?.shouldLoadAutoSubs,
      () => document?.body?.dataset?.btfwAutoSubsEnabled
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

  function getTMDBKey() {
    try {
      const cfg = (window.BTFW_CONFIG && typeof window.BTFW_CONFIG === "object") ? window.BTFW_CONFIG : {};
      const admin = (window.BTFW_THEME_ADMIN && typeof window.BTFW_THEME_ADMIN === "object") ? window.BTFW_THEME_ADMIN : {};
      const cfgTmdb = (cfg.tmdb && typeof cfg.tmdb === "object") ? cfg.tmdb : {};
      const adminTmdb = (admin.integrations?.tmdb && typeof admin.integrations.tmdb === "object") ? admin.integrations.tmdb : {};
      const integrations = (cfg.integrations && typeof cfg.integrations === "object") ? cfg.integrations : {};
      const intTmdb = (integrations.tmdb && typeof integrations.tmdb === "object") ? integrations.tmdb : {};

      const cfgKey = typeof cfgTmdb.apiKey === "string" ? cfgTmdb.apiKey.trim() : "";
      const adminKey = typeof adminTmdb.apiKey === "string" ? adminTmdb.apiKey.trim() : "";
      const intKey = typeof intTmdb.apiKey === "string" ? intTmdb.apiKey.trim() : "";
      const legacyCfg = typeof cfg.tmdbKey === "string" ? cfg.tmdbKey.trim() : "";
      let lsKey = "";
      try {
        lsKey = (localStorage.getItem("btfw:tmdb:key") || "").trim();
      } catch (_) {}
      const g = v => (v == null ? "" : String(v)).trim();
      const globalKey = g(window.TMDB_API_KEY) || g(window.BTFW_TMDB_KEY) || g(window.tmdb_key) || g(window.moviedbkey);
      const bodyKey = (document.body?.dataset?.tmdbKey || "").trim();
      const key = adminKey || intKey || cfgKey || legacyCfg || lsKey || globalKey || bodyKey;
      return key || null;
    } catch (_) {
      return null;
    }
  }

  function getStremioAddon() {
    try {
      const cfg = (window.BTFW_CONFIG && typeof window.BTFW_CONFIG === "object") ? window.BTFW_CONFIG : {};
      const admin = (window.BTFW_THEME_ADMIN && typeof window.BTFW_THEME_ADMIN === "object") ? window.BTFW_THEME_ADMIN : {};
      const adminUrl = admin.integrations?.autoSubs?.stremioAddon;
      const cfgUrl = cfg.integrations?.autoSubs?.stremioAddon;
      let lsUrl = "";
      try { lsUrl = (localStorage.getItem("btfw:stremio:subs") || "").trim(); } catch (_) {}
      const url = (adminUrl || cfgUrl || lsUrl || STREMIO_DEFAULT_ADDON || "").trim();
      return url.replace(/\/+$/, "");
    } catch (_) {
      return STREMIO_DEFAULT_ADDON;
    }
  }

  function getWyzieKey() {
    try {
      const cfg = (window.BTFW_CONFIG && typeof window.BTFW_CONFIG === "object") ? window.BTFW_CONFIG : {};
      const admin = (window.BTFW_THEME_ADMIN && typeof window.BTFW_THEME_ADMIN === "object") ? window.BTFW_THEME_ADMIN : {};
      const integrations = (cfg.integrations && typeof cfg.integrations === "object") ? cfg.integrations : {};
      const cfgWyzie = (cfg.wyzie && typeof cfg.wyzie === "object") ? cfg.wyzie : {};
      const adminWyzie = (admin.integrations?.wyzie && typeof admin.integrations.wyzie === "object") ? admin.integrations.wyzie : {};
      const intWyzie = (integrations.wyzie && typeof integrations.wyzie === "object") ? integrations.wyzie : {};
      let lsKey = "";
      try { lsKey = (localStorage.getItem("btfw:wyzie:key") || "").trim(); } catch (_) {}
      const g = v => (v == null ? "" : String(v)).trim();
      return adminWyzie.apiKey?.trim?.() || intWyzie.apiKey?.trim?.() || cfgWyzie.apiKey?.trim?.() ||
        g(cfg.wyzieKey) || lsKey || g(window.WYZIE_API_KEY) || g(window.BTFW_WYZIE_KEY) ||
        g(window.wyzie_key) || (document.body?.dataset?.wyzieKey || "").trim() || null;
    } catch (_) {
      return null;
    }
  }

  function getSubDLKey() {
    try {
      const cfg = (window.BTFW_CONFIG && typeof window.BTFW_CONFIG === "object") ? window.BTFW_CONFIG : {};
      const admin = (window.BTFW_THEME_ADMIN && typeof window.BTFW_THEME_ADMIN === "object") ? window.BTFW_THEME_ADMIN : {};
      const integrations = (cfg.integrations && typeof cfg.integrations === "object") ? cfg.integrations : {};
      const cfgSubdl = (cfg.subdl && typeof cfg.subdl === "object") ? cfg.subdl : {};
      const adminSubdl = (admin.integrations?.subdl && typeof admin.integrations.subdl === "object") ? admin.integrations.subdl : {};
      const intSubdl = (integrations.subdl && typeof integrations.subdl === "object") ? integrations.subdl : {};
      let lsKey = "";
      try { lsKey = (localStorage.getItem("btfw:subdl:key") || "").trim(); } catch (_) {}
      const g = v => (v == null ? "" : String(v)).trim();
      return adminSubdl.apiKey?.trim?.() || intSubdl.apiKey?.trim?.() || cfgSubdl.apiKey?.trim?.() ||
        g(cfg.subdlKey) || lsKey || g(window.SUBDL_API_KEY) || g(window.BTFW_SUBDL_KEY) ||
        (document.body?.dataset?.subdlKey || "").trim() || null;
    } catch (_) {
      return null;
    }
  }

  function updateRuntimeFlags(enabled) {
    const flag = Boolean(enabled);
    state.updatingRuntime = true;
    try {
      window.BTFW_CONFIG = window.BTFW_CONFIG || {};
      if (typeof window.BTFW_CONFIG.integrations !== "object") {
        window.BTFW_CONFIG.integrations = {};
      }
      window.BTFW_CONFIG.integrations.autoSubs = window.BTFW_CONFIG.integrations.autoSubs || {};
      window.BTFW_CONFIG.integrations.autoSubs.enabled = flag;
      window.BTFW_CONFIG.autoSubs = window.BTFW_CONFIG.autoSubs || {};
      window.BTFW_CONFIG.autoSubs.enabled = flag;
      window.BTFW_CONFIG.autoSubsEnabled = flag;
      window.BTFW_CONFIG.shouldLoadAutoSubs = flag;
    } catch (_) {}
    try {
      const body = document?.body;
      if (body) {
        if (flag) {
          body.dataset.btfwAutoSubsEnabled = "1";
        } else if (body.dataset?.btfwAutoSubsEnabled) {
          delete body.dataset.btfwAutoSubsEnabled;
        }
      }
    } catch (_) {}
    setTimeout(() => {
      state.updatingRuntime = false;
    }, 0);
  }

  function warnMissingKey() {
    if (state.warnedNoKey) return;
    state.warnedNoKey = true;
    console.error("[auto-subs] TMDB API key missing. Set it under Theme Toolkit → Integrations before enabling Auto subtitles.");
  }

  function warnMissingWyzieKey() {
    if (state.warnedNoWyzieKey) return;
    state.warnedNoWyzieKey = true;
    console.info("[auto-subs] No Wyzie API key set — falling back to community Stremio subtitle addon.");
  }

  function clearWarning() {
    state.warnedNoKey = false;
    state.warnedNoWyzieKey = false;
  }

  function shouldLoadSubtitles() {
    const mediaType = window.PLAYER?.mediaType;
    if (mediaType === "fi" || mediaType === "gd") return true;
    const video = $("#ytapiplayer video") || $("#videowrap video");
    return Boolean(video && (video.currentSrc || video.src));
  }

  function getPlayer() {
    if (state.player && typeof state.player.addRemoteTextTrack === "function") return state.player;
    const wrap = $("#videowrap");
    if (!wrap) return null;
    const video = wrap.querySelector("video") || $("#ytapiplayer video");
    if (!video) return null;
    if (typeof window.videojs === "function") {
      try {
        state.player = window.videojs(video);
        return state.player;
      } catch (_) {
        state.player = null;
      }
    }
    state.player = createNativeVideoAdapter(video);
    return state.player;
  }

  function createNativeVideoAdapter(video) {
    return {
      addRemoteTextTrack(track) {
        if (!track || !track.src) return null;
        const el = document.createElement("track");
        el.kind = track.kind || "subtitles";
        el.src = track.src;
        el.srclang = track.srclang || "en";
        el.label = track.label || "Auto subtitles";
        el.dataset.btfwAutoSubs = "1";
        video.appendChild(el);
        try {
          for (const item of video.textTracks) {
            item.mode = item.label === el.label ? "showing" : "disabled";
          }
        } catch (_) {}
        return el;
      },
      remoteTextTracks() {
        return Array.from(video.querySelectorAll('track[data-btfw-auto-subs="1"]'));
      },
      removeRemoteTextTrack(track) {
        const src = track?.src || "";
        const label = track?.label || "";
        const matches = Array.from(video.querySelectorAll('track[data-btfw-auto-subs="1"]'));
        matches.forEach(el => {
          if (track === el || (src && el.src === src) || (label && el.label === label)) {
            try { el.remove(); } catch (_) {}
          }
        });
      }
    };
  }

  function getSocket() {
    if (state.socket) return state.socket;
    if (window.socket && typeof window.socket.on === "function") {
      state.socket = window.socket;
      return state.socket;
    }
    if (window.SOCKET && typeof window.SOCKET.on === "function") {
      state.socket = window.SOCKET;
      return state.socket;
    }
    return null;
  }

  function detachSocket() {
    if (state.socketDetach) {
      try { state.socketDetach(); }
      catch (_) {}
    }
    state.socketDetach = null;
    state.socketHandler = null;
    state.socket = null;
  }

  function hookSocketEvents() {
    const socket = getSocket();
    if (!socket) return false;
    if (state.socketHandler && state.socket === socket) {
      return true;
    }
    if (state.socket && state.socket !== socket) {
      detachSocket();
    }
    const handler = () => {
      if (!state.active) return;
      state.player = null;
      state.currentTitle = "";
      state.currentSubtitles = null;
      state.isFetching = false;
      stopTrackWatcher();
      clearExistingTracks();
      setTimeout(() => {
        if (!state.active) return;
        state.player = getPlayer();
        if (state.player) {
          processCurrentTitle();
        }
      }, 1000);
    };

    let detach = null;
    if (typeof socket.on === "function") {
      socket.on("changeMedia", handler);
      detach = () => {
        try {
          if (typeof socket.off === "function") {
            socket.off("changeMedia", handler);
          } else if (typeof socket.removeListener === "function") {
            socket.removeListener("changeMedia", handler);
          } else if (typeof socket.removeEventListener === "function") {
            socket.removeEventListener("changeMedia", handler);
          }
        } catch (_) {}
      };
    } else if (typeof socket.addEventListener === "function") {
      socket.addEventListener("changeMedia", handler);
      detach = () => {
        try { socket.removeEventListener("changeMedia", handler); }
        catch (_) {}
      };
    }

    state.socket = socket;
    state.socketHandler = handler;
    state.socketDetach = detach;
    return true;
  }

  function getCurrentTitle() {
    const titleEl = $("#currenttitle");
    return titleEl ? titleEl.textContent.trim() : "";
  }

  function normalizeTitle(title) {
    return title.toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanMovieTitle(title) {
    const unwantedWords = [
      "Extended",
      "Director's Cut",
      "Directors Cut",
      "Unrated",
      "Theatrical Cut",
      "Remastered"
    ];
    let cleanTitle = title;
    unwantedWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      cleanTitle = cleanTitle.replace(regex, "");
    });
    return cleanTitle.replace(/\s{2,}/g, " ").trim();
  }

  function extractYearAndTitle(title) {
    const yearParenMatch = title.match(/^(.+?)\s*\((\d{4})\)\s*$/);
    if (yearParenMatch) {
      return {
        title: yearParenMatch[1].trim(),
        year: parseInt(yearParenMatch[2], 10),
        originalTitle: title
      };
    }
    const yearPlainMatch = title.match(/^(.+?)\s+(\d{4})\s*$/);
    if (yearPlainMatch) {
      return {
        title: yearPlainMatch[1].trim(),
        year: parseInt(yearPlainMatch[2], 10),
        originalTitle: title
      };
    }
    return {
      title: title.trim(),
      year: null,
      originalTitle: title
    };
  }

  function isExactTitleMatch(searchTitle, resultTitle, targetYear = null, resultYear = null) {
    const normalizedSearch = normalizeTitle(searchTitle);
    const normalizedResult = normalizeTitle(resultTitle);
    const titleMatch = normalizedSearch === normalizedResult ||
      normalizedResult === normalizedSearch ||
      normalizedResult.replace(/^(the|a|an)\s+/, "") === normalizedSearch.replace(/^(the|a|an)\s+/, "");
    if (!titleMatch) return false;
    if (targetYear && resultYear) {
      return Math.abs(targetYear - resultYear) <= 1;
    }
    return true;
  }

  function clearExistingTracks() {
    const player = getPlayer();
    if (!player) return;
    state.lastAddedTracks.forEach(trackEl => {
      try {
        if (trackEl) {
          const src = trackEl.src || trackEl.track?.src || "";
          if (src && src.startsWith("blob:")) {
            URL.revokeObjectURL(src);
          }
          if (trackEl.parentNode) {
            trackEl.remove();
          } else if (trackEl.track) {
            player.removeRemoteTextTrack(trackEl.track);
          } else {
            player.removeRemoteTextTrack(trackEl);
          }
        }
      } catch (_) {}
    });
    state.lastAddedTracks = [];
    try {
      const tracks = player.remoteTextTracks();
      const toRemove = [];
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (!track || !track.src || !track.src.startsWith("blob:")) continue;
        if (isLocalSubTrack(track)) continue; // preserve local-subs tracks
        toRemove.push(track);
      }
      toRemove.forEach(track => {
        try {
          URL.revokeObjectURL(track.src);
          player.removeRemoteTextTrack(track);
        } catch (_) {}
      });
    } catch (_) {}
  }

  async function searchTMDB(title, year) {
    if (!state.tmdbKey) return null;
    const key = state.tmdbKey;
    let apiUrl = `${TMDB_API}/search/movie?api_key=${key}&query=${encodeURIComponent(title)}`;
    if (year) {
      apiUrl += `&primary_release_year=${year}`;
    }
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        for (const movie of data.results) {
          const movieYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4), 10) : null;
          if (isExactTitleMatch(title, movie.title, year, movieYear)) {
            const extIdsResp = await fetch(`${TMDB_API}/movie/${movie.id}/external_ids?api_key=${key}`);
            const extIds = await extIdsResp.json();
            return extIds.imdb_id || null;
          }
        }
        if (year) {
          for (const movie of data.results) {
            const movieYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4), 10) : null;
            if (movieYear === year) {
              const extIdsResp = await fetch(`${TMDB_API}/movie/${movie.id}/external_ids?api_key=${key}`);
              const extIds = await extIdsResp.json();
              return extIds.imdb_id || null;
            }
          }
        }
      }
    } catch (_) {}
    if (year) {
      const apiUrlNoYear = `${TMDB_API}/search/movie?api_key=${key}&query=${encodeURIComponent(title)}`;
      try {
        const response = await fetch(apiUrlNoYear);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const movie = data.results[0];
          const extIdsResp = await fetch(`${TMDB_API}/movie/${movie.id}/external_ids?api_key=${key}`);
          const extIds = await extIdsResp.json();
          return extIds.imdb_id || null;
        }
      } catch (_) {}
    }
    return null;
  }

  async function fetchSubtitlesWyzie(imdbId, season, episode) {
    if (!imdbId || !state.wyzieKey) return null;
    const sources = ["opensubtitles", "all"];
    for (const source of sources) {
      const params = new URLSearchParams({ id: imdbId });
      if (season !== null && episode !== null) {
        params.append("season", season);
        params.append("episode", episode);
      }
      params.append("language", "en");
      params.append("format", "srt");
      params.append("source", source);
      params.append("key", state.wyzieKey);
      const url = `${WYZIE_API}?${params}`;
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          const converted = await Promise.all(
            data.slice(0, 10).map(sub => convertSrtToVtt(sub))
          );
          const filtered = converted.filter(Boolean);
          if (filtered.length > 0) {
            return filtered;
          }
        }
      } catch (_) {
        continue;
      }
    }
    return null;
  }

  async function fetchSubtitlesStremio(imdbId, season, episode) {
    const addon = getStremioAddon();
    if (!addon || !imdbId) return null;
    const isSeries = season !== null && episode !== null;
    const path = isSeries
      ? `subtitles/series/${imdbId}:${season}:${episode}.json`
      : `subtitles/movie/${imdbId}.json`;
    const url = `${addon}/${path}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();
      const list = Array.isArray(data?.subtitles) ? data.subtitles : [];
      if (list.length === 0) return null;
      const englishOnly = list.filter(s => {
        const lang = String(s?.lang || s?.language || "").toLowerCase();
        return !lang || lang === "en" || lang === "eng" || lang === "english";
      });
      const pickFrom = englishOnly.length > 0 ? englishOnly : list;
      const converted = await Promise.all(
        pickFrom.slice(0, 10).map(sub => convertSrtToVtt(sub))
      );
      const filtered = converted.filter(Boolean);
      return filtered.length > 0 ? filtered : null;
    } catch (_) {
      return null;
    }
  }

  async function fetchSubtitles(imdbId, season, episode) {
    if (!imdbId) return null;
    // Optional keyed sources first (reliable), then the keyless Stremio addon.
    if (state.wyzieKey) {
      const wyzie = await fetchSubtitlesWyzie(imdbId, season, episode);
      if (wyzie && wyzie.length > 0) return wyzie;
    }
    if (state.subdlKey) {
      const subdl = await fetchSubtitlesSubDL(imdbId, season, episode);
      if (subdl && subdl.length > 0) return subdl;
    }
    return await fetchSubtitlesStremio(imdbId, season, episode);
  }

  async function convertSrtToVtt(subtitle) {
    if (!subtitle || !subtitle.url) return null;
    try {
      const srtResp = await fetch(subtitle.url);
      if (!srtResp.ok) return null;
      const srtText = await srtResp.text();
      const vttText = srtText.trimStart().startsWith("WEBVTT") ? srtText : srtToVtt(srtText);
      const blob = new Blob([vttText], { type: "text/vtt" });
      const vttUrl = URL.createObjectURL(blob);
      return { url: vttUrl, lang: subtitle.lang || "en" };
    } catch (_) {
      return null;
    }
  }

  function srtToVtt(srt) {
    let vtt = "WEBVTT\n\n";
    vtt += String(srt)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, "$1:$2:$3.$4")
      .replace(/^\d+\n/gm, "")
      .trim();
    return vtt;
  }

  /* ---- SubDL (client-side) ----------------------------------------------
     SubDL blocks datacenter/worker IPs, so it has to run here in the browser
     (residential IP, and api.subdl.com/dl.subdl.com both allow CORS). SubDL
     ships subtitles as .zip; we inflate the .srt locally with the browser's
     built-in DecompressionStream — no worker, no external library. */
  function _u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function _u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  async function extractSrtFromZip(buf) {
    const b = new Uint8Array(buf);
    let eocd = -1;
    const minScan = Math.max(0, b.length - 22 - 65536);
    for (let i = b.length - 22; i >= minScan; i--) { if (_u32(b, i) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) return null;
    const count = _u16(b, eocd + 10);
    let off = _u32(b, eocd + 16);
    let best = null;
    for (let n = 0; n < count && off + 46 <= b.length; n++) {
      if (_u32(b, off) !== 0x02014b50) break;
      const method = _u16(b, off + 10);
      const compSize = _u32(b, off + 20);
      const nameLen = _u16(b, off + 28);
      const extraLen = _u16(b, off + 30);
      const commentLen = _u16(b, off + 32);
      const localOff = _u32(b, off + 42);
      const name = new TextDecoder().decode(b.subarray(off + 46, off + 46 + nameLen));
      const entry = { method, compSize, localOff };
      if (/\.srt$/i.test(name)) { best = entry; break; }
      if (!best && /\.(vtt|ssa|ass|sub|txt)$/i.test(name)) best = entry;
      if (!best) best = entry;
      off += 46 + nameLen + extraLen + commentLen;
    }
    if (!best) return null;
    const lo = best.localOff;
    if (_u32(b, lo) !== 0x04034b50) return null;
    const dataStart = lo + 30 + _u16(b, lo + 26) + _u16(b, lo + 28);
    const comp = b.subarray(dataStart, dataStart + best.compSize);
    let outBytes;
    if (best.method === 0) {
      outBytes = comp;
    } else if (best.method === 8 && typeof DecompressionStream === "function") {
      const ds = new DecompressionStream("deflate-raw");
      const stream = new Response(comp).body.pipeThrough(ds);
      outBytes = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      return null;
    }
    try { return new TextDecoder("utf-8", { fatal: false }).decode(outBytes); }
    catch (_) { return new TextDecoder("windows-1252").decode(outBytes); }
  }

  async function fetchSubtitlesSubDL(imdbId, season, episode) {
    if (!state.subdlKey || !imdbId) return null;
    const isSeries = season !== null && episode !== null;
    const params = new URLSearchParams({
      api_key: state.subdlKey,
      imdb_id: imdbId,
      languages: "EN",
      subs_per_page: "30",
      type: isSeries ? "tv" : "movie"
    });
    if (isSeries) { params.append("season_number", season); params.append("episode_number", episode); }
    let list;
    try {
      const resp = await fetch(`https://api.subdl.com/api/v1/subtitles?${params}`, { credentials: "omit" });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data || data.status === false || !Array.isArray(data.subtitles)) return null;
      const english = data.subtitles.filter(s => {
        const lang = String((s && (s.language || s.lang)) || "").toLowerCase();
        return s && s.url && (lang === "en" || lang === "eng" || lang === "english");
      });
      list = (english.length > 0 ? english : data.subtitles).slice(0, 8);
    } catch (_) {
      return null;
    }
    const results = [];
    for (const sub of list) {
      try {
        const zipResp = await fetch(`https://dl.subdl.com${sub.url}`, { credentials: "omit" });
        if (!zipResp.ok) continue;
        const srtText = await extractSrtFromZip(await zipResp.arrayBuffer());
        if (!srtText || !/-->/.test(srtText)) continue;
        const vttText = srtText.trimStart().startsWith("WEBVTT") ? srtText : srtToVtt(srtText);
        const blob = new Blob([vttText], { type: "text/vtt" });
        results.push({ url: URL.createObjectURL(blob), lang: "en" });
      } catch (_) {}
    }
    return results.length > 0 ? results : null;
  }

  function addSubtitlesToPlayer(subtitles) {
    if (!Array.isArray(subtitles) || subtitles.length === 0) return false;
    const player = getPlayer();
    if (!player || typeof player.addRemoteTextTrack !== "function") return false;
    const existingTracks = player.remoteTextTracks();
    const hasNonLocalBlobTracks = existingTracks && Array.from(existingTracks).some(
      t => t.src && t.src.startsWith("blob:") && !isLocalSubTrack(t)
    );
    if (hasNonLocalBlobTracks) return false;
    clearExistingTracks();
    const added = [];
    subtitles.forEach((sub, idx) => {
      if (!sub || !sub.url) return;
      const label = `Auto sub ${idx + 1}`;
      try {
        const trackEl = player.addRemoteTextTrack({
          kind: "subtitles",
          src: sub.url,
          srclang: sub.lang || "en",
          label
        }, false);
        if (trackEl) {
          added.push(trackEl);
        }
      } catch (_) {}
    });
    state.lastAddedTracks = added;
    state.currentSubtitles = subtitles;
    return added.length > 0;
  }

  function startTrackWatcher() {
    if (state.trackWatcher) return;
    state.trackWatcher = setInterval(() => {
      if (!state.active) {
        stopTrackWatcher();
        return;
      }
      if (!shouldLoadSubtitles()) {
        stopTrackWatcher();
        clearExistingTracks();
        return;
      }
      const player = getPlayer();
      if (!player || !state.currentSubtitles || state.currentSubtitles.length === 0) return;
      const existingTracks = player.remoteTextTracks();
      const hasNonLocalBlobTracks = existingTracks && Array.from(existingTracks).some(
        t => t.src && t.src.startsWith("blob:") && !isLocalSubTrack(t)
      );
      if (!hasNonLocalBlobTracks && state.lastAddedTracks.length > 0) {
        state.lastAddedTracks = [];
        setTimeout(() => {
          if (state.active) {
            addSubtitlesToPlayer(state.currentSubtitles);
          }
        }, 100);
      }
    }, 1000);
  }

  function stopTrackWatcher() {
    if (state.trackWatcher) {
      clearInterval(state.trackWatcher);
      state.trackWatcher = null;
    }
  }

  async function processCurrentTitle() {
    if (!state.active || state.isFetching) return;
    const title = getCurrentTitle();
    if (!title || title === state.currentTitle) return;
    if (!shouldLoadSubtitles()) {
      state.currentTitle = title;
      clearExistingTracks();
      stopTrackWatcher();
      return;
    }
    state.currentTitle = title;
    state.isFetching = true;
    try {
      const player = getPlayer();
      if (!player || typeof player.addRemoteTextTrack !== "function") return;
      if (state.subsCache.has(title)) {
        const cached = state.subsCache.get(title);
        if (cached) {
          const added = addSubtitlesToPlayer(cached);
          if (added) {
            startTrackWatcher();
          }
        }
        return;
      }
      let season = null;
      let episode = null;
      const episodeMatch = title.match(/S(\d+)E(\d+)/i);
      if (episodeMatch) {
        season = parseInt(episodeMatch[1], 10);
        episode = parseInt(episodeMatch[2], 10);
      }
      const { title: cleanTitle, year } = extractYearAndTitle(title);
      const finalTitle = cleanMovieTitle(cleanTitle);
      const imdbId = await searchTMDB(finalTitle, year);
      if (!imdbId) {
        state.subsCache.set(title, null);
        return;
      }
      const subtitles = await fetchSubtitles(imdbId, season, episode);
      if (subtitles && subtitles.length > 0) {
        state.subsCache.set(title, subtitles);
        const added = addSubtitlesToPlayer(subtitles);
        if (added) {
          startTrackWatcher();
        }
      } else {
        state.subsCache.set(title, null);
      }
    } catch (_) {
    } finally {
      state.isFetching = false;
    }
  }

  function startBootProcess() {
    if (state.bootInterval) {
      clearInterval(state.bootInterval);
      state.bootInterval = null;
    }
    let attempts = 0;
    const tick = () => {
      if (!state.active) {
        if (state.bootInterval) {
          clearInterval(state.bootInterval);
          state.bootInterval = null;
        }
        return;
      }
      attempts += 1;
      const player = getPlayer();
      const socket = getSocket();
      if (player && socket) {
        if (state.bootInterval) {
          clearInterval(state.bootInterval);
          state.bootInterval = null;
        }
        hookSocketEvents();
        clearExistingTracks();
        if (shouldLoadSubtitles()) {
          startTrackWatcher();
          setTimeout(processCurrentTitle, 1000);
        }
        return;
      }
      if (attempts >= 20 && state.bootInterval) {
        clearInterval(state.bootInterval);
        state.bootInterval = null;
      }
    };
    state.bootInterval = setInterval(tick, 500);
    setTimeout(tick, 100);
  }

  function ensureDatasetObserver() {
    if (state.datasetObserver || typeof MutationObserver !== "function") return;
    const body = document.body;
    if (!body) return;
    state.datasetObserver = new MutationObserver(() => {
      if (state.updatingRuntime) return;
      evaluateActivation();
    });
    state.datasetObserver.observe(body, {
      attributes: true,
      attributeFilter: ["data-btfw-auto-subs-enabled", "data-tmdb-key", "data-wyzie-key"]
    });
  }

  function activate(tmdbKey, wyzieKey, subdlKey) {
    const keyChanged = Boolean(
      (state.tmdbKey && state.tmdbKey !== tmdbKey) ||
      (state.wyzieKey && state.wyzieKey !== wyzieKey) ||
      (state.subdlKey && state.subdlKey !== subdlKey)
    );
    state.tmdbKey = tmdbKey;
    state.wyzieKey = wyzieKey;
    state.subdlKey = subdlKey;
    clearWarning();
    if (state.active) {
      updateRuntimeFlags(true);
      if (keyChanged) {
        state.subsCache.clear();
        state.currentTitle = "";
      }
      if (!state.currentTitle || keyChanged) {
        processCurrentTitle();
      }
      return;
    }
    state.active = true;
    updateRuntimeFlags(true);
    ensureDatasetObserver();
    state.subsCache.clear();
    state.currentTitle = "";
    startBootProcess();
  }

  function deactivate() {
    if (state.bootInterval) {
      clearInterval(state.bootInterval);
      state.bootInterval = null;
    }
    stopTrackWatcher();
    clearExistingTracks();
    detachSocket();
    state.subsCache.clear();
    state.player = null;
    state.currentSubtitles = null;
    state.lastAddedTracks = [];
    state.currentTitle = "";
    state.isFetching = false;
    state.tmdbKey = null;
    state.wyzieKey = null;
    state.subdlKey = null;
    state.active = false;
    updateRuntimeFlags(false);
  }

  function evaluateActivation() {
    if (state.updatingRuntime) return;
    if (state.isEvaluating) return;
    state.isEvaluating = true;
    try {
      const enabled = computeEnabled();
      if (!enabled) {
        deactivate();
        return;
      }
      const key = getTMDBKey();
      if (!key) {
        warnMissingKey();
        deactivate();
        return;
      }
      const wyzieKey = getWyzieKey();
      const subdlKey = getSubDLKey();
      if (!wyzieKey && !subdlKey) {
        warnMissingWyzieKey();
      }
      activate(key, wyzieKey || null, subdlKey || null);
      processCurrentTitle();
    } finally {
      state.isEvaluating = false;
    }
  }

  function onReady() {
    ensureDatasetObserver();
    evaluateActivation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady, { once: true });
  } else {
    onReady();
  }

  document.addEventListener("btfw:ready", evaluateActivation);
  document.addEventListener("btfw:channelIntegrationsChanged", evaluateActivation);

  return {
    name: MODULE_NAME,
    refresh: () => {
      if (!state.active) return;
      state.currentTitle = "";
      processCurrentTitle();
    },
    clearCache: () => {
      state.subsCache.clear();
    }
  };
});
