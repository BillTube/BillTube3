
BTFW.define("feature:stack", ["feature:layout"], async ({}) => {
  const SKEY = "btfw-stack-order";
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
      const video = document.getElementById("videowrap");
      if (video && video.nextSibling) video.parentNode.insertBefore(stack, video.nextSibling);
      else left.appendChild(stack);
      const hdr = document.createElement("div");
      hdr.className = "btfw-stack-header";
      hdr.innerHTML = `<div class="btfw-stack-title">Page Modules</div>`;
      stack.appendChild(hdr);
      const list = document.createElement("div"); list.className = "btfw-stack-list"; stack.appendChild(list);
      const footer = document.createElement("div"); footer.id="btfw-stack-footer"; footer.className="btfw-stack-footer"; stack.appendChild(footer);
    }
    return { list: stack.querySelector(".btfw-stack-list"), footer: stack.querySelector("#btfw-stack-footer") };
  }

  function normalizeId(el) { if (!el) return null; if (el.id) return el.id; el.id = "stackitem-" + Math.random().toString(36).slice(2,7); return el.id; }
  function itemTitle(el){ return el.getAttribute("data-title") || el.getAttribute("title") || el.id; }

  function makeItemFor(el) {
    normalizeId(el);
    const wrap = document.createElement("section");
    wrap.className = "btfw-stack-item";
    wrap.dataset.bind = el.id;
    wrap.innerHTML = `
      <header class="btfw-stack-item__header">
        <span class="btfw-stack-item__title">${itemTitle(el)}</span>
        <span class="btfw-stack-arrows">
          <button class="btfw-arrow btfw-up" title="Move up">&uarr;</button>
          <button class="btfw-arrow btfw-down" title="Move down">&darr;</button>
        </span>
      </header>
      <div class="btfw-stack-item__body"></div>
    `;
    const body = wrap.querySelector(".btfw-stack-item__body");
    body.appendChild(el);
    const up = wrap.querySelector(".btfw-up");
    const down = wrap.querySelector(".btfw-down");
    up.onclick = () => { const p=wrap.parentElement; if (!p) return; const prev=wrap.previousElementSibling; if (prev) p.insertBefore(wrap, prev); saveOrder(p); };
    down.onclick = () => { const p=wrap.parentElement; if (!p) return; const next=wrap.nextElementSibling; if (next) p.insertBefore(next, wrap); else p.appendChild(wrap); saveOrder(p); };
    return wrap;
  }

  function currentOrder(list) { return Array.from(list.children).map(li => li.dataset.bind).filter(Boolean); }
  function saveOrder(list){ try { localStorage.setItem(SKEY, JSON.stringify(currentOrder(list))); } catch(e){} }
  function loadOrder(){ try { return JSON.parse(localStorage.getItem(SKEY) || "[]"); } catch(e){ return []; } }

  function attachFooter(footer){
    const real = document.getElementById("footer") || document.querySelector("footer");
    if (!real) return;
    real.classList.add("btfw-footer");
    if (!footer.contains(real)) { footer.innerHTML=""; footer.appendChild(real); }
  }

  function moveIntoStack({list, footer}) {
    const found = [];
    DEFAULT_SELECTORS.forEach(sel => {
      const el = document.querySelector(sel);
      if (el && !list.contains(el)) found.push(el);
    });
    const byId = new Map(found.map(el => [normalizeId(el), el]));
    let order = loadOrder();
    if (!order.length) {
      const seed = [];
      if (document.getElementById("btfw-channels")) seed.push("btfw-channels");
      ["motdrow","mainpage"].forEach(id => { if (byId.has(id)) seed.push(id); });
      ["playlistrow","playlistwrap","queuecontainer"].forEach(id => { if (byId.has(id) && !seed.includes(id)) seed.push(id); });
      Array.from(byId.keys()).forEach(id => { if (!seed.includes(id)) seed.push(id); });
      order = seed;
    }
    Array.from(list.children).forEach(c => { if (c.dataset.bind && !byId.has(c.dataset.bind) && c.dataset.bind!=="btfw-channels") c.remove(); });
    order.forEach(id => {
      const el = byId.get(id);
      if (!el) return;
      let item = Array.from(list.children).find(n => n.dataset.bind === id);
      if (!item) { item = makeItemFor(el); list.appendChild(item); }
      byId.delete(id);
    });
    Array.from(byId.values()).forEach(el => list.appendChild(makeItemFor(el)));
    saveOrder(list);
    attachFooter(footer);
  }

  function init(){
    const refs = ensureStack(); if (!refs) return;
    moveIntoStack(refs);
    const obs = new MutationObserver(() => moveIntoStack(refs));
    obs.observe(document.body, { childList:true, subtree:true });
  }
  document.addEventListener("btfw:layoutReady", init);
  setTimeout(init, 1200);
  return { name:"feature:stack" };
});
