/* BTFW — feature:videoOverlay (refresh + local subtitles) */
BTFW.define("feature:videoOverlay", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS = {
    localSubs: "btfw:video:localsubs" // "1" | "0"
  };

  function getPrefLocalSubs(){
    try { return localStorage.getItem(LS.localSubs) !== "0"; } catch(_) { return true; }
  }
  function setPrefLocalSubs(v){
    try { localStorage.setItem(LS.localSubs, v ? "1":"0"); } catch(_){}
    document.dispatchEvent(new CustomEvent("btfw:video:localsubs:changed",{detail:{enabled:!!v}}));
  }

  // --- Player helpers -------------------------------------------------------
  function getHTML5VideoEl(){
    // CyTube HTML5 player uses video.js; the <video> is inside .video-js or #ytapiplayer replacements
    return $('video');
  }

  function tryReloadPlayer(){
    try {
      if (typeof window.reloadPlayer === "function") {
        window.reloadPlayer();
        return true;
      }
      // Some builds expose loadMediaPlayer(media)
      if (window.loadMediaPlayer && window.PLAYER && window.PLAYER.media) {
        window.loadMediaPlayer(window.PLAYER.media);
        return true;
      }
      // Fallback: click the existing menu item if present
      const a = $$('a[onclick*="reloadPlayer"]').find(Boolean);
      if (a) { a.click(); return true; }
    } catch(e){
      console.warn("[BTFW overlay] reload fallback failed", e);
    }
    console.warn("[BTFW overlay] No supported reload hook found");
    return false;
  }

  // Minimal SRT → VTT converter (good enough for common files)
  function srtToVtt(text){
    // Normalize CRLF
    let s = text.replace(/\r\n/g, "\n").trim() + "\n";
    // Remove numeric cue indices
    s = s.replace(/^\d+\s*$\n/gm, "");
    // 00:00:01,000 --> 00:00:04,000  → commas to dots
    s = s.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
    // Ensure arrow spacing
    s = s.replace(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/g, "$1 --> $2");
    return "WEBVTT\n\n" + s;
  }

  async function pickLocalSubs(){
    const video = getHTML5VideoEl();
    if (!video) {
      toast("Local subtitles only available for HTML5 sources.");
      return;
    }

    // File picker
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".vtt,.srt,text/vtt,text/plain";
    inp.style.display = "none";
    document.body.appendChild(inp);

    const done = new Promise((resolve)=> {
      inp.addEventListener("change", async () => {
        const f = inp.files && inp.files[0];
        document.body.removeChild(inp);
        if (!f) return resolve(false);
        try {
          const txt = await f.text();
          const ext = (f.name.split(".").pop()||"").toLowerCase();
          let vttText = txt;
          if (ext === "srt") vttText = srtToVtt(txt);
          if (!vttText.startsWith("WEBVTT")) vttText = "WEBVTT\n\n" + vttText;

          // Blob URL
          const blob = new Blob([vttText], {type:"text/vtt"});
          const url  = URL.createObjectURL(blob);

          attachTrack(video, url, f.name.replace(/\.[^.]+$/, "") || "Local");
          toast("Subtitles loaded.");
          resolve(true);
        } catch(e){
          console.error("[BTFW overlay] load subs failed", e);
          toast("Failed to load subtitles.");
          resolve(false);
        }
      }, { once:true });
    });

    inp.click();
    return await done;
  }

  function attachTrack(video, url, label){
    // Remove previous BTFW track
    $(`track[data-btfw="1"]`, video)?.remove();

    const tr = document.createElement("track");
    tr.kind     = "subtitles";
    tr.label    = label || "Local";
    tr.srclang  = "en";
    tr.src      = url;
    tr.default  = true;
    tr.setAttribute("data-btfw","1");
    video.appendChild(tr);

    // Ensure it shows
    try {
      const tracks = video.textTracks;
      for (let i=0;i<tracks.length;i++){
        tracks[i].mode = (tracks[i].label === tr.label) ? "showing" : "disabled";
      }
    } catch(_){}
  }

  function toast(msg){
    // Very small non-intrusive toast (no dependency)
    let t = $("#btfw-mini-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "btfw-mini-toast";
      t.style.cssText = "position:fixed;right:12px;bottom:12px;background:#111a;backdrop-filter:saturate(1.2) blur(2px);color:#fff;padding:8px 12px;border-radius:8px;font:12px/1.2 system-ui,Segoe UI,Arial;z-index:99999;pointer-events:none";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t._hid);
    t._hid = setTimeout(()=> t.style.opacity="0", 1400);
  }

  // --- Overlay DOM ----------------------------------------------------------
  function ensureOverlay(){
    let wrap = $("#videowrap");
    if (!wrap) return null;

    let overlay = $("#btfw-video-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "btfw-video-overlay";
      overlay.className = "btfw-video-overlay";
      overlay.innerHTML = `
        <div class="btfw-vo-bar">
          <button class="btfw-vo-btn" id="btfw-vo-refresh" title="Reload player">
            <i class="fa fa-rotate-right"></i>
          </button>
          <button class="btfw-vo-btn" id="btfw-vo-subs" title="Load local subtitles (.vtt/.srt)">
            <i class="fa fa-closed-captioning"></i>
          </button>
        </div>
      `;
      wrap.appendChild(overlay);
    }

    // Wire buttons
    const btnRefresh = $("#btfw-vo-refresh", overlay);
    if (!btnRefresh._wired){
      btnRefresh._wired = true;
      btnRefresh.addEventListener("click", (e)=>{ e.preventDefault(); tryReloadPlayer() || toast("Reload not available"); });
    }

    const btnSubs = $("#btfw-vo-subs", overlay);
    if (!btnSubs._wired){
      btnSubs._wired = true;
      btnSubs.addEventListener("click", (e)=>{ e.preventDefault(); pickLocalSubs(); });
    }

    // Respect pref: show/hide Local Subs button
    btnSubs.style.display = getPrefLocalSubs() ? "" : "none";

    return overlay;
  }

  // Minimal CSS for the overlay bar (keeps your theme intact)
  function ensureCSS(){
    if ($("#btfw-vo-css")) return;
    const st = document.createElement("style");
    st.id = "btfw-vo-css";
    st.textContent = `
      #btfw-video-overlay{
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      #btfw-video-overlay .btfw-vo-bar{
        position: absolute;
        right: 8px; top: 8px;
        display: flex; gap: 6px;
        pointer-events: auto;
      }
      #btfw-video-overlay .btfw-vo-btn{
        width:32px;height:32px;border-radius:8px;border:0;
        display:grid;place-items:center;
        background:rgba(17,17,20,.75);
        color:#fff; cursor:pointer;
      }
      #btfw-video-overlay .btfw-vo-btn:hover{ filter:brightness(1.1); }
    `;
    document.head.appendChild(st);
  }

  function boot(){
    ensureCSS();
    ensureOverlay();

    // re-ensure when video area is reloaded by CyTube
    const mo = new MutationObserver((_m)=> ensureOverlay());
    $("#videowrap") && mo.observe($("#videowrap"), { childList:true, subtree:true });

    // React to theme setting change
    document.addEventListener("btfw:video:localsubs:changed", ()=> ensureOverlay());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    name: "feature:videoOverlay",
    setLocalSubsEnabled: setPrefLocalSubs
  };
});
