BTFW.define("feature:channels", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);
  let booted = false;
  let initTimer = null;
  let initRun = 0;
  let sliderRun = 0;
  let placementTimer = null;

  function resolveSliderSettings() {
    try {
      const global = window.BTFW || {};
      const theme = global.channelTheme || {};
      const slider = theme.slider || {};
      let enabled = slider.enabled;
      let url = slider.feedUrl || slider.url || slider.json || '';

      if (typeof enabled === 'undefined' && typeof theme.sliderEnabled !== 'undefined') {
        enabled = theme.sliderEnabled;
      }
      if (!url) {
        url = theme.sliderJson || theme.sliderJSON || '';
      }

      if (typeof enabled === 'undefined' && global.channelSlider) {
        enabled = global.channelSlider.enabled;
        if (!url) url = global.channelSlider.feedUrl || '';
      }
      if (typeof enabled === 'undefined' && typeof global.channelSliderEnabled !== 'undefined') {
        enabled = global.channelSliderEnabled;
      }
      if (!url && global.channelSliderJSON) {
        url = global.channelSliderJSON;
      }

      if (typeof enabled === 'undefined' && typeof window.UI_ChannelList !== 'undefined') {
        enabled = window.UI_ChannelList === '1' || window.UI_ChannelList === 1;
      }
      if (!url && typeof window.Channel_JSON !== 'undefined') {
        url = window.Channel_JSON || '';
      }

      if (typeof enabled === 'undefined' && url) {
        enabled = true;
      }

      return { enabled: Boolean(enabled), url: url || '' };
    } catch (_) {
      return { enabled: false, url: '' };
    }
  }

  function isChannelListEnabled() {
    return resolveSliderSettings().enabled;
  }

  function getChannelJSON() {
    return resolveSliderSettings().url || '';
  }

  function createChannelSlider(channels) {
    const slider = document.createElement('section');
    slider.className = 'btfw-channels';
    slider.id = 'btfw-channels';
    slider.dataset.title = 'Featured Channels';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'btfw-channels__arrow btfw-channels__arrow--prev';
    prev.setAttribute('aria-label', 'Scroll featured channels left');
    prev.innerHTML = '<i class="fa fa-chevron-left" aria-hidden="true"></i>';

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btfw-channels__arrow btfw-channels__arrow--next';
    next.setAttribute('aria-label', 'Scroll featured channels right');
    next.innerHTML = '<i class="fa fa-chevron-right" aria-hidden="true"></i>';

    const viewport = document.createElement('div');
    viewport.className = 'btfw-channels__viewport';
    viewport.id = 'btfw-carousel';

    const track = document.createElement('div');
    track.className = 'btfw-channels__track';
    viewport.appendChild(track);

    if (channels.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'btfw-channels__empty';
      empty.textContent = 'No channels available';
      track.appendChild(empty);
    } else {
      channels.forEach((channel, index) => {
        const item = document.createElement('article');
        item.className = 'btfw-channels__item';
        item.dataset.index = String(index);

        const link = document.createElement('a');
        link.href = channel.channel_url || '#';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'btfw-channels__link';
        link.title = channel.title || channel.channel_url;
        link.setAttribute('aria-label', channel.title || 'Visit channel');

        const media = document.createElement('div');
        media.className = 'btfw-channels__media';
        const img = document.createElement('img');
        img.className = 'btfw-channels__thumb';
        img.src = channel.image_url;
        img.alt = channel.title || 'Channel thumbnail';
        img.loading = 'lazy';
        img.onerror = function(){ this.classList.add('is-missing'); };
        media.appendChild(img);

        link.appendChild(media);
        item.appendChild(link);
        track.appendChild(item);
      });
    }

    slider.appendChild(prev);
    slider.appendChild(viewport);
    slider.appendChild(next);

    return slider;
  }

  function injectChannelCSS() {
    if (document.getElementById('btfw-channels-css')) return;

    const style = document.createElement('style');
    style.id = 'btfw-channels-css';
    style.textContent = `
      .btfw-channels {
        position: relative;
        margin-top: 10px;
        border-radius: 16px;
        border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 28%, transparent 72%);
        background: rgba(12, 18, 34, 0.92);
        background: linear-gradient(135deg,
          color-mix(in srgb, var(--btfw-color-surface) 94%, transparent 6%),
          color-mix(in srgb, var(--btfw-color-panel) 86%, black 14%));
        padding: 10px 30px;
        display: flex;
        align-items: center;
        gap: 14px;
        width: 100%;
        color: var(--btfw-color-text);
      }

      .btfw-channels__viewport {
        flex: 1 1 auto;
        overflow: hidden;
        /* vertical room so the hover scale doesn't get clipped */
        padding: 9px 2px;
        touch-action: pan-y;
      }

      .btfw-channels__track {
        display: flex;
        gap: 16px;
        transition: transform 0.3s ease;
        will-change: transform;
      }

      .btfw-channels__item {
        flex: 0 0 clamp(180px, 16vw, 230px);
        max-width: clamp(180px, 16vw, 230px);
      }

      /* Frosted-glass card: full-bleed banner, title on a blurred gradient. */
      .btfw-channels__link {
        position: relative;
        display: block;
        aspect-ratio: 2 / 1;
        text-decoration: none;
        border-radius: 12px;
        overflow: hidden;
        background: color-mix(in srgb, var(--btfw-color-panel) 88%, black 12%);
        border: 1px solid var(--btfw-border);
        box-shadow: 0 10px 22px color-mix(in srgb, var(--btfw-color-panel) 34%, transparent 66%);
        transition: transform 0.26s cubic-bezier(.2,.7,.3,1), box-shadow 0.26s ease, border-color 0.26s ease;
        cursor: pointer;
        user-select: none;
      }

      .btfw-channels__link:hover,
      .btfw-channels__link:focus {
        transform: scale(1.04);
        z-index: 3;
        border-color: color-mix(in srgb, var(--btfw-color-accent) 60%, white 40%);
        box-shadow: 0 16px 32px color-mix(in srgb, var(--btfw-color-accent) 30%, transparent 70%);
      }

      .btfw-channels__media {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      .btfw-channels__thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.5s cubic-bezier(.2,.7,.3,1);
      }

      .btfw-channels__thumb.is-missing {
        opacity: 0.45;
        object-fit: contain;
      }

      .btfw-channels__link:hover .btfw-channels__thumb {
        transform: scale(1.1);
      }

      .btfw-channels__arrow {
        /* flex:0 0 keeps them from being squished into ovals by the flex row */
        flex: 0 0 38px;
        width: 38px;
        height: 38px;
        padding: 0;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        font-size: 15px;
        background: color-mix(in srgb, var(--btfw-color-panel) 86%, transparent 14%);
        border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 30%, transparent 70%);
        color: color-mix(in srgb, var(--btfw-color-text) 92%, transparent 8%);
        box-shadow: 0 4px 12px color-mix(in srgb, var(--btfw-color-panel) 40%, transparent 60%);
        cursor: pointer;
        transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      }

      .btfw-channels__arrow i { line-height: 1; }

      .btfw-channels__arrow:hover:not([disabled]) {
        background: color-mix(in srgb, var(--btfw-color-accent) 70%, white 8%);
        border-color: color-mix(in srgb, var(--btfw-color-accent) 80%, white 20%);
        color: #fff;
        box-shadow: 0 10px 22px color-mix(in srgb, var(--btfw-color-accent) 30%, transparent 70%);
        transform: translateY(-1px);
      }

      .btfw-channels__arrow[disabled] {
        opacity: 0.4;
        cursor: default;
        pointer-events: none;
      }

      .btfw-channels--dragging .btfw-channels__link {
        cursor: grabbing;
      }

      .btfw-channels__empty {
        padding: 24px;
        color: color-mix(in srgb, var(--btfw-color-text) 80%, transparent 20%);
        font-size: 15px;
        width: 100%;
        text-align: center;
      }

      .btfw-channels--no-scroll .btfw-channels__arrow {
        display: none;
      }

      @media (max-width: 768px) {
        .btfw-channels {
          padding: 10px 14px;
          gap: 8px;
        }
        .btfw-channels__item {
          flex: 0 0 clamp(150px, 42vw, 200px);
          max-width: clamp(150px, 42vw, 200px);
        }
        .btfw-channels__arrow {
          flex-basis: 34px;
          width: 34px;
          height: 34px;
          font-size: 14px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  async function fetchChannelData(jsonUrl) {
    try {
      const response = await fetch(jsonUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.list && data.list.channels && Array.isArray(data.list.channels)) {
        return data.list.channels;
      } else if (data.channels && Array.isArray(data.channels)) {
        return data.channels;
      } else if (Array.isArray(data)) {
        return data;
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  function setupCarouselControls(slider, channels) {
    if (!slider || slider._btfwCarouselWired) return;
    if (!channels || channels.length === 0) {
      slider.classList.add('btfw-channels--no-scroll');
      return;
    }
    slider._btfwCarouselWired = true;

    const viewport = slider.querySelector('.btfw-channels__viewport');
    const track = slider.querySelector('.btfw-channels__track');
    const leftBtn = slider.querySelector('.btfw-channels__arrow--prev');
    const rightBtn = slider.querySelector('.btfw-channels__arrow--next');

    if (!viewport || !track) return;

    const items = Array.from(track.children);
    if (!items.length) {
      slider.classList.add('btfw-channels--no-scroll');
      return;
    }

    let currentIndex = 0;
    let itemWidth = 0;
    let gap = 0;
    let autoTimer = null;

    const cleanup = () => {
      if (slider._btfwCleanup) slider._btfwCleanup();
      slider._btfwCleanup = () => {
        if (autoTimer) clearInterval(autoTimer);
        window.removeEventListener('resize', measure);
      };
    };

    const stopAuto = () => {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    };

    const startAuto = () => {
      stopAuto();
      if (channels.length <= 1) return;
      autoTimer = setInterval(() => {
        const max = getMaxIndex();
        if (max <= 0) return;
        currentIndex = currentIndex >= max ? 0 : currentIndex + 1;
        scrollToIndex(currentIndex);
      }, 48000);
    };

    function measure(){
      const first = items.find(el => el.getBoundingClientRect().width > 0);
      if (!first) {
        itemWidth = 0;
        gap = 0;
        return;
      }
      const rect = first.getBoundingClientRect();
      itemWidth = rect.width;
      const style = window.getComputedStyle(track);
      const parsedGap = parseFloat(style.columnGap || style.gap || '0');
      gap = Number.isFinite(parsedGap) ? parsedGap : 0;
      updateArrows();
    }

    function getMaxIndex(){
      if (!itemWidth) return 0;
      const visible = Math.max(1, Math.floor((viewport.clientWidth + gap) / (itemWidth + gap)));
      return Math.max(0, items.length - visible);
    }

    function updateArrows(){
      const max = getMaxIndex();
      if (leftBtn) leftBtn.disabled = currentIndex <= 0;
      if (rightBtn) rightBtn.disabled = currentIndex >= max;
      slider.classList.toggle('btfw-channels--no-scroll', max <= 0);
    }

    function scrollToIndex(index, behavior = 'smooth'){
      const max = getMaxIndex();
      currentIndex = Math.min(Math.max(index, 0), max);
      viewport.scrollTo({ left: (itemWidth + gap) * currentIndex, behavior });
      updateArrows();
    }

    if (leftBtn) {
      leftBtn.addEventListener('click', () => {
        stopAuto();
        scrollToIndex(currentIndex - 1);
        startAuto();
      });
    }

    if (rightBtn) {
      rightBtn.addEventListener('click', () => {
        stopAuto();
        scrollToIndex(currentIndex + 1);
        startAuto();
      });
    }

    viewport.addEventListener('scroll', () => {
      if (!itemWidth) return;
      const newIndex = Math.round(viewport.scrollLeft / (itemWidth + gap));
      if (!Number.isNaN(newIndex)) {
        currentIndex = newIndex;
        updateArrows();
      }
    });

    slider.addEventListener('mouseenter', stopAuto);
    slider.addEventListener('mouseleave', startAuto);

    window.addEventListener('resize', measure);
    measure();
    requestAnimationFrame(measure);
    startAuto();

    slider._btfwRecalc = () => {
      measure();
      updateArrows();
    };

    cleanup();
  }

  function placeSliderInStack(slider, run = sliderRun){
    if (run !== sliderRun) return true;
    const stackBody = document.querySelector('#btfw-stack .btfw-stack-item[data-bind="channels-group"] .btfw-stack-item__body');
    if (!stackBody) return false;
    if (slider.parentElement !== stackBody) stackBody.appendChild(slider);
    slider._btfwRecalc && slider._btfwRecalc();
    return true;
  }

  function clearStackPlacementTimer(){
    if (!placementTimer) return;
    clearInterval(placementTimer);
    placementTimer = null;
  }

  function scheduleStackPlacement(slider, run){
    clearStackPlacementTimer();
    if (placeSliderInStack(slider, run)) return;
    let attempts = 0;
    placementTimer = setInterval(() => {
      attempts += 1;
      if (run !== sliderRun || placeSliderInStack(slider, run) || attempts > 10) {
        clearStackPlacementTimer();
      }
    }, 400);
  }

  function removeExistingSliders() {
    clearStackPlacementTimer();
    document.querySelectorAll('#btfw-channels').forEach(existing => {
      if (typeof existing._btfwCleanup === 'function') {
        try { existing._btfwCleanup(); } catch(_) {}
      }
      try { existing.remove(); } catch(_) {}
    });
  }

  function injectChannelSlider(channels) {
    removeExistingSliders();
    const run = ++sliderRun;

    const slider = createChannelSlider(channels);

    const videowrap = document.getElementById('videowrap');
    const leftpad = document.getElementById('btfw-leftpad');

    let inserted = false;

    if (placeSliderInStack(slider, run)) {
      inserted = true;
    } else if (videowrap && leftpad && leftpad.contains(videowrap)) {
      leftpad.insertBefore(slider, videowrap.nextSibling);
      inserted = true;
    } else if (leftpad) {
      leftpad.appendChild(slider);
      inserted = true;
    }

    if (!inserted) {
      document.body.appendChild(slider);
    }

    scheduleStackPlacement(slider, run);
    setTimeout(() => {
      setupCarouselControls(slider, channels);
      slider._btfwRecalc && slider._btfwRecalc();
    }, 150);
  }

  async function initializeChannels() {
    const run = ++initRun;
    initTimer = null;
    removeExistingSliders();
    if (!isChannelListEnabled()) {
      return;
    }

    const jsonUrl = getChannelJSON();
    if (!jsonUrl) {
      return;
    }

    const channels = await fetchChannelData(jsonUrl);
    if (run !== initRun) return;
    if (channels.length === 0) {
      injectChannelCSS();
      injectChannelSlider([]);
      return;
    }

    injectChannelCSS();
    injectChannelSlider(channels);
  }

  function scheduleInitialize(delay = 250) {
    if (initTimer) clearTimeout(initTimer);
    initTimer = setTimeout(initializeChannels, delay);
  }

  function boot() {
    if (booted) {
      scheduleInitialize(250);
      return;
    }
    booted = true;

    scheduleInitialize(500);

    document.addEventListener('btfw:layoutReady', () => {
      scheduleInitialize(300);
    });

    let themeTimer = null;
    const scheduleThemeSync = () => {
      if (themeTimer) clearTimeout(themeTimer);
      themeTimer = setTimeout(() => {
        themeTimer = null;
        initializeChannels();
      }, 120);
    };

    document.addEventListener('btfw:channelThemeTint', scheduleThemeSync);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  return {
    name: 'feature:channels',
    initialize: initializeChannels,
    isEnabled: isChannelListEnabled
  };
});
