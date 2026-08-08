// ============================================================================
//  config.js — paste your Supabase keys here.
//
//  TriviaDuel is a static site that talks to Supabase DIRECTLY from the
//  browser (auth, questions, matchmaking RPCs, live scores via Realtime).
//  There is no server of our own, so the only setup is these two keys.
//
//  HOW TO GET THEM:
//    1. supabase.com -> your project -> Project Settings -> API
//    2. copy the "Project URL" and the "publishable" (aka anon) key here
//
//  NOTE: the publishable key is PUBLIC by design — it ships to the browser
//  and the real security comes from the Row Level Security policies in
//  database/schema.sql. NEVER put the SECRET key (sb_secret_... / the old
//  service_role key) in this repo — it grants full database access and this
//  app has no server, so it doesn't need it.
//
//  If the keys are missing the app still opens (no setup screen anymore) —
//  online play just won't work until these two values are real.
// ============================================================================

// NOTE: must be set on `window` (not `const`) — api.js reads it via
// window.TRIVIADUEL_CONFIG, and top-level const/let don't attach to window.
window.TRIVIADUEL_CONFIG = {
  SUPABASE_URL: "https://ajtwoiohwjzobnpenghb.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_dAG_t11J8Q55iDaiThnxMw_2Z8pLEJP",
};
