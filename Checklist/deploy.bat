@echo off
echo ============================================
echo   Checklist Seven - Deploy de Producao
echo ============================================
echo.

REM Verifica se Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
    pause
    exit /b 1
)

REM Verifica se PM2 esta instalado globalmente
where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Instalando PM2 globalmente...
    call npm install -g pm2
    call npm install -g pm2-windows-startup
)

echo [1/3] Verificando configuracao...
cd /d "%~dp0backend"
if not exist ".env" (
    echo.
    echo [AVISO] Arquivo .env nao encontrado. Criando a partir do exemplo...
    copy ".env.example" ".env" >nul
    echo.
    echo ============================================
    echo   IMPORTANTE: Configure o arquivo .env
    echo   Caminho: %~dp0backend\.env
    echo.
    echo   Ajuste a linha FB_DATABASE para o
    echo   caminho correto do banco .fdb
    echo ============================================
    echo.
    pause
)

echo [2/3] Instalando dependencias do backend...
call npm install --omit=dev
if %errorlevel% neq 0 ( echo [ERRO] Falha ao instalar dependencias && pause && exit /b 1 )

echo [3/3] Iniciando servidor com PM2...
call pm2 delete checklist-seven >nul 2>nul
call pm2 start ecosystem.config.js
call pm2 save

echo.
echo ============================================
echo   Deploy concluido!
echo   Acesse: http://localhost:3000
echo   Ou pelo IP do servidor na porta 3000
echo ============================================
pause
