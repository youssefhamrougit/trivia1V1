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
      const { data, error } = await sup.auth.signUp({ email: body.email, password: body.password });
      if (error) throw new Error(error.message);
      return { session: data.session, user: data.user || null };
    }
    if (path === "/api/auth/login") {
      const { data, error } = await sup.auth.signInWithPassword({ email: body.email, password: body.password });
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
      // half the match's questions toward the arena the player has reached
      let sig = "mixed";
      const prof = await sup.from("profiles").select("peak_trophies").eq("id", uid).limit(1);
      if (!prof.error && prof.data && prof.data[0]) {
        const peak = prof.data[0].peak_trophies || 0;
        if (peak >= 27) sig = "Math";
        else if (peak >= 20) sig = "History";
        else if (peak >= 13) sig = "Football";
        else if (peak >= 6) sig = "Science";
      }
      const { data, error } = await sup.rpc("join_matchmaking", { me: uid, sig: sig });
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
      const { error } = await sup.rpc("finish_match", {
        match_id: body.match_id,
        me: uid,
        s1: myIsP1 ? body.my_score : body.opp_score,
        s2: myIsP1 ? body.opp_score : body.my_score,
      });
      if (error) throw new Error(error.message);
      const after = await sup.from("matches").select("winner").eq("id", body.match_id).limit(1);
      const winner = after.data && after.data[0] ? after.data[0].winner : null;
      return { winner: winner, delta: winner === uid ? 1 : winner ? -1 : 0, ranked: true };
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

          // queue listener: an opponent joined, the match went active
          if (isQueue) {
            if (row.status === "active" && old.status !== "active") {
              onEvent({ type: "match_active", match_id: matchId });
            }
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
