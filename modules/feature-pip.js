
BTFW.define("feature:pip", ["feature:layout"], async ({}) => {
  const KEY = "btfw:pip";
  function pref(){ try{ return localStorage.getItem(KEY)==="1"; }catch(e){ return !!window.BTFW_PIP; } }
  function setPref(v){ try{ localStorage.setItem(KEY, v ? "1":"0"); }catch(e){} window.BTFW_PIP = !!v; document.dispatchEvent(new CustomEvent("btfw:pip:refresh")); }

  let io=null, originalParent=null, beforeNode=null;

  function ensureDock(){
    const chatcol=document.getElementById("btfw-chatcol"); if(!chatcol) return null;
    let dock=document.getElementById("btfw-pip-dock");
    if(!dock){ dock=document.createElement("div"); dock.id="btfw-pip-dock"; chatcol.prepend(dock); }
    return dock;
  }
  function toDock(){
    const video=document.getElementById("videowrap"); if(!video) return;
    const dock=ensureDock(); if(!dock) return;
    if(dock.contains(video)) return;
    originalParent=video.parentNode; beforeNode=video.nextSibling;
    dock.appendChild(video); video.classList.add("btfw-pip");
  }
  function toOriginal(){
    const video=document.getElementById("videowrap"); if(!video) return;
    if(originalParent && !originalParent.contains(video)){
      if(beforeNode) originalParent.insertBefore(video, beforeNode); else originalParent.appendChild(video);
    }
    video.classList.remove("btfw-pip");
  }
  function start(){
    stop();
    const video=document.getElementById("videowrap"); if(!video) return;
    io = new IntersectionObserver(entries => {
      const e=entries[0]; if(!e) return;
      if(e.intersectionRatio < 0.1) toDock(); else toOriginal();
    }, {threshold:[0,0.1,0.5,1]});
    io.observe(video);
  }
  function stop(){
    if(io){ io.disconnect(); io=null; }
    toOriginal();
  }

  document.addEventListener("btfw:pip:refresh", function(){
    if (pref()) start(); else stop();
  });

  if (pref()) start();
  window.BTFW_setPiP = setPref;
  return { name:"feature:pip", set: setPref };
});
