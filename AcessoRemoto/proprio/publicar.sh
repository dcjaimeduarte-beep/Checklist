#!/bin/sh
set -eu
cd "$(dirname "$0")"
export DOTNET_CLI_TELEMETRY_OPTOUT=1
dotnet publish App/App.csproj -c Release -r win-x64 --self-contained true \
  -p:PublishSingleFile=true \
  -p:IncludeNativeLibrariesForSelfExtract=true \
  -p:EnableCompressionInSingleFile=true \
  -p:DebugType=none \
  -p:DebugSymbols=false \
  -o /tmp/acesso-remoto-pub
destino="../pronto/acesso-remoto-proprio"
rm -rf "$destino"
mkdir -p "$destino/01-servidor" "$destino/02-tecnico" "$destino/03-cliente"
cp /tmp/acesso-remoto-pub/AcessoRemoto.exe "$destino/01-servidor/AcessoRemoto.exe"
cp /tmp/acesso-remoto-pub/AcessoRemoto.exe "$destino/02-tecnico/AcessoRemoto.exe"
cp /tmp/acesso-remoto-pub/AcessoRemoto.exe "$destino/03-cliente/AcessoRemoto.exe"
printf 'servidor\n' > "$destino/01-servidor/modo.txt"
printf 'tecnico\n' > "$destino/02-tecnico/modo.txt"
printf 'cliente\n' > "$destino/03-cliente/modo.txt"
printf 'IP=DEFINIR\nPORTA=47200\nIMPRESSAO=\n' > "$destino/02-tecnico/servidor.conf"
printf 'IP=DEFINIR\nPORTA=47200\nIMPRESSAO=\n' > "$destino/03-cliente/servidor.conf"
cat > "$destino/01-servidor/Liberar-porta.bat" <<'EOF'
@echo off
netsh advfirewall firewall delete rule name="AcessoRemoto 47200" >nul 2>&1
netsh advfirewall firewall add rule name="AcessoRemoto 47200" dir=in action=allow protocol=TCP localport=47200
echo Porta 47200 liberada neste Windows.
pause
EOF
cat > "$destino/LEIA-ME.txt" <<'EOF'
O tecnico fica na empresa. O cliente fica em outro lugar, com outra internet.
O servidor fica no computador do tecnico. O cliente so espera o acesso.

1. No computador do tecnico, pasta 01-servidor:
   Clique com o botao direito em Liberar-porta.bat e escolha Executar como administrador.
   Dê dois cliques em AcessoRemoto.exe e deixe a janela aberta.
   Ela mostra o IP da internet da empresa e grava esse IP na pasta 03-cliente.
   No roteador da empresa, encaminhe a porta 47200/tcp para este computador.

2. So depois disso, copie a pasta 03-cliente para o computador do cliente.
   La, dê dois cliques em AcessoRemoto.exe.
   A janela mostra o ID e a senha. Envie o arquivo da Area de Trabalho para o tecnico.

3. No computador do tecnico, pasta 02-tecnico, dê dois cliques em AcessoRemoto.exe.
   Digite o ID e a senha e clique em Conectar. A tela que abre e a do cliente.
EOF
echo "publicado em $destino"
ls -lh "$destino"/01-servidor/AcessoRemoto.exe
