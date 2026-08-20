// ============================================================================
//  friends.js — the Friends tab
//
//    • search players by username and send friend requests
//    • see incoming requests (accept / decline) and your friend list
//    • 1v1 challenges: challenge a friend -> they get a live notification
//      -> they accept -> the normal match flow takes over
//    • friend duels are CASUAL: the winner is recorded but no trophies move
//
//  Everything is routed through Supabase (tables + RPCs in
//  database/friends-bots.sql — run that file before using this tab).
// ============================================================================

let friendsStream = null; // live Realtime listener for incoming challenges

// ---- tiny helpers ----------------------------------------------------------

// escape a username before it goes into innerHTML (usernames are user input)
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function friendAvatar(p) {
  const ch = (p && p.username ? p.username.charAt(0) : "?").toUpperCase();
  return '<div class="ring"><div class="avatar">' + esc(ch) + "</div></div>";
}

// ---- friends screen tabs: "Add Friend" | "Requests" ------------------------
function switchFriendsTab(tab) {
  const addTab = document.getElementById("tab-add");
  const reqTab = document.getElementById("tab-requests");
  const addPane = document.getElementById("friends-pane-add");
  const reqPane = document.getElementById("friends-pane-requests");
  if (addTab) addTab.classList.toggle("active", tab === "add");
  if (reqTab) reqTab.classList.toggle("active", tab === "requests");
  if (addPane) addPane.hidden = tab !== "add";
  if (reqPane) reqPane.hidden = tab !== "requests";
}

// ============================================================================
//  MAIN LOADER  (called by the router when the Friends screen opens)
// ============================================================================

async function loadFriends() {
  const reqs = document.getElementById("friends-requests");
  const list = document.getElementById("friends-list");
  const chall = document.getElementById("friends-challenges");

  if (reqs) reqs.innerHTML = "<p class='muted small'>Loading…</p>";
  if (list) list.innerHTML = "";
  if (chall) chall.innerHTML = "";

  let data = null;
  try {
    data = await API.call("/api/friends");
  } catch (err) {
    const msg = /does not exist|PGRST/i.test(err.message || "")
      ? "Friends isn't set up yet — run database/friends-bots.sql (see README)."
      : err.message;
    if (reqs) reqs.innerHTML = "<p class='muted'>" + esc(msg) + "</p>";
    return;
  }

  renderFriendRequests(reqs, data.requests || []);
  renderFriends(list, data.friends || [], data.outgoing || []);
  loadChallenges();
  refreshFriendsBadge();
}

// ============================================================================
//  SEARCH + SEND REQUEST
// ============================================================================

async function friendsSearch() {
  const input = document.getElementById("friends-search");
  const q = (input.value || "").trim();
  const wrap = document.getElementById("friends-search-results");
  if (q.length < 2) {
    wrap.innerHTML = "<p class='muted small'>Type at least 2 characters.</p>";
    return;
  }
  wrap.innerHTML = "<p class='muted small'>Searching…</p>";

  let rows = [];
  try {
    rows = await API.call("/api/friends/search", { method: "POST", body: { q: q } });
  } catch (err) {
    wrap.innerHTML = "<p class='muted'>" + esc(err.message) + "</p>";
    return;
  }

  wrap.innerHTML = "";
  if (!rows.length) {
    wrap.innerHTML = "<p class='muted'>No players found.</p>";
    return;
  }
  for (const r of rows) {
    const row = document.createElement("div");
    row.className = "friend-row";
    row.innerHTML =
      friendAvatar(r) +
      '<div class="friend-info"><b>' + esc(r.username) + "</b>" +
      '<span class="muted small">' + (r.trophies || 0) + ' <img class="pill-icon" src="assets/icons/trophy.svg" alt=""> trophies</span></div>';
    const btn = document.createElement("button");
    btn.className = "mini-btn";
    btn.textContent = "Add";
    btn.onclick = function () { sendFriendRequest(r.username, btn); };
    row.appendChild(btn);
    wrap.appendChild(row);
  }
}

async function sendFriendRequest(username, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "…"; }
  try {
    const res = await API.call("/api/friends/request", { method: "POST", body: { username: username } });
    const status = res.status;
    if (status === "pending") { showToast("Friend request sent!", "ok"); if (btn) btn.textContent = "Sent"; }
    else if (status === "already_friends") { showToast("You're already friends", "gold"); if (btn) btn.textContent = "Friends"; }
    else if (status === "pending_exists") { showToast("A request already exists", "gold"); if (btn) btn.textContent = "Sent"; }
    else if (status === "self") { showToast("That's you!", "err"); }
    else if (status === "bot") { showToast("QuizBot can't be friended", "err"); }
    else if (status === "not_found") { showToast("No player with that username", "err"); }
    else { showToast("Something went wrong", "err"); }
  } catch (err) {
    showToast(err.message || "Couldn't send the request.", "err");
    if (btn) { btn.disabled = false; btn.textContent = "Add"; }
  }
}

// ============================================================================
//  REQUESTS + FRIEND LIST
// ============================================================================

function renderFriendRequests(wrap, requests) {
  if (!wrap) return;
  if (!requests.length) { wrap.innerHTML = ""; return; }
  let html = '<div class="friends-section"><h3>Requests <span class="badge">' + requests.length + "</span></h3>";
  for (const r of requests) {
    html +=
      '<div class="friend-row">' +
      friendAvatar(r) +
      '<div class="friend-info"><b>' + esc(r.username) + "</b>" +
      '<span class="muted small">wants to battle</span></div>' +
      '<button class="mini-btn green" onclick="acceptFriendRequest(\'' + r.rowId + '\')">Accept</button>' +
      '<button class="mini-btn red" onclick="declineFriendRequest(\'' + r.rowId + '\')">X</button>' +
      "</div>";
  }
  wrap.innerHTML = html + "</div>";
}

function renderFriends(wrap, friends, outgoing) {
  if (!wrap) return;
  if (!friends.length) {
    wrap.innerHTML = '<div class="friends-section"><h3>Your friends</h3><p class="muted small">No friends yet — search for someone above.</p></div>';
    return;
  }
  let html = '<div class="friends-section"><h3>Your friends <span class="badge">' + friends.length + "</span></h3>";
  for (const f of friends) {
    const wait = outgoing.find(function (o) { return o.friendId === f.id; });
    html +=
      '<div class="friend-row">' +
      friendAvatar(f) +
      '<div class="friend-info"><b>' + esc(f.username) + "</b>" +
      '<span class="muted small">' + (f.trophies || 0) + ' <img class="pill-icon" src="assets/icons/trophy.svg" alt=""> trophies</span></div>' +
      (wait
        ? '<button class="mini-btn red" title="Cancel the challenge you sent" onclick="cancelChallenge(\'' + wait.matchId + '\', this)">Cancel</button>'
        : '<button class="mini-btn" onclick="challengeFriend(\'' + f.id + '\', this)">1v1</button>') +
      '<button class="mini-btn red" title="Remove friend" onclick="removeFriend(\'' + f.rowId + '\')">✕</button>' +
      "</div>";
  }
  wrap.innerHTML = html + "</div>";
}

async function acceptFriendRequest(rowId) {
  try {
    await API.call("/api/friends/accept", { method: "POST", body: { id: rowId } });
    showToast("You're now friends!", "ok");
    loadFriends();
  } catch (err) { showToast(err.message || "Couldn't accept.", "err"); }
}

async function declineFriendRequest(rowId) {
  try {
    await API.call("/api/friends/decline", { method: "POST", body: { id: rowId } });
    showToast("Request declined", "ok");
    loadFriends();
  } catch (err) { showToast(err.message || "Couldn't decline.", "err"); }
}

async function removeFriend(rowId) {
  if (!window.confirm("Remove this friend?")) return;
  try {
    await API.call("/api/friends/remove", { method: "POST", body: { id: rowId } });
    showToast("Friend removed", "ok");
    loadFriends();
  } catch (err) { showToast(err.message || "Couldn't remove.", "err"); }
}

// ============================================================================
//  1v1 CHALLENGES (casual duels — no trophies)
// ============================================================================

// I challenge a friend: create a 'challenged' match row in Supabase, then
// listen (Realtime + a poll) for them to accept — the normal match flow then
// takes over.
async function challengeFriend(friendId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "…"; }
  try {
    const res = await API.call("/api/friends/challenge", { method: "POST", body: { friendId: friendId } });
    if (!res.match_id) {
      showToast("A challenge to that friend is already pending.", "gold");
      loadFriends(); // re-render so the button isn't left stuck on "…"
      return;
    }

    triviaState.mode = "online";
    triviaState.casual = true;
    triviaState.started = false;
    triviaState.ending = false;
    triviaState.matchId = res.match_id;
    triviaState.myAnswers = {};

    closeStream();
    triviaState.stream = API.stream("queue-" + res.match_id, function (ev) {
      if (ev.type === "match_active") triviaStartMatch(res.match_id);
      else if (ev.type === "match_declined") {
        triviaState.matchId = null;
        closeStream();
        if (triviaState.mode === "online" && !triviaState.started) triviaState.mode = null;
        showToast("Your friend declined the challenge", "err");
        loadFriends();
      }
    });
    // safety net if the stream hiccups. If the friend never answers, the
    // challenge is expired cleanly (cancel + re-render) instead of being
    // kicked to the home screen — and it can never be accepted into a match
    // where the challenger doesn't show up.
    triviaPollForOpponent(0, function () {
      // (started => the friend just accepted and the match is already live —
      //  never expire something that's running)
      if (!triviaState.matchId || triviaState.mode !== "online" || triviaState.started) return;
      triviaState.matchId = null;
      closeStream();
      triviaState.mode = null;
      API.call("/api/friends/cancelchallenge", { method: "POST", body: { matchId: res.match_id } })
        .then(function (r) {
          // the friend accepted in the same instant — play it out after all
          if (r && r.match_id && !triviaState.started) {
            triviaState.mode = "online";
            triviaState.casual = true;
            triviaState.started = false;
            return triviaStartMatch(r.match_id);
          }
          showToast("Your friend didn't answer — the challenge expired.", "err");
        })
        .catch(function () {
          // the row is already finished — nothing to clean up, still say so
          showToast("Your friend didn't answer — the challenge expired.", "err");
        });
      loadFriends();
    });

    showToast("Challenge sent — waiting for your friend", "ok");
    loadFriends();
  } catch (err) {
    var msg = (err.message || "").indexOf("does not exist") !== -1
      ? "Friends needs a database update — re-run database/friends-bots.sql (see README)."
      : err.message;
    showToast(msg || "Couldn't send the challenge.", "err");
    if (btn) { btn.disabled = false; btn.textContent = "1v1"; }
  }
}

// I retract a challenge I sent (the friend list shows a Cancel button while
// one is pending). Race-safe: if the friend accepted at that exact instant,
// the database hands the match back and we play it instead.
async function cancelChallenge(matchId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "…"; }
  try {
    const res = await API.call("/api/friends/cancelchallenge", { method: "POST", body: { matchId: matchId } });
    if (res && res.match_id) {
      // the friend accepted in the same instant — we're duelling after all.
      // (If the stream already started it, triviaStartMatch's guard makes
      //  this a no-op and the live match keeps running untouched.)
      if (!triviaState.started) {
        triviaState.mode = "online";
        triviaState.casual = true;
        triviaState.started = false;
        triviaState.matchId = res.match_id;
        closeStream();
        await triviaStartMatch(res.match_id);
      }
      return;
    }
    triviaState.matchId = null;
    closeStream();
    if (triviaState.mode === "online" && !triviaState.started) triviaState.mode = null;
    showToast("Challenge cancelled", "ok");
    loadFriends();
  } catch (err) {
    const msg = /does not exist|PGRST/i.test(err.message || "")
      ? "Friends needs a database update — re-run database/friends-bots.sql (see README)."
      : err.message;
    showToast(msg || "Couldn't cancel the challenge.", "err");
    loadFriends();
  }
}

// ============================================================================
//  INCOMING CHALLENGES (shown on the Friends screen, updated live)
// ============================================================================

async function loadChallenges() {
  const wrap = document.getElementById("friends-challenges");
  if (!wrap) return;
  let rows = [];
  try {
    rows = await API.call("/api/friends/challenges");
  } catch (err) {
    wrap.innerHTML = "";
    return;
  }
  if (!rows.length) { wrap.innerHTML = ""; return; }

  let html = '<div class="friends-section"><h3>Challenges</h3>';
  for (const c of rows) {
    html +=
      '<div class="challenge-card">' +
      friendAvatar(c.challenger) +
      '<div class="friend-info"><b>' + esc(c.challenger.username || "Player") + "</b>" +
      '<span class="muted small">challenged you to a duel!</span></div>' +
      '<div class="challenge-actions">' +
      '<button class="mini-btn green" onclick="acceptFriendChallenge(\'' + c.matchId + '\')">Accept</button>' +
      '<button class="mini-btn red" onclick="declineFriendChallenge(\'' + c.matchId + '\')">Decline</button>' +
      "</div></div>";
  }
  wrap.innerHTML = html + "</div>";
}

async function acceptFriendChallenge(matchId) {
  try {
    await API.call("/api/friends/acceptchallenge", { method: "POST", body: { matchId: matchId } });
    showToast("Challenge accepted — good luck!", "ok");
    triviaState.mode = "online";
    triviaState.casual = true;
    triviaState.started = false;
    triviaState.ending = false;
    triviaState.myAnswers = {};
    await triviaStartMatch(matchId);
  } catch (err) {
    showToast(err.message || "Couldn't accept the challenge.", "err");
    loadFriends();
  }
}

async function declineFriendChallenge(matchId) {
  try {
    await API.call("/api/friends/declinechallenge", { method: "POST", body: { matchId: matchId } });
    showToast("Challenge declined", "ok");
    loadFriends();
  } catch (err) { showToast(err.message || "Couldn't decline.", "err"); }
}

// ============================================================================
//  LIVE LISTENER: a friend challenges ME (works anywhere in the app)
// ============================================================================

function initFriendsListener() {
  if (!API._supabase || !currentUser || !currentUser.id) return;
  closeFriendsListener();
  const sup = API._ensureClient();
  friendsStream = sup
    .channel("challenges-" + currentUser.id)
    .on("postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "matches",
        filter: "challengee=eq." + currentUser.id,
      },
      function (payload) {
        if (!payload.new || payload.new.status !== "challenged") return;
        showToast("You've been challenged — check Friends!", "gold");
        const friendsScreen = document.getElementById("screen-friends");
        if (friendsScreen && friendsScreen.classList.contains("active")) loadFriends();
        else refreshFriendsBadge();
      })
    .subscribe();
}

function closeFriendsListener() {
  if (friendsStream) {
    try { friendsStream.unsubscribe(); } catch (e) { /* already closed */ }
    friendsStream = null;
  }
}

// called when signing out
function friendsCleanup() {
  closeFriendsListener();
}

// ============================================================================
//  BADGE: pending requests + challenges shown on the home Friends chip
// ============================================================================

async function refreshFriendsBadge() {
  let n = 0;
  try {
    const d = await API.call("/api/friends");
    n += (d.requests || []).length;
    const c = await API.call("/api/friends/challenges");
    n += (c || []).length;
  } catch (e) { /* table not set up yet — badges stay hidden */ }
  // update both the home-screen chip badge and the Requests tab badge
  ["friends-badge", "friends-requests-badge"].forEach(function (id) {
    const b = document.getElementById(id);
    if (!b) return;
    b.textContent = n > 0 ? n : "";
    b.hidden = n === 0;
  });
}
