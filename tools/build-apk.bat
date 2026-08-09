@echo off
title Trivia1v1 - APK builder
setlocal
cd /d "%~dp0.."
echo.
echo  ======================================================
echo    Trivia1v1 APK builder  -  keep this window open
echo  ======================================================
echo.

REM ---- step 1/3: fix wrongly-named icons (old exporter bug) ----
echo  [1/3] Checking icons in assets/ ...
if exist "assets\assets_icon-192.png" (
  if not exist "assets\icon-192.png" (
    ren "assets\assets_icon-192.png" "icon-192.png"
    echo     renamed  assets_icon-192.png  -^>  icon-192.png
  ) else (
    del "assets\assets_icon-192.png" >nul 2>nul
    echo     removed duplicate stray assets_icon-192.png
  )
)
if exist "assets\assets_icon-512.png" (
  if not exist "assets\icon-512.png" (
    ren "assets\assets_icon-512.png" "icon-512.png"
    echo     renamed  assets_icon-512.png  -^>  icon-512.png
  ) else (
    del "assets\assets_icon-512.png" >nul 2>nul
    echo     removed duplicate stray assets_icon-512.png
  )
)
if exist "assets\assets_icon-maskable-512.png" (
  if not exist "assets\icon-maskable-512.png" (
    ren "assets\assets_icon-maskable-512.png" "icon-maskable-512.png"
    echo     renamed  assets_icon-maskable-512.png  -^>  icon-maskable-512.png
  ) else (
    del "assets\assets_icon-maskable-512.png" >nul 2>nul
    echo     removed duplicate stray assets_icon-maskable-512.png
  )
)
echo     icon check done.
echo.

REM ---- step 2/3: tell the user what to do next ----
echo  [2/3] Icon names are now correct. They must be pushed to the live site
echo        before the APK build can use them. Run these 3 commands in the
echo        repo folder (or use GitHub Desktop / VS Code):
echo.
echo        git add -A
echo        git commit -m "add PNG launcher icons"
echo        git push
echo.
echo        Wait ~1 minute for the deploy, then double-click this file again.
echo.
choice /c YN /m "Have you already pushed the icons (or will skip the APK build now)"
if errorlevel 2 goto :manual
if errorlevel 1 goto :build

:build
REM ---- step 3/3: launch the external builder ----
set "TOOLS=%USERPROFILE%\Documents\GitHub\triviaduel-tools"
if not exist "%TOOLS%\build-apk.ps1" if exist "%~dp0..\..\triviaduel-tools\build-apk.ps1" set "TOOLS=%~dp0..\..\triviaduel-tools"
if not exist "%TOOLS%\build-apk.ps1" (
  echo  [WARN] The external builder was not found, but your icons are fixed.
  echo         Build the APK at https://www.pwabuilder.com  and save the .apk as apk\trivia1v1.apk
  goto :end
)
echo  [3/3] Launching the APK builder ...
echo        (It talks to the PWABuilder cloud - takes ~2-4 minutes.)
echo.
powershell -ExecutionPolicy Bypass -File "%TOOLS%\build-apk.ps1" -RepoPath "%CD%"
echo.
echo  The builder finished. If it printed git commands, run them to publish the APK.
goto :end

:manual
echo.
echo  OK - icons are fixed. Push them, then either:
echo    - double-click this file again (after the deploy) to build the APK, or
echo    - build it manually at https://www.pwabuilder.com
echo.

:end
echo.
pause
