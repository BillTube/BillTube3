/* BTFW — feature:videoOverlay (adopt native CyTube controls into an overlay + Local Subs) */
BTFW.define("feature:videoOverlay", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // Controls we’ll try to adopt from CyTube’s DOM (order matters)
  const CONTROL_SELECTORS = [
    "#mediarefresh",
    "#voteskip",
    "#fullscreenbtn"
    // add more here if you want them adopted too
  ];

  const LS = { localSubs: "btfw:video:localsubs" }; // "1" | "0"
  const localSubsEnabled = () => { try { return localStorage.getItem(LS.localSubs) !== "0"; } catch(_) { return true; } };
  const setLocalSubs = v => { try { localStorage.setItem(LS.localSubs, v?"1":"0"); } catch(_){}; document.dispatchEvent(new CustomEvent("btfw:video:localsubs:changed",{detail:{enabled:!!v}})); };

  // ---------- Minimal CSS for overlay ----------
  function ensureCSS(){
    if ($("#btfw-vo-css")) return;
    const st = document.createElement("style");
    st.id = "btfw-vo-css";
    st.textContent = `
      #btfw-video-overlay{position:absolute;inset:0;pointer-events:none;z-index: 40;}
      #btfw-video-overlay .btfw-vo-bar{
        position:absolute; right:8px; top:8px; display:flex; gap:6px; pointer-events:auto;
        background:transparent;
      }
      #btfw-video-overlay .btfw-vo-btn{
        display:inline-grid; place-items:center; min-width:32px; height:32px; padding:0 10px;
        border:0; border-radius:8px; background:rgba(18,18,22,.78); color:#fff; cursor:pointer;
        font:12px/1 system-ui,Segoe UI,Arial; box-shadow:0 1px 2px rgba(0,0,0,.35);
      }
      #btfw-video-overlay .btfw-vo-btn:hover{ filter:brightness(1.06); }
      /* normalize adopted native buttons inside overlay */
      #btfw-video-overlay .btfw-vo-adopted{
        all: unset; display:inline-grid; place-items:center; min-width:32px; height:32px;
        padding:0 10px; border-radius:8px; background:rgba(18,18,22,.78); color:#fff; cursor:pointer;
      }
      #btfw-mini-toast{position:fixed;right:12px;bottom:12px;background:#111a;color:#fff;padding:8px 12px;border-radius:8px;font:12px/1.2 system-ui,Segoe UI,Arial;z-index:99999;pointer-events:none;opacity:0;transition:opacity .2s}
    `;
    document.head.appendChild(st);
  }

  // ---------- Overlay DOM ----------
  function ensureOverlay(){
    const wrap = $("#videowrap");
    if (!wrap) return null;

    let ov = $("#btfw-video-overlay");
    if (!ov){
      ov = document.createElement("div");
      ov.id = "btfw-video-overlay";
    }
    // keep overlay attached and positioned
    if (ov.parentElement !== wrap) wrap.appendChild(ov);

    let bar = $("#btfw-vo-bar");
    if (!bar){
      bar = document.createElement("div");
      bar.className = "btfw-vo-bar";
      bar.id = "btfw-vo-bar";
      ov.appendChild(bar);
    }

    ensureLocalSubsButton(bar);
    adoptNativeControls(bar); // after subs, so native buttons appear to the right if you prefer—swap calls to reorder

    return ov;
  }

  // ---------- Adopt native buttons ----------
  function adoptNativeControls(bar){
    CONTROL_SELECTORS.forEach(sel => {
      const el = $(sel);
      if (!el) return;

      // already adopted?
      if (el.dataset.btfwOverlay === "1") {
        // make sure it sits in the bar
        if (el.parentElement !== bar) bar.appendChild(el);
        return;
      }

      // remember original place with a hidden placeholder so we could restore later if needed
      const ph = document.createElement("span");
      ph.hidden = true;
      ph.setAttribute("data-btfw-ph", sel);
      try { el.insertAdjacentElement("afterend", ph); } catch(_){}

      // visually normalize inside overlay without destroying existing handlers
      el.classList.add("btfw-vo-adopted");
      el.dataset.btfwOverlay = "1";
      bar.appendChild(el);
    });
  }

  // ---------- Local Subtitles ----------
  function ensureLocalSubsButton(bar){
    // create or refresh visibility
    let btn = $("#btfw-vo-subs");
    if (!btn){
      btn = document.createElement("button");
      btn.id = "btfw-vo-subs";
      btn.className = "btfw-vo-btn";
      btn.title = "Load local subtitles (.vtt/.srt)";
      btn.innerHTML = `<i class="fa fa-closed-captioning"></i>`;
      btn.addEventListener("click", (e)=>{ e.preventDefault(); pickLocalSubs(); });
      bar.prepend(btn); // keep it leftmost; change to append if you want it on the right
    }
    btn.style.display = localSubsEnabled() ? "" : "none";
  }

  function getHTML5Video(){ return $('video'); }

  function srtToVtt(text){
    let s = (text||"").replace(/\r\n/g,"\n").trim() + "\n";
    s = s.replace(/^\d+\s*$\n/gm,"");
    s = s.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,"$1.$2");
    s = s.replace(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/g,"$1 --> $2");
    return "WEBVTT\n\n"+s;
  }

  async function pickLocalSubs(){
    const video = getHTML5Video();
    if (!video){ toast("Local subs only for HTML5 sources."); return; }

    const inp = document.createElement("input");
    inp.type="file"; inp.accept=".vtt,.srt,text/vtt,text/plain"; inp.style.display="none";
    document.body.appendChild(inp);

    const done = new Promise(res=>{
      inp.addEventListener("change", async ()=>{
        const f = inp.files && inp.files[0];
        document.body.removeChild(inp);
        if (!f) return res(false);
        try{
          const txt = await f.text();
          const ext = (f.name.split(".").pop()||"").toLowerCase();
          let vtt = (ext==="srt")? srtToVtt(txt) : (txt.startsWith("WEBVTT")? txt : "WEBVTT\n\n"+txt);
          const url = URL.createObjectURL(new Blob([vtt],{type:"text/vtt"}));
          attachTrack(video, url, f.name.replace(/\.[^.]+$/,"")||"Local");
          toast("Subtitles loaded.");
          res(true);
        }catch(e){ console.error(e); toast("Failed to load subtitles."); res(false); }
      }, { once:true });
    });

    inp.click();
    await done;
  }

  function attachTrack(video, url, label){
    $('track[data-btfw="1"]', video)?.remove();
    const tr = document.createElement("track");
    tr.kind="subtitles"; tr.label=label||"Local"; tr.srclang="en"; tr.src=url; tr.default=true; tr.setAttribute("data-btfw","1");
    video.appendChild(tr);
    try { for (const t of video.textTracks) t.mode = (t.label===tr.label)?"showing":"disabled"; } catch(_){}
  }

  // ---------- Tiny toast ----------
  function toast(msg){
    let t=$("#btfw-mini-toast"); if(!t){ t=document.createElement("div"); t.id="btfw-mini-toast"; document.body.appendChild(t); }
    t.textContent=msg; t.style.opacity="1"; clearTimeout(t._hid); t._hid=setTimeout(()=>t.style.opacity="0",1400);
  }

  // ---------- Boot / observers ----------
  function boot(){
    ensureCSS();
    ensureOverlay();

    // If CyTube re-renders controls, adopt again
    const targets = [ $("#videowrap"), $("#rightcontrols"), $("#leftcontrols"), document.body ].filter(Boolean);
    const mo = new MutationObserver(()=> ensureOverlay());
    targets.forEach(t => mo.observe(t, { childList:true, subtree:true }));

    document.addEventListener("btfw:video:localsubs:changed", ()=> ensureOverlay());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    name:"feature:videoOverlay",
    setLocalSubsEnabled: setLocalSubs
  };
});
