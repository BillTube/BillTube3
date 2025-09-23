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
    
    // Merge motd content into container
    if (motd && container && !container.contains(motd)) {
      // Move motd's content directly into container
      while (motd.firstChild) {
        container.appendChild(motd.firstChild);
      }
      motd.remove();
    }
    
    // Remove duplicate motdrow if we're using motdwrap
    if (motdwrap && motdrow && motdrow !== motdwrap) {
      while (motdrow.firstChild) {
        motdwrap.appendChild(motdrow.firstChild);
      }
      motdrow.remove();
    }
  }
  
  function mergePlaylistControls() {
    const rightControls = document.getElementById("rightcontrols");
    const plBar = document.getElementById("btfw-plbar");
    const playlistWrap = document.getElementById("playlistwrap");
    const queueContainer = document.getElementById("queuecontainer");
    
    // Find the main playlist container
    const mainContainer = playlistWrap || queueContainer;
    if (!mainContainer) return;
    
    // Create or enhance the playlist bar
    let controlsBar = plBar;
    if (!controlsBar) {
      controlsBar = document.createElement("div");
      controlsBar.id = "btfw-plbar";
      controlsBar.className = "btfw-plbar";
    }
    
    // Style the controls bar nicely
    controlsBar.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px 12px;
      margin: 8px 0 6px 0;
      background: linear-gradient(135deg, rgba(109, 77, 246, 0.08), rgba(139, 92, 246, 0.05));
      border: 1px solid rgba(109, 77, 246, 0.15);
      border-radius: 12px;
      flex-wrap: wrap;
    `;
    
    // Move rightcontrols buttons into the enhanced bar
    if (rightControls) {
      const buttons = rightControls.querySelectorAll("button, .btn, input");
      buttons.forEach(btn => {
        btn.classList.add("button", "is-small", "is-dark");
        btn.style.cssText += "border-radius: 8px; margin: 0 2px;";
        controlsBar.appendChild(btn);
      });
      rightControls.remove();
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
    
    // Add all elements to this group
    elements.forEach(el => {
      if (el && el.parentElement !== body) {
        body.appendChild(el);
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
    
    // Process groups
    GROUPS.forEach(group => {
      const elements = [];
      group.selectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el && !list.contains(el) && !SKIP_SELECTORS.includes(sel)) {
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
        const groupItem = createGroupItem(group, elements);
        if (groupItem) {
          itemsToAdd.push({ item: groupItem, id: groupId, priority: group.priority, isGroup: true });
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
    
    // Add items to list
    itemsToAdd.forEach(({ item }) => {
      list.appendChild(item);
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