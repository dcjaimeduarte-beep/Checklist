#!/bin/sh
# Para os contêineres sem apagar a pasta data.
set -eu
cd "$(dirname "$0")/.."
docker compose stop
echo "Servidor parado. A pasta data continua no disco."
