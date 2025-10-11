/* BTFW — feature:poll-overlay (video overlay display for CyTube polls) */
BTFW.define("feature:poll-overlay", [], async () => {
  "use strict";

  const CSS_ID = "btfw-poll-overlay-styles";
  const POLL_OVERLAY_CSS = `
    /* Poll Display Overlay on Video */
    #btfw-poll-video-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1500;
      pointer-events: none;
      display: none;
    }

    :root.btfw-poll-overlay-disabled #btfw-poll-video-overlay {
      display: none !important;
    }

    #btfw-poll-video-overlay.btfw-poll-active {
      display: block;
    }

    .btfw-poll-video-content {
      position: absolute;
      top: 30px;
      left: 20px;
      right: 20px;
      pointer-events: auto;
      background: var(--btfw-overlay-bg);
      backdrop-filter: saturate(130%) blur(2px);
      border: 1px solid var(--btfw-overlay-border);
      border-radius: calc(var(--btfw-radius) + 6px);
      padding: 20px;
      box-shadow: var(--btfw-overlay-shadow);
      color: var(--btfw-color-text);
      max-width: 800px;
      margin: 0 auto;
    }

    .btfw-poll-video-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .btfw-poll-video-title {
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--btfw-color-text);
      margin: 0;
      flex: 1;
    }

    .btfw-poll-video-close {
      background: none;
      border: none;
      font-size: 1.2rem;
      color: var(--btfw-color-text);
      cursor: pointer;
      padding: 4px;
      opacity: 0.7;
      margin-left: 12px;
    }

    .btfw-poll-video-close:hover {
      opacity: 1;
    }

    .btfw-poll-options-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .btfw-poll-option-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btfw-poll-option-btn {
      background: color-mix(in srgb, var(--btfw-color-panel) 86%, transparent 14%);
      border: 2px solid var(--btfw-border);
      border-radius: 6px;
      padding: 6px 12px;
      color: var(--btfw-color-text);
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
      min-width: 60px;
      text-align: center;
      font-size: 0.9rem;
    }

    .btfw-poll-option-btn:hover {
      background: color-mix(in srgb, var(--btfw-color-accent) 20%, transparent 80%);
      border-color: var(--btfw-color-accent);
    }

    .btfw-poll-option-btn.active {
      background: color-mix(in srgb, var(--btfw-color-accent) 32%, transparent 68%);
      border-color: var(--btfw-color-accent);
      color: var(--btfw-color-on-accent);
    }

    .btfw-poll-option-text {
      flex: 1;
      color: var(--btfw-color-text);
      font-weight: 500;
    }

    .btfw-poll-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid color-mix(in srgb, var(--btfw-border) 60%, transparent 40%);
    }

    .btfw-poll-info {
      font-size: 0.85rem;
      color: color-mix(in srgb, var(--btfw-color-text) 70%, transparent 30%);
    }

    .btfw-poll-end-btn {
      background: var(--btfw-color-error, #e74c3c);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .btfw-poll-end-btn:hover {
      opacity: 0.9;
    }

    @media (max-width: 768px) {
      .btfw-poll-video-content {
        left: 12px;
        right: 12px;
        top: 20px;
        padding: 16px;
      }
    }
  `;

  let videoOverlay = null;
  let currentPoll = null;
  let socketEventsWired = false;
  let userVotes = new Set(); // Track which options user voted for
  let pollDomObserver = null;
  let observedPollElement = null;


  const ENTITY_DECODER = document.createElement("textarea");

  function decodeHtmlEntities(value) {
    if (typeof value !== "string") {
      if (value == null) return "";
      return String(value);
    }
    if (value.length === 0) {
      return "";
    }
    ENTITY_DECODER.innerHTML = value;
    return ENTITY_DECODER.value;
  }

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement("style");
    style.id = CSS_ID;
    style.textContent = POLL_OVERLAY_CSS;
    document.head.appendChild(style);
  }

  function createVideoOverlay() {
    if (videoOverlay) return videoOverlay;

    const videowrap = document.getElementById("videowrap");
    if (!videowrap) return null;

    const overlay = document.createElement("div");
    overlay.id = "btfw-poll-video-overlay";
    overlay.innerHTML = `
      <div class="btfw-poll-video-content">
        <div class="btfw-poll-video-header">
          <h3 class="btfw-poll-video-title">Poll Title</h3>
          <button class="btfw-poll-video-close" type="button">&times;</button>
        </div>
        <div class="btfw-poll-options-grid">
          <!-- Options populated by JS -->
        </div>
        <div class="btfw-poll-footer">
          <div class="btfw-poll-info">
            <span class="btfw-poll-votes">0 votes</span>
          </div>
          <button class="btfw-poll-end-btn" style="display: none;">End Poll</button>
        </div>
      </div>
    `;

    videowrap.appendChild(overlay);
    videoOverlay = overlay;

    // Wire up close button
    const closeBtn = overlay.querySelector(".btfw-poll-video-close");
    closeBtn.addEventListener("click", hideVideoOverlay);

    // Wire up end poll button
    const endBtn = overlay.querySelector(".btfw-poll-end-btn");
    endBtn.addEventListener("click", () => {
      if (window.socket && window.socket.emit) {
        try {
          window.socket.emit("closePoll");
        } catch (e) {
          console.error("Failed to end poll:", e);
        }
      }
    });

    return overlay;
  }

  function canEndPoll() {
    // Show end poll button if user has sufficient rank (usually rank 2+ can end polls)
    return window.CLIENT && window.CLIENT.rank >= 2;
  }

  function getOriginalPollButtons() {
    return document.querySelectorAll("#pollwrap .well .option button");
  }

  function stopPollDomObserver() {
    if (pollDomObserver) {
      pollDomObserver.disconnect();
      pollDomObserver = null;
      observedPollElement = null;
    }
  }

  function startPollDomObserver() {
    stopPollDomObserver();

    if (!videoOverlay || !videoOverlay.classList.contains("btfw-poll-active")) {
      return;
    }

    const pollWell = document.querySelector("#pollwrap .well.active");
    if (!pollWell) {
      setTimeout(() => {
        if (!pollDomObserver) {
          startPollDomObserver();
        }
      }, 150);
      return;
    }

    observedPollElement = pollWell;
    pollDomObserver = new MutationObserver(() => {
      if (observedPollElement && !document.contains(observedPollElement)) {
        stopPollDomObserver();
        setTimeout(() => {
          if (!pollDomObserver) {
            startPollDomObserver();
          }
        }, 120);
        return;
      }

      syncOverlayFromDom();
    });

    pollDomObserver.observe(pollWell, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });

    // Sync immediately in case the poll was updated before we attached
    syncOverlayFromDom();
  }

  function syncOverlayFromDom() {
    if (!videoOverlay) return;

    const overlayButtons = videoOverlay.querySelectorAll(".btfw-poll-option-btn");
    const originalButtons = getOriginalPollButtons();
    if (!overlayButtons.length || overlayButtons.length !== originalButtons.length) {
      return;
    }

    const newVotes = [];

    overlayButtons.forEach((button, index) => {
      const originalButton = originalButtons[index];
      const voteCount = parseInt(originalButton?.textContent) || 0;
      button.textContent = voteCount.toString();

      if (originalButton?.classList.contains("active")) {
        button.classList.add("active");
        userVotes.add(index);
      } else {
        button.classList.remove("active");
        userVotes.delete(index);
      }

      newVotes.push(voteCount);
    });

    if (newVotes.length) {
      const votesSpan = videoOverlay.querySelector(".btfw-poll-votes");
      if (votesSpan) {
        const totalVotes = newVotes.reduce((sum, count) => sum + count, 0);
        votesSpan.textContent = `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`;
      }

      if (currentPoll) {
        currentPoll.votes = newVotes;
      }
    }
  }

  function attemptVote(optionIndex, attempt = 0) {
    const originalButtons = getOriginalPollButtons();
    if (originalButtons && originalButtons[optionIndex]) {
      originalButtons[optionIndex].click();

      setTimeout(() => {
        syncOverlayFromDom();
      }, 120);
      return;
    }

    if (attempt >= 4) {
      emitVoteFallback(optionIndex);
      return;
    }

    setTimeout(() => {
      attemptVote(optionIndex, attempt + 1);
    }, 100);
  }

  function emitVoteFallback(optionIndex) {
    if (!window.socket || typeof window.socket.emit !== "function") {
      return false;
    }

    const pollId = currentPoll && (currentPoll.id ?? currentPoll.pollId ?? currentPoll.pollID ?? currentPoll.poll_id);
    const attempts = [];

    const basePayloads = [optionIndex, { option: optionIndex }];
    if (pollId != null) {
      basePayloads.push({ poll: pollId, option: optionIndex });
      basePayloads.push({ id: pollId, option: optionIndex });
    }

    const events = ["vote", "votePoll"];

    events.forEach((event) => {
      basePayloads.forEach((payload) => {
        attempts.push({ event, payload });
      });
    });

    attempts.forEach(({ event, payload }, index) => {
      setTimeout(() => {
        try {
          window.socket.emit(event, payload);
        } catch (err) {
          if (index === attempts.length - 1) {
            console.warn("[poll-overlay] Failed to emit vote via socket", err);
          }
        }
      }, index * 25);
    });

    setTimeout(() => {
      syncOverlayFromDom();
    }, attempts.length * 25 + 150);

    return attempts.length > 0;
  }

  function showVideoOverlay(poll) {
    const overlay = createVideoOverlay();
    if (!overlay || !poll) return;

    currentPoll = poll;
    userVotes.clear(); // Reset user votes for new poll
    
    // Update overlay content
    const title = overlay.querySelector(".btfw-poll-video-title");
    const optionsGrid = overlay.querySelector(".btfw-poll-options-grid");
    const votesSpan = overlay.querySelector(".btfw-poll-votes");
    const endBtn = overlay.querySelector(".btfw-poll-end-btn");

    if (title) title.textContent = decodeHtmlEntities(poll.title || "Poll");
    
    // Show/hide end poll button based on permissions
    if (endBtn) {
      endBtn.style.display = canEndPoll() ? "block" : "none";
    }
    
    if (optionsGrid && poll.options) {
      optionsGrid.innerHTML = "";
      poll.options.forEach((option, index) => {
        const optionRow = document.createElement("div");
        optionRow.className = "btfw-poll-option-row";
        
        const btn = document.createElement("button");
        btn.className = "btfw-poll-option-btn";
        btn.dataset.optionIndex = index;
        
        const optionText = document.createElement("span");
        optionText.className = "btfw-poll-option-text";
        optionText.textContent = decodeHtmlEntities(option);
        
        // Set initial vote count
        const voteCount = poll.votes && poll.votes[index] ? poll.votes[index] : 0;
        btn.textContent = voteCount.toString();
        
        btn.addEventListener("click", () => {
          try {
            attemptVote(index);
          } catch (e) {
            console.error("Failed to trigger poll vote:", e);
          }

          // Track user vote for visual feedback
          if (poll.multi) {
            // Multi-choice: toggle selection
            if (userVotes.has(index)) {
              userVotes.delete(index);
              btn.classList.remove("active");
            } else {
              userVotes.add(index);
              btn.classList.add("active");
            }
          } else {
            // Single choice: clear others and select this one
            userVotes.clear();
            optionsGrid.querySelectorAll(".btfw-poll-option-btn").forEach(b => {
              b.classList.remove("active");
            });
            userVotes.add(index);
            btn.classList.add("active");
          }
        });
        
        optionRow.appendChild(btn);
        optionRow.appendChild(optionText);
        optionsGrid.appendChild(optionRow);
      });
    }

    // Update vote count
    updateVoteDisplay(poll);

    overlay.classList.add("btfw-poll-active");

    // Ensure overlay stays in sync with the native poll controls once they mount
    setTimeout(() => {
      syncOverlayFromDom();
      startPollDomObserver();

    }, 200);
  }

  function hideVideoOverlay() {
    if (videoOverlay) {
      videoOverlay.classList.remove("btfw-poll-active");
      currentPoll = null;
      userVotes.clear();
      stopPollDomObserver();

    }
  }

  function updateVoteDisplay(poll) {
    if (!videoOverlay || !poll) return;

    if (currentPoll) {
      currentPoll = {
        ...currentPoll,
        ...poll,
        votes: Array.isArray(poll.votes) ? poll.votes : currentPoll.votes
      };
    }
    
    const votesSpan = videoOverlay.querySelector(".btfw-poll-votes");
    const optionsGrid = videoOverlay.querySelector(".btfw-poll-options-grid");
    
    // Update vote counts on buttons to match original poll
    if (optionsGrid && poll.votes) {
      const buttons = optionsGrid.querySelectorAll(".btfw-poll-option-btn");
      const originalPollButtons = getOriginalPollButtons();
      let mirroredActiveState = false;

      buttons.forEach((btn, index) => {
        const voteCount = poll.votes[index] || 0;
        btn.textContent = voteCount.toString();
        btn.classList.remove("active");
      });

      if (originalPollButtons.length === buttons.length) {
        buttons.forEach((btn, index) => {
          const originalBtn = originalPollButtons[index];
          if (originalBtn && originalBtn.classList.contains("active")) {
            btn.classList.add("active");
            userVotes.add(index);
            mirroredActiveState = true;
          } else {
            userVotes.delete(index);
          }
        });
      }

      if (!mirroredActiveState && userVotes.size) {
        userVotes.forEach((voteIndex) => {
          const btn = buttons[voteIndex];
          if (btn) {
            btn.classList.add("active");
          }
        });
      }
    }
    
    // Update total vote count
    if (votesSpan && poll.votes) {
      const totalVotes = poll.votes.reduce((sum, count) => sum + (count || 0), 0);
      votesSpan.textContent = `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`;
    }

    if (!pollDomObserver && videoOverlay && videoOverlay.classList.contains("btfw-poll-active")) {
      startPollDomObserver();
    }
  }

  function checkForExistingPoll() {
    // Check if there's already an active poll when the module loads
    const existingPoll = document.querySelector('#pollwrap .well.active');
    if (existingPoll) {
      console.log("Found existing active poll, extracting data...");
      
      // Extract poll data from the existing DOM
      const titleElement = existingPoll.querySelector('h3');
      const optionElements = existingPoll.querySelectorAll('.option');
      
      if (titleElement && optionElements.length > 0) {
        const pollData = {
          title: titleElement.textContent.trim(),
          options: [],
          votes: [],
          multi: false // Default, will be updated if we can detect it
        };
        
        optionElements.forEach((option, index) => {
          const button = option.querySelector('button');
          const optionText = option.textContent.replace(button ? button.textContent : '', '').trim();
          const voteCount = button ? parseInt(button.textContent) || 0 : 0;
          
          pollData.options.push(optionText);
          pollData.votes.push(voteCount);
        });
        
        console.log("Extracted poll data:", pollData);
        showVideoOverlay(pollData);
        return true;
      }
    }
    return false;
  }

  function wireSocketEvents() {
    if (socketEventsWired || !window.socket) return;

    try {
      // Listen for new polls
      window.socket.on("newPoll", (poll) => {
        if (poll && poll.title) {
          showVideoOverlay(poll);
        }
      });

      // Listen for poll updates (vote counts)
      window.socket.on("updatePoll", (poll) => {
        if (poll && currentPoll) {
          updateVoteDisplay(poll);
        }
      });

      // Listen for poll closure
      window.socket.on("closePoll", () => {
        hideVideoOverlay();
      });

      socketEventsWired = true;
    } catch (e) {
      console.warn("[poll-overlay] Socket event wiring failed:", e);
    }
  }

  function waitForSocket() {
    return new Promise((resolve) => {
      if (window.socket && window.socket.on) {
        resolve();
        return;
      }

      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max
      const checkSocket = () => {
        attempts++;
        if (window.socket && window.socket.on) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(checkSocket, 100);
        } else {
          console.warn("[poll-overlay] Socket not available after 5 seconds");
          resolve(); // Continue anyway
        }
      };

      setTimeout(checkSocket, 100);
    });
  }

  async function boot() {
    try {
      injectCSS();
      
      // Wait for socket to be available before wiring events
      await waitForSocket();
      wireSocketEvents();
      
      // Check for existing poll after a short delay to ensure DOM is ready
      setTimeout(() => {
        checkForExistingPoll();
      }, 500);
      
    } catch (e) {
      console.error("[poll-overlay] Boot failed:", e);
    }
  }

  // Boot when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    setTimeout(boot, 0); // Async to avoid blocking
  }

  // Also boot on layout ready event (with delay to ensure everything is settled)
  document.addEventListener("btfw:layoutReady", () => {
    setTimeout(boot, 200);
  });

  return {
    name: "feature:poll-overlay",
    showOverlay: showVideoOverlay,
    hideOverlay: hideVideoOverlay
  };
});
