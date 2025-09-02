/* BTFW — feature:themeSettings (clean, no LS collisions, with openers wired) */
BTFW.define("feature:themeSettings", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // single key map (avoid "LS" name to prevent merge collisions)
  const TS_KEYS = {
    themeMode   : "btfw:theme:mode",          // "auto" | "dark" | "light"
    chatTextPx  : "btfw:chat:textSize",       // "12" | "14" | "16" | "18"
    avatarsMode : "btfw:chat:avatars",        // "off" | "small" | "big"
    emoteSize   : "btfw:chat:emoteSize",      // "small" | "medium" | "big"
    gifAutoplay : "btfw:chat:gifAutoplay",    // "1" | "0"
    pipEnabled  : "btfw:pip:enabled",         // "1" | "0"
    localSubs   : "btfw:video:localsubs",     // "1" | "0"
  };

  // lightweight storage helpers
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v==null? d : v; } catch(_) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch(_){} };

  // apply CSS variables immediately (used by chat/emote sizing)
  function applyChatTextPx(px){
    const wrap = $("#chatwrap");
    if (wrap) wrap.style.setProperty("--btfw-chat-text", `${px}px`);
  }
  function applyEmoteSize(size){
    const px = size==="small"?100 : size==="big"?170 : 130; // medium default
    document.documentElement.style.setProperty("--btfw-emote-size", `${px}px`);
    // notify media module (if present) to re-style already-rendered items
    document.dispatchEvent(new CustomEvent("btfw:chat:emoteSizeChanged", { detail:{ size, px } }));
  }

  // cross-feature bridges (optional if modules present)
  const bulma   = (()=>{ try { return BTFW.require("feature:bulma-layer"); } catch(_){ return null; } })();
  const avatars = (()=>{ try { return BTFW.require("feature:chat-avatars") || BTFW.require("feature:chatAvatars"); } catch(_){ return null; } })();
  const pip     = (()=>{ try { return BTFW.require("feature:pip"); } catch(_){ return null; } })();

  // --- modal creation ---
  function ensureModal(){
    let m = $("#btfw-theme-modal");
    if (m) return m;

    // remove any legacy shells
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
                  <label class="checkbox">
                    <input type="checkbox" id="btfw-pip-toggle"> Picture-in-Picture (experimental)
                  </label>
                </div>
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

    // LISTENER: open when other modules fire btfw:openThemeSettings
    document.addEventListener("btfw:openThemeSettings", open);

    return m;
  }

  // --- apply & persist ---
  function applyAndPersist(){
    const m = $("#btfw-theme-modal"); if (!m) return;

    // Theme mode
    const themeMode = ($$('input[name="btfw-theme-mode"]:checked', m)[0]?.value) || "dark";
    set(TS_KEYS.themeMode, themeMode);
    if (bulma?.setTheme) bulma.setTheme(themeMode);

    // Avatars mode
    const avatarsMode = ($$('input[name="btfw-avatars-mode"]:checked', m)[0]?.value) || "small";
    set(TS_KEYS.avatarsMode, avatarsMode);
    if (avatars?.setMode) avatars.setMode(avatarsMode);

    // Chat text size
    const chatTextPx = $("#btfw-chat-textsize", m)?.value || "14";
    set(TS_KEYS.chatTextPx, chatTextPx);
    applyChatTextPx(parseInt(chatTextPx,10));

    // Emote size
    const emoteSize = $("#btfw-emote-size", m)?.value || "medium";
    set(TS_KEYS.emoteSize, emoteSize);
    applyEmoteSize(emoteSize);

    // GIF autoplay
    const gifAuto = $("#btfw-gif-autoplay", m)?.checked ? "1":"0";
    set(TS_KEYS.gifAutoplay, gifAuto);
    document.dispatchEvent(new CustomEvent("btfw:chat:gifAutoplayChanged", { detail:{ autoplay: gifAuto==="1" } }));

    // PiP
    const pipOn = $("#btfw-pip-toggle", m)?.checked;
    set(TS_KEYS.pipEnabled, pipOn ? "1":"0");
    if (pip?.setEnabled) pip.setEnabled(!!pipOn);
    document.dispatchEvent(new CustomEvent("btfw:pip:toggled", { detail:{ enabled: !!pipOn }}));

    // Local subs button
    const ls = $("#btfw-localsubs-toggle", m)?.checked;
    set(TS_KEYS.localSubs, ls ? "1":"0");
    document.dispatchEvent(new CustomEvent("btfw:video:localsubs:changed", { detail:{ enabled: !!ls }}));
  }

  // --- open/close & state refresh ---
  function open(){
    const m = ensureModal();

    // Refresh current values every time it opens
    const modeNow = bulma?.getTheme ? bulma.getTheme() : (get(TS_KEYS.themeMode, "dark"));
    $$('input[name="btfw-theme-mode"]').forEach(i => i.checked = (i.value === modeNow));

    const avNow = avatars?.getMode ? avatars.getMode() : get(TS_KEYS.avatarsMode,"small");
    $$('input[name="btfw-avatars-mode"]').forEach(i => i.checked = (i.value === avNow));

    $("#btfw-chat-textsize").value = get(TS_KEYS.chatTextPx, "14");
    $("#btfw-emote-size").value   = get(TS_KEYS.emoteSize, "medium");
    $("#btfw-gif-autoplay").checked = get(TS_KEYS.gifAutoplay, "1") === "1";
    $("#btfw-pip-toggle").checked   = get(TS_KEYS.pipEnabled,  "0") === "1";
    $("#btfw-localsubs-toggle").checked = get(TS_KEYS.localSubs, "1") === "1";

    m.classList.add("is-active");
    document.dispatchEvent(new CustomEvent("btfw:themeSettings:open"));
  }
  function close(){ $("#btfw-theme-modal")?.classList.remove("is-active"); }

  // --- wire openers in DOM (chat button, navbar button, and any .btfw-theme-open) ---
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
    wireOpeners(); // make sure buttons open the modal
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { name: "feature:themeSettings", open, close, wireOpeners };
});
