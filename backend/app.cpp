// ============================================================================
//  app.cpp — the TriviaDuel API, in C++.
//
//  Browser  ->  this C++ server  ->  Supabase (database + auth)
//
//  What lives here:
//    - auth proxy (sign up / log in / guest / log out)
//    - profiles, leaderboard, question bank
//    - 1v1 matchmaking (join_matchmaking RPC) + live score relay over SSE
//
//  Realtime works with Server-Sent Events (SSE): each browser opens one
//  stream per "room" (match-<id> or queue-<id>) and the C++ server pushes
//  JSON events to everyone in that room.
// ============================================================================

#include "app.hpp"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <map>
#include <memory>
#include <mutex>
#include <set>
#include <string>
#include <thread>
#include <vector>

using jx::Value;

sb::Client supabase;
const std::string BOT_ID = "00000000-0000-0000-0000-000000000001";

// ============================================================================
//  SSE hub — one stream per "room"; broadcasts JSON events to everyone in it
// ============================================================================
struct SSEHub {
  struct Conn {
    SOCKET s;
    std::string room, token;
    std::recursive_mutex mu;
    bool closed = false;
  };

  std::mutex g;
  std::map<std::string, std::vector<std::shared_ptr<Conn>>> rooms;

  std::shared_ptr<Conn> add(const std::string& room, const std::string& token, SOCKET s) {
    auto c = std::make_shared<Conn>();
    c->s = s;
    c->room = room;
    c->token = token;
    std::lock_guard<std::mutex> lk(g);
    rooms[room].push_back(c);
    return c;
  }

  void remove(const std::string& room, const std::shared_ptr<Conn>& c) {
    std::lock_guard<std::mutex> lk(g);
    auto& v = rooms[room];
    v.erase(std::remove(v.begin(), v.end(), c), v.end());
    if (v.empty()) rooms.erase(room);
  }

  void broadcast(const std::string& room, const std::string& jsonEvent,
                 const std::string& exceptToken = "") {
    std::lock_guard<std::mutex> lk(g);
    auto it = rooms.find(room);
    if (it == rooms.end()) return;
    std::string msg = "data: " + jsonEvent + "\n\n";
    for (auto& c : it->second) {
      if (!exceptToken.empty() && c->token == exceptToken) continue;
      std::lock_guard<std::recursive_mutex> lk2(c->mu);
      if (c->closed) continue;
      send(c->s, msg.c_str(), (int)msg.size(), 0);
    }
  }

  std::string anyToken(const std::string& room) {
    std::lock_guard<std::mutex> lk(g);
    auto it = rooms.find(room);
    if (it == rooms.end() || it->second.empty()) return "";
    return it->second[0]->token;
  }

  std::vector<std::string> roomList() {
    std::lock_guard<std::mutex> lk(g);
    std::vector<std::string> out;
    for (auto& kv : rooms) out.push_back(kv.first);
    return out;
  }

  void serve(std::shared_ptr<Conn> c) {
    // Windows SO_RCVTIMEO takes a DWORD in MILLISECONDS (not a timeval):
    // 15000 ms = 15 s between client pings, not a 15 ms busy-loop.
    DWORD timeoutMs = 15000;
    setsockopt(c->s, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeoutMs, sizeof timeoutMs);
    char buf[256];
    while (true) {
      int n = recv(c->s, buf, sizeof buf, 0);
      if (n > 0) continue;
      if (n == 0) break;
      if (WSAGetLastError() == WSAETIMEDOUT) continue;
      break;
    }
    {
      std::lock_guard<std::recursive_mutex> lk(c->mu);
      c->closed = true;
    }
    remove(c->room, c);
    closesocket(c->s);
  }

  void heartbeatAll() {
    std::lock_guard<std::mutex> lk(g);
    std::string ping = ": ping\n\n";
    for (auto& kv : rooms) {
      for (auto& c : kv.second) {
        std::lock_guard<std::recursive_mutex> lk2(c->mu);
        if (!c->closed) send(c->s, ping.c_str(), (int)ping.size(), 0);
      }
    }
  }
};

SSEHub hub;

// ============================================================================
//  little helpers
// ============================================================================
Value parseBody(const http::Request& r) {
  if (r.body.empty()) return Value::mkObj();
  try { return jx::parse(r.body); } catch (...) { return Value::mkObj(); }
}

Value parseArr(const std::string& body) {
  try {
    Value v = jx::parse(body);
    if (v.isArr()) return v;
  } catch (...) {}
  return Value::mkArr();
}

Value firstRow(const http::HttpsResult& res) {
  try {
    Value v = jx::parse(res.body);
    if (v.isArr() && !v.a.empty()) return v.a[0];
  } catch (...) {}
  return Value::mkObj();
}

std::mutex uidCacheMu;
std::map<std::string, std::pair<std::string, std::time_t>> uidCache;
const std::time_t UID_TTL = 120;

std::string uidForToken(const std::string& token) {
  if (token.empty()) return "";
  {
    std::lock_guard<std::mutex> lk(uidCacheMu);
    auto it = uidCache.find(token);
    if (it != uidCache.end() && std::time(nullptr) - it->second.second < UID_TTL)
      return it->second.first;
  }
  std::string uid;
  auto r = supabase.authUser(token);
  if (r.status == 200 && !r.body.empty()) {
    try { uid = jx::parse(r.body).str("id"); } catch (...) {}
  }
  {
    std::lock_guard<std::mutex> lk(uidCacheMu);
    if (uidCache.size() > 10000) uidCache.clear();
    uidCache[token] = {uid, std::time(nullptr)};
  }
  return uid;
}

http::Response forward(const http::HttpsResult& r) {
  http::Response res;
  res.status = r.status == 0 ? 502 : r.status;
  res.body = r.body.empty() ? "{}" : r.body;
  return res;
}

Value okResponse() {
  Value v = Value::mkObj();
  v.o["ok"] = Value::mkBool(true);
  return v;
}

// ============================================================================
//  background threads
// ============================================================================

void queuePoller() {
  while (true) {
    std::this_thread::sleep_for(std::chrono::milliseconds(1500));
    for (const std::string& room : hub.roomList()) {
      if (room.rfind("queue-", 0) != 0) continue;
      std::string matchId = room.substr(6);
      std::string token = hub.anyToken(room);
      if (token.empty()) continue;
      auto r = supabase.select("matches", "select=status&id=eq." + matchId, token);
      try {
        Value v = jx::parse(r.body);
        if (v.isArr() && !v.a.empty() && v.a[0].str("status") == "active") {
          Value ev = Value::mkObj();
          ev.o["type"] = Value::mkStr("match_active");
          ev.o["match_id"] = Value::mkStr(matchId);
          hub.broadcast(room, jx::dump(ev));
        }
      } catch (...) {}
    }
  }
}

void heartbeat() {
  while (true) {
    std::this_thread::sleep_for(std::chrono::seconds(15));
    hub.heartbeatAll();
  }
}

void startBackgroundThreads() {
  std::thread(queuePoller).detach();
  std::thread(heartbeat).detach();
}

// ============================================================================
//  routes
// ============================================================================
void setupRoutes(http::Server& srv) {
  using R = http::Response;

  // ---- status: used by the setup screen -----------------------------------
  srv.routes["GET /api/status"] = [](const http::Request&) {
    Value v = Value::mkObj();
    v.o["name"] = Value::mkStr("TriviaDuel");
    v.o["backend"] = Value::mkStr("C++17 + OpenSSL");
    v.o["configured"] = Value::mkBool(supabase.configured());
    return R::json(200, jx::dump(v));
  };

  // ---- auth (proxied straight to Supabase) --------------------------------
  srv.routes["POST /api/auth/signup"] = [](const http::Request& r) {
    Value b = parseBody(r);
    return forward(supabase.authSignup(b.str("email"), b.str("password")));
  };
  srv.routes["POST /api/auth/login"] = [](const http::Request& r) {
    Value b = parseBody(r);
    return forward(supabase.authLogin(b.str("email"), b.str("password")));
  };
  srv.routes["POST /api/auth/guest"] = [](const http::Request&) {
    return forward(supabase.authGuest());
  };
  srv.routes["POST /api/auth/logout"] = [](const http::Request& r) {
    if (r.bearer().empty()) return R::error(401, "Not logged in");
    supabase.authSignOut(r.bearer());
    return R::json(200, jx::dump(okResponse()));
  };

  // ---- me: profile --------------------------------------------------------
  srv.routes["GET /api/me"] = [](const http::Request& r) {
    if (r.bearer().empty()) return R::error(401, "Not logged in");
    std::string uid = uidForToken(r.bearer());
    if (uid.empty()) return R::error(401, "Invalid session");

    Value me = Value::mkObj();
    Value user = Value::mkObj();
    user.o["id"] = Value::mkStr(uid);
    me.o["user"] = user;
    me.o["profile"] = firstRow(supabase.select("profiles", "select=*&id=eq." + uid, r.bearer()));
    return R::json(200, jx::dump(me));
  };

  // ---- leaderboard + question bank ----------------------------------------
  srv.routes["GET /api/leaderboard"] = [](const http::Request& r) {
    if (r.bearer().empty()) return R::error(401, "Not logged in");
    auto res = supabase.select("profiles",
        "select=*&order=trophies.desc&limit=50&id=neq." + BOT_ID, r.bearer());
    // pre-migration databases still use "elo" — fall back so the screen
    // keeps working until setup-demo.sql is run
    if (res.status != 200) {
      res = supabase.select("profiles",
          "select=*&order=elo.desc&limit=50&id=neq." + BOT_ID, r.bearer());
    }
    if (res.status != 200) return forward(res);
    return R::json(200, res.body);
  };
  srv.routes["GET /api/questions"] = [](const http::Request& r) {
    if (r.bearer().empty()) return R::error(401, "Not logged in");
    auto res = supabase.select("questions", "select=*&limit=200", r.bearer());
    if (res.status != 200) return forward(res);
    return R::json(200, res.body);
  };

  // ---- 1v1 matchmaking -----------------------------------------------------
  srv.routes["POST /api/trivia/join"] = [](const http::Request& r) {
    if (r.bearer().empty()) return R::error(401, "Not logged in");
    std::string uid = uidForToken(r.bearer());
    if (uid.empty()) return R::error(401, "Invalid session");

    Value args = Value::mkObj();
    args.o["me"] = Value::mkStr(uid);
    // arena signature discipline: the RPC tilts half the match's questions
    // toward the arena the player is currently in (by trophies).
    Value prof = firstRow(supabase.select("profiles", "select=trophies&id=eq." + uid, r.bearer()));
    if (prof.has("trophies")) {
      std::string sig = "mixed";
      double trophies = prof.num("trophies");
      if (trophies >= 540) sig = "Math";
      else if (trophies >= 400) sig = "History";
      else if (trophies >= 260) sig = "Football";
      else if (trophies >= 120) sig = "Science";
      args.o["sig"] = Value::mkStr(sig);
    }
    auto res = supabase.rpc("join_matchmaking", jx::dump(args), r.bearer());
    if (res.status != 200) return forward(res);

    std::string matchId = res.body;
    try {
      Value v = jx::parse(res.body);
      if (v.isStr()) matchId = v.s;
    } catch (...) {}
    Value out = Value::mkObj();
    out.o["match_id"] = Value::mkStr(matchId);
    return R::json(200, jx::dump(out));
  };

  srv.routes["GET /api/trivia/match/"] = [](const http::Request& r) {
    std::string id = r.params.count("id") ? r.params.at("id") : "";
    if (id.empty()) return R::error(400, "missing match id");
    if (r.bearer().empty()) return R::error(401, "Not logged in");
    std::string uid = uidForToken(r.bearer());
    if (uid.empty()) return R::error(401, "Invalid session");

    auto mres = supabase.select("matches", "select=*&id=eq." + id, r.bearer());
    if (mres.status != 200) return forward(mres);
    Value match = firstRow(mres);
    if (match.isNull() || match.str("id").empty()) return R::error(404, "Match not found");

    std::string p1 = match.str("player1");
    std::string p2 = match.str("player2");
    if (p1 != uid && p2 != uid) return R::error(403, "Not your match");

    Value opp = Value::mkObj();
    std::string oppId = p1 == uid ? p2 : p1;
    if (!oppId.empty())
      opp = firstRow(supabase.select("profiles", "select=id,username&id=eq." + oppId, r.bearer()));

    Value qs = Value::mkArr();
    const Value* ids = match.get("question_ids");
    if (ids && ids->isArr() && !ids->a.empty()) {
      std::string inList;
      for (auto& qid : ids->a) {
        if (!inList.empty()) inList += ",";
        inList += std::to_string((long long)qid.n);
      }
      Value all = parseArr(supabase.select("questions", "select=*&id=in.(" + inList + ")", r.bearer()).body);
      for (auto& qid : ids->a) {
        long long want = (long long)qid.n;
        for (auto& q : all.a) {
          if ((long long)q.num("id") == want) { qs.a.push_back(q); break; }
        }
      }
    }

    Value out = Value::mkObj();
    out.o["match"] = match;
    out.o["opponent"] = opp;
    out.o["questions"] = qs;
    return R::json(200, jx::dump(out));
  };

  srv.routes["POST /api/trivia/answer"] = [](const http::Request& r) {
    if (r.bearer().empty()) return R::error(401, "Not logged in");
    std::string uid = uidForToken(r.bearer());
    if (uid.empty()) return R::error(401, "Invalid session");

    Value b = parseBody(r);
    std::string id = b.str("match_id");
    if (id.empty()) return R::error(400, "missing match_id");

    Value m = firstRow(supabase.select("matches", "select=id&id=eq." + id, r.bearer()));
    if (m.isNull() || m.str("id").empty()) return R::error(403, "Not your match");

    Value ev = Value::mkObj();
    ev.o["type"] = Value::mkStr("answer");
    ev.o["from"] = Value::mkStr(uid);
    ev.o["score"] = Value::mkNum(b.num("score"));
    hub.broadcast("match-" + id, jx::dump(ev), r.bearer());
    return R::json(200, jx::dump(okResponse()));
  };

  srv.routes["POST /api/trivia/finish"] = [](const http::Request& r) {
    if (r.bearer().empty()) return R::error(401, "Not logged in");
    std::string uid = uidForToken(r.bearer());
    if (uid.empty()) return R::error(401, "Invalid session");

    Value b = parseBody(r);
    std::string id = b.str("match_id");
    if (id.empty()) return R::error(400, "missing match_id");
    double myScore = b.num("my_score");
    double oppScore = b.num("opp_score");

    std::string winner;
    double delta = 0;
    bool ranked = false;

    try {
      Value match = firstRow(supabase.select("matches", "select=*&id=eq." + id, r.bearer()));
      if (match.isNull() || match.str("id").empty()) throw std::runtime_error("no match");
      std::string p1 = match.str("player1");
      std::string p2 = match.str("player2");
      if (p1 != uid && p2 != uid) throw std::runtime_error("not your match");

      bool myIsP1 = (p1 == uid);
      Value args = Value::mkObj();
      args.o["match_id"] = Value::mkStr(id);
      args.o["me"] = Value::mkStr(uid);
      args.o["s1"] = Value::mkNum(myIsP1 ? myScore : oppScore);
      args.o["s2"] = Value::mkNum(myIsP1 ? oppScore : myScore);

      auto fres = supabase.rpc("finish_match", jx::dump(args), r.bearer());
      if (fres.status != 200 && fres.status != 204) throw std::runtime_error("rpc failed");

      Value m2 = firstRow(supabase.select("matches", "select=*&id=eq." + id, r.bearer()));
      winner = m2.str("winner");
      // 1:1 trophies: win = +20, loss = -20
      delta = winner == uid ? 20 : (winner.empty() ? 0 : -20);
      ranked = true;
    } catch (const std::exception&) {
      winner = myScore > oppScore ? uid : (myScore < oppScore ? "opponent" : "");
    }

    Value out = Value::mkObj();
    out.o["winner"] = Value::mkStr(winner);
    out.o["delta"] = Value::mkNum(delta);
    out.o["ranked"] = Value::mkBool(ranked);
    return R::json(200, jx::dump(out));
  };

  // ---- live streams (SSE) --------------------------------------------------
  srv.onStream = [](SOCKET c, const http::Request& r) {
    auto fail = [c](int status, const std::string& msg) {
      std::string body = "{\"error\":\"" + msg + "\"}";
      std::string head = "HTTP/1.1 " + std::to_string(status) +
                         " " + (status == 401 ? "Unauthorized" : "Bad Request") + "\r\n" +
                         "Content-Type: application/json\r\n" +
                         "Content-Length: " + std::to_string(body.size()) + "\r\n" +
                         "Connection: close\r\n\r\n";
      send(c, head.c_str(), (int)head.size(), 0);
      send(c, body.c_str(), (int)body.size(), 0);
      closesocket(c);
    };

    std::string room = r.params.count("room") ? r.params.at("room") : "";
    std::string token = r.params.count("token") ? r.params.at("token") : "";
    if (room.empty() || token.empty()) { fail(400, "missing room/token"); return; }
    if (uidForToken(token).empty()) { fail(401, "invalid session"); return; }

    // match + queue streams are private: only the two players may listen
    if (room.rfind("match-", 0) == 0 || room.rfind("queue-", 0) == 0) {
      std::string id = room.substr(room.find('-') + 1);
      auto mres = supabase.select("matches", "select=id&id=eq." + id, token);
      Value m = parseArr(mres.body);
      if (mres.status != 200 || m.a.empty()) { fail(401, "not a player in this match"); return; }
    }

    std::string head = "HTTP/1.1 200 OK\r\n"
                       "Content-Type: text/event-stream\r\n"
                       "Cache-Control: no-cache\r\n"
                       "Connection: keep-alive\r\n"
                       "Access-Control-Allow-Origin: *\r\n\r\n"
                       "retry: 1000\n\n";
    send(c, head.c_str(), (int)head.size(), 0);

    auto conn = hub.add(room, token, c);
    hub.serve(conn);
  };
}
