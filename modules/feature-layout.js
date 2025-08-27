
BTFW.define("feature:layout",["core","bridge"],async function(){
  var {$}=BTFW.require("core"); var {ids}=BTFW.require("bridge");
  function ensureTopOffset(){
    var nav = document.querySelector("nav.navbar") || document.querySelector("#nav-collapsible")?.closest("nav");
    var h = nav ? nav.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty("--bt-offset-top", Math.round(h)+"px");
  }
  function mount(){
    ensureTopOffset();
    var map = ids();
    var chatCol = document.getElementById("btfw-chatcol");
    if(!chatCol){ chatCol = document.createElement("div"); chatCol.id="btfw-chatcol"; document.body.appendChild(chatCol); }
    if(map.chatwrap && map.chatwrap.parentNode !== chatCol){ chatCol.appendChild(map.chatwrap); }

    var leftpad = document.getElementById("btfw-leftpad");
    if(!leftpad){ leftpad = document.createElement("div"); leftpad.id="btfw-leftpad"; }
    if(map.mainpage && leftpad.parentNode!==map.mainpage){ map.mainpage.insertBefore(leftpad, map.mainpage.firstChild); }

    if(map.videowrap && map.videowrap.parentNode!==leftpad){ leftpad.appendChild(map.videowrap); }
    var queueC = document.getElementById("queuecontainer");
    if(!queueC && map.queue){
      queueC=document.createElement("div"); queueC.id="queuecontainer"; queueC.className="section";
      if(map.queue.parentNode) map.queue.parentNode.insertBefore(queueC, map.queue);
      queueC.appendChild(map.queue);
    }
    if(queueC && queueC.parentNode!==leftpad){ leftpad.appendChild(queueC); }

    var headRight = document.getElementById("headright");
    var navcol = document.querySelector("#nav-collapsible");
    if(!headRight && navcol){ headRight=document.createElement("div"); headRight.id="headright"; headRight.innerHTML="<div id='progbar'></div>"; navcol.appendChild(headRight); }
    window.addEventListener("resize", ensureTopOffset);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount); else mount();
  return { mount };
});
