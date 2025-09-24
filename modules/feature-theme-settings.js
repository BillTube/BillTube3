/* BTFW — feature:themeSettings (clean, no LS collisions, with openers wired + Billcast apply dispatch) */
BTFW.define("feature:themeSettings", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // single key map
  const TS_KEYS = {
    themeMode   : "btfw:theme:mode",          // "auto" | "dark" | "light"
    chatTextPx  : "btfw:chat:textSize",       // "12" | "14" | "16" | "18"
    avatarsMode : "btfw:chat:avatars",        // "off" | "small" | "big"
    emoteSize   : "btfw:chat:emoteSize",      // "small" | "medium" | "big"
    gifAutoplay : "btfw:chat:gifAutoplay",    // "1" | "0"
    pipEnabled  : "btfw:pip:enabled",         // "1" | "0"
    localSubs   : "btfw:video:localsubs",     // "1" | "0"
    billcastEnabled: "btfw:billcast:enabled", // "1" | "0"
    layoutSide  : "btfw:layout:chatSide"      // "left" | "right"
  };

  // storage helpers
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v==null? d : v; } catch(_) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch(_){} };

  // apply CSS variables immediately (used by chat/emote sizing)
  function applyChatTextPx(px){
    const wrap = $("#chatwrap");
    if (!wrap) return;
    const clamped = Math.min(Math.max(Number(px) || 14, 10), 20);
    wrap.style.setProperty("--btfw-chat-text", `${clamped}px`);
  }
  function applyEmoteSize(size){
    const px = size==="small"?100 : size==="big"?170 : 130; // medium default
    document.documentElement.style.setProperty("--btfw-emote-size", `${px}px`);
    document.dispatchEvent(new CustomEvent("btfw:chat:emoteSizeChanged", { detail:{ size, px } }));
  }

  // cross-feature bridges (optional)
  const bulma   = (()=>{ try { return BTFW.require("feature:bulma-layer"); } catch(_){ return null; } })();
  const avatars = (()=>{ try { return BTFW.require("feature:chat-avatars") || BTFW.require("feature:chatAvatars"); } catch(_){ return null; } })();
  const pip     = (()=>{ try { return BTFW.require("feature:pip"); } catch(_){ return null; } })();

  // --- modal creation ---
  function ensureModal(){
    let m = $("#btfw-theme-modal");
    if (m) return m;

    // nuke legacy
    ["#themesettings","#themeSettingsModal",".themesettings"].forEach(sel=> $$(sel).forEach(el=>el.remove()));

    m = document.createElement("div");
    m.id = "btfw-theme-modal";
    m.className = "modal";
    m.innerHTML = `
      <div class="modal-background"></div>
      <div class="modal-card" style="width:min(820px,92vw)">
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
                  <div class="control btfw-range-control">
                    <input type="range" id="btfw-chat-textsize" min="10" max="20" step="1">
                    <span class="btfw-range-value" id="btfw-chat-textsize-value">14px</span>
                  </div>
                  <p class="help">Adjusts the chat font between 10&nbsp;px and 20&nbsp;px.</p>
                </div>

                <div class="field">
                  <label class="label">Emote & GIF size</label>
                  <div class="control">
                    <div class="select is-small">
                      <select id="btfw-emote-size">
                        <option value="small">Small (100×100)</option>
                        <option value="medium">Medium (130×130)</option>
                        <option value="big">Big (170×170)</option>
                      </select>
                    </div>
                  </div>
                  <p class="help">Applies to images with <code>.channel-emote</code> and the GIF picker.</p>
                </div>

                <div class="field">
                  <label class="checkbox">
                    <input type="checkbox" id="btfw-gif-autoplay"> Autoplay GIFs in chat (otherwise play on hover)
                  </label>
                </div>
              </div>
            </div>

            <!-- Video -->
            <div class="btfw-ts-panel" data-tab="video" style="display:none;">
              <div class="content">
                <h4>Video</h4>
                <div class="field">
                  <label class="label">Desktop layout</label>
                  <div class="control">
                    <label class="radio" style="margin-right:12px;">
                      <input type="radio" name="btfw-chat-side" value="right"> Video left, chat right
                    </label>
                    <label class="radio">
                      <input type="radio" name="btfw-chat-side" value="left"> Chat left, video right
                    </label>
                  </div>
                  <p class="help">Mobile screens switch to a stacked view automatically.</p>
                </div>
                <div class="field">
                  <label class="checkbox">
                    <input type="checkbox" id="btfw-pip-toggle"> Picture-in-Picture (experimental)
                  </label>
                </div>
                <label class="checkbox" style="display:block;margin-top:10px;">
                  <input type="checkbox" id="btfw-billcast-toggle" checked>
                  Enable Billcast (Chromecast sender)
                </label>
                <div class="field">
                  <label class="checkbox">
                    <input type="checkbox" id="btfw-localsubs-toggle"> Show “Local Subtitles” button
                  </label>
                  <p class="help">Load a local .vtt or .srt file into the HTML5 player.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer class="modal-card-foot">
          <button class="button is-link" id="btfw-ts-apply">Apply</button>
          <button class="button" id="btfw-ts-close">Close</button>
        </footer>
      </div>
    `;
    document.body.appendChild(m);

    // Close actions
    $(".modal-background", m).addEventListener("click", close);
    $(".delete", m).addEventListener("click", close);
    $("#btfw-ts-close", m).addEventListener("click", close);

    // Tabs
    $("#btfw-ts-tabs ul", m).addEventListener("click", (e)=>{
      const li = e.target.closest("li[data-tab]"); if (!li) return;
      $$("#btfw-ts-tabs li", m).forEach(x => x.classList.toggle("is-active", x===li));
      const tab = li.getAttribute("data-tab");
      $$("#btfw-ts-panels .btfw-ts-panel", m).forEach(p => p.style.display = (p.dataset.tab===tab) ? "block" : "none");
    });

    // Apply button
    $("#btfw-ts-apply", m).addEventListener("click", applyAndPersist);

    const chatTextSlider = $("#btfw-chat-textsize", m);
    const chatTextValue  = $("#btfw-chat-textsize-value", m);
    if (chatTextSlider && chatTextValue) {
      const updateLabel = (val) => { chatTextValue.textContent = `${val}px`; };
      chatTextSlider.addEventListener("input", () => updateLabel(chatTextSlider.value || "14"));
      updateLabel(chatTextSlider.value || "14");
    }

    // Open via event
    document.addEventListener("btfw:openThemeSettings", open);

    return m;
  }

  // --- apply & persist ---
  function applyAndPersist(){
    const m = $("#btfw-theme-modal"); if (!m) return;

    // gather current values
    const themeMode   = ($$('input[name="btfw-theme-mode"]:checked', m)[0]?.value) || "dark";
    const avatarsMode = ($$('input[name="btfw-avatars-mode"]:checked', m)[0]?.value) || "small";
    const chatTextPx  = $("#btfw-chat-textsize", m)?.value || "14";
    const emoteSize   = $("#btfw-emote-size", m)?.value   || "medium";
    const gifAutoOn   = $("#btfw-gif-autoplay", m)?.checked;
    const pipOn       = $("#btfw-pip-toggle", m)?.checked;
    const localSubsOn = $("#btfw-localsubs-toggle", m)?.checked;
    const billcastOn  = $("#btfw-billcast-toggle", m)?.checked;
    const chatSide    = ($$('input[name="btfw-chat-side"]:checked', m)[0]?.value) || "right";

    // persist
    set(TS_KEYS.themeMode, themeMode);
    set(TS_KEYS.avatarsMode, avatarsMode);
    set(TS_KEYS.chatTextPx, chatTextPx);
    set(TS_KEYS.emoteSize, emoteSize);
    set(TS_KEYS.gifAutoplay, gifAutoOn ? "1":"0");
    set(TS_KEYS.pipEnabled,  pipOn ? "1":"0");
    set(TS_KEYS.localSubs,   localSubsOn ? "1":"0");
    set(TS_KEYS.billcastEnabled, billcastOn ? "1":"0");
    set(TS_KEYS.layoutSide, chatSide);

    // apply live
    if (bulma?.setTheme) bulma.setTheme(themeMode);
    if (avatars?.setMode) avatars.setMode(avatarsMode);
    applyChatTextPx(parseInt(chatTextPx,10));
    applyEmoteSize(emoteSize);
    if (pip?.setEnabled) pip.setEnabled(!!pipOn);

    // notify modules
    document.dispatchEvent(new CustomEvent("btfw:chat:gifAutoplayChanged", { detail:{ autoplay: !!gifAutoOn } }));
    document.dispatchEvent(new CustomEvent("btfw:pip:toggled",             { detail:{ enabled : !!pipOn } }));
    document.dispatchEvent(new CustomEvent("btfw:video:localsubs:changed", { detail:{ enabled : !!localSubsOn } }));
    document.dispatchEvent(new CustomEvent("btfw:layout:chatSideChanged",   { detail:{ side    : chatSide } }));
    document.dispatchEvent(new CustomEvent("btfw:themeSettings:apply",     { detail:{
      values: {
        themeMode, avatarsMode, chatTextPx: parseInt(chatTextPx,10),
        emoteSize, gifAutoplay: !!gifAutoOn, pipEnabled: !!pipOn,
        localSubs: !!localSubsOn, billcastEnabled: !!billcastOn,
        chatSide
      }
    }}));
  }

  // --- open/close & state refresh ---
  function open(){
    const m = ensureModal();

    const modeNow = bulma?.getTheme ? bulma.getTheme() : (get(TS_KEYS.themeMode, "dark"));
    $$('input[name="btfw-theme-mode"]').forEach(i => i.checked = (i.value === modeNow));

    const avNow = avatars?.getMode ? avatars.getMode() : get(TS_KEYS.avatarsMode,"small");
    $$('input[name="btfw-avatars-mode"]').forEach(i => i.checked = (i.value === avNow));

    const chatPxNow = get(TS_KEYS.chatTextPx, "14");
    const chatSlider = $("#btfw-chat-textsize");
    if (chatSlider) chatSlider.value = chatPxNow;
    const chatLabel = $("#btfw-chat-textsize-value");
    if (chatLabel) chatLabel.textContent = `${chatPxNow}px`;
    $("#btfw-emote-size").value   = get(TS_KEYS.emoteSize,   "medium");
    $("#btfw-gif-autoplay").checked = get(TS_KEYS.gifAutoplay, "1") === "1";
    $("#btfw-pip-toggle").checked   = get(TS_KEYS.pipEnabled,  "0") === "1";
    $("#btfw-localsubs-toggle").checked = get(TS_KEYS.localSubs, "1") === "1";
    const bc = $("#btfw-billcast-toggle"); if (bc) bc.checked = get(TS_KEYS.billcastEnabled, "1") === "1";
    const sideNow = get(TS_KEYS.layoutSide, "right");
    $$('input[name="btfw-chat-side"]').forEach(i => i.checked = (i.value === sideNow));

    m.classList.add("is-active");
    document.dispatchEvent(new CustomEvent("btfw:themeSettings:open"));
  }
  function close(){ $("#btfw-theme-modal")?.classList.remove("is-active"); }

  // --- wire openers in DOM (chat/nav buttons) ---
  function wireOpeners(){
    ["#btfw-theme-btn-chat", "#btfw-theme-btn-nav", ".btfw-theme-open"].forEach(sel=>{
      const el = $(sel);
      if (el && !el._btfwTS) {
        el._btfwTS = true;
        el.addEventListener("click", (e)=>{ e.preventDefault(); open(); }, false);
      }
    });
  }

  // --- boot: apply persisted variables even if modal never opened ---
  function boot(){
    applyChatTextPx(parseInt(get(TS_KEYS.chatTextPx, "14"),10));
    applyEmoteSize(get(TS_KEYS.emoteSize,"medium"));
    wireOpeners();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:themeSettings", open, close, wireOpeners };
});
