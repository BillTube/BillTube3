BTFW.define("feature:themeSettings", ["feature:layout"], async ({}) => {
  const KEY_PIP="btfw:pip";

  function ensureModal(){
    if (document.getElementById("btfw-theme-modal")) return;
    const m=document.createElement("div"); m.id="btfw-theme-modal"; m.className="modal";
    m.innerHTML=`
      <div class="modal-background"></div>
      <div class="modal-card" style="width:min(720px,92vw)">
        <header class="modal-card-head">
          <p class="modal-card-title">Theme Settings</p>
          <button class="delete" aria-label="close"></button>
        </header>
        <section class="modal-card-body">
          <div class="field">
            <label class="checkbox">
              <input id="btfw-pip-toggle" type="checkbox">
              Enable Picture-in-Picture (dock video above chat when scrolled)
            </label>
          </div>
        </section>
        <footer class="modal-card-foot">
          <button class="button is-primary" id="btfw-theme-save">Save</button>
          <button class="button" id="btfw-theme-cancel">Cancel</button>
        </footer>
      </div>`;
    document.body.appendChild(m);

    // Close wiring
    const close = ()=>m.classList.remove("is-active");
    m.querySelector(".delete").onclick = close;
    m.querySelector(".modal-background").onclick = close;
    m.querySelector("#btfw-theme-cancel").onclick = close;
    m.querySelector("#btfw-theme-save").onclick = save;
  }

  function open(){
    ensureModal();
    const m=document.getElementById("btfw-theme-modal");
    const pip = (localStorage.getItem(KEY_PIP) === "1");
    const cb = m.querySelector("#btfw-pip-toggle"); if (cb) cb.checked = pip;
    m.classList.add("is-active");
  }

  function save(){
    const m=document.getElementById("btfw-theme-modal");
    const on = !!m.querySelector("#btfw-pip-toggle")?.checked;
    localStorage.setItem(KEY_PIP, on ? "1":"0");
    if (typeof window.BTFW_setPiP === "function") window.BTFW_setPiP(on);
    m.classList.remove("is-active");
  }

  // Public opener + events
  document.addEventListener("btfw:openThemeSettings", open);
  window.BTFW_openTheme = open;

  // Navbar button (retry to catch late nav)
  function addNavButton(){
    const nav = document.querySelector("#nav-collapsible .nav, .navbar .nav, #navbar .nav");
    if (!nav || document.getElementById("btfw-theme-btn-nav")) return;
    const li=document.createElement("li");
    li.innerHTML = '<a id="btfw-theme-btn-nav" class="button is-dark is-small" style="margin-left:8px;"><i class="fa fa-sliders"></i> Theme</a>';
    li.querySelector("a").onclick=open;
    nav.appendChild(li);
  }
  addNavButton(); setTimeout(addNavButton, 800);

  return { name:"feature:themeSettings", open };
});
