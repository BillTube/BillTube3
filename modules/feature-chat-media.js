/* BTFW — feature:chatMedia
   - Adds .channel-emote to Giphy/Tenor embeds in chat
   - Emote/GIF size setting: small(100) / medium(130) / big(170)  (persisted)
   - GIF autoplay: ON (default) or hover-to-play (persisted)
   - Works with BillTube2 filters that emit:
       <img class="giphy chat-picture"> / <img class="tenor chat-picture">
*/
BTFW.define("feature:chatMedia", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  const LS_SIZE = "btfw:chat:emoteSize";   // "sm" | "md" | "lg"
  const LS_AUTO = "btfw:chat:gifAutoplay"; // "1" | "0"

  // Exact pixel sizes
  const SIZE_PX = { sm: 100, md: 130, lg: 170 };

  function getSize(){
    try { return localStorage.getItem(LS_SIZE) || "md"; } catch(_) { return "md"; }
  }
  function setSize(v){
    if (!SIZE_PX[v]) v = "md";
    try { localStorage.setItem(LS_SIZE, v); } catch(_){}
    applySize(v);
  }

  function getAutoplay(){
    try { return localStorage.getItem(LS_AUTO) ?? "1"; } catch(_) { return "1"; }
  }
  function setAutoplay(on){
    try { localStorage.setItem(LS_AUTO, on ? "1" : "0"); } catch(_){}
    applyAutoplay();
  }

  function applySize(mode){
    const px = SIZE_PX[mode] || SIZE_PX.md;
    document.documentElement.style.setProperty("--btfw-emote-size", px + "px");
  }

  function isGiphy(img){
    return img.classList.contains("giphy") || /media\d\.giphy\.com\/media\/.+\/.+\.gif/i.test(img.src);
  }
  function isTenor(img){
    return img.classList.contains("tenor") || /media\.tenor\.com\/.+\.gif/i.test(img.src);
  }

  // For Giphy filter: 200_s.gif (static) ↔ 200.gif (animated)
  function toAnimated(src){ return src.replace(/\/200_s\.gif$/i, "/200.gif"); }
  function toStatic(src){   return src.replace(/\/200\.gif$/i,   "/200_s.gif"); }

  function tagAndSize(img){
    if (!img.classList.contains("channel-emote")) img.classList.add("channel-emote");
    // sizing comes from CSS via --btfw-emote-size
  }

  function wireAutoplay(img){
    const auto = getAutoplay() === "1";
    if (isGiphy(img)) {
      if (auto) {
        img.src = toAnimated(img.src);
        img.onmouseenter = null;
        img.onmouseleave = null;
      } else {
        img.src = toStatic(img.src);
        img.onmouseenter = () => { img.src = toAnimated(img.src); };
        img.onmouseleave = () => { img.src = toStatic(img.src); };
      }
    } else if (isTenor(img)) {
      // Tenor usually lacks static variants; leave animated
      img.onmouseenter = null;
      img.onmouseleave = null;
    }
  }

  function processNode(node){
    if (!node) return;
    const direct = (node.matches && node.matches("img.giphy.chat-picture, img.tenor.chat-picture")) ? [node] : [];
    const list = direct.length ? direct
      : (node.querySelectorAll ? node.querySelectorAll("img.giphy.chat-picture, img.tenor.chat-picture") : []);
    list.forEach(img => {
      tagAndSize(img);
      wireAutoplay(img);
    });
  }

  function boot(){
    // Initial pass
    processNode($("#messagebuffer"));

    // Watch new chat content
    const buf = $("#messagebuffer");
    if (buf && !buf._btfwMediaMO) {
      const mo = new MutationObserver(muts=>{
        muts.forEach(m=>{
          m.addedNodes && m.addedNodes.forEach(n => { if (n.nodeType===1) processNode(n); });
          if (m.type === "attributes" && m.target && m.target.nodeType===1) processNode(m.target);
        });
      });
      mo.observe(buf, { childList:true, subtree:true, attributes:true, attributeFilter:["src","class"] });
      buf._btfwMediaMO = mo;
    }

    // Apply persisted settings
    applySize(getSize());
    applyAutoplay();

    console.log("[BTFW] chatMedia ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Expose API for Theme Settings
  return {
    name:"feature:chatMedia",
    setEmoteSize: setSize,
    getEmoteSize: getSize,
    setGifAutoplayOn: setAutoplay,
    getGifAutoplayOn: () => getAutoplay()==="1"
  };
});
