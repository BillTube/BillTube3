
/* feature-layout.js — applies the BillTube layout while preserving original structure */
BTFW.define("feature:layout", ["core","bridge"], async function(ctx){
  var { $, $$, postTask } = BTFW.require("core");
  var { ids, ensure } = BTFW.require("bridge");

  function applyLayout(){
    var el = ids();
    try{
      var nav = el.navCollapsible || $("#nav-collapsible");
      var headRight = document.getElementById("headright");
      if (!headRight && nav) {
        headRight = document.createElement("div");
        headRight.id = "headright";
        headRight.innerHTML = "<div id='progbar'></div>";
        nav.appendChild(headRight);
      }

      var queue = el.playlist;
      var rp = el.rightPane || $("#rightpane");
      if (queue && rp) {
        var container = document.getElementById("queuecontainer");
        if (!container) {
          container = document.createElement("div");
          container.id = "queuecontainer";
          container.className = "section";
          container.innerHTML = "<div class='textheader'><p id='upnext' class='sectionheader'>Playlist</p></div>";
          rp.insertAdjacentElement("afterend", container);
          container.appendChild(queue);
          var upnext = document.getElementById("upnext");
          if (upnext) {
            var plmeta = el.plMeta; if (plmeta) upnext.appendChild(plmeta);
            var plo = el.plOptions; if (plo) upnext.insertAdjacentElement("afterend", plo);
          }
        }
      }

      document.body.classList.add("fluid","btfw-dark");

      var currentTitle = el.currentTitle;
      if (currentTitle) currentTitle.setAttribute("data-fit-text","");
    }catch(e){ console.warn("[BTFW:layout]", e); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyLayout);
  } else {
    applyLayout();
  }

  return { applyLayout };
});
