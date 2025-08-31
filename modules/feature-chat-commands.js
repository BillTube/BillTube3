/* BTFW — feature:chat-commands (BillTube2-compatible + full command set)
   Includes:
     Trivia (Cloudflare Worker + OpenTDB) — same flow as BillTube2
     !leaderboard, !pick, !summary, !ask, !time, !dice (1–5), !roll (000–999),
     !skip (voteskip), !next (play next), !bump (move last after current),
     !add <url> (queue media), !now (current title), !sm (random channel emote)
   Also:
     - Intercepts Enter for "!" commands (but doesn’t affect normal messages)
     - Injects a "Commands" button into #btfw-chat-bottombar
     - Shows a Bulma-style modal with the command list (descriptions & usages)
*/
BTFW.define("feature:chat-commands", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  // ---------------- Utilities ----------------
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
  function getRank(){ try { return (window.CLIENT && CLIENT.rank|0) || 0; } catch(_) { return 0; } }
  function hasRank(min){ return getRank() >= min; }
  function clamp(n,a,b){ return Math.min(b, Math.max(a, n)); }
  const now = ()=>Date.now();

  // Normalize string for comparisons
  function norm(s){ return String(s||"").toLowerCase().replace(/['".,;:!?()\[\]{}]/g,"").replace(/\s+/g," ").trim(); }

  // Current media title (robust)
  function getCurrentTitle(){
    const a = $(".queue_active a");
    if (a && a.textContent) return a.textContent.trim();
    const nowPlaying = $("#currenttitle"); // your feature-nowplaying
    if (nowPlaying && nowPlaying.textContent) return nowPlaying.textContent.trim();
    const titleMeta = document.querySelector('meta[property="og:title"]');
    if (titleMeta && titleMeta.content) return titleMeta.content.trim();
    return "";
  }

  // --------------- Trivia (BillTube2-compatible) ---------------
  const workerUrl    = 'https://trivia-worker.billtube.workers.dev';
  const triviaAPIUrl = 'https://opentdb.com/api.php?amount=1&type=multiple';

  let triviaActive    = false;
  let correctAnswer   = '';
  let answeredUsers   = new Set();
  let triviaTimeoutId = null;

  function decodeHTMLEntities(text){
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }
  function stylizeUsername(username){
    const map = {'a':'𝐚','b':'𝐛','c':'𝐜','d':'𝐝','e':'𝐞','f':'𝐟','g':'𝐠','h':'𝐡','i':'𝐢','j':'𝐣','k':'𝐤','l':'𝐥','m':'𝐦','n':'𝐧','o':'𝐨','p':'𝐩','q':'𝐪','r':'𝐫','s':'𝐬','t':'𝐭','u':'𝐮','v':'𝐯','w':'𝐰','x':'𝐱','y':'𝐲','z':'𝐳','A':'𝐀','B':'𝐁','C':'𝐂','D':'𝐃','E':'𝐄','F':'𝐅','G':'𝐆','H':'𝐇','I':'𝐈','J':'𝐉','K':'𝐊','L':'𝐋','M':'𝐌','N':'𝐍','O':'𝐎','P':'𝐏','Q':'𝐐','R':'𝐑','S':'𝐒','T':'𝐓','U':'𝐔','V':'𝐕','W':'𝐖','X':'𝐗','Y':'𝐘','Z':'𝐙'};
    return String(username||"").split('').map(ch => map[ch] || ch).join('');
  }
  async function updateScore(username){
    try {
      await fetch(`${workerUrl}/updateScore`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ username })
      });
    } catch(e){ console.error('[trivia] updateScore failed:', e); }
  }
  async function displayLeaderboard(){
    try {
      const res = await fetch(`${workerUrl}/leaderboard`);
      const leaderboard = await res.json(); // [{ username, score }]
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
        const all = [...q.incorrect_answers, q.correct_answer].map(decodeHTMLEntities);
        all.sort(() => Math.random() - 0.5);
        const colors = ["#ffa500","#ff4500","#1e90ff","#32cd32"];
        const colored = all.map((ans,i)=>`col:${colors[i%colors.length]}:${ans}`);
        const question = decodeHTMLEntities(q.question);
        return `🎬 [code]Trivia: ${question}[/code] \nOptions: ${colored.join(', ')}`;
      }
      return '[i]No trivia question available at the moment.[/i]';
    } catch(e){
      console.error('[trivia] OpenTDB error:', e);
      return 'Error fetching trivia question. Please try again later.';
    }
  }
  async function startTriviaOnce(){
    if (!hasRank(2)) return 'col:#a52a2a:You do not have permission to start a trivia question.';
    if (triviaActive) return 'col:#a52a2a:A trivia question is already active!';
    const q = await fetchTriviaQuestion();
    triviaActive = true;
    answeredUsers.clear();
    sendChat('!trivia');
    sendChat(q);
    clearTimeout(triviaTimeoutId);
    triviaTimeoutId = setTimeout(()=>{
      if (triviaActive) {
        triviaActive = false;
        sendChat(`col:#a52a2a:⏰ Time's up! The correct answer was: ${correctAnswer}`);
      }
    }, 30000);
    return '';
  }
  function onIncomingChatMsg(data){
    try {
      const username = data?.username || '';
      const message  = (data?.msg || '').trim();
      if (!triviaActive || !username || !message) return;
      if (answeredUsers.has(username)) return;
      if (message.toLowerCase() === correctAnswer) {
        answeredUsers.add(username);
        triviaActive = false;
        clearTimeout(triviaTimeoutId);
        updateScore(username).then(()=> displayLeaderboard()).catch(()=>{});
        sendChat(`col:#008000:🎉 ${username} got the right answer! Their score has been updated.`);
      }
    } catch(e){ console.error('[trivia] incoming error:', e); }
  }

  // --------------- TMDB summary ---------------
 function getTMDBKey(){
  // Priority:
  // 1) window.BTFW_CONFIG.tmdbKey (channel-supplied, “nice” way)
  // 2) localStorage("btfw:tmdb:key") (per-user)
  // 3) legacy globals (compat with old themes / quick tests)
  //    window.TMDB_API_KEY / window.BTFW_TMDB_KEY / window.tmdb_key
  // 4) <body data-tmdb-key="..."> (optional)
  try {
    // 1) Namespaced config
    const k1 = (window.BTFW_CONFIG && typeof window.BTFW_CONFIG.tmdbKey === "string")
      ? window.BTFW_CONFIG.tmdbKey.trim() : "";

    // 2) LocalStorage
    let k2 = "";
    try { k2 = (localStorage.getItem("btfw:tmdb:key") || "").trim(); } catch(_) {}

    // 3) Legacy globals (accept string or number)
    const g = (v)=> (v==null ? "" : String(v)).trim();
    const k3 = g(window.TMDB_API_KEY) || g(window.BTFW_TMDB_KEY) || g(window.tmdb_key);

    // 4) data attribute
    const k4 = (document.body && document.body.dataset && document.body.dataset.tmdbKey)
      ? document.body.dataset.tmdbKey.trim() : "";

    const key = k1 || k2 || k3 || k4;
    return key || null;
  } catch(_) {
    return null;
  }
}

  async function fetchTMDBSummary(title){
    const key = getTMDBKey();
    if (!key) return 'TMDB API key not configured. Set it with localStorage.setItem("btfw:tmdb:key","YOUR_KEY").';
    try {
      const q = encodeURIComponent(title);
      const url = `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${q}&include_adult=false&language=en-US`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const r = (data.results||[])[0];
      if (!r) return 'No TMDB result.';
      const mediaType = r.media_type || (r.title?'movie':'tv');
      const name = r.title || r.name || title;
      const year = (r.release_date || r.first_air_date || '').slice(0,4);
      const rating = (typeof r.vote_average==="number") ? r.vote_average.toFixed(1) : 'n/a';
      // Fetch details for overview if missing
      let overview = r.overview || '';
      if (!overview && r.id) {
        const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${r.id}?api_key=${key}&language=en-US`;
        const dres = await fetch(detailsUrl);
        if (dres.ok) {
          const det = await dres.json();
          overview = det.overview || '';
        }
      }
      if (!overview) overview = 'No summary available.';
      // BillTube2-style formatting (code block for title)
      return `col:#87ceeb:[code]${name}${year?` (${year})`:''}[/code] — ★ ${rating}\n${overview}`;
    } catch(e){
      console.error('[summary] TMDB error', e);
      return `TMDB error: ${e.message||e}`;
    }
  }

  // --------------- Channel Emotes (for !sm) ---------------
  function getChannelEmotes(){
    // CyTube stores emotes in CHANNEL.emotes (varies by install)
    try {
      if (window.CHANNEL?.emotes) {
        // Accept array or object
        const em = CHANNEL.emotes;
        if (Array.isArray(em)) return em.map(x => x.name || x);
        if (typeof em === 'object') return Object.keys(em);
      }
    } catch(_) {}
    // Fallback: scrape the emote list in DOM if present
    const els = $$("#emotelist img, #emotelist .emote");
    if (els.length) {
      return els.map(el => el.getAttribute('title') || el.getAttribute('alt') || el.dataset?.name).filter(Boolean);
    }
    return [];
  }

  // --------------- Playlist helpers (bump/add/next/skip) ---------------
  function emitVoteSkip(){ try { socket.emit("voteskip"); } catch(_) {} }
  function emitPlayNext(){ try { socket.emit("playNext"); } catch(_) {} }

  // move last queue item after the current active item (server enforces perms)
  function emitBumpLastAfterCurrent(){
    try {
      const items = $$("#queue .queue_entry");
      if (items.length < 2) return "Not enough items to bump.";
      const active = $("#queue .queue_active");
      if (!active) return "No active item found.";
      const last = items[items.length-1];
      const fromUid = last.getAttribute("data-uid") || last.dataset?.uid;
      const afterUid = active.getAttribute("data-uid") || active.dataset?.uid;
      if (!fromUid || !afterUid) return "Missing media UID.";
      socket.emit("moveMedia", { from: fromUid, after: afterUid });
      return null;
    } catch(e){ return "Bump failed."; }
  }

  // Add a URL to the end of the queue
  function emitQueueAdd(url){
    try {
      if (typeof window.parseMediaLink === "function") {
        const parsed = parseMediaLink(url);
        if (!parsed) return "Couldn’t parse media link.";
        socket.emit("queue", {
          id: parsed.id, type: parsed.type, pos: "end",
          ttl: parsed.title || url
        });
        return null;
      }
      // Fallback: try straight URL (server may reject)
      socket.emit("queue", { id: url, type: "url", pos: "end", ttl: url });
      return null;
    } catch(e){ return "Queue add failed."; }
  }

  // --------------- Command Registry ---------------
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

  // ---- Core commands ----
  addCommand("help", ()=>{
    const names = listPrimary();
    return `Commands: ${names.map(n=>"!"+n).join(", ")}  —  Click the “?” button below chat for details.`;
  }, { desc:"List available commands", usage:"!help" });

  addCommand("leaderboard", async ()=>{ await displayLeaderboard(); return ""; }, {
    desc:"Show trivia leaderboard (Cloudflare)", usage:"!leaderboard"
  });

  addCommand("trivia", async ()=>{
    const out = await startTriviaOnce();
    return out || ""; // already posted
  }, { desc:"Start one trivia question (rank ≥2)", usage:"!trivia" });

  addCommand("pick", (ctx)=>{
    const raw = ctx.args.join(" ");
    const parts = raw.split(/[,|]/).map(s=>s.trim()).filter(Boolean);
    if (parts.length<2) return "Usage: !pick a, b, c";
    const pick = parts[Math.floor(Math.random()*parts.length)];
    sendChat(`🎯 I choose: ${pick}`);
    return "";
  }, { desc:"Pick randomly among options", usage:"!pick a, b, c" });

  addCommand("ask", (ctx)=>{
    const answers = ["Yes.","No.","Maybe.","Probably.","Probably not.","Absolutely.","Definitely not.","Ask again later."];
    const a = answers[Math.floor(Math.random()*answers.length)];
    sendChat(a);
    return "";
  }, { desc:"Magic 8-ball style answer", usage:"!ask <question>" });

  addCommand("time", ()=>{
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    sendChat(`[${hh}:${mm}]`);
    return "";
  }, { desc:"Show current time", usage:"!time" });

  // BillTube2 quirk: dice 1–5
  addCommand("dice", ()=>{
    const v = 1 + Math.floor(Math.random()*5);
    sendChat(`🎲 ${v}`);
    return "";
  }, { desc:"Roll a die (1–5)", usage:"!dice" });

  // BillTube2: roll 000–999 zero-padded
  addCommand("roll", ()=>{
    const v = Math.floor(Math.random()*1000);
    sendChat(String(v).padStart(3,"0"));
    return "";
  }, { desc:"Random 3-digit number", usage:"!roll" });

  addCommand("skip", ()=>{
    if (!hasRank(2)) return "You lack permission to voteskip.";
    emitVoteSkip();
    return "";
  }, { desc:"Vote to skip", usage:"!skip" });

  addCommand("next", ()=>{
    if (!hasRank(2)) return "You lack permission to play next.";
    emitPlayNext();
    return "";
  }, { desc:"Play next item", usage:"!next" });

  addCommand("bump", ()=>{
    if (!hasRank(2)) return "You lack permission to move playlist items.";
    const e = emitBumpLastAfterCurrent();
    return e || "";
  }, { desc:"Move last queue item after current", usage:"!bump" });

  addCommand("add", (ctx)=>{
    if (!hasRank(2)) return "You lack permission to add to playlist.";
    const url = ctx.args.join(" ").trim();
    if (!url) return "Usage: !add <url>";
    const e = emitQueueAdd(url);
    return e || "";
  }, { desc:"Queue a URL to end", usage:"!add <url>" });

  addCommand("now", ()=>{
    const t = getCurrentTitle();
    if (!t) return "No current media.";
    sendChat(`now: ${t}`);
    return "";
  }, { desc:"Show currently playing title", usage:"!now" });

  addCommand("sm", ()=>{
    const em = getChannelEmotes();
    if (!em.length) return "No channel emotes found.";
    const pick = em[Math.floor(Math.random()*em.length)];
    sendChat(pick);
    return "";
  }, { desc:"Post a random channel emote", usage:"!sm" });

  // Native /me passthrough
  addCommand("/me", (ctx)=>{ const msg=(ctx.args[0]||"").trim(); if (msg) sendChat(`/me ${msg}`); return ""; });

  // --------------- Input intercept & incoming ---------------
  function onEnterIntercept(e){
    try {
      const input = e.currentTarget;
      if (!input) return;
      if (e.key === "Enter" && !e.shiftKey) {
        const text = input.value.trim();
        const parsed = parseCommand(text);
        if (!parsed) return; // let normal chat through
        const cmd = REG.get(parsed.name);
        if (!cmd) return;    // unknown → let through
        const t = now();
        if (t - cmd.last < (cmd.cooldownMs||800)) {
          e.preventDefault(); sysLocal("Command is on cooldown…"); return;
        }
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
    try {
      if (window.socket && socket.on) {
        socket.on("chatMsg", onIncomingChatMsg);
      }
    } catch(_) {}
  }

  // --------------- Commands modal & button -----------------
  function ensureCommandsButton(){
    const bar = document.getElementById("btfw-chat-bottombar");
    if (!bar || bar._btfwCmdBtn) return;
    const btn = document.createElement("button");
    btn.id = "btfw-chatcmds-btn";
    btn.className = "button is-dark is-small btfw-chatbtn";
    btn.innerHTML = `<i class="fa fa-question-circle"></i>`;
    btn.title = "Commands";
    btn.addEventListener("click", (e)=>{ e.preventDefault(); openCommandsModal(); });
    bar.appendChild(btn);
    bar._btfwCmdBtn = true;
  }

  function buildCommandsTable(){
    const rows = listPrimary().map(name=>{
      const c = REG.get(name);
      const desc  = c?.desc || "";
      const usage = c?.usage || ("!" + name);
      return `<tr><td><code>!${name}</code></td><td>${desc}</td><td><code>${usage}</code></td></tr>`;
    }).join("");
    return `
      <div class="content">
        <p>Type these in chat. Some require moderator permissions.</p>
        <div class="table-container">
          <table class="table is-fullwidth is-striped is-narrow">
            <thead><tr><th>Command</th><th>Description</th><th>Usage</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function ensureCommandsModal(){
    let m = $("#btfw-cmds-modal");
    if (m) return m;
    m = document.createElement("div");
    m.id = "btfw-cmds-modal";
    m.className = "modal";
    m.innerHTML = `
      <div class="modal-background"></div>
      <div class="modal-card btfw-modal">
        <header class="modal-card-head">
          <p class="modal-card-title">Chat Commands</p>
          <button class="delete" aria-label="close"></button>
        </header>
        <section class="modal-card-body">
          ${buildCommandsTable()}
        </section>
        <footer class="modal-card-foot">
          <button class="button is-link" id="btfw-cmds-close">Close</button>
        </footer>
      </div>`;
    document.body.appendChild(m);
    $(".modal-background", m).addEventListener("click", ()=> m.classList.remove("is-active"));
    $(".delete", m).addEventListener("click", ()=> m.classList.remove("is-active"));
    $("#btfw-cmds-close", m).addEventListener("click", ()=> m.classList.remove("is-active"));
    return m;
  }
  function openCommandsModal(){
    const m = ensureCommandsModal();
    // Refresh contents in case registry changed:
    const body = m.querySelector(".modal-card-body");
    if (body) body.innerHTML = buildCommandsTable();
    m.classList.add("is-active");
  }

  // --------------- Boot ---------------
  function boot(){
    // Input intercept
    const input = $("#chatline");
    if (input && !input._btfwCmds) {
      input._btfwCmds = true;
      input.addEventListener("keydown", onEnterIntercept, true);
    }
    wireIncoming();
    ensureCommandsButton();
  }

  // Layout ready hook improves reliability
  document.addEventListener("btfw:layoutReady", ()=> setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:chat-commands" };
});
