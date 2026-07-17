/* BTFW — util:gradientCanvas
   Canvas-based gradient renderer for the theme toolkit preview and runtime.
   Replaces the animated SVG filter pipeline with a single render pass:
   - organic/value-noise blob shapes
   - OKLAB color mixing for clean, non-muddy fades
   - 8×8 Bayer dither baked into the pixels to kill banding
   - static image export (data URL) so the existing CSS keyframes can animate
     the texture on the compositor instead of re-rasterizing filters every frame.

   API:
     renderGradientLayer(type, width, height, options) -> { canvas, dataUrl, css, count, sizes, positions }
     supportsCanvas() -> boolean
*/
BTFW.define("util:gradientCanvas", [], async () => {
  // --------------------------------------------------------------------------
  // Deterministic PRNG + value-noise FBM (organic blob silhouettes)
  // --------------------------------------------------------------------------
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function makeNoise2D(seed) {
    const rand = mulberry32(seed);
    const perm = new Uint8Array(512);
    const grad = new Float32Array(256);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    for (let i = 0; i < 256; i++) grad[i] = rand() * 2 - 1;
    const fade = t => t * t * (3 - 2 * t);
    return function (x, y) {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const g = (X, Y) => grad[perm[(perm[X & 255] + (Y & 255)) & 511] & 255];
      const u = fade(xf);
      const v = fade(yf);
      const a = g(xi, yi);
      const b = g(xi + 1, yi);
      const c = g(xi, yi + 1);
      const d = g(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }

  function fbmFactory(seed) {
    const n = makeNoise2D(seed);
    return (x, y) => {
      let v = 0;
      let amp = 0.55;
      let f = 1;
      for (let o = 0; o < 4; o++) {
        v += amp * n(x * f, y * f);
        amp *= 0.5;
        f *= 2.03;
      }
      return v;
    };
  }

  // --------------------------------------------------------------------------
  // OKLAB color mixing (clean, perceptually even fades)
  // --------------------------------------------------------------------------
  const s2l = c => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const l2s = c => {
    c = Math.max(0, Math.min(1, c));
    return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
  };

  function hexRgb(hex) {
    const match = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!match) return [0, 0, 0];
    return [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16));
  }

  function rgbToOklab(r, g, b) {
    r = s2l(r); g = s2l(g); b = s2l(b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }

  function oklabToRgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ ** 3;
    const m = m_ ** 3;
    const s = s_ ** 3;
    return [
      l2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      l2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      l2s(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    ];
  }

  function mixOklab(c1, c2, t) {
    const a = rgbToOklab(...hexRgb(c1));
    const b = rgbToOklab(...hexRgb(c2));
    return oklabToRgb(
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    );
  }

  function colorAt(stops, progress) {
    const value = Math.min(1, Math.max(0, progress));
    const positioned = stops.map(s => ({ ...s, unit: s.position / 100 }));
    if (value <= positioned[0].unit) return positioned[0].color;
    if (value >= positioned[positioned.length - 1].unit) return positioned[positioned.length - 1].color;
    const upperIndex = positioned.findIndex(s => s.unit >= value);
    const lower = positioned[Math.max(0, upperIndex - 1)];
    const upper = positioned[upperIndex];
    const span = Math.max(0.001, upper.unit - lower.unit);
    const mix = (value - lower.unit) / span;
    return `#${mixOklab(lower.color, upper.color, mix).map(c => c.toString(16).padStart(2, "0")).join("")}`;
  }

  // --------------------------------------------------------------------------
  // 8×8 Bayer ordered dither (banding killer)
  // --------------------------------------------------------------------------
  const BAYER = (() => {
    const m = [
      0, 32, 8, 40, 2, 34, 10, 42,
      48, 16, 56, 24, 50, 18, 58, 26,
      12, 44, 4, 36, 14, 46, 6, 38,
      60, 28, 52, 20, 62, 30, 54, 22,
      3, 35, 11, 43, 1, 33, 9, 41,
      51, 19, 59, 27, 49, 17, 57, 25,
      15, 47, 7, 39, 13, 45, 5, 37,
      63, 31, 55, 23, 61, 29, 53, 21
    ];
    const out = new Float32Array(64);
    for (let i = 0; i < 64; i++) out[i] = (m[i] / 64) - 0.5;
    return out;
  })();

  function applyDither(ctx, w, h, amplitude = 2.2) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const row = y & 7;
      for (let x = 0; x < w; x++) {
        const n = BAYER[(row << 3) | (x & 7)] * amplitude;
        const i = (y * w + x) << 2;
        d[i] += n;
        d[i + 1] += n;
        d[i + 2] += n;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // --------------------------------------------------------------------------
  // Common options normalization
  // --------------------------------------------------------------------------
  function normalizeOptions(options) {
    const stops = Array.isArray(options.stops) ? options.stops.slice(0, 4) : [];
    while (stops.length < 4) stops.push({ color: "#000000", position: 25 * stops.length });
    return {
      stops,
      strength: Number(options.strength) || 34,
      soften: Number(options.soften) || 18,
      noise: Number(options.noise) || 0,
      angle: Number(options.angle) || 135,
      strengthScale: Number(options.strengthScale) || 1,
      surface: String(options.surface || options.backgroundColor || "#05060d"),
      dither: Number(options.dither) || 2.2,
      maxDpr: Math.min(2, Number(options.maxDpr) || 2),
      seed: Number(options.seed) || 17
    };
  }

  // --------------------------------------------------------------------------
  // Renderers
  // --------------------------------------------------------------------------
  function renderFlow(canvas, w, h, opts) {
    const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext("2d", { alpha: false });
    const W = canvas.width;
    const H = canvas.height;
    const S = Math.min(W, H);

    const alpha = Math.min(0.72, Math.max(0.04, (opts.strength * opts.strengthScale) / 100));
    const blurPx = Math.max(0, Math.round((16 + opts.soften * 0.34) * (S / 720)));
    const warp = fbmFactory(opts.seed);
    const warp2 = fbmFactory(opts.seed + 101);

    // Offscreen field: draw the translucent blobs at full opacity, then composite once.
    const field = document.createElement("canvas");
    field.width = W;
    field.height = H;
    const fx = field.getContext("2d", { alpha: true });

    // Blob recipe: same stacking order as the original SVG flow paths.
    const blobs = [
      { c: opts.stops[2].color, cx: 0.70 * W, cy: 0.34 * H, r: 0.56 * S, seed: 3.1 },
      { c: opts.stops[1].color, cx: 0.14 * W, cy: 0.70 * H, r: 0.62 * S, seed: 7.7 },
      { c: opts.stops[0].color, cx: 0.42 * W, cy: 0.12 * H, r: 0.50 * S, seed: 12.9 }
    ];

    const canFilter = typeof fx.filter === "string";
    for (const b of blobs) {
      const lab = rgbToOklab(...hexRgb(b.c));
      const g = fx.createRadialGradient(b.cx, b.cy, b.r * 0.05, b.cx, b.cy, b.r * 1.02);
      for (let i = 0; i <= 44; i++) {
        const t = i / 44;
        const ease = t < 0.55 ? 1 : Math.pow(1 - (t - 0.55) / 0.45, 1.8);
        const [rr, gg, bb] = oklabToRgb(lab[0] * (1 - t * 0.12), lab[1] * (1 - t * 0.25), lab[2] * (1 - t * 0.25));
        g.addColorStop(t, `rgba(${rr},${gg},${bb},${ease.toFixed(3)})`);
      }
      fx.fillStyle = g;
      if (canFilter) fx.filter = `blur(${blurPx}px)`;
      fx.beginPath();
      const N = 96;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const n = warp(ca * 1.4 + b.seed, sa * 1.4 + b.seed) * 0.5 +
                  warp2(ca * 3.1 + b.seed, sa * 3.1 + b.seed) * 0.22;
        const r = b.r * (0.84 + n * (0.46 + opts.soften * 0.004));
        const x = b.cx + ca * r * 1.28;
        const y = b.cy + sa * r * 0.82;
        if (i) fx.lineTo(x, y);
        else fx.moveTo(x, y);
      }
      fx.closePath();
      fx.fill();
      if (canFilter) fx.filter = "none";
    }

    // Composite the field over the surface color at the requested alpha.
    ctx.fillStyle = opts.surface;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = alpha;
    ctx.drawImage(field, 0, 0);
    ctx.globalAlpha = 1;
    applyDither(ctx, W, H, opts.dither);
  }

  function renderLinear(canvas, w, h, opts) {
    const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext("2d", { alpha: false });
    const W = canvas.width;
    const H = canvas.height;

    const alpha = Math.min(0.72, Math.max(0.04, (opts.strength * opts.strengthScale) / 100));
    const rad = (opts.angle * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = Math.cos(rad);
    const dist = Math.abs(W * dx) + Math.abs(H * dy);
    const cx = W / 2;
    const cy = H / 2;

    const g = ctx.createLinearGradient(
      cx - dx * dist / 2, cy - dy * dist / 2,
      cx + dx * dist / 2, cy + dy * dist / 2
    );
    const sorted = [...opts.stops].sort((a, b) => a.position - b.position);
    for (const stop of sorted) {
      g.addColorStop(stop.position / 100, stop.color);
    }

    ctx.fillStyle = opts.surface;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    applyDither(ctx, W, H, opts.dither);
  }

  function renderRetro(canvas, w, h, opts) {
    const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext("2d", { alpha: false });
    const W = canvas.width;
    const H = canvas.height;

    const alpha = Math.min(0.72, Math.max(0.04, (opts.strength * opts.strengthScale) / 100));
    const rgbLight = c => {
      const [r, g, b] = hexRgb(c);
      return r * 0.2126 + g * 0.7152 + b * 0.0722;
    };
    let brightest = 0;
    for (let i = 1; i < opts.stops.length; i++) {
      if (rgbLight(opts.stops[i].color) > rgbLight(opts.stops[brightest].color)) brightest = i;
    }

    const others = opts.stops.filter((_, i) => i !== brightest);
    const centers = [
      [0.156 * W, 0.812 * H],
      [0.791 * W, 0.243 * H],
      [0.875 * W, 0.840 * H]
    ].slice(0, others.length);
    const rx = 0.458 * W;
    const ry = 0.562 * H;
    const blur = Math.max(0, Math.round((24 + opts.soften * 0.42) * (Math.min(W, H) / 720)));

    const canFilter = typeof ctx.filter === "string";

    ctx.fillStyle = opts.surface;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = alpha;
    for (let i = 0; i < others.length; i++) {
      const [cx, cy] = centers[i] || [W / 2, H / 2];
      const g = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.05, cx, cy, Math.max(rx, ry) * 1.1);
      g.addColorStop(0, others[i].color);
      g.addColorStop(0.55, others[i].color);
      g.addColorStop(1, opts.surface);
      ctx.fillStyle = g;
      if (canFilter) ctx.filter = `blur(${blur}px)`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      if (canFilter) ctx.filter = "none";
    }
    ctx.globalAlpha = 1;
    applyDither(ctx, W, H, opts.dither);
  }

  function renderPixel(canvas, w, h, opts) {
    const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext("2d", { alpha: false });
    const W = canvas.width;
    const H = canvas.height;

    const alpha = Math.min(0.72, Math.max(0.04, (opts.strength * opts.strengthScale) / 100));
    const columns = 17;
    const rows = 11;
    const cell = Math.max(8, Math.round(Math.min(W, H) / 10));
    const levels = Array.from({ length: 9 }, (_, i) => colorAt(opts.stops, i / 8));

    // Base surface.
    ctx.fillStyle = opts.surface;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = alpha;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const field = (
          Math.sin((col + 1) * 0.73) +
          Math.cos((row + 1) * 0.91) +
          Math.sin((col + row + 2) * 0.39) + 3
        ) / 6;
        const level = Math.round(Math.min(1, Math.max(0, field)) * (levels.length - 1));
        ctx.fillStyle = levels[level];
        ctx.fillRect((col - 1) * cell, (row - 1) * cell, cell, cell);
      }
    }

    // Subtle grid pattern overlay for the pixel vibe.
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let row = 0; row <= rows; row++) {
      ctx.fillRect(-cell, row * cell - cell, (columns + 1) * cell, 1);
    }
    for (let col = 0; col <= columns; col++) {
      ctx.fillRect(col * cell - cell, -cell, 1, (rows + 1) * cell);
    }

    ctx.globalAlpha = 1;
    applyDither(ctx, W, H, opts.dither);
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------
  function supportsCanvas() {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext && c.getContext("2d"));
    } catch (_) {
      return false;
    }
  }

  function canvasToDataUrl(canvas, format = "webp") {
    if (format === "webp") {
      const url = canvas.toDataURL("image/webp", 0.92);
      if (url.startsWith("data:image/webp")) return url;
    }
    return canvas.toDataURL("image/png");
  }

  // --------------------------------------------------------------------------
  // 8-entry LRU memo cache: repeat renders during slider drags / panel syncs
  // are near-instant. Keyed on type + dimensions + full normalized config.
  // --------------------------------------------------------------------------
  const RENDER_CACHE = new Map();
  const RENDER_CACHE_MAX = 8;
  function renderCacheKey(type, width, height, opts) {
    return JSON.stringify({ type, width, height, opts });
  }
  function getCachedRender(key) {
    const entry = RENDER_CACHE.get(key);
    if (!entry) return undefined;
    // Touch: move to end to keep LRU order.
    RENDER_CACHE.delete(key);
    RENDER_CACHE.set(key, entry);
    return entry;
  }
  function setCachedRender(key, value) {
    if (RENDER_CACHE.has(key)) RENDER_CACHE.delete(key);
    else if (RENDER_CACHE.size >= RENDER_CACHE_MAX) {
      const oldest = RENDER_CACHE.keys().next().value;
      RENDER_CACHE.delete(oldest);
    }
    RENDER_CACHE.set(key, value);
  }

  function renderGradientLayer(type, width, height, options = {}) {
    if (!supportsCanvas()) {
      return null;
    }
    const opts = normalizeOptions(options);
    const key = renderCacheKey(type, width, height, opts);
    const cached = getCachedRender(key);
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-hidden", "true");

    const renderers = {
      flow: renderFlow,
      linear: renderLinear,
      retro: renderRetro,
      pixel: renderPixel
    };
    const render = renderers[type] || renderers.flow;
    render(canvas, width, height, opts);

    const dataUrl = canvasToDataUrl(canvas, options.format);
    const css = `url("${dataUrl}")`;
    const result = {
      canvas,
      dataUrl,
      css,
      count: 1,
      sizes: ["cover"],
      positions: ["center"]
    };
    setCachedRender(key, result);
    return result;
  }

  return {
    supportsCanvas,
    renderGradientLayer,
    canvasToDataUrl
  };
});
