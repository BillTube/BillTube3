
BTFW.define("feature:ui",["core"],async function(){
  var {load,save,$}=BTFW.require("core");
  var KEY_SIDE="btfw.chat.side", KEY_AR="btfw.video.ar";
  function button(txt, title){
    var b=document.createElement("button"); b.className="btfw-btn"; b.textContent=txt; if(title) b.title=title; return b;
  }
  function build(){
    var nav = document.querySelector("#nav-collapsible") || document.querySelector("nav .navbar-collapse") || document.querySelector("nav.navbar");
    if(!nav) return;
    var wrap=document.createElement("div"); wrap.className="btfw-controls";
    var swap=button("Swap chat"); var reset=button("Reset"); 
    var select=document.createElement("select"); select.className="btfw-select";
    [["16/9","16/9"],["21/9","21/9"],["4/3","4/3"],["1/1","1/1"]].forEach(function([v,l]){ var o=document.createElement("option"); o.value=v; o.textContent=l; select.appendChild(o); });
    select.value = load(KEY_AR,"16/9");
    swap.addEventListener("click", function(){ var cur=load(KEY_SIDE,"right"); var next = cur==="right"?"left":"right"; save(KEY_SIDE,next); document.body.classList.toggle("btfw-chat-left", next==="left"); });
    reset.addEventListener("click", function(){ localStorage.removeItem("btfw.chat.width"); localStorage.removeItem("btfw.chat.side"); localStorage.removeItem("btfw.video.ar"); location.reload(); });
    select.addEventListener("change", function(){ localStorage.setItem("btfw.video.ar", JSON.stringify(this.value)); document.documentElement.style.setProperty("--bt-video-ar", this.value); });
    wrap.appendChild(swap); wrap.appendChild(select); wrap.appendChild(reset);
    nav.appendChild(wrap);
    window.BTFW_ui = { onSideChange:null, onRatioChange:null };
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",build); else build();
  return {};
});
