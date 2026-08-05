// ============================================================================
//  config.js — paste your Supabase keys here.
//
//  TriviaDuel is a static site that talks to Supabase DIRECTLY from the
//  browser (auth, questions, matchmaking RPCs, live scores via Realtime).
//  There is no server of our own, so the only setup is these two keys.
//
//  HOW TO GET THEM:
//    1. supabase.com -> your project -> Project Settings -> API
//    2. copy the "Project URL" and the "anon public" key into this file
//
//  NOTE: the anon key is PUBLIC by design — the real security comes from the
//  Row Level Security policies in database/schema.sql.
//
//  The app shows the "Almost ready" screen until both values are real.
// ============================================================================

const TRIVIADUEL_CONFIG = {
  SUPABASE_URL: "https://ajtwoiohwjzobnpenghb.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqdHdvaW9od2p6b2JucGVuZ2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NjkxNDYsImV4cCI6MjEwMTQ0NTE0Nn0.AgD-eArh4CuNnTRE2l3inwxfV59OeyVlw72oapv-6AM",
};
