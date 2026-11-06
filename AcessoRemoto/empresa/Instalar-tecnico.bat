@echo off
echo.
echo Prepara o RustDesk deste computador da empresa
echo para entrar nos computadores dos clientes.
echo O servidor e a chave saem do arquivo servidor.conf.
echo.
pause
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-tecnico.ps1"
echo.
pause
