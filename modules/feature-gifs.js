/* BillTube Framework — feature:gifs (BillTube2-compatible, classic GIPHY URL)
   - Inserts GIPHY as https://media1.giphy.com/media/<ID>/giphy.gif  (matches your filter)
   - Inserts Tenor as direct .gif with params stripped
   - 4×3 grid, search/trending, pagination
*/

BTFW.define("feature:gifs", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const PER_PAGE = 12;

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
    provider: "giphy",  // "giphy" | "tenor"
    query: "",
    page: 1,
    total: 0,
    items: [],          // { id, thumb, urlClassic }
    loading: false
  };

  // Track rendered state for optimized rendering
  let renderedItems = []; // Track what's currently rendered
  let gridClickHandlerAttached = false; // Ensure we only attach the delegated handler once

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
        c.addEventListener("click", e => { e.preventDefault(); open(); }, { capture:true });
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
        btn.addEventListener("click", e => { e.preventDefault(); open(); }, { capture:true });
      }
    }
  }

  /* ---- Modal ---- */
  let modal = null;
  function ensureModal(){
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "btfw-gif-modal";
    modal.className = "modal is-active";
    modal.innerHTML = `
      <div class="modal-background"></div>
      <div class="modal-card btfw-modal">
        <header class="modal-card-head">
          <p class="modal-card-title">GIFs</p>
          <button class="delete" aria-label="close"></button>
        </header>
        <section class="modal-card-body">
          <div class="btfw-gif-toolbar">
            <div class="tabs is-boxed is-small btfw-gif-tabs">
              <ul>
                <li class="is-active" data-p="giphy"><a>Giphy</a></li>
                <li data-p="tenor"><a>Tenor</a></li>
              </ul>
            </div>
            <div class="btfw-gif-search">
              <input id="btfw-gif-q" class="input is-small" type="text" placeholder="Search GIFs…">
              <button id="btfw-gif-go" class="button is-link is-small">Search</button>
              <button id="btfw-gif-trending" class="button is-dark is-small">Trending</button>
            </div>
          </div>

          <div id="btfw-gif-notice" class="btfw-gif-notice is-hidden"></div>
          <div id="btfw-gif-grid" class="btfw-gif-grid"></div>

          <nav class="pagination is-centered btfw-gif-pager" role="navigation" aria-label="pagination">
            <button id="btfw-gif-prev" class="button is-dark is-small">Prev</button>
            <span id="btfw-gif-pages" class="btfw-gif-pages">1 / 1</span>
            <button id="btfw-gif-next" class="button is-dark is-small">Next</button>
          </nav>
        </section>
        <footer class="modal-card-foot">
          <button class="button is-link" id="btfw-gif-close">Close</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector(".modal-background").addEventListener("click", close);
    modal.querySelector(".delete").addEventListener("click", close);
    $("#btfw-gif-close", modal).addEventListener("click", close);

    modal.querySelector(".btfw-gif-tabs ul").addEventListener("click", e=>{
      const li = e.target.closest("li[data-p]"); if (!li) return;
      modal.querySelectorAll(".btfw-gif-tabs li").forEach(x=>x.classList.toggle("is-active", x===li));
      state.provider = li.getAttribute("data-p");
      state.page = 1;
      search();
    });

    $("#btfw-gif-go", modal).addEventListener("click", ()=> { state.page = 1; search(); });
    $("#btfw-gif-q",  modal).addEventListener("keydown", e=> { if (e.key === "Enter") { state.page = 1; search(); }});
    $("#btfw-gif-trending", modal).addEventListener("click", ()=>{
      $("#btfw-gif-q").value = "";
      state.page = 1; search();
    });

    $("#btfw-gif-prev", modal).addEventListener("click", ()=>{
      if (state.page > 1) { state.page--; debouncedRender(); }
    });
    $("#btfw-gif-next", modal).addEventListener("click", ()=>{
      const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
      if (state.page < totalPages) { state.page++; debouncedRender(); }
    });

    return modal;
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
      return { id, thumb, urlClassic };
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
      return { id: t.id, thumb: tiny, urlClassic: normTenor(gif) };
    });
    return { items: list, total: list.length };
  }

  async function search(){
    const q = ($("#btfw-gif-q", ensureModal()).value || "").trim();
    state.query = q;
    state.page = 1;
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
      frag.appendChild(sk);
    }

    grid.appendChild(frag);
    $("#btfw-gif-pages").textContent = "… / …";
  }

  function render(){
    const grid = $("#btfw-gif-grid", ensureModal());

    // Setup event delegation (only once)
    setupGridClickHandler(grid);

    const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
    const clamped = Math.max(1, Math.min(totalPages, state.page));
    if (clamped !== state.page) state.page = clamped;

    const start = (state.page - 1) * PER_PAGE;
    const pageItems = state.items.slice(start, start + PER_PAGE);

    // OPTIMIZATION: Check if we can update in place
    const canUpdateInPlace = shouldUpdateInPlace(pageItems, grid);

    if (canUpdateInPlace) {
      // Fast path: update existing elements
      updateExistingCells(grid, pageItems);
    } else {
      // Full render needed
      fullRender(grid, pageItems);
    }

    // Update rendered state
    renderedItems = pageItems.map(item => ({
      id: item.id,
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
  function updateExistingCells(grid, newItems) {
    const cells = grid.querySelectorAll(".btfw-gif-cell");

    newItems.forEach((item, index) => {
      const cell = cells[index];
      if (!cell) return;

      const oldItem = renderedItems[index];

      // Only update if item actually changed
      if (!oldItem || oldItem.id !== item.id) {
        updateCell(cell, item);
      }
    });
  }

  // Update a single cell's content
  function updateCell(cell, item) {
    // Update data attribute
    cell.dataset.url = item.urlClassic || "";
    cell.dataset.id = item.id || "";

    // Update image
    const img = cell.querySelector("img");
    if (img && img.src !== item.thumb) {
      img.src = item.thumb;
      img.alt = "gif";

      // Reset broken state
      cell.classList.remove("is-broken");

      // Re-attach error handler
      img.onerror = () => cell.classList.add("is-broken");
    }

    // Remove skeleton class if present
    cell.classList.remove("is-skeleton");
  }

  // Full render when updating in place isn't possible
  function fullRender(grid, pageItems) {
    // Use replaceChildren for efficient bulk replacement (better than innerHTML = "")
    const frag = document.createDocumentFragment();

    pageItems.forEach(item => {
      const cell = createGifCell(item);
      frag.appendChild(cell);
    });

    grid.replaceChildren(frag);
  }

  // Create a single GIF cell element
  function createGifCell(item) {
    const cell = document.createElement("button");
    cell.className = "btfw-gif-cell";
    cell.type = "button";

    // Store data in attributes for event delegation
    cell.dataset.url = item.urlClassic || "";
    cell.dataset.id = item.id || "";

    const img = document.createElement("img");
    img.src = item.thumb;
    img.alt = "gif";
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = () => cell.classList.add("is-broken");

    cell.appendChild(img);

    return cell;
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
// Open the GIF modal when the bridge asks
document.addEventListener('btfw:openGifs', ()=> {
  try { openGifModal(); } catch(e){}
});

  /* ---- open / close ---- */
  function open(){
    ensureModal();
    showNotice("");
    state.page = 1;
    state.provider = modal.querySelector(".btfw-gif-tabs li.is-active")?.getAttribute("data-p") || "giphy";
    renderSkeleton();
    setTimeout(search, 0);
    modal.classList.add("is-active");
  }
  function close(){ modal?.classList.remove("is-active"); }

  /* ---- boot ---- */
  function boot(){ ensureOpeners(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:gifs", open, close };
});
