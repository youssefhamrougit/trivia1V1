# Trivia1v1 — Working Skills

How to work safely in this repo. Read `context.md` for the architecture map;
this file is about *how* to make changes.

## Conventions

- **Vanilla JS, ES2022.** No frameworks, no build step, no package.json.
  There is no test suite or typecheck — verify changes by reading carefully
  and running `node --check <file>.js` for syntax.
- **Keep the public surface stable.** `API.call(path, opts)` and
  `API.stream(room, onEvent)` are the only ways the game talks to Supabase.
  Add routes inside `API.call`; keep the same event shapes the game code
  handles (`match_active`, `match_declined`, `answer`, `match_finished`,
  `round`).
- **Match the file's style:** plain functions (no arrow-function overuse),
  `// ---- section ----` banners, short comments explaining *why*, not what.
- **`esc()` for user input** before it goes into `innerHTML` (see friends.js).

## Editing the database

- `schema.sql` and `setup-demo.sql` must stay **identical** for the shared
  RPCs (`join_matchmaking`, `cancel_matchmaking`, `submit_answer`,
  `sync_advance`, `sync_tick`, `match_score`, `finish_match`) and the shared
  table shapes. Edit both together. `friends-bots.sql` also redefines
  `finish_match` — keep the three in lockstep.
- Prefer `create or replace function` and `add column if not exists` so every
  file stays re-runnable.
- All game logic RPCs are `security definer` with `set search_path = public`
  and **derive the user from `auth.uid()`** — never trust passed `me`/`uid`
  params. Match that pattern for any new RPC.
- Add new RPCs/columns to the SQL **and** deploy the client in the same
  change — the two are version-locked.
- Realtime: only the `matches` table is published. If a new column must
  trigger client updates, it must live on `matches` (or publish a new table).

## Editing the game (sync 1v1)

- The match flow is a state machine driven by: the `submit_answer` RPC
  response (the second answerer advances from here), the Realtime **"round"**
  event (the waiting answerer advances from here), and the 1.5s `sync_tick`
  poll (fallback + disconnect grace). All three paths must funnel through
  **one guarded function** (`syncAdvanceTo`) so duplicate events are no-ops.
- Never let the client write scores — `match_answers` is the only source of
  truth; `match_score` recomputes everything server-side.
- The waiting state (`triviaState.waiting`) must lock the answer buttons and
  stop the timer, and the poll must stop on advance/finish/cleanup.
- Disconnect handling: the server auto-records a `-1` timeout for a missing
  opponent 20s after the first answer in a round (`sync_advance`). Don't
  build client-side "opponent answered" heuristics that bypass this.
- Practice (visible QuizBot) is deliberately **not** sync — it keeps the old
  self-paced flow. Don't route it through the sync machinery.

## Editing the client

- `triviaState` in trivia.js holds all game state — add new fields there with
  a comment, and reset them in every entry path (`triviaFindMatch`,
  `triviaStartBot`, `prepareBotGame`, `triviaCleanup`).
- `API.stream` must be closed on cleanup (`closeStream`) — same for any new
  timers/intervals (`stopSyncPoll`, `clearTimeout`).
- When a bot id list changes, update **both** `js/api.js` (`BOT_IDS`) and
  `database/stealth-bots.sql`.
- The result screen reads `triviaState.lastWinner/lastDelta/lastOnline/
  lastRanked` — set them in `endMatch`, nowhere else.

## Editing the arena viewer (js/arenaViewer.js)

- **three.js is pinned to r128** (CDN in `index.html`) — the code uses r128
  APIs (`sRGBEncoding`, `ACESFilmicToneMapping`, UMD `THREE.GLTFLoader`).
  Don't bump the version or migrate to ES-module imports; keep the
  script-tag, no-build setup.
- **Procedural scenes are the fallback, not the placeholder to delete.**
  `_buildArena3D(i)` must keep working for every arena — it's what renders
  until the GLB models exist and what renders forever if WebGL is missing.
- **Real models are drop-in.** Drop `arena-1.glb` … `arena-7.glb` into
  `assets/arenas/models/` and `_tryLoadModel` picks them up automatically
  (auto-fits to 4.2-wide footprint, floors at y=0, front faces +Z). The
  build spec lives in `assets/arenas/models/instruction.md` — point the
  3D-art agent there and don't hand-tune per-model offsets in code.
- **`_viewer.target` must stay an index** (the loop multiplies it by
  `spacing`). While dragging, store `nx / spacing`; on release, a whole
  index. Never a raw world position.
- **New inputs** (gestures, keys) belong in `bindArenaInput`; keep the drag
  path (pointer capture → follow → snap) intact and keep the 2D fallback
  (`_showFallback`) reachable when `_viewer` is null.
- The `esc()` helper from friends.js is used when building tile/fallback
  HTML — it only runs on user navigation, after all scripts load.

## Before finishing a change

1. `node --check` every edited JS file.
2. Grep for the touched function names to make sure no caller was missed
   (e.g. `submit_answer`, `finishQuestion`, `syncAdvanceTo`).
3. Keep `schema.sql` and `setup-demo.sql` in sync (diff them).
4. Update `aitools/context.md` if the architecture or flow changed.
5. Update `README.md` / `database/README.md` if user-facing behavior changed.
