@echo off
cd /d "%~dp0"
REM Prefer Start-Board-Background.bat for daily use (no leftover console).
REM Hidden watchdog. Does not auto-open the task board.
wscript.exe //nologo "%~dp0Start-Board-Background.vbs"
exit /b 0
