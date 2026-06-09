/* BTFW — util:anime
   Lazy wrapper around anime.js v4 (MIT). The ~10KB UMD bundle is fetched from
   the CDN the FIRST time an animation is actually requested — never on page or
   chat load — then cached on window.anime. Everything is a no-op under
   prefers-reduced-motion, and degrades gracefully (elements just appear) if the
   CDN can't be reached.

   API:
     load()                  -> Promise<anime|null>   (warm it up early if you like)
     reducedMotion()         -> boolean
     staggerIn(els, opts)    -> reveal a list of elements one-by-one
     popIn(el, opts)         -> spring scale+fade entrance for one element
*/
BTFW.define("util:anime", [], async () => {
  const CDN = "https://cdn.jsdelivr.net/npm/animejs@4/dist/bundles/anime.umd.min.js";
  let loadPromise = null;

  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (_) { return false; }
  }

  function load() {
    if (window.anime && window.anime.animate) return Promise.resolve(window.anime);
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = CDN;
      s.async = true;
      s.onload = () => resolve((window.anime && window.anime.animate) ? window.anime : null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
    return loadPromise;
  }

  // Reveal a set of elements with a quick staggered fade + slight rise. Caps the
  // animated count so huge grids stay cheap; anything past the cap just appears.
  async function staggerIn(els, opts = {}) {
    const all = Array.from(els || []);
    if (!all.length || reducedMotion()) return;
    const list = all.slice(0, opts.max || 48);
    // Hide immediately so there's no flash while the CDN bundle downloads.
    list.forEach(e => { e.style.opacity = "0"; });
    const a = await load();
    if (!a || !a.animate) { list.forEach(e => { e.style.opacity = ""; }); return; }
    try {
      a.animate(list, {
        opacity: [0, 1],
        translateY: [opts.dy != null ? opts.dy : 6, 0],
        duration: opts.duration || 360,
        delay: a.stagger ? a.stagger(opts.stagger || 14, { start: opts.start || 0 }) : 0,
        ease: opts.ease || "out(3)"
      });
    } catch (_) { list.forEach(e => { e.style.opacity = ""; }); }
  }

  // Spring scale + fade entrance for a single element (modals, toasts).
  async function popIn(el, opts = {}) {
    if (!el || reducedMotion()) return;
    el.style.opacity = "0";
    const a = await load();
    if (!a || !a.animate) { el.style.opacity = ""; return; }
    try {
      const ease = opts.ease || (a.createSpring ? a.createSpring({ stiffness: 130, damping: 14 }) : "outBack");
      a.animate(el, {
        opacity: [0, 1],
        scale: [opts.from != null ? opts.from : 0.94, 1],
        translateY: [opts.dy != null ? opts.dy : 6, 0],
        duration: opts.duration || 440,
        ease
      });
    } catch (_) { el.style.opacity = ""; }
  }

  // Count a number up into an element's text. opts: { from, duration, decimals, prefix, suffix, ease }
  async function countUp(el, to, opts = {}) {
    if (!el) return;
    to = Number(to) || 0;
    const dec = opts.decimals || 0;
    const fmt = (v) => (opts.prefix || "") + (dec ? Number(v).toFixed(dec) : Math.round(v)) + (opts.suffix || "");
    if (reducedMotion()) { el.textContent = fmt(to); return; }
    const a = await load();
    if (!a || !a.animate) { el.textContent = fmt(to); return; }
    const st = { v: opts.from != null ? opts.from : 0 };
    try {
      a.animate(st, {
        v: to,
        duration: opts.duration || 800,
        ease: opts.ease || "out(3)",
        onUpdate: () => { el.textContent = fmt(st.v); }
      });
    } catch (_) { el.textContent = fmt(to); }
  }

  return { name: "util:anime", load, reducedMotion, staggerIn, popIn, countUp };
});
