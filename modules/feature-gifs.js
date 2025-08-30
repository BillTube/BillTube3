/* BillTube Framework — feature:gifs (BillTube2-compatible)
   - Uses BillTube2 keys by default
   - Inserts classic, filter-friendly URLs
   - 3×3 grid, search/trending, pagination
*/

BTFW.define("feature:gifs", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const PER_PAGE = 9;

  /* ---- Keys (BillTube2 defaults, override via localStorage if needed) ---- */
  const K = { giphy: "btfw:giphy:key", tenor: "btfw:tenor:key" };
  function getKey(which) {
    try { return (localStorage.getItem(K[which]) || "").trim(); } catch (_) { return ""; }
  }
  function effectiveKey(which, fallback) {
    const k = getKey(which);
    return k || fallback;
  }
  const DEFAULT_GIPHY = "bb2006d9d3454578be1a99cfad65913d";
  const DEFAULT_TENOR = "5WPAZ4EXST2V";      // Tenor v1 key used in BillTube2

  /* ---- State ---- */
  const state = {
    provider: "giphy",  // "giphy" | "tenor"
    query: "",
    page: 1,
    total: 0,
    items: [],          // { id, thumb, url }
    loading: false
  };

  /* ---- Utilities ---- */
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

  // Trim query/hash
  function stripQuery(u) { return (u || "").split("?")[0].split("#")[0]; }

  // Normalize GIPHY URL to classic format:
  //   https://media.giphy.com/media/<ID>/giphy.gif
  function normGiphy(originalUrl, idMaybe) {
    let id = idMaybe || "";
    const clean = stripQuery(originalUrl);

    // Try to extract ID from any giphy URL shape
    // Examples:
    //   https://media4.giphy.com/media/abc123/giphy-downsized.gif
    //   https://media.giphy.com/media/abc123/giphy.gif
    //   https://i.giphy.com/media/abc123/giphy.gif
    const m = clean.match(/\/media\/([^/]+)\//) || clean.match(/\/gifs\/([^/?#]+)/);
    if (m && m[1]) id = m[1];

    if (!id && clean) {
      // sometimes v1 paths: /media/v1.Y2lk.../<ID>/giphy-downsized.gif
      const m2 = clean.match(/\/([A-Za-z0-9]+)\/giphy(?:-[a-z]+)?\.gif$/i);
      if (m2 && m2[1]) id = m2[1];
    }

    if (!id) return clean; // fallback

    return `https://media.giphy.com/media/${id}/giphy.gif`;
  }

  // Normalize Tenor URL: use gif URL and strip params
  function normTenor(url) {
    return stripQuery(url || "");
  }

  function ensureOpeners() {
    // bind any existing buttons (including legacy)
    ["#btfw-btn-gif", ".btfw-btn-gif", "#giphybtn", "#gifbtn"].forEach(sel => {
      $$(sel).forEach(el => {
        el.removeAttribute("onclick");
        const c = el.cloneNode(true);
        el.parentNode.replaceChild(c, el);
        c.addEventListener("click", e => { e.preventDefault(); open(); }, { capture: true });
      });
    });
    // add one if missing
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
        btn.innerHTML = (document.querySelector(".fa")) ? '<i class="fa fa-gif"></i>' : 'GIF';
        btn.title = "GIFs";
        bar.appendChild(btn);
        btn.addEventListener("click", e => { e.preventDefault(); open(); }, { capture: true });
      }
    }
  }

  /* ---- Modal ---- */
  let modal = null;
  function ensureModal() {
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

    // Close
    modal.querySelector(".modal-background").addEventListener("click", close);
    modal.querySelector(".delete").addEventListener("click", close);
    $("#btfw-gif-close", modal).addEventListener("click", close);

    // Tabs
    modal.querySelector(".btfw-gif-tabs ul").addEventListener("click", e => {
      const li = e.target.closest("li[data-p]"); if (!li) return;
      modal.querySelectorAll(".btfw-gif-tabs li").forEach(x => x.classList.toggle("is-active", x === li));
      state.provider = li.getAttribute("data-p");
      state.page = 1;
      search();
    });

    // Search & trending
    $("#btfw-gif-go",  modal).addEventListener("click", () => { state.page = 1; search(); });
    $("#btfw-gif-q",   modal).addEventListener("keydown", e => { if (e.key === "Enter") { state.page = 1; search(); }});
    $("#btfw-gif-trending", modal).addEventListener("click", () => {
      $("#btfw-gif-q").value = "";
      state.page = 1; search();
    });

    // Pager
    $("#btfw-gif-prev", modal).addEventListener("click", () => {
      if (state.page > 1) { state.page--; render(); }
    });
    $("#btfw-gif-next", modal).addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
      if (state.page < totalPages) { state.page++; render(); }
    });

    return modal;
  }

  function showNotice(msg) {
    const n = $("#btfw-gif-notice", modal);
    n.textContent = msg || "";
    n.classList.toggle("is-hidden", !msg);
  }

  /* ---- Fetching ---- */
  async function fetchGiphy(q) {
    const key = effectiveKey("giphy", DEFAULT_GIPHY);
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
      const id = g.id;
      const thumb = (g.images && (g.images.fixed_width_small?.url || g.images.fixed_width?.url || g.images.downsized_still?.url)) || "";
      // Use ORIGINAL for insertion, then normalize to classic /media/<ID>/giphy.gif
      const raw  = g.images?.original?.url || "";
      const url  = normGiphy(raw, id) || (id ? `https://media.giphy.com/media/${id}/giphy.gif` : raw);
      return { id, thumb, url };
    });
    return { items: list, total: list.length };
  }

  async function fetchTenor(q) {
    // Use Tenor v1 to match BillTube2 behavior
    const key = effectiveKey("tenor", DEFAULT_TENOR);
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
      // BillTube2 used result.media[0].gif.url
      const gif  = t.media?.[0]?.gif?.url || t.media?.[0]?.mediumgif?.url || t.media?.[0]?.tinygif?.url || "";
      const tiny = t.media?.[0]?.nanogif?.url || t.media?.[0]?.tinygif?.url || gif;
      return { id: t.id, thumb: tiny, url: normTenor(gif) };
    });
    return { items: list, total: list.length };
  }

  async function search() {
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
      // Keys may be revoked/rate limited; just show friendly text
      showNotice("Failed to load GIFs (key limit or network). Try again, or set your own keys in localStorage.");
      render();
    }
  }

  /* ---- Rendering ---- */
  function renderSkeleton() {
    const grid = $("#btfw-gif-grid", ensureModal());
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let i = 0; i < PER_PAGE; i++) {
      const sk = document.createElement("div");
      sk.className = "btfw-gif-cell is-skeleton";
      frag.appendChild(sk);
    }
    grid.appendChild(frag);
    $("#btfw-gif-pages").textContent = "… / …";
  }

  function render() {
    const grid = $("#btfw-gif-grid", ensureModal());
    grid.innerHTML = "";

    const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
    const clamped = Math.max(1, Math.min(totalPages, state.page));
    if (clamped !== state.page) state.page = clamped;

    const start = (state.page - 1) * PER_PAGE;
    const pageItems = state.items.slice(start, start + PER_PAGE);

    const frag = document.createDocumentFragment();
    pageItems.forEach(item => {
      const cell = document.createElement("button");
      cell.className = "btfw-gif-cell";
      cell.type = "button";
      const img = document.createElement("img");
      img.src = item.thumb;
      img.alt = "gif";
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = () => cell.classList.add("is-broken");
      cell.appendChild(img);

      cell.addEventListener("click", () => {
        const input = document.getElementById("chatline");
        if (!input) return;
        // Insert the normalized link wrapped with spaces so filters catch it cleanly
        insertAtCursor(input, " " + item.url + " ");
        close();
      });

      frag.appendChild(cell);
    });
    grid.appendChild(frag);

    $("#btfw-gif-pages").textContent = `${state.page} / ${totalPages}`;
    $("#btfw-gif-prev").disabled = (state.page <= 1);
    $("#btfw-gif-next").disabled = (state.page >= totalPages);
  }

  /* ---- open / close ---- */
  function open() {
    ensureModal();
    showNotice("");
    state.page = 1;
    state.provider = modal.querySelector(".btfw-gif-tabs li.is-active")?.getAttribute("data-p") || "giphy";
    renderSkeleton();
    setTimeout(search, 0);
    modal.classList.add("is-active");
  }
  function close() { modal?.classList.remove("is-active"); }

  /* ---- boot ---- */
  function boot() { ensureOpeners(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:gifs", open, close };
});
