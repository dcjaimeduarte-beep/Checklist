@echo off
echo Configurando PM2 para iniciar junto com o Windows...
pm2-startup install
pm2 save
echo.
echo Pronto! O servidor iniciara automaticamente com o Windows.
pause
