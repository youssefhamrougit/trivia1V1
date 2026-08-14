// ============================================================================
//  api.js — talk to Supabase DIRECTLY from the browser.
//
//  The browser is the only client — auth, data and game logic all live on
//  Supabase:
//    - auth ......... GoTrue        (sign-up / log-in / guest)
//    - tables ....... PostgREST     (profiles, questions, matches)
//    - game logic ... Postgres RPCs (join_matchmaking, finish_match)
//    - live scores .. Supabase Realtime (the matches table is published)
//
//  The functions below keep the SAME names the rest of the app expects
//  (API.call, API.stream, API.saveSession, ...) so the game code didn't
//  have to change.
// ============================================================================

const BOT_ID = "00000000-0000-0000-0000-000000000001";

// ---- disguised skill bots (see database/stealth-bots.sql) -----------------
// These are the "hidden" opponents the app pairs you with when no human joins
// the queue within 7 seconds. They look like real players (human names,
// trophies that move) but must never appear on the leaderboard or in friend
// search — keep this list in sync with the ids in database/stealth-bots.sql.
const STEALTH_BOT_IDS = [
  "00000000-0000-0000-0000-0000000000a1", // Nova
  "00000000-0000-0000-0000-0000000000a2", // Vortex
  "00000000-0000-0000-0000-0000000000a3", // ShadowFox
  "00000000-0000-0000-0000-0000000000a4", // PixelRider
  "00000000-0000-0000-0000-0000000000a5", // EmberBlaze
  "00000000-0000-0000-0000-0000000000a6", // Quasar
  "00000000-0000-0000-0000-0000000000a7", // Zephyr
  "00000000-0000-0000-0000-0000000000a8", // Luna
  "00000000-0000-0000-0000-0000000000a9", // NeonWolf
  "00000000-0000-0000-0000-0000000000aa", // Raptor
];
const BOT_IDS = [BOT_ID].concat(STEALTH_BOT_IDS);

// PostgREST expects the value list of an `in` filter wrapped in parentheses
// (`not.in.(a,b,c)`), but supabase-js's .not() operator concatenates the raw
// value and drops the parens — which makes PostgREST fail to parse the filter.
// Build the parenthesised list once and pass it through .filter() instead.
const BOT_IDS_FILTER = "(" + BOT_IDS.join(",") + ")";

// ---- username + password auth -------------------------------------------------
// Supabase GoTrue only signs people up with an email, so we turn the chosen
// username into a private per-user email:  <username>@triviaduel.local
// The player never sees this — for them it's just username + password.
// (Requires "Confirm email" to be OFF in the Supabase dashboard — see README.)
const AUTH_DOMAIN = "triviaduel.local";

function usernameToEmail(username) {
  return String(username || "")
    .trim().toLowerCase()
    .replace(/[^a-z0-9_]/g, "") + "@" + AUTH_DOMAIN;
}

// the arena the player currently sits in (from their trophies). Matchmaking
// tilts 4 of the match's 10 questions toward it, so each arena "feels" themed.
async function _arenaSignature(uid) {
  let sig = "mixed";
  const prof = await API._ensureClient().from("profiles").select("trophies").eq("id", uid).limit(1);
  if (!prof.error && prof.data && prof.data[0]) {
    const trophies = prof.data[0].trophies || 0;
    if (trophies >= 540) sig = "Math";
    else if (trophies >= 400) sig = "History";
    else if (trophies >= 260) sig = "Football";
    else if (trophies >= 120) sig = "Science";
  }
  return sig;
}

const API = {
  _supabase: null,
  token: null, // the JWT of the current session (null = logged out)
  user: null,  // the supabase user object of the current session

  // build the supabase client + restore the saved session (if any)
  async init() {
    if (this._supabase) return false;
    if (!window.supabase) throw new Error("Service is temporarily unavailable — please try again.");
    this._supabase = window.supabase.createClient(
      window.TRIVIA1V1_CONFIG.SUPABASE_URL,
      window.TRIVIA1V1_CONFIG.SUPABASE_ANON_KEY
    );
    const { data } = await this._supabase.auth.getSession();
    const s = data && data.session;
    this.token = s ? s.access_token : null;
    this.user = s ? s.user : null;
    return true;
  },

  _ensureClient() {
    if (!this._supabase) throw new Error("Supabase is not initialised");
    return this._supabase;
  },

  async _uid() {
    const { data, error } = await this._ensureClient().auth.getUser();
    if (error || !data || !data.user) return null;
    return data.user.id;
  },

  // one logical call, mirroring the old /api/* routes
  async call(path, opts) {
    const sup = this._ensureClient();
    const body = (opts && opts.body) || {};

    // ---- auth (GoTrue) ------------------------------------------------------
    if (path === "/api/auth/signup") {
      const username = String(body.username || "").trim().toLowerCase();
      const { data, error } = await sup.auth.signUp({
        email: usernameToEmail(username),
        password: body.password,
        options: { data: { username: username } }, // the SQL trigger claims it on the profile row
      });
      if (error) {
        // the friendliest way to read "User already registered"
        if (/already registered|already been registered/i.test(error.message)) {
          throw new Error("That username is taken — try another.");
        }
        throw new Error(error.message);
      }
      // email confirmation is ON: no session yet, the player must confirm first
      if (data.user && !data.session) {
        return { session: null, user: data.user, needsConfirm: true };
      }
      // backup claim in case the trigger hasn't been (re)created yet
      if (data.user && data.session) {
        try {
          await sup.from("profiles").update({ username: username }).eq("id", data.user.id);
        } catch (e) { /* the trigger probably handled it */ }
      }
      return { session: data.session, user: data.user || null };
    }
    if (path === "/api/auth/login") {
      const username = String(body.username || "").trim().toLowerCase();
      const { data, error } = await sup.auth.signInWithPassword({
        email: usernameToEmail(username),
        password: body.password,
      });
      if (error) throw new Error(error.message);
      return { session: data.session, user: data.user || null };
    }
    if (path === "/api/auth/guest") {
      const { data, error } = await sup.auth.signInAnonymously();
      if (error) throw new Error(error.message);
      return { session: data.session, user: data.user || null };
    }
    if (path === "/api/auth/logout") {
      await sup.auth.signOut().catch(function () {});
      return { ok: true };
    }

    // ---- me / leaderboard / questions (PostgREST) ---------------------------
    if (path === "/api/me") {
      const uid = await this._uid();
      if (!uid) throw new Error("Invalid session");
      const { data: rows, error } = await sup.from("profiles").select("*").eq("id", uid).limit(1);
      if (error) throw new Error(error.message);
      return { user: { id: uid }, profile: (rows && rows[0]) || null };
    }
    if (path === "/api/leaderboard") {
      let { data, error } = await sup.from("profiles")
        .select("*").filter("id", "not.in", BOT_IDS_FILTER).order("trophies", { ascending: false }).limit(50);
      if (error || !data || data.length === 0) {
        // pre-migration databases still use "elo" — fall back so the screen
        // keeps working until setup-demo.sql is run
        const fb = await sup.from("profiles")
          .select("*").filter("id", "not.in", BOT_IDS_FILTER).order("elo", { ascending: false }).limit(50);
        if (!fb.error && fb.data && fb.data.length) { data = fb.data; error = null; }
      }
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (path.indexOf("/api/questions") === 0) {
      // limit 1000 so the whole bank (480 questions) is reachable — the
      // practice mode needs to see every category to build varied matches
      const { data, error } = await sup.from("questions").select("*").limit(1000);
      if (error) throw new Error(error.message);
      return data || [];
    }

    // ---- matchmaking: the Postgres function pairs us ------------------------
    if (path === "/api/trivia/join") {
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");
      // arena signature discipline (mirrors the original backend logic): the RPC tilts
      // 4 of the match's 10 questions toward the arena the player is currently in
      const sig = await _arenaSignature(uid);
      const { data, error } = await sup.rpc("join_matchmaking", { me: uid, sig: sig });
      if (error) throw new Error(error.message);
      return { match_id: data };
    }

    // ---- cancel: atomically remove an abandoned waiting match (left the
    // queue, or the 7-second human-search window ran out). If a human JUST
    // joined it in that instant, the RPC hands the match back instead and
    // we play that human. Returns { match_id } or { match_id: null }.
    if (path === "/api/trivia/cancel") {
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");
      const { data, error } = await sup.rpc("cancel_matchmaking", { me: uid });
      if (error) throw new Error(error.message);
      return { match_id: data };
    }

    // ---- stealth bot: no human joined within the 7-second window — create
    // a REAL, human-looking match against a skill-matched bot (see
    // database/stealth-bots.sql). The client simulates the bot's answers.
    if (path === "/api/trivia/botmatch") {
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");
      const sig = await _arenaSignature(uid);
      const { data, error } = await sup.rpc("start_bot_match", { me: uid, sig: sig });
      if (error) throw new Error(error.message);
      return { match_id: data };
    }

    // ---- match detail: row + opponent + the 10 questions --------------------
    const m = path.match(/^\/api\/trivia\/match\/([^?]+)/);
    if (m) {
      const id = m[1];
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");
      const { data: rows, error } = await sup.from("matches").select("*").eq("id", id).limit(1);
      if (error) throw new Error(error.message);
      if (!rows || !rows[0]) throw new Error("Match not found");
      const match = rows[0];
      if (match.player1 !== uid && match.player2 !== uid) throw new Error("Not your match");

      const oppId = match.player1 === uid ? match.player2 : match.player1;
      let opp = {};
      if (oppId) {
        const o = await sup.from("profiles").select("id,username").eq("id", oppId).limit(1);
        if (!o.error && o.data && o.data[0]) opp = o.data[0];
      }

      const qs = [];
      if (Array.isArray(match.question_ids) && match.question_ids.length) {
        const q = await sup.from("questions").select("*").in("id", match.question_ids);
        if (!q.error && q.data) {
          for (const qid of match.question_ids) {
            const hit = q.data.find(function (x) { return x.id === qid; });
            if (hit) qs.push(hit);
          }
        }
      }

      // which questions have I already answered in this match? (question_id →
      // correct). Used by the sync 1v1 flow to resume the right state after a
      // reload mid-round — e.g. re-enter the "waiting for opponent" state
      // instead of letting the player answer the same question twice.
      const myAnswers = {};
      const a = await sup.from("match_answers")
        .select("question_id, correct")
        .eq("match_id", id).eq("player_id", uid);
      if (!a.error && a.data) a.data.forEach(function (x) { myAnswers[x.question_id] = x.correct; });

      return { match: match, opponent: opp, questions: qs, myAnswers: myAnswers };
    }

    // ---- bot difficulty (easy / medium / hard) -------------------------------
    if (path === "/api/bot/config") {
      const { data, error } = await sup.from("bot_config").select("*").order("difficulty");
      if (error) {
        // PLACEHOLDER: run database/friends-bots.sql to create bot_config.
        // The game falls back to built-in difficulty defaults, so practice
        // still works until then.
        console.warn("PLACEHOLDER — bot_config table missing. Run database/friends-bots.sql (see README).");
        return null;
      }
      return data || null;
    }

    // ---- friends -------------------------------------------------------------
    if (path === "/api/friends/search") {
      const uid = await this._uid();
      const q = String(body.q || "").trim();
      if (q.length < 2) return [];
      const { data, error } = await sup.from("profiles")
        .select("id,username,trophies")
        .ilike("username", "%" + q + "%")
        .neq("id", uid).filter("id", "not.in", BOT_IDS_FILTER)
        .order("trophies", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (path === "/api/friends/request") {
      const { data, error } = await sup.rpc("send_friend_request", { to_username: body.username });
      if (error) throw new Error(error.message);
      return { status: data };
    }
    if (path === "/api/friends") {
      const uid = await this._uid();
      const [reqRes, accRes, outRes] = await Promise.all([
        sup.from("friends").select("id,requester,created_at").eq("addressee", uid).eq("status", "pending"),
        sup.from("friends").select("id,requester,addressee,created_at").eq("status", "accepted")
          .or("requester.eq." + uid + ",addressee.eq." + uid),
        sup.from("matches").select("id,challengee").eq("player1", uid).eq("status", "challenged"),
      ]);
      if (reqRes.error) throw new Error(reqRes.error.message);
      if (accRes.error) throw new Error(accRes.error.message);
      if (outRes.error) throw new Error(outRes.error.message);

      const requests = reqRes.data || [];
      const accepted = accRes.data || [];
      const outgoing = (outRes.data || []).map(function (m) { return { friendId: m.challengee, matchId: m.id }; });

      // fetch the other party's profile for every row in one batched call
      const otherIds = requests.map(function (r) { return r.requester; });
      accepted.forEach(function (f) { otherIds.push(f.requester === uid ? f.addressee : f.requester); });
      const ids = Array.from(new Set(otherIds));
      const profiles = {};
      if (ids.length) {
        const p = await sup.from("profiles").select("id,username,trophies").in("id", ids);
        if (!p.error && p.data) p.data.forEach(function (x) { profiles[x.id] = x; });
      }

      return {
        requests: requests.map(function (r) {
          return { rowId: r.id, id: r.requester, created_at: r.created_at, ...(profiles[r.requester] || {}) };
        }),
        friends: accepted.map(function (f) {
          const oid = f.requester === uid ? f.addressee : f.requester;
          return { rowId: f.id, id: oid, ...(profiles[oid] || {}) };
        }),
        outgoing: outgoing, // { friendId, matchId } for each challenge we sent
      };
    }
    if (path === "/api/friends/accept") {
      const uid = await this._uid();
      const { data, error } = await sup.from("friends")
        .update({ status: "accepted" })
        .eq("id", body.id).eq("addressee", uid).eq("status", "pending").select("id");
      if (error) throw new Error(error.message);
      return { ok: data && data.length > 0 };
    }
    if (path === "/api/friends/decline") {
      const uid = await this._uid();
      const { error } = await sup.from("friends").delete().eq("id", body.id).eq("addressee", uid);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    if (path === "/api/friends/remove") {
      const uid = await this._uid();
      const { error } = await sup.from("friends").delete()
        .eq("id", body.id).or("requester.eq." + uid + ",addressee.eq." + uid);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // ---- friend 1v1 challenges (casual — no trophy change) -------------------
    if (path === "/api/friends/challenge") {
      const { data, error } = await sup.rpc("create_challenge", { challengee_id: body.friendId });
      if (error) throw new Error(error.message);
      return { match_id: data };
    }
    if (path === "/api/friends/challenges") {
      const uid = await this._uid();
      const { data, error } = await sup.from("matches")
        .select("id,player1,created_at")
        .eq("challengee", uid).eq("status", "challenged")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const ids = Array.from(new Set((data || []).map(function (m) { return m.player1; })));
      const profiles = {};
      if (ids.length) {
        const p = await sup.from("profiles").select("id,username,trophies").in("id", ids);
        if (!p.error && p.data) p.data.forEach(function (x) { profiles[x.id] = x; });
      }
      return (data || []).map(function (m) {
        return { matchId: m.id, created_at: m.created_at, challenger: profiles[m.player1] || { username: "Player" } };
      });
    }
    if (path === "/api/friends/acceptchallenge") {
      const uid = await this._uid();
      // the round clock starts on ACCEPT, not on challenge creation (the
      // challenge may have sat pending for minutes) — so stamp round_started_at
      const { data, error } = await sup.from("matches")
        .update({ status: "active", player2: uid, round_started_at: new Date().toISOString() })
        .eq("id", body.matchId).eq("challengee", uid).eq("status", "challenged").select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("That challenge is no longer available.");
      return { ok: true };
    }
    if (path === "/api/friends/declinechallenge") {
      const uid = await this._uid();
      const { error } = await sup.from("matches")
        .update({ status: "finished" })
        .eq("id", body.matchId).eq("challengee", uid).eq("status", "challenged");
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    if (path === "/api/friends/cancelchallenge") {
      // the challenger retracts a pending challenge (or it expired). The RPC
      // marks it finished — unless the friend accepted at the same instant,
      // in which case it hands the match back and we play it.
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");
      const { data, error } = await sup.rpc("cancel_challenge", { match_id: body.matchId });
      if (error) throw new Error(error.message);
      return { match_id: data }; // null = cancelled · an id = it just went active
    }

    // ---- stats: per-category accuracy (answer_log, see match-stats.sql) ------
    // one row per answered question, written fire-and-forget from the match.
    // Silently no-ops when the answer_log table hasn't been created yet, so
    // the game never breaks because of a missing stats migration.
    if (path === "/api/stats/answer") {
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");
      const { error } = await sup.from("answer_log")
        .insert({
          player_id: uid,
          match_id: body.match_id || null,
          question_id: body.question_id,
          category: String(body.category || "Other"),
          correct: !!body.correct,
          mode: body.mode === "bot" ? "bot" : "online",
        })
        .onConflict("player_id,match_id,question_id")
        .ignore(); // never double-count an answer (see match-stats.sql)
      if (error) {
        if (/does not exist|PGRST/i.test(error.message)) return { ok: false };
        throw new Error(error.message);
      }
      return { ok: true };
    }

    // the whole log for one player, aggregated into overall + per-category
    // accuracy. Pages through the rows because PostgREST caps a single
    // request at 1000 (10 pages = ~1000 matches of history).
    if (path === "/api/stats") {
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");
      const rows = [];
      for (let page = 0; page < 10; page++) {
        const { data, error } = await sup.from("answer_log")
          .select("category, correct")
          .eq("player_id", uid)
          .range(page * 1000, page * 1000 + 999);
        if (error) {
          if (/does not exist|PGRST/i.test(error.message)) {
            return { total: 0, correct: 0, by_category: {} };
          }
          throw new Error(error.message);
        }
        rows.push.apply(rows, data || []);
        if (!data || data.length < 1000) break;
      }
      const by_category = {};
      let total = 0;
      let correct = 0;
      rows.forEach(function (r) {
        const c = r.category || "Other";
        if (!by_category[c]) by_category[c] = { total: 0, correct: 0 };
        by_category[c].total += 1;
        total += 1;
        if (r.correct) {
          by_category[c].correct += 1;
          correct += 1;
        }
      });
      return { total: total, correct: correct, by_category: by_category };
    }

    // ---- match history: my finished matches, most recent first ---------------
    if (path === "/api/matches/history") {
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");
      const { data, error } = await sup.from("matches")
        .select("id,player1,player2,winner,score1,score2,created_at")
        .or("player1.eq." + uid + ",player2.eq." + uid)
        .eq("status", "finished")
        .not("player2", "is", null)   // skip declined / cancelled challenge rows
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);

      // fetch the opponent's username for every row in one batched call
      const oppIds = [];
      (data || []).forEach(function (m) {
        const oid = m.player1 === uid ? m.player2 : m.player1;
        if (oid && oppIds.indexOf(oid) === -1) oppIds.push(oid);
      });
      const profiles = {};
      if (oppIds.length) {
        const p = await sup.from("profiles").select("id,username").in("id", oppIds);
        if (!p.error && p.data) p.data.forEach(function (x) { profiles[x.id] = x; });
      }

      return (data || []).map(function (m) {
        const iAmP1 = m.player1 === uid;
        const opp = profiles[iAmP1 ? m.player2 : m.player1] || { username: "Player" };
        return {
          id: m.id,
          created_at: m.created_at,
          opp_name: opp.username,
          my_score: iAmP1 ? m.score1 : m.score2,
          opp_score: iAmP1 ? m.score2 : m.score1,
          i_won: m.winner === uid,
          tie: m.winner == null,
        };
      });
    }

    // ---- live answer relay: the opponent hears about it through Supabase
    // Realtime (API.stream). On the secure schema this goes through the
    // server-verified submit_answer RPC; older databases (no match_answers
    // table) still use the legacy direct score write, so the game keeps
    // working until the DB is upgraded (see database/README.md).
    if (path === "/api/trivia/answer") {
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");

      // secure path (schema.sql / setup-demo.sql): the server validates the
      // pick against the real question, records it, and recomputes the score
      // columns from match_answers — a forged client can't inflate anything.
      // The response carries the sync 1v1 state: 'done' says the round is
      // resolved (both players answered) and 'current_q' is the next question.
      if (body.question_id != null) {
        const r = await sup.rpc("submit_answer", {
          me: uid,
          match_id: body.match_id,
          question_id: body.question_id,
          choice: body.choice == null ? -1 : body.choice, // -1 = timed out
        });
        if (!r.error) return Object.assign({ ok: true, submit: true }, r.data || {});
        // only fall back when the RPC itself is missing (PostgREST: "Could
        // not find the function … in the schema cache") — never mask a real
        // error from a deployed-but-broken function
        if (!/could not find the function|does not exist/i.test(r.error.message)) {
          throw new Error(r.error.message);
        }
        // submit_answer isn't deployed yet — fall through to the legacy path
      }

      // legacy path (older databases): write the score column directly
      const { data: rows, error: er } = await sup.from("matches")
        .select("player1,score1,score2").eq("id", body.match_id).limit(1);
      if (er) throw new Error(er.message);
      if (!rows || !rows[0]) throw new Error("Not your match");
      const patch = rows[0].player1 === uid ? { score1: body.score } : { score2: body.score };
      const { error } = await sup.from("matches").update(patch).eq("id", body.match_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // ---- sync 1v1: the waiting player nudges the round every ~1.5s -----------
    // submit_answer only advances the round when BOTH players answered; the
    // one who answered first sits in a waiting state. This RPC pushes stalled
    // rounds forward (disconnect grace) and reports the current state so the
    // poll can react — a new current_q means "next question", a finished
    // status means the match is over.
    if (path === "/api/trivia/synctick") {
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");
      const { data, error } = await sup.rpc("sync_tick", {
        me: uid,
        match_id: body.matchId,
      });
      if (error) throw new Error(error.message);
      return data || {};
    }

    // ---- finish: the database decides the winner + moves trophies ------------
    if (path === "/api/trivia/finish") {
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");
      const { data: rows, error: er } = await sup.from("matches").select("player1").eq("id", body.match_id).limit(1);
      if (er) throw new Error(er.message);
      if (!rows || !rows[0]) throw new Error("Not your match");
      const myIsP1 = rows[0].player1 === uid;
      // ranked = true (normal matchmaking) moves trophies; friend duels pass
      // ranked = false so the winner is recorded but no trophies change.
      const ranked = body.ranked !== false;

      // v3 finish_match (the secure one) recomputes both scores from the
      // recorded answers — no s1/s2 needed. Older databases still have the
      // legacy (s1/s2) signature, so retry that way if v3 isn't deployed yet.
      let res = await sup.rpc("finish_match", {
        match_id: body.match_id,
        me: uid,
        ranked: ranked,
      });
      if (res.error && /could not find the function|does not exist/i.test(res.error.message)) {
        res = await sup.rpc("finish_match", {
          match_id: body.match_id,
          me: uid,
          s1: myIsP1 ? body.my_score : body.opp_score,
          s2: myIsP1 ? body.opp_score : body.my_score,
          ranked: ranked,
        });
      }
      if (res.error) throw new Error(res.error.message);
      const after = await sup.from("matches").select("winner").eq("id", body.match_id).limit(1);
      const winner = after.data && after.data[0] ? after.data[0].winner : null;
      return {
        winner: winner,
        delta: ranked ? (winner === uid ? 20 : winner ? -20 : 0) : 0,
        ranked: ranked,
      };
    }

    throw new Error("Unknown API path: " + path);
  },

  // live updates for a room ("queue-<matchId>" or "match-<matchId>").
  // Replaces the old SSE stream with a Supabase Realtime subscription on the
  // match row. Emits the SAME event shapes the game code already handles:
  //   queue listener -> { type: "match_active" }
  //   match listener -> { type: "answer", from: <opponent uid>, score: N }
  stream(room, onEvent) {
    const sup = this._ensureClient();
    const api = this;
    if (!room || room.length < 7) return null;
    const matchId = room.slice(6); // strip "queue-" / "match-"
    const isQueue = room.indexOf("queue-") === 0;
    let mySide = null; // cached { player1, player2 } so we know whose column is whose
    let myUid = null;  // cached session uid

    const channel = sup
      .channel("room-" + room)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: "id=eq." + matchId },
        async function (payload) {
          const row = payload.new || {};
          const old = payload.old || {};

          // queue listener: an opponent joined (match went active) — or a
          // friend declined the challenge (challenged -> finished)
          if (isQueue) {
            if (row.status === "active" && old.status !== "active") {
              onEvent({ type: "match_active", match_id: matchId });
            } else if (row.status === "finished" && old.status === "challenged") {
              onEvent({ type: "match_declined", match_id: matchId });
            }
            return;
          }

          // match listener: the match just ended (one player finished) —
          // end it for BOTH players at the same moment
          if (row.status === "finished" && old.status !== "finished") {
            onEvent({ type: "match_finished", match_id: matchId });
            return;
          }

          // sync 1v1: the round advanced (BOTH players answered, or the
          // server's disconnect grace timed one out) — both phones move to
          // the next question together. The row carries the fresh scores.
          if ((row.current_q || 0) !== (old.current_q || 0)) {
            onEvent({ type: "round", match_id: matchId, row: row });
          }

          // match listener: relay the OPPONENT's score column
          if (!mySide || myUid === null) {
            try {
              const r = await sup.from("matches").select("player1,player2").eq("id", matchId).limit(1);
              mySide = (r.data && r.data[0]) || {};
              myUid = await api._uid();
            } catch (e) { mySide = {}; }
          }
          const iAmP1 = mySide.player1 === myUid;
          const oppId = iAmP1 ? mySide.player2 : mySide.player1;
          const oppScore = iAmP1 ? (row.score2 || 0) : (row.score1 || 0);
          const prevOpp = iAmP1 ? old.score2 : old.score1;
          if (oppId && (prevOpp == null || prevOpp !== oppScore)) {
            onEvent({ type: "answer", from: oppId, score: oppScore });
          }
        })
      .subscribe();

    return { close: function () { sup.removeChannel(channel); } };
  },

  // mirrors of the session, kept so the rest of the app can read API.token.
  // supabase-js persists the real session itself (localStorage).
  saveSession(session, user) {
    this.token = session ? session.access_token : null;
    this.user = user || null;
    if (this.token) localStorage.setItem("df_token", this.token);
    else localStorage.removeItem("df_token");
    if (this.user) localStorage.setItem("df_user", JSON.stringify(this.user));
    else localStorage.removeItem("df_user");
  },

  clearSession() { this.saveSession(null, null); },
};
