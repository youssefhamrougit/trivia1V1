// ============================================================================
//  arenas.js — the "Knowledge Ladder": 7 arenas, Clash Royale style.
//
//  Trophies are 1:1 (win +20, lose -20). Your ARENA follows your CURRENT
//  trophies, so dropping below a threshold takes you back down an arena.
//
//  Arena thresholds:  0 | 120 | 260 | 400 | 540 | 680 | 840  (~6-7 wins per arena)
// ============================================================================

const ARENAS = [
  { id: 1, name: "Training Grounds",  icon: "assets/arenas/arena-1.svg",  min: 0,  sig: null,
    theme: { c1: "#94a3b8", c2: "#475569", glow: "rgba(148,163,184,0.18)" },
    blurb: "Every legend starts somewhere. Learn the ropes — then climb." },
  { id: 2, name: "The Beaker Realm",   icon: "assets/arenas/arena-2.svg",  min: 120, sig: "Science",
    theme: { c1: "#34d399", c2: "#0d9488", glow: "rgba(52,211,153,0.20)" },
    blurb: "Molecules, stars, and the laws of the universe. Can you keep up?" },
  { id: 3, name: "The Last Whistle",   icon: "assets/arenas/arena-3.svg",  min: 260, sig: "Football",
    theme: { c1: "#4ade80", c2: "#15803d", glow: "rgba(74,222,128,0.20)" },
    blurb: "Hear that roar? That's the crowd calling your name." },
  { id: 4, name: "The Marble Archive", icon: "assets/arenas/arena-4.svg",  min: 400, sig: "History",
    theme: { c1: "#fbbf24", c2: "#b45309", glow: "rgba(251,191,36,0.20)" },
    blurb: "The past belongs to those who remember it. Become unforgettable." },
  { id: 5, name: "Axiom Chamber",      icon: "assets/arenas/arena-5.svg",  min: 540, sig: "Math",
    theme: { c1: "#a78bfa", c2: "#6d28d9", glow: "rgba(167,139,250,0.20)" },
    blurb: "Numbers don't bluff. Prove your calculations, challenger." },
  { id: 6, name: "Sandsworn Arena",    icon: "assets/arenas/arena-6.svg",  min: 680, sig: null,
    theme: { c1: "#f87171", c2: "#b91c1c", glow: "rgba(248,113,113,0.20)" },
    blurb: "Only the strongest survive the sand. Champions are made here." },
  { id: 7, name: "Hall of Legends",   icon: "assets/arenas/arena-7.svg",  min: 840, sig: null,
    theme: { c1: "#facc15", c2: "#a16207", glow: "rgba(250,204,21,0.22)" },
    blurb: "You've reached the summit. Now etch your name in history." },
];

// the arena a player is in, given their current trophies
function arenaForTrophies(t) {
  let arena = ARENAS[0];
  for (const a of ARENAS) if (t >= a.min) arena = a;
  return arena;
}

// the next arena to unlock, or null if they're at the top
function nextArenaFor(t) {
  for (const a of ARENAS) if (a.min > t) return a;
  return null;
}

// progress info for the home-screen banner: current arena, next arena,
// fill percentage, and trophies still needed
function arenaProgress(t) {
  const arena = arenaForTrophies(t);
  const next = nextArenaFor(t);
  if (!next) return { arena: arena, next: null, pct: 100, needed: 0 };
  const span = next.min - arena.min;
  // clamp both ends: negative trophies must not produce a negative width
  const pct = Math.max(0, Math.min(100, Math.round(((t - arena.min) / span) * 100)));
  return { arena: arena, next: next, pct: pct, needed: next.min - t };
}

// paint the whole app in this arena's colors (CSS variables on <html>)
function applyArenaTheme(arena) {
  const r = document.documentElement.style;
  r.setProperty("--arena-c1", arena.theme.c1);
  r.setProperty("--arena-c2", arena.theme.c2);
  r.setProperty("--arena-glow", arena.theme.glow);
}

// reset to the default brand look (used on the auth screen, etc.)
function resetArenaTheme() {
  const r = document.documentElement.style;
  r.removeProperty("--arena-c1");
  r.removeProperty("--arena-c2");
  r.removeProperty("--arena-glow");
}
