BTFW.define("feature:stack", ["feature:layout"], async ({}) => {
  const SKEY="btfw-stack-order";
  let compactSpacing = true;
  
  // Define what should be grouped together
  const GROUPS = [
    {
      id: "motd-group",
      title: "Message of the Day",
      selectors: ["#motdwrap", "#motdrow", "#motd", "#announcements"],
      priority: 1
    },
    {
      id: "playlist-group",
      title: "Playlist",
      selectors: ["#playlistrow", "#playlistwrap", "#queuecontainer", "#queue"],
      priority: 2
    },
    {
      id: "channels-group",
      title: "Featured Channels",
      selectors: ["#btfw-channels"],
      priority: 3
    },
    {
      id: "poll-group",
      title: "Polls & Voting",
      selectors: ["#pollwrap", "#btfw-poll-parking", "#btfw-poll-history"],
      priority: 4
    }
  ];
  
  // Skip these - they're either empty or handled elsewhere
  const SKIP_SELECTORS = ["#main", "#mainpage", "#mainpane"];

  const ADD_MEDIA_SECTIONS = [
    { id: "addfromurl", title: "From URL", default: true },
    { id: "searchcontrol", title: "Library & YouTube" },
    { id: "customembed", title: "Custom embed" }
  ];

  function ensureAddMediaUI(mainContainer, controlsBar, actionsCluster) {
    if (!mainContainer || !controlsBar || !actionsCluster) return null;

    const available = ADD_MEDIA_SECTIONS.map(cfg => {
      const el = document.getElementById(cfg.id);
      if (!el) return null;
      return { ...cfg, el };
    }).filter(Boolean);

    if (!available.length) {
      const existingPanel = document.getElementById("btfw-addmedia-panel");
      if (existingPanel) existingPanel.remove();
      return null;
    }

    let panel = document.getElementById("btfw-addmedia-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "btfw-addmedia-panel";
      panel.className = "btfw-addmedia-panel";
      panel.dataset.open = "false";
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-label", "Add media controls");
      panel.setAttribute("aria-hidden", "true");
      panel.setAttribute("hidden", "hidden");
      panel.innerHTML = `
        <div class="btfw-addmedia-panel__inner">
          <header class="btfw-addmedia-panel__header">
            <nav class="btfw-addmedia-tabs" role="tablist"></nav>
            <button type="button" class="btfw-addmedia-close" aria-label="Close add media">
              <span aria-hidden="true">&times;</span>
            </button>
          </header>
          <div class="btfw-addmedia-panel__body">
            <div class="btfw-addmedia-views"></div>
            <p class="btfw-addmedia-help">Queue media by URL, browse your library, or embed custom players without leaving the playlist.</p>
          </div>
        </div>
      `;
    }

    if (panel.parentElement !== mainContainer) {
      const anchor = controlsBar.parentElement === mainContainer ?
        controlsBar.nextSibling : null;
      mainContainer.insertBefore(panel, anchor);
    }

    const tabs = panel.querySelector(".btfw-addmedia-tabs");
    const viewsHost = panel.querySelector(".btfw-addmedia-views");
    const closeBtn = panel.querySelector(".btfw-addmedia-close");

    if (!tabs || !viewsHost) return null;

    while (tabs.firstChild) tabs.removeChild(tabs.firstChild);
    while (viewsHost.firstChild) viewsHost.removeChild(viewsHost.firstChild);

    available.forEach(({ id, title, el }) => {
      el.classList.remove("collapse", "in", "plcontrol-collapse");
      el.style.removeProperty("display");
      el.style.removeProperty("height");
      el.removeAttribute("aria-expanded");
      el.setAttribute("role", "tabpanel");
      el.setAttribute("data-btfw-addmedia", "panel");

      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "btfw-addmedia-tab";
      tab.dataset.target = id;
      tab.textContent = title;
      tab.setAttribute("role", "tab");
      tabs.appendChild(tab);

      const view = document.createElement("div");
      view.className = "btfw-addmedia-view";
      view.dataset.target = id;
      view.setAttribute("role", "tabpanel");
      view.setAttribute("aria-hidden", "true");
      view.appendChild(el);
      viewsHost.appendChild(view);
    });

    const defaultSection = available.find(sec => sec.default) || available[0];

    const setActive = (targetId) => {
      const activeId = targetId || panel.dataset.active || defaultSection.id;
      panel.dataset.active = activeId;
      tabs.querySelectorAll(".btfw-addmedia-tab").forEach(tab => {
        const match = tab.dataset.target === activeId;
        tab.classList.toggle("is-active", match);
        tab.setAttribute("aria-selected", match ? "true" : "false");
        tab.setAttribute("tabindex", match ? "0" : "-1");
      });
      viewsHost.querySelectorAll(".btfw-addmedia-view").forEach(view => {
        const match = view.dataset.target === activeId;
        view.classList.toggle("is-active", match);
        view.setAttribute("aria-hidden", match ? "false" : "true");
      });
    };

    const toggle = (force) => {
      const open = force != null ? !!force : panel.dataset.open !== "true";
      panel.dataset.open = open ? "true" : "false";
      panel.classList.toggle("is-open", open);
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      if (open) {
        panel.removeAttribute("hidden");
        setActive(panel.dataset.active || defaultSection.id);
      } else {
        panel.setAttribute("hidden", "hidden");
      }
      panel.dispatchEvent(new CustomEvent("btfw:addmedia:state", { detail: { open } }));
      return open;
    };

    if (!panel._btfwWired) {
      tabs.addEventListener("click", (ev) => {
        const btn = ev.target.closest(".btfw-addmedia-tab");
        if (!btn) return;
        ev.preventDefault();
        setActive(btn.dataset.target);
      });
      if (closeBtn) {
        closeBtn.addEventListener("click", () => toggle(false));
      }
      panel._btfwWired = true;
    }

    setActive(panel.dataset.active || defaultSection.id);

    panel._btfwToggle = toggle;
    panel._btfwSetActive = setActive;

    const wireLegacyTriggers = () => {
      const triggers = [
        { id: "showsearch", target: "searchcontrol" },
        { id: "showcustomembed", target: "customembed" }
      ];

      triggers.forEach(({ id, target }) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (btn.dataset.btfwAddmedia === target) return;

        btn.dataset.btfwAddmedia = target;
        btn.setAttribute("aria-controls", "btfw-addmedia-panel");
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setActive(target);
          toggle(true);
          btn.blur();
        });
      });
    };

    wireLegacyTriggers();

    return { panel, toggle, setActive };
  }

  
  function applyCompactSpacing(enabled){
    const stack = document.getElementById("btfw-stack");
    if (!stack) return;
    const want = !!enabled;
    stack.classList.toggle("btfw-stack--compact", want);
    stack.querySelectorAll(".btfw-stack-list").forEach(list => {
      list.classList.toggle("btfw-stack-list--compact", want);
    });
  }

  function ensureStack(){
    const left=document.getElementById("btfw-leftpad");
    if(!left) return null;
    let stack=document.getElementById("btfw-stack");
    if(!stack){
      stack=document.createElement("div");
      stack.id="btfw-stack";
      stack.className="btfw-stack";
      const v=document.getElementById("videowrap");
      if(v&&v.nextSibling) v.parentNode.insertBefore(stack, v.nextSibling);
      else left.appendChild(stack);

      // Just create the list - no header with "Page Modules"
      const list=document.createElement("div");
      list.className="btfw-stack-list";
      stack.appendChild(list);
      const footer=document.createElement("div");
      footer.id="btfw-stack-footer";
      footer.className="btfw-stack-footer";
      stack.appendChild(footer);
    }
    applyCompactSpacing(compactSpacing);
    return {
      list:stack.querySelector(".btfw-stack-list"),
      footer:stack.querySelector("#btfw-stack-footer")
    };
  }
  
  function normalizeId(el){ 
    if(!el) return null; 
    if(!el.id) el.id="stackitem-"+Math.random().toString(36).slice(2,7); 
    return el.id; 
  }
  
  function titleOf(el){ 
    return el.getAttribute("data-title")||el.getAttribute("title")||el.id; 
  }
  
  function mergeMotdElements() {
    const motdwrap = document.getElementById("motdwrap");
    const motdrow = document.getElementById("motdrow");
    const motd = document.getElementById("motd");
    
    if (!motdwrap && !motdrow) return;
    
    // Use motdwrap as the main container, or create it
    let container = motdwrap;
    if (!container && motdrow) {
      container = motdrow;
      container.id = "motdwrap";
    }
    
    // Merge motd content into container (avoid circular reference)
    if (motd && container && !container.contains(motd) && !motd.contains(container)) {
      // Move motd's content directly into container
      while (motd.firstChild) {
        container.appendChild(motd.firstChild);
      }
      motd.remove();
    }
    
    // Remove duplicate motdrow if we're using motdwrap (avoid circular reference)
    if (motdwrap && motdrow && motdrow !== motdwrap && !motdwrap.contains(motdrow) && !motdrow.contains(motdwrap)) {
      while (motdrow.firstChild) {
        motdwrap.appendChild(motdrow.firstChild);
      }
      motdrow.remove();
    }
  }
  
  function mergePlaylistControls() {
    const controlsRow = document.getElementById("controlsrow");
    const rightControls = document.getElementById("rightcontrols");
    const plBar = document.getElementById("btfw-plbar");
    const playlistWrap = document.getElementById("playlistwrap");
    const queueContainer = document.getElementById("queuecontainer");
    const playlistRow = document.getElementById("playlistrow");
    const stackPlaylist = document.querySelector('#btfw-stack .btfw-stack-item[data-bind="playlist-group"] .btfw-stack-item__body');

    // Find any floating controls row (legacy CyTube layout)
    const controlsRows = document.querySelectorAll(".btfw-controls-row");

    // Find the main playlist container
    let mainContainer = playlistRow || playlistWrap || queueContainer || stackPlaylist;
    if (!mainContainer) return;

    // Create or enhance the playlist bar
    let controlsBar = plBar;
    if (!controlsBar) {
      controlsBar = document.createElement("div");
      controlsBar.id = "btfw-plbar";
      controlsBar.className = "btfw-plbar";
    } else {
      controlsBar.classList.add("btfw-plbar");
    }

    // Build a modern layout scaffold once
    let layout = controlsBar.querySelector(".btfw-plbar__layout");
    let primary; // search + playlist tools
    let aside;   // playlist actions from rightcontrols
    if (!layout) {
      layout = document.createElement("div");
      layout.className = "btfw-plbar__layout";

      primary = document.createElement("div");
      primary.className = "btfw-plbar__primary";

      aside = document.createElement("div");
      aside.className = "btfw-plbar__aside";

      layout.append(primary, aside);

      while (controlsBar.firstChild) {
        primary.appendChild(controlsBar.firstChild);
      }
      controlsBar.appendChild(layout);

      const searchBlock = primary.querySelector(".field.has-addons");
      if (searchBlock) searchBlock.classList.add("btfw-plbar__search");

      const countBadge = primary.querySelector("#btfw-pl-count");
      if (countBadge) {
        countBadge.classList.add("btfw-plbar__count");
        aside.appendChild(countBadge);
      }
    } else {
      primary = layout.querySelector(".btfw-plbar__primary") || layout;
      aside = layout.querySelector(".btfw-plbar__aside") || layout;
    }

    // Drop legacy controls that conflict with the modern bar
    controlsBar.querySelectorAll("#showmediaurl, #btfw-pl-poll").forEach(btn => btn.remove());

    // Ensure we have an actions cluster for playlist controls
    let actionsCluster = controlsBar.querySelector(".btfw-plbar__actions");
    if (!actionsCluster) {
      actionsCluster = document.createElement("div");
      actionsCluster.className = "btfw-plbar__actions";
      (aside || controlsBar).appendChild(actionsCluster);
    }

    let addMediaBtn = document.getElementById("btfw-addmedia-btn");

    const styleActionButton = (btn) => {
      if (!btn) return;
      btn.classList.add("btfw-plbar__action-btn");
      if (btn.tagName === "BUTTON" || btn.tagName === "A") {
        btn.classList.add("button", "is-dark", "is-small");
      } else if (btn.tagName === "INPUT") {
        const type = (btn.type || "").toLowerCase();
        if (type === "button" || type === "submit" || type === "reset") {
          btn.classList.add("button", "is-dark", "is-small");
        } else {
          btn.classList.remove("button", "is-dark", "is-small");
        }
      }
    };

    if (controlsBar.parentElement !== mainContainer) {
      mainContainer.insertBefore(controlsBar, mainContainer.firstChild);
    }

    const addMedia = ensureAddMediaUI(mainContainer, controlsBar, actionsCluster);
    if (addMedia) {
      if (!addMediaBtn || !document.body.contains(addMediaBtn)) {
        addMediaBtn = document.createElement("button");
        addMediaBtn.id = "btfw-addmedia-btn";
        addMediaBtn.type = "button";
        addMediaBtn.className = "button is-small";
        addMediaBtn.innerHTML = `<i class="fa fa-plus"></i><span>Add media</span>`;
        actionsCluster.prepend(addMediaBtn);
      } else if (!actionsCluster.contains(addMediaBtn)) {
        actionsCluster.prepend(addMediaBtn);
      }
    } else if (addMediaBtn) {
      if (addMediaBtn.parentElement) addMediaBtn.parentElement.removeChild(addMediaBtn);
      addMediaBtn = null;
    }

    const moveControls = (root) => {
      if (!root) return;
      const elements = Array.from(root.children || []);
      elements.forEach(el => {
        if (!el) return;
        el.classList.add("btfw-plbar__control");
        actionsCluster.appendChild(el);
      });
    };

    // Move rightcontrols buttons into the enhanced bar
    if (rightControls) {
      moveControls(rightControls);
      rightControls.remove();
    }

    // Move any remaining legacy controls into the bar
    if (controlsRow) {
      moveControls(controlsRow);
      controlsRow.remove();
    }

    actionsCluster.querySelectorAll("button, a.btn, input[type=button], input[type=submit], input[type=reset], select").forEach(styleActionButton);

    if (addMedia && addMediaBtn) {
      addMediaBtn.classList.remove("is-dark");
      addMediaBtn.classList.add("is-primary");
      if (!addMediaBtn.dataset.iconified) {
        addMediaBtn.innerHTML = `<i class="fa fa-plus"></i><span>Add media</span>`;
        addMediaBtn.dataset.iconified = "1";
      }
      addMediaBtn.setAttribute("aria-controls", "btfw-addmedia-panel");

      const syncState = (open) => {
        addMediaBtn.setAttribute("aria-expanded", open ? "true" : "false");
      };

      if (!addMediaBtn.dataset.btfwBound) {
        addMediaBtn.dataset.btfwBound = "1";
        addMediaBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          const panel = document.getElementById("btfw-addmedia-panel");
          const toggleFn = panel && panel._btfwToggle;
          const open = typeof toggleFn === "function" ? toggleFn() : false;
          syncState(open);
        });
      }

      const panel = addMedia.panel || document.getElementById("btfw-addmedia-panel");
      if (panel) {
        syncState(panel.dataset.open === "true");
        if (!panel._btfwButtonSync) {
          panel.addEventListener("btfw:addmedia:state", (ev) => {
            syncState(!!(ev.detail && ev.detail.open));
          });
          panel._btfwButtonSync = true;
        }
      }
    }

    // Move any floating controls rows into the playlist container
    controlsRows.forEach(row => {
      if (row && !mainContainer.contains(row)) {
        row.style.cssText += `
          margin-top: 8px;
          position: relative !important;
          bottom: auto !important;
          left: auto !important;
          right: auto !important;
          width: auto !important;
        `;
        row.remove();
        mainContainer.appendChild(row);
        console.log('[stack] Moved floating controls row into playlist container');
      }
    });

    // Hide the legacy controls row if it no longer contains useful content
    // Ensure the bar is at the top of the playlist container
    if (!mainContainer.contains(controlsBar)) {
      mainContainer.insertBefore(controlsBar, mainContainer.firstChild);
    }
  }
  
  function createGroupItem(group, elements) {
    // Special handling for MOTD group
    if (group.id === "motd-group") {
      mergeMotdElements();
      // Re-get the element after merging
      elements = [document.getElementById("motdwrap")].filter(Boolean);
    }
    
    // Special handling for playlist group
    if (group.id === "playlist-group") {
      mergePlaylistControls();
      // Re-get elements after merging
      elements = elements.filter(el => el && el.id !== "rightcontrols"); // rightcontrols is now merged
    }
    
    // ✅ FIX: Allow channels-group to be created even with zero elements (slider will be added later)
    if (group.id !== "channels-group" && elements.length === 0) return null;
    
    // Filter out any elements that are already in the stack to avoid circular references
    const stackList = document.querySelector("#btfw-stack .btfw-stack-list");
    if (stackList) {
      elements = elements.filter(el => el && !stackList.contains(el) && !el.contains(stackList));
    }
    
    // Continue creating the wrapper even if elements is empty (for channels-group)
    const wrapper = document.createElement("section");
    wrapper.className = "btfw-stack-item btfw-group-item";
    wrapper.dataset.bind = group.id;
    wrapper.dataset.group = "true";
    
    const header = document.createElement("header");
    header.className = "btfw-stack-item__header";
    header.innerHTML = `
      <span class="btfw-stack-item__title">${group.title}</span>
      <span class="btfw-stack-arrows">
        <button class="btfw-arrow btfw-up">↑</button>
        <button class="btfw-arrow btfw-down">↓</button>
      </span>
    `;
    
    const body = document.createElement("div");
    body.className = "btfw-stack-item__body btfw-group-body";
    
    // Add all elements to this group with safety checks
    elements.forEach(el => {
      if (el && el.parentElement !== body && !body.contains(el) && !el.contains(body)) {
        try {
          body.appendChild(el);
        } catch (error) {
          console.warn('[stack] Failed to move element:', el.id || el.className, error);
        }
      }
    });
    
    wrapper.appendChild(header);
    wrapper.appendChild(body);
    
    // Wire up/down buttons
    wrapper.querySelector(".btfw-up").onclick = function(){ 
      const p = wrapper.parentElement; 
      const prev = wrapper.previousElementSibling; 
      if(prev) p.insertBefore(wrapper, prev); 
      save(p); 
    };
    wrapper.querySelector(".btfw-down").onclick = function(){ 
      const p = wrapper.parentElement; 
      const next = wrapper.nextElementSibling; 
      if(next) p.insertBefore(next, wrapper); 
      else p.appendChild(wrapper); 
      save(p); 
    };
    
    return wrapper;
  }
  
  function save(list){ 
    try{ 
      const items = Array.from(list.children).map(n => ({
        id: n.dataset.bind,
        isGroup: n.dataset.group === "true"
      }));
      localStorage.setItem(SKEY, JSON.stringify(items)); 
    }catch(e){} 
  }
  
  function load(){ 
    try{ 
      return JSON.parse(localStorage.getItem(SKEY)||"[]"); 
    }catch(e){ 
      return []; 
    } 
  }
  
  function attachFooter(footer){
    if (!footer) return;
    if (footer.querySelector("#btfw-footer")) return;

    const themed = document.getElementById("btfw-footer");
    if (themed && themed !== footer && !footer.contains(themed)) {
      footer.innerHTML = "";
      footer.appendChild(themed);
      return;
    }

    const real=document.getElementById("footer")||document.querySelector("footer");
    if(real && !footer.contains(real)){
      real.classList.add("btfw-footer");
      footer.innerHTML="";
      footer.appendChild(real);
    }
  }

  function movePollButton() {
    // Move poll button from leftcontrols to pollwrap
    const leftControls = document.getElementById("leftcontrols");
    const pollWrap = document.getElementById("pollwrap");
    
    if (leftControls && pollWrap) {
      // Find poll-related buttons
      const pollButtons = leftControls.querySelectorAll('button[onclick*="poll"], button[title*="poll"], .poll-btn, #newpollbtn');
      
      pollButtons.forEach(btn => {
        // Create a container if pollwrap doesn't have one
        let btnContainer = pollWrap.querySelector('.poll-controls');
        if (!btnContainer) {
          btnContainer = document.createElement('div');
          btnContainer.className = 'poll-controls';
          btnContainer.style.cssText = 'margin-bottom: 8px; padding: 4px; display: flex; gap: 6px;';
          pollWrap.insertBefore(btnContainer, pollWrap.firstChild);
        }
        
        // Style the button to match the theme
        btn.classList.add('button', 'is-small', 'is-link');
        btnContainer.appendChild(btn);
      });
      
      // Remove leftcontrols if it's empty
      if (leftControls.children.length === 0) {
        leftControls.remove();
      }
    }
  }
  
  function populate(refs){
    const list = refs.list;
    const footer = refs.footer;
    
    // Move poll button first
    movePollButton();
    
    // Group elements
    const groupedElements = new Map();
    
    // Process groups with better safety checks
    GROUPS.forEach(group => {
      const elements = [];
      group.selectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (!el) return;
        if (list.contains(el) || el.contains(list)) return;
        if (SKIP_SELECTORS.includes(sel)) return;
        if (sel === "#pollwrap") {
          const overlayState = el.dataset && el.dataset.btfwPollOverlay;
          const attrState = el.getAttribute && el.getAttribute("data-btfw-poll-overlay");
          if (overlayState === "video" || attrState === "video") {
            return;
          }
        }
        elements.push(el);
      });
      
      // ✅ FIX: Always create channels-group if slider is enabled, even if #btfw-channels doesn't exist yet
      if (group.id === "channels-group" && elements.length === 0) {
        // Check if channel slider is enabled via multiple possible sources
        const btfw = window.BTFW || {};
        
        // Check modern config paths
        let sliderEnabled = btfw.channelSliderEnabled || 
                           (btfw.channelSlider && btfw.channelSlider.enabled) ||
                           (btfw.channelTheme && btfw.channelTheme.slider && btfw.channelTheme.slider.enabled);
        
        // Also check legacy global variables (for backwards compatibility)
        if (typeof sliderEnabled === 'undefined' && typeof window.UI_ChannelList !== 'undefined') {
          sliderEnabled = window.UI_ChannelList === '1' || window.UI_ChannelList === 1;
        }
        
        // If we found a URL but no explicit enabled flag, assume enabled
        if (!sliderEnabled) {
          const hasUrl = btfw.channelSliderJSON || 
                        (btfw.channelSlider && btfw.channelSlider.feedUrl) ||
                        (btfw.channelTheme && btfw.channelTheme.slider && btfw.channelTheme.slider.feedUrl) ||
                        window.Channel_JSON;
          if (hasUrl) sliderEnabled = true;
        }
        
        if (sliderEnabled) {
          // Don't skip this group - allow it to be created with zero elements
          // The channel slider will be added to it later via placeSliderInStack()
          groupedElements.set(group.id, { group, elements: [] });
          return; // Continue to next group
        }
      }
      
      if (elements.length > 0) {
        groupedElements.set(group.id, { group, elements });
      }
    });
    
    // Create items by priority/order
    const savedOrder = load();
    const itemsToAdd = [];
    
    // Add groups
    groupedElements.forEach(({ group, elements }, groupId) => {
      const existingItem = Array.from(list.children).find(n => n.dataset.bind === groupId);
      if (!existingItem) {
        try {
          const groupItem = createGroupItem(group, elements);
          if (groupItem) {
            itemsToAdd.push({ item: groupItem, id: groupId, priority: group.priority, isGroup: true });
          }
        } catch (error) {
          console.warn('[stack] Failed to create group item:', groupId, error);
        }
      }
    });
    
    // Sort by saved order, then by priority
    if (savedOrder.length > 0) {
      itemsToAdd.sort((a, b) => {
        const aIndex = savedOrder.findIndex(s => s.id === a.id);
        const bIndex = savedOrder.findIndex(s => s.id === b.id);
        if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
        if (aIndex >= 0) return -1;
        if (bIndex >= 0) return 1;
        return a.priority - b.priority;
      });
    } else {
      itemsToAdd.sort((a, b) => a.priority - b.priority);
    }
    
    // Add items to list with safety checks
    itemsToAdd.forEach(({ item }) => {
      try {
        if (item && !list.contains(item) && !item.contains(list)) {
          list.appendChild(item);
        }
      } catch (error) {
        console.warn('[stack] Failed to add item to list:', error);
      }
    });
    
    applyCompactSpacing(compactSpacing);
    save(list);
    attachFooter(footer);
  }

  function setCompactSpacing(enabled){
    compactSpacing = !!enabled;
    applyCompactSpacing(compactSpacing);
  }

  function getCompactSpacing(){
    return compactSpacing;
  }

 function boot(){
  const refs=ensureStack();
  if(!refs) return;
  populate(refs);
    const observer=new MutationObserver(()=>populate(refs));
    const leftpad = document.getElementById('btfw-leftpad');
  const main = document.getElementById('main');
  
  if (leftpad) {
    observer.observe(leftpad, {childList:true, subtree:false});
  }
  if (main) {
    observer.observe(main, {childList:true, subtree:false});
  }
  setTimeout(() => {
  const pm = document.querySelector('.btfw-stack-item[data-bind="playlist-group"]');
  if (pm) {
    pm.dataset.open = 'false';
    pm.classList.remove('is-open');
  }
}, 1000);
  let n=0;
  const iv=setInterval(()=>{
    populate(refs);
    if(++n>8) clearInterval(iv);
  },700);
}

  document.addEventListener("btfw:layoutReady", boot);
  setTimeout(boot, 1200);
  
  document.addEventListener("btfw:channelThemeTint", () => {
    const refs = ensureStack();
    if (refs) {
      setTimeout(() => populate(refs), 100);
    }
  });
  
  document.addEventListener("btfw:layout:orientation", () => {
    requestAnimationFrame(() => applyCompactSpacing(compactSpacing));
  });
  document.addEventListener("btfw:stack:compactChanged", (ev) => {
    if (ev && ev.detail && "enabled" in ev.detail) {
      setCompactSpacing(!!ev.detail.enabled);
    } else {
      applyCompactSpacing(compactSpacing);
    }
  });

  return {
    name:"feature:stack",
    setCompactSpacing,
    getCompactSpacing
  };
});
