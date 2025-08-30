/* BillTube Framework — feature:emotes (popover version)
   - Compact popover anchored to chat (not a fullscreen modal)
   - Tabs: Channel / Emoji / Recent
   - Search, keyboard nav, “recently used”, insert into #chatline
   - Removes legacy CyTube emote button and injects our own
*/
BTFW.define("feature:emotes", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // ------------------------- helpers -------------------------
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

  function ensureChatwrapRelative(){
    const wrap = $("#chatwrap");
    if (wrap && getComputedStyle(wrap).position === "static") {
      wrap.style.position = "relative";
    }
  }

  // ------------------------- state -------------------------
  const chatline      = $("#chatline");
  const CHANNEL_NAME  = (window.CHANNEL && window.CHANNEL.name) || "default";
  const RECENT_KEY    = `btfw:recent:emotes:${CHANNEL_NAME}`;

  let state = {
    tab: "emotes",           // emotes | emoji | recent
    list: { emotes: [], emoji: [], recent: [] },
    filtered: [],
    highlight: 0,
    emojiReady: false,
    search: ""
  };

  // ------------------------- data -------------------------
  function loadChannelEmotes(){
    const src = Array.isArray(window.CHANNEL?.emotes) ? window.CHANNEL.emotes : [];
    state.list.emotes = src.filter(x => x && x.name)
                           .map(x => ({ name: x.name, image: x.image || "" }));
  }

  async function loadEmoji(){
    try {
      const raw = localStorage.getItem("btfw:emoji:cache");
      if (raw) {
        state.list.emoji = JSON.parse(raw);
        state.emojiReady = true;
        render();
        return;
      }
    } catch(_) {}

    const url = "https://cdn.jsdelivr.net/npm/emoji.json@13.1.0/emoji.json";
    try {
      const res = await fetch(url, {cache:"force-cache"});
      const arr = await res.json();
      state.list.emoji = arr.map(e => ({
        char: e.char, name: (e.name||"").toLowerCase(),
        keywords: (e.keywords||"").toLowerCase()
      }));
      localStorage.setItem("btfw:emoji:cache", JSON.stringify(state.list.emoji));
    } catch(_) {
      state.list.emoji = [
        {char:"😀", name:"grinning face", keywords:"smile happy"},
        {char:"😂", name:"face with tears of joy", keywords:"laugh cry"},
        {char:"😍", name:"smiling face with heart-eyes", keywords:"love"},
        {char:"👍", name:"thumbs up", keywords:"like ok yes"},
        {char:"🔥", name:"fire", keywords:"lit hot"},
        {char:"🎉", name:"party popper", keywords:"celebrate confetti"},
      ];
    }
    state.emojiReady = true;
    render();
  }

  function loadRecent(){
    try { state.list.recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
    catch(_) { state.list.recent = []; }
  }
  function pushRecent(item){
    const key = item.kind === "emoji" ? item.char : item.name;
    state.list.recent = state.list.recent.filter(x => (x.kind==="emoji"?x.char:x.name)!==key);
    state.list.recent.unshift(item);
    state.list.recent = state.list.recent.slice(0, 24);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(state.list.recent)); } catch(_){}
  }

  // ------------------------- popover UI -------------------------
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
          <input id="btfw-emotes-search" type="text" placeholder="Search…" />
          <button id="btfw-emotes-clear" title="Clear">×</button>
        </div>
      </div>
      <div id="btfw-emotes-grid" class="btfw-emotes-grid" tabindex="0" aria-label="Emote grid"></div>
    `;
    // anchor it inside chatwrap so it never covers video
    const wrap = $("#chatwrap") || document.body;
    wrap.appendChild(pop);

    // interactions
    pop.querySelector(".btfw-emotes-tabs").addEventListener("click", ev=>{
      const btn = ev.target.closest(".btfw-tab");
      if (!btn) return;
      pop.querySelectorAll(".btfw-tab").forEach(x=>x.classList.toggle("is-active", x===btn));
      state.tab = btn.getAttribute("data-tab");
      state.search = ""; $("#btfw-emotes-search").value = "";
      render();
      if (state.tab === "emoji" && !state.emojiReady) loadEmoji();
      $("#btfw-emotes-grid").focus();
    });

    $("#btfw-emotes-search", pop).addEventListener("input", e=>{
      state.search = e.target.value.trim();
      render();
    });
    $("#btfw-emotes-clear", pop).addEventListener("click", ()=>{
      state.search = ""; $("#btfw-emotes-search").value = ""; render(); $("#btfw-emotes-grid").focus();
    });

    // keyboard grid nav
    $("#btfw-emotes-grid", pop).addEventListener("keydown", ev=>{
      const grid = $("#btfw-emotes-grid");
      const count = grid.children.length;
      if (!count) return;

      const cols = 8;
      const row = Math.floor(state.highlight / cols);
      const col = state.highlight % cols;

      switch(ev.key){
        case "ArrowRight": state.highlight = Math.min(count-1, state.highlight+1); break;
        case "ArrowLeft":  state.highlight = Math.max(0, state.highlight-1); break;
        case "ArrowDown":  state.highlight = Math.min(count-1, (row+1)*cols + col); break;
        case "ArrowUp":    state.highlight = Math.max(0, (row-1)*cols + col); break;
        case "Enter":
          const tile = grid.children[state.highlight]; tile && tile.click();
          ev.preventDefault(); return;
        case "Escape":
          close(); return;
        default: return;
      }
      ev.preventDefault();
      highlightActive(); ensureVisible();
    });

    // click outside to close (but only inside chatwrap area)
    document.addEventListener("click", (e)=>{
      if (pop.classList.contains("hidden")) return;
      const within = e.target.closest("#btfw-emotes-pop") || e.target.closest("#btfw-btn-emotes");
      if (!within) close();
    }, true);

    window.addEventListener("resize", positionPopover);
    positionPopover();

    return pop;
  }

  function positionPopover(){
    const pop = $("#btfw-emotes-pop"); if (!pop) return;
    // anchor above the chat input bottom bar
    const bar = $("#btfw-chat-bottombar") || $("#chatcontrols") || $("#chatwrap");
    const wrap = $("#chatwrap") || document.body;
    const rightPad = 8, bottomOffset = (bar ? (wrap.offsetHeight - (bar.offsetTop || 0)) : 60) + 8;
    pop.style.right  = rightPad + "px";
    pop.style.bottom = bottomOffset + "px";
    // width: cap to chat width
    const w = Math.min(560, Math.max(320, wrap.clientWidth - 24));
    pop.style.width = w + "px";
    pop.style.maxHeight = Math.max(240, Math.min(480, wrap.clientHeight - 150)) + "px";
  }

  function open(){
    const pop = ensurePopover();
    loadChannelEmotes(); loadRecent();
    state.tab="emotes"; state.search=""; state.highlight=0;
    pop.querySelectorAll(".btfw-tab").forEach(b=>b.classList.toggle("is-active", b.getAttribute("data-tab")==="emotes"));
    $("#btfw-emotes-search").value = "";
    render();
    positionPopover();
    pop.classList.remove("hidden");
    $("#btfw-emotes-grid").focus();
  }

  function close(){
    $("#btfw-emotes-pop")?.classList.add("hidden");
  }

  // ------------------------- render -------------------------
  function filterLists(){
    const q = state.search.toLowerCase();
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
  }

  function render(){
    const grid = $("#btfw-emotes-grid"); if (!grid) return;
    filterLists(); grid.innerHTML = ""; state.highlight = 0;

    const frag = document.createDocumentFragment();
    state.filtered.forEach(item=>{
      const tile = document.createElement("div");
      tile.className = "btfw-emote-tile";

      if (state.tab==="emoji" || item.kind==="emoji") {
        const span = document.createElement("span");
        span.className = "btfw-emoji"; span.textContent = item.char;
        tile.title = item.name || "";
        tile.appendChild(span);
      } else {
        const img = document.createElement("img");
        img.className = "btfw-emote-img"; img.src = item.image || ""; img.alt = item.name;
        img.onerror = ()=>{ img.style.display="none"; tile.textContent = item.name; };
        tile.title = item.name;
        tile.appendChild(img);
      }

      tile.addEventListener("click", ()=>{
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

  function highlightActive(){
    const grid = $("#btfw-emotes-grid");
    Array.from(grid.children).forEach((el,i)=>el.classList.toggle("is-active", i===state.highlight));
  }

  function ensureVisible(){
    const grid = $("#btfw-emotes-grid");
    const a = grid.children[state.highlight]; if (!a) return;
    const r = a.getBoundingClientRect(), gr = grid.getBoundingClientRect();
    if (r.top < gr.top) grid.scrollTop -= (gr.top - r.top) + 8;
    else if (r.bottom > gr.bottom) grid.scrollTop += (r.bottom - gr.bottom) + 8;
  }

  // ------------------------- button management -------------------------
  function removeLegacyButtons(){
    const sels = [
      "#emotelistbtn", "#emotelist", "#emote-list", "#emote-btn",
      'button[title*="Emote"]', 'button[onclick*="emote"]'
    ];
    sels.forEach(sel => $$(sel).forEach(el => el.remove()));
  }

  function findBottomBar(){
    return $("#btfw-chat-bottombar")
        || $("#chatcontrols .input-group-btn")
        || $("#chatcontrols")
        || $("#chatwrap");
  }

  function ensureOurButton(){
    if ($("#btfw-btn-emotes")) return;
    const bar = findBottomBar(); if (!bar) return;

    const btn = document.createElement("button");
    btn.id = "btfw-btn-emotes";
    btn.type = "button";
    btn.className = "button is-dark is-small btfw-chatbtn btfw-btn-emotes";
    btn.innerHTML = (window.FontAwesome || document.querySelector('.fa'))
      ? '<i class="fa fa-smile" aria-hidden="true"></i>'
      : '<span aria-hidden="true">🙂</span>';
    btn.title = "Emotes / Emoji";

    // place before GIF if present
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

  // ------------------------- boot -------------------------
  function boot(){
    removeLegacyButtons();
    ensureOurButton();
    bindAnyExistingOpeners();
    setTimeout(()=>loadEmoji(), 1000); // warm cache quietly
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:emotes", open, close, render };
});
