
/* feature-chat.js — username coloring & MutationObserver for new messages */
BTFW.define("feature:chat", ["core","bridge"], async function(ctx){
  var { $, $$ } = BTFW.require("core");
  var { ids } = BTFW.require("bridge");

  var colorCache = new Map();
  function stringToColour(str){
    var hash=0;
    for (var i=0;i<str.length;i++){ hash = str.charCodeAt(i) + ((hash<<5)-hash); }
    var colour = "#";
    for (var i=0;i<3;i++){ var value = (hash >> (i*8)) & 0xFF; colour += ("00"+value.toString(16)).slice(-2); }
    return colour;
  }
  function colorForUser(name){
    if (!colorCache.has(name)) colorCache.set(name, stringToColour(name));
    return colorCache.get(name);
  }

  function styleMessage(el){
    try{
      var u = el.querySelector(".username");
      if (!u) return;
      var name = u.textContent.replace(":", "").trim();
      u.style.color = colorForUser(name);
    }catch(e){}
  }

  function boot(){
    var buf = ids().messageBuffer || $("#messagebuffer");
    if (!buf) return;
    $$(".username", buf).forEach(function(u){
      var name = u.textContent.replace(":", "").trim();
      u.style.color = colorForUser(name);
    });
    var mo = new MutationObserver(function(muts){
      for (var i=0;i<muts.length;i++){
        var m=muts[i];
        for (var j=0;j<m.addedNodes.length;j++){
          var n=m.addedNodes[j];
          if (n.nodeType===1){ styleMessage(n); }
        }
      }
    });
    mo.observe(buf, {childList:true});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  return { };
});
