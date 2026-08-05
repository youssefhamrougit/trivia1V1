// ============================================================================
//  api.js — talk to the C++ backend.
//
//  The backend is now a C++ server (backend/app.exe) that talks to Supabase
//  for storage. This tiny file is the only thing the browser needs to
//  connect: a fetch helper for JSON requests + an SSE helper for live events.
//
//  Replaces the old supabase.js (the backend is no longer JavaScript).
// ============================================================================

const API = {
  // the session token (JWT) the C++ server handed us after login
  token: localStorage.getItem("df_token") || null,
  user: (function () {
    try { return JSON.parse(localStorage.getItem("df_user")); } catch (e) { return null; }
  })(),

  saveSession(session, user) {
    this.token = session ? session.access_token : null;
    this.user = user || null;
    if (this.token) localStorage.setItem("df_token", this.token);
    else localStorage.removeItem("df_token");
    if (this.user) localStorage.setItem("df_user", JSON.stringify(this.user));
    else localStorage.removeItem("df_user");
  },

  clearSession() { this.saveSession(null, null); },

  // one JSON request to the C++ server
  async call(path, opts) {
    opts = opts || {};
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers.Authorization = "Bearer " + this.token;
    const res = await fetch(path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      throw new Error((data && (data.message || data.error)) || ("Request failed (" + res.status + ")"));
    }
    return data;
  },

  // a live event stream (Server-Sent Events). Returns an EventSource you
  // can close with .close(). The C++ server pushes JSON events to every
  // browser listening on the same "room".
  stream(room, onEvent) {
    if (!this.token) return null;
    const es = new EventSource(
      "/api/stream?room=" + encodeURIComponent(room) +
      "&token=" + encodeURIComponent(this.token)
    );
    es.onmessage = function (e) {
      try { onEvent(JSON.parse(e.data)); } catch (err) { /* ignore bad frames */ }
    };
    return es;
  },
};
