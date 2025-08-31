/* BTFW — feature:chat-commands (BillTube2-compatible trivia)
   - Trivia uses the same Cloudflare Worker + OpenTDB flow as BillTube2
   - Commands:
       !trivia          → start one question (rank >= 2)
       !leaderboard     → fetch and print scores
       !help            → list commands
   - Behavior:
       * Posts a question + colorized options to chat
       * 30s timer; "Time's up" message with correct answer
       * First user with exact (case-insensitive) correct answer wins
       * Updates score via Worker and prints leaderboard
*/

BTFW.define("feature:chat-commands", [], async () => {
  const $ = (s,r=document)=>r.querySelector(s);

  // --- Config copied from BillTube2 ---
  const workerUrl    = 'https://trivia-worker.billtube.workers.dev';
  const triviaAPIUrl = 'https://opentdb.com/api.php?amount=1&type=multiple';

  // --- State (mirrors old theme) ---
  let triviaActive    = false;
  let correctAnswer   = '';
  let answeredUsers   = new Set();
  let triviaTimeoutId = null;

  // --- Utils (copied behavior) ---
  function sendChat(msg) {
    try { if (window.socket?.emit) { socket.emit("chatMsg", { msg }); return true; } } catch(e){}
    return false;
  }
  function decodeHTMLEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }
  function stylizeUsername(username) {
    const map = {
      'a':'𝐚','b':'𝐛','c':'𝐜','d':'𝐝','e':'𝐞','f':'𝐟','g':'𝐠','h':'𝐡','i':'𝐢','j':'𝐣','k':'𝐤','l':'𝐥',
      'm':'𝐦','n':'𝐧','o':'𝐨','p':'𝐩','q':'𝐪','r':'𝐫','s':'𝐬','t':'𝐭','u':'𝐮','v':'𝐯','w':'𝐰','x':'𝐱','y':'𝐲','z':'𝐳',
      'A':'𝐀','B':'𝐁','C':'𝐂','D':'𝐃','E':'𝐄','F':'𝐅','G':'𝐆','H':'𝐇','I':'𝐈','J':'𝐉','K':'𝐊','L':'𝐋',
      'M':'𝐌','N':'𝐍','O':'𝐎','P':'𝐏','Q':'𝐐','R':'𝐑','S':'𝐒','T':'𝐓','U':'𝐔','V':'𝐕','W':'𝐖','X':'𝐗','Y':'𝐘','Z':'𝐙'
    };
    return String(username||"").split('').map(ch => map[ch] || ch).join('');
  }

  async function updateScore(username){
    try {
      await fetch(`${workerUrl}/updateScore`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ username })
      });
    } catch (e) {
      console.error('[trivia] updateScore failed:', e);
    }
  }

  async function displayLeaderboard(){
    try {
      const res = await fetch(`${workerUrl}/leaderboard`);
      const leaderboard = await res.json(); // [{ username, score }, ...]
      let message = '🎉 Leaderboard:\n';
      leaderboard.forEach(({ username, score }) => {
        message += `${stylizeUsername(username)}: ${score} points\n`;
      });
      sendChat(message);
    } catch (e) {
      console.error('[trivia] leaderboard failed:', e);
    }
  }

  // Pull 1 OpenTDB question; build the colored options string like BillTube2
  async function fetchTriviaQuestion(){
    try {
      const response = await fetch(triviaAPIUrl);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const q = data.results[0];
        correctAnswer = decodeHTMLEntities(q.correct_answer.toLowerCase());

        const all = [...q.incorrect_answers, q.correct_answer];
        const decoded = all.map(a => decodeHTMLEntities(a));
        // Shuffle like old theme
        decoded.sort(() => Math.random() - 0.5);

        // BillTube2 color set (rotating):
        const colors = ["#ffa500", "#ff4500", "#1e90ff", "#32cd32"];
        const coloredAnswers = decoded.map((ans, i) => `col:${colors[i % colors.length]}:${ans}`);

        const question = decodeHTMLEntities(q.question);
        // Matches BillTube2’s text formatting:
        return `🎬 [code]Trivia: ${question}[/code] \nOptions: ${coloredAnswers.join(', ')}`;
      } else {
        return '[i]No trivia question available at the moment.[/i]';
      }
    } catch (e) {
      console.error('[trivia] OpenTDB error:', e);
      return 'Error fetching trivia question. Please try again later.';
    }
  }

  // Start a single question (rank >= 2), just like BillTube2’s !trivia
  async function startTriviaOnce(){
    try {
      if ((window.CLIENT?.rank|0) < 2) {
        return 'col:#a52a2a:You do not have permission to start a trivia question.';
      }
      if (triviaActive) {
        return 'col:#a52a2a:A trivia question is already active!';
      }

      const triviaQuestion = await fetchTriviaQuestion();
      triviaActive = true;
      answeredUsers.clear();

      // Old theme posted a marker and then the actual question/options:
      sendChat('!trivia');
      sendChat(triviaQuestion);

      // 30 second window
      clearTimeout(triviaTimeoutId);
      triviaTimeoutId = setTimeout(() => {
        if (triviaActive) {
          triviaActive = false;
          sendChat(`col:#a52a2a:⏰ Time's up! The correct answer was: ${correctAnswer}`);
        }
      }, 30000);

      return ''; // BillTube2 returned an empty string (message already posted above)
    } catch (e) {
      console.error('[trivia] start error:', e);
      return 'Error starting trivia. Please try again later.';
    }
  }

  // Check answers on every chat message (any user can answer)
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
        // Update score remotely and announce
        updateScore(username).then(()=> displayLeaderboard()).catch(()=>{});
        sendChat(`col:#008000:🎉 ${username} got the right answer! Their score has been updated.`);
      }
    } catch (e) {
      console.error('[trivia] onIncomingChatMsg error:', e);
    }
  }

  // --- Command router (minimal; mirrors BillTube2 usage pattern) ---
  const COMMANDS = {
    '!trivia': {
      desc: 'Start a trivia question',
      async run(){ return await startTriviaOnce(); }
    },
    '!leaderboard': {
      desc: 'Display the current trivia leaderboard',
      async run(){ await displayLeaderboard(); return 'Leaderboard displayed!'; }
    },
    '!help': {
      desc: 'List commands',
      run(){
        const list = Object.keys(COMMANDS).join(', ');
        return `Commands: ${list}`;
      }
    }
  };

  async function tryRunCommand(text){
    const key = text.split(/\s+/)[0].toLowerCase();
    const cmd = COMMANDS[key];
    if (!cmd) return null;
    const out = await cmd.run(text);
    // In BillTube2, the command handler returns a string to be sent as chat by the caller.
    // If you’re using an upstream “prepareMessage” chain, returning a string is compatible.
    return (typeof out === 'string') ? out : '';
  }

  // If your chat pipeline calls this feature explicitly, you can export `handleOutgoing`.
  // Otherwise, we also bind to Enter on #chatline (non-invasive; only when prefixed).
  async function handleOutgoing(raw){
    const trimmed = (raw||'').trim();
    if (!trimmed) return raw;
    if (!trimmed.startsWith('!')) return raw;            // not a command
    const res = await tryRunCommand(trimmed);
    return (res === null) ? raw : res;                   // null → unknown command; let it pass
  }

  // --- Bindings ---
  // Intercept Enter locally if no upstream prepareMessage pipeline exists.
  function bindInputIntercept(){
    const input = $('#chatline');
    if (!input || input._btfwCmds) return;
    input._btfwCmds = true;
    input.addEventListener('keydown', async (e)=>{
      if (e.key === 'Enter' && !e.shiftKey) {
        const text = input.value.trim();
        if (!text.startsWith('!')) return;           // not our command
        const res = await tryRunCommand(text);
        if (res !== null) {
          e.preventDefault();
          if (res) sendChat(res);                    // if handler returned a message, send it
          input.value = '';
        }
      }
    }, true);
  }

  function bindIncoming(){
    try {
      if (window.socket && socket.on) {
        socket.on('chatMsg', onIncomingChatMsg);
      }
    } catch (_) {}
  }

  // --- Boot ---
  function boot(){
    bindInputIntercept();
    bindIncoming();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return {
    name: 'feature:chat-commands',
    handleOutgoing // exposed if your pipeline wants to call it
  };
});
