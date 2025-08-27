
BTFW.define("feature:chatAvatars",["core"],async function(){
  var {getSetting,on}=BTFW.require("core");
  function initials(name){
    var t=name.trim(); if(!t) return "?";
    var parts=t.split(/\s+/); var s=parts[0][0]||""; if(parts.length>1) s+=parts[1][0]||""; return s.toUpperCase();
  }
  function ensureAvatar(node){
    if(!document.body.classList.contains("btfw-chat-avatars")) return;
    if(!node || node.nodeType!==1) return;
    if(node.querySelector(".btfw-avatar")) return;
    var u=node.querySelector(".username"); if(!u) return;
    var name=(u.textContent||"").replace(":","").trim(); if(!name) return;
    var av=document.createElement("span"); av.className="btfw-avatar"; av.textContent=initials(name);
    node.insertBefore(av, node.firstChild);
  }
  function scan(){
    var buf=document.getElementById("messagebuffer"); if(!buf) return;
    Array.prototype.forEach.call(buf.children, ensureAvatar);
  }
  function boot(){
    scan();
    var buf=document.getElementById("messagebuffer"); if(!buf) return;
    var mo=new MutationObserver(function(m){ m.forEach(function(r){ r.addedNodes && r.addedNodes.forEach(ensureAvatar); }); });
    mo.observe(buf,{childList:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot); else boot();
  on("settings:changed", function(kv){ if(kv.key==="chat.avatars"){ scan(); } });
  return {};
});
