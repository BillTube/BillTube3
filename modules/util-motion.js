BTFW.define("util:motion", [], async () => {
  const reduceQuery = (typeof window !== "undefined" && window.matchMedia)
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  let reduceMotion = !!(reduceQuery && reduceQuery.matches);

  if (reduceQuery) {
    const onChange = (event) => { reduceMotion = !!event.matches; };
    if (typeof reduceQuery.addEventListener === "function") {
      reduceQuery.addEventListener("change", onChange);
    } else if (typeof reduceQuery.addListener === "function") {
      reduceQuery.addListener(onChange);
    }
  }

  function prefersReducedMotion() {
    return reduceMotion;
  }

  function toMilliseconds(timeString) {
    if (!timeString) return 0;
    return timeString.split(",").reduce((max, token) => {
      const value = parseFloat(token.trim());
      if (Number.isNaN(value)) return max;
      if (token.trim().endsWith("ms")) {
        return Math.max(max, value);
      }
      return Math.max(max, value * 1000);
    }, 0);
  }

  function transitionTotal(el) {
    if (!el || typeof window === "undefined" || !window.getComputedStyle) return 0;
    const style = getComputedStyle(el);
    const duration = toMilliseconds(style.transitionDuration || "0s");
    const delay = toMilliseconds(style.transitionDelay || "0s");
    return duration + delay;
  }

  function waitForTransition(el) {
    return new Promise((resolve) => {
      if (!el || prefersReducedMotion()) { resolve(); return; }
      const total = transitionTotal(el);
      if (!total) { resolve(); return; }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.removeEventListener("transitionend", onEnd);
        resolve();
      };

      const onEnd = (event) => {
        if (event && event.target !== el) return;
        finish();
      };

      el.addEventListener("transitionend", onEnd);
      setTimeout(finish, total + 34);
    });
  }

  function openModal(modal) {
    if (!modal) return;
    modal.dataset.btfwModalState = "open";
    modal.removeAttribute("aria-hidden");
    modal.removeAttribute("hidden");
    modal.classList.add("is-active");
  }

  async function closeModal(modal) {
    if (!modal) return;
    const state = modal.dataset.btfwModalState;
    if (state === "closing" || state === "closed") return;

    modal.dataset.btfwModalState = "closing";
    modal.setAttribute("aria-hidden", "true");
    const card = modal.querySelector(".modal-card, .modal-content, .modal-dialog");
    const backdrop = modal.querySelector(".modal-background, .modal-backdrop");

    modal.classList.remove("is-active");

    await Promise.all([waitForTransition(card), waitForTransition(backdrop)]);

    if (modal.dataset.btfwModalState === "closing") {
      modal.dataset.btfwModalState = "closed";
      modal.setAttribute("hidden", "");
    }
  }

  function openPopover(pop, options = {}) {
    if (!pop) return;
    const state = pop.dataset.btfwPopoverState;
    if (state === "open") return;

    pop.dataset.btfwPopoverState = "open";
    pop.removeAttribute("hidden");
    pop.removeAttribute("aria-hidden");

    const backdrop = options.backdrop;
    if (backdrop) {
      backdrop.dataset.btfwPopoverState = "open";
      backdrop.removeAttribute("hidden");
      backdrop.removeAttribute("aria-hidden");
    }
  }

  async function closePopover(pop, options = {}) {
    if (!pop) return;
    const state = pop.dataset.btfwPopoverState;
    if (state === "closing" || state === "closed") return;

    pop.dataset.btfwPopoverState = "closing";
    pop.setAttribute("aria-hidden", "true");

    const waits = [waitForTransition(pop)];
    const backdrop = options.backdrop;
    if (backdrop) {
      backdrop.dataset.btfwPopoverState = "closing";
      backdrop.setAttribute("aria-hidden", "true");
      waits.push(waitForTransition(backdrop));
    }

    await Promise.all(waits);

    if (pop.dataset.btfwPopoverState === "closing") {
      pop.dataset.btfwPopoverState = "closed";
      pop.setAttribute("hidden", "");
    }

    if (backdrop && backdrop.dataset.btfwPopoverState === "closing") {
      backdrop.dataset.btfwPopoverState = "closed";
      backdrop.setAttribute("hidden", "");
    }
  }

  return {
    prefersReducedMotion,
    waitForTransition,
    openModal,
    closeModal,
    openPopover,
    closePopover
  };
});
