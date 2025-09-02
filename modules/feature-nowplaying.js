BTFW.define("feature:nowplaying", [], async () => {
  const $ = (s,r=document)=>r.querySelector(s);

  function stripPrefix(t){
    return String(t||"")
      .replace(/^\s*(?:currently|now)\s*playing\s*[:\-]\s*/i, "")
      .trim();
  }

  function ensureSlot(){
    // chat.js usually creates this; we just sanity-check
    const cw   = $("#chatwrap"); if (!cw) return null;
    let top    = cw.querySelector(".btfw-chat-topbar");
    if (!top) {
      top = document.createElement("div");
      top.className = "btfw-chat-topbar";
      cw.prepend(top);
    }
    let slot = top.querySelector("#btfw-nowplaying-slot");
    if (!slot) {
      slot = document.createElement("div");
      slot.id = "btfw-nowplaying-slot";
      slot.className = "btfw-chat-title";
      top.appendChild(slot);
    }
    return slot;
  }

  function mountTitleIntoSlot(){
    const slot = ensureSlot();
    const ct   = $("#currenttitle");
    if (!slot || !ct) return;
    if (ct.parentElement !== slot) {
      slot.textContent = "";
      slot.appendChild(ct);
      ct.classList.add("btfw-nowplaying"); // styling hook
    }
  }

  function getQueueActiveTitle(){
    const a = document.querySelector("#queue .queue_active .qe_title a, #queue .queue_active .qe_title");
    return a && a.textContent ? a.textContent.trim() : "";
  }

  function setTitle(raw){
    const ct = $("#currenttitle"); if (!ct) return;
    const t  = stripPrefix(raw || getQueueActiveTitle());
    ct.textContent = t || "";
    ct.title = t || "";
  }

  function boot(){
    // 1) Ensure slot exists & mount the real node
    mountTitleIntoSlot();

    // 2) Initial text (respect anything CyTube already set)
    const existing = $("#currenttitle")?.textContent || "";
    setTitle(existing);

    // 3) Listen to CyTube socket events
    try {
      if (window.socket && socket.on) {
        socket.on("changeMedia", data => { setTitle(data?.title || ""); mountTitleIntoSlot(); });
        socket.on("setCurrent",  data => { setTitle(data?.title || ""); mountTitleIntoSlot(); });
        socket.on("mediaUpdate", ()   => { setTitle(); mountTitleIntoSlot(); });
      }
    } catch(_) {}

    // 4) Watch the queue; if active item changes, update text
    const q = $("#queue");
    if (q && !q._btfwNPObs){
      const mo = new MutationObserver(()=> { setTitle(getQueueActiveTitle()); mountTitleIntoSlot(); });
      mo.observe(q, { childList:true, subtree:true });
      q._btfwNPObs = mo;
    }

    // 5) Watch the whole body; if CyTube re-inserts #currenttitle, remount it
    if (!document._btfwNpMoveObs){
      const obs = new MutationObserver(()=> mountTitleIntoSlot());
      obs.observe(document.body, { childList:true, subtree:true });
      document._btfwNpMoveObs = obs;
    }

    // 6) One more delayed pass after layout settles
    setTimeout(()=> { mountTitleIntoSlot(); setTitle(); }, 200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:nowplaying", setTitle, mountTitleIntoSlot };
});
