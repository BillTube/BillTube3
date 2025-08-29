/* BillTube Framework — feature:chat-tools
   BBCode buttons, AFK/Clear, color picker, history, and chat hotkeys. */
BTFW.define("feature:chat-tools", ["feature:chat"], async ({}) => {
  const LS = {
    nameColor: "btfw:chat:nameColor",
    hist:      "btfw:chat:history",
  };
  const COLORS = ["#1abc9c","#16a085","#f1c40f","#f39c12","#2ecc71","#27ae60","#e67e22",
                  "#d35400","#3498db","#2980b9","#e74c3c","#c0392b","#9b59b6","#8e44ad",
                  "#0080a5","#34495e","#2c3e50","#87724b","#7300a7","#ec87bf","#d870ad",
                  "#f69785","#9ba37e","#b49255","#a94136"];
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  /* ---------------- UI placement ---------------- */
  function ensureToolbar() {
    const controls = $("#chatcontrols, #chat-controls") || ($("#chatline") && $("#chatline").parentElement);
    if (!controls) return null;

    let tb = $("#btfw-chattools");
    if (!tb) {
      tb = document.createElement("div");
      tb.id = "btfw-chattools";
      tb.className = "btfw-chattools";
      tb.innerHTML = `
        <div class="btfw-ct-left">
          <button class="button is-dark is-small btfw-ct bb" data-tag="b">B</button>
          <button class="button is-dark is-small btfw-ct bb" data-tag="i"><em>I</em></button>
          <button class="button is-dark is-small btfw-ct bb" data-tag="sp">SP</button>
          <button class="button is-dark is-small btfw-ct bb" data-tag="code">&lt;/&gt;</button>
          <button class="button is-dark is-small btfw-ct bb" data-tag="s"><span style="text-decoration:line-through">S</span></button>
          <button class="button is-dark is-small btfw-ct" id="btfw-ct-clear" title="Clear chat">🧹</button>
          <button class="button is-dark is-small btfw-ct" id="btfw-ct-afk" title="Toggle AFK">🤖</button>
        </div>
        <div class="btfw-ct-right">
          <button class="button is-dark is-small btfw-ct" id="btfw-ct-color" title="Name color">A</button>
          <div id="btfw-ct-swatch" class="btfw-ct-swatch is-hidden"></div>
        </div>
      `;
      controls.prepend(tb);

      // Build swatches
      const sw = $("#btfw-ct-swatch", tb);
      COLORS.forEach(c => {
        const b = document.createElement("button");
        b.className = "btfw-ct-swatchbtn";
        b.style.background = c;
        b.dataset.color = c;
        sw.appendChild(b);
      });
    }
    return tb;
  }

  /* ---------------- helpers ---------------- */
  function chatline() { return $("#chatline"); }
  function insertAround(tag) {
    const line = chatline(); if (!line) return;
    const a = line.selectionStart ?? line.value.length;
    const b = line.selectionEnd ?? line.value.length;
    const left = line.value.slice(0, a);
    const mid  = line.value.slice(a, b);
    const right= line.value.slice(b);
    const t = tag === "sp" ? "sp" : tag;
    line.value = `${left}[${t}]${mid}[/${t}]${right}`;
    const pos = a + t.length + 2 + mid.length + t.length + 3;
    line.focus(); line.setSelectionRange(pos, pos);
  }
  function sendRaw(msg){
    if (window.socket && window.socket.emit) { window.socket.emit("chatMsg",{msg}); }
    else { const l=chatline(); if(l){ l.value = msg + " "; l.focus(); } }
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
    if (histIndex === -1) histIndex = h.length; // point after end
    histIndex += (dir<0 ? -1 : 1);
    histIndex = Math.max(0, Math.min(h.length-1, histIndex));
    l.value = h[histIndex] || "";
    l.focus(); l.setSelectionRange(l.value.length,l.value.length);
  }

  // Color
  function setNameColor(color){
    try{ localStorage.setItem(LS.nameColor, color||""); }catch(e){}
    // Apply to existing messages
    $$("#messagebuffer .username, #messagebuffer .nick, #messagebuffer .name")
      .forEach(n => { if (color) n.style.color = color; else n.style.color = ""; });
  }
  function getNameColor(){ try{ return localStorage.getItem(LS.nameColor)||""; }catch(e){ return ""; } }

  /* ---------------- events ---------------- */
  function wire() {
    // Toolbar buttons
    document.addEventListener("click", function(e){
      const bb = e.target.closest && e.target.closest(".btfw-ct.bb");
      if (bb) { e.preventDefault(); insertAround(bb.dataset.tag); return; }

      if (e.target.id === "btfw-ct-clear") { e.preventDefault(); const mb=$("#messagebuffer"); if(mb) mb.innerHTML=""; return; }
      if (e.target.id === "btfw-ct-afk")   { e.preventDefault(); sendRaw("/afk"); return; }

      if (e.target.id === "btfw-ct-color") {
        e.preventDefault();
        const sw = $("#btfw-ct-swatch"); if (sw) sw.classList.toggle("is-hidden");
        return;
      }
      const swb = e.target.closest && e.target.closest(".btfw-ct-swatchbtn");
      if (swb) { e.preventDefault(); setNameColor(swb.dataset.color); $("#btfw-ct-swatch")?.classList.add("is-hidden"); return; }
    }, true);

    // Chatline key bindings
    const l = chatline(); if (!l) return;
    l.addEventListener("keydown", (ev)=>{
      if (ev.key === "Enter" && !ev.shiftKey) { commitToHist(l.value.trim()); }
      if (ev.key === "ArrowUp" && !ev.shiftKey && l.selectionStart===l.selectionEnd && l.selectionStart===0) { ev.preventDefault(); histUpDown(-1); }
      if (ev.key === "ArrowDown" && !ev.shiftKey && l.selectionStart===l.selectionEnd && l.selectionStart===l.value.length) { ev.preventDefault(); histUpDown(+1); }
      if ((ev.key === "g" || ev.key === "G") && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
        // quick open GIFs when chat has focus
        document.dispatchEvent(new Event("btfw:openGifs"));
      }
      if (ev.key === "l" && ev.ctrlKey) { ev.preventDefault(); $("#messagebuffer")?.replaceChildren(); }
    });

    // Apply stored name color on boot and for new messages
    const saved = getNameColor();
    if (saved) setNameColor(saved);

    const buf = $("#messagebuffer");
    if (buf && !buf._btfw_ct_obs){
      buf._btfw_ct_obs = true;
      new MutationObserver(m => m.forEach(r => r.addedNodes.forEach(n => {
        if (n.nodeType===1 && saved){
          const u = n.querySelector?.(".username,.nick,.name"); if (u) u.style.color = saved;
        }
      }))).observe(buf, {childList:true});
    }
  }

  function boot(){
    ensureToolbar();
    wire();
  }

  // re-run when chat is rebuilt
  document.addEventListener("btfw:layoutReady", ()=>setTimeout(boot, 0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  return { name: "feature:chat-tools" };
});
