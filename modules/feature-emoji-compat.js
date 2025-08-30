/* BillTube Framework — feature:emoji-compat
   Optional: unify emoji appearance using Twemoji (SVG).
   - Parses the emotes popover grid when it renders
   - Parses new chat messages in #messagebuffer via MutationObserver
   - Toggle via Theme Settings
*/
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
    else { stopChatObserver(); /* we leave existing images alone to avoid churn */ }
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

  function parseNode(node){
    if (!window.twemoji || !enabled || !node) return;
    window.twemoji.parse(node, {
      base: TW_ASSETS_BASE,
      folder: "svg",
      ext: ".svg",
      className: "twemoji",
    });
  }

  // Parse the mini popover grid whenever it renders
  function parsePicker(){
    const grid = document.getElementById("btfw-emotes-grid");
    if (grid) parseNode(grid);
  }

  // Observe the message buffer and parse new messages
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
    // initial pass (in case there are existing messages)
    parseNode(buf);
  }
  function stopChatObserver(){
    if (mo) { try { mo.disconnect(); } catch(_){} mo = null; }
  }

  // Wire lifecycle hooks
  document.addEventListener("btfw:emotes:rendered", (e)=> { if (enabled) parseNode(e.detail?.container || null); });

  // Public API
  function boot(){ setEnabled(getEnabled()); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:emoji-compat", getEnabled, setEnabled };
});
