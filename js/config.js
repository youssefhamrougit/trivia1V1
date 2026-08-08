// ============================================================================
//  config.js — TriviaDuel Supabase configuration.
//
//  TriviaDuel talks to Supabase DIRECTLY from the browser (auth, questions,
//  matchmaking RPCs, live scores via Realtime). This file holds the project's
//  Supabase credentials — the publishable (anon) key is PUBLIC by design: it
//  ships to the browser, and the real security comes from the Row Level
//  Security policies in database/schema.sql.
// ============================================================================

// NOTE: must be set on `window` (not `const`) — api.js reads it via
// window.TRIVIADUEL_CONFIG, and top-level const/let don't attach to window.
window.TRIVIADUEL_CONFIG = {
  SUPABASE_URL: "https://ajtwoiohwjzobnpenghb.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_dAG_t11J8Q55iDaiThnxMw_2Z8pLEJP",
};
