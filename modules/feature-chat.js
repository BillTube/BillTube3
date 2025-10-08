BTFW.define("feature:chat", ["feature:layout"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const MESSAGE_SELECTOR = ".chat-msg, .message, [class*=message]";
  const TRIVIA_PREFIX = /^Trivia:\s*/i;
  const BASE = (window.BTFW && BTFW.BASE ? BTFW.BASE.replace(/\/+$/,'') : "");
  
/* --- Shared pop-in positioning helper (exports a global for other modules) --- */
function positionAboveChatBar(el, opts){
  if (!el) return;
  const cw  = document.querySelector("#chatwrap");
  const bar = cw && cw.querySelector(".btfw-chat-bottombar");
  if (!cw || !bar) return;

  const {
    margin = 8,
    widthPx = 560,  // desired width cap
    widthVw = 92,   // fallback cap in vw
    maxHpx = 480,   // desired max height cap
    maxHvh = 70     // fallback cap in vh
  } = (opts || {});

  const cwRect  = cw.getBoundingClientRect();
  const barRect = bar.getBoundingClientRect();

  const safeMargin = Math.max(6, margin);
  const viewportLimitPx = isFinite(widthVw) ? (window.innerWidth * (widthVw / 100)) : widthPx;
  const availableViewport = Math.max(0, window.innerWidth - safeMargin * 2);
  const availableWithinChat = Math.max(0, cwRect.width - safeMargin * 2);

  let width = Math.min(widthPx, viewportLimitPx, availableViewport || widthPx);
  if (availableWithinChat > 0) {
    width = Math.min(width, availableWithinChat);
  }

  const minComfort = Math.min(widthPx, viewportLimitPx, availableViewport || widthPx);
  if (width < 280 && minComfort >= 280) {
    width = Math.min(minComfort, Math.max(width, 280));
  }

  if (!Number.isFinite(width) || width <= 0) {
    width = Math.min(widthPx, viewportLimitPx, availableViewport || widthPx);
  }

  const left = Math.max(safeMargin, cwRect.right - width);
  const bottomOffset = Math.max(safeMargin, window.innerHeight - barRect.top + safeMargin);

  const maxHeightViewport = isFinite(maxHvh) ? window.innerHeight * (maxHvh / 100) : maxHpx;
  const availableHeight = Math.max(0, barRect.top - safeMargin);
  const maxHeight = Math.min(maxHpx, maxHeightViewport, availableHeight || maxHpx);

  el.style.position  = "fixed";
  el.style.left      = `${Math.round(left)}px`;
  el.style.right     = "auto";
  el.style.bottom    = `${Math.round(bottomOffset)}px`;
  el.style.width     = `${Math.round(width)}px`;
  el.style.maxWidth  = `${Math.round(Math.min(widthPx, viewportLimitPx, Math.max(width, availableWithinChat || width, availableViewport || width)))}px`;
  if (Number.isFinite(maxHeight) && maxHeight > 0) {
    el.style.maxHeight = `${Math.round(maxHeight)}px`;
  } else {
    el.style.removeProperty("max-height");
  }
  el.style.zIndex    = el.style.zIndex || "6002"; // keep above chat, below navbar modals
}
window.BTFW_positionPopoverAboveChatBar = positionAboveChatBar;

let scrolling = false;
let scrollTimeout;

window.addEventListener('scroll', () => {
  if (!scrolling) {
    document.body.classList.add('is-scrolling');
    scrolling = true;
  }
  
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    document.body.classList.remove('is-scrolling');
    scrolling = false;
  }, 150);
}, { passive: true });
  
function repositionOpenPopins(){
  const helper = (el, opts) => window.BTFW_positionPopoverAboveChatBar && window.BTFW_positionPopoverAboveChatBar(el, opts);

  // Emotes (visible when NOT .hidden)
  const em = document.getElementById("btfw-emotes-pop");
  if (em && !em.classList.contains("hidden")) {
    helper(em, { widthPx: 560, widthVw: 92, maxHpx: 480, maxHvh: 70 });
  }

  // Chat Tools (modal active -> position its card)
  const ctCard = document.querySelector("#btfw-ct-modal.is-active .btfw-ct-card");
  if (ctCard) {
    helper(ctCard, { widthPx: 420, widthVw: 92, maxHpx: 360, maxHvh: 60 });
  }

  // Userlist (uses display toggling)
  const ul = document.getElementById("btfw-userlist-pop");
  if (ul && ul.style.display !== "none") {
    helper(ul);
  }
}
window.addEventListener("resize", repositionOpenPopins);
window.addEventListener("scroll", repositionOpenPopins, true);
document.addEventListener("btfw:layoutReady", ()=> setTimeout(repositionOpenPopins, 0));


  /* ---------------- Userlist popover (same pattern as Emote popover) ---------------- */
  function adoptUserlistIntoPopover(){
    const body = $("#btfw-userlist-pop .btfw-popbody");
    const ul   = $("#userlist");
    if (!body || !ul) return;
    if (ul.parentElement !== body) {
      ul.classList.add("btfw-userlist-overlay");
      ul.classList.remove("btfw-userlist-overlay--open");
      ul.style.removeProperty("display");
      ul.style.removeProperty("position");
      body.appendChild(ul);
    }
  }

  const scheduleAdoptUserlist = (() => {
    let pending = false;
    const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
    return () => {
      if (pending) return;
      pending = true;
      raf(() => {
        pending = false;
        adoptUserlistIntoPopover();
      });
    };
  })();

  const userlistSocketState = {
    wired: false,
    socketRef: null,
    teardown: null,
    retryTimer: null
  };

  function wireUserlistSocketWatchers(){
    const sock = window.socket;

    if (userlistSocketState.wired && userlistSocketState.socketRef && userlistSocketState.socketRef !== sock) {
      if (typeof userlistSocketState.teardown === "function") {
        try { userlistSocketState.teardown(); } catch (_) {}
      }
      userlistSocketState.teardown = null;
      userlistSocketState.wired = false;
      userlistSocketState.socketRef = null;
    }

    if (userlistSocketState.retryTimer) {
      clearTimeout(userlistSocketState.retryTimer);
      userlistSocketState.retryTimer = null;
    }

    if (userlistSocketState.wired) return;

    if (!sock || typeof sock.on !== "function") {
      if (!userlistSocketState.retryTimer) {
        userlistSocketState.retryTimer = setTimeout(() => {
          userlistSocketState.retryTimer = null;
          wireUserlistSocketWatchers();
        }, 1000);
      }
      return;
    }

    const events = ["userlist", "addUser", "userLeave"];
    const handler = () => {
      wireUserlistSocketWatchers();
      scheduleAdoptUserlist();
    };

    try {
      events.forEach((evt) => sock.on(evt, handler));
      userlistSocketState.teardown = () => {
        events.forEach((evt) => {
          if (typeof sock.off === "function") {
            try { sock.off(evt, handler); } catch (_) {}
          } else if (typeof sock.removeListener === "function") {
            try { sock.removeListener(evt, handler); } catch (_) {}
          }
        });
      };
      userlistSocketState.wired = true;
      userlistSocketState.socketRef = sock;
      scheduleAdoptUserlist();
    } catch (_) {
      userlistSocketState.wired = false;
      userlistSocketState.socketRef = null;
      if (typeof userlistSocketState.teardown === "function") {
        try { userlistSocketState.teardown(); } catch (_) {}
      }
      userlistSocketState.teardown = null;
      if (!userlistSocketState.retryTimer) {
        userlistSocketState.retryTimer = setTimeout(() => {
          userlistSocketState.retryTimer = null;
          wireUserlistSocketWatchers();
        }, 1500);
      }
    }
  }

  const ensureUserlistDomTriggers = (() => {
    let wired = false;
    const handler = () => {
      wireUserlistSocketWatchers();
      scheduleAdoptUserlist();
    };
    return () => {
      if (wired) return;
      wired = true;
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", handler, { once: true });
      } else {
        setTimeout(handler, 0);
      }
      document.addEventListener("btfw:layoutReady", handler);
      document.addEventListener("btfw:chat:barsReady", handler);
    };
  })();

  function ensureUserlistWatch(){
    if (document._btfw_userlist_watch?.disconnect) {
      try { document._btfw_userlist_watch.disconnect(); } catch (_) {}
    }
    document._btfw_userlist_watch = true;
    ensureUserlistDomTriggers();
    scheduleAdoptUserlist();
    wireUserlistSocketWatchers();
  }
function actionsNode(){
  const bar = document.querySelector("#chatwrap .btfw-chat-bottombar");
  return bar && bar.querySelector("#btfw-chat-actions");
}

/* Move our action buttons into the correct spot, remove legacy duplicates */
function normalizeChatActionButtons() {
  const actions = actionsNode(); if (!actions) return;

  // remove legacy/duplicate
  const legacyGif = document.getElementById("btfw-gif-btn");
  if (legacyGif) legacyGif.remove();

  // native emotelist stays hidden; we drive it programmatically as fallback
  const nativeEmoteBtn = document.querySelector("#emotelistbtn, #emotelist");
  if (nativeEmoteBtn) nativeEmoteBtn.style.display = "none";

  // ensure our buttons exist (create if missing)
  if (!document.getElementById("btfw-btn-emotes")) {
    const b = document.createElement("button");
    b.id = "btfw-btn-emotes";
    b.className = "button is-dark is-small btfw-chatbtn";
    b.title = "Emotes / Emoji";
    b.innerHTML = '<i class="fa fa-smile"></i>';
    actions.appendChild(b);
  }
  if (!document.getElementById("btfw-btn-gif")) {
    const b = document.createElement("button");
    b.id = "btfw-btn-gif";
    b.className = "button is-dark is-small btfw-chatbtn";
    b.title = "GIFs";
    b.innerHTML = '<i class="fa-solid fa-video"></i>';
    actions.appendChild(b);
  }

  // if some other module created them elsewhere, adopt them
  ["btfw-btn-emotes", "btfw-btn-gif", "btfw-chatcmds-btn", "btfw-users-toggle", "usercount"].forEach(id=>{
    const el = document.getElementById(id);
    if (el && el.parentElement !== actions) actions.appendChild(el);
  });

  const gifBtn = actions.querySelector("#btfw-btn-gif");
  if (gifBtn) {
    gifBtn.classList.add("btfw-chatbtn");
    gifBtn.classList.add("button", "is-dark", "is-small");
    gifBtn.title = gifBtn.title || "GIFs";

    const hasIcon = gifBtn.querySelector("i.fa-solid.fa-video");
    if (!hasIcon) {
      gifBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
    }
  }

  orderChatActions(actions);
}

const CHAT_ACTION_ORDER = [
  "#btfw-btn-emotes",
  "#btfw-btn-gif",
  "#btfw-chattools-btn",
  "#btfw-ct-open",
  "#btfw-chatcmds-btn",
  "#btfw-users-toggle",
  "#usercount"
];

function orderChatActions(actions){
  if (!actions) return;

  const orderedNodes = [];
  CHAT_ACTION_ORDER.forEach((sel) => {
    const el = actions.querySelector(sel);
    if (el && el.parentElement === actions && !orderedNodes.includes(el)) {
      orderedNodes.push(el);
    }
  });

  if (orderedNodes.length <= 1) return;

  let alreadyOrdered = true;
  outer: for (let i = 0; i < orderedNodes.length - 1; i += 1) {
    for (let j = i + 1; j < orderedNodes.length; j += 1) {
      const rel = orderedNodes[i].compareDocumentPosition(orderedNodes[j]);
      if (rel & Node.DOCUMENT_POSITION_PRECEDING) {
        alreadyOrdered = false;
        break outer;
      }
    }
  }

  if (alreadyOrdered) return;

  const anchor = document.createElement("span");
  anchor.style.display = "none";
  actions.insertBefore(anchor, actions.firstChild);
  orderedNodes.forEach((node) => {
    if (node.parentElement === actions) {
      actions.insertBefore(node, anchor);
    }
  });
  anchor.remove();
}


const scheduleNormalizeChatActions = (() => {
  let pending = false;
  const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
  return () => {
    if (pending) return;
    pending = true;
    raf(() => {
      pending = false;
      normalizeChatActionButtons();
    });
  };
})();

/* Watch the whole document for late/stray button injections and normalize */
  const buttonSocketState = {
    wired: false,
    socketRef: null,
    teardown: null,
    retryTimer: null
  };

  function ensureChatActionsObserver(){
    const actions = actionsNode();
    if (!actions) return;

    const prev = document._btfw_btn_obsTarget;
    if (prev && prev !== actions) {
      const prevObserver = prev._btfwNormalizeObserver;
      if (prevObserver && typeof prevObserver.disconnect === "function") {
        try { prevObserver.disconnect(); } catch (_) {}
      }
      prev._btfwNormalizeObserver = null;
      document._btfw_btn_obsTarget = null;
    }

    if (actions._btfwNormalizeObserver) return;

    const observer = new MutationObserver(() => scheduleNormalizeChatActions());
    try {
      observer.observe(actions, { childList: true });
      actions._btfwNormalizeObserver = observer;
      document._btfw_btn_obsTarget = actions;
    } catch (_) {
      scheduleNormalizeChatActions();
    }
  }

  function wireButtonSocketListeners(){
    const sock = window.socket;

    if (buttonSocketState.wired && buttonSocketState.socketRef && buttonSocketState.socketRef !== sock) {
      if (typeof buttonSocketState.teardown === "function") {
        try { buttonSocketState.teardown(); } catch (_) {}
      }
      buttonSocketState.teardown = null;
      buttonSocketState.wired = false;
      buttonSocketState.socketRef = null;
    }

    if (buttonSocketState.retryTimer) {
      clearTimeout(buttonSocketState.retryTimer);
      buttonSocketState.retryTimer = null;
    }

    if (buttonSocketState.wired) return;

    if (!sock || typeof sock.on !== "function") {
      if (!buttonSocketState.retryTimer) {
        buttonSocketState.retryTimer = setTimeout(() => {
          buttonSocketState.retryTimer = null;
          wireButtonSocketListeners();
        }, 1000);
      }
      return;
    }

    const events = ["changeMedia", "queue", "setUserMeta", "setAFK"];
    const handler = () => {
      wireButtonSocketListeners();
      ensureChatActionsObserver();
      scheduleNormalizeChatActions();
    };

    try {
      events.forEach((evt) => sock.on(evt, handler));
      buttonSocketState.teardown = () => {
        events.forEach((evt) => {
          if (typeof sock.off === "function") {
            try { sock.off(evt, handler); } catch (_) {}
          } else if (typeof sock.removeListener === "function") {
            try { sock.removeListener(evt, handler); } catch (_) {}
          }
        });
      };
      buttonSocketState.wired = true;
      buttonSocketState.socketRef = sock;
    } catch (_) {
      buttonSocketState.wired = false;
      buttonSocketState.socketRef = null;
      if (typeof buttonSocketState.teardown === "function") {
        try { buttonSocketState.teardown(); } catch (_) {}
      }
      buttonSocketState.teardown = null;
      if (!buttonSocketState.retryTimer) {
        buttonSocketState.retryTimer = setTimeout(() => {
          buttonSocketState.retryTimer = null;
          wireButtonSocketListeners();
        }, 1500);
      }
    }
  }

  const ensureButtonDomTriggers = (() => {
    let wired = false;
      const handler = () => {
        wireButtonSocketListeners();
        ensureChatActionsObserver();
        scheduleNormalizeChatActions();
      };
    return () => {
      if (wired) return;
      wired = true;
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", handler, { once: true });
      } else {
        setTimeout(handler, 0);
      }
      document.addEventListener("btfw:layoutReady", handler);
      document.addEventListener("btfw:chat:barsReady", handler);
    };
  })();

  function watchForStrayButtons(){
    if (document._btfw_btn_watch) return;
    document._btfw_btn_watch = true;

    ensureButtonDomTriggers();
    ensureChatActionsObserver();
    scheduleNormalizeChatActions();
    wireButtonSocketListeners();
  }

  /* ---------------- Auto-scroll management ---------------- */
  const scrollState = {
    buffer: null,
    isUserScrolledUp: false,
    lastScrollTop: 0,
    timeout: null
  };

  const processedMessages = new WeakSet();
  const processedMessageMedia = new WeakSet();

  function isChatMessageElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const classList = el.classList;
    if (!classList || classList.length === 0) return false;
    if (classList.contains("chat-msg")) return true;
    for (const cls of classList) {
      if (cls && cls.startsWith("chat-msg-")) return true;
    }
    return false;
  }

  function applyChatMessageGrouping(el) {
    if (!isChatMessageElement(el)) return;
    const hasUsername = !!el.querySelector(".username");
    if (hasUsername) {
      el.classList.add("btfw-new-user-msg");
      el.classList.remove("btfw-continuation-msg");
    } else {
      el.classList.add("btfw-continuation-msg");
      el.classList.remove("btfw-new-user-msg");
    }
  }

  function markChatMessageGroups() {
    const buffer = getChatBuffer();
    if (!buffer) return;
    const nodes = buffer.children || [];
    for (const node of nodes) {
      if (!node || node.nodeType !== 1) continue;
      applyChatMessageGrouping(node);
    }
  }

  const scheduleMarkChatMessageGroups = (() => {
    let pending = false;
    const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
    return () => {
      if (pending) return;
      pending = true;
      raf(() => {
        pending = false;
        markChatMessageGroups();
      });
    };
  })();

  function getChatBuffer(){
    return document.getElementById("messagebuffer") ||
           document.querySelector(".chat-messages, #chatbuffer, .message-buffer");
  }

  function isScrolledToBottom(el){
    if (!el) return false;
    const tolerance = 5;
    return el.scrollTop >= (el.scrollHeight - el.clientHeight - tolerance);
  }

  function scrollBufferToBottom(el, smooth){
    if (!el) return;
    if (smooth && typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }

  function handleScroll(event){
    const el = event.currentTarget || event.target;
    if (!el) return;

    const current = el.scrollTop;
    const atBottom = isScrolledToBottom(el);

    if (current < scrollState.lastScrollTop && !atBottom) {
      scrollState.isUserScrolledUp = true;
    } else if (current > scrollState.lastScrollTop && atBottom) {
      scrollState.isUserScrolledUp = false;
    }

    scrollState.lastScrollTop = current;

    if (scrollState.timeout) clearTimeout(scrollState.timeout);
    scrollState.timeout = setTimeout(() => {
      if (isScrolledToBottom(el)) {
        scrollState.isUserScrolledUp = false;
      }
    }, 800);
  }

  function scheduleScrollAfterMedia(){
    if (scrollState.isUserScrolledUp) return;
    const buffer = scrollState.buffer || getChatBuffer();
    if (!buffer) return;

    const raf = window.requestAnimationFrame;
    if (typeof raf === "function") {
      raf(() => raf(() => scrollBufferToBottom(buffer, false)));
    } else {
      setTimeout(() => scrollBufferToBottom(buffer, false), 32);
    }
  }

  function handleNewMessage(){
    const buffer = scrollState.buffer || getChatBuffer();
    if (!buffer || scrollState.isUserScrolledUp) return;
    setTimeout(() => scrollBufferToBottom(buffer, false), 16);
  }

  function wireMessageMediaAutoScroll(msgEl){
    if (!msgEl || processedMessageMedia.has(msgEl)) return;
    processedMessageMedia.add(msgEl);

    const images = msgEl.querySelectorAll?.("img");
    if (!images || images.length === 0) return;

    images.forEach((img) => {
      if (!img) return;

      const onLoad = () => {
        img.removeEventListener("load", onLoad);
        scheduleScrollAfterMedia();
      };

      if (img.complete && img.naturalHeight !== 0) {
        scheduleScrollAfterMedia();
      } else {
        img.addEventListener("load", onLoad, { once: true });
        setTimeout(() => {
          if (img.complete && img.naturalHeight !== 0) {
            img.removeEventListener("load", onLoad);
            scheduleScrollAfterMedia();
          }
        }, 250);
      }
    });
  }

  function escapeHTML(str){
    return (str || "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch] || ch);
  }

  function restyleTriviaMessage(msgEl){
    if (!msgEl || msgEl.dataset?.btfwTriviaStyled) return;
    const code = msgEl.querySelector("code");
    if (!code) return;
    const raw = (code.textContent || "").trim();
    if (!TRIVIA_PREFIX.test(raw)) return;

    const question = raw.replace(TRIVIA_PREFIX, "").trim();
    const hostSpan = code.closest("span");
    if (!hostSpan) return;

    const optionNodes = Array.from(hostSpan.querySelectorAll(".chatcolor"));
    const options = [];
    optionNodes.forEach((node) => {
      const text = (node.textContent || "").replace(/,\s*$/, "").trim();
      if (!text) return;
      const color = node.style?.color || "";
      options.push({ text, color });
    });

    if (!options.length) {
      const segments = (hostSpan.textContent || "").split(/Options:/i);
      if (segments[1]) {
        segments[1].split(",").map(part => part.trim()).filter(Boolean).forEach((text) => {
          options.push({ text, color: "" });
        });
      }
    }

    const wrapper = document.createElement("div");
    wrapper.className = "btfw-chat-trivia";

    const questionRow = document.createElement("div");
    questionRow.className = "btfw-chat-trivia__question";
    questionRow.innerHTML = `
      <span class="btfw-chat-trivia__icon" aria-hidden="true">🎬</span>
      <span class="btfw-chat-trivia__prompt">${escapeHTML(question || "Trivia question")}</span>
    `;
    wrapper.appendChild(questionRow);

    if (options.length) {
      const meta = document.createElement("div");
      meta.className = "btfw-chat-trivia__meta";
      meta.textContent = "Choose the correct answer:";
      wrapper.appendChild(meta);

      const list = document.createElement("ol");
      list.className = "btfw-chat-trivia__options";
      options.forEach((opt, index) => {
        const li = document.createElement("li");
        li.className = "btfw-chat-trivia__option";
        if (opt.color) li.style.setProperty("--btfw-trivia-option-color", opt.color);
        li.innerHTML = `
          <span class="btfw-chat-trivia__badge">${index + 1}</span>
          <span class="btfw-chat-trivia__label">${escapeHTML(opt.text)}</span>
        `;
        list.appendChild(li);
      });
      wrapper.appendChild(list);
    }

    hostSpan.replaceWith(wrapper);
    msgEl.classList.add("btfw-chat-trivia-msg");
    msgEl.dataset.btfwTriviaStyled = "1";
  }

  function processPendingChatMessages(){
    const buffer = getChatBuffer();
    if (!buffer) return;
    let sawMessage = false;
    buffer.querySelectorAll(MESSAGE_SELECTOR).forEach((el) => {
      if (processedMessages.has(el)) return;
      restyleTriviaMessage(el);
      applyChatMessageGrouping(el);
      processedMessages.add(el);
      wireMessageMediaAutoScroll(el);
      sawMessage = true;
    });
    if (sawMessage) handleNewMessage();
  }

  const scheduleProcessPendingChatMessages = (() => {
    let pending = false;
    const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
    return () => {
      if (pending) return;
      pending = true;
      raf(() => {
        pending = false;
        processPendingChatMessages();
      });
    };
  })();

  function onSocketChatMessage(){
    scheduleProcessPendingChatMessages();
    setTimeout(() => processPendingChatMessages(), 80);
  }

  const chatSocketState = {
    wired: false,
    retryTimer: null,
    socketRef: null,
    teardown: null
  };

  function wireChatSocketWatcher(){
    const sock = window.socket;
    if (chatSocketState.wired && chatSocketState.socketRef && chatSocketState.socketRef !== sock) {
      if (typeof chatSocketState.teardown === "function") {
        try { chatSocketState.teardown(); } catch(_) {}
      }
      chatSocketState.wired = false;
      chatSocketState.socketRef = null;
      chatSocketState.teardown = null;
    }
    if (chatSocketState.wired) return;
    if (!sock || typeof sock.on !== "function") {
      if (!chatSocketState.retryTimer) {
        chatSocketState.retryTimer = setTimeout(() => {
          chatSocketState.retryTimer = null;
          wireChatSocketWatcher();
        }, 1000);
      }
      return;
    }
    try {
      sock.on("chatMsg", onSocketChatMessage);
      chatSocketState.wired = true;
      chatSocketState.socketRef = sock;
      if (typeof sock.off === "function") {
        chatSocketState.teardown = () => {
          try { sock.off("chatMsg", onSocketChatMessage); } catch(_) {}
        };
      } else if (typeof sock.removeListener === "function") {
        chatSocketState.teardown = () => {
          try { sock.removeListener("chatMsg", onSocketChatMessage); } catch(_) {}
        };
      } else {
        chatSocketState.teardown = null;
      }
      if (chatSocketState.retryTimer) {
        clearTimeout(chatSocketState.retryTimer);
        chatSocketState.retryTimer = null;
      }
      scheduleProcessPendingChatMessages();
    } catch (err) {
      chatSocketState.wired = false;
      if (!chatSocketState.retryTimer) {
        chatSocketState.retryTimer = setTimeout(() => {
          chatSocketState.retryTimer = null;
          wireChatSocketWatcher();
        }, 1500);
      }
    }
  }

  function restyleExistingTrivia(){
    const buffer = getChatBuffer();
    if (!buffer) return;
    buffer.querySelectorAll(MESSAGE_SELECTOR).forEach((el) => {
      restyleTriviaMessage(el);
      processedMessages.add(el);
    });
  }

  function bindChatBuffer(buffer){
    if (!buffer) return;
    if (scrollState.buffer === buffer) return;

    if (scrollState.buffer) {
      scrollState.buffer.removeEventListener("scroll", handleScroll);
    }
    if (scrollState.timeout) {
      clearTimeout(scrollState.timeout);
      scrollState.timeout = null;
    }

    scrollState.buffer = buffer;
    scrollState.isUserScrolledUp = false;
    scrollState.lastScrollTop = buffer.scrollTop;

    buffer.addEventListener("scroll", handleScroll, { passive: true });

    processPendingChatMessages();
    scheduleMarkChatMessageGroups();
    setTimeout(() => scrollBufferToBottom(buffer, false), 80);
  }

  function ensureScrollManagement(){
    const buffer = getChatBuffer();
    if (!buffer) return;
    bindChatBuffer(buffer);
  }

  function scrollChat(opts){
    const buffer = scrollState.buffer || getChatBuffer();
    if (!buffer) return;
    scrollState.isUserScrolledUp = false;
    let smooth = true;
    if (typeof opts === "boolean") smooth = opts;
    else if (opts && Object.prototype.hasOwnProperty.call(opts, "smooth")) smooth = !!opts.smooth;
    scrollBufferToBottom(buffer, smooth);
  }

  if (typeof window.scrollChat !== "function") {
    window.scrollChat = scrollChat;
  }

  function locateUserlistItem(name){
    if (!name) return null;
    const direct = document.querySelector(`#userlist li[data-name="${CSS.escape(name)}"]`);
    if (direct) return direct;
    const candidates = document.querySelectorAll('#userlist li, #userlist .userlist_item, #userlist .user');
    for (const el of candidates) {
      const attr = (el.getAttribute && el.getAttribute('data-name')) || '';
      const text = attr || (el.textContent || '');
      if (!text) continue;
      if (text.trim().replace(/:\s*$/, '').toLowerCase() === name.toLowerCase()) return el;
    }
    return null;
  }

  function wireChatUsernameContextMenu(){
    const buf = document.getElementById('messagebuffer');
    if (!buf || buf._btfwNameContext) return;
    buf._btfwNameContext = true;

    buf.addEventListener('click', (ev) => {
      if (ev.button !== 0) return;
      const target = ev.target.closest('.username');
      if (!target) return;
      const raw = (target.textContent || '').trim();
      if (!raw) return;
      const name = raw.replace(/:\s*$/, '');
      if (!name) return;

      const item = locateUserlistItem(name);
      if (!item) return;

      const rect = target.getBoundingClientRect();
      const clientX = ev.clientX || rect.left + rect.width / 2;
      const clientY = ev.clientY || rect.bottom + 6;

      const menuEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY
      });

      item.dispatchEvent(menuEvent);
      ev.preventDefault();
      ev.stopPropagation();
    }, true);
  }

  function adoptNewMessageIndicator(){
    const indicator = document.getElementById('newmessages-indicator');
    const controls = document.querySelector('#chatwrap .btfw-controls-row');
    if (!indicator || !controls) return;
    const buffer = document.getElementById('messagebuffer');

    indicator.classList.add('btfw-newmessages');
    indicator.style.position = '';
    indicator.style.left = '';
    indicator.style.right = '';
    indicator.style.bottom = '';
    indicator.style.top = '';

    let slot = document.querySelector('#chatwrap .btfw-newmessages-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'btfw-newmessages-slot';
    }

    if (buffer && buffer.parentNode) {
      const parent = buffer.parentNode;
      if (slot.parentNode !== parent) {
        parent.insertBefore(slot, buffer.nextSibling);
      } else if (slot.previousElementSibling !== buffer) {
        parent.insertBefore(slot, buffer.nextSibling);
      }
    } else if (!slot.parentNode && controls.parentNode) {
      controls.parentNode.insertBefore(slot, controls);
    } else if (slot.parentNode === controls.parentNode && slot.nextSibling !== controls) {
      controls.parentNode.insertBefore(slot, controls);
    }

    if (indicator.parentElement !== slot) {
      slot.appendChild(indicator);
    }
  }
  function ensureUserlistPopover(){
    if ($("#btfw-userlist-pop")) return;

    // Backdrop — same family as emote popover
    const back = document.createElement("div");
    back.id = "btfw-userlist-backdrop";
    back.className = "btfw-popover-backdrop";
    back.style.display = "none";
    back.style.zIndex = "6001";
    document.body.appendChild(back);

    // Panel
    const pop = document.createElement("div");
    pop.id = "btfw-userlist-pop";
    pop.className = "btfw-popover btfw-userlist-pop";
    pop.style.display = "none";
    pop.style.zIndex = "6002";
    pop.innerHTML = `
      <div class="btfw-pophead">
        <span>Users</span>
        <button class="btfw-popclose" aria-label="Close">&times;</button>
      </div>
      <div class="btfw-popbody"></div>
    `;
    document.body.appendChild(pop);

    adoptUserlistIntoPopover();

    const close = () => {
      back.style.display = "none";
      pop.style.display  = "none";
      const ul = $("#userlist");
      if (ul) ul.classList.remove("btfw-userlist-overlay--open");
    };

    back.addEventListener("click", close);
    pop.querySelector(".btfw-popclose").addEventListener("click", close);
    document.addEventListener("keydown", (ev)=>{ if (ev.key === "Escape") close(); }, true);

    function position(){
    positionAboveChatBar(pop);
    }
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);

    document._btfw_userlist_isOpen = () => pop.style.display !== "none";
    document._btfw_userlist_open   = () => {
      adoptUserlistIntoPopover();
      const ul = $("#userlist");
      if (ul) ul.classList.add("btfw-userlist-overlay--open");
      back.style.display = "block";
      pop.style.display  = "block";
      positionAboveChatBar(pop);
    };
    document._btfw_userlist_close  = close;
    document._btfw_userlist_position = position;
  }

  function toggleUserlist(){
    ensureUserlistPopover();
    if (document._btfw_userlist_isOpen && document._btfw_userlist_isOpen()){
      document._btfw_userlist_close && document._btfw_userlist_close();
    } else {
      document._btfw_userlist_open && document._btfw_userlist_open();
    }
  }

  /* ---------------- Chat bars & actions ---------------- */
  function ensureBars(){
    const cw = $("#chatwrap"); if (!cw) return;
    cw.classList.add("btfw-chatwrap");

    // Top bar (Now Playing slot — feature:nowplaying moves #currenttitle here)
    let top = cw.querySelector(".btfw-chat-topbar");
    if (!top) {
      top = document.createElement("div");
      top.className = "btfw-chat-topbar";
      top.innerHTML = `
        <div class="btfw-chat-topbar-left">
          <div class="btfw-chat-title" id="btfw-nowplaying-slot"></div>
        </div>
        <div class="btfw-chat-topbar-actions" id="btfw-chat-topbar-actions"></div>
      `;
      cw.prepend(top);
    }

    let left = top.querySelector(".btfw-chat-topbar-left");
    if (!left) {
      left = document.createElement("div");
      left.className = "btfw-chat-topbar-left";
      top.prepend(left);
    }

    if (!left.querySelector("#btfw-nowplaying-slot")) {
      const slot = document.createElement("div");
      slot.id = "btfw-nowplaying-slot";
      slot.className = "btfw-chat-title";
      left.appendChild(slot);
    }

    let topActions = top.querySelector("#btfw-chat-topbar-actions");
    if (!topActions) {
      topActions = document.createElement("div");
      topActions.id = "btfw-chat-topbar-actions";
      topActions.className = "btfw-chat-topbar-actions";
      top.appendChild(topActions);
    }

    if (!topActions.querySelector("#btfw-mobile-modules-toggle")) {
      const btn = document.createElement("button");
      btn.id = "btfw-mobile-modules-toggle";
      btn.className = "button is-dark is-small btfw-chatbtn";
      btn.title = "Modules";
      btn.setAttribute("aria-label", "Toggle modules stack");
      btn.innerHTML = '<i class="fa fa-bars"></i>';
      topActions.appendChild(btn);
    }

    // Bottom bar + actions
    let bottom = cw.querySelector(".btfw-chat-bottombar");
    if (!bottom) {
      bottom = document.createElement("div");
      bottom.className = "btfw-chat-bottombar";
      cw.appendChild(bottom);
    }

    let composer = bottom.querySelector(".btfw-chat-composer");
    if (!composer) {
      composer = document.createElement("div");
      composer.className = "btfw-chat-composer";
      bottom.prepend(composer);
    }

    let composerMain = composer.querySelector("#btfw-chat-composer-main");
    if (!composerMain) {
      composerMain = document.createElement("div");
      composerMain.id = "btfw-chat-composer-main";
      composerMain.className = "btfw-chat-composer-main";
      composer.prepend(composerMain);
    }

    let actions = composer.querySelector("#btfw-chat-actions") || bottom.querySelector("#btfw-chat-actions");
    if (actions && actions.parentElement !== composer) {
      composer.appendChild(actions);
    }
    if (!actions) {
      actions = document.createElement("div");
      actions.id = "btfw-chat-actions";
      composer.appendChild(actions);
    }
    actions.classList.add("btfw-chat-actions");

    // 🔹 Remove deprecated/duplicate buttons from previous versions
    const oldGif = $("#btfw-gif-btn");            if (oldGif) oldGif.remove();
    const chatTheme = $("#btfw-theme-btn-chat");  if (chatTheme) chatTheme.remove();

    // 🔹 Emotes button (ours) — lives in actions
    if (!$("#btfw-btn-emotes")) {
      const b = document.createElement("button");
      b.id = "btfw-btn-emotes";
      b.className = "button is-dark is-small btfw-chatbtn";
      b.title = "Emotes / Emoji";
      b.innerHTML = '<i class="fa fa-smile"></i>';
      actions.appendChild(b);
    }

    // Hide the native emotelist button if it exists (we’ll trigger it programmatically)
    const nativeEmoteBtn = $("#emotelistbtn, #emotelist");
    if (nativeEmoteBtn) nativeEmoteBtn.style.display = "none";

    // 🔹 GIF button (ours) — lives in actions
    if (!$("#btfw-btn-gif")) {
      const b = document.createElement("button");
      b.id = "btfw-btn-gif";
      b.className = "button is-dark is-small btfw-chatbtn";
      b.title = "GIFs";
      b.innerHTML = '<i class="fa fa-file-video-o"></i>';
      actions.appendChild(b);
    }

    // 🔹 Chat commands button — move into actions if it exists elsewhere
    const cmds = $("#btfw-chatcmds-btn");
    if (cmds && cmds.parentElement !== actions) {
      cmds.classList.add("button","is-dark","is-small","btfw-chatbtn");
      actions.appendChild(cmds);
    }

    // Users button (keep)
    if (!$("#btfw-users-toggle")) {
      const b = document.createElement("button");
      b.id = "btfw-users-toggle";
      b.className = "button is-dark is-small btfw-chatbtn";
      b.title = "Users";
      b.innerHTML = '<i class="fa fa-users"></i>';
      actions.appendChild(b);
    }

    // Buffer & controls layout
    const msg = $("#messagebuffer"); if (msg) msg.classList.add("btfw-messagebuffer");
    const controls = $("#chatcontrols,#chat-controls") || ($("#chatline") && $("#chatline").parentElement);
    if (controls && controls.parentElement !== composerMain) {
      controls.classList.add("btfw-controls-row");
      composerMain.appendChild(controls);
    }
    scheduleNormalizeChatActions();
    wireChatUsernameContextMenu();
    adoptNewMessageIndicator();

    document.dispatchEvent(new CustomEvent("btfw:chat:barsReady", {
      detail: {
        topbar: top,
        bottombar: bottom,
        actions: topActions
      }
    }));
  }

  function refreshChatDom(){
    ensureBars();
    adoptUserlistIntoPopover();
    adoptNewMessageIndicator();
    ensureScrollManagement();
    restyleExistingTrivia();
    scheduleProcessPendingChatMessages();
    scheduleMarkChatMessageGroups();
  }

  const scheduleChatDomRefresh = (() => {
    let pending = false;
    const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
    return () => {
      if (pending) return;
      pending = true;
      raf(() => {
        pending = false;
        refreshChatDom();
      });
    };
  })();

  /* ---------------- Usercount cleanup + styling ---------------- */
  const usercountState = {
    socket: null
  };

  function cleanUsercountText(){
    const uc = $("#usercount");
    if (!uc) return;

    const cleaned = (uc.textContent || "")
      .replace(/connected users/gi, " ")
      .replace(/connected user/gi, " ")
      .replace(/not connected/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    uc.textContent = cleaned || "0";
  }

  function wireUsercountSocket(){
    const uc = $("#usercount");
    if (!uc) return;

    cleanUsercountText();

    const sock = window.socket;
    if (!sock || typeof sock.on !== "function") {
      setTimeout(wireUsercountSocket, 500);
      return;
    }

    if (usercountState.socket === sock) return;
    usercountState.socket = sock;

    sock.on("usercount", () => {
      cleanUsercountText();
    });

    sock.on("userlist", (list) => {
      if (Array.isArray(list)) {
        const el = $("#usercount");
        if (el) el.textContent = String(list.length);
      }
      cleanUsercountText();
    });
  }

 function ensureUsercountInBar(){
  const cw = $("#chatwrap"); if (!cw) return;
  const bar = cw.querySelector(".btfw-chat-bottombar"); if (!bar) return;
  const actions = bar.querySelector("#btfw-chat-actions"); if (!actions) return;

  let uc = actions.querySelector("#usercount");
  if (!uc) {
    uc = $("#usercount");
    if (uc && uc.parentElement !== actions) {
      actions.appendChild(uc);
    }
  }

  if (!uc) {
    uc = document.createElement("div");
    uc.id = "usercount";
    actions.appendChild(uc);
  }

  uc.classList.add("btfw-usercount");
  uc.classList.remove("pointer"); // Remove pointer cursor class
  if (!uc.title) uc.title = "Connected users";

  // Disable all interaction
  if (!uc.dataset.btfwUsercountBound) {
    uc.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);
    uc.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);
    uc.dataset.btfwUsercountBound = "true";
  }

  cleanUsercountText();
  orderChatActions(actions);
  wireUsercountSocket();
}

  /* ---------------- Deterministic username colors ---------------- */
  function colorizeUser(el){
    const n = el.matches?.(".username,.nick,.name") ? el : el.querySelector?.(".username,.nick,.name");
    if (!n) return;
    const t = (n.textContent||"").replace(":","").trim(); if(!t) return;
    let hash=0; for(let i=0;i<t.length;i++) hash=t.charCodeAt(i)+((hash<<5)-hash);
    let c="#"; for(let i=0;i<3;i++) c+=("00"+((hash>>(i*8))&0xff).toString(16)).slice(-2);
    n.style.color=c;
  }

  /* ---------------- Observe chat DOM (re-adopt userlist if re-rendered) ---------------- */
  function observeChatDom(){
    const cw = $("#chatwrap"); if (!cw || cw._btfw_chat_obs) return;
    cw._btfw_chat_obs = true;

    new MutationObserver(()=>{
      scheduleChatDomRefresh();
    }).observe(cw,{childList:true,subtree:true});

    const buf = $("#messagebuffer");
    if (buf && !buf._btfw_color_obs){
      buf._btfw_color_obs = true;
      new MutationObserver(muts=>{
        muts.forEach(r=>{
          r.addedNodes.forEach(n=>{
            if (n.nodeType===1) colorizeUser(n);
          });
        });
      }).observe(buf,{childList:true});
      Array.from(buf.querySelectorAll(".username,.nick,.name")).forEach(colorizeUser);
    }

    ensureScrollManagement();
  }

  /* ---------------- Theme Settings opener (unchanged) ---------------- */
  function loadScript(src){
    return new Promise((res,rej)=>{
      const s=document.createElement("script");
      s.src = src; s.async=true; s.defer=true;
      s.onload = ()=> res(true);
      s.onerror= ()=> rej(new Error("Failed to load "+src));
      document.head.appendChild(s);
    });
  }
  let _tsLoading = false;
  async function openThemeSettings(){
    document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));
    let modal = $("#btfw-theme-modal");
    if (modal) { modal.classList.add("is-active"); return; }
    await new Promise(r => setTimeout(r, 40));
    modal = $("#btfw-theme-modal");
    if (modal) { modal.classList.add("is-active"); return; }

    if (_tsLoading) return;
    _tsLoading = true;
    try {
      const url = BASE ? `${BASE}/modules/feature-theme-settings.js` : "/modules/feature-theme-settings.js";
      await loadScript(url);
      document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));
      await new Promise(r => setTimeout(r, 40));
      modal = $("#btfw-theme-modal");
      if (modal) modal.classList.add("is-active");
    } catch(e){
      console.warn("[chat] Theme Settings lazy-load failed:", e.message||e);
    } finally {
      _tsLoading = false;
    }
  }

  /* ---------------- Delegated clicks ---------------- */
  function wireDelegatedClicks(){
    if (window._btfwChatClicksWired) return;
    window._btfwChatClicksWired = true;

    document.addEventListener("click", function(e){
      const t = e.target;
      const gifBtn   = t.closest && t.closest("#btfw-btn-gif");
      const emoBtn   = t.closest && t.closest("#btfw-btn-emotes");
      const themeBtn = t.closest && (t.closest("#btfw-theme-btn-nav")); // chat theme button removed
      const usersBtn = t.closest && t.closest("#btfw-users-toggle");
      const cmdsBtn  = t.closest && t.closest("#btfw-chatcmds-btn");

      if (gifBtn) { e.preventDefault(); document.dispatchEvent(new Event("btfw:openGifs")); return; }

      if (emoBtn) {
        e.preventDefault();
        // Prefer our emote popover if present
        const ev = new Event("btfw:openEmotes");
        document.dispatchEvent(ev);
        // Fallback to native emotelist button if no handler created the popover
        setTimeout(()=>{
          const existing = document.querySelector(".btfw-emote-pop,.btfw-popover.btfw-emote-pop");
          if (!existing) {
            const nativeBtn = document.querySelector("#emotelistbtn, #emotelist");
            if (nativeBtn) nativeBtn.click();
          }
        }, 10);
        return;
      }

      if (themeBtn) { e.preventDefault(); openThemeSettings(); return; }

      if (usersBtn) { e.preventDefault(); toggleUserlist(); return; }

      if (cmdsBtn) {
        e.preventDefault();
        // Let chat-commands module handle it
        document.dispatchEvent(new Event("btfw:openChatCmds"));
        return;
      }
    }, true);
  }

  document.addEventListener("btfw:themeSettings:apply", () => {
    scheduleMarkChatMessageGroups();
  });

  /* ---------------- Boot ---------------- */
  function boot(){
    refreshChatDom();
    wireChatSocketWatcher();
    ensureUserlistWatch();
    ensureUsercountInBar();
    ensureUserlistPopover();
    observeChatDom();
    scheduleMarkChatMessageGroups();
    wireDelegatedClicks();
    watchForStrayButtons();
  }

  document.addEventListener("btfw:layoutReady", ()=> setTimeout(boot, 50));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:chat" };
});
