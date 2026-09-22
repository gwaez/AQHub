@echo off
cd /d "%~dp0"
wscript.exe //nologo "%~dp0Start-Board-Background.vbs"
start "" "http://127.0.0.1:8766/board.html"
exit /b 0
