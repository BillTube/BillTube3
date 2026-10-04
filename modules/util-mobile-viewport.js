/* Track the visible phone area without treating pinch zoom as a keyboard.
   Keep the pre-keyboard orientation: a keyboard can make a portrait layout
   viewport shorter than it is wide on browsers that resize both viewports. */
BTFW.define("util:mobileViewport", [], async () => {
  const mq = window.matchMedia("(max-width: 768px), (max-width: 940px) and (max-height: 500px)");
  let idleHeight = 0;
  let lastWidth = 0;

  function sync() {
    const body = document.body;
    if (!body) return;
    const root = document.documentElement;
    if (!mq.matches) {
      body.classList.remove("btfw-phone-keyboard", "btfw-phone-landscape");
      idleHeight = lastWidth = 0;
      return;
    }
    const vv = window.visualViewport;
    const height = vv?.height || window.innerHeight;
    const unscaledHeight = height * (vv?.scale || 1);
    const width = window.innerWidth;
    const editing = !!document.activeElement?.matches('textarea, [contenteditable="true"], input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"])');
    // A width change identifies rotation, rather than keyboard opening.
    if (!lastWidth || Math.abs(width - lastWidth) > 50 || !editing) {
      idleHeight = Math.max(window.innerHeight, unscaledHeight);
    }
    lastWidth = width;
    const keyboard = editing && idleHeight - unscaledHeight > 120;
    body.classList.toggle("btfw-phone-keyboard", keyboard);
    body.classList.toggle("btfw-phone-landscape", width > idleHeight);
    root.style.setProperty("--btfw-phone-height", height + "px");
    root.style.setProperty("--btfw-phone-top", (vv?.offsetTop || 0) + "px");
  }

  // Safari may report the final keyboard viewport after the focus event.
  function settleFocus() {
    sync();
    [120, 350].forEach(delay => setTimeout(sync, delay));
  }
  document.addEventListener("focusin", settleFocus);
  document.addEventListener("focusout", settleFocus);
  window.addEventListener("resize", sync);
  window.visualViewport?.addEventListener("resize", sync);
  window.visualViewport?.addEventListener("scroll", sync);
  sync();
  return { sync };
});
