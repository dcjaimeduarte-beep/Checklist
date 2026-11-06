@echo off
echo.
echo Informe o IP ou o dominio do servidor uma vez.
echo Depois copie esta pasta para cada computador.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0definir-servidor.ps1"
echo.
pause
