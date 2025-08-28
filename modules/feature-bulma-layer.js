
BTFW.define("feature:bulma", ["feature:styleCore"], async ({}) => {
  function ensureBulmaLayer() {
    if (document.querySelector('style[data-btfw-bulma-layer]')) return;
    const s = document.createElement("style");
    s.dataset.btfwBulmaLayer = "1";
    s.textContent = `@layer btfw-bulma { @import url("https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css"); }`;
    document.head.appendChild(s);
  }
  function bridge(root) {
    root = root || document;
    root.querySelectorAll(".btn:not(.button)").forEach(el => el.classList.add("button"));
    root.querySelectorAll(".btn-primary").forEach(el => el.classList.add("is-primary"));
    root.querySelectorAll(".btn-success").forEach(el => el.classList.add("is-success"));
    root.querySelectorAll(".btn-danger").forEach(el => el.classList.add("is-danger"));
    root.querySelectorAll(".btn-warning").forEach(el => el.classList.add("is-warning"));
    root.querySelectorAll(".btn-info").forEach(el => el.classList.add("is-info"));
    root.querySelectorAll(".btn-default,.btn-secondary").forEach(el => el.classList.add("is-light"));
  }
  ensureBulmaLayer();
  document.addEventListener("btfw:layoutReady", () => bridge(document.getElementById("btfw-grid")||document));
  setTimeout(() => bridge(document), 1200);
  return { name:"feature:bulma" };
});
