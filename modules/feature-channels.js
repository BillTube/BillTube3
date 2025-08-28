// BillTube — Channel slider under video; reads window.BTFW_CHANNELS or uses placeholders.
BTFW.define("feature:channels", ["feature:stack"], async ({}) => {
  function getChannels(){
    if (Array.isArray(window.BTFW_CHANNELS) && window.BTFW_CHANNELS.length) return window.BTFW_CHANNELS;
    // Fallback sample — replace these with your channels; each item: {name, href, icon?}
    return [
      { name: "Home", href: "/" },
      { name: "Music", href: "/r/music" },
      { name: "Movies", href: "/r/movies" },
      { name: "Anime", href: "/r/anime" },
      { name: "Gaming", href: "/r/gaming" }
    ];
  }

  function ensure() {
    let el = document.getElementById("btfw-channels");
    if (!el) {
      el = document.createElement("div");
      el.id = "btfw-channels";
      el.setAttribute("data-title", "Channels");
      el.className = "btfw-channels";
    }

    const bar = document.createElement("div");
    bar.className = "btfw-channels-bar";
    const left = document.createElement("button"); left.className = "btfw-ch-nav"; left.innerHTML = "&lsaquo;";
    const right = document.createElement("button"); right.className = "btfw-ch-nav"; right.innerHTML = "&rsaquo;";
    const scroller = document.createElement("div"); scroller.className = "btfw-ch-scroller";

    getChannels().forEach(ch => {
      const a = document.createElement("a");
      a.href = ch.href; a.className = "btfw-ch";
      a.innerHTML = ch.icon ? `<img src="${ch.icon}" alt=""> ${ch.name}` : ch.name;
      scroller.appendChild(a);
    });

    bar.appendChild(left); bar.appendChild(scroller); bar.appendChild(right);
    el.innerHTML = ""; el.appendChild(bar);

    left.onclick = () => scroller.scrollBy({left: -240, behavior: "smooth"});
    right.onclick = () => scroller.scrollBy({left: +240, behavior: "smooth"});

    // Mount into the stack as an item
    const list = document.querySelector("#btfw-stack .btfw-stack-list");
    if (!list) return;
    let item = Array.from(list.children).find(n => n.dataset.bind === "btfw-channels");
    if (!item) {
      item = document.createElement("section");
      item.className = "btfw-stack-item"; item.setAttribute("draggable","true");
      item.dataset.bind = "btfw-channels";
      item.innerHTML = `
        <header class="btfw-stack-item__header">
          <span class="btfw-handle"><i class="fa fa-bars"></i></span>
          <span class="btfw-stack-item__title">Channels</span>
        </header>
        <div class="btfw-stack-item__body"></div>
      `;
      list.appendChild(item);
    }
    const body = item.querySelector(".btfw-stack-item__body");
    if (!body.contains(el)) body.appendChild(el);
  }

  document.addEventListener("btfw:layoutReady", ensure);
  setTimeout(ensure, 1200);
  return { name: "feature:channels" };
});
