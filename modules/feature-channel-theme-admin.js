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
  // feature-channel-theme-admin.js - PART 2 OF 3
// Append this after Part 1

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

  // FIXED VERSION
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
    
    // CRITICAL FIX: Only trim if not skipping
    if (!skipTrim) {
      trimModuleInputs(panel);
    }
  }

  // FIXED VERSION
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
// ============================================================================
// SIMPLE FIX: Just replace these 3 functions in your existing file
// Search for each function name and replace it entirely
// ============================================================================

// FUNCTION 1: Replace ensureModuleFieldAvailability
// Search for: function ensureModuleFieldAvailability(panel){
// Replace entire function with:

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
  
  // CRITICAL FIX: Only trim if not skipping (skip during initialization)
  if (!skipTrim) {
    trimModuleInputs(panel);
  }
}


// FUNCTION 2: Replace bindModuleFieldWatcher
// Search for: function bindModuleFieldWatcher(panel, onChange){
// Replace entire function with:

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


// FUNCTION 3: Replace updateInputs
// Search for: function updateInputs(panel, cfg){
// Replace entire function with:

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
  
// FUNCTION 3: Replace updateInputs - COMPLETE VERSION
// Search for: function updateInputs(panel, cfg){
// Replace entire function with:

function updateInputs(panel, cfg){
  $('[data-btfw-bind]', panel).forEach(input => {
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
  
  console.log('[theme-admin] updateInputs rendering modules:', modules);
  
  renderModuleInputs(panel, modules);
  
  // CRITICAL FIX: Pass skipTrim=true to prevent trimming saved values during load
  ensureModuleFieldAvailability(panel, true);
  
  updateTypographyFieldState(panel);
  updateSliderFieldState(panel);
  renderPreview(panel, cfg);
}
