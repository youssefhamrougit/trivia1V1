# TriviaDuel

A live 1v1 trivia battle game that runs in any browser. It's a **static site** (plain HTML/CSS/JS) that talks to **Supabase** directly — auth, storage, matchmaking and live score sync all happen on Supabase, so it deploys anywhere (Vercel included) with zero servers of your own.

Find a stranger, get the same 10 questions, 15 seconds each. Winner takes **+1 trophy**. Climb 7 arenas, Clash Royale style.

## What is this?

TriviaDuel is a real-time 1v1 trivia game — no frameworks, no build step. The browser talks to Supabase directly: GoTrue for auth, PostgREST for data, Postgres functions (`join_matchmaking`, `finish_match`) for game logic, and Supabase Realtime for live scores. A Windows C++ backend used to proxy all of this — it's still in `backend/` as a reference, but the web app no longer needs it.

It's intentionally simple:

- **Match** — find a stranger (or practice vs. QuizBot) and get the same 10 questions.
- **Answer fast** — 15 seconds per question, streaks score more.
- **Live scores** — answers relay to the other phone instantly over SSE.
- **Climb arenas** — +1 trophy per win; your *peak* trophies unlock 7 arenas forever.

## ✨ Features

| Category | Details |
|---|---|
| ⚔️ Matchmaking | Pair with a stranger (same 10 questions) or practice vs. QuizBot |
| 🔴 Live relay | Supabase Realtime pushes scores between phones instantly |
| 🏆 Trophy ladder | 1:1 trophies (win +1, lose −1), peak-trophy arenas, arena-themed questions |
| 📊 Leaderboard | Top 50 players by trophies |
| 🔐 Auth | Email sign-up/login or one-tap guest via Supabase Auth |
| 📱 PWA | Installable on phones, offline-ready (network-first service worker) |

## 🚀 Quick Start

The app is a **static site** that talks to Supabase directly — there is no server to run. Deploy it to Vercel and paste 2 keys, and it's live.

### 1. Set up the database (Supabase, ~2 minutes)

1. Go to **supabase.com** → **New project** (free plan).
2. **SQL Editor** → run **`database/schema.sql`** (tables + security + functions).
3. **SQL Editor** → run **`database/seed.sql`** (questions + the QuizBot).
4. **Authentication → Sign In / Providers**: turn **OFF** *"Confirm email"*, turn **ON** *"Allow anonymous sign-ins"*.

Already used a project before? Run **`database/setup-demo.sql`** instead — it's idempotent and brings an existing project up to date (trophies, question bank, fixed matchmaking, realtime).

### 2. Add your keys

Open **`js/config.js`** and paste your **Project URL** and **anon public key** from *Project Settings → API*. (The anon key is public by design — the real security is the Row Level Security in the schema.)

To test locally, just open `index.html` in a browser (or run any static server) — no backend needed.

### 3. Deploy to Vercel (~2 minutes, free)

1. Push this repo to **GitHub**.
2. Go to **vercel.com** → **Add New → Project** → import the repo.
3. Framework preset: **Other** — leave *Build command* and *Output directory* empty (it's static).
4. Click **Deploy**. Done — the app is live at your `*.vercel.app` URL.
5. Changed keys later? Edit `js/config.js`, commit, and push — Vercel redeploys automatically.

That's it — no servers, no Docker, no environment variables.

> The old Windows **C++ backend** (`backend/`) is no longer required — the browser talks to Supabase directly. The files are kept as a reference for the game logic.

## 🗺️ Project Status

⚠️ Active development — the current build ships a complete 1v1 game.

**✅ Shipped**

- Live 1v1 matchmaking (both players get the same 10 questions)
- Real-time score relay over Supabase Realtime (queue + match streams)
- 7-arena ladder with arena-themed question pools
- Practice mode vs. QuizBot (no rank change)
- Leaderboard + email/guest auth
- PWA install + offline shell
- Deploys as a pure static site — Vercel-ready

**⬜ On the roadmap**

- Rate limiting & abuse protection
- AI-generated questions
- Short-lived Realtime tokens / rate limits for guest abuse

## 📁 Project Structure

```
triviaduel/
├── index.html              # all screens (the shell of the app)
├── style.css               # design system (dark + neon)
├── manifest.json           # PWA install
├── sw.js                   # offline support (network-first)
├── assets/
│   ├── icon.svg            # logo (favicon + in-app)
│   ├── arenas/             # 7 arena icons
│   └── icons/              # UI icons (trophy, bolt, medals…)
├── js/
│   ├── config.js           # 👉 paste your Supabase URL + anon key here
│   ├── api.js              # talks to Supabase directly (auth, RPCs, Realtime)
│   ├── app.js              # startup, login, screen switching
│   ├── arenas.js           # the 7-arena "Knowledge Ladder"
│   └── trivia.js           # the TriviaDuel game
├── backend/                # the original C++ backend (optional — no longer used)
│   ├── main.cpp / app.cpp / http.hpp / json.hpp / supabase.hpp
│   └── Makefile            # build with `mingw32-make`
└── database/
    ├── schema.sql          # tables + security + functions (run first)
    ├── seed.sql            # 40 questions + the practice bot (run second)
    └── setup-demo.sql      # idempotent migration for existing projects
```

## 🛠️ Technology

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5 + CSS3 + JavaScript (ES2022) — no frameworks, no build step |
| Hosting | Vercel (pure static — no server functions needed) |
| Realtime | Supabase Realtime (Postgres changes on the matches table) |
| Database | Supabase (Postgres + GoTrue auth), row-level security |
| PWA | Web app manifest + network-first service worker |

## 📄 License

MIT — see [LICENSE](LICENSE).
