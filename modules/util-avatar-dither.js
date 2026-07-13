/* BTFW — util:avatar-dither
   Dependency-free, deterministic fallback avatars inspired by ordered-dither
   identicons. A name supplies 32 pattern bits, a mirror axis, and a hue, so the
   same user gets the same crisp avatar everywhere without a network request.
*/
BTFW.define("util:avatar-dither", [], async () => {
  const VERSION = "dither-v1";
  const CACHE_LIMIT = 240;
  const cache = new Map();

  function normalizedName(name) {
    const raw = String(name || "Guest").trim() || "Guest";
    try { return raw.normalize("NFKC").toLowerCase(); }
    catch (_) { return raw.toLowerCase(); }
  }

  // FNV-1a: compact, deterministic across browsers, and well distributed for
  // the short usernames this generator receives.
  function hash32(value) {
    const input = String(value);
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  function bitCount(value) {
    let bits = value >>> 0;
    let count = 0;
    while (bits) {
      bits &= bits - 1;
      count++;
    }
    return count;
  }

  function encodeSvg(svg) {
    const binary = encodeURIComponent(svg).replace(/%([0-9A-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    return "data:image/svg+xml;base64," + btoa(binary);
  }

  function dataUrl(name, sizePx) {
    const key = normalizedName(name);
    const size = Math.max(16, Math.min(128, parseInt(sizePx, 10) || 40));
    const cacheKey = `${VERSION}:${key}:${size}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    // 32 independent cells are mirrored into an 8×8 mark. Extremely sparse
    // or dense hashes are folded once so every result remains legible at 28px.
    let patternBits = hash32(key + "\u0000pattern");
    const density = bitCount(patternBits);
    if (density < 8 || density > 24) patternBits = (patternBits ^ 0x5aa5a55a) >>> 0;

    const styleBits = hash32(key + "\u0000style");
    const toneBits = hash32(key + "\u0000tone");
    const foldLeftRight = (styleBits & 1) === 0;
    const hue = ((styleBits >>> 1) % 180) * 2;
    const companionHue = (hue + 24 + ((styleBits >>> 10) % 38)) % 360;

    const background = `hsl(${hue}, 38%, 7%)`;
    const backgroundLift = `hsl(${companionHue}, 42%, 12%)`;
    const foreground = `hsl(${hue}, 92%, 60%)`;
    const highlight = `hsl(${companionHue}, 94%, 70%)`;
    const border = `hsl(${hue}, 78%, 56%)`;

    const cell = 7;
    const inset = 4;
    const cellSize = 6;
    let cells = "";

    function addCell(x, y, fill) {
      cells += `<rect x="${inset + x * cell}" y="${inset + y * cell}" width="${cellSize}" height="${cellSize}" fill="${fill}"/>`;
    }

    for (let bit = 0; bit < 32; bit++) {
      if (((patternBits >>> bit) & 1) === 0) continue;

      let x;
      let y;
      let mirrorX;
      let mirrorY;
      if (foldLeftRight) {
        x = bit % 4;
        y = Math.floor(bit / 4);
        mirrorX = 7 - x;
        mirrorY = y;
      } else {
        x = bit % 8;
        y = Math.floor(bit / 8);
        mirrorX = x;
        mirrorY = 7 - y;
      }

      const tone = (toneBits >>> (bit % 29)) & 3;
      const fill = tone === 0 ? highlight
        : tone === 1 ? "url(#dense)"
        : tone === 2 ? foreground
        : "url(#cut)";
      addCell(x, y, fill);
      addCell(mirrorX, mirrorY, fill);
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" shape-rendering="crispEdges">`
      + `<defs>`
      + `<linearGradient id="backdrop" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${backgroundLift}"/><stop offset="1" stop-color="${background}"/></linearGradient>`
      + `<pattern id="dense" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="${foreground}"/><path d="M0 0h2v2H0zM2 2h2v2H2z" fill="${highlight}"/></pattern>`
      + `<pattern id="cut" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="${foreground}"/><path d="M2 0h2v2H2zM0 2h2v2H0z" fill="${background}" fill-opacity=".82"/></pattern>`
      + `<pattern id="grain" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0h1v1H0zM2 2h1v1H2z" fill="${border}" fill-opacity=".18"/></pattern>`
      + `</defs>`
      + `<rect width="64" height="64" fill="url(#backdrop)"/>`
      + `<rect width="64" height="64" fill="url(#grain)"/>`
      + `<g>${cells}</g>`
      + `<rect x=".75" y=".75" width="62.5" height="62.5" rx="8.5" fill="none" stroke="${border}" stroke-opacity=".42" stroke-width="1.5"/>`
      + `</svg>`;

    const result = encodeSvg(svg);
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, result);
    return result;
  }

  return {
    name: "util:avatar-dither",
    version: VERSION,
    dataUrl,
    getCacheStats: () => ({ size: cache.size, limit: CACHE_LIMIT })
  };
});
