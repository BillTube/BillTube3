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
        <div class="btfw-footer-branding__donate">
          <a href="https://ko-fi.com/O5O02CIHL" rel="noopener noreferrer" target="_blank">
            <img
              src="https://storage.ko-fi.com/cdn/kofi3.png?v=3"
              alt="Buy Me a Coffee at ko-fi.com"
              height="36"
              width="235"
            />
          </a>
        </div>
      </div>
    </div>
  `;

  function ensureStyles(){
    if (document.getElementById("btfw-footer-styles")) return;
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
        gap: 14px;
        align-items: center;
        justify-content: center;
        padding: 14px 16px;
        background: color-mix(in srgb, var(--btfw-color-panel) 60%, transparent 40%);
        border: 1px solid color-mix(in srgb, var(--btfw-border) 36%, transparent 64%);
        border-radius: 14px;
      }

      .btfw-footer__form {
        display: inline-flex !important;
        gap: 10px;
        align-items: center;
        margin: 0;
        padding: 0;
        background: transparent;
        border: 0;
        box-shadow: none;
        flex-wrap: wrap;
        flex: 0 1 auto;
      }

      /* Username + password inputs need higher specificity + !important to
         beat CyTube themes/slate.css which forces background-color rgb(22,26,32) */
      .btfw-footer__auth input.form-control[type="text"],
      .btfw-footer__auth input.form-control[type="password"] {
        background-color: color-mix(in srgb, var(--btfw-color-bg) 55%, transparent 45%) !important;
        background-image: none !important;
        border: 1px solid color-mix(in srgb, var(--btfw-border) 45%, transparent 55%) !important;
        border-radius: 999px !important;
        color: var(--btfw-color-text) !important;
        height: 36px !important;
        padding: 0 16px !important;
        font-size: 13px !important;
        line-height: 1 !important;
        box-shadow: none !important;
        width: 180px;
        transition: border-color .18s ease, box-shadow .18s ease, background-color .18s ease;
      }
      .btfw-footer__auth input.form-control:focus {
        outline: none !important;
        border-color: color-mix(in srgb, var(--btfw-color-accent) 60%, transparent 40%) !important;
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--btfw-color-accent) 22%, transparent 78%) !important;
        background-color: color-mix(in srgb, var(--btfw-color-bg) 45%, transparent 55%) !important;
      }
      .btfw-footer__auth input.form-control::placeholder {
        color: color-mix(in srgb, var(--btfw-color-text) 55%, transparent 45%);
        opacity: 1;
      }

      /* "Remember me" label + checkbox */
      .btfw-footer__auth label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        font-size: 12.5px;
        font-weight: 500;
        color: color-mix(in srgb, var(--btfw-color-text) 75%, transparent 25%);
        cursor: pointer;
      }
      .btfw-footer__auth label input[type="checkbox"],
      .btfw-footer__auth input[type="checkbox"] {
        accent-color: var(--btfw-color-accent);
        width: 14px;
        height: 14px;
        margin: 0;
      }

      /* Login button — accent fill pill */
      .btfw-footer__auth #login,
      .btfw-footer__auth button.btn[type="submit"] {
        background: color-mix(in srgb, var(--btfw-color-accent) 78%, transparent 22%);
        border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 90%, transparent 10%);
        border-radius: 999px;
        color: var(--btfw-color-bg);
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.02em;
        height: 36px;
        padding: 0 18px;
        line-height: 1;
        box-shadow: none;
        transition: background 0.18s ease, border-color 0.18s ease;
      }
      .btfw-footer__auth #login:hover,
      .btfw-footer__auth button.btn[type="submit"]:hover {
        background: var(--btfw-color-accent);
        border-color: var(--btfw-color-accent);
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

      .btfw-footer-branding__donate {
        margin-top: 0.75rem;
        display: flex;
        justify-content: center;
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
        if (form.matches("p#loginform")) {
          form.remove();
          return;
        }
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

  function removeLegacyFooter(){
    document.querySelectorAll("footer#footer").forEach(legacy => {
      if (legacy && legacy.isConnected) {
        legacy.remove();
      }
    });
  }

  function maintainFooter(){
    ensureStyles();
    moveForms();
    insertBranding();
    removeLegacyFooter();
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

  document.addEventListener("btfw:ready", () => removeLegacyFooter(), { once: true });

  return {
    name: "feature:footer",
    moveForms,
    insertBranding,
    removeLegacyFooter
  };
});
