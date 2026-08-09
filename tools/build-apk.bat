@echo off
setlocal
REM ============================================================================
REM  tools/build-apk.bat — LAUNCHER for the Trivia1v1 APK builder.
REM
REM  The actual build tooling lives OUTSIDE this repo on purpose (it is not
REM  committed to GitHub — the repo only keeps the built apk/trivia1v1.apk).
REM  This tiny launcher finds the external script and runs it.
REM
REM  External tools are expected at:
REM      %USERPROFILE%\Documents\GitHub\triviaduel-tools\build-apk.ps1
REM  (see triviaduel-tools\README.txt there for how it works — the default
REM   route uses the PWABuilder cloud API: nothing to install, ~2-4 minutes).
REM ============================================================================

set "TOOLS=%USERPROFILE%\Documents\GitHub\triviaduel-tools"
if not exist "%TOOLS%\build-apk.ps1" (
  if exist "%~dp0..\..\triviaduel-tools\build-apk.ps1" set "TOOLS=%~dp0..\..\triviaduel-tools"
)
if not exist "%TOOLS%\build-apk.ps1" (
  echo.
  echo  [ERROR] Could not find the APK builder (build-apk.ps1) in "%TOOLS%".
  echo          The build tools live outside the repo - get the triviaduel-tools
  echo          folder (next to your local clone), or build manually instead:
  echo          https://www.pwabuilder.com  -^> enter the app URL  -^> Android
  echo          -^> Generate package  -^> drop the signed .apk into apk/.
  pause
  exit /b 1
)

powershell -ExecutionPolicy Bypass -File "%TOOLS%\build-apk.ps1" -RepoPath "%~dp0.."
pause
