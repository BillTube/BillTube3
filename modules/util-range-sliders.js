BTFW.define("util:rangeSliders", [], async () => {
  const RANGE_SELECTOR = '.btfw-range-control input[type="range"], .btfw-notify-volume-range input[type="range"], .btfw-gradient-range input[type="range"]';
  const WRAPPER_SELECTOR = ".btfw-gradient-range, .btfw-range-control, .btfw-notify-volume-range";
  let activeDrag = null;

  function readoutFor(input, wrapper){
    if (!wrapper) return null;
    return wrapper.querySelector("output, .btfw-range-value, .btfw-notify-volume-value");
  }

  function sync(input){
    if (!input || input.type !== "range") return;
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const value = Number(input.value || min);
    const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty("--btfw-range-progress", `${Math.max(0, Math.min(100, progress))}%`);
    input.setAttribute("aria-valuenow", String(value));
    requestAnimationFrame(() => {
      const readout = readoutFor(input, input.closest(".btfw-dial-range"));
      const text = readout?.textContent?.trim();
      if (text) input.setAttribute("aria-valuetext", text);
    });
  }

  function releaseDrag(pointerId){
    if (!activeDrag || (pointerId != null && activeDrag.pointerId !== pointerId)) return;
    const input = activeDrag.input;
    activeDrag = null;
    input.classList.remove("is-dragging");
    input.classList.add("is-releasing");
    input.style.setProperty("--btfw-range-elastic-x", "0px");
    input.style.setProperty("--btfw-range-elastic-scale", "1");
    window.setTimeout(() => input.classList.remove("is-releasing"), 260);
  }

  function enhance(input){
    if (!input || input.type !== "range") return input;
    if (input.dataset.btfwDialRange === "1") {
      sync(input);
      return input;
    }
    input.dataset.btfwDialRange = "1";
    input.classList.add("btfw-dial-range__input");
    const wrapper = input.closest(WRAPPER_SELECTOR) || input.parentElement;
    wrapper?.classList.add("btfw-dial-range");

    input.addEventListener("input", () => sync(input), { passive: true });
    input.addEventListener("change", () => sync(input), { passive: true });
    input.addEventListener("pointerdown", event => {
      if (activeDrag && activeDrag.input !== input) releaseDrag(activeDrag.pointerId);
      input.classList.remove("is-releasing");
      input.classList.add("is-dragging");
      activeDrag = { input, pointerId: event.pointerId, rect: input.getBoundingClientRect() };
    }, { passive: true });
    input.addEventListener("keydown", () => requestAnimationFrame(() => sync(input)));
    sync(input);
    return input;
  }

  function enhanceAll(root = document){
    if (root?.matches?.(RANGE_SELECTOR)) enhance(root);
    root?.querySelectorAll?.(RANGE_SELECTOR).forEach(enhance);
  }

  document.addEventListener("pointermove", event => {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    const { input, rect } = activeDrag;
    const overshoot = event.clientX < rect.left
      ? event.clientX - rect.left
      : (event.clientX > rect.right ? event.clientX - rect.right : 0);
    const resisted = Math.sign(overshoot) * Math.min(14, Math.sqrt(Math.abs(overshoot)) * 1.7);
    input.style.setProperty("--btfw-range-elastic-x", `${(resisted * 0.36).toFixed(2)}px`);
    input.style.setProperty("--btfw-range-elastic-scale", String(1 + (Math.abs(resisted) / Math.max(1, rect.width))));
  }, { passive: true });
  document.addEventListener("pointerup", event => releaseDrag(event.pointerId), { passive: true });
  document.addEventListener("pointercancel", event => releaseDrag(event.pointerId), { passive: true });

  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1) enhanceAll(node);
    }));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceAll(document);

  return { enhance, enhanceAll, sync, syncAll: enhanceAll };
});
