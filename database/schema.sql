-- ============================================================================
--  schema.sql — Trivia1v1 database
--  Tables: profiles, questions, matches
--
--  HOW TO USE:
--    1. Go to supabase.com -> your project -> "SQL Editor"
--    2. Paste this whole file and click RUN
--    3. Then open seed.sql and run that too
-- ============================================================================


-- ============================================================================
--  TABLE 1: profiles (one row = one user)
-- ============================================================================
create table public.profiles (
  id             uuid primary key,
  username       text unique,
  trophies       integer not null default 0,  -- +20 win, -20 loss (1:1)
  wins           integer not null default 0,
  losses         integer not null default 0,
  is_bot         boolean not null default false,  -- disguised bot opponents (stealth-bots.sql)
  created_at     timestamptz default now()
);

-- when a new user signs up, automatically create their profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, 'player_' || left(new.id::text, 6));
  return new;
end;
$$;

create trigger on_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================================
--  SECURITY RULES for profiles
-- ============================================================================
alter table public.profiles enable row level security;

create policy "read profiles"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "edit own profile"
  on public.profiles for update
  using (auth.uid() = id);


-- ============================================================================
--  TABLE 2: questions (the trivia question bank)
-- ============================================================================
create table public.questions (
  id            bigint generated always as identity primary key,
  category      text not null,
  question      text not null,
  options       text[] not null,
  correct_index integer not null check (correct_index between 0 and 3)
);

alter table public.questions enable row level security;

create policy "read questions"
  on public.questions for select
  using (auth.uid() is not null);


-- ============================================================================
--  TABLE 3: matches (one row = one trivia battle)
-- ============================================================================
create table public.matches (
  id           uuid primary key default gen_random_uuid(),
  player1      uuid references public.profiles(id),
  player2      uuid references public.profiles(id),
  winner       uuid references public.profiles(id),
  status       text not null default 'waiting'
               check (status in ('waiting','active','finished')),
  question_ids bigint[] not null,
  score1       integer not null default 0,
  score2       integer not null default 0,
  created_at   timestamptz default now()
);

alter table public.matches enable row level security;

create policy "read own matches"
  on public.matches for select
  using (auth.uid() in (player1, player2));

create policy "create match"
  on public.matches for insert
  with check (player1 = auth.uid());

create policy "update matches"
  on public.matches for update
  using (auth.uid() in (player1, player2));


-- ============================================================================
--  TABLE 4: match_answers — every answer, recorded server-side
--
--  This is the SOURCE OF TRUTH for scoring. The client never sends a score —
--  it only sends which option it picked (submit_answer). The server validates
--  the pick against the question's correct_index and records it here, then
--  scores are recomputed from these rows (match_score). A forged client can't
--  inflate anything: every row is checked against the real answer.
-- ============================================================================
create table public.match_answers (
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

-- players may only ever see their OWN answers — never the opponent's (and
-- never the bot's), so nobody can read out the correctness of others early
create policy "read own answers"
  on public.match_answers for select
  using (player_id = auth.uid());

-- no insert/update/delete policies: answers can ONLY be written by the
-- submit_answer RPC (security definer), which validates each one first

-- stop clients from painting their own score columns on the live scoreboard —
-- only the server-side RPCs may write them now
revoke update (score1, score2) on public.matches from anon, authenticated;

create index idx_match_answers_lookup on public.match_answers(match_id, player_id, question_id);


-- ============================================================================
--  FUNCTION: join_matchmaking
--  Called when a player taps "Find Match".
--  Step 1: look for a waiting match created by someone else -> join it, but
--          only if they are within 60 trophies of us (skill-based pairing)
--  Step 2: if none exists, create a new waiting match (with 10 random questions)
-- ============================================================================
create or replace function public.join_matchmaking(me uuid, sig text default 'mixed')
returns uuid
language plpgsql
security definer
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
    set player2 = me, status = 'active'
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
--  FUNCTION: match_score
--  Recomputes ONE player's score from their recorded answers — the only place
--  scores come from. Walks the match's questions in order, applying the same
--  rules the client shows: 100 points per correct answer, 150 when you're on
--  a 3+ streak, and a miss (wrong / timed out / unanswered) resets the streak.
--  Both submit_answer and finish_match use this, so the DATABASE — never the
--  client — decides the winner.
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
--  The ONLY way an answer enters the game. The client sends just the option
--  it picked (0-3, or -1 if the clock ran out); the server checks it against
--  the question's correct_index, records it, and recomputes the score.
--
--  Returns: { correct, correct_index, score, opp_score }
--    correct       — was the pick right? (drives the reveal + sound)
--    correct_index — revealed ONLY after the answer is locked in
--    score         — the player's authoritative running score
--    opp_score     — the opponent's authoritative running score (for a
--                    disguised bot, this includes the bot's server-rolled
--                    answer for this same question)
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
begin
  -- never trust the client: derive the identity from the JWT instead
  me := auth.uid();
  if me is null then return null; end if;

  select * into m from public.matches where id = match_id;
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

  return jsonb_build_object(
    'correct',    my_correct,
    'correct_index', q.correct_index,
    'score',      public.match_score(match_id, me),
    'opp_score',  case when me = m.player1
                     then public.match_score(match_id, m.player2)
                     else public.match_score(match_id, m.player1) end
  );
end;
$$;


-- ============================================================================
--  FUNCTION: finish_match
--  Ends the match and moves trophies (+20 / -20, 1:1 ratio).
--  The winner is decided PURELY from the recorded answers (match_score) —
--  the client no longer submits any scores, so forged finals are impossible.
--  ranked = true (default) moves trophies; friend duels pass false.
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
--  INDEXES
-- ============================================================================
create index idx_matches_status on public.matches(status);
create index idx_questions_category on public.questions(category);


-- ============================================================================
--  REALTIME: turn on live updates for matches
-- ============================================================================
alter publication supabase_realtime add table public.matches;
