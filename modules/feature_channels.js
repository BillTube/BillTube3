/* BTFW – feature:channels (Channel Carousel from JSON) */
BTFW.define("feature:channels", [], async () => {
  const $ = (s, r=document) => r.querySelector(s);
  
  function isChannelListEnabled() {
    try {
      return window.UI_ChannelList === 1;
    } catch(_) {
      return false;
    }
  }
  
  function getChannelJSON() {
    try {
      return window.Channel_JSON || '';
    } catch(_) {
      return '';
    }
  }
  
  function createChannelCarousel(channels) {
    const carousel = document.createElement('div');
    carousel.id = 'btfw-channels';
    carousel.className = 'btfw-channels';
    carousel.setAttribute('data-title', 'Other Channels');
    
    carousel.innerHTML = `
      <div class="btfw-channels-header">
        <button class="btfw-channels-prev" aria-label="Previous">‹</button>
        <h3>Channels</h3>
        <button class="btfw-channels-next" aria-label="Next">›</button>
      </div>
      <div class="btfw-channels-viewport">
        <div class="btfw-channels-track" id="btfw-channels-track">
        </div>
      </div>
    `;
    
    const track = carousel.querySelector('#btfw-channels-track');
    
    channels.forEach(channel => {
      const card = document.createElement('a');
      card.href = channel.channel_url;
      card.target = '_blank';
      card.className = 'btfw-channel-card';
      card.title = channel.title;
      
      card.innerHTML = `
        <img src="${channel.image_url}" alt="${channel.title}" loading="lazy" />
      `;
      
      track.appendChild(card);
    });
    
    // Add carousel functionality
    const prevBtn = carousel.querySelector('.btfw-channels-prev');
    const nextBtn = carousel.querySelector('.btfw-channels-next');
    let currentIndex = 0;
    const cardsVisible = 5; // Show 5 cards at once
    const totalCards = channels.length;
    const maxIndex = Math.max(0, totalCards - cardsVisible);
    
    function updateCarousel() {
      const cardWidth = 140; // Match CSS width
      const gap = 12; // Match CSS gap
      const offset = currentIndex * (cardWidth + gap);
      track.style.transform = `translateX(-${offset}px)`;
      
      prevBtn.style.opacity = currentIndex > 0 ? '1' : '0.5';
      nextBtn.style.opacity = currentIndex < maxIndex ? '1' : '0.5';
    }
    
    prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentIndex > 0) {
        currentIndex--;
        updateCarousel();
      }
    });
    
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentIndex < maxIndex) {
        currentIndex++;
        updateCarousel();
      }
    });
    
    // Initialize carousel
    setTimeout(updateCarousel, 0);
    
    return carousel;
  }
  
  function injectChannelCSS() {
    if (document.getElementById('btfw-channels-css')) return;
    
    const style = document.createElement('style');
    style.id = 'btfw-channels-css';
    style.textContent = `
      .btfw-channels {
        margin: 0 0 10px 0;
        background: rgba(20, 24, 34, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        overflow: hidden;
      }
      
      .btfw-channels-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: linear-gradient(135deg, #6d4df6 0%, #8b5cf6 100%);
        border-bottom: 1px solid rgba(109, 77, 246, 0.3);
      }
      
      .btfw-channels-header h3 {
        margin: 0;
        color: #fff;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 0.3px;
        flex: 1;
        text-align: center;
      }
      
      .btfw-channels-prev,
      .btfw-channels-next {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .btfw-channels-prev:hover,
      .btfw-channels-next:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.05);
      }
      
      .btfw-channels-viewport {
        padding: 12px;
        overflow: hidden;
      }
      
      .btfw-channels-track {
        display: flex;
        gap: 12px;
        transition: transform 0.3s ease;
      }
      
      .btfw-channel-card {
        flex: 0 0 140px;
        height: 80px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        overflow: hidden;
        text-decoration: none;
        color: inherit;
        transition: all 0.2s ease;
        position: relative;
      }
      
      .btfw-channel-card:hover {
        border-color: rgba(109, 77, 246, 0.4);
        box-shadow: 0 4px 12px rgba(109, 77, 246, 0.15);
        color: inherit;
        text-decoration: none;
        transform: translateY(-2px);
      }
      
      .btfw-channel-card img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.2s ease;
      }
      
      .btfw-channel-card:hover img {
        transform: scale(1.05);
      }
      
      @media (max-width: 768px) {
        .btfw-channels-viewport {
          padding: 8px;
        }
        .btfw-channel-card {
          flex: 0 0 120px;
          height: 70px;
        }
        .btfw-channels-track {
          gap: 8px;
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
      
      if (data.ok && data.list && data.list.channels) {
        return data.list.channels;
      }
      
      return [];
    } catch (error) {
      console.warn('[channels] Failed to fetch channel data:', error);
      return [];
    }
  }
  
  function injectChannelCarousel(channels) {
    // Remove existing carousel
    const existing = document.getElementById('btfw-channels');
    if (existing) existing.remove();
    
    // Create new carousel
    const carousel = createChannelCarousel(channels);
    
    // Find the best place to inject it
    const stack = document.getElementById('btfw-stack');
    const videowrap = document.getElementById('videowrap');
    const leftpad = document.getElementById('btfw-leftpad');
    
    if (stack) {
      // Insert before the stack (at the very top)
      stack.parentElement.insertBefore(carousel, stack);
    } else if (videowrap) {
      // Insert after videowrap
      if (videowrap.nextSibling) {
        videowrap.parentElement.insertBefore(carousel, videowrap.nextSibling);
      } else {
        videowrap.parentElement.appendChild(carousel);
      }
    } else if (leftpad) {
      // Insert at top of leftpad
      leftpad.insertBefore(carousel, leftpad.firstChild);
    }
  }
  
  async function initializeChannels() {
    if (!isChannelListEnabled()) {
      console.log('[channels] UI_ChannelList not enabled');
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
    injectChannelCarousel(channels);
  }
  
  function boot() {
    // Try to initialize immediately
    initializeChannels();
    
    // Also try after layout is ready
    document.addEventListener('btfw:layoutReady', () => {
      setTimeout(initializeChannels, 100);
    });
    
    // And try again after a delay in case variables are set later
    setTimeout(initializeChannels, 1000);
    setTimeout(initializeChannels, 2000);
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