/* BTFW — feature:mobileTabs — phone-only Channel menu + bottom sheet for the
   below-video stack. Each item (Playlist, MOTD, Polls, Featured Channels, …)
   opens from one compact button in the chat header. Items are re-parented
   into the sheet and returned to their exact
   slot on close, so CyTube's own handlers keep working. Desktop untouched. */
BTFW.define("feature:mobileTabs", [], async () => {
  const MQ = window.matchMedia("(max-width: 768px), (max-width: 940px) and (max-height: 500px)");
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
  let menuOpen = false;

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
    placeBar();

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
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && (openEntry || menuOpen)) closeSheet(); });
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
  }

  function placeBar() {
    if (!bar) return;
    const actions = $("#btfw-chat-topbar-actions");
    if (actions) {
      if (bar.parentElement !== actions) actions.prepend(bar);
    } else {
      const video = $("#videowrap");
      if (video?.parentElement && bar.parentElement !== video.parentElement) {
        video.parentElement.insertBefore(bar, video.nextSibling);
      }
    }
  }

  function stackItems() {
    return document.querySelectorAll("#btfw-stack .btfw-stack-list > .btfw-stack-item");
  }

  function openMenu() {
    closeSheet();
    menuOpen = true;
    sheet.querySelector(".btfw-msheet__title").textContent = "Channel";
    const body = sheet.querySelector(".btfw-msheet__body");
    body.textContent = "";
    const menu = document.createElement("div");
    menu.className = "btfw-msheet__sections";
    const items = Array.from(stackItems());
    const ratings = $("#btfw-ratings-wrapper");
    if (ratings?.querySelector("#btfw-ratings:not([hidden])")) items.push(ratings);
    items.forEach(item => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btfw-btn btfw-msheet__section";
      b.textContent = item === ratings ? "Rate movie" : shortLabel(item);
      b.addEventListener("click", () => openSheet(item, b.textContent, bar.firstElementChild));
      menu.appendChild(b);
    });
    body.appendChild(menu);
    bar.firstElementChild?.setAttribute("aria-expanded", "true");
    document.body.classList.add("btfw-mobile-sheet-open");
    sheet.querySelector(".btfw-msheet__close").focus({ preventScroll: true });
  }

  function buildTabs() {
    if (!bar) return;
    placeBar();
    // Reuse the trigger when stack items move into/out of the sheet, so a
    // queued stack observer cannot remove it after we restore focus to it.
    if (bar.firstElementChild) {
      stackItems().forEach(item => {
        if (/poll/i.test(shortLabel(item))) watchPolls(item, bar.firstElementChild);
      });
      return;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btfw-btn btfw-btn--sm btfw-btn--pill btfw-mtab";
    b.textContent = "Channel";
    b.setAttribute("aria-label", "Open channel sections");
    b.setAttribute("aria-haspopup", "dialog");
    b.setAttribute("aria-controls", "btfw-mobile-sheet");
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", () => {
      if (openEntry || menuOpen) closeSheet();
      else openMenu();
    });
    bar.appendChild(b);
    const items = stackItems();
    items.forEach((item) => {
      const label = shortLabel(item);
      if (/poll/i.test(label)) watchPolls(item, b);
    });
  }

  function openSheet(item, label, tab) {
    closeSheet();
    ensureUI();
    const placeholder = document.createComment("btfw-mtab-slot");
    item.parentNode.insertBefore(placeholder, item);
    sheet.querySelector(".btfw-msheet__title").textContent = label;
    sheet.querySelector(".btfw-msheet__body").textContent = "";
    sheet.querySelector(".btfw-msheet__body").appendChild(item);
    openEntry = { item, placeholder, tab };
    tab.classList.add("is-active");
    tab.setAttribute("aria-expanded", "true");
    document.body.classList.add("btfw-mobile-sheet-open");
    sheet.querySelector(".btfw-msheet__close").focus({ preventScroll: true });
  }

  function closeSheet() {
    const wasOpen = menuOpen || !!openEntry;
    menuOpen = false;
    document.body.classList.remove("btfw-mobile-sheet-open");
    if (openEntry) {
      const { item, placeholder, tab } = openEntry;
      if (placeholder.parentNode) {
        placeholder.parentNode.insertBefore(item, placeholder);
        placeholder.remove();
      }
      tab.classList.remove("is-active");
      openEntry = null;
    }
    sheet?.querySelector(".btfw-msheet__body").replaceChildren();
    bar?.firstElementChild?.setAttribute("aria-expanded", "false");
    if (wasOpen && MQ.matches) bar?.firstElementChild?.focus({ preventScroll: true });
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
      if (!openEntry && !menuOpen) buildTabs();
      document.body.classList.add("btfw-mobile-tabs-active");
      if (!listObserver) {
        const list = $("#btfw-stack .btfw-stack-list");
        if (list) {
          // channel modules add stack items after boot (e.g. custom widgets)
          listObserver = new MutationObserver(() => { if (!openEntry && !menuOpen) buildTabs(); });
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
    document.addEventListener("btfw:chat:barsReady", placeBar);
    setTimeout(apply, 1500); // catch stack items added late by channel modules
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:mobileTabs" };
});
