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
    const slider = document.createElement('div');
    slider.className = 'slider btfw-channels';
    slider.id = 'btfw-channels';
    slider.setAttribute('data-title', 'Channels');

    slider.innerHTML = `
      <i id="btfw-left" class="arrow arrleft">‹</i>
      <div id="btfw-carousel" class="carousel-inner">
      </div>
      <i id="btfw-right" class="arrow arrright">›</i>
    `;

    const carousel = slider.querySelector('#btfw-carousel');
    
    channels.forEach(channel => {
      const item = document.createElement('div');
      item.className = 'item';
      item.onclick = () => window.open(channel.channel_url);
      item.innerHTML = `<img src="${channel.image_url}" class="kek" alt="${channel.title}">`;
      carousel.appendChild(item);
    });

    return slider;
  }

  function injectChannelCSS() {
    if (document.getElementById('btfw-channels-css')) return;

    const style = document.createElement('style');
    style.id = 'btfw-channels-css';
    style.textContent = `
      .slider {
        position: relative;
        margin: 10px 0;
        background: color-mix(in srgb, var(--btfw-theme-panel, #1d2640) 86%, transparent 14%);
        border: 1px solid color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 24%, transparent 76%);
        border-radius: 14px;
        overflow: hidden;
        height: 120px;
        color: var(--btfw-theme-text, #e6edf3);
        box-shadow: 0 18px 36px color-mix(in srgb, var(--btfw-theme-bg, #0f1524) 28%, transparent 72%);
      }
      
      .carousel-inner {
        display: flex;
        transition: transform 0.3s ease;
        height: 100%;
        align-items: center;
        padding: 10px;
        gap: 12px;
        overflow: hidden;
      }
      
      .item {
        flex: 0 0 140px;
        height: 80px;
        cursor: pointer;
        border-radius: 10px;
        overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        border: 1px solid color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 18%, transparent 82%);
        background: color-mix(in srgb, var(--btfw-theme-surface, #151d30) 84%, transparent 16%);
      }

      .item:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 16px color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 30%, transparent 70%);
        border-color: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 65%, white 35%);
      }
      
      .item img.kek {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.2s ease;
      }
      
      .item:hover img.kek {
        transform: scale(1.05);
      }
      
      .arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        font-size: 24px;
        color: color-mix(in srgb, var(--btfw-theme-text, #e6edf3) 98%, transparent 2%);
        background: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 32%, rgba(0,0,0,0.55) 68%);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 10;
        transition: all 0.2s ease;
        user-select: none;
      }

      .arrow:hover {
        background: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 70%, white 30%);
        transform: translateY(-50%) scale(1.1);
        box-shadow: 0 10px 24px color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 32%, transparent 68%);
      }
      
      .arrleft {
        left: 10px;
      }
      
      .arrright {
        right: 10px;
      }
      
      @media (max-width: 768px) {
        .item {
          flex: 0 0 120px;
          height: 70px;
        }
        .slider {
          height: 100px;
        }
        .arrow {
          width: 35px;
          height: 35px;
          font-size: 20px;
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

      if (data.list && data.list.channels) {
        return data.list.channels;
      }

      return [];
    } catch (error) {
      console.warn('[channels] Failed to fetch channel data:', error);
      return [];
    }
  }

  function setupCarouselControls(slider, channels) {
    const carousel = slider.querySelector('#btfw-carousel');
    const leftBtn = slider.querySelector('#btfw-left');
    const rightBtn = slider.querySelector('#btfw-right');
    
    let currentIndex = 0;
    const itemWidth = 140 + 12;
    const visibleItems = Math.floor((slider.offsetWidth - 80) / itemWidth);
    const maxIndex = Math.max(0, channels.length - visibleItems);

    function updateCarousel() {
      const offset = currentIndex * itemWidth;
      carousel.style.transform = `translateX(-${offset}px)`;
      
      leftBtn.style.opacity = currentIndex > 0 ? '1' : '0.5';
      rightBtn.style.opacity = currentIndex < maxIndex ? '1' : '0.5';
    }

    rightBtn.addEventListener('click', () => {
      if (currentIndex < maxIndex) {
        currentIndex++;
        updateCarousel();
      }
    });

    leftBtn.addEventListener('click', () => {
      if (currentIndex > 0) {
        currentIndex--;
        updateCarousel();
      }
    });

    let autoplayInterval = setInterval(() => {
      if (currentIndex < maxIndex) {
        currentIndex++;
      } else {
        currentIndex = 0;
      }
      updateCarousel();
    }, 48000);

    slider.addEventListener('mouseenter', () => {
      clearInterval(autoplayInterval);
    });

    slider.addEventListener('mouseleave', () => {
      clearInterval(autoplayInterval);
      autoplayInterval = setInterval(() => {
        if (currentIndex < maxIndex) {
          currentIndex++;
        } else {
          currentIndex = 0;
        }
        updateCarousel();
      }, 48000);
    });

    setTimeout(updateCarousel, 100);
  }

  function injectChannelSlider(channels) {
    const existing = document.getElementById('btfw-channels');
    if (existing) existing.remove();

    const slider = createChannelSlider(channels);

    const motdrow = document.getElementById('motdrow');
    const motdwrap = document.getElementById('motdwrap');
    const videowrap = document.getElementById('videowrap');
    const leftpad = document.getElementById('btfw-leftpad');

    if (motdrow) {
      motdrow.parentNode.insertBefore(slider, motdrow);
    } else if (motdwrap) {
      motdwrap.parentNode.insertBefore(slider, motdwrap);
    } else if (videowrap && videowrap.nextSibling) {
      videowrap.parentNode.insertBefore(slider, videowrap.nextSibling);
    } else if (leftpad) {
      leftpad.insertBefore(slider, leftpad.firstChild);
    }

    setTimeout(() => setupCarouselControls(slider, channels), 100);
  }

  async function initializeChannels() {
    if (!isChannelListEnabled()) {
      console.log('[channels] UI_ChannelList not enabled (must be "1")');
      return;
    }

    const jsonUrl = getChannelJSON();
    if (!jsonUrl) {
      console.warn('[channels] Channel_JSON not provided');
      return;
    }

    console.log('[channels] Fetching channel data from:', jsonUrl);

    const channels = await fetchChannelData(jsonUrl);
    if (channels.length === 0) {
      console.warn('[channels] No channels found in JSON');
      return;
    }

    console.log(`[channels] Loaded ${channels.length} channels`);

    injectChannelCSS();
    injectChannelSlider(channels);
  }

  function boot() {
    initializeChannels();

    document.addEventListener('btfw:layoutReady', () => {
      setTimeout(initializeChannels, 200);
    });

    setTimeout(initializeChannels, 1000);
    setTimeout(initializeChannels, 3000);
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
});ChannelJSON();
    if (!jsonUrl) {
      console.warn('[channels] Channel_JSON not provided');
      return;
    }

    console.log('[channels] Fetching channel data from:', jsonUrl);

    const channels = await fetchChannelData(jsonUrl);
    if (channels.length === 0) {
      console.warn('[channels] No channels found in JSON');
      return;
    }

    console.log(`[channels] Loaded ${channels.length} channels`);

    injectChannelCSS();
    injectChannelSlider(channels);
  }

  function boot() {
    // Try to initialize immediately
    initializeChannels();

    // Also try after layout is ready
    document.addEventListener('btfw:layoutReady', () => {
      setTimeout(initializeChannels, 200);
    });

    // And try again after delays in case variables are set later
    setTimeout(initializeChannels, 1000);
    setTimeout(initializeChannels, 3000);
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