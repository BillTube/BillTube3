/* BTFW – feature:auto-subs */
BTFW.define("feature:auto-subs", [], async () => {
  const MODULE_NAME = "feature:auto-subs";
  const WYZIE_API = "https://sub.wyzie.ru/search";
  const TMDB_API = "https://api.themoviedb.org/3";

  const state = {
    active: false,
    tmdbKey: null,
    warnedNoKey: false,
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
    datasetObserver: null
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

  function updateRuntimeFlags(enabled) {
    const flag = Boolean(enabled);
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
  }

  function warnMissingKey() {
    if (state.warnedNoKey) return;
    state.warnedNoKey = true;
    console.error("[auto-subs] TMDB API key missing. Set it under Theme Toolkit → Integrations before enabling Auto subtitles.");
  }

  function clearWarning() {
    state.warnedNoKey = false;
  }

  function shouldLoadSubtitles() {
    const mediaType = window.PLAYER?.mediaType;
    return mediaType === "fi" || mediaType === "gd";
  }

  function getPlayer() {
    if (state.player && typeof state.player.addRemoteTextTrack === "function") return state.player;
    const wrap = $("#videowrap");
    if (!wrap) return null;
    const video = wrap.querySelector("video");
    if (!video) return null;
    if (typeof window.videojs === "function") {
      try {
        state.player = window.videojs(video);
        return state.player;
      } catch (_) {
        return null;
      }
    }
    return null;
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
        if (trackEl && trackEl.track) {
          const src = trackEl.track.src;
          if (src && src.startsWith("blob:")) {
            URL.revokeObjectURL(src);
          }
          player.removeRemoteTextTrack(trackEl.track);
        }
      } catch (_) {}
    });
    state.lastAddedTracks = [];
    try {
      const tracks = player.remoteTextTracks();
      const toRemove = [];
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track.src && track.src.startsWith("blob:")) {
          toRemove.push(track);
        }
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

  async function fetchSubtitles(imdbId, season, episode) {
    if (!imdbId) return null;
    const sources = ["opensubtitles", "subdl", "all"];
    for (const source of sources) {
      const params = new URLSearchParams({ id: imdbId });
      if (season !== null && episode !== null) {
        params.append("season", season);
        params.append("episode", episode);
      }
      params.append("language", "en");
      params.append("format", "srt");
      params.append("source", source);
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

  async function convertSrtToVtt(subtitle) {
    if (!subtitle || !subtitle.url) return null;
    try {
      const srtResp = await fetch(subtitle.url);
      if (!srtResp.ok) return null;
      const srtText = await srtResp.text();
      const vttText = srtToVtt(srtText);
      const blob = new Blob([vttText], { type: "text/vtt" });
      const vttUrl = URL.createObjectURL(blob);
      return { url: vttUrl, lang: "en" };
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

  function addSubtitlesToPlayer(subtitles) {
    if (!Array.isArray(subtitles) || subtitles.length === 0) return false;
    const player = getPlayer();
    if (!player || typeof player.addRemoteTextTrack !== "function") return false;
    const existingTracks = player.remoteTextTracks();
    const hasBlobTracks = existingTracks && Array.from(existingTracks).some(t => t.src && t.src.startsWith("blob:"));
    if (hasBlobTracks) return false;
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
      const hasBlobTracks = existingTracks && Array.from(existingTracks).some(t => t.src && t.src.startsWith("blob:"));
      if (!hasBlobTracks && state.lastAddedTracks.length > 0) {
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
      evaluateActivation();
    });
    state.datasetObserver.observe(body, {
      attributes: true,
      attributeFilter: ["data-btfw-auto-subs-enabled", "data-tmdb-key"]
    });
  }

  function activate(tmdbKey) {
    const keyChanged = Boolean(state.tmdbKey && state.tmdbKey !== tmdbKey);
    state.tmdbKey = tmdbKey;
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
    state.active = false;
    updateRuntimeFlags(false);
  }

  function evaluateActivation() {
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
    activate(key);
    processCurrentTitle();
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
