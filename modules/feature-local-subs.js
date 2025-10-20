
BTFW.define("feature:local-subs", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

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

  function removeOldTracksFromVideoEl(video){
    try {
      const tracks = video.querySelectorAll("track[kind='subtitles'], track[kind='captions']");
      tracks.forEach(t => t.remove());
    } catch(_) {}
  }
  function addTrackToVideoEl(video, src, label="Subtitles"){
    const t = document.createElement("track");
    t.kind = "subtitles";
    t.src  = src;
    t.label= label;
    t.default = true;
    video.appendChild(t);
  }

  // Video.js interop (if present)
  function getVideoJS(){
    try { return (window.videojs && videojs("ytapiplayer")) || null; } catch(_) { return null; }
  }
  function removeOldTracksFromVJS(vjs){
    try {
      const list = vjs.remoteTextTracks();
      // vjs.remoteTextTracks() returns a TextTrackList; you can't iterate directly in some versions
      for (let i = list.length - 1; i >= 0; i--) {
        vjs.removeRemoteTextTrack(list[i]);
      }
    } catch(_) {}
  }
  function addTrackToVJS(vjs, src, label="Subtitles"){
    try {
      vjs.addRemoteTextTrack({ kind:"subtitles", src, default:true, label }, false);
    } catch(_) {}
  }

  function getActiveHTML5Video(){
    // CyTube’s HTML5 player <video> usually lives under #ytapiplayer
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

          const vjs = getVideoJS();
          if (vjs) {
            removeOldTracksFromVJS(vjs);
            addTrackToVJS(vjs, url, file.name);
          } else {
            const video = getActiveHTML5Video();
            if (video) {
              removeOldTracksFromVideoEl(video);
              addTrackToVideoEl(video, url, file.name);
            } else {
              console.warn("[local-subs] No compatible video element found.");
            }
          }
        };
        reader.readAsText(file);
        // reset so selecting same file again fires change
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

  // Clear tracks on media change
  function wireChangeMedia(){
    try {
      if (window.socket && socket.on && !window._btfw_localsubs_wired) {
        window._btfw_localsubs_wired = true;
        socket.on("changeMedia", ()=>{
          const vjs = getVideoJS();
          if (vjs) removeOldTracksFromVJS(vjs);
          const v = getActiveHTML5Video();
          if (v) removeOldTracksFromVideoEl(v);
          setTimeout(updateButtonVisibility, 0);
        });
      }
    } catch(_) {}
  }

  function boot(){
    wireChangeMedia();
    injectButton();
    updateButtonVisibility();
    // Watch for overlay mount/remount
    const mo = new MutationObserver(()=> {
      injectButton();
      updateButtonVisibility();
    });
    mo.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:local-subs" };
});
