<div align="center">

# ⚔️ Trivia1v1

**Real-time 1v1 trivia battles — 10 questions, 15 seconds each. Beat strangers, climb 7 arenas, and take their trophies.**

<br>

<a href="https://trivia1-v1.vercel.app"><strong>🔗 Live site →</strong></a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="#-the-stack">The stack</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="#-whats-in-the-repo">What's in the repo</a>

<br>

![license](https://img.shields.io/badge/license-MIT-blue)
![status](https://img.shields.io/badge/status-live-brightgreen)
![static](https://img.shields.io/badge/static%20site-vanilla%20JS-8b5cf6)
![download](https://img.shields.io/badge/download-APK-orange)

</div>

---

## 📲 Download for Android

Get Trivia1v1 on your phone's home screen — **two ways**:

| | |
|---|---|
| 📦 **APK (Android)** | Grab the installer from the [**download page**](download.html) (live at [`/download.html`](https://trivia1-v1.vercel.app/download.html)). The Download button turns on automatically once `apk/trivia1v1.apk` is in the repo — see [`apk/README.md`](apk/README.md) to generate it in ~2 minutes (PWABuilder or Capacitor). |
| 🌐 **PWA (any phone)** | No file needed. Open [the app](https://trivia1-v1.vercel.app) and use your browser's **Install app** (Android Chrome) or **Add to Home Screen** (iOS Safari). Same app, offline-capable, full-screen. |

---

## 🎮 What is it?

trivia1v1 is a mobile-first **1v1 trivia game** that runs entirely in the browser. Find a stranger (or practice against QuizBot), get the same 10 questions, and race the 15-second clock. Answers relay to the other player **live**, winner takes **+20 trophies** (loser −20, a strict 1:1 swap) — climb a 7-arena "Knowledge Ladder" Clash Royale style, where your **current** trophies decide your arena. Matchmaking only pairs you with humans within 60 trophies; otherwise QuizBot steps in after 7 seconds. Win to climb; lose and you drop back down.

**No app stores. No downloads. No login wall.** Open the link, tap *Continue as guest*, and you're in a match.

| | |
|---|---|
| ⚔️ **Matchmaking** | Pair with a stranger (same 10 questions) or practice vs. QuizBot — Easy / Medium / Hard |
| 🔴 **Live relay** | Scores push between phones instantly via Supabase Realtime |
| 🏆 **Trophy ladder** | Win +20 / lose −20 (1:1), arena follows your current trophies, skill-matched pairings (60-trophy band), arena-themed questions |
| 🤝 **Friends** | Search by username, send/accept requests, and 1v1-challenge friends (casual duels — no trophies) |
| 📊 **Leaderboard** | Top 50 players by trophies |
| 🔐 **Auth** | Username + password (or one-tap guest) via Supabase Auth |
| 📱 **PWA** | Installable on phones, offline-ready (network-first service worker) |

## 🛠️ The stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML5 + CSS3 + JavaScript (ES2022) — no frameworks, no build step |
| **Backend** | None of our own — **Supabase** handles everything (GoTrue auth, PostgREST, Postgres RPCs, Realtime) |
| **Database** | Supabase (Postgres) with **Row Level Security** — the anon key is public by design, RLS is the real gate |
| **Game logic** | Postgres functions (`join_matchmaking`, `finish_match`) + `profiles` / `questions` / `matches` tables |
| **Hosting** | **Vercel** — pure static deployment, zero servers, zero build |
| **PWA** | Web app manifest + network-first service worker |

The whole thing is a **static site**: the browser talks to Supabase directly (auth, questions, matchmaking RPCs, live scores). There is no C++, no Node, no Docker — nothing to build or deploy.

## 📁 What's in the repo

```
trivia1v1/
├── index.html          # all screens (the shell of the app)
├── style.css           # design system (dark + neon)
├── manifest.json       # PWA install
├── sw.js               # offline support (network-first)
├── vercel.json         # Vercel caching headers
├── download.html       # Android APK download page (checks apk/ at load)
├── .env.example        # env var reference (placeholders only)
├── assets/             # icons, arena art, UI graphics
├── apk/                # generated trivia1v1.apk + build instructions
├── content/            # social content kit (Instagram carousels, captions)
├── js/
│   ├── config.js       # Supabase config (project URL + publishable key)
│   ├── api.js          # Supabase client (auth, RPCs, Realtime)
│   ├── app.js          # startup, login, screen switching
│   ├── arenas.js       # the 7-arena "Knowledge Ladder"
│   ├── trivia.js       # the trivia1v1 game
│   └── friends.js      # the Friends tab (requests, 1v1 challenges)
└── database/
    ├── schema.sql      # tables + security + functions (run first)
    ├── seed.sql        # 40 questions + the practice bot (run second)
    ├── setup-demo.sql  # idempotent migration for existing projects
    └── friends-bots.sql # ⚠️ REQUIRED: friends + bot difficulty + username auth
```

## 🗺️ Status

✅ **Live** — a complete, playable 1v1 game in production.

**Shipped** — live matchmaking, real-time score relay, 7-arena ladder, bot practice with Easy/Medium/Hard, friends + 1v1 challenges, leaderboard, username/password or guest auth, PWA install.

**⬜ Roadmap** — rate limiting & abuse protection, AI-generated questions, short-lived Realtime tokens for guest abuse, challenge expiry cleanup.

## 🔧 Supabase setup checklist (you must do this once)

The app is a static site that talks to Supabase directly — which means **one file + one dashboard toggle** are required for the newer features:

1. **Run `database/friends-bots.sql`** in the Supabase SQL Editor. It creates the `friends` table, the `bot_config` table, the `matches.challengee` column + `'challenged'` status, and the `send_friend_request` / `create_challenge` RPCs — and upgrades `finish_match` with a `ranked` flag. Safe to re-run.
2. **Turn OFF “Confirm email”** — Supabase dashboard → *Authentication → Providers → Email*. Sign-up then logs you straight in and claims your username.
3. **Old email accounts**: accounts created before this change won't log in by username (their email isn't `username@triviaduel.local` — that domain is functional and intentionally unchanged). Recreate them, or rename their email in the dashboard to `<username>@triviaduel.local`.

Until you run the SQL, the app degrades gracefully: practice bots still work with built-in difficulty defaults, and the Friends tab shows a hint instead of crashing.

## 📄 License

MIT — see [LICENSE](LICENSE).
