/* BTFW — feature:themeSettings (Apply/Cancel + more chat controls)
   Adds:
   - Colored usernames (toggle)
   - Show timestamps (toggle)
   - Timestamp format (12/24)
*/
BTFW.define("feature:themeSettings", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // Lazy resolvers
  const BULMA = () => { try { return BTFW.require("feature:bulma-layer"); } catch(_) { return null; } };
  const AV    = () => { try { return BTFW.require("feature:chat-avatars") || BTFW.require("feature:avatars-bridge"); } catch(_) { return null; } };
  const CM    = () => { try { return BTFW.require("feature:chatMedia"); } catch(_) { return null; } };
  const PIP   = () => { try { return BTFW.require("feature:pip"); } catch(_) { return null; } };
  const NC    = () => { try { return BTFW.require("feature:chat-username-colors"); } catch(_) { return null; } };
  const TS    = () => { try { return BTFW.require("feature:chat-timestamps"); } catch(_) { return null; } };

  const LS = {
    chatTextSize : "btfw:chat:textSize",
    pip          : "btfw:pip:enabled",
    themeMode    : "btfw:theme:mode",
    avatarsMode  : "btfw:avatars:mode",
    emoteSize    : "btfw:chat:emoteSize",
    gifAutoplay  : "btfw:chat:gifAutoplay",
    nameColors   : "btfw:chat:unameColors",   // "1"/"0"
    tsShow       : "btfw:chat:ts:show",       // "1"/"0"
    tsFmt        : "btfw:chat:ts:fmt"         // "24"/"12"
  };

  function lsGet(k, d){ try { const v = localStorage.getItem(k); return (v==null?d:v); } catch(_) { return d; } }
  function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(_) {} }

  function getChatTextSize(){ return parseInt(lsGet(LS.chatTextSize,"14"),10) || 14; }
  function applyChatText(px){
    lsSet(LS.chatTextSize, String(px));
    const wrap = $("#chatwrap"); if (wrap) wrap.style.setProperty("--btfw-chat-text", px+"px");
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

  let staged = null;
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

                <hr>

                <div class="field">
                  <label class="checkbox">
                    <input type="checkbox" id="btfw-uname-colors"> Colored usernames
                  </label>
                </div>

                <div class="field is-grouped">
                  <div class="control">
                    <label class="checkbox">
                      <input type="checkbox" id="btfw-ts-show"> Show timestamps
                    </label>
                  </div>
                  <div class="control" style="margin-left:12px;">
                    <div class="select is-small">
                      <select id="btfw-ts-format">
                        <option value="24">24-hour</option>
                        <option value="12">12-hour</option>
                      </select>
                    </div>
                  </div>
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

    // close/cancel
    $(".modal-background", m).addEventListener("click", close);
    $(".delete", m).addEventListener("click", close);
    $("#btfw-ts-cancel", m).addEventListener("click", close);

    // tabs
    $("#btfw-ts-tabs ul", m).addEventListener("click", (e)=>{
      const li = e.target.closest("li[data-tab]"); if (!li) return;
      $$("#btfw-ts-tabs li", m).forEach(x => x.classList.toggle("is-active", x===li));
      const tab = li.getAttribute("data-tab");
      $$("#btfw-ts-panels .btfw-ts-panel", m).forEach(p => {
        p.style.display = (p.getAttribute("data-tab") === tab) ? "block" : "none";
      });
    });

    // Stage-only changes
    m.addEventListener("change", (e)=>{
      if (!staged) return;
      const t = e.target;
      if (t.name === "btfw-theme-mode") staged.themeMode = t.value;
      if (t.name === "btfw-avatars-mode") staged.avatars = t.value;
      if (t.id   === "btfw-chat-textsize") staged.chatText = parseInt(t.value,10);
      if (t.id   === "btfw-emote-size")    staged.emoteSize = t.value;
      if (t.id   === "btfw-gif-autoplay")  staged.gifAuto = !!t.checked;
      if (t.id   === "btfw-uname-colors")  staged.unameColors = !!t.checked;
      if (t.id   === "btfw-ts-show")       staged.tsShow = !!t.checked;
      if (t.id   === "btfw-ts-format")     staged.tsFmt  = t.value;
      if (t.id   === "btfw-pip-toggle")    staged.pip    = !!t.checked;
    });

    // Apply
    $("#btfw-ts-apply", m).addEventListener("click", async ()=>{
      const btn = $("#btfw-ts-apply", m);
      btn.classList.add("is-loading"); btn.disabled = true;
      try { await applyAll(staged); close(); }
      finally { btn.classList.remove("is-loading"); btn.disabled = false; }
    });

    return m;
  }

  function readEffective(){
    // best-effort read from modules; fallback to LS
    const eff = {
      themeMode: (BULMA()?.getTheme && BULMA().getTheme()) || lsGet("btfw:theme:mode","dark"),
      avatars  : lsGet("btfw:avatars:mode","small"),
      chatText : parseInt(lsGet("btfw:chat:textSize","14"),10) || 14,
      emoteSize: lsGet("btfw:chat:emoteSize","md"),
      gifAuto  : (lsGet("btfw:chat:gifAutoplay","1")==="1"),
      unameColors: (lsGet("btfw:chat:unameColors","1")==="1"),
      tsShow     : (lsGet("btfw:chat:ts:show","1")==="1"),
      tsFmt      : lsGet("btfw:chat:ts:fmt","24"),
      pip        : (lsGet("btfw:pip:enabled","0")==="1")
    };
    // override from live modules if available
    try { const cm = BTFW.require("feature:chatMedia");
      if (cm?.getEmoteSize) eff.emoteSize = cm.getEmoteSize();
      if (cm?.getGifAutoplayOn) eff.gifAuto = !!cm.getGifAutoplayOn();
    } catch(_){}
    try { const nc = BTFW.require("feature:chat-username-colors");
      if (nc?.getEnabled) eff.unameColors = !!nc.getEnabled();
    } catch(_){}
    try { const ts = BTFW.require("feature:chat-timestamps");
      if (ts?.getShow) eff.tsShow = !!ts.getShow();
      if (ts?.getFmt)  eff.tsFmt  = ts.getFmt();
    } catch(_){}
    try { const av = BTFW.require("feature:chat-avatars") || BTFW.require("feature:avatars-bridge");
      if (av?.getMode) eff.avatars = av.getMode();
    } catch(_){}
    return eff;
  }

  function refreshModalState(m){
    const S = staged = readEffective();
    $$('input[name="btfw-theme-mode"]', m).forEach(i => i.checked = (i.value === S.themeMode));
    $$('input[name="btfw-avatars-mode"]', m).forEach(i => i.checked = (i.value === S.avatars));
    $("#btfw-chat-textsize", m).value = String(S.chatText);
    $("#btfw-emote-size", m).value = S.emoteSize;
    $("#btfw-gif-autoplay", m).checked = !!S.gifAuto;
    $("#btfw-uname-colors", m).checked = !!S.unameColors;
    $("#btfw-ts-show", m).checked = !!S.tsShow;
    $("#btfw-ts-format", m).value = S.tsFmt;
    $("#btfw-pip-toggle", m).checked = !!S.pip;
  }

  function applyThemeMode(mode){ BULMA()?.setTheme && BULMA().setTheme(mode); lsSet("btfw:theme:mode", mode); }
  function applyAvatarsMode(mode){
    const av = AV();
    if (av?.setMode) av.setMode(mode);
    lsSet("btfw:avatars:mode", mode);
    // fallback CSS var/class (bridge style)
    const px = mode==="off" ? 0 : (mode==="big" ? 36 : 24);
    document.documentElement.style.setProperty("--btfw-avatar-size", px+"px");
    document.body.classList.remove("btfw-avatars-off","btfw-avatars-small","btfw-avatars-big");
    document.body.classList.add("btfw-avatars-"+mode);
  }
  function applyEmoteSize(mode){
    CM()?.setEmoteSize && CM().setEmoteSize(mode);
    lsSet("btfw:chat:emoteSize", mode);
    const map = { sm:100, md:130, lg:170 };
    const px = map[mode] || map.md;
    document.documentElement.style.setProperty("--btfw-emote-size", px+"px");
  }
  function applyGifAutoplay(on){ CM()?.setGifAutoplayOn && CM().setGifAutoplayOn(!!on); lsSet("btfw:chat:gifAutoplay", on?"1":"0"); }
  function applyChatTextSize(px){ applyChatText(px); }
  function applyNameColors(on){ NC()?.setEnabled && NC().setEnabled(!!on); lsSet("btfw:chat:unameColors", on?"1":"0"); }
  function applyTsShow(on){ TS()?.setShow && TS().setShow(!!on); lsSet("btfw:chat:ts:show", on?"1":"0"); }
  function applyTsFmt(fmt){ TS()?.setFmt && TS().setFmt(fmt); lsSet("btfw:chat:ts:fmt", fmt); }
  function applyPip(on){ const pip = PIP(); pip?.setEnabled && pip.setEnabled(!!on); lsSet("btfw:pip:enabled", on?"1":"0"); }

  async function applyAll(s){
    if (!s) return;
    applyThemeMode(s.themeMode);
    applyAvatarsMode(s.avatars);
    applyChatTextSize(s.chatText);
    applyEmoteSize(s.emoteSize);
    applyGifAutoplay(s.gifAuto);
    applyNameColors(s.unameColors);
    applyTsShow(s.tsShow);
    applyTsFmt(s.tsFmt);
    applyPip(s.pip);
    // late retry for modules that initialize after
    setTimeout(()=>{ try{
      BULMA()?.setTheme && BULMA().setTheme(s.themeMode);
      (AV()?.setMode) && AV().setMode(s.avatars);
      (CM()?.setEmoteSize) && CM().setEmoteSize(s.emoteSize);
      (CM()?.setGifAutoplayOn) && CM().setGifAutoplayOn(s.gifAuto);
      (NC()?.setEnabled) && NC().setEnabled(s.unameColors);
      (TS()?.setShow) && TS().setShow(s.tsShow);
      (TS()?.setFmt) && TS().setFmt(s.tsFmt);
      (PIP()?.setEnabled) && PIP().setEnabled(!!s.pip);
    }catch(_){ } }, 300);
  }

  function open(){
    const m = ensureModal();
    refreshModalState(m);
    m.classList.add("is-active");
    document.dispatchEvent(new CustomEvent("btfw:themeSettings:open"));
  }
  function close(){ $("#btfw-theme-modal")?.classList.remove("is-active"); }

  function boot(){
    // Apply saved chat text size early
    applyChatText(getChatTextSize());
    ensureOpeners();
  }

  document.addEventListener("btfw:layoutReady", () => setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:themeSettings", open, close };
});
