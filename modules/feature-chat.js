
BTFW.define("feature:chat",["core","bridge"],async function(){
  var {$$}=BTFW.require("core");
  var cache=new Map(); function toColor(s){var h=0;for(var i=0;i<s.length;i++){h=s.charCodeAt(i)+((h<<5)-h);}var c="#";for(var j=0;j<3;j++){var v=(h>>(j*8))&0xFF;c+=("00"+v.toString(16)).slice(-2);}return c;}
  function colorize(buf){$$(".username",buf).forEach(function(u){var n=u.textContent.replace(":","").trim();u.style.color= cache.get(n)|| (function(x){var col=toColor(x);cache.set(x,col);return col;})(n);});}
  function boot(){var buf=document.getElementById("messagebuffer"); if(!buf)return; colorize(buf); var mo=new MutationObserver(function(m){m.forEach(function(r){r.addedNodes&&r.addedNodes.forEach(function(n){if(n.nodeType===1){var u=n.querySelector(".username");if(u){var name=u.textContent.replace(":","").trim();u.style.color=cache.get(name)||toColor(name);}}});});}); mo.observe(buf,{childList:true});}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot); else boot();
  return {};
});
