-- ============================================================================
--  setup-demo.sql — ONE-TIME FIX to make the demo work on an EXISTING project
--
--  WHY THIS FILE EXISTS:
--    schema.sql / seed.sql are written for a FRESH project. If
--    your project already has tables (e.g. created via the dashboard Table
--    Editor), running them as-is fails with "relation already exists".
--
--    This file is IDEMPOTENT: every statement is safe to run again. It:
--      • creates tables only if they don't exist
--      • re-creates all functions (create or replace)
--      • re-creates the sign-up trigger (drop first)
--      • re-creates RLS policies (drop first)
--      • fills any missing question category (idempotent — safe to re-run)
--      • adds realtime tables only if not already published
--      • upgrades the game to the SECURE server-verified answer pipeline
--        (match_answers / submit_answer / match_score + the score revoke)
--
--  HOW TO USE:
--    1. supabase.com -> your project -> SQL Editor
--    2. paste this whole file -> RUN
--    3. refresh the app. Done!
-- ============================================================================


-- ============================================================================
--  TABLE: profiles (one row = one user)
-- ============================================================================
create table if not exists public.profiles (
  id             uuid primary key,
  username       text unique,
  trophies       integer not null default 0,  -- +20 win, -20 loss (1:1)
  wins           integer not null default 0,
  losses         integer not null default 0,
  created_at     timestamptz default now()
);

-- migration: projects created before the trophy system have an "elo" column
-- rename it to trophies and start everyone at 0 (fresh arena climb).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'elo'
  ) then
    alter table public.profiles rename column elo to trophies;
    alter table public.profiles alter column trophies set default 0;
    update public.profiles set trophies = 0 where trophies is null;
  end if;
end;
$$;

-- migration: the peak-trophy system is gone — only current trophies matter.
-- Drop the old column if it exists (existing projects ran schema.sql before).
alter table public.profiles drop column if exists peak_trophies;

-- ⚠️ ONE-TIME MIGRATION — the economy moved from ±1 to ±20 per match and the
-- arena thresholds scaled ×20. If your players already have trophies on the
-- OLD ±1 scale, uncomment the line below and run it ONCE to scale everyone
-- so their arena position is preserved. It is idempotent in spirit: new-scale
-- balances are always multiples of 20, so re-running it touches nothing.
--   update public.profiles set trophies = trophies * 20 where trophies <> 0 and trophies % 20 <> 0;
-- (If you'd rather start fresh, leave it commented — everyone just re-climbs.)

-- ============================================================================
--  TABLE: questions (the trivia question bank)
-- ============================================================================
create table if not exists public.questions (
  id            bigint generated always as identity primary key,
  category      text not null,
  question      text not null,
  options       text[] not null,
  correct_index integer not null check (correct_index between 0 and 3)
);

-- ============================================================================
--  TABLE: matches (one row = one trivia battle)
-- ============================================================================
create table if not exists public.matches (
  id           uuid primary key default gen_random_uuid(),
  player1      uuid references public.profiles(id),
  player2      uuid references public.profiles(id),
  winner       uuid references public.profiles(id),
  status       text not null default 'waiting'
               check (status in ('waiting','active','finished')),
  question_ids bigint[] not null,
  score1       integer not null default 0,
  score2       integer not null default 0,
  -- sync 1v1: the question currently in play (0-based into question_ids).
  -- The round only advances when BOTH players have answered it (or the
  -- disconnect grace in sync_advance times the missing one out).
  current_q        integer not null default 0,
  -- when the current round started — anchors the disconnect grace window
  round_started_at timestamptz not null default now(),
  created_at   timestamptz default now()
);

-- migration for EXISTING projects: add the sync 1v1 columns if missing
-- (idempotent — safe to re-run)
alter table public.matches add column if not exists current_q integer not null default 0;
alter table public.matches add column if not exists round_started_at timestamptz not null default now();


-- ============================================================================
--  ROW LEVEL SECURITY (re-created safely)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.matches enable row level security;

drop policy if exists "read profiles" on public.profiles;
create policy "read profiles"
  on public.profiles for select
  using (auth.uid() is not null);

drop policy if exists "edit own profile" on public.profiles;
create policy "edit own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "read questions" on public.questions;
create policy "read questions"
  on public.questions for select
  using (auth.uid() is not null);

drop policy if exists "read own matches" on public.matches;
-- the friend-challenge column comes from friends-bots.sql; if it exists (this
-- file was run AFTER that one), keep the policies challenge-aware so running
-- setup-demo again can never break friend challenges.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'matches' and column_name = 'challengee'
  ) then
    execute $pol$
      create policy "read own matches" on public.matches for select
      using (auth.uid() in (player1, player2) or challengee = auth.uid())
    $pol$;
  else
    execute $pol$
      create policy "read own matches" on public.matches for select
      using (auth.uid() in (player1, player2))
    $pol$;
  end if;
end;
$$;

drop policy if exists "create match" on public.matches;
create policy "create match"
  on public.matches for insert
  with check (player1 = auth.uid());

drop policy if exists "update matches" on public.matches;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'matches' and column_name = 'challengee'
  ) then
    execute $pol$
      create policy "update matches" on public.matches for update
      using (
        (auth.uid() in (player1, player2))
        or (status = 'waiting' and player2 is null)
        or (status = 'challenged' and challengee = auth.uid() and player2 is null)
      )
    $pol$;
  else
    execute $pol$
      create policy "update matches" on public.matches for update
      using (
        (auth.uid() in (player1, player2))
        or (status = 'waiting' and player2 is null)
      )
    $pol$;
  end if;
end;
$$;


-- ============================================================================
--  SIGN-UP TRIGGER: auto-create a profile row for every new user
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, 'player_' || left(new.id::text, 6));
  return new;
end;
$$;

drop trigger if exists on_user_created on auth.users;
create trigger on_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================================
--  FUNCTION: join_matchmaking
-- ============================================================================
create or replace function public.join_matchmaking(me uuid, sig text default 'mixed')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_id uuid;
  picked   bigint[];
  mine     integer;
  rest     text[];  -- the 4 categories shuffled, for the variety mix
begin
  -- never trust the client: derive the identity from the JWT instead
  me := auth.uid();
  if me is null then return null; end if;

  -- my current trophies — the centre of the skill-based pairing band
  select trophies into mine from public.profiles where id = me;
  mine := coalesce(mine, 0);

  -- strict skill-based pairing: only join a waiting match whose creator is
  -- within 60 trophies of us (3 games at the 20-per-game scale). If nobody
  -- in the band shows up, the client waits out its 7-second window and then
  -- plays QuizBot — we never pair a big skill mismatch.
  select m.id into found_id
  from public.matches m
  join public.profiles p on p.id = m.player1
  where m.status = 'waiting' and m.player1 <> me
    and m.created_at > now() - interval '5 minutes'  -- skip abandoned queues
    and abs(p.trophies - mine) <= 60
  order by m.created_at
  limit 1
  for update of m skip locked;

  if found_id is not null then
    update public.matches
    set player2 = me, status = 'active', round_started_at = now()
    where id = found_id;
    return found_id;
  end if;

  -- EVERY match now mixes all 4 categories, so no game is a wall of one
  -- topic (with the big bank in questions-bank.sql each category has plenty
  -- of questions to draw from):
  --   • themed arenas keep a 4-question tilt from their own category, plus
  --     2 questions from each of the other three (4/2/2/2)
  --   • mixed matches draw a 3/3/2/2 split across the 4 categories
  -- The final 10 are shuffled so the categories interleave all match long.
  if sig is null or sig not in ('Science','Math','Football','History') then
    sig := 'mixed';
  end if;

  -- shuffle the category list (for 'mixed' this is all 4 categories)
  select array(
    select cat
    from unnest(ARRAY['Science','Math','Football','History']) as cat
    where cat <> sig
    order by random()
  ) into rest;

  if sig = 'mixed' then
    select array(
      select id from (
        (select id from public.questions where category = rest[1] order by random() limit 3)
        union all
        (select id from public.questions where category = rest[2] order by random() limit 3)
        union all
        (select id from public.questions where category = rest[3] order by random() limit 2)
        union all
        (select id from public.questions where category = rest[4] order by random() limit 2)
      ) t order by random()
    ) into picked;
  else
    select array(
      select id from (
        (select id from public.questions where category = sig order by random() limit 4)
        union all
        (select id from public.questions where category = rest[1] order by random() limit 2)
        union all
        (select id from public.questions where category = rest[2] order by random() limit 2)
        union all
        (select id from public.questions where category = rest[3] order by random() limit 2)
      ) t order by random()
    ) into picked;
  end if;

  insert into public.matches (player1, status, question_ids)
  values (me, 'waiting', picked)
  returning id into found_id;

  return found_id;
end;
$$;


-- ============================================================================
--  FUNCTION: cancel_matchmaking
--  Called when a player leaves the queue (pressing Cancel, or after the
--  7-second human-search window when they fall back to QuizBot).
--
--  Atomically removes the player's waiting match. One race matters: a
--  human may join in the exact millisecond we give up. So we lock the
--  waiting row first — if a joiner got there before us (status flipped
--  to 'active'), we hand that match back and the client plays the human
--  instead of QuizBot. Returns the match id, or null if cancelled.
-- ============================================================================
create or replace function public.cancel_matchmaking(me uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_id uuid;
begin
  -- never trust the client: derive the identity from the JWT instead
  me := auth.uid();
  if me is null then return null; end if;

  -- lock our waiting match (if any) so the decision below is race-free
  select id into found_id
  from public.matches
  where player1 = me and status = 'waiting' and player2 is null
  order by created_at
  limit 1
  for update;

  if found_id is not null then
    -- no human joined: remove the empty seat
    delete from public.matches where id = found_id;
    return null;
  end if;

  -- our waiting match is gone — a human just joined it. Tell the client
  -- to play that human instead of QuizBot.
  select id into found_id
  from public.matches
  where player1 = me and status = 'active' and player2 is not null
  limit 1;

  return found_id;
end;
$$;


-- ============================================================================
--  SECURITY UPGRADE: match_answers + submit_answer (server-verified pipeline)
--
--  Brings an EXISTING project up to the same secure state as schema.sql:
--  every answer is recorded server-side and validated against the real
--  question, scores are recomputed by the database, and the client can no
--  longer write the score columns directly. This is what closes the
--  score-forgery hole. Deploy the matching client (js/api.js) at the same
--  time — see database/README.md.
-- ============================================================================
create table if not exists public.match_answers (
  id          bigint generated always as identity primary key,
  match_id    uuid not null references public.matches(id) on delete cascade,
  player_id   uuid not null references public.profiles(id),
  question_id bigint not null references public.questions(id),
  choice      integer,               -- the option picked (0-3) · -1 = timed out
  correct     boolean not null,
  created_at  timestamptz default now(),
  unique (match_id, player_id, question_id)  -- one answer per player per question
);

alter table public.match_answers enable row level security;

drop policy if exists "read own answers" on public.match_answers;
create policy "read own answers"
  on public.match_answers for select
  using (player_id = auth.uid());

-- no insert/update/delete policies: answers can ONLY be written by the
-- submit_answer RPC (security definer), which validates each one first

-- stop clients from painting their own score columns on the live scoreboard —
-- only the server-side RPCs may write them now
revoke update (score1, score2) on public.matches from anon, authenticated;

create index if not exists idx_match_answers_lookup on public.match_answers(match_id, player_id, question_id);


-- ============================================================================
--  FUNCTION: match_score
--  Recomputes ONE player's score from their recorded answers — the only place
--  scores come from. Same definition as schema.sql (create or replace = safe
--  to re-run).
-- ============================================================================
create or replace function public.match_score(p_match uuid, p_player uuid)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  qids   bigint[];
  qid    bigint;
  streak integer := 0;
  total  integer := 0;
  c      boolean;
begin
  -- only people in the match may read its scoring (scores are visible via
  -- Realtime anyway; this keeps randoms from probing arbitrary matches)
  if auth.uid() is null
     or not exists (
       select 1 from public.matches
       where id = p_match and auth.uid() in (player1, player2)
     ) then
    return 0;
  end if;

  select question_ids into qids from public.matches where id = p_match;
  if qids is null then return 0; end if;

  foreach qid in array qids loop
    select correct into c
    from public.match_answers
    where match_id = p_match and player_id = p_player and question_id = qid;
    if c is true then
      streak := streak + 1;
      total := total + case when streak >= 3 then 150 else 100 end;
    else
      streak := 0;   -- wrong, timed out, or unanswered resets the streak
    end if;
  end loop;

  return total;
end;
$$;


-- ============================================================================
--  FUNCTION: submit_answer
--  The ONLY way an answer enters the game. Same definition as schema.sql.
--  The client sends just the option it picked (0-3, or -1 if the clock ran
--  out); the server checks it against the question's correct_index, records
--  it, and recomputes the score.
-- ============================================================================
create or replace function public.submit_answer(
  me uuid,
  match_id uuid,
  question_id bigint,
  choice integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m           public.matches%rowtype;
  q           public.questions%rowtype;
  opp         uuid;
  opp_bot     boolean;
  my_correct  boolean;
  bot_correct boolean;
  bot_chance  numeric;
  p_trophies  integer := 0;
  cur_q       integer := 0;
  both_done   boolean := false;
begin
  -- never trust the client: derive the identity from the JWT instead
  me := auth.uid();
  if me is null then return null; end if;

  -- lock the match row so two players answering the same question at the
  -- same instant serialize: exactly ONE submission sees "both answered"
  -- and advances the round (the other one simply waits for the advance).
  select * into m from public.matches where id = match_id for update;
  if not found then return null; end if;
  if m.status <> 'active' then return null; end if;  -- the match already ended
  if me not in (m.player1, m.player2) then return null; end if;

  select * into q from public.questions where id = question_id;
  if not found or not (question_id = any(m.question_ids)) then return null; end if;

  -- record the answer (idempotent: a retry returns the SAME result)
  insert into public.match_answers (match_id, player_id, question_id, choice, correct)
  values (
    match_id, me, question_id, choice,
    coalesce((choice between 0 and 3) and (choice = q.correct_index), false)
  )
  on conflict (match_id, player_id, question_id) do nothing;

  -- read back the recorded answer (the FIRST one wins on retries)
  select correct into my_correct
  from public.match_answers
  where match_id = match_id and player_id = me and question_id = question_id;
  my_correct := coalesce(my_correct, false);

  -- is the opponent a disguised bot? then the SERVER rolls its answer for
  -- this question too (skill follows OUR trophies, same curve the client
  -- uses to pick the bot), so even the bot's score is server-computed
  opp := case when m.player1 = me then m.player2 else m.player1 end;
  select is_bot into opp_bot from public.profiles where id = opp;

  if coalesce(opp_bot, false) and not exists (
    select 1 from public.match_answers
    where match_id = match_id and player_id = opp and question_id = question_id
  ) then
    select trophies into p_trophies from public.profiles where id = me;
    bot_chance := 0.28 + least(1.0, greatest(0.0, coalesce(p_trophies, 0)::numeric / 900)) * 0.50;
    bot_correct := random() < bot_chance;
    insert into public.match_answers (match_id, player_id, question_id, choice, correct)
    values (
      match_id, opp, question_id,
      case when bot_correct then q.correct_index else -1 end,
      bot_correct
    )
    on conflict (match_id, player_id, question_id) do nothing;
  end if;

  -- refresh the live score columns from the answers (authoritative)
  if me = m.player1 then
    update public.matches set score1 = public.match_score(match_id, m.player1)
    where id = match_id;
    if coalesce(opp_bot, false) then
      update public.matches set score2 = public.match_score(match_id, m.player2)
      where id = match_id;
    end if;
  else
    update public.matches set score2 = public.match_score(match_id, me)
    where id = match_id;
    if coalesce(opp_bot, false) then
      update public.matches set score1 = public.match_score(match_id, m.player1)
      where id = match_id;
    end if;
  end if;

  -- SYNC 1V1: if both players have now answered the current question (or the
  -- disconnect grace timed the missing one out), move the round forward.
  -- Realtime pushes the current_q change to BOTH phones, so they advance to
  -- the next question together. Returns 'done' so the answering client knows
  -- whether it must wait for the opponent or can advance right away.
  perform public.sync_advance(match_id);

  select current_q into cur_q from public.matches where id = match_id;

  select exists (
    select 1 from public.match_answers a
    where a.match_id = match_id and a.question_id = question_id
    group by a.question_id
    having count(*) >= 2   -- both players answered this question
  ) into both_done;

  return jsonb_build_object(
    'correct',       my_correct,
    'correct_index', q.correct_index,
    'score',         public.match_score(match_id, me),
    'opp_score',     case when me = m.player1
                       then public.match_score(match_id, m.player2)
                       else public.match_score(match_id, m.player1) end,
    'current_q',     cur_q,
    'done',          both_done
  );
end;
$$;


-- ============================================================================
--  FUNCTION: sync_advance
--  The shared SYNC 1V1 round-advance step. Called by submit_answer (right
--  after an answer is recorded) and by sync_tick (the waiting player's
--  poll). Does two things, in order:
--
--    1. DISCONNECT GRACE: once ONE player has answered the current question,
--       the other gets a 20-second window to answer too. If it expires with
--       them still missing, their answer is auto-recorded as a timeout (-1),
--       so a round can never hang on a dead/closed opponent tab.
--    2. ADVANCE: when BOTH players have answered the current question (or
--       been timed out), move to the next question together, reset the round
--       clock, and recompute both scores from the recorded answers. The
--       matches row UPDATE is what Realtime pushes to both phones, so they
--       advance to the next question in sync.
-- ============================================================================
create or replace function public.sync_advance(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m               public.matches%rowtype;
  qid             bigint;
  first_answer_at timestamptz;
begin
  select * into m from public.matches where id = p_match;
  if not found then return; end if;
  if m.status <> 'active' then return; end if;
  if m.current_q >= coalesce(cardinality(m.question_ids), 0) then return; end if;

  -- the question in play (current_q is 0-based; the array is 1-based)
  qid := m.question_ids[m.current_q + 1];

  -- how long ago the first answer in this round landed
  select max(created_at) into first_answer_at
  from public.match_answers
  where match_id = p_match and question_id = qid;

  -- grace: a missing player is timed out 20s after the first answer, so a
  -- disconnected opponent can never stall the round forever
  if first_answer_at is not null and now() - first_answer_at > interval '20 seconds' then
    if not exists (
      select 1 from public.match_answers
      where match_id = p_match and player_id = m.player1 and question_id = qid
    ) then
      insert into public.match_answers (match_id, player_id, question_id, choice, correct)
      values (p_match, m.player1, qid, -1, false)
      on conflict (match_id, player_id, question_id) do nothing;
    end if;
    if m.player2 is not null and not exists (
      select 1 from public.match_answers
      where match_id = p_match and player_id = m.player2 and question_id = qid
    ) then
      insert into public.match_answers (match_id, player_id, question_id, choice, correct)
      values (p_match, m.player2, qid, -1, false)
      on conflict (match_id, player_id, question_id) do nothing;
    end if;
  end if;

  -- both players answered (or were timed out) -> next question, in sync
  if (select count(*) from public.match_answers
      where match_id = p_match and question_id = qid) >= 2 then
    update public.matches
    set current_q = m.current_q + 1,
        round_started_at = now(),
        score1 = public.match_score(p_match, m.player1),
        score2 = public.match_score(p_match, m.player2)
    where id = p_match;
  end if;
end;
$$;


-- ============================================================================
--  FUNCTION: sync_tick
--  Called every ~1.5s by the player who is WAITING on the opponent (they
--  already answered the current question). Nudges the round forward if the
--  disconnect grace has elapsed (sync_advance), then returns the current
--  state so the client can react — a new current_q means "move to the next
--  question", a finished status means the match is over. This is the safety
--  net under the Realtime "round" event.
-- ============================================================================
create or replace function public.sync_tick(me uuid, match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
begin
  -- never trust the client: derive the identity from the JWT instead
  me := auth.uid();
  if me is null then return null; end if;

  select * into m from public.matches where id = match_id for update;
  if not found then return null; end if;
  if me not in (m.player1, m.player2) then return null; end if;

  if m.status = 'active'
     and m.current_q < coalesce(cardinality(m.question_ids), 0) then
    perform public.sync_advance(match_id);
  end if;

  select * into m from public.matches where id = match_id;

  return jsonb_build_object(
    'current_q', m.current_q,
    'score1',    m.score1,
    'score2',    m.score2,
    'status',    m.status,
    'winner',    m.winner
  );
end;
$$;


-- ============================================================================
--  FUNCTION: finish_match — the SECURE v3 (identical to schema.sql and
--  friends-bots.sql). Winner is decided PURELY from the recorded answers
--  (match_score) — the client no longer submits any scores.
-- ============================================================================
create or replace function public.finish_match(
  match_id uuid,
  me       uuid,
  ranked   boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m         public.matches%rowtype;
  winner_id uuid;
  s1        integer;
  s2        integer;
begin
  -- never trust the client: derive the identity from the JWT instead
  me := auth.uid();
  if me is null then return; end if;

  -- lock the row so two players finishing at the same instant can't double-move
  select * into m from public.matches where id = match_id for update;
  if not found then return; end if;
  if me not in (m.player1, m.player2) then return; end if;

  -- the ONLY source of truth: recompute both scores from the recorded answers
  s1 := public.match_score(match_id, m.player1);
  s2 := public.match_score(match_id, m.player2);
  update public.matches set score1 = s1, score2 = s2 where id = match_id;

  if m.status = 'finished' then return; end if;  -- idempotent: no double move

  if s1 > s2 then
    winner_id := m.player1;
  elsif s2 > s1 then
    winner_id := m.player2;
  else
    winner_id := null;
  end if;

  update public.matches
  set status = 'finished', winner = winner_id
  where id = match_id;

  if winner_id is not null and ranked then
    -- 1:1 trophies: winner +20, loser -20. Your arena follows your CURRENT
    -- trophies, so dropping below a threshold takes you back down.
    update public.profiles
    set trophies = trophies + 20,
        wins = wins + 1
    where id = winner_id;
    if winner_id = m.player1 then
      update public.profiles set trophies = trophies - 20, losses = losses + 1 where id = m.player2;
    else
      update public.profiles set trophies = trophies - 20, losses = losses + 1 where id = m.player1;
    end if;
  end if;
end;
$$;


-- ============================================================================
--  SEED: the QuizBot profile (idempotent)
-- ============================================================================
insert into public.profiles (id, username)
values ('00000000-0000-0000-0000-000000000001', 'QuizBot')
on conflict (id) do nothing;

-- ============================================================================
--  SEED: keep only Science / Math / Football / History, then fill any
--  category that's missing questions (idempotent — safe to re-run).
-- ============================================================================
delete from public.questions
where category not in ('Science','Math','Football','History');

do $$
begin
  -- Math (10) — only if the bank has none yet
  if not exists (select 1 from public.questions where category = 'Math') then
    insert into public.questions (category, question, options, correct_index) values
      ('Math', 'What is 7 × 8?', ARRAY['54', '56', '64', '48'], 1),
      ('Math', 'What is the square root of 144?', ARRAY['11', '12', '14', '16'], 1),
      ('Math', 'What is 15% of 200?', ARRAY['15', '25', '30', '35'], 2),
      ('Math', 'What is the value of pi rounded to 2 decimal places?', ARRAY['3.14', '3.15', '3.13', '3.41'], 0),
      ('Math', 'What is 2 to the power of 10?', ARRAY['512', '1024', '2048', '1000'], 1),
      ('Math', 'If a triangle has angles 90°, 45° and 45°, what type is it?', ARRAY['Equilateral', 'Isosceles', 'Scalene', 'Obtuse'], 1),
      ('Math', 'What is the next prime number after 7?', ARRAY['9', '10', '11', '13'], 2),
      ('Math', 'What is 100 ÷ 4?', ARRAY['20', '25', '30', '40'], 1),
      ('Math', 'What is the sum of the angles in a triangle?', ARRAY['90 degrees', '180 degrees', '270 degrees', '360 degrees'], 1),
      ('Math', 'What is 9 × 9?', ARRAY['72', '81', '89', '99'], 1);
  end if;

  -- Football (10) — only if the bank has none yet
  if not exists (select 1 from public.questions where category = 'Football') then
    insert into public.questions (category, question, options, correct_index) values
      ('Football', 'How many players are on a football team on the pitch?', ARRAY['10', '11', '12', '9'], 1),
      ('Football', 'How long is a standard football match?', ARRAY['80 minutes', '90 minutes', '100 minutes', '120 minutes'], 1),
      ('Football', 'Which country has won the most FIFA World Cups?', ARRAY['Germany', 'Argentina', 'Brazil', 'Italy'], 2),
      ('Football', 'What color is a standard red card used for?', ARRAY['Red', 'Yellow', 'Orange', 'Blue'], 0),
      ('Football', 'What is the name of the trophy awarded to the World Cup winner?', ARRAY['Golden Ball', 'FIFA Trophy', 'World Cup Trophy', 'Champions Cup'], 2),
      ('Football', 'How many points does a team get for a win in the league?', ARRAY['1', '2', '3', '4'], 2),
      ('Football', 'What position does a goalkeeper primarily play in?', ARRAY['Midfield', 'Attack', 'Defence', 'Goal'], 3),
      ('Football', 'Which club is known as "The Red Devils"?', ARRAY['Liverpool', 'Manchester United', 'Arsenal', 'Chelsea'], 1),
      ('Football', 'How many substitutes can a team typically make in a match?', ARRAY['3', '5', '7', '2'], 1),
      ('Football', 'What is it called when a player scores three goals in one match?', ARRAY['Double', 'Brace', 'Hat-trick', 'Treble'], 2);
  end if;

  -- top up Science to 10 if there are fewer
  if (select count(*) from public.questions where category = 'Science') < 10 then
    insert into public.questions (category, question, options, correct_index) values
      ('Science', 'What is the powerhouse of the cell?', ARRAY['Nucleus', 'Ribosome', 'Mitochondria', 'Cell wall'], 2),
      ('Science', 'What is the speed of light in a vacuum, roughly?', ARRAY['300,000 km/s', '150,000 km/s', '1,000,000 km/s', '30,000 km/s'], 0),
      ('Science', 'Which planet is the largest in our solar system?', ARRAY['Earth', 'Saturn', 'Neptune', 'Jupiter'], 3),
      ('Science', 'What element has the atomic number 6?', ARRAY['Oxygen', 'Carbon', 'Nitrogen', 'Helium'], 1),
      ('Science', 'What is H2O commonly known as?', ARRAY['Salt', 'Peroxide', 'Water', 'Ammonia'], 2);
  end if;

  -- top up History to 10 if there are fewer
  if (select count(*) from public.questions where category = 'History') < 10 then
    insert into public.questions (category, question, options, correct_index) values
      ('History', 'In which year did the Berlin Wall fall?', ARRAY['1985', '1989', '1991', '1993'], 1),
      ('History', 'Who was the ancient Greek god of the sea?', ARRAY['Zeus', 'Apollo', 'Poseidon', 'Ares'], 2),
      ('History', 'What ship did Charles Darwin sail on?', ARRAY['Beagle', 'Endeavour', 'Victory', 'Mayflower'], 0),
      ('History', 'Which ancient wonder stood in Alexandria?', ARRAY['Colossus', 'Lighthouse', 'Hanging Gardens', 'Pyramid'], 1),
      ('History', 'Who painted the Mona Lisa?', ARRAY['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Donatello'], 2);
  end if;
end;
$$;


-- ============================================================================
--  INDEXES (idempotent)
-- ============================================================================
create index if not exists idx_matches_status on public.matches(status);
create index if not exists idx_questions_category on public.questions(category);


-- ============================================================================
--  REALTIME (only add tables that aren't published yet)
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end;
$$;

-- ============================================================================
--  DONE!  You can now refresh the app.  Re-running this file is safe.
-- ============================================================================
