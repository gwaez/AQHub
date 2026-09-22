@echo off
title CRM Login - Aqaar WorkBoard
cd /d "C:\Users\AMahmoud\Documents\AqaarWorkBoard"
echo.
echo === CRM login ===
echo Browser will open. Sign in as Ahmed.Mahmoud@aqaar.com
echo.
if exist "data\token-refresh-ok.txt" del "data\token-refresh-ok.txt"
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\AMahmoud\Documents\AqaarWorkBoard\Interactive-CrmToken.ps1"
echo.
if exist "data\token-refresh-ok.txt" (
  echo SUCCESS - token saved. You can close this window.
) else (
  echo Not finished. Close and try Login-Crm-Now.bat again.
)
pause
