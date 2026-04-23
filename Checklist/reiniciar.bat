@echo off
echo ============================================
echo   Checklist Seven v2 - Reiniciar Servico
echo ============================================
echo.

cd /d "%~dp0backend"

echo [1/3] Parando processo anterior (se existir)...
pm2 delete checklist-seven >nul 2>nul

echo [2/3] Iniciando servidor...
pm2 start ecosystem.config.js

echo [3/3] Salvando configuracao PM2...
pm2 save

echo.
echo ============================================
echo   Pronto! Acesse: http://localhost:3000
echo ============================================
echo.
pm2 status
pause
