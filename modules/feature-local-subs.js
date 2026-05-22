
BTFW.define("feature:local-subs", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  const LOCAL_LABEL_PREFIX = "Local: ";

  function getMediaType(){
    try {
      return window.PLAYER?.mediaType || null;
    } catch(_) {
      return null;
    }
  }

  function isDirectMedia(){
    const type = (getMediaType() || "").toLowerCase();
    return type === "fi" || type === "gd";
  }

  function isLocalLabel(label){
    return typeof label === "string" && label.indexOf(LOCAL_LABEL_PREFIX) === 0;
  }

  function shortLabelFromFile(name){
    const base = String(name || "Subtitles").replace(/\.(srt|vtt)$/i, "");
    return LOCAL_LABEL_PREFIX + (base.length > 28 ? base.slice(0, 27) + "…" : base);
  }

  function convertSRTtoVTT(srt){
    return "WEBVTT\n\n" + String(srt)
      .replace(/\r+/g, "")
      .replace(/^\d+\s+|\n\d+\s+/g, "")
      .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, "$1:$2:$3.$4");
  }

  function vttURLFromContent(txt){
    const blob = new Blob([txt], { type: "text/vtt" });
    return URL.createObjectURL(blob);
  }

  function removeOldLocalTracksFromVideoEl(video){
    try {
      const tracks = video.querySelectorAll('track[data-btfw-local-subs="1"]');
      tracks.forEach(t => {
        try {
          if (t.src && t.src.startsWith("blob:")) URL.revokeObjectURL(t.src);
        } catch(_) {}
        t.remove();
      });
    } catch(_) {}
  }
  function addTrackToVideoEl(video, src, label){
    const t = document.createElement("track");
    t.kind = "subtitles";
    t.src  = src;
    t.label= label;
    t.default = true;
    t.dataset.btfwLocalSubs = "1";
    video.appendChild(t);
  }

  // Video.js interop (if present)
  function getVideoJS(){
    try { return (window.videojs && videojs("ytapiplayer")) || null; } catch(_) { return null; }
  }
  function removeOldLocalTracksFromVJS(vjs){
    try {
      const list = vjs.remoteTextTracks();
      for (let i = list.length - 1; i >= 0; i--) {
        const t = list[i];
        if (!t || !isLocalLabel(t.label)) continue;
        try {
          if (t.src && t.src.startsWith("blob:")) URL.revokeObjectURL(t.src);
        } catch(_) {}
        try { vjs.removeRemoteTextTrack(t); } catch(_) {}
      }
    } catch(_) {}
  }
  function addTrackToVJS(vjs, src, label){
    try {
      const trackEl = vjs.addRemoteTextTrack({ kind:"subtitles", src, default:true, label }, false);
      if (trackEl && trackEl.setAttribute) {
        trackEl.setAttribute("data-btfw-local-subs", "1");
      }
      return trackEl;
    } catch(_) { return null; }
  }

  function getActiveHTML5Video(){
    const v = $("#ytapiplayer video") || $("video");
    return v || null;
  }

  function pickAndLoad(){
    let input = $("#btfw-localsubs-input");
    if (!input) {
      input = document.createElement("input");
      input.type = "file";
      input.accept = ".vtt,.srt";
      input.id = "btfw-localsubs-input";
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", async (e)=>{
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev){
          let text = String(ev.target.result || "");
          if (file.name.toLowerCase().endsWith(".srt")) {
            text = convertSRTtoVTT(text);
          }
          const url = vttURLFromContent(text);
          const label = shortLabelFromFile(file.name);

          const vjs = getVideoJS();
          if (vjs) {
            // Only clear previous *local* tracks so auto-subs tracks survive.
            removeOldLocalTracksFromVJS(vjs);
            addTrackToVJS(vjs, url, label);
          } else {
            const video = getActiveHTML5Video();
            if (video) {
              removeOldLocalTracksFromVideoEl(video);
              addTrackToVideoEl(video, url, label);
            } else {
              console.warn("[local-subs] No compatible video element found.");
            }
          }
        };
        reader.readAsText(file);
        e.target.value = "";
      });
    }
    input.click();
  }

  function updateButtonVisibility(){
    const btn = $("#btfw-btn-localsubs");
    if (!btn) return;
    btn.style.display = isDirectMedia() ? "" : "none";
  }

  function injectButton(){
    const overlay = $("#VideoOverlay");
    if (!overlay) return;

    let btn = $("#btfw-btn-localsubs");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "btfw-btn-localsubs";
      btn.className = "button is-dark is-small btfw-vo-btn";
      btn.title = "Local Subtitles (VTT/SRT)";
      btn.innerHTML = `<i class="fa fa-closed-captioning"></i>`;
      btn.addEventListener("click", pickAndLoad);
      overlay.querySelector(".btfw-vo-buttons")?.appendChild(btn) || overlay.appendChild(btn);
    }

    updateButtonVisibility();
  }

  // Clear local tracks on media change — leave auto-subs's tracks alone.
  function wireChangeMedia(){
    try {
      if (window.socket && socket.on && !window._btfw_localsubs_wired) {
        window._btfw_localsubs_wired = true;
        socket.on("changeMedia", ()=>{
          const vjs = getVideoJS();
          if (vjs) removeOldLocalTracksFromVJS(vjs);
          const v = getActiveHTML5Video();
          if (v) removeOldLocalTracksFromVideoEl(v);
          setTimeout(updateButtonVisibility, 0);
        });
      }
    } catch(_) {}
  }

  function boot(){
    wireChangeMedia();
    injectButton();
    updateButtonVisibility();
    const mo = new MutationObserver(()=> {
      injectButton();
      updateButtonVisibility();
    });
    mo.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    name: "feature:local-subs",
    isLocalLabel
  };
});
