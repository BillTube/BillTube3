/* BTFW — feature:themeSettings (clean, no LS collisions, with openers wired + Billcast apply dispatch) */
BTFW.define("feature:themeSettings", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // single key map
  const TS_KEYS = {
    chatTextPx  : "btfw:chat:textSize",       // "12" | "14" | "16" | "18"
    avatarsMode : "btfw:chat:avatars",        // "off" | "small" | "big"
    emoteSize   : "btfw:chat:emoteSize",      // "small" | "medium" | "big"
    gifAutoplay : "btfw:chat:gifAutoplay",    // "1" | "0"
    stackCompact: "btfw:stack:compact",       // "1" | "0"
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

  function applyCompactStack(enabled){
    const active = !!enabled;
    document.documentElement.classList.toggle("btfw-compact-stack", active);
    if (stackModule?.setCompactSpacing) stackModule.setCompactSpacing(active);
    else resolveStack().then(mod => { if (mod?.setCompactSpacing) mod.setCompactSpacing(active); });
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

  let avatarsModule = null;
  let stackModule = null;

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

  resolveAvatars();
  function resolveStack(){
    if (stackModule) return Promise.resolve(stackModule);
    return getModule("feature:stack").then(mod => {
      if (mod) stackModule = mod;
      return stackModule;
    });
  }
  resolveStack();

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
                    <h3>Stack layout</h3>
                    <p>Give desktop stack modules a little more breathing room.</p>
                  </header>
                  <div class="btfw-ts-card__body">
                    <button type="button" class="btfw-compact-stack-btn" id="btfw-compact-stack-toggle" aria-pressed="true">
                      <span class="btfw-compact-stack-label">Compact stack</span>
                      <span class="btfw-compact-stack-status">On</span>
                    </button>
                    <p class="btfw-help">Adds horizontal padding around <code>.btfw-stack-list</code> items whenever the desktop grid is active.</p>
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
                    <div class="btfw-ts-control">
                      <label class="btfw-input__label" for="btfw-avatars-mode">Avatar size</label>
                      <div class="select is-small">
                        <select id="btfw-avatars-mode">
                          <option value="off">Off</option>
                          <option value="small">Small</option>
                          <option value="big">Big</option>
                        </select>
                      </div>
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
                    <div class="btfw-ts-control">
                      <label class="btfw-input__label" for="btfw-chat-side">Layout mode</label>
                      <div class="select is-small">
                        <select id="btfw-chat-side">
                          <option value="right">Video left, chat right</option>
                          <option value="left">Chat left, video right</option>
                        </select>
                      </div>
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

    const compactBtn = $("#btfw-compact-stack-toggle", m);
    if (compactBtn && !compactBtn._btfwSync) {
      const status = compactBtn.querySelector(".btfw-compact-stack-status");
      const sync = (state) => {
        const on = !!state;
        compactBtn.setAttribute("aria-pressed", on ? "true" : "false");
        compactBtn.classList.toggle("is-active", on);
        if (status) status.textContent = on ? "On" : "Off";
        compactBtn.dataset.state = on ? "on" : "off";
      };
      compactBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const next = compactBtn.getAttribute("aria-pressed") !== "true";
        sync(next);
      });
      compactBtn._btfwSync = sync;
    }

    // Open via event
    document.addEventListener("btfw:openThemeSettings", open);

    return m;
  }

  // --- apply & persist ---
  function applyAndPersist(){
    const m = $("#btfw-theme-modal"); if (!m) return;

    // gather current values
    const avatarsMode = $("#btfw-avatars-mode", m)?.value || "big";
    const chatTextPx  = $("#btfw-chat-textsize", m)?.value || "14";
    const emoteSize   = $("#btfw-emote-size", m)?.value   || "medium";
    const gifAutoOn   = $("#btfw-gif-autoplay", m)?.checked;
    const compactBtn  = $("#btfw-compact-stack-toggle", m);
    const compactOn   = compactBtn ? compactBtn.getAttribute("aria-pressed") === "true" : true;
    const localSubsOn = $("#btfw-localsubs-toggle", m)?.checked;
    const billcastOn  = $("#btfw-billcast-toggle", m)?.checked;
    const chatSide    = $("#btfw-chat-side", m)?.value || "right";

    // persist
    set(TS_KEYS.avatarsMode, avatarsMode);
    set(TS_KEYS.chatTextPx, chatTextPx);
    set(TS_KEYS.emoteSize, emoteSize);
    set(TS_KEYS.gifAutoplay, gifAutoOn ? "1":"0");
    set(TS_KEYS.stackCompact, compactOn ? "1":"0");
    set(TS_KEYS.localSubs,   localSubsOn ? "1":"0");
    set(TS_KEYS.billcastEnabled, billcastOn ? "1":"0");
    set(TS_KEYS.layoutSide, chatSide);

    // apply live
    if (avatarsModule?.setMode) avatarsModule.setMode(avatarsMode);
    else resolveAvatars().then(mod => { if (mod?.setMode) mod.setMode(avatarsMode); });

    applyChatTextPx(parseInt(chatTextPx,10));
    applyEmoteSize(emoteSize);
    applyCompactStack(compactOn);

    // notify modules
    document.dispatchEvent(new CustomEvent("btfw:chat:gifAutoplayChanged", { detail:{ autoplay: !!gifAutoOn } }));
    document.dispatchEvent(new CustomEvent("btfw:stack:compactChanged",    { detail:{ enabled : !!compactOn } }));
    document.dispatchEvent(new CustomEvent("btfw:video:localsubs:changed", { detail:{ enabled : !!localSubsOn } }));
    document.dispatchEvent(new CustomEvent("btfw:layout:chatSideChanged",   { detail:{ side    : chatSide } }));
    document.dispatchEvent(new CustomEvent("btfw:themeSettings:apply",     { detail:{
      values: {
        avatarsMode, chatTextPx: parseInt(chatTextPx,10),
        emoteSize, gifAutoplay: !!gifAutoOn, compactStack: !!compactOn,
        localSubs: !!localSubsOn, billcastEnabled: !!billcastOn,
        chatSide
      }
    }}));
  }

  // --- open/close & state refresh ---
  function open(){
    const m = ensureModal();

    const avatarSelect = $("#btfw-avatars-mode", m);
    const storedAv = get(TS_KEYS.avatarsMode,"big");
    const avNow = avatarsModule?.getMode ? avatarsModule.getMode() : storedAv;
    if (avatarSelect) {
      avatarSelect.value = ["off","small","big"].includes(avNow) ? avNow : "big";
    }
    resolveAvatars().then(mod => {
      if (mod?.getMode && avatarSelect) {
        const live = mod.getMode();
        avatarSelect.value = ["off","small","big"].includes(live) ? live : avatarSelect.value;
      }
    });

    const chatPxNow = get(TS_KEYS.chatTextPx, "14");
    const chatSlider = $("#btfw-chat-textsize");
    if (chatSlider) chatSlider.value = chatPxNow;
    const chatLabel = $("#btfw-chat-textsize-value");
    if (chatLabel) chatLabel.textContent = `${chatPxNow}px`;
    $("#btfw-emote-size").value   = get(TS_KEYS.emoteSize,   "medium");
    $("#btfw-gif-autoplay").checked = get(TS_KEYS.gifAutoplay, "1") === "1";
    $("#btfw-localsubs-toggle").checked = get(TS_KEYS.localSubs, "1") === "1";
    const bc = $("#btfw-billcast-toggle"); if (bc) bc.checked = get(TS_KEYS.billcastEnabled, "1") === "1";
    const compactStored = get(TS_KEYS.stackCompact, "1") === "1";
    const compactBtn = $("#btfw-compact-stack-toggle", m);
    if (compactBtn?._btfwSync) compactBtn._btfwSync(compactStored);
    else if (compactBtn) {
      compactBtn.setAttribute("aria-pressed", compactStored ? "true" : "false");
      const status = compactBtn.querySelector(".btfw-compact-stack-status");
      if (status) status.textContent = compactStored ? "On" : "Off";
    }
    const layoutSelect = $("#btfw-chat-side", m);
    const sideNow = get(TS_KEYS.layoutSide, "right");
    if (layoutSelect) layoutSelect.value = ["left","right"].includes(sideNow) ? sideNow : "right";

    m.classList.add("is-active");
    document.dispatchEvent(new CustomEvent("btfw:themeSettings:open"));
  }
  function close(){ $("#btfw-theme-modal")?.classList.remove("is-active"); }

  // --- wire openers in DOM (chat/nav buttons) ---
  const OPEN_SELECTOR = "#btfw-theme-btn-chat, #btfw-theme-btn-nav, .btfw-theme-open";
  let delegatedOpeners = false;
  function wireOpeners(){
    if (delegatedOpeners) return;
    delegatedOpeners = true;
    document.addEventListener("click", (event)=>{
      const trigger = event.target?.closest?.(OPEN_SELECTOR);
      if (!trigger) return;
      event.preventDefault();
      open();
    });
  }

 function decorateUserOptions(modal = document.getElementById("useroptions")){
  if (!modal) return;
  const pane = modal.querySelector("#us-general");
  if (pane && !pane._btfwDecorated) {
    pane._btfwDecorated = true;
    pane.classList.add("btfw-useroptions-pane");
    
    // Hide the "General Preferences" header
    const headers = Array.from(pane.querySelectorAll('h3, h4, .section-header, legend'));
    headers.forEach(header => {
      const text = header.textContent.toLowerCase();
      if (text.includes('general preferences')) {
        header.style.display = 'none';
      }
    });
    
    // Hide the disclaimer text about layouts
    const paragraphs = Array.from(pane.querySelectorAll('p, .help-block, .text-muted'));
    paragraphs.forEach(p => {
      const text = p.textContent.toLowerCase();
      if (text.includes('changing layouts') || text.includes('require refreshing')) {
        p.style.display = 'none';
      }
    });
    
        const controlsById = [
      '#us-theme',
      '#us-layout', 
      '#us-no-channelcss',
      '#us-no-channeljs'
    ];
    
    controlsById.forEach(id => {
      const element = pane.querySelector(id);
      if (element) {
        const formGroup = element.closest('.form-group, .control-group, .checkbox, label, div');
        if (formGroup) {
          formGroup.style.display = 'none';
        }
      }
    });
    
    const labels = Array.from(pane.querySelectorAll('label'));
    labels.forEach(label => {
      const text = label.textContent.toLowerCase();
      if (text.includes('theme') || 
          text.includes('layout') || 
          text.includes('ignore channel css') || 
          text.includes('ignore channel javascript')) {
        // Hide the label itself
        label.style.display = 'none';
        
        const formGroup = label.closest('.form-group, .control-group, .checkbox, div');
        if (formGroup) {
          formGroup.style.display = 'none';
        }
      }
    });
    
    const checkboxes = Array.from(pane.querySelectorAll('input[type="checkbox"]'));
    checkboxes.forEach(checkbox => {
      const name = checkbox.name || checkbox.id || '';
      if (name.includes('channelcss') || name.includes('channeljs')) {
        const container = checkbox.closest('.form-group, .control-group, .checkbox, label, div');
        if (container) {
          container.style.display = 'none';
        }
      }
    });
    
    const selects = Array.from(pane.querySelectorAll('select'));
    selects.forEach(select => {
      const name = select.name || select.id || '';
      if (name.includes('theme') || name.includes('layout')) {
        const container = select.closest('.form-group, .control-group, div');
        if (container) {
          container.style.display = 'none';
        }
      }
    });
    
    const customSection = document.createElement('div');
    customSection.className = 'btfw-useroptions-about';
    customSection.innerHTML = `
      <div class="btfw-useroptions-hero">
        <span class="btfw-useroptions-badge">BillTube3</span>
        <h4>Made by Bill</h4>
        <p>BillTube3 keeps the entire channel aligned with a unified visual language. Theme and layout settings are managed by the channel to ensure a consistent experience.</p>
      </div>
      <div class="btfw-useroptions-panels">
        <article class="btfw-useroptions-panel">
          <h5>New features!</h5>
          <p>Native mobile theme, dynamic chromecast support, Tenor and Giphy for more emote variety.</p>
        </article>
        <article class="btfw-useroptions-panel">
          <h5>Need a tweak?</h5>
          <p>Share feedback in chat or ping Bill directly on Discord. Adjustments roll out globally after testing in the Channel Theme Toolkit.</p>
        </article>
      </div>
    `;
    
    pane.insertBefore(customSection, pane.firstChild);
  }
}

  let userOptionsBound = false;
  function bindUserOptions(){
    if (userOptionsBound) return;
    userOptionsBound = true;
    document.addEventListener("show.bs.modal", (event)=>{
      const modal = event?.target?.closest?.("#useroptions") || (event?.target?.id === "useroptions" ? event.target : null);
      if (modal) decorateUserOptions(modal);
    }, true);
  }

  // --- boot: apply persisted variables even if modal never opened ---
  function boot(){
    applyChatTextPx(parseInt(get(TS_KEYS.chatTextPx, "14"),10));
    applyEmoteSize(get(TS_KEYS.emoteSize,"medium"));
    applyCompactStack(get(TS_KEYS.stackCompact, "1") === "1");
    wireOpeners();
    decorateUserOptions();
    bindUserOptions();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:themeSettings", open, close, wireOpeners };
});
