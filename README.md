<div align="center">

# ⚔️ Trivia1v1

**Real-time 1v1 trivia battles — 10 questions, 15 seconds each, played question-by-question in sync. Beat strangers, climb 7 arenas, and take their trophies.**

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
| 📦 **APK (Android)** | **Direct download:** [**Install the Android app**](https://tangerine-chaja-22963b.netlify.app/) — grab `Trivia1v1.apk` from the Netlify download page (sideload it: tap Install APK, allow "unknown apps", done). To build your own copy instead, use the tooling in the `triviaduel-tools` folder (see [`apk/README.md`](apk/README.md)). |
| 🌐 **PWA (any phone)** | No file needed. Open [the app](https://trivia1-v1.vercel.app) and use your browser's **Install app** (Android Chrome) or **Add to Home Screen** (iOS Safari). Same app, offline-capable, full-screen. |

---

## 🎮 What is it?

trivia1v1 is a mobile-first **1v1 trivia game** that runs entirely in the browser. Find a stranger (or practice against QuizBot) and get the same 10 questions — played **question-by-question in sync**: both players see the same question, each answers (or the 15-second clock runs out), and the round only moves on once **both** have answered, so both phones advance together. Winner takes **+20 trophies** (loser −20, a strict 1:1 swap) — climb a 7-arena "Knowledge Ladder" Clash Royale style, where your **current** trophies decide your arena. Matchmaking only pairs you with humans within 60 trophies; otherwise a **skill-matched bot opponent** (indistinguishable from a human) steps in after 7 seconds. Win to climb; lose and you drop back down.

**No app stores. No downloads. No login wall.** Open the link, tap *Continue as guest*, and you're in a match.

| | |
|---|---|
| ⚔️ **Matchmaking** | Pair with a stranger (same 10 questions) or practice vs. QuizBot — Easy / Medium / Hard |
| 🔄 **Sync rounds** | Both players answer each question before the round advances — both phones move on together (Realtime + a safety-net poll) |
| 🔴 **Live relay** | Scores push between phones instantly via Supabase Realtime |
| 🏆 **Trophy ladder** | Win +20 / lose −20 (1:1), arena follows your current trophies, skill-matched pairings (60-trophy band), arena-themed questions — every match mixes all 4 categories |
| 🤝 **Friends** | Search by username, send/accept requests, and 1v1-challenge friends (casual duels — no trophies) |
| 📊 **Leaderboard** | Top 50 players by trophies |
| 📈 **Stats** | Per-category answer accuracy + your recent match history (Profile → Stats) |
| 🔐 **Auth** | Username + password (or one-tap guest) via Supabase Auth |
| 🔊 **Sound** | Synthesized effects for right/wrong answers + the countdown clock (Web Audio, no audio files) — mute toggle on the home + match screens |
| 📱 **PWA** | Installable on phones, offline-ready (network-first service worker) |

## 🛠️ The stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML5 + CSS3 + JavaScript (ES2022) — no frameworks, no build step |
| **Backend** | None of our own — **Supabase** handles everything (GoTrue auth, PostgREST, Postgres RPCs, Realtime) |
| **Database** | Supabase (Postgres) with **Row Level Security** — the anon key is public by design, RLS is the real gate |
| **Game logic** | Postgres functions (`join_matchmaking`, `submit_answer`, `finish_match`) + `profiles` / `questions` / `matches` / `match_answers` tables — answers are validated and scored **server-side** |
| **Hosting** | **Vercel** — pure static deployment, zero servers, zero build |
| **PWA** | Web app manifest + network-first service worker |

The whole thing is a **static site**: the browser talks to Supabase directly (auth, questions, matchmaking RPCs, live scores). There is no C++, no Node, no Docker — nothing to build or deploy.

## 🎨 Design

An indie pixel identity — Undertale-cute but polished, dark and moody but warm. The arena viewer is the reference target: the whole app matches its pixel language.

| | |
|---|---|
| 🎨 **Palette** | Warm near-black `#0e0d0b` background with layered warm-dark surfaces (`#161410` → `#1e1a15`, `#262119`), warm off-white ink `#f3efe8` (never pure white) |
| 🧡 **Accent** | One burnt-amber chrome accent (`#df7d1f`, bright `#f2a254`) for buttons/active states; state colors only for win/lose/streak (`#7fcf8d`, `#f17a68`, `#e0a93e`); arenas keep their own per-arena palettes |
| 🔤 **Fonts** | **Press Start 2P** for headings/titles (single weight — no faux bold), **Pixelify Sans** for body text, Press Start 2P again for the arena HUD |
| 🔲 **Chrome** | Chunky 2px borders, hard offset "sticker" shadows (no glow, no blur halos, no gradient buttons), one radius scale (4/8/12px), 150–250ms motion |

## 📁 What's in the repo

```
trivia1v1/
├── index.html          # all screens (the shell of the app)
├── 404.html            # custom not-found page (Vercel serves it for bad routes)
├── style.css           # design system (indie pixel: Press Start 2P + Pixelify Sans, burnt-amber accent)
├── manifest.json       # PWA install
├── sw.js               # offline support (network-first)
├── vercel.json         # Vercel caching + security headers (CSP)
├── download.html       # Android APK download page (checks apk/ at load)
├── .env.example        # env var reference (placeholders only)
├── assets/             # icons, arena art, UI graphics
├── apk/                # generated trivia1v1.apk + build instructions
├── js/
│   ├── config.js       # Supabase config (project URL + publishable key)
│   ├── api.js          # Supabase client (auth, RPCs, Realtime)
│   ├── sound.js        # synthesized sound effects (Web Audio — no audio files)
│   ├── app.js          # startup, login, screen switching
│   ├── arenas.js       # the 7-arena "Knowledge Ladder"
│   ├── arenaViewer.js  # arena browser (Undertale-style HTML/SVG island scenes)
│   ├── trivia.js       # the trivia1v1 game
│   └── friends.js      # the Friends tab (requests, 1v1 challenges)
└── database/
    ├── schema.sql      # tables + security + functions (run first)
    ├── seed.sql        # 40 starter questions + the practice bot (run second)
    ├── questions-bank.sql # 440 more questions — the full 480-question bank
    ├── stealth-bots.sql # disguised skill-matched bot opponents (run after seed)
    ├── setup-demo.sql  # idempotent migration for existing projects
    ├── friends-bots.sql # ⚠️ REQUIRED: friends + bot difficulty + username auth
    ├── match-stats.sql  # OPTIONAL: Stats screen (per-category accuracy)
    └── README.md        # ⚠️ READ FIRST: install order, security model, dashboard checklist
```

## 🗺️ Status

✅ **Live** — a complete, playable 1v1 game in production.

**Shipped** — live matchmaking, real-time score relay, 7-arena ladder, bot practice with Easy/Medium/Hard, friends + 1v1 challenges, leaderboard, per-category accuracy + match history, username/password or guest auth, PWA install.

**⬜ Roadmap** — rate limiting & abuse protection, AI-generated questions, short-lived Realtime tokens for guest abuse, challenge expiry cleanup.


## 📄 License

MIT — see [LICENSE](LICENSE).
