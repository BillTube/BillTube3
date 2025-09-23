BTFW.define("feature:channels", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);

  function isChannelListEnabled() {
    try {
      return window.UI_ChannelList === "1" || window.UI_ChannelList === 1;
    } catch (_) {
      return false;
    }
  }

  function getChannelJSON() {
    try {
      return window.Channel_JSON || '';
    } catch (_) {
      return '';
    }
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
    
    if (channels.length === 0) {
      carousel.innerHTML = '<div class="no-channels">No channels available</div>';
      return slider;
    }

    channels.forEach(channel => {
      const item = document.createElement('div');
      item.className = 'item';
      item.onclick = () => window.open(channel.channel_url);
      item.innerHTML = `<img src="${channel.image_url}" class="kek" alt="${channel.title}" onerror="this.style.display='none'">`;
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
        background: rgba(20, 24, 34, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        overflow: hidden;
        height: 120px;
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
      
      .no-channels {
        color: rgba(255, 255, 255, 0.6);
        text-align: center;
        width: 100%;
        padding: 20px;
        font-size: 14px;
      }
      
      .item {
        flex: 0 0 140px;
        height: 80px;
        cursor: pointer;
        border-radius: 8px;
        overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      
      .item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(109, 77, 246, 0.15);
        border-color: rgba(109, 77, 246, 0.4);
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
        color: #fff;
        background: rgba(109, 77, 246, 0.8);
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
        background: rgba(109, 77, 246, 1);
        transform: translateY(-50%) scale(1.1);
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
      console.log('[channels] Attempting to fetch from:', jsonUrl);
      const response = await fetch(jsonUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      console.log('[channels] Raw JSON data:', data);

      if (data.list && data.list.channels && Array.isArray(data.list.channels)) {
        console.log('[channels] Found channels:', data.list.channels.length);
        return data.list.channels;
      } else if (data.channels && Array.isArray(data.channels)) {
        console.log('[channels] Found channels (alt format):', data.channels.length);
        return data.channels;
      } else if (Array.isArray(data)) {
        console.log('[channels] Found channels (array format):', data.length);
        return data;
      }

      console.warn('[channels] Unexpected JSON structure:', data);
      return [];
    } catch (error) {
      console.warn('[channels] Failed to fetch channel data:', error);
      return [];
    }
  }

  function setupCarouselControls(slider, channels) {
    if (channels.length === 0) return;
    
    const carousel = slider.querySelector('#btfw-carousel');
    const leftBtn = slider.querySelector('#btfw-left');
    const rightBtn = slider.querySelector('#btfw-right');
    
    let currentIndex = 0;
    const itemWidth = 140 + 12;
    const visibleItems = Math.floor((slider.offsetWidth - 80) / itemWidth);
    const maxIndex = Math.max(0, channels.length - visibleItems);

    if (maxIndex === 0) {
      leftBtn.style.display = 'none';
      rightBtn.style.display = 'none';
      return;
    }

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
    const stack = document.getElementById('btfw-stack');

    if (motdrow) {
      motdrow.parentNode.insertBefore(slider, motdrow);
    } else if (motdwrap) {
      motdwrap.parentNode.insertBefore(slider, motdwrap);
    } else if (stack) {
      stack.parentNode.insertBefore(slider, stack);
    } else if (videowrap && videowrap.nextSibling) {
      videowrap.parentNode.insertBefore(slider, videowrap.nextSibling);
    } else if (leftpad) {
      leftpad.insertBefore(slider, leftpad.firstChild);
    }

    setTimeout(() => setupCarouselControls(slider, channels), 200);
  }

  async function initializeChannels() {
    console.log('[channels] Initializing...');
    console.log('[channels] UI_ChannelList:', window.UI_ChannelList);
    console.log('[channels] Channel_JSON:', window.Channel_JSON);
    
    if (!isChannelListEnabled()) {
      console.log('[channels] UI_ChannelList not enabled (must be "1")');
      return;
    }

    const jsonUrl = getChannelJSON();
    if (!jsonUrl) {
      console.warn('[channels] Channel_JSON not provided');
      return;
    }

    const channels = await fetchChannelData(jsonUrl);
    if (channels.length === 0) {
      console.warn('[channels] No channels found or failed to fetch');
      injectChannelCSS();
      injectChannelSlider([]);
      return;
    }

    console.log(`[channels] Successfully loaded ${channels.length} channels`);

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