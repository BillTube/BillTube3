BTFW.define("feature:layout", ["core"], async ({ require }) => {

  /**
   * All of the theme's CSS is contained in this string.
   * It will be injected into the page head by our script.
   */
  const themeCSS = `
#btfw-vsplit {
  width: 5px;
  background-color: #333;
  cursor: col-resize; /* Indicates this can be dragged horizontally */
  flex-shrink: 0;
}

#btfw-vsplit:hover {
  background-color: #555;
}

/* This class is added by the JS to prevent selecting text while dragging */
body.btfw-resizing {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
}
  `;

  /**
   * Creates a <style> element and injects the theme's CSS into the document head.
   */
  function injectThemeCSS() {
    if (document.getElementById('btfw-theme-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'btfw-theme-styles';
    style.type = 'text/css';
    style.appendChild(document.createTextNode(themeCSS));
    
    document.head.appendChild(style);
  }

  /**
   * This function makes the vertical split bar resizable.
   */
  function makeResizable() {
    const grid = document.getElementById("btfw-grid");
    const splitter = document.getElementById("btfw-vsplit");
    
    if (!grid || !splitter) return;

    let isResizing = false;

    splitter.addEventListener("mousedown", (e) => {
      isResizing = true;
      document.body.classList.add("btfw-resizing");
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", stopResize);
    });

    function handleMouseMove(e) {
      if (!isResizing) return;

      const gridRect = grid.getBoundingClientRect();
      let newLeftWidth = e.clientX - gridRect.left;
      
      if (newLeftWidth < 400) newLeftWidth = 400;
      if ((gridRect.width - newLeftWidth) < 320) {
        newLeftWidth = gridRect.width - 320;
      }

      grid.style.gridTemplateColumns = `${newLeftWidth}px 5px 1fr`;
    }

    function stopResize() {
      isResizing = false;
      document.body.classList.remove("btfw-resizing");
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopResize);
    }
  }

  /**
   * The main function that performs a "total takeover" of the CyTube UI.
   */
  function buildAndDeployLayout() {
    if (document.getElementById("btfw-grid")) return;

    const wrap = document.getElementById("wrap");
    const videoWrap = document.getElementById("videowrap");
    const chatWrap = document.getElementById("chatwrap");
    
    if (!wrap || !videoWrap || !chatWrap) {
        setTimeout(buildAndDeployLayout, 100);
        return;
    }
    
    // --- 1. INJECT ALL CSS ---
    injectThemeCSS();
    console.log("[BTFW] Takeover initiated...");

    // --- 2. TAKEOVER THE HEADER ---
    const navbar = document.querySelector(".navbar");
    if (navbar) {
        navbar.id = "btfw-navbar";
        navbar.className = "btfw-navbar";
        navbar.innerHTML = `...`; // Header HTML from previous steps
    }
    
    // --- 3. AGGRESSIVE CLASS STRIPPING ---
    [videoWrap, chatWrap, document.getElementById("playlistrow"), document.getElementById("main")].forEach(el => {
        if (el) el.className = '';
    });
    
    // --- 4. CREATE AND DEPLOY OUR GRID ---
    const grid = document.createElement("div");
    grid.id = "btfw-grid";
    // ... Grid creation logic from previous steps ...

    // --- 5. ACTIVATE THE RESIZER ---
    makeResizable();

    console.log("[BTFW] Takeover complete. Layout deployed.");
    document.dispatchEvent(new Event("btfw:layoutReady"));
  }
  
  // Start the process
  buildAndDeployLayout();

  return { name: "feature:layout" };
});