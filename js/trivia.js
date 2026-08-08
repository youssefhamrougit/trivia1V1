// ============================================================================
//  trivia.js — the TriviaDuel game
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

// all of the game's variables live in one object (like a struct)
let triviaState = {
  mode: null,        // 'online' = real match | 'bot' = practice
  matchId: null,
  iAmPlayer1: true,  // which side of the match am I?
  questions: [],     // the 10 questions for this match
  qIndex: 0,         // which question we are on (0..9)
  myScore: 0,
  oppScore: 0,
  streak: 0,         // consecutive correct answers in a row
  oppName: "…",
  oppAvatar: "?",
  answered: false,   // have we picked an answer this question?
  stream: null,      // the live Realtime subscription for this match / queue
  timer: null,       // the per-question countdown
  starting: false,   // guard so the match can't start twice (concurrency)
  started: false,    // true once the match has begun — stops the queue poller
                     // from re-triggering and wiping the score back to question 1
  lastWinner: null,  // for the result screen
  lastDelta: 0,
  lastOnline: false,
  lastRanked: false, // did the database actually move trophies?
};

// ============================================================================
//  MATCHMAKING  (tap "Find Match")
// ============================================================================

function triviaFindMatch() {
  setError("trivia-error", "");
  go("screen-trivia-queue");
  triviaState.mode = "online";
  triviaState.started = false;

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
    })
    .catch(function (err) {
      setError("trivia-error", "Could not join matchmaking: " + err.message);
      go("screen-trivia-home");
    });
}

// keep checking whether an opponent has joined (up to ~60 seconds)
function triviaPollForOpponent(attempt) {
  if (!triviaState.matchId || triviaState.mode !== "online") return;
  if (attempt > 40) {
    // give up quietly: go home and show the message there
    setError("trivia-error", "No opponent found yet. Try again in a moment!");
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

function triviaCancelQueue() {
  closeStream();
  triviaState.matchId = null;
  go("screen-trivia-home");
}

// ============================================================================
//  STARTING A MATCH
// ============================================================================

async function triviaStartMatch(matchId) {
  if (triviaState.starting || triviaState.started) return;
  triviaState.starting = true;
  triviaState.started = true;

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
    }
  });

  // reset the game state
  triviaState.qIndex = 0;
  triviaState.myScore = 0;
  triviaState.oppScore = 0;
  triviaState.streak = 0;

  buildProgressDots();
  setScoreboard();
  showArenaInMatch();
  go("screen-trivia-match");
  renderQuestion();
  triviaState.starting = false;
}

// practice mode: you vs. the bot (no rank change)
async function triviaStartBot() {
  setError("trivia-error", "");
  triviaState.mode = "bot";
  triviaState.started = false;
  triviaState.oppName = "QuizBot";
  triviaState.oppAvatar = '<img class="avatar-img" src="assets/icons/robot.svg" alt="QuizBot">';    // grab all questions from Supabase and pick 10 random ones
  try {
    const allQs = await API.call("/api/questions?limit=200");
    triviaState.questions = [];
    const pool = allQs.slice();
    for (let i = 0; i < QUESTIONS_PER_MATCH && pool.length > 0; i++) {
      const idx = randomInt(pool.length);
      triviaState.questions.push(pool.splice(idx, 1)[0]);
    }
  } catch (err) {
    setError("trivia-error", "Could not load questions: " + err.message);
    go("screen-trivia-home");
    return;
  }

  triviaState.qIndex = 0;
  triviaState.myScore = 0;
  triviaState.oppScore = 0;
  triviaState.streak = 0;

  buildProgressDots();
  setScoreboard();
  showArenaInMatch();
  go("screen-trivia-match");
  renderQuestion();
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
  startQuestionTimer();
}

// the 15-second countdown bar for this question
function startQuestionTimer() {
  const fill = document.getElementById("match-timer-fill");
  let remaining = QUESTION_SECONDS;

  fill.style.width = "100%";
  triviaState.timer = setInterval(function () {
    remaining -= 0.1;
    fill.style.width = Math.max(0, (remaining / QUESTION_SECONDS) * 100) + "%";
    fill.classList.toggle("urgent", remaining <= 5 && !triviaState.answered);
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

  // in practice mode, the bot "answers" too (sometimes correctly)
  if (triviaState.mode === "bot") {
    setTimeout(function () {
      if (Math.random() < 0.55) triviaState.oppScore += 100;
      updateScoreboard();
    }, 900);
  }

  // short pause so you can see the result, then next question
  setTimeout(function () { triviaNext(); }, 1400);
}

function triviaNext() {
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
  clearInterval(triviaState.timer);
  closeStream();

  const online = triviaState.mode === "online";
  let winner = null;
  let delta = 0;
  let ranked = false; // did the database actually move trophies this time?

  if (online) {
    try {
      // the database decides the winner and moves trophies. The finish_match
      // RPC orders the scores server-side, so player1's score always lands
      // in the right slot (this permanently fixes the old always-tie bug).
      const res = await API.call("/api/trivia/finish", {
        method: "POST",
        body: {
          match_id: triviaState.matchId,
          my_score: triviaState.myScore,
          opp_score: triviaState.oppScore,
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
  const deltaText = delta > 0 ? "+" + delta + " trophy" : delta < 0 ? delta + " trophy" : "No trophy change";
  const deltaEl = document.getElementById("result-trophy-line");
  deltaEl.textContent = online
    ? ranked
      ? deltaText
      : "Couldn't reach the network — no rank change"
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
    const peak = (currentProfile && currentProfile.peak_trophies) || 0;
    const before = arenaForTrophies(peak - delta);
    const after = arenaForTrophies(peak);
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
  const text = "I scored " + triviaState.myScore + " in TriviaDuel! Can you beat me?";
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
  else triviaStartBot();
}

// clean up anything left running (used when signing out)
function triviaCleanup() {
  clearInterval(triviaState.timer);
  closeStream();
  triviaState.matchId = null;
  triviaState.started = false;
}

// ============================================================================
//  HOME + LEADERBOARD
// ============================================================================

async function loadTriviaHome() {
  if (!currentProfile) return;
  const trophies = currentProfile.trophies || 0;
  const peak = currentProfile.peak_trophies || trophies;
  animateNumber(document.getElementById("trivia-trophies"), trophies, 500);
  animateNumber(document.getElementById("trivia-wins"), currentProfile.wins || 0, 500);
  animateNumber(document.getElementById("trivia-losses"), currentProfile.losses || 0, 500);

  // player avatar initial in the top bar
  const av = document.getElementById("home-avatar");
  if (av) av.textContent = (currentProfile.username || "?").charAt(0).toUpperCase();

  // arena banner + paint the app in the arena's colors
  const prog = arenaProgress(peak);
  const a = prog.arena;
  document.getElementById("arena-emoji").innerHTML = '<img src="' + a.icon + '" alt="' + a.name + '">';
  document.getElementById("arena-name").textContent = a.name;
  document.getElementById("arena-fill").style.width = prog.pct + "%";
  document.getElementById("arena-next").textContent = prog.next
    ? prog.needed + " trophies to " + prog.next.name
    : "Max arena reached — you're a legend!";
  document.getElementById("arena-peak").textContent = "Peak: " + peak + " trophies";
  buildArenaLadder(peak);
  applyArenaTheme(a);
}

// the little 7-step Knowledge Ladder strip under the arena card
function buildArenaLadder(peak) {
  const wrap = document.getElementById("arena-ladder");
  if (!wrap) return;
  wrap.innerHTML = "";
  const cur = arenaForTrophies(peak);
  for (const a of ARENAS) {
    const step = document.createElement("div");
    step.className = "ladder-step" + (peak >= a.min ? " unlocked" : "") + (a === cur ? " current" : "");
    step.title = a.name;
    const img = document.createElement("img");
    img.src = a.icon;
    img.alt = a.name;
    step.appendChild(img);
    if (peak < a.min) {
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
  const peak = (currentProfile && currentProfile.peak_trophies) || 0;
  const a = arenaForTrophies(peak);
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
