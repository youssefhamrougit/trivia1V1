// ============================================================================
//  app.js — the "main" file for TriviaDuel
//
//  What it does:
//    1. On startup: check the Supabase keys in js/config.js, then check
//       whether you are already logged in.
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

// when the Supabase keys in js/config.js are missing, reveal the small hint
// on the auth screen (replaces the old blocking "Almost ready" page)
function showKeysHint() {
  const el = document.getElementById("auth-keys-hint");
  if (el) el.style.display = "block";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function randomInt(n) {
  return Math.floor(Math.random() * n);
}

// ---- the router: show one screen, hide the rest ---------------------------

function go(screenId) {
  document.querySelectorAll(".screen").forEach(function (s) {
    s.classList.remove("active");
  });
  document.getElementById(screenId).classList.add("active");

  if (screenId === "screen-trivia-home") loadTriviaHome();
  if (screenId === "screen-leaderboard") loadLeaderboard();
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

function authSignUp() {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!email || password.length < 6) {
    setError("auth-error", "Enter an email and a password of at least 6 characters.");
    return;
  }
  setError("auth-error", "");
  API.call("/api/auth/signup", { method: "POST", body: { email: email, password: password } })
    .then(afterAuth)
    .catch(function (err) { setError("auth-error", err.message); });
}

function authLogIn() {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!email || !password) {
    setError("auth-error", "Enter your email and password.");
    return;
  }
  setError("auth-error", "");
  API.call("/api/auth/login", { method: "POST", body: { email: email, password: password } })
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
    setError("auth-error", (data && data.message) || "Please check your email or log in.");
    return;
  }
  API.saveSession({ access_token: session.access_token }, session.user || null);
  afterLogin(session.user);
}

async function afterLogin(user) {
  currentUser = user || null;
  await loadMyProfile();
  go("screen-trivia-home");
}

function authSignOut() {
  API.call("/api/auth/logout", { method: "POST", body: {} }).catch(function () {});
  API.clearSession();
  currentUser = null;
  currentProfile = null;
  triviaCleanup();
  resetArenaTheme();
  go("screen-auth");
}

// ---- app startup -----------------------------------------------------------
//
// The app is a static site that talks to Supabase directly. No backend to
// wait for: we open the auth screen right away, even if the keys in
// js/config.js are still missing (online play just won't work until they're
// added — a small hint on the auth screen explains it).

async function appInit() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  // connect to Supabase and restore the saved session (if any)
  try { await API.init(); } catch (e) { console.error("API.init:", e.message); }

  if (!API.configured) {
    // no keys in js/config.js yet — skip the old "Almost ready" screen and
    // open the app anyway, with a gentle hint on the auth screen
    resetArenaTheme();
    showKeysHint();
    go("screen-auth");
    return;
  }

  await afterBoot();
}

// logged in → home, otherwise → the auth screen
async function afterBoot() {
  if (API.token) {
    const me = await loadMyProfile();
    if (me && me.profile) {
      go("screen-trivia-home");
      return;
    }
    API.clearSession();
  }
  go("screen-auth");
}
