@echo off
cd /d "%~dp0"
title AQWizard
echo AQWizard P1 — start AQHub first (Start-Board-Background.bat) then this window.
echo Board URL: http://127.0.0.1:8766/board.html
if not exist "node_modules" (
  echo Running npm install...
  call npm install
)
call npm run tauri dev
