
BTFW.define("feature:pip", ["feature:layout"], async ({}) => {
  let originalParent = null;
  let beforeNode = null;

  function ensureDock(){
    const chatcol = document.getElementById("btfw-chatcol"); if(!chatcol) return null;
    let dock = document.getElementById("btfw-pip-dock");
    if (!dock){
      dock = document.createElement("div");
      dock.id = "btfw-pip-dock";
      chatcol.prepend(dock);
    }
    return dock;
  }

  function toDock(){
    const video = document.getElementById("videowrap"); if(!video) return;
    const dock = ensureDock(); if(!dock) return;
    if (dock.contains(video)) return;
    originalParent = video.parentNode;
    beforeNode = video.nextSibling;
    dock.appendChild(video);
    video.classList.add("btfw-pip");
  }

  function toOriginal(){
    const video = document.getElementById("videowrap"); if(!video) return;
    if (originalParent && !originalParent.contains(video)){
      if (beforeNode) originalParent.insertBefore(video, beforeNode);
      else originalParent.appendChild(video);
    }
    video.classList.remove("btfw-pip");
  }

  function observe(){
    const video = document.getElementById("videowrap"); if(!video) return;
    const io = new IntersectionObserver(entries => {
      const e = entries[0];
      if (!e) return;
      if (e.intersectionRatio < 0.15) toDock();
      else toOriginal();
    }, { root: null, threshold: [0, 0.15, 0.5, 1] });
    io.observe(video);
  }

  document.addEventListener("btfw:layoutReady", observe);
  setTimeout(observe, 1500);

  return { name:"feature:pip" };
});
