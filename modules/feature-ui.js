
BTFW.define("feature:ui",["core"],async function(){
  var {load,save}=BTFW.require("core");
  function makeIconBtn(cls, title){
    var b=document.createElement("button"); b.className="btfw-iconbtn "+cls; if(title) b.title=title; return b;
  }
  function addHeaderButtons(){
    var nav = document.querySelector("#nav-collapsible") || document.querySelector("nav .navbar-collapse") || document.querySelector("nav.navbar");
    if(!nav || nav.querySelector(".btfw-controls")) return;
    var wrap=document.createElement("div"); wrap.className="btfw-controls";
    var themeBtn=document.createElement("button"); themeBtn.className="btfw-btn"; themeBtn.textContent="Theme Settings";
    themeBtn.addEventListener("click", function(){ if (window.BTFW_themeSettings && window.BTFW_themeSettings.open){ window.BTFW_themeSettings.open(); } });
    wrap.appendChild(themeBtn);
    nav.appendChild(wrap);
  }
  function addChatButtons(){
    var top = document.querySelector("#chatwrap .btfw-chat-topbar");
    var bottom = document.querySelector("#chatwrap .btfw-chat-bottombar");
    if(top && !top.querySelector(".btfw-iconbtn")){
      var users = makeIconBtn("btfw-ic-users","Users");
      users.addEventListener("click", function(){ if (window.BTFW_userlist && window.BTFW_userlist.toggle){ window.BTFW_userlist.toggle(); } });
      var emotes = makeIconBtn("btfw-ic-emotes","Mote list");
      var giphy = makeIconBtn("btfw-ic-gif","GIFs");
      emotes.addEventListener("click", function(){ if(window.BTFW_overlays){ BTFW_overlays.openDrawer({title:"Emotes", side:"right", content:"<div class='p-16'>Emotes plugin here</div>"}); } });
      giphy.addEventListener("click", function(){ if(window.BTFW_overlays){ BTFW_overlays.openDrawer({title:"GIFs", side:"right", content:"<div class='p-16'>Giphy/Tenor plugin hook</div>"}); } });
      top.appendChild(users); top.appendChild(emotes); top.appendChild(giphy);
    }
    if(bottom && !bottom.querySelector(".btfw-iconbtn")){
      var settings = makeIconBtn("btfw-ic-cog","Chat settings");
      settings.addEventListener("click", function(){ if (window.BTFW_themeSettings && window.BTFW_themeSettings.open){ window.BTFW_themeSettings.open("chat"); } });
      bottom.appendChild(settings);
    }
  }
  function boot(){ addHeaderButtons(); addChatButtons(); }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot); else boot();
  return {};
});
