/* BTFW — feature:notification-sounds (theme modal tab with audio cues) */
BTFW.define("feature:notification-sounds", [], async () => {
  const $ = (s, r=document) => r.querySelector(s);

  const STORAGE_KEY = "btfw:notify:sounds:v1";

  const SOUND_PRESETS = [
    {
      id: "soft-chime",
      name: "Soft chime",
      duration: 0.8,
      steps: [
        { type: "sine", frequency: 660, duration: 0.28, attack: 0.012, release: 0.16, level: 0.9 },
        { type: "triangle", frequency: 880, duration: 0.26, delay: 0.05, attack: 0.01, release: 0.14, level: 0.75 }
      ]
    },
    {
      id: "bright-ping",
      name: "Bright ping",
      duration: 0.7,
      steps: [
        { type: "square", frequency: 1250, frequencyEnd: 1320, duration: 0.2, attack: 0.006, release: 0.12, level: 0.85 },
        { type: "sine", frequency: 980, frequencyEnd: 880, delay: 0.18, duration: 0.22, attack: 0.01, release: 0.16, level: 0.6 }
      ]
    },
    {
      id: "digital-pop",
      name: "Digital pop",
      duration: 0.65,
      steps: [
        { type: "square", frequency: 420, frequencyEnd: 260, duration: 0.22, attack: 0.008, release: 0.16, level: 0.9 },
        { type: "sawtooth", frequency: 640, frequencyEnd: 520, delay: 0.16, duration: 0.18, attack: 0.012, release: 0.12, level: 0.7 }
      ]
    },
    {
      id: "harmony-rise",
      name: "Harmony rise",
      duration: 1.0,
      steps: [
        { type: "sine", frequency: 540, frequencyEnd: 620, duration: 0.32, attack: 0.014, release: 0.18, level: 0.85 },
        { type: "sine", frequency: 720, frequencyEnd: 680, delay: 0.18, duration: 0.34, attack: 0.012, release: 0.2, level: 0.75 },
        { type: "triangle", frequency: 430, frequencyEnd: 360, delay: 0.32, duration: 0.42, attack: 0.018, release: 0.24, level: 0.65 }
      ]
    },
    {
      id: "airy-bell",
      name: "Airy bell",
      duration: 0.9,
      steps: [
        { type: "sine", frequency: 780, duration: 0.28, attack: 0.012, release: 0.2, level: 0.75 },
        { type: "triangle", frequency: 520, frequencyEnd: 470, delay: 0.22, duration: 0.34, attack: 0.018, release: 0.22, level: 0.7 },
        { type: "sine", frequency: 1040, delay: 0.1, duration: 0.2, attack: 0.008, release: 0.14, level: 0.6 }
      ]
    }
  ];

  const GITHUB_SOUNDS_BASE = "https://raw.githubusercontent.com/BillTube/BillTube2/master/sounds/";
const MP3_SOUND_PRESETS = [
  {
    id: "boop",
    name: "boop",
    url: GITHUB_SOUNDS_BASE + "146717_2437358-lq.mp3",
    duration: 1.0
  },
  {
    id: "blip",
    name: "blip",
    url: GITHUB_SOUNDS_BASE + "146718_2437358-lq.mp3",
    duration: 1.0
  },
  {
    id: "dingding",
    name: "dingding",
    url: GITHUB_SOUNDS_BASE + "264447_4322723-lq.mp3",
    duration: 2.0
  },
  {
    id: "nyan",
    name: "nyan",
    url: GITHUB_SOUNDS_BASE + "336012_5953264-lq.mp3",
    duration: 2.0
  },
  {
    id: "knocks",
    name: "knocks",
    url: GITHUB_SOUNDS_BASE + "383757_7146007-lq.mp3",
    duration: 5.0
  },
  {
    id: "scary",
    name: "scary",
    url: GITHUB_SOUNDS_BASE + "419673_1904290-lq.mp3",
    duration: 1.0
  },
  {
    id: "ping",
    name: "Sound 7",
    url: GITHUB_SOUNDS_BASE + "506052_10991815-lq.mp3",
    duration: 1.0
  }
];
  SOUND_PRESETS.push(...MP3_SOUND_PRESETS);

  const SOUND_LOOKUP = new Map(SOUND_PRESETS.map(p => [p.id, p]));

  const EVENT_CONFIG = [
    {
      key: "join",
      title: "Someone joins",
      description: "Play a sound when a new viewer enters the channel.",
      muteLabel: "Mute join sound"
    },
    {
      key: "mention",
      title: "You are mentioned",
      description: "Alert me when my username appears in chat.",
      muteLabel: "Mute mention sound"
    },
    {
      key: "poll",
      title: "Poll starts",
      description: "Play an audible cue whenever a new poll opens.",
      muteLabel: "Mute poll sound"
    },
    {
      key: "video",
      title: "New video",
      description: "Notify me when playback switches to a new video.",
      muteLabel: "Mute video sound"
    }
  ];

  const DEFAULTS = {
    join:    { muted: true,  volume: 0.6,  sound: "soft-chime" },
    mention: { muted: false,  volume: 0.75, sound: "bright-ping" },
    poll:    { muted: false, volume: 0.85, sound: "knocks" },
    video:   { muted: true,  volume: 0.65, sound: "airy-bell" }
  };

  const scratch = document.createElement("div");
  const dedupe = new Map();

  const ui = new Map();
  let liveSettings = loadSettings();
  let draftSettings = cloneSettings(liveSettings);

  let audioCtx = null;
  const audioBufferCache = new Map();

  function getAudioCtor(){
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function ensureAudioContext(){
    if (audioCtx) return audioCtx;
    const Ctor = getAudioCtor();
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch (_) {
      audioCtx = null;
    }
    return audioCtx;
  }

  function resumeAudio(){
    const ctx = ensureAudioContext();
    if (!ctx) return null;
    if (ctx.state === "suspended") {
      ctx.resume().catch(()=>{});
    }
    return ctx;
  }

  function clamp01(value){
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(Math.max(n, 0), 1);
  }

  function sanitizeSetting(key, value){
    const base = DEFAULTS[key];
    const obj = value && typeof value === "object" ? value : {};
    const soundId = SOUND_LOOKUP.has(obj.sound) ? obj.sound : base.sound;
    const volume = clamp01(obj.volume != null ? obj.volume : base.volume);
    const muted = obj.muted != null ? !!obj.muted : !!base.muted;
    return { muted, volume, sound: soundId };
  }

  function cloneSettings(source){
    const result = {};
    EVENT_CONFIG.forEach(cfg => {
      const current = source && source[cfg.key];
      result[cfg.key] = sanitizeSetting(cfg.key, current);
    });
    return result;
  }

  function loadSettings(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneSettings(DEFAULTS);
      const parsed = JSON.parse(raw);
      return cloneSettings(parsed);
    } catch (_) {
      return cloneSettings(DEFAULTS);
    }
  }

  function persist(settings){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  function scheduleOscStep(ctx, destination, baseTime, step, volume){
    const delay = Math.max(0, Number(step.delay) || 0);
    const start = baseTime + delay;
    const duration = Math.max(0.08, Number(step.duration) || 0.2);
    const attack = Math.max(0.004, Math.min(step.attack != null ? step.attack : 0.01, duration * 0.6));
    const release = Math.max(0.04, Math.min(step.release != null ? step.release : 0.12, duration));
    const sustain = Math.max(0, duration - attack - release);
    const peak = clamp01(volume) * clamp01(step.level != null ? step.level : 1);

    const osc = ctx.createOscillator();
    osc.type = step.type || "sine";
    const freq = Number(step.frequency) || 440;
    osc.frequency.setValueAtTime(freq, start);
    if (typeof step.frequencyEnd === "number" && step.frequencyEnd !== freq) {
      osc.frequency.linearRampToValueAtTime(step.frequencyEnd, start + duration);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    if (sustain > 0) {
      gain.gain.setValueAtTime(peak, start + attack + sustain);
    }
    gain.gain.linearRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(destination);

    const stopAt = start + duration + (step.tail != null ? step.tail : 0.08);
    osc.start(start);
    osc.stop(stopAt);

    const cleanupDelay = Math.max(0, (stopAt - ctx.currentTime + 0.25) * 1000);
    setTimeout(() => {
      try { gain.disconnect(); } catch (_) {}
      try { osc.disconnect(); } catch (_) {}
    }, cleanupDelay);

    return stopAt;
  }

  async function loadAudioBuffer(url){
    if (audioBufferCache.has(url)) return audioBufferCache.get(url);
    const ctx = ensureAudioContext();
    if (!ctx) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioBufferCache.set(url, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.error(`Failed to load sound from ${url}:`, error);
      return null;
    }
  }

  function playAudioBuffer(buffer, volume){
    const ctx = resumeAudio();
    if (!ctx || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gainNode = ctx.createGain();
    gainNode.gain.value = clamp01(volume);
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);
    setTimeout(() => { try { gainNode.disconnect(); } catch (_) {} }, (buffer.duration + 0.1) * 1000);
  }

  async function playPresetById(id, volume){
    const preset = SOUND_LOOKUP.get(id) || SOUND_PRESETS[0];
    if (!preset) return;

    if (preset.url) {
      const buffer = await loadAudioBuffer(preset.url);
      if (buffer) playAudioBuffer(buffer, volume);
      return;
    }

    const ctx = resumeAudio();
    if (!ctx) return;

    const master = ctx.createGain();
    master.gain.value = clamp01(volume);
    master.connect(ctx.destination);

    const base = ctx.currentTime + 0.02;
    let maxStop = base;
    preset.steps.forEach(step => {
      maxStop = Math.max(maxStop, scheduleOscStep(ctx, master, base, step, master.gain.value));
    });

    const cleanupDelay = Math.max(0, (maxStop - ctx.currentTime + 0.35) * 1000);
    setTimeout(() => {
      try { master.disconnect(); } catch (_) {}
    }, cleanupDelay);
  }

  function throttle(key, ttlMs){
    const now = Date.now();
    const expires = dedupe.get(key) || 0;
    if (expires > now) return true;
    dedupe.set(key, now + (ttlMs || 1000));
    return false;
  }

  function plainText(html){
    if (!html) return "";
    scratch.innerHTML = String(html);
    const text = scratch.textContent || scratch.innerText || "";
    scratch.textContent = "";
    return text;
  }

  function getOwnName(){
    try {
      if (window.CLIENT && typeof CLIENT.name === "string") return CLIENT.name;
    } catch (_) {}
    return "";
  }

  function containsMention(text, name){
    if (!text || !name) return false;
    const lowerText = text.toLowerCase();
    const lowerName = name.toLowerCase();
    if (!lowerText.includes(lowerName)) return false;
    let idx = lowerText.indexOf(lowerName);
    while (idx !== -1) {
      const before = idx === 0 ? " " : lowerText[idx - 1];
      const afterIndex = idx + lowerName.length;
      const after = afterIndex >= lowerText.length ? " " : lowerText[afterIndex];
      const beforeOk = !/[a-z0-9_]/i.test(before);
      const afterOk = !/[a-z0-9_]/i.test(after);
      if (beforeOk && afterOk) return true;
      idx = lowerText.indexOf(lowerName, idx + lowerName.length);
    }
    return false;
  }

  function shouldPlay(key){
    const cfg = liveSettings[key];
    if (!cfg) return false;
    if (cfg.muted) return false;
    if (!(cfg.volume > 0)) return false;
    if (!SOUND_LOOKUP.has(cfg.sound)) return false;
    return true;
  }

  function triggerSound(key){
    if (!shouldPlay(key)) return;
    const cfg = liveSettings[key];
    playPresetById(cfg.sound, cfg.volume);
  }

  function handleUserJoin(payload){
    if (!payload) return;
    const name = (payload.name || payload.un || "").trim();
    if (!name) return;
    if (name === getOwnName()) return;
    if (throttle("join:" + name.toLowerCase(), 60000)) return;
    triggerSound("join");
  }

  function handleChatMessage(payload){
    if (!shouldPlay("mention")) return;
    const name = getOwnName();
    if (!name) return;
    if (payload && (payload.username === name || payload.name === name)) return;
    const text = plainText(payload && payload.msg);
    if (!containsMention(text, name)) return;
    if (throttle("mention:" + text.slice(0, 40), 1200)) return;
    triggerSound("mention");
  }

  function pollKey(poll){
    if (!poll || typeof poll !== "object") return "poll:?";
    const id = poll.id ?? poll.pollId ?? poll.pollID ?? poll.poll_id ?? poll.uid;
    if (id != null) return "poll:" + String(id);
    if (poll.title) return "poll:" + String(poll.title);
    return "poll:?";
  }

  function handlePoll(poll){
    const key = pollKey(poll);
    if (throttle(key, 2500)) return;
    triggerSound("poll");
  }

  function mediaKey(media){
    if (!media || typeof media !== "object") return "media:?";
    const candidate = media.id ?? media.uid ?? media.guid ?? media.media?.id ?? media.media?.uid ?? media.media?.vid;
    if (candidate != null) return "media:" + String(candidate);
    if (media.media && media.media.title) return "media:" + String(media.media.title);
    if (media.title) return "media:" + String(media.title);
    return "media:?";
  }

  function handleMediaChange(media){
    if (!shouldPlay("video")) return;
    const key = mediaKey(media);
    if (throttle(key, 2000)) return;
    triggerSound("video");
  }

  const socketState = {
    wired: false,
    socketRef: null,
    teardown: null,
    retryTimer: null
  };

  function detachSocket(){
    if (typeof socketState.teardown === "function") {
      try { socketState.teardown(); } catch (_) {}
    }
    socketState.teardown = null;
    socketState.wired = false;
    socketState.socketRef = null;
  }

  function wireSocketWatchers(){
    const sock = window.socket;
    if (socketState.socketRef && socketState.socketRef !== sock) {
      detachSocket();
    }
    if (socketState.wired) return;
    if (!sock || typeof sock.on !== "function") {
      if (!socketState.retryTimer) {
        socketState.retryTimer = setTimeout(() => {
          socketState.retryTimer = null;
          wireSocketWatchers();
        }, 1000);
      }
      return;
    }

    const handlers = new Map([
      ["addUser", handleUserJoin],
      ["chatMsg", handleChatMessage],
      ["newPoll", handlePoll],
      ["changeMedia", handleMediaChange]
    ]);

    try {
      handlers.forEach((handler, event) => {
        sock.on(event, handler);
      });
    } catch (_) {
      if (!socketState.retryTimer) {
        socketState.retryTimer = setTimeout(() => {
          socketState.retryTimer = null;
          wireSocketWatchers();
        }, 1000);
      }
      return;
    }

    if (socketState.retryTimer) {
      clearTimeout(socketState.retryTimer);
      socketState.retryTimer = null;
    }

    socketState.wired = true;
    socketState.socketRef = sock;

    socketState.teardown = () => {
      handlers.forEach((handler, event) => {
        if (typeof sock.off === "function") {
          try { sock.off(event, handler); } catch (_) {}
        } else if (typeof sock.removeListener === "function") {
          try { sock.removeListener(event, handler); } catch (_) {}
        }
      });
    };
  }

  function ensurePanel(){
    const container = $("#btfw-notify-sounds-body");
    if (!container || container._btfwNotifySounds) return;
    container._btfwNotifySounds = true;

    const audioSupported = !!getAudioCtor();

    const list = document.createElement("div");
    list.className = "btfw-notify-sound-list";

    EVENT_CONFIG.forEach(cfg => {
      const row = buildRow(cfg);
      list.appendChild(row);
    });

    container.appendChild(list);

    if (!audioSupported) {
      const warn = document.createElement("p");
      warn.className = "btfw-help";
      warn.textContent = "Your browser does not support the Web Audio API, so notification sounds cannot play.";
      container.appendChild(warn);
    }
  }

  function buildRow(cfg){
    const row = document.createElement("div");
    row.className = "btfw-notify-sound";
    row.dataset.notifyKey = cfg.key;

    const meta = document.createElement("div");
    meta.className = "btfw-notify-sound__meta";
    const title = document.createElement("h4");
    title.textContent = cfg.title;
    const desc = document.createElement("p");
    desc.textContent = cfg.description;
    meta.appendChild(title);
    meta.appendChild(desc);
    row.appendChild(meta);

    const controls = document.createElement("div");
    controls.className = "btfw-notify-sound__controls";

    const soundWrap = document.createElement("div");
    soundWrap.className = "btfw-ts-control";
    const soundLabel = document.createElement("label");
    soundLabel.className = "btfw-input__label";
    const soundId = `btfw-notify-${cfg.key}-sound`;
    soundLabel.setAttribute("for", soundId);
    soundLabel.textContent = "Sound";
    const soundSelectWrap = document.createElement("div");
    soundSelectWrap.className = "select is-small";
    const soundSelect = document.createElement("select");
    soundSelect.id = soundId;
    SOUND_PRESETS.forEach(preset => {
      const opt = document.createElement("option");
      opt.value = preset.id;
      opt.textContent = preset.name;
      soundSelect.appendChild(opt);
    });
    soundSelectWrap.appendChild(soundSelect);
    soundWrap.appendChild(soundLabel);
    soundWrap.appendChild(soundSelectWrap);
    controls.appendChild(soundWrap);

    const volumeWrap = document.createElement("div");
    volumeWrap.className = "btfw-notify-volume";
    const volumeLabel = document.createElement("span");
    volumeLabel.className = "btfw-input__label";
    volumeLabel.textContent = "Volume";
    const volumeRangeWrap = document.createElement("div");
    volumeRangeWrap.className = "btfw-notify-volume-range";
    const volumeInput = document.createElement("input");
    volumeInput.type = "range";
    volumeInput.min = "0";
    volumeInput.max = "100";
    volumeInput.step = "5";
    volumeInput.id = `btfw-notify-${cfg.key}-volume`;
    const volumeValue = document.createElement("span");
    volumeValue.className = "btfw-notify-volume-value";
    volumeValue.textContent = "100%";
    volumeRangeWrap.appendChild(volumeInput);
    volumeRangeWrap.appendChild(volumeValue);
    volumeWrap.appendChild(volumeLabel);
    volumeWrap.appendChild(volumeRangeWrap);
    controls.appendChild(volumeWrap);

    const muteLabel = document.createElement("label");
    muteLabel.className = "checkbox btfw-checkbox";
    const muteInput = document.createElement("input");
    muteInput.type = "checkbox";
    muteInput.id = `btfw-notify-${cfg.key}-mute`;
    const muteText = document.createElement("span");
    muteText.textContent = cfg.muteLabel;
    muteLabel.appendChild(muteInput);
    muteLabel.appendChild(muteText);
    controls.appendChild(muteLabel);

    const previewBtn = document.createElement("button");
    previewBtn.type = "button";
    previewBtn.className = "button is-small is-link btfw-notify-preview";
    previewBtn.textContent = "Preview";
    controls.appendChild(previewBtn);

    row.appendChild(controls);

    ui.set(cfg.key, {
      row,
      soundSelect,
      volumeInput,
      volumeValue,
      muteInput,
      previewBtn
    });

    soundSelect.addEventListener("change", () => {
      const state = draftSettings[cfg.key];
      if (!state) return;
      state.sound = SOUND_LOOKUP.has(soundSelect.value) ? soundSelect.value : state.sound;
    });

    volumeInput.addEventListener("input", () => {
      const state = draftSettings[cfg.key];
      if (!state) return;
      const vol = clamp01(Number(volumeInput.value) / 100);
      state.volume = vol;
      volumeValue.textContent = `${Math.round(vol * 100)}%`;
    });

    muteInput.addEventListener("change", () => {
      const state = draftSettings[cfg.key];
      if (!state) return;
      state.muted = !!muteInput.checked;
      row.classList.toggle("is-muted", state.muted);
    });

    previewBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const state = draftSettings[cfg.key];
      if (!state) return;
      const sound = SOUND_LOOKUP.has(state.sound) ? state.sound : DEFAULTS[cfg.key].sound;
      const vol = clamp01(state.volume != null ? state.volume : DEFAULTS[cfg.key].volume);
      playPresetById(sound, vol || 0.5);
    });

    return row;
  }

  function syncUI(){
    EVENT_CONFIG.forEach(cfg => {
      const state = draftSettings[cfg.key];
      const refs = ui.get(cfg.key);
      if (!state || !refs) return;
      refs.soundSelect.value = SOUND_LOOKUP.has(state.sound) ? state.sound : DEFAULTS[cfg.key].sound;
      const vol = clamp01(state.volume != null ? state.volume : DEFAULTS[cfg.key].volume);
      refs.volumeInput.value = String(Math.round(vol * 100));
      refs.volumeValue.textContent = `${Math.round(vol * 100)}%`;
      refs.muteInput.checked = !!state.muted;
      refs.row.classList.toggle("is-muted", !!state.muted);
    });
  }

  function onThemeOpen(){
    ensurePanel();
    draftSettings = cloneSettings(liveSettings);
    syncUI();
    resumeAudio();
  }

  function applyDraft(){
    liveSettings = cloneSettings(draftSettings);
    persist(liveSettings);
    draftSettings = cloneSettings(liveSettings);
    syncUI();
    document.dispatchEvent(new CustomEvent("btfw:notificationSounds:changed", {
      detail: { settings: cloneSettings(liveSettings) }
    }));
  }

  document.addEventListener("btfw:themeSettings:open", onThemeOpen);
  document.addEventListener("btfw:themeSettings:apply", applyDraft);

  document.addEventListener("click", resumeAudio, { once: true });
  document.addEventListener("keydown", resumeAudio, { once: true });

  wireSocketWatchers();
  document.addEventListener("btfw:ready", () => setTimeout(wireSocketWatchers, 0));

  return {
    getSettings(){
      return cloneSettings(liveSettings);
    },
    preview(key){
      const cfg = liveSettings[key];
      if (!cfg) return;
      playPresetById(cfg.sound, cfg.volume);
    }
  };
});
