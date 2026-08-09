@echo off
setlocal
REM ============================================================================
REM  build-apk.bat — one-click TriviaDuel Android build
REM
REM  Packages the web app (index.html, js/, assets/, manifest, sw) into a real
REM  Android project with Capacitor and compiles apk/triviaduel.apk.
REM
REM  Requirements on THIS machine (your own PC, not the repo):
REM    - Node.js + npm          https://nodejs.org  (v18+)
REM    - Java JDK 17+           https://adoptium.net
REM    - Android Studio (SDK)   https://developer.android.com/studio
REM      (set ANDROID_HOME or let Android Studio install the SDK)
REM
REM  No Android Studio? Skip the gradle step and use the ~2-minute PWABuilder
REM  route instead: https://www.pwabuilder.com  ->  enter the deployed URL
REM  ->  Android -> Generate package -> drop app-release-signed.apk into apk/.
REM ============================================================================

cd /d "%~dp0.."
set "ROOT=%CD%"

echo.
echo  === TriviaDuel Android build ===
echo.

REM ---- 0) prerequisites -----------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js not found. Install it from https://nodejs.org then re-run.
  exit /b 1
)
where java >nul 2>nul
if errorlevel 1 (
  echo  [WARN] Java not found. The Gradle build will fail.
  echo         Install a JDK 17+ from https://adoptium.net (or Android Studio).
  set "JAVA_MISSING=1"
)
if "%ANDROID_HOME%"=="" if "%ANDROID_SDK_ROOT%"=="" (
  echo  [WARN] ANDROID_HOME not set. The Gradle build needs the Android SDK.
  echo         Install Android Studio and open it once, then re-run.
  set "SDK_MISSING=1"
)

REM ---- 1) dist/ = just the web files (no backend/, apk/, tools/, android/) --
echo  [1/6] Preparing dist/ ...
if exist dist rmdir /s /q dist
mkdir dist
copy /y index.html style.css manifest.json sw.js dist\ >nul
xcopy /e /i /q js dist\js >nul
xcopy /e /i /q assets dist\assets >nul

REM ---- 2) Capacitor dependencies -------------------------------------------
echo  [2/6] Installing Capacitor (first run downloads packages - be patient) ...
call npm i -D @capacitor/cli
if errorlevel 1 goto :deps_fail
call npm i @capacitor/core @capacitor/android
if errorlevel 1 goto :deps_fail

REM ---- 3) init + add the android platform -----------------------------------
REM    (Capacitor 5 writes capacitor.config.json; Capacitor 6+ writes .ts —
REM     only run cap init when neither exists, or it fails "already initialized")
echo  [3/6] Initialising the Capacitor project ...
if not exist capacitor.config.json if not exist capacitor.config.ts (
  call npx cap init TriviaDuel io.triviaduel.app --web-dir=dist
)
if not exist android (
  call npx cap add android
)

REM ---- 4) sync the web app into the android project -------------------------
echo  [4/6] Syncing web files into the Android project ...
call npx cap sync android

REM ---- 5) gradle build -------------------------------------------------------
echo  [5/6] Building the APK (first build downloads Gradle - can take a while) ...
if defined JAVA_MISSING goto :build_skip
if defined SDK_MISSING goto :build_skip
cd android
call gradlew.bat assembleDebug
if errorlevel 1 goto :gradle_fail
cd "%ROOT%"

REM ---- 6) copy the APK into place -------------------------------------------
if exist android\app\build\outputs\apk\debug\app-debug.apk (
  copy /y android\app\build\outputs\apk\debug\app-debug.apk apk\triviaduel.apk >nul
  echo.
  echo  [6/6] Done!  apk\triviaduel.apk  is ready.
  echo         The download page will now show the Download button.
  echo         (Bump the version field in apk/version.json if you want.)
  echo         Tip: this debug APK is signed with Android's debug key - fine
  echo         for sideloading. For the Play Store, build a signed release.
  exit /b 0
)

echo.
echo  [WARN] The build finished but the APK wasn't found where expected.
echo         Check android\app\build\outputs\apk\ for the file and copy it to apk\triviaduel.apk.
exit /b 1

:deps_fail
echo.
echo  [ERROR] npm install failed. Check your internet connection and npm access.
exit /b 1

:build_skip
echo.
echo  [SKIP] Java/Android SDK missing, so the Gradle step was skipped.
echo         The Capacitor android/ project is ready though - install Android
echo         Studio, open the android/ folder, and press Run, OR use the
echo         PWABuilder route (~2 min, no installs): https://www.pwabuilder.com
exit /b 1

:gradle_fail
echo.
echo  [ERROR] The Gradle build failed. Common fixes:
echo          - Install / open Android Studio once (installs the SDK).
echo          - Set ANDROID_HOME (e.g. C:\Users\you\AppData\Local\Android\Sdk).
echo          - Accept SDK licenses:  sdkmanager --licenses
echo          - Or skip all of this and use PWABuilder: https://www.pwabuilder.com
exit /b 1
