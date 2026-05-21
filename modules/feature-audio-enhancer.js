/* BTFW – feature:audioEnhancer */
BTFW.define("feature:audioEnhancer", [], async () => {
  const INTERNAL_SET_GRACE_MS = 2000;
  const WATCHDOG_TICK_MS = 800;
  const REAPPLY_DEBOUNCE_MS = 800;

  function safeNow() {
    return Date.now();
  }

  function whenReady(callback) {
    if (document.readyState === "loading") {
      const handler = () => {
        document.removeEventListener("DOMContentLoaded", handler);
        callback();
      };
      document.addEventListener("DOMContentLoaded", handler);
    } else {
      callback();
    }
  }

  const sharedAudio = {
    audioContext: null,
    sourceNode: null,
    compressorNode: null,
    gainNode: null,
    player: null,

    originalSrc: null,
    proxiedSrc: null,
    isProxied: false,

    boostEnabled: false,
    normalizationEnabled: false,

    CORS_PROXY: "https://vidprox.billtube.workers.dev/?url=",
    BOOST_MULTIPLIER: 2.5,
    currentNormPreset: "youtube",

    _watchdogInterval: null,
    _mutationObserver: null,
    _lastKnownSrc: null,
    _lastInternalSrcSetAt: 0,
    _lastAutoReapplyAt: 0,

    NORM_PRESETS: {
      gentle:     { threshold: -12, knee: 20, ratio: 6,  attack: 0.01,  release: 0.5,  label: "Gentle" },
      youtube:    { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25, label: "YouTube" },
      aggressive: { threshold: -50, knee: 40, ratio: 12, attack: 0.001, release: 0.25, label: "Aggressive" }
    },

    _markInternalSrcSet() {
      this._lastInternalSrcSetAt = safeNow();
    },

    _isInsideInternalWindow() {
      return safeNow() - this._lastInternalSrcSetAt <= INTERNAL_SET_GRACE_MS;
    },

    _shouldForceProxy() {
      return this.boostEnabled || this.normalizationEnabled;
    },

    disconnectChain() {
      if (this.sourceNode) {
        try { this.sourceNode.disconnect(); }
        catch (_) {}
      }
      if (this.compressorNode) {
        try { this.compressorNode.disconnect(); }
        catch (_) {}
        this.compressorNode = null;
      }
      if (this.gainNode) {
        try { this.gainNode.disconnect(); }
        catch (_) {}
        this.gainNode = null;
      }
    },

    cleanup() {
      this.disconnectChain();

      if (this.audioContext && this.audioContext.state !== "closed") {
        this.audioContext.close().catch(() => {});
        this.audioContext = null;
      }

      this.sourceNode = null;

      if (this.player && this.player.tech_ && this.player.tech_.el_) {
        this.player.tech_.el_.disableRemotePlayback = false;
      }

      this.stopWatchdog();
    },

    startWatchdog() {
      if (!this.player) return;
      this.stopWatchdog();

      const videoEl = this.player.tech_?.el?.() || this.player.tech_?.el_ || document.querySelector("#ytapiplayer video");

      if (videoEl && typeof MutationObserver !== "undefined") {
        this._mutationObserver = new MutationObserver(() => {
          this._checkAndReapply("mutation");
        });
        this._mutationObserver.observe(videoEl, { attributes: true, attributeFilter: ["src", "crossorigin"] });

        const sourceObserver = new MutationObserver(() => {
          this._checkAndReapply("sources");
        });
        sourceObserver.observe(videoEl, { childList: true, subtree: true });
        this._mutationObserver._sourceObserver = sourceObserver;
      }

      try {
        this.player.on("sourceset", () => this._checkAndReapply("sourceset"));
        this.player.on("loadstart", () => this._checkAndReapply("loadstart"));
        this.player.on("loadedmetadata", () => this._checkAndReapply("loadedmetadata"));
        this.player.on("stalled", () => this._checkAndReapply("stalled"));
        this.player.on("error", () => this._checkAndReapply("error"));
      } catch (_) {}

      this._watchdogInterval = setInterval(() => this._checkAndReapply("interval"), WATCHDOG_TICK_MS);

      this._lastKnownSrc = this.player.currentSrc();
    },

    stopWatchdog() {
      if (this._watchdogInterval) {
        clearInterval(this._watchdogInterval);
        this._watchdogInterval = null;
      }
      if (this._mutationObserver) {
        try { this._mutationObserver.disconnect(); }
        catch (_) {}
        try { this._mutationObserver._sourceObserver?.disconnect(); }
        catch (_) {}
        this._mutationObserver = null;
      }
    },

    _checkAndReapply(reason) {
      if (!this.player) return;
      const current = this.player.currentSrc();
      if (!current) return;

      this._lastKnownSrc = current;

      if (this._isInsideInternalWindow()) return;

      const isAlreadyProxied = current.includes(this.CORS_PROXY);
      if (isAlreadyProxied) {
        this.isProxied = true;
        this.proxiedSrc = current;
        return;
      }

      if (!this._shouldForceProxy()) {
        this.isProxied = false;
        this.originalSrc = current;
        return;
      }

      const since = safeNow() - this._lastAutoReapplyAt;
      if (since < REAPPLY_DEBOUNCE_MS) return;
      this._lastAutoReapplyAt = safeNow();
      this._forceProxyPreservingState(current);
    },

    async _forceProxyPreservingState(currentSrc) {
      if (!this.player) return;
      const t = this.player.currentTime();
      const wasPlaying = !this.player.paused();

      this.originalSrc = currentSrc;
      this.proxiedSrc = this.CORS_PROXY + encodeURIComponent(currentSrc);

      try { this.player.pause(); }
      catch (_) {}
      try { this.player.crossOrigin("anonymous"); }
      catch (_) {}

      this._markInternalSrcSet();
      this.player.src({ src: this.proxiedSrc, type: "video/mp4" });
      try { this.player.load(); }
      catch (_) {}

      const resume = () => {
        try { this.player.currentTime(t); }
        catch (_) {}
        this.isProxied = true;
        if (wasPlaying) {
          this.player.play().catch(() => {});
        }
      };

      if (typeof this.player.ready === "function") {
        this.player.ready(resume);
      } else {
        setTimeout(resume, 300);
      }
    },

    async ensureProxy() {
      if (!this.player) return false;

      const currentSrc = this.player.currentSrc();
      if (!currentSrc) return false;

      if (currentSrc.includes(this.CORS_PROXY)) {
        this.isProxied = true;
        this.proxiedSrc = currentSrc;
        return true;
      }

      this.originalSrc = currentSrc;
      await this._forceProxyPreservingState(currentSrc);
      return true;
    },

    async rebuildAudioChain() {
      if (!this.player || !this.player.tech_ || !this.player.tech_.el_) {
        console.error("[audio-enhancer] Player not ready");
        return false;
      }

      if (this.boostEnabled || this.normalizationEnabled) {
        await this.ensureProxy();
      }

      this.disconnectChain();

      try {
        if (!this.audioContext || this.audioContext.state === "closed") {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const videoEl = this.player.tech().el();
        if (this.player.tech_ && this.player.tech_.el_) {
          this.player.tech_.el_.disableRemotePlayback = true;
        }

        if (!this.sourceNode) {
          this.sourceNode = this.audioContext.createMediaElementSource(videoEl);
        }

        let currentNode = this.sourceNode;

        if (this.normalizationEnabled) {
          this.compressorNode = this.audioContext.createDynamicsCompressor();
          const preset = this.NORM_PRESETS[this.currentNormPreset];
          this.compressorNode.threshold.setValueAtTime(preset.threshold, this.audioContext.currentTime);
          this.compressorNode.knee.setValueAtTime(preset.knee, this.audioContext.currentTime);
          this.compressorNode.ratio.setValueAtTime(preset.ratio, this.audioContext.currentTime);
          this.compressorNode.attack.setValueAtTime(preset.attack, this.audioContext.currentTime);
          this.compressorNode.release.setValueAtTime(preset.release, this.audioContext.currentTime);

          currentNode.connect(this.compressorNode);
          currentNode = this.compressorNode;
        }

        if (this.boostEnabled) {
          this.gainNode = this.audioContext.createGain();
          this.gainNode.gain.value = this.BOOST_MULTIPLIER;

          currentNode.connect(this.gainNode);
          currentNode = this.gainNode;
        }

        currentNode.connect(this.audioContext.destination);

        this.startWatchdog();

        console.log("[audio-enhancer] Chain rebuilt:", {
          normalization: this.normalizationEnabled,
          boost: this.boostEnabled,
          proxied: this.isProxied
        });

        return true;
      } catch (e) {
        console.error("[audio-enhancer] Error building audio chain:", e);
        this.cleanup();
        return false;
      }
    },

    async enableBoost() {
      this.boostEnabled = true;
      const ok = await this.rebuildAudioChain();
      if (ok && (this.boostEnabled || this.normalizationEnabled)) {
        this.startWatchdog();
      }
      return ok;
    },

    async disableBoost() {
      this.boostEnabled = false;

      if (this.normalizationEnabled) {
        const ok = await this.rebuildAudioChain();
        if (!this._shouldForceProxy()) this.stopWatchdog();
        return ok;
      }

      this.cleanup();

      if (this.originalSrc && this.isProxied) {
        const currentTime = this.player.currentTime();
        const wasPlaying = !this.player.paused();

        try { this.player.pause(); }
        catch (_) {}
        try { this.player.crossOrigin(null); }
        catch (_) {}

        this._markInternalSrcSet();
        this.player.src({ src: this.originalSrc, type: "video/mp4" });
        try { this.player.load(); }
        catch (_) {}

        this.player.ready(() => {
          try { this.player.currentTime(currentTime); }
          catch (_) {}
          this.isProxied = false;
          if (wasPlaying) {
            this.player.play().catch(() => {});
          }
        });
      }
      return true;
    },

    async enableNormalization() {
      this.normalizationEnabled = true;
      const ok = await this.rebuildAudioChain();
      if (ok && (this.boostEnabled || this.normalizationEnabled)) {
        this.startWatchdog();
      }
      return ok;
    },

    async setNormPreset(presetKey) {
      if (!this.NORM_PRESETS[presetKey]) return false;
      this.currentNormPreset = presetKey;
      if (this.normalizationEnabled) {
        return await this.rebuildAudioChain();
      }
      return true;
    },

    async setBoostMultiplier(multiplier) {
      this.BOOST_MULTIPLIER = multiplier;
      if (this.boostEnabled) {
        return await this.rebuildAudioChain();
      }
      return true;
    },

    async disableNormalization() {
      this.normalizationEnabled = false;

      if (this.boostEnabled) {
        const ok = await this.rebuildAudioChain();
        if (!this._shouldForceProxy()) this.stopWatchdog();
        return ok;
      }

      this.cleanup();

      if (this.originalSrc && this.isProxied) {
        const currentTime = this.player.currentTime();
        const wasPlaying = !this.player.paused();

        try { this.player.pause(); }
        catch (_) {}
        try { this.player.crossOrigin(null); }
        catch (_) {}

        this._markInternalSrcSet();
        this.player.src({ src: this.originalSrc, type: "video/mp4" });
        try { this.player.load(); }
        catch (_) {}

        this.player.ready(() => {
          try { this.player.currentTime(currentTime); }
          catch (_) {}
          this.isProxied = false;
          if (wasPlaying) {
            this.player.play().catch(() => {});
          }
        });
      }
      return true;
    }
  };

  const $ = (selector, root = document) => root.querySelector(selector);

  const BOOST_PRESETS = [
    { multiplier: 1.5, label: "150%" },
    { multiplier: 2.5, label: "250%" },
    { multiplier: 3.5, label: "350%" }
  ];

  const state = {
    enabled: false,
    booted: false,
    overlayInterval: null,
    boostButton: null,
    normButton: null,
    boostMenu: null,
    normMenu: null,
    shouldBoostAfterMediaChange: false,
    shouldNormalizeAfterMediaChange: false,
    socketBound: false
  };

  function computeIntegrationEnabled() {
    const checks = [
      () => window.BTFW_THEME_ADMIN?.integrations?.audioEnhancer?.enabled,
      () => window.BTFW_CONFIG?.integrations?.audioEnhancer?.enabled,
      () => window.BTFW_CONFIG?.audioEnhancer?.enabled,
      () => window.BTFW_CONFIG?.audioEnhancerEnabled,
      () => window.BTFW_CONFIG?.shouldLoadAudioEnhancer,
      () => document?.body?.dataset?.btfwAudioEnhancerEnabled
    ];
    for (const check of checks) {
      try {
        const value = typeof check === "function" ? check() : check;
        if (typeof value === "string") {
          const normalized = value.trim().toLowerCase();
          if (["1", "true", "yes", "on"].includes(normalized)) {
            return true;
          }
        } else if (value) {
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  function showToast(id, message, theme = "info") {
    if (!state.enabled) return;
    let toast = document.getElementById(id);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = id;
      toast.style.cssText = `
        position: fixed;
        top: ${id.includes("norm") ? "70px" : "20px"};
        right: 20px;
        background: rgba(20, 31, 54, 0.95);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      `;
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.background = theme === "success"
      ? (id.includes("boost") ? "rgba(46, 213, 115, 0.9)" : "rgba(52, 152, 219, 0.9)")
      : "rgba(235, 77, 75, 0.9)";
    toast.style.opacity = "1";
    setTimeout(() => {
      if (toast) toast.style.opacity = "0";
    }, 2000);
  }

  function updateButtonState(button, active, palette) {
    if (!button) return;
    const { bg, border, color } = palette;
    button.classList.toggle("active", active);
    button.style.background = active ? bg : "";
    button.style.borderColor = active ? border : "";
    button.style.color = active ? color : "";
    button.style.boxShadow = active ? `0 0 12px ${color}` : "";
  }

  async function activateAudioBoost() {
    if (!state.enabled) return;
    const success = await sharedAudio.enableBoost();
    if (success) {
      state.shouldBoostAfterMediaChange = true;
      const percentage = Math.round(sharedAudio.BOOST_MULTIPLIER * 100);
      showToast("btfw-audio-boost-toast", `Boosted by ${percentage}%`, "success");
      updateButtonState(state.boostButton, true, {
        bg: "rgba(46, 213, 115, 0.3)",
        border: "#2ed573",
        color: "#2ed573"
      });
    } else {
      showToast("btfw-audio-boost-toast", "Failed to activate boost", "error");
    }
  }

  async function deactivateAudioBoost() {
    state.shouldBoostAfterMediaChange = false;
    await sharedAudio.disableBoost();
    updateButtonState(state.boostButton, false, {
      bg: "",
      border: "",
      color: ""
    });
  }

  async function activateNormalization() {
    if (!state.enabled) return;
    const success = await sharedAudio.enableNormalization();
    if (success) {
      state.shouldNormalizeAfterMediaChange = true;
      showToast("btfw-audio-norm-toast", "Normalization enabled", "success");
      updateButtonState(state.normButton, true, {
        bg: "rgba(52, 152, 219, 0.3)",
        border: "#3498db",
        color: "#3498db"
      });
    } else {
      showToast("btfw-audio-norm-toast", "Failed to activate", "error");
    }
  }

  async function deactivateNormalization() {
    state.shouldNormalizeAfterMediaChange = false;
    await sharedAudio.disableNormalization();
    updateButtonState(state.normButton, false, {
      bg: "",
      border: "",
      color: ""
    });
  }

  function buildBoostButton() {
    const btn = document.createElement("button");
    btn.id = "btfw-vo-audioboost";
    btn.className = "btn btn-sm btn-default btfw-vo-adopted";
    const percentage = Math.round(sharedAudio.BOOST_MULTIPLIER * 100);
    btn.title = `Toggle Audio Boost (${percentage}%)`;
    btn.setAttribute("data-btfw-overlay", "1");
    btn.innerHTML = '<i class="fa-solid fa-megaphone"></i>';

    btn.addEventListener("click", () => {
      if (!state.enabled) return;
      if (sharedAudio.boostEnabled) {
        deactivateAudioBoost();
      } else {
        activateAudioBoost();
      }
    });

    btn.addEventListener("mouseenter", () => showBoostMenu());
    btn.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (!state.enabled) return;
        if (!state.boostMenu?.matches(":hover") && !btn.matches(":hover")) {
          hideBoostMenu();
        }
      }, 100);
    });

    return btn;
  }

  function buildNormButton() {
    const btn = document.createElement("button");
    btn.id = "btfw-vo-audionorm";
    btn.className = "btn btn-sm btn-default btfw-vo-adopted";
    const presetLabel = sharedAudio.NORM_PRESETS[sharedAudio.currentNormPreset].label;
    btn.title = `Toggle Audio Normalization (${presetLabel})`;
    btn.setAttribute("data-btfw-overlay", "1");
    btn.innerHTML = '<i class="fa-solid fa-waveform-lines"></i>';

    btn.addEventListener("click", () => {
      if (!state.enabled) return;
      if (sharedAudio.normalizationEnabled) {
        deactivateNormalization();
      } else {
        activateNormalization();
      }
    });

    btn.addEventListener("mouseenter", () => showNormMenu());
    btn.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (!state.enabled) return;
        if (!state.normMenu?.matches(":hover") && !btn.matches(":hover")) {
          hideNormMenu();
        }
      }, 100);
    });

    return btn;
  }

  function ensureBoostMenu() {
    if (state.boostMenu) return state.boostMenu;
    const menu = document.createElement("div");
    menu.id = "btfw-boost-context-menu";
    menu.style.cssText = `
      position: absolute;
      background: rgba(20, 31, 54, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(109, 77, 246, 0.3);
      border-radius: 8px;
      padding: 6px;
      display: none;
      z-index: 10000;
      min-width: 100px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    `;

    BOOST_PRESETS.forEach(preset => {
      const item = document.createElement("button");
      item.className = "btfw-context-item";
      item.textContent = preset.label;
      item.style.cssText = `
        display: block;
        width: 100%;
        padding: 6px 12px;
        background: transparent;
        border: none;
        color: #e0e0e0;
        text-align: left;
        cursor: pointer;
        border-radius: 4px;
        font-size: 13px;
        transition: all 0.2s ease;
      `;

      item.addEventListener("mouseenter", () => {
        if (sharedAudio.BOOST_MULTIPLIER !== preset.multiplier) {
          item.style.background = "rgba(109, 77, 246, 0.2)";
        }
      });

      item.addEventListener("mouseleave", () => {
        if (sharedAudio.BOOST_MULTIPLIER !== preset.multiplier) {
          item.style.background = "transparent";
        }
      });

      item.addEventListener("click", async () => {
        if (!state.enabled) return;
        await sharedAudio.setBoostMultiplier(preset.multiplier);
        updateBoostMenuSelection();
        if (state.boostButton) {
          const percentage = Math.round(preset.multiplier * 100);
          state.boostButton.title = `Toggle Audio Boost (${percentage}%)`;
        }
        if (sharedAudio.boostEnabled) {
          showToast("btfw-audio-boost-toast", `Boost set to ${preset.label}`, "success");
        }
      });

      menu.appendChild(item);
    });

    menu.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (!state.enabled) return;
        if (!state.boostButton?.matches(":hover")) {
          hideBoostMenu();
        }
      }, 100);
    });

    document.body.appendChild(menu);
    state.boostMenu = menu;
    updateBoostMenuSelection();
    return menu;
  }

  function ensureNormMenu() {
    if (state.normMenu) return state.normMenu;
    const menu = document.createElement("div");
    menu.id = "btfw-norm-context-menu";
    menu.style.cssText = `
      position: absolute;
      background: rgba(20, 31, 54, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(52, 152, 219, 0.3);
      border-radius: 8px;
      padding: 6px;
      display: none;
      z-index: 10000;
      min-width: 110px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    `;

    Object.keys(sharedAudio.NORM_PRESETS).forEach(key => {
      const preset = sharedAudio.NORM_PRESETS[key];
      const item = document.createElement("button");
      item.className = "btfw-context-item";
      item.textContent = preset.label;
      item.style.cssText = `
        display: block;
        width: 100%;
        padding: 6px 12px;
        background: transparent;
        border: none;
        color: #e0e0e0;
        text-align: left;
        cursor: pointer;
        border-radius: 4px;
        font-size: 13px;
        transition: all 0.2s ease;
      `;

      item.addEventListener("mouseenter", () => {
        if (sharedAudio.currentNormPreset !== key) {
          item.style.background = "rgba(109, 77, 246, 0.2)";
        }
      });

      item.addEventListener("mouseleave", () => {
        if (sharedAudio.currentNormPreset !== key) {
          item.style.background = "transparent";
        }
      });

      item.addEventListener("click", async () => {
        if (!state.enabled) return;
        await sharedAudio.setNormPreset(key);
        updateNormMenuSelection();
        if (state.normButton) {
          state.normButton.title = `Toggle Audio Normalization (${preset.label})`;
        }
        if (sharedAudio.normalizationEnabled) {
          showToast("btfw-audio-norm-toast", `Preset: ${preset.label}`, "success");
        }
      });

      menu.appendChild(item);
    });

    menu.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (!state.enabled) return;
        if (!state.normButton?.matches(":hover")) {
          hideNormMenu();
        }
      }, 100);
    });

    document.body.appendChild(menu);
    state.normMenu = menu;
    updateNormMenuSelection();
    return menu;
  }

  function showBoostMenu() {
    if (!state.enabled || !state.boostButton) return;
    const menu = ensureBoostMenu();
    const rect = state.boostButton.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.display = "block";
    updateBoostMenuSelection();
  }

  function hideBoostMenu() {
    if (state.boostMenu) {
      state.boostMenu.style.display = "none";
    }
  }

  function updateBoostMenuSelection() {
    if (!state.boostMenu) return;
    const items = state.boostMenu.querySelectorAll(".btfw-context-item");
    items.forEach((item, idx) => {
      const preset = BOOST_PRESETS[idx];
      if (!preset) return;
      if (sharedAudio.BOOST_MULTIPLIER === preset.multiplier) {
        item.style.background = "rgba(46, 213, 115, 0.2)";
        item.style.color = "#2ed573";
      } else {
        item.style.background = "transparent";
        item.style.color = "#e0e0e0";
      }
    });
  }

  function showNormMenu() {
    if (!state.enabled || !state.normButton) return;
    const menu = ensureNormMenu();
    const rect = state.normButton.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.display = "block";
    updateNormMenuSelection();
  }

  function hideNormMenu() {
    if (state.normMenu) {
      state.normMenu.style.display = "none";
    }
  }

  function updateNormMenuSelection() {
    if (!state.normMenu) return;
    const items = state.normMenu.querySelectorAll(".btfw-context-item");
    Object.keys(sharedAudio.NORM_PRESETS).forEach((key, idx) => {
      const item = items[idx];
      if (!item) return;
      if (sharedAudio.currentNormPreset === key) {
        item.style.background = "rgba(52, 152, 219, 0.2)";
        item.style.color = "#3498db";
      } else {
        item.style.background = "transparent";
        item.style.color = "#e0e0e0";
      }
    });
  }

  function addButtonsToOverlay() {
    if (!state.enabled) return false;
    const voLeft = document.querySelector("#btfw-vo-left");
    if (!voLeft) return false;

    if (state.boostButton) {
      state.boostButton.remove();
      state.boostButton = null;
    }
    if (state.normButton) {
      state.normButton.remove();
      state.normButton = null;
    }

    state.boostButton = buildBoostButton();
    state.normButton = buildNormButton();

    voLeft.appendChild(state.boostButton);
    voLeft.appendChild(state.normButton);
    return true;
  }

  function startOverlayWatcher() {
    stopOverlayWatcher();
    state.overlayInterval = setInterval(() => {
      if (!state.enabled) return;
      if (addButtonsToOverlay()) {
        stopOverlayWatcher();
      }
    }, 500);
  }

  function stopOverlayWatcher() {
    if (state.overlayInterval) {
      clearInterval(state.overlayInterval);
      state.overlayInterval = null;
    }
  }

  function initializePlayer() {
    if (!state.enabled) return;
    if (typeof window.videojs === "undefined") {
      setTimeout(initializePlayer, 500);
      return;
    }

    const playerElement = document.querySelector("#ytapiplayer");
    if (!playerElement) {
      setTimeout(initializePlayer, 500);
      return;
    }

    try {
      sharedAudio.player = window.videojs("ytapiplayer");
      sharedAudio.originalSrc = sharedAudio.player.currentSrc();
      sharedAudio.startWatchdog();
    } catch (err) {
      console.warn("[audio-enhancer] Failed to initialize player", err);
    }
  }

  function handleMediaChange() {
    if (!state.enabled) return;
    setTimeout(() => {
      if (!state.enabled) return;
      sharedAudio.cleanup();
      sharedAudio.isProxied = false;
      updateButtonState(state.boostButton, false, { bg: "", border: "", color: "" });
      updateButtonState(state.normButton, false, { bg: "", border: "", color: "" });
      initializePlayer();

      if (state.shouldBoostAfterMediaChange) {
        setTimeout(() => { if (state.enabled) activateAudioBoost(); }, 1200);
      }
      if (state.shouldNormalizeAfterMediaChange) {
        setTimeout(() => { if (state.enabled) activateNormalization(); }, 1200);
      }
    }, 600);
  }

  function hookSocketEvents() {
    if (state.socketBound) return;
    const socket = window.socket;
    if (!socket || typeof socket.on !== "function") return;

    const changeHandler = () => handleMediaChange();
    const reconnectHandler = () => {
      if (!state.enabled) return;
      setTimeout(() => sharedAudio._checkAndReapply("socket-reconnect"), 500);
    };
    const connectHandler = () => {
      if (!state.enabled) return;
      setTimeout(() => sharedAudio._checkAndReapply("socket-connect"), 500);
    };

    try {
      socket.on("changeMedia", changeHandler);
      socket.on("reconnect", reconnectHandler);
      socket.on("connect", connectHandler);
    } catch (err) {
      console.warn("[audio-enhancer] Failed to bind socket handlers", err);
    }

    state.socketBound = true;
  }

  function boot() {
    if (!state.enabled) return;
    addButtonsToOverlay();
    startOverlayWatcher();
    initializePlayer();
    hookSocketEvents();
    state.booted = true;
  }

  function teardown() {
    stopOverlayWatcher();

    if (state.boostMenu) {
      state.boostMenu.remove();
      state.boostMenu = null;
    }
    if (state.normMenu) {
      state.normMenu.remove();
      state.normMenu = null;
    }

    if (state.boostButton) {
      state.boostButton.remove();
      state.boostButton = null;
    }
    if (state.normButton) {
      state.normButton.remove();
      state.normButton = null;
    }

    state.shouldBoostAfterMediaChange = false;
    state.shouldNormalizeAfterMediaChange = false;

    const finalize = () => {
      if (sharedAudio.player) {
        try { sharedAudio.player.crossOrigin(null); }
        catch (_) {}
      }
      sharedAudio.player = null;
      sharedAudio.originalSrc = null;
      sharedAudio.proxiedSrc = null;
      sharedAudio.isProxied = false;
      state.booted = false;
    };

    const tasks = [];
    if (sharedAudio.boostEnabled) {
      try { tasks.push(sharedAudio.disableBoost()); }
      catch (_) {}
    }
    if (sharedAudio.normalizationEnabled) {
      try { tasks.push(sharedAudio.disableNormalization()); }
      catch (_) {}
    }

    if (tasks.length) {
      Promise.allSettled(tasks).finally(() => {
        sharedAudio.cleanup();
        finalize();
      });
    } else {
      sharedAudio.cleanup();
      finalize();
    }
  }

  function evaluate() {
    const enabled = computeIntegrationEnabled();
    if (enabled && !state.enabled) {
      state.enabled = true;
      whenReady(boot);
    } else if (!enabled && state.enabled) {
      state.enabled = false;
      teardown();
    } else if (enabled && state.enabled && !state.booted) {
      whenReady(boot);
    }
  }

  document.addEventListener("btfw:channelIntegrationsChanged", () => evaluate());

  whenReady(() => evaluate());

  return {
    name: "feature:audioEnhancer",
    enable: () => { state.enabled = true; whenReady(boot); },
    disable: () => { state.enabled = false; teardown(); },
    sharedAudio
  };
});

