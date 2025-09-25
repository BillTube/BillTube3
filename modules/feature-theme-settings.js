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

  // cross-feature bridges (lazy)
  const moduleCache = new Map();
  function getModule(name){
    if (moduleCache.has(name)) return moduleCache.get(name);
    const promise = (window.BTFW && typeof BTFW.init === "function")
      ? BTFW.init(name).catch(()=>null)
      : Promise.resolve(null);
    moduleCache.set(name, promise);
    return promise;
  }

  let bulmaModule = null;
  let avatarsModule = null;
  let pipModule = null;

  function resolveBulma(){
    if (bulmaModule) return Promise.resolve(bulmaModule);
    return getModule("feature:bulma-layer").then(mod => {
      if (mod) bulmaModule = mod;
      return bulmaModule;
    });
  }

  function resolveAvatars(){
    if (avatarsModule) return Promise.resolve(avatarsModule);
    return getModule("feature:chat-avatars").then(mod => {
      if (mod) avatarsModule = mod;
      if (avatarsModule) return avatarsModule;
      return getModule("feature:chatAvatars").then(alt => {
        if (alt) avatarsModule = alt;
        return avatarsModule;
      });
    });
  }

  function resolvePip(){
    if (pipModule) return Promise.resolve(pipModule);
    return getModule("feature:pip").then(mod => {
      if (mod) pipModule = mod;
      return pipModule;
    });
  }

  resolveBulma();
  resolveAvatars();
  resolvePip();

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
      <div class="modal-card btfw-theme-modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Theme Settings</p>
          <button class="delete" aria-label="close"></button>
        </header>
        <section class="modal-card-body">
          <div class="tabs btfw-ts-tabs is-small" id="btfw-ts-tabs">
            <ul>
              <li class="is-active" data-tab="general"><a>General</a></li>
              <li data-tab="chat"><a>Chat</a></li>
              <li data-tab="video"><a>Video</a></li>
            </ul>
          </div>

          <div id="btfw-ts-panels">
            <!-- General -->
            <div class="btfw-ts-panel" data-tab="general" style="display:block;">
              <div class="btfw-ts-grid">
                <section class="btfw-ts-card">
                  <header class="btfw-ts-card__header">
                    <h3>Appearance</h3>
                    <p>Select how the interface adapts to your lighting preferences.</p>
                  </header>
                  <div class="btfw-ts-card__body">
                    <div class="btfw-ts-control btfw-ts-control--radios">
                      <label class="radio">
                        <input type="radio" name="btfw-theme-mode" value="auto"> <span>Auto (match system)</span>
                      </label>
                      <label class="radio">
                        <input type="radio" name="btfw-theme-mode" value="dark"> <span>Dark</span>
                      </label>
                      <label class="radio">
                        <input type="radio" name="btfw-theme-mode" value="light"> <span>Light</span>
                      </label>
                    </div>
                  </div>
                </section>

                <section class="btfw-ts-card">
                  <header class="btfw-ts-card__header">
                    <h3>Integrations</h3>
                    <p>Connect API keys used by chat tools and commands.</p>
                  </header>
                  <div class="btfw-ts-card__body">
                    <label class="btfw-input">
                      <span class="btfw-input__label">TMDB API key</span>
                      <input type="text" id="btfw-tmdb-key" data-btfw-bind="integrations.tmdb.apiKey" placeholder="YOUR_TMDB_KEY">
                    </label>
                    <p class="btfw-help">Required for the <code>!summary</code> command. Request a key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org</a>.</p>
                  </div>
                </section>
              </div>
            </div>

            <!-- Chat -->
            <div class="btfw-ts-panel" data-tab="chat" style="display:none;">
              <div class="btfw-ts-grid">
                <section class="btfw-ts-card">
                  <header class="btfw-ts-card__header">
                    <h3>Avatars & text</h3>
                    <p>Adjust density and readability for the chat column.</p>
                  </header>
                  <div class="btfw-ts-card__body">
                    <div class="btfw-ts-control btfw-ts-control--radios">
                      <span class="btfw-input__label">Avatar size</span>
                      <label class="radio"><input type="radio" name="btfw-avatars-mode" value="off"> <span>Off</span></label>
                      <label class="radio"><input type="radio" name="btfw-avatars-mode" value="small"> <span>Small</span></label>
                      <label class="radio"><input type="radio" name="btfw-avatars-mode" value="big"> <span>Big</span></label>
                    </div>
                    <div class="btfw-ts-control">
                      <span class="btfw-input__label">Chat text size</span>
                      <div class="control btfw-range-control">
                        <input type="range" id="btfw-chat-textsize" min="10" max="20" step="1">
                        <span class="btfw-range-value" id="btfw-chat-textsize-value">14px</span>
                      </div>
                      <p class="btfw-help">Set chat typography anywhere between 10&nbsp;px and 20&nbsp;px.</p>
                    </div>
                  </div>
                </section>

                <section class="btfw-ts-card">
                  <header class="btfw-ts-card__header">
                    <h3>Media</h3>
                    <p>Control sticker and GIF behaviour for the chat experience.</p>
                  </header>
                  <div class="btfw-ts-card__body">
                    <div class="btfw-ts-control">
                      <label class="btfw-input__label" for="btfw-emote-size">Emote & GIF size</label>
                      <div class="select is-small">
                        <select id="btfw-emote-size">
                          <option value="small">Small (100×100)</option>
                          <option value="medium">Medium (130×130)</option>
                          <option value="big">Big (170×170)</option>
                        </select>
                      </div>
                      <p class="btfw-help">Applies to elements with <code>.channel-emote</code> and the GIF picker.</p>
                    </div>
                    <label class="checkbox btfw-checkbox">
                      <input type="checkbox" id="btfw-gif-autoplay"> <span>Autoplay GIFs in chat (otherwise play on hover)</span>
                    </label>
                  </div>
                </section>
              </div>
            </div>

            <!-- Video -->
            <div class="btfw-ts-panel" data-tab="video" style="display:none;">
              <div class="btfw-ts-grid">
                <section class="btfw-ts-card">
                  <header class="btfw-ts-card__header">
                    <h3>Layout</h3>
                    <p>Choose how the desktop layout positions chat and video.</p>
                  </header>
                  <div class="btfw-ts-card__body">
                    <div class="btfw-ts-control btfw-ts-control--radios">
                      <label class="radio">
                        <input type="radio" name="btfw-chat-side" value="right"> <span>Video left, chat right</span>
                      </label>
                      <label class="radio">
                        <input type="radio" name="btfw-chat-side" value="left"> <span>Chat left, video right</span>
                      </label>
                    </div>
                    <p class="btfw-help">Mobile screens automatically collapse into a stacked layout.</p>
                  </div>
                </section>

                <section class="btfw-ts-card">
                  <header class="btfw-ts-card__header">
                    <h3>Playback tools</h3>
                    <p>Toggle experimental features for the HTML5 player.</p>
                  </header>
                  <div class="btfw-ts-card__body">
                    <label class="checkbox btfw-checkbox">
                      <input type="checkbox" id="btfw-pip-toggle"> <span>Enable Picture-in-Picture controls</span>
                    </label>
                    <label class="checkbox btfw-checkbox">
                      <input type="checkbox" id="btfw-billcast-toggle" checked> <span>Enable Billcast (Chromecast sender)</span>
                    </label>
                    <label class="checkbox btfw-checkbox">
                      <input type="checkbox" id="btfw-localsubs-toggle"> <span>Show the “Local Subtitles” button</span>
                    </label>
                    <p class="btfw-help">Allows viewers to load local <code>.vtt</code> or <code>.srt</code> caption files.</p>
                  </div>
                </section>
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
    if (bulmaModule?.setTheme) bulmaModule.setTheme(themeMode);
    else resolveBulma().then(mod => { if (mod?.setTheme) mod.setTheme(themeMode); });

    if (avatarsModule?.setMode) avatarsModule.setMode(avatarsMode);
    else resolveAvatars().then(mod => { if (mod?.setMode) mod.setMode(avatarsMode); });

    applyChatTextPx(parseInt(chatTextPx,10));
    applyEmoteSize(emoteSize);
    if (pipModule?.setEnabled) pipModule.setEnabled(!!pipOn);
    else resolvePip().then(mod => { if (mod?.setEnabled) mod.setEnabled(!!pipOn); });

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

    const storedMode = get(TS_KEYS.themeMode, "dark");
    const modeNow = bulmaModule?.getTheme ? bulmaModule.getTheme() : storedMode;
    $$('input[name="btfw-theme-mode"]').forEach(i => i.checked = (i.value === modeNow));
    resolveBulma().then(mod => {
      if (mod?.getTheme) {
        const live = mod.getTheme();
        $$('input[name="btfw-theme-mode"]').forEach(i => i.checked = (i.value === live));
      }
    });

    const storedAv = get(TS_KEYS.avatarsMode,"small");
    const avNow = avatarsModule?.getMode ? avatarsModule.getMode() : storedAv;
    $$('input[name="btfw-avatars-mode"]').forEach(i => i.checked = (i.value === avNow));
    resolveAvatars().then(mod => {
      if (mod?.getMode) {
        const live = mod.getMode();
        $$('input[name="btfw-avatars-mode"]').forEach(i => i.checked = (i.value === live));
      }
    });

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

  function decorateUserOptions(){
    const modal = document.getElementById("useroptions");
    if (!modal) return;
    const pane = modal.querySelector("#us-general");
    if (pane && !pane._btfwDecorated) {
      pane._btfwDecorated = true;
      pane.classList.add("btfw-useroptions-pane");
      pane.innerHTML = `
        <div class="btfw-useroptions-about">
          <div class="btfw-useroptions-hero">
            <span class="btfw-useroptions-badge">BillTube3</span>
            <h4>Made by Bill</h4>
            <p>BillTube3 keeps the entire channel aligned with a unified visual language. Manual theme or layout overrides are disabled to protect the curated experience.</p>
          </div>
          <div class="btfw-useroptions-panels">
            <article class="btfw-useroptions-panel">
              <h5>Unified look</h5>
              <p>Every viewer sees the same polished interface, playlists, and chat styling that Bill prepared for the community.</p>
            </article>
            <article class="btfw-useroptions-panel">
              <h5>Need a tweak?</h5>
              <p>Share feedback in chat or ping Bill directly. Adjustments roll out globally after testing in the Channel Theme Toolkit.</p>
            </article>
          </div>
        </div>
      `;
    }
  }

  function observeUserOptions(){
    if (document.body._btfwUserOptionsMO) return;
    const mo = new MutationObserver(() => decorateUserOptions());
    mo.observe(document.body, { childList: true, subtree: true });
    document.body._btfwUserOptionsMO = mo;
  }

  // --- boot: apply persisted variables even if modal never opened ---
  function boot(){
    applyChatTextPx(parseInt(get(TS_KEYS.chatTextPx, "14"),10));
    applyEmoteSize(get(TS_KEYS.emoteSize,"medium"));
    wireOpeners();
    decorateUserOptions();
    observeUserOptions();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:themeSettings", open, close, wireOpeners };
});
