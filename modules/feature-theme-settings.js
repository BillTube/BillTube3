/* BillTube Framework — feature:themeSettings (Tabbed)
   - Bulma modal with tabs
   - General tab: Theme Mode (Auto/Dark/Light) => feature:bulma-layer
   - Chat tab: Avatar size (off/small/big) + Chat text size
   - Persists settings in localStorage (chat text size), avatars via its own module
*/
BTFW.define("feature:themeSettings", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS = {
    chatTextSize: "btfw:chat:textSize",   // number px (12/14/16/18)
  };

  /* --------------------- helpers --------------------- */
  function ensureOpeners(){
    // Any of these will open the settings modal
    ["#btfw-theme-btn-nav", "#btfw-theme-btn", ".btfw-theme-open"].forEach(sel => {
      const el = $(sel);
      if (el && !el._btfw_ts) {
        el._btfw_ts = true;
        el.addEventListener("click", (e)=>{ e.preventDefault(); open(); }, false);
      }
    });
  }

  function getChatTextSize(){ try { return parseInt(localStorage.getItem(LS.chatTextSize)||"14",10); } catch(e){ return 14; } }
  function setChatTextSize(px){
    try { localStorage.setItem(LS.chatTextSize, String(px)); } catch(e){}
    applyChatTextSize(px);
  }
  function applyChatTextSize(px){
    const wrap = $("#chatwrap");
    if (wrap) wrap.style.setProperty("--btfw-chat-text", px+"px");
  }

  function apiBulma(){ try { return BTFW.require("feature:bulma-layer"); } catch(e){ return null; } }
  function apiAvatars(){
    try { return BTFW.require("feature:chat-avatars") || BTFW.require("feature:chatAvatars"); }
    catch(e){ return null; }
  }

  /* --------------------- modal --------------------- */
  function ensureModal(){
    if ($("#btfw-theme-modal")) return $("#btfw-theme-modal");

    const m = document.createElement("div");
    m.id = "btfw-theme-modal";
    m.className = "modal"; // Bulma modal; dark styling handled by bulma-layer
    m.innerHTML = `
      <div class="modal-background"></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Theme Settings</p>
          <button class="delete" aria-label="close"></button>
        </header>

        <section class="modal-card-body">
          <div class="tabs is-boxed is-small" id="btfw-ts-tabs">
            <ul>
              <li class="is-active" data-tab="general"><a>General</a></li>
              <li data-tab="chat"><a>Chat</a></li>
              <li data-tab="video"><a>Video</a></li>
            </ul>
          </div>

          <div id="btfw-ts-panels">
            <!-- General -->
            <div class="btfw-ts-panel" data-tab="general" style="display:block;">
              <div class="content">
                <h4>Appearance</h4>

                <div class="field">
                  <label class="label">Theme mode</label>
                  <div class="control">
                    <label class="radio" style="margin-right:12px;">
                      <input type="radio" name="btfw-theme-mode" value="auto"> Auto (match system)
                    </label>
                    <label class="radio" style="margin-right:12px;">
                      <input type="radio" name="btfw-theme-mode" value="dark"> Dark
                    </label>
                    <label class="radio">
                      <input type="radio" name="btfw-theme-mode" value="light"> Light
                    </label>
                  </div>
                  <p class="help">Controls Bulma’s palette for modals, tabs, inputs, etc.</p>
                </div>
              </div>
            </div>

            <!-- Chat -->
            <div class="btfw-ts-panel" data-tab="chat" style="display:none;">
              <div class="content">
                <h4>Chat Appearance</h4>

                <div class="field">
                  <label class="label">Avatar size</label>
                  <div class="control">
                    <label class="radio" style="margin-right:12px;">
                      <input type="radio" name="btfw-avatars-mode" value="off"> Off
                    </label>
                    <label class="radio" style="margin-right:12px;">
                      <input type="radio" name="btfw-avatars-mode" value="small"> Small
                    </label>
                    <label class="radio">
                      <input type="radio" name="btfw-avatars-mode" value="big"> Big
                    </label>
                  </div>
                </div>

                <div class="field">
                  <label class="label">Chat text size</label>
                  <div class="control">
                    <div class="select is-small">
                      <select id="btfw-chat-textsize">
                        <option value="12">12 px</option>
                        <option value="14">14 px</option>
                        <option value="16">16 px</option>
                        <option value="18">18 px</option>
                      </select>
                    </div>
                  </div>
                  <p class="help">Applies to the message list.</p>
                </div>
              </div>
            </div>

            <!-- Video (placeholder for now) -->
            <div class="btfw-ts-panel" data-tab="video" style="display:none;">
              <div class="content">
                <p>Video options will live here.</p>
              </div>
            </div>
          </div>
        </section>

        <footer class="modal-card-foot">
          <button class="button is-link" id="btfw-ts-close">Close</button>
        </footer>
      </div>
    `;
    document.body.appendChild(m);

    // Close actions
    $(".modal-background", m).addEventListener("click", close);
    $(".delete", m).addEventListener("click", close);
    $("#btfw-ts-close", m).addEventListener("click", close);

    // Tab logic
    $("#btfw-ts-tabs ul", m).addEventListener("click", (e)=>{
      const li = e.target.closest("li[data-tab]");
      if (!li) return;
      $$("#btfw-ts-tabs li", m).forEach(x => x.classList.toggle("is-active", x===li));
      const tab = li.getAttribute("data-tab");
      $$("#btfw-ts-panels .btfw-ts-panel", m).forEach(p => {
        p.style.display = (p.getAttribute("data-tab") === tab) ? "block" : "none";
      });
    });

    // ------- Wire: Theme Mode (bulma-layer) -------
    const bulma = apiBulma();
    const currentTheme = (bulma && bulma.getTheme) ? bulma.getTheme() : "dark";
    $$('input[name="btfw-theme-mode"]', m).forEach(i => {
      i.checked = (i.value === currentTheme);
      if (bulma && bulma.setTheme) {
        i.addEventListener("change", () => bulma.setTheme(i.value));
      } else {
        i.disabled = true;
      }
    });

    // ------- Wire: Avatars (if module present) -------
    const avatars = apiAvatars();
    if (avatars && avatars.setMode) {
      const mode = (avatars.getMode ? avatars.getMode() : null) || "small";
      $$('input[name="btfw-avatars-mode"]', m).forEach(i => {
        i.checked = (i.value === mode);
        i.addEventListener("change", () => avatars.setMode(i.value));
      });
    } else {
      $$('input[name="btfw-avatars-mode"]', m).forEach(i => i.disabled = true);
    }

    // Chat font size
    const sz = String(getChatTextSize());
    const sel = $("#btfw-chat-textsize", m);
    sel.value = sz;
    sel.addEventListener("change", ()=> setChatTextSize(parseInt(sel.value,10)));

    return m;
  }

  function open(){
    const m = ensureModal();
    // Refresh control states each open (in case user changed things elsewhere)
    const bulma = apiBulma();
    const theme = (bulma && bulma.getTheme) ? bulma.getTheme() : "dark";
    $$('input[name="btfw-theme-mode"]', m).forEach(i => { i.checked = (i.value === theme); });

    const avatars = apiAvatars();
    if (avatars && avatars.getMode){
      const mode = avatars.getMode();
      $$('input[name="btfw-avatars-mode"]', m).forEach(i => { i.checked = (i.value === mode); });
    }

    $("#btfw-chat-textsize", m).value = String(getChatTextSize());

    m.classList.add("is-active");
    document.dispatchEvent(new CustomEvent("btfw:themeSettings:open"));
  }

  function close(){
    $("#btfw-theme-modal")?.classList.remove("is-active");
  }

  /* --------------------- boot --------------------- */
  function boot(){
    ensureOpeners();
    applyChatTextSize(getChatTextSize()); // apply persisted value on boot
  }

  document.addEventListener("btfw:layoutReady", () => setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:themeSettings", open, close };
});
