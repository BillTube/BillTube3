
BTFW.define("feature:layout", ["core"], async ({ require }) => {
  function ensureFontAwesome(){
    if (document.querySelector('link[data-btfw-fa6]')) return;
    var fa6 = document.createElement("link");
    fa6.rel = "stylesheet";
    fa6.dataset.btfwFa6 = "1";
    fa6.href = "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css";
    fa6.onerror = function(){
      if (document.querySelector('link[data-btfw-fa4]')) return;
      var fa4 = document.createElement("link");
      fa4.rel = "stylesheet";
      fa4.dataset.btfwFa4 = "1";
      fa4.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css";
      document.head.appendChild(fa4);
      console.warn("[BTFW] FA6 failed; loaded FA4 fallback");
    };
    document.head.appendChild(fa6);
  }

  function removeVideoHeaderOnce(){
    var vh = document.getElementById("videowrap-header");
    if (vh && vh.parentNode) vh.parentNode.removeChild(vh);
  }
  function watchVideoHeader(){
    var v = document.getElementById("videowrap"); if (!v) return;
    removeVideoHeaderOnce();
    var mo = new MutationObserver(function(m){
      m.forEach(function(r){
        r.addedNodes && r.addedNodes.forEach(function(n){
          if (!n) return;
          if (n.id === "videowrap-header" || (n.querySelector && n.querySelector("#videowrap-header"))) {
            removeVideoHeaderOnce();
          }
        });
      });
    });
    mo.observe(v, { childList: true, subtree: true });
  }

  function stripBootstrapLayoutClasses(el){
    if (!el || !el.classList) return;
    var rm = [];
    el.classList.forEach(function(c){
      if (/^(col|span)-|^row$|^container(-fluid)?$|^pull-(left|right)$|^offset-/.test(c)) rm.push(c);
    });
    rm.forEach(function(c){ el.classList.remove(c); });
  }
  function neutralizeBootstrapOn(ids){
    ids.forEach(function(id){
      var el = document.getElementById(id);
      if (el) stripBootstrapLayoutClasses(el);
    });
  }

  function normalizeCyTubePrefs(){
    try {
      localStorage.setItem("cytube-layout", "fluid");
      localStorage.setItem("cytube-theme", "slate");
      localStorage.setItem("layout", "fluid");
      localStorage.setItem("theme", "slate");
      if (typeof window.setPreferredLayout === "function") window.setPreferredLayout("fluid");
      if (typeof window.setPreferredTheme === "function") window.setPreferredTheme("slate");
    } catch(e){}
  }

  function setTopOffsetVar(){
    var header = document.querySelector(".navbar, #nav-collapsible, #navbar") || null;
    var h = header ? header.offsetHeight : 48;
    document.documentElement.style.setProperty("--btfw-top", h + "px");
  }

  function ensureShell(){
    var wrap = document.getElementById("wrap") || document.body;

    ensureFontAwesome();
    normalizeCyTubePrefs();
    removeVideoHeaderOnce();
    watchVideoHeader();
    setTopOffsetVar();
    addEventListener("resize", setTopOffsetVar);

    neutralizeBootstrapOn([ "videowrap", "playlistrow", "playlistwrap", "queuecontainer", "queue", "plmeta" ]);

    var topnav = document.querySelector("#nav-collapsible") || document.querySelector(".navbar") || document;
    if (!document.getElementById("btfw-theme-settings-btn")){
      var btn = document.createElement("button");
      btn.id = "btfw-theme-settings-btn";
      btn.className = "btfw-topbtn";
      btn.title = "Theme settings";
      btn.innerHTML = '<i class="fa-solid fa-sliders fa fa-sliders"></i>';
      btn.addEventListener("click", function(){ document.dispatchEvent(new CustomEvent("btfw:openThemeSettings")); });
      (document.querySelector("#userdropdown")?.parentElement || topnav).appendChild(btn);
    }

    if (!document.getElementById("btfw-grid")){
      var grid = document.createElement("div"); grid.id = "btfw-grid"; grid.className = "btfw-grid";
      var left = document.getElementById("btfw-leftpad") || document.createElement("div"); left.id = "btfw-leftpad"; left.className = "btfw-leftpad";
      var right = document.getElementById("btfw-chatcol") || document.createElement("aside"); right.id = "btfw-chatcol"; right.className = "btfw-chatcol";
      var video = document.getElementById("videowrap");
      var chat  = document.getElementById("chatwrap");
      var queue = document.getElementById("playlistrow") || document.getElementById("playlistwrap") || document.getElementById("queuecontainer");
      if (video && !left.contains(video)) left.appendChild(video);
      if (queue && !left.contains(queue)) left.appendChild(queue);
      if (chat && !right.contains(chat)) right.appendChild(chat);
      grid.appendChild(left); grid.appendChild(right); wrap.prepend(grid);
    }
  }

  function ready(){ document.dispatchEvent(new Event("btfw:layoutReady")); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ ensureShell(); ready(); });
  else { ensureShell(); ready(); }

  return { name: "feature:layout", stripBootstrapLayoutClasses };
});
