// ============================================================================
//  trivia.js — the Trivia1v1 game
//
//  THE FLOW:
//    tap "Find Match"  ->  Supabase pairs us with a stranger
//    both players get the SAME 10 questions, 15 seconds each
//    answers are relayed live through Supabase Realtime so both
//    phones show both scores
//    at the end, the database decides the winner and moves trophies
//
//  HOW THE "LIVE" PART WORKS:
//    each player subscribes to Realtime changes on the match row
//    ("match-<id>"). When you answer, we write your score to the match
//    row in Supabase and Realtime pushes it to the other phone instantly.
// ============================================================================

const QUESTION_SECONDS = 15;
const QUESTIONS_PER_MATCH = 10;
const MEDAL_ICONS = ["assets/icons/medal-1.svg", "assets/icons/medal-2.svg", "assets/icons/medal-3.svg"];

// how long we wait for a human opponent before switching to QuizBot
const HUMAN_SEARCH_SECONDS = 7;

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
  stream: null,      // the live Realtime subscription for this match / queue
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
  botAnsweredThisQ: false, // has the invisible opponent already answered this question?
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
  setQueueStatus("Searching for a human opponent… (" + left + "s)");
  triviaState.queueTimer = setInterval(function () {
    left -= 1;
    if (left > 0) setQueueStatus("Searching for a human opponent… (" + left + "s)");
    else {
      clearQueueCountdown();
      setQueueStatus("Opponent found — starting…");
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
      setError("trivia-error", "Could not join matchmaking: " + err.message);
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
      ? "Your friend didn't accept the challenge. Try again!"
      : "No opponent found yet. Try again in a moment!");
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
    triviaState.stealthBot = true;    // simulate the bot's answers client-side
    triviaState.opponentFound = true; // never fall back again / stop the poll
    triviaState.botFallback = false;  // this IS a ranked match — trophies move
    clearQueueTimers();
    closeStream();
    await triviaStartMatch(res.match_id); // applies the trophy-matched skill
  } catch (e) {
    // start_bot_match isn't deployed yet (run database/stealth-bots.sql) —
    // fall back to the old VISIBLE QuizBot practice game so the app still works
    triviaStartBot("medium", true);
  }
}

function triviaCancelQueue() {
  clearQueueTimers();
  closeStream();
  triviaState.mode = null; // the search is over — stop any in-flight fallback
  // don't leave a waiting match behind that someone could join into empty
  API.call("/api/trivia/cancel", { method: "POST", body: {} }).catch(function () {});
  triviaState.matchId = null;
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
    setError("trivia-error", "Could not load the match: " + err.message);
    go("screen-trivia-home");
    triviaState.starting = false;
    return;
  }

  showToast("Opponent found — good luck!", "ok");

  const match = data.match;
  const opp = data.opponent || { username: "Player" };
  triviaState.iAmPlayer1 = match.player1 === currentUser.id;
  triviaState.oppName = opp.username || "Player";
  triviaState.oppAvatar = triviaState.oppName.charAt(0).toUpperCase();
  triviaState.questions = data.questions || [];

  // open the live feed: Realtime pushes the opponent's scores to us
  triviaState.stream = API.stream("match-" + matchId, function (ev) {
    if (ev.type === "answer" && ev.from !== currentUser.id) {
      triviaState.oppScore = ev.score;
      updateScoreboard();
    } else if (ev.type === "match_finished") {
      // the opponent finished first — the match ends for BOTH of us now
      endMatch();
    }
  });

  // reset the game state
  triviaState.qIndex = 0;
  triviaState.myScore = 0;
  triviaState.oppScore = 0;
  triviaState.streak = 0;
  if (triviaState.stealthBot) applyStealthBotSkill(); // trophy-matched "opponent"

  buildProgressDots();
  setScoreboard();
  showArenaInMatch();
  go("screen-trivia-match");
  renderQuestion();
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
    setError("trivia-error", "Could not load questions: " + err.message);
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
  triviaState.questions = questions || [];
  triviaState.qIndex = 0;
  triviaState.myScore = 0;
  triviaState.oppScore = 0;
  triviaState.streak = 0;
  triviaState.botStreak = 0;

  buildProgressDots();
  setScoreboard();
  showArenaInMatch();
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

// the disguised bot's skill follows the PLAYER's trophies (the higher you
// climb, the tougher the "opponent") — a continuous version of the
// easy/medium/hard spread (0.35/0.55/0.85 accuracy, 1100/800/550 ms), tuned
// slightly forgiving so players still climb while it feels like a fair fight.
function applyStealthBotSkill() {
  const t = Math.min(1, Math.max(0, ((currentProfile && currentProfile.trophies) || 0) / 900));
  triviaState.botChance = 0.28 + t * 0.50; // 0.28 → 0.78 answer accuracy
  triviaState.botDelay  = 1150 - t * 600;  // 1150ms → 550ms "thinking"
  triviaState.botStreak = 0;
}

function closeStream() {
  if (triviaState.stream) {
    triviaState.stream.close();
    triviaState.stream = null;
  }
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
    ? '<img class="pill-icon" src="assets/icons/flame.svg" alt=""> ' + triviaState.streak + " streak"
    : "streak: " + triviaState.streak;
  if (on) {
    pill.classList.remove("flame-on");
    void pill.offsetWidth; // restart the pop animation
    pill.classList.add("flame-on");
  }
}

function renderQuestion() {
  clearInterval(triviaState.timer);
  const q = triviaState.questions[triviaState.qIndex];

  document.getElementById("match-question").textContent = q.question;
  document.getElementById("match-category").textContent = q.category;
  document.getElementById("match-status").textContent =
    "Question " + (triviaState.qIndex + 1) + " of " + QUESTIONS_PER_MATCH + " · " + QUESTION_SECONDS + " seconds each";
  updateStreak();

  // progress dots: done / current / upcoming
  const dots = document.querySelectorAll("#match-progress .pdot");
  dots.forEach(function (d, i) {
    d.className = "pdot" + (i < triviaState.qIndex ? " done" : i === triviaState.qIndex ? " now" : "");
  });

  // build the 4 answer buttons with A/B/C/D badges
  const wrap = document.getElementById("match-answers");
  wrap.innerHTML = "";
  const letters = ["A", "B", "C", "D"];
  for (let i = 0; i < q.options.length; i++) {
    const btn = document.createElement("button");
    btn.className = "answer";
    btn.style.animationDelay = i * 60 + "ms";
    const badge = document.createElement("span");
    badge.className = "answer-letter";
    badge.textContent = letters[i] || String(i + 1);
    const txt = document.createElement("span");
    txt.textContent = q.options[i];
    btn.appendChild(badge);
    btn.appendChild(txt);
    btn.onclick = function () { triviaPick(i, q, btn); };
    wrap.appendChild(btn);
  }

  triviaState.answered = false;
  triviaState.botAnsweredThisQ = false;
  scheduleBotAnswer(); // the invisible opponent starts "thinking" right away
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
      finishQuestion(false, null); // out of time = wrong answer
    }
  }, 100);
}

// called when the player taps an answer
function triviaPick(index, q, btn) {
  if (triviaState.answered) return;
  triviaState.answered = true;
  clearInterval(triviaState.timer);
  finishQuestion(index === q.correct_index, btn);
}

// finish the current question: score it, tell the opponent, move on
function finishQuestion(correct, chosenBtn) {
  const q = triviaState.questions[triviaState.qIndex];

  // game feedback sounds (right / wrong / clock ran out)
  if (correct) Sound.playCorrect();
  else if (chosenBtn) Sound.playWrong();
  else Sound.playTimesUp();

  // highlight the right answer (green) and the wrong pick (red)
  const buttons = document.querySelectorAll("#match-answers .answer");
  buttons[q.correct_index].classList.add("correct");
  if (chosenBtn && !correct) chosenBtn.classList.add("wrong");
  buttons.forEach(function (b) { b.disabled = true; });

  // scoring: 100 points, 150 if you have a streak of 3+
  if (correct) {
    triviaState.streak++;
    triviaState.myScore += triviaState.streak >= 3 ? 150 : 100;
  } else {
    triviaState.streak = 0;
  }
  updateScoreboard();
  updateStreak();

  // write our new score to Supabase; Realtime relays it to the opponent (online only)
  if (triviaState.mode === "online" && triviaState.matchId) {
    API.call("/api/trivia/answer", {
      method: "POST",
      body: { match_id: triviaState.matchId, score: triviaState.myScore },
    }).catch(function () { /* the opponent will see the final scores anyway */ });
  }

  // the invisible opponent "answers" too — practice mode uses QuizBot at the
  // difficulty you picked, a stealth match uses the disguised bot at a skill
  // matched to your trophies. If it hasn't answered this question already
  // (see scheduleBotAnswer), it "thinks" a moment and answers right now.
  if ((triviaState.mode === "bot" || triviaState.stealthBot) && !triviaState.botAnsweredThisQ) {
    clearTimeout(triviaState.botTimer);
    const jitter = randomInt(550) - 225; // -225..+325 ms of "thinking"
    setTimeout(function () {
      botAnswer();
    }, Math.max(320, Math.min(1250, triviaState.botDelay + jitter)));
  }

  // short pause so you can see the result, then next question
  setTimeout(function () { triviaNext(); }, 1400);
}

// score ONE answer for the invisible opponent — 100 points, or 150 on a
// 3-streak, exactly like a real player's scoring. Guarded so a stale timer
// (e.g. the reveal-path answer firing after sign-out or a finished match)
// can never mutate a scoreboard that is no longer on screen.
function botAnswer() {
  if (triviaState.ending || !(triviaState.mode === "bot" || triviaState.stealthBot)) return;
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
  if (!(triviaState.mode === "bot" || triviaState.stealthBot)) return;
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
//  END OF MATCH + RESULT
// ============================================================================

async function endMatch() {
  if (triviaState.ending) return; // the match can only end once (for both players)
  triviaState.ending = true;
  clearInterval(triviaState.timer);
  clearTimeout(triviaState.botTimer);
  clearQueueTimers();
  closeStream();

  const online = triviaState.mode === "online";
  let winner = null;
  let delta = 0;
  let ranked = false; // did the database actually move trophies this time?

  if (online) {
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
  document.getElementById("result-title").textContent = iWon ? "You win!" : tie ? "It's a tie!" : "You lost!";
  const trophyWord = Math.abs(delta) === 1 ? "trophy" : "trophies";
  const deltaText = delta > 0
    ? "+" + delta + " " + trophyWord
    : delta < 0 ? delta + " " + trophyWord : "No trophy change";
  const deltaEl = document.getElementById("result-trophy-line");
  deltaEl.textContent = online
    ? ranked
      ? deltaText
      : triviaState.casual
        ? "Friendly duel — no rank change"
        : "Couldn't reach the network — no rank change"
    : triviaState.botFallback
      ? "No humans found — played QuizBot (no rank change)"
      : "Practice game — no rank change";
  deltaEl.classList.remove("up", "down", "flat");
  deltaEl.classList.add(delta > 0 ? "up" : delta < 0 ? "down" : "flat");

  // celebration! confetti fountain on a win
  if (iWon) confettiBurst();

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
      promo.innerHTML = 'Arena unlocked: <img class="inline-icon" src="' + after.icon + '" alt=""> ' + after.name + "!";
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

  go("screen-trivia-result");
}

// share a bragging scorecard to a friend
function shareResult() {
  const text = "I scored " + triviaState.myScore + " in Trivia1v1! Can you beat me?";
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
    alert("Score copied! Paste it to your friends.");
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
    ? prog.needed + " trophies to " + prog.next.name
    : "Max arena reached — you're a legend!";
  buildArenaLadder(trophies);
  applyArenaTheme(a);

  // keep the Friends chip badge (pending requests + challenges) fresh
  if (typeof refreshFriendsBadge === "function") refreshFriendsBadge();
}

// the little 7-step Knowledge Ladder strip under the arena card
function buildArenaLadder(trophies) {
  const wrap = document.getElementById("arena-ladder");
  if (!wrap) return;
  wrap.innerHTML = "";
  const cur = arenaForTrophies(trophies);
  for (const a of ARENAS) {
    const step = document.createElement("div");
    step.className = "ladder-step" + (trophies >= a.min ? " unlocked" : "") + (a === cur ? " current" : "");
    step.title = a.name;
    const img = document.createElement("img");
    img.src = a.icon;
    img.alt = a.name;
    step.appendChild(img);
    if (trophies < a.min) {
      const lock = document.createElement("span");
      lock.className = "ladder-lock";
      lock.textContent = "\uD83D\uDD12";
      step.appendChild(lock);
    }
    wrap.appendChild(step);
  }
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
  wrap.innerHTML = "<p class='muted'>Loading…</p>";

  // top 50 players by trophies (the bot is excluded via BOT_ID)
  let data = [];
  try {
    data = await API.call("/api/leaderboard");
  } catch (err) {
    wrap.innerHTML = "<p class='muted'>Couldn't load the leaderboard.</p>";
    return;
  }

  wrap.innerHTML = "";
  if (!data || data.length === 0) {
    wrap.innerHTML = "<p class='muted'>No players yet. Be the first!</p>";
    return;
  }

  for (let i = 0; i < data.length; i++) {
    const p = data[i];
    const row = document.createElement("div");
    row.className = "lb-row" + (p.id === currentUser.id ? " me" : "");

    const rank = document.createElement("span");
    rank.className = "lb-rank" + (i < 3 ? " top" : "");
    rank.innerHTML = i < 3 ? '<img class="lb-medal" src="' + MEDAL_ICONS[i] + '" alt="">' : "#" + (i + 1);

    const name = document.createElement("span");
    name.className = "lb-name";
    name.textContent = p.username + (p.id === currentUser.id ? " (you)" : "");

    const tr = document.createElement("span");
    tr.className = "lb-elo";
    tr.innerHTML = (p.trophies || 0) + ' <img class="pill-icon" src="assets/icons/trophy.svg" alt="">';

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(tr);
    wrap.appendChild(row);
  }
}
