
BTFW.define("feature:layout", ["feature:bulma"], async ({ require }) => {
  function setTopOffsetVar(){
    var header=document.querySelector(".navbar, #nav-collapsible, #navbar");
    var h=header?header.offsetHeight:48;
    document.documentElement.style.setProperty("--btfw-top", h + "px");
  }

  const BOOT=/^(col(-(xs|sm|md|lg|xl))?-(\d+|auto)|row|container(-fluid)?|pull-(left|right)|offset-\d+)$/;
  function stripClassesOn(el){
    if(!el||!el.classList) return;
    var rm=[]; el.classList.forEach(c=>{ if(BOOT.test(c)) rm.push(c); });
    rm.forEach(c=>el.classList.remove(c));
  }
  function stripVideoWrapDeep(){
    var vr=document.getElementById("videowrap"); if(!vr) return;
    stripClassesOn(vr); vr.querySelectorAll("[class]").forEach(stripClassesOn);
  }
  function neutralizeCommonBlocks(){
    ["videowrap","playlistrow","playlistwrap","queuecontainer","queue","plmeta"].forEach(id=>stripClassesOn(document.getElementById(id)));
  }

  function killVideoHeader(){
    var vh=document.getElementById("videowrap-header");
    if(vh&&vh.parentNode) vh.parentNode.removeChild(vh);
  }
  function observeVideoWrap(){
    var vw=document.getElementById("videowrap"); if(!vw) return;
    new MutationObserver(list=>list.forEach(r=>r.addedNodes&&r.addedNodes.forEach(n=>{
      if(n.nodeType!==1) return;
      if(n.id==="videowrap-header" || n.querySelector?.("#videowrap-header")) killVideoHeader();
      stripVideoWrapDeep();
    }))).observe(vw,{childList:true,subtree:true});
  }

  function ensureShell(){
    var wrap=document.getElementById("wrap") || document.body;
    setTopOffsetVar();
    addEventListener("resize", setTopOffsetVar);

    if(!document.getElementById("btfw-grid")){
      var grid=document.createElement("div"); grid.id="btfw-grid"; grid.className="btfw-grid";
      var left=document.getElementById("btfw-leftpad")||document.createElement("div"); left.id="btfw-leftpad"; left.className="btfw-leftpad";
      var right=document.getElementById("btfw-chatcol")||document.createElement("aside"); right.id="btfw-chatcol"; right.className="btfw-chatcol";
      var video=document.getElementById("videowrap");
      var chat=document.getElementById("chatwrap");
      var queue=document.getElementById("playlistrow")||document.getElementById("playlistwrap")||document.getElementById("queuecontainer");
      if(video && !left.contains(video)) left.appendChild(video);
      if(queue && !left.contains(queue)) left.appendChild(queue);
      if(chat && !right.contains(chat)) right.appendChild(chat);
      grid.appendChild(left);
      var split=document.createElement("div"); split.id="btfw-vsplit"; grid.appendChild(split);
      grid.appendChild(right);
      wrap.prepend(grid);
    }

    neutralizeCommonBlocks();
    stripVideoWrapDeep();
    killVideoHeader();
    observeVideoWrap();
  }

  function ready(){ document.dispatchEvent(new Event("btfw:layoutReady")); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ ensureShell(); ready(); });
  else { ensureShell(); ready(); }

  return { name:"feature:layout" };
});
