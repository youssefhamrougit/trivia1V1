-- ============================================================================
--  match-stats.sql — the Stats screen (per-category accuracy + match history)
--
--  Run this AFTER friends-bots.sql (it's additive: it only creates a new
--  table, nothing else changes). Supabase -> SQL Editor -> paste -> RUN.
--
--  WHAT THIS ENABLES:
--    • Match history works with NO database change — it reads the existing
--      matches table. Only the per-category accuracy page needs this file.
--    • answer_log stores one row per question a player answers, in EVERY mode
--      (online matches, friend duels, and practice). The Stats screen then
--      aggregates those rows into overall + per-category accuracy.
--
--  SECURITY: RLS is on — a player can only read and insert their OWN rows.
--  The `correct` flag comes from the client. Online answers are ALSO recorded
--  server-side in match_answers via the submit_answer RPC (schema.sql /
--  setup-demo.sql); this log additionally covers practice games and feeds the
--  Stats UI directly, so client-reported correctness is fine here — it's a
--  personal stats page, not a leaderboard input.
-- ============================================================================

create table if not exists public.answer_log (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.profiles(id),
  match_id    uuid references public.matches(id) on delete set null, -- null in practice
  question_id bigint not null,
  category    text not null,
  correct     boolean not null,
  mode        text not null default 'online' check (mode in ('online', 'bot')),
  created_at  timestamptz default now()
);

alter table public.answer_log enable row level security;

-- a player may only ever read their own answers (never anyone else's)
create policy "read own answer log"
  on public.answer_log for select
  using (player_id = auth.uid());

-- a player may only ever write their own answers
create policy "insert own answer log"
  on public.answer_log for insert
  with check (player_id = auth.uid());

-- one answer per player per question (NULL match_id = practice, and Postgres
-- allows multiple NULLs in a unique constraint, so practice rows don't collide).
-- The client insert uses ON CONFLICT DO NOTHING, so a stale timer or retry can
-- never double-count an answer in the accuracy stats.
create unique index if not exists uq_answer_log_question
  on public.answer_log(player_id, match_id, question_id);

-- fast lookup for the stats aggregation (one player, newest first)
create index if not exists idx_answer_log_player
  on public.answer_log(player_id, created_at desc);
