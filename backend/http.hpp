// ============================================================================
//  http.hpp — a tiny HTTP server (WinSock) + a tiny HTTPS client (OpenSSL).
//  No frameworks. Windows only. This is the "web layer" of the C++ backend.
// ============================================================================
#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>

#include <openssl/ssl.h>
#include <openssl/err.h>

#include <algorithm>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <functional>
#include <iostream>
#include <iterator>
#include <map>
#include <memory>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace http {

// ---------------------------------------------------------------------------
//  small helpers
// ---------------------------------------------------------------------------
inline std::string toLower(std::string s) {
  std::transform(s.begin(), s.end(), s.begin(),
                 [](unsigned char c) { return (char)std::tolower(c); });
  return s;
}

inline void winsockInit() {
  static bool done = false;
  if (done) return;
  WSADATA wsa;
  WSAStartup(MAKEWORD(2, 2), &wsa);
  done = true;
}

inline std::string urlDecode(const std::string& in) {
  auto hex = [](char c) -> int {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return 0;
  };
  std::string out;
  for (size_t i = 0; i < in.size(); i++) {
    if (in[i] == '%' && i + 2 < in.size()) {
      out += (char)(hex(in[i + 1]) * 16 + hex(in[i + 2]));
      i += 2;
    } else if (in[i] == '+') out += ' ';
    else out += in[i];
  }
  return out;
}

inline std::map<std::string, std::string> parseQuery(const std::string& q) {
  std::map<std::string, std::string> out;
  size_t start = 0;
  while (start <= q.size()) {
    size_t amp = q.find('&', start);
    if (amp == std::string::npos) amp = q.size();
    std::string pair = q.substr(start, amp - start);
    size_t eq = pair.find('=');
    if (eq != std::string::npos) out[urlDecode(pair.substr(0, eq))] = urlDecode(pair.substr(eq + 1));
    else if (!pair.empty()) out[urlDecode(pair)] = "";
    start = amp + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
//  request / response
// ---------------------------------------------------------------------------
struct Request {
  std::string method, target, path, query, body;
  std::map<std::string, std::string> headers; // lower-cased keys
  std::map<std::string, std::string> params;  // parsed query params

  std::string bearer() const {
    auto it = headers.find("authorization");
    if (it == headers.end()) return "";
    const std::string& v = it->second;
    if (v.rfind("Bearer ", 0) == 0) return v.substr(7);
    return v;
  }
};

struct Response {
  int status = 200;
  std::string ctype = "application/json; charset=utf-8";
  std::string body;
  std::map<std::string, std::string> headers;

  static Response json(int status, const std::string& body) {
    Response r;
    r.status = status;
    r.body = body;
    return r;
  }
  static Response text(int status, const std::string& body) {
    Response r;
    r.status = status;
    r.ctype = "text/plain; charset=utf-8";
    r.body = body;
    return r;
  }
  static Response error(int status, const std::string& msg) {
    return json(status, "{\"error\":\"" + msg + "\",\"message\":\"" + msg + "\"}");
  }
};

// ---------------------------------------------------------------------------
//  the HTTP server
// ---------------------------------------------------------------------------
struct Server {
  using Handler = std::function<Response(const Request&)>;
  std::map<std::string, Handler> routes;   // key: "POST /api/thing"
  std::function<void(SOCKET, const Request&)> onStream; // takes over a socket (SSE)

  int port = 3000;
  std::string staticRoot; // folder containing index.html

  bool run() {
    winsockInit();
    SOCKET srv = socket(AF_INET, SOCK_STREAM, 0);
    if (srv == INVALID_SOCKET) {
      std::cerr << "[http] socket() failed\n";
      return false;
    }
    int on = 1;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, (const char*)&on, sizeof on);
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons((u_short)port);
    if (bind(srv, (sockaddr*)&addr, sizeof addr) == SOCKET_ERROR) {
      std::cerr << "[http] bind failed on port " << port
                << " (is another server already running?)\n";
      closesocket(srv);
      return false;
    }
    if (listen(srv, 64) == SOCKET_ERROR) {
      std::cerr << "[http] listen failed\n";
      closesocket(srv);
      return false;
    }
    std::cout << "[http] C++ backend listening on http://localhost:" << port << "\n";
    while (true) {
      SOCKET c = accept(srv, nullptr, nullptr);
      if (c == INVALID_SOCKET) continue;
      std::thread([this, c]() { handleClient(c); }).detach();
    }
  }

  // reads a full HTTP request off the socket
  Request readRequest(SOCKET c) {
    // Windows SO_RCVTIMEO takes a DWORD in MILLISECONDS — a `timeval`
    // would be read as its first 4 bytes (10 ms instead of 10 s) and
    // slow clients/threads would get their sockets reset.
    DWORD timeoutMs = 10000;
    setsockopt(c, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeoutMs, sizeof timeoutMs);

    std::string req;
    char buf[16384];
    bool gotHeader = false;
    size_t hEnd = 0;
    long contentLen = -1;

    while (true) {
      int n = recv(c, buf, sizeof buf, 0);
      if (n <= 0) break;
      req.append(buf, n);
      if (!gotHeader) {
        hEnd = req.find("\r\n\r\n");
        if (hEnd != std::string::npos) {
          gotHeader = true;
          std::string head = toLower(req.substr(0, hEnd));
          size_t clp = head.find("content-length:");
          if (clp != std::string::npos) {
            size_t eol = head.find('\n', clp);
            std::string val = head.substr(clp + 15, eol - clp - 15);
            while (!val.empty() && (val.back() == '\r' || val.back() == ' ' || val.back() == '\t')) val.pop_back();
            contentLen = atol(val.c_str());
          }
        }
      }
      if (gotHeader && (contentLen < 0 || (long)(req.size() - (hEnd + 4)) >= contentLen)) break;
    }

    Request r;
    size_t hEnd2 = req.find("\r\n\r\n");
    if (hEnd2 == std::string::npos) return r;
    std::string head = req.substr(0, hEnd2);
    r.body = req.substr(hEnd2 + 4);

    size_t e1 = head.find(' ');
    size_t e2 = head.find(' ', e1 + 1);
    if (e1 == std::string::npos || e2 == std::string::npos) return r;
    r.method = head.substr(0, e1);
    r.target = head.substr(e1 + 1, e2 - e1 - 1);

    size_t q = r.target.find('?');
    if (q != std::string::npos) {
      r.path = r.target.substr(0, q);
      r.query = r.target.substr(q + 1);
    } else r.path = r.target;
    r.params = parseQuery(r.query);

    std::istringstream hs(head.substr(e2 + 1));
    std::string line;
    while (std::getline(hs, line)) {
      if (!line.empty() && line.back() == '\r') line.pop_back();
      size_t cpos = line.find(':');
      if (cpos != std::string::npos) {
        std::string k = toLower(line.substr(0, cpos));
        std::string v = line.substr(cpos + 1);
        size_t a = v.find_first_not_of(" \t");
        size_t b = v.find_last_not_of(" \t");
        if (a != std::string::npos && b != std::string::npos && b >= a) v = v.substr(a, b - a + 1);
        r.headers[k] = v;
      }
    }
    return r;
  }

  void handleClient(SOCKET c) {
    Request r = readRequest(c);
    if (r.method.empty()) {
      closesocket(c);
      return;
    }
    // SSE routes hand the socket over (connection stays open)
    if (onStream && r.path == "/api/stream") {
      onStream(c, r);
      return;
    }
    Response res = handle(r);
    sendResponse(c, res);
    closesocket(c);
  }

  Response handle(const Request& r) {
    std::string key = r.method + " " + r.path;
    auto it = routes.find(key);
    if (it != routes.end()) return it->second(r);

    // prefix routes: registered as "GET /api/trivia/match/" -> capture the id
    for (const auto& kv : routes) {
      size_t sp = kv.first.find(' ');
      if (sp == std::string::npos) continue;
      std::string m = kv.first.substr(0, sp);
      std::string p = kv.first.substr(sp + 1);
      if (m != r.method) continue;
      if (!p.empty() && p.back() == '/' && r.path.rfind(p, 0) == 0) {
        Request r2 = r;
        r2.params["id"] = r.path.substr(p.size());
        return kv.second(r2);
      }
    }

    if (!staticRoot.empty()) return serveFile(r);
    return Response::text(404, "{\"error\":\"Not found\"}");
  }

  void sendResponse(SOCKET c, const Response& res) {
    std::string head = "HTTP/1.1 " + std::to_string(res.status) + " " + reason(res.status) + "\r\n";
    head += "Content-Type: " + res.ctype + "\r\n";
    head += "Content-Length: " + std::to_string(res.body.size()) + "\r\n";
    head += "Cache-Control: no-store\r\n";
    head += "Access-Control-Allow-Origin: *\r\n";
    for (const auto& kv : res.headers) head += kv.first + ": " + kv.second + "\r\n";
    head += "Connection: close\r\n\r\n";
    sendAll(c, head);
    if (!res.body.empty()) sendAll(c, res.body);
  }

  void sendAll(SOCKET c, const std::string& data) {
    size_t off = 0;
    while (off < data.size()) {
      int n = send(c, data.c_str() + off, (int)(data.size() - off), 0);
      if (n <= 0) break;
      off += (size_t)n;
    }
  }

  Response serveFile(const Request& r) {
    std::string p = r.path;
    if (p == "/" || p.empty()) p = "/index.html";
    if (p.find("..") != std::string::npos) return Response::text(403, "forbidden");
    std::string full = staticRoot + p;
    std::ifstream f(full, std::ios::binary);
    if (!f) return Response::text(404, "not found: " + p);
    std::string body((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
    Response res;
    res.status = 200;
    res.ctype = mime(p);
    res.body = body;
    return res;
  }

  std::string mime(const std::string& p) {
    // paths without a dot (e.g. "/api/unknown" or "/favicon") must NOT
    // crash the server: find_last_of returns npos and substr(npos) throws,
    // and an uncaught exception in a worker thread kills the whole process.
    size_t dot = p.find_last_of('.');
    if (dot == std::string::npos) return "application/octet-stream";
    std::string ext = toLower(p.substr(dot));
    if (ext == ".html") return "text/html; charset=utf-8";
    if (ext == ".css") return "text/css";
    if (ext == ".js") return "text/javascript";
    if (ext == ".json") return "application/json";
    if (ext == ".svg") return "image/svg+xml";
    if (ext == ".png") return "image/png";
    if (ext == ".ico") return "image/x-icon";
    if (ext == ".webmanifest") return "application/manifest+json";
    return "application/octet-stream";
  }

  std::string reason(int status) {
    switch (status) {
      case 200: return "OK";
      case 201: return "Created";
      case 204: return "No Content";
      case 400: return "Bad Request";
      case 401: return "Unauthorized";
      case 403: return "Forbidden";
      case 404: return "Not Found";
      case 405: return "Method Not Allowed";
      case 500: return "Internal Server Error";
      case 502: return "Bad Gateway";
      default: return "OK";
    }
  }
};

// ---------------------------------------------------------------------------
//  HTTPS client (OpenSSL) — used to talk to Supabase over port 443
// ---------------------------------------------------------------------------
struct HttpsResult {
  int status = 0;
  std::string body;
};

class HttpsClient {
public:
  // Performs one HTTPS request and returns status + body.
  static HttpsResult request(const std::string& host, const std::string& port,
                             const std::string& method, const std::string& path,
                             const std::map<std::string, std::string>& headers,
                             const std::string& body) {
    winsockInit();
    HttpsResult out;

    // 1) DNS + TCP connect
    addrinfo hints{};
    hints.ai_family = AF_INET;
    hints.ai_socktype = SOCK_STREAM;
    addrinfo* res = nullptr;
    if (getaddrinfo(host.c_str(), port.c_str(), &hints, &res) != 0 || !res) return out;
    SOCKET s = INVALID_SOCKET;
    for (addrinfo* p = res; p; p = p->ai_next) {
      s = socket(p->ai_family, p->ai_socktype, p->ai_protocol);
      if (s == INVALID_SOCKET) continue;
      if (connect(s, p->ai_addr, (int)p->ai_addrlen) == 0) break;
      closesocket(s);
      s = INVALID_SOCKET;
    }
    freeaddrinfo(res);
    if (s == INVALID_SOCKET) return out;

    // 2) TLS handshake
    static bool sslReady = []() {
      OPENSSL_init_ssl(0, nullptr);
      OPENSSL_init_crypto(0, nullptr);
      return true;
    }();
    (void)sslReady;

    SSL_CTX* ctx = SSL_CTX_new(TLS_client_method());
    if (!ctx) { closesocket(s); return out; }
    // demo app: don't verify the Supabase certificate (no CA bundle on Windows)
    SSL_CTX_set_verify(ctx, SSL_VERIFY_NONE, nullptr);
    SSL* ssl = SSL_new(ctx);
    SSL_set_fd(ssl, (int)s);
    // SNI is REQUIRED by Cloudflare-fronted hosts (like Supabase) — without
    // it the server answers "ssl/tls alert handshake failure".
    SSL_set_tlsext_host_name(ssl, host.c_str());
    if (SSL_connect(ssl) != 1) {
      SSL_free(ssl);
      SSL_CTX_free(ctx);
      closesocket(s);
      return out;
    }

    // 3) send the request
    std::string req = method + " " + path + " HTTP/1.1\r\n";
    req += "Host: " + host + "\r\n";
    req += "User-Agent: Trivia1v1-CPP/1.0\r\n";
    req += "Connection: close\r\n";
    for (const auto& kv : headers) req += kv.first + ": " + kv.second + "\r\n";
    if (!body.empty()) req += "Content-Length: " + std::to_string(body.size()) + "\r\n";
    req += "\r\n" + body;

    size_t off = 0;
    while (off < req.size()) {
      int w = SSL_write(ssl, req.c_str() + off, (int)(req.size() - off));
      if (w <= 0) break;
      off += (size_t)w;
    }

    // 4) read the response
    std::string resp;
    char buf[16384];
    int n;
    while ((n = SSL_read(ssl, buf, sizeof buf)) > 0) resp.append(buf, n);

    SSL_free(ssl);
    SSL_CTX_free(ctx);
    closesocket(s);

    if (resp.empty()) return out;

    // 5) parse status line + body
    size_t hEnd = resp.find("\r\n\r\n");
    std::string head = hEnd == std::string::npos ? resp : resp.substr(0, hEnd);
    std::string respBody = hEnd == std::string::npos ? "" : resp.substr(hEnd + 4);

    size_t sp1 = head.find(' ');
    if (sp1 != std::string::npos) {
      size_t sp2 = head.find(' ', sp1 + 1);
      out.status = atoi(head.substr(sp1 + 1, sp2 - sp1 - 1).c_str());
    }

    if (toLower(head).find("transfer-encoding: chunked") != std::string::npos) {
      std::string decoded;
      size_t i = 0;
      while (i < respBody.size()) {
        size_t eol = respBody.find("\r\n", i);
        if (eol == std::string::npos) break;
        int sz = (int)strtol(respBody.substr(i, eol - i).c_str(), nullptr, 16);
        if (sz <= 0) break;
        decoded.append(respBody, eol + 2, (size_t)sz);
        i = eol + 2 + (size_t)sz + 2;
      }
      respBody = decoded;
    }
    out.body = respBody;
    return out;
  }
};

} // namespace http
