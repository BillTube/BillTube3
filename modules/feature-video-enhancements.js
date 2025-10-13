/* BTFW — feature:videoEnhancements (title extraction, changeMedia handling) */
BTFW.define("feature:videoEnhancements", [], async () => {
  
  // Title length CSS variable handling
  function updateTitleLength(){
    const titleElements = document.querySelectorAll("#currenttitle, .current-title");
    titleElements.forEach(el => {
      const text = (el.textContent || el.innerText || "").trim();
      el.style.setProperty("--length", text.length);
    });
  }

  // Remove the fullscreen button if present
  function removeVjsFullscreenButton(){
    const fullscreenBtn = document.querySelector(".vjs-fullscreen-control");
    if (fullscreenBtn) {
      fullscreenBtn.remove();
    }
  }

  // Hide the quality button when there are no real options
  function handleQualityButton(){
    const qualityBtn = document.querySelector(".vjs-resolution-button");
    if (!qualityBtn) return;

    const qualityMenu = qualityBtn.querySelector(".vjs-menu");
    if (!qualityMenu) {
      qualityBtn.style.display = "none";
      return;
    }

    const menuItems = qualityMenu.querySelectorAll(".vjs-menu-item");
    if (menuItems.length <= 1) {
      qualityBtn.style.display = "none";
    }
  }

  // Ensure the fullscreen button is hidden via CSS as a fallback
  function ensureFullscreenCss(){
    if (document.getElementById("btfw-video-enhancements-style")) return;

    const style = document.createElement("style");
    style.id = "btfw-video-enhancements-style";
    style.textContent = `
      .vjs-fullscreen-control {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Try to remove fullscreen controls and hide unused quality options
  function tryHideQuality(){
    removeVjsFullscreenButton();
    handleQualityButton();
  }

  // Media URL processing and title extraction
  function processMediaUrl(urlInput){
    if (!urlInput || !urlInput.value) return;

    let url = urlInput.value.trim();
    if (!url) return;

    // Dropbox URL transformation
    url = url.replace("//www.dropbox.com/s/", "//dl.dropbox.com/s/")
             .replace("?dl=0", "")
             .replace("?a=view", "");
    
    urlInput.value = url;

    // Auto-title extraction
    setTimeout(() => {
      const titleInput = document.querySelector("#addfromurl-title-val, #mediaurl-title, .media-title-input");
      if (titleInput && !titleInput.value.trim()) {
        try {
          const decodedUrl = decodeURI(url);
          const pathParts = decodedUrl.split("/");
          const filename = pathParts[pathParts.length - 1];
          const nameParts = filename.split("?")[0].split(".");
          
          // Build title from filename parts (exclude extension)
          let title = "";
          for (let i = 0; i < nameParts.length - 1; i++) {
            title += nameParts[i] + (i < nameParts.length - 2 ? "." : "");
          }
          
          // Clean up title
          title = title.replace(/[._-]/g, " ")
                      .replace(/\s+/g, " ")
                      .trim();

          if (title) {
            titleInput.value = title;
          }
        } catch (err) {
          console.warn("[video-enhancements] Title extraction failed:", err);
        }
      }
    }, 100);
  }

  // Setup media URL processing
  function bindMediaUrlProcessing(){
    const urlInputs = document.querySelectorAll("#mediaurl, .media-url-input");
    urlInputs.forEach(input => {
      if (input._btfwUrlBound) return;
      input._btfwUrlBound = true;

      input.addEventListener("paste", () => {
        setTimeout(() => processMediaUrl(input), 50);
      });

      input.addEventListener("input", () => {
        setTimeout(() => processMediaUrl(input), 50);
      });
    });
  }

  // changeMedia event handler
  function handleChangeMedia(){
    setTimeout(() => {
      updateTitleLength();
    }, 100);

    setTimeout(tryHideQuality, 500);
    setTimeout(tryHideQuality, 1000);
    setTimeout(tryHideQuality, 2000);
  }

  // Initialize
  function boot(){
    // Initial setup
    updateTitleLength();
    bindMediaUrlProcessing();
    ensureFullscreenCss();
    tryHideQuality();
    setTimeout(tryHideQuality, 500);
    setTimeout(tryHideQuality, 1000);
    setTimeout(tryHideQuality, 2000);

    // Bind to changeMedia event
    if (window.socket) {
      try {
        socket.on("changeMedia", handleChangeMedia);
      } catch (err) {
        console.warn("[video-enhancements] Failed to bind changeMedia:", err);
      }
    }

    // Watch for DOM changes to rebind URL processing
    const observer = new MutationObserver(() => {
      bindMediaUrlProcessing();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { 
    name: "feature:videoEnhancements",
    updateTitleLength: updateTitleLength
  };
});
