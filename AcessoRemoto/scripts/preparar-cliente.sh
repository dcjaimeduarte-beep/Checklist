#!/bin/sh
# Monta as pastas que vao para o cliente e para o tecnico, com a chave publica deste servidor.
set -eu
cd "$(dirname "$0")/.."

host="${1:-}"
empresa=$(printf '%s' "${2:-Empresa de informatica}" | tr -d '\n\r')

if [ -z "$host" ]; then
  echo "Uso: ./scripts/preparar-cliente.sh IP_OU_DOMINIO [Nome da empresa]"
  echo "Exemplo: ./scripts/preparar-cliente.sh suporte.suaempresa.com \"Minha Informatica\""
  exit 1
fi

case "$host" in
  *[!A-Za-z0-9._-]*)
    echo "Use so o IP ou o dominio, sem http:// e sem barra."
    exit 1
    ;;
esac

if [ ! -f data/id_ed25519.pub ]; then
  echo "A chave publica ainda nao existe. Rode ./scripts/subir.sh e tente de novo."
  exit 1
fi

key=$(tr -d ' \n\r' < data/id_ed25519.pub)
case "$key" in
  *BEGIN*|*PRIVATE*)
    echo "O arquivo data/id_ed25519.pub nao parece a chave publica."
    exit 1
    ;;
esac
if [ "${#key}" -lt 40 ] || [ "${#key}" -gt 128 ]; then
  echo "A chave publica tem tamanho inesperado. Confira data/id_ed25519.pub."
  exit 1
fi

escrever_conf() {
  destino="$1"
  mkdir -p "$(dirname "$destino")"
  umask 022
  printf 'EMPRESA=%s\nID_SERVER=%s\nKEY=%s\n' "$empresa" "$host" "$key" > "$destino"
}

rm -rf dist/para-o-cliente dist/para-a-empresa
mkdir -p dist/para-o-cliente dist/para-a-empresa

cp cliente/instalar-cliente.ps1 cliente/Instalar-acesso.bat cliente/LEIA-ME.txt \
  cliente/definir-servidor.ps1 cliente/Definir-servidor.bat \
  comum/windows.ps1 \
  dist/para-o-cliente/
cp empresa/instalar-tecnico.ps1 empresa/Instalar-tecnico.bat \
  empresa/definir-servidor.ps1 empresa/Definir-servidor.bat \
  comum/windows.ps1 \
  empresa/conectar.ps1 empresa/Conectar.bat \
  empresa/registrar.ps1 empresa/Registrar.bat \
  empresa/cadastro.ps1 empresa/LEIA-ME.txt \
  empresa/cadastro.csv.example empresa/cadastro.conf.example \
  dist/para-a-empresa/
printf 'cliente,computador,id,senha,observacao\n' > dist/para-a-empresa/cadastro.csv
printf '%s\n' \
  '# Lista usada por toda a equipe. Para varios tecnicos, use o mesmo caminho de rede.' \
  '# Exemplo: \\\\servidor\\suporte\\cadastro.csv' \
  'CADASTRO=cadastro.csv' \
  > dist/para-a-empresa/cadastro.conf
escrever_conf dist/para-o-cliente/servidor.conf
escrever_conf dist/para-a-empresa/servidor.conf
escrever_conf cliente/servidor.conf
escrever_conf empresa/servidor.conf

python3 - <<'PY'
import zipfile
from pathlib import Path

raiz = Path("dist")
for nome in ("para-o-cliente", "para-a-empresa"):
    pasta = raiz / nome
    destino = raiz / f"{nome}.zip"
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
        for arq in pasta.rglob("*"):
            if arq.is_file():
                z.write(arq, arq.relative_to(raiz).as_posix())
PY

echo
echo "Pacote do cliente: dist/para-o-cliente.zip"
echo "Envie esse zip. No computador dele, extraia e rode Instalar-acesso.bat."
echo
echo "Pacote da empresa: dist/para-a-empresa.zip"
echo "Cada tecnico extrai e roda Instalar-tecnico.bat uma vez."
echo "Registrar.bat inclui o computador na lista. Conectar.bat deixa escolher qualquer cliente."
echo "Para a equipe inteira ver a mesma lista, aponte CADASTRO em cadastro.conf para uma pasta de rede."
echo
echo "A chave privada continua so em data/id_ed25519. Estes zips levam a chave publica."
