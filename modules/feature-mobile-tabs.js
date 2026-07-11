/* BTFW — feature:mobileTabs — phone-only tab bar + bottom sheet for the
   below-video stack. On phones the main page stays video + chat; each stack
   item (Playlist, MOTD, Polls, Featured Channels, …) opens in a slide-up
   sheet from a pill bar under the video instead of stacking into one long
   scroll. Items are re-parented into the sheet and returned to their exact
   slot on close, so CyTube's own handlers keep working. Desktop untouched. */
BTFW.define("feature:mobileTabs", [], async () => {
  const MQ = window.matchMedia("(max-width: 768px)");
  const LABELS = [
    [/message of the day|motd/i, "MOTD"],
    [/playlist|queue/i, "Playlist"],
    [/poll/i, "Polls"],
    [/featured channels/i, "Channels"],
    [/clock/i, "Clock"]
  ];

  let bar = null, sheet = null, backdrop = null;
  let listObserver = null, pollObserver = null;
  let openEntry = null; // { item, placeholder, tab }

  const $ = (s, r) => (r || document).querySelector(s);

  function shortLabel(item) {
    const raw = ($(".btfw-stack-item__title", item)?.textContent || "").trim();
    for (const [re, lab] of LABELS) if (re.test(raw)) return lab;
    const clean = raw.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️]/gu, "").trim();
    return clean.length > 14 ? clean.slice(0, 14) + "…" : (clean || "More");
  }

  function ensureUI() {
    if (bar) return;
    bar = document.createElement("div");
    bar.id = "btfw-mobile-tabbar";
    const video = $("#videowrap");
    if (video && video.parentElement) {
      video.parentElement.insertBefore(bar, video.nextSibling);
    } else {
      document.body.appendChild(bar);
    }

    backdrop = document.createElement("div");
    backdrop.id = "btfw-mobile-sheet-backdrop";
    backdrop.addEventListener("click", closeSheet);

    sheet = document.createElement("div");
    sheet.id = "btfw-mobile-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.innerHTML = `
      <span class="btfw-msheet__grab" aria-hidden="true"></span>
      <div class="btfw-msheet__head">
        <span class="btfw-msheet__title"></span>
        <button type="button" class="btfw-msheet__close" aria-label="Close">&times;</button>
      </div>
      <div class="btfw-msheet__body"></div>`;
    sheet.querySelector(".btfw-msheet__close").addEventListener("click", closeSheet);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openEntry) closeSheet(); });
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
  }

  function buildTabs() {
    if (!bar) return;
    bar.textContent = "";
    const items = document.querySelectorAll("#btfw-stack .btfw-stack-list > .btfw-stack-item");
    items.forEach((item) => {
      const label = shortLabel(item);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btfw-btn btfw-btn--sm btfw-btn--pill btfw-mtab";
      b.textContent = label;
      b.addEventListener("click", () => {
        if (openEntry && openEntry.item === item) { closeSheet(); return; }
        openSheet(item, label, b);
      });
      bar.appendChild(b);
      if (/poll/i.test(label)) watchPolls(item, b);
    });
  }

  function openSheet(item, label, tab) {
    closeSheet();
    ensureUI();
    const placeholder = document.createComment("btfw-mtab-slot");
    item.parentNode.insertBefore(placeholder, item);
    sheet.querySelector(".btfw-msheet__title").textContent = label;
    sheet.querySelector(".btfw-msheet__body").appendChild(item);
    openEntry = { item, placeholder, tab };
    tab.classList.add("is-active");
    document.body.classList.add("btfw-mobile-sheet-open");
  }

  function closeSheet() {
    document.body.classList.remove("btfw-mobile-sheet-open");
    if (!openEntry) return;
    const { item, placeholder, tab } = openEntry;
    if (placeholder.parentNode) {
      placeholder.parentNode.insertBefore(item, placeholder);
      placeholder.remove();
    }
    tab.classList.remove("is-active");
    openEntry = null;
  }

  function watchPolls(item, tab) {
    if (pollObserver) pollObserver.disconnect();
    const sync = () => {
      const live = item.querySelector("#pollwrap .well.active, #pollwrap .well");
      tab.classList.toggle("has-badge", Boolean(live));
    };
    pollObserver = new MutationObserver(sync);
    pollObserver.observe(item, { childList: true, subtree: true });
    sync();
  }

  function apply() {
    if (MQ.matches) {
      ensureUI();
      buildTabs();
      document.body.classList.add("btfw-mobile-tabs-active");
      if (!listObserver) {
        const list = $("#btfw-stack .btfw-stack-list");
        if (list) {
          // channel modules add stack items after boot (e.g. custom widgets)
          listObserver = new MutationObserver(() => { if (!openEntry) buildTabs(); });
          listObserver.observe(list, { childList: true });
        }
      }
    } else {
      closeSheet();
      document.body.classList.remove("btfw-mobile-tabs-active");
      if (listObserver) { listObserver.disconnect(); listObserver = null; }
    }
  }

  function ensureViewportFit() {
    // env(safe-area-inset-*) stays 0 on notched phones unless the viewport
    // meta opts in with viewport-fit=cover; the safe-area rules in mobile.css
    // then keep the video/chat clear of the notch and home indicator.
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content = "width=device-width, initial-scale=1";
      document.head.appendChild(meta);
    }
    if (!/viewport-fit/i.test(meta.content)) {
      meta.content = meta.content.replace(/\s*$/, "") + ", viewport-fit=cover";
    }
  }

  function boot() {
    ensureViewportFit();
    apply();
    if (MQ.addEventListener) MQ.addEventListener("change", apply);
    else if (MQ.addListener) MQ.addListener(apply);
    document.addEventListener("btfw:ready", apply, { once: true });
    setTimeout(apply, 1500); // catch stack items added late by channel modules
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:mobileTabs" };
});
