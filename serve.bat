@echo off
title Trivia1v1 server
cd /d "%~dp0"

echo.
echo   Trivia1v1 - local server
echo   URL:  http://localhost:8080
echo   Close this window to stop the server.
echo.

REM --- 1) Python via the "py" launcher (comes with real Python installs) ---
where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server --help >nul 2>nul
  if %errorlevel%==0 goto py
)

REM --- 2) Plain "python" - but skip the fake Microsoft Store stub,
REM        which cannot actually run a server -------------------------------
where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server --help >nul 2>nul
  if %errorlevel%==0 goto py2
)

REM --- 3) Node.js -----------------------------------------------------------
where node >nul 2>nul
if %errorlevel%==0 goto node

echo   ! Could not find a working Python or Node.js on this PC.
echo.
echo   Easiest fix: install Python from https://python.org
echo   (tick "Add Python to PATH" during install), then run this file again.
echo   Or install Node.js from https://nodejs.org
echo.
echo   No install at all? Just double-click index.html instead - the app
echo   still runs, it just skips the PWA manifest.
echo.
pause
exit /b 1

:py
echo   Found Python (py launcher). Starting server...
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:8080"
py -m http.server 8080
exit /b 0

:py2
echo   Found Python. Starting server...
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:8080"
python -m http.server 8080
exit /b 0

:node
echo   Found Node.js. Starting server...
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:8080"
node server.js
exit /b 0
