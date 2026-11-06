#!/bin/sh
# Copia a pasta data para backups/. Leve o arquivo para fora do servidor.
set -eu
cd "$(dirname "$0")/.."

if [ ! -d data ] || [ ! -f data/id_ed25519 ]; then
  echo "A pasta data ainda não tem a chave. Suba o servidor antes do backup."
  exit 1
fi

mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
arquivo="backups/rustdesk-data-${stamp}.tar.gz"
tar czf "$arquivo" -C data .
chmod 600 "$arquivo"

echo "Backup em ${arquivo}"
echo "Copie este arquivo para um lugar fora do servidor."
echo "Não envie por e-mail e não coloque no Git: ele contém a chave privada."
