BTFW.define("feature:stack", ["feature:layout"], async ({}) => {
  const SKEY="btfw-stack-order";
  
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
      id: "poll-group",
      title: "Polls & Voting", 
      selectors: ["#pollwrap"],
      priority: 3
    }
  ];
  
  // Skip these - they're either empty or handled elsewhere
  const SKIP_SELECTORS = ["#main", "#mainpage", "#mainpane"];
  
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

    // Find any floating controls row (legacy CyTube layout)
    const controlsRows = document.querySelectorAll(".btfw-controls-row");

    // Find the main playlist container
    const mainContainer = playlistWrap || queueContainer;
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

    // Ensure we have an actions cluster for playlist controls
    let actionsCluster = controlsBar.querySelector(".btfw-plbar__actions");
    if (!actionsCluster) {
      actionsCluster = document.createElement("div");
      actionsCluster.className = "btfw-plbar__actions";
      (aside || controlsBar).appendChild(actionsCluster);
    }

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

    // Move rightcontrols buttons into the enhanced bar
    if (rightControls) {
      Array.from(rightControls.childNodes).forEach(node => {
        if (!node || node.nodeType !== 1) return;
        const el = node;
        // Normalise Bootstrap control groups inside the modern cluster
        el.classList.add("btfw-plbar__control");
        actionsCluster.appendChild(el);
      });

      actionsCluster.querySelectorAll("button, a.btn, input[type=button], input[type=submit], input[type=reset], select").forEach(styleActionButton);

      rightControls.remove();
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
    if (controlsRow && !controlsRow.querySelector("button, input, select, .btn, .dropdown")) {
      controlsRow.style.display = "none";
    }

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
    
    if (elements.length === 0) return null;
    
    // Filter out any elements that are already in the stack to avoid circular references
    const stackList = document.querySelector("#btfw-stack .btfw-stack-list");
    if (stackList) {
      elements = elements.filter(el => el && !stackList.contains(el) && !el.contains(stackList));
    }
    
    if (elements.length === 0) return null;
    
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
        if (el && 
            !list.contains(el) && 
            !el.contains(list) &&
            !SKIP_SELECTORS.includes(sel)) {
          elements.push(el);
        }
      });
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
    
    save(list);
    attachFooter(footer);
  }
  
  function boot(){ 
    const refs=ensureStack(); 
    if(!refs) return; 
    populate(refs); 
    const obs=new MutationObserver(()=>populate(refs)); 
    obs.observe(document.body,{childList:true,subtree:true}); 
    let n=0; 
    const iv=setInterval(()=>{ 
      populate(refs); 
      if(++n>8) clearInterval(iv); 
    },700); 
  }
  
  document.addEventListener("btfw:layoutReady", boot); 
  setTimeout(boot, 1200);
  return {name:"feature:stack"};
});