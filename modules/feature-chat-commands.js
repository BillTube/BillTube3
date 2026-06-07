BTFW.define("feature:chat-commands", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const motion = await BTFW.init("util:motion");
  const chatPopover = await BTFW.init("util:chat-popover");
  const now = ()=>Date.now();

  // ---------- Utils ----------
  function sendChat(msg){
    try { if (window.socket?.emit) { socket.emit("chatMsg", { msg }); return true; } } catch(_) {}
    return false;
  }
  function sysLocal(text){
    const buf = $("#messagebuffer"); if (!buf) return;
    const d = document.createElement("div");
    d.className = "server-msg btfw-cmd";
    d.textContent = text;
    buf.appendChild(d);
    buf.scrollTop = buf.scrollHeight;
  }
  function getUser(){ try { return (window.CLIENT && CLIENT.name) ? CLIENT.name : ""; } catch(_) { return ""; } }
  function getRank(){ try { return (window.CLIENT && (CLIENT.rank|0)) || 0; } catch(_) { return 0; } }
  function hasRank(min){ return getRank() >= min; }
  function clamp(n,a,b){ return Math.min(b, Math.max(a, n)); }
  function norm(s){ return String(s||"").toLowerCase().replace(/['".,;:!?()\[\]{}]/g,"").replace(/\s+/g," ").trim(); }

function getCurrentTitle(){
  const ct = document.getElementById('currenttitle') || document.querySelector('.currenttitle');
  let t = (ct?.textContent || "").trim();
  // Remove any "Currently playing:" / "Now playing:" prefix
  t = t.replace(/^\s*(?:currently|now)\s*playing\s*[:\-]\s*/i, "").trim();
  return t;
}

  const workerUrl    = 'https://trivia-worker.billtube.workers.dev';
  const triviaAPIUrl = 'https://opentdb.com/api.php?amount=1&type=multiple';

  let triviaActive=false, correctAnswer='', answeredUsers=new Set(), triviaTimeoutId=null;

  function decodeHTMLEntities(text){ const t=document.createElement('textarea'); t.innerHTML=text; return t.value; }
  function stylizeUsername(u){
    const map={'a':'𝐚','b':'𝐛','c':'𝐜','d':'𝐝','e':'𝐞','f':'𝐟','g':'𝐠','h':'𝐡','i':'𝐢','j':'𝐣','k':'𝐤','l':'𝐥','m':'𝐦','n':'𝐧','o':'𝐨','p':'𝐩','q':'𝐪','r':'𝐫','s':'𝐬','t':'𝐭','u':'𝐮','v':'𝐯','w':'𝐰','x':'𝐱','y':'𝐲','z':'𝐳','A':'𝐀','B':'𝐁','C':'𝐂','D':'𝐃','E':'𝐄','F':'𝐅','G':'𝐆','H':'𝐇','I':'𝐈','J':'𝐉','K':'𝐊','L':'𝐋','M':'𝐌','N':'𝐍','O':'𝐎','P':'𝐏','Q':'𝐐','R':'𝐑','S':'𝐒','T':'𝐓','U':'𝐔','V':'𝐕','W':'𝐖','X':'𝐗','Y':'𝐘','Z':'𝐙'};
    return String(u||"").split("").map(ch=>map[ch]||ch).join("");
  }
  async function updateScore(username){
    try {
      await fetch(`${workerUrl}/updateScore`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username }) });
    } catch(e){ console.error('[trivia] updateScore failed:', e); }
  }
  async function displayLeaderboard(){
    try {
      const res = await fetch(`${workerUrl}/leaderboard`);
      const leaderboard = await res.json();
      let message = '🎉 Leaderboard:\n';
      leaderboard.forEach(({ username, score }) => { message += `${stylizeUsername(username)}: ${score} points\n`; });
      sendChat(message);
    } catch(e){ console.error('[trivia] leaderboard failed:', e); }
  }
  async function fetchTriviaQuestion(){
    try {
      const response = await fetch(triviaAPIUrl);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const q = data.results[0];
        correctAnswer = decodeHTMLEntities(q.correct_answer.toLowerCase());
        const all = [...q.incorrect_answers, q.correct_answer].map(decodeHTMLEntities).sort(()=>Math.random()-0.5);
        const colors = ["#ffa500","#ff4500","#1e90ff","#32cd32"];
        const colored = all.map((ans,i)=>`col:${colors[i%colors.length]}:${ans}`);
        const question = decodeHTMLEntities(q.question);
        return `🎬 [code]Trivia: ${question}[/code] \nOptions: ${colored.join(', ')}`;
      }
      return '[i]No trivia question available at the moment.[/i]';
    } catch(e){ console.error('[trivia] OpenTDB error:', e); return 'Error fetching trivia question. Please try again later.'; }
  }
  async function startTriviaOnce(){
    if (!hasRank(2)) return 'col:#a52a2a:You do not have permission to start a trivia question.';
    if (triviaActive) return 'col:#a52a2a:A trivia question is already active!';
    const q = await fetchTriviaQuestion();
    triviaActive = true; answeredUsers.clear();
    sendChat('!trivia'); sendChat(q);
    clearTimeout(triviaTimeoutId);
    triviaTimeoutId = setTimeout(()=>{ if (triviaActive){ triviaActive=false; sendChat(`col:#a52a2a:⏰ Time's up! The correct answer was: ${correctAnswer}`);} }, 30000);
    return '';
  }
  function onIncomingChatMsg(data){
    const username = data?.username || '';
    const message  = (data?.msg || '').trim();
    if (!triviaActive || !username || !message) return;
    if (answeredUsers.has(username)) return;
    if (message.toLowerCase() === correctAnswer) {
      answeredUsers.add(username);
      triviaActive=false; clearTimeout(triviaTimeoutId);
      updateScore(username).then(()=> displayLeaderboard()).catch(()=>{});
      sendChat(`col:#008000:🎉 ${username} got the right answer! Their score has been updated.`);
    }
  }

  // ---------- TMDB summary ----------
  function getTMDBKey(){
    try {
      const cfg = (window.BTFW_CONFIG && typeof window.BTFW_CONFIG === "object") ? window.BTFW_CONFIG : {};
      const tmdbObj = (cfg.tmdb && typeof cfg.tmdb === "object") ? cfg.tmdb : {};
      const cfgKey = typeof tmdbObj.apiKey === "string" ? tmdbObj.apiKey.trim() : "";
      const legacyCfg = typeof cfg.tmdbKey === "string" ? cfg.tmdbKey.trim() : "";
      let lsKey = "";
      try { lsKey = (localStorage.getItem("btfw:tmdb:key") || "").trim(); }
      catch(_) {}
      const g  = v => (v==null ? "" : String(v)).trim();
      const globalKey = g(window.TMDB_API_KEY) || g(window.BTFW_TMDB_KEY) || g(window.tmdb_key);
      const bodyKey = (document.body?.dataset?.tmdbKey || "").trim();
      const key = cfgKey || legacyCfg || lsKey || globalKey || bodyKey;
      return key || null;
    } catch(_) { return null; }
  }
async function fetchTMDBSummary(title){
  const key = getTMDBKey();
  if (!key) return 'TMDB key missing. Open Theme Settings → General → Integrations to add your TMDB API key, or set one of:\nwindow.BTFW_CONFIG.tmdb = { apiKey: "KEY" };\nlocalStorage.setItem("btfw:tmdb:key","KEY");\nwindow.tmdb_key = "KEY";';
  
  try {
    const imdbMatch = /^tt\d+$/.test(title.trim());
    let r;
    
    if (imdbMatch) {
      const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(title.trim())}?api_key=${key}&external_source=imdb_id`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      r = (data.movie_results||[])[0] || (data.tv_results||[])[0];
    } else {
      const yearMatch = title.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? yearMatch[0] : '';
      let cleanTitle = title;
      
      if (year) {
        cleanTitle = title.replace(/\s*\(?\s*(19|20)\d{2}\s*\)?\s*/g, ' ').trim();
      }
      
      const q = encodeURIComponent(cleanTitle);
      
      if (year) {
        const movieUrl = `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${q}&primary_release_year=${year}&include_adult=false&language=en-US`;
        const movieRes = await fetch(movieUrl);
        if (movieRes.ok) {
          const movieData = await movieRes.json();
          if (movieData.results && movieData.results.length > 0) {
            r = movieData.results[0];
            r.media_type = 'movie';
          }
        }
      }
      
      if (!r && year) {
        const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${key}&query=${q}&first_air_date_year=${year}&include_adult=false&language=en-US`;
        const tvRes = await fetch(tvUrl);
        if (tvRes.ok) {
          const tvData = await tvRes.json();
          if (tvData.results && tvData.results.length > 0) {
            r = tvData.results[0];
            r.media_type = 'tv';
          }
        }
      }
      
      if (!r) {
        const multiUrl = `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${q}&include_adult=false&language=en-US`;
        const res = await fetch(multiUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        r = (data.results||[])[0];
      }
    }
    
    if (!r) return 'No TMDB result.';
    
    const mediaType = r.media_type || (r.title ? 'movie' : 'tv');
    const name = r.title || r.name || title;
    const year = (r.release_date || r.first_air_date || '').slice(0,4);
    const rating = (typeof r.vote_average === "number") ? r.vote_average.toFixed(1) : 'n/a';
    let overview = r.overview || '';
    
    if (!overview && r.id) {
      const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${r.id}?api_key=${key}&language=en-US`;
      const dres = await fetch(detailsUrl);
      if (dres.ok) { const det = await dres.json(); overview = det.overview || ''; }
    }
    
    if (!overview) overview = 'No summary available.';
    
if (overview.length > 150) {
  overview = overview.substring(0, 147) + '...';
}
    
overview = overview.replace(/\|/g, '&#124;');
    
    const posterPath = r.poster_path || '';
    
    return `[tmdbcard]${name}|${year}|${rating}|${overview}|${posterPath}[/tmdbcard]`;
  } catch(e){ 
    console.error('[summary] TMDB error', e); 
    return `TMDB error: ${e.message||e}`; 
  }
}
async function fetchTMDBCast(title){
  const key = getTMDBKey();
  if (!key) return 'TMDB key missing. Configure your API key first.';
  
  try {
    const imdbMatch = /^tt\d+$/.test(title.trim());
    let movieId, mediaType = 'movie';
    
    if (imdbMatch) {
      const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(title.trim())}?api_key=${key}&external_source=imdb_id`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const r = (data.movie_results||[])[0] || (data.tv_results||[])[0];
      if (!r) return 'No TMDB result.';
      movieId = r.id;
      mediaType = r.media_type || (data.movie_results?.[0] ? 'movie' : 'tv');
    } else {
      const yearMatch = title.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? yearMatch[0] : '';
      let cleanTitle = title;
      
      if (year) {
        cleanTitle = title.replace(/\s*\(?\s*(19|20)\d{2}\s*\)?\s*/g, ' ').trim();
      }
      
      const q = encodeURIComponent(cleanTitle);
      let r;
      
      if (year) {
        const movieUrl = `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${q}&primary_release_year=${year}&include_adult=false&language=en-US`;
        const movieRes = await fetch(movieUrl);
        if (movieRes.ok) {
          const movieData = await movieRes.json();
          if (movieData.results && movieData.results.length > 0) {
            r = movieData.results[0];
            mediaType = 'movie';
          }
        }
      }
      
      if (!r && year) {
        const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${key}&query=${q}&first_air_date_year=${year}&include_adult=false&language=en-US`;
        const tvRes = await fetch(tvUrl);
        if (tvRes.ok) {
          const tvData = await tvRes.json();
          if (tvData.results && tvData.results.length > 0) {
            r = tvData.results[0];
            mediaType = 'tv';
          }
        }
      }
      
      if (!r) {
        const multiUrl = `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${q}&include_adult=false&language=en-US`;
        const res = await fetch(multiUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        r = (data.results||[])[0];
        if (r) mediaType = r.media_type || (r.title ? 'movie' : 'tv');
      }
      
      if (!r) return 'No TMDB result.';
      movieId = r.id;
    }
    
    // Fetch credits
    const creditsUrl = `https://api.themoviedb.org/3/${mediaType}/${movieId}/credits?api_key=${key}`;
    const creditsRes = await fetch(creditsUrl);
    if (!creditsRes.ok) throw new Error(`HTTP ${creditsRes.status}`);
    const creditsData = await creditsRes.json();
    
    const cast = creditsData.cast || [];
    if (!cast.length) return 'No cast information available.';
    
    // Get top 8 cast members
    const top8 = cast.slice(0, 8);
    const castList = top8.map(actor => {
      const character = actor.character ? ` (${actor.character})` : '';
      return `${actor.name}${character}`;
    }).join(', ');
    
    return `col:#87ceeb:Cast: ${castList}`;
  } catch(e){ 
    console.error('[cast] TMDB error', e); 
    return `TMDB error: ${e.message||e}`; 
  }
}
  // ---------- Channel Emotes (for !sm) ----------
  function getChannelEmotes(){
    try {
      if (window.CHANNEL?.emotes) {
        const em = CHANNEL.emotes;
        if (Array.isArray(em)) return em.map(x => x.name || x);
        if (typeof em === 'object') return Object.keys(em);
      }
    } catch(_) {}
    const els = $$("#emotelist img, #emotelist .emote");
    if (els.length) return els.map(el => el.getAttribute('title') || el.getAttribute('alt') || el.dataset?.name).filter(Boolean);
    return [];
  }

  // ---------- Playlist helpers ----------
  function emitVoteSkip(){ try { socket.emit("voteskip"); } catch(_) {} }
  function emitPlayNext(){ try { socket.emit("playNext"); } catch(_) {} }
  function emitBumpLastAfterCurrent(){
    try {
      const items = $$("#queue .queue_entry");
      if (items.length < 2) return "Not enough items to bump.";
      const active = $("#queue .queue_active"); if (!active) return "No active item found.";
      const last = items[items.length-1];
      const fromUid = last.getAttribute("data-uid") || last.dataset?.uid;
      const afterUid = active.getAttribute("data-uid") || active.dataset?.uid;
      if (!fromUid || !afterUid) return "Missing media UID.";
      socket.emit("moveMedia", { from: fromUid, after: afterUid });
      return null;
    } catch(e){ return "Bump failed."; }
  }
  function emitQueueAdd(url){
    try {
      if (typeof window.parseMediaLink === "function") {
        const parsed = parseMediaLink(url);
        if (!parsed) return "Couldn’t parse media link.";
        socket.emit("queue", { id: parsed.id, type: parsed.type, pos: "end", ttl: parsed.title || url });
        return null;
      }
      socket.emit("queue", { id: url, type: "url", pos: "end", ttl: url });
      return null;
    } catch(e){ return "Queue add failed."; }
  }
function canonicalizeYearSuffix(value){
  const input = String(value || "").trim();
  if (!input) return "";
  if (/\(\s*(?:19|20)\d{2}\s*\)\s*$/.test(input)) return input;

  const match = /(?:^|[\s,;:|/-])((?:19|20)\d{2})\s*$/.exec(input);
  if (!match) return input;

  const year = match[1];
  const basePart = input
    .slice(0, match.index)
    .replace(/[\s,;:|/-]+$/, "")
    .trim();

  if (!basePart) return input;

  return `${basePart} (${year})`;
}

function sanitizeTitleForSearch(t){
  if (!t) return "";
  let s = " " + t + " ";

  // Strip bracketed tags like [1080p], (Official Trailer), but keep (YYYY)
  s = s.replace(/\[[^\]]*\]/g, " ");
  s = s.replace(/\(([^)]*)\)/g, (m, inner) => /^\s*\d{4}\s*$/.test(inner) ? m : " ");

  // Common noise tokens
  s = s.replace(/\b(?:official\s*trailer|trailer|teaser|lyrics|mv|amv|full\s*episode|episode\s*\d+|season\s*\d+)\b/gi, " ");
  s = s.replace(/\b(?:\d{3,4}p|[48]k|hdr|dolby(?:\s+vision)?|remaster|extended|uncut|subbed|dubbed)\b/gi, " ");

  // Collapse whitespace
  s = s.replace(/\s{2,}/g, " ").trim();

  // If there is a delimiter like " - " or " | ", prefer left part (often the title)
  const split = s.split(/\s[-–|:]\s/);
  if (split.length > 1 && split[0].length >= 3) s = split[0].trim();

  s = canonicalizeYearSuffix(s);

  return s || t;
}
  // ---------- Command registry ----------
  const REG = new Map();
  function addCommand(name, handler, {desc="", usage="", cooldownMs=800, aliases=[]}={}){
    REG.set(name, {name, handler, desc, usage, cooldownMs, last:0, aliases});
    aliases.forEach(a => REG.set(a, REG.get(name)));
  }
  function listPrimary(){ return Array.from(new Set(Array.from(REG.values()).map(c=>c.name))).sort(); }
  function parseCommand(text){
    if (!text || text.length<2) return null;
    if (text.startsWith("/me ")) return { name:"/me", args:[text.slice(4)] };
    if (text[0] !== "!") return null;
    const parts = text.slice(1).trim().split(/\s+/);
    const name = (parts.shift()||"").toLowerCase();
    return { name, args: parts, raw: text };
  }

  // ---- Commands ----
  addCommand("help", ()=> `Commands: ${listPrimary().map(n=>"!"+n).join(", ")}  —  Click the “?” button below chat for details.`, { desc:"List commands", usage:"!help" });

  addCommand("leaderboard", async ()=>{ await displayLeaderboard(); return ""; }, { desc:"Show trivia leaderboard", usage:"!leaderboard" });
  addCommand("trivia",      async ()=>{ const out=await startTriviaOnce(); return out||""; }, { desc:"Start one trivia question (rank ≥2)", usage:"!trivia" });

  addCommand("summary", async (ctx)=>{
  const raw = ctx.args.length ? ctx.args.join(" ") : getCurrentTitle();
  if (!raw) return "No current title, try: !summary <title>";
  const q = sanitizeTitleForSearch(raw);
  const out = await fetchTMDBSummary(q);
  sendChat(out);
  return "";
}, { desc:"TMDB summary for current or given title", usage:"!summary [title]" });
addCommand("cast", async (ctx)=>{
  const raw = ctx.args.length ? ctx.args.join(" ") : getCurrentTitle();
  if (!raw) return "No current title, try: !cast <title>";
  const q = sanitizeTitleForSearch(raw);
  const out = await fetchTMDBCast(q);
  sendChat(out);
  return "";
}, { desc:"Show cast for current or given title", usage:"!cast [title]" });
  
  addCommand("pick",  (ctx)=>{ const raw=ctx.args.join(" "); const parts=raw.split(/[,|]/).map(s=>s.trim()).filter(Boolean); if (parts.length<2) return "Usage: !pick a, b, c"; sendChat(`🎯 I choose: ${parts[Math.floor(Math.random()*parts.length)]}`); return ""; }, { desc:"Pick randomly", usage:"!pick a, b, c" });
  addCommand("ask",   ()=>{ const a=["Yes.","No.","Maybe.","Probably.","Probably not.","Absolutely.","Definitely not.","Ask again later."]; sendChat(a[Math.floor(Math.random()*a.length)]); return ""; }, { desc:"Magic-8", usage:"!ask <q>" });
  addCommand("time",  ()=>{ const d=new Date(); sendChat(`[${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}]`); return ""; }, { desc:"Current time", usage:"!time" });
  addCommand("dice",  ()=>{ sendChat(`🎲 ${1+Math.floor(Math.random()*5)}`); return ""; }, { desc:"Roll 1–5", usage:"!dice" });
  addCommand("roll",  ()=>{ sendChat(String(Math.floor(Math.random()*1000)).padStart(3,"0")); return ""; }, { desc:"Random 000–999", usage:"!roll" });
  addCommand("skip",  ()=>{ if (!hasRank(2)) return "You lack permission to voteskip."; emitVoteSkip(); return ""; }, { desc:"Vote skip", usage:"!skip" });
  addCommand("next",  ()=>{ if (!hasRank(2)) return "You lack permission to play next."; emitPlayNext(); return ""; }, { desc:"Play next", usage:"!next" });
  addCommand("bump",  ()=>{ if (!hasRank(2)) return "You lack permission to move items."; const e=emitBumpLastAfterCurrent(); return e||""; }, { desc:"Move last after current", usage:"!bump" });
  addCommand("add",   (ctx)=>{ if (!hasRank(2)) return "You lack permission to add."; const url=ctx.args.join(" ").trim(); if (!url) return "Usage: !add <url>"; const e=emitQueueAdd(url); return e||""; }, { desc:"Queue URL", usage:"!add <url>" });
  addCommand("now",   ()=>{ const t=getCurrentTitle(); if (!t) return "No current media."; sendChat(`now: ${t}`); return ""; }, { desc:"Show current title", usage:"!now" });
  addCommand("sm",    ()=>{ const em=getChannelEmotes(); if (!em.length) return "No channel emotes found."; sendChat(em[Math.floor(Math.random()*em.length)]); return ""; }, { desc:"Random channel emote", usage:"!sm" });
  addCommand("/me",   (ctx)=>{ const msg=(ctx.args[0]||"").trim(); if (msg) sendChat(`/me ${msg}`); return ""; });

  // ---------- Input intercept & incoming ----------
  function onEnterIntercept(e){
    try {
      const input = e.currentTarget; if (!input) return;
      if (e.key === "Enter" && !e.shiftKey) {
        const text = input.value.trim();
        const parsed = parseCommand(text);
        if (!parsed) return; // normal message
        const cmd = REG.get(parsed.name);
        if (!cmd) return;
        const t = now();
        if (t - cmd.last < (cmd.cooldownMs||800)) { e.preventDefault(); sysLocal("Command is on cooldown…"); return; }
        cmd.last = t;
        e.preventDefault();
        const ctx = { args: parsed.args, raw: parsed.raw, user: getUser() };
        const res = cmd.handler(ctx);
        if (res instanceof Promise) {
          res.then(msg => { if (typeof msg === "string" && msg) sendChat(msg); })
             .catch(err => sysLocal(String(err)));
        } else if (typeof res === "string" && res) {
          sendChat(res);
        }
        input.value = "";
      }
    } catch(_) {}
  }
  function wireIncoming(){
    try { if (window.socket && socket.on) socket.on("chatMsg", onIncomingChatMsg); } catch(_) {}
  }

  // ---------- Commands UI (in-chat popover, matching Chat Tools / Emotes) ----------
  function injectCmdsCSS(){
    if (document.getElementById("btfw-cmds-css")) return;
    const st = document.createElement("style");
    st.id = "btfw-cmds-css";
    st.textContent = `
      #btfw-cmds-modal .btfw-cmds-card{
        position:absolute; display:flex; flex-direction:column;
        background: linear-gradient(180deg,
          color-mix(in srgb, var(--btfw-color-panel) 90%, transparent 10%),
          color-mix(in srgb, var(--btfw-color-surface) 88%, transparent 12%));
        border:1px solid var(--btfw-border); border-radius:14px;
        box-shadow:0 18px 44px color-mix(in srgb, var(--btfw-color-bg) 34%, transparent 66%);
        color:var(--btfw-color-text); overflow:hidden;
      }
      #btfw-cmds-modal .btfw-cmds-head{
        display:flex; align-items:center; justify-content:space-between;
        padding:10px 12px; font-weight:600; letter-spacing:.2px;
        border-bottom:1px solid var(--btfw-border); flex:0 0 auto;
      }
      #btfw-cmds-modal .btfw-cmds-close{ background:transparent; border:0; color:var(--btfw-color-text); font-size:18px; line-height:1; padding:0 4px; cursor:pointer; }
      #btfw-cmds-modal .btfw-cmds-close:hover{ color:var(--btfw-color-accent); }
      #btfw-cmds-modal .btfw-cmds-hint{ padding:8px 12px 0; font-size:.74rem; color:color-mix(in srgb, var(--btfw-color-text) 60%, transparent); }
      #btfw-cmds-modal .btfw-cmds-body{ padding:6px 8px 8px; overflow-y:auto; flex:1 1 auto; }
      #btfw-cmds-modal .btfw-cmd-row{ display:flex; align-items:baseline; gap:10px; padding:6px 8px; border-radius:8px; cursor:pointer; user-select:none; transition:background .12s ease, transform .06s ease; }
      #btfw-cmds-modal .btfw-cmd-row:hover{ background:color-mix(in srgb, var(--btfw-color-accent) 12%, transparent); }
      #btfw-cmds-modal .btfw-cmd-row:focus-visible{ outline:none; background:color-mix(in srgb, var(--btfw-color-accent) 16%, transparent); box-shadow:0 0 0 2px color-mix(in srgb, var(--btfw-color-accent) 55%, transparent); }
      #btfw-cmds-modal .btfw-cmd-row:active{ transform:translateY(1px); background:color-mix(in srgb, var(--btfw-color-accent) 20%, transparent); }
      #btfw-cmds-modal .btfw-cmd-name{ flex:0 0 auto; color:var(--btfw-color-accent); font-weight:700; font-family:"JetBrains Mono",monospace; font-size:.84rem; }
      #btfw-cmds-modal .btfw-cmd-desc{ color:color-mix(in srgb, var(--btfw-color-text) 82%, transparent); font-size:.84rem; }
    `;
    document.head.appendChild(st);
  }

  function buildCommandsList(){
    return listPrimary().map(name=>{
      const c = REG.get(name);
      const desc  = c?.desc || "";
      const token = name.startsWith("/") ? name : ("!"+name); // /me has no "!"
      const usage = (c?.usage || token).replace(/"/g,"&quot;");
      return `<div class="btfw-cmd-row" role="button" tabindex="0" data-cmd="${token}" title="Click to insert — ${usage}"><code class="btfw-cmd-name">${token}</code><span class="btfw-cmd-desc">${desc}</span></div>`;
    }).join("");
  }

  // Drop a command into the chat input so it's ready to send/edit — we don't
  // auto-send because most commands take args or need a rank.
  function insertCommandToInput(token){
    const input = document.getElementById("chatline");
    if (!input) return;
    input.value = /\s$/.test(token) ? token : (token + " ");
    input.focus();
    try { const L = input.value.length; input.setSelectionRange(L, L); } catch(_){}
    try { input.dispatchEvent(new Event("input", { bubbles:true })); } catch(_){}
  }

  // Shared popover plumbing (open/close/position/reposition/click-outside) all
  // lives in util:chat-popover now — this is the whole UI wiring.
  const cmdsPop = chatPopover.create({
    id: "btfw-cmds-modal",
    cardClass: "btfw-cmds-card",
    opts: { widthPx: 480, widthVw: 92, maxHpx: 440, maxHvh: 66 },
    toggleSelector: "#btfw-chatcmds-btn",
    build: () => {
      injectCmdsCSS();
      return `
        <div class="btfw-cmds-card">
          <div class="btfw-cmds-head">
            <span>Chat Commands</span>
            <button class="btfw-cmds-close" data-btfw-popover-close aria-label="Close">&times;</button>
          </div>
          <div class="btfw-cmds-hint">Click a command to drop it into chat. Some need moderator rank.</div>
          <div class="btfw-cmds-body">${buildCommandsList()}</div>
        </div>`;
    }
  });
  function openCommandsModal(){ cmdsPop.open(); }
  function closeCommandsModal(){ cmdsPop.close(); }
  function cmdsIsOpen(){ return cmdsPop.isOpen(); }

  // Click (or Enter/Space) a command row → insert it into chat, then close the
  // popover and leave focus in the input. Delegated because build() re-creates
  // the rows on every open. Bubble phase, so util:chat-popover's capture-phase
  // outside-click handler (which ignores in-card clicks) doesn't interfere.
  if (!window.__btfwCmdRowWired) {
    window.__btfwCmdRowWired = true;
    const rowFrom = (t) => t && t.closest && t.closest("#btfw-cmds-modal .btfw-cmd-row");
    const useRow = (row) => {
      const token = row.getAttribute("data-cmd");
      if (!token) return;
      insertCommandToInput(token);
      cmdsPop.close();
    };
    document.addEventListener("click", (e)=>{
      const row = rowFrom(e.target); if (row) useRow(row);
    });
    document.addEventListener("keydown", (e)=>{
      if (e.key !== "Enter" && e.key !== " ") return;
      const row = rowFrom(e.target); if (!row) return;
      e.preventDefault(); useRow(row);
    });
  }

  function injectCommandsButton(into){
    if (!into || into._btfwCmdBtn) return false;
    const btn = document.createElement("button");
    btn.id = "btfw-chatcmds-btn";
    btn.className = "button is-dark is-small btfw-chatbtn";
    btn.innerHTML = `<i class="fa fa-question-circle" aria-hidden="true"></i>`;
    btn.title = "Commands";
    btn.addEventListener("click", (e)=>{ e.preventDefault(); cmdsPop.toggle(); });
    into.appendChild(btn);
    into._btfwCmdBtn = true;
    return true;
  }

  function ensureCommandsButton(){
    // Prefer bottom bar
    let placed = false;
    const bottom = $("#btfw-chat-bottombar"); if (bottom) placed = injectCommandsButton(bottom);
    // Fallback to top bar
    if (!placed) { const top = $("#btfw-chat-topbar"); if (top) placed = injectCommandsButton(top); }
    // Last resort: floating inside chatwrap
    if (!placed) {
      const wrap = $("#chatwrap");
      if (wrap && !$("#btfw-chatcmds-float")) {
        const f = document.createElement("div");
        f.id = "btfw-chatcmds-float";
        f.style.position = "absolute"; f.style.right = "8px"; f.style.bottom = "42px"; f.style.zIndex = "1100";
        wrap.appendChild(f);
        injectCommandsButton(f);
      }
    }
  }

  // Observe chat bars if they mount later
  function watchBars(){
    const root = document.body;
    const mo = new MutationObserver(()=>{
      if ($("#btfw-chat-bottombar") || $("#btfw-chat-topbar")) {
        ensureCommandsButton();
      }
    });
    mo.observe(root, { childList:true, subtree:true });
  }

  // ---------- Boot ----------
  function boot(){
    const input = $("#chatline");
    if (input && !input._btfwCmds) { input._btfwCmds = true; input.addEventListener("keydown", onEnterIntercept, true); }
    wireIncoming();
    ensureCommandsButton();
    watchBars();
  }

  document.addEventListener("btfw:layoutReady", ()=> setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:chat-commands" };
});







