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
    // cfg: { id, parent?, cardClass, build:()=>cardHTML, opts, toggleSelector }
    const getParent = () => {
      const p = (typeof cfg.parent === "function") ? cfg.parent() : cfg.parent;
      return p || document.getElementById("chatwrap") || document.body;
    };
    const sel = "#" + cfg.id + " ." + cfg.cardClass;

    function ensure(){
      let modal = document.getElementById(cfg.id);
      if (!modal) {
        modal = document.createElement("div");
        modal.id = cfg.id;
        modal.setAttribute("hidden", "");
        modal.setAttribute("aria-hidden", "true");
        getParent().appendChild(modal);
      }
      modal.innerHTML = cfg.build();
      // container is inert; only the card is interactive
      modal.style.background = "transparent";
      modal.style.pointerEvents = "none";
      const card = modal.querySelector("." + cfg.cardClass);
      if (card) {
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
      // container must be visible (not [hidden]) before positioning, or the card
      // can't lay out and renders 0×0.
      modal.removeAttribute("hidden");
      modal.removeAttribute("aria-hidden");
      REG.set(card, { opts: cfg.opts, modalId: cfg.id, toggleSelector: cfg.toggleSelector, close });
      position(card, cfg.opts);
      motion.openPopover(card);
    }
    function close(){
      const modal = document.getElementById(cfg.id);
      const card = modal && modal.querySelector("." + cfg.cardClass);
      if (!card) { if (modal) { modal.setAttribute("hidden", ""); modal.setAttribute("aria-hidden", "true"); } return; }
      motion.closePopover(card).then(() => {
        if (card.dataset.btfwPopoverState === "open") return; // reopened mid-close
        modal.setAttribute("hidden", "");
        modal.setAttribute("aria-hidden", "true");
        REG.delete(card);
      });
    }
    function toggle(){ isOpen() ? close() : open(); }

    return { open, close, toggle, isOpen, ensure, getCard };
  }

  // Re-fit every open popover to the chat column. feature:chat calls this from
  // repositionOpenPopins on resize / scroll / layout.
  function repositionAll(){
    REG.forEach((info, card) => {
      if (card && document.body.contains(card) && card.dataset.btfwPopoverState === "open") {
        position(card, info.opts);
      }
    });
  }
  window.BTFW_repositionChatPopovers = repositionAll;

  // One delegated handler for close-button + click-outside across all popovers.
  if (!window.__btfwChatPopoverClickWired) {
    window.__btfwChatPopoverClickWired = true;
    document.addEventListener("click", (e) => {
      REG.forEach((info, card) => {
        if (card.dataset.btfwPopoverState !== "open") return;
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
