# TriviaDuel

A live 1v1 trivia battle game that runs in any browser. The frontend is plain HTML/CSS/JS; the backend is a **C++17 web server** (WinSock + OpenSSL, written from scratch) that serves the app and runs the game logic, with a hosted **Supabase** database handling storage and auth.

Find a stranger, get the same 10 questions, 15 seconds each. Winner takes **+1 trophy**. Climb 7 arenas, Clash Royale style.

## What is this?

TriviaDuel is a real-time 1v1 trivia game — no frameworks, no build step for the frontend, no JavaScript on the server. The web server, the JSON parsing, the HTTPS client, the matchmaking, and the live score relay all live in `backend/` as C++.

It's intentionally simple:

- **Match** — find a stranger (or practice vs. QuizBot) and get the same 10 questions.
- **Answer fast** — 15 seconds per question, streaks score more.
- **Live scores** — answers relay to the other phone instantly over SSE.
- **Climb arenas** — +1 trophy per win; your *peak* trophies unlock 7 arenas forever.

## ✨ Features

| Category | Details |
|---|---|
| ⚔️ Matchmaking | Pair with a stranger (same 10 questions) or practice vs. QuizBot |
| 🔴 Live relay | Server-Sent Events push scores between phones — no WebSocket library |
| 🏆 Trophy ladder | 1:1 trophies (win +1, lose −1), peak-trophy arenas, arena-themed questions |
| 📊 Leaderboard | Top 50 players by trophies |
| 🔐 Auth | Email sign-up/login or one-tap guest, proxied through the C++ server |
| 📱 PWA | Installable on phones, offline-ready (network-first service worker) |

## 🚀 Quick Start

### Run it locally (Windows)

Needs MSYS2 / MinGW-w64 `g++` and OpenSSL:
`pacman -S mingw-w64-x86_64-gcc mingw-w64-x86_64-openssl`

```bash
cd backend
mingw32-make        # or: make
cd ..
./backend/app.exe   # serves http://localhost:3000
```

Open **http://localhost:3000** — or use your computer's IP on your phone (`ipconfig`) to test two devices at once.

### Set up the database (Supabase, ~2 minutes)

1. Go to **supabase.com** → **New project** (free plan).
2. **SQL Editor** → run **`database/schema.sql`** (tables + security + functions).
3. **SQL Editor** → run **`database/seed.sql`** (40 questions + the QuizBot).
4. **Authentication → Sign In / Providers**: turn **OFF** *"Confirm email"*, turn **ON** *"Allow anonymous sign-ins"*.

Already used a project before? Run **`database/setup-demo.sql`** instead — it's idempotent and brings an existing project up to date (trophies, question bank, fixed matchmaking).

### Add your keys

```bash
cp backend/config.example.ini backend/config.ini
```

Then paste your **Project URL** and **anon public key** from *Project Settings → API* into `config.ini` (it's git-ignored). Environment variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `PORT` work too.

## 🗺️ Project Status

⚠️ Active development — the current build ships a complete 1v1 game.

**✅ Shipped**

- Live 1v1 matchmaking (both players get the same 10 questions)
- Real-time score relay over SSE (queue + match streams)
- 7-arena ladder with arena-themed question pools
- Practice mode vs. QuizBot (no rank change)
- Leaderboard + email/guest auth
- PWA install + offline shell

**⬜ On the roadmap**

- HTTPS deployment (reverse proxy + TLS)
- WebSockets / short-lived stream tokens (replace the token-in-URL SSE)
- Rate limiting & abuse protection
- AI-generated questions
- Cloud hosting for the C++ server

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
│   ├── api.js              # talks to the C++ backend (fetch + SSE)
│   ├── app.js              # startup, login, screen switching
│   ├── arenas.js           # the 7-arena "Knowledge Ladder"
│   └── trivia.js           # the TriviaDuel game
├── backend/                # the C++ backend (all server code)
│   ├── main.cpp            # entry point + config
│   ├── app.cpp             # every API route + the live SSE relay
│   ├── app.hpp / http.hpp / json.hpp / supabase.hpp
│   ├── config.example.ini  # copy to config.ini, paste your keys
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
| Backend | C++17 — WinSock HTTP server + OpenSSL HTTPS client, written from scratch |
| Realtime | Server-Sent Events (one stream per match / queue room) |
| Database | Supabase (Postgres + GoTrue auth), row-level security |
| PWA | Web app manifest + network-first service worker |

## 📄 License

MIT — see [LICENSE](LICENSE).
