/* BTFW — util:chat-popover
   Shared plumbing for the mini chat popovers (Chat Commands, Chat Tools,
   Emotes, Userlist…) so they all behave identically and new ones are trivial.

   One create() per popover returns { open, close, toggle, isOpen }. The utility
   owns everything that used to be hand-written in each module:
     • container + card creation, the inert container / interactive card split,
       and the [hidden] handling that lets the card lay out before positioning;
     • open  → show container, position above the chat bar, motion.openPopover,
               register for auto re-fit;
     • close → motion.closePopover, then re-hide + unregister;
     • a registry so EVERY open popover is re-fitted to the chat column on
       resize/scroll/layout (feature:chat's repositionOpenPopins calls
       window.BTFW_repositionChatPopovers) — no more hardcoded per-popover list;
     • one delegated click handler for both "click the X" (any element marked
       [data-btfw-popover-close] inside the card) and "click outside to close"
       (skipping the popover's own toggle button).

   Positioning still uses the shared window.BTFW_positionPopoverAboveChatBar
   helper (defined in feature:chat); open/close animation uses util:motion.
*/
BTFW.define("util:chat-popover", ["util:motion"], async () => {
  const motion = await BTFW.init("util:motion");

  // card element -> { opts, modalId, toggleSelector, close }
  const REG = new Map();

  function position(card, opts){
    if (card && window.BTFW_positionPopoverAboveChatBar) {
      window.BTFW_positionPopoverAboveChatBar(card, opts || {});
    }
  }

  function create(cfg){
    // cfg: { id, parent?, cardClass, build:()=>cardHTML, opts, toggleSelector,
    //        once?, backdrop?, backdropZ?, onOpen?(card), onClose?(card) }
    //   once     – build the inner HTML exactly once (so DOM adopted into the
    //              card, e.g. the live #userlist, survives re-opens).
    //   backdrop – manage a .btfw-popover-backdrop element (passed to util:motion).
    //   onOpen/onClose – hooks for popover-specific content wiring.
    const getParent = () => {
      const p = (typeof cfg.parent === "function") ? cfg.parent() : cfg.parent;
      return p || document.getElementById("chatwrap") || document.body;
    };
    const sel = "#" + cfg.id + " ." + cfg.cardClass;
    let backdropEl = null;

    function ensureBackdrop(){
      if (!cfg.backdrop) return null;
      if (backdropEl && document.body.contains(backdropEl)) return backdropEl;
      backdropEl = document.createElement("div");
      backdropEl.className = "btfw-popover-backdrop";
      backdropEl.dataset.btfwPopoverState = "closed";
      backdropEl.setAttribute("hidden", "");
      backdropEl.setAttribute("aria-hidden", "true");
      if (cfg.backdropZ) backdropEl.style.zIndex = cfg.backdropZ;
      document.body.appendChild(backdropEl);
      return backdropEl;
    }

    function ensure(){
      let modal = document.getElementById(cfg.id);
      if (!modal) {
        modal = document.createElement("div");
        modal.id = cfg.id;
        modal.setAttribute("hidden", "");
        modal.setAttribute("aria-hidden", "true");
        getParent().appendChild(modal);
      }
      // With cfg.once we build exactly once so adopted DOM survives re-opens.
      if (!cfg.once || !modal._btfwBuilt) {
        modal.innerHTML = cfg.build();
        modal._btfwBuilt = true;
      }
      // container is inert; only the card is interactive
      modal.style.background = "transparent";
      modal.style.pointerEvents = "none";
      const card = modal.querySelector("." + cfg.cardClass);
      if (card && !card._btfwCardInit) {
        card._btfwCardInit = true;
        card.classList.add("btfw-popover");
        card.style.pointerEvents = "auto";
        card.dataset.btfwPopoverState = "closed";
        card.setAttribute("hidden", "");
        card.setAttribute("aria-hidden", "true");
      }
      return { modal, card };
    }
    function getCard(){ return document.querySelector(sel); }
    function isOpen(){ const c = getCard(); return !!(c && c.dataset.btfwPopoverState === "open"); }

    function open(){
      const { modal, card } = ensure();
      if (!card) return;
      const bd = ensureBackdrop();
      // container must be visible (not [hidden]) before positioning, or the card
      // can't lay out and renders 0×0.
      modal.removeAttribute("hidden");
      modal.removeAttribute("aria-hidden");
      REG.set(card, { opts: cfg.opts, modalId: cfg.id, toggleSelector: cfg.toggleSelector, close, backdrop: bd });
      installChatColumnWatch(); // ensure the live re-fit observer is attached
      // onOpen first (it may inject/adopt content that changes the card size),
      // then position so the fit reflects the final content.
      if (typeof cfg.onOpen === "function") { try { cfg.onOpen(card); } catch(_){} }
      position(card, cfg.opts);
      motion.openPopover(card, bd ? { backdrop: bd } : {});
    }
    function close(){
      const modal = document.getElementById(cfg.id);
      const card = modal && modal.querySelector("." + cfg.cardClass);
      if (!card) { if (modal) { modal.setAttribute("hidden", ""); modal.setAttribute("aria-hidden", "true"); } return; }
      if (typeof cfg.onClose === "function") { try { cfg.onClose(card); } catch(_){} }
      const bd = backdropEl;
      motion.closePopover(card, bd ? { backdrop: bd } : {}).then(() => {
        if (card.dataset.btfwPopoverState === "open") return; // reopened mid-close
        modal.setAttribute("hidden", "");
        modal.setAttribute("aria-hidden", "true");
        REG.delete(card);
      });
    }
    function toggle(){ isOpen() ? close() : open(); }

    return { open, close, toggle, isOpen, ensure, getCard };
  }

  // "Active" = visible (open) or mid open-animation. The motion util flips
  // opening→open on a double-rAF, so accept both so re-fit / close work
  // immediately rather than only after the animation settles.
  function isActive(card){
    const s = card && card.dataset.btfwPopoverState;
    return s === "open" || s === "opening";
  }

  // Re-fit every open popover to the chat column. feature:chat calls this from
  // repositionOpenPopins on resize / scroll / layout.
  function repositionAll(){
    REG.forEach((info, card) => {
      if (card && document.body.contains(card) && isActive(card)) {
        position(card, info.opts);
      }
    });
  }
  window.BTFW_repositionChatPopovers = repositionAll;

  // Live re-fit, copied from feature:emotes' watchPosition: a ResizeObserver on
  // the chat column AND the bottom bar that re-fits open popovers the instant the
  // column changes size — including a continuous splitter drag. The reflow is
  // called DIRECTLY (no setTimeout / rAF debounce) so it tracks the drag
  // frame-by-frame, exactly like the Emotes popover. (A debounced version lagged
  // a frame behind, which read as "only updates after reopen".) Repositioning
  // only ever resizes the popover card — never #chatwrap or the anchor — so this
  // can't feed back into the observer.
  function findBottomBar(){
    return document.getElementById("btfw-chat-bottombar")
        || document.getElementById("chatcontrols")
        || document.getElementById("chatline");
  }
  function installChatColumnWatch(){
    const wrap = document.getElementById("chatwrap");
    if (!wrap || wrap._btfwPopoverWatch) return;
    wrap._btfwPopoverWatch = true;
    // Prefer the union refit (covers popovers not yet migrated to this util);
    // fall back to our own registry if feature:chat hasn't exposed it yet.
    const onReflow = () => (window.BTFW_repositionOpenPopins || repositionAll)();
    window.addEventListener("resize", onReflow);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(onReflow);
      ro.observe(wrap);
      const anchor = findBottomBar();
      if (anchor && anchor !== wrap) ro.observe(anchor);
      wrap._btfwPopoverRO = ro;
    }
  }
  installChatColumnWatch();
  document.addEventListener("btfw:layoutReady", installChatColumnWatch);

  // Escape closes any open popover — uniform across all of them.
  if (!window.__btfwChatPopoverEscWired) {
    window.__btfwChatPopoverEscWired = true;
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      REG.forEach((info, card) => { if (isActive(card)) info.close(); });
    }, true);
  }

  // One delegated handler for close-button + click-outside across all popovers.
  if (!window.__btfwChatPopoverClickWired) {
    window.__btfwChatPopoverClickWired = true;
    document.addEventListener("click", (e) => {
      REG.forEach((info, card) => {
        if (!isActive(card)) return;
        const inCard = card.contains(e.target);
        // explicit close affordance inside the card
        if (inCard && e.target.closest && e.target.closest("[data-btfw-popover-close]")) { info.close(); return; }
        if (inCard) return; // other in-card clicks do nothing
        // outside click — but not on this popover's own toggle button
        if (info.toggleSelector && e.target.closest && e.target.closest(info.toggleSelector)) return;
        info.close();
      });
    }, true);
  }

  const api = { create, repositionAll };
  window.BTFW_ChatPopover = api;
  return api;
});
