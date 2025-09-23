BTFW.define("feature:stack", ["feature:layout"], async ({}) => {
  const SKEY="btfw-stack-order";
  
  // Define what should be grouped together
  const GROUPS = [
    {
      id: "motd-group",
      title: "Message of the Day",
      selectors: ["#motdrow", "#motd", "#announcements"],
      priority: 1
    },
    {
      id: "playlist-group", 
      title: "Playlist",
      selectors: ["#playlistrow", "#playlistwrap", "#queuecontainer", "#queue", "#rightcontrols"],
      priority: 2
    },
    {
      id: "poll-group",
      title: "Polls & Voting", 
      selectors: ["#pollwrap"],
      priority: 3
    }
  ];
  
  const STANDALONE_SELECTORS = ["#btfw-channels", "#mainpage", "#mainpane", "#main"];
  
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
      const hdr=document.createElement("div"); 
      hdr.className="btfw-stack-header"; 
      hdr.innerHTML='<div class="btfw-stack-title">Page Modules</div>'; 
      stack.appendChild(hdr); 
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
  
  function createGroupItem(group, elements) {
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
  
  function itemFor(el){ 
    const w=document.createElement("section"); 
    w.className="btfw-stack-item"; 
    w.dataset.bind=normalizeId(el); 
    w.innerHTML='<header class="btfw-stack-item__header"><span class="btfw-stack-item__title">'+titleOf(el)+'</span><span class="btfw-stack-arrows"><button class="btfw-arrow btfw-up">↑</button><button class="btfw-arrow btfw-down">↓</button></span></header><div class="btfw-stack-item__body"></div>'; 
    w.querySelector(".btfw-stack-item__body").appendChild(el); 
    w.querySelector(".btfw-up").onclick=function(){ 
      const p=w.parentElement; 
      const prev=w.previousElementSibling; 
      if(prev) p.insertBefore(w, prev); 
      save(p); 
    }; 
    w.querySelector(".btfw-down").onclick=function(){ 
      const p=w.parentElement; 
      const next=w.nextElementSibling; 
      if(next) p.insertBefore(next, w); 
      else p.appendChild(w); 
      save(p); 
    }; 
    return w; 
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
          btnContainer.style.cssText = 'margin-bottom: 8px; padding: 4px;';
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
    const standaloneElements = [];
    
    // Process groups
    GROUPS.forEach(group => {
      const elements = [];
      group.selectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el && !list.contains(el)) {
          elements.push(el);
        }
      });
      if (elements.length > 0) {
        groupedElements.set(group.id, { group, elements });
      }
    });
    
    // Process standalone elements  
    STANDALONE_SELECTORS.forEach(sel => {
      const el = document.querySelector(sel);
      if (el && !list.contains(el)) {
        standaloneElements.push(el);
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
        itemsToAdd.push({ item: groupItem, id: groupId, priority: group.priority, isGroup: true });
      }
    });
    
    // Add standalone elements
    standaloneElements.forEach(el => {
      const id = normalizeId(el);
      const existingItem = Array.from(list.children).find(n => n.dataset.bind === id);
      if (!existingItem) {
        const item = itemFor(el);
        itemsToAdd.push({ item, id, priority: 999, isGroup: false });
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