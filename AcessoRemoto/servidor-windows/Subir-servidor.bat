@echo off
cd /d "%~dp0"
echo.
echo Este Windows fica ligado. Ele e o servidor do acesso remoto.
echo O cliente e o tecnico continuam Windows e apontam para este computador.
echo.
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell.exe"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0subir-servidor.ps1"
echo.
pause
