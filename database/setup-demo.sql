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
  created_at   timestamptz default now()
);


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
create policy "read own matches"
  on public.matches for select
  using (auth.uid() in (player1, player2));

drop policy if exists "create match" on public.matches;
create policy "create match"
  on public.matches for insert
  with check (player1 = auth.uid());

drop policy if exists "update matches" on public.matches;
create policy "update matches"
  on public.matches for update
  using (
    (auth.uid() in (player1, player2))
    or (status = 'waiting' and player2 is null)
  );


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

  -- the creator's arena has a signature discipline: half the questions come
  -- from it, half from the whole bank. Keeps every match 10 questions while
  -- making each arena "feel" themed.
  if sig is null or sig not in ('Science','Math','Football','History') then
    sig := 'mixed';
  end if;

  if sig = 'mixed' then
    select array(
      select id from public.questions order by random() limit 10
    ) into picked;
  else
    select array(
      (select id from public.questions where category = sig order by random() limit 5)
      union
      (select id from public.questions where category <> sig order by random() limit 5)
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
--  FUNCTION: finish_match
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
set search_path = public
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
