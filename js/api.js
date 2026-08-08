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

const API = {
  _supabase: null,
  token: null, // the JWT of the current session (null = logged out)
  user: null,  // the supabase user object of the current session

  // build the supabase client + restore the saved session (if any)
  async init() {
    if (this._supabase) return false;
    if (!window.supabase) throw new Error("Service is temporarily unavailable — please try again.");
    this._supabase = window.supabase.createClient(
      window.TRIVIADUEL_CONFIG.SUPABASE_URL,
      window.TRIVIADUEL_CONFIG.SUPABASE_ANON_KEY
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
        .select("*").neq("id", BOT_ID).order("trophies", { ascending: false }).limit(50);
      if (error || !data || data.length === 0) {
        // pre-migration databases still use "elo" — fall back so the screen
        // keeps working until setup-demo.sql is run
        const fb = await sup.from("profiles")
          .select("*").neq("id", BOT_ID).order("elo", { ascending: false }).limit(50);
        if (!fb.error && fb.data && fb.data.length) { data = fb.data; error = null; }
      }
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (path.indexOf("/api/questions") === 0) {
      const { data, error } = await sup.from("questions").select("*").limit(200);
      if (error) throw new Error(error.message);
      return data || [];
    }

    // ---- matchmaking: the Postgres function pairs us ------------------------
    if (path === "/api/trivia/join") {
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");
      // arena signature discipline (mirrors the original backend logic): the RPC tilts
      // half the match's questions toward the arena the player is currently in
      let sig = "mixed";
      const prof = await sup.from("profiles").select("trophies").eq("id", uid).limit(1);
      if (!prof.error && prof.data && prof.data[0]) {
        const trophies = prof.data[0].trophies || 0;
        if (trophies >= 27) sig = "Math";
        else if (trophies >= 20) sig = "History";
        else if (trophies >= 13) sig = "Football";
        else if (trophies >= 6) sig = "Science";
      }
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
      return { match: match, opponent: opp, questions: qs };
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
        .neq("id", uid).neq("id", BOT_ID)
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
      const outgoing = (outRes.data || []).map(function (m) { return m.challengee; });

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
        outgoing: outgoing, // friend ids who have a pending challenge from us
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
      const { data, error } = await sup.rpc("create_challenge", { challengee: body.friendId });
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
      const { data, error } = await sup.from("matches")
        .update({ status: "active", player2: uid })
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

    // ---- live answer relay: write my score onto the match row. The opponent
    // hears about it through Supabase Realtime (API.stream), not SSE ----------
    if (path === "/api/trivia/answer") {
      const uid = await this._uid();
      if (!uid) throw new Error("Not logged in");
      const { data: rows, error: er } = await sup.from("matches")
        .select("player1,score1,score2").eq("id", body.match_id).limit(1);
      if (er) throw new Error(er.message);
      if (!rows || !rows[0]) throw new Error("Not your match");
      const patch = rows[0].player1 === uid ? { score1: body.score } : { score2: body.score };
      const { error } = await sup.from("matches").update(patch).eq("id", body.match_id);
      if (error) throw new Error(error.message);
      return { ok: true };
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
      const { error } = await sup.rpc("finish_match", {
        match_id: body.match_id,
        me: uid,
        s1: myIsP1 ? body.my_score : body.opp_score,
        s2: myIsP1 ? body.opp_score : body.my_score,
        ranked: ranked,
      });
      if (error) throw new Error(error.message);
      const after = await sup.from("matches").select("winner").eq("id", body.match_id).limit(1);
      const winner = after.data && after.data[0] ? after.data[0].winner : null;
      return {
        winner: winner,
        delta: ranked ? (winner === uid ? 1 : winner ? -1 : 0) : 0,
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
