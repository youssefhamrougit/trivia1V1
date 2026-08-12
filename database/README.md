# Database — the map

Everything here runs on **Supabase (Postgres)**. There is no other backend. The
browser talks to it directly (auth, PostgREST, RPCs, Realtime) — so the SQL in
this folder **is** your security layer, and the app is only as safe as these
files + the dashboard settings below.

---

## What each file does

| File | Role | Safe to re-run? |
|---|---|---|
| `schema.sql` | **Fresh-install schema**: profiles, questions, matches, `match_answers`, all RLS policies, `join_matchmaking`, `cancel_matchmaking`, `match_score`, `submit_answer`, `finish_match`, indexes, Realtime publication | No (plain `create table`) |
| `seed.sql` | 40 starter questions + the QuizBot profile (practice) | Mostly (idempotent inserts) |
| `questions-bank.sql` | 440 more questions → full 480-question bank | No (plain inserts) |
| `friends-bots.sql` | **REQUIRED after schema**: username claim trigger, friends tables + RPCs, challenges (`challengee`, `challenged` status), `bot_config`, and the **secure v3 `finish_match`** | Yes (idempotent) |
| `stealth-bots.sql` | Disguised skill-matched bot opponents + `start_bot_match` | Yes |
| `match-stats.sql` | **Optional**: `answer_log` table → per-category accuracy on the Stats screen | Yes |
| `setup-demo.sql` | **Existing projects only**: idempotent bring-up to the same state as schema + seed + the security upgrade | Yes |

## Install order

**Fresh project** (recommended):
```
1. schema.sql
2. seed.sql
3. questions-bank.sql
4. friends-bots.sql      ← REQUIRED
5. stealth-bots.sql
6. match-stats.sql       ← optional (Stats accuracy)
```

**Existing project** (tables already exist — running `schema.sql` would fail):
```
1. setup-demo.sql        ← creates everything idempotently + the security upgrade
2. friends-bots.sql
3. stealth-bots.sql
4. match-stats.sql
```

> ⚠️ **Deploy the app and the SQL together.** The client (`js/api.js`) prefers
> the server-verified `submit_answer` RPC and falls back to the legacy direct
> score write when the table doesn't exist — but the **reverse** (old client on
> a new database) breaks, because new databases revoke the score columns.
> Apply the SQL, then deploy the new client, back to back.

## The secure answer pipeline (why `finish_match` changed)

The repo used to ship **three different `finish_match` signatures**. Now every
file defines the **same v3 function** `finish_match(match_id, me, ranked)` —
whichever runs last wins and they're identical.

- The client no longer submits scores. Each answer goes to **`submit_answer`**,
  which validates the pick against the real question, records it in
  **`match_answers`**, and recomputes the score columns from **`match_score`**.
- `finish_match` reads the winner **purely from the recorded answers** and moves
  trophies (+20 / −20, or none for friend duels with `ranked = false`).
- A forged client cannot inflate scores or wins: every row is checked
  server-side, and `update(score1, score2)` is revoked from `anon/authenticated`.
- The client keeps a **legacy fallback** for databases that haven't run the
  upgrade yet — it tries `submit_answer`/v3 `finish_match` first, then falls
  back to the old calls. Old DBs keep working; new DBs are secure.

## Supabase dashboard checklist

1. **Authentication → Providers → Email → "Confirm email" = OFF**
   (sign-up with `username@triviaduel.local` logs straight in and the username
   trigger can claim the row).
2. **Authentication → Rate Limits** — set per-project limits. The repo can't
   enforce these for you; this is your main defense against guest-account spam
   and matchmaking abuse.
3. **Realtime** — the `matches` table must be published (`schema.sql` does it).
4. Older accounts created with a real email can't log in by username — rename
   their email to `<username>@triviaduel.local` or recreate them.

## Security model in one paragraph

The Supabase **anon key in `js/config.js` is public by design**. Every table
has **Row Level Security** on, and every write goes through a `security definer`
RPC that re-derives the user id from the JWT (`auth.uid()`) instead of trusting
parameters. The client can only ever read/write its own rows, and the game's
money moves (winner, trophies) are decided by the database. What the repo can't
do for you: rate limits (dashboard), email/account recovery (needs a real email
domain), and client-side timing verification (server records answers but not
answer windows).
