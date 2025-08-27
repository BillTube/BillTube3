
BTFW.define("feature:resize",["core"],async function(){
  var {save,load}=BTFW.require("core");
  var KEY_W="btfw.chat.width", KEY_SIDE="btfw.chat.side", KEY_AR="btfw.video.ar";
  function setCSSVar(name,val){ document.documentElement.style.setProperty(name,val); }
  function ensureResizer(){
    var bar=document.getElementById("btfw-resizer"); if(bar) return bar;
    bar=document.createElement("div"); bar.id="btfw-resizer"; document.body.appendChild(bar); 
    return bar;
  }
  function applySide(side){
    document.body.classList.toggle("btfw-chat-left", side==="left");
    save(KEY_SIDE, side);
    positionResizer();
  }
  function positionResizer(){
    var side=load(KEY_SIDE,"right");
    var w = load(KEY_W,"28%");
    setCSSVar("--bt-chat-w", w);
    var top = getComputedStyle(document.documentElement).getPropertyValue("--bt-offset-top")||"0px";
    var bar = ensureResizer();
    bar.style.top = top.trim();
    bar.style.height = "calc(100vh - "+top+")";
    if(side==="left"){ bar.style.left = w; bar.style.right = "auto"; }
    else { bar.style.right = w; bar.style.left = "auto"; }
  }
  function drag(){
    var startX, startW;
    function onDown(e){
      e.preventDefault();
      startX = e.clientX;
      startW = getComputedStyle(document.documentElement).getPropertyValue("--bt-chat-w").trim();
      document.addEventListener("mousemove",onMove);
      document.addEventListener("mouseup",onUp);
    }
    function onMove(e){
      var side=load(KEY_SIDE,"right");
      var dx = e.clientX - startX;
      var vw = Math.max(document.documentElement.clientWidth, window.innerWidth||0);
      var newW;
      if (startW.indexOf("%")>0){
        var pct = parseFloat(startW);
        var px = pct/100 * vw;
        var px2 = side==="left" ? (px+dx) : (px-dx);
        px2 = Math.min(Math.max(px2, 280), Math.min(800, vw*0.5));
        newW = (px2/vw*100).toFixed(2) + "%";
      } else {
        var px = parseFloat(startW);
        var px2 = side==="left" ? (px+dx) : (px-dx);
        px2 = Math.min(Math.max(px2, 280), Math.min(800, vw*0.5));
        newW = px2 + "px";
      }
      setCSSVar("--bt-chat-w", newW);
      positionResizer();
    }
    function onUp(){
      document.removeEventListener("mousemove",onMove);
      document.removeEventListener("mouseup",onUp);
      var cur = getComputedStyle(document.documentElement).getPropertyValue("--bt-chat-w").trim();
      save(KEY_W, cur);
    }
    ensureResizer().addEventListener("mousedown", onDown);
  }
  function setAspect(r){
    var ar = (typeof r==="string") ? r : String(r);
    document.documentElement.style.setProperty("--bt-video-ar", ar);
    save(KEY_AR, ar);
  }
  function boot(){
    var side=load(KEY_SIDE,"right"); applySide(side);
    var w=load(KEY_W,null); if(w){ setCSSVar("--bt-chat-w", w); }
    var ar=load(KEY_AR,"16/9"); setAspect(ar);
    drag();
    window.addEventListener("resize", positionResizer);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot); else boot();
  return { applySide, setAspect };
});
