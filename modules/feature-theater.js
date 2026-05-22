/* BTFW — feature:theater
   Twitch/Kick-style theater mode: video fills the viewport vertically
   while chat stays pinned on its current side. Hides the navbar and the
   under-video stack (MOTD, playlist, channels, etc.) and the footer.
   Respects --btfw-grid--chat-left vs --chat-right; the body.btfw-theater
   class is the single source of truth so the layout flips accordingly.
*/
BTFW.define("feature:theater", [], async () => {
  const STATE_KEY = "btfw:theater";
  const BODY_CLASS = "btfw-theater";
  const STYLE_ID = "btfw-theater-style";

  function isOn() { return document.body.classList.contains(BODY_CLASS); }

  function apply(on) {
    document.body.classList.toggle(BODY_CLASS, !!on);
    try { localStorage.setItem(STATE_KEY, on ? "1" : "0"); } catch {}
    const btn = document.getElementById("btfw-vo-theater");
    if (btn) {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = on ? "Exit theater mode (T)" : "Theater mode (T)";
    }
    document.dispatchEvent(new CustomEvent("btfw:theaterChanged", { detail: { on } }));
    // Nudge the player to recompute its dimensions when the layout changes.
    requestAnimationFrame(() => {
      try { window.dispatchEvent(new Event("resize")); } catch (_) {}
    });
  }

  function toggle() { apply(!isOn()); }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* === Theater mode ====================================================
         The body.btfw-theater toggle collapses everything to a 100vh single
         row of "video | splitter | chat", with the chat on whichever side
         the user already selected (.btfw-grid--chat-left or --chat-right).
      */
      body.btfw-theater { overflow: hidden; }
      body.btfw-theater #btfw-navhost { display: none !important; }

      /* Hide everything in the video column except the player itself —
         the under-video stack (MOTD, playlist, featured channels, …) lives
         in #btfw-leftpad next to #videowrap. */
      body.btfw-theater #btfw-leftpad > :not(#videowrap) { display: none !important; }
      body.btfw-theater #btfw-stack,
      body.btfw-theater #btfw-stack-footer,
      body.btfw-theater #btfw-footer { display: none !important; }

      /* Collapse the grid to one full-viewport row. */
      body.btfw-theater #btfw-grid {
        --btfw-top: 0px;
        --btfw-gap: 0px;
        height: 100vh !important;
        min-height: 100vh !important;
        grid-template-rows: 100vh !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      body.btfw-theater #btfw-grid.btfw-grid--chat-left {
        grid-template-areas: "chat split video" !important;
      }
      body.btfw-theater #btfw-grid.btfw-grid--chat-right {
        grid-template-areas: "video split chat" !important;
      }
      body.btfw-theater #btfw-leftpad,
      body.btfw-theater #btfw-chatcol {
        height: 100vh !important;
        max-height: 100vh !important;
        top: 0 !important;
        margin: 0 !important;
      }
      body.btfw-theater #videowrap {
        flex: 1 1 auto !important;
        height: 100% !important;
        max-height: 100vh !important;
        margin: 0 !important;
        border-radius: 0 !important;
      }
      body.btfw-theater #videowrap > *,
      body.btfw-theater #ytapiplayer,
      body.btfw-theater #ytapiplayer > video,
      body.btfw-theater #ytapiplayer > iframe {
        height: 100% !important;
        max-height: 100vh !important;
      }

      /* Theater toggle button — same chrome as the rest of the video-overlay
         icons. Tints accent + flips icon when theater mode is on. */
      #btfw-vo-theater {
        color: var(--btfw-color-text);
      }
      #btfw-vo-theater[aria-pressed="true"] {
        color: var(--btfw-color-accent);
      }
      #btfw-vo-theater > i { line-height: 1; }
    `;
    document.head.appendChild(style);
  }

  function ensureButton() {
    ensureStyles();
    const host = document.getElementById("btfw-vo-right")
              || document.querySelector("#btfw-video-overlay #btfw-vo-bar");
    if (!host) return null;
    let btn = document.getElementById("btfw-vo-theater");
    if (btn) {
      if (btn.parentElement !== host) host.appendChild(btn);
      return btn;
    }
    btn = document.createElement("button");
    btn.id = "btfw-vo-theater";
    btn.type = "button";
    btn.className = "btn btn-sm btn-default btfw-vo-btn";
    btn.setAttribute("aria-pressed", "false");
    btn.title = "Theater mode (T)";
    btn.setAttribute("aria-label", "Toggle theater mode");
    btn.innerHTML = '<i class="fa fa-expand" aria-hidden="true"></i>';
    btn.addEventListener("click", (e) => { e.preventDefault(); toggle(); });

    // Slot it before the native fullscreen control if we can find it, else
    // just append to the right section.
    const fs = host.querySelector(".vjs-fullscreen-control")
            || Array.from(host.querySelectorAll("button"))
                   .find(b => /fullscreen/i.test(b.title || b.getAttribute("aria-label") || ""));
    if (fs && fs.parentElement === host) host.insertBefore(btn, fs);
    else host.appendChild(btn);
    return btn;
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function bindKeys() {
    document.addEventListener("keydown", (e) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape" && isOn()) { apply(false); return; }
      if ((e.key === "t" || e.key === "T") && !isTypingTarget(e.target)) {
        if (e.shiftKey) return; // leave SHIFT+T to other handlers
        e.preventDefault();
        toggle();
      }
    });
  }

  function restoreFromStorage() {
    try { if (localStorage.getItem(STATE_KEY) === "1") apply(true); } catch (_) {}
  }

  function boot() {
    ensureStyles();
    ensureButton();
    // Re-attach button when the video overlay rebuilds (e.g. layout reset).
    document.addEventListener("btfw:layoutReady", () => ensureButton(), { passive: true });
    document.addEventListener("btfw:videoOverlayReady", () => ensureButton(), { passive: true });
    // Retry a few times in case the video overlay is built after us.
    let retries = 0;
    const t = setInterval(() => {
      if (document.getElementById("btfw-vo-theater") || retries++ > 20) {
        clearInterval(t);
        return;
      }
      ensureButton();
    }, 500);
    bindKeys();
    restoreFromStorage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { name: "feature:theater", toggle, isOn, apply };
});
