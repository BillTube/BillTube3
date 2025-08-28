
BTFW.define("feature:bulma", ["feature:styleCore"], async ({}) => {
  function ensureBulmaLayer() {
    if (document.querySelector('style[data-btfw-bulma-layer]')) return;
    const s = document.createElement("style");
    s.dataset.btfwBulmaLayer = "1";
    s.textContent = `@layer btfw-bulma { @import url("https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css"); }`;
    document.head.appendChild(s);
  }
  function bridgeBootstrapToBulma(root) {
    root = root || document;
    root.querySelectorAll(".btn:not(.button)").forEach(el => el.classList.add("button"));
    root.querySelectorAll(".btn-primary").forEach(el => el.classList.add("is-primary"));
    root.querySelectorAll(".btn-success").forEach(el => el.classList.add("is-success"));
    root.querySelectorAll(".btn-danger").forEach(el => el.classList.add("is-danger"));
    root.querySelectorAll(".btn-warning").forEach(el => el.classList.add("is-warning"));
    root.querySelectorAll(".btn-info").forEach(el => el.classList.add("is-info"));
    root.querySelectorAll(".btn-default,.btn-secondary").forEach(el => el.classList.add("is-light"));
    root.querySelectorAll('input.form-control:not(.input)').forEach(el => el.classList.add("input"));
    root.querySelectorAll('textarea.form-control:not(.textarea)').forEach(el => el.classList.add("textarea"));
    root.querySelectorAll('#btfw-grid select.form-control').forEach(el => {
      if (!el.parentElement || !el.parentElement.classList.contains("select")) {
        const wrap = document.createElement("div"); wrap.className = "select is-fullwidth";
        el.parentNode.insertBefore(wrap, el); wrap.appendChild(el);
      }
    });
    root.querySelectorAll("#btfw-grid table:not(.table)").forEach(t => t.classList.add("table"));
  }
  function observe() {
    const grid = document.getElementById("btfw-grid");
    if (!grid || grid._btfw_bulma_observer) return;
    grid._btfw_bulma_observer = true;
    new MutationObserver(m => m.forEach(r => r.addedNodes && r.addedNodes.forEach(n => {
      if (n.nodeType === 1) bridgeBootstrapToBulma(n);
    }))).observe(grid, { childList: true, subtree: true });
  }
  ensureBulmaLayer();
  document.addEventListener("btfw:layoutReady", () => { bridgeBootstrapToBulma(document.getElementById("btfw-grid")||document); observe(); });
  setTimeout(() => bridgeBootstrapToBulma(document), 1000);
  return { name: "feature:bulma" };
});
