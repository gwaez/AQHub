@echo off
cd /d "%~dp0"
title AQAAR Board Watchdog
echo Starting AQAAR board watchdog on http://127.0.0.1:8766 ...
echo Browser will NOT open automatically.
echo Control home: http://127.0.0.1:8766/
echo Task board:   http://127.0.0.1:8766/board.html
echo Optional: Start-Board.ps1 -OpenBrowser  (homepage only)
start "AQAAR-Watchdog" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Watch-Board.ps1"
timeout /t 4 /nobreak >nul
echo Watchdog is running. Server stays alive without opening the board.
exit /b 0
