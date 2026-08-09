// ============================================================================
//  app.hpp — the Trivia1v1 API. Everything the browser needs, in C++.
// ============================================================================
#pragma once

#include "http.hpp"
#include "supabase.hpp"

// the one shared Supabase connection (filled in from config.ini by main.cpp)
extern sb::Client supabase;

// the hub that fans live events out to browsers over SSE
struct SSEHub;
extern SSEHub hub;

// registers every route on the server + the SSE handler
void setupRoutes(http::Server& srv);

// background tasks (matchmaking poller, keep-alive heartbeats)
void startBackgroundThreads();

// the bot we exclude from the leaderboard (created in seed.sql)
extern const std::string BOT_ID;
