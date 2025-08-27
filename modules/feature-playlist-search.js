
/* feature-playlist-search.js — live filtering of playlist items (debounced) */
BTFW.define("feature:playlistSearch", ["core","bridge"], async function(ctx){
  var { $, $$ } = BTFW.require("core");
  var { ids } = BTFW.require("bridge");

  function debounce(fn, ms){
    var t=null; return function(){ clearTimeout(t); var a=arguments; t=setTimeout(function(){ fn.apply(null,a); }, ms); };
  }

  function boot(){
    var el = ids();
    var container = document.getElementById("queuecontainer");
    var queue = el.playlist;
    if (!container || !queue) return;

    if (!container.querySelector(".btfw-pl-search")) {
      var div = document.createElement("div");
      div.className = "btfw-pl-search-wrap";
      div.innerHTML = "<input type='text' class='btfw-pl-search' placeholder='Name Search' />";
      container.firstElementChild && container.firstElementChild.appendChild(div);
      var input = div.querySelector("input");
      input.addEventListener("keyup", debounce(function(){
        var term = input.value.trim().toLowerCase();
        var items = queue.children;
        var visible = 0;
        for (var i=0;i<items.length;i++){
          var it = items[i];
          var match = it.textContent.toLowerCase().indexOf(term) >= 0;
          it.style.display = match ? "" : "none";
          if (match) visible++;
        }
      }, 200));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  return {};
});
