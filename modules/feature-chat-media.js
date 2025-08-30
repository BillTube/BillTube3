/* BTFW — feature:chatMedia (stable, no mutation loops)
   - Adds .channel-emote to Giphy/Tenor chat images
   - Emote/GIF size: small(100) / medium(130) / big(170)  [persisted]
   - GIF autoplay: ON (default) or hover-to-play           [persisted]
   - IMPORTANT: observes childList only (no attribute observe) to avoid loops
*/
BTFW.define("feature:chatMedia", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  const LS_SIZE = "btfw:chat:emoteSize";   // "sm"|"md"|"lg"
  const LS_AUTO = "btfw:chat:gifAutoplay"; // "1"|"0"
  const SIZE_PX = { sm:100, md:130, lg:170 };

  function getSize(){ try { return localStorage.getItem(LS_SIZE) || "md"; } catch(_) { return "md"; } }
  function setSize(v){
    if (!SIZE_PX[v]) v = "md";
    try { localStorage.setItem(LS_SIZE, v); } catch(_){}
    applySize(v);
  }
  function applySize(v){
    const px = SIZE_PX[v] || SIZE_PX.md;
    document.documentElement.style.setProperty("--btfw-emote-size", px+"px");
  }

  function getAutoplay(){ try { return localStorage.getItem(LS_AUTO) ?? "1"; } catch(_) { return "1"; } }
  function setAutoplay(on){
    try { localStorage.setItem(LS_AUTO, on ? "1" : "0"); } catch(_){}
    applyAutoplay(); // rewire existing images without loops
  }

  // Helpers
  const isGiphy = (img)=> img.classList.contains("giphy") || /media\d\.giphy\.com\/media\/.+\/.+\.gif/i.test(img.src);
  const isTenor = (img)=> img.classList.contains("tenor") || /media\.tenor\.com\/.+\.gif/i.test(img.src);
  const toAnimated = (src)=> src.replace(/\/200_s\.gif$/i, "/200.gif");
  const toStatic   = (src)=> src.replace(/\/200\.gif$/i,   "/200_s.gif");

  function ensureTagged(img){
    if (!img.classList.contains("channel-emote")) img.classList.add("channel-emote");
  }

  function setSrcIfDifferent(img, next){
    if (!next || img.src === next) return;
    img.src = next;
  }

  // (Re)wire a single image according to current autoplay setting
  function wireOne(img){
    ensureTagged(img);

    // Mark wired so we don't attach listeners repeatedly
    if (!img._btfwWired) {
      img._btfwWired = true;
      // We will (re)assign handlers below each time, but mark prevents
      // duplicate observers elsewhere from piling up.
    }

    const auto = getAutoplay() === "1";
    if (isGiphy(img)) {
      if (auto) {
        // Ensure animated at rest
        setSrcIfDifferent(img, toAnimated(img.src));
        img.onmouseenter = null;
        img.onmouseleave = null;
      } else {
        // Rest static; animate on hover
        setSrcIfDifferent(img, toStatic(img.src));
        img.onmouseenter = () => { setSrcIfDifferent(img, toAnimated(img.src)); };
        img.onmouseleave = () => { setSrcIfDifferent(img, toStatic(img.src));   };
      }
    } else if (isTenor(img)) {
      // Tenor: typically always animated (no static variant from filter)
      img.onmouseenter = null;
      img.onmouseleave = null;
    }
  }

  function processNode(node){
    if (!node) return;
    const direct = (node.matches && node.matches("img.giphy.chat-picture, img.tenor.chat-picture")) ? [node] : [];
    const list = direct.length ? direct
      : (node.querySelectorAll ? node.querySelectorAll("img.giphy.chat-picture, img.tenor.chat-picture") : []);
    list.forEach(wireOne);
  }

  function applyAutoplay(){
    // Rewire all existing images idempotently (no attribute observer here)
    $$("#messagebuffer img.giphy.chat-picture, #messagebuffer img.tenor.chat-picture").forEach(wireOne);
  }

  function boot(){
    const buf = $("#messagebuffer");
    if (buf) processNode(buf);

    // Observe ONLY new nodes; DO NOT observe attributes (prevents loops)
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

    // Apply persisted settings
    applySize(getSize());
    applyAutoplay();

    console.log("[BTFW] chatMedia ready (stable)");
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
