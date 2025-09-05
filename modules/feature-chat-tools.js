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

  try { localStorage.removeItem("btfw:chat:nameColor"); } catch(e){}
  (function clearUsernameTint(){
    $$("#messagebuffer .username, #messagebuffer .nick, #messagebuffer .name")
      .forEach(n => { try { n.style.color = ""; } catch(e){} });
  })();

  const chatline = () => $("#chatline");
  const controlsRow = () => $("#chatcontrols,#chat-controls") || ($("#chatline") && $("#chatline").parentElement);

  function withSelection(fn){
    const l = chatline(); if (!l) return;
    const a = l.selectionStart ?? l.value.length;
    const b = l.selectionEnd   ?? l.value.length;
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
        l.focus(); l.setSelectionRange(pos, pos);
      } else {
        const start = s.before.length + open.length;
        const end   = start + s.mid.length;
        l.focus(); l.setSelectionRange(start, end);
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

  function applyColPrefix(hex){
    hex = normalizeHex(hex); if (!hex) return;
    const l = chatline(); if (!l) return;
    const prefixRe = /^col:\s*#?[0-9a-fA-F]{6}:\s*/;
    const current = l.value || "";
    const without = current.replace(prefixRe, "");
    const prefix  = `col:${hex}:`;
    const glue = without && !/^\s/.test(without) ? " " : "";
    l.value = prefix + glue + without;
    const pos = l.value.length;
    l.focus(); l.setSelectionRange(pos, pos);
  }

  function getStickColor(){ try { return localStorage.getItem(LS.stickColor)||""; } catch(e){ return ""; } }
  function setStickColor(hex){ try { localStorage.setItem(LS.stickColor, normalizeHex(hex)||""); } catch(e){} }

  function applyStickyColorBeforeSend(){
    const hex = getStickColor(); if (!hex) return;
    const l = chatline(); if (!l) return;
    const v = (l.value||"").trimStart();
    if (/^col:\s*#?[0-9a-fA-F]{6}:/i.test(v)) return;
    l.value = `col:${normalizeHex(hex)}:` + (v ? " " : "") + v;
  }

  function ensureActionsButton(){
    const actions = $("#chatwrap .btfw-chat-bottombar #btfw-chat-actions");
    if (!actions) return;
    if ($("#btfw-chattools-btn") || $("#btfw-ct-open")) return;
    const b = document.createElement("button");
    b.id = "btfw-chattools-btn";
    b.className = "button is-dark is-small btfw-chatbtn";
    b.innerHTML = '<span style="font-weight:700;letter-spacing:.5px;">Aa</span>';
    actions.prepend(b);
  }

  function ensureMiniModal(){
    const cw = $("#chatwrap"); if (!cw) return null;
    if ($("#btfw-ct-modal")) return $("#btfw-ct-modal");

    cw.style.position = cw.style.position || "relative";

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
            <button class="btfw-ct-item" data-tag="u"><u>U</u><span>Underline</span></button>
            <button class="btfw-ct-item" data-tag="s"><span style="text-decoration:line-through">S</span><span>Strike</span></button>
            <button class="btfw-ct-item" data-tag="spoiler"><span>🙈</span><span>Spoiler</span></button>
          </div>

          <div class="btfw-ct-color">
            <label class="btfw-ct-keep">
              <input type="checkbox" id="btfw-ct-keepcolor"> Keep color
            </label>
            <div class="btfw-ct-swatch" id="btfw-ct-swatch"></div>

            <div class="btfw-ct-hexrow" style="display:flex; gap:6px; align-items:center; margin-top:6px;">
              <input id="btfw-ct-hex" type="text" placeholder="#rrggbb" maxlength="7" class="input is-small" style="max-width:120px;" />
              <button id="btfw-ct-insertcolor" class="button is-small">Insert</button>
              <button id="btfw-ct-clearcolor" class="button is-small">Clear Keep</button>
            </div>
          </div>

          <div class="btfw-ct-actions" style="display:flex; gap:6px; margin-top:8px;">
            <button class="btfw-ct-item button is-small" data-act="clear">Clear</button>
            <button class="btfw-ct-item button is-small" data-act="afk">AFK</button>
          </div>
        </div>
      </div>
    `;

    // auto-flow button grid + swatches (width-responsive)
    try {
      const grid = modal.querySelector(".btfw-ct-grid");
      if (grid) {
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(92px, 1fr))";
        grid.style.gap = "8px";
      }
      const sw = modal.querySelector("#btfw-ct-swatch");
      if (sw) {
        sw.style.display = "grid";
        sw.style.gridTemplateColumns = "repeat(auto-fit, minmax(28px, 1fr))";
        sw.style.gap = "6px";
      }
    } catch(e){}

    cw.appendChild(modal);
    return modal;
  }

  function openMiniModal(){
    const m = ensureMiniModal(); if (!m) return;

    (function syncKeepColorUI(){
      const keep  = document.getElementById("btfw-ct-keepcolor");
      const hexEl = document.getElementById("btfw-ct-hex");
      const stored = (typeof getStickColor === "function" && getStickColor()) || "";
      if (keep) keep.checked = !!stored;
      if (hexEl && stored) hexEl.value = stored;
      if (keep && keep.checked && !stored) keep.checked = false;
    })();

    m.classList.add("is-active");
    positionMiniModal();
  }
  function closeMiniModal(){
    const m = $("#btfw-ct-modal");
    if (m) m.classList.remove("is-active");
  }

  function positionMiniModal(){
    const m = document.getElementById("btfw-ct-modal"); if (!m) return;
    const card = m.querySelector(".btfw-ct-card"); if (!card) return;

    // Prefer the global helper (aligns above .btfw-chat-bottombar)
    if (window.BTFW_positionPopoverAboveChatBar) {
      window.BTFW_positionPopoverAboveChatBar(card, {
        widthFromChatwrap: true,
        minWidthPx: 360,
        maxWidthPx: 640,
        maxHpx: 360,
        maxHvh: 60
      });
      return;
    }

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

  function wire(){
    ensureActionsButton();
    ensureMiniModal();

    const toolsBtn = $("#btfw-chattools-btn") || $("#btfw-ct-open");
    if (toolsBtn) {
      toolsBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const m = $("#btfw-ct-modal");
        const isActive = m && m.classList.contains("is-active");
        if (isActive) { closeMiniModal(); } else { openMiniModal(); }
      }, { capture: true });
    }

    document.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest(".btfw-ct-close")) {
        e.preventDefault(); closeMiniModal(); return;
      }

      const cardRoot = $("#btfw-ct-modal .btfw-ct-card");

      const bb = e.target.closest && e.target.closest(".btfw-ct-item[data-tag]");
      if (bb && cardRoot && e.target.closest("#btfw-ct-modal .btfw-ct-card")) {
        e.preventDefault(); wrapWithTag(bb.dataset.tag); closeMiniModal(); return;
      }

      const afk = e.target.closest && e.target.closest('.btfw-ct-item[data-act="afk"]');
      if (afk && cardRoot && e.target.closest("#btfw-ct-modal .btfw-ct-card")) {
        e.preventDefault(); if (window.socket?.emit) window.socket.emit("chatMsg", { msg: "/afk" }); closeMiniModal(); return;
      }
      const clr = e.target.closest && e.target.closest('.btfw-ct-item[data-act="clear"]');
      if (clr && cardRoot && e.target.closest("#btfw-ct-modal .btfw-ct-card")) {
        e.preventDefault(); const mb = $("#messagebuffer"); if (mb) mb.innerHTML = ""; closeMiniModal(); return;
      }

      const swb = e.target.closest && e.target.closest(".btfw-ct-swatchbtn");
      if (swb && cardRoot && e.target.closest("#btfw-ct-modal .btfw-ct-card")) {
        e.preventDefault();
        const swHex = normalizeHex(swb.dataset.color || "");
        const hexEl = $("#btfw-ct-hex"); if (hexEl) hexEl.value = swHex;
        const keep = $("#btfw-ct-keepcolor"); if (keep && keep.checked) setStickColor(swHex);
        return;
      }

      if (e.target && e.target.id === "btfw-ct-insertcolor" && cardRoot && e.target.closest("#btfw-ct-modal .btfw-ct-card")) {
        e.preventDefault();
        const hexEl = $("#btfw-ct-hex");
        const hex = normalizeHex((hexEl?.value || "").trim());
        if (hex) {
          applyColPrefix(hex);
          const keep = $("#btfw-ct-keepcolor"); if (keep && keep.checked) setStickColor(hex);
          closeMiniModal();
        }
        return;
      }

      if (e.target && e.target.id === "btfw-ct-clearcolor" && cardRoot && e.target.closest("#btfw-ct-modal .btfw-ct-card")) {
        e.preventDefault(); setStickColor(""); const keep = $("#btfw-ct-keepcolor"); if (keep) keep.checked = false; return;
      }

      if (cardRoot &&
          !e.target.closest("#btfw-ct-modal .btfw-ct-card") &&
          !e.target.closest("#btfw-chattools-btn") &&
          !e.target.closest("#btfw-ct-open")) {
        closeMiniModal(); return;
      }
    }, true);

    document.addEventListener("change", (e)=>{
      if (e.target && e.target.id === "btfw-ct-keepcolor") {
        const hexEl = $("#btfw-ct-hex");
        const hex = normalizeHex((hexEl?.value || "").trim());
        if (e.target.checked) {
          if (hex) { setStickColor(hex); } else { setStickColor(""); e.target.checked = false; }
        } else {
          setStickColor("");
        }
        return;
      }
    }, true);

    document.addEventListener("input", (e)=>{
      if (e.target && e.target.id === "btfw-ct-hex") {
        const keep = $("#btfw-ct-keepcolor");
        if (keep && keep.checked) {
          const val = normalizeHex((e.target.value || "").trim());
          setStickColor(val);
        }
      }
    }, true);

    document.addEventListener("keydown", (e)=>{
      if (e.key === "Escape") closeMiniModal();
    }, true);

    const l = chatline(); if (l) {
      l.addEventListener("keydown", (ev)=>{
        if (ev.key === "Enter" && !ev.shiftKey) {
          applyStickyColorBeforeSend();  commitToHist(l.value.trim());
        }
        if (ev.key === "ArrowUp" && !ev.shiftKey && l.selectionStart===l.selectionEnd && l.selectionStart===0) {
          ev.preventDefault(); histUpDown(-1);
        }
        if (ev.key === "ArrowDown" && !ev.shiftKey && l.selectionStart===l.selectionEnd && l.selectionStart===l.value.length) {
          ev.preventDefault(); histUpDown(+1);
        }
      });
    }

    window.addEventListener("resize", positionMiniModal);
    window.addEventListener("resize", positionMiniModal); // (kept as-is; existing code)
    $("#chatwrap")?.addEventListener("scroll", positionMiniModal, { passive:true });
  }

  function boot(){ wire(); positionMiniModal(); }
  document.addEventListener("btfw:layoutReady", ()=>setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  return { name: "feature:chat-tools" };
});
