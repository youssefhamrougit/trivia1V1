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
//
//  Bump CACHE ("trivia-1v1-vN") whenever the pre-cache list or any cached
//  asset changes, so stale versions get purged by the activate handler.
// ============================================================================

const CACHE = "trivia-1v1-v3";

// everything the app needs to render the login/home shell offline: the page,
// styles, all JS, the manifest and every icon (SVGs are tiny).
const PRECACHE = [
  "./",
  "./index.html",
  "./download.html",
  "./404.html",
  "./style.css",
  "./manifest.json",
  "./js/config.js",
  "./js/api.js",
  "./js/sound.js",
  "./js/arenas.js",
  "./js/app.js",
  "./js/trivia.js",
  "./js/friends.js",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/icons/bolt.svg",
  "./assets/icons/flame.svg",
  "./assets/icons/gamepad.svg",
  "./assets/icons/medal-1.svg",
  "./assets/icons/medal-2.svg",
  "./assets/icons/medal-3.svg",
  "./assets/icons/repeat.svg",
  "./assets/icons/robot.svg",
  "./assets/icons/share.svg",
  "./assets/icons/skull.svg",
  "./assets/icons/tie.svg",
  "./assets/icons/trophy.svg",
  "./assets/arenas/arena-1.svg",
  "./assets/arenas/arena-2.svg",
  "./assets/arenas/arena-3.svg",
  "./assets/arenas/arena-4.svg",
  "./assets/arenas/arena-5.svg",
  "./assets/arenas/arena-6.svg",
  "./assets/arenas/arena-7.svg",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
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
  // let cross-origin requests (Google Fonts, Supabase, etc.) go straight through
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
