#!/bin/sh
# Sobe o hbbs e o hbbr e mostra a chave pública para colar no RustDesk.
set -eu
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Instale o Docker neste Linux e rode de novo."
  exit 1
fi

docker compose up -d

echo
echo "Servidor no ar. Chave pública (campo Key do RustDesk):"
if [ -f data/id_ed25519.pub ]; then
  cat data/id_ed25519.pub
else
  echo "A chave ainda não apareceu. Veja os logs: docker compose logs hbbs"
fi
echo
echo "A chave privada fica em data/id_ed25519 e não sai deste servidor."
echo "Faça o backup agora: ./scripts/backup-data.sh"
echo "Depois monte os pacotes: ./scripts/preparar-cliente.sh IP_OU_DOMINIO \"Nome da empresa\""
