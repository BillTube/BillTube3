/* BillTube Framework — feature:chat-tools
   Mini panel above chat input: BBCode buttons, AFK/Clear, and Color tools.
   Color uses BillTube2 format: prefix 'col:#RRGGBB:' at the start of the message.
*/
BTFW.define("feature:chat-tools", ["feature:chat", "util:chat-popover"], async ({ init }) => {
  const motion = await init("util:motion");
  const chatPopover = await init("util:chat-popover");
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS = {
    hist:       "btfw:chat:history",
    stickColor: "btfw:chat:stickColor" // "#rrggbb" or ""
  };

  const COLORS = [
    // reds / oranges
    "#e74c3c","#c0392b","#ff6b6b","#a94136","#e67e22","#d35400","#ff9f43",
    // yellows / warm
    "#f1c40f","#f39c12","#feca57","#b49255","#87724b",
    // greens
    "#2ecc71","#27ae60","#1abc9c","#16a085","#00b894","#55efc4","#9ba37e",
    // blues / teals
    "#3498db","#2980b9","#0984e3","#0080a5","#00cec9","#54a0ff","#74b9ff",
    // purples
    "#9b59b6","#8e44ad","#6c5ce7","#a29bfe","#7300a7",
    // pinks
    "#e84393","#fd79a8","#ec87bf","#d870ad","#f69785",
    // neutrals
    "#ffffff","#dfe6e9","#b2bec3","#95a5a6","#7f8c8d","#34495e","#2c3e50"
  ];

  /* ---------- one-time cleanup: never color usernames ---------- */
  try { localStorage.removeItem("btfw:chat:nameColor"); } catch(e){}
  (function clearUsernameTint(){
    $$("#messagebuffer .username, #messagebuffer .nick, #messagebuffer .name")
      .forEach(n => { try { n.style.color = ""; } catch(e){} });
  })();

  /* ---------- helpers ---------- */
  const chatline = () => $("#chatline");

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
    const pos = l.value.length;
    l.focus(); l.setSelectionRange(pos, pos);
  }

  function getStickColor(){ try { return localStorage.getItem(LS.stickColor)||""; } catch(e){ return ""; } }
  function setStickColor(hex){ try { localStorage.setItem(LS.stickColor, normalizeHex(hex)||""); } catch(e){} }

  function applyStickyColorBeforeSend(){
    const hex = getStickColor(); if (!hex) return;
    const l = chatline(); if (!l) return;
    const v = (l.value||"").trimStart();
    if (/^col:\s*#?[0-9a-fA-F]{6}:/i.test(v)) return; // already has color prefix
    l.value = `col:${normalizeHex(hex)}:` + (v ? " " : "") + v;
  }

  /* ---------- UI: actions button + mini panel ---------- */
  // Built on the shared util:chat-popover — same open/close, positioning,
  // live-resize re-fit, click-outside and Escape as the other mini popovers.
  // The card keeps its #btfw-ct-modal / .btfw-ct-card structure so all existing
  // CSS and the in-panel action handlers below keep working unchanged.
  // Tint the little preview chip + reflect the current hex value.
  function updateHexPreview(hex){
    const pv = document.getElementById("btfw-ct-hexpreview");
    if (!pv) return;
    const h = normalizeHex(hex || "");
    pv.style.background = h || "transparent";
    pv.classList.toggle("is-empty", !h);
  }
  // Highlight the swatch matching the given hex (clears others).
  function markSelectedSwatch(hex){
    const h = normalizeHex(hex || "");
    document.querySelectorAll("#btfw-ct-swatch .btfw-ct-swatchbtn").forEach(b => {
      b.classList.toggle("is-selected", !!h && normalizeHex(b.dataset.color || "") === h);
    });
  }

  function syncKeepColorUI(){
    const keep  = document.getElementById("btfw-ct-keepcolor");
    const hexEl = document.getElementById("btfw-ct-hex");
    const stored = (typeof getStickColor === "function" && getStickColor()) || "";
    if (keep) keep.checked = !!stored;
    if (hexEl && stored) hexEl.value = stored;
    if (keep && keep.checked && !stored) keep.checked = false;
    updateHexPreview(stored || (hexEl && hexEl.value) || "");
    markSelectedSwatch(stored || (hexEl && hexEl.value) || "");
  }

  function buildSwatchesOnce(){
    const sw = document.querySelector("#btfw-ct-swatch");
    if (sw && !sw.hasChildNodes()) {
      COLORS.forEach(c => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btfw-ct-swatchbtn";
        b.style.background = c;
        b.dataset.color = c;
        b.title = c;
        b.setAttribute("aria-label", "Color " + c);
        sw.appendChild(b);
      });
    }
  }

  let _ctPop = null;
  function getPopover(){
    if (_ctPop) return _ctPop;
    _ctPop = chatPopover.create({
      id: "btfw-ct-modal",
      cardClass: "btfw-ct-card",
      parent: () => document.getElementById("chatwrap") || document.body,
      once: true,
      opts: { widthPx: 420, widthVw: 92, maxHpx: 360, maxHvh: 60 },
      toggleSelector: "#btfw-chattools-btn, #btfw-ct-open",
      build: () => `
        <div class="btfw-ct-card">
          <div class="btfw-ct-cardhead">
            <span>Chat Tools</span>
            <button class="btfw-ct-close" data-btfw-popover-close aria-label="Close">&times;</button>
          </div>

          <div class="btfw-ct-body">
            <!-- Formatting -->
            <section class="btfw-ct-sec">
              <div class="btfw-ct-seclabel">Format</div>
              <div class="btfw-ct-grid">
                <button class="btfw-ct-item" data-tag="b" title="Bold"><strong>B</strong><span>Bold</span></button>
                <button class="btfw-ct-item" data-tag="i" title="Italic"><em>I</em><span>Italic</span></button>
                <button class="btfw-ct-item" data-tag="u" title="Underline"><u>U</u><span>Underline</span></button>
                <button class="btfw-ct-item" data-tag="s" title="Strikethrough"><span class="btfw-ct-strike">S</span><span>Strike</span></button>
                <button class="btfw-ct-item" data-tag="sp" title="Spoiler"><span>🙈</span><span>Spoiler</span></button>
              </div>
            </section>

            <!-- Color -->
            <section class="btfw-ct-sec">
              <div class="btfw-ct-seclabel">Color</div>
              <div class="btfw-ct-swatch" id="btfw-ct-swatch"></div>
              <div class="btfw-ct-colorrow">
                <div class="btfw-ct-hexwrap">
                  <span class="btfw-ct-hexpreview" id="btfw-ct-hexpreview" aria-hidden="true"></span>
                  <input id="btfw-ct-hex" type="text" placeholder="#rrggbb" maxlength="7" spellcheck="false" autocomplete="off" />
                  <button id="btfw-ct-insertcolor" type="button" class="btfw-ct-apply">Apply</button>
                </div>
                <label class="btfw-ct-switch" title="Keep this color on your next messages">
                  <input type="checkbox" id="btfw-ct-keepcolor">
                  <span class="btfw-ct-switchtrack"><span class="btfw-ct-switchknob"></span></span>
                  <span class="btfw-ct-switchlabel">Keep color</span>
                </label>
              </div>
            </section>

            <!-- Actions -->
            <section class="btfw-ct-sec">
              <div class="btfw-ct-seclabel">Actions</div>
              <div class="btfw-ct-actions">
                <button class="btfw-ct-action" data-act="afk" type="button"><i class="fa fa-mug-hot" aria-hidden="true"></i><span>AFK</span></button>
                <button class="btfw-ct-action" data-act="clear" type="button"><i class="fa fa-eraser" aria-hidden="true"></i><span>Clear chat</span></button>
              </div>
            </section>
          </div>
        </div>`,
      onOpen: () => syncKeepColorUI()
    });
    return _ctPop;
  }

  function ensureMiniModal(){
    getPopover().ensure();
    buildSwatchesOnce();
    return document.getElementById("btfw-ct-modal");
  }

  function openMiniModal(){ ensureMiniModal(); getPopover().open(); }
  function closeMiniModal(){ if (_ctPop) _ctPop.close(); }

  function ensureActionsButton(){
    const actions = $("#chatwrap .btfw-chat-bottombar #btfw-chat-actions");
    if (!actions) return;

    // Use distinct id for Chat Tools; do not reuse Chat Commands id
    if ($("#btfw-chattools-btn") || $("#btfw-ct-open")) return;

    const b = document.createElement("button");
    b.id = "btfw-chattools-btn";
    b.className = "button is-dark is-small btfw-chatbtn";
    b.innerHTML = '<span style="font-weight:700;letter-spacing:.5px;">Aa</span>';
    // The reference button may live inside the left-actions pill (a nested
    // container), so insertBefore would throw ("not a child of this node").
    // Only insert before it when it's a direct child; otherwise append and let
    // feature:chat's grouping place it into the pill.
    const ref = actions.querySelector("#btfw-chatcmds-btn")
      || actions.querySelector("#btfw-users-toggle")
      || actions.querySelector("#usercount");
    if (ref && ref.parentElement === actions) actions.insertBefore(b, ref);
    else actions.appendChild(b);
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
    if (window._btfwChatToolsWired) return;
    window._btfwChatToolsWired = true;

    ensureActionsButton();
    ensureMiniModal();

    // Toggle Chat Tools (open/close) on its own button
    const toolsBtn = $("#btfw-chattools-btn") || $("#btfw-ct-open");
    if (toolsBtn) {
      toolsBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        getPopover().isOpen() ? closeMiniModal() : openMiniModal();
      }, { capture: true });
    }

    // Doc-level: in-panel actions inside the Tools panel. Close, click-outside
    // and Escape are owned by util:chat-popover now.
    document.addEventListener("click", (e) => {
      // --- In-panel actions (run only if click happened inside the card) ---
      const inCard = e.target.closest && e.target.closest("#btfw-ct-modal .btfw-ct-card");

      // BBCode buttons (one-shot)
      const bb = e.target.closest && e.target.closest(".btfw-ct-item[data-tag]");
      if (bb && inCard) {
        e.preventDefault();
        wrapWithTag(bb.dataset.tag);
        closeMiniModal();
        return;
      }

      // AFK / Clear
      const afk = e.target.closest && e.target.closest('[data-act="afk"]');
      if (afk && inCard) {
        e.preventDefault();
        if (window.socket?.emit) window.socket.emit("chatMsg", { msg: "/afk" });
        closeMiniModal();
        return;
      }
      const clr = e.target.closest && e.target.closest('[data-act="clear"]');
      if (clr && inCard) {
        e.preventDefault();
        const mb = $("#messagebuffer"); if (mb) mb.innerHTML = "";
        closeMiniModal();
        return;
      }

      // Color swatch -> fill hex box (if Keep is on, persist immediately)
      const swb = e.target.closest && e.target.closest(".btfw-ct-swatchbtn");
      if (swb && inCard) {
        e.preventDefault();
        const swHex = normalizeHex(swb.dataset.color || "");
        const hexEl = $("#btfw-ct-hex");
        if (hexEl) hexEl.value = swHex;
        markSelectedSwatch(swHex);
        updateHexPreview(swHex);
        const keep = $("#btfw-ct-keepcolor");
        if (keep && keep.checked) setStickColor(swHex);
        return;
      }

      // Apply color button -> apply prefix in input now
      if (e.target && e.target.closest && e.target.closest("#btfw-ct-insertcolor") && inCard) {
        e.preventDefault();
        const hexEl = $("#btfw-ct-hex");
        const hex = normalizeHex((hexEl?.value || "").trim());
        if (hex) {
          applyColPrefix(hex);
          const keep = $("#btfw-ct-keepcolor");
          if (keep && keep.checked) setStickColor(hex);
          closeMiniModal();
        }
        return;
      }
    }, true);

    // Keep color toggle
    document.addEventListener("change", (e)=>{
      if (e.target && e.target.id === "btfw-ct-keepcolor") {
        const hexEl = $("#btfw-ct-hex");
        const hex = normalizeHex((hexEl?.value || "").trim());

        if (e.target.checked) {
          if (hex) {
            setStickColor(hex);   // persist the chosen color
          } else {
            // no valid hex → don’t allow Keep to stay on
            setStickColor("");
            e.target.checked = false;
          }
        } else {
          // turned off → clear stored color
          setStickColor("");
        }
        return;
      }
    }, true);

    // Live preview while typing a hex; persist too if Keep is checked.
    document.addEventListener("input", (e)=>{
      if (e.target && e.target.id === "btfw-ct-hex") {
        const val = normalizeHex((e.target.value || "").trim());
        updateHexPreview(val);
        markSelectedSwatch(val);
        const keep = $("#btfw-ct-keepcolor");
        if (keep && keep.checked) setStickColor(val);
      }
    }, true);

    // Chatline helpers: history + sticky color before send
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

  }

  function boot(){ wire(); }
  document.addEventListener("btfw:layoutReady", ()=>setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  return { name: "feature:chat-tools" };
});