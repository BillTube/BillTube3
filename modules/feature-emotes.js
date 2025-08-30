/* BillTube Framework — feature:emotes
   Channel Emotes + Emoji picker (Bulma modal), with search & recently-used.
   - Opens from #btfw-btn-emotes (your chat bottom-bar button)
   - Tabs: Channel Emotes / Emoji / Recent
   - Search filters current tab
   - Click inserts into #chatline at cursor position
   - Keeps per-channel "recently used" (localStorage)
   - Keyboard: ↑ ↓ ← → to move, Enter to insert, Esc to close
*/
BTFW.define("feature:emotes", [], async () => {
  // ---------- tiny helpers ----------
  const $ = (s, r=document) => r.querySelector(s);
  const $$= (s, r=document) => Array.from(r.querySelectorAll(s));

  function insertAtCursor(textarea, text) {
    textarea.focus();
    const [s,e] = [textarea.selectionStart, textarea.selectionEnd];
    const val = textarea.value;
    const before = val.slice(0, s);
    const after  = val.slice(e);
    textarea.value = before + text + after;
    const pos = before.length + text.length;
    textarea.selectionStart = textarea.selectionEnd = pos;
    textarea.dispatchEvent(new Event("input", {bubbles:true}));
  }

  // ---------- state ----------
  const chatline = $("#chatline");
  const CHANNEL_NAME = (window.CHANNEL && window.CHANNEL.name) || "default";
  const RECENT_KEY   = `btfw:recent:emotes:${CHANNEL_NAME}`;

  let state = {
    tab: "emotes",             // "emotes" | "emoji" | "recent"
    list: { emotes: [], emoji: [], recent: [] },
    filtered: [],
    highlight: -1,
    emojiReady: false,
    search: ""
  };

  // ---------- build modal ----------
  function ensureModal() {
    let m = $("#btfw-emotes-modal");
    if (m) return m;

    m = document.createElement("div");
    m.id = "btfw-emotes-modal";
    m.className = "modal";
    m.innerHTML = `
      <div class="modal-background"></div>
      <div class="modal-card btfw-emotes-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Emotes</p>
          <button class="delete" aria-label="close"></button>
        </header>
        <section class="modal-card-body">
          <div class="tabs is-boxed is-small btfw-emotes-tabs">
            <ul>
              <li data-tab="emotes" class="is-active"><a>Channel</a></li>
              <li data-tab="emoji"><a>Emoji</a></li>
              <li data-tab="recent"><a>Recent</a></li>
            </ul>
          </div>

          <div class="field has-addons btfw-emotes-search">
            <p class="control is-expanded">
              <input id="btfw-emotes-search" class="input is-small" type="text" placeholder="Search…">
            </p>
            <p class="control">
              <button id="btfw-emotes-clear" class="button is-small">Clear</button>
            </p>
          </div>

          <div id="btfw-emotes-grid" class="btfw-emotes-grid" tabindex="0" aria-label="Emote grid"></div>
        </section>
        <footer class="modal-card-foot">
          <span class="help">↑↓←→ navigate • Enter insert • Esc close</span>
          <button class="button" id="btfw-emotes-close">Close</button>
        </footer>
      </div>
    `;
    document.body.appendChild(m);

    // High z-index to avoid backdrop issues
    const css = document.createElement("style");
    css.textContent = `
      #btfw-emotes-modal.is-active { z-index: 6000; }
      .btfw-emotes-card { width: 560px; max-height: 80vh; overflow: hidden; }
      .btfw-emotes-card .modal-card-body { overflow: hidden; padding-top: 10px; }
      .btfw-emotes-tabs { margin-bottom: 8px; }
      .btfw-emotes-search { margin-bottom: 8px; }
      .btfw-emotes-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 8px;
        overflow: auto;
        max-height: calc(80vh - 160px);
        padding-right: 4px;
      }
      .btfw-emote-tile {
        display:flex; align-items:center; justify-content:center;
        width: 56px; height: 56px;
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 10px; cursor: pointer;
        transition: transform .08s ease, background .1s ease;
      }
      .btfw-emote-tile:hover { background: rgba(255,255,255,.08); transform: translateY(-1px); }
      .btfw-emote-tile.is-active { outline: 2px solid #6d4df6; }
      .btfw-emote-img { max-width: 42px; max-height: 42px; }
      .btfw-emoji { font-size: 26px; line-height: 1; }
      .btfw-emote-name {
        grid-column: 1 / -1;
        font-size: 12px; opacity: .75; margin-top: -2px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        display:none; /* hidden to keep a compact grid; enable if you want captions */
      }
      html.btfw-dark .btfw-emote-tile { background:#1a2230; border-color:rgba(255,255,255,.10); }
      html.btfw-dark .btfw-emote-tile:hover { background:#202a3a; }
    `;
    document.head.appendChild(css);

    // Close behavior
    $(".delete", m).addEventListener("click", close);
    $(".modal-background", m).addEventListener("click", close);
    $("#btfw-emotes-close", m).addEventListener("click", close);

    // Tabs
    $(".btfw-emotes-tabs ul", m).addEventListener("click", (ev)=>{
      const li = ev.target.closest("li[data-tab]");
      if (!li) return;
      $$(".btfw-emotes-tabs li", m).forEach(x => x.classList.toggle("is-active", x===li));
      state.tab = li.getAttribute("data-tab");
      state.search = ""; $("#btfw-emotes-search").value = "";
      render();
      if (state.tab === "emoji" && !state.emojiReady) loadEmoji();
    });

    // Search
    $("#btfw-emotes-search", m).addEventListener("input", (e)=>{
      state.search = e.target.value.trim();
      render();
    });
    $("#btfw-emotes-clear", m).addEventListener("click", ()=>{
      state.search = ""; $("#btfw-emotes-search").value = ""; render();
    });

    // Keyboard navigation on the grid
    $("#btfw-emotes-grid", m).addEventListener("keydown", (ev)=>{
      const grid = $("#btfw-emotes-grid");
      const count = grid.children.length;
      if (!count) return;

      const cols = 8;
      const row = Math.floor(state.highlight / cols);
      const col = state.highlight % cols;

      switch (ev.key) {
        case "ArrowRight": state.highlight = Math.min(count-1, state.highlight+1); break;
        case "ArrowLeft":  state.highlight = Math.max(0, state.highlight-1);       break;
        case "ArrowDown":  state.highlight = Math.min(count-1, (row+1)*cols + col); break;
        case "ArrowUp":    state.highlight = Math.max(0, (row-1)*cols + col);       break;
        case "Enter":
          const tile = grid.children[state.highlight];
          tile && tile.click();
          ev.preventDefault();
          return;
        case "Escape": close(); return;
        default: return;
      }
      ev.preventDefault();
      highlightActive();
      ensureVisible();
    });

    return m;
  }

  // ---------- data load ----------
  function loadChannelEmotes() {
    const list = Array.isArray(window.CHANNEL?.emotes) ? window.CHANNEL.emotes : [];
    // normalize: {name, image} only
    state.list.emotes = list
      .filter(x => x && x.name)
      .map(x => ({ name: x.name, image: x.image || "" }));
  }

  async function loadEmoji() {
    // Try localStorage cache first
    try {
      const raw = localStorage.getItem("btfw:emoji:cache");
      if (raw) {
        state.list.emoji = JSON.parse(raw);
        state.emojiReady = true;
        render();
        return;
      }
    } catch(_){}

    // Fetch a small, well-known emoji dataset (char + name + keywords)
    // Falls back to a minimal built-in set if fetch fails.
    const url = "https://cdn.jsdelivr.net/npm/emoji.json@13.1.0/emoji.json";
    try {
      const res = await fetch(url, {cache:"force-cache"});
      const arr = await res.json();
      // keep only essentials to reduce memory
      state.list.emoji = arr.map(e => ({
        char: e.char, name: (e.name || "").toLowerCase(),
        keywords: (e.keywords || "").toLowerCase()
      }));
      localStorage.setItem("btfw:emoji:cache", JSON.stringify(state.list.emoji));
    } catch(e) {
      // minimal fallback
      state.list.emoji = [
        {char:"😀", name:"grinning face", keywords:"smile happy"},
        {char:"😂", name:"face with tears of joy", keywords:"laugh cry"},
        {char:"😍", name:"smiling face with heart-eyes", keywords:"love"},
        {char:"👍", name:"thumbs up", keywords:"like yes ok"},
        {char:"🔥", name:"fire", keywords:"lit hot"},
        {char:"🎉", name:"party popper", keywords:"celebrate confetti"},
      ];
    }
    state.emojiReady = true;
    render();
  }

  function loadRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      state.list.recent = raw ? JSON.parse(raw) : [];
    } catch(_){ state.list.recent = []; }
  }
  function pushRecent(item) {
    // item: { kind:"emote"|"emoji", name?, image?, char? }
    const key = item.kind === "emoji" ? item.char : item.name;
    // dedupe
    state.list.recent = state.list.recent.filter(x => (x.kind==="emoji" ? x.char : x.name) !== key);
    state.list.recent.unshift(item);
    state.list.recent = state.list.recent.slice(0, 24);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(state.list.recent)); } catch(_){}
  }

  // ---------- render ----------
  function filterLists() {
    const q = state.search.toLowerCase();
    if (state.tab === "emotes") {
      state.filtered = !q ? state.list.emotes
        : state.list.emotes.filter(x => x.name.toLowerCase().includes(q));
    } else if (state.tab === "emoji") {
      state.filtered = !q ? state.list.emoji
        : state.list.emoji.filter(x => x.name.includes(q) || x.keywords.includes(q));
    } else {
      // recent: show both kinds
      state.filtered = !q ? state.list.recent : state.list.recent.filter(x => {
        if (x.kind === "emoji") return (x.char + (x.name||"") + (x.keywords||"")).toLowerCase().includes(q);
        return (x.name||"").toLowerCase().includes(q);
      });
    }
  }

  function render() {
    const grid = $("#btfw-emotes-grid");
    if (!grid) return;
    filterLists();
    grid.innerHTML = "";
    state.highlight = 0;

    const frag = document.createDocumentFragment();

    state.filtered.forEach(item => {
      const tile = document.createElement("div");
      tile.className = "btfw-emote-tile";
      if (state.tab === "emoji" || (item.kind === "emoji")) {
        const span = document.createElement("span");
        span.className = "btfw-emoji";
        span.textContent = item.char;
        tile.title = item.name || "";
        tile.appendChild(span);
      } else if (state.tab === "recent" && item.kind === "emote") {
        const img = document.createElement("img");
        img.className = "btfw-emote-img";
        img.src = item.image || "";
        img.alt = item.name;
        img.onerror = () => { img.style.display="none"; tile.textContent=item.name; };
        tile.title = item.name;
        tile.appendChild(img);
      } else { // emotes
        const img = document.createElement("img");
        img.className = "btfw-emote-img";
        img.src = item.image || "";
        img.alt = item.name;
        img.onerror = () => { img.style.display="none"; tile.textContent=item.name; };
        tile.title = item.name;
        tile.appendChild(img);
      }

      tile.addEventListener("click", () => {
        if (!chatline) return;
        if (state.tab === "emoji" || item.kind === "emoji") {
          insertAtCursor(chatline, item.char + " ");
          pushRecent({kind:"emoji", char:item.char, name:item.name, keywords:item.keywords});
        } else {
          // channel emote: insert its "code" (BillTube2 inserted the name as-is)
          insertAtCursor(chatline, " " + item.name + " ");
          pushRecent({kind:"emote", name:item.name, image:item.image});
        }
        close();
      });

      frag.appendChild(tile);
    });

    grid.appendChild(frag);
    highlightActive();
  }

  function highlightActive() {
    const grid = $("#btfw-emotes-grid");
    Array.from(grid.children).forEach((el,i)=>el.classList.toggle("is-active", i===state.highlight));
  }

  function ensureVisible() {
    const grid = $("#btfw-emotes-grid");
    const active = grid.children[state.highlight];
    if (!active) return;
    const r = active.getBoundingClientRect();
    const gr = grid.getBoundingClientRect();
    if (r.top < gr.top)      grid.scrollTop -= (gr.top - r.top) + 8;
    else if (r.bottom > gr.bottom) grid.scrollTop += (r.bottom - gr.bottom) + 8;
  }

  // ---------- open/close ----------
  function open() {
    const m = ensureModal();
    loadChannelEmotes();
    loadRecent();
    state.tab = "emotes";
    state.search = "";
    state.highlight = 0;
    $("#btfw-emotes-search").value = "";
    // activate first tab
    $$(".btfw-emotes-tabs li").forEach(li => li.classList.toggle("is-active", li.getAttribute("data-tab")==="emotes"));
    render();
    m.classList.add("is-active");
    $("#btfw-emotes-grid").focus();
  }
  function close() { $("#btfw-emotes-modal")?.classList.remove("is-active"); }

  // ---------- wire buttons (bottom bar) ----------
  function bindOpeners(){
    const sels = ["#btfw-btn-emotes", ".btfw-btn-emotes"];
    sels.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        // remove legacy listeners
        el.removeAttribute("onclick");
        if (window.jQuery) { try { jQuery(el).off("click"); } catch(_){ } }
        const clone = el.cloneNode(true);
        el.parentNode.replaceChild(clone, el);
        clone.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); open(); }, {capture:true});
      });
    });
  }

  // ---------- boot ----------
  function boot(){
    bindOpeners();
    // optional: preload emoji quietly once
    setTimeout(()=>{ loadEmoji(); }, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:emotes", open, close, render };
});
