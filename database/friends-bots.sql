-- ============================================================================
--  friends-bots.sql — PLACEHOLDER / REQUIRED SETUP for:
--    1. username + password auth   (claim the chosen username on sign-up)
--    2. Friends tab                (search, requests, list)
--    3. Friend 1v1 challenges      (casual duels — no trophy change)
--    4. Bot difficulty             (easy / medium / hard practice)
--
--  ⚠️  YOU MUST RUN THIS FILE:
--     supabase.com -> your project -> SQL Editor -> paste -> RUN
--
--  Safe to re-run (idempotent). Requires schema.sql (or setup-demo.sql) to
--  already be applied — it needs the profiles / questions / matches tables.
-- ============================================================================


-- ============================================================================
--  1) SIGN-UP TRIGGER: claim the username the player chose at sign-up.
--
--     The app signs people up with  username@triviaduel.local  and passes the
--     clean username in the user's metadata. This trigger stores it on their
--     profile row. Guests (anonymous) have no metadata -> player_xxxxxx.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen text;
begin
  chosen := nullif(btrim(new.raw_user_meta_data->>'username'), '');
  insert into public.profiles (id, username)
  values (new.id, coalesce(chosen, 'player_' || left(new.id::text, 6)));
  return new;
end;
$$;

drop trigger if exists on_user_created on auth.users;
create trigger on_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================================
--  2) TABLE: friends  (one row = one friendship / one pending request)
-- ============================================================================
create table if not exists public.friends (
  id         uuid primary key default gen_random_uuid(),
  requester  uuid not null references public.profiles(id),
  addressee  uuid not null references public.profiles(id),
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  unique (requester, addressee)
);

alter table public.friends enable row level security;

drop policy if exists "friends select" on public.friends;
create policy "friends select"
  on public.friends for select
  using (auth.uid() in (requester, addressee));

drop policy if exists "friends insert" on public.friends;
create policy "friends insert"
  on public.friends for insert
  with check (requester = auth.uid());

drop policy if exists "friends accept" on public.friends;
create policy "friends accept"
  on public.friends for update
  using (addressee = auth.uid());   -- only the addressee can accept

drop policy if exists "friends delete" on public.friends;
create policy "friends delete"
  on public.friends for delete
  using (auth.uid() in (requester, addressee));


-- ============================================================================
--  3) RPC: send_friend_request(to_username)
--     The only way a request is created — validated server-side.
--     Returns: 'pending' | 'already_friends' | 'pending_exists' | 'self'
--              | 'not_found' | 'not_authed'
-- ============================================================================
create or replace function public.send_friend_request(to_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  target   uuid;
  existing text;
begin
  if me is null then return 'not_authed'; end if;

  select id into target
  from public.profiles
  where lower(username) = lower(to_username)
  limit 1;
  if target is null then return 'not_found'; end if;
  if target = me then return 'self'; end if;
  -- the practice bot is not a person — don't let anyone friend it
  if target = '00000000-0000-0000-0000-000000000001' then return 'bot'; end if;

  select status into existing
  from public.friends
  where (requester = me and addressee = target)
     or (requester = target and addressee = me)
  limit 1;

  if existing is not null then
    if existing = 'accepted' then return 'already_friends'; end if;
    return 'pending_exists';
  end if;

  insert into public.friends (requester, addressee, status)
  values (me, target, 'pending')
  on conflict (requester, addressee) do nothing; -- race-safe
  return 'pending';
end;
$$;


-- ============================================================================
--  4) MATCHES: add a `challengee` column + a 'challenged' status.
--
--     Challenge matches get their OWN status so the normal matchmaking
--     (which only ever picks up status = 'waiting') can never join them.
-- ============================================================================
alter table public.matches add column if not exists challengee uuid references public.profiles(id);

alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status in ('waiting','challenged','active','finished'));

create index if not exists idx_matches_challengee on public.matches(challengee, status);

-- a challengee must be able to SEE their incoming challenges (they are not
-- player1 / player2 yet) and ACCEPT them (update when player2 is null)
drop policy if exists "read own matches" on public.matches;
create policy "read own matches"
  on public.matches for select
  using (auth.uid() in (player1, player2) or challengee = auth.uid());

drop policy if exists "update matches" on public.matches;
create policy "update matches"
  on public.matches for update
  using (
    (auth.uid() in (player1, player2))
    or (status = 'waiting' and player2 is null)
    or (status = 'challenged' and challengee = auth.uid() and player2 is null)
  );


-- ============================================================================
--  5) RPC: create_challenge(challengee_id)
--     Starts a CASUAL 1v1 vs a friend: 10 random questions, status
--     'challenged' until the friend accepts (then it becomes 'active' and
--     the normal match flow takes over). Friend duels never move trophies.
--
--     NOTE: the parameter is named challengee_id (NOT challengee) on purpose.
--     PL/pgSQL treats a bare identifier that matches a column of a table in
--     the statement as the COLUMN, not the variable — so a parameter named
--     exactly 'challengee' collides with the matches.challengee column and
--     Postgres fails with 'column reference "challengee" is ambiguous'.
-- ============================================================================
create or replace function public.create_challenge(challengee_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me     uuid := auth.uid();
  picked bigint[];
  new_id uuid;
  rest   text[];  -- the 4 categories shuffled, for the variety mix
begin
  if me is null then return null; end if;
  if challengee_id is null or challengee_id = me then return null; end if;

  -- first sweep away any stale challenge between this pair (e.g. one the
  -- challenger abandoned, or that was never answered and the client
  -- expired) so a dead row can never block a fresh challenge. 10 minutes
  -- is comfortably longer than the client's ~90-second accept window.
  update public.matches m
  set status = 'finished'
  where m.status = 'challenged'
    and m.created_at < now() - interval '10 minutes'
    and ((m.player1 = me and m.challengee = challengee_id)
      or (m.player1 = challengee_id and m.challengee = me));

  -- only one pending challenge between the same pair at a time
  if exists (
    select 1 from public.matches m
    where m.status = 'challenged'
      and ((m.player1 = me and m.challengee = challengee_id)
        or (m.player1 = challengee_id and m.challengee = me))
  ) then
    return null;
  end if;

  -- every challenge mixes all 4 categories (3/3/2/2 split), shuffled so the
  -- categories stay interleaved through the whole match
  select array(
    select cat
    from unnest(ARRAY['Science','Math','Football','History']) as cat
    order by random()
  ) into rest;

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

  insert into public.matches (player1, challengee, status, question_ids)
  values (me, challengee_id, 'challenged', picked)
  returning id into new_id;

  return new_id;
end;
$$;


-- ============================================================================
--  6) RPC: cancel_challenge(match_id)
--     The CHALLENGER retracts a pending challenge (the friend list shows a
--     Cancel button while one is pending). Mirrors cancel_matchmaking's
--     race-safety: if the friend accepted at the exact instant, the match is
--     already 'active' — return its id so the challenger plays it instead.
--     Returns the match id if it went active, or null when cancelled.
-- ============================================================================
create or replace function public.cancel_challenge(match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  m  public.matches%rowtype;
begin
  if me is null then return null; end if;

  select * into m from public.matches where id = match_id;
  if not found then return null; end if;

  -- only the challenger can cancel, and only while it's still pending
  if m.player1 <> me then return null; end if;
  if m.status = 'active' then return m.id; end if;   -- they just accepted!
  if m.status = 'challenged' then
    update public.matches set status = 'finished' where id = match_id;
  end if;
  return null;
end;
$$;


-- ============================================================================
--  7) RPC: finish_match — now takes a `ranked` flag.
--
--     ranked = true  (default, normal matchmaking): winner +20 / loser -20
--     ranked = false (friend duels): the winner is recorded, but NO trophies
--     move. Backwards compatible with the old call signature.
-- ============================================================================
create or replace function public.finish_match(
  match_id uuid,
  me       uuid,
  s1       integer,
  s2       integer,
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
--  8) TABLE: bot_config — Practice-vs-QuizBot difficulty settings.
--     The app reads this table; if it's missing it falls back to built-in
--     defaults, so practice still works before you run this file.
-- ============================================================================
create table if not exists public.bot_config (
  difficulty    text primary key check (difficulty in ('easy','medium','hard')),
  label         text not null,
  answer_chance numeric not null,  -- 0..1  chance the bot answers correctly
  answer_ms     integer not null,  -- delay before the bot "answers" (milliseconds)
  icon          text
);

alter table public.bot_config enable row level security;

drop policy if exists "read bot config" on public.bot_config;
create policy "read bot config"
  on public.bot_config for select
  using (auth.uid() is not null);

insert into public.bot_config (difficulty, label, answer_chance, answer_ms, icon) values
  ('easy',   'Easy',   0.35, 1100, 'assets/icons/robot.svg'),
  ('medium', 'Medium', 0.55,  800, 'assets/icons/robot.svg'),
  ('hard',   'Hard',   0.85,  550, 'assets/icons/robot.svg')
on conflict (difficulty) do nothing;
-- (answer_ms is deliberately under the ~1.4s question-reveal pause so the
--  bot's score always lands while the reveal is still showing)


-- ============================================================================
--  DONE!  Re-running this file is safe.
--
--  Still to do in the Supabase dashboard (see README):
--    • Authentication → Providers → Email  →  turn OFF "Confirm email"
--      (so sign-up logs you straight in and the username can be claimed).
--    • Older accounts created with a real email won't log in by username —
--      recreate them or rename their email to  <username>@triviaduel.local .
-- ============================================================================
