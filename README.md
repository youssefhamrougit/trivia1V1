<div align="center">

# ⚔️ TriviaDuel

**Real-time 1v1 trivia battles — 10 questions, 15 seconds each. Beat strangers, climb 7 arenas, and take their trophies.**

<br>

<a href="https://triviaduel-xi.vercel.app"><strong>🔗 Live site →</strong></a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="#-the-stack">The stack</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="#-whats-in-the-repo">What's in the repo</a>

<br>

![license](https://img.shields.io/badge/license-MIT-blue)
![status](https://img.shields.io/badge/status-active%20development-yellow)
![static](https://img.shields.io/badge/static%20site-vanilla%20JS-8b5cf6)

</div>

---

## 🎮 What is it?

TriviaDuel is a mobile-first **1v1 trivia game** that runs entirely in the browser. Find a stranger (or practice against QuizBot), get the same 10 questions, and race the 15-second clock. Answers relay to the other player **live**, winner takes **+1 trophy** — climb a 7-arena "Knowledge Ladder" Clash Royale style, and your *peak* trophies unlock arenas forever.

**No app stores. No downloads. No login wall.** Open the link, tap *Continue as guest*, and you're in a match.

| | |
|---|---|
| ⚔️ **Matchmaking** | Pair with a stranger (same 10 questions) or practice vs. QuizBot |
| 🔴 **Live relay** | Scores push between phones instantly via Supabase Realtime |
| 🏆 **Trophy ladder** | Win +1 / lose −1, peak-trophy arena progression, arena-themed questions |
| 📊 **Leaderboard** | Top 50 players by trophies |
| 🔐 **Auth** | Email sign-up/login or one-tap guest via Supabase Auth |
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
triviaduel/
├── index.html          # all screens (the shell of the app)
├── style.css           # design system (dark + neon)
├── manifest.json       # PWA install
├── sw.js               # offline support (network-first)
├── vercel.json         # Vercel caching headers
├── .env.example        # env var reference (placeholders only)
├── assets/             # icons, arena art, UI graphics
├── js/
│   ├── config.js       # 👉 your Supabase URL + publishable key
│   ├── api.js          # Supabase client (auth, RPCs, Realtime)
│   ├── app.js          # startup, login, screen switching
│   ├── arenas.js       # the 7-arena "Knowledge Ladder"
│   └── trivia.js       # the TriviaDuel game
└── database/
    ├── schema.sql      # tables + security + functions (run first)
    ├── seed.sql        # 40 questions + the practice bot (run second)
    └── setup-demo.sql  # idempotent migration for existing projects
```

## 🗺️ Status

⚠️ **Active development** — a complete, playable 1v1 game, with more on the way.

**✅ Shipped** — live matchmaking, real-time score relay, 7-arena ladder, QuizBot practice mode, leaderboard, email/guest auth, PWA install.

**⬜ Roadmap** — rate limiting & abuse protection, AI-generated questions, short-lived Realtime tokens for guest abuse.

## 📄 License

MIT — see [LICENSE](LICENSE).
