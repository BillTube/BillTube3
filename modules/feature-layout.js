
BTFW.define("feature:layout", ["feature:styleCore","feature:bulma"], async ({}) => {
  function setTopOffsetVar(){
    const header = document.querySelector(".navbar, #nav-collapsible, #navbar, header.navbar, .navbar-fixed-top");
    const h = header ? header.offsetHeight : 48;
    document.documentElement.style.setProperty("--btfw-top", h + "px");
  }
  function wireTopOffset(){
    setTopOffsetVar();
    window.addEventListener("resize", setTopOffsetVar);
    const header = document.querySelector(".navbar, #nav-collapsible, #navbar, .navbar-fixed-top");
    if (header && "ResizeObserver" in window) new ResizeObserver(setTopOffsetVar).observe(header);
    setTimeout(setTopOffsetVar, 500); setTimeout(setTopOffsetVar, 2000);
  }
  const BOOT = /^(col(-(xs|sm|md|lg|xl))?-(\d+|auto)|row|container(-fluid)?|pull-(left|right)|offset-\d+)$/;
  function stripClassesOn(el){ if (!el||!el.classList) return; const rm=[]; el.classList.forEach(c=>{ if(BOOT.test(c)) rm.push(c); }); rm.forEach(c=>el.classList.remove(c)); }
  function stripDeep(root){ if(!root) return; stripClassesOn(root); root.querySelectorAll("[class]").forEach(stripClassesOn); }
  function neutralizeCommonBlocks(){ ["videowrap","playlistrow","playlistwrap","queuecontainer","queue","plmeta"].forEach(id=>stripDeep(document.getElementById(id))); }
  function neutralizeChatWrap(){ const cw=document.getElementById("chatwrap"); stripDeep(cw); }
  function killVideoHeader(){
    const vh=document.getElementById("videowrap-header");
    if (vh){
      const ct = vh.querySelector("#currenttitle");
      if (ct){
        const top = document.querySelector("#chatwrap .btfw-chat-topbar");
        if (top){
          let slot = top.querySelector("#btfw-nowplaying-slot");
          if (!slot){ slot=document.createElement("div"); slot.id="btfw-nowplaying-slot"; slot.className="btfw-chat-title"; top.innerHTML=""; top.appendChild(slot); }
          slot.appendChild(ct);
        }
      }
      vh.parentNode.removeChild(vh);
    }
  }
  function observeVideoWrap(){
    const vw=document.getElementById("videowrap"); if(!vw) return;
    new MutationObserver(list=>list.forEach(r=>r.addedNodes&&r.addedNodes.forEach(n=>{
      if(n.nodeType!==1) return;
      if(n.id==="videowrap-header" || n.querySelector?.("#videowrap-header")) killVideoHeader();
      if(n.id==="videowrap" || n.closest?.("#videowrap")) stripDeep(document.getElementById("videowrap"));
    }))).observe(vw,{childList:true,subtree:true});
  }
  function ensureShell(){
    const wrap=document.getElementById("wrap")||document.body;
    const video=document.getElementById("videowrap");
    const chat=document.getElementById("chatwrap");
    const queue=document.getElementById("playlistrow")||document.getElementById("playlistwrap")||document.getElementById("queuecontainer");
    if(!document.getElementById("btfw-grid")){
      const grid=document.createElement("div"); grid.id="btfw-grid"; grid.className="btfw-grid";
      const left=document.createElement("div"); left.id="btfw-leftpad"; left.className="btfw-leftpad";
      const right=document.createElement("aside"); right.id="btfw-chatcol"; right.className="btfw-chatcol";
      if(video) left.appendChild(video);
      if(queue) left.appendChild(queue);
      if(chat) right.appendChild(chat);
      grid.appendChild(left);
      const split=document.createElement("div"); split.id="btfw-vsplit"; grid.appendChild(split);
      grid.appendChild(right);
      wrap.prepend(grid);
    } else {
      const left=document.getElementById("btfw-leftpad");
      const right=document.getElementById("btfw-chatcol");
      if(video && !left.contains(video)) left.appendChild(video);
      if(queue && !left.contains(queue)) left.appendChild(queue);
      if(chat && !right.contains(chat)) right.appendChild(chat);
    }
    neutralizeCommonBlocks(); neutralizeChatWrap(); killVideoHeader(); observeVideoWrap();
  }
  function ready(){ document.dispatchEvent(new Event("btfw:layoutReady")); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ ensureShell(); wireTopOffset(); ready(); });
  else { ensureShell(); wireTopOffset(); ready(); }
  return { name:"feature:layout" };
});
