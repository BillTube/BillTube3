/* BTFW — feature:modal-skin
   Make CyTube Bootstrap modals look like Bulma modal-card, without changing behavior.
   - Skins any `.modal` that is NOT our own `.btfw-modal` (keeps our Bulma modals intact)
   - Normalizes header/footer and re-styles .btn -> .button variants
   - Adds a Bulma-like close "delete" button that hides via Bootstrap
*/
BTFW.define("feature:modal-skin", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  function restyleButtons(root){
    const map = [
      ["btn-primary", "is-link"],
      ["btn-danger",  "is-danger"],
      ["btn-warning", "is-warning"],
      ["btn-success", "is-success"],
      ["btn-info",    "is-info"],
      ["btn-default", "is-dark"]
    ];
    root.querySelectorAll(".btn").forEach(btn=>{
      btn.classList.add("button","is-small");
      btn.classList.remove("btn","btn-lg","btn-sm","btn-xs");
      // map Bootstrap flavor to Bulma flavor
      let mapped=false;
      for (const [bs,bul] of map){
        if (btn.classList.contains(bs)) { btn.classList.remove(bs); btn.classList.add(bul); mapped=true; }
      }
      if (!mapped) btn.classList.add("is-dark");
      // alignments
      if (btn.classList.contains("pull-right")) { btn.classList.remove("pull-right"); btn.classList.add("is-pulled-right"); }
      if (btn.classList.contains("pull-left"))  { btn.classList.remove("pull-left");  btn.classList.add("is-pulled-left"); }
    });
  }

  function ensureDeleteButton(modal){
    const header = modal.querySelector(".modal-header");
    if (!header) return;
    if (header.querySelector(".delete")) return;
    const del = document.createElement("button");
    del.className = "delete"; del.setAttribute("aria-label","close");
    del.addEventListener("click", (e)=>{
      e.preventDefault();
      // hide using Bootstrap if available
      try { if (window.jQuery) window.jQuery(modal).modal("hide"); } catch(_) {}
      modal.classList.remove("is-active"); // harmless for non-bulma
    });
    header.appendChild(del);
  }

  function decorate(modal){
    if (!modal || modal.classList.contains("btfw-modal") || modal.classList.contains("btfw-bulma-skin")) return;
    modal.classList.add("btfw-bulma-skin");

    // tag parts so CSS can skin them like Bulma modal-card
    modal.querySelectorAll(".modal-content").forEach(c=>c.classList.add("btfw-card"));
    modal.querySelectorAll(".modal-header").forEach(h=>h.classList.add("btfw-card-head"));
    modal.querySelectorAll(".modal-body").forEach(b=>b.classList.add("btfw-card-body"));
    modal.querySelectorAll(".modal-footer").forEach(f=>f.classList.add("btfw-card-foot"));

    // add bulma-like close button
    ensureDeleteButton(modal);

    // restyle buttons once now, and again on each show
    restyleButtons(modal);

    // When Bootstrap shows the modal, restyle again (in case content was injected)
    try {
      if (window.jQuery) {
        window.jQuery(modal).on("shown.bs.modal", function(){ restyleButtons(modal); });
      }
    } catch(_) {}
  }

  function skinAll(){
    $$(".modal").forEach(m => decorate(m));
  }

  function boot(){
    // initial pass
    skinAll();

    const handleBootstrapModal = (event)=>{
      const modal = event?.target && event.target.classList?.contains("modal")
        ? event.target
        : event?.target?.closest?.(".modal");
      if (modal) decorate(modal);
    };

    document.addEventListener("show.bs.modal", handleBootstrapModal, true);
    document.addEventListener("shown.bs.modal", handleBootstrapModal, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:modal-skin", reskin: skinAll };
});
