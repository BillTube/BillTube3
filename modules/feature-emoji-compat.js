
BTFW.define("feature:emoji-compat", [], async () => {
  const LS = "btfw:emoji:twemoji";     // "1" | "0"
  const TW_VER = "14.0.2";
  const TW_JS  = `https://cdn.jsdelivr.net/npm/twemoji@${TW_VER}/dist/twemoji.min.js`;
  const TW_ASSETS_BASE = `https://cdn.jsdelivr.net/npm/twemoji@${TW_VER}/assets/`;

  let enabled = false;
  let mo = null;

  function getEnabled(){
    try { return localStorage.getItem(LS) === "1"; } catch(_) { return false; }
  }
  function setEnabled(v){
    enabled = !!v;
    try { localStorage.setItem(LS, v ? "1":"0"); } catch(_){}
    if (enabled) { ensureTwemoji().then(() => { parsePicker(); startChatObserver(); }); }
    else { stopChatObserver(); }
  }

  function ensureTwemoji(){
    return new Promise((resolve, reject)=>{
      if (window.twemoji) return resolve();
      const s = document.createElement("script");
      s.async = true; s.defer = true;
      s.src = TW_JS + "?v=" + Date.now();
      s.onload = ()=> resolve();
      s.onerror = ()=> reject(new Error("Failed to load Twemoji"));
      document.head.appendChild(s);
    });
  }

  // Hide until loaded + set attrs + remove broken/orphan FE0F images
  function prepImages(root){
    if (!root) return;
    root.querySelectorAll("img.twemoji").forEach(img => {
      // Add attrs for smoother loading
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      // Fade-in on load; if already cached, mark ready immediately
      if (img.complete && img.naturalWidth > 0) img.classList.add("is-ready");
      else {
        img.addEventListener("load", ()=> img.classList.add("is-ready"), { once:true });
      }
      // If the src is an orphaned FE0F (variation selector) image, remove it
      try {
        if (img.alt === "\uFE0F" || /\/fe0f(?:\.svg|\.png)$/.test(img.src)) {
          img.remove();
        }
      } catch(_) {}
      // Also remove truly broken images
      img.addEventListener("error", ()=> img.remove(), { once:true });
    });
  }

  function parseNode(node){
    if (!window.twemoji || !enabled || !node) return;
    window.twemoji.parse(node, {
      base: TW_ASSETS_BASE,
      folder: "svg",
      ext: ".svg",
      className: "twemoji",
      // add attributes to every generated <img>
      attributes: () => ({ loading: "lazy", decoding: "async" })
    });
    prepImages(node);
  }

  function parsePicker(){
    const grid = document.getElementById("btfw-emotes-grid");
    if (grid) parseNode(grid);
  }

  function startChatObserver(){
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    stopChatObserver();
    mo = new MutationObserver((muts)=>{
      for (const m of muts) {
        m.addedNodes && m.addedNodes.forEach(n => {
          if (n.nodeType === 1) parseNode(n);
        });
      }
    });
    mo.observe(buf, { childList: true, subtree: true });
    // initial pass
    parseNode(buf);
  }
  function stopChatObserver(){
    if (mo) { try { mo.disconnect(); } catch(_){} mo = null; }
  }

  // Re-parse just the picker window when it renders/updates
  document.addEventListener("btfw:emotes:rendered", (e)=> {
    if (enabled) parseNode(e.detail?.container || null);
  });

  function boot(){ setEnabled(getEnabled()); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:emoji-compat", getEnabled, setEnabled };
});
