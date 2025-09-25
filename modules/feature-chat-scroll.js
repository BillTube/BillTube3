/* BTFW — feature:chat-scroll (Auto-scroll management, bottom detection, user scroll awareness) */
BTFW.define("feature:chat-scroll", [], async () => {
  
  let isUserScrolledUp = false;
  let scrollTimeout = null;
  let lastScrollTop = 0;
  
  // Get chat buffer element
  function getChatBuffer(){
    return document.getElementById("messagebuffer") || 
           document.querySelector(".chat-messages, #chatbuffer, .message-buffer");
  }

  // Check if chat is scrolled to bottom (with small tolerance)
  function isScrolledToBottom(element = getChatBuffer()){
    if (!element) return false;
    const tolerance = 5;
    return element.scrollTop >= (element.scrollHeight - element.clientHeight - tolerance);
  }

  // Scroll to bottom smoothly
  function scrollToBottom(element = getChatBuffer(), smooth = false){
    if (!element) return;
    
    if (smooth) {
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      element.scrollTop = element.scrollHeight;
    }
  }

  // Handle scroll events
  function handleScroll(event){
    const element = event.target;
    if (!element) return;

    const currentScrollTop = element.scrollTop;
    const isAtBottom = isScrolledToBottom(element);
    
    // Determine scroll direction
    const scrollingDown = currentScrollTop > lastScrollTop;
    const scrollingUp = currentScrollTop < lastScrollTop;
    
    // Update user scroll state
    if (scrollingUp && !isAtBottom) {
      isUserScrolledUp = true;
    } else if (scrollingDown && isAtBottom) {
      isUserScrolledUp = false;
    }

    lastScrollTop = currentScrollTop;

    // Clear existing timeout
    clearTimeout(scrollTimeout);
    
    // Set timeout to reset scroll state if user stops scrolling near bottom
    scrollTimeout = setTimeout(() => {
      if (isScrolledToBottom(element)) {
        isUserScrolledUp = false;
      }
    }, 1000);
  }

  // Handle new messages
  function handleNewMessage(){
    const chatBuffer = getChatBuffer();
    if (!chatBuffer) return;

    // Only auto-scroll if user hasn't manually scrolled up
    if (!isUserScrolledUp) {
      // Small delay to ensure message is rendered
      setTimeout(() => {
        scrollToBottom(chatBuffer);
      }, 10);
    }
  }

  // Setup chat scroll management
  function setupScrollManagement(){
    const chatBuffer = getChatBuffer();
    if (!chatBuffer || chatBuffer._btfwScrollBound) return;
    
    chatBuffer._btfwScrollBound = true;

    // Bind scroll event
    chatBuffer.addEventListener("scroll", handleScroll, { passive: true });

    // Watch for new messages
    const observer = new MutationObserver((mutations) => {
      let hasNewMessages = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          // Check if added nodes are message elements
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              const isMessage = node.matches?.(".chat-msg, .message, [class*=message]") ||
                              node.querySelector?.(".chat-msg, .message, [class*=message]");
              if (isMessage) {
                hasNewMessages = true;
              }
            }
          });
        }
      });

      if (hasNewMessages) {
        handleNewMessage();
      }
    });

    observer.observe(chatBuffer, {
      childList: true,
      subtree: true
    });

    // Initial scroll to bottom
    setTimeout(() => scrollToBottom(chatBuffer), 100);
  }

  // Enhanced scroll to bottom for external use (like the original scrollChat function)
  function scrollChat(){
    const chatBuffer = getChatBuffer();
    if (!chatBuffer) return;
    
    // Reset user scroll state and scroll to bottom
    isUserScrolledUp = false;
    scrollToBottom(chatBuffer, true);
  }

  // Initialize
  function boot(){
    setupScrollManagement();
    
    // Watch for chat buffer changes (in case it's recreated)
    const observer = new MutationObserver(() => {
      setupScrollManagement();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Expose global scrollChat function for compatibility
    if (!window.scrollChat) {
      window.scrollChat = scrollChat;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return {
    name: "feature:chat-scroll",
    scrollToBottom: scrollChat,
    isScrolledToBottom: () => isScrolledToBottom(),
    isUserScrolledUp: () => isUserScrolledUp
  };
});