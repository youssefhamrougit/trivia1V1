// ============================================================================
//  app.js — the "main" file for TriviaDuel
//
//  What it does:
//    1. On startup: check that the C++ backend is configured, then check
//       whether you are already logged in.
//    2. Login / signup / guest / sign-out (all proxied through the C++ server).
//    3. Show and hide screens (the router).
//    4. Shared little helpers.
// ============================================================================

// ---- global state: who is the current user? ------------------------------
let currentUser = null;    // has .id
let currentProfile = null; // the database row for this user (elo, wins, ...)

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

// ---- the router: show one screen, hide the rest ---------------------------

function go(screenId) {
  document.querySelectorAll(".screen").forEach(function (s) {
    s.classList.remove("active");
  });
  document.getElementById(screenId).classList.add("active");

  if (screenId === "screen-trivia-home") loadTriviaHome();
  if (screenId === "screen-leaderboard") loadLeaderboard();
}

// ---- loading my profile row (from the C++ backend) -------------------------

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
// The "Almost ready" screen used to appear for THREE different problems, which
// is why it looked stuck:
//   1. the page is opened straight from disk (file://) — the browser can't
//      reach /api/status at all, no matter what you paste into config.ini
//   2. the C++ backend isn't running (or is on another port)
//   3. the backend is up, but the Supabase keys are missing
// Each case now gets its own explanation and the right fix.

let setupRetryTimer = null;

function stopSetupRetry() {
  if (setupRetryTimer) { clearInterval(setupRetryTimer); setupRetryTimer = null; }
}

// flavour: "config" (keys missing) | "offline" (backend down, auto-retry) | "file" (opened from disk)
function showSetup(flavour) {
  stopSetupRetry();
  resetArenaTheme();

  const title = document.getElementById("setup-title");
  const desc = document.getElementById("setup-desc");
  const steps = document.getElementById("setup-steps");
  const btn = document.getElementById("setup-reload");

  if (flavour === "config") {
    title.textContent = "Almost ready";
    desc.innerHTML =
      "TriviaDuel runs on a <b>C++ backend</b> which talks to a free database called <b>Supabase</b>. " +
      "You just need to paste 2 keys into <code>backend/config.ini</code>.";
    steps.innerHTML =
      "<li>Create a free project at <b>supabase.com</b></li>" +
      "<li>Open the SQL Editor and run <code>database/schema.sql</code>, then <code>database/seed.sql</code></li>" +
      "<li>Copy your <b>Project URL</b> and <b>anon key</b> into <code>backend/config.ini</code></li>" +
      "<li>Restart the backend (<code>backend/app.exe</code>) and refresh this page</li>";
    btn.textContent = "I added the keys — reload";
    btn.onclick = function () { location.reload(); };
  } else if (flavour === "offline") {
    title.textContent = "Backend not running";
    desc.innerHTML =
      "This page can't reach the <b>C++ backend</b> — the little server that serves the app " +
      "and talks to Supabase. Start it, and this screen will refresh itself.";
    steps.innerHTML =
      "<li>Build it (first time only): <code>cd backend && make</code></li>" +
      "<li>Run it from the project root: <code>./backend/app.exe</code></li>" +
      "<li>You should see: <code>C++ backend listening on http://localhost:3000</code></li>" +
      "<li>Keep this tab open — it will move on automatically</li>";
    btn.textContent = "Retry now";
    btn.onclick = function () { appInit(); };
    startSetupRetry();
  } else { // "file"
    title.textContent = "Open it from the backend";
    desc.innerHTML =
      "You opened <code>index.html</code> straight from disk (a <code>file://</code> page). " +
      "The browser can't reach the backend's <code>/api/status</code> from a file, so the app " +
      "will never move past this screen here.";
    steps.innerHTML =
      "<li>Start the backend: <code>./backend/app.exe</code> from the project root</li>" +
      "<li>Then open this address in your browser instead of the file:</li>";
    btn.textContent = "Open http://localhost:3000";
    btn.onclick = function () { location.href = "http://localhost:3000"; };
  }

  go("screen-setup");
}

// while stuck on the "offline" screen, keep pinging /api/status every few
// seconds; the moment the backend answers, finish startup with no reload
function startSetupRetry() {
  stopSetupRetry();
  setupRetryTimer = setInterval(async function () {
    let status = null;
    try { status = await API.call("/api/status"); } catch (e) { status = null; }
    if (!status) return;                            // still down — keep waiting
    if (!status.configured) showSetup("config");   // up, but needs keys
    else await afterBoot();                         // up + configured — carry on
  }, 3000);
}

async function appInit() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  let status = null;
  try { status = await API.call("/api/status"); } catch (e) { status = null; }

  if (location.protocol === "file:") { showSetup("file"); return; }
  if (!status) { showSetup("offline"); return; }        // backend down — auto-retry
  if (!status.configured) { showSetup("config"); return; }  // keys missing
  await afterBoot();
}

// the normal post-boot path: logged in → home, otherwise → auth
async function afterBoot() {
  stopSetupRetry();
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
