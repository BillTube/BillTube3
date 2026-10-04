/* Keep media near the chat viewport active. Distant images release their
   animated source while an intrinsic-size placeholder preserves row layout. */
BTFW.define("util:chat-media-visibility", [], async () => {
  const BUFFER_PX = 600;
  const SELECTOR = "img.channel-emote, img.chat-picture, img.twemoji, img.emote";
  let buffer = null;
  let intersections = null;
  let mutations = null;
  const media = new Map();

  function getSource(img) {
    return media.get(img)?.source || img.dataset.btfwMediaSrc || img.getAttribute("src") || "";
  }
  function rememberSize(img, state) {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      state.width = img.naturalWidth;
      state.height = img.naturalHeight;
    }
  }
  function placeholder(state) {
    return "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${state.width}" height="${state.height}"/>`
    );
  }
  function swap(img, state, source) {
    state.pendingSwap = source;
    img.setAttribute("src", source);
  }
  function suspend(img, state) {
    // Load once to learn the real aspect ratio. Never collapse an unknown-size
    // image or reintroduce estimated message heights.
    if (state.suspended || !state.width || !state.height || !state.source) return;
    // An external source update must finish loading before we cache its URL
    // and dimensions; don't replace it with the previous image's placeholder.
    if (img.getAttribute("src") !== state.source) return;
    state.suspended = true;
    img.dataset.btfwMediaSrc = state.source;
    if (state.srcset) img.dataset.btfwMediaSrcset = state.srcset;
    img.removeAttribute("srcset");
    state.placeholderSource = placeholder(state);
    swap(img, state, state.placeholderSource);
  }
  function restore(img, state) {
    if (!state.suspended) return;
    state.suspended = false;
    // Eager within our overscan: start restoring BEFORE it reaches view.
    img.loading = "eager";
    if (state.srcset) img.setAttribute("srcset", state.srcset);
    swap(img, state, state.source);
    delete img.dataset.btfwMediaSrc;
    delete img.dataset.btfwMediaSrcset;
  }
  function sync(img, state) {
    if (document.hidden || !state.near) suspend(img, state);
    else {
      img.loading = "eager";
      restore(img, state);
    }
  }
  function setSource(img, source) {
    if (!source || getSource(img) === source) return;
    const state = media.get(img);
    if (!state) { img.setAttribute("src", source); return; }
    state.source = source;
    if (state.suspended) img.dataset.btfwMediaSrc = source;
    else swap(img, state, source);
  }
  function onLoad(e) {
    const img = e.target;
    const state = media.get(img);
    if (!state) return;
    if (state.pendingSwap && img.getAttribute("src") === state.pendingSwap) {
      // CyTube's old image-load handler adds the image height to scrollTop
      // while reading history. Our same-size swaps must not run that handler.
      e.stopImmediatePropagation();
      state.pendingSwap = null;
    }
    const source = img.getAttribute("src") || "";
    if (state.suspended && source !== state.placeholderSource) {
      state.suspended = false;
      delete img.dataset.btfwMediaSrc;
      delete img.dataset.btfwMediaSrcset;
    }
    if (!state.suspended) {
      state.source = source;
      state.srcset = img.getAttribute("srcset") || "";
      rememberSize(img, state);
    }
    // Let the FIRST real load reach normal image handlers before suspending.
    queueMicrotask(() => { if (media.get(img) === state) sync(img, state); });
  }
  function watch(img) {
    if (media.has(img) || !img.matches(SELECTOR) || img.closest("picture")) return;
    const saved = img.dataset.btfwMediaSrc;
    const state = {
      source: saved || img.getAttribute("src") || "",
      srcset: img.dataset.btfwMediaSrcset || img.getAttribute("srcset") || "",
      width: 0, height: 0, near: !saved, suspended: !!saved,
      pendingSwap: saved ? img.getAttribute("src") : null,
      placeholderSource: saved ? img.getAttribute("src") : null
    };
    media.set(img, state);
    img.loading = "lazy";
    img.decoding = "async";
    if (img.complete) rememberSize(img, state);
    intersections?.observe(img);
    if (saved && !intersections) { state.near = true; restore(img, state); }
    if (document.hidden) sync(img, state);
  }
  function processNode(node) {
    if (node.nodeType !== 1) return;
    if (node.matches(SELECTOR)) watch(node);
    node.querySelectorAll(SELECTOR).forEach(watch);
  }
  function release(img, state) {
    intersections?.unobserve(img);
    // Restore nodes moved elsewhere; detached history can keep its cheap
    // placeholder, and its data attributes allow re-adoption later.
    if (img.isConnected) restore(img, state);
    media.delete(img);
  }
  function onMutations(records) {
    for (const record of records) record.addedNodes.forEach(processNode);
    if (records.some(record => record.removedNodes.length)) {
      for (const [img, state] of media) {
        if (!buffer.contains(img)) release(img, state);
      }
    }
  }
  function bind(next = document.getElementById("messagebuffer")) {
    if (!next || next === buffer) return;
    if (buffer) buffer.removeEventListener("load", onLoad, true);
    mutations?.disconnect();
    intersections?.disconnect();
    for (const [img, state] of media) release(img, state);
    buffer = next;
    intersections = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        const state = media.get(entry.target);
        if (!state) continue;
        state.near = entry.isIntersecting;
        sync(entry.target, state);
      }
    }, { root: buffer, rootMargin: `${BUFFER_PX}px 0px`, threshold: 0 }) : null;
    buffer.addEventListener("load", onLoad, true);
    processNode(buffer);
    mutations = new MutationObserver(onMutations);
    mutations.observe(buffer, { childList: true, subtree: true });
  }
  document.addEventListener("visibilitychange", () => {
    for (const [img, state] of media) sync(img, state);
  });
  return { bind, getSource, setSource };
});
