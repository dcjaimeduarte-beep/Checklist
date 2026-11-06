@echo off
echo.
echo Acesso remoto para suporte de informatica.
echo.
echo Ao continuar, o RustDesk sera instalado neste computador
echo ja apontando para o servidor da empresa.
echo O icone fica visivel perto do relogio.
echo No final, um arquivo na Area de Trabalho mostra o ID e a senha.
echo Envie esse arquivo para a empresa e guarde a senha no cofre.
echo.
echo So continue se voce autoriza esse acesso.
echo.
pause
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-cliente.ps1" -Confirmado
echo.
pause
