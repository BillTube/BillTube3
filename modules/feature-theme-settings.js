/* BillTube Framework — feature:themeSettings (Tabbed, Bulma, robust)
   - General: Theme Mode (Auto / Dark / Light) -> feature:bulma-layer
   - Chat: Avatar size (off/small/big) + Chat text size + Twemoji toggle (optional)
   - Video: PiP toggle (optional)
   - Works even if BTFW.require is unavailable (falls back to init())
*/
BTFW.define("feature:themeSettings", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS = {
    chatTextSize: "btfw:chat:textSize",
    pip:          "btfw:pip:enabled"
  };

  let modalEl = null; // <— single source of truth for the modal node

  /* --------------------- small helpers --------------------- */
  function getChatTextSize(){ try { return parseInt(localStorage.getItem(LS.chatTextSize)||"14",10); } catch(e){ return 14; } }
  function setChatTextSize(px){
    try { localStorage.setItem(LS.chatTextSize, String(px)); } catch(e){}
    const wrap = $("#chatwrap");
    if (wrap) wrap.style.setProperty("--btfw-chat-text", px + "px");
  }

  async function safeInit(names){
    for (const name of (Array.isArray(names)?names:[names])) {
      try { return await BTFW.init(name); } catch(_) {}
    }
    return null;
  }

  async function getBulmaLayer(){ return await safeInit("feature:bulma-layer"); }
  async function getAvatars(){ return await safeInit(["feature:chat-avatars","feature:chatAvatars"]); }
  async function getPip(){ return await safeInit("feature:pip"); }
  async function getEmojiCompat(){ return await safeInit("feature:emoji-compat"); }

  function nukeLegacy(){
    // Remove any existing “Theme Settings” modal DOM
    ["#themesettings", "#themeSettingsModal", ".themesettings", "#btfw-theme-modal"]
      .forEach(sel => $$(sel).forEach(el => el.remove()));

    // Also remove any modal with a header titled "Theme Settings"
    $$(".modal, .modal.in, .modal.is-active").forEach(m => {
      const title = m.querySelector(".modal-title, .modal-card-title");
      if (title && /theme settings/i.test(title.textContent || "")) m.remove();
    });

    // Disable any global legacy opener, if present
    if (typeof window.showThemeSettings === "function") {
      try { window.showThemeSettings = function(){ return false; }; } catch(e){}
    }
  }

  function ensureOpeners(){
    const selectors = [
      "#btfw-theme-btn-nav",
      "#btfw-theme-btn",
      "#btfw-theme-btn-chat",   // chat bar button
      ".btfw-theme-open"
    ];

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        // Strip inline & jQuery handlers (legacy)
        el.removeAttribute("onclick");
        if (window.jQuery) { try { jQuery(el).off("click"); } catch(_){} }

        // Clone to remove any remaining listeners
        const clone = el.cloneNode(true);
        el.parentNode.replaceChild(clone, el);

        if (!clone._btfw_ts) {
          clone._btfw_ts = true;
          clone.addEventListener("click", (ev)=>{
            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            open(); // our modal
          }, {capture:true});
        }
      });
    });

    // Optional global helper any other code can call
    window.BTFWOpenThemeSettings = () => open();
  }

  /* --------------------- modal creation --------------------- */
  function ensureModal(){
    if (modalEl) return modalEl;

    nukeLegacy();

    modalEl = document.createElement("div");
    modalEl.id = "btfw-theme-modal";
    modalEl.className = "modal";
    modalEl.innerHTML = `
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
                  <p class="help">Controls Bulma surfaces (modals, tabs, inputs).</p>
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
<!-- Emote/GIF size -->
<div class="field">
  <label class="label">Emote/GIF size</label>
  <div class="control">
    <label class="radio" style="margin-right:12px;"><input type="radio" name="btfw-emote-size" value="sm"> Small</label>
    <label class="radio" style="margin-right:12px;"><input type="radio" name="btfw-emote-size" value="md"> Medium</label>
    <label class="radio"><input type="radio" name="btfw-emote-size" value="lg"> Big</label>
  </div>
</div>

<!-- GIF autoplay -->
<div class="field">
  <label class="checkbox">
    <input type="checkbox" id="btfw-gif-autoplay"> Autoplay GIFs (hover-to-play when off)
  </label>
</div>

                <div class="field">
                  <label class="checkbox">
                    <input type="checkbox" id="btfw-emoji-twemoji"> Use Twemoji images for emoji
                  </label>
                  <p class="help">Ensures emoji look the same on all devices (if Emoji Compat is loaded).</p>
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
    document.body.appendChild(modalEl);

    // Close behavior
    $(".modal-background", modalEl).addEventListener("click", close);
    $(".delete", modalEl).addEventListener("click", close);
    $("#btfw-ts-close", modalEl).addEventListener("click", close);

    // Tabs
    $("#btfw-ts-tabs ul", modalEl).addEventListener("click", (e)=>{
      const li = e.target.closest("li[data-tab]");
      if (!li) return;
      $$("#btfw-ts-tabs li", modalEl).forEach(x => x.classList.toggle("is-active", x===li));
      const tab = li.getAttribute("data-tab");
      $$("#btfw-ts-panels .btfw-ts-panel", modalEl).forEach(p => {
        p.style.display = (p.getAttribute("data-tab") === tab) ? "block" : "none";
      });
    });

    // Wire: Chat text size (immediate, no async deps)
    const sel = $("#btfw-chat-textsize", modalEl);
    sel.value = String(getChatTextSize());
    sel.addEventListener("change", ()=> setChatTextSize(parseInt(sel.value,10)));

    // Wire: Theme Mode (async so it works even if require is absent)
    $$('input[name="btfw-theme-mode"]', modalEl).forEach(i => {
      i.addEventListener("change", async () => {
        const bulma = await getBulmaLayer();
        if (bulma?.setTheme) bulma.setTheme(i.value);
      });
    });

    // Wire: Avatar mode (async)
    $$('input[name="btfw-avatars-mode"]', modalEl).forEach(i => {
      i.addEventListener("change", async () => {
        const avatars = await getAvatars();
        if (avatars?.setMode) avatars.setMode(i.value);
      });
    });

    // Wire: PiP toggle (async)
    $("#btfw-pip-toggle", modalEl).addEventListener("change", async (e)=>{
      const enabled = !!e.target.checked;
      const pip = await getPip();
      if (pip?.setEnabled) pip.setEnabled(enabled);
      else { try { localStorage.setItem(LS.pip, enabled ? "1":"0"); } catch(_){} }
      document.dispatchEvent(new CustomEvent("btfw:pip:toggled",{detail:{enabled}}));
    });

    // Wire: Twemoji toggle (async)
    $("#btfw-emoji-twemoji", modalEl).addEventListener("change", async (e)=>{
      const compat = await getEmojiCompat();
      compat?.setEnabled?.(!!e.target.checked);
    });
// Chat media APIs
const chatMedia = (function(){ try { return BTFW.require("feature:chatMedia"); } catch(_){ return null; }})();

// Emote/GIF size radios
(function(){
  const radios = document.querySelectorAll('#btfw-theme-modal input[name="btfw-emote-size"]');
  if (!radios.length || !chatMedia) return;
  // initialize
  const cur = chatMedia.getEmoteSize ? chatMedia.getEmoteSize() : "md";
  radios.forEach(r => {
    r.checked = (r.value === cur);
    r.addEventListener("change", ()=> chatMedia.setEmoteSize(r.value));
  });
})();

// GIF autoplay checkbox
(function(){
  const box = document.querySelector('#btfw-theme-modal #btfw-gif-autoplay');
  if (!box || !chatMedia) return;
  // initialize
  box.checked = !!(chatMedia.getGifAutoplayOn && chatMedia.getGifAutoplayOn());
  box.addEventListener("change", ()=> chatMedia.setGifAutoplayOn(box.checked));
})();

    return modalEl;
  }

  /* --------------------- open/close --------------------- */
  async function open(){
    const el = ensureModal();

    // Refresh control states each open (so it reflects current modules)
    setChatTextSize(getChatTextSize()); // ensure CSS var applied

    const bulma = await getBulmaLayer();
    const themeNow = bulma?.getTheme ? bulma.getTheme() : "dark";
    $$('input[name="btfw-theme-mode"]', el).forEach(i => i.checked = (i.value === themeNow));

    const avatars = await getAvatars();
    const mode = avatars?.getMode ? avatars.getMode() : "small";
    $$('input[name="btfw-avatars-mode"]', el).forEach(i => i.checked = (i.value === mode));

    $("#btfw-chat-textsize", el).value = String(getChatTextSize());

    const pip = await getPip();
    const pipEnabled = pip?.isEnabled ? !!pip.isEnabled() : (localStorage.getItem(LS.pip) === "1");
    $("#btfw-pip-toggle", el).checked = pipEnabled;

    const emojiCompat = await getEmojiCompat();
    $("#btfw-emoji-twemoji", el).checked = !!(emojiCompat?.getEnabled && emojiCompat.getEnabled());

    el.classList.add("is-active");
    document.dispatchEvent(new CustomEvent("btfw:themeSettings:open"));
  }

  function close(){ modalEl && modalEl.classList.remove("is-active"); }

  /* --------------------- boot --------------------- */
  function boot(){
    ensureOpeners();
    setChatTextSize(getChatTextSize()); // apply persisted value
  }

  document.addEventListener("btfw:layoutReady", () => setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:themeSettings", open, close };
});
