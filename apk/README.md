# 📦 TriviaDuel APK

The download page (`download.html`) looks for **`apk/triviaduel.apk`**. Drop the generated
file here and the page's Download button turns on automatically (it checks on load and
shows the real file size + version from [`version.json`](version.json)).

TriviaDuel is a **PWA** — a web app with a manifest + service worker — so the APK is just
a thin Android wrapper that opens the app full-screen, offline-capable, with an icon in
your app drawer. There's no native codebase; the game logic stays on the web + Supabase.

---

## ⚡ Fastest: PWABuilder (no installs, ~2 minutes)

1. Make sure the app is deployed and reachable, e.g. **https://triviaduel-xi.vercel.app**
2. Go to [**pwabuilder.com**](https://www.pwabuilder.com) and enter the app URL.
3. Click **Android** → **Generate package** → download the ZIP.
4. Extract the release APK (the file inside is named something like `app-release-signed.apk`) and copy it here:
   ```
   apk/triviaduel.apk
   ```
5. (Optional) bump the `version` field in [`version.json`](version.json), then push.

> PWABuilder's free packages are signed with its own key. If you plan to release widely,
> see "Signing" below — and consider the Play Store for updates.

## 🚀 One-click local build (`tools/build-apk.bat`)

On a **Windows** machine with Node.js (+ Android Studio for the final Gradle
step), double-click `tools/build-apk.bat` — it prepares `dist/`, installs
Capacitor, creates the Android project, syncs the web app, runs the Gradle
build and drops `apk/triviaduel.apk` in place automatically. It prints clear
help if a prerequisite (Java, Android SDK) is missing, and the files it
generates (`android/`, `dist/`, `capacitor.config.*`) are gitignored.

## 🔧 Local: Capacitor (full control, needs Android Studio)

```bash
# from the project root
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android

npx cap init TriviaDuel io.triviaduel.app --web-dir=.
npx cap add android
npx cap sync android
npx cap open android        # builds the APK in Android Studio
```

> ⚠ `--web-dir=.` copies the **whole repo** into the app's assets (backend/, content/,
> apk/, README…). That's harmless for a personal build. For a cleaner package, copy
> just the web files into a `dist/` folder (index.html, style.css, js/, assets/,
> manifest.json, sw.js) and use `--web-dir=dist` instead.

The generated APK will be at:

```
android/app/build/outputs/apk/debug/app-debug.apk     # debug build
android/app/build/outputs/apk/release/app-release.apk # signed release
```

Copy it to `apk/triviaduel.apk` and update `version.json`.

## ✍️ Signing (recommended for wide distribution)

Android requires APKs to be signed. Options:

- **PWABuilder** — free packages come signed with PWABuilder's key (fine for sideloading).
- **Android Studio** — generate a keystore via *Build → Generate Signed Bundle/APK*, keep the
  keystore safe (you'll need it for every update).

## 🧩 Icons

The logo is the **VS duel shield** (`assets/icon.svg` — orange tile, dark
shield, facing chevrons + bolt). Android launcher icons must be **PNG**, so
generate them in one click: open `tools/export-icons.html` in any browser
and hit **Download all 3 PNGs** — it renders `icon-192.png`,
`icon-512.png` and `icon-maskable-512.png` (full-bleed + safe zone) at the
exact sizes. Drop them into `assets/` (they're already referenced in
`manifest.json`, which keeps the SVG for in-app use). PWABuilder rasterises
the SVG automatically too, but the PNGs give you full control.

## 🔒 Checksum

If you want to publish a checksum for users to verify against, generate it after placing
the file and add it to `version.json`:

```bash
sha256sum apk/triviaduel.apk    # Linux / Git Bash
certutil -hashfile apk\triviaduel.apk SHA256   # Windows cmd
```
