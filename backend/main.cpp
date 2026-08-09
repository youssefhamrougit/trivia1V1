// ============================================================================
//  main.cpp — the Trivia1v1 C++ backend entry point.
//
//  Run from the project root:   backend/app.exe
//  (or build it first:          cd backend && make)
// ============================================================================

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include "app.hpp"

#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <map>
#include <string>

namespace {

std::string trim(const std::string& s) {
  size_t a = s.find_first_not_of(" \t\r\n");
  if (a == std::string::npos) return "";
  size_t b = s.find_last_not_of(" \t\r\n");
  return s.substr(a, b - a + 1);
}

bool fileExists(const std::string& p) {
  std::ifstream f(p);
  return (bool)f;
}

std::map<std::string, std::string> loadConfig() {
  std::map<std::string, std::string> cfg;

  std::string path;
  if (fileExists("backend/config.ini")) path = "backend/config.ini";
  else if (fileExists("config.ini")) path = "config.ini";

  if (!path.empty()) {
    std::ifstream f(path);
    std::string line;
    while (std::getline(f, line)) {
      std::string t = trim(line);
      if (t.empty() || t[0] == ';' || t[0] == '#') continue;
      size_t eq = t.find('=');
      if (eq == std::string::npos) continue;
      cfg[trim(t.substr(0, eq))] = trim(t.substr(eq + 1));
    }
  }

  if (getenv("SUPABASE_URL")) cfg["SUPABASE_URL"] = getenv("SUPABASE_URL");
  if (getenv("SUPABASE_ANON_KEY")) cfg["SUPABASE_ANON_KEY"] = getenv("SUPABASE_ANON_KEY");
  if (getenv("PORT")) cfg["PORT"] = getenv("PORT");
  return cfg;
}

std::string findStaticRoot() {
  char buf[MAX_PATH];
  GetCurrentDirectoryA(MAX_PATH, buf);
  std::string cwd = buf;
  auto hasIndex = [](const std::string& dir) {
    return fileExists(dir + "\\index.html") || fileExists(dir + "/index.html");
  };
  if (hasIndex(cwd)) return cwd;
  size_t slash = cwd.find_last_of("/\\");
  if (slash != std::string::npos) {
    std::string parent = cwd.substr(0, slash);
    if (hasIndex(parent)) return parent;
  }
  return cwd;
}

} // namespace

int main() {
  std::map<std::string, std::string> cfg = loadConfig();

  if (cfg["SUPABASE_URL"].empty()) cfg["SUPABASE_URL"] = "PASTE_YOUR_SUPABASE_URL_HERE";
  if (cfg["SUPABASE_ANON_KEY"].empty()) cfg["SUPABASE_ANON_KEY"] = "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";
  supabase = sb::Client(cfg["SUPABASE_URL"], cfg["SUPABASE_ANON_KEY"]);

  int port = atoi(cfg["PORT"].c_str());
  if (port <= 0) port = 3000;

  std::cout << "==================================================\n";
  std::cout << "  Trivia1v1 — C++ backend\n";
  std::cout << "  Port: " << port << "\n";
  std::cout << "  Supabase: " << (supabase.configured() ? "configured" : "NOT CONFIGURED (paste keys into backend/config.ini)") << "\n";
  std::cout << "==================================================\n";

  http::Server srv;
  srv.port = port;
  srv.staticRoot = findStaticRoot();

  setupRoutes(srv);
  startBackgroundThreads();

  if (!srv.run()) return 1;
  return 0;
}
