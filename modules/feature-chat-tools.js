/* BillTube Framework — feature:chat-tools
   Mini modal above chat input: BBCode buttons, AFK/Clear, and Color tools.
   Color uses BillTube2 format: prefix 'col:#RRGGBB:' at the start of the message.
*/
BTFW.define("feature:chat-tools", ["feature:chat"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS = {
    hist:       "btfw:chat:history",
    stickColor: "btfw:chat:stickColor" // "#rrggbb" or ""
  };

  const COLORS = ["#1abc9c","#16a085","#f1c40f","#f39c12","#2ecc71","#27ae60","#e67e22",
                  "#d35400","#3498db","#2980b9","#e74c3c","#c0392b","#9b59b6","#8e44ad",
                  "#0080a5","#34495e","#2c3e50","#87724b","#7300a7","#ec87bf","#d870ad",
                  "#f69785","#9ba37e","#b49255","#a94136"];

  /* ---------- one-time cleanup: never color usernames ---------- */
  try { localStorage.removeItem("btfw:chat:nameColor"); } catch(e){}
  (function clearUsernameTint(){
    $$("#messagebuffer .username, #messagebuffer .nick, #messagebuffer .name")
      .forEach(n => { try { n.style.color = ""; } catch(e){} });
  })();

  /* ---------- helpers ---------- */
  const chatline = () => $("#chatline");
  const controlsRow = () => $("#chatcontrols,#chat-controls") || ($("#chatline") && $("#chatline").parentElement);

  function withSelection(fn){
    const l = chatline(); if (!l) return;
    const a = l.selectionStart ?? l.value.length;
    const b = l.selectionEnd ?? l.value.length;
    const before = l.value.slice(0, a);
    const mid    = l.value.slice(a, b);
    const after  = l.value.slice(b);
    fn(l, {a,b,before,mid,after});
  }

function wrapWithTag(tag){
  withSelection((l, s)=>{
    const open = `[${tag}]`, close = `[/${tag}]`;
    l.value = s.before + open + s.mid + close + s.after;

    if (s.mid.length === 0) {
      const pos = s.before.length + open.length;
      l.focus(); l.setSelectionRange(pos, pos);  // caret between tags
    } else {
      const start = s.before.length + open.length;
      const end   = start + s.mid.length;
      l.focus(); l.setSelectionRange(start, end); // keep selection inside tags
    }
  });
}


  function normalizeHex(x){
    if (!x) return "";
    x = x.trim();
    if (/^[0-9a-f]{6}$/i.test(x)) x = "#"+x;
    if (!/^#[0-9a-f]{6}$/i.test(x)) return "";
    return x.toLowerCase();
  }

  // Insert/replace prefix col:#hex: at the very start of the line
  function applyColPrefix(hex){
    hex = normalizeHex(hex); if (!hex) return;
    const l = chatline(); if (!l) return;
    const prefixRe = /^col:\s*#?[0-9a-fA-F]{6}:\s*/;
    const current = l.value || "";
    const without = current.replace(prefixRe, "");          // remove existing color prefix if any
    const prefix  = `col:${hex}:`;
    // Add a space after prefix only if there is content
    const glue = without && !/^\s/.test(without) ? " " : "";
    l.value = prefix + glue + without;
    // Move caret to end so user can keep typing
    const pos = l.value.length;
    l.focus(); l.setSelectionRange(pos, pos);
  }

  // On send, auto-prefix with sticky color if enabled and line lacks a prefix
  function getStickColor(){ try { return localStorage.getItem(LS.stickColor)||""; } catch(e){ return ""; } }
  function setStickColor(hex){ try { localStorage.setItem(LS.stickColor, normalizeHex(hex)||""); } catch(e){} }

  function applyStickyColorBeforeSend(){
    const hex = getStickColor(); if (!hex) return;
    const l = chatline(); if (!l) return;
    const v = (l.value||"").trimStart();
    if (/^col:\s*#?[0-9a-fA-F]{6}:/i.test(v)) return; // already has color prefix
    // Prepend prefix, keep rest of message as-is
    l.value = `col:${normalizeHex(hex)}:` + (v ? " " : "") + v;
  }

  /* ---------- UI: actions button + mini modal ---------- */
function ensureMiniModal(){
  // container
  const cw = document.getElementById("chatwrap") || document.body;

  // re-use if already present
  let modal = document.getElementById("btfw-ct-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "btfw-ct-modal";
    // no full-screen backdrop; just a lightweight container
    cw.appendChild(modal);
  }

  // inline template (no backdrop)
  modal.innerHTML = `
    <div class="btfw-ct-card">
      <div class="btfw-ct-cardhead">
        <span>Chat Tools</span>
        <button class="btfw-ct-close" aria-label="Close">&times;</button>
      </div>

      <div class="btfw-ct-body">
        <div class="btfw-ct-grid">
          <button class="btfw-ct-item" data-tag="b"><strong>B</strong><span>Bold</span></button>
          <button class="btfw-ct-item" data-tag="i"><em>I</em><span>Italic</span></button>
          <button class="btfw-ct-item" data-tag="u"><u>U</u><span>Underline</span></button>
          <button class="btfw-ct-item" data-tag="s"><span style="text-decoration:line-through">S</span><span>Strike</span></button>
          <!-- …rest of your buttons… -->
        </div>

        <div class="btfw-ct-color">
          <label><input type="checkbox" id="btfw-ct-keepcolor"> Keep color</label>
          <div class="btfw-ct-swatch" id="btfw-ct-swatch"></div>
        </div>

        <div class="btfw-ct-actions">
          <button id="btfw-ct-clear" class="button is-small">Clear</button>
          <button id="btfw-ct-afk"   class="button is-small">AFK</button>
        </div>
      </div>
    </div>
  `;


  // make container inert; only the card is interactive
  modal.style.background = "transparent";
  modal.style.pointerEvents = "none";
  modal.classList.add("hidden");

 const card = modal.querySelector(".btfw-ct-card");
  if (card) {
    card.classList.add("btfw-popover");
    card.style.pointerEvents = "auto"; // ensure clicks work on the panel
  }

  // Build color swatches
  const sw = document.querySelector("#btfw-ct-swatch");
  if (sw && !sw.hasChildNodes()) {
    COLORS.forEach(c => {
      const b = document.createElement("button");
      b.className = "btfw-ct-swatchbtn";
      b.style.background = c;
      b.dataset.color = c;
      sw.appendChild(b);
    });
  }

  // Init keep toggle state
  const keep = document.getElementById("btfw-ct-keepcolor");
  if (keep) keep.checked = !!getStickColor();

  return modal;
}

function openMiniModal(){
  const m = ensureMiniModal(); if (!m) return;
  positionMiniModal();
  m.classList.remove("hidden");
  m.classList.add("is-active");
}
  
function closeMiniModal(){
  const m = $("#btfw-ct-modal");
  if (m) { m.classList.add("hidden"); m.classList.remove("is-active"); }
}

function positionMiniModal(){
  const m = document.getElementById("btfw-ct-modal"); if (!m) return;
  const card = m.querySelector(".btfw-ct-card"); if (!card) return;

  // Prefer the global helper (aligns above .btfw-chat-bottombar)
  if (window.BTFW_positionPopoverAboveChatBar) {
    window.BTFW_positionPopoverAboveChatBar(card, {
      widthPx: 420,
      widthVw: 92,
      maxHpx: 360,
      maxHvh: 60
    });
    return;
  }

  // --- Fallback (previous approach) ---
  const c = (document.getElementById("chatcontrols")
        || document.getElementById("chat-controls")
        || (document.getElementById("chatline") && document.getElementById("chatline").parentElement));
  if (!c) return;

  const bottom = (c.offsetHeight || 48) + 12;
  card.style.position = "fixed";
  card.style.right    = "8px";
  card.style.bottom   = bottom + "px";
  card.style.maxHeight = "60vh";
  card.style.width     = "min(420px,92vw)";
}

function ensureActionsButton(){
  const actions = $("#chatwrap .btfw-chat-bottombar #btfw-chat-actions");
  if (!actions) return;

  // Use a distinct id for Chat Tools. Do not reuse the Commands id.
  if ($("#btfw-chattools-btn") || $("#btfw-ct-open")) return;

  const b = document.createElement("button");
  b.id = "btfw-chattools-btn";
  b.className = "button is-dark is-small btfw-chatbtn";
  b.innerHTML = '<span style="font-weight:700;letter-spacing:.5px;">Aa</span>';
  actions.prepend(b);
}


  /* ---------- History ---------- */
  function getHist(){ try{ return JSON.parse(localStorage.getItem(LS.hist)||"[]"); }catch(e){ return []; } }
  function setHist(a){ try{ localStorage.setItem(LS.hist, JSON.stringify(a.slice(-50))); }catch(e){} }
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

  /* ---------- Wiring ---------- */
  function wire(){
    ensureActionsButton();
    ensureMiniModal();
const toolsBtn = $("#btfw-chattools-btn") || $("#btfw-ct-open");
if (toolsBtn) {
  toolsBtn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openMiniModal();
  }, { capture: true });
}

    // Open/close
    document.addEventListener("click", (e)=>{
if (e.target.closest) {
  const hit = e.target.closest("#btfw-chattools-btn") || e.target.closest("#btfw-ct-open");
  if (hit) { e.preventDefault(); openMiniModal(); return; }
}      if (e.target.closest && e.target.closest(".btfw-ct-close")) { e.preventDefault(); closeMiniModal(); return; }
// Outside click closes the tools panel
const cardEl = $("#btfw-ct-modal .btfw-ct-card");
if (cardEl && !e.target.closest("#btfw-ct-modal .btfw-ct-card")
    && !e.target.closest("#btfw-chattools-btn")
    && !e.target.closest("#btfw-ct-open")) {
  closeMiniModal();
  return;
}

      // BBCode buttons (one-shot)
      const bb = e.target.closest && e.target.closest(".btfw-ct-item[data-tag]");
      if (bb) { e.preventDefault(); wrapWithTag(bb.dataset.tag); closeMiniModal(); return; }

      // AFK / Clear
      const afk = e.target.closest && e.target.closest('.btfw-ct-item[data-act="afk"]');
      if (afk) { e.preventDefault(); if(window.socket?.emit) window.socket.emit("chatMsg",{msg:"/afk"}); closeMiniModal(); return; }
      const clr = e.target.closest && e.target.closest('.btfw-ct-item[data-act="clear"]');
      if (clr) { e.preventDefault(); const mb=$("#messagebuffer"); if(mb) mb.innerHTML=""; closeMiniModal(); return; }

      // Color swatch -> fill hex box (no auto insert)
      const swb = e.target.closest && e.target.closest(".btfw-ct-swatchbtn");
      if (swb) {
        e.preventDefault();
        $("#btfw-ct-hex").value = swb.dataset.color;
        // If keep is checked, update persistent color immediately
        const keep = $("#btfw-ct-keepcolor");
        if (keep && keep.checked) setStickColor(swb.dataset.color);
        return;
      }

      // Insert Color button -> apply prefix in input now
      if (e.target.id === "btfw-ct-insertcolor") {
        e.preventDefault();
        const hex = ($("#btfw-ct-hex").value||"").trim();
        applyColPrefix(hex);
        closeMiniModal();
        return;
      }

      // Clear Keep -> disable sticky color
      if (e.target.id === "btfw-ct-clearcolor") {
        e.preventDefault();
        setStickColor("");
        const keep = $("#btfw-ct-keepcolor"); if (keep) keep.checked = false;
        return;
      }
    }, true);

    // Keep color toggle
    document.addEventListener("change", (e)=>{
      if (e.target && e.target.id === "btfw-ct-keepcolor") {
        const hex = normalizeHex(($("#btfw-ct-hex").value||"").trim());
        setStickColor(e.target.checked ? hex : "");
        // If turned on with empty/invalid hex, immediately turn off
        if (e.target.checked && !hex) { setStickColor(""); e.target.checked = false; }
      }
    }, true);

    // Chatline keys (no GIF hotkey)
    const l = chatline(); if (l) {
      l.addEventListener("keydown", (ev)=>{
        if (ev.key === "Enter" && !ev.shiftKey) {
          applyStickyColorBeforeSend();  // prefix if needed
          commitToHist(l.value.trim());
        }
        if (ev.key === "ArrowUp" && !ev.shiftKey && l.selectionStart===l.selectionEnd && l.selectionStart===0) {
          ev.preventDefault(); histUpDown(-1);
        }
        if (ev.key === "ArrowDown" && !ev.shiftKey && l.selectionStart===l.selectionEnd && l.selectionStart===l.value.length) {
          ev.preventDefault(); histUpDown(+1);
        }
      });
    }

    // Maintain position on resize/scroll
    window.addEventListener("resize", positionMiniModal);
    $("#chatwrap")?.addEventListener("scroll", positionMiniModal, { passive:true });
  }

  function boot(){ wire(); positionMiniModal(); }
  document.addEventListener("btfw:layoutReady", ()=>setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  return { name: "feature:chat-tools" };
});
