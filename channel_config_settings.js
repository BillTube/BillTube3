// ==BTFW_THEME_ADMIN_START==
window.BTFW_THEME_ADMIN = {
    "version": 6,
    "tint": "custom",
    "colors": {
      "background": "#110802",
      "surface": "#190d05",
      "panel": "#211b17",
      "text": "#fbe3c9",
      "chatText": "#e6caad",
      "accent": "#d97436"
    },
    "slider": {
      "enabled": true,
      "feedUrl": "https://cdn.jsdelivr.net/gh/IntentionallyIncomplete/BadMovieCytube@dev/channels.json"
    },
    "typography": {
      "preset": "nunito",
      "customFamily": ""
    },
    "integrations": {
      "enabled": true,
      "tmdb": {
        "apiKey": "6459fcd631e69317f25758b82f77615d"
      }
    },
    "resources": {
      "scripts": [],
      "styles": [],
      "modules": [
        "https://dl.dropbox.com/scl/fi/wg1bii426nkcfo4b7ch70/audioboost_module.js?rlkey=7jbcv6s56vh5s17vz1070cbaq&dl=0",
        "https://dl.dropbox.com/scl/fi/a9psx3wce0ea2d5bq4h12/movie_info_module.js?rlkey=w6b5ngc2ahd92gv483jfoi6ix&dl=0",
        "https://dl.dropbox.com/scl/fi/okc1i0pgew93zfzdjb4o1/movie_suggestion_module.js?rlkey=a2he954g5w3dvkupoeedhz1m9&dl=0",
        "https://dl.dropbox.com/scl/fi/q72lsam25mkzb5mnrtn6m/autosubs_module.js?rlkey=fppgxw5a11zb5binpljo8k93o&dl=0"
      ]
    },
    "branding": {
      "headerName": "BillTube3 Slim (Experimental)",
      "faviconUrl": "https://icons8.com/icon/19706/experiment",
      "posterUrl": "https://tinyurl.com/332v25ny"
    }
  };
  // ==BTFW_THEME_ADMIN_END==
  
  /* BillTube3 one-shot loader for CyTube Channel JS */
  (function (W, D) {
    // --- configurable bits ---
    var CDN_BASE = "https://cdn.jsdelivr.net/gh/intentionallyIncomplete@dev/BillTube3-slim";
    var FILE     = "billtube-fw.js";
    var VERSION  = "dev-000";
    var DEV_NOCACHE = false;
    // --------------------------
  
    // Already loaded/applied? bail.
    if (W.BTFW && W.BTFW.init) { console.debug("[BTFW] already present; skip"); return; }
    if (D.querySelector('script[data-btfw-loader]')) { console.debug("[BTFW] loader tag exists; skip"); return; }
    if (D.getElementById("btfw-grid")) { console.debug("[BTFW] layout present; skip"); return; }
  
    // var qs = function (s) { return D.querySelector(s); };
    var stamp = DEV_NOCACHE ? ("&t=" + Date.now()) : "";
    var primary = CDN_BASE + "/" + FILE + "?v=" + encodeURIComponent(VERSION) + stamp;
  
    function inject(src, attr) {
      var s = D.createElement("script");
      s.src = src;
      s.async = false;
      s.defer = false;
      s.dataset.btfwLoader = "1";
      if (attr) Object.keys(attr).forEach(function (k) { s.setAttribute(k, attr[k]); });
      D.head.appendChild(s);
      return s;
    }
    // Primary load
    var tag = inject(primary);
  
    // Fallback to rawcdn.githack if jsDelivr fails
    tag.onerror = function () {
      console.warn("[BTFW] primary failed, trying fallback");
      inject("https://raw.githack.com/intentionallyIncomplete/BillTube3-slim/dev/" + FILE + "?" + Date.now(), { "data-btfw-fallback": "1" });
    };
  })(window, document);