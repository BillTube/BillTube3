BTFW.define("feature:styleCore", [], async () => {

  function ensureSlate() {
    // CyTube serves its viewer-selected bootswatch build from /css/themes/
    // (e.g. /css/themes/slate.css) — an href the old regex could not match,
    // which made this fallback double-load 129KB of Slate on cytu.be. The
    // inject remains as a fallback for host pages with no Bootstrap CSS.
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const hasBootSlate = links.some(l => /(bootstrap.*\.css|bootswatch.*slate|\/css\/themes\/)/i.test(l.href || ""));
    if (!hasBootSlate && !document.querySelector('link[data-btfw-slate]')) {
      const s = document.createElement("link");
      s.rel = "stylesheet";
      s.href = "https://cdn.jsdelivr.net/npm/bootswatch@3.4.1/slate/bootstrap.min.css";
      s.dataset.btfwSlate = "1";
      document.head.insertBefore(s, document.head.firstChild);
    }
  }

  // --- UI deps + z-index layering (once) ---
  function ensureUiDepsAndZ() {
    // Bulma is no longer loaded: the load-bearing slice the theme used is
    // reimplemented natively in css/ui.css (same class names, token colors).
    // Escape hatch for channels whose third-party modules emit Bulma markup
    // beyond that slice — set `window.BTFW_LOAD_BULMA = true` in Channel JS
    // before the theme boots to restore the CDN stylesheet.
    if (window.BTFW_LOAD_BULMA === true &&
        !document.querySelector('link[href*="bulma.min.css"]') &&
        !document.querySelector('link[data-btfw-bulma]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css';
      l.dataset.btfwBulma = "1";
      document.head.appendChild(l);
    }

    if (!document.querySelector('link[data-btfw-fa6]') &&
        !document.querySelector('link[href*="fontawesome"]')) {
      const fa = document.createElement("link");
      fa.rel = "stylesheet";
      fa.href = "https://cdn.jsdelivr.net/gh/ElBeyonder/font-awesome-6.5.2-pro-full@master/css/all.css";
      fa.dataset.btfwFa6 = "1";
      document.head.appendChild(fa);
    }

    // Global z-index fixes + userlist overlay default CLOSED
    if (!document.getElementById('btfw-modal-zfix-core')) {
      const z = document.createElement('style');
      z.id = 'btfw-modal-zfix-core';
      z.textContent = `
        /* Keep navbar on top (z scale lives in css/tokens.css) */
        #nav-collapsible, .navbar, #navbar, .navbar-fixed-top {
          position: sticky !important;
          top: 0;
          left: 0;
          right: 0;
          z-index: var(--btfw-z-navbar, 5000) !important;
        }
        /* Modals layered correctly above content */
        .modal { z-index: var(--btfw-z-modal, 6000) !important; }
        .modal .modal-background { z-index: var(--btfw-z-modal-bg, 6001) !important; }
        .modal .modal-card, .modal .modal-content { z-index: var(--btfw-z-modal-card, 6002) !important; }

        /* Userlist overlay default CLOSED (chat module toggles classes) */
        #userlist.btfw-userlist-overlay:not(.btfw-userlist-overlay--open) {
          display: none !important;
        }
      `;
      document.head.appendChild(z);
    }
  }

  function installPrimaryButtonRipple() {
    const root = document.documentElement;
    if (!root || root.dataset.btfwButtonMotion === "1") return;
    root.dataset.btfwButtonMotion = "1";

    const selector = [
      ".btfw-btn--primary",
      ".btfw-theme-admin .btn-primary",
      ".btfw-admin-actions .btn-primary",
      ".btfw-theme-admin .btfw-mkt-btn--primary"
    ].join(",");

    document.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const button = event.target.closest(selector);
      if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;

      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const radius = Math.hypot(
        Math.max(x, rect.width - x),
        Math.max(y, rect.height - y)
      );
      const ripple = document.createElement("span");
      ripple.className = "btfw-button-ripple";
      ripple.setAttribute("aria-hidden", "true");
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      ripple.style.width = `${radius * 2}px`;
      ripple.style.height = `${radius * 2}px`;
      button.classList.add("btfw-button-ripple-host");
      button.appendChild(ripple);

      const remove = () => ripple.remove();
      ripple.addEventListener("animationend", remove, { once: true });
      setTimeout(remove, 650);
    });
  }

  function installFluidInteractions() {
    const root = document.documentElement;
    if (!root || root.dataset.btfwFluidInteractions === "1") return;
    root.dataset.btfwFluidInteractions = "1";

    const finePointer = window.matchMedia
      ? window.matchMedia("(hover: hover) and (pointer: fine)")
      : { matches: true };
    const reducedMotion = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : { matches: false };
    const containerSelector = [
      "#btfw-navhost .dropdown-menu",
      ".user-dropdown",
      ".btfw-emotes-tabs",
      ".btfw-gif-tabs",
      ".btfw-ct-tabs",
      ".tabs > ul",
      "[role='menu']",
      "[role='tablist']"
    ].join(",");
    const itemSelector = [
      "a",
      "button",
      "[role='menuitem']",
      "[role='menuitemradio']",
      "[role='tab']",
      ".btfw-tab"
    ].join(",");

    function motionAllowed() {
      return finePointer.matches &&
        !reducedMotion.matches &&
        root.dataset.btfwMotion !== "reduced";
    }

    function resolveTarget(eventTarget) {
      if (!(eventTarget instanceof Element)) return null;
      const item = eventTarget.closest(itemSelector);
      if (!item || item.matches(":disabled, [aria-disabled='true']")) return null;
      const container = item.closest(containerSelector);
      if (!container || !container.contains(item)) return null;
      return { container, item };
    }

    function clearTarget(container) {
      if (!container) return;
      container.dataset.btfwFluidActive = "false";
      const active = container.querySelector("[data-btfw-fluid-target='true']");
      if (active) active.removeAttribute("data-btfw-fluid-target");
    }

    function activate(container, item) {
      if (!motionAllowed()) { clearTarget(container); return; }
      if (item.dataset.btfwFluidTarget === "true" &&
          container.dataset.btfwFluidActive === "true") return;
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      if (!itemRect.width || !itemRect.height) return;

      const previous = container.querySelector("[data-btfw-fluid-target='true']");
      if (previous && previous !== item) previous.removeAttribute("data-btfw-fluid-target");

      container.classList.add("btfw-fluid-menu");
      if (getComputedStyle(container).position === "static") {
        container.classList.add("btfw-fluid-menu--relative");
      }
      container.dataset.btfwFluidAxis = container.matches("[role='tablist'], .tabs > ul, .btfw-emotes-tabs, .btfw-gif-tabs, .btfw-ct-tabs")
        ? "tabs"
        : "menu";
      container.style.setProperty("--btfw-fluid-hover-x", `${itemRect.left - containerRect.left}px`);
      container.style.setProperty("--btfw-fluid-hover-y", `${itemRect.top - containerRect.top}px`);
      container.style.setProperty("--btfw-fluid-hover-w", `${itemRect.width}px`);
      container.style.setProperty("--btfw-fluid-hover-h", `${itemRect.height}px`);
      item.dataset.btfwFluidTarget = "true";
      container.dataset.btfwFluidActive = "true";
    }

    document.addEventListener("pointerover", (event) => {
      const target = resolveTarget(event.target);
      if (target) activate(target.container, target.item);
    }, { passive: true });

    document.addEventListener("pointerout", (event) => {
      if (!(event.target instanceof Element)) return;
      const container = event.target.closest(containerSelector);
      if (!container) return;
      if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) return;
      clearTarget(container);
    }, { passive: true });

    document.addEventListener("focusin", (event) => {
      const target = resolveTarget(event.target);
      if (target) activate(target.container, target.item);
    });

    document.addEventListener("focusout", (event) => {
      const target = resolveTarget(event.target);
      if (!target) return;
      if (event.relatedTarget instanceof Node && target.container.contains(event.relatedTarget)) return;
      clearTarget(target.container);
    });

    document.addEventListener("btfw:motion:preferenceApplied", () => {
      if (motionAllowed()) return;
      document.querySelectorAll(".btfw-fluid-menu").forEach(clearTarget);
    });
  }

  ensureSlate();
  setTimeout(ensureSlate, 400);

  ensureUiDepsAndZ();
  setTimeout(ensureUiDepsAndZ, 300);
  installPrimaryButtonRipple();
  installFluidInteractions();

  // Persist "fluid" layout so CyTube renders consistently for all users
  try {
    localStorage.setItem("cytube-layout", "fluid");
    localStorage.setItem("layout", "fluid");
    if (typeof window.setPreferredLayout === "function") {
      window.setPreferredLayout("fluid");
    }
  } catch (e) { /* ignore */ }

  return { name: "feature:styleCore" };
});
