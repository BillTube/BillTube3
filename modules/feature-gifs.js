
BTFW.define("feature:gifs", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const PER_PAGE = 12;

  const K = { giphy: "btfw:giphy:key", tenor: "btfw:tenor:key" };
  const DEFAULT_GIPHY = "bb2006d9d3454578be1a99cfad65913d";
  const DEFAULT_TENOR = "5WPAZ4EXST2V";

  function getKey(which) {
    try { return (localStorage.getItem(K[which]) || "").trim(); } catch (_) { return ""; }
  }
  function effKey(which, fallback) {
    const v = getKey(which);
    return v || fallback;
  }

  const state = {
    provider: "giphy",
    query: "",
    page: 1,
    total: 0,
    items: [],
    loading: false
  };

  let renderedItems = [];
  let gridClickHandlerAttached = false;

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
  function buildGiphyClassic(id){ return `https://media1.giphy.com/media/${id}/giphy.gif`; }
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

  function renderSkeleton(){
    const grid = $("#btfw-gif-grid", ensureModal());

    renderedItems = [];

    const existingSkeletons = grid.querySelectorAll('.is-skeleton');
    if (existingSkeletons.length === PER_PAGE) {
      return;
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

    setupGridClickHandler(grid);

    const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
    const clamped = Math.max(1, Math.min(totalPages, state.page));
    if (clamped !== state.page) state.page = clamped;

    const start = (state.page - 1) * PER_PAGE;
    const pageItems = state.items.slice(start, start + PER_PAGE);

    const canUpdateInPlace = shouldUpdateInPlace(pageItems, grid);

    if (canUpdateInPlace) {
      updateExistingCells(grid, pageItems);
    } else {
      fullRender(grid, pageItems);
    }

    renderedItems = pageItems.map(item => ({
      id: item.id,
      thumb: item.thumb,
      urlClassic: item.urlClassic
    }));

    $("#btfw-gif-pages").textContent = `${state.page} / ${totalPages}`;
    $("#btfw-gif-prev").disabled = (state.page <= 1);
    $("#btfw-gif-next").disabled = (state.page >= totalPages);
  }

  function setupGridClickHandler(grid) {
    if (gridClickHandlerAttached) return;

    grid.addEventListener("click", (e) => {
      const cell = e.target.closest(".btfw-gif-cell");
      if (!cell || cell.classList.contains("is-skeleton")) return;

      const url = cell.dataset.url;
      if (!url) return;

      const input = document.getElementById("chatline");
      if (!input) return;

      insertAtCursor(input, " " + url + " ");
      close();
    });

    gridClickHandlerAttached = true;
  }

  function shouldUpdateInPlace(newItems, grid) {
    const existingCells = grid.querySelectorAll(".btfw-gif-cell:not(.is-skeleton)");

    if (existingCells.length !== newItems.length) return false;

    if (renderedItems.length === 0) return false;

    return true;
  }

  function updateExistingCells(grid, newItems) {
    const cells = grid.querySelectorAll(".btfw-gif-cell");

    newItems.forEach((item, index) => {
      const cell = cells[index];
      if (!cell) return;

      const oldItem = renderedItems[index];

      if (!oldItem || oldItem.id !== item.id) {
        updateCell(cell, item);
      }
    });
  }

  function updateCell(cell, item) {
    cell.dataset.url = item.urlClassic || "";
    cell.dataset.id = item.id || "";

    const img = cell.querySelector("img");
    if (img && img.src !== item.thumb) {
      img.src = item.thumb;
      img.alt = "gif";
      prepareImageLoadingState(cell, img);
    } else if (img) {
      prepareImageLoadingState(cell, img);
    }

    cell.classList.remove("is-skeleton");
  }

  function fullRender(grid, pageItems) {
    const frag = document.createDocumentFragment();

    pageItems.forEach(item => {
      const cell = createGifCell(item);
      frag.appendChild(cell);
    });

    grid.replaceChildren(frag);
  }

  function createGifCell(item) {
    const cell = document.createElement("button");
    cell.className = "btfw-gif-cell";
    cell.type = "button";

    cell.dataset.url = item.urlClassic || "";
    cell.dataset.id = item.id || "";

    const img = document.createElement("img");
    img.src = item.thumb;
    img.alt = "gif";
    img.loading = "lazy";
    img.decoding = "async";
    prepareImageLoadingState(cell, img);

    cell.appendChild(img);

    return cell;
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

  let renderTimeout = null;

  function debouncedRender() {
    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }

    renderTimeout = setTimeout(() => {
      render();
      renderTimeout = null;
    }, 16);
  }

  document.addEventListener('btfw:openGifs', ()=> {
    try { openGifModal(); } catch(e){}
  });

  function open(){
    ensureModal();
    showNotice("");
    state.page = 1;
    state.provider = modal.querySelector(".btfw-gif-tabs li.is-active")?.getAttribute("data-p") || "giphy";
    renderSkeleton();
    setTimeout(search, 0);
    modal.classList.add("is-active");
    const input = $("#btfw-gif-q", modal);
    if (input) {
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    }
  }
  function close(){ modal?.classList.remove("is-active"); }

  function boot(){ ensureOpeners(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:gifs", open, close };
});
