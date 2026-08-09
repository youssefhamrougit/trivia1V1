-- ============================================================================
--  stealth-bots.sql — disguised skill-matched bot opponents
--
--  When no human joins the queue within the 7-second search window, the app
--  secretly pairs the player with a BOT that looks exactly like a human:
--    • the bot has a real-looking username + avatar initial (no "QuizBot")
--    • the match is a REAL 'active' match row vs the bot's profile, so the
--      normal online flow (opponent name, live scoreboard, finish_match with
--      +20/-20 trophy movement) runs exactly like a human match
--    • the bot's skill follows the PLAYER's trophies (the RPC picks the bot
--      whose trophies are closest to ours, and the client tunes the bot's
--      accuracy/response time from our trophies too)
--
--  The player's browser simulates the bot's answers (the bot profile has no
--  client of its own) — see js/trivia.js (triviaState.stealthBot).
--
--  HOW TO USE:
--    Paste into supabase.com -> SQL Editor -> RUN. Run AFTER schema.sql +
--    seed.sql (or setup-demo.sql) + questions-bank.sql + friends-bots.sql.
--    Safe to re-run.
--
--  NOTE: these bot ids are also listed in js/api.js (BOT_IDS) so they are
--  excluded from the leaderboard and friend search — keep the two lists in
--  sync if you ever add more bots.
-- ============================================================================


-- ============================================================================
--  1) THE BOT PROFILES — one row per bot, spread across the ladder so every
--     trophy level has a nearby "opponent". Idempotent, and safe even if a
--     real player already took one of these usernames (each bot is only
--     inserted if neither its id NOR its username is taken).
--     (profiles.id has no FK to auth.users — bots never log in, they only
--      need a profile row so matches can reference them.)
-- ============================================================================
do $$
declare
  b record;
begin
  for b in values
    ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Nova',        40,  30, 28),
    ('00000000-0000-0000-0000-0000000000a2'::uuid, 'Vortex',     140,  42, 35),
    ('00000000-0000-0000-0000-0000000000a3'::uuid, 'ShadowFox',  260,  48, 35),
    ('00000000-0000-0000-0000-0000000000a4'::uuid, 'PixelRider', 380,  54, 35),
    ('00000000-0000-0000-0000-0000000000a5'::uuid, 'EmberBlaze', 500,  60, 35),
    ('00000000-0000-0000-0000-0000000000a6'::uuid, 'Quasar',     620,  66, 35),
    ('00000000-0000-0000-0000-0000000000a7'::uuid, 'Zephyr',     740,  72, 35),
    ('00000000-0000-0000-0000-0000000000a8'::uuid, 'Luna',       860,  78, 35),
    ('00000000-0000-0000-0000-0000000000a9'::uuid, 'NeonWolf',   220,  46, 35),
    ('00000000-0000-0000-0000-0000000000aa'::uuid, 'Raptor',     460,  58, 35)
  loop
    if not exists (
      select 1 from public.profiles
      where id = b.column1 or username = b.column2
    ) then
      insert into public.profiles (id, username, trophies, wins, losses)
      values (b.column1, b.column2, b.column3, b.column4, b.column5);
    end if;
  end loop;
end;
$$;


-- ============================================================================
--  2) RPC: start_bot_match(me, sig)
--     Called by the client when the 7-second human-search window expires.
--     Picks the bot whose trophies are closest to the player's (skill match),
--     draws 10 category-varied questions (same discipline as join_matchmaking,
--     including the arena signature tilt), and creates a REAL 'active' match
--     row so the normal online flow + finish_match handle everything.
--     Returns the match id (the client then loads it like any match).
-- ============================================================================
create or replace function public.start_bot_match(me uuid, sig text default 'mixed')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  bot_id uuid;
  mine   integer;
  picked bigint[];
  rest   text[];
  new_id uuid;
begin
  -- never trust the client: derive the identity from the JWT instead
  me := auth.uid();
  if me is null then return null; end if;

  select trophies into mine from public.profiles where id = me;
  mine := coalesce(mine, 0);

  -- a skill-matched opponent: the bot whose trophies sit nearest ours
  select id into bot_id
  from public.profiles
  where id in (
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000a3',
    '00000000-0000-0000-0000-0000000000a4',
    '00000000-0000-0000-0000-0000000000a5',
    '00000000-0000-0000-0000-0000000000a6',
    '00000000-0000-0000-0000-0000000000a7',
    '00000000-0000-0000-0000-0000000000a8',
    '00000000-0000-0000-0000-0000000000a9',
    '00000000-0000-0000-0000-0000000000aa'
  )
  order by abs(trophies - mine), random()
  limit 1;
  if bot_id is null then return null; end if;

  -- sweep up any abandoned bot matches from earlier interrupted fallbacks so
  -- they can't accumulate (the bot never finishes a match on its own). Only
  -- touches ACTIVE bot matches this player abandoned — never a match in play.
  update public.matches
  set status = 'finished'
  where player1 = me
    and status = 'active'
    and player2 in (
      '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-0000000000a2',
      '00000000-0000-0000-0000-0000000000a3',
      '00000000-0000-0000-0000-0000000000a4',
      '00000000-0000-0000-0000-0000000000a5',
      '00000000-0000-0000-0000-0000000000a6',
      '00000000-0000-0000-0000-0000000000a7',
      '00000000-0000-0000-0000-0000000000a8',
      '00000000-0000-0000-0000-0000000000a9',
      '00000000-0000-0000-0000-0000000000aa'
    );

  -- same all-4-category question mix as join_matchmaking (themed arenas keep
  -- a 4-question tilt from their own category, otherwise a 3/3/2/2 split)
  if sig is null or sig not in ('Science','Math','Football','History') then
    sig := 'mixed';
  end if;

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

  -- an ACTIVE match vs the bot: the normal online flow takes over, and the
  -- player's client simulates the bot's answers. finish_match then moves
  -- trophies exactly like a human match (+20 / -20), so nothing gives the
  -- disguise away.
  insert into public.matches (player1, player2, status, question_ids)
  values (me, bot_id, 'active', picked)
  returning id into new_id;

  return new_id;
end;
$$;


-- ============================================================================
--  DONE!  Re-running this file is safe.
-- ============================================================================
