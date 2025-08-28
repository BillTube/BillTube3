// BillTube — stack under video: MOTD, mainpage wells, playlist, etc.  Drag to reorder (persisted).
BTFW.define("feature:stack", ["feature:layout"], async ({}) => {
  const SKEY = "btfw-stack-order";

  // All selectors we want stacked (you can add more later)
  const DEFAULT_SELECTORS = [
    "#playlistrow", "#playlistwrap", "#queuecontainer",
    "#mainpage", "#motdrow", "#announcements", "#pollwrap"
  ];

  function ensureStack() {
    const left = document.getElementById("btfw-leftpad");
    if (!left) return null;

    let stack = document.getElementById("btfw-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "btfw-stack";
      stack.className = "btfw-stack";
      // insert right under the video
      const video = document.getElementById("videowrap");
      if (video && video.nextSibling) video.parentNode.insertBefore(stack, video.nextSibling);
      else left.appendChild(stack);

      // header with customize toggle
      const hdr = document.createElement("div");
      hdr.className = "btfw-stack-header";
      hdr.innerHTML = `
        <div class="btfw-stack-title">Page Modules</div>
        <div class="btfw-stack-actions">
          <button id="btfw-stack-edit" class="btfw-ghost" title="Reorder modules">
            <i class="fa fa-arrows"></i> Customize
          </button>
        </div>
      `;
      stack.appendChild(hdr);

      const list = document.createElement("div");
      list.className = "btfw-stack-list";
      stack.appendChild(list);

      const editBtn = hdr.querySelector("#btfw-stack-edit");
      editBtn.onclick = () => stack.classList.toggle("btfw-stack--editing");
    }
    return stack.querySelector(".btfw-stack-list");
  }

  function normalizeId(el) {
    if (!el) return null;
    if (el.id) return el.id;
    // make a stable id
    const base = (el.dataset && el.dataset.section) || el.getAttribute("data-panel") || "stackitem";
    const id = base + "-" + Math.random().toString(36).slice(2,7);
    el.id = id;
    return id;
  }

  function makeItemFor(el) {
    normalizeId(el);
    const wrap = document.createElement("section");
    wrap.className = "btfw-stack-item";
    wrap.setAttribute("draggable", "true");
    wrap.dataset.bind = el.id;
    wrap.innerHTML = `
      <header class="btfw-stack-item__header">
        <span class="btfw-handle" title="Drag to reorder"><i class="fa fa-bars"></i></span>
        <span class="btfw-stack-item__title">${el.getAttribute("data-title") || el.getAttribute("title") || el.id}</span>
      </header>
      <div class="btfw-stack-item__body"></div>
    `;
    wrap.querySelector(".btfw-stack-item__body").appendChild(el);
    return wrap;
  }

  function currentOrder(list) {
    return Array.from(list.children).map(li => li.dataset.bind).filter(Boolean);
  }

  function saveOrder(list) {
    try { localStorage.setItem(SKEY, JSON.stringify(currentOrder(list))); } catch(e){}
  }

  function loadOrder() {
    try { return JSON.parse(localStorage.getItem(SKEY) || "[]"); } catch(e){ return []; }
  }

  function applyDrag(list) {
    let src = null;
    list.addEventListener("dragstart", e => {
      src = e.target.closest(".btfw-stack-item");
      if (!src) return;
      e.dataTransfer.effectAllowed = "move";
      src.classList.add("dragging");
    });
    list.addEventListener("dragend", e => {
      const n = e.target.closest(".btfw-stack-item");
      n && n.classList.remove("dragging");
      saveOrder(list);
    });
    list.addEventListener("dragover", e => {
      e.preventDefault();
      const dragging = list.querySelector(".btfw-stack-item.dragging");
      if (!dragging) return;
      const after = Array.from(list.querySelectorAll(".btfw-stack-item:not(.dragging)"))
        .find(el => e.clientY <= el.getBoundingClientRect().top + el.offsetHeight / 2);
      if (after) list.insertBefore(dragging, after);
      else list.appendChild(dragging);
    });
  }

  function moveIntoStack(list) {
    const want = new Set(DEFAULT_SELECTORS);
    // collect existing matches
    const found = [];
    DEFAULT_SELECTORS.forEach(sel => {
      const el = document.querySelector(sel);
      if (el && !list.contains(el)) {
        // Some wrappers (like #mainpage) may contain multiple wells; we move the entire block.
        found.push(el);
      }
    });
    // render
    const order = loadOrder();
    const byId = new Map();
    found.forEach(el => byId.set(normalizeId(el), el));

    // First: items that the user ordered previously
    order.forEach(id => {
      const el = byId.get(id);
      if (!el) return;
      const item = makeItemFor(el);
      list.appendChild(item);
      byId.delete(id);
    });
    // Then: any new items we haven’t seen before
    Array.from(byId.values()).forEach(el => list.appendChild(makeItemFor(el)));

    applyDrag(list);
  }

  function init() {
    const list = ensureStack();
    if (!list) return;
    moveIntoStack(list);

    // If CyTube injects more sections later, try to adopt them
    const obs = new MutationObserver(() => moveIntoStack(list));
    obs.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("btfw:layoutReady", init);
  setTimeout(init, 1500);

  return { name: "feature:stack" };
});
