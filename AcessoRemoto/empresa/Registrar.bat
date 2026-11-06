@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0registrar.ps1" %*
echo.
pause
