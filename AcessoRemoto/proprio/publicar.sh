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
Programa proprio de acesso remoto. Nao usa RustDesk, TeamViewer nem AnyDesk.
Os dois computadores sao Windows. Um deles fica ligado com o servidor.

1. No Windows que fica ligado, abra a pasta 01-servidor.
   Clique com o botao direito em Liberar-porta.bat e escolha Executar como administrador.
   Dê dois cliques em AcessoRemoto.exe e deixe a janela aberta.
   Ela grava o IP nas pastas 02-tecnico e 03-cliente.

2. Copie a pasta 03-cliente para o computador do cliente.
   Dê dois cliques em AcessoRemoto.exe.
   A janela mostra o ID e a senha. O mesmo texto fica na Area de Trabalho,
   no arquivo Acesso-remoto-desta-maquina.txt. Envie esse arquivo para o tecnico.

3. No computador do tecnico, abra a pasta 02-tecnico.
   Dê dois cliques em AcessoRemoto.exe.
   Digite o ID e a senha e clique em Conectar.

O computador do servidor precisa ficar ligado. O do cliente tambem, com a janela do programa aberta.
Se o cliente estiver em outra rede, encaminhe a porta 47200/tcp do roteador para o Windows do servidor
e troque a linha IP dos dois arquivos servidor.conf pelo IP publico.
EOF
echo "publicado em $destino"
ls -lh "$destino"/01-servidor/AcessoRemoto.exe
