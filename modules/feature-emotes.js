
BTFW.define("feature:emotes", ["util:chat-popover"], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const motion = await BTFW.init("util:motion");
  const chatPopover = await BTFW.init("util:chat-popover");
  const anime = await BTFW.init("util:anime");

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
    if (/️/.test(s)) return s;
    const cps = Array.from(s);
    if (cps.length === 1) return s + "️";
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
    tab: "emotes",                // "emotes" | "emoji" | "recent" | "pack:<key>"
    list: { emotes: [], emoji: [], recent: [] },
    packs: [],                    // [{key,label,emotes:[{name,image,token}]}] from feature:emote-marketplace
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

  // The Emoji tab uses Google's Noto Animated Emoji (Apache-2.0): animated WebP
  // served from the gstatic CDN, inserted into chat as [ae]<codepoint>[/ae]
  // tokens that the BillTube chat filters render as images for everyone.
  const NOTO_META = "https://googlefonts.github.io/noto-emoji-animation/data/api.json";
  const NOTO_CDN  = "https://fonts.gstatic.com/s/e/notoemoji/latest";
  // `%5F` is an encoded underscore. It reaches the Noto CDN as `_`, but does
  // not collide with CyTube's `_text_` italic chat filter while the token is
  // processed server-side.
  const NOTO_CACHE = "btfw:emoji:noto:v3";

  function animatedEmojiToken(cp){
    return `[ae]${String(cp).replace(/_/g, "%5F")}[/ae]`;
  }

  function normalizeAnimatedEmojiToken(token){
    return String(token || "").replace(/\[ae\]([0-9a-f_]+)\[\/ae\]/gi,
      (_, cp) => animatedEmojiToken(cp));
  }

  async function loadEmoji(){
    try {
      const raw = localStorage.getItem(NOTO_CACHE);
      if (raw) {
        state.list.emoji = JSON.parse(raw);
        state.emojiReady = true;
        render(true);
        return;
      }
    } catch(_){}

    // image = static PNG (shown in the picker by default), imageAnim = animated
    // WebP (swapped in on hover). Chat always renders the animated WebP.
    const mk = (cp, name) => ({ name, keywords: name, image: `${NOTO_CDN}/${cp}/512.png`, imageAnim: `${NOTO_CDN}/${cp}/512.webp`, token: animatedEmojiToken(cp) });
    try {
      const res = await fetch(NOTO_META, { cache: "force-cache" });
      const data = await res.json();
      const icons = Array.isArray(data.icons) ? data.icons : [];
      // api.json is ordered by popularity; keep that order so common emoji lead.
      state.list.emoji = icons.map(e => {
        const cp = String(e.codepoint);
        const tag0 = (e.tags && e.tags[0]) ? e.tags[0].replace(/:/g, "").replace(/[-_]+/g, " ").trim() : cp;
        const kw = ((e.tags || []).join(" ") + " " + (e.categories || []).join(" ")).replace(/:/g, " ").toLowerCase();
        return { name: tag0.toLowerCase(), keywords: kw, image: `${NOTO_CDN}/${cp}/512.png`, imageAnim: `${NOTO_CDN}/${cp}/512.webp`, token: animatedEmojiToken(cp) };
      }).filter(x => x.token);
      try { localStorage.setItem(NOTO_CACHE, JSON.stringify(state.list.emoji)); } catch(_){}
    } catch(_) {
      state.list.emoji = [
        mk("1f600","grinning face"), mk("1f602","face with tears of joy"),
        mk("1f60d","smiling face with heart eyes"), mk("1f44d","thumbs up"),
        mk("1f525","fire"), mk("1f389","party popper")
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
  // Built on the shared util:chat-popover — same open/close, positioning,
  // live-resize re-fit, click-outside and Escape as the other mini popovers.
  // The card keeps its legacy #btfw-emotes-pop id so all existing CSS + the
  // internal #btfw-emotes-grid / #btfw-emotes-search selectors keep working.
  let _emotesPop = null;
  function getPopover(){
    if (_emotesPop) return _emotesPop;
    _emotesPop = chatPopover.create({
      id: "btfw-emotes-modal",
      cardClass: "btfw-emotes-pop",
      parent: () => $("#chatwrap") || document.body,
      once: true,
      // Matches the legacy positionPopover sizing; helper caps width to the chat.
      opts: { widthPx: 530, widthVw: 92, maxHpx: 480, maxHvh: 70 },
      // Clicking the emotes button must not count as an outside click.
      toggleSelector: "#btfw-btn-emotes, .btfw-btn-emotes",
      build: () => `
        <div id="btfw-emotes-pop" class="btfw-emotes-pop">
          <div class="btfw-emotes-head">
            <span class="btfw-emotes-title">Emotes</span>
            <button class="btfw-emotes-close" data-btfw-popover-close title="Close" aria-label="Close">×</button>
          </div>
          <div class="btfw-emotes-tabs">
            <button class="btfw-tab is-active" data-tab="emotes">Channel</button>
            <button class="btfw-tab" data-tab="emoji">Emoji</button>
            <button class="btfw-tab" data-tab="recent">Recent</button>
          </div>
          <div class="btfw-emotes-search">
            <input id="btfw-emotes-search" type="search" placeholder="Search…" autocomplete="off" />
            <button id="btfw-emotes-clear" class="btfw-emotes-clear" type="button" title="Clear search" aria-label="Clear search" aria-hidden="true" tabindex="-1">×</button>
          </div>
          <div id="btfw-emotes-grid" class="btfw-emotes-grid" tabindex="0" aria-label="Emote grid"></div>
        </div>`,
      onOpen: () => {
        const pop = _emotesPop.getCard();
        if (anime && anime.load) anime.load(); // warm anime.js for tab-switch staggers
        loadChannelEmotes();
        loadRecent();
        state.tab = "emotes"; state.search = ""; state.highlight = 0;
        const si = $("#btfw-emotes-search"); if (si) si.value = "";
        pop?._btfwSyncSearchClear?.();
        pop?.querySelectorAll(".btfw-tab").forEach(b =>
          b.classList.toggle("is-active", b.getAttribute("data-tab") === "emotes"));
        syncPackTabs(pop);
        render(true);
        // focusGrid runs from open() once the popover is actually visible —
        // onOpen fires before util:motion flips the card visible.
      }
    });
    return _emotesPop;
  }

  // Build the card (once) and wire its internal controls (once).
  function ensurePopover(){
    const api = getPopover();
    api.ensure();
    const pop = api.getCard();
    if (pop && !pop._btfwWired) wireCard(pop);
    return pop;
  }

  function wireCard(pop){
    pop._btfwWired = true;
    ensureChatwrapRelative();

    const gridEl = pop.querySelector("#btfw-emotes-grid");
    if (gridEl) {
      gridEl.setAttribute("data-twemoji-skip", "true");
      gridEl.classList.add("btfw-emoji-grid--native");
    }

    const syncSearchClear = ()=>{
      const input = $("#btfw-emotes-search", pop);
      const btn   = $("#btfw-emotes-clear", pop);
      if (!input || !btn) return;
      const hasValue = input.value.length > 0;
      btn.classList.toggle("is-visible", hasValue);
      btn.setAttribute("aria-hidden", hasValue ? "false" : "true");
      btn.tabIndex = hasValue ? 0 : -1;
    };

    // Tabs
    pop.querySelector(".btfw-emotes-tabs").addEventListener("click", ev=>{
      const btn = ev.target.closest(".btfw-tab");
      if (!btn) return;
      pop.querySelectorAll(".btfw-tab").forEach(x=>x.classList.toggle("is-active", x===btn));
      state.tab = btn.getAttribute("data-tab");
      state.search = ""; $("#btfw-emotes-search").value = "";
      syncSearchClear();
      if (state.tab === "emoji" && !state.emojiReady) loadEmoji();
      render(true);
      playTabIn($("#btfw-emotes-grid", pop)); // smooth fade/slide on tab switch
      focusGrid();
    });

    // Debounced search
    (function(){
      let t = 0;
      $("#btfw-emotes-search", pop).addEventListener("input", e=>{
        state.search = e.target.value.trim();
        syncSearchClear();
        clearTimeout(t);
        t = setTimeout(()=> render(true), 120);
      });
    })();
    $("#btfw-emotes-clear", pop).addEventListener("click", ()=>{
      state.search = ""; $("#btfw-emotes-search").value = "";
      syncSearchClear();
      render(true); focusGrid();
    });

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

    pop._btfwSyncSearchClear = syncSearchClear;
    syncSearchClear();
  }

  // Build/refresh a tab per loaded emote pack (from feature:emote-marketplace).
  // Called on open and whenever packs change — so packs appear/disappear live.
  function syncPackTabs(pop){
    pop = pop || (_emotesPop && _emotesPop.getCard && _emotesPop.getCard());
    if (!pop) return;
    const tabsEl = pop.querySelector(".btfw-emotes-tabs");
    if (!tabsEl) return;

    const packs = Array.isArray(window.BTFW_EMOTE_PACKS) ? window.BTFW_EMOTE_PACKS : [];
    state.packs = packs;

    // Reconcile tab buttons with the current packs (keep, add, remove).
    const wanted = new Set(packs.map(p => p.key));
    tabsEl.querySelectorAll(".btfw-tab[data-pack]").forEach(b => {
      if (!wanted.has(b.getAttribute("data-pack"))) b.remove();
    });
    packs.forEach(p => {
      let b = tabsEl.querySelector(`.btfw-tab[data-pack="${CSS.escape(p.key)}"]`);
      if (!b) {
        b = document.createElement("button");
        b.className = "btfw-tab";
        b.setAttribute("data-tab", "pack:" + p.key);
        b.setAttribute("data-pack", p.key);
        tabsEl.appendChild(b);
      }
      b.textContent = p.label;
    });

    // If the active tab was a pack that's now gone, fall back to Channel.
    if (state.tab.indexOf("pack:") === 0 && !wanted.has(state.tab.slice(5))) {
      state.tab = "emotes";
    }
    tabsEl.querySelectorAll(".btfw-tab").forEach(x =>
      x.classList.toggle("is-active", x.getAttribute("data-tab") === state.tab));
  }

  // Reveal the grid on a tab switch: a staggered tile cascade once anime.js is
  // warm, otherwise the instant CSS container fade (also the reduced-motion path).
  function playTabIn(el){
    if (!el) return;
    if (window.anime && window.anime.animate && anime && !anime.reducedMotion()) {
      anime.staggerIn(el.querySelectorAll(".btfw-emote-tile"), { max: 48, stagger: 12, dy: 8, duration: 340 });
      return;
    }
    el.classList.remove("btfw-tab-in");
    void el.offsetWidth; // force reflow so the animation restarts every switch
    el.classList.add("btfw-tab-in");
  }

  function focusGrid(preventScroll = true){
    const grid = document.getElementById("btfw-emotes-grid");
    if (!grid || typeof grid.focus !== "function") return;
    if (preventScroll) {
      try {
        grid.focus({ preventScroll: true });
        return;
      } catch(_) {}
    }
    try { grid.focus(); } catch(_) {}
  }

  /* ------------------- anchoring ------------------- */
  function findBottomBar(){
    // Prefer custom bottom bar → fallback to CyTube controls → final fallback: input itself
    return document.getElementById("btfw-chat-bottombar")
        || document.getElementById("chatcontrols")
        || document.getElementById("chatline");
  }

  // Kept as an exported convenience; the open/resize re-fit is now driven by
  // util:chat-popover (registry + chat-column watcher).
  function positionPopover(){
    const pop = document.getElementById("btfw-emotes-pop");
    if (!pop) return;
    if (window.BTFW_positionPopoverAboveChatBar) {
      window.BTFW_positionPopoverAboveChatBar(pop, {
        widthPx: 530,
        widthVw: 92,
        maxHpx: 480,
        maxHvh: 70
      });
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
    } else if (state.tab.indexOf("pack:") === 0) {
      const pack = state.packs.find(p => ("pack:" + p.key) === state.tab);
      const items = pack ? pack.emotes : [];
      state.filtered = q ? items.filter(x => (x.name || "").toLowerCase().includes(q)) : items;
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

      if (item.char) {
        // Native unicode emoji (legacy entries / older "recent" items).
        tile.classList.add("btfw-emote-tile--emoji");
        tile.dataset.kind = "emoji";
        tile.setAttribute("aria-label", item.name || item.char || "Emoji");
        tile.dataset.emoji = item.char;
        const span = document.createElement("span");
        span.className = "btfw-emoji";
        span.textContent = item.char;
        span.setAttribute("aria-hidden", "true");
        tile.title = item.name || "";
        tile.appendChild(span);
      } else {
        tile.classList.add("btfw-emote-tile--emote");
        tile.dataset.kind = "emote";
        // Token-bearing tiles (marketplace packs + Noto animated emoji) get the
        // smaller capped size so they don't dwarf native channel emotes.
        if (item.token) tile.classList.add("btfw-emote-tile--pack");
        const img = document.createElement("img");
        img.className = "btfw-emote-img";
        img.src = item.image || "";
        img.alt = item.name;
        img.loading = "lazy";
        img.decoding = "async";
        img.onerror = ()=>{ img.style.display="none"; tile.textContent = item.name; };
        tile.title = item.name;
        tile.setAttribute("aria-label", item.name || "Emote");
        // Animated emoji (and anything with a separate animated source) show a
        // static frame in the grid and only animate on hover — keeps 800+ tiles
        // calm, like the Noto example page.
        if (item.imageAnim) {
          tile.classList.add("btfw-emote-tile--hover-anim");
          tile.addEventListener("mouseenter", ()=>{ img.src = item.imageAnim; });
          tile.addEventListener("mouseleave", ()=>{ img.src = item.image; });
        }
        tile.appendChild(img);
      }

      tile.addEventListener("click", ()=>{
        const input = $("#chatline"); if (!input) return;
        if (item.char) {
          insertAtCursor(input, normalizeEmojiForInsert(item.char) + " ");
          pushRecent({kind:"emoji", char:item.char, name:item.name, keywords:item.keywords});
        } else if (item.token) {
          // Pack emote / animated emoji — insert the short token; the chat
          // filters render it as an image for everyone.
          const token = normalizeAnimatedEmojiToken(item.token);
          insertAtCursor(input, " " + token + " ");
          pushRecent({kind:"pack", name:item.name, image:item.image, imageAnim:item.imageAnim, token});
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
      toggle();
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
          toggle();
        }, {capture:true});
      });
    });
  }

  /* ------------------- open / close / boot ------------------- */
  function open(){
    ensurePopover();
    getPopover().open();
    // util:motion sets the card to "opening" (visibility:visible) synchronously,
    // so the grid is focusable by the time open() returns.
    focusGrid();
  }

  function close(){
    if (_emotesPop) _emotesPop.close();
  }

  function toggle(){
    ensurePopover();
    getPopover().isOpen() ? close() : open();
  }

  /* ---------------- inline :emote autocomplete ----------------
     Type ":xx" (2+ chars after a colon at a word start) in the chat line to
     get a completion popup: channel emotes first, then marketplace pack
     emotes, then animated emoji (only if their list is already loaded — the
     autocomplete never triggers a network fetch). Up/Down navigate,
     Tab/Enter accept, Escape closes. The keydown handler runs in the CAPTURE
     phase on document so it beats CyTube's own Enter-to-send handler while
     the popup is open. */
  const AC_MAX = 8;
  const ac = { box: null, items: [], index: 0, start: -1, open: false, dirty: true, lastChannelCount: -1, suppress: false, index_: null };

  function acBuildIndex(){
    const out = [];
    const seen = new Set();
    const push = (name, image, insert, hint) => {
      if (!name || !insert) return;
      const key = name.toLowerCase() + "|" + insert;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ name, lower: name.toLowerCase(), image: image || "", insert, hint });
    };
    loadChannelEmotes();
    state.list.emotes.forEach(e => push(e.name, e.image, e.name, "channel"));
    (Array.isArray(window.BTFW_EMOTE_PACKS) ? window.BTFW_EMOTE_PACKS : []).forEach(p => {
      (p.emotes || []).forEach(e => { if (e && e.name && e.token) push(e.name, e.image, e.token, p.label || "pack"); });
    });
    if (state.emojiReady) {
      state.list.emoji.forEach(e => { if (e.token) push(e.name, e.image, normalizeAnimatedEmojiToken(e.token), "emoji"); });
    }
    ac.lastChannelCount = Array.isArray(window.CHANNEL?.emotes) ? window.CHANNEL.emotes.length : 0;
    ac.dirty = false;
    ac.index_ = out;
    return out;
  }

  function acIndex(){
    const channelCount = Array.isArray(window.CHANNEL?.emotes) ? window.CHANNEL.emotes.length : 0;
    if (!ac.index_ || ac.dirty || channelCount !== ac.lastChannelCount) return acBuildIndex();
    return ac.index_;
  }

  function acEnsureBox(){
    if (ac.box) return ac.box;
    ensureChatwrapRelative();
    const box = document.createElement("div");
    box.id = "btfw-emote-ac";
    box.hidden = true;
    box.setAttribute("role", "listbox");
    // keep focus in the chat line while clicking rows
    box.addEventListener("mousedown", (e) => e.preventDefault());
    box.addEventListener("click", (e) => {
      const row = e.target.closest(".btfw-emote-ac__item");
      if (row) acAccept(Number(row.dataset.idx));
    });
    ($("#chatwrap") || document.body).appendChild(box);
    ac.box = box;
    return box;
  }

  function acQueryAt(input){
    const pos = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, pos);
    const m = /(^|\s):([A-Za-z0-9_+\-]{2,30})$/.exec(before);
    if (!m) return null;
    return { start: pos - m[2].length - 1, query: m[2].toLowerCase(), pos };
  }

  function acRender(){
    const box = acEnsureBox();
    if (!ac.items.length) { acClose(); return; }
    box.innerHTML = "";
    ac.items.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "btfw-emote-ac__item" + (i === ac.index ? " is-active" : "");
      row.dataset.idx = String(i);
      row.setAttribute("role", "option");
      if (item.image) {
        const img = document.createElement("img");
        img.src = item.image;
        img.alt = "";
        img.loading = "lazy";
        row.appendChild(img);
      }
      const name = document.createElement("span");
      name.className = "btfw-emote-ac__name";
      name.textContent = item.name;
      row.appendChild(name);
      const hint = document.createElement("span");
      hint.className = "btfw-emote-ac__hint";
      hint.textContent = item.hint;
      row.appendChild(hint);
      box.appendChild(row);
    });
    // sit just above the chat line, aligned to it
    const input = $("#chatline");
    const wrap = $("#chatwrap");
    if (input && wrap) {
      const ir = input.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      box.style.left = Math.max(4, ir.left - wr.left) + "px";
      box.style.width = Math.min(ir.width, 340) + "px";
      box.style.bottom = (wr.bottom - ir.top + 6) + "px";
    }
    box.hidden = false;
    ac.open = true;
  }

  function acSetIndex(i){
    if (!ac.items.length) return;
    ac.index = (i + ac.items.length) % ac.items.length;
    const box = acEnsureBox();
    Array.from(box.children).forEach((row, idx) => row.classList.toggle("is-active", idx === ac.index));
    const active = box.children[ac.index];
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
  }

  function acClose(){
    if (ac.box) ac.box.hidden = true;
    ac.open = false;
    ac.items = [];
    ac.index = 0;
    ac.start = -1;
  }

  function acAccept(i){
    const item = ac.items[i];
    const input = $("#chatline");
    if (!item || !input || ac.start < 0) { acClose(); return; }
    const caret = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, ac.start);
    const after = input.value.slice(caret);
    const insert = item.insert + " ";
    ac.suppress = true;
    input.value = before + insert + after;
    const pos = (before + insert).length;
    input.selectionStart = input.selectionEnd = pos;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    ac.suppress = false;
    acClose();
    input.focus();
  }

  function acOnInput(){
    if (ac.suppress) return;
    const input = $("#chatline");
    if (!input) return acClose();
    const q = acQueryAt(input);
    if (!q) return acClose();
    const idx = acIndex();
    const starts = [];
    const contains = [];
    for (const item of idx) {
      if (item.lower.startsWith(q.query)) starts.push(item);
      else if (item.lower.includes(q.query)) contains.push(item);
      if (starts.length >= AC_MAX) break;
    }
    ac.items = starts.concat(contains).slice(0, AC_MAX);
    ac.start = q.start;
    ac.index = 0;
    acRender();
  }

  function acBind(){
    const input = $("#chatline");
    if (!input || input.dataset.btfwEmoteAc === "1") return;
    input.dataset.btfwEmoteAc = "1";
    input.addEventListener("input", acOnInput);
    input.addEventListener("blur", () => setTimeout(acClose, 120));
    document.addEventListener("keydown", (e) => {
      if (!ac.open) return;
      if (e.target !== input) return;
      if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); acSetIndex(ac.index + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); acSetIndex(ac.index - 1); }
      else if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); acAccept(ac.index); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); acClose(); }
    }, true);
  }

  function boot(){
    removeLegacyButtons();
    ensureOurButton();
    bindAnyExistingOpeners();
    ensurePopover();   // build + wire up front
    acBind();          // inline :emote autocomplete on the chat line
    // NO warm-up emoji fetch; loads on first Emoji tab open

    // Live updates: when the marketplace loads/changes packs, rebuild the pack
    // tabs in place (and re-render if the popover is open) — no refresh needed.
    document.addEventListener("btfw:emotePacks:changed", () => {
      ac.dirty = true; // autocomplete re-indexes on next trigger
      const pop = _emotesPop && _emotesPop.getCard && _emotesPop.getCard();
      if (!pop) return;
      syncPackTabs(pop);
      try { if (_emotesPop.isOpen && _emotesPop.isOpen()) render(true); } catch (_) {}
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:emotes", open, close, render, positionPopover };
});
