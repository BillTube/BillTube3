/* BillTube Framework — feature:emotes
   Channel Emotes + Emoji picker (Bulma modal), with search & recently-used.
   Also cleans up the legacy CyTube "Emote List" button and injects our own.
*/
BTFW.define("feature:emotes", [], async () => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$= (s, r=document) => Array.from(r.querySelectorAll(s));

  function insertAtCursor(textarea, text) {
    textarea.focus();
    const s = textarea.selectionStart ?? textarea.value.length;
    const e = textarea.selectionEnd   ?? textarea.value.length;
    const before = textarea.value.slice(0, s);
    const after  = textarea.value.slice(e);
    textarea.value = before + text + after;
    const pos = before.length + text.length;
    textarea.selectionStart = textarea.selectionEnd = pos;
    textarea.dispatchEvent(new Event("input", {bubbles:true}));
  }

  const chatline = $("#chatline");
  const CHANNEL_NAME = (window.CHANNEL && window.CHANNEL.name) || "default";
  const RECENT_KEY   = `btfw:recent:emotes:${CHANNEL_NAME}`;

  let state = {
    tab: "emotes",
    list: { emotes: [], emoji: [], recent: [] },
    filtered: [],
    highlight: 0,
    emojiReady: false,
    search: ""
  };

  /* -------------------------------------------------- UI: modal -------------------------------------------------- */
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
          <button class="button is-link" id="btfw-emotes-close">Close</button>
        </footer>
      </div>
    `;
    document.body.appendChild(m);

    // elevated z-index & grid styles
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
        gap: 8px; overflow: auto;
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
      html.btfw-dark .btfw-emote-tile { background:#1a2230; border-color:rgba(255,255,255,.10); }
      html.btfw-dark .btfw-emote-tile:hover { background:#202a3a; }
      /* Button look (if FA missing, we show text) */
      .btfw-btn-emotes { display:inline-flex; align-items:center; gap:6px; }
      .btfw-btn-emotes .btfw-ico { font-size:14px; line-height:1; }
    `;
    document.head.appendChild(css);

    // close actions
    $(".delete", m).addEventListener("click", close);
    $(".modal-background", m).addEventListener("click", close);
    $("#btfw-emotes-close", m).addEventListener("click", close);

    // tabs
    $(".btfw-emotes-tabs ul", m).addEventListener("click", (ev)=>{
      const li = ev.target.closest("li[data-tab]");
      if (!li) return;
      $$(".btfw-emotes-tabs li", m).forEach(x => x.classList.toggle("is-active", x===li));
      state.tab = li.getAttribute("data-tab");
      state.search = ""; $("#btfw-emotes-search").value = "";
      render();
      if (state.tab === "emoji" && !state.emojiReady) loadEmoji();
    });

    // search
    $("#btfw-emotes-search", m).addEventListener("input", (e)=>{
      state.search = e.target.value.trim();
      render();
    });
    $("#btfw-emotes-clear", m).addEventListener("click", ()=>{
      state.search = ""; $("#btfw-emotes-search").value = ""; render();
    });

    // keyboard navigation
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
          const tile = grid.children[state.highlight]; tile && tile.click();
          ev.preventDefault(); return;
        case "Escape": close(); return;
        default: return;
      }
      ev.preventDefault();
      highlightActive(); ensureVisible();
    });

    return m;
  }

  /* ----------------------------------------------- data ----------------------------------------------- */
  function loadChannelEmotes() {
    const list = Array.isArray(window.CHANNEL?.emotes) ? window.CHANNEL.emotes : [];
    state.list.emotes = list.filter(x => x && x.name)
                            .map(x => ({ name: x.name, image: x.image || "" }));
  }

  async function loadEmoji() {
    try {
      const raw = localStorage.getItem("btfw:emoji:cache");
      if (raw) {
        state.list.emoji = JSON.parse(raw);
        state.emojiReady = true; render(); return;
      }
    } catch(_){}

    const url = "https://cdn.jsdelivr.net/npm/emoji.json@13.1.0/emoji.json";
    try {
      const res = await fetch(url, {cache:"force-cache"});
      const arr = await res.json();
      state.list.emoji = arr.map(e => ({
        char: e.char, name: (e.name || "").toLowerCase(),
        keywords: (e.keywords || "").toLowerCase()
      }));
      localStorage.setItem("btfw:emoji:cache", JSON.stringify(state.list.emoji));
    } catch(_) {
      state.list.emoji = [
        {char:"😀", name:"grinning face", keywords:"smile happy"},
        {char:"😂", name:"face with tears of joy", keywords:"laugh cry"},
        {char:"😍", name:"smiling face with heart-eyes", keywords:"love"},
        {char:"👍", name:"thumbs up", keywords:"like yes ok"},
        {char:"🔥", name:"fire", keywords:"lit hot"},
        {char:"🎉", name:"party popper", keywords:"celebrate confetti"},
      ];
    }
    state.emojiReady = true; render();
  }

  function loadRecent() {
    try { state.list.recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
    catch(_){ state.list.recent = []; }
  }
  function pushRecent(item) {
    const key = item.kind === "emoji" ? item.char : item.name;
    state.list.recent = state.list.recent.filter(x => (x.kind==="emoji"?x.char:x.name)!==key);
    state.list.recent.unshift(item); state.list.recent = state.list.recent.slice(0, 24);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(state.list.recent)); } catch(_){}
  }

  /* ----------------------------------------------- render ---------------------------------------------- */
  function filterLists() {
    const q = state.search.toLowerCase();
    if (state.tab === "emotes") {
      state.filtered = q ? state.list.emotes.filter(x => x.name.toLowerCase().includes(q)) : state.list.emotes;
    } else if (state.tab === "emoji") {
      state.filtered = q ? state.list.emoji.filter(x => x.name.includes(q) || x.keywords.includes(q)) : state.list.emoji;
    } else {
      state.filtered = q ? state.list.recent.filter(x =>
        x.kind==="emoji" ? (x.char+(x.name||"")+(x.keywords||"")).toLowerCase().includes(q)
                         : (x.name||"").toLowerCase().includes(q)
      ) : state.list.recent;
    }
  }

  function render() {
    const grid = $("#btfw-emotes-grid"); if (!grid) return;
    filterLists(); grid.innerHTML = ""; state.highlight = 0;

    const frag = document.createDocumentFragment();
    state.filtered.forEach(item => {
      const tile = document.createElement("div");
      tile.className = "btfw-emote-tile";

      if (state.tab==="emoji" || item.kind==="emoji") {
        const span = document.createElement("span");
        span.className = "btfw-emoji"; span.textContent = item.char;
        tile.title = item.name || ""; tile.appendChild(span);
      } else {
        const img = document.createElement("img");
        img.className = "btfw-emote-img"; img.src = item.image || ""; img.alt = item.name;
        img.onerror = ()=>{ img.style.display="none"; tile.textContent = item.name; };
        tile.title = item.name; tile.appendChild(img);
      }

      tile.addEventListener("click", () => {
        const input = $("#chatline"); if (!input) return;
        if (state.tab==="emoji" || item.kind==="emoji") {
          insertAtCursor(input, item.char + " ");
          pushRecent({kind:"emoji", char:item.char, name:item.name, keywords:item.keywords});
        } else {
          insertAtCursor(input, " " + item.name + " ");
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
    const a = grid.children[state.highlight]; if (!a) return;
    const r = a.getBoundingClientRect(), gr = grid.getBoundingClientRect();
    if (r.top < gr.top) grid.scrollTop -= (gr.top - r.top) + 8;
    else if (r.bottom > gr.bottom) grid.scrollTop += (r.bottom - gr.bottom) + 8;
  }

  /* --------------------------------------- open / close & button --------------------------------------- */
  function open() {
    const m = ensureModal();
    loadChannelEmotes(); loadRecent();
    state.tab="emotes"; state.search=""; state.highlight=0;
    $("#btfw-emotes-search").value = ""; 
    $$(".btfw-emotes-tabs li").forEach(li => li.classList.toggle("is-active", li.getAttribute("data-tab")==="emotes"));
    render(); m.classList.add("is-active"); $("#btfw-emotes-grid").focus();
  }
  function close(){ $("#btfw-emotes-modal")?.classList.remove("is-active"); }

  function findBottomBar(){
    return $("#btfw-chat-bottombar")
        || $("#chatwrap .btfw-chat-bottombar")
        || $("#chatcontrols .input-group-btn")
        || $("#chatcontrols")
        || $("#chatwrap");
  }

  function removeLegacyButtons(){
    const sels = [
      "#emotelistbtn", "#emotelist", "#emote-list", "#emote-btn",
      'button[title*="Emote"]', 'button[onclick*="emote"]'
    ];
    sels.forEach(sel => $$(sel).forEach(el => el.remove()));
  }

  function injectOurButton(){
    if ($("#btfw-btn-emotes")) return;
    const container = findBottomBar(); if (!container) return;

    const btn = document.createElement("button");
    btn.id = "btfw-btn-emotes";
    btn.type = "button";
    btn.className = "button is-dark is-small btfw-chatbtn btfw-btn-emotes";
    // Use FA icon if available, else fallback glyph
    btn.innerHTML = (window.FontAwesome || document.querySelector('.fa')) 
      ? '<i class="fa fa-smile btfw-ico" aria-hidden="true"></i>'
      : '<span class="btfw-ico" aria-hidden="true">🙂</span>';
    btn.title = "Emotes / Emoji";

    // wipe any legacy listeners (safety) then attach ours
    btn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); open(); }, {capture:true});

    // put it just before GIF button if present, else at end
    const gifBtn = container.querySelector("#btfw-btn-gif, .btfw-btn-gif");
    if (gifBtn && gifBtn.parentNode) gifBtn.parentNode.insertBefore(btn, gifBtn);
    else container.appendChild(btn);
  }

  function bindAnyExistingOpeners(){
    ["#btfw-btn-emotes", ".btfw-btn-emotes"].forEach(sel => {
      document.querySelectorAll(sel).forEach(el=>{
        el.removeAttribute("onclick");
        if (window.jQuery) { try { jQuery(el).off("click"); } catch(_){ } }
        const c = el.cloneNode(true); el.parentNode.replaceChild(c, el);
        c.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); open(); }, {capture:true});
      });
    });
  }

  /* ---------------------------------------------- boot ------------------------------------------------- */
  function boot(){
    removeLegacyButtons();
    injectOurButton();
    bindAnyExistingOpeners();
    // warm up emoji cache silently
    setTimeout(()=>{ loadEmoji(); }, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:emotes", open, close, render };
});
