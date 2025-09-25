/* BTFW — feature:channel-theme-admin (Channel Theme Settings Panel) */
BTFW.define("feature:channel-theme-admin", [], async () => {
  const JS_FIELD_SELECTORS = ["#chanjs", "#channel-js", ".channel-js-field", "textarea[name='js']"];
  const CSS_FIELD_SELECTORS = ["#chancss", "#channel-css", ".channel-css-field", "textarea[name='css']"];
  
  const JS_BLOCK_START = "/* BTFW_THEME_CONFIG_START */";
  const JS_BLOCK_END = "/* BTFW_THEME_CONFIG_END */";
  const CSS_BLOCK_START = "/* BTFW_THEME_STYLES_START */";
  const CSS_BLOCK_END = "/* BTFW_THEME_STYLES_END */";

  const FONT_PRESETS = {
    "inter": { name: "Inter", family: "'Inter', 'Segoe UI', sans-serif", google: "Inter:wght@300;400;600;700" },
    "roboto": { name: "Roboto", family: "'Roboto', 'Segoe UI', sans-serif", google: "Roboto:wght@300;400;500;700" },
    "poppins": { name: "Poppins", family: "'Poppins', 'Segoe UI', sans-serif", google: "Poppins:wght@300;400;600;700" },
    "montserrat": { name: "Montserrat", family: "'Montserrat', 'Segoe UI', sans-serif", google: "Montserrat:wght@300;400;600;700" },
    "opensans": { name: "Open Sans", family: "'Open Sans', 'Segoe UI', sans-serif", google: "Open+Sans:wght@300;400;600;700" },
    "lato": { name: "Lato", family: "'Lato', 'Segoe UI', sans-serif", google: "Lato:wght@300;400;700;900" },
    "nunito": { name: "Nunito", family: "'Nunito', 'Segoe UI', sans-serif", google: "Nunito:wght@300;400;600;700" },
    "manrope": { name: "Manrope", family: "'Manrope', 'Segoe UI', sans-serif", google: "Manrope:wght@300;400;600;700" },
    "outfit": { name: "Outfit", family: "'Outfit', 'Segoe UI', sans-serif", google: "Outfit:wght@300;400;600;700" },
    "urbanist": { name: "Urbanist", family: "'Urbanist', 'Segoe UI', sans-serif", google: "Urbanist:wght@300;400;600;700" }
  };
  const FONT_FALLBACK_FAMILY = "'Inter', 'Segoe UI', sans-serif";

  const DEFAULT_CONFIG = {
    version: 3,
    colors: {
      background: "#05060d",
      surface: "#0b111d", 
      panel: "#141f36",
      text: "#e8ecfb",
      chatText: "#e8ecfb",
      accent: "#6d4df6"
    },
    typography: { preset: "inter", custom: "" },
    resources: { styles: [], scripts: [] },
    integrations: { enabled: true },
    branding: {
      headerName: "",
      favicon: "",
      posterUrl: ""
    },
    slider: {
      enabled: false,
      feedUrl: ""
    }
  };

  function cloneDefaults(){
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  function deepMerge(target, source) {
    if (!target || !source || typeof target !== "object" || typeof source !== "object") {
      return source !== undefined ? source : target;
    }
    Object.keys(source).forEach(key => {
      const value = source[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        target[key] = deepMerge(typeof target[key] === "object" && !Array.isArray(target[key]) ? 
          { ...target[key] } : {}, value);
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
    const normalized = cloneDefaults();
    deepMerge(normalized, cfg || {});
    if (!normalized.slider || typeof normalized.slider !== "object") {
      normalized.slider = cloneDefaults().slider;
    }
    const slider = normalized.slider || {};
    normalized.sliderEnabled = Boolean(slider.enabled);
    normalized.sliderJson = slider.feedUrl || slider.url || "";

    const json = JSON.stringify(normalized, null, 2);
    return `\n${JS_BLOCK_START}\nwindow.BTFW_THEME_ADMIN = ${json};\n(function(cfg){\n  if (!cfg) return;\n  window.BTFW = window.BTFW || {};\n  window.BTFW.channelTheme = cfg;\n  const FONT_PRESETS = {"inter":{"name":"Inter","family":"'Inter', 'Segoe UI', sans-serif","google":"Inter:wght@300;400;600;700"},"roboto":{"name":"Roboto","family":"'Roboto', 'Segoe UI', sans-serif","google":"Roboto:wght@300;400;500;700"},"poppins":{"name":"Poppins","family":"'Poppins', 'Segoe UI', sans-serif","google":"Poppins:wght@300;400;600;700"},"montserrat":{"name":"Montserrat","family":"'Montserrat', 'Segoe UI', sans-serif","google":"Montserrat:wght@300;400;600;700"},"opensans":{"name":"Open Sans","family":"'Open Sans', 'Segoe UI', sans-serif","google":"Open+Sans:wght@300;400;600;700"},"lato":{"name":"Lato","family":"'Lato', 'Segoe UI', sans-serif","google":"Lato:wght@300;400;700;900"},"nunito":{"name":"Nunito","family":"'Nunito', 'Segoe UI', sans-serif","google":"Nunito:wght@300;400;600;700"},"manrope":{"name":"Manrope","family":"'Manrope', 'Segoe UI', sans-serif","google":"Manrope:wght@300;400;600;700"},"outfit":{"name":"Outfit","family":"'Outfit', 'Segoe UI', sans-serif","google":"Outfit:wght@300;400;600;700"},"urbanist":{"name":"Urbanist","family":"'Urbanist', 'Segoe UI', sans-serif","google":"Urbanist:wght@300;400;600;700"}};\n  const FONT_FALLBACK = "'Inter', 'Segoe UI', sans-serif";\n  function ensureAsset(id, url, kind){\n    if (!url) return;\n    var existing = document.getElementById(id);\n    if (existing) return;\n    if (kind === 'style'){\n      var link = document.createElement('link');\n      link.rel = 'stylesheet';\n      link.href = url;\n      link.id = id;\n      document.head.appendChild(link);\n    } else {\n      var script = document.createElement('script');\n      script.src = url;\n      script.async = true;\n      script.defer = true;\n      script.id = id;\n      document.head.appendChild(script);\n    }\n  }\n  function applyResources(resources){\n    if (!resources) return;\n    if (Array.isArray(resources.styles)) {\n      resources.styles.forEach(function(url, idx){ ensureAsset('btfw-theme-style-'+idx, url, 'style'); });\n    }\n    if (Array.isArray(resources.scripts)) {\n      resources.scripts.forEach(function(url, idx){ ensureAsset('btfw-theme-script-'+idx, url, 'script'); });\n    }\n  }\n  function applySlider(sliderCfg){\n    sliderCfg = sliderCfg || {};\n    if (typeof sliderCfg.enabled === 'undefined' && typeof cfg.sliderEnabled !== 'undefined') {\n      sliderCfg.enabled = cfg.sliderEnabled;\n    }\n    if (!sliderCfg.feedUrl && cfg.sliderJson) {\n      sliderCfg.feedUrl = cfg.sliderJson;\n    }\n    var enabled = Boolean(sliderCfg.enabled);\n    var feed = sliderCfg.feedUrl || sliderCfg.url || '';\n    cfg.slider = cfg.slider || {};\n    cfg.slider.enabled = enabled;\n    cfg.slider.feedUrl = feed;\n    cfg.sliderEnabled = enabled;\n    cfg.sliderJson = feed;\n    window.BTFW.channelSlider = { enabled: enabled, feedUrl: feed };\n    window.BTFW.channelSliderEnabled = enabled;\n    window.BTFW.channelSliderJSON = feed;\n    window.UI_ChannelList = enabled ? 1 : 0;\n    window.Channel_JSON = feed || '';\n  }\n  function applyBranding(branding){\n    branding = branding || {};\n    var name = typeof branding.headerName === 'string' ? branding.headerName.trim() : '';\n    var favicon = typeof branding.favicon === 'string' ? branding.favicon.trim() : '';\n    var posterUrl = typeof branding.posterUrl === 'string' ? branding.posterUrl.trim() : '';\n    cfg.branding = cfg.branding || {};\n    cfg.branding.headerName = name;\n    cfg.branding.favicon = favicon;\n    cfg.branding.posterUrl = posterUrl;\n    window.BTFW.channelBranding = { headerName: name, favicon: favicon, posterUrl: posterUrl };\n    if (name && typeof document !== 'undefined') {\n      var brand = document.querySelector('.navbar-brand, .brand, .header-brand');\n      if (brand) brand.textContent = name;\n    }\n    if (favicon && typeof document !== 'undefined') {\n      var existing = document.getElementById('btfw-favicon');\n      if (existing) existing.remove();\n      if (favicon.startsWith('http')) {\n        var link = document.createElement('link');\n        link.id = 'btfw-favicon';\n        link.rel = 'icon';\n        link.href = favicon;\n        document.head.appendChild(link);\n      }\n    }\n    if (posterUrl && typeof document !== 'undefined') {\n      applyVideoJSPoster(posterUrl);\n    }\n  }\n  function applyVideoJSPoster(posterUrl){\n    if (!posterUrl) return;\n    try {\n      if (typeof videojs === 'function') {\n        var player = videojs('ytapiplayer');\n        if (player && typeof player.poster === 'function') {\n          player.poster(posterUrl);\n          return;\n        }\n      }\n      var video = document.querySelector('#ytapiplayer video, video');\n      if (video) {\n        video.setAttribute('poster', posterUrl);\n      }\n    } catch (err) {\n      console.warn('[channel-theme-admin] Failed to set poster:', err);\n    }\n  }\n  function applyColors(colors){\n    colors = colors || {};\n    var bg = colors.background || '#05060d';\n    var surface = colors.surface || colors.panel || '#0b111d';\n    var panel = colors.panel || '#141f36';\n    var text = colors.text || '#e8ecfb';\n    var chatText = colors.chatText || text;\n    var accent = colors.accent || '#6d4df6';\n    var root = document.documentElement;\n    if (root) {\n      root.style.setProperty('--btfw-color-bg', bg);\n      root.style.setProperty('--btfw-color-surface', surface);\n      root.style.setProperty('--btfw-color-panel', panel);\n      root.style.setProperty('--btfw-color-text', text);\n      root.style.setProperty('--btfw-color-chat-text', chatText);\n      root.style.setProperty('--btfw-color-accent', accent);\n    }\n    cfg.colors = cfg.colors || {};\n    cfg.colors.background = bg;\n    cfg.colors.surface = surface;\n    cfg.colors.panel = panel;\n    cfg.colors.text = text;\n    cfg.colors.chatText = chatText;\n    cfg.colors.accent = accent;\n  }\n  function applyIntegrations(integrations){\n    integrations = integrations || {};\n    var enabled = Boolean(integrations.enabled);\n    cfg.integrations = cfg.integrations || {};\n    cfg.integrations.enabled = enabled;\n    window.BTFW.integrationsEnabled = enabled;\n  }\n  function resolveFont(typography){\n    if (!typography) return { family: FONT_FALLBACK, url: '', label: 'Inter' };\n    var preset = typography.preset || 'inter';\n    var custom = typography.custom || '';\n    if (preset === 'custom' && custom) {\n      var name = custom.trim().replace(/'/g, '');\n      var family = name ? \"'\" + name.replace(/'/g, \"\\'\") + \"', \" + FONT_FALLBACK : FONT_FALLBACK;\n      var url = name ? 'https://fonts.googleapis.com/css2?family=' + name.replace(/\\s+/g, '+') + ':wght@300;400;600;700&display=swap' : '';\n      return { family: family, url: url, label: name || 'Custom' };\n    }\n    var meta = FONT_PRESETS[preset] || FONT_PRESETS['inter'];\n    var family = meta ? meta.family : FONT_FALLBACK;\n    var url = meta && meta.google ? 'https://fonts.googleapis.com/css2?family=' + meta.google + '&display=swap' : '';\n    return { family: family, url: url, label: (meta && meta.name) || 'Inter' };\n  }\n  function applyTypography(typography){\n    var resolved = resolveFont(typography);\n    var root = document.documentElement;\n    if (root && resolved.family) {\n      root.style.setProperty('--btfw-theme-font-family', resolved.family);\n    }\n    var existing = document.getElementById('btfw-theme-font');\n    if (resolved.url) {\n      if (existing && existing.tagName === 'LINK') {\n        if (existing.href !== resolved.url) existing.href = resolved.url;\n      } else {\n        ensureAsset('btfw-theme-font', resolved.url, 'style');\n      }\n    } else if (existing && existing.parentNode) {\n      existing.parentNode.removeChild(existing);\n    }\n    cfg.typography = cfg.typography || {};\n    cfg.typography.resolvedFamily = resolved.family;\n  }\n  applyResources(cfg.resources);\n  applySlider(cfg.slider || {});\n  applyBranding(cfg.branding || {});\n  applyColors(cfg.colors || {});\n  applyIntegrations(cfg.integrations || {});\n  applyTypography(cfg.typography || {});\n})(window.BTFW_THEME_ADMIN);\n${JS_BLOCK_END}`;

  }

  function buildCssBlock(cfg){
    const colors = cfg.colors || {};
    const typography = applyLiveTypographyAssets(cfg.typography || {});
    const bg = colors.background || "#05060d";
    const surface = colors.surface || colors.panel || "#0b111d";
    const panel = colors.panel || "#141f36";
    const textColor = colors.text || "#e8ecfb";
    const chatText = colors.chatText || textColor;
    const accent = colors.accent || "#6d4df6";
    const fontFamily = typography.family || FONT_FALLBACK_FAMILY;

    return `\n${CSS_BLOCK_START}\n:root {\n  --btfw-theme-bg: ${bg};\n  --btfw-theme-surface: ${surface};\n  --btfw-theme-panel: ${panel};\n  --btfw-theme-text: ${textColor};\n  --btfw-theme-chat-text: ${chatText};\n  --btfw-theme-accent: ${accent};\n  --btfw-theme-font-family: ${fontFamily};\n}\n${CSS_BLOCK_END}`;
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
    const typography = applyLiveTypographyAssets(cfg.typography || {});
    preview.style.setProperty("--bg", colors.background || "#05060d");
    preview.style.setProperty("--surface", colors.surface || colors.panel || "#0b111d");
    preview.style.setProperty("--panel", colors.panel || "#141f36");
    preview.style.setProperty("--accent", colors.accent || "#6d4df6");
    preview.style.background = `linear-gradient(160deg, ${colors.background || "#05060d"} 0%, ${colors.surface || "#0b111d"} 100%)`;
    preview.style.fontFamily = typography.family || FONT_FALLBACK_FAMILY;
    preview.style.color = colors.text || "#e8ecfb";
  }

  function applyLiveTypographyAssets(typography) {
    const preset = typography?.preset || "inter";
    const custom = typography?.custom || "";
    
    if (preset === "custom" && custom) {
      const name = custom.trim().replace(/'/g, "");
      const family = name ? `'${name.replace(/'/g, "\\'")}', ${FONT_FALLBACK_FAMILY}` : FONT_FALLBACK_FAMILY;
      const url = name ? `https://fonts.googleapis.com/css2?family=${name.replace(/\s+/g, "+")}:wght@300;400;600;700&display=swap` : "";
      return { family, url, label: name || "Custom" };
    }
    
    const meta = FONT_PRESETS[preset] || FONT_PRESETS["inter"];
    const family = meta?.family || FONT_FALLBACK_FAMILY;
    const url = meta?.google ? `https://fonts.googleapis.com/css2?family=${meta.google}&display=swap` : "";
    return { family, url, label: meta?.name || "Inter" };
  }

  function renderPanel(panel) {
    panel.innerHTML = `
      <div class="btfw-theme-admin">
        <header class="btfw-theme-header">
          <h3>BillTube Theme Settings</h3>
          <p>Customize your channel's appearance and branding.</p>
        </header>
        
        <div class="btfw-sections">
          <section class="btfw-section">
            <h4>Colors</h4>
            <div class="btfw-color-grid">
              <div class="btfw-color-item">
                <label for="btfw-bg">Background:</label>
                <input type="color" id="btfw-bg" value="#05060d">
              </div>
              <div class="btfw-color-item">
                <label for="btfw-surface">Surface:</label>
                <input type="color" id="btfw-surface" value="#0b111d">
              </div>
              <div class="btfw-color-item">
                <label for="btfw-panel">Panel:</label>
                <input type="color" id="btfw-panel" value="#141f36">
              </div>
              <div class="btfw-color-item">
                <label for="btfw-text">Text:</label>
                <input type="color" id="btfw-text" value="#e8ecfb">
              </div>
              <div class="btfw-color-item">
                <label for="btfw-chat-text">Chat Text:</label>
                <input type="color" id="btfw-chat-text" value="#e8ecfb">
              </div>
              <div class="btfw-color-item">
                <label for="btfw-accent">Accent:</label>
                <input type="color" id="btfw-accent" value="#6d4df6">
              </div>
            </div>
          </section>

          <section class="btfw-section">
            <h4>Typography</h4>
            <div class="btfw-control">
              <label for="btfw-font-preset">Font:</label>
              <select id="btfw-font-preset">
                <option value="inter">Inter</option>
                <option value="roboto">Roboto</option>
                <option value="poppins">Poppins</option>
                <option value="montserrat">Montserrat</option>
                <option value="opensans">Open Sans</option>
                <option value="lato">Lato</option>
                <option value="nunito">Nunito</option>
                <option value="manrope">Manrope</option>
                <option value="outfit">Outfit</option>
                <option value="urbanist">Urbanist</option>
                <option value="custom">Custom Font</option>
              </select>
            </div>
            <div class="btfw-control btfw-custom-font" style="display: none;">
              <label for="btfw-custom-font">Custom Font Name:</label>
              <input type="text" id="btfw-custom-font" placeholder="Helvetica Neue">
            </div>
          </section>

          <section class="btfw-section">
            <h4>Branding</h4>
            <div class="btfw-control">
              <label for="btfw-header-name">Channel Name:</label>
              <input type="text" id="btfw-header-name" placeholder="My Awesome Channel">
            </div>
            <div class="btfw-control">
              <label for="btfw-favicon">Favicon URL:</label>
              <input type="url" id="btfw-favicon" placeholder="https://example.com/favicon.ico">
            </div>
            <div class="btfw-control">
              <label for="btfw-poster">Video Poster URL:</label>
              <input type="url" id="btfw-poster" placeholder="https://example.com/poster.jpg">
            </div>
          </section>

          <section class="btfw-section">
            <h4>Channel Slider</h4>
            <div class="btfw-control">
              <label class="btfw-checkbox">
                <input type="checkbox" id="btfw-slider-enabled">
                Enable channel carousel
              </label>
            </div>
            <div class="btfw-control">
              <label for="btfw-slider-url">JSON Feed URL:</label>
              <input type="url" id="btfw-slider-url" placeholder="https://example.com/channels.json">
            </div>
          </section>
        </div>

        <div class="btfw-actions">
          <button type="button" id="btfw-apply" class="btfw-btn btfw-btn-primary">Apply Theme</button>
          <button type="button" id="btfw-reset" class="btfw-btn btfw-btn-secondary">Reset to Defaults</button>
        </div>
        
        <div id="btfw-theme-status" class="btfw-status" data-variant="idle">
          Theme settings loaded. Make changes above and click Apply.
        </div>
      </div>
    `;
  }

  function extractSliderSettings(jsText) {
    if (!jsText) return {};
    
    const enabledMatch = jsText.match(/window\.UI_ChannelList\s*=\s*["']?([^"';]+)["']?/);
    const urlMatch = jsText.match(/window\.Channel_JSON\s*=\s*["']([^"']*)["']/);
    
    return {
      enabled: enabledMatch ? (enabledMatch[1] === "1" || enabledMatch[1] === 1) : undefined,
      url: urlMatch ? urlMatch[1] : undefined
    };
  }

  function ensureSliderVariables(jsText, cfg) {
    const slider = cfg.slider || {};
    const enabled = Boolean(slider.enabled);
    const feedUrl = slider.feedUrl || "";
    
    let result = jsText || "";
    
    // Remove existing slider variables
    result = result.replace(/window\.UI_ChannelList\s*=\s*[^;\n]*;?\s*/g, "");
    result = result.replace(/window\.Channel_JSON\s*=\s*[^;\n]*;?\s*/g, "");
    
    // Add new slider variables at the end
    const sliderVars = `\nwindow.UI_ChannelList = ${enabled ? "1" : "0"};\nwindow.Channel_JSON = "${feedUrl}";\n`;
    
    return result + sliderVars;
  }

  function overwriteConfig(target, source) {
    Object.keys(source).forEach(key => {
      target[key] = source[key];
    });
  }

  function collectConfig(panel, baseCfg) {
    const cfg = JSON.parse(JSON.stringify(baseCfg || cloneDefaults()));

    // Colors
    const bgColor = panel.querySelector('#btfw-bg')?.value;
    const surfaceColor = panel.querySelector('#btfw-surface')?.value;
    const panelColor = panel.querySelector('#btfw-panel')?.value;
    const textColor = panel.querySelector('#btfw-text')?.value;
    const chatTextColor = panel.querySelector('#btfw-chat-text')?.value;
    const accentColor = panel.querySelector('#btfw-accent')?.value;

    cfg.colors = cfg.colors || {};
    if (bgColor) cfg.colors.background = bgColor;
    if (surfaceColor) cfg.colors.surface = surfaceColor;
    if (panelColor) cfg.colors.panel = panelColor;
    if (textColor) cfg.colors.text = textColor;
    if (chatTextColor) cfg.colors.chatText = chatTextColor;
    if (accentColor) cfg.colors.accent = accentColor;

    // Typography
    const fontPreset = panel.querySelector('#btfw-font-preset')?.value || 'inter';
    const customFont = panel.querySelector('#btfw-custom-font')?.value || '';

    cfg.typography = cfg.typography || {};
    cfg.typography.preset = fontPreset;
    cfg.typography.custom = customFont;

    // Branding
    const headerName = panel.querySelector('#btfw-header-name')?.value || "";
    const favicon = panel.querySelector('#btfw-favicon')?.value || "";
    const posterUrl = panel.querySelector('#btfw-poster')?.value || "";

    cfg.branding = cfg.branding || {};
    cfg.branding.headerName = headerName;
    cfg.branding.favicon = favicon;
    cfg.branding.posterUrl = posterUrl;

    // Slider
    const sliderEnabled = panel.querySelector('#btfw-slider-enabled')?.checked || false;
    const sliderUrl = panel.querySelector('#btfw-slider-url')?.value || '';

    cfg.slider = cfg.slider || {};
    cfg.slider.enabled = sliderEnabled;
    cfg.slider.feedUrl = sliderUrl;

    return cfg;
  }

  function updateInputs(panel, cfg) {
    const colors = cfg.colors || {};
    const typography = cfg.typography || {};
    const branding = cfg.branding || {};
    const slider = cfg.slider || {};

    // Update colors
    const bgInput = panel.querySelector('#btfw-bg');
    const surfaceInput = panel.querySelector('#btfw-surface');
    const panelInput = panel.querySelector('#btfw-panel');
    const textInput = panel.querySelector('#btfw-text');
    const chatTextInput = panel.querySelector('#btfw-chat-text');
    const accentInput = panel.querySelector('#btfw-accent');

    if (bgInput) bgInput.value = colors.background || "#05060d";
    if (surfaceInput) surfaceInput.value = colors.surface || "#0b111d";
    if (panelInput) panelInput.value = colors.panel || "#141f36";
    if (textInput) textInput.value = colors.text || "#e8ecfb";
    if (chatTextInput) chatTextInput.value = colors.chatText || "#e8ecfb";
    if (accentInput) accentInput.value = colors.accent || "#6d4df6";

    // Update typography
    const fontPresetInput = panel.querySelector('#btfw-font-preset');
    const customFontInput = panel.querySelector('#btfw-custom-font');
    const customFontContainer = panel.querySelector('.btfw-custom-font');

    if (fontPresetInput) {
      fontPresetInput.value = typography.preset || 'inter';
      if (customFontContainer) {
        customFontContainer.style.display = (typography.preset === 'custom') ? 'block' : 'none';
      }
    }
    if (customFontInput) customFontInput.value = typography.custom || '';

    // Update branding
    const headerInput = panel.querySelector('#btfw-header-name');
    const faviconInput = panel.querySelector('#btfw-favicon');
    const posterInput = panel.querySelector('#btfw-poster');

    if (headerInput) headerInput.value = branding.headerName || "";
    if (faviconInput) faviconInput.value = branding.favicon || "";
    if (posterInput) posterInput.value = branding.posterUrl || "";

    // Update slider
    const sliderEnabledInput = panel.querySelector('#btfw-slider-enabled');
    const sliderUrlInput = panel.querySelector('#btfw-slider-url');

    if (sliderEnabledInput) sliderEnabledInput.checked = Boolean(slider.enabled);
    if (sliderUrlInput) sliderUrlInput.value = slider.feedUrl || '';
  }

  function ensureTab(modal) {
    if (!modal) return null;

    const existingTab = modal.querySelector('.btfw-theme-admin');
    if (existingTab) return existingTab.closest('.tab-pane, .modal-tab, [role="tabpanel"]') || existingTab.parentElement;

    const tabContainer = modal.querySelector('.nav-tabs, .modal-tabs, [role="tablist"]');
    const contentContainer = modal.querySelector('.tab-content, .modal-content .modal-body, .modal-body');

    if (!tabContainer || !contentContainer) return null;

    // Create tab button
    const tabButton = document.createElement('li');
    tabButton.innerHTML = '<a href="#btfw-theme-tab" data-toggle="tab">Theme</a>';
    tabContainer.appendChild(tabButton);

    // Create tab content
    const tabContent = document.createElement('div');
    tabContent.id = 'btfw-theme-tab';
    tabContent.className = 'tab-pane';
    tabContent.setAttribute('role', 'tabpanel');
    contentContainer.appendChild(tabContent);

    return tabContent;
  }

  function applyTheme(panel, cfg, mode = 'manual') {
    const jsField = ensureField(document, JS_FIELD_SELECTORS, "chanjs");
    const cssField = ensureField(document, CSS_FIELD_SELECTORS, "chancss");
    const status = panel.querySelector('#btfw-theme-status');

    if (!jsField || !cssField) {
      if (status) {
        status.textContent = "Error: Cannot find Channel JS/CSS fields. Please open Channel Settings first.";
        status.dataset.variant = "error";
      }
      return;
    }

    const existingJs = jsField.value || "";
    const existingCss = cssField.value || "";

    const mergedConfig = collectConfig(panel, cfg);
    const jsBlock = buildConfigBlock(mergedConfig);
    const cssBlock = buildCssBlock(mergedConfig);

    const jsWithSlider = ensureSliderVariables(existingJs, mergedConfig);
    jsField.value = replaceBlock(jsWithSlider, JS_BLOCK_START, JS_BLOCK_END, jsBlock);

    cssField.value = replaceBlock(existingCss, CSS_BLOCK_START, CSS_BLOCK_END, cssBlock);

    ['input', 'change'].forEach(type => {
      try {
        jsField.dispatchEvent(new Event(type, { bubbles: true }));
      } catch (_) {}
      try {
        cssField.dispatchEvent(new Event(type, { bubbles: true }));
      } catch (_) {}
    });

    if (status) {
      if (mode === 'manual') {
        status.textContent = "Theme JS & CSS applied. Submitting changes...";
        status.dataset.variant = "pending";
      } else if (mode === 'init') {
        status.textContent = "BillTube theme prepared. Click apply to submit changes.";
        status.dataset.variant = "idle";
      }
    }
    renderPreview(panel, mergedConfig);
    return { config: mergedConfig, jsField, cssField };
  }

  function initPanel(modal){
    if (!canManageChannel()) return false;
    const panel = ensureTab(modal);
    if (!panel || panel.dataset.initialized === "1") return Boolean(panel);

    renderPanel(panel);

    const jsField = ensureField(modal, JS_FIELD_SELECTORS, "chanjs");
    const cssField = ensureField(modal, CSS_FIELD_SELECTORS, "chancss");
    const storedConfig = parseConfig(jsField?.value || "");
    const cfg = deepMerge(cloneDefaults(), storedConfig || {});
    const storedVersion = Number(cfg.version) || 0;
    cfg.version = DEFAULT_CONFIG.version;

    if (!cfg.slider || typeof cfg.slider !== "object") {
      cfg.slider = cloneDefaults().slider;
    }
    if (typeof cfg.sliderEnabled === "boolean") {
      cfg.slider.enabled = cfg.sliderEnabled;
    }
    if (typeof cfg.sliderJson === "string" && !cfg.slider.feedUrl) {
      cfg.slider.feedUrl = cfg.sliderJson;
    }

    const sliderState = extractSliderSettings(jsField?.value || "");
    if (typeof sliderState.enabled === "boolean") {
      cfg.slider.enabled = sliderState.enabled;
      cfg.sliderEnabled = sliderState.enabled;
    }
    if (typeof sliderState.url !== "undefined") {
      cfg.slider.feedUrl = sliderState.url || "";
      cfg.sliderJson = sliderState.url || "";
    }

    let initializing = true;
    updateInputs(panel, cfg);
    initializing = false;

    let dirty = false;
    const status = panel.querySelector('#btfw-theme-status');

    const markDirty = () => {
      if (initializing) return;
      const latest = collectConfig(panel, cfg);
      overwriteConfig(cfg, latest);
      renderPreview(panel, cfg);
      dirty = true;
      if (status) {
        status.textContent = "Changes pending. Click Apply to sync with Channel JS/CSS.";
        status.dataset.variant = "idle";
      }
    };

    // Bind events
    const colorInputs = panel.querySelectorAll('input[type="color"]');
    colorInputs.forEach(input => input.addEventListener('input', markDirty));

    const fontPresetSelect = panel.querySelector('#btfw-font-preset');
    const customFontInput = panel.querySelector('#btfw-custom-font');
    const customFontContainer = panel.querySelector('.btfw-custom-font');

    if (fontPresetSelect) {
      fontPresetSelect.addEventListener('change', (e) => {
        const isCustom = e.target.value === 'custom';
        if (customFontContainer) {
          customFontContainer.style.display = isCustom ? 'block' : 'none';
        }
        markDirty();
      });
    }

    if (customFontInput) {
      customFontInput.addEventListener('input', markDirty);
    }

    const textInputs = panel.querySelectorAll('input[type="text"], input[type="url"]');
    textInputs.forEach(input => input.addEventListener('input', markDirty));

    const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(input => input.addEventListener('change', markDirty));

    const applyBtn = panel.querySelector('#btfw-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        applyTheme(panel, cfg, 'manual');
        dirty = false;
      });
    }

    const resetBtn = panel.querySelector('#btfw-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const defaults = cloneDefaults();
        overwriteConfig(cfg, defaults);
        updateInputs(panel, cfg);
        renderPreview(panel, cfg);
        dirty = true;
        if (status) {
          status.textContent = "Reset to defaults. Click Apply to save changes.";
          status.dataset.variant = "idle";
        }
      });
    }

    // Add CSS for the admin panel
    if (!document.getElementById('btfw-theme-admin-styles')) {
      const styles = document.createElement('style');
      styles.id = 'btfw-theme-admin-styles';
      styles.textContent = `
        .btfw-theme-admin { padding: 1rem; max-width: 600px; }
        .btfw-theme-header { margin-bottom: 1.5rem; }
        .btfw-theme-header h3 { margin: 0 0 0.5rem; font-size: 1.25rem; }
        .btfw-theme-header p { margin: 0; opacity: 0.8; }
        .btfw-sections { display: flex; flex-direction: column; gap: 1.5rem; }
        .btfw-section h4 { margin: 0 0 1rem; font-size: 1rem; font-weight: 600; }
        .btfw-color-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; }
        .btfw-color-item { display: flex; flex-direction: column; gap: 0.5rem; }
        .btfw-color-item label { font-size: 0.875rem; font-weight: 500; }
        .btfw-color-item input[type="color"] { width: 100%; height: 40px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }
        .btfw-control { margin-bottom: 1rem; }
        .btfw-control label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
        .btfw-control input, .btfw-control select { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
        .btfw-checkbox { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
        .btfw-checkbox input[type="checkbox"] { width: auto; }
        .btfw-actions { display: flex; gap: 1rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; }
        .btfw-btn { padding: 0.75rem 1.5rem; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
        .btfw-btn-primary { background: #007bff; color: white; }
        .btfw-btn-primary:hover { background: #0056b3; }
        .btfw-btn-secondary { background: #6c757d; color: white; }
        .btfw-btn-secondary:hover { background: #545b62; }
        .btfw-status { margin-top: 1rem; padding: 0.75rem; border-radius: 4px; font-size: 0.875rem; }
        .btfw-status[data-variant="idle"] { background: #e7f3ff; color: #0056b3; }
        .btfw-status[data-variant="pending"] { background: #fff3cd; color: #856404; }
        .btfw-status[data-variant="error"] { background: #f8d7da; color: #721c24; }
      `;
      document.head.appendChild(styles);
    }

    if (storedConfig) {
      applyTheme(panel, cfg, 'init');
      if (status && !dirty) {
        status.textContent = "Theme settings loaded. No changes applied yet.";
        status.dataset.variant = "idle";
      }
    } else if (status && !dirty) {
      status.textContent = "Theme settings loaded. No changes applied yet.";
      status.dataset.variant = "idle";
    }

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