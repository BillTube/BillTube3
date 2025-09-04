
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
    return s;
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
    search: "",
    renderEpoch: 0               // cancels in-flight chunked renders
  };

  // Grid sizing logic (purely for keyboard nav calculations)
  const TILE_APPROX = 72;        // px per tile including gaps for estimating columns

  function gridCols(grid){
    const w = grid.clientWidth || 520;
    return Math.max(3, Math.floor(w / TILE_APPROX));
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
        {char:"🔥", name:"fire",                         keywords:"lit hot"},
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
    pop.className = "btfw-popover btfw-emotes-pop hidden";
    pop.innerHTML = `
      <div class="btfw-emotes-head">
        <div class="btfw-emotes-tabs">
          <button class="btfw-tab is-active" data-tab="emotes">Channel</button>
          <button class="btfw-tab" data-tab="emoji">Emoji</button>
          <button class="btfw-tab" data-tab="recent">Recent</button>
        </div>
        <div class="btfw-emotes-search">
          <input id="btfw-emotes-search" type="text" placeholder="Search…">
          <button id="btfw-emotes-clear" title="Clear">Clear</button>
        </div>
        <button class="btfw-emotes-close" title="Close">×</button>
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

    // Close button
    $(".btfw-emotes-close", pop).addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); close(); });

    // Keyboard navigation (full list)
    $("#btfw-emotes-grid", pop).addEventListener("keydown", ev=>{
      const grid = $("#btfw-emotes-grid");
      const total = grid.querySelectorAll(".btfw-emote-tile").length;
      if (!total) return;

      const cols = gridCols(grid);
      switch(ev.key){
        case "ArrowRight": state.highlight = Math.min(total-1, state.highlight+1); break;
        case "ArrowLeft":  state.highlight = Math.max(0, state.highlight-1);       break;
        case "ArrowDown":  state.highlight = Math.min(total-1, state.highlight + cols); break;
        case "ArrowUp":    state.highlight = Math.max(0, state.highlight - cols);       break;
        case "Enter": {
          const tile = grid.querySelector(`.btfw-emote-tile[data-index="${state.highlight}"]`);
          if (tile) tile.click();
          ev.preventDefault(); return;
        }
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

    // First position & fixed height
    positionPopover(true);

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
  const pop = document.getElementById("btfw-emotes-pop");
  if (!pop) return;
  if (window.BTFW_positionPopoverAboveChatBar) {
    window.BTFW_positionPopoverAboveChatBar(pop, {
      widthPx: 560,
      widthVw: 92,
      maxHpx: 480,
      maxHvh: 70
    });
  }
}




  function watchPosition(){
    const wrap   = document.getElementById("chatwrap") || document.body;
    const anchor = findBottomBar() || wrap;
    if (wrap._btfwEmoteWatch) return;
    wrap._btfwEmoteWatch = true;

    const onReflow = () => positionPopover(false);
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

  /* ------------------- render (chunked) ------------------- */
  function render(fromSearch){
    const grid = $("#btfw-emotes-grid"); if (!grid) return;

    // Filter entire list
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

    // Reset scroll & highlight on new search/tab
    if (fromSearch) {
      grid.scrollTop = 0;
      state.highlight = 0;
    }

    // Start a new render epoch (cancel any in-flight chunk)
    const epoch = ++state.renderEpoch;

    // Hard clear and start chunked build
    grid.innerHTML = "";
    const total = state.filtered.length;
    let i = 0;
    const CHUNK = 200;

    function makeTile(item, idxAbs){
      const tile = document.createElement("div");
      tile.className = "btfw-emote-tile";
      tile.setAttribute("data-index", String(idxAbs));

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

      return tile;
    }

    function step(){
      if (epoch !== state.renderEpoch) return; // canceled
      const frag = document.createDocumentFragment();
      const end = Math.min(total, i + CHUNK);
      for (; i < end; i++) {
        frag.appendChild(makeTile(state.filtered[i], i));
      }
      grid.appendChild(frag);

      // Let emoji-compat (Twemoji) parse the appended chunk
      document.dispatchEvent(new CustomEvent("btfw:emotes:rendered", { detail:{ container: grid } }));

      if (i < total) {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(step, { timeout: 50 });
        } else {
          setTimeout(step, 0);
        }
      } else {
        // Finalize selection styling
        highlightActive();
      }
    }

    step();
  }

  function highlightActive(){
    const grid = $("#btfw-emotes-grid");
    if (!grid) return;
    grid.querySelectorAll(".btfw-emote-tile.is-active").forEach(el => el.classList.remove("is-active"));
    const active = grid.querySelector(`.btfw-emote-tile[data-index="${state.highlight}"]`);
    if (active) active.classList.add("is-active");
  }

  function ensureVisible(){
    const grid = $("#btfw-emotes-grid");
    const active = grid && grid.querySelector(`.btfw-emote-tile[data-index="${state.highlight}"]`);
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

    btn.addEventListener("click", ev=>{
  ev.preventDefault(); ev.stopPropagation();
  const pop = document.getElementById("btfw-emotes-pop");
  (pop && !pop.classList.contains("hidden")) ? close() : open();
}, {capture:true});

  }

  function bindAnyExistingOpeners(){
    ["#btfw-btn-emotes", ".btfw-btn-emotes"].forEach(sel=>{
      document.querySelectorAll(sel).forEach(el=>{
        el.removeAttribute("onclick");
        if (window.jQuery) { try { jQuery(el).off("click"); } catch(_){} }
        const c = el.cloneNode(true);
el.parentNode.replaceChild(c, el);
c.addEventListener("click", ev=>{
  ev.preventDefault(); ev.stopPropagation();
  const pop = document.getElementById("btfw-emotes-pop");
  (pop && !pop.classList.contains("hidden")) ? close() : open();
}, {capture:true});
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
    positionPopover(true);            // compute fixed height once per open
    pop.classList.remove("hidden");
    render(true);
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
