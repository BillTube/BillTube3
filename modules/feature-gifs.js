
BTFW.define("feature:gifs", ["util:chat-popover"], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const PER_PAGE = 12;
  const motion = await BTFW.init("util:motion");
  const chatPopover = await BTFW.init("util:chat-popover");

  /* ---- Keys (BillTube2 defaults; can override via localStorage) ---- */
  const K = { giphy: "btfw:giphy:key", tenor: "btfw:tenor:key" };
  const DEFAULT_GIPHY = "bb2006d9d3454578be1a99cfad65913d";
  const DEFAULT_TENOR = "5WPAZ4EXST2V"; // Tenor v1 used by BillTube2

  function getKey(which) {
    try { return (localStorage.getItem(K[which]) || "").trim(); } catch (_) { return ""; }
  }
  function effKey(which, fallback) {
    const v = getKey(which);
    return v || fallback;
  }

  /* ---- State ---- */
  const state = {
    provider: "giphy",  // "giphy" | "tenor" | "favorites"
    query: "",
    page: 1,
    total: 0,
    items: [],          // { id, provider, thumb, urlClassic }
    loading: false
  };

  // Track rendered state for optimized rendering
  let renderedItems = []; // Track what's currently rendered
  let gridClickHandlerAttached = false; // Ensure we only attach the delegated handler once

  const FAVORITES_KEY = "btfw:gifs:favorites";
  let favorites = loadFavorites();
  let favoriteLookup = buildFavoriteLookup(favorites);

  /* ---- Utils ---- */
  function insertAtCursor(input, text) {
    input.focus();
    const s = input.selectionStart ?? input.value.length;
    const e = input.selectionEnd   ?? input.value.length;
    const before = input.value.slice(0, s);
    const after  = input.value.slice(e);
    input.value = before + text + after;
    const pos = before.length + text.length;
    input.selectionStart = input.selectionEnd = pos;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function stripQuery(u){ return (u||"").split("?")[0].split("#")[0]; }
  function buildGiphyClassic(id){ return `https://media1.giphy.com/media/${id}/giphy.gif`; } // NOTE: media1 (digit) for your regex
  function normTenor(u){ return stripQuery(u); }

  function ensureOpeners() {
    ["#btfw-btn-gif", ".btfw-btn-gif", "#giphybtn", "#gifbtn"].forEach(sel=>{
      $$(sel).forEach(el=>{
        el.removeAttribute("onclick");
        const c = el.cloneNode(true);
        el.parentNode.replaceChild(c, el);
        c.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); toggle(); }, { capture:true });
      });
    });
    if (!$("#btfw-btn-gif")) {
      const bar = document.getElementById("btfw-chat-bottombar")
             || document.querySelector("#chatcontrols .input-group-btn")
             || document.getElementById("chatcontrols")
             || document.getElementById("chatwrap");
      if (bar) {
        const btn = document.createElement("button");
        btn.id = "btfw-btn-gif";
        btn.type = "button";
        btn.className = "button is-dark is-small btfw-chatbtn btfw-btn-gif";
        btn.innerHTML = (document.querySelector(".fa")) ? '<i class="fa fa-file-video-o"></i>' : 'GIF';
        btn.title = "GIFs";
        bar.appendChild(btn);
        btn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); toggle(); }, { capture:true });
      }
    }
  }

  /* ---- Popover (in-chat, built on the shared util:chat-popover) ---- */
  // `modal` holds the CARD element so all the existing $(sel, modal) lookups
  // (grid, search box, pager…) keep working unchanged.
  let modal = null;
  let modalOpen = false;
  let gifPop = null;
  let modalWired = false;

  function gifCardHTML(){
    return `
      <div class="btfw-gif-pop">
        <header class="btfw-gif-head">
          <span class="btfw-gif-title">GIFs</span>
          <button class="btfw-gif-close" data-btfw-popover-close aria-label="Close">&times;</button>
        </header>
        <div class="btfw-gif-body">
          <div class="btfw-gif-toolbar">
            <div class="tabs is-boxed is-small btfw-gif-tabs">
              <ul>
                <li class="is-active" data-p="giphy"><a>Giphy</a></li>
                <li data-p="tenor"><a>Tenor</a></li>
                <li data-p="favorites"><a>Favorites</a></li>
              </ul>
            </div>
            <div class="btfw-gif-search">
              <input id="btfw-gif-q" type="text" placeholder="Search GIFs…" autocomplete="off">
              <button id="btfw-gif-go" class="btfw-gif-sbtn" type="button" title="Search" aria-label="Search"><i class="fa fa-search" aria-hidden="true"></i></button>
              <button id="btfw-gif-trending" class="btfw-gif-sbtn" type="button" title="Trending"><i class="fa fa-fire" aria-hidden="true"></i><span>Trending</span></button>
            </div>
          </div>

          <div id="btfw-gif-notice" class="btfw-gif-notice is-hidden"></div>
          <div id="btfw-gif-grid" class="btfw-gif-grid"></div>

          <nav class="btfw-gif-pager" role="navigation" aria-label="pagination">
            <button id="btfw-gif-prev" class="btfw-gif-pagebtn" type="button" aria-label="Previous page"><i class="fa fa-chevron-left" aria-hidden="true"></i></button>
            <span id="btfw-gif-pages" class="btfw-gif-pages">1 / 1</span>
            <button id="btfw-gif-next" class="btfw-gif-pagebtn" type="button" aria-label="Next page"><i class="fa fa-chevron-right" aria-hidden="true"></i></button>
          </nav>
        </div>
      </div>`;
  }

  function getPopover(){
    if (gifPop) return gifPop;
    gifPop = chatPopover.create({
      id: "btfw-gif-modal",
      cardClass: "btfw-gif-pop",
      parent: () => document.getElementById("chatwrap") || document.body,
      once: true,
      opts: { widthPx: 560, widthVw: 94, maxHpx: 520, maxHvh: 78 },
      toggleSelector: "#btfw-btn-gif, .btfw-btn-gif, #giphybtn, #gifbtn",
      build: gifCardHTML,
      onOpen: () => {
        modalOpen = true;
        showNotice("");
        state.page = 1;
        state.provider = modal?.querySelector(".btfw-gif-tabs li.is-active")?.getAttribute("data-p") || "giphy";
        if (state.provider !== "favorites") renderSkeleton();
        setTimeout(search, 0);
        lockGifHeight();
        const input = $("#btfw-gif-q", modal);
        if (input && state.provider !== "favorites") {
          setTimeout(() => { try { input.focus(); input.select(); } catch(_){} }, 40);
        }
      },
      onClose: () => { modalOpen = false; }
    });
    return gifPop;
  }

  function ensureModal(){
    getPopover().ensure();
    modal = getPopover().getCard();
    if (modal && !modalWired) wireModal(modal);
    return modal;
  }

  // Keep the card height constant across tabs: the util computes a max-height
  // (accounting for the viewport & chat-bar position) each time it positions
  // the popover; we pin the card's height to that so a sparse Favorites tab
  // doesn't collapse the panel. A MutationObserver re-pins whenever the util
  // re-positions (chat resize, splitter drag…). The equality guard avoids a loop.
  let _heightMO = null;
  function lockGifHeight(){
    const card = modal;
    if (!card) return;
    const apply = () => {
      const mh = card.style.maxHeight;
      if (mh && card.style.height !== mh) card.style.height = mh;
    };
    apply();
    if (!_heightMO) {
      _heightMO = new MutationObserver(apply);
      _heightMO.observe(card, { attributes: true, attributeFilter: ["style"] });
    }
  }

  function wireModal(card){
    modalWired = true;

    card.querySelector(".btfw-gif-tabs ul").addEventListener("click", e=>{
      const li = e.target.closest("li[data-p]"); if (!li) return;
      card.querySelectorAll(".btfw-gif-tabs li").forEach(x=>x.classList.toggle("is-active", x===li));
      state.provider = li.getAttribute("data-p");
      state.page = 1;
      handleProviderChange();
    });

    $("#btfw-gif-go", card).addEventListener("click", ()=> { state.page = 1; search(); });
    $("#btfw-gif-q",  card).addEventListener("keydown", e=> { if (e.key === "Enter") { state.page = 1; search(); }});
    $("#btfw-gif-trending", card).addEventListener("click", ()=>{
      const q = $("#btfw-gif-q", card); if (q) q.value = "";
      state.page = 1; search();
    });

    $("#btfw-gif-prev", card).addEventListener("click", ()=>{
      if (state.page > 1) { state.page--; debouncedRender(); }
    });
    $("#btfw-gif-next", card).addEventListener("click", ()=>{
      const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
      if (state.page < totalPages) { state.page++; debouncedRender(); }
    });
  }

  function showNotice(msg){
    const n = $("#btfw-gif-notice", modal);
    n.textContent = msg || "";
    n.classList.toggle("is-hidden", !msg);
  }

  /* ---- Fetching ---- */
  async function fetchGiphy(q){
    const key = effKey("giphy", DEFAULT_GIPHY);
    const endpoint = q ? "https://api.giphy.com/v1/gifs/search"
                       : "https://api.giphy.com/v1/gifs/trending";
    const url = new URL(endpoint);
    url.searchParams.set("api_key", key);
    if (q) url.searchParams.set("q", q);
    url.searchParams.set("limit", "50");
    url.searchParams.set("rating", "pg-13");

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`GIPHY_${res.status}`);

    const json = await res.json();
    const list = (json.data || []).map(g => {
      const id    = g.id || ""; // always present
      const thumb = (g.images && (g.images.fixed_width_small?.url
                               || g.images.fixed_width?.url
                               || g.images.downsized_still?.url)) || "";
      const urlClassic = id ? buildGiphyClassic(id) : ""; // <— classic format ONLY
      return { id, provider: "giphy", thumb, urlClassic };
    });
    return { items: list, total: list.length };
  }

  async function fetchTenor(q){
    const key = effKey("tenor", DEFAULT_TENOR);
    // Tenor v1 to match BillTube2
    const endpoint = q ? "https://api.tenor.com/v1/search"
                       : "https://api.tenor.com/v1/trending";
    const url = new URL(endpoint);
    url.searchParams.set("key", key);
    if (q) url.searchParams.set("q", q);
    url.searchParams.set("limit", "50");

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`TENOR_${res.status}`);

    const json = await res.json();
    const list = (json.results || []).map(t => {
      const gif  = t.media?.[0]?.gif?.url || t.media?.[0]?.mediumgif?.url || t.media?.[0]?.tinygif?.url || "";
      const tiny = t.media?.[0]?.nanogif?.url || t.media?.[0]?.tinygif?.url || gif;
      return { id: t.id, provider: "tenor", thumb: tiny, urlClassic: normTenor(gif) };
    });
    return { items: list, total: list.length };
  }

  async function search(){
    const q = ($("#btfw-gif-q", ensureModal()).value || "").trim();
    state.query = q;
    state.page = 1;

    if (state.provider === "favorites") {
      state.loading = false;
      applyFavoritesToState();
      render();
      return;
    }

    state.loading = true;
    renderSkeleton();

    try {
      const { items, total } = (state.provider === "giphy") ? await fetchGiphy(q) : await fetchTenor(q);
      state.items = items;
      state.total = total;
      state.loading = false;
      showNotice(total ? "" : "No results. Try a different search.");
      render();
    } catch (e) {
      state.items = [];
      state.total = 0;
      state.loading = false;
      showNotice("Failed to load GIFs (key limit or network). Try again, or set your own keys in localStorage.");
      render();
    }
  }

  /* ---- Rendering ---- */
  function renderSkeleton(){
    if (state.provider === "favorites") {
      return;
    }
    const grid = $("#btfw-gif-grid", ensureModal());

    // Clear rendered state
    renderedItems = [];

    // Only clear if we're not already showing skeletons
    const existingSkeletons = grid.querySelectorAll('.is-skeleton');
    if (existingSkeletons.length === PER_PAGE) {
      return; // Already showing correct number of skeletons
    }

    grid.innerHTML = "";
    const frag = document.createDocumentFragment();

    for (let i = 0; i < PER_PAGE; i++){
      const sk = document.createElement("div");
      sk.className = "btfw-gif-cell is-skeleton";
      const frame = document.createElement("div");
      frame.className = "btfw-gif-thumb";
      sk.appendChild(frame);
      frag.appendChild(sk);
    }

    grid.appendChild(frag);
    $("#btfw-gif-pages").textContent = "… / …";
  }

  function render(){
    const grid = $("#btfw-gif-grid", ensureModal());

    // Setup event delegation (only once)
    setupGridClickHandler(grid);

    updateToolbarForProvider();

    const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
    const clamped = Math.max(1, Math.min(totalPages, state.page));
    if (clamped !== state.page) state.page = clamped;

    const start = (state.page - 1) * PER_PAGE;
    const pageItems = state.items.slice(start, start + PER_PAGE);

    // OPTIMIZATION: Check if we can update in place
    const canUpdateInPlace = shouldUpdateInPlace(pageItems, grid);

    const showRemove = state.provider === "favorites";

    if (canUpdateInPlace) {
      // Fast path: update existing elements
      updateExistingCells(grid, pageItems, { showRemove });
    } else {
      // Full render needed
      fullRender(grid, pageItems, { showRemove });
    }

    // Update rendered state
    renderedItems = pageItems.map(item => ({
      id: item.id,
      provider: item.provider,
      thumb: item.thumb,
      urlClassic: item.urlClassic
    }));

    // Update pagination
    $("#btfw-gif-pages").textContent = `${state.page} / ${totalPages}`;
    $("#btfw-gif-prev").disabled = (state.page <= 1);
    $("#btfw-gif-next").disabled = (state.page >= totalPages);
  }

  // Event delegation - ONE handler for all GIF clicks
  function setupGridClickHandler(grid) {
    if (gridClickHandlerAttached) return;

    grid.addEventListener("click", (e) => {
      const toggle = e.target.closest(".btfw-gif-fav-toggle");
      if (toggle && handleFavoriteControl(toggle)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Find the clicked cell (bubbling from img or button)
      const cell = e.target.closest(".btfw-gif-cell");
      if (!cell || cell.classList.contains("is-skeleton")) return;

      // Get URL from data attribute
      const url = cell.dataset.url;
      if (!url) return;

      const input = document.getElementById("chatline");
      if (!input) return;

      insertAtCursor(input, " " + url + " ");
      close();
    });

    grid.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      const toggle = e.target.closest(".btfw-gif-fav-toggle");
      if (toggle && handleFavoriteControl(toggle)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    gridClickHandlerAttached = true;
  }

  // Check if we can update existing cells instead of full re-render
  function shouldUpdateInPlace(newItems, grid) {
    const existingCells = grid.querySelectorAll(".btfw-gif-cell:not(.is-skeleton)");

    // If counts don't match, need full render
    if (existingCells.length !== newItems.length) return false;

    // If we have no tracked state, need full render
    if (renderedItems.length === 0) return false;

    return true;
  }

  // Update existing cells efficiently
  function updateExistingCells(grid, newItems, opts = {}) {
    const { showRemove = false } = opts;
    const cells = grid.querySelectorAll(".btfw-gif-cell");

    newItems.forEach((item, index) => {
      const cell = cells[index];
      if (!cell) return;
      updateCell(cell, item, { showRemove });
    });
  }

  // Update a single cell's content
  function updateCell(cell, item, opts = {}) {
    const { showRemove = false } = opts;
    // Update data attribute
    cell.dataset.url = item.urlClassic || "";
    cell.dataset.id = item.id || "";
    cell.dataset.thumb = item.thumb || "";
    cell.dataset.provider = item.provider || state.provider || "";
    cell.dataset.favKey = makeFavoriteKey(item);

    // Update image
    const img = cell.querySelector("img");
    if (img && img.src !== item.thumb) {
      img.src = item.thumb;
      img.alt = "gif";
      prepareImageLoadingState(cell, img);
    } else if (img) {
      prepareImageLoadingState(cell, img);
    }

    // Remove skeleton class if present
    cell.classList.remove("is-skeleton");
    updateFavoriteVisualState(cell, showRemove);
  }

  // Full render when updating in place isn't possible
  function fullRender(grid, pageItems, opts = {}) {
    const { showRemove = false } = opts;
    // Use replaceChildren for efficient bulk replacement (better than innerHTML = "")
    const frag = document.createDocumentFragment();

    pageItems.forEach(item => {
      const cell = createGifCell(item, { showRemove });
      frag.appendChild(cell);
    });

    grid.replaceChildren(frag);
  }

  // Create a single GIF cell element
  function createGifCell(item, opts = {}) {
    const { showRemove = false } = opts;
    const cell = document.createElement("button");
    cell.className = "btfw-gif-cell";
    cell.type = "button";

    // Store data in attributes for event delegation
    cell.dataset.url = item.urlClassic || "";
    cell.dataset.id = item.id || "";
    cell.dataset.thumb = item.thumb || "";
    cell.dataset.provider = item.provider || state.provider || "";
    cell.dataset.favKey = makeFavoriteKey(item);

    const frame = document.createElement("div");
    frame.className = "btfw-gif-thumb";

    const img = document.createElement("img");
    img.src = item.thumb;
    img.alt = "gif";
    img.loading = "lazy";
    img.decoding = "async";
    prepareImageLoadingState(cell, img);

    frame.appendChild(img);
    cell.appendChild(frame);

    const toggle = document.createElement("span");
    toggle.className = "btfw-gif-fav-toggle" + (showRemove ? " is-remove" : "");
    toggle.dataset.action = showRemove ? "remove-favorite" : "toggle-favorite";
    toggle.setAttribute("role", "button");
    toggle.tabIndex = 0;
    cell.appendChild(toggle);

    updateFavoriteVisualState(cell, showRemove);

    return cell;
  }

  function updateFavoriteVisualState(cell, showRemove) {
    const favKey = cell.dataset.favKey;
    const isFav = favoriteLookup.has(favKey || "");
    cell.classList.toggle("is-favorited", isFav);
    const toggle = cell.querySelector(".btfw-gif-fav-toggle");
    if (!toggle) return;
    if (showRemove) {
      toggle.textContent = "×";
      toggle.title = "Remove from favorites";
      toggle.setAttribute("aria-label", "Remove from favorites");
      toggle.setAttribute("aria-pressed", "true");
      return;
    }
    toggle.textContent = isFav ? "★" : "☆";
    const label = isFav ? "Remove from favorites" : "Add to favorites";
    toggle.title = label;
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("aria-pressed", isFav ? "true" : "false");
  }

  function prepareImageLoadingState(cell, img) {
    const handleLoad = () => {
      cell.classList.remove("is-loading");
      cell.classList.remove("is-broken");
    };
    const handleError = () => {
      cell.classList.add("is-broken");
      cell.classList.remove("is-loading");
    };

    cell.classList.add("is-loading");
    img.onload = handleLoad;
    img.onerror = handleError;

    if (img.complete) {
      if (img.naturalWidth && img.naturalHeight) {
        handleLoad();
      } else {
        handleError();
      }
    }
  }

  // If you have rapid pagination clicks, you can debounce renders:
  let renderTimeout = null;

  function debouncedRender() {
    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }

    renderTimeout = setTimeout(() => {
      render();
      renderTimeout = null;
    }, 16); // ~60fps
  }

  // Open the GIF popover when the bridge asks
  document.addEventListener('btfw:openGifs', ()=> {
    try { open(); } catch(e){}
  });

  /* ---- open / close ---- */
  // All the initial render/search/focus work happens in the popover's onOpen
  // hook (see getPopover) so it runs once the card is positioned & visible.
  function open(){ ensureModal(); getPopover().open(); }
  function close(){ if (gifPop) gifPop.close(); }
  function toggle(){ ensureModal(); getPopover().isOpen() ? close() : open(); }

  function handleProviderChange() {
    updateToolbarForProvider();
    if (state.provider === "favorites") {
      applyFavoritesToState();
      render();
    } else {
      renderSkeleton();
      search();
    }
  }

  function updateToolbarForProvider() {
    const searchBar = $(".btfw-gif-search", modal || document);
    if (!searchBar) return;
    const shouldHide = state.provider === "favorites";
    searchBar.classList.toggle("is-hidden", shouldHide);
  }

  function makeFavoriteKey(item) {
    const provider = item.provider || state.provider || "";
    const idPart = item.id || "";
    const urlPart = item.urlClassic || "";
    const fallback = idPart || urlPart;
    return provider + "::" + (fallback || "");
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(item => item && typeof item === "object" && item.urlClassic)
          .map(item => ({
            provider: item.provider || "giphy",
            id: item.id || "",
            thumb: item.thumb || item.urlClassic,
            urlClassic: item.urlClassic
          }));
      }
    } catch (_) {}
    return [];
  }

  function saveFavorites() {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (_) {}
  }

  function buildFavoriteLookup(list) {
    const map = new Map();
    list.forEach(item => {
      const key = makeFavoriteKey(item);
      if (key) map.set(key, item);
    });
    return map;
  }

  function applyFavoritesToState() {
    state.loading = false;
    state.items = favorites.slice();
    state.total = favorites.length;
    showNotice(favorites.length ? "" : "Favorite GIFs will appear here once you star them.");
  }

  function cellToItem(cell) {
    if (!cell) return null;
    const provider = cell.dataset.provider || state.provider || "";
    const id = cell.dataset.id || "";
    const thumb = cell.dataset.thumb || "";
    const urlClassic = cell.dataset.url || "";
    const item = { provider, id, thumb, urlClassic };
    item.favKey = cell.dataset.favKey || makeFavoriteKey(item);
    return item;
  }

  // Low-level favorites mutation (no rendering). Shared by the modal's star
  // controls AND the in-chat right-click menu so both stay in sync against the
  // same in-memory list + localStorage.
  function addFavorite(item) {
    const key = item.favKey || makeFavoriteKey(item);
    if (!item.urlClassic || favoriteLookup.has(key)) return false;
    const rec = {
      provider: item.provider,
      id: item.id,
      thumb: item.thumb || item.urlClassic,
      urlClassic: item.urlClassic
    };
    favorites.push(rec);
    favoriteLookup.set(key, rec);
    saveFavorites();
    return true;
  }

  function deleteFavorite(item) {
    const key = item.favKey || makeFavoriteKey(item);
    const idx = favorites.findIndex(f => makeFavoriteKey(f) === key);
    if (idx === -1) return false;
    favorites.splice(idx, 1);
    favoriteLookup.delete(key);
    saveFavorites();
    return true;
  }

  // Re-render the modal grid only when it's actually open (so favoriting from
  // chat doesn't build/touch the modal needlessly).
  function refreshFavoritesUIIfOpen() {
    if (!modal || !modalOpen) return;
    if (state.provider === "favorites") applyFavoritesToState();
    render();
  }

  function toggleFavorite(item) {
    if (!item.urlClassic) return;
    const key = item.favKey || makeFavoriteKey(item);
    if (favoriteLookup.has(key)) deleteFavorite(item);
    else addFavorite(item);
    if (state.provider === "favorites") applyFavoritesToState();
    render();
  }

  function removeFavorite(item) {
    if (!deleteFavorite(item)) return;
    if (state.provider === "favorites") applyFavoritesToState();
    render();
  }

  function handleFavoriteControl(toggle) {
    const cell = toggle.closest(".btfw-gif-cell");
    if (!cell || cell.classList.contains("is-skeleton")) return false;
    const item = cellToItem(cell);
    if (!item) return false;
    const action = toggle.dataset.action || "";
    if (action === "remove-favorite") {
      removeFavorite(item);
    } else {
      toggleFavorite(item);
    }
    return true;
  }

  /* ============================================================
     In-chat right-click menu for Giphy/Tenor GIFs
       • Favorite / Unfavorite  → same favorites list as the modal
       • Hide / Show            → graceful blur toggle (per element)
     One delegated contextmenu listener covers EXISTING and FUTURE
     GIFs with zero per-image wiring and no observers. Channel emotes
     (img.channel-emote without .giphy/.tenor) are intentionally
     excluded — this only targets user-posted Giphy/Tenor GIFs.
     ============================================================ */
  const CHAT_GIF_SEL = "#messagebuffer img.giphy.chat-picture, #messagebuffer img.tenor.chat-picture";

  function parseChatGif(img){
    if (!img) return null;
    const isG = img.classList.contains("giphy");
    const isT = img.classList.contains("tenor");
    if (!isG && !isT) return null;
    const src = img.getAttribute("src") || img.src || "";
    let item;
    if (isG) {
      const m = src.match(/\/media\/([A-Za-z0-9_-]+)\//);
      const id = m ? m[1] : "";
      const urlClassic = id ? buildGiphyClassic(id) : stripQuery(src);
      item = { provider: "giphy", id, thumb: src || urlClassic, urlClassic };
    } else {
      const urlClassic = normTenor(src);
      item = { provider: "tenor", id: "", thumb: src || urlClassic, urlClassic };
    }
    item.favKey = makeFavoriteKey(item);
    return item;
  }

  function setGifHidden(img, hidden){
    if (!img) return;
    img.classList.toggle("btfw-gif-hidden", !!hidden);
    if (hidden){
      if (img.dataset.btfwTitle0 == null) img.dataset.btfwTitle0 = img.getAttribute("title") || "";
      img.setAttribute("title", "Hidden GIF — right-click to show");
    } else {
      const t0 = img.dataset.btfwTitle0 || "";
      if (t0) img.setAttribute("title", t0); else img.removeAttribute("title");
      delete img.dataset.btfwTitle0;
    }
  }

  let gmenu = null;
  let gmenuImg = null;
  let dismissBound = false;

  function ensureGifMenu(){
    if (gmenu) return gmenu;
    gmenu = document.createElement("div");
    gmenu.id = "btfw-gif-menu";
    gmenu.className = "btfw-gif-menu";
    gmenu.setAttribute("role", "menu");
    gmenu.hidden = true;
    gmenu.innerHTML = `
      <button type="button" class="btfw-gif-menu-item" data-act="fav" role="menuitem">
        <i class="far fa-star" aria-hidden="true"></i><span class="btfw-gif-menu-label">Favorite</span>
      </button>
      <button type="button" class="btfw-gif-menu-item" data-act="hide" role="menuitem">
        <i class="fa fa-eye-slash" aria-hidden="true"></i><span class="btfw-gif-menu-label">Hide</span>
      </button>`;
    document.body.appendChild(gmenu);
    gmenu.addEventListener("click", onGifMenuClick);
    gmenu.addEventListener("contextmenu", (e)=> e.preventDefault());
    return gmenu;
  }

  function syncGifMenu(img){
    const item = parseChatGif(img);
    const isFav = item ? favoriteLookup.has(item.favKey) : false;
    const favBtn = gmenu.querySelector('[data-act="fav"]');
    favBtn.querySelector(".btfw-gif-menu-label").textContent = isFav ? "Unfavorite" : "Favorite";
    favBtn.querySelector("i").className = isFav ? "fa fa-star" : "far fa-star";
    favBtn.classList.toggle("is-active", isFav);

    const hidden = img.classList.contains("btfw-gif-hidden");
    const hideBtn = gmenu.querySelector('[data-act="hide"]');
    hideBtn.querySelector(".btfw-gif-menu-label").textContent = hidden ? "Show" : "Hide";
    hideBtn.querySelector("i").className = hidden ? "fa fa-eye" : "fa fa-eye-slash";
  }

  function showGifMenu(x, y, img){
    ensureGifMenu();
    gmenuImg = img;
    syncGifMenu(img);
    gmenu.hidden = false;
    gmenu.style.left = "0px";
    gmenu.style.top = "0px";
    gmenu.style.visibility = "hidden";
    gmenu.classList.add("is-open");
    const r = gmenu.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = x, top = y;
    if (left + r.width + 8 > vw) left = Math.max(8, vw - r.width - 8);
    if (top + r.height + 8 > vh) top = Math.max(8, vh - r.height - 8);
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    gmenu.style.left = left + "px";
    gmenu.style.top = top + "px";
    gmenu.style.visibility = "";
    bindGifMenuDismiss();
  }

  function hideGifMenu(){
    if (!gmenu) return;
    gmenu.classList.remove("is-open");
    gmenu.hidden = true;
    gmenuImg = null;
    unbindGifMenuDismiss();
  }

  function onGifMenuClick(e){
    const btn = e.target.closest(".btfw-gif-menu-item");
    if (!btn) return;
    e.preventDefault();
    const img = gmenuImg;
    const act = btn.dataset.act;
    if (img){
      if (act === "fav"){
        const item = parseChatGif(img);
        if (item){
          if (favoriteLookup.has(item.favKey)) deleteFavorite(item);
          else addFavorite(item);
          refreshFavoritesUIIfOpen();
        }
      } else if (act === "hide"){
        setGifHidden(img, !img.classList.contains("btfw-gif-hidden"));
      }
    }
    hideGifMenu();
  }

  function onGifMenuDocDown(e){
    if (gmenu && !gmenu.contains(e.target)) hideGifMenu();
  }
  function onGifMenuKey(e){ if (e.key === "Escape") hideGifMenu(); }
  function onGifMenuReflow(){ hideGifMenu(); }

  function bindGifMenuDismiss(){
    if (dismissBound) return;
    dismissBound = true;
    document.addEventListener("mousedown", onGifMenuDocDown, true);
    document.addEventListener("keydown", onGifMenuKey, true);
    window.addEventListener("resize", onGifMenuReflow, true);
    window.addEventListener("scroll", onGifMenuReflow, true);
    const buf = document.getElementById("messagebuffer");
    if (buf) buf.addEventListener("scroll", onGifMenuReflow, true);
  }
  function unbindGifMenuDismiss(){
    if (!dismissBound) return;
    dismissBound = false;
    document.removeEventListener("mousedown", onGifMenuDocDown, true);
    document.removeEventListener("keydown", onGifMenuKey, true);
    window.removeEventListener("resize", onGifMenuReflow, true);
    window.removeEventListener("scroll", onGifMenuReflow, true);
    const buf = document.getElementById("messagebuffer");
    if (buf) buf.removeEventListener("scroll", onGifMenuReflow, true);
  }

  function onChatGifContextMenu(e){
    const t = e.target;
    const img = (t && t.closest) ? t.closest(CHAT_GIF_SEL) : null;
    if (!img) return; // not a chat GIF → leave the native menu alone
    e.preventDefault();
    e.stopPropagation();
    showGifMenu(e.clientX, e.clientY, img);
  }

  function wireChatGifMenu(){
    if (document._btfwGifMenuWired) return;
    document._btfwGifMenuWired = true;
    document.addEventListener("contextmenu", onChatGifContextMenu, true);
  }

  /* ---- boot ---- */
  function boot(){ ensureOpeners(); wireChatGifMenu(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    name: "feature:gifs",
    open,
    close,
    parseChatGif,
    isFavoritedData: (item) => item ? favoriteLookup.has(item.favKey || makeFavoriteKey(item)) : false,
    toggleFavoriteData: (item) => {
      if (!item) return;
      const it = Object.assign({}, item);
      it.favKey = it.favKey || makeFavoriteKey(it);
      if (favoriteLookup.has(it.favKey)) deleteFavorite(it);
      else addFavorite(it);
      refreshFavoritesUIIfOpen();
    }
  };
});
