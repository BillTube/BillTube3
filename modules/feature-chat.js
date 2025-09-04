/* BTFW — feature:chat (DIAGNOSTIC VERSION) */
BTFW.define("feature:chat", ["feature:layout"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  /* ---------------- Userlist POPUP (with Debugging) ---------------- */
  function adoptUserlistIntoPopover(){
    const popBody = $("#btfw-userlist-pop .btfw-popbody");
    const ul = $("#userlist");
    if (!popBody) { console.error("[Debug] adoptUserlist: Popover body not found!"); return; }
    if (!ul) { console.error("[Debug] adoptUserlist: CyTube #userlist not found!"); return; }
    
    if (ul.parentElement !== popBody) {
      console.log("[Debug] Adopting #userlist into popover.");
      ul.classList.add("btfw-userlist-overlay");
      popBody.appendChild(ul);
    }
  }

  function buildUserlistPopover(){
    if ($("#btfw-userlist-pop")) return;
    console.log("[Debug] Building userlist popover for the first time...");

    const back = document.createElement("div");
    back.id = "btfw-userlist-backdrop"; /* ... */
    document.body.appendChild(back);

    const pop = document.createElement("div");
    pop.id = "btfw-userlist-pop"; /* ... */
    pop.innerHTML = `...`; // Content from your original script
    document.body.appendChild(pop);
    
    adoptUserlistIntoPopover();

    const close = () => {
        console.log("[Debug] Closing userlist popover.");
        back.style.display = "none";
        pop.style.display = "none";
    };
    back.addEventListener("click", close);
    pop.querySelector(".btfw-popclose").addEventListener("click", close);

    function position(){
        console.log("[Debug] Repositioning popover...");
        const cw  = $("#chatwrap");
        const bar = cw && cw.querySelector(".btfw-chat-bottombar");
        
        // --- SAFEGUARD ---
        if (!cw || !bar) {
            console.error("[Debug] Positioning failed: #chatwrap or bottom bar not found.");
            // Fallback position
            pop.style.bottom = "60px";
            pop.style.right = "20px";
            return;
        }

        const cwRect  = cw.getBoundingClientRect();
        const barRect = bar.getBoundingClientRect();
        const right  = Math.max(8, window.innerWidth  - cwRect.right + 8);
        const bottom = Math.max(8, window.innerHeight - barRect.top + 8);
        
        console.log(`[Debug] Popover position set to: bottom=${bottom}px, right=${right}px`);
        pop.style.right  = right + "px";
        pop.style.bottom = bottom + "px";
    }
    
    document._btfw_userlist_open = function(){
        console.log("[Debug] _btfw_userlist_open called.");
        adoptUserlistIntoPopover();
        back.style.display = "block";
        pop.style.display  = "block";
        position();
    };
    document._btfw_userlist_close = close;
  }

  function openUserlistSafe(){
    console.log("[Debug] openUserlistSafe() triggered by click.");
    if (!$("#btfw-userlist-pop")) {
      buildUserlistPopover();
    }
    if (typeof document._btfw_userlist_open === "function") {
      document._btfw_userlist_open();
    } else {
      console.error("[Debug] Open function (_btfw_userlist_open) not found!");
    }
  }

  /* ---------------- Chat bars & actions (with direct binding fix) ---------------- */
  function ensureBars(){
    const cw = $("#chatwrap"); if (!cw) return;
    cw.classList.add("btfw-chatwrap");

    let bottom = cw.querySelector(".btfw-chat-bottombar");
    if (!bottom) {
        bottom = document.createElement("div");
        bottom.className = "btfw-chat-bottombar";
        bottom.innerHTML = '<div class="btfw-chat-actions" id="btfw-chat-actions"></div>';
        const controls = $("#chatcontrols,#chat-controls") || ($("#chatline") && $("#chatline").parentElement);
        if (controls) controls.before(bottom);
        else cw.appendChild(bottom);
    }
    const actions = bottom.querySelector("#btfw-chat-actions");

    // Add Users button if it doesn't exist
    if (!$("#btfw-users-toggle")) {
      const b = document.createElement("button");
      b.id = "btfw-users-toggle";
      b.className = "button is-dark is-small btfw-chatbtn";
      b.innerHTML = '<i class="fa fa-users"></i>';
      
      // Direct event listener to prevent conflicts
      b.addEventListener("click", (e) => {
        e.preventDefault();
        openUserlistSafe();
      });
      
      actions.appendChild(b);
    }
  }

  /* ---------------- Boot ---------------- */
  function boot(){
    console.log("[Debug] Chat module boot sequence started.");
    ensureBars();
    buildUserlistPopover();
  }

  document.addEventListener("btfw:layoutReady", ()=> setTimeout(boot, 50));
  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);

  return { name:"feature:chat" };
});