/* BTFW — feature:channelThemeAdmin
   Adds an "Admin Theme" tab to the channel settings modal allowing owners
   to manage BillTube theme resources without editing raw Channel JS / CSS.
   The module keeps a structured config block inside Channel JS and mirrors
   it to Channel CSS so the theme always loads with consistent colors.
*/
BTFW.define("feature:channelThemeAdmin", [], async () => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const JS_BLOCK_START  = "// ==BTFW_THEME_ADMIN_START==";
  const JS_BLOCK_END    = "// ==BTFW_THEME_ADMIN_END==";
  const CSS_BLOCK_START = "/* ==BTFW_THEME_ADMIN_START== */";
  const CSS_BLOCK_END   = "/* ==BTFW_THEME_ADMIN_END== */";

  const JS_FIELD_SELECTORS = [
    "#chanjs", "#channel-js", "#channeljs", "#customjs", "#customJS",
    "textarea[name=chanjs]", "textarea[name=channeljs]",
    "textarea[data-setting='customJS']", "textarea[data-setting='chanjs']"
  ];

  const CSS_FIELD_SELECTORS = [
    "#chancss", "#channel-css", "#channelcss", "#customcss", "#customCSS",
    "textarea[name=chancss]", "textarea[name=channelcss]",
    "textarea[data-setting='customCSS']", "textarea[data-setting='chancss']"
  ];

  const DEFAULT_CONFIG = {
    version: 1,
    sliderJson: "",
    resources: {
      scripts: [],
      styles: []
    },
    tint: "midnight",
    colors: {
      background: "#0f1524",
      surface: "#161f33",
      panel: "#1d2640",
      text: "#e8ecf8",
      chatText: "#d4dcff",
      accent: "#6d4df6"
    }
  };

  const TINT_PRESETS = {
    midnight: {
      name: "Midnight Pulse",
      colors: {
        background: "#0f1524",
        surface: "#151d30",
        panel: "#1d2640",
        text: "#e8ecf8",
        chatText: "#d4dcff",
        accent: "#6d4df6"
      }
    },
    aurora: {
      name: "Aurora Bloom",
      colors: {
        background: "#081c26",
        surface: "#0e2532",
        panel: "#143144",
        text: "#f2fbff",
        chatText: "#daf3ff",
        accent: "#4dd0f6"
      }
    },
    sunset: {
      name: "Sunset Neon",
      colors: {
        background: "#1c0b16",
        surface: "#28101f",
        panel: "#331728",
        text: "#ffeef8",
        chatText: "#ffd1e5",
        accent: "#ff6b9d"
      }
    },
    ember: {
      name: "Ember Forge",
      colors: {
        background: "#1b1309",
        surface: "#241a0d",
        panel: "#2e210f",
        text: "#fcead6",
        chatText: "#f7d3a8",
        accent: "#ff914d"
      }
    }
  };

  const STYLE_ID = "btfw-theme-admin-style";

  function injectLocalStyles(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .btfw-theme-admin { padding: 16px 6px 26px; color: #d8ddf4; }
      .btfw-theme-admin h3 { font-size: 1.1rem; margin: 0 0 12px; letter-spacing: 0.02em; }
      .btfw-theme-admin p.lead { margin-bottom: 18px; color: rgba(216,221,244,0.72); }
      .btfw-theme-admin .section { background: rgba(15,19,32,0.78); border: 1px solid rgba(109,77,246,0.22); border-radius: 14px; padding: 16px 18px; margin-bottom: 18px; box-shadow: 0 12px 30px rgba(8,12,24,0.45); }
      .btfw-theme-admin .section h4 { font-size: 0.95rem; margin-bottom: 14px; color: #f0f4ff; letter-spacing: 0.04em; text-transform: uppercase; }
      .btfw-theme-admin .field { margin-bottom: 14px; }
      .btfw-theme-admin label { display: block; font-weight: 600; margin-bottom: 6px; letter-spacing: 0.02em; color: rgba(232,236,248,0.9); }
      .btfw-theme-admin input[type="text"],
      .btfw-theme-admin input[type="url"],
      .btfw-theme-admin textarea,
      .btfw-theme-admin select { width: 100%; background: rgba(7,10,22,0.76); border: 1px solid rgba(109,77,246,0.28); border-radius: 10px; padding: 10px 12px; color: #f8fbff; font-size: 0.95rem; box-shadow: inset 0 1px 0 rgba(255,255,255,0.05); transition: border 0.18s ease, box-shadow 0.18s ease; }
      .btfw-theme-admin input[type="color"] { width: 100%; height: 42px; padding: 0; border-radius: 12px; border: 1px solid rgba(109,77,246,0.35); background: rgba(7,10,22,0.76); cursor: pointer; }
      .btfw-theme-admin input:focus,
      .btfw-theme-admin textarea:focus,
      .btfw-theme-admin select:focus { border-color: rgba(132,99,255,0.82); box-shadow: 0 0 0 2px rgba(132,99,255,0.32); outline: none; }
      .btfw-theme-admin textarea { min-height: 64px; resize: vertical; }
      .btfw-theme-admin .help { font-size: 0.82rem; color: rgba(210,216,240,0.65); margin-top: 4px; }
      .btfw-theme-admin .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px 18px; }
      .btfw-theme-admin .preview { border-radius: 14px; overflow: hidden; border: 1px solid rgba(109,77,246,0.3); display: grid; grid-template-columns: 2fr 1fr; min-height: 120px; background: rgba(8,12,22,0.88); }
      .btfw-theme-admin .preview__main { padding: 18px; display: flex; flex-direction: column; gap: 8px; justify-content: center; }
      .btfw-theme-admin .preview__chips { display: flex; gap: 8px; flex-wrap: wrap; }
      .btfw-theme-admin .preview__chip { padding: 6px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; color: rgba(12,16,28,0.85); background: rgba(255,255,255,0.92); }
      .btfw-theme-admin .preview__accent { display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; color: rgba(12,16,28,0.8); }
      .btfw-theme-admin .buttons { display: flex; gap: 10px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
      .btfw-theme-admin .btn-primary { background: linear-gradient(135deg, rgba(109,77,246,0.95), rgba(76,94,255,0.95)); border: 0; color: #fff; padding: 10px 18px; border-radius: 10px; font-weight: 600; letter-spacing: 0.02em; cursor: pointer; box-shadow: 0 8px 18px rgba(86,72,255,0.35); transition: transform 0.16s ease, box-shadow 0.16s ease; }
      .btfw-theme-admin .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(86,72,255,0.42); }
      .btfw-theme-admin .btn-secondary { background: rgba(255,255,255,0.08); border: 0; color: rgba(232,236,248,0.88); padding: 10px 14px; border-radius: 10px; cursor: pointer; font-weight: 600; letter-spacing: 0.02em; }
      .btfw-theme-admin .status { font-size: 0.85rem; font-weight: 600; letter-spacing: 0.02em; }
      .btfw-theme-admin .status[data-variant="idle"] { color: rgba(210,216,240,0.7); }
      .btfw-theme-admin .status[data-variant="saved"] { color: #5af2b2; }
      .btfw-theme-admin .status[data-variant="error"] { color: #ff7a8a; }
      @media (max-width: 720px) {
        .btfw-theme-admin { padding: 12px 4px 18px; }
        .btfw-theme-admin .section { padding: 14px; }
      }
    `;
    document.head.appendChild(style);
  }

  function cloneDefaults(){
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  function deepMerge(target, source){
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach(key => {
      const value = source[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        target[key] = deepMerge(target[key] ? { ...target[key] } : {}, value);
      } else {
        target[key] = Array.isArray(value) ? value.slice() : value;
      }
    });
    return target;
  }

  function parseConfig(jsText){
    if (!jsText) return null;
    const start = jsText.indexOf(JS_BLOCK_START);
    const end = jsText.indexOf(JS_BLOCK_END);
    if (start === -1 || end === -1 || end < start) return null;
    const block = jsText.slice(start + JS_BLOCK_START.length, end).trim();
    const match = block.match(/window\.BTFW_THEME_ADMIN\s*=\s*(\{[\s\S]*?\});/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch (err) {
      console.warn("[theme-admin] Failed to parse stored config", err);
      return null;
    }
  }

  function buildConfigBlock(cfg){
    const json = JSON.stringify(cfg, null, 2);
    return `\n${JS_BLOCK_START}\nwindow.BTFW_THEME_ADMIN = ${json};\n(function(cfg){\n  if (!cfg) return;\n  window.BTFW = window.BTFW || {};\n  window.BTFW.channelTheme = cfg;\n  function ensureAsset(id, url, kind){\n    if (!url) return;\n    var existing = document.getElementById(id);\n    if (existing) return;\n    if (kind === 'style'){\n      var link = document.createElement('link');\n      link.rel = 'stylesheet';\n      link.href = url;\n      link.id = id;\n      document.head.appendChild(link);\n    } else {\n      var script = document.createElement('script');\n      script.src = url;\n      script.async = true;\n      script.defer = true;\n      script.id = id;\n      document.head.appendChild(script);\n    }\n  }\n  if (Array.isArray(cfg.resources?.styles)) {\n    cfg.resources.styles.forEach(function(url, idx){ ensureAsset('btfw-theme-style-'+idx, url, 'style'); });\n  }\n  if (Array.isArray(cfg.resources?.scripts)) {\n    cfg.resources.scripts.forEach(function(url, idx){ ensureAsset('btfw-theme-script-'+idx, url, 'script'); });\n  }\n  if (cfg.sliderJson) {\n    window.BTFW = window.BTFW || {};\n    window.BTFW.channelSliderJSON = cfg.sliderJson;\n  }\n  document.documentElement.setAttribute('data-btfw-theme-tint', cfg.tint || 'custom');\n})(window.BTFW_THEME_ADMIN);\n${JS_BLOCK_END}`;
  }

  function buildCssBlock(cfg){
    const colors = cfg.colors || {};
    const bg = colors.background || "#0f1524";
    const surface = colors.surface || colors.panel || "#161f33";
    const panel = colors.panel || "#1d2640";
    const text = colors.text || "#f0f4ff";
    const chatText = colors.chatText || text;
    const accent = colors.accent || "#6d4df6";

    return `\n${CSS_BLOCK_START}\n:root {\n  --btfw-theme-bg: ${bg};\n  --btfw-theme-surface: ${surface};\n  --btfw-theme-panel: ${panel};\n  --btfw-theme-text: ${text};\n  --btfw-theme-chat-text: ${chatText};\n  --btfw-theme-accent: ${accent};\n}\nhtml, body {\n  background-color: var(--btfw-theme-bg);\n  color: var(--btfw-theme-text);\n}\n#mainpage, #wrap, #main {\n  background: linear-gradient(160deg, color-mix(in srgb, var(--btfw-theme-bg) 92%, black 8%), color-mix(in srgb, var(--btfw-theme-surface) 92%, black 5%));\n  color: var(--btfw-theme-text);\n}\n#chatwrap {\n  --btfw-chat-text: 14px;\n  color: var(--btfw-theme-chat-text);\n}\n#chatwrap .chat-msg, #chatwrap .timestamp, #chatwrap .username {\n  color: var(--btfw-theme-chat-text);\n}\n#chatwrap .server-msg {\n  color: color-mix(in srgb, var(--btfw-theme-accent) 80%, white 20%);\n}\n#queue, #rightpane, #leftpane, #userlist, .poll-menu, .pollwrap {\n  background: rgba(0,0,0,0.08) linear-gradient(180deg, color-mix(in srgb, var(--btfw-theme-panel) 96%, black 4%), color-mix(in srgb, var(--btfw-theme-surface) 92%, black 8%));\n  border-radius: 14px;\n  border: 1px solid color-mix(in srgb, var(--btfw-theme-accent) 30%, transparent 70%);\n  box-shadow: 0 18px 36px rgba(0,0,0,0.35);
  color: var(--btfw-theme-text);
}\n.btn, button, .btn-primary, .btn-default {\n  background: linear-gradient(135deg, color-mix(in srgb, var(--btfw-theme-accent) 88%, white 12%), color-mix(in srgb, var(--btfw-theme-accent) 62%, black 8%));\n  border: 0;\n  color: #fff;\n}\n.btn:hover, button:hover, .btn-primary:hover {\n  filter: brightness(1.08);\n}\na { color: color-mix(in srgb, var(--btfw-theme-accent) 70%, white 30%); }\n[data-btfw-theme-tint="${cfg.tint || "custom"}"] body::after {\n  content: "";\n  position: fixed;\n  inset: 0;\n  pointer-events: none;\n  background: linear-gradient(160deg, color-mix(in srgb, var(--btfw-theme-accent) 12%, transparent 88%), transparent);\n  mix-blend-mode: screen;\n  opacity: 0.22;\n}\n${CSS_BLOCK_END}`;
  }

  function replaceBlock(original, startMarker, endMarker, block){
    const start = original.indexOf(startMarker);
    const end = original.indexOf(endMarker);
    if (start !== -1 && end !== -1 && end > start) {
      return original.slice(0, start) + block + original.slice(end + endMarker.length);
    }
    if (!original || !original.trim()) return block.trimStart();
    return `${original.trim()}\n\n${block.trimStart()}`;
  }

  function canManageChannel(){
    try {
      if (typeof window.hasPermission === "function") {
        if (window.hasPermission("motdedit") || window.hasPermission("seehidden") || window.hasPermission("chanowner")) return true;
      }
      const client = window.CLIENT || null;
      if (client?.hasPermission) {
        if (client.hasPermission("motdedit") || client.hasPermission("seehidden") || client.hasPermission("chanowner")) return true;
      }
      if (client && typeof client.rank !== "undefined") {
        const rank = client.rank | 0;
        const ranks = window.RANK || window.Ranks || {};
        const owner = [ranks.owner, ranks.founder, ranks.admin, ranks.administrator].find(v => typeof v === "number");
        if (typeof owner === "number") return rank >= owner;
        return rank >= 4;
      }
    } catch (_) {}
    return false;
  }

  function ensureField(modal, selectors, fallbackId){
    for (const selector of selectors) {
      const el = modal ? modal.querySelector(selector) : document.querySelector(selector);
      if (el) return el;
    }
    const host = modal?.querySelector("form") || modal?.querySelector(".modal-body") || modal || document.body;
    const textarea = document.createElement("textarea");
    textarea.id = fallbackId;
    textarea.style.display = "none";
    textarea.dataset.btfwThemeAdmin = "synthetic";
    host.appendChild(textarea);
    return textarea;
  }

  function renderPreview(panel, cfg){
    const preview = panel.querySelector(".preview");
    if (!preview) return;
    const colors = cfg.colors || {};
    preview.style.setProperty("--bg", colors.background || "#0f1524");
    preview.style.setProperty("--surface", colors.surface || colors.panel || "#161f33");
    preview.style.setProperty("--panel", colors.panel || "#1d2640");
    preview.style.setProperty("--accent", colors.accent || "#6d4df6");
    preview.style.background = `linear-gradient(160deg, ${colors.background || "#0f1524"}, ${colors.surface || colors.panel || "#161f33"})`;
    const accent = panel.querySelector(".preview__accent");
    if (accent) {
      accent.style.background = colors.accent || "#6d4df6";
    }
    const chips = panel.querySelectorAll(".preview__chip");
    chips.forEach(chip => {
      const key = chip.dataset.key;
      const value = colors[key] || "#6d4df6";
      chip.style.background = value;
      chip.textContent = `${key.replace(/([A-Z])/g, ' $1')}: ${value}`;
    });
  }

  function updateInputs(panel, cfg){
    $$('[data-btfw-bind]', panel).forEach(input => {
      const path = input.dataset.btfwBind;
      let value = cfg;
      path.split('.').forEach(part => { if (value) value = value[part]; });
      if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else if (input.tagName === "TEXTAREA") {
        if (Array.isArray(value)) {
          input.value = value.join('\n');
        } else {
          input.value = value || "";
        }
      } else if (input.type === "color") {
        input.value = value || "#000000";
      } else {
        input.value = value ?? "";
      }
    });
    renderPreview(panel, cfg);
  }

  function setValueAtPath(obj, path, value){
    const parts = path.split('.');
    let cursor = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
      cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function collectConfig(panel, cfg){
    const updated = cloneDefaults();
    deepMerge(updated, cfg);
    $$('[data-btfw-bind]', panel).forEach(input => {
      const path = input.dataset.btfwBind;
      let value;
      if (input.type === "checkbox") {
        value = input.checked;
      } else if (input.tagName === "TEXTAREA") {
        const lines = input.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        value = lines;
      } else {
        value = input.value;
      }
      setValueAtPath(updated, path, value);
    });
    return updated;
  }

  function ensureTab(modal){
    const nav =
      modal.querySelector(".nav-tabs") ||
      modal.querySelector(".nav.nav-tabs") ||
      modal.querySelector(".tabs ul") ||
      document.querySelector("#channeloptions .nav-tabs");
    const tabContainer =
      modal.querySelector(".tab-content") ||
      modal.querySelector(".tabs-content") ||
      modal.querySelector("#channelsettingsmodal .tab-content") ||
      document.querySelector("#channeloptions .tab-content");
    if (!nav || !tabContainer) return null;

    let tab = nav.querySelector("li[data-btfw-theme-tab]");
    if (!tab) {
      tab = document.createElement("li");
      tab.dataset.btfwThemeTab = "1";
      const anchor = document.createElement("a");
      anchor.href = "#btfw-theme-admin-panel";
      anchor.setAttribute("data-toggle", "tab");
      anchor.textContent = "Theme";
      anchor.style.display = "flex";
      anchor.style.alignItems = "center";
      anchor.style.gap = "8px";
      anchor.innerHTML = '<span class="fa fa-magic"></span> <span>Theme</span>';
      tab.appendChild(anchor);
      nav.appendChild(tab);
    }

    let panel = modal.querySelector("#btfw-theme-admin-panel") || document.querySelector("#channeloptions #btfw-theme-admin-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "btfw-theme-admin-panel";
      panel.className = "tab-pane";
      panel.style.display = "none";
      tabContainer.appendChild(panel);
    }

    const activate = () => {
      const activeClass = nav.classList.contains("tabs") ? "is-active" : "active";
      $$('li', nav).forEach(li => li.classList.remove("active", "is-active"));
      tab.classList.add(activeClass);
      $$(".tab-pane", tabContainer).forEach(p => { p.style.display = p === panel ? "block" : "none"; p.classList.remove("active", "in"); });
      panel.style.display = "block";
      panel.classList.add("active");
    };

    const deactivate = () => {
      panel.style.display = "none";
      panel.classList.remove("active");
    };

    const alreadyBound = Boolean(tab.dataset.btfwThemeTabBound);
    if (!alreadyBound) {
      tab.dataset.btfwThemeTabBound = "1";
      tab.addEventListener("click", evt => {
        evt.preventDefault();
        activate();
      });
    }

    panel.dataset.activate = activate;
    panel.dataset.deactivate = deactivate;
    return panel;
  }

  function renderPanel(panel){
    injectLocalStyles();
    panel.innerHTML = `
      <div class="btfw-theme-admin">
        <h3>Channel Theme Toolkit</h3>
        <p class="lead">Configure your BillTube channel's featured media, theme scripts, and palette without touching Channel JS or CSS. These settings will be stored alongside your channel and auto-applied on load.</p>

        <div class="section">
          <h4>Featured Content & Resources</h4>
          <div class="field">
            <label for="btfw-theme-slider-json">Featured slider JSON</label>
            <input type="url" id="btfw-theme-slider-json" data-btfw-bind="sliderJson" placeholder="https://example.com/featured.json">
            <p class="help">Paste the URL to the JSON feed used by the channel slider. We'll cache this in window.BTFW.channelTheme.sliderJson for other modules.</p>
          </div>
          <div class="field">
            <label for="btfw-theme-css-urls">Additional CSS URLs</label>
            <textarea id="btfw-theme-css-urls" data-btfw-bind="resources.styles" placeholder="https://example.com/theme.css"></textarea>
            <p class="help">Each line becomes a stylesheet link, injected before the theme renders. Useful for advanced overrides.</p>
          </div>
          <div class="field">
            <label for="btfw-theme-js-urls">Additional Script URLs</label>
            <textarea id="btfw-theme-js-urls" data-btfw-bind="resources.scripts" placeholder="https://example.com/theme.js"></textarea>
            <p class="help">Each line becomes a deferred script tag. Use this for widgets or extra behavior you previously pasted in Channel JS.</p>
          </div>
        </div>

        <div class="section">
          <h4>Palette & Tint</h4>
          <div class="field">
            <label for="btfw-theme-tint">Preset tint</label>
            <select id="btfw-theme-tint" data-btfw-bind="tint">
              <option value="midnight">Midnight Pulse</option>
              <option value="aurora">Aurora Bloom</option>
              <option value="sunset">Sunset Neon</option>
              <option value="ember">Ember Forge</option>
              <option value="custom">Custom mix</option>
            </select>
            <p class="help">Choose a curated palette to start from. Switching presets updates the swatches below. Adjust any color to craft your own look.</p>
          </div>
          <div class="grid">
            <div class="field">
              <label>Background</label>
              <input type="color" data-btfw-bind="colors.background">
            </div>
            <div class="field">
              <label>Surface</label>
              <input type="color" data-btfw-bind="colors.surface">
            </div>
            <div class="field">
              <label>Panel</label>
              <input type="color" data-btfw-bind="colors.panel">
            </div>
            <div class="field">
              <label>Primary text</label>
              <input type="color" data-btfw-bind="colors.text">
            </div>
            <div class="field">
              <label>Chat text</label>
              <input type="color" data-btfw-bind="colors.chatText">
            </div>
            <div class="field">
              <label>Accent</label>
              <input type="color" data-btfw-bind="colors.accent">
            </div>
          </div>
          <div class="preview" aria-hidden="true">
            <div class="preview__main">
              <div class="preview__chips">
                <div class="preview__chip" data-key="background"></div>
                <div class="preview__chip" data-key="surface"></div>
                <div class="preview__chip" data-key="panel"></div>
                <div class="preview__chip" data-key="text"></div>
                <div class="preview__chip" data-key="chatText"></div>
              </div>
            </div>
            <div class="preview__accent">Accent</div>
          </div>
        </div>

        <div class="buttons">
          <button type="button" class="btn-primary" id="btfw-theme-apply">Apply to Channel CSS & JS</button>
          <button type="button" class="btn-secondary" id="btfw-theme-reset">Reset to preset</button>
          <span class="status" id="btfw-theme-status" data-variant="idle">No changes applied yet.</span>
        </div>
      </div>
    `;
    return panel;
  }

  function watchInputs(panel, cfg, onChange){
    $$('[data-btfw-bind]', panel).forEach(input => {
      const handler = () => {
        if (input.dataset.btfwBind.startsWith("colors")) {
          const tintSelect = panel.querySelector('#btfw-theme-tint');
          if (tintSelect && tintSelect.value !== "custom") {
            tintSelect.value = "custom";
          }
        }
        onChange();
      };
      input.addEventListener("input", handler);
      input.addEventListener("change", handler);
    });

    const tintSelect = panel.querySelector('#btfw-theme-tint');
    if (tintSelect) {
      tintSelect.addEventListener('change', () => {
        const value = tintSelect.value;
        if (value && value !== 'custom' && TINT_PRESETS[value]) {
          const preset = TINT_PRESETS[value];
          Object.assign(cfg.colors, preset.colors);
          updateInputs(panel, cfg);
        }
        onChange();
      });
    }

    const resetBtn = panel.querySelector('#btfw-theme-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const tint = panel.querySelector('#btfw-theme-tint')?.value || 'midnight';
        if (tint !== 'custom' && TINT_PRESETS[tint]) {
          const preset = TINT_PRESETS[tint];
          Object.assign(cfg.colors, preset.colors);
        } else {
          const defaults = cloneDefaults();
          Object.assign(cfg.colors, defaults.colors);
        }
        updateInputs(panel, cfg);
        onChange();
      });
    }
  }

  function applyConfigToFields(panel, cfg, modal){
    const status = panel.querySelector('#btfw-theme-status');
    const jsField = ensureField(modal, JS_FIELD_SELECTORS, "chanjs");
    const cssField = ensureField(modal, CSS_FIELD_SELECTORS, "chancss");
    if (!jsField || !cssField) {
      if (status) {
        status.textContent = "Could not find Channel JS or CSS fields.";
        status.dataset.variant = "error";
      }
      return;
    }

    const existingJs = jsField.value || "";
    const existingCss = cssField.value || "";

    const mergedConfig = collectConfig(panel, cfg);
    const jsBlock = buildConfigBlock(mergedConfig);
    const cssBlock = buildCssBlock(mergedConfig);

    jsField.value = replaceBlock(existingJs, JS_BLOCK_START, JS_BLOCK_END, jsBlock);
    cssField.value = replaceBlock(existingCss, CSS_BLOCK_START, CSS_BLOCK_END, cssBlock);

    if (status) {
      status.textContent = "Theme JS & CSS updated. Don't forget to save channel settings.";
      status.dataset.variant = "saved";
    }
    renderPreview(panel, mergedConfig);
  }

  function initPanel(modal){
    if (!canManageChannel()) return false;
    const panel = ensureTab(modal);
    if (!panel || panel.dataset.initialized === "1") return Boolean(panel);

    renderPanel(panel);

    const jsField = ensureField(modal, JS_FIELD_SELECTORS, "chanjs");
    const storedConfig = parseConfig(jsField?.value || "");
    const cfg = deepMerge(cloneDefaults(), storedConfig || {});

    updateInputs(panel, cfg);

    let dirty = false;
    const status = panel.querySelector('#btfw-theme-status');
    const markDirty = () => {
      dirty = true;
      if (status) {
        status.textContent = "Changes pending. Click apply to sync with Channel JS/CSS.";
        status.dataset.variant = "idle";
      }
    };

    watchInputs(panel, cfg, markDirty);

    const applyBtn = panel.querySelector('#btfw-theme-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        applyConfigToFields(panel, cfg, modal);
        dirty = false;
      });
    }

    const observer = new MutationObserver(() => {
      const active = panel.classList.contains('active') || panel.style.display === 'block';
      if (active && status && dirty) {
        status.textContent = "Changes pending. Click apply to sync with Channel JS/CSS.";
        status.dataset.variant = "idle";
      }
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['class', 'style'] });

    panel.dataset.initialized = "1";
    return true;
  }

  function boot(){
    if (!canManageChannel()) return;
    const modal =
      document.getElementById('channeloptions') ||
      document.getElementById('channelsettingsmodal') ||
      document.getElementById('channeloptionsmodal') ||
      document.querySelector('.channel-settings-modal');
    if (modal && !modal.dataset.btfwThemeAdminBound) {
      if (initPanel(modal)) {
        modal.dataset.btfwThemeAdminBound = "1";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  const mo = new MutationObserver(() => {
    const modal =
      document.getElementById('channeloptions') ||
      document.getElementById('channelsettingsmodal') ||
      document.getElementById('channeloptionsmodal') ||
      document.querySelector('.channel-settings-modal');
    if (modal && !modal.dataset.btfwThemeAdminBound) {
      if (initPanel(modal)) {
        modal.dataset.btfwThemeAdminBound = "1";
      }
    } else if (modal) {
      initPanel(modal);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  return { name: "feature:channelThemeAdmin" };
});
