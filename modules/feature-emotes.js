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

  function icon(svg, w=20, h=20){
    const span = document.createElement("span");
    span.className = "btfw-ico";
    span.innerHTML = svg;
    span.style.display = "inline-flex";
    span.style.verticalAlign = "middle";
    span.style.width  = w+"px";
    span.style.height = h+"px";
    return span;
  }

  function ensureChatwrapRelative(){
    const wrap = $("#chatwrap");
    if (wrap && getComputedStyle(wrap).position === "static") {
      wrap.style.position = "relative";
    }
  }

  const ICONS = {
    emotes: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-3.5 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm7 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM7 14a5 5 0 0010 0H7z"/></svg>`,
    emoji:  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-18C7.6 4 4 7.6 4 12s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm-3 6c.8 0 1.5-.7 1.5-1.5S9.8 9 9 9s-1.5.7-1.5 1.5S8.2 12 9 12zm6 0c.8 0 1.5-.7 1.5-1.5S15.8 9 15 9s-1.5.7-1.5 1.5S14.2 12 15 12zm-9 3c1.3 2 3.5 3 6 3s4.7-1 6-3H6z"/></svg>`,
    recent: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 109 9 9 9 0 00-9-9zm0 16a7 7 0 117-7 7 7 0 01-7 7zM2 13h2a9 9 0 019-9V2A11 11 0 002 13zM14 8h-2v6l5 3 .9-1.5-3.9-2.3z"/></svg>`
  };

  /* ------------------------ state ------------------------- */
  const CHANNEL_NAME = (window.CHANNEL && window.CHANNEL.name) || "default";
  const RECENT_KEY   = `btfw:recent:emotes:${CHANNEL_NAME}`;

  let state = {
    tab: "emotes", // "emotes" | "emoji" | "recent"
    query: "",
    loadingEmoji: false,
    packs: [],
    emoji: [],
    recent: []
  };

  function readRecents(){ try { return JSON.parse(localStorage.getItem(RECENT_KEY)||"[]"); } catch(e) { return []; } }
  function writeRecents(a){ try { localStorage.setItem(RECENT_KEY, JSON.stringify(a.slice(0,120))); } catch(e){} }

  /* ------------------------ render ------------------------ */
  function el(tag, cls, html){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function buildHeader(){
    const head = el("div", "btfw-emotes-head");
    const tabs = el("div", "btfw-emotes-tabs");

    [["emotes", ICONS.emotes, "Emotes"], ["emoji", ICONS.emoji, "Emoji"], ["recent", ICONS.recent, "Recent"]].forEach(([id,svg,label])=>{
      const b = el("button", "btfw-emotes-tab", `${svg}<span>${label}</span>`);
      b.dataset.tab = id;
      tabs.appendChild(b);
    });

    const close = el("button", "btfw-emotes-close", "×");
    head.appendChild(tabs);
    head.appendChild(close);
    return head;
  }

  function buildGrid(){
    const grid = el("div", "btfw-emotes-grid");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(36px, 1fr))";
    grid.style.gap = "6px";
    grid.style.alignContent = "start";
    grid.style.padding = "8px";
    return grid;
  }

  function renderEmoteTile(code, url){
    const btn = el("button", "btfw-emote-tile");
    const img = el("img", "btfw-emote-img");
    img.src = url;
    img.alt = code;
    img.width = 36;
    img.height = 36;
    btn.appendChild(img);
    btn.title = code;
    btn.dataset.code = code;
    return btn;
  }

  function open(){
    ensureChatwrapRelative();
    let pop = document.getElementById("btfw-emotes-pop");
    if (!pop){
      pop = document.createElement("div");
      pop.id = "btfw-emotes-pop";
      pop.className = "btfw-popover btfw-emotes-pop hidden";
      pop.innerHTML = `
        <div class="btfw-emotes-head">
          <div class="btfw-emotes-tabs"></div>
          <button id="btfw-emotes-close" class="btfw-emotes-close" aria-label="Close">×</button>
        </div>
        <div class="btfw-emotes-search">
          <input id="btfw-emotes-search" class="input is-small" placeholder="Search" />
          <button id="btfw-emotes-clear" class="button is-small">Clear</button>
        </div>
        <div class="btfw-emotes-grid"></div>
      `;
      const wrap = document.getElementById("chatwrap") || document.body;
      wrap.appendChild(pop);
      render(); // first render
    }
    pop.classList.remove("hidden");
    positionPopover(true);
  }

  function close(){
    const pop = document.getElementById("btfw-emotes-pop");
    if (pop) pop.classList.add("hidden");
  }

  function toggle(){ const pop = document.getElementById("btfw-emotes-pop"); (!pop || pop.classList.contains("hidden")) ? open() : close(); }

  function render(){
    const pop  = document.getElementById("btfw-emotes-pop");
    if (!pop) return;

    const head = pop.querySelector(".btfw-emotes-head .btfw-emotes-tabs");
    const grid = pop.querySelector(".btfw-emotes-grid");
    const q    = (state.query||"").toLowerCase();

    head.innerHTML = "";
    [["emotes", ICONS.emotes, "Emotes"], ["emoji", ICONS.emoji, "Emoji"], ["recent", ICONS.recent, "Recent"]].forEach(([id,svg,label])=>{
      const b = document.createElement("button");
      b.className = "btfw-emotes-tab" + (state.tab===id ? " is-active" : "");
      b.dataset.tab = id;
      b.innerHTML = `${svg}<span>${label}</span>`;
      head.appendChild(b);
    });

    grid.innerHTML = "";

    if (state.tab === "emotes"){
      state.packs.forEach(pk=>{
        pk.items.filter(x=> !q || (x.code||"").toLowerCase().includes(q))
                .forEach(x => grid.appendChild(renderEmoteTile(x.code, x.url)));
      });
    } else if (state.tab === "emoji"){
      (state.emoji||[]).filter(x=> !q || (x.code||"").toLowerCase().includes(q))
                       .forEach(x => grid.appendChild(renderEmoteTile(x.code, x.url)));
    } else {
      (readRecents()||[]).filter(x=> !q || (x.code||"").toLowerCase().includes(q))
                         .forEach(x => grid.appendChild(renderEmoteTile(x.code, x.url)));
    }
  }

  function positionPopover(setFixedHeight){
    const pop = document.getElementById("btfw-emotes-pop");
    if (!pop) return;

    const wrap = (document.getElementById("chatwrap") || document.body);
    const anchor = (document.getElementById("btfw-chat-bottombar")
                 || document.getElementById("chatcontrols")
                 || document.getElementById("chatline")
                 || wrap);

    if (wrap.id === "chatwrap" && getComputedStyle(wrap).position === "static") {
      wrap.style.position = "relative";
    }

    const margin     = 8;
    const wrapRect   = wrap.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();

    let bottomPx = Math.round((wrapRect.bottom - anchorRect.top) + margin);
    if (anchor === wrap || !isFinite(bottomPx) || bottomPx <= 0) bottomPx = 56;
    bottomPx = Math.max(8, Math.min(bottomPx, (wrap.clientHeight || 480) - 48));

    const maxWidth = Math.min(560, Math.max(320, (wrap.clientWidth || window.innerWidth) - 24));
    pop.style.position = "fixed";
    pop.style.right  = "8px";
    pop.style.bottom = bottomPx + "px";
    pop.style.width  = maxWidth + "px";

    const fixedH = Math.max(260, Math.min(480, (wrap.clientHeight || (window.innerHeight - 120)) - (bottomPx + 40)));
    if (setFixedHeight || !pop._btfwFixedH) {
      pop.style.height = fixedH + "px";
      pop._btfwFixedH = fixedH;
    }
  }

  document.addEventListener("click", (e)=>{
    if (e.target.closest && e.target.closest("#btfw-emotes-close")) { e.preventDefault(); close(); return; }
    if (e.target.closest && e.target.closest(".btfw-emotes-tab")) {
      e.preventDefault();
      state.tab = e.target.closest(".btfw-emotes-tab").dataset.tab;
      render(); positionPopover();
      return;
    }
    if (e.target.closest && e.target.closest("#btfw-emotes-clear")) {
      e.preventDefault(); const inp = $("#btfw-emotes-search"); if (inp) { inp.value=""; state.query = ""; } render(); return;
    }
    const tile = e.target.closest && e.target.closest(".btfw-emote-tile");
    if (tile){
      e.preventDefault();
      const code = tile.dataset.code;
      const input = $("#chatline"); if (input) insertAtCursor(input, code+" ");
      const list = readRecents(); if (!list.find(x=>x.code===code)) { list.unshift({code}); writeRecents(list); }
      close();
      return;
    }
  }, true);

  document.addEventListener("input", (e)=>{
    if (e.target && e.target.id==="btfw-emotes-search") {
      state.query = (e.target.value||"");
      render();
    }
  }, true);

  const btn = document.getElementById("btfw-btn-emotes");
  if (btn){
    btn.addEventListener("click", (ev)=>{
      ev.preventDefault(); ev.stopPropagation();
      const pop = document.getElementById("btfw-emotes-pop");
      (pop && !pop.classList.contains("hidden")) ? close() : open();
    }, {capture:true});
  }

  window.addEventListener("resize", positionPopover);
  (document.getElementById("chatwrap")||document).addEventListener("scroll", positionPopover, {passive:true});

  function boot(){
    ensureOurButton();
    bindAnyExistingOpeners();
    watchPosition();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:emotes", open, close, render, positionPopover };
});
