/* BillTube Framework — feature:emotes (popover, optimized)
   - Compact popover anchored just above the chat bottom bar
   - Tabs: Channel / Emoji / Recent
   - Lazy emoji JSON load (only when Emoji tab is opened)
   - Debounced search
   - Virtualized grid (renders only visible rows + buffer)
   - Channel emote images: loading="lazy", decoding="async"
   - Removes legacy CyTube emote button; injects our own into the chat bottom bar
   - Dispatches "btfw:emotes:rendered" so emoji-compat (Twemoji) can parse visible window only
*/
BTFW.define("feature:emotes", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  /* ------------------------ helpers ------------------------ */
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

  // Ensure single-codepoint emoji render as emoji (VS16)
  function normalizeEmojiForInsert(s){
    if (/\uFE0F/.test(s)) return s;
    const cps = Array.from(s);
    if (cps.length === 1) return s + "\uFE0F";
    return s; // multi-codepoint ZWJ sequences are fine
  }

  function ensureChatwrapRelative(){
    const wrap = $("#chatwrap");
    if (wrap && getComputedStyle(wrap).position === "static") {
      wrap.style.position = "relative";
    }
  }

  /* ------------------------ state ------------------------- */
  const CHANNEL_NAME = (window.CHANNEL && window.CHANNEL.name) || "default";
  const RECENT_KEY   = `btfw:recent:emotes:${CHANNEL_NAME}`;

  let state = {
    tab: "emotes",                // "emotes" | "emoji" | "recent"
    list: { emotes: [], emoji: [], recent: [] },
    filtered: [],
    highlight: 0,
    emojiReady: false,
    search: ""
  };

  // Virtualization params
  const TILE_W    = 64;           // approx tile width incl. gap (for col calc)
  const ROW_H     = 64;           // row height (matches CSS grid-auto-rows)
  const BUF_ROWS  = 3;            // overscan rows above & below

  function gridCols(grid){
    const w = grid.clientWidth || 512;
    return Math.max(3, Math.floor(w / TILE_W));
  }

  /* ------------------------ data -------------------------- */
  function loadChannelEmotes(){
    const src = Array.isArray(window.CHANNEL?.emotes) ? window.CHANNEL.emotes : [];
    state.list.emotes = src
      .filter(x => x && x.name)
      .map(x => ({ name: x.name, image: x.image || "" }));
  }

  async function loadEmoji(){
    try {
      const raw = localStorage.getItem("btfw:emoji:cache");
      if (raw) {
        state.list.emoji = JSON.parse(raw);
        state.emojiReady = true;
        render(true);
        return;
      }
    } catch(_){}

    const url = "https://cdn.jsdelivr.net/npm/emoji.json@13.1.0/emoji.json";
    try {
      const res = await fetch(url, { cache: "force-cache" });
      const arr = await res.json();
      state.list.emoji = arr.map(e => ({
        char: e.char,
        name: (e.name || "").toLowerCase(),
        keywords: (e.keywords || "").toLowerCase()
      }));
      localStorage.setItem("btfw:emoji:cache", JSON.stringify(state.list.emoji));
    } catch(_) {
      state.list.emoji = [
        {char:"😀", name:"grinning face",                keywords:"smile happy"},
        {char:"😂", name:"face with tears of joy",       keywords:"laugh cry"},
        {char:"😍", name:"smiling face with heart-eyes", keywords:"love"},
        {char:"👍", name:"thumbs up",                    keywords:"like ok yes"},
        {char:"🔥", name:"fire",                          keywords:"lit hot"},
        {char:"🎉", name:"party popper",                 keywords:"celebrate confetti"},
      ];
    }
    state.emojiReady = true;
    render(true);
  }

  function loadRecent(){
    try { state.list.recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
    catch(_){ state.list.recent = []; }
  }

  function pushRecent(item){
    const key = item.kind === "emoji" ? item.char : item.name;
    state.list.recent = state.list.recent.filter(x => (x.kind==="emoji" ? x.char : x.name) !== key);
    state.list.recent.unshift(item);
    state.list.recent = state.list.recent.slice(0, 24);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(state.list.recent)); } catch(_){}
  }

  /* ------------------------ popover UI ------------------------ */
  function ensurePopover(){
    let pop = $("#btfw-emotes-pop");
    if (pop) return pop;

    ensureChatwrapRelative();

    pop = document.createElement("div");
    pop.id = "btfw-emotes-pop";
    pop.className = "btfw-emotes-pop hidden";
    pop.innerHTML = `
      <div class="btfw-emotes-head">
        <div class="btfw-emotes-tabs">
          <button class="btfw-tab is-active" data-tab="emotes">Channel</button>
          <button class="btfw-tab" data-tab="emoji">Emoji</button>
          <button class="btfw-tab" data-tab="recent">Recent</button>
        </div>
        <div class="btfw-emotes-search">
          <input id="btfw-emotes-search" type="text" placeholder="Search…">
          <button id="btfw-emotes-clear" title="Clear">×</button>
        </div>
      </div>
      <div id="btfw-emotes-grid" class="btfw-emotes-grid" tabindex="0" aria-label="Emote grid"></div>
    `;
    const wrap = $("#chatwrap") || document.body;
    wrap.appendChild(pop);

    // Tabs
    pop.querySelector(".btfw-emotes-tabs").addEventListener("click", ev=>{
      const btn = ev.target.closest(".btfw-tab");
      if (!btn) return;
      pop.querySelectorAll(".btfw-tab").forEach(x=>x.classList.toggle("is-active", x===btn));
      state.tab = btn.getAttribute("data-tab");
      state.search = ""; $("#btfw-emotes-search").value = "";
      if (state.tab === "emoji" && !state.emojiReady) loadEmoji();
      render(true);
      $("#btfw-emotes-grid").focus();
    });

    // Debounced search
    (function(){
      let t = 0;
      $("#btfw-emotes-search", pop).addEventListener("input", e=>{
        state.search = e.target.value.trim();
        clearTimeout(t);
        t = setTimeout(()=> render(true), 120);
      });
    })();
    $("#btfw-emotes-clear", pop).addEventListener("click", ()=>{
      state.search = ""; $("#btfw-emotes-search").value = "";
      render(true); $("#btfw-emotes-grid").focus();
    });

    // Keyboard navigation
    $("#btfw-emotes-grid", pop).addEventListener("keydown", ev=>{
      const grid = $("#btfw-emotes-grid");
      const count = grid._btfwWindowCount || 0;
      if (!count) return;

      // Track within the visible window; we map to absolute index in renderWindow()
      switch(ev.key){
        case "ArrowRight": state.highlight = Math.min(count-1, state.highlight+1); break;
        case "ArrowLeft":  state.highlight = Math.max(0, state.highlight-1);       break;
        case "ArrowDown": {
          const cols = gridCols(grid);
          state.highlight = Math.min(count-1, state.highlight + cols);
          break;
        }
        case "ArrowUp": {
          const cols = gridCols(grid);
          state.highlight = Math.max(0, state.highlight - cols);
          break;
        }
        case "Enter":
          const tile = grid.querySelector('.btfw-emote-tile[data-win-index="'+state.highlight+'"]');
          if (tile) tile.click();
          ev.preventDefault(); return;
        case "Escape": close(); return;
        default: return;
      }
      ev.preventDefault();
      highlightActive();
      ensureVisible();
    });

    // Click-outside to close
    document.addEventListener("click", (e)=>{
      if (pop.classList.contains("hidden")) return;
      const within = e.target.closest("#btfw-emotes-pop") || e.target.closest("#btfw-btn-emotes");
      if (!within) close();
    }, true);

    // First position
    positionPopover();

    // Bind virtualization scroll/resize once
    const grid = $("#btfw-emotes-grid", pop);
    if (!grid._btfwVirtBound){
      grid.addEventListener("scroll", renderWindow, {passive:true});
      window.addEventListener("resize", renderWindow);
      grid._btfwVirtBound = true;
    }

    return pop;
  }

  /* ------------------- anchoring & watchers ------------------- */
  function findBottomBar(){
    // Prefer custom bottom bar → fallback to CyTube controls → final fallback: input itself
    return document.getElementById("btfw-chat-bottombar")
        || document.getElementById("chatcontrols")
        || document.getElementById("chatline");
  }

  function positionPopover(){
    const pop    = document.getElementById("btfw-emotes-pop"); if (!pop) return;
    const wrap   = document.getElementById("chatwrap") || document.body;
    const anchor = findBottomBar() || wrap;

    if (wrap.id === "chatwrap" && getComputedStyle(wrap).position === "static") {
      wrap.style.position = "relative";
    }

    const margin     = 8;
    const wrapRect   = wrap.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();

    // Distance from anchor top to wrap bottom, plus gap
    let bottomPx = Math.round((wrapRect.bottom - anchorRect.top) + margin);

    // If anchored to wrap or weird value, pick a reasonable default
    if (anchor === wrap || !isFinite(bottomPx) || bottomPx <= 0) bottomPx = 56;

    // Clamp within the chat wrapper
    bottomPx = Math.max(8, Math.min(bottomPx, (wrap.clientHeight || 480) - 48));

    // Width / height within chat column
    const maxWidth = Math.min(560, Math.max(320, (wrap.clientWidth || window.innerWidth) - 24));
    pop.style.right     = "8px";
    pop.style.bottom    = bottomPx + "px";
    pop.style.width     = maxWidth + "px";

    const maxH = Math.max(240, Math.min(480, (wrap.clientHeight || (window.innerHeight - 120)) - (bottomPx + 40)));
    pop.style.maxHeight = maxH + "px";
  }

  function watchPosition(){
    const wrap   = document.getElementById("chatwrap") || document.body;
    const anchor = findBottomBar() || wrap;
    if (wrap._btfwEmoteWatch) return;
    wrap._btfwEmoteWatch = true;

    const onReflow = () => positionPopover();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(onReflow);
      ro.observe(wrap);
      if (anchor && anchor !== wrap) ro.observe(anchor);
      wrap._btfwEmoteRO = ro;
    } else {
      const mo = new MutationObserver(onReflow);
      mo.observe(wrap, { attributes:true, childList:true, subtree:true });
      if (anchor && anchor !== wrap) mo.observe(anchor, { attributes:true, childList:true, subtree:true });
      wrap._btfwEmoteMO = mo;
    }
  }

  /* ------------------- render (virtualized) ------------------- */
  function render(fromSearch){
    const grid = $("#btfw-emotes-grid"); if (!grid) return;

    const q = (state.search || "").toLowerCase();
    if (state.tab === "emotes") {
      state.filtered = q ? state.list.emotes.filter(x => x.name.toLowerCase().includes(q)) : state.list.emotes;
    } else if (state.tab === "emoji") {
      state.filtered = q ? state.list.emoji.filter(x => x.name.includes(q) || x.keywords.includes(q)) : state.list.emoji;
    } else {
      state.filtered = q
        ? state.list.recent.filter(x => x.kind==="emoji"
            ? (x.char+(x.name||"")+(x.keywords||"")).toLowerCase().includes(q)
            : (x.name||"").toLowerCase().includes(q))
        : state.list.recent;
    }

    if (fromSearch) grid.scrollTop = 0;

    renderWindow(); // draw current visible window
  }

  function renderWindow(){
    const grid = $("#btfw-emotes-grid"); if (!grid) return;

    const cols   = gridCols(grid);
    const total  = state.filtered.length;
    const vh     = grid.clientHeight || 320;
    const st     = grid.scrollTop || 0;

    const firstRow = Math.max(0, Math.floor(st / ROW_H) - BUF_ROWS);
    const visRows  = Math.ceil(vh / ROW_H) + BUF_ROWS * 2;
    const lastRow  = Math.min(Math.ceil(total / cols), firstRow + visRows);

    const start = firstRow * cols;
    const end   = Math.min(total, lastRow * cols);

    const frag = document.createDocumentFragment();

    // top spacer
    const topPad = document.createElement("div");
    topPad.style.height = (firstRow * ROW_H) + "px";
    topPad.style.width  = "1px";
    frag.appendChild(topPad);

    let winIndex = 0; // visible window index so keyboard nav can find tiles
    for (let i=start; i<end; i++, winIndex++){
      const item = state.filtered[i];
      const tile = document.createElement("div");
      tile.className = "btfw-emote-tile";
      tile.setAttribute("data-abs-index", String(i));
      tile.setAttribute("data-win-index", String(winIndex));

      if (state.tab==="emoji" || item.kind==="emoji") {
        const span = document.createElement("span");
        span.className = "btfw-emoji";
        span.textContent = item.char;
        tile.title = item.name || "";
        tile.appendChild(span);
      } else {
        const img = document.createElement("img");
        img.className = "btfw-emote-img";
        img.src = item.image || "";
        img.alt = item.name;
        img.loading = "lazy";
        img.decoding = "async";
        img.onerror = ()=>{ img.style.display="none"; tile.textContent = item.name; };
        tile.title = item.name;
        tile.appendChild(img);
      }

      tile.addEventListener("click", ()=>{
        const input = $("#chatline"); if (!input) return;
        if (state.tab==="emoji" || item.kind==="emoji") {
          insertAtCursor(input, normalizeEmojiForInsert(item.char) + " ");
          pushRecent({kind:"emoji", char:item.char, name:item.name, keywords:item.keywords});
        } else {
          insertAtCursor(input, " " + item.name + " ");
          pushRecent({kind:"emote", name:item.name, image:item.image});
        }
        close();
      });

      frag.appendChild(tile);
    }

    // bottom spacer
    const totalRows = Math.ceil(total / cols);
    const bottomPad = document.createElement("div");
    bottomPad.style.height = Math.max(0, (totalRows - lastRow) * ROW_H) + "px";
    bottomPad.style.width  = "1px";
    frag.appendChild(bottomPad);

    grid.innerHTML = "";
    grid.appendChild(frag);

    // update count for keyboard nav in this window
    grid._btfwWindowCount = Math.max(0, end - start);

    // keep highlight within visible window bounds
    state.highlight = Math.max(0, Math.min(state.highlight, grid._btfwWindowCount - 1));
    highlightActive();

    // Let emoji-compat (Twemoji) parse only the visible window
    document.dispatchEvent(new CustomEvent("btfw:emotes:rendered", { detail:{ container: grid } }));
  }

  function highlightActive(){
    const grid = $("#btfw-emotes-grid");
    if (!grid) return;
    const tiles = grid.querySelectorAll(".btfw-emote-tile");
    tiles.forEach(el => el.classList.remove("is-active"));
    const active = grid.querySelector('.btfw-emote-tile[data-win-index="'+state.highlight+'"]');
    if (active) active.classList.add("is-active");
  }

  function ensureVisible(){
    const grid = $("#btfw-emotes-grid");
    const active = grid && grid.querySelector('.btfw-emote-tile[data-win-index="'+state.highlight+'"]');
    if (!grid || !active) return;
    const r  = active.getBoundingClientRect();
    const gr = grid.getBoundingClientRect();
    if (r.top < gr.top)      grid.scrollTop -= (gr.top - r.top) + 8;
    else if (r.bottom > gr.bottom) grid.scrollTop += (r.bottom - gr.bottom) + 8;
  }

  /* --------------------- buttons ---------------------- */
  function removeLegacyButtons(){
    const sels = [
      "#emotelistbtn", "#emotelist", "#emote-list", "#emote-btn",
      'button[title*="Emote"]', 'button[onclick*="emote"]'
    ];
    sels.forEach(sel => $$(sel).forEach(el => el.remove()));
  }

  function findBottomBarContainer(){
    return document.getElementById("btfw-chat-bottombar")
        || document.querySelector("#chatcontrols .input-group-btn")
        || document.getElementById("chatcontrols")
        || document.getElementById("chatwrap");
  }

  function ensureOurButton(){
    if ($("#btfw-btn-emotes")) return;
    const bar = findBottomBarContainer(); if (!bar) return;

    const btn = document.createElement("button");
    btn.id = "btfw-btn-emotes";
    btn.type = "button";
    btn.className = "button is-dark is-small btfw-chatbtn btfw-btn-emotes";
    btn.innerHTML = (window.FontAwesome || document.querySelector('.fa'))
      ? '<i class="fa fa-smile" aria-hidden="true"></i>'
      : '<span aria-hidden="true">🙂</span>';
    btn.title = "Emotes / Emoji";

    // place before GIF button if present
    const gifBtn = bar.querySelector("#btfw-btn-gif, .btfw-btn-gif");
    if (gifBtn && gifBtn.parentNode) gifBtn.parentNode.insertBefore(btn, gifBtn);
    else bar.appendChild(btn);

    btn.addEventListener("click", ev=>{ ev.preventDefault(); ev.stopPropagation(); open(); }, {capture:true});
  }

  function bindAnyExistingOpeners(){
    ["#btfw-btn-emotes", ".btfw-btn-emotes"].forEach(sel=>{
      document.querySelectorAll(sel).forEach(el=>{
        el.removeAttribute("onclick");
        if (window.jQuery) { try { jQuery(el).off("click"); } catch(_){} }
        const c = el.cloneNode(true);
        el.parentNode.replaceChild(c, el);
        c.addEventListener("click", ev=>{ ev.preventDefault(); ev.stopPropagation(); open(); }, {capture:true});
      });
    });
  }

  /* ------------------- open / close / boot ------------------- */
  function open(){
    const pop = ensurePopover();
    loadChannelEmotes();
    loadRecent();
    state.tab="emotes"; state.search=""; state.highlight=0;
    $("#btfw-emotes-search").value = "";
    // activate correct tab styling
    pop.querySelectorAll(".btfw-tab").forEach(b=>b.classList.toggle("is-active", b.getAttribute("data-tab")==="emotes"));
    render(true);
    positionPopover();
    pop.classList.remove("hidden");
    $("#btfw-emotes-grid").focus();
  }

  function close(){ $("#btfw-emotes-pop")?.classList.add("hidden"); }

  function boot(){
    removeLegacyButtons();
    ensureOurButton();
    bindAnyExistingOpeners();
    watchPosition();
    // NO warm-up emoji fetch; loads on first Emoji tab open
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:emotes", open, close, render, positionPopover };
});
