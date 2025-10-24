
BTFW.define("feature:emoji-compat", [], async () => {
  const LS = "btfw:emoji:twemoji";
  const TW_VER = "14.0.2";
  const TW_JS  = `https://cdn.jsdelivr.net/npm/twemoji@${TW_VER}/dist/twemoji.min.js`;
  const TW_ASSETS_BASE = `https://cdn.jsdelivr.net/npm/twemoji@${TW_VER}/assets/`;
  const SKIP_SELECTOR = "[data-twemoji-skip='true']";

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

  function prepImages(root){
    if (!root) return;
    root.querySelectorAll("img.twemoji").forEach(img => {
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      if (img.complete && img.naturalWidth > 0) img.classList.add("is-ready");
      else {
        img.addEventListener("load", ()=> img.classList.add("is-ready"), { once:true });
      }
      try {
        if (img.alt === "\uFE0F" || /\/fe0f(?:\.svg|\.png)$/.test(img.src)) {
          img.remove();
        }
      } catch(_) {}
      img.addEventListener("error", ()=> img.remove(), { once:true });
    });
  }

  function shouldSkip(node){
    if (!node) return false;
    if (node.nodeType === 1) {
      if (node.matches?.(SKIP_SELECTOR)) return true;
      if (node.closest?.(SKIP_SELECTOR)) return true;
    }
    if (node.nodeType === 11) {
      return Array.from(node.childNodes || []).every(child => shouldSkip(child));
    }
    return false;
  }

  function parseNode(node){
    if (!window.twemoji || !enabled || !node) return;
    if (shouldSkip(node)) return;
    window.twemoji.parse(node, {
      base: TW_ASSETS_BASE,
      folder: "svg",
      ext: ".svg",
      className: "twemoji",
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
    parseNode(buf);
  }
  function stopChatObserver(){
    if (mo) { try { mo.disconnect(); } catch(_){} mo = null; }
  }

  document.addEventListener("btfw:emotes:rendered", (e)=> {
    const container = e.detail?.container || null;
    if (enabled && container && !shouldSkip(container)) {
      parseNode(container);
    }
  });

  function boot(){ setEnabled(getEnabled()); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:emoji-compat", getEnabled, setEnabled };
});
