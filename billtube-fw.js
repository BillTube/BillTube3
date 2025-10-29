/*! BillTube Framework — v3.4f */
const DEV_CDN = "https://cdn.jsdelivr.net/gh/intentionallyIncomplete/BillTube3-slim@dev";

(function(){
  var Registry=Object.create(null);
  function define(name,deps,factory){ Registry[name]={deps:deps||[],factory:factory,instance:null}; }
  async function init(name){
    var m=Registry[name]; if(!m) throw new Error("Module not found: "+name);
    if(m.instance) return m.instance;
    for(var i=0;i<m.deps.length;i++){ await init(m.deps[i]); }
    m.instance = await m.factory({define, init, DEV_CDN});
    return m.instance;
  }
  window.BTFW = { define, init, DEV_CDN };

  var BootOverlay=(function(){
    var overlay=null;
    var styleEl=null;
    var muteInterval=null;
    var suppressedVideos=new Map();

    function cleanupVideoRefs(){
      for (const [video] of suppressedVideos) {
        if (!(video instanceof HTMLVideoElement) || !video.isConnected) {
          suppressedVideos.delete(video);
        }
      }
    }

    function suppressVideoAudio(){
      cleanupVideoRefs();
      var videos=document.querySelectorAll('video');
      videos.forEach(function(video){
        if (!(video instanceof HTMLVideoElement)) return;
        if (!suppressedVideos.has(video)) {
          var state={
            muted: video.muted,
            volume: (typeof video.volume === 'number') ? video.volume : null
          };
          suppressedVideos.set(video, state);
        }
        try { video.muted = true; }
        catch(_){}
      });
    }

    function startAudioSuppression(){
      suppressVideoAudio();
      if (muteInterval) return;
      muteInterval = setInterval(suppressVideoAudio, 250);
      document.documentElement && document.documentElement.classList.add('btfw-loading-muted');
    }

    function stopAudioSuppression(){
      if (muteInterval) {
        clearInterval(muteInterval);
        muteInterval = null;
      }
      for (const [video, state] of suppressedVideos.entries()) {
        if (!(video instanceof HTMLVideoElement)) {
          suppressedVideos.delete(video);
          continue;
        }
        try {
          if (!state.muted) {
            video.muted = false;
            if (typeof state.volume === 'number') video.volume = state.volume;
          }
        } catch(_){}
        suppressedVideos.delete(video);
      }
      document.documentElement && document.documentElement.classList.remove('btfw-loading-muted');
    }

    function ensureStyles(){
      if (styleEl) return;
      styleEl=document.createElement('style');
      styleEl.id='btfw-boot-overlay-style';
      styleEl.textContent="\n        #btfw-boot-overlay{\n          position:fixed;\n          inset:0;\n          background:radial-gradient(circle at 20% 20%, rgba(41,52,89,0.28), rgba(5,6,13,0.92));\n          backdrop-filter:blur(6px);\n          display:flex;\n          align-items:center;\n          justify-content:center;\n          z-index:10000;\n          opacity:1;\n          transition:opacity 220ms ease, visibility 220ms ease;\n          visibility:visible;\n        }\n        #btfw-boot-overlay[data-state=hidden]{\n          opacity:0;\n          visibility:hidden;\n        }\n        .btfw-boot-overlay__card{\n          display:flex;\n          flex-direction:column;\n          align-items:center;\n          gap:1rem;\n          padding:2.5rem 3rem;\n          border-radius:18px;\n          background:rgba(9,12,23,0.82);\n          box-shadow:0 18px 48px rgba(3,8,20,0.45);\n          color:#f5f7ff;\n          text-align:center;\n          min-width:260px;\n          font-family:'Inter','Segoe UI',sans-serif;\n        }\n        .btfw-boot-overlay__ring{\n          width:58px;\n          height:58px;\n          border-radius:50%;\n          border:4px solid rgba(255,255,255,0.18);\n          border-top-color:#6d4df6;\n          animation:btfw-boot-spin 1s linear infinite;\n        }\n        .btfw-boot-overlay__label{\n          font-size:0.95rem;\n          letter-spacing:0.02em;\n          opacity:0.88;\n        }\n        .btfw-boot-overlay__label strong{\n          display:block;\n          font-size:1.05rem;\n          letter-spacing:0.03em;\n          margin-bottom:0.35rem;\n        }\n        .btfw-boot-overlay__error{\n          display:none;\n          font-size:0.85rem;\n          color:#ffb4c1;\n        }\n        #btfw-boot-overlay[data-state=error] .btfw-boot-overlay__error{\n          display:block;\n        }\n        #btfw-boot-overlay[data-state=error] .btfw-boot-overlay__ring{\n          border-color:rgba(255,180,193,0.3);\n          border-top-color:#ff5678;\n          animation:none;\n        }\n        @keyframes btfw-boot-spin{\n          from{transform:rotate(0deg);}\n          to{transform:rotate(360deg);}\n        }\n      ";
      document.head.appendChild(styleEl);
    }

    function attach(){
      if (overlay) return overlay;
      ensureStyles();
      overlay=document.createElement('div');
      overlay.id='btfw-boot-overlay';
      overlay.setAttribute('role','status');
      overlay.setAttribute('aria-live','polite');
      overlay.innerHTML="\n        <div class=\"btfw-boot-overlay__card\">\n          <div class=\"btfw-boot-overlay__ring\"></div>\n          <p class=\"btfw-boot-overlay__label\">\n            <strong>BillTube theme</strong>\n            Preparing the channel experience…\n          </p>\n          <p class=\"btfw-boot-overlay__error\"></p>\n        </div>\n      ";
      var mount=function(){
        if (!overlay || overlay.isConnected) return;
        var host=document.body||document.documentElement;
        host.appendChild(overlay);
      };
      if (document.body) mount();
      else document.addEventListener('DOMContentLoaded', mount, { once:true });
      return overlay;
    }

    function show(){ attach(); 
      startAudioSuppression(); }

    function hide(){
      stopAudioSuppression();
      if (!overlay) return;
      overlay.setAttribute('data-state','hidden');
      setTimeout(function(){ if(overlay){ overlay.remove(); overlay=null; } if(styleEl){ styleEl.remove(); styleEl=null; } }, 260);
    }

    function fail(message){
      var ov=attach();
      ov.setAttribute('data-state','error');
      var label=ov.querySelector('.btfw-boot-overlay__label');
      if (label) label.innerHTML='<strong>BillTube theme</strong>Something went wrong loading the experience.';
      var err=ov.querySelector('.btfw-boot-overlay__error');
      if (err) err.textContent=message||'Please refresh to retry.';
      setTimeout(function(){ hide(); }, 4000);
    }

    return { show, hide, fail };
  })();

  BootOverlay.show();

function qparam(u, kv){ return u + (u.indexOf('?')>=0?'&':'?') + kv; }

var BTFW_VERSION = (function(){
  var m = /[?&]v=([^&]+)/.exec(location.search);
  return (m && m[1]) || ('dev-' + Date.now());
})();

var SUPPORTS_PRELOAD = (function(){
  try {
    return document.createElement("link").relList.supports("preload");
  } catch (e) {
    return false;
  }
})();

function preload(href){
  return new Promise(function(resolve, reject){
    var link = document.createElement("link");
    var url;

    try {
      url = qparam(href, "v="+encodeURIComponent(BTFW_VERSION));
    } catch (err) {
      reject(err instanceof Error ? err : new Error("Failed to prepare preload URL"));
      return;
    }

    var settled = false;

    function promoteToStylesheet(){
      link.rel = "stylesheet";
      link.removeAttribute("onload");
      link.removeAttribute("onerror");
    }

    function handleLoad(){
      if (settled) return;
      settled = true;
      promoteToStylesheet();
      resolve(true);
    }

    function handleError(event){
      if (settled) return;
      settled = true;
      promoteToStylesheet();
      var reason = event && event.error ? event.error : new Error("Failed to preload stylesheet: " + href);
      reject(reason);
    }

    if (SUPPORTS_PRELOAD) {
      link.rel = "preload";
      link.as  = "style";
    } else {
      link.rel = "stylesheet";
    }

    link.onload = handleLoad;
    link.onerror = handleError;
    link.href = url;

    document.head.appendChild(link);

    if (!SUPPORTS_PRELOAD) {
      // Fallback browsers load styles directly; mark success once appended.
      // Give the browser a microtask to signal errors before resolving.
      Promise.resolve().then(function(){
        if (!settled) {
          settled = true;
          resolve(true);
        }
      });
    }
  });
}

function load(src){
  return new Promise(function(resolve, reject){
    var s = document.createElement("script");
    s.async = true; s.defer = true;
    s.src = qparam(src, "v="+encodeURIComponent(BTFW_VERSION)) + "&t=" + Date.now();
    s.onload = function(){ resolve(); };
    s.onerror = function(){ reject(new Error("Failed to load "+src)); };
    document.head.appendChild(s);
  });
}
  
  console.log('[BTFW] DEV_CDN:', DEV_CDN);
  console.log('[BTFW] isDev:', isDev);
  console.log('[BTFW] USE_BUNDLES:', USE_BUNDLES);
  // Preload CSS in proper order for layout stability
  Promise.all([
    preload(DEV_CDN+"/css/tokens.css"),
    preload(DEV_CDN+"/css/base.css"),
    preload(DEV_CDN+"/css/navbar.css"),
    preload(DEV_CDN+"/css/chat.css"),
    preload(DEV_CDN+"/css/overlays.css"),
    preload(DEV_CDN+"/css/player.css"),
    preload(DEV_CDN+"/css/mobile.css")
  ]).then(function(){
    // Always load bundled modules from the dev CDN
    var bundles = [
      "/dist/core.bundle.js",
      "/dist/chat.bundle.js",
      "/dist/player.bundle.js",
      "/dist/playlist.bundle.js",
      "/dist/admin.bundle.js",
      "/dist/features.bundle.js"
    ];
    return Promise.all(bundles.map(function(file){
      return load(DEV_CDN + file);
    }));
  }).then(function(){
    return Promise.all([
      BTFW.init("feature:styleCore"),
      BTFW.init("feature:bulma-layer")
    ]);
  }).then(function(){
    // Initialize layout early
    return BTFW.init("feature:layout");
  }).then(function(){
    // Initialize all remaining modules
    return Promise.all([
      BTFW.init("feature:channels"),
      BTFW.init("feature:footer"),
      BTFW.init("feature:player"),
      BTFW.init("feature:stack"),
      BTFW.init("feature:chat"),
      BTFW.init("feature:chat-tools"),
      BTFW.init("feature:chat-filters"),
      BTFW.init("feature:chat-username-colors"),
      BTFW.init("feature:emotes"),
      BTFW.init("feature:chatMedia"),
      BTFW.init("feature:emoji-compat"),
      BTFW.init("feature:chat-avatars"),
      BTFW.init("feature:chat-timestamps"),
      BTFW.init("feature:chat-ignore"),
      BTFW.init("feature:navbar"),
      BTFW.init("feature:modal-skin"),
      BTFW.init("feature:nowplaying"),
      BTFW.init("feature:gifs"),
      BTFW.init("feature:ambient"),
      BTFW.init("feature:videoOverlay"),
      BTFW.init("feature:poll-overlay"),
      BTFW.init("feature:pip"),
      BTFW.init("feature:notify"),
      BTFW.init("feature:syncGuard"),
      BTFW.init("feature:chat-commands"),
      BTFW.init("feature:playlistPerformance"),
      BTFW.init("feature:playlist-tools"),
      BTFW.init("feature:local-subs"),
      BTFW.init("feature:emoji-loader"),
      BTFW.init("feature:billcast"),
      BTFW.init("feature:motd-editor"),
      BTFW.init("feature:videoEnhancements"),
      BTFW.init("feature:channelThemeAdmin"),
      BTFW.init("feature:themeSettings")
    ]);
  }).then(function(){
    console.log("[BTFW v3.4f] Ready.");
    // Dispatch a final ready event
    document.dispatchEvent(new CustomEvent('btfw:ready', {
      detail: { version: '3.4f', timestamp: Date.now() }
    }));
    BootOverlay.hide();
  })
  .catch(function(e){
    console.error("[BTFW v3.4f] boot failed:", e&&e.message||e);
    BootOverlay.fail((e&&e.message)||'Unknown error');
  });
})();