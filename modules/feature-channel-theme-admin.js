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
    "textarea[data-setting='customJS']", "textarea[data-setting='chanjs']",
    "textarea[name='js']", ".channel-js-field"
  ];

  const CSS_FIELD_SELECTORS = [
    "#cs-csstext",
    "#chancss", "#channel-css", "#channelcss", "#customcss", "#customCSS",
    "textarea[name=chancss]", "textarea[name=channelcss]",
    "textarea[data-setting='customCSS']", "textarea[data-setting='chancss']",
    "textarea[name='css']", ".channel-css-field"
  ];

  const DEFAULT_CONFIG = {
    version: 6,
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
      enabled: true,
      tmdb: {
        apiKey: ""
      }
    },
    branding: {
      headerName: "",
      faviconUrl: "",
      posterUrl: ""
    },
    resources: {
      styles: [],
      scripts: [],
      modules: []
    }
  };

  const TINT_PRESETS = {
    midnight: {
      name: "Midnight",
      colors: {
        background: "#05060d",
        surface: "#0b111d",
        panel: "#141f36",
        text: "#e8ecfb",
        chatText: "#d4defd",
        accent: "#6d4df6"
      }
    },
    slate: {
      name: "Slate",
      colors: {
        background: "#0a0e14",
        surface: "#141a24",
        panel: "#1f2937",
        text: "#e5e7eb",
        chatText: "#d1d5db",
        accent: "#3b82f6"
      }
    },
    ocean: {
      name: "Ocean",
      colors: {
        background: "#051923",
        surface: "#003554",
        panel: "#006494",
        text: "#ffffff",
        chatText: "#d4f1f4",
        accent: "#00a8e8"
      }
    },
    forest: {
      name: "Forest",
      colors: {
        background: "#0f1a14",
        surface: "#1a2f23",
        panel: "#2d4a3e",
        text: "#e8f5e9",
        chatText: "#c8e6c9",
        accent: "#66bb6a"
      }
    },
    ember: {
      name: "Ember",
      colors: {
        background: "#1a0a0a",
        surface: "#2d1414",
        panel: "#4a2323",
        text: "#ffe8e8",
        chatText: "#ffd4d4",
        accent: "#ff6b6b"
      }
    },
    custom: {
      name: "Custom",
      colors: {}
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
  const MODULE_FIELD_MIN = 3;
  const MODULE_FIELD_MAX = 10;
  const MODULE_INPUT_SELECTOR = '[data-role="module-inputs"]';

  const LOADER_PATTERNS = [
    /\/\*\s*BillTube[\s\S]*?loader[\s\S]*?\*\//i,
    /\/\/\s*BillTube[\s\S]*?loader/i,
    /https?:\/\/billtube\.github\.io\/BillTube3\//i,
    /billtube-fw\.js/i,
    /\(function\s*\(\s*(?:W\s*,\s*D|window\s*,\s*document)\s*\)\s*\{[\s\S]*?CDN_BASE/i,
  ];

  function findLoaderStart(source){
    if (!source) return -1;
    for (const pattern of LOADER_PATTERNS) {
      const match = pattern.exec(source);
      if (match) {
        let index = match.index;
        if (pattern === LOADER_PATTERNS[2] || pattern === LOADER_PATTERNS[3]) {
          const commentIndex = source.lastIndexOf("/*", index);
          if (commentIndex !== -1 && commentIndex >= index - 200) {
            index = commentIndex;
          }
        }
        const lineStart = source.lastIndexOf("\n", index);
        if (lineStart !== -1) {
          index = lineStart + 1;
        } else {
          index = 0;
        }
        return index;
      }
    }
    return -1;
  }

  function joinSections(parts, ensureTrailingNewline){
    const filtered = (parts || [])
      .map(part => typeof part === "string" ? part : "")
      .filter(part => part.trim().length > 0);
    if (filtered.length === 0) {
      return ensureTrailingNewline ? "\n" : "";
    }
    let joined = filtered.join("\n\n");
    if (ensureTrailingNewline && !joined.endsWith("\n")) {
      joined += "\n";
    }
    return joined;
  }

  function canManageChannel(){
    try {
      return Boolean(
        window.CLIENT && 
        CLIENT.rank >= 3
      );
    } catch (_) {
      return false;
    }
  }

  function ensureTabSystem(modal){
    if (!modal) return { tabContainer: null, contentContainer: null };
    let tabContainer = modal.querySelector('.nav-tabs, ul[role="tablist"], .tabs');
    let contentContainer = modal.querySelector('.tab-content, [role="tabpanel-container"]');
    if (!tabContainer) {
      tabContainer = modal.querySelector('ul');
    }
    if (!contentContainer) {
      contentContainer = modal.querySelector('.modal-body, .settings-body');
    }
    return { tabContainer, contentContainer };
  }

  function ensureField(modal, selectors, fallbackName){
    if (!modal) return null;
    for (const sel of selectors) {
      const field = modal.querySelector(sel);
      if (field) return field;
    }
    const created = document.createElement("textarea");
    created.name = fallbackName;
    created.id = fallbackName;
    created.style.display = "none";
    const body = modal.querySelector('.modal-body, .settings-body') || modal;
    body.appendChild(created);
    return created;
  }

  function triggerChannelSubmit(modal, jsField, cssField){
    if (!modal || !jsField || !cssField) return false;
    const submitBtn = modal.querySelector('button[type="submit"], .btn-primary[form], #submit-channel-settings');
    if (submitBtn && typeof submitBtn.click === "function") {
      submitBtn.click();
      return true;
    }
    const form = modal.querySelector('form');
    if (form && typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return true;
    } else if (form && typeof form.submit === "function") {
      form.submit();
      return true;
    }
    return false;
  }

  function extractSliderSettings(jsText){
    const result = { enabled: undefined, url: undefined };
    if (!jsText || typeof jsText !== "string") return result;
    const uiMatch = jsText.match(/(?:var|let|const)?\s*UI_ChannelList\s*=\s*["']?([^"'\s;]+)["']?/);
    if (uiMatch) {
      const val = uiMatch[1];
      result.enabled = (val === "1" || val === "true" || val === 1 || val === true);
    }
    const jsonMatch = jsText.match(/(?:var|let|const)?\s*Channel_JSON\s*=\s*["']([^"']+)["']/);
    if (jsonMatch) {
      result.url = jsonMatch[1];
    }
    return result;
  }

  function stripLoaderAndAssignments(jsText){
    const source = jsText ? String(jsText) : '';
    if (!source) return '';

    const lines = source.split(/\r?\n/);
    const cleaned = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (/^(?:var|let|const)?\s*UI_ChannelList\s*=/.test(trimmed)) continue;
      if (/^window\.UI_ChannelList\s*=/.test(trimmed)) continue;
      if (/^(?:var|let|const)?\s*Channel_JSON\s*=/.test(trimmed)) continue;
      if (/^window\.Channel_JSON\s*=/.test(trimmed)) continue;
      cleaned.push(line);
    }

    while (cleaned.length && cleaned[0].trim() === '') {
      cleaned.shift();
    }
    for (let i = cleaned.length - 1; i > 0; i--) {
      if (cleaned[i].trim() === '' && cleaned[i - 1].trim() === '') {
        cleaned.splice(i, 1);
      }
    }

    return cleaned.join('\n');
  }

  function normalizeFontId(id){
    if (!id || typeof id !== "string") return FONT_DEFAULT_ID;
    const normalized = id.toLowerCase().replace(/[^a-z0-9]/g, "");
    return FONT_PRESETS[normalized] ? normalized : FONT_DEFAULT_ID;
  }

  function buildGoogleFontUrl(family){
    if (!family) return "";
    const encoded = encodeURIComponent(family.replace(/'/g, ""));
    return `https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;600;700&display=swap`;
  }

  function resolveTypographyConfig(typography){
    const cfg = typography || {};
    const presetId = cfg.preset || FONT_DEFAULT_ID;
    const isCustom = presetId === "custom";
    const preset = isCustom ? null : FONT_PRESETS[normalizeFontId(presetId)];
    const customName = cfg.customFamily ? String(cfg.customFamily).trim() : "";
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

  function coerceModuleValue(value){
    if (typeof value === "string") {
      return value.trim();
    }
    if (!value || typeof value !== "object") return "";

    if (Array.isArray(value)) {
      if (!value.length) return "";
      return coerceModuleValue(value[0]);
    }

    for (const key of ["url", "href", "src", "value"]) {
      if (typeof value[key] === "string") {
        return value[key].trim();
      }
    }

    return "";
  }

  function normalizeModuleUrls(values){
    let list = values;
    if (typeof list === "string") {
      list = list.split(/\r?\n|[,\s]+/).filter(Boolean);
    } else if (!Array.isArray(list) && list && typeof list === "object") {
      list = Object.values(list);
    }

    if (!Array.isArray(list)) return [];

    const seen = new Set();
    const normalized = [];
    list.forEach(item => {
      const url = coerceModuleValue(item);
      if (!url || seen.has(url)) return;
      seen.add(url);
      normalized.push(url);
    });
    return normalized;
  }

  function getModuleContainer(panel){
    if (!panel) return null;
    return panel.querySelector(MODULE_INPUT_SELECTOR);
  }

  function createModuleInput(index, value){
    const wrapper = document.createElement("div");
    wrapper.className = "module-input__row";
    const input = document.createElement("input");
    input.type = "url";
    input.className = "module-input__control";
    input.id = `btfw-theme-module-${index}`;
    input.name = `btfw-theme-module-${index}`;
    input.placeholder = "https://example.com/module.js";
    input.dataset.role = "module-input";
    input.value = value || "";
    wrapper.appendChild(input);
    return { wrapper, input };
  }

  function appendModuleInput(container, index, value){
    if (!container) return null;
    const { wrapper, input } = createModuleInput(index, value);
    container.appendChild(wrapper);
    return input;
  }

  function renderModuleInputs(panel, values){
    const container = getModuleContainer(panel);
    if (!container) return;
    const normalized = normalizeModuleUrls(values);
    const limited = normalized.slice(0, MODULE_FIELD_MAX);
    const rows = [];
    limited.forEach((value, index) => {
      const { wrapper } = createModuleInput(index, value);
      rows.push(wrapper);
    });
    let count = limited.length;
    while (count < MODULE_FIELD_MIN && count < MODULE_FIELD_MAX) {
      const { wrapper } = createModuleInput(count, "");
      rows.push(wrapper);
      count++;
    }
    const canExtend = count < MODULE_FIELD_MAX && normalized.length === limited.length;
    if (canExtend && count === limited.length) {
      const { wrapper } = createModuleInput(count, "");
      rows.push(wrapper);
    }

    if (typeof container.replaceChildren === "function") {
      container.replaceChildren(...rows);
    } else {
      container.innerHTML = "";
      rows.forEach(row => container.appendChild(row));
    }
  }

  function trimModuleInputs(panel){
    const container = getModuleContainer(panel);
    if (!container) return;
    container.querySelectorAll('.module-input__row').forEach(row => {
      if (!row.querySelector('input[data-role="module-input"]')) {
        row.remove();
      }
    });
    let inputs = Array.from(container.querySelectorAll('input[data-role="module-input"]'));
    while (inputs.length > MODULE_FIELD_MIN) {
      const last = inputs[inputs.length - 1];
      if (last && !last.value.trim()) {
        const precedingHasEmpty = inputs.slice(0, inputs.length - 1).some(input => !input.value.trim());
        if (precedingHasEmpty) {
          const wrapper = last.closest('.module-input__row');
          if (wrapper && wrapper.parentElement === container) {
            container.removeChild(wrapper);
          } else {
            last.remove();
          }
          inputs = Array.from(container.querySelectorAll('input[data-role="module-input"]'));
          continue;
        }
      }
      break;
    }
  }

  function ensureModuleFieldAvailability(panel, skipTrim){
    const container = getModuleContainer(panel);
    if (!container) return;
    
    container.querySelectorAll('.module-input__row').forEach(row => {
      if (!row.querySelector('input[data-role="module-input"]')) {
        row.remove();
      }
    });
    
    let inputs = Array.from(container.querySelectorAll('input[data-role="module-input"]'));
    
    if (!inputs.length) {
      renderModuleInputs(panel, []);
      inputs = Array.from(container.querySelectorAll('input[data-role="module-input"]'));
    }
    
    if (inputs.length < MODULE_FIELD_MIN) {
      let index = inputs.length;
      while (index < MODULE_FIELD_MIN && index < MODULE_FIELD_MAX) {
        appendModuleInput(container, index, "");
        index++;
      }
      inputs = Array.from(container.querySelectorAll('input[data-role="module-input"]'));
    }
    
    const hasEmpty = inputs.some(input => !input.value.trim());
    if (!hasEmpty && inputs.length < MODULE_FIELD_MAX) {
      appendModuleInput(container, inputs.length, "");
      inputs = Array.from(container.querySelectorAll('input[data-role="module-input"]'));
    }
    
    if (!skipTrim) {
      trimModuleInputs(panel);
    }
  }

  function bindModuleFieldWatcher(panel, onChange){
    const container = getModuleContainer(panel);
    if (!container) {
      console.warn('[theme-admin] Module container not found for binding');
      return;
    }
    
    if (container._btfwModuleHandlerBound) {
      return;
    }
    
    const handler = (event) => {
      if (event?.target?.dataset?.role === 'module-input') {
        setTimeout(() => {
          ensureModuleFieldAvailability(panel);
          if (typeof onChange === "function") onChange();
        }, 10);
      }
    };
    
    container.addEventListener('input', handler);
    container.addEventListener('change', handler);
    
    container._btfwModuleHandlerBound = true;
    container.dataset.btfwModuleWatcher = "1";
    
    console.log('[theme-admin] Module field watcher bound successfully');
  }

  function readModuleValues(panel){
    const container = getModuleContainer(panel);
    if (!container) return [];
    const seen = new Set();
    const values = [];
    container.querySelectorAll('input[data-role="module-input"]').forEach(input => {
      const value = (input.value || "").trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      values.push(value);
    });
    return values;
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

  function normalizeConfig(cfg){
    const defaults = cloneDefaults();
    const normalized = cloneDefaults();
    deepMerge(normalized, cfg || {});

    if (!normalized.slider || typeof normalized.slider !== "object") {
      normalized.slider = JSON.parse(JSON.stringify(defaults.slider));
    }
    const slider = normalized.slider || {};
    normalized.sliderEnabled = Boolean(slider.enabled);
    normalized.sliderJson = slider.feedUrl || slider.url || normalized.sliderJson || "";

    if (!normalized.integrations || typeof normalized.integrations !== "object") {
      normalized.integrations = JSON.parse(JSON.stringify(defaults.integrations));
    }
    if (typeof normalized.integrations.enabled !== "boolean") {
      normalized.integrations.enabled = true;
    }
    if (!normalized.integrations.tmdb || typeof normalized.integrations.tmdb !== "object") {
      normalized.integrations.tmdb = { apiKey: "" };
    } else if (typeof normalized.integrations.tmdb.apiKey !== "string") {
      normalized.integrations.tmdb.apiKey = "";
    } else {
      normalized.integrations.tmdb.apiKey = normalized.integrations.tmdb.apiKey.trim();
    }

    if (normalized.features && typeof normalized.features === "object") {
      delete normalized.features.videoOverlayPoll;
      if (Object.keys(normalized.features).length === 0) {
        delete normalized.features;
      }
    }

    if (!normalized.resources || typeof normalized.resources !== "object") {
      normalized.resources = JSON.parse(JSON.stringify(defaults.resources));
    }
    if (!Array.isArray(normalized.resources.styles)) {
      normalized.resources.styles = [];
    }
    if (!Array.isArray(normalized.resources.scripts)) {
      normalized.resources.scripts = [];
    }
    const resourceModuleCandidates = (normalized.resources.modules && normalized.resources.modules.length)
      ? normalized.resources.modules
      : (normalized.resources.moduleUrls || normalized.resources.externalModules || normalized.moduleUrls || normalized.externalModules || normalized.modules || []);
    normalized.resources.modules = normalizeModuleUrls(resourceModuleCandidates);
    delete normalized.resources.moduleUrls;
    delete normalized.resources.externalModules;
    delete normalized.moduleUrls;
    delete normalized.externalModules;
    delete normalized.modules;

    if (!normalized.branding || typeof normalized.branding !== "object") {
      normalized.branding = JSON.parse(JSON.stringify(defaults.branding));
    }
    if (typeof normalized.branding.favicon === "string" && !normalized.branding.faviconUrl) {
      normalized.branding.faviconUrl = normalized.branding.favicon;
    }
    if (typeof normalized.branding.posterUrl !== "string") {
      normalized.branding.posterUrl = "";
    }

    if (!normalized.typography || typeof normalized.typography !== "object") {
      normalized.typography = JSON.parse(JSON.stringify(defaults.typography));
    }

    return normalized;
  }

  function buildConfigBlock(cfg){
    const normalized = normalizeConfig(cfg);
    const json = JSON.stringify(normalized, null, 2);
    return `${JS_BLOCK_START}\nwindow.BTFW_THEME_ADMIN = ${json};\n${JS_BLOCK_END}`;
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
    const sanitizedBlock = (block || "").trim();
    if (!sanitizedBlock) return original;

    const start = original.indexOf(startMarker);
    const end = original.indexOf(endMarker);
    const hadTrailingNewline = /\n\s*$/.test(original);

    if (start !== -1 && end !== -1 && end > start) {
      const before = original.slice(0, start).replace(/\s+$/, "");
      const after = original.slice(end + endMarker.length).replace(/^\s+/, "");
      return joinSections([before, sanitizedBlock, after], hadTrailingNewline);
    }

    const loaderStart = findLoaderStart(original);
    if (loaderStart !== -1) {
      const before = original.slice(0, loaderStart).replace(/\s+$/, "");
      return joinSections([before, sanitizedBlock], hadTrailingNewline);
    }

    return joinSections([sanitizedBlock, original], hadTrailingNewline);
  }

  function stripLegacySliderGlobals(jsText){
    const source = jsText ? String(jsText) : '';
    if (!source) return '';

    const lines = source.split(/\r?\n/);
    const cleaned = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (/^(?:var|let|const)?\s*UI_ChannelList\s*=/.test(trimmed)) continue;
      if (/^window\.UI_ChannelList\s*=/.test(trimmed)) continue;
      if (/^(?:var|let|const)?\s*Channel_JSON\s*=/.test(trimmed)) continue;
      if (/^window\.Channel_JSON\s*=/.test(trimmed)) continue;
      cleaned.push(line);
    }

    while (cleaned.length && cleaned[0].trim() === '') {
      cleaned.shift();
    }
    for (let i = cleaned.length - 1; i > 0; i--) {
      if (cleaned[i].trim() === '' && cleaned[i - 1].trim() === '') {
        cleaned.splice(i, 1);
      }
    }

    return cleaned.join('\n');
  }

function ensureRuntimeAsset(id, url, type){
    if (!url || !document.head) return;
    const existing = document.getElementById(id);
    if (existing) {
      if (type === "script" && existing.src === url) return;
      if (type === "style" && existing.href === url) return;
      existing.remove();
    }
    if (type === "script") {
      const script = document.createElement("script");
      script.id = id;
      script.src = url;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (type === "style") {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = url;
      document.head.appendChild(link);
    }
  }

  function pruneRuntimeAssets(prefix, keepCount){
    if (!document.head) return;
    let index = keepCount;
    while (index < 100) {
      const id = `${prefix}${index}`;
      const el = document.getElementById(id);
      if (!el) break;
      el.remove();
      index++;
    }
  }

  function applyRuntimeResources(theme){
    if (!theme || typeof theme !== "object") return;
    const resources = theme.resources && typeof theme.resources === "object"
      ? theme.resources : {};
    const styles = Array.isArray(resources.styles) ? resources.styles : [];
    styles.forEach((url, idx) => ensureRuntimeAsset(`btfw-theme-style-${idx}`, url, "style"));
    pruneRuntimeAssets("btfw-theme-style-", styles.length);

    const scripts = Array.isArray(resources.scripts) ? resources.scripts : [];
    scripts.forEach((url, idx) => ensureRuntimeAsset(`btfw-theme-script-${idx}`, url, "script"));
    pruneRuntimeAssets("btfw-theme-script-", scripts.length);

    const moduleCandidates = resources.modules && resources.modules.length
      ? resources.modules
      : (resources.moduleUrls || resources.externalModules || theme.modules || theme.moduleUrls || theme.externalModules || []);
    const modules = normalizeModuleUrls(moduleCandidates);
    modules.forEach((url, idx) => ensureRuntimeAsset(`btfw-theme-module-${idx}`, url, "script"));
    pruneRuntimeAssets("btfw-theme-module-", modules.length);
    theme.resources = theme.resources || {};
    theme.resources.styles = styles.slice();
    theme.resources.scripts = scripts.slice();
    theme.resources.modules = modules;
    if (typeof window !== "undefined") {
      const global = window.BTFW = window.BTFW || {};
      global.channelThemeModules = modules.slice();
    }
  }

  function applyRuntimeSlider(theme){
    if (!theme || typeof theme !== "object") return;
    const slider = (theme.slider && typeof theme.slider === "object") ? theme.slider : (theme.slider = {});
    let enabled = typeof slider.enabled === "boolean" ? slider.enabled : theme.sliderEnabled;
    let feed = slider.feedUrl || slider.url || theme.sliderJson || "";
    enabled = Boolean(enabled);
    slider.enabled = enabled;
    slider.feedUrl = feed;
    theme.sliderEnabled = enabled;
    theme.sliderJson = feed;
    if (typeof window !== "undefined") {
      const global = window.BTFW = window.BTFW || {};
      global.channelSlider = { enabled, feedUrl: feed };
      global.channelSliderEnabled = enabled;
      global.channelSliderJSON = feed;
    }
  }

  function applyRuntimeBranding(theme){
    if (!theme || typeof theme !== "object") return;
    const branding = (theme.branding && typeof theme.branding === "object") ? theme.branding : (theme.branding = {});
    let name = typeof branding.headerName === "string" ? branding.headerName.trim() : "";
    if (!name && typeof theme.headerName === "string") {
      name = theme.headerName.trim();
    }
    if (!name) name = "CyTube";
    branding.headerName = name;

    const selectors = [
      "#nav-collapsible .navbar-brand",
      ".navbar .navbar-brand",
      ".navbar-brand",
      "#navbrand"
    ];
    selectors.forEach(sel => {
      const anchor = document?.querySelector?.(sel);
      if (anchor && anchor.textContent !== name) {
        anchor.textContent = name;
      }
    });

    let favicon = typeof branding.faviconUrl === "string" ? branding.faviconUrl.trim() : "";
    if (!favicon && typeof branding.favicon === "string") {
      favicon = branding.favicon.trim();
    }
    branding.faviconUrl = favicon || "";
    if (favicon && typeof document !== "undefined") {
      let link = document.querySelector("link[rel='icon'], link[rel='shortcut icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      if (link.href !== favicon) {
        link.href = favicon;
      }
    }

    let poster = typeof branding.posterUrl === "string" ? branding.posterUrl.trim() : "";
    if (!poster && typeof theme.branding?.posterUrl === "string") {
      poster = theme.branding.posterUrl.trim();
    }
    branding.posterUrl = poster || "";
    if (typeof window !== "undefined") {
      const global = window.BTFW = window.BTFW || {};
      global.channelPosterUrl = poster || "";
    }
  }

  function applyRuntimeIntegrations(theme){
    if (!theme || typeof theme !== "object") return;
    const integrations = (theme.integrations && typeof theme.integrations === "object") ? theme.integrations : (theme.integrations = {});
    if (typeof integrations.enabled !== "boolean") {
      integrations.enabled = true;
    }
    if (!integrations.tmdb || typeof integrations.tmdb !== "object") {
      integrations.tmdb = { apiKey: "" };
    }
    const key = typeof integrations.tmdb.apiKey === "string" ? integrations.tmdb.apiKey.trim() : "";
    integrations.tmdb.apiKey = key;
    if (typeof window !== "undefined") {
      window.BTFW_CONFIG = window.BTFW_CONFIG || {};
      if (typeof window.BTFW_CONFIG.tmdb !== "object") {
        window.BTFW_CONFIG.tmdb = {};
      }
      window.BTFW_CONFIG.tmdb.apiKey = key;
      window.BTFW_CONFIG.tmdbKey = key;
      window.BTFW_CONFIG.integrationsEnabled = integrations.enabled;
      try {
        if (document?.body && document.body.dataset.tmdbKey !== key) {
          document.body.dataset.tmdbKey = key;
        }
      } catch (_) {}
    }
  }

  function applyRuntimeColors(theme){
    if (!theme || typeof theme !== "object" || typeof document === "undefined") return;
    const colors = (theme.colors && typeof theme.colors === "object") ? theme.colors : (theme.colors = {});
    const root = document.documentElement;
    if (!root) return;

    const colorVars = {
      "--btfw-theme-bg": colors.background || "#05060d",
      "--btfw-theme-surface": colors.surface || colors.panel || "#0b111d",
      "--btfw-theme-panel": colors.panel || "#141f36",
      "--btfw-theme-text": colors.text || "#e8ecfb",
      "--btfw-theme-chat-text": colors.chatText || colors.text || "#d4defd",
      "--btfw-theme-accent": colors.accent || "#6d4df6"
    };

    Object.entries(colorVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }

  function applyRuntimeTypography(theme){
    if (!theme || typeof theme !== "object") return;
    const typography = theme.typography && typeof theme.typography === "object"
      ? theme.typography : (theme.typography = {});
    const resolved = applyLiveTypographyAssets(typography);
    typography.resolvedFamily = resolved.family;
  }

  function syncRuntimeThemeConfig(source){
    if (!source || typeof source !== "object" || typeof window === "undefined") return null;
    const normalized = normalizeConfig(source);
    const global = window.BTFW = window.BTFW || {};
    window.BTFW_THEME_ADMIN = normalized;
    global.channelTheme = normalized;
    applyRuntimeResources(normalized);
    applyRuntimeSlider(normalized);
    applyRuntimeBranding(normalized);
    applyRuntimeColors(normalized);
    applyRuntimeIntegrations(normalized);
    applyRuntimeTypography(normalized);
    return normalized;
  }

  function bootstrapRuntimeThemeSync(){
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const apply = () => {
      try {
        const cfg = window.BTFW_THEME_ADMIN;
        if (cfg && typeof cfg === "object") {
          syncRuntimeThemeConfig(cfg);
        }
      } catch (error) {
        console.warn("[theme-admin] Failed to sync runtime theme config", error);
      }
    };
    apply();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", apply, { once: true });
    }
  }

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
        --btfw-admin-text: var(--btfw-theme-text, #e8ecfb);
        --btfw-admin-text-soft: color-mix(in srgb, var(--btfw-theme-text, #e8ecfb) 72%, transparent 28%);
      }
      .btfw-theme-admin { max-width: 900px; margin: 0 auto; padding: 20px; font-family: var(--btfw-theme-font-family, 'Inter', sans-serif); color: var(--btfw-admin-text); }
      .btfw-theme-admin h3 { margin: 0 0 8px; font-size: 1.6rem; font-weight: 700; letter-spacing: -0.02em; }
      .btfw-theme-admin .lead { margin: 0 0 24px; font-size: 0.94rem; color: var(--btfw-admin-text-soft); line-height: 1.5; }
      .btfw-theme-admin .section { background: var(--btfw-admin-surface); border: 1px solid var(--btfw-admin-border-soft); border-radius: 16px; margin-bottom: 16px; overflow: hidden; transition: border 0.2s ease; }
      .btfw-theme-admin .section:hover { border-color: var(--btfw-admin-border); }
      .btfw-theme-admin .section__summary { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; cursor: pointer; list-style: none; user-select: none; }
      .btfw-theme-admin .section__summary::-webkit-details-marker { display: none; }
      .btfw-theme-admin .section__title { display: flex; flex-direction: column; gap: 4px; }
      .btfw-theme-admin .section__title h4 { margin: 0; font-size: 1.05rem; font-weight: 600; letter-spacing: 0.01em; }
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
      .btfw-theme-admin .module-inputs { display: grid; gap: 10px; margin-top: 8px; }
      .btfw-theme-admin .module-input__row { display: flex; }
      .btfw-theme-admin .module-input__control { width: 100%; }
      .btfw-theme-admin input[type="text"],
      .btfw-theme-admin input[type="url"],
      .btfw-theme-admin textarea,
      .btfw-theme-admin select {
        width: 100%;
        background: color-mix(in srgb, var(--btfw-admin-surface-alt) 92%, transparent 8%);
        border: 1px solid var(--btfw-admin-border-soft);
        border-radius: 12px;
        padding: 12px 14px;
        font-family: inherit;
        font-size: 0.94rem;
        color: var(--btfw-admin-text);
        transition: border 0.2s ease, background 0.2s ease;
      }
      .btfw-theme-admin input:focus,
      .btfw-theme-admin textarea:focus,
      .btfw-theme-admin select:focus {
        outline: none;
        border-color: var(--btfw-admin-border);
        background: var(--btfw-admin-surface-alt);
      }
      .btfw-theme-admin input:disabled,
      .btfw-theme-admin textarea:disabled,
      .btfw-theme-admin select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btfw-theme-admin textarea { min-height: 80px; resize: vertical; font-family: 'Monaco', 'Courier New', monospace; font-size: 0.88rem; }
      .btfw-theme-admin input[type="color"] { height: 48px; padding: 6px; cursor: pointer; }
      .btfw-theme-admin .help { margin: 0; font-size: 0.84rem; color: var(--btfw-admin-text-soft); line-height: 1.4; }
      .btfw-theme-admin .help code { background: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 18%, transparent 82%); color: var(--btfw-theme-accent, #6d4df6); padding: 2px 6px; border-radius: 4px; font-size: 0.88em; }
      .btfw-theme-admin .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
      .btfw-theme-admin .preview { margin-top: 12px; padding: 16px; background: var(--btfw-admin-surface-alt); border: 1px solid var(--btfw-admin-border-soft); border-radius: 12px; }
      .btfw-theme-admin .preview__main { display: flex; flex-direction: column; gap: 12px; }
      .btfw-theme-admin .preview__chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .btfw-theme-admin .preview__chip { padding: 8px 12px; border-radius: 8px; font-size: 0.82rem; font-weight: 500; color: white; }
      .btfw-theme-admin .preview__accent { width: 100%; height: 6px; border-radius: 6px; }
      .btfw-theme-admin .preview--font { display: flex; flex-direction: column; gap: 8px; }
      .btfw-theme-admin .preview__font-label { font-size: 0.88rem; font-weight: 600; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .preview__font-text { margin: 0; font-size: 1.1rem; line-height: 1.6; color: var(--btfw-admin-text); }
      .btfw-theme-admin .integrations-callout { display: flex; flex-direction: column; gap: 6px; padding: 14px; background: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 12%, transparent 88%); border-radius: 10px; margin-bottom: 8px; }
      .btfw-theme-admin .integrations-callout strong { font-weight: 600; color: var(--btfw-admin-text); }
      .btfw-theme-admin .integrations-callout span { font-size: 0.88rem; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .integrations-callout a { color: var(--btfw-theme-accent, #6d4df6); text-decoration: none; font-weight: 500; }
      .btfw-theme-admin .integrations-callout a:hover { text-decoration: underline; }
      .btfw-theme-admin .buttons { display: flex; align-items: center; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
      .btfw-theme-admin button { padding: 12px 20px; border: none; border-radius: 10px; font-family: inherit; font-size: 0.94rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
      .btfw-theme-admin .btn-primary { background: var(--btfw-theme-accent, #6d4df6); color: white; }
      .btfw-theme-admin .btn-primary:hover { background: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 85%, black 15%); transform: translateY(-1px); }
      .btfw-theme-admin .btn-secondary { background: var(--btfw-admin-surface); color: var(--btfw-admin-text); border: 1px solid var(--btfw-admin-border-soft); }
      .btfw-theme-admin .btn-secondary:hover { border-color: var(--btfw-admin-border); background: var(--btfw-admin-surface-alt); }
      .btfw-theme-admin .status { flex: 1; min-width: 200px; font-size: 0.88rem; padding: 10px 14px; border-radius: 8px; font-weight: 500; }
      .btfw-theme-admin .status[data-variant="idle"] { background: var(--btfw-admin-surface-alt); color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .status[data-variant="pending"] { background: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 20%, transparent 80%); color: var(--btfw-theme-accent, #6d4df6); }
      .btfw-theme-admin .status[data-variant="saved"] { background: color-mix(in srgb, #66bb6a 20%, transparent 80%); color: #66bb6a; }
      .btfw-theme-admin .status[data-variant="error"] { background: color-mix(in srgb, #ff6b6b 20%, transparent 80%); color: #ff6b6b; }
    `;
    document.head.appendChild(style);
  }

  function renderPreview(panel, cfg){
    const colors = cfg?.colors || {};
    const typography = cfg?.typography || {};
    const preview = panel.querySelector(".preview");
    if (!preview) return;

    preview.style.background = `linear-gradient(135deg, ${colors.surface || colors.panel || "#0b111d"}, ${colors.panel || "#141f36"})`;
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
            <div class="field">
              <label for="btfw-theme-module-0">Additional module URLs</label>
              <div class="module-inputs" data-role="module-inputs">
                <div class="module-input__row">
                  <input type="url" id="btfw-theme-module-0" name="btfw-theme-module-0" class="module-input__control" placeholder="https://example.com/module.js" data-role="module-input">
                </div>
                <div class="module-input__row">
                  <input type="url" id="btfw-theme-module-1" name="btfw-theme-module-1" class="module-input__control" placeholder="https://example.com/module.js" data-role="module-input">
                </div>
                <div class="module-input__row">
                  <input type="url" id="btfw-theme-module-2" name="btfw-theme-module-2" class="module-input__control" placeholder="https://example.com/module.js" data-role="module-input">
                </div>
              </div>
              <p class="help">Load up to 10 extra BillTube modules by URL. A new field appears once you fill the last one.</p>
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
                <option value="midnight">Midnight</option>
                <option value="slate">Slate</option>
                <option value="ocean">Ocean</option>
                <option value="forest">Forest</option>
                <option value="ember">Ember</option>
                <option value="custom">Custom</option>
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
                <div class="preview__accent"></div>
              </div>
            </div>
          </div>
        </details>

        <details class="section" data-section="typography">
          <summary class="section__summary">
            <div class="section__title">
              <h4>Typography</h4>
              <span>Select a Google Font or define a custom family.</span>
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
                <option value="custom">Custom</option>
              </select>
              <p class="help">Choose <em>Custom</em> to specify your own.</p>
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
              <span>Navbar title, favicon, and poster overrides.</span>
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
            <div class="field">
              <label for="btfw-theme-poster">Video poster URL</label>
              <input type="url" id="btfw-theme-poster" data-btfw-bind="branding.posterUrl" placeholder="https://example.com/poster.jpg">
              <p class="help">Optional hero image used by some overlays. Leave blank to use the default poster.</p>
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

    bindModuleFieldWatcher(panel, onChange);

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
    const root = document.documentElement;
    if (root) {
      root.classList.add("btfw-poll-overlay-enabled");
      root.classList.remove("btfw-poll-overlay-disabled");
    }
    const moduleCandidates = (cfg?.resources?.modules && cfg.resources.modules.length)
      ? cfg.resources.modules
      : (cfg?.resources?.moduleUrls || cfg?.resources?.externalModules || cfg?.modules || cfg?.moduleUrls || cfg?.externalModules || []);
    const modules = normalizeModuleUrls(moduleCandidates);
    renderModuleInputs(panel, modules);
    ensureModuleFieldAvailability(panel, true);
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
    if (!updated.resources || typeof updated.resources !== "object") {
      updated.resources = cloneDefaults().resources;
    }
    updated.resources.modules = normalizeModuleUrls(readModuleValues(panel));
    delete updated.resources.moduleUrls;
    delete updated.resources.externalModules;
    delete updated.moduleUrls;
    delete updated.externalModules;
    if (!updated.slider || typeof updated.slider !== "object") {
      updated.slider = cloneDefaults().slider;
    }
    updated.sliderEnabled = Boolean(updated.slider?.enabled);
    updated.sliderJson = updated.slider?.feedUrl || "";
    if (!updated.integrations || typeof updated.integrations !== "object") {
      updated.integrations = cloneDefaults().integrations;
    }
    if (typeof updated.integrations.enabled !== "boolean") {
      updated.integrations.enabled = true;
    }
    if (!updated.integrations.tmdb || typeof updated.integrations.tmdb !== "object") {
      updated.integrations.tmdb = { apiKey: "" };
    } else if (typeof updated.integrations.tmdb.apiKey !== "string") {
      updated.integrations.tmdb.apiKey = "";
    }
    if (!updated.branding || typeof updated.branding !== "object") {
      updated.branding = cloneDefaults().branding;
    }
    if (!updated.typography || typeof updated.typography !== "object") {
      updated.typography = cloneDefaults().typography;
    }
    return updated;
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

    const cleanedJs = stripLegacySliderGlobals(existingJs);
    jsField.value = replaceBlock(cleanedJs, JS_BLOCK_START, JS_BLOCK_END, jsBlock);

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

  function ensureTab(modal){
    if (!modal) return null;

    const { tabContainer, contentContainer } = ensureTabSystem(modal);
    const panelHost = contentContainer || modal.querySelector('.tab-content') || modal;

    let panel = panelHost?.querySelector('#btfw-theme-admin-panel');
    if (panel) return panel;

    if (!tabContainer || !panelHost) return null;

    let tab = tabContainer.querySelector("li[data-btfw-theme-tab]");
    if (!tab) {
      const existingLink = tabContainer.querySelector("a[href='#btfw-theme-admin-panel'], a[data-target='#btfw-theme-admin-panel']");
      if (existingLink) {
        tab = existingLink.closest('li') || existingLink;
        tab.dataset.btfwThemeTab = "1";
      } else if (tabContainer.tagName === 'UL' || tabContainer.tagName === 'OL' || tabContainer.classList.contains('nav-tabs')) {
        tab = document.createElement('li');
        tab.dataset.btfwThemeTab = "1";
        const anchor = document.createElement('a');
        anchor.href = '#btfw-theme-admin-panel';
        anchor.setAttribute('data-toggle', 'tab');
        anchor.innerHTML = '<span class="fa fa-magic"></span> <span>Theme</span>';
        anchor.style.display = 'flex';
        anchor.style.alignItems = 'center';
        anchor.style.gap = '8px';
        tab.appendChild(anchor);
        tabContainer.appendChild(tab);
      } else {
        const anchor = document.createElement('a');
        anchor.href = '#btfw-theme-admin-panel';
        anchor.setAttribute('data-toggle', 'tab');
        anchor.className = 'btfw-theme-tab-toggle';
        anchor.innerHTML = '<span class="fa fa-magic"></span> <span>Theme</span>';
        tabContainer.appendChild(anchor);
        tab = anchor;
      }
    }

    panel = document.createElement('div');
    panel.id = 'btfw-theme-admin-panel';
    panel.className = 'tab-pane';
    panel.setAttribute('role', 'tabpanel');
    panel.style.display = 'none';
    panelHost.appendChild(panel);

    return panel;
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

    if (!cfg.integrations || typeof cfg.integrations !== "object") {
      cfg.integrations = cloneDefaults().integrations;
    }
    if (typeof cfg.integrations.enabled !== "boolean") {
      cfg.integrations.enabled = true;
    }
    if (!cfg.integrations.tmdb || typeof cfg.integrations.tmdb !== "object") {
      cfg.integrations.tmdb = { apiKey: "" };
    }

    if (!cfg.branding || typeof cfg.branding !== "object") {
      cfg.branding = cloneDefaults().branding;
    }
    if (typeof cfg.branding.favicon === "string" && !cfg.branding.faviconUrl) {
      cfg.branding.faviconUrl = cfg.branding.favicon;
    }
    if (typeof cfg.branding.posterUrl !== "string") {
      cfg.branding.posterUrl = '';
    }

    if (!cfg.resources || typeof cfg.resources !== "object") {
      cfg.resources = cloneDefaults().resources;
    }
    if (!Array.isArray(cfg.resources.styles)) {
      cfg.resources.styles = [];
    }
    if (!Array.isArray(cfg.resources.scripts)) {
      cfg.resources.scripts = [];
    }
    const resourceModules = (cfg.resources.modules && cfg.resources.modules.length)
      ? cfg.resources.modules
      : (cfg.resources.moduleUrls || cfg.resources.externalModules || cfg.moduleUrls || cfg.externalModules || cfg.modules || []);
    cfg.resources.modules = normalizeModuleUrls(resourceModules);
    delete cfg.resources.moduleUrls;
    delete cfg.resources.externalModules;
    delete cfg.moduleUrls;
    delete cfg.externalModules;
    delete cfg.modules;

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

  const CHANNEL_MODAL_SELECTOR = "#channeloptions, #channelsettingsmodal, #channeloptionsmodal, .channel-settings-modal";

  function ensureModalPanel(modal){
    if (!modal || !canManageChannel()) return;
    if (!modal.dataset.btfwThemeAdminBound) {
      if (initPanel(modal)) {
        modal.dataset.btfwThemeAdminBound = "1";
      }
    } else {
      initPanel(modal);
    }
  }

  function boot(){
    if (!canManageChannel()) return;
    const modal = document.querySelector(CHANNEL_MODAL_SELECTOR);
    ensureModalPanel(modal);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  const bindModalEvents = (()=>{
    let bound = false;
    return function(){
      if (bound) return;
      bound = true;
      const handler = (event)=>{
        const modal = event?.target?.closest?.(CHANNEL_MODAL_SELECTOR) ||
          (event?.target && event.target.matches?.(CHANNEL_MODAL_SELECTOR) ? event.target : null);
        ensureModalPanel(modal);
      };
      document.addEventListener("show.bs.modal", handler, true);
      document.addEventListener("shown.bs.modal", handler, true);
    };
  })();

  bootstrapRuntimeThemeSync();
  bindModalEvents();

  return { name: "feature:channelThemeAdmin" };
});
