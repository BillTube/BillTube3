// modules/feature-theme-settings.js
BTFW.define("feature:themeSettings", ["feature:layout"], async () => {
  function ensure() {
    if (document.querySelector("#btfw-theme-modal")) return;
    const m = document.createElement("div");
    m.id = "btfw-theme-modal";
    m.className = "btfw-modal hidden";
    m.innerHTML = `
      <div class="btfw-modal__backdrop"></div>
      <div class="btfw-modal__card">
        <div class="btfw-modal__header">
          <h3>Theme Settings</h3>
          <button class="btfw-close">&times;</button>
        </div>
        <div class="btfw-modal__body">
          <label class="row">Chat font size <input id="btfw-font" type="range" min="12" max="20" value="14"></label>
          <label class="row">Compact chat <input id="btfw-compact" type="checkbox"></label>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.querySelector(".btfw-close").onclick = () => m.classList.add("hidden");
    m.querySelector(".btfw-modal__backdrop").onclick = () => m.classList.add("hidden");
    m.querySelector("#btfw-font").oninput = e => document.documentElement.style.setProperty("--btfw-chat-font", e.target.value + "px");
    m.querySelector("#btfw-compact").onchange = e => document.body.classList.toggle("btfw-compact-chat", e.target.checked);
  }
  ensure();
  document.addEventListener("btfw:openThemeSettings", () => {
    ensure();
    document.querySelector("#btfw-theme-modal").classList.remove("hidden");
  });
  return { name: "feature:themeSettings" };
});
