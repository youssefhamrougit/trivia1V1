# 📦 Trivia1v1 APK

The download page (`download.html`) looks for **`apk/trivia1v1.apk`**. Drop the generated
file here and the page's Download button turns on automatically (it checks on load and
shows the real file size + version from [`version.json`](version.json)).

Trivia1v1 is a **PWA** — a web app with a manifest + service worker — so the APK is just
a thin Android wrapper that opens the app full-screen, offline-capable, with an icon in
your app drawer. There's no native codebase; the game logic stays on the web + Supabase.

---

## ⚡ Fastest: PWABuilder (no installs, ~2 minutes)

1. Make sure the app is deployed and reachable, e.g. **https://trivia1-v1.vercel.app**
2. Go to [**pwabuilder.com**](https://www.pwabuilder.com) and enter the app URL.
3. Click **Android** → **Generate package** → download the ZIP.
4. Extract the release APK (the file inside is named something like `app-release-signed.apk`) and copy it here:
   ```
   apk/trivia1v1.apk
   ```
5. (Optional) bump the `version` field in [`version.json`](version.json), then push.

> PWABuilder's free packages are signed with its own key. If you plan to release widely,
> see "Signing" below — and consider the Play Store for updates.

## 🚀 One-click build (zero installs — recommended)

All the build tooling deliberately lives **outside the repo** — it is not part
of GitHub. It lives in the **`triviaduel-tools`** folder on the **Desktop**:
`build-apk.ps1`, `build-apk-capacitor.bat`, `export-icons.html` and a README.

- **`build-apk.ps1`** — the recommended route. It asks the **PWABuilder cloud
  API** to package the live PWA into a signed APK: **nothing to install, ~2-4
  minutes**. On its first run it also fixes/generates the PNG launcher icons
  into `assets/` (drawn from the app's SVG), downloads the signed APK into
  `apk/trivia1v1.apk`, saves your signing key in
  `triviaduel-tools/signing-keys/` (outside the repo, where it belongs) and
  bumps `version.json`.
- **`build-apk-capacitor.bat`** — the local Capacitor route (needs Node.js +
  Android Studio) for full control.

Run it with (right-click → **Run with PowerShell**, or):

```
powershell -ExecutionPolicy Bypass -File <Desktop>\triviaduel-tools\build-apk.ps1
```

It prints the exact `git add / commit / push` commands to publish the APK when
it's done.

## 🔧 Local: Capacitor (full control, needs Android Studio)

The one-click version of this route is `build-apk-capacitor.bat` in the
Desktop `triviaduel-tools` folder (see above). Manual steps, from the project
root:

```bash
# from the project root
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android

npx cap init Trivia1v1 io.trivia1v1.app --web-dir=.
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

Copy it to `apk/trivia1v1.apk` and update `version.json`.

## ✍️ Signing (recommended for wide distribution)

Android requires APKs to be signed. Options:

- **PWABuilder** — free packages come signed with PWABuilder's key (fine for sideloading).
- **Android Studio** — generate a keystore via *Build → Generate Signed Bundle/APK*, keep the
  keystore safe (you'll need it for every update).

## 🧩 Icons

The logo is the **VS duel shield** (`assets/icon.svg` — orange tile, dark
shield, facing chevrons + bolt). Android launcher icons must be **PNG**.
`build-apk.ps1` generates all three automatically on its first run (`icon-192.png`,
`icon-512.png` and `icon-maskable-512.png` — full-bleed + safe zone, drawn from
the SVG), so you only need the manual route below if you want to tweak them by
hand: open `export-icons.html` from the Desktop `triviaduel-tools` folder in any
browser and hit **Download all 3 PNGs**. Drop them into `assets/` (they're
already referenced in `manifest.json`, which keeps the SVG for in-app use).
PWABuilder rasterises the SVG automatically too, but the PNGs give you full
control.

## 🔒 Checksum

If you want to publish a checksum for users to verify against, generate it after placing
the file and add it to `version.json`:

```bash
sha256sum apk/trivia1v1.apk    # Linux / Git Bash
certutil -hashfile apk\trivia1v1.apk SHA256   # Windows cmd
```
