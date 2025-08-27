
BTFW.define("feature:channels",["core"],async function(){
  var {$,load,save}=BTFW.require("core");
  function data(){
    if (window.BTFW_CHANNELS && Array.isArray(window.BTFW_CHANNELS)) return window.BTFW_CHANNELS;
    return load("btfw.channels", [
      { name:"Movies", href:"#"},
      { name:"TV", href:"#"},
      { name:"Music", href:"#"},
      { name:"Retro", href:"#"},
      { name:"Anime", href:"#"},
      { name:"Sports", href:"#"},
      { name:"Docu", href:"#"},
      { name:"Random", href:"#"},
    ]);
  }
  function render(){
    var host=document.getElementById("btfw-channels");
    if(!host){
      host=document.createElement("div"); host.id="btfw-channels";
      var video=document.getElementById("videowrap");
      if(video && video.parentNode){ video.parentNode.insertBefore(host, video.nextSibling); }
    }
    host.innerHTML="";
    var sc=document.createElement("div"); sc.className="btfw-channels-scroll";
    data().forEach(function(ch){
      var a=document.createElement("a"); a.className="btfw-chip"; a.textContent=ch.name; a.href=ch.href || "#";
      sc.appendChild(a);
    });
    host.appendChild(sc);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render); else render();
  return { render };
});
