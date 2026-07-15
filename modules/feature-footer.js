/* BTFW — feature:footer (auth forms relocation + branding/disclaimer block) */
BTFW.define("feature:footer", [], async () => {
  const $  = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const BRANDING_HTML = `
    <div class="btfw-footer-branding__content">
      <div class="btfw-footer-branding__credit">
        <div class="btfw-footer-branding__identity">
          <span class="btfw-footer-branding__mark" aria-hidden="true">BT</span>
          <div>
            <strong>BillTube Framework</strong>
            <span class="btfw-footer-branding__version">Version 1</span>
          </div>
        </div>
        <nav class="btfw-footer-branding__actions" aria-label="BillTube links">
          <a href="http://discord.gg/fwadWd9" target="_blank" rel="noopener">
            <i class="fa fa-comments" aria-hidden="true"></i>
            Join Discord
          </a>
          <a class="is-accent" href="https://ko-fi.com/O5O02CIHL" rel="noopener noreferrer" target="_blank">
            <span aria-hidden="true">☕</span>
            Support on Ko-fi
          </a>
        </nav>
      </div>
      <div class="btfw-footer-branding__disclaimer">
        <p>
          BillTube links to media hosted by third-party services and does not host video files.
          <a href="https://www.lumendatabase.org/topics/14" target="_blank" rel="noopener">DMCA information</a>
        </p>
      </div>
    </div>
  `;

  function ensureStyles(){
    if (document.getElementById("btfw-footer-styles")) return;
    const style = document.createElement("style");
    style.id = "btfw-footer-styles";
    style.textContent = `
      #btfw-footer,
      .btfw-footer {
        width: 100%;
      }

      #btfw-stack-footer .btfw-footer__inner,
      .btfw-footer__inner {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: min(100%, 960px);
        margin: 0 auto;
        padding: 18px 12px 28px;
        color: color-mix(in srgb, var(--btfw-color-text) 86%, transparent 14%);
      }

      #btfw-stack-footer .btfw-footer__auth,
      .btfw-footer__auth {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        justify-content: center;
        width: fit-content;
        max-width: 100%;
        align-self: center;
        padding: 10px 12px;
        background:
          linear-gradient(135deg,
            color-mix(in srgb, var(--btfw-color-surface) 86%, transparent 14%),
            color-mix(in srgb, var(--btfw-color-panel) 72%, transparent 28%));
        border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 18%, transparent 82%);
        border-radius: 14px;
      }

      #btfw-stack-footer .btfw-footer__auth .btfw-footer__form,
      .btfw-footer__form {
        display: inline-flex !important;
        gap: 10px;
        align-items: center;
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        flex-wrap: wrap;
        flex: 0 1 auto;
      }

      /* Username + password inputs need higher specificity + !important to
         beat CyTube themes/slate.css which forces background-color rgb(22,26,32) */
      #btfw-stack-footer .btfw-footer__auth input.form-control[type="text"],
      #btfw-stack-footer .btfw-footer__auth input.form-control[type="password"],
      .btfw-footer__auth input.form-control[type="text"],
      .btfw-footer__auth input.form-control[type="password"] {
        background-color: color-mix(in srgb, var(--btfw-color-bg) 66%, transparent 34%) !important;
        background-image: none !important;
        border: 1px solid color-mix(in srgb, var(--btfw-color-text) 14%, transparent 86%) !important;
        border-radius: 999px !important;
        color: var(--btfw-color-text) !important;
        height: 36px !important;
        padding: 0 14px !important;
        font-size: 13px !important;
        line-height: 1 !important;
        box-shadow: none !important;
        width: 165px;
        transition: border-color .18s ease, box-shadow .18s ease, background-color .18s ease;
      }
      #btfw-stack-footer .btfw-footer__auth input.form-control:focus,
      .btfw-footer__auth input.form-control:focus {
        outline: none !important;
        border-color: color-mix(in srgb, var(--btfw-color-accent) 60%, transparent 40%) !important;
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--btfw-color-accent) 22%, transparent 78%) !important;
        background-color: color-mix(in srgb, var(--btfw-color-bg) 58%, transparent 42%) !important;
      }
      .btfw-footer__auth input.form-control::placeholder {
        color: color-mix(in srgb, var(--btfw-color-text) 58%, transparent 42%);
        opacity: 1;
      }

      /* "Remember me" label + checkbox */
      #btfw-stack-footer .btfw-footer__auth label,
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
      #btfw-stack-footer .btfw-footer__auth #login,
      #btfw-stack-footer .btfw-footer__auth button.btn[type="submit"],
      .btfw-footer__auth #login,
      .btfw-footer__auth button.btn[type="submit"] {
        background: color-mix(in srgb, var(--btfw-color-accent) 82%, var(--btfw-color-panel) 18%);
        border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 72%, white 8%);
        border-radius: 999px;
        color: var(--btfw-color-on-accent, #fff);
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.02em;
        height: 36px;
        padding: 0 18px;
        line-height: 1;
        box-shadow: none;
        transition: background 0.18s ease, border-color 0.18s ease;
      }
      #btfw-stack-footer .btfw-footer__auth #login:hover,
      #btfw-stack-footer .btfw-footer__auth button.btn[type="submit"]:hover,
      .btfw-footer__auth #login:hover,
      .btfw-footer__auth button.btn[type="submit"]:hover {
        background: var(--btfw-color-accent);
        border-color: var(--btfw-color-accent);
      }

      .btfw-footer-branding {
        padding: 16px 18px;
        font-size: 0.82rem;
        background-color: color-mix(in srgb, var(--btfw-color-panel) 82%, var(--btfw-color-bg) 18%);
        background-image:
          var(--btfw-dither-image),
          var(--btfw-gradient-panel-runtime-layer),
          radial-gradient(circle at 0 0,
            color-mix(in srgb, var(--btfw-color-accent) 13%, transparent 87%),
            transparent 42%),
          radial-gradient(circle at 100% 100%,
            color-mix(in srgb, var(--btfw-color-surface) 14%, transparent 86%),
            transparent 52%),
          linear-gradient(135deg,
            color-mix(in srgb, var(--btfw-color-surface) 90%, transparent 10%),
            color-mix(in srgb, var(--btfw-color-panel) 82%, black 18%));
        background-size: var(--btfw-panel-background-size);
        background-position: var(--btfw-panel-background-position);
        border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 18%, transparent 82%);
        border-radius: 16px;
        box-shadow: 0 14px 30px color-mix(in srgb, var(--btfw-color-bg) 36%, transparent 64%);
      }

      .btfw-footer-branding__content {
        display: grid;
        gap: 14px;
      }

      .btfw-footer-branding__credit {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .btfw-footer-branding__identity {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .btfw-footer-branding__identity > div {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .btfw-footer-branding__identity strong {
        color: var(--btfw-color-text);
        font-size: 0.95rem;
        letter-spacing: 0.01em;
      }

      .btfw-footer-branding__mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        flex: 0 0 36px;
        border-radius: 11px;
        border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 45%, transparent 55%);
        background:
          var(--btfw-dither-image, none),
          color-mix(in srgb, var(--btfw-color-accent) 20%, var(--btfw-color-panel) 80%);
        background-size: var(--btfw-dither-size, auto);
        color: color-mix(in srgb, var(--btfw-color-text) 94%, white 6%);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
      }

      .btfw-footer-branding__version {
        display: inline-flex;
        align-items: center;
        min-height: 20px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 28%, transparent 72%);
        background: color-mix(in srgb, var(--btfw-color-accent) 12%, transparent 88%);
        color: color-mix(in srgb, var(--btfw-color-text) 72%, transparent 28%);
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .btfw-footer-branding__actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }

      .btfw-footer-branding__actions a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 34px;
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--btfw-color-text) 14%, transparent 86%);
        background: color-mix(in srgb, var(--btfw-color-panel) 72%, transparent 28%);
        color: color-mix(in srgb, var(--btfw-color-text) 86%, transparent 14%);
        text-decoration: none;
        font-weight: 600;
      }

      .btfw-footer-branding__actions a.is-accent {
        border-color: color-mix(in srgb, var(--btfw-color-accent) 38%, transparent 62%);
        background: color-mix(in srgb, var(--btfw-color-accent) 16%, transparent 84%);
      }

      .btfw-footer-branding__actions a:hover,
      .btfw-footer-branding__actions a:focus-visible {
        border-color: color-mix(in srgb, var(--btfw-color-accent) 55%, transparent 45%);
        background: color-mix(in srgb, var(--btfw-color-accent) 22%, transparent 78%);
        color: var(--btfw-color-text);
        outline: none;
      }

      .btfw-footer-branding__disclaimer {
        padding-top: 12px;
        border-top: 1px solid color-mix(in srgb, var(--btfw-color-text) 10%, transparent 90%);
      }

      .btfw-footer-branding__disclaimer p {
        margin: 0;
        color: color-mix(in srgb, var(--btfw-color-text) 58%, transparent 42%);
        font-size: 0.74rem;
        line-height: 1.55;
      }

      .btfw-footer-branding__disclaimer a {
        color: color-mix(in srgb, var(--btfw-color-accent) 72%, var(--btfw-color-text) 28%);
        text-decoration: none;
        font-weight: 600;
      }

      .btfw-footer-branding__disclaimer a:hover,
      .btfw-footer-branding__disclaimer a:focus-visible {
        color: var(--btfw-color-accent);
        text-decoration: underline;
      }

      @media (max-width: 640px) {
        #btfw-stack-footer .btfw-footer__inner,
        .btfw-footer__inner {
          padding: 12px 4px 20px;
        }
        #btfw-stack-footer .btfw-footer__auth,
        .btfw-footer__auth {
          width: 100%;
        }
        #btfw-stack-footer .btfw-footer__auth .btfw-footer__form,
        .btfw-footer__form {
          width: 100%;
          justify-content: center;
        }
        #btfw-stack-footer .btfw-footer__auth input.form-control[type="text"],
        #btfw-stack-footer .btfw-footer__auth input.form-control[type="password"],
        .btfw-footer__auth input.form-control[type="text"],
        .btfw-footer__auth input.form-control[type="password"] {
          width: min(100%, 220px);
          flex: 1 1 130px;
        }
        .btfw-footer-branding {
          padding: 14px;
        }
        .btfw-footer-branding__credit {
          align-items: flex-start;
          flex-direction: column;
        }
        .btfw-footer-branding__actions {
          width: 100%;
          justify-content: flex-start;
        }
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
