/* BTFW — feature:themeSettings (lazy module resolution + live binds)
   - General: theme mode (bulma-layer)
   - Chat: avatars size (off/small/big), chat text size, emote/GIF size (dropdown),
           GIF autoplay (via feature:chatMedia)
   - Video: PiP toggle
   Notes:
   * All dependencies are resolved LAZILY at open/time-of-use to avoid stale/null refs.
   * Works even if some features are not loaded; controls auto-disable.
*/
BTFW.define("feature:themeSettings", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // ---- lazy resolvers (avoid capturing null before features init) ----
  const BULMA = () => { try { return BTFW.require("feature:bulma-layer"); } catch(_) { return null; } };
  const AV    = () => { try { return BTFW.require("feature:chat-avatars") || BTFW.require("feature:chatAvatars") || BTFW.require("feature:avatars-bridge"); } catch(_) { return null; } };
  const CM    = () => { try { return BTFW.require("feature:chatMedia"); } catch(_) { return null; } };
  const PIP   = () => { try { return BTFW.require("feature:pip"); } catch(_) { return null; } };

  const LS = { chatTextSize: "btfw:chat:textSize", pip: "btfw:pip:enabled" };

  function getChatTextSize(){
    try { return parseInt(localStorage.getItem(LS.chatTextSize)||"14",10); } catch(e){ return 14; }
  }
  function setChatTextSize(px){
    try { localStorage.setItem(LS.chatTextSize, String(px)); } catch(e){}
    const wrap = $("#chatwrap"); if (wrap) wrap.style.setProperty("--btfw-chat-text", px+"px");
  }

  function pipGet(){
    const pip = PIP();
    if (pip?.isEnabled) return !!pip.isEnabled();
    try { return localStorage.getItem(LS.pip)==="1"; } catch(e){ return false; }
  }
  function pipSet(v){
    const pip = PIP();
    if (pip?.setEnabled) { pip.setEnabled(!!v); }
    else { try { localStorage.setItem(LS.pip, v ? "1":"0"); } catch(e){} }
    document.dispatchEvent(new CustomEvent("btfw:pip:toggled",{detail:{enabled:!!v}}));
  }

  function ensureOpeners(){
    ["#btfw-theme-btn-nav", "#btfw-theme-btn", ".btfw-theme-open", "#btfw-theme-btn-chat"].forEach(sel => {
      $$(sel).forEach(el => {
        if (el._btfw_ts) return;
        el._btfw_ts = true;
        el.addEventListener("click", (e)=>{ e.preventDefault(); open(); }, {capture:true});
      });
    });
  }

  function nukeLegacy(){
    ["#themesettings", "#themeSettingsModal", ".themesettings", "#btfw-theme-modal"]
      .forEach(sel => $$(sel).forEach(el => el.remove()));
  }

  function ensureModal(){
    let m = $("#btfw-theme-modal");
    if (m) return m;

    nukeLegacy();

    m = document.createElement("div");
    m.id = "btfw-theme-modal";
    m.className = "modal";
    m.innerHTML = `
      <div class="modal-background"></div>
      <div class="modal-card btfw-modal">
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
                    <label class="radio" style="margin-right:12px;"><input type="radio" name="btfw-theme-mode" value="auto"> Auto</label>
                    <label class="radio" style="margin-right:12px;"><input type="radio" name="btfw-theme-mode" value="dark"> Dark</label>
                    <label class="radio"><input type="radio" name="btfw-theme-mode" value="light"> Light</label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Chat -->
            <div class="btfw-ts-panel" data-tab="chat" style="display:none;">
              <div class="content">
                <h4>Chat</h4>

                <div class="field">
                  <label class="label">Avatar size</label>
                  <div class="control">
                    <label class="radio" style="margin-right:12px;"><input type="radio" name="btfw-avatars-mode" value="off"> Off</label>
                    <label class="radio" style="margin-right:12px;"><input type="radio" name="btfw-avatars-mode" value="small"> Small</label>
                    <label class="radio"><input type="radio" name="btfw-avatars-mode" value="big"> Big</label>
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

                <div class="field">
                  <label class="label">Emote/GIF size</label>
                  <div class="control">
                    <div class="select is-small">
                      <select id="btfw-emote-size">
                        <option value="sm">Small (100×100)</option>
                        <option value="md">Medium (130×130)</option>
                        <option value="lg">Big (170×170)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="field">
                  <label class="checkbox">
                    <input type="checkbox" id="btfw-gif-autoplay"> Autoplay GIFs (hover-to-play when off)
                  </label>
                </div>
              </div>
            </div>

            <!-- Video -->
            <div class="btfw-ts-panel" data-tab="video" style="display:none;">
              <div class="content">
                <h4>Video</h4>
                <label class="checkbox">
                  <input type="checkbox" id="btfw-pip-toggle"> Picture-in-Picture (experimental)
                </label>
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

    // Close hooks
    $(".modal-background", m).addEventListener("click", close);
    $(".delete", m).addEventListener("click", close);
    $("#btfw-ts-close", m).addEventListener("click", close);

    // Tabs
    $("#btfw-ts-tabs ul", m).addEventListener("click", (e)=>{
      const li = e.target.closest("li[data-tab]"); if (!li) return;
      $$("#btfw-ts-tabs li", m).forEach(x => x.classList.toggle("is-active", x===li));
      const tab = li.getAttribute("data-tab");
      $$("#btfw-ts-panels .btfw-ts-panel", m).forEach(p => {
        p.style.display = (p.getAttribute("data-tab") === tab) ? "block" : "none";
      });
    });

    // Wire: theme mode
    $$('input[name="btfw-theme-mode"]', m).forEach(i => {
      i.addEventListener("change", () => BULMA()?.setTheme && BULMA().setTheme(i.value));
    });

    // Wire: avatar size (works with either your avatar module OR the bridge)
    $$('input[name="btfw-avatars-mode"]', m).forEach(i => {
      i.addEventListener("change", () => AV()?.setMode && AV().setMode(i.value));
    });

    // Wire: chat text size
    $("#btfw-chat-textsize", m).addEventListener("change", ()=> {
      setChatTextSize(parseInt($("#btfw-chat-textsize", m).value,10));
    });

    // Wire: Emote/GIF size (chatMedia)
    $("#btfw-emote-size", m).addEventListener("change", ()=> {
      const v = $("#btfw-emote-size", m).value;
      CM()?.setEmoteSize && CM().setEmoteSize(v);
    });

    // Wire: GIF autoplay
    $("#btfw-gif-autoplay", m).addEventListener("change", ()=> {
      const on = $("#btfw-gif-autoplay", m).checked;
      CM()?.setGifAutoplayOn && CM().setGifAutoplayOn(on);
    });

    // Wire: PiP
    $("#btfw-pip-toggle", m).addEventListener("change", ()=> pipSet($("#btfw-pip-toggle", m).checked));

    return m;
  }

  function refreshModalState(m){
    // Theme
    const mode = BULMA()?.getTheme ? BULMA().getTheme() : "dark";
    $$('input[name="btfw-theme-mode"]', m).forEach(i => i.checked = (i.value === mode));

    // Avatars
    const avm = (AV()?.getMode && AV().getMode()) || "small";
    $$('input[name="btfw-avatars-mode"]', m).forEach(i => i.checked = (i.value === avm));

    // Chat text size
    $("#btfw-chat-textsize", m).value = String(getChatTextSize());

    // Emote/GIF size
    $("#btfw-emote-size", m).value = (CM()?.getEmoteSize && CM().getEmoteSize()) || "md";

    // GIF autoplay
    $("#btfw-gif-autoplay", m).checked = !!(CM()?.getGifAutoplayOn && CM().getGifAutoplayOn());

    // PiP
    $("#btfw-pip-toggle", m).checked = !!pipGet();
  }

  function open(){
    const m = ensureModal();
    refreshModalState(m);
    m.classList.add("is-active");
    document.dispatchEvent(new CustomEvent("btfw:themeSettings:open"));
  }
  function close(){ $("#btfw-theme-modal")?.classList.remove("is-active"); }

  function boot(){
    ensureOpeners();
    setChatTextSize(getChatTextSize()); // apply persisted size ASAP
  }

  document.addEventListener("btfw:layoutReady", () => setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:themeSettings", open, close };
});
