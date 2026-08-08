// selftest.js — exercises the full TriviaDuel API flow against the running
// C++ backend. Run:  node selftest.js
const BASE = "http://localhost:3000";

async function call(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = "Bearer " + opts.token;
  const res = await fetch(BASE + path, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(path + " -> " + res.status + " " + JSON.stringify(data));
  return data;
}

async function signup(tag) {
  const email = tag + Date.now() + "@selftest.com";
  const data = await call("/api/auth/signup", { method: "POST", body: { email, password: "password123" } });
  return { token: data.access_token, id: data.user.id };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let pass = 0, fail = 0;
  const ok = (name) => { console.log("  ✔ " + name); pass++; };
  const bad = (name, err) => { console.log("  ✘ " + name + " — " + err.message); fail++; };

  console.log("== auth ==");
  let a, b;
  try { a = await signup("pa"); ok("signup A"); } catch (e) { bad("signup A", e); return; }
  try { b = await signup("pb"); ok("signup B"); } catch (e) { bad("signup B", e); return; }

  console.log("== profile ==");
  try {
    const me = await call("/api/me", { token: a.token });
    if (me.profile && me.profile.trophies === 0) ok("profile starts at 0 trophies");
    else bad("profile", new Error("unexpected: " + JSON.stringify(me).slice(0, 120)));
  } catch (e) { bad("profile", e); }

  console.log("== questions ==");
  try {
    const qs = await call("/api/questions?limit=200", { token: a.token });
    const cats = [...new Set(qs.map((q) => q.category))];
    console.log("     " + qs.length + " questions, categories: " + cats.join(", "));
    const allowed = ["Science", "Math", "Football", "History"];
    if (qs.length >= 10 && cats.every((c) => allowed.includes(c)) && cats.length === 4) ok("bank has exactly the 4 allowed categories");
    else bad("question bank", new Error("categories=" + cats.join(",") + " count=" + qs.length));
  } catch (e) { bad("question bank", e); }

  console.log("== matchmaking ==");
  let matchId;
  try {
    const r1 = await call("/api/trivia/join", { method: "POST", token: a.token, body: {} });
    matchId = r1.match_id;
    ok("A created/joined a match (" + matchId.slice(0, 8) + ")");
  } catch (e) { bad("A join", e); return; }

  try {
    const r2 = await call("/api/trivia/join", { method: "POST", token: b.token, body: {} });
    if (r2.match_id === matchId) ok("B paired into A's match");
    else bad("B join", new Error("different match: " + r2.match_id + " vs " + matchId));
  } catch (e) { bad("B join", e); }

  await sleep(1500);
  try {
    const m = await call("/api/trivia/match/" + matchId, { token: a.token });
    const status = m.match.status;
    const qCount = (m.questions || []).length;
    if (status === "active" && qCount === 10) ok("match active with 10 questions");
    else bad("match load", new Error("status=" + status + " questions=" + qCount));
  } catch (e) { bad("match load", e); }

  console.log("== finish (B wins 500-300) ==");
  let deltaA = null;
  try {
    const f1 = await call("/api/trivia/finish", { method: "POST", token: b.token,
      body: { match_id: matchId, my_score: 500, opp_score: 300 } });
    ok("B finish accepted (winner=" + String(f1.winner).slice(0, 8) + ", delta=" + f1.delta + ", ranked=" + f1.ranked + ")");
  } catch (e) { bad("B finish", e); }
  try {
    const f2 = await call("/api/trivia/finish", { method: "POST", token: a.token,
      body: { match_id: matchId, my_score: 300, opp_score: 500 } });
    deltaA = f2.delta;
    ok("A finish accepted (delta=" + f2.delta + ", ranked=" + f2.ranked + ")");
  } catch (e) { bad("A finish", e); }

  await sleep(500);
  try {
    const me = await call("/api/me", { token: a.token });
    if (deltaA === -1 && me.profile.trophies === -1 && me.profile.losses === 1) {
      ok("A lost 1 trophy (-1) with 1 loss — 1:1 ratio");
    } else {
      bad("trophy check", new Error("trophies=" + me.profile.trophies + " (expected -1) wins=" + me.profile.wins + " losses=" + me.profile.losses));
    }
  } catch (e) { bad("trophy check", e); }

  console.log("\n== RESULT: " + pass + " passed, " + fail + " failed ==");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("selftest crashed:", e); process.exit(1); });
