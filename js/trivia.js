// ============================================================================
//  trivia.js — the Trivia1v1 game
//
//  THE FLOW (online 1v1 — question by question, in sync):
//    tap "Find Match"  ->  Supabase pairs us with a stranger
//    both players see the SAME question, 15 seconds each
//    you answer (or the clock runs out) -> the server records it
//    the round only advances when BOTH players have answered — the first
//    to answer waits ("Waiting for <opponent>…") until the second one
//    does, then BOTH phones move to the next question together (Realtime
//    "round" event + a 1.5s poll as the safety net)
//    at the end, the database decides the winner and moves trophies
//
//  HOW THE "LIVE" PART WORKS:
//    each player subscribes to Realtime changes on the match row
//    ("match-<id>"). Answers are validated and scored server-side
//    (match_answers); the client never sends scores.
//
//  Practice vs. the visible QuizBot stays self-paced (no sync, no match row).
// ============================================================================

const QUESTION_SECONDS = 15;
const QUESTIONS_PER_MATCH = 10;
const MEDAL_ICONS = ["assets/icons/medal-1.svg", "assets/icons/medal-2.svg", "assets/icons/medal-3.svg"];

// how long we wait for a human opponent before switching to QuizBot
const HUMAN_SEARCH_SECONDS = 7;

// ---- stealth-bot name generator ------------------------------------------
// Generates human-looking names like "SwiftFox_namer427834" so the disguised bot
// is indistinguishable from a real player in the UI.
const _botAdjectives = ["Swift","Clever","Brave","Lucky","Quick","Sharp","Bold","Cool","Epic","Wild","Calm","Keen","Sly","Ace","Pro","Top","Max","Zen","Star","Nova","Pixel","Turbo","Frost","Blaze","Shadow","Ghost","Phantom","Cosmic","Lunar","Solar"];
const _botNouns = ["Fox","Wolf","Bear","Hawk","Lynx","Tiger","Eagle","Shark","Panther","Viper","Cobra","Raven","Storm","Phoenix","Titan","Ninja","Dragon","Wizard","Hunter","Rider","Pilot","Runner","Diver","Climber","Maverick","Rebel","Legend","King","Queen","Knight"];

function generateBotName() {
  const adj = _botAdjectives[randomInt(_botAdjectives.length)];
  const noun = _botNouns[randomInt(_botNouns.length)];
  const n1 = randomInt(900) + 100;  // 100-999
  const n2 = randomInt(9000) + 1000; // 1000-9999
  return adj + noun + "_namer" + n1 + n2;
}

// all of the game's variables live in one object (like a struct)
let triviaState = {
  mode: null,        // 'online' = real match | 'bot' = practice
  casual: false,     // true for friend 1v1 duels (no trophy change)
  matchId: null,
  iAmPlayer1: true,  // which side of the match am I?
  questions: [],     // the 10 questions for this match
  qIndex: 0,         // which question we are on (0..9)
  myScore: 0,
  oppScore: 0,
  streak: 0,         // consecutive correct answers in a row
  oppName: "…",
  oppAvatar: "?",
  botDiff: "medium", // easy | medium | hard (practice mode)
  botChance: 0.55,   // bot answer-correctness chance (from bot_config)
  botDelay: 1600,    // bot "thinking" delay in ms (from bot_config)
  answered: false,   // have we picked an answer this question?
  // sync 1v1 (online matches): the round only advances when BOTH players
  // have answered the current question — these fields drive that state machine
  waiting: false,    // true while we wait on the opponent after answering
  syncPoll: null,    // the 1.5s poll that nudges + watches the round (fallback under Realtime)
  revealTimer: null, // the post-answer reveal pause before advancing (second answerer)
  myAnswers: {},     // question_id → correct, for resuming after a reload mid-match
  stream: null,      // the live Realtime subscription for this match / queue
  pendingAnswer: null, // the in-flight /api/trivia/answer call (awaited before finishing)
  timer: null,       // the per-question countdown
  starting: false,   // guard so the match can't start twice (concurrency)
  started: false,    // true once the match has begun — stops the queue poller
                     // from re-triggering and wiping the score back to question 1
  opponentFound: false, // a human joined our queue — never fall back to QuizBot
  fallbackTimer: null,  // the 7-second human-search timer (queue)
  queueTimer: null,     // the per-second countdown tick on the queue screen
  ending: false,        // guard so the match ends exactly once (for BOTH players)
  botFallback: false,   // this game started because no human was found (visible QuizBot)
  stealthBot: false,    // this online match's opponent is a DISGUISED bot (looks human)
  botStreak: 0,         // the invisible opponent's current answer streak (streak scoring)
  botTimer: null,       // the invisible opponent's independent per-question "brain"
  botAnsweredThisQ: false, // has QuizBot already answered this question? (practice only)
  lastWinner: null,  // for the result screen
  lastDelta: 0,
  lastOnline: false,
  lastRanked: false, // did the database actually move trophies?
};

// ============================================================================
//  MATCHMAKING  (tap "Find Match")
//
//  Humans get HUMAN_SEARCH_SECONDS to queue up at the same time as us. If
//  nobody joins in that window, we secretly match a skill-matched bot that
//  looks exactly like a human — no "QuizBot" anywhere in this flow.
// ============================================================================

function setQueueStatus(text) {
  const el = document.getElementById("queue-status");
  if (el) el.textContent = text;
}

function clearQueueCountdown() {
  if (triviaState.queueTimer) {
    clearInterval(triviaState.queueTimer);
    triviaState.queueTimer = null;
  }
}

function clearQueueTimers() {
  if (triviaState.fallbackTimer) {
    clearTimeout(triviaState.fallbackTimer);
    triviaState.fallbackTimer = null;
  }
  clearQueueCountdown();
}

// count the search window down on the queue screen
function startQueueCountdown() {
  clearQueueCountdown();
  let left = HUMAN_SEARCH_SECONDS;
  setQueueStatus(Settings.tf("match.searching_human", {n: left}));
  triviaState.queueTimer = setInterval(function () {
    left -= 1;
    if (left > 0) setQueueStatus(Settings.tf("match.searching_human", {n: left}));
    else {
      clearQueueCountdown();
      setQueueStatus(Settings.t("match.opponent_starting"));
    }
  }, 1000);
}

function triviaFindMatch() {
  setError("trivia-error", "");
  go("screen-trivia-queue");
  triviaState.mode = "online";
  triviaState.casual = false;
  triviaState.started = false;
  triviaState.ending = false;
  triviaState.botFallback = false;
  triviaState.stealthBot = false;
  triviaState.opponentFound = false;
  triviaState.myAnswers = {};
  clearQueueTimers();
  startQueueCountdown();

  // ask Supabase: join an existing waiting match, or create a new one.
  // the database also picks the 10 questions (so both players get the same ones)
  API.call("/api/trivia/join", { method: "POST", body: {} })
    .then(function (data) {
      triviaState.matchId = data.match_id;

      // live: Realtime pings us the moment the match goes active
      closeStream();
      triviaState.stream = API.stream("queue-" + triviaState.matchId, function (ev) {
        if (ev.type === "match_active") triviaStartMatch(triviaState.matchId);
      });

      // safety net: also poll the match row in case the stream hiccups
      triviaPollForOpponent(0);

      // no human in the window? fall back to QuizBot
      triviaState.fallbackTimer = setTimeout(function () {
        if (triviaState.opponentFound || triviaState.started) return;
        triviaFallbackToBot();
      }, HUMAN_SEARCH_SECONDS * 1000);
    })
    .catch(function (err) {
      clearQueueTimers();
      setError("trivia-error", Settings.tf("error.couldnt_join", {msg: err.message}));
      go("screen-trivia-home");
    });
}

// keep checking whether an opponent has joined (up to ~60 seconds — or ~90
// seconds for a friend challenge). `onGiveUp` lets the caller decide what
// happens when the wait runs out: the friends tab expires the challenge in
// place instead of bailing to the home screen.
function triviaPollForOpponent(attempt, onGiveUp) {
  if (!triviaState.matchId || triviaState.mode !== "online") return;
  if (triviaState.started || triviaState.stealthBot) return; // a match already took over
  if (attempt > (triviaState.casual ? 60 : 40)) {
    if (typeof onGiveUp === "function") { onGiveUp(); return; }
    // give up quietly: go home and show the message there
    setError("trivia-error", triviaState.casual
      ? Settings.t("error.friend_no_accept")
      : Settings.t("error.no_opponent"));
    triviaCancelQueue();
    return;
  }
  setTimeout(function () {
    API.call("/api/trivia/match/" + triviaState.matchId)
      .then(function (data) {
        if (data.match && data.match.status === "active") triviaStartMatch(triviaState.matchId);
        else triviaPollForOpponent(attempt + 1);
      })
      .catch(function () { triviaPollForOpponent(attempt + 1); });
  }, 1500);
}

// no human joined within the 7-second window — secretly pair the player with
// a skill-matched bot that is indistinguishable from a human: real-looking
// name + avatar, a REAL 'active' match row, and real trophy movement. The
// only thing that's fake is who is on the other side (stealth-bots.sql).
async function triviaFallbackToBot() {
  if (triviaState.opponentFound || triviaState.started || triviaState.mode !== "online") return;

  // atomically leave the queue — unless a human JUST joined it, in which
  // case the database hands the match back and we play that human instead
  try {
    const res = await API.call("/api/trivia/cancel", { method: "POST", body: {} });
    if (triviaState.mode !== "online") return; // cancelled while we looked
    if (res && res.match_id) {
      await triviaStartMatch(res.match_id);
      return;
    }
  } catch (e) { /* leave the row; it ages out on its own */ }

  // a human match may have started through the stream while we were
  // deciding — don't stomp on it
  if (triviaState.mode !== "online" || triviaState.started || triviaState.opponentFound) return;

  // create a real match against a disguised bot whose skill follows OUR
  // trophies — the normal online flow (and finish_match) makes it look real
  try {
    const res = await API.call("/api/trivia/botmatch", { method: "POST", body: {} });
    if (triviaState.mode !== "online" || triviaState.started || triviaState.opponentFound) return;
    if (!res || !res.match_id) throw new Error("No bot opponent available");
    triviaState.stealthBot = true;    // disguise: the bot's answers are rolled server-side (submit_answer)
    triviaState.opponentFound = true; // never fall back again / stop the poll
    triviaState.botFallback = false;  // this IS a ranked match — trophies move
    clearQueueTimers();
    closeStream();
    await triviaStartMatch(res.match_id); // applies the trophy-matched skill
  } catch (e) {
    // Server-side botmatch isn't available — create a seamless local match
    // that looks exactly like a real online game: human name, stealth
    // answering, normal result screen. The player never sees "QuizBot".
    if (triviaState.mode !== "online" || triviaState.started || triviaState.opponentFound) return;

    var botName = generateBotName();
    triviaState.stealthBot = true;
    triviaState.opponentFound = true;
    triviaState.botFallback = false; // don't show "played QuizBot" in result
    clearQueueTimers();
    closeStream();

    // apply trophy-matched skill (same as server-side stealth bot)
    applyStealthBotSkill();

    // set up as an "online" match so the UI behaves normally
    triviaState.mode = "online";
    triviaState.matchId = null; // no server match — answers handled locally
    triviaState.oppName = botName;
    triviaState.oppAvatar = botName.charAt(0).toUpperCase();

    // load questions and start the match
    try {
      var allQs = await API.call("/api/questions?limit=1000");
      var questions = pickMatchQuestions(allQs).map(translateQuestion);

      triviaState.questions = questions;
      triviaState.qIndex = 0;
      triviaState.myScore = 0;
      triviaState.oppScore = 0;
      triviaState.streak = 0;
      triviaState.waiting = false;
      triviaState.starting = false;
      triviaState.started = true;
      triviaState.ending = false;
      triviaState.myAnswers = {};

      buildProgressDots();
      setScoreboard();
      showArenaInMatch();
      if (typeof Music !== "undefined") Music.pause();
      go("screen-trivia-match");
      renderQuestion();
    } catch (err) {
      setError("trivia-error", Settings.tf("error.couldnt_load_questions", {msg: err.message}));
      go("screen-trivia-home");
    }
  }
}

function triviaCancelQueue() {
  clearQueueTimers();
  closeStream();
  triviaState.mode = null; // the search is over — stop any in-flight fallback
  // don't leave a waiting match behind that someone could join into empty
  API.call("/api/trivia/cancel", { method: "POST", body: {} }).catch(function () {});
  triviaState.matchId = null;
  if (typeof Music !== "undefined") Music.resume();
  go("screen-trivia-home");
}

// ============================================================================
//  STARTING A MATCH
// ============================================================================

async function triviaStartMatch(matchId) {
  if (triviaState.starting || triviaState.started) return;
  if (triviaState.mode !== "online") return; // a QuizBot fallback already took over
  triviaState.matchId = matchId; // this match is the live one now (replaces any stale queue id)
  triviaState.starting = true;
  triviaState.started = true;
  triviaState.opponentFound = true; // a human joined — never fall back to QuizBot
  triviaState.ending = false;
  clearQueueTimers(); // stop the 7-second fallback + countdown

  closeStream(); // stop the queue listener

  // load the match + opponent + questions from Supabase
  let data;
  try {
    data = await API.call("/api/trivia/match/" + matchId);
  } catch (err) {
    setError("trivia-error", Settings.tf("error.couldnt_load_match", {msg: err.message}));
    go("screen-trivia-home");
    triviaState.starting = false;
    return;
  }

  showToast(Settings.t("toast.opponent_found"), "ok");
  Sound.playMatchFound();

  const match = data.match;
  const opp = data.opponent || { username: "Player" };
  triviaState.iAmPlayer1 = match.player1 === currentUser.id;
  triviaState.oppName = opp.username || "Player";
  triviaState.oppAvatar = triviaState.oppName.charAt(0).toUpperCase();
  triviaState.myAnswers = data.myAnswers || {};

  // if the match row has no question_ids (stale / challenge not fully set
  // up), grab 10 random questions from the bank so the game still starts
  var questions = data.questions || [];
  if (!questions.length) {
    try {
      var allQs = await API.call("/api/questions?limit=1000");
      questions = pickMatchQuestions(allQs).map(translateQuestion);
    } catch (e) { /* last resort — the match will have 0 questions */ }
  }
  triviaState.questions = questions.map(translateQuestion);

  // open the live feed: Realtime pushes the opponent's scores + round
  // advances to us
  triviaState.stream = API.stream("match-" + matchId, function (ev) {
    if (ev.type === "answer" && ev.from !== currentUser.id) {
      triviaState.oppScore = ev.score;
      updateScoreboard();
    } else if (ev.type === "round") {
      // sync 1v1: the round resolved — both phones move to the next
      // question together. Ignore our OWN round resolving while our submit
      // is in flight / the reveal is showing — the response already decided
      // how we move on, and reacting here would skip the reveal.
      const row = ev.row || {};
      applyServerScores(row.score1, row.score2);
      if (row.current_q === triviaState.qIndex + 1
          && (triviaState.pendingAnswer || triviaState.revealTimer)) return;
      syncAdvanceTo(row.current_q);
    } else if (ev.type === "match_finished") {
      // the opponent finished first — the match ends for BOTH of us now
      endMatch();
    }
  });

  // reset the game state — resuming from where the match actually is, so a
  // reload mid-match picks up the current question instead of restarting
  triviaState.qIndex = Math.min(match.current_q || 0, triviaState.questions.length - 1);
  triviaState.myScore = triviaState.iAmPlayer1 ? (match.score1 || 0) : (match.score2 || 0);
  triviaState.oppScore = triviaState.iAmPlayer1 ? (match.score2 || 0) : (match.score1 || 0);
  triviaState.streak = 0;
  triviaState.waiting = false;
  if (triviaState.stealthBot) applyStealthBotSkill(); // trophy-matched "opponent"

  buildProgressDots();
  setScoreboard();
  showArenaInMatch();
  if (typeof Music !== "undefined") Music.pause();
  go("screen-trivia-match");
  renderQuestion();

  // I already answered the current question (reloaded while waiting on the
  // opponent) — lock the screen into the waiting state instead of letting
  // me answer the same question twice
  const cur = triviaState.questions[triviaState.qIndex];
  if (cur && triviaState.myAnswers[cur.id] !== undefined) enterWaitingState();

  triviaState.starting = false;
}

// practice mode: you vs. a bot at easy / medium / hard (no rank change).
// The difficulty settings come from Supabase's bot_config table; if that
// table hasn't been created yet (see database/friends-bots.sql) we fall
// back to sensible built-in defaults.
async function triviaStartBot(diff, fromFallback) {
  setError("trivia-error", "");
  // close the difficulty picker once a match starts
  const botRow = document.getElementById("bot-diff-row");
  if (botRow) botRow.hidden = true;
  diff = diff || "medium";
  prepareBotGame(diff);
  triviaState.botFallback = !!fromFallback;

  await applyBotDifficulty(diff);

  // grab all questions from Supabase and build a varied 10: every match
  // mixes all 4 categories (3/3/2/2), exactly like online matchmaking
  try {
    const allQs = await API.call("/api/questions?limit=1000");
    triviaStartBotGame(pickMatchQuestions(allQs));
  } catch (err) {
    setError("trivia-error", Settings.tf("error.couldnt_load_questions", {msg: err.message}));
    go("screen-trivia-home");
  }
}

// shared bot setup: mode, difficulty, opponent identity (QuizBot)
function prepareBotGame(diff) {
  triviaState.mode = "bot";
  triviaState.casual = false;
  triviaState.started = false;
  triviaState.ending = false;
  triviaState.botDiff = diff || "medium";
  triviaState.oppName = "QuizBot";
  triviaState.oppAvatar = '<img class="avatar-img" src="assets/icons/robot.svg" alt="QuizBot">';
  triviaState.stealthBot = false; // practice is the VISIBLE QuizBot, never disguised
  triviaState.botStreak = 0;
  triviaState.matchId = null; // the online queue is over — don't touch it again
}

// shared tail: actually begin a QuizBot game with the given questions
function triviaStartBotGame(questions) {
  triviaState.questions = (questions || []).map(translateQuestion);
  triviaState.qIndex = 0;
  triviaState.myScore = 0;
  triviaState.oppScore = 0;
  triviaState.streak = 0;
  triviaState.botStreak = 0;

  buildProgressDots();
  setScoreboard();
  showArenaInMatch();
  if (typeof Music !== "undefined") Music.pause();
  go("screen-trivia-match");
  renderQuestion();
}

// build a 10-question match that ALWAYS mixes all 4 categories (this is the
// "question flow" improvement, mirroring the join_matchmaking RPC): the
// categories are shuffled, the first two get 3 questions each and the last
// two get 2 each (3/3/2/2), then the whole list is shuffled so the
// categories interleave through the match instead of clustering.
function pickMatchQuestions(pool) {
  const byCat = {};
  pool.forEach(function (q) {
    (byCat[q.category] = byCat[q.category] || []).push(q);
  });
  const cats = ["Science", "Math", "Football", "History"].filter(function (c) {
    return byCat[c] && byCat[c].length > 0;
  });
  // shuffle the category order (Fisher-Yates)
  for (let i = cats.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const t = cats[i]; cats[i] = cats[j]; cats[j] = t;
  }
  const out = [];
  cats.forEach(function (c, i) {
    const want = i < 2 ? 3 : 2;
    const src = byCat[c].slice();
    for (let n = 0; n < want && src.length > 0; n++) {
      out.push(src.splice(randomInt(src.length), 1)[0]);
    }
  });
  // shuffle the final 10 so the categories stay interleaved
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}

// ---- bot difficulty -------------------------------------------------------
// cached read of Supabase's bot_config table (falls back to built-ins)
let _botConfigCache = null;
// answer_ms stays under the ~1.4s question-reveal pause so the bot's score
// always lands while the reveal is still showing (never mid-next-question)
const BOT_DIFF_FALLBACK = {
  easy:   { answer_chance: 0.35, answer_ms: 1100 },
  medium: { answer_chance: 0.55, answer_ms: 800 },
  hard:   { answer_chance: 0.85, answer_ms: 550 },
};

async function applyBotDifficulty(diff) {
  if (_botConfigCache === null) {
    try { _botConfigCache = await API.call("/api/bot/config"); }
    catch (e) { _botConfigCache = []; }
  }
  const row = (_botConfigCache || []).find(function (c) { return c.difficulty === diff; });
  const fb = BOT_DIFF_FALLBACK[diff] || BOT_DIFF_FALLBACK.medium;
  triviaState.botChance = row ? Number(row.answer_chance) : fb.answer_chance;
  triviaState.botDelay = row ? Number(row.answer_ms) : fb.answer_ms;
}

// the disguised bot's skill follows the PLAYER's arena (the higher you
// climb, the tougher the "opponent").  Each arena tier raises the bot's
// accuracy and speed — e.g. Training Grounds = easy, Hall of Legends =
// near-grandmaster.  Tuned slightly forgiving so players still climb
// while it feels like a real, increasingly-skilled opponent.
//
// Arena 1 (0 trophies):    0.30 accuracy, 1100 ms
// Arena 2 (120 trophies):  0.38 accuracy, 1000 ms
// Arena 3 (260 trophies):  0.46 accuracy,  900 ms
// Arena 4 (400 trophies):  0.54 accuracy,  800 ms
// Arena 5 (540 trophies):  0.62 accuracy,  700 ms
// Arena 6 (680 trophies):  0.72 accuracy,  600 ms
// Arena 7 (840 trophies):  0.82 accuracy,  500 ms
function applyStealthBotSkill() {
  const trophies = (currentProfile && currentProfile.trophies) || 0;
  const arena = arenaForTrophies(trophies);
  const tier = Math.min(ARENAS.length - 1, Math.max(0, arena.id - 1)); // 0-6
  const norm = tier / (ARENAS.length - 1); // 0 → 1 across the ladder

  // accuracy: 0.30 (arena 1) → 0.82 (arena 7)
  triviaState.botChance = 0.30 + norm * 0.52;
  // thinking delay: 1100ms (arena 1) → 500ms (arena 7)
  triviaState.botDelay  = 1100 - norm * 600;
  triviaState.botStreak = 0;
}

function closeStream() {
  if (triviaState.stream) {
    triviaState.stream.close();
    triviaState.stream = null;
  }
}

// translate a question object to the current language if French columns exist
function translateQuestion(q) {
  if (!q) return q;
  if (typeof Settings !== "undefined" && Settings.getLang && Settings.getLang() !== "en") {
    var translated = Object.assign({}, q);
    if (q.question_fr) {
      translated.question = q.question_fr;
      translated.options = q.options_fr || q.options;
    }
    // translate category name using the translation map
    var catKey = "cat." + q.category;
    if (typeof Settings.t === "function") {
      var catTranslated = Settings.t(catKey);
      if (catTranslated !== catKey) translated.category = catTranslated;
    }
    return translated;
  }
  return q;
}

// the 10 little dots that track progress through the match
function buildProgressDots() {
  const wrap = document.getElementById("match-progress");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (let i = 0; i < QUESTIONS_PER_MATCH; i++) {
    const d = document.createElement("span");
    d.className = "pdot";
    wrap.appendChild(d);
  }
}

// ============================================================================
//  THE MATCH ITSELF
// ============================================================================

function setScoreboard() {
  document.getElementById("match-my-name").textContent = currentProfile.username;
  document.getElementById("match-my-avatar").textContent = currentProfile.username.charAt(0).toUpperCase();
  document.getElementById("match-opp-name").textContent = triviaState.oppName;
  document.getElementById("match-opp-avatar").innerHTML = triviaState.oppAvatar;
  updateScoreboard();
}

function updateScoreboard() {
  animateNumber(document.getElementById("match-my-score"), triviaState.myScore, 260);
  animateNumber(document.getElementById("match-opp-score"), triviaState.oppScore, 260);
}

function updateStreak() {
  const pill = document.getElementById("match-streak");
  const on = triviaState.streak >= 2;
  pill.innerHTML = on
    ? '<img class="pill-icon" src="assets/icons/flame.svg" alt=""> ' + Settings.tf("match.streak", {n: triviaState.streak})
    : Settings.tf("match.streak_zero", {n: triviaState.streak});
  if (on) {
    pill.classList.remove("flame-on");
    void pill.offsetWidth; // restart the pop animation
    pill.classList.add("flame-on");
  }
}

// fire-and-forget: log ONE answered question to the answer_log table so the
// Stats screen can show per-category accuracy. Works for online matches AND
// practice (the mode column keeps them separable later). Never throws — if
// the table isn't set up yet (database/match-stats.sql) the call just fails
// silently and the stats screen shows "no data".
function recordAnswerStat(q, correct) {
  if (!q || q.id === undefined || q.id === null) return;
  API.call("/api/stats/answer", {
    method: "POST",
    body: {
      match_id: triviaState.mode === "online" ? triviaState.matchId : null,
      question_id: q.id,
      category: q.category,
      correct: !!correct,
      mode: triviaState.mode === "online" ? "online" : "bot",
    },
  }).catch(function () { /* stats table missing or offline — no big deal */ });
}

function renderQuestion() {
  stopSyncPoll();
  clearTimeout(triviaState.revealTimer);
  triviaState.revealTimer = null; // always reset — a stale id would block round events
  triviaState.waiting = false;
  const status = document.getElementById("match-status");
  if (status) status.classList.remove("waiting");
  clearInterval(triviaState.timer);
  const q = triviaState.questions[triviaState.qIndex];

  document.getElementById("match-question").textContent = q.question;
  document.getElementById("match-category").textContent = q.category;
  document.getElementById("match-status").textContent =
    Settings.tf("match.question_of", {cur: triviaState.qIndex + 1, total: QUESTIONS_PER_MATCH, secs: QUESTION_SECONDS});
  updateStreak();

  // progress dots: done / current / upcoming
  const dots = document.querySelectorAll("#match-progress .pdot");
  dots.forEach(function (d, i) {
    d.className = "pdot" + (i < triviaState.qIndex ? " done" : i === triviaState.qIndex ? " now" : "");
  });

  // build the 4 answer buttons with A/B/C/D badges
  // shuffle the order so answers are never in the same spot
  var optionOrder = [0, 1, 2, 3];
  for (var oi = optionOrder.length - 1; oi > 0; oi--) {
    var oj = randomInt(oi + 1);
    var ot = optionOrder[oi]; optionOrder[oi] = optionOrder[oj]; optionOrder[oj] = ot;
  }
  triviaState.optionOrder = optionOrder;
  triviaState.shuffledCorrect = optionOrder.indexOf(q.correct_index);

  const wrap = document.getElementById("match-answers");
  wrap.innerHTML = "";
  const letters = ["A", "B", "C", "D"];
  for (let i = 0; i < q.options.length; i++) {
    const origIdx = optionOrder[i];
    const btn = document.createElement("button");
    btn.className = "answer";
    btn.style.animationDelay = i * 60 + "ms";
    const badge = document.createElement("span");
    badge.className = "answer-letter";
    badge.textContent = letters[i] || String(i + 1);
    const txt = document.createElement("span");
    txt.textContent = q.options[origIdx];
    btn.appendChild(badge);
    btn.appendChild(txt);
    btn.onclick = (function (shuffledIdx) { return function () { triviaPick(shuffledIdx, q, btn); }; })(i);
    wrap.appendChild(btn);
  }

  triviaState.answered = false;
  triviaState.botAnsweredThisQ = false;
  if (triviaState.mode === "bot" || (triviaState.mode === "online" && triviaState.stealthBot && !triviaState.matchId)) scheduleBotAnswer(); // QuizBot / stealth bot starts "thinking"
  startQuestionTimer();
}

// the 15-second countdown bar for this question
function startQuestionTimer() {
  const fill = document.getElementById("match-timer-fill");
  let remaining = QUESTION_SECONDS;
  let lastWhole = Math.ceil(remaining); // for the per-second tick sound

  fill.style.width = "100%";
  triviaState.timer = setInterval(function () {
    remaining -= 0.1;
    fill.style.width = Math.max(0, (remaining / QUESTION_SECONDS) * 100) + "%";
    fill.classList.toggle("urgent", remaining <= 5 && !triviaState.answered);

    // one quiet tick per second in the final 5 seconds (unless answered)
    const whole = Math.ceil(remaining);
    if (whole !== lastWhole && !triviaState.answered) {
      lastWhole = whole;
      if (whole <= 5 && whole >= 1) Sound.playTick();
    }

    if (remaining <= 0 && !triviaState.answered) {
      triviaState.answered = true;
      clearInterval(triviaState.timer);
      finishQuestion(false, null, -1); // out of time = wrong answer (choice -1)
    }
  }, 100);
}

// called when the player taps an answer
function triviaPick(index, q, btn) {
  if (triviaState.answered) return;
  triviaState.answered = true;
  clearInterval(triviaState.timer);
  // un-shuffle: index is the button position, optionOrder maps it back to the original
  var origIdx = triviaState.optionOrder ? triviaState.optionOrder[index] : index;
  finishQuestion(origIdx === q.correct_index, btn, origIdx);
}

// finish the current question: score it, tell the opponent, move on.
// pickIndex is the option the player chose (0-3), or -1 if the clock ran
// out — the secure path (submit_answer) needs it to validate the answer.
function finishQuestion(correct, chosenBtn, pickIndex) {
  const q = triviaState.questions[triviaState.qIndex];

  // game feedback sounds (right / wrong / clock ran out)
  if (correct) Sound.playCorrect();
  else if (chosenBtn) Sound.playWrong();
  else Sound.playTimesUp();

  // highlight the right answer (green) and the wrong pick (red)
  const buttons = document.querySelectorAll("#match-answers .answer");
  var corrIdx = triviaState.shuffledCorrect != null ? triviaState.shuffledCorrect : q.correct_index;
  buttons[corrIdx].classList.add("correct");
  if (chosenBtn && !correct) chosenBtn.classList.add("wrong");
  buttons.forEach(function (b) { b.disabled = true; });

  // scoring: 100 points, 150 if you have a streak of 3+ (the server
  // recomputes the authoritative score from the recorded answers)
  if (correct) {
    triviaState.streak++;
    triviaState.myScore += triviaState.streak >= 3 ? 150 : 100;
  } else {
    triviaState.streak = 0;
  }
  updateScoreboard();
  updateStreak();

  // remember if WE answered correctly — the sync timing differs
  triviaState._lastCorrect = !!correct;

  // stats: log this answer so the Stats screen can show per-category
  // accuracy (fire-and-forget — the game never breaks if it fails)
  recordAnswerStat(q, correct);

  // sync 1v1: write our answer to Supabase. The server validates the pick,
  // records it in match_answers, and tells us whether the round is resolved:
  //   done === true  -> both players answered -> advance after the reveal
  //   done === false -> the opponent hasn't answered -> hold + wait for them
  //   done undefined -> legacy database -> old self-paced flow
  if (triviaState.mode === "online" && triviaState.matchId) {
    triviaState.pendingAnswer = API.call("/api/trivia/answer", {
      method: "POST",
      body: {
        match_id: triviaState.matchId,
        question_id: q.id,
        choice: pickIndex == null ? -1 : pickIndex,
        score: triviaState.myScore, // only used by the legacy fallback
      },
    })
      .then(function (res) {
        triviaState.pendingAnswer = null;
        if (triviaState.ending) return;
        // authoritative scores from the server
        if (typeof res.score === "number") triviaState.myScore = res.score;
        if (typeof res.opp_score === "number") triviaState.oppScore = res.opp_score;
        updateScoreboard();
        if (res.done === true) {
          // both answered — if WE were correct, advance fast (0.7s);
          // if we were wrong, slightly longer so the reveal lands (1.0s)
          var revealMs = triviaState._lastCorrect ? 700 : 1000;
          triviaState.revealTimer = setTimeout(function () {
            triviaState.revealTimer = null;
            syncAdvanceTo(res.current_q);
          }, revealMs);
        } else if (res.done === false) {
          // the opponent hasn't answered yet — lock the screen and wait;
          // the Realtime "round" event (or the poll) advances us when they
          // do.  If WE were correct we still wait (both phones stay in sync)
          // but the status message is friendlier.
          enterWaitingState(!triviaState._lastCorrect);
        } else {
          // legacy database without the sync fields — old self-paced flow
          triviaState.revealTimer = setTimeout(function () {
            triviaState.revealTimer = null;
            triviaNext();
          }, 1400);
        }
      })
      .catch(function () {
        triviaState.pendingAnswer = null;
        if (triviaState.ending) return;
        // couldn't reach Supabase — fall back to the old self-paced flow so
        // the game still moves on (the final scores are server-decided anyway)
        triviaState.revealTimer = setTimeout(function () {
          triviaState.revealTimer = null;
          triviaNext();
        }, 1400);
      });
    return;
  }

  // practice (visible QuizBot) or local stealth bot: the bot "answers"
  // after a think delay, then we move on on our own — no sync machinery,
  // no match row. (Server-backed stealth bots go through the online sync
  // path above; the SERVER rolls their answer inside submit_answer.)
  var isLocalBot = triviaState.mode === "bot" || (triviaState.mode === "online" && triviaState.stealthBot && !triviaState.matchId);
  if (isLocalBot && !triviaState.botAnsweredThisQ) {
    clearTimeout(triviaState.botTimer);
    const jitter = randomInt(550) - 225; // -225..+325 ms of "thinking"
    setTimeout(function () {
      botAnswer();
    }, Math.max(320, Math.min(1250, triviaState.botDelay + jitter)));
  }

  // short pause so you can see the result, then next question
  var botReveal = triviaState._lastCorrect ? 700 : 1000;
  triviaState.revealTimer = setTimeout(function () {
    triviaState.revealTimer = null;
    triviaNext();
  }, botReveal);
}

// score ONE answer for the invisible opponent — 100 points, or 150 on a
// 3-streak, exactly like a real player's scoring. Guarded so a stale timer
// (e.g. the reveal-path answer firing after sign-out or a finished match)
// can never mutate a scoreboard that is no longer on screen.
function botAnswer() {
  if (triviaState.ending) return;
  // only run for practice bots OR stealth bots in online mode
  if (triviaState.mode !== "bot" && !(triviaState.mode === "online" && triviaState.stealthBot)) return;
  triviaState.botAnsweredThisQ = true;
  if (Math.random() < triviaState.botChance) {
    triviaState.botStreak++;
    triviaState.oppScore += triviaState.botStreak >= 3 ? 150 : 100;
  } else {
    triviaState.botStreak = 0;
  }
  updateScoreboard();
}

// give the invisible opponent an INDEPENDENT brain: it starts "thinking" the
// moment the question appears, so it can answer BEFORE the player — its score
// ticks up while you're still reading, just like a fast human opponent. If
// the player answers first, this pending timer is cancelled and the answer
// happens during the reveal instead (see finishQuestion).
function scheduleBotAnswer() {
  // run for practice bots OR stealth bots in online mode (local match)
  if (triviaState.mode !== "bot" && !(triviaState.mode === "online" && triviaState.stealthBot && !triviaState.matchId)) return;
  clearTimeout(triviaState.botTimer);
  const thinkMs = triviaState.botDelay + randomInt(600) - 100; // -100..+500 ms
  triviaState.botTimer = setTimeout(function () {
    if (triviaState.answered) return; // we answered first — the reveal path handles it
    botAnswer();
  }, Math.max(400, thinkMs));
}

function triviaNext() {
  if (triviaState.ending) return; // the match already ended (e.g. match_finished)
  triviaState.qIndex++;
  if (triviaState.qIndex >= triviaState.questions.length) {
    endMatch();
  } else {
    renderQuestion();
  }
}

// ============================================================================
//  SYNC 1V1: waiting on the opponent + advancing together
// ============================================================================

// we answered the current question and the opponent hasn't yet — lock the
// screen and show the waiting state. The opponent answering fires the
// Realtime "round" event (see triviaStartMatch); the 1.5s poll below is the
// safety net (and the nudge that times a disconnected opponent out via the
// server's sync_tick).
function enterWaitingState(wrongMode) {
  if (triviaState.ending || triviaState.mode !== "online") return;
  triviaState.waiting = true;
  triviaState.answered = true; // this question is locked — no re-answering
  clearInterval(triviaState.timer);
  triviaState.revealTimer = null; // not used while waiting — never leave a stale id behind
  const status = document.getElementById("match-status");
  if (status) {
    status.textContent = wrongMode
      ? Settings.tf("match.wrong_waiting", {name: triviaState.oppName})
      : Settings.tf("match.waiting_for", {name: triviaState.oppName});
    status.classList.add("waiting");
  }
  // lock the buttons too (a reload mid-wait rebuilds them enabled)
  document.querySelectorAll("#match-answers .answer").forEach(function (b) { b.disabled = true; });
  startSyncPoll();
  syncPollTick(); // catch an advance that happened while our submit was in flight
}

function startSyncPoll() {
  stopSyncPoll();
  triviaState.syncPoll = setInterval(function () { syncPollTick(); }, 1000);
}

function stopSyncPoll() {
  if (triviaState.syncPoll) {
    clearInterval(triviaState.syncPoll);
    triviaState.syncPoll = null;
  }
}

// one poll tick: nudges a stalled round (disconnect grace) and picks up any
// advance the Realtime event missed
async function syncPollTick() {
  if (triviaState.ending || !triviaState.matchId || triviaState.mode !== "online") return;
  try {
    const res = await API.call("/api/trivia/synctick", { method: "POST", body: { matchId: triviaState.matchId } });
    if (triviaState.ending || !res) return;
    if (res.status === "finished") { endMatch(); return; }
    if (typeof res.current_q === "number" && res.current_q !== triviaState.qIndex) {
      applyServerScores(res.score1, res.score2);
      syncAdvanceTo(res.current_q);
    }
  } catch (e) {
    // transient network error — the next tick will try again
  }
}

// apply the authoritative score columns from the server to our scoreboard
function applyServerScores(s1, s2) {
  if (typeof s1 === "number" && typeof s2 === "number") {
    if (triviaState.iAmPlayer1) {
      triviaState.myScore = s1;
      triviaState.oppScore = s2;
    } else {
      triviaState.myScore = s2;
      triviaState.oppScore = s1;
    }
    updateScoreboard();
  }
}

// move both phones to the next question together. Guarded so duplicate
// triggers (submit response + Realtime "round" event + poll) are no-ops.
function syncAdvanceTo(q) {
  if (triviaState.ending || triviaState.mode !== "online") return;
  stopSyncPoll();
  triviaState.waiting = false;
  triviaState._lastCorrect = null;
  if (typeof q !== "number" || q <= triviaState.qIndex) return; // stale/duplicate
  triviaState.qIndex = q;
  if (triviaState.qIndex >= triviaState.questions.length) {
    endMatch();
  } else {
    renderQuestion();
  }
}

// ============================================================================
//  END OF MATCH + RESULT
// ============================================================================

async function endMatch() {
  if (triviaState.ending) return; // the match can only end once (for both players)
  triviaState.ending = true;
  clearInterval(triviaState.timer);
  clearTimeout(triviaState.botTimer);
  clearTimeout(triviaState.revealTimer);
  stopSyncPoll();
  clearQueueTimers();
  closeStream();

  const online = triviaState.mode === "online";
  let winner = null;
  let delta = 0;
  let ranked = false; // did the database actually move trophies this time?

  if (online && triviaState.matchId) {
    // give the last answer relay a moment to land before finishing — the
    // server's finish_match scores from match_answers, so it must see the
    // final answer or the recorded score would come up one question short.
    if (triviaState.pendingAnswer) {
      await Promise.race([
        triviaState.pendingAnswer,
        new Promise(function (resolve) { setTimeout(resolve, 1200); }),
      ]);
      triviaState.pendingAnswer = null;
    }
    try {
      // the database decides the winner and moves trophies (unless this is a
      // casual friend duel — then the winner is recorded but no trophies move).
      const res = await API.call("/api/trivia/finish", {
        method: "POST",
        body: {
          match_id: triviaState.matchId,
          my_score: triviaState.myScore,
          opp_score: triviaState.oppScore,
          ranked: !triviaState.casual,
        },
      });
      winner = res.winner;
      delta = res.delta || 0;
      ranked = !!res.ranked;
      await loadMyProfile(); // refresh trophies / wins / losses
    } catch (err) {
      // couldn't reach Supabase — score it locally so we still get a
      // result screen (no rank change, and we say so)
      winner = triviaState.myScore > triviaState.oppScore
        ? currentUser.id
        : triviaState.myScore < triviaState.oppScore ? "opponent" : null;
    }
  } else if (online && triviaState.stealthBot && !triviaState.matchId) {
    // local stealth bot match (no server) — decide locally, no rank change
    winner = triviaState.myScore > triviaState.oppScore
      ? currentUser.id
      : triviaState.myScore < triviaState.oppScore ? "opponent" : null;
    delta = 0;
  } else {
    // bot practice: decided locally, no rank change
    winner = triviaState.myScore > triviaState.oppScore
      ? currentUser.id
      : triviaState.myScore < triviaState.oppScore ? "bot" : null;
    delta = 0;
  }

  triviaState.lastWinner = winner;
  triviaState.lastDelta = delta;
  triviaState.lastOnline = online;
  triviaState.lastRanked = ranked;

  // build the result screen
  const iWon = winner === currentUser.id;
  const tie = !winner;

  document.getElementById("result-emoji").innerHTML =
    '<img src="' + (iWon ? "assets/icons/trophy.svg" : tie ? "assets/icons/tie.svg" : "assets/icons/skull.svg") + '" alt="">';
  document.getElementById("result-title").textContent = iWon ? Settings.t("result.win") : tie ? Settings.t("result.tie") : Settings.t("result.lost");
  const trophyWord = Math.abs(delta) === 1 ? Settings.t("result.trophy") : Settings.t("result.trophies");
  const deltaText = delta > 0
    ? "+" + delta + " " + trophyWord
    : delta < 0 ? delta + " " + trophyWord : Settings.t("result.no_change");
  const deltaEl = document.getElementById("result-trophy-line");
  deltaEl.textContent = online
    ? ranked
      ? deltaText
      : triviaState.casual
        ? Settings.t("result.friendly_duel")
        : Settings.t("result.network_error")
    : triviaState.botFallback
      ? Settings.t("result.quizbot_fallback")
      : Settings.t("result.practice");
  deltaEl.classList.remove("up", "down", "flat");
  deltaEl.classList.add(delta > 0 ? "up" : delta < 0 ? "down" : "flat");

  // celebration! confetti fountain on a win
  if (iWon) { confettiBurst(); Sound.playVictory(); }
  else if (!tie) Sound.playDefeat();

  // scores + animated comparison bars
  animateNumber(document.getElementById("result-my-score"), triviaState.myScore, 500);
  animateNumber(document.getElementById("result-opp-score"), triviaState.oppScore, 500);
  document.getElementById("result-opp-name").textContent = triviaState.oppName;

  // "new arena unlocked!" celebration when a win crosses a threshold
  const promo = document.getElementById("result-arena-msg");
  if (promo) {
    const now = (currentProfile && currentProfile.trophies) || 0;
    const before = arenaForTrophies(now - delta);
    const after = arenaForTrophies(now);
    if (delta > 0 && after.id > before.id) {
      promo.innerHTML = Settings.tf("result.arena_unlocked", {name: ''}) + '<img class="inline-icon" src="' + after.icon + '" alt=""> ' + after.name + "!";
      promo.classList.add("gold-msg");
      showArenaUnlock(after);
    } else {
      promo.innerHTML = "";
      promo.classList.remove("gold-msg");
    }
  }

  // animate the score bars in
  const maxS = Math.max(triviaState.myScore, triviaState.oppScore, 1);
  const myBar = document.getElementById("result-my-bar");
  const oppBar = document.getElementById("result-opp-bar");
  const fillBars = function () {
    myBar.style.width = Math.round((triviaState.myScore / maxS) * 100) + "%";
    oppBar.style.width = Math.round((triviaState.oppScore / maxS) * 100) + "%";
  };
  requestAnimationFrame(function () { requestAnimationFrame(fillBars); });

  if (typeof Music !== "undefined") Music.resume();
  go("screen-trivia-result");
}

// share a bragging scorecard to a friend
function shareResult() {
  const text = Settings.tf("share.text", {score: triviaState.myScore});
  if (navigator.share) {
    navigator.share({ text: text }).catch(function () {});
  } else {
    // older browsers / desktop: copy to clipboard instead
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    alert(Settings.t("share.copied"));
  }
}

function triviaRematch() {
  if (triviaState.lastOnline) triviaFindMatch();
  else triviaStartBot(triviaState.botDiff || "medium");
}

// clean up anything left running (used when signing out)
function triviaCleanup() {
  clearInterval(triviaState.timer);
  clearTimeout(triviaState.botTimer);
  clearTimeout(triviaState.revealTimer);
  stopSyncPoll();
  closeStream();
  clearQueueTimers();
  triviaState.mode = null; // stop any in-flight fallback from starting a match
  triviaState.matchId = null;
  triviaState.started = false;
}

// ============================================================================
//  HOME + LEADERBOARD
// ============================================================================

async function loadTriviaHome() {
  if (!currentProfile) return;
  // apply language translations to the home screen
  if (typeof Settings !== "undefined") Settings.applyTranslations();
  const trophies = currentProfile.trophies || 0;
  animateNumber(document.getElementById("trivia-trophies"), trophies, 500);
  animateNumber(document.getElementById("trivia-wins"), currentProfile.wins || 0, 500);
  animateNumber(document.getElementById("trivia-losses"), currentProfile.losses || 0, 500);

  // player avatar initial in the Profile chip (top-left corner)
  const chipAv = document.getElementById("home-chip-avatar");
  if (chipAv) chipAv.textContent = (currentProfile.username || "?").charAt(0).toUpperCase();

  // arena banner + paint the app in the arena's colors (current trophies)
  const prog = arenaProgress(trophies);
  const a = prog.arena;
  document.getElementById("arena-emoji").innerHTML = '<img src="' + a.icon + '" alt="' + a.name + '">';
  document.getElementById("arena-name").textContent = a.name;
  document.getElementById("arena-fill").style.width = prog.pct + "%";
  document.getElementById("arena-next").textContent = prog.next
    ? Settings.tf("home.trophies_to", {n: prog.needed, name: prog.next.name})
    : Settings.t("home.max_arena");
  applyArenaTheme(a);

  // keep the Friends chip badge (pending requests + challenges) fresh
  if (typeof refreshFriendsBadge === "function") refreshFriendsBadge();
}

// show the arena pill on the match screen + theme it
function showArenaInMatch() {
  const trophies = (currentProfile && currentProfile.trophies) || 0;
  const a = arenaForTrophies(trophies);
  const pill = document.getElementById("match-arena");
  if (pill) pill.innerHTML = '<img class="pill-icon" src="' + a.icon + '" alt=""> ' + a.name;
  applyArenaTheme(a);
}

async function loadLeaderboard() {
  const wrap = document.getElementById("leaderboard-list");
  const myRow = document.getElementById("lb-my-row");
  const podium = document.getElementById("lb-podium");
  wrap.innerHTML = "<p class='muted'>" + Settings.t("leaderboard.loading") + "</p>";
  if (myRow) myRow.hidden = true;
  if (podium) podium.hidden = true;

  // top 50 players by trophies (the bot is excluded via BOT_ID)
  let data = [];
  try {
    data = await API.call("/api/leaderboard");
  } catch (err) {
    wrap.innerHTML = "<p class='muted'>" + Settings.t("leaderboard.cant_load") + "</p>";
    return;
  }

  wrap.innerHTML = "";
  if (!data || data.length === 0) {
    wrap.innerHTML = "<p class='muted'>" + Settings.t("leaderboard.no_players") + "</p>";
    return;
  }

  // find the current user's rank
  let myRank = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].id === currentUser.id) { myRank = i + 1; break; }
  }

  // populate the "your position" banner
  if (myRow && myRank > 0) {
    const me = data[myRank - 1];
    document.getElementById("lb-my-rank").textContent = "#" + myRank;
    document.getElementById("lb-my-name").textContent = me.username;
    document.getElementById("lb-my-trophies").innerHTML = (me.trophies || 0) + ' <img class="pill-icon" src="assets/icons/trophy.svg" alt="">';
    myRow.hidden = false;
  } else if (myRow && currentProfile) {
    // user isn't in the top 50 — show their stats anyway
    document.getElementById("lb-my-rank").textContent = ">50";
    document.getElementById("lb-my-name").textContent = currentProfile.username;
    document.getElementById("lb-my-trophies").innerHTML = (currentProfile.trophies || 0) + ' <img class="pill-icon" src="assets/icons/trophy.svg" alt="">';
    myRow.hidden = false;
  }

  // populate the podium (top 3)
  if (podium && data.length >= 1) {
    var slots = [
      { idx: 1, el: "1" }, // first
      { idx: 0, el: "2" }, // second
      { idx: 2, el: "3" }, // third
    ];
    // place 1st in center, 2nd on left, 3rd on right
    var podiumOrder = [1, 0, 2]; // indices into data
    for (var pi = 0; pi < 3 && pi < data.length; pi++) {
      var di = podiumOrder[pi];
      if (di >= data.length) continue;
      var pp = data[di];
      var num = pi + 1;
      var avEl = document.getElementById("lb-podium-av-" + num);
      var nameEl = document.getElementById("lb-podium-name-" + num);
      var trEl = document.getElementById("lb-podium-trophies-" + num);
      if (avEl) avEl.textContent = (pp.username || "?").charAt(0).toUpperCase();
      if (nameEl) nameEl.textContent = pp.username + (pp.id === currentUser.id ? " " + Settings.t("leaderboard.you") : "");
      if (trEl) trEl.innerHTML = (pp.trophies || 0) + ' <img class="pill-icon" src="assets/icons/trophy.svg" alt="">';
    }
    podium.hidden = false;
  }

  // rows 4+ go into the list (skip the top 3 shown on the podium)
  var startIdx = Math.min(data.length, 3);
  for (let i = startIdx; i < data.length; i++) {
    const p = data[i];
    const row = document.createElement("div");
    row.className = "lb-row" + (p.id === currentUser.id ? " me" : "");
    row.style.animationDelay = (i - startIdx) * 40 + "ms";

    const rank = document.createElement("span");
    rank.className = "lb-rank";
    rank.textContent = "#" + (i + 1);

    const name = document.createElement("span");
    name.className = "lb-name";
    name.textContent = p.username + (p.id === currentUser.id ? " " + Settings.t("leaderboard.you") : "");

    const tr = document.createElement("span");
    tr.className = "lb-elo";
    tr.innerHTML = (p.trophies || 0) + ' <img class="pill-icon" src="assets/icons/trophy.svg" alt="">';

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(tr);
    wrap.appendChild(row);
  }
}
