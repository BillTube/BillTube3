/* BillTube Framework — feature:chat-tools
   Mini modal above chat input: BBCode buttons, AFK/Clear, and Color tools.
   - Color swatch inserts [color=#HEX]...[/color] into the chatline
   - Optional "Keep color" toggles auto-wrap on send (colors only)
   - Correct caret/selection placement for all tags
   - No keyboard hotkey for GIFs
*/
BTFW.define("feature:chat-tools", ["feature:chat"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS = {
    hist:       "btfw:chat:history",
    stickColor: "btfw:chat:stickColor" // hex string like "#3498db" or ""
  };

  const COLORS = ["#1abc9c","#16a085","#f1c40f","#f39c12","#2ecc71","#27ae60","#e67e22",
                  "#d35400","#3498db","#2980b9","#e74c3c","#c0392b","#9b59b6","#8e44ad",
                  "#0080a5","#34495e","#2c3e50","#87724b","#7300a7","#ec87bf","#d870ad",
                  "#f69785","#9ba37e","#b49255","#a94136"];

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
        l.focus(); l.setSelectionRange(pos, pos); // caret between tags
      } else {
        const start = s.before.length + open.length;
        const end   = start + s.mid.length;
        l.focus(); l.setSelectionRange(start, end); // keep selection inside
      }
    });
  }

  function insertColorTag(hex){
    hex = (hex||"").trim();
    if (!/^#?[0-9a-f]{6}$/i.test(hex)) return;
    if (hex[0] !== "#") hex = "#"+hex;
    withSelection((l, s)=>{
      const open = `[color=${hex}]`, close = `[/color]`;
      l.value = s.before + open + s.mid + close + s.after;

      if (s.mid.length === 0) {
        const pos = s.before.length + open.length;
        l.focus(); l.setSelectionRange(pos, pos);
      } else {
        const start = s.before.length + open.length;
        const end   = start + s.mid.length;
        l.focus(); l.setSelectionRange(start, end);
      }
    });
  }

  // Sticky color: auto-wrap entire message on send if set and line doesn't already contain a color tag
  function getStickColor(){ try { return localStorage.getItem(LS.stickColor)||""; } catch(e){ return ""; } }
  function setStickColor(hex){ try { localStorage.setItem(LS.stickColor, hex||""); } catch(e){} }

  function applyStickyColorBeforeSend(){
    const hex = getStickColor(); if (!hex) return;
    const l = chatline(); if (!l) return;
    const v = (l.value||"").trim();
    if (!v) return;
    if (/\[color=.+?\]/i.test(v)) return; // already colored by user
    // wrap whole message
    l.value = `[color=${hex}]` + v + `[/color]`;
  }

  /* ---------- UI: actions button + mini modal ---------- */
  function ensureActionsButton(){
    const actions = $("#chatwrap .btfw-chat-bottombar #btfw-chat-actions");
    if (!actions || $("#btfw-ct-open")) return;
    const b = document.createElement("button");
    b.id = "btfw-ct-open";
    b.className = "button is-dark is-small btfw-chatbtn";
    b.innerHTML = '<span style="font-weight:700;letter-spacing:.5px;">Aa</span>';
    actions.prepend(b);
  }

  function ensureMiniModal(){
    const cw = $("#chatwrap"); if (!cw) return null;
    if ($("#btfw-ct-modal")) return $("#btfw-ct-modal");

    cw.style.position = cw.style.position || "relative"; // anchor

    const modal = document.createElement("div");
    modal.id = "btfw-ct-modal";
    modal.className = "btfw-ct-modal"; // hidden by default via CSS
    modal.innerHTML = `
      <div class="btfw-ct-backdrop"></div>
      <div class="btfw-ct-card">
        <div class="btfw-ct-cardhead">
          <span>Chat Tools</span>
          <button class="btfw-ct-close" aria-label="Close">&times;</button>
        </div>
        <div class="btfw-ct-body">
          <div class="btfw-ct-grid">
            <button class="btfw-ct-item" data-tag="b"><strong>B</strong><span>Bold</span></button>
            <button class="btfw-ct-item" data-tag="i"><em>I</em><span>Italic</span></button>
            <button class="btfw-ct-item" data-tag="sp"><span>SP</span><span>Spoiler</span></button>
            <button class="btfw-ct-item" data-tag="code"><code>&lt;/&gt;</code><span>Code</span></button>
            <button class="btfw-ct-item" data-tag="s"><span style="text-decoration:line-through">S</span><span>Strike</span></button>
            <button class="btfw-ct-item" data-act="afk">🤖<span>AFK</span></button>
            <button class="btfw-ct-item" data-act="clear">🧹<span>Clear</span></button>
          </div>

          <div class="btfw-ct-section">
            <div class="btfw-ct-row">
              <div class="btfw-ct-title">Text Color</div>
              <label class="btfw-ct-keep">
                <input type="checkbox" id="btfw-ct-keepcolor">
                Keep color for messages
              </label>
            </div>
            <div id="btfw-ct-swatch" class="btfw-ct-swatch"></div>
            <div class="btfw-ct-actions">
              <input id="btfw-ct-hex" class="btfw-ct-hex" placeholder="#RRGGBB">
              <button id="btfw-ct-insertcolor" class="button is-small">Insert Color</button>
              <button id="btfw-ct-clearcolor" class="button is-small is-dark">Clear Keep</button>
            </div>
          </div>
        </div>
      </div>
    `;
    cw.appendChild(modal);

    // Build swatches
    const sw = $("#btfw-ct-swatch", modal);
    COLORS.forEach(c => {
      const b = document.createElement("button");
      b.className = "btfw-ct-swatchbtn";
      b.style.background = c;
      b.dataset.color = c;
      sw.appendChild(b);
    });

    // init keep toggle
    const keep = $("#btfw-ct-keepcolor", modal);
    keep.checked = !!getStickColor();

    return modal;
  }

  function openMiniModal(){
    const m = ensureMiniModal(); if (!m) return;
    positionMiniModal();
    m.classList.add("is-active");
  }
  function closeMiniModal(){
    $("#btfw-ct-modal")?.classList.remove("is-active");
  }
  function positionMiniModal(){
    const m = $("#btfw-ct-modal"); if (!m) return;
    const c = controlsRow(); if (!c) return;
    const card = m.querySelector(".btfw-ct-card");
    // sit above controls with small gap
    const bottom = c.offsetHeight + 12;
    card.style.bottom = bottom + "px";
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

    // Open/close
    document.addEventListener("click", (e)=>{
      if (e.target.closest && e.target.closest("#btfw-ct-open")) { e.preventDefault(); openMiniModal(); return; }
      if (e.target.closest && e.target.closest(".btfw-ct-close")) { e.preventDefault(); closeMiniModal(); return; }
      if (e.target.closest && e.target.closest(".btfw-ct-backdrop")) { e.preventDefault(); closeMiniModal(); return; }

      // BBCode buttons
      const bb = e.target.closest && e.target.closest(".btfw-ct-item[data-tag]");
      if (bb) { e.preventDefault(); wrapWithTag(bb.dataset.tag); closeMiniModal(); return; }

      // AFK / Clear
      const afk = e.target.closest && e.target.closest('.btfw-ct-item[data-act="afk"]');
      if (afk) { e.preventDefault(); if(window.socket?.emit) window.socket.emit("chatMsg",{msg:"/afk"}); closeMiniModal(); return; }
      const clr = e.target.closest && e.target.closest('.btfw-ct-item[data-act="clear"]');
      if (clr) { e.preventDefault(); const mb=$("#messagebuffer"); if(mb) mb.innerHTML=""; closeMiniModal(); return; }

      // Color clicks
      const swb = e.target.closest && e.target.closest(".btfw-ct-swatchbtn");
      if (swb) {
        e.preventDefault();
        $("#btfw-ct-hex").value = swb.dataset.color;
        // Do not auto-insert — user confirms via "Insert Color"
        return;
      }
      if (e.target.id === "btfw-ct-insertcolor") {
        e.preventDefault();
        const hex = ($("#btfw-ct-hex").value||"").trim();
        insertColorTag(hex);
        closeMiniModal();
        return;
      }
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
        setStickColor(e.target.checked ? ($("#btfw-ct-hex").value||"").trim() : "");
      }
    }, true);

    // Chatline keys (no 'g' hotkey)
    const l = chatline(); if (l) {
      l.addEventListener("keydown", (ev)=>{
        if (ev.key === "Enter" && !ev.shiftKey) { // before send, apply sticky color if any
          applyStickyColorBeforeSend();
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
