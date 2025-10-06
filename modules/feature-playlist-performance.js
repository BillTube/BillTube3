/* SIMPLE PLAYLIST PERFORMANCE FIX
 * Hides playlist items beyond visible area to improve performance
 * This is a quick fix until virtual scrolling is implemented
 * 
 * Add to: modules/feature-playlist-performance.js
 */

BTFW.define("feature:playlistPerformance", ["core"], function() {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  
  let isOptimized = false;
  let originalDisplay = new Map();
  
  function optimizePlaylist() {
    const queue = $('#queue');
    if (!queue) return;
    
    const children = Array.from(queue.children);
    const VISIBLE_LIMIT = 50; // Show first 50 items
    
    console.log(`[PlaylistPerformance] Optimizing ${children.length} items...`);
    
    children.forEach((item, index) => {
      if (index >= VISIBLE_LIMIT) {
        // Store original display value
        if (!originalDisplay.has(item)) {
          originalDisplay.set(item, item.style.display || '');
        }
        item.style.display = 'none';
      }
    });
    
    isOptimized = true;
    
    // Add indicator
    addPerformanceIndicator(children.length - VISIBLE_LIMIT);
  }
  
  function restorePlaylist() {
    originalDisplay.forEach((display, item) => {
      item.style.display = display;
    });
    originalDisplay.clear();
    isOptimized = false;
    
    removePerformanceIndicator();
  }
  
  function addPerformanceIndicator(hiddenCount) {
    removePerformanceIndicator(); // Remove existing if any
    
    const queue = $('#queue');
    if (!queue) return;
    
    const indicator = document.createElement('div');
    indicator.id = 'btfw-playlist-performance-indicator';
    indicator.className = 'playlist-performance-indicator';
    indicator.style.cssText = `
      padding: 10px;
      margin: 10px 0;
      background: rgba(0, 150, 0, 0.1);
      border: 1px solid rgba(0, 150, 0, 0.3);
      border-radius: 4px;
      text-align: center;
      color: #0f0;
      font-size: 12px;
    `;
    indicator.innerHTML = `
      <i class="fa fa-rocket"></i> Performance Mode Active<br>
      <small>${hiddenCount} items hidden for better performance</small><br>
      <button id="btfw-show-all-items" class="btn btn-xs btn-default" style="margin-top: 5px;">
        Show All Items (May Cause Lag)
      </button>
    `;
    
    queue.appendChild(indicator);
    
    // Add show all button handler
    const showAllBtn = indicator.querySelector('#btfw-show-all-items');
    if (showAllBtn) {
      showAllBtn.addEventListener('click', () => {
        restorePlaylist();
        console.log('[PlaylistPerformance] All items restored');
      });
    }
  }
  
  function removePerformanceIndicator() {
    const indicator = $('#btfw-playlist-performance-indicator');
    if (indicator) indicator.remove();
  }
  
  // Auto-optimize when scrolling to current item
  function scrollToCurrentOptimized() {
    const queue = $('#queue');
    if (!queue) return;
    
    const active = queue.querySelector('.queue_active');
    if (!active) return;
    
    const children = Array.from(queue.children);
    const activeIndex = children.indexOf(active);
    
    if (activeIndex > -1) {
      // Show items around active item
      const BUFFER = 25; // Show 25 items before and after
      
      children.forEach((item, index) => {
        if (index >= activeIndex - BUFFER && index <= activeIndex + BUFFER) {
          item.style.display = originalDisplay.get(item) || '';
        } else if (isOptimized) {
          item.style.display = 'none';
        }
      });
      
      // Scroll to active
      active.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  // Add toggle button to playlist toolbar
  function addToggleButton() {
    const toolbar = $('.btfw-pl-toolbar');
    if (!toolbar || toolbar.querySelector('#btfw-perf-toggle')) return;
    
    const btn = document.createElement('button');
    btn.id = 'btfw-perf-toggle';
    btn.className = 'btn btn-xs btn-default';
    btn.innerHTML = '<i class="fa fa-rocket"></i> Performance';
    btn.title = 'Toggle performance mode for smooth scrolling';
    btn.style.marginLeft = '5px';
    
    btn.addEventListener('click', () => {
      if (isOptimized) {
        restorePlaylist();
        btn.classList.remove('btn-success');
        btn.innerHTML = '<i class="fa fa-rocket"></i> Performance';
        console.log('[PlaylistPerformance] Disabled');
      } else {
        optimizePlaylist();
        btn.classList.add('btn-success');
        btn.innerHTML = '<i class="fa fa-rocket"></i> Performance ON';
        console.log('[PlaylistPerformance] Enabled');
      }
    });
    
    toolbar.appendChild(btn);
  }
  
  // Also add to playlist header if in stack
  function addStackToggle() {
    const playlistModule = $('.btfw-stack-item[data-bind="playlist-group"]');
    if (!playlistModule) return;
    
    const header = playlistModule.querySelector('.btfw-stack-item__header');
    if (!header || header.querySelector('#btfw-stack-perf-toggle')) return;
    
    const btn = document.createElement('button');
    btn.id = 'btfw-stack-perf-toggle';
    btn.className = 'btfw-stack-perf-btn';
    btn.innerHTML = '⚡';
    btn.title = 'Performance mode - hide excess items';
    btn.style.cssText = `
      background: rgba(0, 150, 0, 0.2);
      border: 1px solid rgba(0, 150, 0, 0.4);
      color: #0f0;
      padding: 2px 8px;
      margin: 0 5px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 14px;
    `;
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      if (isOptimized) {
        restorePlaylist();
        btn.style.background = 'rgba(0, 150, 0, 0.2)';
        btn.innerHTML = '⚡';
      } else {
        optimizePlaylist();
        btn.style.background = 'rgba(0, 150, 0, 0.5)';
        btn.innerHTML = '⚡ ON';
      }
    });
    
    // Insert before arrows
    const arrows = header.querySelector('.btfw-stack-arrows');
    if (arrows) {
      header.insertBefore(btn, arrows);
    } else {
      header.appendChild(btn);
    }
  }
  
  // Hook into scroll to current functionality
  function enhanceScrollButton() {
    const scrollBtn = $('#btfw-pl-scroll');
    if (scrollBtn && !scrollBtn._perfEnhanced) {
      scrollBtn._perfEnhanced = true;
      
      scrollBtn.addEventListener('click', (e) => {
        if (isOptimized) {
          e.preventDefault();
          e.stopPropagation();
          scrollToCurrentOptimized();
        }
      });
    }
  }
  
  // Auto-enable for large playlists
  function checkAutoEnable() {
    const queue = $('#queue');
    if (!queue) return;
    
    const itemCount = queue.children.length;
    
    // Auto-enable if more than 100 items
    if (itemCount > 100 && !isOptimized) {
      console.log(`[PlaylistPerformance] Auto-enabling for ${itemCount} items`);
      optimizePlaylist();
      
      // Update button state if it exists
      const btn = $('#btfw-perf-toggle');
      if (btn) {
        btn.classList.add('btn-success');
        btn.innerHTML = '<i class="fa fa-rocket"></i> Performance ON';
      }
    }
  }
  
  // Monitor for playlist changes
  function watchPlaylist() {
    const queue = $('#queue');
    if (!queue || queue._perfWatched) return;
    
    queue._perfWatched = true;
    
    const observer = new MutationObserver(() => {
      if (isOptimized) {
        // Re-apply optimization after playlist change
        setTimeout(() => {
          optimizePlaylist();
        }, 100);
      }
      
      // Check if we should auto-enable
      checkAutoEnable();
    });
    
    observer.observe(queue, {
      childList: true,
      subtree: false
    });
  }
  
  // Initialize
  function boot() {
    addToggleButton();
    addStackToggle();
    enhanceScrollButton();
    watchPlaylist();
    checkAutoEnable();
    
    console.log('[PlaylistPerformance] Module loaded');
  }
  
  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  
  document.addEventListener('btfw:layoutReady', boot);
  
  // Public API
  window.BTFW_PlaylistPerformance = {
    optimize: optimizePlaylist,
    restore: restorePlaylist,
    toggle: () => isOptimized ? restorePlaylist() : optimizePlaylist(),
    isOptimized: () => isOptimized
  };
  
  return {
    name: 'feature:playlistPerformance'
  };
});
