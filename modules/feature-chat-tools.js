/* BillTube Framework — feature:chat-tools
   Toolbar panel with BBCode, AFK/Clear, color picker, history, and fixes. */
BTFW.define("feature:chat-tools", ["feature:chat"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS = {
    nameColor: "btfw:chat:nameColor",
    hist:      "btfw:chat:history"
  };

  const COLORS = ["#1abc9c","#16a085","#f1c40f","#f39c12","#2ecc71","#27ae60","#e67e22",
                  "#d35400","#3498db","#2980b9","#e74c3c","#c0392b","#9b59b6","#8e44ad",
                  "#0080a5","#34495e","#2c3e50","#87724b","#7300a7","#ec87bf","#d870ad",
                  "#f69785","#9ba37e","#b49255","#a94136"];

  /* ---------------------------------------------------
   * UI creation
   * --------------------------------------------------- */
  function ensureActionsButton() {
    const actions = $("#chatwrap .btfw-chat-bottombar #btfw-chat-actions");
    if (!actions || $("#btfw-ct-panelbtn")) return;
    const b = document.createElement("button");
    b.id = "btfw-ct-panelbtn";
    b.className = "button is-dark is-small btfw-chatbtn";
    b.innerHTML = '<span style="font-weight:700;letter-spacing:.5px;">Aa</span>';
    actions.prepend(b);
  }

  function ensurePanel() {
    const cw = $("#chatwrap"); if (!cw) return null;
    if ($("#btfw-ct-pop")) return $("#btfw-ct-pop");

    // Make chatwrap a positioning context
    cw.style.position = cw.style.position || "relative";

    const div = document.createElement("div");
    div.id = "btfw-ct-pop";
    div.className = "btfw-ct-pop is-hidden";
    div.innerHTML = `
      <div class="btfw-ct-grid">
        <button class="btfw-ct-item" data-tag="b"><strong>B</strong><span>Bold</span></button>
        <button class="btfw-ct-item" data-tag="i"><em>I</em><span>Italic</span></button>
        <button class="btfw-ct-item" data-tag="sp"><span>SP</span><span>Spoiler</span></button>
        <button class="btfw-ct-item" data-tag="code"><code>&lt;/&gt;</code><span>Code</span></button>
        <button class="btfw-ct-item" data-tag="s"><span style="text-decoration:line-through">S</span><span>Strike</span></button>
        <button class="btfw-ct-item" data-act="afk">🤖<span>AFK</span></button>
        <button class="btfw-ct-item" data-act="clear">🧹<span>Clear Chat</span></button>
        <button class="btfw-ct-item" data-act="color">🎨<span>Color</span></button>
      </div>
      <div id="btfw-ct-swatch2" class="btfw-ct-swatch is-hidden"></div>
    `;
    cw.appendChild(div);

    // Build swatches
    const sw = $("#btfw-ct-swatch2", div);
    COLORS.forEach(c => {
      const b = document.createElement("button");
      b.className = "btfw-ct-swatchbtn";
      b.style.background = c;
      b.dataset.color = c;
      sw.appendChild(b);
    });

    return div;
  }

  function positionPanel() {
    const pop = $("#btfw-ct-pop"); if (!pop) return;
    const controls = $("#chatcontrols,#chat-controls") || ($("#chatline") && $("#chatline").parentElement);
    if (!controls) return;

    // Anchor just above controls, with side padding
    pop.style.left = "8px";
    pop.style.right = "8px";
    pop.style.bottom = (controls.offsetHeight + 10) + "px";
  }

  function togglePanel(force) {
    const pop = ensurePanel(); if (!pop) return;
    positionPanel();
    const open = force === undefined ? pop.classList.contains("is-hidden") : !!force;
    pop.classList.toggle("is-hidden", !open);
    if (open) {
      document.addEventListener("click", outsideClose, { capture:true, once:true });
    }
  }

  function outsideClose(ev){
    const pop = $("#btfw-ct-pop");
    const btn = $("#btfw-ct-panelbtn");
    if (!pop) return;
    if (pop.contains(ev.target) || (btn && btn.contains(ev.target))) {
      // clicked inside; keep open and resume outside close next click
      document.addEventListener("click", outsideClose, { capture:true, once:true });
      return;
    }
    pop.classList.add("is-hidden");
  }

  /* ---------------------------------------------------
   * Chatline helpers
   * --------------------------------------------------- */
  function chatline(){ return $("#chatline"); }

  // Insert or wrap with correct caret placement
  function insertBB(tag) {
    const line = chatline(); if (!line) return;
    const a = line.selectionStart ?? line.value.length;
    const b = line.selectionEnd   ?? line.value.length;
    const left = line.value.slice(0, a);
    const mid  = line.value.slice(a, b);
    const right= line.value.slice(b);
    const t = tag;

    // Build new value
    const open = `[${t}]`, close = `[/${t}]`;
    line.value = left + open + mid + close + right;

    // Caret/selection:
    // - If nothing selected: caret goes BETWEEN the tags
    // - If text selected: keep the selection inside the tags
    if (mid.length === 0) {
      const pos = left.length + open.length;
      line.focus(); line.setSelectionRange(pos, pos);
    } else {
      const start = left.length + open.length;
      const end   = start + mid.length;
      line.focus(); line.setSelectionRange(start, end);
    }
  }

  function sendRaw(msg){
    if (window.socket && window.socket.emit) window.socket.emit("chatMsg", { msg });
  }

  // History
  function getHist(){ try{ return JSON.parse(localStorage.getItem(LS.hist)||"[]"); }catch(e){ return []; } }
  function setHist(arr){ try{ localStorage.setItem(LS.hist, JSON.stringify(arr.slice(-50))); }catch(e){} }
  let histIndex = -1;
  function commitToHist(text){
    if (!text) return;
    const h = getHist();
    if (h[h.length-1] !== text) { h.push(text); setHist(h); }
    histIndex = -1;
  }
  function histUpDown(dir){
    const l = chatline(); if (!l) return;
    const h = getHist(); if (!h.length) return;
    if (histIndex === -1) histIndex = h.length;
    histIndex += (dir<0 ? -1 : +1);
    histIndex = Math.max(0, Math.min(h.length-1, histIndex));
    l.value = h[histIndex] || "";
    l.focus(); l.setSelectionRange(l.value.length, l.value.length);
  }

  // Name color
  function setNameColor(color){
    try{ localStorage.setItem(LS.nameColor, color||""); }catch(e){}
    $$("#messagebuffer .username, #messagebuffer .nick, #messagebuffer .name")
      .forEach(n => { n.style.color = color || ""; });
  }
  function initNameColorObserver(){
    const saved = (localStorage.getItem(LS.nameColor) || "");
    if (saved) setNameColor(saved);
    const buf = $("#messagebuffer");
    if (buf && !buf._btfw_ct_color_obs){
      buf._btfw_ct_color_obs = true;
      new MutationObserver(m => m.forEach(r => r.addedNodes.forEach(n => {
        if (n.nodeType===1 && saved){
          const u = n.querySelector?.(".username,.nick,.name"); if (u) u.style.color = saved;
        }
      }))).observe(buf, {childList:true});
    }
  }

  /* ---------------------------------------------------
   * Event wiring
   * --------------------------------------------------- */
  function wire(){
    ensureActionsButton();
    ensurePanel();

    // Clicks
    document.addEventListener("click", (e)=>{
      if (e.target.closest && e.target.closest("#btfw-ct-panelbtn")) {
        e.preventDefault(); togglePanel();
        return;
      }
      const bb = e.target.closest && e.target.closest("#btfw-ct-pop .btfw-ct-item[data-tag]");
      if (bb) { e.preventDefault(); insertBB(bb.dataset.tag); return; }

      const afk = e.target.closest && e.target.closest('#btfw-ct-pop .btfw-ct-item[data-act="afk"]');
      if (afk) { e.preventDefault(); sendRaw("/afk"); return; }

      const clr = e.target.closest && e.target.closest('#btfw-ct-pop .btfw-ct-item[data-act="clear"]');
      if (clr) { e.preventDefault(); const mb=$("#messagebuffer"); if(mb) mb.innerHTML=""; return; }

      const col = e.target.closest && e.target.closest('#btfw-ct-pop .btfw-ct-item[data-act="color"]');
      if (col) { e.preventDefault(); $("#btfw-ct-swatch2")?.classList.toggle("is-hidden"); return; }

      const swb = e.target.closest && e.target.closest("#btfw-ct-swatch2 .btfw-ct-swatchbtn");
      if (swb) { e.preventDefault(); setNameColor(swb.dataset.color); $("#btfw-ct-swatch2")?.classList.add("is-hidden"); return; }
    }, true);

    // Key events on chatline
    const l = chatline(); if (l) {
      l.addEventListener("keydown", (ev)=>{
        if (ev.key === "Enter" && !ev.shiftKey) { commitToHist(l.value.trim()); }
        if (ev.key === "ArrowUp" && !ev.shiftKey && l.selectionStart===l.selectionEnd && l.selectionStart===0) {
          ev.preventDefault(); histUpDown(-1);
        }
        if (ev.key === "ArrowDown" && !ev.shiftKey && l.selectionStart===l.selectionEnd && l.selectionStart===l.value.length) {
          ev.preventDefault(); histUpDown(+1);
        }
        // NOTE: removed the "g" hotkey entirely per request
      });
    }

    // Resize/scroll: keep panel anchored above the input
    window.addEventListener("resize", positionPanel);
    $("#chatwrap")?.addEventListener("scroll", positionPanel, { passive:true });

    initNameColorObserver();
    positionPanel();
  }

  function boot(){ wire(); }
  document.addEventListener("btfw:layoutReady", ()=>setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  return { name: "feature:chat-tools" };
});
