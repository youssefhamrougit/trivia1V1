// ============================================================================
//  sw.js — the "service worker" (a background helper for the PWA)
//
//  This file makes the app installable on a phone home screen and lets it
//  open instantly even without internet.
//
//  Strategy: NETWORK-FIRST. We always try the live server first, and only
//  fall back to the cache when offline. This way every code fix shows up
//  immediately — the old cache-first version never updated, which made the
//  app look "stuck" after changes.
// ============================================================================

const CACHE = "trivia-duel-v2";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(["./index.html", "./style.css"]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
        return caches.delete(k);
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // let cross-origin requests (Google Fonts, etc.) go straight through
  if (url.origin !== location.origin) return;
  // NEVER cache API responses — they carry private per-user data
  if (url.pathname.startsWith("/api/")) return;

  // try the network first, save a copy for offline, fall back to cache
  event.respondWith(
    fetch(req)
      .then(function (res) {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, clone); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) {
          if (hit) return hit;
          if (req.mode === "navigate") return caches.match("./index.html");
          return new Response("offline", { status: 503 });
        });
      })
  );
});
