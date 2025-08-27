
BTFW.define("feature:chat",["core","bridge"],async function(){
  function boot(){
    var cw=document.getElementById("chatwrap");
    if(!cw) return;
    if(!cw.querySelector(".btfw-chat-topbar")){
      var top=document.createElement("div"); top.className="btfw-chat-topbar";
      cw.insertBefore(top, cw.firstChild);
    }
    if(!cw.querySelector(".btfw-chat-bottombar")){
      var bottom=document.createElement("div"); bottom.className="btfw-chat-bottombar";
      cw.appendChild(bottom);
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot); else boot();
  return {};
});
