
BTFW.define("feature:layout", ["core"], async ({ require, BASE }) => {
  const core = require("core");
  function ensureShell() {
    const wrap = document.getElementById("wrap") || document.body;
    const oldHeader = document.getElementById("videowrap-header");
    if (oldHeader) oldHeader.remove();
    const topnav = document.querySelector("#navbar .nav") || document.querySelector(".navbar .nav") || document.querySelector("#nav-collapsible") || document;
    if (!document.querySelector("#btfw-theme-settings-btn")) {
      const btn = document.createElement("button");
      btn.id = "btfw-theme-settings-btn";
      btn.className = "btfw-topbtn";
      btn.title = "Theme settings";
      btn.innerHTML = `<i class="fa fa-sliders" aria-hidden="true"></i>`;
      btn.onclick = () => document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));
      (document.querySelector("#userdropdown")?.parentElement || topnav).appendChild(btn);
    }
    if (!document.querySelector("#btfw-grid")) {
      const grid = document.createElement("div");
      grid.id = "btfw-grid"; grid.className = "btfw-grid";
      const leftPad = document.getElementById("btfw-leftpad") || document.createElement("div");
      leftPad.id = "btfw-leftpad"; leftPad.className = "btfw-leftpad";
      const videoWrap = document.getElementById("videowrap");
      const plWrap    = document.getElementById("playlistrow") || document.getElementById("playlistwrap") || document.getElementById("queuecontainer");
      if (videoWrap && !leftPad.contains(videoWrap)) leftPad.appendChild(videoWrap);
      if (plWrap && !leftPad.contains(plWrap)) leftPad.appendChild(plWrap);
      const rightCol = document.getElementById("btfw-chatcol") || document.createElement("aside");
      rightCol.id = "btfw-chatcol"; rightCol.className = "btfw-chatcol";
      const chatWrap = document.getElementById("chatwrap");
      if (chatWrap && !rightCol.contains(chatWrap)) rightCol.appendChild(chatWrap);
      grid.appendChild(leftPad); grid.appendChild(rightCol); wrap.prepend(grid);
    }
  }
  function ready(){ document.dispatchEvent(new Event("btfw:layoutReady")); }
  ensureShell(); setTimeout(ready, 0);
  return { name: "feature:layout" };
});
