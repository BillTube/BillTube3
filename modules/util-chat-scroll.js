/* Shared chat follow mode. Every native/DOM/media scroll request is batched
   into a frame, and reading history pauses follow until a fresh message. */
BTFW.define("util:chat-scroll", [], async () => {
  const PAUSE_MS = 25_000;
  const mq = window.matchMedia("(max-width: 768px), (max-width: 940px) and (max-height: 500px)");
  let buffer = null;
  let following = true;
  let pausedUntil = 0;
  let pending = false;
  let touchY = null;
  let lastTop = 0;
  let lastHeight = 0;
  let lastClientHeight = 0;
  let observer = null;
  let resizeObserver = null;
  let wrappedScroll = null;
  let nativeScroll = null;
  const observedRows = new Set();
  const nativeScrollEvents = new WeakSet();

  function isMobile() { return mq.matches; }
  function atBottom() {
    return buffer && buffer.scrollHeight - buffer.clientHeight - buffer.scrollTop <= 4;
  }
  function rememberPosition() {
    lastTop = buffer.scrollTop;
    lastHeight = buffer.scrollHeight;
    lastClientHeight = buffer.clientHeight;
  }
  function pause() {
    following = false;
    pausedUntil = Date.now() + PAUSE_MS;
    window.SCROLLCHAT = false;
    // A native write that didn't move can leave this flag set indefinitely.
    window.IGNORE_SCROLL_EVENT = false;
  }
  function follow() {
    pausedUntil = 0;
    following = true;
    window.SCROLLCHAT = true;
    scheduleFollow();
  }
  function onNewMessage() {
    // No timer scroll: only a message arriving AFTER the quiet period resumes.
    if (!following && pausedUntil && Date.now() >= pausedUntil) follow();
    else scheduleFollow();
  }
  function scheduleFollow() {
    if (!buffer || !following || pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      // An upward gesture can cancel work queued by an earlier message.
      if (!following || !buffer) return;
      window.SCROLLCHAT = true;
      const bottom = Math.max(0, buffer.scrollHeight - buffer.clientHeight);
      // Don't write the same position again (or leave IGNORE_SCROLL_EVENT set).
      if (Math.abs(buffer.scrollTop - bottom) > 1 || document.getElementById("newmessages-indicator")) {
        const previousTop = buffer.scrollTop;
        if (nativeScroll) nativeScroll.call(window);
        else buffer.scrollTop = bottom;
        if (buffer.scrollTop === previousTop) window.IGNORE_SCROLL_EVENT = false;
      }
      rememberPosition();
    });
  }
  function guardNativeScroll() {
    if (typeof window.scrollChat !== "function" || window.scrollChat === wrappedScroll) return;
    nativeScroll = window.scrollChat;
    wrappedScroll = function () {
      // Resize and delayed image callbacks must never end a reading pause.
      if (!following) {
        window.SCROLLCHAT = false;
        return;
      }
      scheduleFollow();
    };
    window.scrollChat = wrappedScroll;
  }
  function captureScroll(e) {
    // CyTube consumes this flag in its earlier bubble listener. Capture it
    // first: preserving history during trimming isn't a fresh user gesture.
    if (window.IGNORE_SCROLL_EVENT) nativeScrollEvents.add(e);
  }
  function onScroll(e) {
    // Wheel/touch/key intent is caught before movement. This also catches
    // scrollbar dragging without mistaking buffer trimming/resizing for input.
    const sameSize = buffer.scrollHeight === lastHeight && buffer.clientHeight === lastClientHeight;
    if (!nativeScrollEvents.has(e) && sameSize && buffer.scrollTop < lastTop - 1) pause();
    // Layout/media growth can move the bottom between a programmatic write
    // and its scroll event. Only upward input pauses an active follower.
    else if (!following && !pausedUntil && sameSize && atBottom()) following = true;
    rememberPosition();
    // Override CyTube's whole-last-message threshold (wrong for tall GIFs).
    window.SCROLLCHAT = following;
  }
  function onWheel(e) { if (e.deltaY < 0) pause(); }
  function onTouchStart(e) { touchY = e.touches[0]?.clientY ?? null; }
  function onTouchMove(e) {
    const y = e.touches[0]?.clientY;
    if (touchY !== null && y > touchY + 2) pause();
    if (typeof y === "number") touchY = y;
  }
  function onTouchEnd() { touchY = null; }
  function onKey(e) {
    if (e.target?.closest?.("input, textarea, select, [contenteditable]")) return;
    if (["ArrowUp", "PageUp", "Home"].includes(e.key) || (e.key === " " && e.shiftKey)) pause();
  }
  function observeRows() {
    if (!resizeObserver) return;
    const rows = new Set(Array.from(buffer.children));
    for (const row of observedRows) {
      if (!rows.has(row)) {
        resizeObserver.unobserve(row);
        observedRows.delete(row);
      }
    }
    for (const row of rows) {
      if (observedRows.has(row)) continue;
      resizeObserver.observe(row);
      observedRows.add(row);
    }
  }
  function onMutations(records) {
    observeRows();
    // Decorating an existing row or removing old history isn't a new message.
    const newMessage = records.some(record => record.target === buffer &&
      Array.from(record.addedNodes).some(node => node.nodeType === 1));
    if (newMessage) onNewMessage();
    else scheduleFollow();
  }
  function onResize() {
    // Remember layout changes even while paused so the next scrollbar gesture
    // can be distinguished from a resize or a trimmed row.
    if (buffer && (buffer.scrollHeight !== lastHeight || buffer.clientHeight !== lastClientHeight)) {
      rememberPosition();
    }
    scheduleFollow();
  }
  const listeners = {
    scroll: onScroll, wheel: onWheel, touchstart: onTouchStart,
    touchmove: onTouchMove, touchend: onTouchEnd, touchcancel: onTouchEnd,
    keydown: onKey, load: scheduleFollow, loadedmetadata: scheduleFollow
  };
  function bind(next = document.getElementById("messagebuffer")) {
    guardNativeScroll();
    if (!next || next === buffer) return;
    if (buffer) {
      buffer.removeEventListener("scroll", captureScroll, true);
      for (const [name, handler] of Object.entries(listeners)) {
        buffer.removeEventListener(name, handler, name === "load" || name === "loadedmetadata");
      }
    }
    observer?.disconnect();
    resizeObserver?.disconnect();
    observedRows.clear();
    buffer = next;
    touchY = null;
    following = !pausedUntil && window.SCROLLCHAT !== false;
    rememberPosition();
    // Binding establishes the baseline even if an earlier native write never
    // emitted a scroll event. Don't let its stale flag hide the next gesture.
    window.IGNORE_SCROLL_EVENT = false;
    buffer.addEventListener("scroll", captureScroll, { passive: true, capture: true });
    for (const [name, handler] of Object.entries(listeners)) {
      buffer.addEventListener(name, handler, {
        passive: true, capture: name === "load" || name === "loadedmetadata"
      });
    }
    observer = new MutationObserver(onMutations);
    observer.observe(buffer, { childList: true, subtree: true });
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(buffer);
      observeRows();
    }
    scheduleFollow();
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest?.("#newmessages-indicator")) follow();
  }, true);
  return { bind, isMobile, scheduleFollow };
});
