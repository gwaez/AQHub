@echo off
cd /d "%~dp0"
title AQAAR Board Watchdog
echo Starting AQAAR board watchdog on http://127.0.0.1:8766 ...
start "AQAAR-Watchdog" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Watch-Board.ps1"
timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:8766/board.html"
echo Board should be open. Watchdog keeps it alive.
exit /b 0
