# Trivia1v1 — Repository Context

> Read this file first when working in this repo. It is the map of how the
> whole app fits together. Update it whenever the architecture changes.

## What this app is

**Trivia1v1** — a mobile-first, real-time **1v1 trivia game** that runs
entirely in the browser. Two players get the same questions, answer them
**question-by-question in sync** (both must answer — or time out — before the
round advances), and the database decides the winner and moves trophies.

- **Frontend:** vanilla HTML/CSS/JS (ES2022). No frameworks, no build step.
- **Backend:** none of our own. **Supabase** provides everything: GoTrue auth,
  PostgREST, Postgres RPCs, and Realtime.
- **Hosting:** Vercel static hosting (see `vercel.json`).

## The stack / architecture at a glance

```
browser (index.html + js/*)
   │  direct HTTPS calls (no own server)
   ▼
Supabase
   ├─ Auth (GoTrue)      — username/password via <username>@triviaduel.local, or guest
   ├─ PostgREST          — tables: profiles, questions, matches, match_answers, friends, ...
   ├─ RPCs (Postgres)    — join_matchmaking, submit_answer, sync_tick, finish_match, ...
   └─ Realtime           — live round/score updates on the matches table
```

**Security model:** the Supabase anon key in `js/config.js` is public by
design. Every table has **Row Level Security** on. The client can only read
its own rows, and the game's money moves (winner, trophies) are decided by
**security definer** RPCs that re-derive the user id from the JWT
(`auth.uid()`) instead of trusting parameters.

## File map

| File | What it does |
|---|---|
| `index.html` | All screens (the app shell) — auth, home, queue, match, result, friends, leaderboard, profile, stats |
| `style.css` | Design system (dark + neon), match screen, progress dots, timer bar |
| `manifest.json` / `sw.js` | PWA install + network-first offline support |
| `vercel.json` | Vercel caching + CSP headers |
| `js/config.js` | Supabase project URL + anon key (`window.TRIVIA1V1_CONFIG`) |
| `js/api.js` | **The Supabase client layer** — `API.call()` mirrors the old `/api/*` routes; `API.stream()` wraps Realtime. All table access + RPCs live here |
| `js/app.js` | Startup, auth flow, screen router (`go()`), toasts, confetti, arena modal, stats/history rendering |
| `js/trivia.js` | **The game** — matchmaking queue, the sync 1v1 match loop, bot practice, leaderboard |
| `js/friends.js` | Friends tab — search, requests, 1v1 challenges (casual duels), incoming-challenge Realtime listener |
| `js/arenas.js` | The 7-arena "Knowledge Ladder" (trophies → arena + theme) |
| `js/sound.js` | Synthesized sound effects (Web Audio, no files) |
| `database/*.sql` | All Postgres: tables, RLS, RPCs, seeds (see below) |
| `aitools/context.md` | This file — the codebase map |
| `aitools/skills.md` | How to work safely in this repo (conventions, gotchas) |

## The game flow (the important part)

1. **Matchmaking** — `join_matchmaking(me, sig)` RPC: joins a waiting match
   (within 60-trophy band) or creates one with 10 category-varied questions.
   After a 7-second human-search window with no joiner, the app secretly pairs
   a **disguised bot** (`start_bot_match`) that looks exactly like a human.
2. **Sync 1v1 match** (humans AND disguised bots):
   - Both players see the **same question** (index `matches.current_q`, 0-based).
   - Each player answers (or their 15s timer runs out → choice `-1`).
   - Answers are recorded server-side via **`submit_answer`** into
     `match_answers` (the source of truth — never trust client scores).
   - The round advances **only when both players have answered** (or the
     server's 20s disconnect grace auto-records a timeout for a missing
     opponent via `sync_advance`). The client that answers second advances
     from the RPC response; the one waiting advances from a **Realtime
     "round" event** or a 1.5s poll (`sync_tick` RPC).
   - Scores are recomputed by `match_score` (100 points, 150 on a 3-streak)
     — never sent by the client.
3. **Finish** — when the last round resolves, both clients call
   `finish_match(match_id, me, ranked)`, which reads the winner purely from
   the recorded answers and moves trophies (+20 / −20, 1:1). Friend duels
   pass `ranked = false` (winner recorded, no trophies move).
4. **Practice** — visible QuizBot (easy/medium/hard) still uses the old
   self-paced flow: client-side bot simulation, no match row, no trophies.

### Matches table (key columns)

`id, player1, player2, challengee (friends), winner, status
('waiting'|'challenged'|'active'|'finished'), question_ids bigint[],
score1, score2, current_q (0-based question in play), round_started_at,
created_at`

`current_q` and `round_started_at` are the **sync 1v1** columns: the round
only advances when both players answered the question at `current_q`, and
`round_started_at` anchors the disconnect grace window.

### RPC inventory

| RPC | Role |
|---|---|
| `join_matchmaking(me, sig)` | queue logic + picks the 10 questions |
| `cancel_matchmaking(me)` | leave the queue (race-safe) |
| `start_bot_match(me, sig)` | disguised bot match (stealth-bots.sql) |
| `submit_answer(me, match_id, question_id, choice)` | record + validate answer, recompute scores, returns `{correct, correct_index, score, opp_score, current_q, done}` |
| `sync_advance(p_match)` | shared round-advance helper (both answered? → next question; disconnect grace) |
| `sync_tick(me, match_id)` | polled by the waiting player; nudges stalled rounds; returns `{current_q, score1, score2, status, winner}` |
| `finish_match(match_id, me, ranked)` | decide winner from answers, move trophies (idempotent) |
| `match_score(p_match, p_player)` | recompute one player's score from `match_answers` |
| friends: `send_friend_request`, `create_challenge`, `cancel_challenge` | friends tab |

## Database files (install order matters)

| File | Role | Safe to re-run? |
|---|---|---|
| `schema.sql` | Fresh-install: tables, RLS, RPCs, Realtime publication | No |
| `seed.sql` | 40 starter questions + QuizBot profile | Mostly |
| `questions-bank.sql` | 440 more questions (full 480 bank) | No |
| `friends-bots.sql` | **Required**: username trigger, friends tables/RPCs, challenges, `bot_config`, secure `finish_match` | Yes |
| `stealth-bots.sql` | Disguised bots + `start_bot_match` | Yes |
| `match-stats.sql` | Optional: `answer_log` → per-category accuracy | Yes |
| `setup-demo.sql` | Idempotent bring-up for EXISTING projects (mirrors schema+seed) | Yes |

**Critical rule:** `submit_answer`, `finish_match`, `match_score`,
`sync_advance`, `sync_tick`, `join_matchmaking`, and `cancel_matchmaking`
must stay **identical between `schema.sql` and `setup-demo.sql`** (the last
one run wins). Keep them in sync when editing.

**Deploy rule:** the client (`js/api.js` / `js/trivia.js`) and the SQL are
deployed together — apply the SQL, then ship the client, back to back. The
client keeps a few legacy fallbacks for pre-migration databases (e.g. the
direct score write when `submit_answer` is missing), but new features require
the new SQL.

## Bot ids

- `00000000-0000-0000-0000-000000000001` = QuizBot (visible practice bot)
- `...a1`–`...aa` = 10 disguised stealth bots
- Both lists are hardcoded in `js/api.js` (`BOT_IDS`) **and** in
  `database/stealth-bots.sql` — keep them in sync.
- In SQL filters, bot exclusions use `filter("id", "not.in", "(...)")` with
  a parenthesised list (see `BOT_IDS_FILTER` in `js/api.js`) — plain
  `.not("id","in",array)` in supabase-js produces a malformed PostgREST
  filter (missing parens) and errors with `failed to parse filter`.

## Known pain points / gotchas

- **`not.in` filter bug:** never use `.not(col, "in", array)` in supabase-js
  v2 — it drops the parentheses PostgREST requires. Use `.filter(col,
  "not.in", "(" + array.join(",") + ")")`.
- **Friends search / leaderboard** exclude bots via `BOT_IDS_FILTER`.
- **Realtime** is the sync 1v1 backbone: the `matches` table must be
  published (`alter publication supabase_realtime add table public.matches`).
- **RLS on `match_answers`:** players can only read their OWN answers — the
  opponent's correctness is never readable client-side by design.
- **Challenge accept** (`/api/friends/acceptchallenge`) is a plain client
  update that must also set `round_started_at` (the round starts on accept,
  not on challenge creation).
