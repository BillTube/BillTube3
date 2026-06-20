/* BillTube Framework — public TMDB playlist catalogue */
BTFW.define("feature:playlistCatalog", [], async () => {
  const TMDB_API = "https://api.themoviedb.org";
  const PAGE_SIZE = 20;
  const $ = (sel, root = document) => root.querySelector(sel);

  const state = {
    modal: null,
    listEl: null,
    statusEl: null,
    queryEl: null,
    typeEl: null,
    sortEl: null,
    items: [],
    page: 0,
    totalPages: 1,
    loading: false,
    loadedAll: false,
    abort: null,
    scrollBound: false,
    authTimer: null,
  };

  function channelName(){
    return String(window.CHANNEL?.name || window.CHANNEL?.canonical_name || "default").trim().toLowerCase() || "default";
  }

  function themeConfig(){
    try { return window.BTFW_THEME_ADMIN || window.BTFW?.channelTheme || {}; }
    catch (_) { return {}; }
  }

  function catalogueConfig(){
    const cfg = themeConfig();
    return cfg.playlistCatalog && typeof cfg.playlistCatalog === "object" ? cfg.playlistCatalog : {};
  }

  function readKey(){
    try {
      const cfg = themeConfig();
      const fromTheme = cfg.integrations?.tmdb?.apiKey;
      const fromRuntime = window.BTFW_CONFIG?.tmdb?.apiKey || window.BTFW_CONFIG?.tmdbKey;
      return String(fromTheme || fromRuntime || "").trim();
    } catch (_) { return ""; }
  }

  function parseListUrl(value){
    try {
      const url = new URL(String(value || "").trim());
      if (!/(^|\.)themoviedb\.org$/i.test(url.hostname)) return null;
      const match = url.pathname.match(/^\/list\/(\d+)(?:[-/]|$)/i);
      if (!match) return null;
      return { id: match[1], url: url.href };
    } catch (_) { return null; }
  }

  function activeList(){
    const cfg = catalogueConfig();
    if (!cfg.enabled) return null;
    return parseListUrl(cfg.tmdbListUrl);
  }

  function tokenKey(){ return `btfw:tmdb:list-sync:${channelName()}`; }
  function getWriteSession(){
    try {
      const value = JSON.parse(localStorage.getItem(tokenKey()) || "{}");
      return String(value?.sessionId || "").trim();
    } catch (_) { return ""; }
  }
  function setWriteSession(sessionId){ try { localStorage.setItem(tokenKey(), JSON.stringify({ version:3, sessionId:String(sessionId || "").trim() })); return true; } catch (_) { return false; } }
  function clearWriteToken(){ try { localStorage.removeItem(tokenKey()); } catch (_) {} }
  function notifyAuthState(detail){ try { document.dispatchEvent(new CustomEvent("btfw:playlistCatalogAuth", { detail })); } catch (_) {} }

  function canSync(){
    const rank = Number(window.CLIENT?.rank);
    return Number.isFinite(rank) && rank >= 3;
  }

  function enabled(){ return Boolean(activeList() && readKey()); }

  function navList(){
    return document.querySelector(".navbar .nav.navbar-nav") || document.querySelector(".navbar-nav") ||
      document.querySelector(".navbar .navbar-end ul") || document.querySelector(".btfw-navbar ul") || document.querySelector(".navbar ul");
  }

  function ensureLauncher(){
    const list = navList();
    if (!list) return false;
    let item = document.getElementById("btfw-movie-catalogue-nav");
    if (!enabled()) {
      item?.remove();
      return false;
    }
    if (!item) {
      item = document.createElement("li");
      item.id = "btfw-movie-catalogue-nav";
      item.innerHTML = '<a href="#" class="btfw-nav-pill" aria-label="Open movie catalogue"><span class="btfw-nav-pill__icon" aria-hidden="true"><i class="fa fa-film"></i></span><span class="btfw-nav-pill__label">Movies</span></a>';
      list.appendChild(item);
      item.querySelector("a").addEventListener("click", event => { event.preventDefault(); openModal(); });
    }
    return true;
  }

  function injectStyles(){
    if (document.getElementById("btfw-playlist-catalogue-style")) return;
    const style = document.createElement("style");
    style.id = "btfw-playlist-catalogue-style";
    style.textContent = `
      #btfw-playlist-catalogue { position:fixed; inset:0; z-index:12000; display:none; padding:clamp(12px,3vw,36px); background:rgba(4,6,12,.78); backdrop-filter:blur(8px); }
      #btfw-playlist-catalogue.is-open { display:flex; align-items:center; justify-content:center; }
      #btfw-playlist-catalogue .btfw-catalogue__dialog { width:min(1180px,100%); max-height:min(860px,94vh); overflow:hidden; display:flex; flex-direction:column; border:1px solid color-mix(in srgb,var(--btfw-theme-accent,#6d4df6) 35%,#fff 8%); border-radius:18px; background:var(--btfw-theme-surface,#11151e); color:var(--btfw-theme-text,#eef2ff); box-shadow:0 22px 70px rgba(0,0,0,.55); }
      #btfw-playlist-catalogue .btfw-catalogue__head { display:flex; align-items:center; gap:12px; padding:18px 20px 14px; border-bottom:1px solid rgba(255,255,255,.09); }
      #btfw-playlist-catalogue h2 { margin:0; font-size:1.2rem; flex:1; }
      #btfw-playlist-catalogue button { border:0; border-radius:9px; cursor:pointer; color:inherit; background:rgba(255,255,255,.09); padding:8px 11px; }
      #btfw-playlist-catalogue button:hover { background:rgba(255,255,255,.16); }
      #btfw-playlist-catalogue .btfw-catalogue__filters { display:grid; grid-template-columns:minmax(160px,1fr) 145px 160px; gap:9px; padding:13px 20px; border-bottom:1px solid rgba(255,255,255,.08); }
      #btfw-playlist-catalogue input, #btfw-playlist-catalogue select { min-width:0; border:1px solid rgba(255,255,255,.15); border-radius:9px; padding:9px 10px; color:inherit; background:rgba(0,0,0,.22); }
      #btfw-playlist-catalogue .btfw-catalogue__status { min-height:20px; padding:0 20px 10px; color:rgba(238,242,255,.7); font-size:.85rem; }
      #btfw-playlist-catalogue .btfw-catalogue__body { overflow:auto; padding:0 20px 20px; }
      #btfw-playlist-catalogue .btfw-catalogue__grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:14px; }
      #btfw-playlist-catalogue .btfw-catalogue__card { min-width:0; overflow:hidden; border:1px solid rgba(255,255,255,.1); border-radius:12px; background:rgba(255,255,255,.045); }
      #btfw-playlist-catalogue .btfw-catalogue__poster { display:block; width:100%; aspect-ratio:2/3; object-fit:cover; background:linear-gradient(135deg,#22283a,#111521); }
      #btfw-playlist-catalogue .btfw-catalogue__copy { padding:10px; }
      #btfw-playlist-catalogue .btfw-catalogue__title { color:inherit; font-weight:700; text-decoration:none; line-height:1.25; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #btfw-playlist-catalogue .btfw-catalogue__meta { margin-top:5px; color:rgba(238,242,255,.67); font-size:.8rem; }
      #btfw-playlist-catalogue .btfw-catalogue__overview { margin:7px 0 0; color:rgba(238,242,255,.78); font-size:.78rem; line-height:1.36; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
      #btfw-playlist-catalogue .btfw-catalogue__empty { padding:34px 0; text-align:center; color:rgba(238,242,255,.68); }
      #btfw-playlist-catalogue .btfw-catalogue__foot { padding:10px 20px 14px; color:rgba(238,242,255,.48); font-size:.72rem; border-top:1px solid rgba(255,255,255,.08); }
      @media(max-width:640px){ #btfw-playlist-catalogue .btfw-catalogue__filters { grid-template-columns:1fr; } #btfw-playlist-catalogue { padding:0; } #btfw-playlist-catalogue .btfw-catalogue__dialog { max-height:100vh; min-height:100vh; border-radius:0; } }
    `;
    document.head.appendChild(style);
  }

  function ensureModal(){
    if (state.modal?.isConnected) return state.modal;
    injectStyles();
    const modal = document.createElement("div");
    modal.id = "btfw-playlist-catalogue";
    modal.innerHTML = `
      <section class="btfw-catalogue__dialog" role="dialog" aria-modal="true" aria-labelledby="btfw-catalogue-title">
        <header class="btfw-catalogue__head"><h2 id="btfw-catalogue-title">Movie Catalogue</h2><button type="button" data-action="close" aria-label="Close catalogue">×</button></header>
        <div class="btfw-catalogue__filters"><input type="search" data-role="query" placeholder="Search movies…"><select data-role="type"><option value="">All media</option><option value="movie">Movies</option><option value="tv">TV shows</option></select><select data-role="sort"><option value="order">Playlist order</option><option value="title">Title</option><option value="date">Release date</option><option value="rating">TMDB rating</option></select></div>
        <div class="btfw-catalogue__status" data-role="status"></div><main class="btfw-catalogue__body"><div class="btfw-catalogue__grid" data-role="list"></div></main>
        <footer class="btfw-catalogue__foot">This product uses the TMDB API but is not endorsed or certified by TMDB.</footer>
      </section>`;
    document.body.appendChild(modal);
    state.modal = modal;
    state.listEl = $("[data-role=list]", modal);
    state.statusEl = $("[data-role=status]", modal);
    state.queryEl = $("[data-role=query]", modal);
    state.typeEl = $("[data-role=type]", modal);
    state.sortEl = $("[data-role=sort]", modal);
    modal.addEventListener("click", event => { if (event.target === modal || event.target.closest("[data-action=close]")) closeModal(); });
    modal.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
    [state.queryEl, state.typeEl, state.sortEl].forEach(el => el.addEventListener("input", () => { render(); if (state.queryEl.value.trim()) loadAllPages(); }));
    $(".btfw-catalogue__body", modal).addEventListener("scroll", event => {
      const el = event.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 220) loadNextPage();
    });
    return modal;
  }

  function showStatus(message){ if (state.statusEl) state.statusEl.textContent = message || ""; }

  function itemTitle(item){ return item.title || item.name || item.original_title || item.original_name || "Untitled"; }
  function itemDate(item){ return item.release_date || item.first_air_date || ""; }
  function itemType(item){ return item.media_type || (item.title ? "movie" : "tv"); }

  function filteredItems(){
    const query = String(state.queryEl?.value || "").trim().toLowerCase();
    const type = state.typeEl?.value || "";
    const sort = state.sortEl?.value || "order";
    const rows = state.items.map((item, index) => ({ item, index })).filter(({ item }) => {
      if (type && itemType(item) !== type) return false;
      if (!query) return true;
      return [itemTitle(item), item.original_title, item.original_name, item.overview].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
    rows.sort((a, b) => {
      if (sort === "title") return itemTitle(a.item).localeCompare(itemTitle(b.item));
      if (sort === "date") return String(itemDate(b.item)).localeCompare(String(itemDate(a.item)));
      if (sort === "rating") return Number(b.item.vote_average || 0) - Number(a.item.vote_average || 0);
      return a.index - b.index;
    });
    return rows.map(row => row.item);
  }

  function render(){
    if (!state.listEl) return;
    const items = filteredItems();
    if (!items.length) {
      state.listEl.innerHTML = `<div class="btfw-catalogue__empty">${state.loading ? "Loading catalogue…" : "No matching titles found."}</div>`;
      return;
    }
    state.listEl.innerHTML = items.map(item => {
      const poster = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : "";
      const title = escapeHtml(itemTitle(item));
      const type = itemType(item) === "tv" ? "TV" : "Movie";
      const year = itemDate(item).slice(0, 4);
      const rating = Number(item.vote_average || 0);
      const id = encodeURIComponent(item.id || "");
      const url = `https://www.themoviedb.org/${itemType(item) === "tv" ? "tv" : "movie"}/${id}`;
      return `<article class="btfw-catalogue__card"><img class="btfw-catalogue__poster" ${poster ? `data-src="${escapeAttr(poster)}"` : ""} alt="" loading="lazy"><div class="btfw-catalogue__copy"><a class="btfw-catalogue__title" href="${url}" target="_blank" rel="noopener">${title}</a><div class="btfw-catalogue__meta">${type}${year ? ` · ${escapeHtml(year)}` : ""}${rating ? ` · ★ ${rating.toFixed(1)}` : ""}</div>${item.overview ? `<p class="btfw-catalogue__overview">${escapeHtml(item.overview)}</p>` : ""}</div></article>`;
    }).join("");
    state.listEl.querySelectorAll("img[data-src]").forEach(img => { img.src = img.dataset.src; });
    const suffix = state.loadedAll ? "" : ` · ${state.items.length} loaded`;
    showStatus(`${items.length} title${items.length === 1 ? "" : "s"}${suffix}`);
  }

  function escapeHtml(value){ const d = document.createElement("div"); d.textContent = String(value || ""); return d.innerHTML; }
  function escapeAttr(value){ return escapeHtml(value).replace(/"/g, "&quot;"); }

  async function readListPage(page, signal){
    const list = activeList();
    const key = readKey();
    if (!list || !key) throw new Error("Movie catalogue is not configured.");
    const url = new URL(`${TMDB_API}/3/list/${list.id}`);
    url.searchParams.set("api_key", key);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", String(page));
    const response = await fetch(url.href, { signal, credentials: "omit" });
    if (!response.ok) throw new Error(response.status === 401 ? "TMDB API key cannot read this list." : `TMDB returned HTTP ${response.status}.`);
    return response.json();
  }

  async function loadNextPage(){
    if (state.loading || state.loadedAll || !activeList()) return;
    state.loading = true;
    render();
    try {
      const next = state.page + 1;
      const payload = await readListPage(next, state.abort?.signal);
      const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.results) ? payload.results : [];
      state.items.push(...items);
      state.page = Number(payload.page || next);
      state.totalPages = Math.max(1, Number(payload.total_pages || 1));
      state.loadedAll = state.page >= state.totalPages || !items.length;
    } catch (error) {
      showStatus(error?.message || "Unable to load catalogue.");
      state.loadedAll = true;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function loadAllPages(){
    if (state.loading || state.loadedAll || !state.modal?.classList.contains("is-open")) return;
    while (!state.loading && !state.loadedAll && state.modal?.classList.contains("is-open")) {
      await loadNextPage();
    }
  }

  async function openModal(){
    const modal = ensureModal();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    if (!enabled()) { showStatus("The movie catalogue has not been configured for this channel."); return; }
    if (!state.items.length) {
      state.abort?.abort();
      state.abort = new AbortController();
      state.page = 0; state.totalPages = 1; state.loadedAll = false; state.items = [];
      await loadNextPage();
    } else render();
    setTimeout(() => state.queryEl?.focus(), 0);
  }

  function closeModal(){
    state.modal?.classList.remove("is-open");
    state.modal?.setAttribute("aria-hidden", "true");
  }

  function cleanTitle(title){
    return String(title || "")
      .replace(/[._]+/g, " ")
      .replace(/[\[\(].*?[\]\)]/g, " ")
      .replace(/\b(19|20)\d{2}\b/g, " ")
      .replace(/\b(1080p|720p|2160p|4k|bluray|web[- ]?dl|webrip|hdtv|x264|x265|hevc|dvdrip|proper|extended|remastered)\b/gi, " ")
      .replace(/\s+/g, " ").trim();
  }

  function normalizeTitle(title){ return cleanTitle(title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
  function extractYear(title){ const match = String(title || "").match(/\b((?:19|20)\d{2})\b/); return match ? Number(match[1]) : 0; }
  function editDistance(a, b){
    const rows = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let previous = rows[0]; rows[0] = i;
      for (let j = 1; j <= b.length; j++) { const next = rows[j]; rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = next; }
    }
    return rows[b.length];
  }
  function similarity(a, b){ if (!a || !b) return 0; return 1 - editDistance(a, b) / Math.max(a.length, b.length); }

  async function tmdbRead(path, params = {}, attempt = 0){
    const key = readKey();
    if (!key) throw new Error("Add a TMDB API key in Theme Toolkit → Integrations.");
    const url = new URL(`${TMDB_API}/3/${path}`);
    url.searchParams.set("api_key", key);
    Object.entries(params).forEach(([name, value]) => { if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value)); });
    const response = await fetch(url.href, { credentials: "omit" });
    if (response.status === 429 && attempt < 3) {
      const retry = Number(response.headers.get("Retry-After") || 1);
      await new Promise(resolve => setTimeout(resolve, Math.max(1, retry) * 1000));
      return tmdbRead(path, params, attempt + 1);
    }
    if (!response.ok) throw new Error(`TMDB returned HTTP ${response.status}.`);
    return response.json();
  }

  async function tmdbSessionRequest(path, method, body, params = {}){
    const key = readKey();
    if (!key) throw new Error("Add a TMDB API key in Theme Toolkit → Integrations first.");
    const url = new URL(`${TMDB_API}/3/${path}`);
    url.searchParams.set("api_key", key);
    Object.entries(params).forEach(([name, value]) => { if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value)); });
    const response = await fetch(url.href, { method, headers:{ "Content-Type":"application/json", Accept:"application/json" }, body: body ? JSON.stringify(body) : undefined, credentials:"omit" });
    if (!response.ok) throw await tmdbFailure(response, "TMDB authorization failed");
    return response.json();
  }

  async function tmdbFailure(response, fallback){
    const payload = await response.json().catch(() => ({}));
    const detail = String(payload?.status_message || payload?.status || "").trim();
    const code = payload?.status_code ? ` (TMDB ${payload.status_code})` : "";
    return new Error(`${detail || fallback}${code} — HTTP ${response.status}.`);
  }

  async function validateWriteSession(){
    const sessionId = getWriteSession();
    if (!sessionId) return false;
    try {
      await tmdbSessionRequest("account", "GET", null, { session_id:sessionId });
      return true;
    } catch (error) {
      if (/HTTP (401|403)\./.test(String(error?.message || ""))) {
        clearWriteToken();
        notifyAuthState({ connected:false, reason:"TMDB no longer accepts the saved browser session." });
      }
      throw error;
    }
  }

  async function completeTmdbSignIn(requestToken){
    const data = await tmdbSessionRequest("authentication/session/new", "POST", { request_token:requestToken });
    const sessionId = String(data?.session_id || "").trim();
    if (!sessionId) throw new Error("TMDB did not return a local session.");
    if (!setWriteSession(sessionId)) throw new Error("This browser could not save the local TMDB session.");
    try { await validateWriteSession(); }
    catch (error) {
      const verificationError = new Error(`TMDB could not verify the new session. ${error?.message || "Sign in again."}`);
      verificationError.btfwAuthTerminal = true;
      throw verificationError;
    }
    notifyAuthState({ connected:true });
    return sessionId;
  }

  async function beginTmdbSignIn(){
    const key = readKey();
    if (!key) throw new Error("Add a TMDB API key in Theme Toolkit → Integrations first.");
    const token = await tmdbSessionRequest("authentication/token/new", "GET");
    const requestToken = String(token?.request_token || "").trim();
    if (!requestToken) throw new Error("TMDB did not return an authorization request.");
    const redirect = `${location.origin}${location.pathname}${location.search}`;
    const popup = window.open(`https://www.themoviedb.org/authenticate/${encodeURIComponent(requestToken)}?redirect_to=${encodeURIComponent(redirect)}`, "btfw-tmdb-auth", "popup,width=620,height=760");
    if (!popup) throw new Error("Your browser blocked the TMDB sign-in window. Allow popups and try again.");
    if (state.authTimer) clearInterval(state.authTimer);
    const started = Date.now();
    state.authTimer = setInterval(async () => {
      if (Date.now() - started > 10 * 60 * 1000) {
        clearInterval(state.authTimer); state.authTimer = null;
        notifyAuthState({ connected:false, reason:"TMDB sign-in timed out. Please try again." });
        return;
      }
      if (popup.closed) {
        clearInterval(state.authTimer); state.authTimer = null;
        notifyAuthState({ connected:false, reason:"TMDB sign-in was closed before approval." });
        return;
      }
      try {
        await completeTmdbSignIn(requestToken);
        clearInterval(state.authTimer); state.authTimer = null;
        try { popup.close(); } catch (_) {}
      } catch (error) {
        if (error?.btfwAuthTerminal) {
          clearInterval(state.authTimer); state.authTimer = null;
          notifyAuthState({ connected:false, reason:error.message });
          return;
        }
        // The request is not approved yet; keep polling while the user signs in.
      }
    }, 2200);
    return true;
  }

  function candidateName(candidate){ return candidate.title || candidate.name || candidate.original_title || candidate.original_name || ""; }
  function candidateYear(candidate){ const value = candidate.release_date || candidate.first_air_date || ""; return /^\d{4}/.test(value) ? Number(value.slice(0, 4)) : 0; }

  async function resolveMedia(media){
    const raw = String(media?.title || "").trim();
    const cleaned = cleanTitle(raw);
    const rawNorm = normalizeTitle(raw);
    const cleanNorm = normalizeTitle(cleaned);
    const year = extractYear(raw);
    if (!cleanNorm) return { ok:false, reason:"missing title" };
    const searches = [];
    for (const query of [...new Set([raw, cleaned].filter(Boolean))]) {
      for (const type of ["movie"]) {
        try { searches.push({ type, payload: await tmdbRead(`search/${type}`, { query, year: year || undefined, include_adult: "false" }) }); }
        catch (_) {}
      }
    }
    const candidates = [];
    searches.forEach(({ type, payload }) => (payload?.results || []).forEach(item => {
      const nameNorm = normalizeTitle(candidateName(item));
      const originalNorm = normalizeTitle(item.original_title || item.original_name || "");
      const exact = nameNorm === rawNorm || nameNorm === cleanNorm || originalNorm === rawNorm || originalNorm === cleanNorm;
      const textScore = Math.max(similarity(cleanNorm, nameNorm), similarity(cleanNorm, originalNorm));
      const candidateReleaseYear = candidateYear(item);
      const yearScore = year && candidateReleaseYear ? (Math.abs(year - candidateReleaseYear) <= 1 ? .2 : -.3) : 0;
      const score = (exact ? .78 : textScore * .72) + yearScore;
      candidates.push({ item, type, exact, score, textScore, candidateReleaseYear });
    }));
    const byTmdbId = new Map();
    candidates.forEach(candidate => {
      const key = `${candidate.type}:${candidate.item.id}`;
      if (!byTmdbId.has(key) || byTmdbId.get(key).score < candidate.score) byTmdbId.set(key, candidate);
    });
    const ranked = [...byTmdbId.values()].sort((a, b) => b.score - a.score);
    const best = ranked[0]; const second = ranked[1];
    if (!best) return { ok:false, reason:"not found" };
    const uniqueLead = !second || best.score - second.score >= .12;
    const accepted = (best.exact && best.score >= .65 && uniqueLead) || (!best.exact && best.textScore >= .92 && best.score >= .8 && uniqueLead);
    if (!accepted) return { ok:false, reason: best.exact ? "ambiguous match" : "no high-confidence match" };
    return { ok:true, media_type:best.type, media_id:best.item.id, title:candidateName(best.item), score:best.score };
  }

  function waitForPlaylist(timeout = 9000){
    const socket = window.socket;
    if (!socket?.on || !socket?.emit) return Promise.reject(new Error("CyTube playlist socket is unavailable."));
    return new Promise((resolve, reject) => {
      let timer = null;
      const done = (error, items) => {
        clearTimeout(timer);
        try { socket.off?.("playlist", handler); } catch (_) {}
        error ? reject(error) : resolve(items);
      };
      const handler = items => { if (Array.isArray(items)) done(null, items); };
      socket.on("playlist", handler);
      timer = setTimeout(() => done(new Error("Playlist access was not confirmed. Only channel admins/owners can sync.")), timeout);
      try { socket.emit("requestPlaylist"); } catch (error) { done(error); }
    });
  }

  async function tmdbWrite(path, method, body){
    const sessionId = getWriteSession();
    const key = readKey();
    if (!sessionId) throw new Error("Connect your TMDB account before syncing.");
    if (!key) throw new Error("Add a TMDB API key in Theme Toolkit → Integrations first.");
    const url = new URL(`${TMDB_API}/3/${path}`);
    url.searchParams.set("api_key", key);
    url.searchParams.set("session_id", sessionId);
    const response = await fetch(url.href, { method, headers:{ "Content-Type":"application/json", Accept:"application/json" }, body: body ? JSON.stringify(body) : undefined, credentials:"omit" });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearWriteToken();
        const error = await tmdbFailure(response, "TMDB rejected the local session");
        notifyAuthState({ connected:false, reason:"TMDB rejected the saved browser session. Sign in again." });
        throw new Error(`TMDB rejected the local session. Sign in again. ${error.message}`);
      }
      if (response.status === 429) { const retry = Number(response.headers.get("Retry-After") || 1); await new Promise(resolve => setTimeout(resolve, Math.max(1, retry) * 1000)); return tmdbWrite(path, method, body); }
      throw await tmdbFailure(response, "TMDB list update failed");
    }
    return response.json().catch(() => ({}));
  }

  function batches(items, size = 20){ const out = []; for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size)); return out; }

  async function mapWithConcurrency(items, limit, mapper){
    const results = new Array(items.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await mapper(items[index], index);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }

  async function createList(){
    if (!await validateWriteSession()) throw new Error("TMDB could not verify the local session. Sign in again before creating a list.");
    const name = `BillTube — ${window.CHANNEL?.name || "Channel"}`;
    const payload = await tmdbWrite("list", "POST", { name, description:"Managed by BillTube Theme Toolkit playlist sync.", language:"en" });
    const id = payload.id || payload.list_id;
    if (!id) throw new Error("TMDB did not return a new list ID.");
    return `https://www.themoviedb.org/list/${id}`;
  }

  async function fetchEditableItems(id){
    const items = []; let page = 1; let total = 1;
    while (page <= total) {
      const payload = await tmdbRead(`list/${id}`, { page });
      items.push(...(payload.results || payload.items || []));
      total = Math.max(1, Number(payload.total_pages || 1)); page += 1;
    }
    return items;
  }

  async function sync(options = {}){
    if (!canSync()) throw new Error("Playlist sync is locked: Channel JS edit permission is required.");
    if (!await validateWriteSession()) throw new Error("TMDB could not verify the local session. Sign in again before syncing.");
    let list = parseListUrl(options.listUrl || catalogueConfig().tmdbListUrl);
    if (!list) {
      if (options.createIfMissing === false) throw new Error("Choose a public TMDB list URL or create a new list first.");
      list = parseListUrl(await createList());
    }
    const playlist = await waitForPlaylist();
    const report = { listUrl:list.url, total:playlist.length, added:0, removed:0, duplicateSources:[], duplicateTmdb:[], skipped:[], matched:0 };
    const sourceSeen = new Set();
    const sourceItems = [];
    playlist.forEach((entry, index) => {
      const media = entry?.media;
      const sourceKey = media?.id != null ? `${media?.type || "unknown"}:${media.id}` : `entry:${index}`;
      if (sourceSeen.has(sourceKey)) { report.duplicateSources.push(media?.title || sourceKey); return; }
      sourceSeen.add(sourceKey); sourceItems.push({ media, index });
    });
    const resolved = await mapWithConcurrency(sourceItems, 3, async ({ media, index }) => ({ index, media, result: await resolveMedia(media) }));
    const targetSeen = new Set(); const desired = [];
    resolved.sort((a,b) => a.index - b.index).forEach(({ media, result }) => {
      if (!result.ok) { report.skipped.push({ title:media?.title || "Untitled", reason:result.reason }); return; }
      const key = `${result.media_type}:${result.media_id}`;
      if (targetSeen.has(key)) { report.duplicateTmdb.push(result.title); return; }
      targetSeen.add(key); desired.push({ media_type:result.media_type, media_id:result.media_id }); report.matched += 1;
    });
    const existing = await fetchEditableItems(list.id);
    const existingMap = new Map(existing.map(item => [`${item.media_type || (item.title ? "movie" : "tv")}:${item.id}`, { media_type:item.media_type || (item.title ? "movie" : "tv"), media_id:item.id }]));
    const desiredMap = new Map(desired.map(item => [`${item.media_type}:${item.media_id}`, item]));
    const remove = [...existingMap.entries()].filter(([key]) => !desiredMap.has(key)).map(([, item]) => item);
    const add = [...desiredMap.entries()].filter(([key]) => !existingMap.has(key)).map(([, item]) => item);
    for (const group of batches(remove, 1)) { await tmdbWrite(`list/${list.id}/remove_item`, "POST", { media_id:group[0].media_id }); report.removed += group.length; }
    for (const group of batches(add, 1)) { await tmdbWrite(`list/${list.id}/add_item`, "POST", { media_id:group[0].media_id }); report.added += group.length; }
    return report;
  }

  window.BTFW_PlaylistCatalog = { activeList, canSync, getWriteSession, validateWriteSession, beginTmdbSignIn, clearWriteToken, createList, sync, open:openModal };
  document.addEventListener("btfw:playlistCatalogChanged", () => { ensureLauncher(); if (!enabled()) closeModal(); });
  document.addEventListener("btfw:channelIntegrationsChanged", ensureLauncher);
  ensureLauncher();
  const navObserver = new MutationObserver(() => ensureLauncher());
  navObserver.observe(document.documentElement, { childList:true, subtree:true });
  return { name:"feature:playlistCatalog", open:openModal, sync };
});
