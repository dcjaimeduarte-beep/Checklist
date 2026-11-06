#!/bin/sh
# Mostra as portas do RustDesk OSS. Com --aplicar, libera no ufw já ativo.
set -eu

cat <<'EOF'
Portas do servidor (sem o cliente web):
  21115/tcp
  21116/tcp
  21116/udp
  21117/tcp

Libere as mesmas portas no painel da VPS.
As portas 21118 e 21119 ficam fechadas. A 21114 é da versão paga.

No ufw, se ele já estiver ligado:
  ufw allow 21115/tcp
  ufw allow 21116/tcp
  ufw allow 21116/udp
  ufw allow 21117/tcp
EOF

if [ "${1:-}" != "--aplicar" ]; then
  echo
  echo "Para gravar essas regras no ufw que já está ligado: ./scripts/portas.sh --aplicar"
  exit 0
fi

if ! command -v ufw >/dev/null 2>&1; then
  echo "ufw não está instalado. Libere as portas no firewall que este Linux usa."
  exit 1
fi

status=$(ufw status | head -n 1)
case "$status" in
  *inactive*|*inativo*)
    echo "ufw está desligado. Este script não liga o ufw, para não fechar o SSH."
    echo "Libere a porta 22/tcp antes, se for usar ufw, e ative você mesmo."
    exit 1
    ;;
esac

ufw allow 21115/tcp
ufw allow 21116/tcp
ufw allow 21116/udp
ufw allow 21117/tcp
ufw status
