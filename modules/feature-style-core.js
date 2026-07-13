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

  ensureSlate();
  setTimeout(ensureSlate, 400);

  ensureUiDepsAndZ();
  setTimeout(ensureUiDepsAndZ, 300);
  installPrimaryButtonRipple();

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
