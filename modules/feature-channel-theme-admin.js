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
    "#cs-jstext",
    "#chanjs", "#channel-js", "#channeljs", "#customjs", "#customJS",
    "textarea[name=chanjs]", "textarea[name=channeljs]",
    "textarea[data-setting='customJS']", "textarea[data-setting='chanjs']"
  ];

  const CSS_FIELD_SELECTORS = [
    "#cs-csstext",
    "#chancss", "#channel-css", "#channelcss", "#customcss", "#customCSS",
    "textarea[name=chancss]", "textarea[name=channelcss]",
    "textarea[data-setting='customCSS']", "textarea[data-setting='chancss']"
  ];

  const DEFAULT_CONFIG = {
    version: 4,
    tint: "midnight",
    colors: {
      background: "#05060d",
      surface: "#0b111d",
      panel: "#141f36",
      text: "#e8ecfb",
      chatText: "#d4defd",
      accent: "#6d4df6"
    },
    slider: {
      enabled: false,
      feedUrl: ""
    },
    typography: {
      preset: "inter",
      customFamily: ""
    },
    integrations: {
      tmdb: {
        apiKey: ""
      }
    },
    resources: {
      scripts: [],
      styles: []
    },
    branding: {
      headerName: "CyTube",
      faviconUrl: ""
    }
  };

  const TINT_PRESETS = {
    midnight: {
      name: "Midnight Pulse",
      colors: {
        background: "#05060d",
        surface: "#0b111d",
        panel: "#141f36",
        text: "#e8ecfb",
        chatText: "#d4defd",
        accent: "#6d4df6"
      }
    },
    aurora: {
      name: "Aurora Bloom",
      colors: {
        background: "#02121c",
        surface: "#071b28",
        panel: "#10273b",
        text: "#e9fbff",
        chatText: "#d0ebff",
        accent: "#4dd0f6"
      }
    },
    sunset: {
      name: "Sunset Neon",
      colors: {
        background: "#13030c",
        surface: "#1b0813",
        panel: "#26101d",
        text: "#ffe7f1",
        chatText: "#ffcade",
        accent: "#ff6b9d"
      }
    },
    ember: {
      name: "Ember Forge",
      colors: {
        background: "#110802",
        surface: "#190d05",
        panel: "#24140a",
        text: "#fbe3c9",
        chatText: "#f6cea3",
        accent: "#ff914d"
      }
    }
  };

  const FONT_PRESETS = {
    inter: {
      name: "Inter",
      family: "'Inter', 'Segoe UI', sans-serif",
      google: "Inter:wght@300;400;600;700"
    },
    roboto: {
      name: "Roboto",
      family: "'Roboto', 'Segoe UI', sans-serif",
      google: "Roboto:wght@300;400;500;700"
    },
    poppins: {
      name: "Poppins",
      family: "'Poppins', 'Segoe UI', sans-serif",
      google: "Poppins:wght@300;400;600;700"
    },
    montserrat: {
      name: "Montserrat",
      family: "'Montserrat', 'Segoe UI', sans-serif",
      google: "Montserrat:wght@300;400;600;700"
    },
    opensans: {
      name: "Open Sans",
      family: "'Open Sans', 'Segoe UI', sans-serif",
      google: "Open+Sans:wght@300;400;600;700"
    },
    lato: {
      name: "Lato",
      family: "'Lato', 'Segoe UI', sans-serif",
      google: "Lato:wght@300;400;700;900"
    },
    nunito: {
      name: "Nunito",
      family: "'Nunito', 'Segoe UI', sans-serif",
      google: "Nunito:wght@300;400;600;700"
    },
    manrope: {
      name: "Manrope",
      family: "'Manrope', 'Segoe UI', sans-serif",
      google: "Manrope:wght@300;400;600;700"
    },
    outfit: {
      name: "Outfit",
      family: "'Outfit', 'Segoe UI', sans-serif",
      google: "Outfit:wght@300;400;600;700"
    },
    urbanist: {
      name: "Urbanist",
      family: "'Urbanist', 'Segoe UI', sans-serif",
      google: "Urbanist:wght@300;400;600;700"
    }
  };
  const FONT_DEFAULT_ID = "inter";
  const FONT_FALLBACK_FAMILY = FONT_PRESETS[FONT_DEFAULT_ID].family;
  const THEME_FONT_LINK_ID = "btfw-theme-font";

  const STYLE_ID = "btfw-theme-admin-style";

  function injectLocalStyles(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .btfw-theme-admin {
        --btfw-admin-surface: color-mix(in srgb, var(--btfw-theme-panel, #141f36) 92%, transparent 8%);
        --btfw-admin-surface-alt: color-mix(in srgb, var(--btfw-theme-surface, #0b111d) 88%, transparent 12%);
        --btfw-admin-border: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 40%, transparent 60%);
        --btfw-admin-border-soft: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 26%, transparent 74%);
        --btfw-admin-shadow: 0 20px 46px color-mix(in srgb, var(--btfw-theme-bg, #05060d) 55%, transparent 45%);
        --btfw-admin-text: var(--btfw-theme-text, #dce4ff);
        --btfw-admin-text-soft: color-mix(in srgb, var(--btfw-theme-text, #dce4ff) 72%, transparent 28%);
        --btfw-admin-chip: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 28%, transparent 72%);
        padding: 18px 10px 28px;
        color: var(--btfw-admin-text);
        font-family: var(--btfw-font-body, 'Inter', sans-serif);
      }
      .btfw-theme-admin h3 { font-size: 1.12rem; margin: 0 0 12px; letter-spacing: 0.04em; font-weight: 700; }
      .btfw-theme-admin p.lead { margin: 0 0 18px; color: var(--btfw-admin-text-soft); max-width: 720px; }
      .btfw-theme-admin details.section {
        border-radius: 20px;
        border: 1px solid var(--btfw-admin-border-soft);
        margin-bottom: 18px;
        background: linear-gradient(135deg, color-mix(in srgb, var(--btfw-admin-surface) 94%, transparent 6%), color-mix(in srgb, var(--btfw-admin-surface-alt) 88%, transparent 12%));
        box-shadow: var(--btfw-admin-shadow);
        overflow: hidden;
        transition: border 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
      }
      .btfw-theme-admin details.section[open] {
        border-color: var(--btfw-admin-border);
        box-shadow: 0 22px 52px color-mix(in srgb, var(--btfw-theme-bg, #05060d) 58%, transparent 42%);
        background: linear-gradient(135deg, color-mix(in srgb, var(--btfw-admin-surface-alt) 96%, transparent 4%), color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 18%, transparent 82%));
      }
      .btfw-theme-admin summary.section__summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; cursor: pointer; list-style: none; }
      .btfw-theme-admin summary.section__summary::-webkit-details-marker { display: none; }
      .btfw-theme-admin .section__title { display: flex; flex-direction: column; gap: 4px; }
      .btfw-theme-admin .section__title h4 { margin: 0; font-size: 0.95rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--btfw-admin-text); }
      .btfw-theme-admin .section__title span { font-size: 0.84rem; color: var(--btfw-admin-text-soft); letter-spacing: 0.02em; }
      .btfw-theme-admin .section__chevron { width: 28px; height: 28px; border-radius: 10px; border: 1px solid var(--btfw-admin-border-soft); display: inline-flex; align-items: center; justify-content: center; color: var(--btfw-admin-text-soft); font-size: 0.78rem; transition: transform 0.24s ease, border 0.18s ease, color 0.18s ease, background 0.18s ease; }
      .btfw-theme-admin details.section[open] .section__chevron { transform: rotate(90deg); color: var(--btfw-admin-text); border-color: var(--btfw-admin-border); background: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 14%, transparent 86%); }
      .btfw-theme-admin .section__body { padding: 0 20px 20px; display: flex; flex-direction: column; gap: 16px; }
      .btfw-theme-admin .field { display: flex; flex-direction: column; gap: 6px; }
      .btfw-theme-admin label { font-weight: 600; letter-spacing: 0.03em; color: color-mix(in srgb, var(--btfw-admin-text) 92%, transparent 8%); }
      .btfw-theme-admin .btfw-checkbox { display: inline-flex; gap: 10px; align-items: center; font-weight: 600; color: color-mix(in srgb, var(--btfw-admin-text) 92%, transparent 8%); }
      .btfw-theme-admin .btfw-checkbox input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--btfw-theme-accent, #6d4df6); }
      .btfw-theme-admin .field.is-disabled label,
      .btfw-theme-admin .field.is-disabled .help { opacity: 0.55; }
      .btfw-theme-admin input[type="text"],
      .btfw-theme-admin input[type="url"],
      .btfw-theme-admin textarea,
      .btfw-theme-admin select {
        width: 100%;
        background: color-mix(in srgb, var(--btfw-admin-surface-alt) 92%, transparent 8%);
        border: 1px solid var(--btfw-admin-border-soft);
        border-radius: 12px;
        padding: 10px 12px;
        color: color-mix(in srgb, var(--btfw-admin-text) 98%, white 2%);
        font-size: 0.95rem;
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--btfw-theme-bg, #05060d) 14%, transparent 86%);
        transition: border 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
      }
      .btfw-theme-admin input[type="text"]:focus,
      .btfw-theme-admin input[type="url"]:focus,
      .btfw-theme-admin textarea:focus,
      .btfw-theme-admin select:focus { border-color: var(--btfw-theme-accent, #6d4df6); box-shadow: 0 0 0 2px color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 22%, transparent 78%); outline: none; }
      .btfw-theme-admin .field.is-disabled input,
      .btfw-theme-admin .field.is-disabled textarea,
      .btfw-theme-admin .field.is-disabled select { opacity: 0.55; }
      .btfw-theme-admin input[type="color"] { width: 100%; height: 44px; padding: 0; border-radius: 12px; border: 1px solid var(--btfw-admin-border); background: var(--btfw-admin-surface-alt); cursor: pointer; }
      .btfw-theme-admin .help { font-size: 0.82rem; color: var(--btfw-admin-text-soft); line-height: 1.5; }
      .btfw-theme-admin .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
      .btfw-theme-admin .preview { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 16px; padding: 18px; border-radius: 16px; background: linear-gradient(135deg, color-mix(in srgb, var(--btfw-admin-surface-alt) 94%, transparent 6%), color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 16%, transparent 84%)); box-shadow: inset 0 1px 0 color-mix(in srgb, var(--btfw-admin-border) 20%, transparent 80%); }
      .btfw-theme-admin .preview__main { display: flex; flex-direction: column; gap: 10px; }
      .btfw-theme-admin .preview__chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px,1fr)); gap: 8px; }
      .btfw-theme-admin .preview__chip { padding: 10px; border-radius: 10px; background: var(--btfw-admin-chip); color: color-mix(in srgb, var(--btfw-admin-text) 96%, white 4%); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; }
      .btfw-theme-admin .preview__accent { display: inline-flex; align-items: center; justify-content: center; padding: 10px 14px; border-radius: 999px; font-weight: 700; letter-spacing: 0.08em; color: color-mix(in srgb, var(--btfw-admin-text) 98%, white 2%); background: var(--btfw-theme-accent, #6d4df6); box-shadow: 0 10px 24px color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 32%, transparent 68%); }
      .btfw-theme-admin .preview--font { padding: 18px; border-radius: 14px; background: color-mix(in srgb, var(--btfw-admin-surface) 96%, transparent 4%); border: 1px solid var(--btfw-admin-border-soft); box-shadow: inset 0 1px 0 color-mix(in srgb, var(--btfw-theme-bg, #05060d) 18%, transparent 82%); display: flex; flex-direction: column; gap: 8px; }
      .btfw-theme-admin .preview__font-label { font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .preview__font-text { font-size: 1rem; color: var(--btfw-admin-text); }
      .btfw-theme-admin .buttons { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 16px; }
      .btfw-theme-admin .buttons .btn-primary,
      .btfw-theme-admin .buttons .btn-secondary { padding: 10px 18px; border-radius: 12px; border: 0; font-weight: 600; letter-spacing: 0.02em; cursor: pointer; transition: transform 0.16s ease, filter 0.16s ease; }
      .btfw-theme-admin .buttons .btn-primary { background: linear-gradient(135deg, color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 90%, white 10%), color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 68%, transparent 32%)); color: color-mix(in srgb, var(--btfw-admin-text) 98%, white 2%); }
      .btfw-theme-admin .buttons .btn-secondary { background: color-mix(in srgb, var(--btfw-admin-surface-alt) 90%, transparent 10%); color: var(--btfw-admin-text); border: 1px solid var(--btfw-admin-border-soft); }
      .btfw-theme-admin .buttons .btn-primary:hover,
      .btfw-theme-admin .buttons .btn-secondary:hover { filter: brightness(1.05); transform: translateY(-1px); }
      .btfw-theme-admin .buttons .btn-secondary:hover { border-color: var(--btfw-admin-border); }
      .btfw-theme-admin .status { font-size: 0.82rem; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .integrations-callout { padding: 12px 14px; border-radius: 14px; background: color-mix(in srgb, var(--btfw-admin-surface-alt) 94%, transparent 6%); border: 1px dashed var(--btfw-admin-border-soft); display: flex; flex-direction: column; gap: 6px; font-size: 0.86rem; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .integrations-callout strong { color: var(--btfw-admin-text); }
      @media (max-width: 720px) {
        .btfw-theme-admin { padding: 14px 6px 24px; }
        .btfw-theme-admin summary.section__summary { padding: 16px; }
        .btfw-theme-admin .section__body { padding: 0 16px 16px; }
        .btfw-theme-admin .grid { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeFontId(id){
    if (!id) return FONT_DEFAULT_ID;
    const str = String(id).trim().toLowerCase();
    if (str === "custom") return "custom";
    return str.replace(/[^a-z0-9]+/g, "");
  }

  function getFontPreset(id){
    const key = normalizeFontId(id);
    if (key === "custom") return null;
    return FONT_PRESETS[key] || null;
  }

  function buildGoogleFontUrl(name){
    if (!name) return "";
    const trimmed = name.trim();
    if (!trimmed) return "";
    const encoded = trimmed.replace(/\s+/g, "+");
    return `https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;600;700&display=swap`;
  }

  function resolveTypographyConfig(typo){
    const presetId = normalizeFontId(typo?.preset || FONT_DEFAULT_ID);
    const isCustom = presetId === "custom";
    const preset = getFontPreset(presetId) || getFontPreset(FONT_DEFAULT_ID);
    const customName = (typo?.customFamily || "").trim();
    const family = isCustom && customName
      ? `'${customName.replace(/'/g, "\\'")}', ${FONT_FALLBACK_FAMILY}`
      : (preset?.family || FONT_FALLBACK_FAMILY);
    let url = preset?.google
      ? `https://fonts.googleapis.com/css2?family=${preset.google}&display=swap`
      : "";
    if (isCustom && customName) {
      url = buildGoogleFontUrl(customName);
    }
    return {
      preset: isCustom ? "custom" : (preset ? normalizeFontId(presetId) : FONT_DEFAULT_ID),
      label: isCustom && customName ? customName : (preset?.name || "Inter"),
      family,
      url: url || ""
    };
  }

  function ensureStylesheetLink(id, url){
    if (!document.head) return;
    let link = document.getElementById(id);
    if (url) {
      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      if (link.getAttribute("href") !== url) {
        link.setAttribute("href", url);
      }
    } else if (link && link.parentElement) {
      link.parentElement.removeChild(link);
    }
  }

  function applyLiveTypographyAssets(typography){
    const resolved = resolveTypographyConfig(typography);
    const root = document.documentElement;
    if (root && resolved.family) {
      root.style.setProperty("--btfw-theme-font-family", resolved.family);
    }
    ensureStylesheetLink(THEME_FONT_LINK_ID, resolved.url || "");
    return resolved;
  }

  function cloneDefaults(){
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  function overwriteConfig(target, source){
    if (!target || typeof target !== "object") return target;
    Object.keys(target).forEach(key => {
      delete target[key];
    });
    if (!source || typeof source !== "object") return target;
    const copy = JSON.parse(JSON.stringify(source));
    Object.keys(copy).forEach(key => {
      target[key] = copy[key];
    });
    return target;
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
    const normalized = cloneDefaults();
    deepMerge(normalized, cfg || {});
    if (!normalized.slider || typeof normalized.slider !== "object") {
      normalized.slider = cloneDefaults().slider;
    }
    const slider = normalized.slider || {};
    normalized.sliderEnabled = Boolean(slider.enabled);
    normalized.sliderJson = slider.feedUrl || slider.url || "";

    const json = JSON.stringify(normalized, null, 2);
    return `\n${JS_BLOCK_START}\nwindow.BTFW_THEME_ADMIN = ${json};\n(function(cfg){\n  if (!cfg) return;\n  window.BTFW = window.BTFW || {};\n  window.BTFW.channelTheme = cfg;\n  const FONT_PRESETS = {"inter":{"name":"Inter","family":"'Inter', 'Segoe UI', sans-serif","google":"Inter:wght@300;400;600;700"},"roboto":{"name":"Roboto","family":"'Roboto', 'Segoe UI', sans-serif","google":"Roboto:wght@300;400;500;700"},"poppins":{"name":"Poppins","family":"'Poppins', 'Segoe UI', sans-serif","google":"Poppins:wght@300;400;600;700"},"montserrat":{"name":"Montserrat","family":"'Montserrat', 'Segoe UI', sans-serif","google":"Montserrat:wght@300;400;600;700"},"opensans":{"name":"Open Sans","family":"'Open Sans', 'Segoe UI', sans-serif","google":"Open+Sans:wght@300;400;600;700"},"lato":{"name":"Lato","family":"'Lato', 'Segoe UI', sans-serif","google":"Lato:wght@300;400;700;900"},"nunito":{"name":"Nunito","family":"'Nunito', 'Segoe UI', sans-serif","google":"Nunito:wght@300;400;600;700"},"manrope":{"name":"Manrope","family":"'Manrope', 'Segoe UI', sans-serif","google":"Manrope:wght@300;400;600;700"},"outfit":{"name":"Outfit","family":"'Outfit', 'Segoe UI', sans-serif","google":"Outfit:wght@300;400;600;700"},"urbanist":{"name":"Urbanist","family":"'Urbanist', 'Segoe UI', sans-serif","google":"Urbanist:wght@300;400;600;700"}};\n  const FONT_FALLBACK = "'Inter', 'Segoe UI', sans-serif";\n  function ensureAsset(id, url, kind){\n    if (!url) return;\n    var existing = document.getElementById(id);\n    if (existing) return;\n    if (kind === 'style'){\n      var link = document.createElement('link');\n      link.rel = 'stylesheet';\n      link.href = url;\n      link.id = id;\n      document.head.appendChild(link);\n    } else {\n      var script = document.createElement('script');\n      script.src = url;\n      script.async = true;\n      script.defer = true;\n      script.id = id;\n      document.head.appendChild(script);\n    }\n  }\n  function applyResources(resources){\n    if (!resources) return;\n    if (Array.isArray(resources.styles)) {\n      resources.styles.forEach(function(url, idx){ ensureAsset('btfw-theme-style-'+idx, url, 'style'); });\n    }\n    if (Array.isArray(resources.scripts)) {\n      resources.scripts.forEach(function(url, idx){ ensureAsset('btfw-theme-script-'+idx, url, 'script'); });\n    }\n  }\n  function applySlider(sliderCfg){\n    sliderCfg = sliderCfg || {};
    if (typeof sliderCfg.enabled === 'undefined' && typeof cfg.sliderEnabled !== 'undefined') {
      sliderCfg.enabled = cfg.sliderEnabled;
    }
    if (!sliderCfg.feedUrl && cfg.sliderJson) {
      sliderCfg.feedUrl = cfg.sliderJson;
    }
    var enabled = Boolean(sliderCfg.enabled);
    var feed = sliderCfg.feedUrl || sliderCfg.url || '';
    cfg.slider = cfg.slider || {};
    cfg.slider.enabled = enabled;
    cfg.slider.feedUrl = feed;
    cfg.sliderEnabled = enabled;
    cfg.sliderJson = feed;
    window.BTFW.channelSlider = { enabled: enabled, feedUrl: feed };
    window.BTFW.channelSliderEnabled = enabled;
    window.BTFW.channelSliderJSON = feed;
    window.UI_ChannelList = enabled ? 1 : 0;
    window.Channel_JSON = feed || '';
  }
  function applyBranding(branding){
    branding = branding || {};
    var name = typeof branding.headerName === 'string' ? branding.headerName.trim() : '';
    if (!name && typeof cfg.branding?.headerName === 'string') {
      name = cfg.branding.headerName.trim();
    }
    if (!name && typeof cfg.headerName === 'string') {
      name = cfg.headerName.trim();
    }
    if (!name) name = 'CyTube';
    cfg.branding = cfg.branding || {};
    cfg.branding.headerName = name;
    var brandSelectors = [
      '#nav-collapsible .navbar-brand',
      '.navbar .navbar-brand',
      '.navbar-brand',
      '#navbrand'
    ];
    brandSelectors.forEach(function(sel){
      var anchor = document.querySelector(sel);
      if (!anchor) return;
      var holder = anchor.querySelector('[data-btfw-brand-text]');
      if (holder) {
        holder.textContent = name;
      } else {
        var replaced = false;
        var nodes = Array.prototype.slice.call(anchor.childNodes || []);
        nodes.forEach(function(node){
          if (node && node.nodeType === 3) {
            var text = (node.textContent || '').trim();
            if (!text) return;
            if (!replaced) {
              node.textContent = name;
              replaced = true;
            } else {
              node.textContent = '';
            }
          }
        });
        if (!replaced) {
          holder = document.createElement('span');
          holder.dataset.btfwBrandText = '1';
          if (anchor.childNodes.length > 0) {
            anchor.appendChild(document.createTextNode(' '));
          }
          holder.textContent = name;
          anchor.appendChild(holder);
        }
      }
      anchor.setAttribute('title', name);
      anchor.setAttribute('aria-label', name);
    });

    var faviconUrl = typeof branding.faviconUrl === 'string' ? branding.faviconUrl.trim() : '';
    if (!faviconUrl && typeof cfg.branding?.faviconUrl === 'string') {
      faviconUrl = cfg.branding.faviconUrl.trim();
    }
    cfg.branding.faviconUrl = faviconUrl || '';
    if (faviconUrl) {
      var linkSelectors = 'link[rel*="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]';
      var links = Array.prototype.slice.call(document.querySelectorAll(linkSelectors));
      if (!links.length) {
        var created = document.createElement('link');
        created.rel = 'icon';
        document.head.appendChild(created);
        links.push(created);
      }
      links.forEach(function(link){
        try { link.href = faviconUrl; } catch (_) {}
      });
    }
  }
  function applyIntegrations(integrations){
    integrations = integrations || {};
    cfg.integrations = cfg.integrations || {};
    if (!cfg.integrations.tmdb || typeof cfg.integrations.tmdb !== 'object') {
      cfg.integrations.tmdb = { apiKey: '' };
    }
    var tmdb = integrations.tmdb || cfg.integrations.tmdb || {};
    var key = typeof tmdb.apiKey === 'string' ? tmdb.apiKey.trim() : '';
    cfg.integrations.tmdb.apiKey = key;
    window.BTFW_CONFIG = window.BTFW_CONFIG || {};
    if (typeof window.BTFW_CONFIG.tmdb !== 'object') window.BTFW_CONFIG.tmdb = {};
    window.BTFW_CONFIG.tmdb.apiKey = key;
    window.BTFW_CONFIG.tmdbKey = key;
    try { if (document.body) document.body.dataset.tmdbKey = key; } catch (_) {}
  }
  function applyColors(colors){
    colors = colors || {};
    var root = document.documentElement;
    if (!root) return;
    var bg = colors.background || '#05060d';
    var surface = colors.surface || colors.panel || '#0b111d';
    var panel = colors.panel || '#141f36';
    var text = colors.text || '#e8ecfb';
    var chatText = colors.chatText || text;
    var accent = colors.accent || '#6d4df6';
    cfg.colors = cfg.colors || {};
    cfg.colors.background = bg;
    cfg.colors.surface = surface;
    cfg.colors.panel = panel;
    cfg.colors.text = text;
    cfg.colors.chatText = chatText;
    cfg.colors.accent = accent;
    var map = {
      '--btfw-theme-bg': bg,
      '--btfw-theme-surface': surface,
      '--btfw-theme-panel': panel,
      '--btfw-theme-text': text,
      '--btfw-theme-chat-text': chatText,
      '--btfw-theme-accent': accent
    };
    Object.keys(map).forEach(function(key){
      if (map[key]) {
        root.style.setProperty(key, map[key]);
      }
    });
    root.setAttribute('data-btfw-theme-tint', cfg.tint || 'custom');
    try {
      document.dispatchEvent(new CustomEvent('btfw:channelThemeTint', {
        detail: { tint: cfg.tint || 'custom', colors: { bg: bg, surface: surface, panel: panel, text: text, chat: chatText, accent: accent }, config: cfg }
      }));
    } catch (_) {}
  }

  function resolveFont(typography){
    typography = typography || {};
    var preset = (typography.preset || 'inter').toLowerCase();
    if (preset === 'custom') {
      var name = (typography.customFamily || '').trim();
      var family = name ? "'" + name.replace(/'/g, \"\'\") + "', " + FONT_FALLBACK : FONT_FALLBACK;
      var url = name ? 'https://fonts.googleapis.com/css2?family=' + name.replace(/\s+/g, '+') + ':wght@300;400;600;700&display=swap' : '';
      return { family: family, url: url, label: name || 'Custom' };
    }
    var meta = FONT_PRESETS[preset] || FONT_PRESETS['inter'];
    var family = meta ? meta.family : FONT_FALLBACK;
    var url = meta && meta.google ? 'https://fonts.googleapis.com/css2?family=' + meta.google + '&display=swap' : '';
    return { family: family, url: url, label: (meta && meta.name) || 'Inter' };
  }
  function applyTypography(typography){
    var resolved = resolveFont(typography);
    var root = document.documentElement;
    if (root && resolved.family) {
      root.style.setProperty('--btfw-theme-font-family', resolved.family);
    }
    var existing = document.getElementById('btfw-theme-font');
    if (resolved.url) {
      if (existing && existing.tagName === 'LINK') {
        if (existing.href !== resolved.url) existing.href = resolved.url;
      } else {
        ensureAsset('btfw-theme-font', resolved.url, 'style');
      }
    } else if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    cfg.typography = cfg.typography || {};
    cfg.typography.resolvedFamily = resolved.family;
  }
  applyResources(cfg.resources);
  applySlider(cfg.slider || {});
  applyBranding(cfg.branding || {});
  applyColors(cfg.colors || {});
  applyIntegrations(cfg.integrations || {});
  applyTypography(cfg.typography || {});
})(window.BTFW_THEME_ADMIN);\n${JS_BLOCK_END}`;

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
    preview.style.background = `linear-gradient(160deg, ${colors.background || "#05060d"}, ${colors.surface || colors.panel || "#0b111d"})`;
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

    const fontPreview = panel.querySelector('.preview--font');
    if (fontPreview) {
      if (typography.family) {
        fontPreview.style.fontFamily = typography.family;
      }
      const nameNode = fontPreview.querySelector('[data-role="font-name"]');
      if (nameNode) {
        nameNode.textContent = typography.label || 'Inter';
      }
      const sampleNode = fontPreview.querySelector('[data-role="font-sample"]');
      if (sampleNode) {
        sampleNode.style.fontFamily = typography.family || FONT_FALLBACK_FAMILY;
      }
    }
  }

  function updateSliderFieldState(panel){
    const toggle = panel.querySelector('#btfw-theme-slider-enabled');
    const input = panel.querySelector('#btfw-theme-slider-json');
    if (!toggle || !input) return;
    const enabled = Boolean(toggle.checked);
    input.disabled = !enabled;
    const field = input.closest('.field');
    if (field) {
      field.classList.toggle('is-disabled', !enabled);
    }
  }

  function updateTypographyFieldState(panel){
    const select = panel.querySelector('#btfw-theme-font');
    const field = panel.querySelector('#btfw-theme-font-custom-field');
    const input = panel.querySelector('#btfw-theme-font-custom');
    const isCustom = (select?.value || '').toLowerCase() === 'custom';
    if (input) {
      input.disabled = !isCustom;
    }
    if (field) {
      field.classList.toggle('is-disabled', !isCustom);
    }
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
    updateTypographyFieldState(panel);
    updateSliderFieldState(panel);
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
        if (typeof value === "string") {
          value = value.trim();
        }
      }
      setValueAtPath(updated, path, value);
    });
    if (!updated.slider || typeof updated.slider !== "object") {
      updated.slider = cloneDefaults().slider;
    }
    updated.sliderEnabled = Boolean(updated.slider?.enabled);
    updated.sliderJson = updated.slider?.feedUrl || "";
    if (!updated.integrations || typeof updated.integrations !== "object") {
      updated.integrations = cloneDefaults().integrations;
    }
    if (!updated.integrations.tmdb || typeof updated.integrations.tmdb !== "object") {
      updated.integrations.tmdb = { apiKey: "" };
    }
    updated.integrations.tmdb.apiKey = (updated.integrations.tmdb.apiKey || "").trim();
    if (!updated.typography || typeof updated.typography !== "object") {
      updated.typography = cloneDefaults().typography;
    }
    const typo = updated.typography || {};
    typo.preset = normalizeFontId(typo.preset || FONT_DEFAULT_ID);
    if (typo.preset !== 'custom') {
      typo.customFamily = '';
    } else {
      typo.customFamily = (typo.customFamily || '').trim();
    }
    updated.typography = {
      preset: typo.preset,
      customFamily: typo.customFamily || ''
    };
    updated.version = DEFAULT_CONFIG.version;
    return updated;
  }

  function triggerChannelSubmit(modal, jsField, cssField){
    const roots = [];
    if (modal) roots.push(modal);
    roots.push(document);

    const selectors = [
      '#cs-jssubmit',
      '#cs-csssubmit',
      "button[name='save-js']",
      "button[name='save-css']",
      "button[data-action='save-js']",
      "button[data-action='save-css']"
    ];

    const clicked = new Set();
    selectors.forEach(sel => {
      roots.forEach(root => {
        if (!root) return;
        const el = root.querySelector(sel);
        if (!el || clicked.has(el) || typeof el.click !== 'function') return;
        try {
          el.click();
          clicked.add(el);
        } catch (_) {}
      });
    });

    let submitted = clicked.size > 0;
    const formSet = new Set();
    if (jsField && jsField.form) formSet.add(jsField.form);
    if (cssField && cssField.form) formSet.add(cssField.form);
    formSet.forEach(form => {
      if (!form) return;
      try {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
          submitted = true;
        } else if (typeof form.submit === 'function') {
          form.submit();
          submitted = true;
        }
      } catch (_) {}
    });

    return submitted;
  }

  function extractSliderSettings(jsText){
    if (!jsText) return {};
    const settings = {};
    const enabledMatch = jsText.match(/UI_ChannelList\s*=\s*(['"]?)([01])\1/);
    if (enabledMatch) {
      settings.enabled = enabledMatch[2] === '1';
    }
    const urlMatch = jsText.match(/Channel_JSON\s*=\s*(['"`])([^'"`]*?)\1/);
    if (urlMatch) {
      settings.url = urlMatch[2].trim();
    }
    return settings;
  }

  function ensureSliderVariables(jsText, cfg){
    const sliderCfg = cfg.slider || {};
    const enabledValue = (typeof sliderCfg.enabled === 'boolean' ? sliderCfg.enabled : cfg.sliderEnabled) ? '1' : '0';
    const rawUrl = sliderCfg.feedUrl || cfg.sliderJson || '';
    const sliderUrl = typeof rawUrl === 'string' ? rawUrl : String(rawUrl || '');
    const escapedUrl = sliderUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    let updated = jsText || '';

    let sliderUpdated = false;
    updated = updated.replace(/(UI_ChannelList\s*=\s*)(['"]?)([01])\2/g, (match, prefix, quote) => {
      sliderUpdated = true;
      const q = quote || '';
      return `${prefix}${q}${enabledValue}${q}`;
    });
    updated = updated.replace(/(window\.UI_ChannelList\s*=\s*)(['"]?)([01])\2/g, (match, prefix, quote) => {
      sliderUpdated = true;
      const q = quote || '';
      return `${prefix}${q}${enabledValue}${q}`;
    });

    let jsonUpdated = false;
    updated = updated.replace(/(Channel_JSON\s*=\s*)(['"`])([^'"`]*?)\2/g, (match, prefix) => {
      jsonUpdated = true;
      return `${prefix}'${escapedUrl}'`;
    });
    updated = updated.replace(/(window\.Channel_JSON\s*=\s*)(['"`])([^'"`]*?)\2/g, (match, prefix) => {
      jsonUpdated = true;
      return `${prefix}'${escapedUrl}'`;
    });

    if (!sliderUpdated || !jsonUpdated) {
      const leadingMatch = updated.match(/^\s*/);
      const leading = leadingMatch ? leadingMatch[0] : '';
      let body = updated.slice(leading.length);
      body = body.replace(/^\s*\n/, '');
      const lines = [];
      if (!sliderUpdated) {
        lines.push(`var UI_ChannelList = ${enabledValue};`);
      }
      if (!jsonUpdated) {
        lines.push(`var Channel_JSON = '${escapedUrl}';`);
      }
      const prefixBlock = lines.length ? lines.join('\n') + '\n' : '';
      updated = leading + prefixBlock + body;
    }

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
      tabContainer.appendChild(panel);
    }

    const activate = () => {
      const activeClass = nav.classList.contains("tabs") ? "is-active" : "active";
      $$('li', nav).forEach(li => li.classList.remove("active", "is-active"));
      tab.classList.add(activeClass);
      $$(".tab-pane", tabContainer).forEach(p => {
        p.classList.remove("active", "in", "show");
      });
      panel.classList.add("active", "in", "show");
    };

    const deactivate = () => {
      panel.classList.remove("active", "in", "show");

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
        <p class="lead">Configure your BillTube channel's featured media, theme palette, typography, and resources without editing raw Channel JS or CSS.</p>

        <details class="section" data-section="resources" open>
          <summary class="section__summary">
            <div class="section__title">
              <h4>Featured Content & Resources</h4>
              <span>Manage the featured slider feed and extra theme assets.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="field">
              <label class="btfw-checkbox" for="btfw-theme-slider-enabled">
                <input type="checkbox" id="btfw-theme-slider-enabled" data-btfw-bind="slider.enabled">
                <span>Enable featured slider</span>
              </label>
              <p class="help">Toggles the channel list carousel by setting <code>UI_ChannelList</code> in Channel JS.</p>
            </div>
            <div class="field">
              <label for="btfw-theme-slider-json">Featured slider JSON</label>
              <input type="url" id="btfw-theme-slider-json" data-btfw-bind="slider.feedUrl" placeholder="https://example.com/featured.json">
              <p class="help">Paste the URL to the JSON feed used by the channel slider.</p>
            </div>
            <div class="field">
              <label for="btfw-theme-css-urls">Additional CSS URLs</label>
              <textarea id="btfw-theme-css-urls" data-btfw-bind="resources.styles" placeholder="https://example.com/theme.css"></textarea>
              <p class="help">Each line becomes a stylesheet link injected before the theme renders.</p>
            </div>
            <div class="field">
              <label for="btfw-theme-js-urls">Additional Script URLs</label>
              <textarea id="btfw-theme-js-urls" data-btfw-bind="resources.scripts" placeholder="https://example.com/widget.js"></textarea>
              <p class="help">Each line becomes a deferred script tag for optional widgets or behavior.</p>
            </div>
          </div>
        </details>

        <details class="section" data-section="integrations" open>
          <summary class="section__summary">
            <div class="section__title">
              <h4>Integrations</h4>
              <span>Connect API keys used by chat tools and commands.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="integrations-callout">
              <strong>TMDB API key</strong>
              <span>Required for the <code>!summary</code> command to fetch movie metadata. Request a key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org</a>.</span>
            </div>
            <div class="field">
              <label for="btfw-theme-integrations-tmdb">TMDB API key</label>
              <input type="text" id="btfw-theme-integrations-tmdb" data-btfw-bind="integrations.tmdb.apiKey" placeholder="YOUR_TMDB_KEY">
            </div>
          </div>
        </details>

        <details class="section" data-section="palette" open>
          <summary class="section__summary">
            <div class="section__title">
              <h4>Palette & Tint</h4>
              <span>Adjust surface colors and accent tint.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="field">
              <label for="btfw-theme-tint">Preset tint</label>
              <select id="btfw-theme-tint" data-btfw-bind="tint">
                <option value="midnight">Midnight Pulse</option>
                <option value="aurora">Aurora Bloom</option>
                <option value="sunset">Sunset Neon</option>
                <option value="ember">Ember Forge</option>
                <option value="custom">Custom mix</option>
              </select>
              <p class="help">Choose a curated palette to start from, then fine-tune any swatch.</p>
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
        </details>

        <details class="section" data-section="typography" open>
          <summary class="section__summary">
            <div class="section__title">
              <h4>Typography</h4>
              <span>Select the base font used across the theme.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="field">
              <label for="btfw-theme-font">Font preset</label>
              <select id="btfw-theme-font" data-btfw-bind="typography.preset">
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
                <option value="custom">Custom Google Font</option>
              </select>
              <p class="help">Curated Google Fonts optimized for readability. Choose <em>Custom</em> to specify your own.</p>
            </div>
            <div class="field" id="btfw-theme-font-custom-field">
              <label for="btfw-theme-font-custom">Custom Google font name</label>
              <input type="text" id="btfw-theme-font-custom" data-btfw-bind="typography.customFamily" placeholder="Space Grotesk">
              <p class="help">Enter the exact family name from Google Fonts. We load weights 300, 400, 600, and 700 automatically.</p>
            </div>
            <div class="preview preview--font" aria-hidden="true">
              <div class="preview__font-label" data-role="font-name">Inter</div>
              <p class="preview__font-text" data-role="font-sample">The quick brown fox jumps over the lazy dog.</p>
            </div>
          </div>
        </details>

        <details class="section" data-section="branding">
          <summary class="section__summary">
            <div class="section__title">
              <h4>Branding</h4>
              <span>Navbar title and favicon overrides.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="field">
              <label for="btfw-theme-header-name">Channel header name</label>
              <input type="text" id="btfw-theme-header-name" data-btfw-bind="branding.headerName" placeholder="CyTube">
              <p class="help">Replaces the navbar brand text for all visitors.</p>
            </div>
            <div class="field">
              <label for="btfw-theme-favicon">Favicon URL</label>
              <input type="url" id="btfw-theme-favicon" data-btfw-bind="branding.faviconUrl" placeholder="https://example.com/favicon.png">
              <p class="help">Provide a full URL to the icon browsers should show in the tab bar.</p>
            </div>
          </div>
        </details>

        <div class="buttons">
          <button type="button" class="btn-primary" id="btfw-theme-apply">Apply to Channel CSS &amp; JS</button>
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
        if (input.id === 'btfw-theme-slider-enabled') {
          updateSliderFieldState(panel);
        }
        if (input.dataset.btfwBind.startsWith("typography")) {
          if (input.id === 'btfw-theme-font-custom') {
            const fontSelect = panel.querySelector('#btfw-theme-font');
            if (fontSelect && fontSelect.value !== 'custom') {
              fontSelect.value = 'custom';
            }
          }
          updateTypographyFieldState(panel);
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
        updateTypographyFieldState(panel);
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

  function applyConfigToFields(panel, cfg, modal, options = {}){
    const mode = options.mode || 'manual';
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
        status.textContent = "Changes pending. Click apply to sync with Channel JS/CSS.";
        status.dataset.variant = "pending";
      }
    };

    watchInputs(panel, cfg, markDirty);

    const applyBtn = panel.querySelector('#btfw-theme-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const latest = collectConfig(panel, cfg);
        overwriteConfig(cfg, latest);
        const result = applyConfigToFields(panel, cfg, modal, { mode: 'manual' });
        if (!result) return;
        dirty = false;
        window.setTimeout(() => {
          const submitted = triggerChannelSubmit(modal, result.jsField, result.cssField);
          if (status) {
            if (submitted) {
              status.textContent = "Theme JS & CSS applied and submitted to CyTube.";
              status.dataset.variant = "saved";
            } else {
              status.textContent = "Theme JS & CSS applied. Save channel settings to publish.";
              status.dataset.variant = "idle";
            }
          }
        }, 60);
      });
    }

    const observer = new MutationObserver(() => {
      const active = panel.classList.contains('active') || panel.style.display === 'block';
      if (active && status && dirty) {
        status.textContent = "Changes pending. Click apply to sync with Channel JS/CSS.";
        status.dataset.variant = "pending";
      }
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['class', 'style'] });

    const existingJs = jsField?.value || "";
    const existingCss = cssField?.value || "";
    const hasJsBlock = existingJs.includes(JS_BLOCK_START) && existingJs.includes(JS_BLOCK_END);
    const hasCssBlock = existingCss.includes(CSS_BLOCK_START) && existingCss.includes(CSS_BLOCK_END);
    const currentVersion = storedVersion;
    let needsInit = !hasJsBlock || !hasCssBlock;
    if (currentVersion < DEFAULT_CONFIG.version) {
      cfg.version = DEFAULT_CONFIG.version;
      needsInit = true;
    }
    if (needsInit) {
      dirty = true;
      if (status) {
        status.textContent = "Theme config needs to be applied. Click Apply to sync with Channel JS/CSS.";
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
