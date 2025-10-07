/* BTFW — feature:chatMedia (runtime-resize + dropdown support, stable)
   - Tags Giphy/Tenor chat images as .channel-emote
   - Emote/GIF size: small(100) / medium(130) / big(170)  [persisted]
   - GIF autoplay: ON (default) or hover-to-play          [persisted]
   - ChildList-only observer (no attribute loops)
   - Forces size on existing images at runtime (removes width/height attrs and applies CSS var inline with !important)
*/
BTFW.define("feature:chatMedia", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  const LS_SIZE = "btfw:chat:emoteSize";   // "sm" | "md" | "lg"
  const LS_AUTO = "btfw:chat:gifAutoplay"; // "1" | "0"
  const SIZE_PX = { sm: 100, md: 130, lg: 170 };
  const SEL = "#messagebuffer img.giphy.chat-picture, #messagebuffer img.tenor.chat-picture";

  function getSize(){ try { return localStorage.getItem(LS_SIZE) || "md"; } catch(_) { return "md"; } }
  function setSize(v){
    if (!SIZE_PX[v]) v = "md";
    try { localStorage.setItem(LS_SIZE, v); } catch(_){}
    applySize(v);
  }
  function getAutoplay(){ try { return localStorage.getItem(LS_AUTO) ?? "1"; } catch(_) { return "1"; } }
  function setAutoplay(on){
    try { localStorage.setItem(LS_AUTO, on ? "1" : "0"); } catch(_){}
    applyAutoplay();
  }

  function applySize(mode){
    const px = SIZE_PX[mode] || SIZE_PX.md;
    // Update theme var
    document.documentElement.style.setProperty("--btfw-emote-size", px + "px");
    // Force on all existing images immediately (runtime update)
    $$(SEL).forEach(forceSizeOn);
  }

  const isGiphy = (img)=> img.classList.contains("giphy") || /media\d\.giphy\.com\/media\/.+\/.+\.gif/i.test(img.src);
  const isTenor = (img)=> img.classList.contains("tenor") || /media\.tenor\.com\/.+\.gif/i.test(img.src);
  const toAnimated = (src)=> src.replace(/\/200_s\.gif$/i, "/200.gif");
  const toStatic   = (src)=> src.replace(/\/200\.gif$/i,   "/200_s.gif");

  function ensureTagged(img){
    if (!img.classList.contains("channel-emote")) img.classList.add("channel-emote");
  }

  function setSrcIfDifferent(img, next){
    if (next && img.src !== next) img.src = next;
  }

  // Ensure width/height are controlled by CSS var at runtime
  function forceSizeOn(img){
    // remove HTML attributes that may lock size
    if (img.hasAttribute("width"))  img.removeAttribute("width");
    if (img.hasAttribute("height")) img.removeAttribute("height");
    // enforce via inline style with !important so nothing overrides it
    const v = "var(--btfw-emote-size)";
    img.style.setProperty("width",     "auto", "important");
    img.style.setProperty("height",    "auto", "important");
    img.style.setProperty("max-width", v, "important");
    img.style.setProperty("max-height",v, "important");
    img.style.setProperty("object-fit","contain");
    img.style.setProperty("vertical-align","middle");
    img.style.setProperty("border-radius","8px");
    img.style.setProperty("margin","2px 3px");
  }

  // (Re)wire a single image according to current autoplay and size
  function wireOne(img){
    ensureTagged(img);
    forceSizeOn(img); // make sure size applies immediately

    // Mark wired so we don't keep reattaching listeners
    if (!img._btfwWired) {
      img._btfwWired = true;
    }

    const auto = getAutoplay() === "1";
    if (isGiphy(img)) {
      if (auto) {
        setSrcIfDifferent(img, toAnimated(img.src));
        img.onmouseenter = null;
        img.onmouseleave = null;
      } else {
        setSrcIfDifferent(img, toStatic(img.src));
        img.onmouseenter = () => { setSrcIfDifferent(img, toAnimated(img.src)); };
        img.onmouseleave = () => { setSrcIfDifferent(img, toStatic(img.src));   };
      }
    } else if (isTenor(img)) {
      // Tenor stays animated; no static variant from filter
      img.onmouseenter = null;
      img.onmouseleave = null;
    }
  }

  function processNode(node){
    if (!node) return;
    const direct = (node.matches && node.matches(SEL)) ? [node] : [];
    const list = direct.length ? direct : (node.querySelectorAll ? node.querySelectorAll(SEL) : []);
    list.forEach(wireOne);
  }

  function applyAutoplay(){
    // Re-wire all existing images idempotently
    $$(SEL).forEach(wireOne);
  }

  function boot(){
    const buf = $("#messagebuffer");
    if (buf) processNode(buf);

    // Observe ONLY added nodes; no attributes (prevents loops)
    if (buf && !buf._btfwMediaMO){
      const mo = new MutationObserver(muts=>{
        for (const m of muts) {
          if (m.type === "childList" && m.addedNodes) {
            m.addedNodes.forEach(n => { if (n.nodeType===1) processNode(n); });
          }
        }
      });
      mo.observe(buf, { childList:true, subtree:true });
      buf._btfwMediaMO = mo;
    }

    // Apply persisted settings on startup
    applySize(getSize());
    applyAutoplay();

    console.log("[BTFW] chatMedia ready (runtime sizing)");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    name:"feature:chatMedia",
    setEmoteSize: setSize,
    getEmoteSize: getSize,
    setGifAutoplayOn: setAutoplay,
    getGifAutoplayOn: ()=> getAutoplay()==="1"
  };
});
