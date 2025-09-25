/* BTFW — feature:footerBranding (DMCA disclaimer and theme branding) */
BTFW.define("feature:footerBranding", [], async () => {
  
  // DMCA and theme branding content
  const BRANDING_HTML = `
    <div class="btfw-footer-branding">
      <div class="btfw-disclaimer">
        <p>
          The author is not responsible for any contents linked or referred to from these pages. 
          All CyTu.be does is link or embed content that was uploaded to popular Online Video hosting sites like Youtube.com / Google Drive. 
          All Google users signed a contract with the sites when they set up their accounts which forces them not to upload illegal content.
          (<a href="https://www.lumendatabase.org/topics/14" target="_blank" rel="noopener">DMCA Safe Harbor</a>)
        </p>
      </div>
      <div class="btfw-theme-credit">
        <h4>
          <center>
            <br>BillTube Framework
            <br>(<a href="http://discord.gg/fwadWd9" target="_blank" rel="noopener">Available Now</a>)
          </center>
        </h4>
      </div>
    </div>
  `;

  // Find the best location for footer branding
  function findFooterLocation(){
    // Try various footer locations
    const candidates = [
      "#footer",
      ".footer", 
      "#mainpage footer",
      "#main footer",
      "footer",
      "#mainpage", // fallback to end of mainpage
      "#main", // fallback to end of main
      "body" // ultimate fallback
    ];

    for (const selector of candidates) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    return document.body;
  }

  // Insert branding content
  function insertBranding(){
    // Check if already inserted
    if (document.querySelector(".btfw-footer-branding")) return;

    const container = findFooterLocation();
    if (!container) return;

    // Create branding element
    const brandingDiv = document.createElement("div");
    brandingDiv.innerHTML = BRANDING_HTML;
    
    // Insert at the end of the container
    container.appendChild(brandingDiv.firstElementChild);
  }

  // Add CSS styles for branding
  function addBrandingStyles(){
    if (document.getElementById("btfw-footer-branding-styles")) return;

    const styles = document.createElement("style");
    styles.id = "btfw-footer-branding-styles";
    styles.textContent = `
      .btfw-footer-branding {
        margin-top: 2rem;
        padding: 1.5rem 1rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.2);
        font-size: 0.85rem;
        line-height: 1.4;
      }

      .btfw-disclaimer {
        margin-bottom: 1rem;
        opacity: 0.8;
      }

      .btfw-disclaimer p {
        margin: 0;
        text-align: center;
      }

      .btfw-disclaimer a {
        color: var(--btfw-color-accent, #6d4df6);
        text-decoration: none;
      }

      .btfw-disclaimer a:hover {
        text-decoration: underline;
      }

      .btfw-theme-credit h4 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        opacity: 0.9;
      }

      .btfw-theme-credit a {
        color: var(--btfw-color-accent, #6d4df6);
        text-decoration: none;
        font-weight: bold;
      }

      .btfw-theme-credit a:hover {
        text-decoration: underline;
      }

      /* Dark theme adjustments */
      html[data-btfw-theme="dark"] .btfw-footer-branding {
        border-top-color: rgba(255, 255, 255, 0.05);
        background: rgba(0, 0, 0, 0.3);
      }

      /* Mobile adjustments */
      @media (max-width: 768px) {
        .btfw-footer-branding {
          padding: 1rem 0.5rem;
          font-size: 0.8rem;
        }
        
        .btfw-theme-credit h4 {
          font-size: 0.9rem;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  // Initialize branding
  function boot(){
    addBrandingStyles();
    
    // Try to insert immediately
    insertBranding();
    
    // Watch for DOM changes in case footer is added later
    const observer = new MutationObserver(() => {
      insertBranding();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Retry after page load
    setTimeout(insertBranding, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { 
    name: "feature:footerBranding",
    insertBranding: insertBranding
  };
});