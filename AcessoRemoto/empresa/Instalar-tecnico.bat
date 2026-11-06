@echo off
echo.
echo Instala o RustDesk neste computador da empresa
echo para entrar nos computadores dos clientes.
echo Depois, digite o ID e a senha que o cliente enviou.
echo.
pause
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell.exe"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-tecnico.ps1"
echo.
pause
