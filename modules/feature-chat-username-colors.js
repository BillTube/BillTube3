BTFW.define("feature:chat-username-colors", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const LS = "btfw:chat:unameColors"; // "1" | "0"

  function getEnabled(){ try { return (localStorage.getItem(LS) ?? "1")==="1"; } catch(_) { return true; } }
  function setEnabled(v){ try { localStorage.setItem(LS, v?"1":"0"); } catch(_){} applyAll(); }

  // Palette (pleasant, readable on dark)
  const PALETTE = [
    "#6D4DF6","#2CB1BC","#F29D49","#E85D75","#5AC26A",
    "#B980F0","#59A1FF","#ED6A5E","#F2C94C","#00B894",
    "#E84393","#0984E3","#55EFC4","#FAB1A0","#A29BFE"
  ];

  //  simple fast hash → palette index
  function pickColor(name){
    let h=0; for (let i=0;i<name.length;i++) { h = Math.imul(31,h) + name.charCodeAt(i) | 0; }
    const idx = Math.abs(h) % PALETTE.length;
    return PALETTE[idx];
  }

  // Try reading a color from the userlist (if theme sets one); else fallback to hash
  function colorFor(name){
    const li = findUserlistItem(name);
    const color = li?.getAttribute?.("data-color")
               || li?.style?.color
               || null;
    return color || pickColor(name);
  }

  function findUserlistItem(name){
    if (!name) return null;
    // common structures: #userlist li[data-name], or a span with text
    const byData = document.querySelector(`#userlist li[data-name="${CSS.escape(name)}"]`);
    if (byData) return byData;
    const items = document.querySelectorAll("#userlist li, #userlist .userlist_item, #userlist .user");
    for (const el of items) {
      const t = (el.textContent || "").trim();
      if (t && t.replace(/\s+/g,"").toLowerCase().startsWith(name.toLowerCase())) return el;
    }
    return null;
  }

  function tint(el, name){
    if (!el || !name) return;
    const on = getEnabled();
    if (!on) {
      el.style.removeProperty("--btfw-name-color");
      el.classList.remove("btfw-username-colored");
      return;
    }
    const c = colorFor(name);
    el.style.setProperty("--btfw-name-color", c);
    el.classList.add("btfw-username-colored");
  }

  function processNode(node){
    if (!node) return;
    const list = node.matches?.(".username") ? [node]
               : (node.querySelectorAll?.(".username") || []);
    list.forEach(u => {
      // Extract "name" without the trailing colon
      const raw = (u.textContent || "").trim();
      const name = raw.replace(/:\s*$/, "");
      if (!name) return;
      tint(u, name);
    });
  }

  function applyAll(){
    const buf = document.getElementById("messagebuffer");
    if (buf) processNode(buf);
  }

  function boot(){
    // Initial pass
    applyAll();
    // Observe new messages
    const buf = document.getElementById("messagebuffer");
    if (buf && !buf._btfwNameColorMO){
      const mo = new MutationObserver(muts=>{
        for (const m of muts) {
          if (m.type==="childList" && m.addedNodes) {
            m.addedNodes.forEach(n => { if (n.nodeType===1) processNode(n); });
          }
        }
      });
      mo.observe(buf, { childList:true, subtree:true });
      buf._btfwNameColorMO = mo;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:chat-username-colors", getEnabled, setEnabled, reapply: applyAll };
});
