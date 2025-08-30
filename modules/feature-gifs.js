/* BillTube Framework — feature:gifs (Giphy/Tenor, grid + pagination)
   - Bulma modal with tabs (Giphy / Tenor) + search box
   - Proper CSS Grid (no overlap) with square cells, object-fit:cover
   - Pagination: 9 items per page, Prev/Next + page count
   - Click a GIF to insert its URL into #chatline
   - Uses existing keys if present:
       window.BTFW_GIPHY_KEY   or localStorage("btfw:giphy:key")
       window.BTFW_TENOR_KEY   or localStorage("btfw:tenor:key")
     (falls back to “no key” public endpoints; if those rate-limit, show notice)
*/

BTFW.define("feature:gifs", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const PER_PAGE = 9;

  // ---- Keys (prefer your existing globals if you set them anywhere) ----
  const GIPHY_KEY = window.BTFW_GIPHY_KEY
                 || localStorage.getItem("btfw:giphy:key")
                 || "dc6zaTOxFJmzC"; // legacy public key (may be rate limited)
  const TENOR_KEY = window.BTFW_TENOR_KEY
                 || localStorage.getItem("btfw:tenor:key")
                 || "LIVDSRZULELA";  // demo key (rate limited)

  // ---- State ----
  const state = {
    provider: "giphy",   // "giphy" | "tenor"
    query: "",
    page: 1,
    total: 0,
    items: [],           // normalized: { id, thumb, url }
    loading: false
  };

  // ---- Utilities ----
  function insertAtCursor(input, text){
    input.focus();
    const s = input.selectionStart ?? input.value.length;
    const e = input.selectionEnd   ?? input.value.length;
    const before = input.value.slice(0, s);
    const after  = input.value.slice(e);
    input.value = before + text + after;
    const pos = before.length + text.length;
    input.selectionStart = input.selectionEnd = pos;
    input.dispatchEvent(new Event("input", {bubbles:true}));
  }

  function ensureOpeners(){
    ["#btfw-btn-gif", ".btfw-btn-gif", "#giphybtn", "#gifbtn"].forEach(sel=>{
      $$(sel).forEach(el=>{
        el.removeAttribute("onclick");
        const c = el.cloneNode(true);
        el.parentNode.replaceChild(c, el);
        c.addEventListener("click", (e)=>{ e.preventDefault(); open(); }, {capture:true});
      });
    });
    // If there’s no GIF button, add one next to Emotes
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
        btn.innerHTML = (document.querySelector('.fa')) ? '<i class="fa fa-gif"></i>' : 'GIF';
        btn.title = "GIFs";
        bar.appendChild(btn);
        btn.addEventListener("click", (e)=>{ e.preventDefault(); open(); }, {capture:true});
      }
    }
  }

  // ---- Modal ----
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

    // Close actions
    modal.querySelector(".modal-background").addEventListener("click", close);
    modal.querySelector(".delete").addEventListener("click", close);
    modal.querySelector("#btfw-gif-close").addEventListener("click", close);

    // Tabs
    modal.querySelector(".btfw-gif-tabs ul").addEventListener("click",(e)=>{
      const li = e.target.closest("li[data-p]"); if (!li) return;
      modal.querySelectorAll(".btfw-gif-tabs li").forEach(x=>x.classList.toggle("is-active", x===li));
      state.provider = li.getAttribute("data-p");
      state.page = 1;
      search();
    });

    // Search
    $("#btfw-gif-go", modal).addEventListener("click", ()=> { state.page = 1; search(); });
    $("#btfw-gif-q", modal).addEventListener("keydown", (e)=> { if (e.key==="Enter") { state.page = 1; search(); } });

    // Pager
    $("#btfw-gif-prev", modal).addEventListener("click", ()=>{
      if (state.page > 1) { state.page--; render(); }
    });
    $("#btfw-gif-next", modal).addEventListener("click", ()=>{
      const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
      if (state.page < totalPages) { state.page++; render(); }
    });

    return modal;
  }

  function showNotice(msg){
    const n = $("#btfw-gif-notice", modal);
    n.textContent = msg || "";
    n.classList.toggle("is-hidden", !msg);
  }

  // ---- Fetching ----
  async function fetchGiphy(q){
    // Use "search" if q, otherwise "trending"
    const endpoint = q ? "https://api.giphy.com/v1/gifs/search" : "https://api.giphy.com/v1/gifs/trending";
    const url = new URL(endpoint);
    url.searchParams.set("api_key", GIPHY_KEY);
    url.searchParams.set("q", q || "");
    url.searchParams.set("limit", 50);
    url.searchParams.set("rating", "pg-13");

    const res = await fetch(url.toString());
    const json = await res.json();
    const list = (json.data || []).map(g => {
      // Prefer webp/mp4 thumbs if available, fallback to still
      const img = g.images?.fixed_width_small || g.images?.fixed_width || g.images?.downsized_still || {};
      const thumb = img.webp || img.mp4 || img.url || g.images?.original?.url || "";
      const url = g.images?.original?.url || g.url || thumb;
      return { id: g.id, thumb, url };
    });
    const total = Array.isArray(json.data) ? json.data.length : 0;
    return { items: list, total };
  }

  async function fetchTenor(q){
    const endpoint = q ? "https://tenor.googleapis.com/v2/search" : "https://tenor.googleapis.com/v2/featured";
    const url = new URL(endpoint);
    url.searchParams.set("key", TENOR_KEY);
    url.searchParams.set("q", q || "");
    url.searchParams.set("limit", 50);
    url.searchParams.set("media_filter", "gif,tinygif,mediumgif");
    url.searchParams.set("contentfilter", "high");

    const res = await fetch(url.toString());
    const json = await res.json();
    const list = (json.results || []).map(t => {
      const tiny = t.media_formats?.tinygif?.url;
      const med  = t.media_formats?.gif?.url || t.media_formats?.mediumgif?.url;
      const thumb = tiny || med || "";
      const url   = med  || tiny || "";
      return { id: t.id, thumb, url };
    });
    const total = Array.isArray(json.results) ? json.results.length : 0;
    return { items: list, total };
  }

  async function search(){
    const q = ($("#btfw-gif-q", modal).value || "").trim();
    state.query = q;
    state.page = 1;
    state.loading = true;
    renderSkeleton();

    try {
      const { items, total } = (state.provider === "giphy")
        ? (await fetchGiphy(q))
        : (await fetchTenor(q));

      state.items = items;
      state.total = total;
      state.loading = false;

      if (!items.length) {
        showNotice("No results. Try a different search.");
      } else {
        showNotice("");
      }

      render();
    } catch (e) {
      state.items = [];
      state.total = 0;
      state.loading = false;
      showNotice("Failed to load GIFs (API limit or network). Try again later.");
      render();
      // console.warn(e);
    }
  }

  // ---- Rendering ----
  function renderSkeleton(){
    const grid = $("#btfw-gif-grid", ensureModal());
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let i=0; i<PER_PAGE; i++){
      const sk = document.createElement("div");
      sk.className = "btfw-gif-cell is-skeleton";
      frag.appendChild(sk);
    }
    grid.appendChild(frag);
    $("#btfw-gif-pages").textContent = "… / …";
  }

  function render(){
    const grid = $("#btfw-gif-grid", ensureModal());
    grid.innerHTML = "";

    const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
    const clamped = Math.max(1, Math.min(totalPages, state.page));
    if (clamped !== state.page) state.page = clamped;

    const start = (state.page - 1) * PER_PAGE;
    const pageItems = state.items.slice(start, start + PER_PAGE);

    const frag = document.createDocumentFragment();
    pageItems.forEach(item=>{
      const cell = document.createElement("button");
      cell.className = "btfw-gif-cell";
      cell.type = "button";
      cell.title = "Insert GIF";
      const img = document.createElement("img");
      img.src = item.thumb;
      img.alt = "gif";
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = ()=> cell.classList.add("is-broken");
      cell.appendChild(img);
      cell.addEventListener("click", ()=>{
        const input = document.getElementById("chatline");
        if (!input) return;
        insertAtCursor(input, " " + (item.url || item.thumb) + " ");
        close();
      });
      frag.appendChild(cell);
    });

    grid.appendChild(frag);

    // Pager UI
    $("#btfw-gif-pages").textContent = `${state.page} / ${totalPages}`;
    $("#btfw-gif-prev").disabled = (state.page <= 1);
    $("#btfw-gif-next").disabled = (state.page >= totalPages);
  }

  // ---- open / close ----
  function open(){
    ensureModal();
    // reset (but keep last query)
    showNotice("");
    state.page = 1;
    state.provider = modal.querySelector(".btfw-gif-tabs li.is-active")?.getAttribute("data-p") || "giphy";
    renderSkeleton();
    setTimeout(search, 0);
    modal.classList.add("is-active");
  }

  function close(){ modal?.classList.remove("is-active"); }

  // ---- boot ----
  function boot(){
    ensureOpeners();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:gifs", open, close };
});
