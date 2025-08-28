
BTFW.define("feature:resize", ["feature:layout"], async ({ require }) => {
  function ensureResizer(){
    var grid=document.getElementById("btfw-grid");
    var left=document.getElementById("btfw-leftpad");
    var right=document.getElementById("btfw-chatcol");
    if(!grid||!left||!right) return;

    var split=document.getElementById("btfw-vsplit");
    if(!split){ split=document.createElement("div"); split.id="btfw-vsplit"; left.parentNode.insertBefore(split,right); }

    var KEY="btfw-left-width";
    function gridW(){ return grid.getBoundingClientRect().width; }
    function clamp(px){
      var G=gridW(), minLeft=600, minRight=320, handle=6;
      var min=minLeft, max=Math.max(minLeft, G - minRight - handle);
      if(isNaN(px)) return Math.min(Math.max(G - 380 - handle, min), max);
      return Math.min(Math.max(px, min), max);
    }
    function apply(px){
      document.documentElement.style.setProperty("--btfw-leftpx", px + "px");
      try{ localStorage.setItem(KEY, String(px)); }catch(e){}
    }
    var stored=parseInt(localStorage.getItem(KEY),10);
    apply(clamp(stored));

    function onDown(e){
      e.preventDefault();
      var startX=(e.touches?e.touches[0].clientX:e.clientX);
      var startLeft=parseInt(getComputedStyle(document.documentElement).getPropertyValue("--btfw-leftpx"))||clamp(NaN);
      function onMove(ev){
        var x=(ev.touches?ev.touches[0].clientX:ev.clientX);
        apply(clamp(startLeft + (x - startX)));
      }
      function onUp(){
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchmove", onMove, {passive:false});
      document.addEventListener("touchend", onUp);
    }
    split.onmousedown=onDown;
    split.ontouchstart=onDown;
    split.ondblclick=function(){ localStorage.removeItem(KEY); apply(clamp(NaN)); };

    window.addEventListener("resize", function(){ apply(clamp(parseInt(localStorage.getItem(KEY),10))); });
  }

  document.addEventListener("btfw:layoutReady", ensureResizer);
  setTimeout(ensureResizer, 1000);

  return { name:"feature:resize" };
});
