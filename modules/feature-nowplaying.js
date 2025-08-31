/* BTFW — feature:nowplaying
   Shows ONLY the media title (no "Currently playing:" prefix) and keeps it in sync.
*/
BTFW.define("feature:nowplaying", [], async () => {
  const $ = (s,r=document)=>r.querySelector(s);

  function stripPrefix(t){
    return String(t||"")
      .replace(/^\s*(?:currently|now)\s*playing\s*[:\-]\s*/i, "")
      .trim();
  }

  function getQueueActiveTitle(){
    const a = document.querySelector("#queue .queue_active a");
    return a && a.textContent ? a.textContent.trim() : "";
  }

  function setTitle(raw){
    const el = $("#currenttitle");
    if (!el) return;
    const t = stripPrefix(raw || getQueueActiveTitle());
    el.textContent = t || "";
    el.title = t || "";
  }

  function boot(){
    // Initial
    const existing = $("#currenttitle")?.textContent || "";
    setTitle(existing);

    // CyTube socket events
    try {
      if (window.socket && socket.on) {
        socket.on("changeMedia", data => setTitle(data?.title || ""));
        socket.on("setCurrent",  data => setTitle(data?.title || ""));
      }
    } catch(_) {}

    // Track queue changes as a fallback
    const q = $("#queue");
    if (q && !q._btfwNPObs){
      const mo = new MutationObserver(()=> setTitle(getQueueActiveTitle()));
      mo.observe(q, { childList:true, subtree:true });
      q._btfwNPObs = mo;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:nowplaying", setTitle };
});
