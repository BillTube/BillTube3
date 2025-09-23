BTFW.define("feature:layout", ["feature:styleCore","feature:bulma"], async ({}) => {
  const SPLIT_KEY = "btfw:grid:leftPx";
  
  function setTop(){
    const header = document.querySelector(".navbar, #nav-collapsible, #navbar, .navbar-fixed-top");
    const h = header ? header.offsetHeight : 48;
    const newTop = h + "px";
    
    // Update CSS custom property
    document.documentElement.style.setProperty("--btfw-top", newTop);
    
    // Force layout recalculation for sticky elements
    const chatcol = document.getElementById("btfw-chatcol");
    if (chatcol) {
      chatcol.style.top = `calc(${newTop} + var(--btfw-gap))`;
      chatcol.style.height = `calc(100vh - ${newTop} - var(--btfw-gap) * 2)`;
    }
  }

  function makeResizable() {
    const grid = document.getElementById("btfw-grid");
    const splitter = document.getElementById("btfw-vsplit");
    const left = document.getElementById("btfw-leftpad");
    const right = document.getElementById("btfw-chatcol");

    if (!grid || !splitter || !left || !right) {
      console.warn("[BTFW] Resizer elements not found.");
      return;
    }

    let isResizing = false;

    splitter.addEventListener("mousedown", (e) => {
      isResizing = true;
      // Add a class to the body to prevent text selection during drag
      document.body.classList.add("btfw-resizing");

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", stopResize);
    });

    function handleMouseMove(e) {
      if (!isResizing) return;

      // Calculate the new column widths based on mouse position
      const gridRect = grid.getBoundingClientRect();
      const newLeftWidth = e.clientX - gridRect.left;
      
      // Set a min-width to prevent columns from collapsing
      if (newLeftWidth < 400 || (gridRect.width - newLeftWidth) < 320) {
          return;
      }

      // Update the grid-template-columns style directly
      grid.style.gridTemplateColumns = `${newLeftWidth}px 5px 1fr`;
      try { localStorage.setItem(SPLIT_KEY, String(newLeftWidth)); } catch(e) {}
    }

    function stopResize() {
      isResizing = false;
      document.body.classList.remove("btfw-resizing");
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopResize);
    }
  }

  const BOOT=/^(col(-(xs|sm|md|lg|xl))?-(\d+|auto)|row|container(-fluid)?|pull-(left|right)|offset-\d+)$/;
  function stripDeep(root){ 
    if(!root) return; 
    (root.classList||[]).forEach(c=>{ if(BOOT.test(c)) root.classList.remove(c); }); 
    root.querySelectorAll("[class]").forEach(el=>{ 
      Array.from(el.classList).forEach(c=>{ if(BOOT.test(c)) el.classList.remove(c); }); 
    }); 
  }

  function moveCurrent(){ 
    const vh=document.getElementById("videowrap-header"); 
    if(!vh) return; 
    const ct=vh.querySelector("#currenttitle"); 
    const top=document.querySelector("#chatwrap .btfw-chat-topbar"); 
    if(ct&&top){ 
      let slot=top.querySelector("#btfw-nowplaying-slot"); 
      if(!slot){ 
        slot=document.createElement("div"); 
        slot.id="btfw-nowplaying-slot"; 
        slot.className="btfw-chat-title"; 
        top.innerHTML=""; 
        top.appendChild(slot);
      } 
      slot.appendChild(ct);
    } 
    vh.remove(); 
  }

  function ensureShell(){
    const wrap=document.getElementById("wrap")||document.body; 
    const v=document.getElementById("videowrap"); 
    const c=document.getElementById("chatwrap"); 
    const q=document.getElementById("playlistrow")||document.getElementById("playlistwrap")||document.getElementById("queuecontainer");
    
    if(!document.getElementById("btfw-grid")){
      const grid=document.createElement("div"); 
      grid.id="btfw-grid";
      
      const left=document.createElement("div"); 
      left.id="btfw-leftpad";
      
      const right=document.createElement("aside"); 
      right.id="btfw-chatcol";
      
      if(v) left.appendChild(v); 
      if(q) left.appendChild(q); 
      if(c) right.appendChild(c);
      
      const split=document.createElement("div"); 
      split.id="btfw-vsplit";
      
      grid.appendChild(left); 
      grid.appendChild(split); 
      grid.appendChild(right);
      
      // Insert grid but keep it hidden until properly sized
      grid.style.opacity = '0';
      wrap.prepend(grid);
      
      // Restore saved split position
      try {
        const saved = parseInt(localStorage.getItem(SPLIT_KEY) || "", 10);
        if (!isNaN(saved) && saved >= 400) {
          grid.style.gridTemplateColumns = `${saved}px 5px 1fr`;
        }
      } catch (e) {}
      
    } else {
      const left=document.getElementById("btfw-leftpad"); 
      const right=document.getElementById("btfw-chatcol");
      const v=document.getElementById("videowrap"); 
      const c=document.getElementById("chatwrap"); 
      const q=document.getElementById("playlistrow")||document.getElementById("playlistwrap")||document.getElementById("queuecontainer");
      
      if(v && !left.contains(v)) left.appendChild(v); 
      if(q && !left.contains(q)) left.appendChild(q); 
      if(c && !right.contains(c)) right.appendChild(c);
    }
    
    ["videowrap","playlistrow","playlistwrap","queuecontainer","queue","plmeta","chatwrap"].forEach(id=>stripDeep(document.getElementById(id)));
    moveCurrent();
  }
  
  function finishLayout() {
    const grid = document.getElementById("btfw-grid");
    if (grid) {
      // Add loaded class and show grid
      grid.classList.add("btfw-loaded");
      grid.style.opacity = '1';
    }
    document.dispatchEvent(new CustomEvent("btfw:layoutReady"));
  }

  function init() {
    ensureShell();
    setTop();
    
    // Set up a more robust layout finalization
    const finalizeLayout = () => {
      setTop(); // Recalculate in case navbar mounted late
      makeResizable();
      finishLayout();
    };

    // Try multiple times to handle async loading
    setTimeout(finalizeLayout, 100);
    setTimeout(finalizeLayout, 300);
    setTimeout(finalizeLayout, 600);
    
    // Also listen for window load as final fallback
    if (document.readyState === 'complete') {
      finalizeLayout();
    } else {
      window.addEventListener('load', finalizeLayout);
    }

    // Watch for navbar height changes
    const navbar = document.querySelector(".navbar, #nav-collapsible, #navbar, .navbar-fixed-top");
    if (navbar) {
      const resizeObserver = new ResizeObserver(() => {
        setTimeout(setTop, 0);
      });
      resizeObserver.observe(navbar);
    }

    // Watch for window resize
    window.addEventListener('resize', () => {
      setTimeout(setTop, 0);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {name:"feature:layout"};
});