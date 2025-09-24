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

    if (channels.length === 0) {
      slider.innerHTML = `
        <div class="carousel-inner">
          <div class="no-channels">No channels available</div>
        </div>
      `;
      return slider;
    }

    const arrowsHTML = `
      <i id="btfw-left" class="arrow arrleft">‹</i>
      <i id="btfw-right" class="arrow arrright">›</i>
    `;

    const carousel = document.createElement('div');
    carousel.id = 'btfw-carousel';
    carousel.className = 'carousel-inner';

    channels.forEach((channel, index) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.setAttribute('data-index', index);
      
      const img = document.createElement('img');
      img.src = channel.image_url;
      img.className = 'kek';
      img.alt = channel.title;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;';
      img.onerror = function() { this.style.display = 'none'; };
      
      item.appendChild(img);
      item.onclick = function(e) {
        e.preventDefault();
        window.open(channel.channel_url, '_blank');
      };
      
      carousel.appendChild(item);
    });

    slider.innerHTML = arrowsHTML;
    slider.appendChild(carousel);

    return slider;
  }

  function injectChannelCSS() {
    if (document.getElementById('btfw-channels-css')) return;

    const style = document.createElement('style');
    style.id = 'btfw-channels-css';
    style.textContent = `
      .slider.btfw-channels {
        position: relative;
        margin: 10px 0;
        background: rgba(20, 24, 34, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        overflow: hidden;
        height: 120px;
        z-index: 1;
        width: 100%;
        display: block !important;
      }
      
      .carousel-inner {
        display: flex !important;
        transition: transform 0.3s ease;
        height: 100%;
        align-items: center;
        padding: 10px;
        gap: 12px;
        overflow: hidden;
        width: 100%;
      }
      
      .no-channels {
        color: rgba(255, 255, 255, 0.6);
        text-align: center;
        width: 100%;
        padding: 20px;
        font-size: 14px;
      }
      
      .item {
        flex: 0 0 140px !important;
        height: 80px !important;
        cursor: pointer !important;
        border-radius: 8px;
        overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.02);
        display: block !important;
        position: relative;
      }
      
      .item:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 4px 12px rgba(109, 77, 246, 0.15) !important;
        border-color: rgba(109, 77, 246, 0.4) !important;
      }
      
      .item img.kek {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        display: block !important;
        transition: transform 0.2s ease;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      
      .item:hover img.kek {
        transform: scale(1.05) !important;
      }
      
      .arrow {
        position: absolute !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        font-size: 24px !important;
        color: #fff !important;
        background: rgba(109, 77, 246, 0.8) !important;
        width: 40px !important;
        height: 40px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        z-index: 10 !important;
        transition: all 0.2s ease;
        user-select: none;
        border: none !important;
        line-height: 1 !important;
      }
      
      .arrow:hover {
        background: rgba(109, 77, 246, 1) !important;
        transform: translateY(-50%) scale(1.1) !important;
      }
      
      .arrleft {
        left: 10px !important;
      }
      
      .arrright {
        right: 10px !important;
      }
      
      @media (max-width: 768px) {
        .item {
          flex: 0 0 120px !important;
          height: 70px !important;
        }
        .slider.btfw-channels {
          height: 100px;
        }
        .arrow {
          width: 35px !important;
          height: 35px !important;
          font-size: 20px !important;
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

    const videowrap = document.getElementById('videowrap');
    const leftpad = document.getElementById('btfw-leftpad');

    let inserted = false;

    if (videowrap && leftpad && leftpad.contains(videowrap)) {
      if (videowrap.nextElementSibling) {
        leftpad.insertBefore(slider, videowrap.nextElementSibling);
      } else {
        leftpad.appendChild(slider);
      }
      inserted = true;
    } else if (leftpad) {
      if (leftpad.firstElementChild) {
        leftpad.insertBefore(slider, leftpad.firstElementChild);
      } else {
        leftpad.appendChild(slider);
      }
      inserted = true;
    }

    if (!inserted) {
      document.body.appendChild(slider);
    }

    setTimeout(() => setupCarouselControls(slider, channels), 200);
  }

  async function initializeChannels() {
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