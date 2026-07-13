/* BTFW — feature:tab-ticker
   Turns the browser-tab title into a compact away-state ticker. */
BTFW.define("feature:tab-ticker", ["feature:nowplaying"], async () => {
  "use strict";

  const FRAME_CHARS = 42;
  const FRAME_MS = 480;
  const MENTION_TTL_MS = 30000;
  const LOOP_GAP = "   •   ";

  const motionQuery = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  const segmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

  function glyphs(value) {
    const text = String(value || "");
    return segmenter
      ? Array.from(segmenter.segment(text), item => item.segment)
      : Array.from(text);
  }

  function plainText(value) {
    if (value == null) return "";
    const node = document.createElement("div");
    node.innerHTML = String(value);
    return (node.textContent || node.innerText || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clip(value, limit = 76) {
    const parts = glyphs(value);
    return parts.length > limit ? parts.slice(0, limit - 1).join("") + "…" : parts.join("");
  }

  function channelTitle() {
    const current = plainText(document.title);
    if (current && current.toLowerCase() !== "cytube") return current;
    try {
      const configured = plainText(window.CHANNEL?.title || window.CHANNEL?.name);
      if (configured) return configured;
    } catch (_) {}
    return "BillTube";
  }

  function stripMediaPrefix(value) {
    return plainText(value)
      .replace(/^\s*(?:currently|now)\s*playing\s*[:\-]\s*/i, "")
      .trim();
  }

  function mediaTitleFrom(payload) {
    if (payload == null) return "";
    if (typeof payload === "string") return stripMediaPrefix(payload);
    const candidates = [
      payload.title,
      payload.currenttitle,
      payload.currentTitle,
      payload.media?.title,
      payload.queue?.title,
      payload.qe?.title
    ];
    for (const value of candidates) {
      const title = stripMediaPrefix(value);
      if (title) return title;
    }
    return "";
  }

  function ownName() {
    try {
      return typeof window.CLIENT?.name === "string" ? window.CLIENT.name.trim() : "";
    } catch (_) {
      return "";
    }
  }

  function containsMention(text, name) {
    if (!text || !name) return false;
    const haystack = text.toLowerCase();
    const needle = name.toLowerCase();
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      const before = index === 0 ? " " : haystack[index - 1];
      const afterIndex = index + needle.length;
      const after = afterIndex >= haystack.length ? " " : haystack[afterIndex];
      if (!/[a-z0-9_]/i.test(before) && !/[a-z0-9_]/i.test(after)) return true;
      index = haystack.indexOf(needle, index + needle.length);
    }
    return false;
  }

  const state = {
    baseTitle: channelTitle(),
    media: "",
    poll: "",
    mention: null,
    mentionCount: 0,
    frame: 0,
    signature: "",
    kind: "channel",
    fullTitle: "",
    tickerTimer: null,
    mentionTimer: null,
    pollObserver: null,
    mediaObserver: null,
    domRetryTimer: null,
    retryTimers: new Set(),
    socket: null,
    socketHandlers: null,
    stopped: false
  };

  function status() {
    if (state.mention) {
      const count = state.mentionCount > 1 ? `${state.mentionCount} mentions · ` : "";
      return {
        kind: "mention",
        text: `💬 ${count}${state.mention.sender}: ${state.mention.message}`
      };
    }
    if (state.poll) return { kind: "poll", text: `📊 Poll: ${state.poll}` };
    if (state.media) return { kind: "media", text: `🎬 ${state.media}` };
    return { kind: "channel", text: state.baseTitle };
  }

  function composedTitle() {
    const current = status();
    if (current.kind === "channel") return current;
    return {
      kind: current.kind,
      text: `${current.text} • ${state.baseTitle}`
    };
  }

  function pageIsAway() {
    return document.visibilityState === "hidden" || !document.hasFocus();
  }

  function shouldMarquee(text) {
    if (motionQuery?.matches || !pageIsAway()) return false;
    return glyphs(text).length > FRAME_CHARS;
  }

  function marqueeFrame(text) {
    const icon = state.kind === "mention"
      ? "💬 "
      : (state.kind === "poll" ? "📊 " : (state.kind === "media" ? "🎬 " : ""));
    const iconParts = glyphs(icon);
    const textParts = glyphs(text);
    const source = icon && text.startsWith(icon)
      ? textParts.slice(iconParts.length)
      : textParts;
    const loop = source.concat(glyphs(LOOP_GAP));
    if (!loop.length) return state.baseTitle;
    const start = state.frame % loop.length;
    const result = iconParts.slice();
    const movingChars = Math.max(1, FRAME_CHARS - iconParts.length);
    for (let index = 0; index < movingChars; index += 1) {
      result.push(loop[(start + index) % loop.length]);
    }
    return result.join("");
  }

  function writeTitle(value) {
    const next = String(value || state.baseTitle);
    if (document.title !== next) document.title = next;
  }

  function stopTickerTimer() {
    if (!state.tickerTimer) return;
    clearInterval(state.tickerTimer);
    state.tickerTimer = null;
  }

  function syncTickerTimer() {
    const animate = shouldMarquee(state.fullTitle);
    if (!animate) {
      stopTickerTimer();
      writeTitle(state.fullTitle);
      return;
    }
    writeTitle(marqueeFrame(state.fullTitle));
    if (state.tickerTimer) return;
    state.tickerTimer = setInterval(() => {
      if (!shouldMarquee(state.fullTitle)) {
        syncTickerTimer();
        return;
      }
      state.frame += 1;
      writeTitle(marqueeFrame(state.fullTitle));
    }, FRAME_MS);
  }

  function render(resetFrame = false) {
    if (state.stopped) return;
    const current = composedTitle();
    const signature = `${current.kind}|${current.text}`;
    if (resetFrame || signature !== state.signature) {
      state.frame = 0;
      state.signature = signature;
    }
    state.kind = current.kind;
    state.fullTitle = current.text;
    syncTickerTimer();
  }

  function setMedia(value) {
    const next = clip(stripMediaPrefix(value), 90);
    if (!next || next === state.media) return;
    state.media = next;
    render(true);
  }

  function clearMedia() {
    if (!state.media) return;
    state.media = "";
    render(true);
  }

  function setPoll(value) {
    const next = clip(plainText(value) || "Vote now", 90);
    if (next === state.poll) return;
    state.poll = next;
    render(true);
  }

  function clearPoll() {
    if (!state.poll) return;
    state.poll = "";
    render(true);
  }

  function clearMention() {
    if (state.mentionTimer) {
      clearTimeout(state.mentionTimer);
      state.mentionTimer = null;
    }
    if (!state.mention) return;
    state.mention = null;
    state.mentionCount = 0;
    render(true);
  }

  function handleMention(payload) {
    if (!pageIsAway()) return;
    const name = ownName();
    if (!name) return;
    const sender = plainText(payload?.username || payload?.name || "Chat");
    if (sender && sender.toLowerCase() === name.toLowerCase()) return;
    const message = plainText(payload?.msg);
    if (!containsMention(message, name)) return;

    state.mention = {
      sender: clip(sender || "Chat", 28),
      message: clip(message, 72)
    };
    state.mentionCount += 1;
    if (state.mentionTimer) clearTimeout(state.mentionTimer);
    state.mentionTimer = setTimeout(clearMention, MENTION_TTL_MS);
    render(true);
  }

  function mediaFromDom() {
    const current = document.querySelector("#currenttitle, .currenttitle");
    const queue = document.querySelector("#queue .queue_active .qe_title a, #queue .queue_active .qe_title");
    return stripMediaPrefix(current?.textContent || queue?.textContent || "");
  }

  function pollFromDom() {
    const poll = document.querySelector("#pollwrap .well.active");
    return poll ? plainText(poll.querySelector("h3")?.textContent) : "";
  }

  function syncMediaFromDom() {
    const title = mediaFromDom();
    if (title) setMedia(title);
    else clearMedia();
  }

  function syncPollFromDom() {
    const title = pollFromDom();
    if (title) setPoll(title);
    else clearPoll();
  }

  function schedule(callback, delay) {
    const timer = setTimeout(() => {
      state.retryTimers.delete(timer);
      if (!state.stopped) callback();
    }, delay);
    state.retryTimers.add(timer);
  }

  function wireDomObservers() {
    if (!state.pollObserver) {
      const pollWrap = document.querySelector("#pollwrap");
      if (pollWrap) {
        let pending = null;
        state.pollObserver = new MutationObserver(() => {
          if (pending) clearTimeout(pending);
          pending = setTimeout(() => {
            pending = null;
            syncPollFromDom();
          }, 80);
        });
        state.pollObserver.observe(pollWrap, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
        syncPollFromDom();
      }
    }

    if (!state.mediaObserver) {
      const mediaRoot = document.querySelector("#btfw-nowplaying-slot, #queue");
      if (mediaRoot) {
        let pending = null;
        state.mediaObserver = new MutationObserver(() => {
          if (pending) clearTimeout(pending);
          pending = setTimeout(() => {
            pending = null;
            syncMediaFromDom();
          }, 80);
        });
        state.mediaObserver.observe(mediaRoot, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
        syncMediaFromDom();
      }
    }

    if ((!state.pollObserver || !state.mediaObserver) && !state.domRetryTimer) {
      state.domRetryTimer = setTimeout(() => {
        state.domRetryTimer = null;
        if (!state.stopped) wireDomObservers();
      }, 750);
    }
  }

  function detachSocket() {
    if (!state.socket || !state.socketHandlers) return;
    const remove = typeof state.socket.off === "function"
      ? state.socket.off.bind(state.socket)
      : (typeof state.socket.removeListener === "function" ? state.socket.removeListener.bind(state.socket) : null);
    if (remove) {
      state.socketHandlers.forEach((handler, event) => {
        try { remove(event, handler); } catch (_) {}
      });
    }
    state.socket = null;
    state.socketHandlers = null;
  }

  function wireSocket() {
    const socket = window.socket;
    if (!socket || typeof socket.on !== "function") {
      schedule(wireSocket, 750);
      return;
    }
    if (state.socket === socket) return;
    detachSocket();

    const handlers = new Map([
      ["chatMsg", handleMention],
      ["newPoll", payload => setPoll(payload?.title)],
      ["closePoll", clearPoll],
      ["changeMedia", payload => {
        const title = mediaTitleFrom(payload);
        if (title) setMedia(title);
        else schedule(syncMediaFromDom, 120);
      }],
      ["setCurrent", payload => {
        const title = mediaTitleFrom(payload);
        if (title) setMedia(title);
        else schedule(syncMediaFromDom, 120);
      }],
      ["mediaUpdate", payload => {
        const title = mediaTitleFrom(payload);
        if (title) setMedia(title);
      }]
    ]);

    handlers.forEach((handler, event) => socket.on(event, handler));
    state.socket = socket;
    state.socketHandlers = handlers;
  }

  function handleNowPlayingLookup(event) {
    const detail = event?.detail;
    const title = stripMediaPrefix(detail?.canonical || detail?.original || detail?.base);
    if (title) setMedia(title);
  }

  function handleFocus() {
    clearMention();
    render(false);
  }

  function handleAttentionChange() {
    render(true);
  }

  function stop() {
    if (state.stopped) return;
    state.stopped = true;
    stopTickerTimer();
    if (state.mentionTimer) clearTimeout(state.mentionTimer);
    state.retryTimers.forEach(timer => clearTimeout(timer));
    state.retryTimers.clear();
    if (state.domRetryTimer) clearTimeout(state.domRetryTimer);
    state.domRetryTimer = null;
    state.pollObserver?.disconnect();
    state.mediaObserver?.disconnect();
    detachSocket();
    document.removeEventListener("btfw:nowplayingLookup", handleNowPlayingLookup);
    document.removeEventListener("visibilitychange", handleAttentionChange);
    window.removeEventListener("focus", handleFocus);
    window.removeEventListener("blur", handleAttentionChange);
    motionQuery?.removeEventListener?.("change", handleAttentionChange);
    writeTitle(state.baseTitle);
  }

  document.addEventListener("btfw:nowplayingLookup", handleNowPlayingLookup);
  document.addEventListener("visibilitychange", handleAttentionChange);
  window.addEventListener("focus", handleFocus);
  window.addEventListener("blur", handleAttentionChange);
  motionQuery?.addEventListener?.("change", handleAttentionChange);
  window.addEventListener("beforeunload", stop, { once: true });

  wireSocket();
  wireDomObservers();
  syncMediaFromDom();
  syncPollFromDom();
  render(true);

  const api = {
    getState() {
      return {
        baseTitle: state.baseTitle,
        media: state.media,
        poll: state.poll,
        mentionCount: state.mentionCount,
        kind: status().kind,
        animated: Boolean(state.tickerTimer)
      };
    },
    stop
  };
  BTFW.tabTicker = api;
  return api;
});
