@echo off
echo.
echo Este programa cria o ID deste computador.
echo No final, a Area de Trabalho mostra o ID e a senha.
echo Envie esse arquivo para o tecnico.
echo O Windows vai pedir permissao. Clique em Sim.
echo.
pause
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell.exe"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-cliente.ps1" -Confirmado
echo.
pause
