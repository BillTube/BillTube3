// BillTube — Bulma + Bootstrap combined via CSS Layers + class bridge
// Loads Bulma in a low-priority @layer and maps Bootstrap classes to Bulma inside BTFW zones.
// Bootstrap/Slate stays enabled as fallback; style-core should still run first.

BTFW.define("feature:bulma", ["feature:styleCore"], async ({}) => {
  // 1) Load Bulma inside a CSS layer so it doesn't clobber Bootstrap resets.
  function ensureBulmaLayer() {
    if (document.querySelector('style[data-btfw-bulma-layer]')) return;
    const s = document.createElement("style");
    s.dataset.btfwBulmaLayer = "1";
    s.textContent = `
      @layer btfw-bulma {
        @import url("https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css");
      }
      /* Layer is lower priority than un-layered Bootstrap rules, so no global fights.
         Components we explicitly class-map (e.g. .button) will still render in Bulma style. */
    `;
    document.head.appendChild(s);
  }

  // 2) Bridge Bootstrap → Bulma where we want Bulma styling.
  function bridgeBootstrapToBulma(root) {
    root = root || document;
    // Buttons
    root.querySelectorAll(".btn:not(.button)").forEach(el => el.classList.add("button"));
    root.querySelectorAll(".btn-primary").forEach(el => el.classList.add("is-primary"));
    root.querySelectorAll(".btn-success").forEach(el => el.classList.add("is-success"));
    root.querySelectorAll(".btn-danger").forEach(el => el.classList.add("is-danger"));
    root.querySelectorAll(".btn-warning").forEach(el => el.classList.add("is-warning"));
    root.querySelectorAll(".btn-info").forEach(el => el.classList.add("is-info"));
    root.querySelectorAll(".btn-default,.btn-secondary").forEach(el => el.classList.add("is-light"));

    // Inputs / textareas
    root.querySelectorAll('input.form-control:not(.input)').forEach(el => el.classList.add("input"));
    root.querySelectorAll('textarea.form-control:not(.textarea)').forEach(el => el.classList.add("textarea"));

    // Selects: Bulma expects <div class="select"><select>…</select></div>
    root.querySelectorAll('#btfw-grid select.form-control').forEach(el => {
      if (!el.parentElement || !el.parentElement.classList.contains("select")) {
        const wrap = document.createElement("div");
        wrap.className = "select is-fullwidth";
        el.parentNode.insertBefore(wrap, el);
        wrap.appendChild(el);
      }
    });

    // Tables (optional): add Bulma table class where CyTube uses plain tables
    root.querySelectorAll("table:not(.table)").forEach(t => t.classList.add("table"));

    // Alerts / labels can be mapped later if needed
  }

  function bridgeInBTFWZones() {
    const grid = document.getElementById("btfw-grid");
    if (grid) bridgeBootstrapToBulma(grid);
  }

  function observe() {
    const grid = document.getElementById("btfw-grid");
    if (!grid || grid._btfw_bulma_observer) return;
    grid._btfw_bulma_observer = true;
    new MutationObserver(m =>
      m.forEach(r => r.addedNodes && r.addedNodes.forEach(n => {
        if (n.nodeType === 1) bridgeBootstrapToBulma(n);
      }))
    ).observe(grid, { childList: true, subtree: true });
  }

  // Load Bulma layer immediately so styles are present when we start mapping.
  ensureBulmaLayer();
  // After BTFW lays out the page, map Bootstrap→Bulma where we want.
  document.addEventListener("btfw:layoutReady", () => { bridgeInBTFWZones(); observe(); });
  // Safety: run once more a bit later (some widgets mount late)
  setTimeout(bridgeInBTFWZones, 1000);

  return { name: "feature:bulma" };
});
