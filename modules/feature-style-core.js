/* BTFW — feature:styleCore
   - Ensures Bootswatch Slate (Bootstrap 3) is present (dark baseline)
   - Ensures Font Awesome 6 is present (icons)
   - Ensures Bulma (for modals/buttons/etc.) if not already loaded
   - Applies global z-index fixes (navbar always on top; Bulma modal layering)
   - Provides CSS rule to keep userlist overlay CLOSED by default
   - Forces CyTube "fluid" layout preference
*/
BTFW.define("feature:styleCore", [], async () => {

  // --- Keep Bootswatch Slate present (dark baseline over Bootstrap 3) ---
  function ensureSlate() {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const hasBootSlate = links.some(l => /(bootstrap.*\.css|bootswatch.*slate)/i.test(l.href || ""));
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
    // Bulma (only if not already provided by your bulma-layer or page)
    if (!document.querySelector('link[href*="bulma.min.css"]') &&
        !document.querySelector('link[data-btfw-bulma]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css';
      l.dataset.btfwBulma = "1";
      document.head.appendChild(l);
    }

    // Font Awesome 6 (skip if already present)
    if (!document.querySelector('link[data-btfw-fa6]') &&
        !document.querySelector('link[href*="fontawesome"]')) {
      const fa = document.createElement("link");
      fa.rel = "stylesheet";
      fa.href = "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css";
      fa.dataset.btfwFa6 = "1";
      document.head.appendChild(fa);
    }

    // Global z-index fixes + userlist overlay default CLOSED
    if (!document.getElementById('btfw-modal-zfix-core')) {
      const z = document.createElement('style');
      z.id = 'btfw-modal-zfix-core';
      z.textContent = `
        /* Keep navbar on top */
        #nav-collapsible, .navbar, #navbar, .navbar-fixed-top {
          position: fixed !important; top: 0; left: 0; right: 0;
          z-index: 5000 !important;
        }
        /* Bulma modal layered correctly above content */
        .modal { z-index: 6000 !important; }
        .modal .modal-background { z-index: 6001 !important; }
        .modal .modal-card, .modal .modal-content { z-index: 6002 !important; }

        /* Userlist overlay default CLOSED (chat module toggles classes) */
        #userlist.btfw-userlist-overlay:not(.btfw-userlist-overlay--open) {
          display: none !important;
        }
      `;
      document.head.appendChild(z);
    }
  }

  // Run once now and again shortly after first paint (in case other CSS arrives late)
  ensureSlate();
  setTimeout(ensureSlate, 400);

  ensureUiDepsAndZ();
  // second pass after initial layout settles
  setTimeout(ensureUiDepsAndZ, 300);

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
