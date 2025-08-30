/* BTFW — feature:chatMedia
   - Adds .channel-emote to Giphy/Tenor embeds in chat
   - Emote/GIF size setting: small / medium / big  (persisted)
   - GIF autoplay behavior: Autoplay (default) or Hover-to-play (persisted)
     * Giphy static -> animated swap handled via 200_s.gif <-> 200.gif
     * Tenor GIFs are usually animated already (no static variant provided by the filter)
*/
BTFW.define("feature:chatMedia", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  const LS_SIZE = "btfw:chat:emoteSize";   // "sm" | "md" | "lg"
  const LS_AUTO = "btfw:chat:gifAutoplay"; // "1" | "0"

  function getSize(){ try{ return localStorage.getItem(LS_SIZE) || "md"; } catch(_) { return "md"; } }
  function setSize(v){ try{ localStorage.setItem(LS_SIZE, v); } catch(_){} applySize(v); }

  function getAutoplay(){ try{ return localStorage.getItem(LS_AUTO) ?? "1"; } catch(_) { return "1"; } }
  function setAutoplay(s){ try{ localStorage.setItem(LS_AUTO, s ? "1" : "0"); } catch(_){} applyAutoplay(); }

  function applySize(v){
    const px = (v==="sm") ? 24 : (v==="lg" ? 40 : 32);
    document.documentElement.style.setProperty("--btfw-emote-size", px+"px");
  }

  function isGiphy(img){
    return img.classList.contains("giphy") || /media\d\.giphy\.com\/media\/.+\/.+\.gif/.test(img.src);
  }
  function isTenor(img){
    return img.classList.contains("tenor") || /media\.tenor\.com\/.+\.gif/.test(img.src);
  }

  function makeAnimatedSrc(img){
    const src = img.getAttribute("src") || "";
    // Giphy filter uses 200_s.gif in replace → animated is 200.gif
    if (isGiphy(img)) return src.replace(/\/200_s\.gif$/i, "/200.gif");
    // Tenor is already animated; keep as is
    return src;
  }
  function makeStaticSrc(img){
    const src = img.getAttribute("src") || "";
    if (isGiphy(img)) return src.replace(/\/200\.gif$/i, "/200_s.gif");
    return src; // Tenor: no static available; leave animated
  }

  function tagAndSize(img){
    img.classList.add("channel-emote");
    // Allow theme to size via CSS var; nothing else needed here
  }

  function wireAutoplay(img){
    const auto = getAutoplay() === "1";
    if (auto) {
      if (isGiphy(img) && /\/200_s\.gif$/i.test(img.src)) {
        img.src = makeAnimatedSrc(img);
      }
      img.onmouseenter = null;
      img.onmouseleave = null;
    } else {
      // Hover-to-play
      if (isGiphy(img)) {
        // ensure static at rest
        img.src = img.src.replace(/\/200\.gif$/i, "/200_s.gif");
        img.onmouseenter = ()=> { img.src = makeAnimatedSrc(img); };
        img.onmouseleave = ()=> { img.src = makeStaticSrc(img); };
      } else {
        // Tenor: stays animated; no static variant from filter
        img.onmouseenter = null;
        img.onmouseleave = null;
      }
    }
  }

  function processNode(node){
    if (!node) return;
    const imgs = node.matches && (node.matches("img.giphy.chat-picture, img.tenor.chat-picture") ? [node] : []);
    const list = imgs.length ? imgs : node.querySelectorAll?.("img.giphy.chat-picture, img.tenor.chat-picture") || [];
    list.forEach(img=>{
      tagAndSize(img);
      wireAutoplay(img);
    });
  }

  function boot(){
    // Initial pass
    processNode($("#messagebuffer"));

    // Observe new chat messages
    const buf = $("#messagebuffer");
    if (buf && !buf._btfwMediaMO){
      const mo = new MutationObserver(muts=>{
        muts.forEach(m=>{
          m.addedNodes && m.addedNodes.forEach(n=>{
            if (n.nodeType===1) processNode(n);
          });
        });
      });
      mo.observe(buf, {childList:true, subtree:true});
      buf._btfwMediaMO = mo;
    }

    // Apply persisted settings
    applySize(getSize());
    applyAutoplay();
  }

  function applyAutoplay(){
    // re-wire all images to honor the new mode
    $$("#messagebuffer img.giphy.chat-picture, #messagebuffer img.tenor.chat-picture").forEach(wireAutoplay);
  }

  // expose API for Theme Settings
  function setEmoteSize(v){ setSize(v); }
  function getEmoteSize(){ return getSize(); }
  function setGifAutoplayOn(v){ setAutoplay(v); }
  function getGifAutoplayOn(){ return getAutoplay()==="1"; }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:chatMedia", setEmoteSize, getEmoteSize, setGifAutoplayOn, getGifAutoplayOn };
});
