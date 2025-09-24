BTFW.define("feature:videoOverlay", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);
  const $ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const CONTROL_SELECTORS = [
    "#mediarefresh",
    "#voteskip", 
    "#fullscreenbtn"
  ];

  const LS = { localSubs: "btfw:video:localsubs" };
  const localSubsEnabled = () => { try { return localStorage.getItem(LS.localSubs) !== "0"; } catch(_) { return true; } };
  const setLocalSubs = v => { try { localStorage.setItem(LS.localSubs, v?"1":"0"); } catch(_){}; document.dispatchEvent(new CustomEvent("btfw:video:localsubs:changed",{detail:{enabled:!!v}})); };

  let refreshClickCount = 0;
  let refreshCooldownUntil = 0;
  let isAmbientActive = false;
  let ambientScript = null;
  let overlayTimeout = null;

  function ensureCSS(){
    if ($("#btfw-vo-css")) return;
    const st = document.createElement("style");
    st.id = "btfw-vo-css";
    st.textContent = `
      #btfw-video-overlay{
        position:absolute;
        inset:0;
        pointer-events:none;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0.3) 0%,
          transparent 30%,
          transparent 70%,
          rgba(0, 0, 0, 0.3) 100%
        );
      }
      
      #btfw-video-overlay.btfw-vo-visible {
        opacity: 1;
      }
      
      #btfw-video-overlay .btfw-vo-bar{
        position:absolute; right:12px; top:12px; display:flex; gap:8px; pointer-events:auto;
        background:transparent;
      }
      
      #btfw-video-overlay .btfw-vo-btn{
        display:inline-grid; place-items:center; min-width:44px; height:44px; padding:0;
        border:0; border-radius:22px; background:rgba(0, 0, 0, 0.4); color:#fff; cursor:pointer;
        font:14px/1 system-ui,Segoe UI,Arial; 
        backdrop-filter: blur(12px) saturate(120%);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      #btfw-video-overlay .btfw-vo-btn:hover{ 
        background: rgba(109, 77, 246, 0.8);
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(109, 77, 246, 0.3);
      }
      
      #btfw-video-overlay .btfw-vo-btn:active {
        transform: translateY(0);
      }
      
      #btfw-video-overlay .btfw-vo-btn i {
        transition: transform 0.2s ease;
      }
      
      #btfw-video-overlay .btfw-vo-btn:hover i {
        transform: scale(1.1);
      }
      
      #btfw-video-overlay .btfw-vo-adopted{
        all: unset; display:inline-grid; place-items:center; min-width:44px; height:44px;
        padding:0; border-radius:22px; background:rgba(0, 0, 0, 0.4); color:#fff; cursor:pointer;
        backdrop-filter: blur(12px) saturate(120%);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-size: 14px;
      }
      
      #btfw-video-overlay .btfw-vo-adopted:hover {
        background: rgba(109, 77, 246, 0.8);
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(109, 77, 246, 0.3);
      }
      
      #btfw-ambient.active {
        background: rgba(109, 77, 246, 0.8);
      }
      
      .btfw-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 12px;
        color: #ffffff;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(12px) saturate(120%);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        max-width: 300px;
      }

      .btfw-notification--show {
        transform: translateX(0);
        opacity: 1;
      }

      .btfw-notification--success {
        background: rgba(34, 197, 94, 0.9);
        border: 1px solid rgba(34, 197, 94, 0.3);
      }

      .btfw-notification--error {
        background: rgba(239, 68, 68, 0.9);
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .btfw-notification--warning {
        background: rgba(245, 158, 11, 0.9);
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      .btfw-notification--info {
        background: rgba(59, 130, 246, 0.9);
        border: 1px solid rgba(59, 130, 246, 0.3);
      }
      
      #btfw-mini-toast{position:fixed;right:12px;bottom:12px;background:#111a;color:#fff;padding:8px 12px;border-radius:8px;font:12px/1.2 system-ui,Segoe UI,Arial;z-index:99999;pointer-events:none;opacity:0;transition:opacity .2s}
      
      @media (max-width: 768px) {
        #btfw-video-overlay .btfw-vo-bar {
          top: 8px;
          right: 8px;
          gap: 6px;
        }
        
        #btfw-video-overlay .btfw-vo-btn,
        #btfw-video-overlay .btfw-vo-adopted {
          min-width: 40px;
          height: 40px;
          border-radius: 20px;
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(st);
  }

  function ensureOverlay(){
    const wrap = $("#videowrap");
    if (!wrap) return null;

    let ov = $("#btfw-video-overlay");
    if (!ov){
      ov = document.createElement("div");
      ov.id = "btfw-video-overlay";
    }
    if (ov.parentElement !== wrap) wrap.appendChild(ov);

    let bar = $("#btfw-vo-bar");
    if (!bar){
      bar = document.createElement("div");
      bar.className = "btfw-vo-bar";
      bar.id = "btfw-vo-bar";
      ov.appendChild(bar);
    }

    setupHoverEffects(wrap, ov);
    ensureLocalSubsButton(bar);
    ensureCustomButtons(bar);
    adoptNativeControls(bar);

    return ov;
  }

  function setupHoverEffects(videowrap, overlay) {
    if (overlay._hoverSetup) return;
    overlay._hoverSetup = true;

    let hideTimer = null;

    function showOverlay() {
      clearTimeout(hideTimer);
      overlay.classList.add("btfw-vo-visible");
      overlay.style.pointerEvents = "none";
    }

    function hideOverlay() {
      overlay.classList.remove("btfw-vo-visible");
    }

    function scheduleHide() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideOverlay, 3000);
    }

    videowrap.addEventListener("mouseenter", showOverlay);
    videowrap.addEventListener("mousemove", () => {
      showOverlay();
      scheduleHide();
    });

    videowrap.addEventListener("mouseleave", hideOverlay);

    overlay.addEventListener("mouseenter", () => {
      clearTimeout(hideTimer);
      showOverlay();
    });

    overlay.addEventListener("mouseleave", scheduleHide);
  }

  function ensureCustomButtons(bar) {
    const customButtons = [
      { id: "btfw-fullscreen", icon: "fas fa-expand", tooltip: "Fullscreen", action: toggleFullscreen },
      { id: "btfw-ambient", icon: "fas fa-sun", tooltip: "Ambient Mode", action: toggleAmbient },
      { id: "btfw-airplay", icon: "fas fa-cast", tooltip: "AirPlay", action: enableAirplay }
    ];

    customButtons.forEach(btnConfig => {
      let btn = $("#" + btnConfig.id);
      if (!btn) {
        btn = document.createElement("button");
        btn.id = btnConfig.id;
        btn.className = "btfw-vo-btn";
        btn.innerHTML = `<i class="${btnConfig.icon}"></i>`;
        btn.title = btnConfig.tooltip;
        btn.addEventListener("click", btnConfig.action);
        bar.appendChild(btn);
      }
    });
  }

  function adoptNativeControls(bar){
    CONTROL_SELECTORS.forEach(sel => {
      const el = $(sel);
      if (!el) return;

      if (el.dataset.btfwOverlay === "1") {
        if (el.parentElement !== bar) bar.appendChild(el);
        return;
      }

      const ph = document.createElement("span");
      ph.hidden = true;
      ph.setAttribute("data-btfw-ph", sel);
      try { el.insertAdjacentElement("afterend", ph); } catch(_){}

      el.classList.add("btfw-vo-adopted");
      el.dataset.btfwOverlay = "1";

      if (el.id === "mediarefresh") {
        const originalClick = el.onclick;
        el.onclick = (e) => {
          e.preventDefault();
          handleMediaRefresh();
        };
      }

      bar.appendChild(el);
    });
  }

  function ensureLocalSubsButton(bar){
    let btn = $("#btfw-vo-subs");
    if (!btn){
      btn = document.createElement("button");
      btn.id = "btfw-vo-subs";
      btn.className = "btfw-vo-btn";
      btn.title = "Load local subtitles (.vtt/.srt)";
      btn.innerHTML = `<i class="fa fa-closed-captioning"></i>`;
      btn.addEventListener("click", (e)=>{ e.preventDefault(); pickLocalSubs(); });
      bar.prepend(btn);
    }
    btn.style.display = localSubsEnabled() ? "" : "none";
  }

  function toggleFullscreen() {
    const videowrap = $("#videowrap");
    if (!videowrap) return;

    if (!document.fullscreenElement) {
      if (videowrap.requestFullscreen) {
        videowrap.requestFullscreen();
      } else if (videowrap.webkitRequestFullscreen) {
        videowrap.webkitRequestFullscreen();
      } else if (videowrap.mozRequestFullScreen) {
        videowrap.mozRequestFullScreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      }
    }
  }

  function handleMediaRefresh() {
    const now = Date.now();
    
    if (now < refreshCooldownUntil) {
      const remainingSeconds = Math.ceil((refreshCooldownUntil - now) / 1000);
      showNotification(`Refresh on cooldown for ${remainingSeconds}s`, "warning");
      return;
    }

    refreshClickCount++;
    
    if (refreshClickCount >= 10) {
      refreshCooldownUntil = now + 30000;
      refreshClickCount = 0;
      showNotification("Refresh limit reached. 30s cooldown active.", "error");
      return;
    }

    setTimeout(() => {
      if (refreshClickCount > 0) refreshClickCount--;
    }, 10000);

    try {
      if (window.socket) {
        socket.emit("playerReady");
      }
    } catch (e) {
      console.warn("[video-overlay] Media refresh failed:", e);
    }
    
    showNotification("Media refreshed", "success");
  }

  async function toggleAmbient() {
    if (!ambientScript) {
      try {
        showNotification("Loading ambient mode...", "info");
        await loadAmbientScript();
      } catch (e) {
        showNotification("Failed to load ambient mode", "error");
        return;
      }
    }

    isAmbientActive = !isAmbientActive;
    
    try {
      if (window.toggleAmbient) {
        window.toggleAmbient();
      } else if (window.ambientToggle) {
        window.ambientToggle();
      }
    } catch (e) {
      console.warn("[video-overlay] Ambient toggle failed:", e);
    }

    const btn = $("#btfw-ambient");
    if (btn) {
      btn.classList.toggle("active", isAmbientActive);
    }

    showNotification(isAmbientActive ? "Ambient mode enabled" : "Ambient mode disabled", "info");
  }

  function loadAmbientScript() {
    return new Promise((resolve, reject) => {
      if (ambientScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://billtube.github.io/BillTube2/BillTube_Ambient.js';
      script.onload = () => {
        ambientScript = script;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load ambient script'));
      document.head.appendChild(script);
    });
  }

  function enableAirplay() {
    const video = document.querySelector("#ytapiplayer video, #ytapiplayer");
    if (video) {
      video.setAttribute("airplay", "allow");
      video.setAttribute("x-webkit-airplay", "allow");
      
      if (video.webkitShowPlaybackTargetPicker) {
        video.webkitShowPlaybackTargetPicker();
      }
      
      showNotification("AirPlay enabled", "success");
    } else {
      showNotification("AirPlay not available", "warning");
    }

    if (window.socket) {
      socket.on("changeMedia", () => {
        setTimeout(() => {
          const video = document.querySelector("#ytapiplayer video");
          if (video) {
            video.setAttribute("airplay", "allow");
            video.setAttribute("x-webkit-airplay", "allow");
          }
        }, 1000);
      });
    }
  }

  function showNotification(message, type = "info") {
    let notification = document.getElementById("btfw-notification");
    
    if (!notification) {
      notification = document.createElement("div");
      notification.id = "btfw-notification";
      notification.className = "btfw-notification";
      document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.className = `btfw-notification btfw-notification--${type} btfw-notification--show`;

    clearTimeout(notification._hideTimer);
    notification._hideTimer = setTimeout(() => {
      notification.classList.remove("btfw-notification--show");
    }, 3000);
  }

  function getHTML5Video(){ return $('video'); }

  function srtToVtt(text){
    let s = (text||"").replace(/\r\n/g,"\n").trim() + "\n";
    s = s.replace(/^\d+\s*$\n/gm,"");
    s = s.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,"$1.$2");
    s = s.replace(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/g,"$1 --> $2");
    return "WEBVTT\n\n"+s;
  }

  async function pickLocalSubs(){
    const video = getHTML5Video();
    if (!video){ toast("Local subs only for HTML5 sources."); return; }

    const inp = document.createElement("input");
    inp.type="file"; inp.accept=".vtt,.srt,text/vtt,text/plain"; inp.style.display="none";
    document.body.appendChild(inp);

    const done = new Promise(res=>{
      inp.addEventListener("change", async ()=>{
        const f = inp.files && inp.files[0];
        document.body.removeChild(inp);
        if (!f) return res(false);
        try{
          const txt = await f.text();
          const ext = (f.name.split(".").pop()||"").toLowerCase();
          let vtt = (ext==="srt")? srtToVtt(txt) : (txt.startsWith("WEBVTT")? txt : "WEBVTT\n\n"+txt);
          const url = URL.createObjectURL(new Blob([vtt],{type:"text/vtt"}));
          attachTrack(video, url, f.name.replace(/\.[^.]+$/,"")||"Local");
          toast("Subtitles loaded.");
          res(true);
        }catch(e){ console.error(e); toast("Failed to load subtitles."); res(false); }
      }, { once:true });
    });

    inp.click();
    await done;
  }

  function attachTrack(video, url, label){
    $('track[data-btfw="1"]', video)?.remove();
    const tr = document.createElement("track");
    tr.kind="subtitles"; tr.label=label||"Local"; tr.srclang="en"; tr.src=url; tr.default=true; tr.setAttribute("data-btfw","1");
    video.appendChild(tr);
    try { for (const t of video.textTracks) t.mode = (t.label===tr.label)?"showing":"disabled"; } catch(_){}
  }

  function toast(msg){
    let t=$("#btfw-mini-toast"); if(!t){ t=document.createElement("div"); t.id="btfw-mini-toast"; document.body.appendChild(t); }
    t.textContent=msg; t.style.opacity="1"; clearTimeout(t._hid); t._hid=setTimeout(()=>t.style.opacity="0",1400);
  }

  function boot(){
    ensureCSS();
    ensureOverlay();

    const targets = [ $("#videowrap"), $("#rightcontrols"), $("#leftcontrols"), document.body ].filter(Boolean);
    const mo = new MutationObserver(()=> ensureOverlay());
    targets.forEach(t => mo.observe(t, { childList:true, subtree:true }));

    document.addEventListener("btfw:video:localsubs:changed", ()=> ensureOverlay());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    name:"feature:videoOverlay",
    setLocalSubsEnabled: setLocalSubs,
    toggleFullscreen,
    toggleAmbient,
    enableAirplay
  };
});BTFW.define("feature:videoOverlay", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);

  let overlayTimeout = null;
  let refreshClickCount = 0;
  let refreshCooldownUntil = 0;
  let isAmbientActive = false;
  let ambientScript = null;

  function createOverlay() {
    const videowrap = $("#videowrap");
    if (!videowrap) return null;

    let overlay = videowrap.querySelector("#btfw-video-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "btfw-video-overlay";
    overlay.className = "btfw-video-overlay";
    overlay.style.opacity = "0";

    const controlsContainer = document.createElement("div");
    controlsContainer.className = "btfw-vo-controls";

    const buttons = [
      { id: "btfw-fullscreen", icon: "expand", tooltip: "Fullscreen", action: toggleFullscreen },
      { id: "btfw-voteskip", icon: "forward", tooltip: "Vote Skip", action: handleVoteSkip },
      { id: "btfw-refresh", icon: "refresh", tooltip: "Refresh Media", action: handleMediaRefresh },
      { id: "btfw-ambient", icon: "sun", tooltip: "Ambient Mode", action: toggleAmbient },
      { id: "btfw-airplay", icon: "cast", tooltip: "AirPlay", action: enableAirplay }
    ];

    buttons.forEach(btn => {
      const button = document.createElement("button");
      button.id = btn.id;
      button.className = "btfw-vo-btn";
      button.innerHTML = `<i class="fas fa-${btn.icon}"></i>`;
      button.title = btn.tooltip;
      button.addEventListener("click", btn.action);
      controlsContainer.appendChild(button);
    });

    overlay.appendChild(controlsContainer);
    videowrap.appendChild(overlay);

    setupOverlayEvents(videowrap, overlay);
    return overlay;
  }

  function setupOverlayEvents(videowrap, overlay) {
    let hideTimer = null;

    function showOverlay() {
      clearTimeout(hideTimer);
      overlay.style.opacity = "1";
      overlay.style.pointerEvents = "auto";
    }

    function hideOverlay() {
      overlay.style.opacity = "0";
      setTimeout(() => {
        if (overlay.style.opacity === "0") {
          overlay.style.pointerEvents = "none";
        }
      }, 300);
    }

    function scheduleHide() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideOverlay, 3000);
    }

    videowrap.addEventListener("mouseenter", showOverlay);
    videowrap.addEventListener("mousemove", () => {
      showOverlay();
      scheduleHide();
    });

    videowrap.addEventListener("mouseleave", hideOverlay);

    overlay.addEventListener("mouseenter", () => {
      clearTimeout(hideTimer);
      showOverlay();
    });

    overlay.addEventListener("mouseleave", scheduleHide);
  }

  function toggleFullscreen() {
    const videowrap = $("#videowrap");
    if (!videowrap) return;

    const video = videowrap.querySelector("video, iframe");
    if (!video) return;

    if (!document.fullscreenElement) {
      if (videowrap.requestFullscreen) {
        videowrap.requestFullscreen();
      } else if (videowrap.webkitRequestFullscreen) {
        videowrap.webkitRequestFullscreen();
      } else if (videowrap.mozRequestFullScreen) {
        videowrap.mozRequestFullScreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      }
    }
  }

  function handleVoteSkip() {
    const voteSkipBtn = $("#voteskip");
    if (voteSkipBtn && !voteSkipBtn.disabled) {
      voteSkipBtn.click();
    } else {
      try {
        if (window.socket) {
          socket.emit("voteskip");
        }
      } catch (e) {
        console.warn("[video-overlay] Vote skip failed:", e);
      }
    }
  }

  function handleMediaRefresh() {
    const now = Date.now();
    
    if (now < refreshCooldownUntil) {
      const remainingSeconds = Math.ceil((refreshCooldownUntil - now) / 1000);
      showNotification(`Refresh on cooldown for ${remainingSeconds}s`, "warning");
      return;
    }

    refreshClickCount++;
    
    if (refreshClickCount >= 10) {
      refreshCooldownUntil = now + 30000;
      refreshClickCount = 0;
      showNotification("Refresh limit reached. 30s cooldown active.", "error");
      return;
    }

    setTimeout(() => {
      if (refreshClickCount > 0) refreshClickCount--;
    }, 10000);

    const refreshBtn = $("#mediarefresh");
    if (refreshBtn && !refreshBtn.disabled) {
      refreshBtn.click();
    } else {
      try {
        if (window.socket) {
          socket.emit("playerReady");
        }
      } catch (e) {
        console.warn("[video-overlay] Media refresh failed:", e);
      }
    }
    
    showNotification("Media refreshed", "success");
  }

  async function toggleAmbient() {
    if (!ambientScript) {
      try {
        showNotification("Loading ambient mode...", "info");
        await loadAmbientScript();
      } catch (e) {
        showNotification("Failed to load ambient mode", "error");
        return;
      }
    }

    isAmbientActive = !isAmbientActive;
    
    try {
      if (window.toggleAmbient) {
        window.toggleAmbient();
      } else if (window.ambientToggle) {
        window.ambientToggle();
      }
    } catch (e) {
      console.warn("[video-overlay] Ambient toggle failed:", e);
    }

    const btn = $("#btfw-ambient");
    if (btn) {
      btn.style.background = isAmbientActive 
        ? "rgba(109, 77, 246, 0.8)" 
        : "rgba(0, 0, 0, 0.4)";
    }

    showNotification(isAmbientActive ? "Ambient mode enabled" : "Ambient mode disabled", "info");
  }

  function loadAmbientScript() {
    return new Promise((resolve, reject) => {
      if (ambientScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://billtube.github.io/BillTube2/BillTube_Ambient.js';
      script.onload = () => {
        ambientScript = script;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load ambient script'));
      document.head.appendChild(script);
    });
  }

  function enableAirplay() {
    const video = document.querySelector("#ytapiplayer video, #ytapiplayer");
    if (video) {
      video.setAttribute("airplay", "allow");
      video.setAttribute("x-webkit-airplay", "allow");
      
      if (video.webkitShowPlaybackTargetPicker) {
        video.webkitShowPlaybackTargetPicker();
      }
      
      showNotification("AirPlay enabled", "success");
    } else {
      showNotification("AirPlay not available", "warning");
    }
  }

  function showNotification(message, type = "info") {
    let notification = document.getElementById("btfw-notification");
    
    if (!notification) {
      notification = document.createElement("div");
      notification.id = "btfw-notification";
      notification.className = "btfw-notification";
      document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.className = `btfw-notification btfw-notification--${type} btfw-notification--show`;

    clearTimeout(notification._hideTimer);
    notification._hideTimer = setTimeout(() => {
      notification.classList.remove("btfw-notification--show");
    }, 3000);
  }

  function injectCSS() {
    if (document.getElementById("btfw-video-overlay-css")) return;

    const style = document.createElement("style");
    style.id = "btfw-video-overlay-css";
    style.textContent = `
      .btfw-video-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        pointer-events: none;
        transition: opacity 0.3s ease;
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0.3) 0%,
          transparent 30%,
          transparent 70%,
          rgba(0, 0, 0, 0.3) 100%
        );
      }

      .btfw-vo-controls {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        gap: 8px;
        pointer-events: auto;
      }

      .btfw-vo-btn {
        width: 44px;
        height: 44px;
        border-radius: 22px;
        border: none;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(12px) saturate(120%);
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      .btfw-vo-btn:hover {
        background: rgba(109, 77, 246, 0.8);
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(109, 77, 246, 0.3);
      }

      .btfw-vo-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      .btfw-vo-btn i {
        transition: transform 0.2s ease;
      }

      .btfw-vo-btn:hover i {
        transform: scale(1.1);
      }

      #btfw-ambient.active {
        background: rgba(109, 77, 246, 0.8);
      }

      .btfw-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 12px;
        color: #ffffff;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(12px) saturate(120%);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        max-width: 300px;
      }

      .btfw-notification--show {
        transform: translateX(0);
        opacity: 1;
      }

      .btfw-notification--success {
        background: rgba(34, 197, 94, 0.9);
        border: 1px solid rgba(34, 197, 94, 0.3);
      }

      .btfw-notification--error {
        background: rgba(239, 68, 68, 0.9);
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .btfw-notification--warning {
        background: rgba(245, 158, 11, 0.9);
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      .btfw-notification--info {
        background: rgba(59, 130, 246, 0.9);
        border: 1px solid rgba(59, 130, 246, 0.3);
      }

      @media (max-width: 768px) {
        .btfw-vo-controls {
          top: 8px;
          right: 8px;
          gap: 6px;
        }
        
        .btfw-vo-btn {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          font-size: 14px;
        }
        
        .btfw-notification {
          top: 10px;
          right: 10px;
          left: 10px;
          max-width: none;
        }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .btfw-vo-btn.loading {
        animation: pulse 1s infinite;
      }
    `;

    document.head.appendChild(style);
  }

  function boot() {
    injectCSS();
    
    const checkVideoWrap = () => {
      const videowrap = $("#videowrap");
      if (videowrap) {
        createOverlay();
        
        if (window.socket) {
          socket.on("changeMedia", () => {
            setTimeout(() => {
              const video = document.querySelector("#ytapiplayer video");
              if (video) {
                video.setAttribute("airplay", "allow");
                video.setAttribute("x-webkit-airplay", "allow");
              }
            }, 1000);
          });
        }
      } else {
        setTimeout(checkVideoWrap, 500);
      }
    };

    checkVideoWrap();
  }

  document.addEventListener("btfw:layoutReady", boot);
  if (document.readyState !== "loading") {
    setTimeout(boot, 100);
  }

  return {
    name: "feature:videoOverlay",
    createOverlay,
    toggleFullscreen,
    toggleAmbient,
    enableAirplay
  };
});