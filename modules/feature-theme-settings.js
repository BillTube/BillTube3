
BTFW.define("feature:themeSettings", ["feature:layout"], async ({}) => {
  const KEY_PIP="btfw:pip";
  function get(k, d){ try{ const v=localStorage.getItem(k); return v===null?d:v; }catch(e){ return d; } }
  function set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }

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
              <input id="btfw-pip-toggle" type="checkbox"> Enable Picture-in-Picture (dock video above chat when scrolled)
            </label>
          </div>
        </section>
        <footer class="modal-card-foot">
          <button class="button is-primary" id="btfw-theme-save">Save</button>
          <button class="button" id="btfw-theme-cancel">Cancel</button>
        </footer>
      </div>`;
    document.body.appendChild(m);
    m.querySelector(".delete").onclick=hide;
    m.querySelector(".modal-background").onclick=hide;
    m.querySelector("#btfw-theme-cancel").onclick=hide;
    m.querySelector("#btfw-theme-save").onclick=save;
  }

  function open(){
    ensureModal();
    const m=document.getElementById("btfw-theme-modal");
    const pip=get(KEY_PIP,"0")==="1";
    document.getElementById("btfw-pip-toggle").checked = pip;
    m.classList.add("is-active");
  }
  function hide(){ const m=document.getElementById("btfw-theme-modal"); if(m) m.classList.remove("is-active"); }
  function save(){
    const pip = document.getElementById("btfw-pip-toggle").checked;
    set(KEY_PIP, pip ? "1":"0");
    if (typeof window.BTFW_setPiP === "function") window.BTFW_setPiP(pip);
    hide();
  }

  document.addEventListener("btfw:openThemeSettings", open);

  function addNavButton(){
    const nav = document.querySelector("#nav-collapsible .nav, .navbar .nav, #navbar .nav");
    if (!nav || document.getElementById("btfw-theme-btn-nav")) return;
    const li=document.createElement("li");
    li.innerHTML = '<a id="btfw-theme-btn-nav" class="button is-dark is-small" style="margin-left:8px;"><i class="fa fa-sliders"></i> Theme</a>';
    li.querySelector("a").onclick=open;
    if (nav.appendChild) nav.appendChild(li);
  }
  addNavButton(); setTimeout(addNavButton, 1200);

  return { name:"feature:themeSettings", open };
});
