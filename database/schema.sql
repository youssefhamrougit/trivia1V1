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
--  FUNCTION: finish_match
--  Called by each player when the match ends.
--  Decides the winner and moves trophies (+20 / -20, 1:1 ratio).
-- ============================================================================
create or replace function public.finish_match(
  match_id uuid,
  me       uuid,
  s1       integer,
  s2       integer
)
returns void
language plpgsql
security definer
as $$
declare
  m         public.matches%rowtype;
  winner_id uuid;
begin
  -- never trust the client: derive the identity from the JWT instead
  me := auth.uid();
  if me is null then return; end if;

  select * into m from public.matches where id = match_id;
  if not found then return; end if;

  if me not in (m.player1, m.player2) then return; end if;

  -- merge scores first so the second finisher's last answer still counts
  -- (with "ends for both", the first finisher ends the match for everyone)
  update public.matches
  set score1 = greatest(m.score1, s1),
      score2 = greatest(m.score2, s2)
  where id = match_id;

  if m.status = 'finished' then return; end if;

  select * into m from public.matches where id = match_id;

  if m.score1 > m.score2 then
    winner_id := m.player1;
  elsif m.score2 > m.score1 then
    winner_id := m.player2;
  else
    winner_id := null;
  end if;

  update public.matches
  set status = 'finished', winner = winner_id
  where id = match_id;

  if winner_id is not null then
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
