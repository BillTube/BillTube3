/* Phone-only follow mode. CyTube's scrollChat() is unconditional, including
   on resize and delayed image loads; guard it while someone reads history. */
BTFW.define("util:chat-scroll", [], async () => {
  const mq = window.matchMedia("(max-width: 768px), (max-width: 940px) and (max-height: 500px)");
  let buffer = null;
  let following = true;
  let pending = false;
  let touchY = null;
  let observer = null;
  let resizeObserver = null;
  let wrappedScroll = null;

  function isMobile() { return mq.matches; }
  function atBottom() {
    return buffer && buffer.scrollHeight - buffer.clientHeight - buffer.scrollTop <= 4;
  }
  function pause() {
    if (!isMobile()) return;
    following = false;
    window.SCROLLCHAT = false;
    // A native programmatic scroll can leave this set when no scroll event
    // fires. The next user gesture must not be swallowed by that stale flag.
    window.IGNORE_SCROLL_EVENT = false;
  }
  function follow() {
    following = true;
    window.SCROLLCHAT = true;
    scheduleFollow();
  }
  function scheduleFollow() {
    if (!isMobile() || !following || pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      // Recheck after the frame: an upward gesture may have happened since
      // the message/resize queued this work.
      if (!isMobile() || !following || !buffer) return;
      if (typeof window.scrollChat === "function") window.scrollChat();
      else buffer.scrollTop = buffer.scrollHeight;
    });
  }
  function guardNativeScroll() {
    if (typeof window.scrollChat !== "function" || window.scrollChat === wrappedScroll) return;
    const nativeScroll = window.scrollChat;
    wrappedScroll = function (...args) {
      if (isMobile() && !following) return;
      return nativeScroll.apply(this, args);
    };
    window.scrollChat = wrappedScroll;
  }
  function onScroll() {
    if (!isMobile()) return;
    following = !!atBottom();
    // CyTube treats the entire last message as its bottom threshold. A tall
    // GIF/movie card can therefore mark history as "caught up" prematurely.
    // Our listener runs after its listener and uses the actual bottom.
    window.SCROLLCHAT = following;
  }
  function onWheel(e) { if (e.deltaY < 0) pause(); }
  function onTouchStart(e) { touchY = e.touches[0]?.clientY ?? null; }
  function onTouchMove(e) {
    const y = e.touches[0]?.clientY;
    if (touchY !== null && y > touchY + 2) pause();
    if (typeof y === "number") touchY = y;
  }
  function onKey(e) {
    if (["ArrowUp", "PageUp", "Home"].includes(e.key)) pause();
  }
  function bind(next = document.getElementById("messagebuffer")) {
    guardNativeScroll();
    if (!next || next === buffer) return;
    if (buffer) {
      buffer.removeEventListener("scroll", onScroll);
      buffer.removeEventListener("wheel", onWheel);
      buffer.removeEventListener("touchstart", onTouchStart);
      buffer.removeEventListener("touchmove", onTouchMove);
      buffer.removeEventListener("keydown", onKey);
    }
    observer?.disconnect();
    resizeObserver?.disconnect();
    buffer = next;
    following = window.SCROLLCHAT !== false;
    buffer.addEventListener("scroll", onScroll, { passive: true });
    buffer.addEventListener("wheel", onWheel, { passive: true });
    buffer.addEventListener("touchstart", onTouchStart, { passive: true });
    buffer.addEventListener("touchmove", onTouchMove, { passive: true });
    buffer.addEventListener("keydown", onKey);
    observer = new MutationObserver(scheduleFollow);
    observer.observe(buffer, { childList: true, subtree: true });
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(scheduleFollow);
      resizeObserver.observe(buffer);
    }
    scheduleFollow();
  }
  document.addEventListener("click", (e) => {
    if (isMobile() && e.target.closest?.("#newmessages-indicator")) follow();
  }, true);
  const onModeChange = () => {
    // Entering phone mode respects an already paused desktop chat.
    following = window.SCROLLCHAT !== false;
    scheduleFollow();
  };
  if (mq.addEventListener) mq.addEventListener("change", onModeChange);
  else mq.addListener(onModeChange);
  return { bind, isMobile, scheduleFollow };
});
