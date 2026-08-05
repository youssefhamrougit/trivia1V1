// ============================================================================
//  supabase.hpp — a thin C++ wrapper around Supabase's REST API.
//
//  Supabase stays as our database + auth provider; this class is how the
//  C++ backend talks to it (over HTTPS). Every call forwards the logged-in
//  user's JWT, so Supabase's row-level security still protects everything.
// ============================================================================
#pragma once

#include "json.hpp"
#include "http.hpp"

#include <string>
#include <map>

namespace sb {

class Client {
public:
  std::string url;     // e.g. "https://abc123.supabase.co"
  std::string anonKey; // the public anon key

  Client() = default;
  Client(const std::string& u, const std::string& k) : url(u), anonKey(k) {}

  bool configured() const {
    if (url.find("PASTE") != std::string::npos) return false;
    if (anonKey.find("PASTE") != std::string::npos) return false;
    return url.size() > 12 && anonKey.size() > 20;
  }

  std::string host() const {
    std::string h = url;
    if (h.rfind("https://", 0) == 0) h = h.substr(8);
    else if (h.rfind("http://", 0) == 0) h = h.substr(7);
    size_t sl = h.find('/');
    if (sl != std::string::npos) h = h.substr(0, sl);
    while (!h.empty() && h.back() == '/') h.pop_back();
    return h;
  }

  // one REST call: anon key header + optional user JWT (Authorization)
  http::HttpsResult call(const std::string& method, const std::string& path,
                         const std::string& body,
                         const std::string& token = "") const {
    std::map<std::string, std::string> hdrs;
    hdrs["apikey"] = anonKey;
    hdrs["Content-Type"] = "application/json";
    if (!token.empty()) hdrs["Authorization"] = "Bearer " + token;
    return http::HttpsClient::request(host(), "443", method, path, hdrs, body);
  }

  // ---- auth (GoTrue) ----
  http::HttpsResult authSignup(const std::string& email, const std::string& password) const {
    return call("POST", "/auth/v1/signup",
                "{\"email\":" + jx::esc(email) + ",\"password\":" + jx::esc(password) + "}");
  }
  http::HttpsResult authLogin(const std::string& email, const std::string& password) const {
    return call("POST", "/auth/v1/token?grant_type=password",
                "{\"email\":" + jx::esc(email) + ",\"password\":" + jx::esc(password) + "}");
  }
  http::HttpsResult authGuest() const {
    return call("POST", "/auth/v1/signup", "{}");
  }
  http::HttpsResult authUser(const std::string& token) const {
    return call("GET", "/auth/v1/user", "", token);
  }
  http::HttpsResult authSignOut(const std::string& token) const {
    return call("POST", "/auth/v1/logout", "", token);
  }

  // ---- tables (PostgREST) ----
  http::HttpsResult select(const std::string& table, const std::string& qs,
                           const std::string& token) const {
    return call("GET", "/rest/v1/" + table + "?" + qs, "", token);
  }
  http::HttpsResult insert(const std::string& table, const std::string& json,
                           const std::string& token, const std::string& qs = "") const {
    return call("POST", "/rest/v1/" + table + (qs.empty() ? "" : "?" + qs), json, token);
  }
  http::HttpsResult remove(const std::string& table, const std::string& qs,
                           const std::string& token) const {
    return call("DELETE", "/rest/v1/" + table + "?" + qs, "", token);
  }

  // ---- functions (PostgREST RPC) ----
  http::HttpsResult rpc(const std::string& fn, const std::string& jsonArgs,
                        const std::string& token) const {
    return call("POST", "/rest/v1/rpc/" + fn, jsonArgs, token);
  }
};

} // namespace sb
