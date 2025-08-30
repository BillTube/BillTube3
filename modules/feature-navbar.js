/* BillTube Framework — feature:navbar
   Polishes the stock Bootstrap navbar into a modern, sticky top bar.
   - Converts the main UL into a flex row
   - Pushes Theme + Avatar to the right
   - Ensures avatar sizing and alignment
*/
BTFW.define("feature:navbar", [], async () => {
  function $ (s, r=document) { return r.querySelector(s); }
  function $$(s, r=document) { return Array.from(r.querySelectorAll(s)); }

  function findMainUL() {
    return (
      $("#nav-collapsible ul.nav") ||
      $(".navbar .nav.navbar-nav") ||
      $("ul.navbar-nav")
    );
  }

  function polish() {
    const ul = findMainUL();
    if (!ul) return;

    // mark once
    if (!ul.classList.contains("btfw-topbar")) {
      ul.classList.add("btfw-topbar");
    }

    // Make each LI a flex item
    $$(".btfw-topbar > li", ul).forEach(li => li.classList.add("btfw-topitem"));

    // Push Theme button + items after it to the right
    const themeA = ul.querySelector("li > a#btfw-theme-btn-nav");
    if (themeA) {
      themeA.closest("li")?.classList.add("btfw-flex-spacer");
    }

    // Avatar LI (if present) -> add hook class
    const avatarImg = ul.querySelector("#useravatar");
    if (avatarImg) {
      avatarImg.closest("li")?.classList.add("btfw-avatar-li");
    }
  }

  function boot() { polish(); }

  document.addEventListener("btfw:layoutReady", () => setTimeout(boot, 0));
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { name: "feature:navbar" };
});
