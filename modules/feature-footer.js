/* BTFW — feature:footer (auth forms relocation + branding/disclaimer block) */
BTFW.define("feature:footer", [], async () => {
  const $  = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const BRANDING_HTML = `
    <div class="btfw-footer-branding__content">
      <div class="btfw-footer-branding__disclaimer">
        <p>
          The author is not responsible for any contents linked or referred to from these pages.
          All CyTu.be does is link or embed content that was uploaded to popular Online Video hosting sites like Youtube.com /
          Google Drive. All Google users signed a contract with the sites when they set up their accounts which forces them not
          to upload illegal content. (<a href="https://www.lumendatabase.org/topics/14" target="_blank" rel="noopener">DMCA Safe Harbor</a>)
        </p>
      </div>
      <div class="btfw-footer-branding__credit">
        <h4>
          <span>BillTube Framework</span>
          <a href="http://discord.gg/fwadWd9" target="_blank" rel="noopener">Available Now</a>
        </h4>
      </div>
    </div>
  `;

  let styleInjected = false;

  function ensureStyles(){
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement("style");
    style.id = "btfw-footer-styles";
    style.textContent = `
      #btfw-footer, .btfw-footer {
        width: 100%;
      }

      .btfw-footer__inner {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        padding: 1.5rem 1rem 3rem;
        color: rgba(255, 255, 255, 0.85);
      }

      .btfw-footer__auth {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
        justify-content: center;
      }

      .btfw-footer__form {
        display: inline-flex !important;
        gap: 0.35rem;
        align-items: center;
      }

      .btfw-footer-branding {
        border-top: 1px solid rgba(255, 255, 255, 0.12);
        padding-top: 1.25rem;
        font-size: 0.85rem;
        background: rgba(5, 6, 13, 0.35);
        border-radius: 12px;
      }

      .btfw-footer-branding__disclaimer {
        margin-bottom: 1rem;
        opacity: 0.8;
      }

      .btfw-footer-branding__disclaimer p {
        margin: 0;
        text-align: center;
        line-height: 1.5;
      }

      .btfw-footer-branding__disclaimer a,
      .btfw-footer-branding__credit a {
        color: var(--btfw-color-accent, #6d4df6);
        text-decoration: none;
        font-weight: 600;
      }

      .btfw-footer-branding__disclaimer a:hover,
      .btfw-footer-branding__credit a:hover {
        text-decoration: underline;
      }

      .btfw-footer-branding__credit {
        text-align: center;
      }

      .btfw-footer-branding__credit h4 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      @media (min-width: 640px) {
        .btfw-footer__auth {
          justify-content: flex-end;
        }
        .btfw-footer__inner {
          padding-inline: 2.5rem;
        }
      }

      @media (max-width: 640px) {
        .btfw-footer-branding {
          font-size: 0.8rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureFooterSlot(){
    const stackContainer = document.getElementById("btfw-stack-footer");
    if (stackContainer) {
      const stray = document.getElementById("btfw-footer");
      const strayChildren = [];
      if (stray && stray !== stackContainer && !stackContainer.contains(stray)) {
        while (stray.firstChild) {
          strayChildren.push(stray.firstChild);
        }
        stray.remove();
      }

      let host = stackContainer.querySelector("#btfw-footer") || stackContainer.querySelector(".btfw-footer");
      if (!host) {
        host = document.createElement("div");
        host.id = "btfw-footer";
        host.className = "btfw-footer";
        stackContainer.appendChild(host);
      } else {
        host.id = "btfw-footer";
        host.classList.add("btfw-footer");
      }

      strayChildren.forEach(node => host.appendChild(node));

      // Merge any duplicate footer nodes into the primary host
      stackContainer.querySelectorAll("#btfw-footer ~ .btfw-footer, #btfw-footer ~ #btfw-footer").forEach(extra => {
        if (extra === host) return;
        while (extra.firstChild) host.appendChild(extra.firstChild);
        extra.remove();
      });

      host.classList.remove("btfw-footer--standalone");
      return host;
    }

    let host = $("#btfw-footer") || $(".btfw-footer");
    if (!host) {
      host = document.createElement("div");
      host.id = "btfw-footer";
      host.className = "btfw-footer";
      const stack = $("#btfw-content-stack") || $("#mainpage") || $("#main") || document.body;
      stack.appendChild(host);
    }
    return host;
  }

  function ensureFooterInner(){
    const slot = ensureFooterSlot();
    if (!slot) return null;
    let inner = slot.querySelector(".btfw-footer__inner");
    if (!inner) {
      inner = document.createElement("div");
      inner.className = "btfw-footer__inner";
      slot.appendChild(inner);
    }
    return inner;
  }

  function ensureAuthWrap(){
    const inner = ensureFooterInner();
    if (!inner) return null;
    let wrap = inner.querySelector(".btfw-footer__auth");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "btfw-footer__auth";
      inner.prepend(wrap);
    }
    return wrap;
  }

  function ensureBrandingBlock(){
    const inner = ensureFooterInner();
    if (!inner) return null;
    let block = inner.querySelector(".btfw-footer-branding");
    if (!block) {
      block = document.createElement("div");
      block.className = "btfw-footer-branding";
      block.innerHTML = BRANDING_HTML;
      inner.appendChild(block);
    }
    return block;
  }

  function moveForms(){
    const wrap = ensureAuthWrap();
    if (!wrap) return;

    ["#logoutform", "#loginform"].forEach(selector => {
      $$(selector).forEach(form => {
        if (!wrap.contains(form)) {
          form.classList.remove("navbar-text", "pull-right");
          form.classList.add("btfw-footer__form");
          form.style.margin = "0";
          form.style.display = "inline-flex";
          wrap.appendChild(form);
        }
      });
    });
  }

  function insertBranding(){
    ensureBrandingBlock();
  }

  function maintainFooter(){
    ensureStyles();
    moveForms();
    insertBranding();
  }

  function boot(){
    maintainFooter();

    if (!document._btfwFooterObserver) {
      const observer = new MutationObserver(() => maintainFooter());
      observer.observe(document.body, { childList: true, subtree: true });
      document._btfwFooterObserver = observer;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return {
    name: "feature:footer",
    moveForms,
    insertBranding
  };
});
