BTFW.define("feature:channels", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);

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
    prev.innerHTML = '<span aria-hidden="true">‹</span>';

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btfw-channels__arrow btfw-channels__arrow--next';
    next.setAttribute('aria-label', 'Scroll featured channels right');
    next.innerHTML = '<span aria-hidden="true">›</span>';

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

        const media = document.createElement('div');
        media.className = 'btfw-channels__media';
        const img = document.createElement('img');
        img.className = 'btfw-channels__thumb';
        img.src = channel.image_url;
        img.alt = channel.title || 'Channel thumbnail';
        img.loading = 'lazy';
        img.onerror = function(){ this.classList.add('is-missing'); };
        media.appendChild(img);

        const label = document.createElement('span');
        label.className = 'btfw-channels__label';
        label.textContent = channel.title || channel.channel_url || 'Channel';

        link.appendChild(media);
        link.appendChild(label);
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
        border: 1px solid rgba(109, 77, 246, 0.22);
        border: 1px solid color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 28%, transparent 72%);
        background: rgba(12, 18, 34, 0.92);
        background: linear-gradient(135deg,
          color-mix(in srgb, var(--btfw-theme-surface, #0b111d) 94%, transparent 6%),
          color-mix(in srgb, var(--btfw-theme-panel, #141f36) 86%, black 14%));
        padding: 18px 52px;
        display: flex;
        align-items: center;
        gap: 14px;
        width: 100%;
        color: var(--btfw-theme-text, #e8ecfb);
        box-shadow: 0 24px 48px color-mix(in srgb, var(--btfw-theme-bg, #05060d) 30%, transparent 70%);
        backdrop-filter: blur(14px);
      }

      .btfw-channels__viewport {
        flex: 1 1 auto;
        overflow: hidden;
        touch-action: pan-y;
      }

      .btfw-channels__track {
        display: flex;
        gap: 16px;
        transition: transform 0.3s ease;
        will-change: transform;
      }

      .btfw-channels__item {
        flex: 0 0 clamp(160px, 18vw, 220px);
        max-width: clamp(160px, 18vw, 220px);
      }

      .btfw-channels__link {
        display: flex;
        flex-direction: column;
        gap: 8px;
        text-decoration: none;
        color: color-mix(in srgb, var(--btfw-theme-text, #e8ecfb) 96%, transparent 4%);
        background: var(--btfw-theme-surface, #0b111d);
        background: color-mix(in srgb, var(--btfw-theme-surface, #0b111d) 88%, transparent 12%);
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 22%, transparent 78%);
        overflow: hidden;
        box-shadow: 0 14px 30px color-mix(in srgb, var(--btfw-theme-panel, #141f36) 28%, transparent 72%);
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        cursor: grab;
        user-select: none;
      }

      .btfw-channels__link:hover,
      .btfw-channels__link:focus {
        transform: translateY(-4px);
        border-color: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 70%, white 30%);
        background: color-mix(in srgb, var(--btfw-theme-panel, #141f36) 82%, var(--btfw-theme-accent, #6d4df6) 18%);
        box-shadow: 0 18px 36px color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 35%, transparent 65%);
      }

      .btfw-channels__media {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        background: var(--btfw-theme-panel, #141f36);
        background: color-mix(in srgb, var(--btfw-theme-panel, #141f36) 88%, black 12%);
      }

      .btfw-channels__thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.2s ease;
      }

      .btfw-channels__thumb.is-missing {
        opacity: 0.45;
        object-fit: contain;
      }

      .btfw-channels__link:hover .btfw-channels__thumb {
        transform: scale(1.05);
      }

      .btfw-channels__label {
        padding: 10px 12px 14px;
        font-weight: 600;
        letter-spacing: 0.01em;
        font-size: 14px;
        color: color-mix(in srgb, var(--btfw-theme-text, #e6edf3) 92%, transparent 8%);
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      }

      .btfw-channels__arrow {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 18%, rgba(255,255,255,0.08) 82%);
        color: color-mix(in srgb, var(--btfw-theme-text, #e6edf3) 98%, transparent 2%);
        font-size: 20px;
        cursor: pointer;
        transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
      }

      .btfw-channels__arrow:hover:not([disabled]) {
        background: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 65%, white 35%);
        box-shadow: 0 12px 24px color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 30%, transparent 70%);
        transform: translateY(-2px);
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
        color: color-mix(in srgb, var(--btfw-theme-text, #e6edf3) 80%, transparent 20%);
        font-size: 15px;
        width: 100%;
        text-align: center;
      }

      .btfw-channels--no-scroll .btfw-channels__arrow {
        display: none;
      }

      @media (max-width: 960px) {
        .btfw-channels {
          padding: 16px 44px;
        }
        .btfw-channels__item {
          flex-basis: 190px;
        }
      }

      @media (max-width: 768px) {
        .btfw-channels {
          padding: 14px 38px;
          gap: 10px;
        }
        .btfw-channels__item {
          flex-basis: 170px;
        }
        .btfw-channels__label {
          font-size: 13px;
        }
        .btfw-channels__arrow {
          width: 34px;
          height: 34px;
          font-size: 18px;
        }
      }

      @media (max-width: 600px) {
        .btfw-channels {
          padding: 12px 32px;
        }
        .btfw-channels__item {
          flex-basis: 150px;
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

    let pointerActive = false;
    let pointerId = null;
    let startX = 0;
    let startScroll = 0;

    function releasePointer(){
      if (!pointerActive) return;
      pointerActive = false;
      slider.classList.remove('btfw-channels--dragging');
      if (pointerId !== null) {
        try { viewport.releasePointerCapture(pointerId); } catch(_) {}
      }
      pointerId = null;
      startAuto();
    }

    viewport.addEventListener('pointerdown', (e) => {
      pointerActive = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScroll = viewport.scrollLeft;
      slider.classList.add('btfw-channels--dragging');
      viewport.setPointerCapture(e.pointerId);
      stopAuto();
    });

    viewport.addEventListener('pointermove', (e) => {
      if (!pointerActive || e.pointerId !== pointerId) return;
      e.preventDefault();
      const delta = e.clientX - startX;
      viewport.scrollLeft = startScroll - delta;
    });

    viewport.addEventListener('pointerup', releasePointer);
    viewport.addEventListener('pointercancel', releasePointer);
    viewport.addEventListener('pointerleave', () => {
      if (!pointerActive) return;
      releasePointer();
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

  function placeSliderInStack(slider){
    const stackBody = document.querySelector('#btfw-stack .btfw-stack-item[data-bind="channels-group"] .btfw-stack-item__body');
    if (!stackBody) return false;
    if (slider.parentElement !== stackBody) stackBody.appendChild(slider);
    slider._btfwRecalc && slider._btfwRecalc();
    return true;
  }

  function scheduleStackPlacement(slider){
    if (placeSliderInStack(slider)) return;
    let attempts = 0;
    const iv = setInterval(() => {
      attempts += 1;
      if (placeSliderInStack(slider) || attempts > 10) clearInterval(iv);
    }, 400);
  }

  function removeExistingSliders() {
    document.querySelectorAll('#btfw-channels').forEach(existing => {
      if (typeof existing._btfwCleanup === 'function') {
        try { existing._btfwCleanup(); } catch(_) {}
      }
      try { existing.remove(); } catch(_) {}
    });
  }

  function injectChannelSlider(channels) {
    removeExistingSliders();

    const slider = createChannelSlider(channels);

    const videowrap = document.getElementById('videowrap');
    const leftpad = document.getElementById('btfw-leftpad');

    let inserted = false;

    if (placeSliderInStack(slider)) {
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

    scheduleStackPlacement(slider);
    setTimeout(() => {
      setupCarouselControls(slider, channels);
      slider._btfwRecalc && slider._btfwRecalc();
    }, 150);
  }

  async function initializeChannels() {
    removeExistingSliders();
    if (!isChannelListEnabled()) {
      return;
    }

    const jsonUrl = getChannelJSON();
    if (!jsonUrl) {
      return;
    }

    const channels = await fetchChannelData(jsonUrl);
    if (channels.length === 0) {
      injectChannelCSS();
      injectChannelSlider([]);
      return;
    }

    injectChannelCSS();
    injectChannelSlider(channels);
  }

  function boot() {
    setTimeout(initializeChannels, 500);
    setTimeout(initializeChannels, 1500);
    setTimeout(initializeChannels, 3000);

    document.addEventListener('btfw:layoutReady', () => {
      setTimeout(initializeChannels, 300);
    });
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