@echo off
echo.
echo Informe o IP ou o dominio do servidor uma vez.
echo Depois copie esta pasta para cada computador.
echo.
if not exist "%~dp0servidor.conf" (
  >"%~dp0servidor.conf" echo EMPRESA=Empresa de informatica
  >>"%~dp0servidor.conf" echo ID_SERVER=DEFINIR
  >>"%~dp0servidor.conf" echo KEY=COLE_A_CHAVE_PUBLICA
)
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell.exe"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0definir-servidor.ps1"
echo.
pause
