
BTFW.define("feature:overlays",["core"],async function(){
  function mountHost(){
    if(document.getElementById("btfw-overlay-root")) return;
    var root=document.createElement("div"); root.id="btfw-overlay-root"; document.body.appendChild(root);
  }
  function openModal(opts){
    mountHost();
    var root=document.getElementById("btfw-overlay-root");
    var wrap=document.createElement("div"); wrap.className="btfw-overlay";
    wrap.innerHTML="<div class='btfw-backdrop'></div><div class='btfw-modal'><button class='btfw-close' aria-label='Close'>&times;</button><div class='btfw-modal-body'></div></div>";
    var body=wrap.querySelector(".btfw-modal-body");
    if (opts && opts.content){ if (typeof opts.content==="string") body.innerHTML=opts.content; else body.appendChild(opts.content); }
    function close(){ wrap.remove(); }
    wrap.querySelector(".btfw-backdrop").addEventListener("click", close);
    wrap.querySelector(".btfw-close").addEventListener("click", close);
    document.addEventListener("keydown", function esc(e){ if(e.key==="Escape"){close(); document.removeEventListener("keydown",esc);} });
    root.appendChild(wrap);
    return { close, el:wrap, body };
  }
  function openDrawer(opts){
    mountHost();
    var side = (opts && opts.side) || "right";
    var root=document.getElementById("btfw-overlay-root");
    var wrap=document.createElement("div"); wrap.className="btfw-overlay btfw-drawer btfw-"+side;
    wrap.innerHTML="<div class='btfw-backdrop'></div><div class='btfw-panel'><div class='btfw-drawer-header'><span class='title'></span><button class='btfw-close'>&times;</button></div><div class='btfw-drawer-body'></div></div>";
    wrap.querySelector(".title").textContent = (opts && opts.title) || "";
    var body=wrap.querySelector(".btfw-drawer-body");
    if (opts && opts.content){ if (typeof opts.content==="string") body.innerHTML=opts.content; else body.appendChild(opts.content); }
    function close(){ wrap.remove(); }
    wrap.querySelector(".btfw-backdrop").addEventListener("click", close);
    wrap.querySelector(".btfw-close").addEventListener("click", close);
    root.appendChild(wrap);
    return { close, el:wrap, body };
  }
  window.BTFW_overlays = { openModal, openDrawer };
  return { openModal, openDrawer };
});
