// ============================================================================
//  app.js — the "main" file for TriviaDuel
//
//  What it does:
//    1. On startup: connect to Supabase and check whether you are already
//       logged in.
//    2. Login / signup / guest / sign-out (all through Supabase directly).
//    3. Show and hide screens (the router).
//    4. Shared little helpers.
// ============================================================================

// ---- global state: who is the current user? ------------------------------
let currentUser = null;    // has .id
let currentProfile = null; // the database row for this user (trophies, wins, ...)

// ---- tiny helpers ---------------------------------------------------------

function setError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message || "";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function randomInt(n) {
  return Math.floor(Math.random() * n);
}

// ---- UI helpers: toasts, animated numbers, confetti -------------------------

// a small notification that slides in from the top and fades out.
// types: "ok" (green) | "err" (red) | "gold" (celebration)
function showToast(message, type) {
  const wrap = document.getElementById("toast-wrap");
  if (!wrap) return;
  const t = document.createElement("div");
  t.className = "toast" + (type ? " " + type : "");
  t.textContent = message;
  wrap.appendChild(t);
  setTimeout(function () { t.classList.add("show"); }, 10);
  setTimeout(function () {
    t.classList.remove("show");
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
  }, 2600);
}

// count a number up (or down) inside `el` with a smooth ease-out tween.
// each call cancels the previous tween, so rapid live score updates stay smooth.
function animateNumber(el, to, duration) {
  if (!el) return;
  duration = duration || 320;
  const start = el._v !== undefined ? el._v : (parseInt(el.textContent, 10) || 0);
  if (el._raf) cancelAnimationFrame(el._raf);
  if (start === to) { el.textContent = to; el._v = to; return; }
  const t0 = performance.now();
  function step(now) {
    const p = Math.min(1, (now - t0) / duration);
    const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
    el.textContent = Math.round(start + (to - start) * e);
    if (p < 1) el._raf = requestAnimationFrame(step);
    else { el._v = to; el._raf = null; }
  }
  el._v = to;
  el._raf = requestAnimationFrame(step);
}

// a confetti fountain — used for big wins and arena unlocks
let _confettiRunning = false;
function confettiBurst() {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas || _confettiRunning) return;
  const ctx = canvas.getContext("2d");
  const colors = ["#8b5cf6", "#ec4899", "#22d3ee", "#2dd4bf", "#fbbf24", "#fb7185", "#a78bfa"];
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * DPR;
  canvas.height = innerHeight * DPR;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const parts = [];
  const cx = innerWidth / 2;
  const cy = innerHeight * 0.82;
  for (let i = 0; i < 160; i++) {
    parts.push({
      x: cx + (Math.random() - 0.5) * 90,
      y: cy + Math.random() * 20,
      vx: (Math.random() - 0.5) * 8,
      vy: -(Math.random() * 11 + 5),
      g: 0.16,
      s: Math.random() * 7 + 4,
      c: colors[(Math.random() * colors.length) | 0],
      r: Math.random() * Math.PI * 2,
      rs: (Math.random() - 0.5) * 0.3,
      life: 1,
      rect: Math.random() < 0.6,
    });
  }

  _confettiRunning = true;
  canvas.style.display = "block";
  const t0 = performance.now();
  function frame(now) {
    const dt = (now - t0) / 1000; // seconds since the burst started
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = false;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive = true;
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.rs;
      p.life -= dt * 0.72;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      if (p.rect) ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      else { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (alive) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      canvas.style.display = "none";
      _confettiRunning = false;
    }
  }
  requestAnimationFrame(frame);
}

// ---- arena unlock modal (Clash-Royale style celebration) -------------------

let _arenaModalLastFocus = null;

// show the full-screen "Arena unlocked!" modal themed in the arena's colors,
// with confetti. Called from the result screen when a win crosses a threshold.
function showArenaUnlock(arena) {
  const modal = document.getElementById("arena-modal");
  if (!modal) return;

  document.getElementById("arena-modal-icon").innerHTML =
    '<img src="' + arena.icon + '" alt="' + arena.name + '">';
  document.getElementById("arena-modal-name").textContent = arena.name;
  document.getElementById("arena-modal-blurb").textContent = arena.blurb || "";
  document.getElementById("arena-modal-req").textContent = "Reached " + arena.min + " trophies";

  // paint the card, icon and button in the arena's colors
  const card = modal.querySelector(".arena-modal-card");
  card.style.setProperty("--arena-c1", arena.theme.c1);
  card.style.setProperty("--arena-c2", arena.theme.c2);
  card.style.setProperty("--arena-glow", arena.theme.glow);

  // replay the entrance ceremony on every unlock: reflow the card so the
  // gated child animations (kicker, icon pop, name, …) run again
  card.classList.remove("celebrating");
  void card.offsetWidth;
  card.classList.add("celebrating");
  modal.classList.remove("show");
  void modal.offsetWidth;
  modal.classList.add("show");
  confettiBurst();

  // keyboard support: Escape closes, and focus moves to the Continue button
  _arenaModalLastFocus = document.activeElement;
  const btn = modal.querySelector(".arena-modal-btn");
  if (btn) setTimeout(function () { btn.focus(); }, 260);
  if (!window._arenaModalEsc) {
    window._arenaModalEsc = function (e) {
      if (e.key === "Escape") closeArenaModal();
    };
    document.addEventListener("keydown", window._arenaModalEsc);
  }
}

function closeArenaModal() {
  const modal = document.getElementById("arena-modal");
  if (!modal) return;
  modal.classList.remove("show");
  if (window._arenaModalEsc) {
    document.removeEventListener("keydown", window._arenaModalEsc);
    window._arenaModalEsc = null;
  }
  if (_arenaModalLastFocus && _arenaModalLastFocus.focus) {
    _arenaModalLastFocus.focus();
    _arenaModalLastFocus = null;
  }
}

// ---- the router: show one screen, hide the rest ---------------------------

function go(screenId) {
  document.querySelectorAll(".screen").forEach(function (s) {
    s.classList.remove("active");
  });
  document.getElementById(screenId).classList.add("active");

  if (screenId === "screen-trivia-home") loadTriviaHome();
  if (screenId === "screen-leaderboard") loadLeaderboard();
  if (screenId === "screen-friends") loadFriends();
}

// ---- loading my profile row (from Supabase) -------------------------

async function loadMyProfile() {
  try {
    const me = await API.call("/api/me");
    if (me.user) currentUser = me.user;
    currentProfile = me.profile || null;
    return me;
  } catch (err) {
    console.error("loadMyProfile:", err.message);
    return null;
  }
}

// ---- auth: sign up / log in / guest / sign out -----------------------------

// a username is 3–20 characters: letters, digits, underscore
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function authSignUp() {
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!USERNAME_RE.test(username)) {
    setError("auth-error", "Username: 3–20 letters, numbers or underscores.");
    return;
  }
  if (password.length < 6) {
    setError("auth-error", "Password must be at least 6 characters.");
    return;
  }
  setError("auth-error", "");
  API.call("/api/auth/signup", { method: "POST", body: { username: username, password: password } })
    .then(afterAuth)
    .catch(function (err) { setError("auth-error", err.message); });
}

function authLogIn() {
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!username || !password) {
    setError("auth-error", "Enter your username and password.");
    return;
  }
  setError("auth-error", "");
  API.call("/api/auth/login", { method: "POST", body: { username: username, password: password } })
    .then(afterAuth)
    .catch(function (err) { setError("auth-error", err.message); });
}

function authGuest() {
  setError("auth-error", "");
  API.call("/api/auth/guest", { method: "POST", body: {} })
    .then(afterAuth)
    .catch(function (err) { setError("auth-error", err.message); });
}

function afterAuth(data) {
  const session = data.session || data;
  if (!session || !session.access_token) {
    if (data && data.needsConfirm) {
      setError("auth-error", "Account created! Confirm your email first, then log in. (Or turn off \"Confirm email\" in Supabase — see README.)");
    } else {
      setError("auth-error", (data && data.message) || "Please check your email or log in.");
    }
    return;
  }
  API.saveSession({ access_token: session.access_token }, session.user || null);
  afterLogin(session.user);
}

async function afterLogin(user) {
  currentUser = user || null;
  await loadMyProfile();
  initFriendsListener(); // live incoming-challenge listener (Supabase Realtime)
  go("screen-trivia-home");
}

function authSignOut() {
  API.call("/api/auth/logout", { method: "POST", body: {} }).catch(function () {});
  API.clearSession();
  currentUser = null;
  currentProfile = null;
  triviaCleanup();
  friendsCleanup();
  resetArenaTheme();
  go("screen-auth");
}

// ---- app startup -----------------------------------------------------------
//
// The app is a static site that talks to Supabase directly. No backend to
// wait for: we connect, restore the saved session (if any), and open the
// right screen.

async function appInit() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  // connect to Supabase and restore the saved session (if any)
  try { await API.init(); } catch (e) { console.error("API.init:", e.message); }

  await afterBoot();
}

// logged in → home, otherwise → the auth screen
async function afterBoot() {
  if (API.token) {
    const me = await loadMyProfile();
    if (me && me.profile) {
      initFriendsListener();
      go("screen-trivia-home");
      return;
    }
    API.clearSession();
  }
  go("screen-auth");
}
