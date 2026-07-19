BTFW.define("feature:playlistPerformance", [], function() {
  const $ = s => document.querySelector(s);
  
  let isOptimized = false;
  let originalDisplay = new Map();
  let originalContentVisibility = new Map();
  let originalContainIntrinsicSize = new Map();
  let currentVisibleCount = Infinity;
  let scrollHandler = null;
  let usesNativeVirtualization = false;

  const INITIAL_BATCH = 120;
  const BATCH_SIZE = 80;
  const SCROLL_THRESHOLD = 300;
  const SUPPORTS_CONTENT_VISIBILITY = !!(
    window.CSS
    && typeof window.CSS.supports === 'function'
    && window.CSS.supports('content-visibility', 'auto')
  );

  function getQueue() {
    return $('#queue');
  }

  function getPlaylistItems() {
    const queue = getQueue();
    if (!queue) return [];

    return Array.from(queue.children).filter(item => item.id !== 'btfw-playlist-performance-indicator');
  }

  function ensurePollButtonForItem(item) {
    if (!item) return;

    const group = item.querySelector('.btn-group');
    if (!group || group.querySelector('.btfw-qbtn-pollcopy')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-xs btn-default qbtn-pollcopy btfw-qbtn-pollcopy';
    btn.title = 'Add this title to the poll';
    btn.textContent = 'Poll';

    const queueNext = group.querySelector('.qbtn-next');
    if (queueNext && queueNext.nextSibling) {
      group.insertBefore(btn, queueNext.nextSibling);
    } else {
      group.appendChild(btn);
    }
  }

  function ensurePollButtonsForVisibleItems(children) {
    const items = Array.isArray(children) ? children : getPlaylistItems();
    if (!items.length) return;

    const limit = Number.isFinite(currentVisibleCount)
      ? Math.min(items.length, currentVisibleCount)
      : items.length;

    for (let index = 0; index < limit; index += 1) {
      const item = items[index];
      if (!item || item.style.display === 'none' || item.hidden) continue;

      ensurePollButtonForItem(item);
    }
  }

  function applyVisibility(children) {
    children.forEach((item, index) => {
      if (!originalDisplay.has(item)) {
        originalDisplay.set(item, item.style.display || '');
      }

      if (index < currentVisibleCount) {
        const display = originalDisplay.get(item);
        item.style.display = display === undefined ? '' : display;
      } else {
        item.style.display = 'none';
      }
    });

    ensurePollButtonsForVisibleItems(children);
  }

  function applyNativeVirtualization(children) {
    const measurableItem = children.find(item => item.style.display !== 'none' && !item.hidden);
    const measuredHeight = measurableItem?.getBoundingClientRect().height;
    const intrinsicHeight = Number.isFinite(measuredHeight) && measuredHeight > 0
      ? Math.ceil(measuredHeight)
      : 81;

    children.forEach(item => {
      if (!originalContentVisibility.has(item)) {
        originalContentVisibility.set(item, item.style.contentVisibility || '');
        originalContainIntrinsicSize.set(item, item.style.containIntrinsicSize || '');
      }

      item.style.contentVisibility = 'auto';
      item.style.containIntrinsicSize = `auto ${intrinsicHeight}px`;
    });

    // Keep startup work bounded. Controls for other rows are added when a row
    // becomes relevant instead of eagerly decorating the entire queue.
    ensurePollButtonsForVisibleItems(children);
  }

  function detachScrollWatcher(queue) {
    if (queue && scrollHandler) {
      queue.removeEventListener('scroll', scrollHandler);
    }
    scrollHandler = null;
  }

  function updatePerformanceIndicator(totalCount) {
    const indicator = $('#btfw-playlist-performance-indicator');
    if (!indicator) return;

    indicator.dataset.totalCount = totalCount;

    const status = indicator.querySelector('.btfw-perf-status');
    if (!status) return;

    const hiddenCount = Math.max(totalCount - Math.min(currentVisibleCount, totalCount), 0);
    const shownCount = totalCount - hiddenCount;
    const controls = indicator.querySelector('.btfw-perf-controls');

    if (usesNativeVirtualization) {
      status.textContent = `${totalCount} items · offscreen details render on demand`;
      if (controls) controls.style.display = 'none';
      return;
    }

    if (controls) controls.style.display = 'flex';
    if (hiddenCount > 0) {
      status.textContent = `Showing ${shownCount} of ${totalCount} items (${hiddenCount} hidden for performance)`;
    } else {
      status.textContent = `Showing all ${totalCount} items`;
    }

    const showMoreBtn = indicator.querySelector('#btfw-show-more-items');
    if (showMoreBtn) {
      showMoreBtn.disabled = hiddenCount === 0;
      showMoreBtn.style.opacity = hiddenCount === 0 ? '0.5' : '1';
    }

    const showAllBtn = indicator.querySelector('#btfw-show-all-items');
    if (showAllBtn) {
      showAllBtn.disabled = hiddenCount === 0;
      showAllBtn.style.opacity = hiddenCount === 0 ? '0.5' : '1';
    }
  }

  function optimizePlaylist() {
    const queue = getQueue();
    if (!queue) return;

    const children = getPlaylistItems();
    if (!children.length) return;

    const hadOptimization = isOptimized;

    if (!hadOptimization || !Number.isFinite(currentVisibleCount)) {
      currentVisibleCount = INITIAL_BATCH;
    }

    currentVisibleCount = Math.min(children.length, Math.max(currentVisibleCount, INITIAL_BATCH));
    usesNativeVirtualization = SUPPORTS_CONTENT_VISIBILITY;

    if (usesNativeVirtualization) {
      applyNativeVirtualization(children);
    } else {
      applyVisibility(children);
    }

    isOptimized = true;

    // Add indicator
    addPerformanceIndicator(children.length);
    updatePerformanceIndicator(children.length);

    // Older browsers fall back to progressive batches. Chromium can keep the
    // complete layout while skipping paint/layout work inside offscreen rows.
    detachScrollWatcher(queue);
    if (!usesNativeVirtualization) {
      scrollHandler = () => {
        if (!isOptimized) return;

        if (queue.scrollTop + queue.clientHeight >= queue.scrollHeight - SCROLL_THRESHOLD) {
          revealNextBatch();
        }
      };

      queue.addEventListener('scroll', scrollHandler, { passive: true });
    }
  }

  function restorePlaylist() {
    const queue = getQueue();
    const children = getPlaylistItems();

    children.forEach(item => {
      const display = originalDisplay.get(item);
      const contentVisibility = originalContentVisibility.get(item);
      const intrinsicSize = originalContainIntrinsicSize.get(item);
      item.style.display = display === undefined ? item.style.display : display;
      item.style.contentVisibility = contentVisibility === undefined ? '' : contentVisibility;
      item.style.containIntrinsicSize = intrinsicSize === undefined ? '' : intrinsicSize;
    });
    originalDisplay.clear();
    originalContentVisibility.clear();
    originalContainIntrinsicSize.clear();
    currentVisibleCount = Infinity;
    usesNativeVirtualization = false;
    ensurePollButtonsForVisibleItems(children);
    isOptimized = false;

    if (queue) {
      detachScrollWatcher(queue);
    }

    removePerformanceIndicator();
  }

  function addPerformanceIndicator(totalCount) {
    removePerformanceIndicator(); // Remove existing if any

    const queue = getQueue();
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
      <small class="btfw-perf-status"></small><br>
      <div class="btfw-perf-controls" style="margin-top: 5px; display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
        <button id="btfw-show-more-items" class="btn btn-xs btn-default">Show More</button>
        <button id="btfw-show-all-items" class="btn btn-xs btn-default">Show All (May Lag)</button>
      </div>
    `;

    queue.appendChild(indicator);
    
    // Add show all button handler
    const showMoreBtn = indicator.querySelector('#btfw-show-more-items');
    if (showMoreBtn) {
      showMoreBtn.addEventListener('click', () => {
        revealNextBatch();
      });
    }

    const showAllBtn = indicator.querySelector('#btfw-show-all-items');
    if (showAllBtn) {
      showAllBtn.addEventListener('click', () => {
        restorePlaylist();
      });
    }

    updatePerformanceIndicator(totalCount);
  }

  function removePerformanceIndicator() {
    const indicator = $('#btfw-playlist-performance-indicator');
    if (indicator) indicator.remove();
  }

  function revealNextBatch() {
    const queue = getQueue();
    const children = getPlaylistItems();
    if (!queue || !children.length) return;

    const previousVisible = currentVisibleCount;
    currentVisibleCount = Math.min(children.length, currentVisibleCount + BATCH_SIZE);

    if (currentVisibleCount === previousVisible) return;

    applyVisibility(children);
    updatePerformanceIndicator(children.length);
  }

  function ensureItemVisible(item, buffer = 25) {
    if (!item) return false;

    const children = getPlaylistItems();
    const itemIndex = children.indexOf(item);
    if (itemIndex < 0) return false;

    if (isOptimized && !usesNativeVirtualization) {
      const safeBuffer = Math.max(0, Number(buffer) || 0);
      currentVisibleCount = Math.min(
        children.length,
        Math.max(currentVisibleCount, itemIndex + safeBuffer + 1)
      );
      applyVisibility(children);
      updatePerformanceIndicator(children.length);
    }

    ensurePollButtonForItem(item);
    return true;
  }

  function scrollItemIntoQueueView(queue, item) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const itemRect = item.getBoundingClientRect();
        const queueRect = queue.getBoundingClientRect();
        if (!itemRect.height || !queueRect.height) return;

        const targetTop = queue.scrollTop
          + (itemRect.top - queueRect.top)
          - ((queueRect.height - itemRect.height) * 0.35);

        queue.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      });
    });
  }

  // Reveal a lazy-hidden current item before trying to scroll to it.
  function scrollToCurrentOptimized() {
    const queue = getQueue();
    if (!queue) return false;

    const active = queue.querySelector('.queue_active');
    if (!active || !ensureItemVisible(active)) return false;

    scrollItemIntoQueueView(queue, active);
    return true;
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
      } else {
        optimizePlaylist();
        btn.classList.add('btn-success');
        btn.innerHTML = '<i class="fa fa-rocket"></i> Performance ON';
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
  

  // Auto-enable for large playlists
  function checkAutoEnable() {
    const queue = getQueue();
    if (!queue) return;

    const itemCount = getPlaylistItems().length;

    // Auto-enable if more than 100 items
    if (itemCount > 100 && !isOptimized) {
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
    const queue = getQueue();
    if (!queue || queue._perfWatched) return;

    queue._perfWatched = true;

    const observer = new MutationObserver((mutations) => {
      const hasRelevantChange = mutations.some(mutation => {
        const added = Array.from(mutation.addedNodes || []);
        const removed = Array.from(mutation.removedNodes || []);

        const touchesQueueEntry = node => {
          if (!(node instanceof HTMLElement)) return false;
          if (node.id === 'btfw-playlist-performance-indicator') return false;
          return node.classList.contains('queue_entry') || !!node.querySelector?.('.queue_entry');
        };

        return added.some(touchesQueueEntry) || removed.some(touchesQueueEntry);
      });

      if (!hasRelevantChange) {
        return;
      }

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
    watchPlaylist();
    checkAutoEnable();
    
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
    isOptimized: () => isOptimized,
    usesNativeVirtualization: () => usesNativeVirtualization,
    ensureItemVisible,
    scrollToCurrent: scrollToCurrentOptimized
  };
  
  return {
    name: 'feature:playlistPerformance'
  };
});
