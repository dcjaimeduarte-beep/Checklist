@echo off
echo.
echo Informe o IP ou o dominio do servidor uma vez.
echo Depois copie esta pasta para cada computador.
echo.
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell.exe"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0definir-servidor.ps1"
echo.
pause
