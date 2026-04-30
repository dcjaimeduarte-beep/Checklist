@echo off
chcp 65001 > nul
title Checklist Seven - Reiniciar
echo Reiniciando Checklist Seven...
pm2 restart checklist-seven
pm2 status
echo.
pause

