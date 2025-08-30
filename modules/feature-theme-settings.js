/* BTFW — feature:themeSettings (Apply/Cancel workflow + async-safe apply)
   - Nothing is saved or applied until "Apply" is clicked.
   - On Apply: persist to localStorage and apply live if modules are ready.
   - If a module isn't loaded yet, fall back (no blocking). Modules will
     read the saved values on their own boot and apply.
*/
BTFW.define("feature:themeSettings", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // Lazy resolvers (avoid stale/null refs)
  const BULMA = () => { try { return BTFW.require("feature:bulma-layer"); } catch(_) { return null; } };
  const AV    = () => { try { return BTFW.require("feature:chat-avatars") || BTFW.require("feature:chatAvatars") || BTFW.require("feature:avatars-bridge"); } catch(_) { return null; } };
  const CM    = () => { try { return BTFW.require("feature:chatMedia"); } catch(_) { return null; } };
  const PIP   = () => { try { return BTFW.require("feature:pip"); } catch(_) { return null; } };

  const LS = {
    chatTextSize : "btfw:chat:textSize",
    pip          : "btfw:pip:enabled",
    themeMode    : "btfw:theme:mode",       // backup if bulma-layer isn't ready
    avatarsMode  : "btfw:avatars:mode",     // bridge fallback
    emoteSize    : "btfw:chat:emoteSize",   // used by chatMedia
    gifAutoplay  : "btfw:chat:gifAutoplay"  // used by chatMedia
  };

  function lsGet(k, d){ try { const v = localStorage.getItem(k); return (v==null?d:v); } catch(_) { return d; } }
  function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(_) {} }

  // Current effective values (read from modules or LS as fallback)
  function readEffective() {
    const bulma = BULMA();
    const cm    = CM();
    const av    = AV();
    const pip   = PIP();

    return {
      themeMode:  (bulma?.getTheme && bulma.getTheme()) || lsGet(LS.themeMode, "dark"),
      avatars:    (av?.getMode && av.getMode()) || lsGet(LS.avatarsMode, "small"),
      chatText:   parseInt(lsGet(LS.chatTextSize, "14"), 10) || 14,
      emoteSize:  (cm?.getEmoteSize && cm.getEmoteSize()) || lsGet(LS.emoteSize, "md"),
      gifAuto:    ((cm?.getGifAutoplayOn && cm.getGifAutoplayOn()) ? "1" : lsGet(LS.gifAutoplay, "1")) === "1",
      pip:        (pip?.isEnabled && !!pip.isEnabled()) || lsGet(LS.pip, "0")==="1"
    };
  }

  // Apply helpers (non-blocking, with graceful fallbacks)
  function applyThemeMode(mode){
    const b = BULMA();
    if (b?.setTheme) b.setTheme(mode);
    lsSet(LS.themeMode, mode);
    // lightweight fallback so CSS can react if you want:
    document.documentElement.setAttribute("data-btfw-theme", mode);
  }
  function applyAvatarsMode(mode){
    const a = AV();
    if (a?.setMode) a.setMode(mode);
    lsSet(LS.avatarsMode, mode);
    // fallback CSS (same as avatars-bridge)
    const px = mode==="off" ? 0 : (mode==="big" ? 36 : 24);
    document.documentElement.style.setProperty("--btfw-avatar-size", px+"px");
    document.body.classList.remove("btfw-avatars-off","btfw-avatars-small","btfw-avatars-big");
    document.body.classList.add("btfw-avatars-"+mode);
  }
  function applyChatText(px){
    lsSet(LS.chatTextSize, String(px));
    const wrap = $("#chatwrap");
    if (wrap) wrap.style.setProperty("--btfw-chat-text", px+"px");
  }
  function applyEmoteSize(mode){
    // Prefer chatMedia API
    const cm = CM();
    if (cm?.setEmoteSize) cm.setEmoteSize(mode);
    lsSet(LS.emoteSize, mode);
    // Fallback: at least set the CSS var so size changes without module
    const map = { sm:100, md:130, lg:170 };
    const px = map[mode] || map.md;
    document.documentElement.style.setProperty("--btfw-emote-size", px+"px");
    // Optional runtime force for existing images if module missing:
    if (!cm) {
      const SEL = "#messagebuffer img.giphy.chat-picture, #messagebuffer img.tenor.chat-picture";
      document.querySelectorAll(SEL).forEach(img=>{
        ["width","height","maxWidth","maxHeight"].forEach(prop=>{
          img.style.setProperty(prop.replace(/[A-Z]/g, m=>"-"+m.toLowerCase()), "var(--btfw-emote-size)", "important");
        });
      });
    }
  }
  function applyGifAutoplay(on){
    const cm = CM();
    if (cm?.setGifAutoplayOn) cm.setGifAutoplayOn(!!on);
    lsSet(LS.gifAutoplay, on ? "1":"0");
  }
  function applyPip(on){
    const pip = PIP();
    if (pip?.setEnabled) pip.setEnabled(!!on);
    lsSet(LS.pip, on ? "1":"0");
    document.dispatchEvent(new CustomEvent("btfw:pip:toggled",{detail:{enabled:!!on}}));
  }

  // ---- Modal creation (with Apply/Cancel) ----
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

  let staged = null; // staged (unsaved) values
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
          <button class="button" id="btfw-ts-cancel">Cancel</button>
          <button class="button is-link" id="btfw-ts-apply">Apply</button>
        </footer>
      </div>
    `;
    document.body.appendChild(m);

    // Close/Cancel
    $(".modal-background", m).addEventListener("click", close);
    $(".delete", m).addEventListener("click", close);
    $("#btfw-ts-cancel", m).addEventListener("click", close);

    // Tabs
    $("#btfw-ts-tabs ul", m).addEventListener("click", (e)=>{
      const li = e.target.closest("li[data-tab]"); if (!li) return;
      $$("#btfw-ts-tabs li", m).forEach(x => x.classList.toggle("is-active", x===li));
      const tab = li.getAttribute("data-tab");
      $$("#btfw-ts-panels .btfw-ts-panel", m).forEach(p => {
        p.style.display = (p.getAttribute("data-tab") === tab) ? "block" : "none";
      });
    });

    // Stage-only listeners (no live apply)
    m.addEventListener("change", (e)=>{
      const t = e.target;
      if (!staged) return;
      if (t.name === "btfw-theme-mode")        staged.themeMode = t.value;
      if (t.name === "btfw-avatars-mode")      staged.avatars   = t.value;
      if (t.id   === "btfw-chat-textsize")     staged.chatText  = parseInt(t.value,10);
      if (t.id   === "btfw-emote-size")        staged.emoteSize = t.value;
      if (t.id   === "btfw-gif-autoplay")      staged.gifAuto   = !!t.checked;
      if (t.id   === "btfw-pip-toggle")        staged.pip       = !!t.checked;
    });

    // Apply button
    $("#btfw-ts-apply", m).addEventListener("click", async ()=>{
      const btn = $("#btfw-ts-apply", m);
      btn.classList.add("is-loading"); btn.disabled = true;
      try {
        await applyAll(staged);
        close();
      } finally {
        btn.classList.remove("is-loading"); btn.disabled = false;
      }
    });

    return m;
  }

  function refreshModalState(m){
    const eff = readEffective();
    staged = { ...eff }; // copy to stage

    // Theme
    $$('input[name="btfw-theme-mode"]', m).forEach(i => i.checked = (i.value === eff.themeMode));

    // Avatars
    $$('input[name="btfw-avatars-mode"]', m).forEach(i => i.checked = (i.value === eff.avatars));

    // Chat text size
    $("#btfw-chat-textsize", m).value = String(eff.chatText);

    // Emote/GIF size
    $("#btfw-emote-size", m).value = eff.emoteSize;

    // GIF autoplay
    $("#btfw-gif-autoplay", m).checked = !!eff.gifAuto;

    // PiP
    $("#btfw-pip-toggle", m).checked = !!eff.pip;
  }

  function open(){
    const m = ensureModal();
    refreshModalState(m);
    m.classList.add("is-active");
    document.dispatchEvent(new CustomEvent("btfw:themeSettings:open"));
  }

  function close(){ $("#btfw-theme-modal")?.classList.remove("is-active"); }

  // Apply everything in a non-blocking way; if modules are missing, fall back and persist so they pick up on boot.
  async function applyAll(s){
    if (!s) return;
    // Theme
    applyThemeMode(s.themeMode);
    // Avatars
    applyAvatarsMode(s.avatars);
    // Chat text size
    applyChatText(s.chatText);
    // Emote/GIF size
    applyEmoteSize(s.emoteSize);
    // GIF autoplay
    applyGifAutoplay(s.gifAuto);
    // PiP
    applyPip(s.pip);

    // Optionally, schedule a short retry to catch late-loaded modules without blocking UI
    setTimeout(()=> {
      try { BULMA()?.setTheme && BULMA().setTheme(s.themeMode); } catch(_){}
      try { AV()?.setMode && AV().setMode(s.avatars); } catch(_){}
      try { CM()?.setEmoteSize && CM().setEmoteSize(s.emoteSize); } catch(_){}
      try { CM()?.setGifAutoplayOn && CM().setGifAutoplayOn(s.gifAuto); } catch(_){}
      try { PIP()?.setEnabled && PIP().setEnabled(!!s.pip); } catch(_){}
    }, 300);
  }

  function boot(){
    // Apply persisted chat text size ASAP on page load
    const px = parseInt(lsGet(LS.chatTextSize, "14"),10) || 14;
    const wrap = $("#chatwrap"); if (wrap) wrap.style.setProperty("--btfw-chat-text", px+"px");

    ensureOpeners();
  }

  document.addEventListener("btfw:layoutReady", () => setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:themeSettings", open, close };
});
