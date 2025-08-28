
BTFW.define("feature:layout", ["feature:styleCore","feature:bulma"], async ({}) => {
  function setTop(){
    const header = document.querySelector(".navbar, #nav-collapsible, #navbar, .navbar-fixed-top");
    const h = header ? header.offsetHeight : 48;
    document.documentElement.style.setProperty("--btfw-top", h + "px");
  }
  const BOOT=/^(col(-(xs|sm|md|lg|xl))?-(\d+|auto)|row|container(-fluid)?|pull-(left|right)|offset-\d+)$/;
  function stripDeep(root){ if(!root) return; (root.classList||[]).forEach(c=>{ if(BOOT.test(c)) root.classList.remove(c); }); root.querySelectorAll("[class]").forEach(el=>{ Array.from(el.classList).forEach(c=>{ if(BOOT.test(c)) el.classList.remove(c); }); }); }
  function moveCurrent(){ const vh=document.getElementById("videowrap-header"); if(!vh) return; const ct=vh.querySelector("#currenttitle"); const top=document.querySelector("#chatwrap .btfw-chat-topbar"); if(ct&&top){ let slot=top.querySelector("#btfw-nowplaying-slot"); if(!slot){ slot=document.createElement("div"); slot.id="btfw-nowplaying-slot"; slot.className="btfw-chat-title"; top.innerHTML=""; top.appendChild(slot);} slot.appendChild(ct);} vh.remove(); }
  function ensureShell(){
    const wrap=document.getElementById("wrap")||document.body; const v=document.getElementById("videowrap"); const c=document.getElementById("chatwrap"); const q=document.getElementById("playlistrow")||document.getElementById("playlistwrap")||document.getElementById("queuecontainer");
    if(!document.getElementById("btfw-grid")){
      const grid=document.createElement("div"); grid.id="btfw-grid";
      const left=document.createElement("div"); left.id="btfw-leftpad";
      const right=document.createElement("aside"); right.id="btfw-chatcol";
      if(v) left.appendChild(v); if(q) left.appendChild(q); if(c) right.appendChild(c);
      const split=document.createElement("div"); split.id="btfw-vsplit";
      grid.appendChild(left); grid.appendChild(split); grid.appendChild(right);
      wrap.prepend(grid);
    } else {
      const left=document.getElementById("btfw-leftpad"); const right=document.getElementById("btfw-chatcol");
      const v=document.getElementById("videowrap"); const c=document.getElementById("chatwrap"); const q=document.getElementById("playlistrow")||document.getElementById("playlistwrap")||document.getElementById("queuecontainer");
      if(v && !left.contains(v)) left.appendChild(v); if(q && !left.contains(q)) left.appendChild(q); if(c && !right.contains(c)) right.appendChild(c);
    }
    ["videowrap","playlistrow","playlistwrap","queuecontainer","queue","plmeta","chatwrap"].forEach(id=>stripDeep(document.getElementById(id)));
    moveCurrent();
  }
  function ready(){ document.dispatchEvent(new Event("btfw:layoutReady")); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ ensureShell(); setTop(); ready(); });
  else { ensureShell(); setTop(); ready(); }
  setTimeout(setTop, 500);
  return {name:"feature:layout"};
});
