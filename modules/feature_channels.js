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
        <h3>Other Channels</h3>
      </div>
      <div class="btfw-channels-scroll">
        <div class="btfw-channels-grid" id="btfw-channels-grid">
        </div>
      </div>
    `;
    
    const grid = carousel.querySelector('#btfw-channels-grid');
    
    channels.forEach(channel => {
      const card = document.createElement('a');
      card.href = channel.channel_url;
      card.target = '_blank';
      card.className = 'btfw-channel-card';
      card.title = channel.title;
      
      card.innerHTML = `
        <div class="btfw-channel-image">
          <img src="${channel.image_url}" alt="${channel.title}" loading="lazy" />
        </div>
        <div class="btfw-channel-info">
          <span class="btfw-channel-title">${channel.title}</span>
        </div>
      `;
      
      // Add hover effects
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
      });
      
      grid.appendChild(card);
    });
    
    return carousel;
  }
  
  function injectChannelCSS() {
    if (document.getElementById('btfw-channels-css')) return;
    
    const style = document.createElement('style');
    style.id = 'btfw-channels-css';
    style.textContent = `
      .btfw-channels {
        margin: 0 0 10px 0;
      }
      
      .btfw-channels-header {
        padding: 8px 12px;
        background: linear-gradient(135deg, #6d4df6 0%, #8b5cf6 100%);
        border-radius: 12px 12px 0 0;
        border: 1px solid rgba(109, 77, 246, 0.3);
        border-bottom: none;
      }
      
      .btfw-channels-header h3 {
        margin: 0;
        color: #fff;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 0.3px;
      }
      
      .btfw-channels-scroll {
        background: rgba(20, 24, 34, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 0 0 12px 12px;
        padding: 12px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      
      .btfw-channels-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        min-width: max-content;
      }
      
      @media (max-width: 768px) {
        .btfw-channels-scroll {
          padding: 8px;
        }
        .btfw-channels-grid {
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 8px;
        }
      }
      
      .btfw-channel-card {
        display: flex;
        flex-direction: column;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        overflow: hidden;
        text-decoration: none;
        color: inherit;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        min-width: 140px;
      }
      
      .btfw-channel-card:hover {
        border-color: rgba(109, 77, 246, 0.4);
        box-shadow: 0 8px 24px rgba(109, 77, 246, 0.15);
        color: inherit;
        text-decoration: none;
        transform: translateY(-2px);
      }
      
      .btfw-channel-image {
        position: relative;
        width: 100%;
        height: 80px;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.2);
      }
      
      .btfw-channel-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.2s ease;
      }
      
      .btfw-channel-card:hover .btfw-channel-image img {
        transform: scale(1.05);
      }
      
      .btfw-channel-info {
        padding: 8px 10px;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
      }
      
      .btfw-channel-title {
        font-size: 12px;
        font-weight: 500;
        color: #e6edf3;
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      .btfw-channel-card:hover .btfw-channel-title {
        color: #fff;
      }
      
      /* Custom scrollbar for channel scroll */
      .btfw-channels-scroll::-webkit-scrollbar {
        height: 6px;
      }
      
      .btfw-channels-scroll::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
      }
      
      .btfw-channels-scroll::-webkit-scrollbar-thumb {
        background: rgba(109, 77, 246, 0.4);
        border-radius: 3px;
      }
      
      .btfw-channels-scroll::-webkit-scrollbar-thumb:hover {
        background: rgba(109, 77, 246, 0.6);
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