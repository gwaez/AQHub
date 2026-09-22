@echo off
cd /d "%~dp0"
REM Prefer Start-Board-Background.bat for daily use (no leftover console).
wscript.exe //nologo "%~dp0Start-Board-Background.vbs"
start "" "http://127.0.0.1:8766/board.html"
exit /b 0
