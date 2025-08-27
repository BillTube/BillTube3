BTFW.define("feature:layout", ["core"], async ({ require }) => {
  function removeVideoHeaderOnce(){
    var vh = document.getElementById("videowrap-header");
    if (vh && vh.parentNode) vh.parentNode.removeChild(vh);
  }
  function watchVideoHeader(){
    var v = document.getElementById("videowrap");
    if (!v) return;
    removeVideoHeaderOnce();
    var mo = new MutationObserver(function(m){
      m.forEach(function(r){
        if (r.addedNodes) r.addedNodes.forEach(function(n){
          if (!n) return;
          if (n.id === "videowrap-header" || (n.querySelector && n.querySelector("#videowrap-header"))) {
            removeVideoHeaderOnce();
          }
        });
      });
    });
    mo.observe(v, { childList: true, subtree: true });
  }

  function ensureShell(){
    var wrap = document.getElementById("wrap") || document.body;

    removeVideoHeaderOnce();
    watchVideoHeader();

    var topnav = document.querySelector("#nav-collapsible") || document.querySelector(".navbar") || document;
    if (!document.getElementById("btfw-theme-settings-btn")){
      var btn = document.createElement("button");
      btn.id = "btfw-theme-settings-btn";
      btn.className = "btfw-topbtn";
      btn.title = "Theme settings";
      btn.innerHTML = "<i class=\"fa fa-sliders\"></i>";
      btn.addEventListener("click", function(){ document.dispatchEvent(new CustomEvent("btfw:openThemeSettings")); });
      (document.querySelector("#userdropdown")?.parentElement || topnav).appendChild(btn);
    }

    if (!document.getElementById("btfw-grid")){
      var grid = document.createElement("div"); grid.id = "btfw-grid"; grid.className = "btfw-grid";

      // --- BTFW CHANGE START ---
      // 1. Create the new left sidebar element
      var leftSidebar = document.createElement("nav");
      leftSidebar.id = "btfw-left-sidebar";
      leftSidebar.className = "btfw-left-sidebar";
      // Add placeholder content for now
      leftSidebar.innerHTML = `<button class="btfw-sidebar-btn" title="Home"><i class="fa fa-home"></i></button>`;
      // --- BTFW CHANGE END ---

      var left = document.getElementById("btfw-leftpad") || document.createElement("div"); left.id = "btfw-leftpad"; left.className = "btfw-leftpad";
      var right = document.getElementById("btfw-chatcol") || document.createElement("aside"); right.id = "btfw-chatcol"; right.className = "btfw-chatcol";
      var video = document.getElementById("videowrap");
      var chat  = document.getElementById("chatwrap");
      var queue = document.getElementById("playlistrow") || document.getElementById("playlistwrap") || document.getElementById("queuecontainer");
      if (video && !left.contains(video)) left.appendChild(video);
      if (queue && !left.contains(queue)) left.appendChild(queue);
      if (chat && !right.contains(chat)) right.appendChild(chat);
      
      // --- BTFW CHANGE START ---
      // 2. Prepend the new sidebar and then append the other columns
      grid.appendChild(leftSidebar);
      // --- BTFW CHANGE END ---

      grid.appendChild(left);
      grid.appendChild(right);
      wrap.prepend(grid);
    }
  }

  function ready(){ document.dispatchEvent(new Event("btfw:layoutReady")); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ ensureShell(); ready(); });
  else { ensureShell(); ready(); }

  return { name: "feature:layout" };
});