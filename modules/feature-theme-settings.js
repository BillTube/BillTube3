
BTFW.define("feature:themeSettings", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS = { chatTextSize: "btfw:chat:textSize", pip: "btfw:pip:enabled" };

  function nukeLegacy(){
    // remove any old/legacy theme settings modals
    ["#themesettings", "#themeSettingsModal", ".themesettings", "#btfw-theme-modal"]
      .forEach(sel => $$(sel).forEach(el => el.remove()));
  }

function ensureOpeners(){
  const selectors = [
    "#btfw-theme-btn-nav",
    "#btfw-theme-btn",
    "#btfw-theme-btn-chat",   // <- chat button
    ".btfw-theme-open"        // <- any future buttons, just add this class
  ];

  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      // strip any legacy bindings
      el.removeAttribute("onclick");
      if (window.jQuery) { try { jQuery(el).off("click"); } catch(_){} }

      // cloning removes ALL listeners cleanly
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);

      if (!clone._btfw_ts) {
        clone._btfw_ts = true;
        clone.addEventListener("click", ev => {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          open();
        }, { capture: true });
      }
    });
  });

  // Optional global helper so any legacy code can call us:
  window.BTFWOpenThemeSettings = () => open();
}

  // ---- Chat text size ----
  function getChatTextSize(){ try { return parseInt(localStorage.getItem(LS.chatTextSize)||"14",10); } catch(e){ return 14; } }
  function setChatTextSize(px){
    try { localStorage.setItem(LS.chatTextSize, String(px)); } catch(e){}
    const wrap = $("#chatwrap"); if (wrap) wrap.style.setProperty("--btfw-chat-text", px+"px");
  }

  // ---- APIs from other features ----
  const bulma = (function(){ try { return BTFW.require("feature:bulma-layer"); } catch(e){ return null; }})();
  const avatars = (function(){
    try { return BTFW.require("feature:chat-avatars") || BTFW.require("feature:chatAvatars"); }
    catch(e){ return null; }
  })();
  const pip = (function(){ try { return BTFW.require("feature:pip"); } catch(e){ return null; }})();

  function pipGet(){
    if (pip?.isEnabled) return !!pip.isEnabled();
    try { return localStorage.getItem(LS.pip)==="1"; } catch(e){ return false; }
  }
  function pipSet(v){
    if (pip?.setEnabled) { pip.setEnabled(!!v); }
    else { try { localStorage.setItem(LS.pip, v ? "1":"0"); } catch(e){} }
    document.dispatchEvent(new CustomEvent("btfw:pip:toggled",{detail:{enabled:!!v}}));
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
  <label class="checkbox">
    <input type="checkbox" id="btfw-emoji-twemoji"> Use Twemoji images for emoji
  </label>
  <p class="help">Ensures emoji look the same on all devices.</p>
</div>
              </div>
            </div>

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
      const li = e.target.closest("li[data-tab]");
      if (!li) return;
      $$("#btfw-ts-tabs li", m).forEach(x => x.classList.toggle("is-active", x===li));
      const tab = li.getAttribute("data-tab");
      $$("#btfw-ts-panels .btfw-ts-panel", m).forEach(p => {
        p.style.display = (p.getAttribute("data-tab") === tab) ? "block" : "none";
      });
    });

    // Wire: Theme mode
    const themeNow = (bulma && bulma.getTheme) ? bulma.getTheme() : "dark";
    $$('input[name="btfw-theme-mode"]', m).forEach(i => {
      i.checked = (i.value === themeNow);
      if (bulma?.setTheme) i.addEventListener("change", () => bulma.setTheme(i.value));
      else i.disabled = true;
    });

    // Wire: Avatars
    if (avatars && avatars.setMode) {
      const mode = (avatars.getMode ? avatars.getMode() : null) || "small";
      $$('input[name="btfw-avatars-mode"]', m).forEach(i => {
        i.checked = (i.value === mode);
        i.addEventListener("change", () => avatars.setMode(i.value));
      });
    } else {
      $$('input[name="btfw-avatars-mode"]', m).forEach(i => i.disabled = true);
    }

    // Wire: Chat text size
    const sel = $("#btfw-chat-textsize", m);
    sel.value = String(getChatTextSize());
    sel.addEventListener("change", ()=> setChatTextSize(parseInt(sel.value,10)));

    // Wire: PiP toggle
    const pipBox = $("#btfw-pip-toggle", m);
    pipBox.checked = !!pipGet();
    pipBox.addEventListener("change", ()=> pipSet(pipBox.checked));

    return m;
  }

  function open(){
    const m = ensureModal();

    // refresh states each open
    const themeNow = (bulma && bulma.getTheme) ? bulma.getTheme() : "dark";
    $$('input[name="btfw-theme-mode"]', m).forEach(i => i.checked = (i.value === themeNow));
    $("#btfw-emoji-twemoji", m).checked = !!emojiCompat?.getEnabled?.();

    if (avatars?.getMode) {
      const mode = avatars.getMode();
      $$('input[name="btfw-avatars-mode"]', m).forEach(i => i.checked = (i.value === mode));
    }

    $("#btfw-chat-textsize", m).value = String(getChatTextSize());
    $("#btfw-pip-toggle", m).checked = !!pipGet();

    m.classList.add("is-active");
    document.dispatchEvent(new CustomEvent("btfw:themeSettings:open"));
  }

  function close(){ $("#btfw-theme-modal")?.classList.remove("is-active"); }

  function boot(){
    ensureOpeners();
    setChatTextSize(getChatTextSize()); // apply persisted size
  }

  document.addEventListener("btfw:layoutReady", () => setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:themeSettings", open, close };
});
// Emoji compat toggle
const emojiCompat = (function(){ try { return BTFW.require("feature:emoji-compat"); } catch(_) { return null; }})();
const twChk = $("#btfw-emoji-twemoji", m);
if (emojiCompat) {
  twChk.checked = !!emojiCompat.getEnabled?.();
  twChk.addEventListener("change", () => emojiCompat.setEnabled?.(twChk.checked));
} else {
  twChk.disabled = true;
}