#!/bin/sh
# Gera as tres pastas prontas: servidor, equipe e cliente.
set -eu
cd "$(dirname "$0")/.."

if [ ! -f data/id_ed25519.pub ]; then
  python3 scripts/gerar-chaves.py
fi

./scripts/preparar-cliente.sh DEFINIR "Empresa de informatica"

rm -rf dist/pronto
mkdir -p dist/pronto/01-servidor dist/pronto/02-para-a-empresa dist/pronto/03-para-o-cliente

cp compose.yml dist/pronto/01-servidor/
cp -a scripts dist/pronto/01-servidor/scripts
rm -f dist/pronto/01-servidor/scripts/gerar-chaves.py dist/pronto/01-servidor/scripts/gerar-pronto.sh
mkdir -p dist/pronto/01-servidor/data
cp data/id_ed25519 data/id_ed25519.pub dist/pronto/01-servidor/data/
chmod 600 dist/pronto/01-servidor/data/id_ed25519

cp -a dist/para-a-empresa/. dist/pronto/02-para-a-empresa/
cp -a dist/para-o-cliente/. dist/pronto/03-para-o-cliente/

cat > dist/pronto/LEIA-ME.txt <<'EOF'
Tres pastas prontas. A chave do servidor ja esta gerada e e a mesma nos tres lugares.

01-servidor
  Copie esta pasta inteira para o Linux com IP publico, inclusive a pasta data.
  Nao apague data e nao deixe outra pessoa levar o arquivo data/id_ed25519.
  No Linux: chmod +x scripts/*.sh
  Depois: ./scripts/portas.sh
          ./scripts/subir.sh
          ./scripts/backup-data.sh
  Anote o IP publico desse Linux.

02-para-a-empresa
  Rode Definir-servidor.bat e digite o IP do Linux.
  Copie a pasta para o computador de cada tecnico.
  Em cada um: Instalar-tecnico.bat uma vez.
  Registrar.bat inclui os computadores dos clientes.
  Conectar.bat escolhe em qual cliente entrar.

03-para-o-cliente
  Rode Definir-servidor.bat com o mesmo IP.
  Copie a pasta para cada computador autorizado.
  Em cada um: Instalar-acesso.bat
  O arquivo na Area de Trabalho volta com o ID e a senha para o Registrar.bat.

Se o Definir-servidor.bat nao for usado, a instalacao pergunta o IP na hora.
EOF

cat > dist/pronto/01-servidor/LEIA-ME.txt <<'EOF'
Pasta do servidor. Fica no Linux com IP publico.

A pasta data ja tem a chave certa, a mesma dos pacotes da equipe e do cliente.
Copie a pasta inteira. Se data for apagada, os computadores deixam de aceitar o servidor.

chmod +x scripts/*.sh
./scripts/portas.sh
./scripts/subir.sh
./scripts/backup-data.sh

Libere no firewall e no painel da VPS: 21115/tcp, 21116/tcp, 21116/udp e 21117/tcp.
O arquivo data/id_ed25519 nao vai para o Git e nao sai desta maquina.
EOF

python3 - <<'PY'
import zipfile
from pathlib import Path

raiz = Path("dist/pronto")

def zipar(origem: Path, destino: Path) -> None:
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
        for arq in origem.rglob("*"):
            if arq.is_file():
                z.write(arq, Path(origem.name) / arq.relative_to(origem))

zipar(raiz / "01-servidor", raiz / "01-servidor.zip")
zipar(raiz / "02-para-a-empresa", raiz / "02-para-a-empresa.zip")
zipar(raiz / "03-para-o-cliente", raiz / "03-para-o-cliente.zip")

completo = Path("dist") / "acesso-remoto-pronto.zip"
with zipfile.ZipFile(completo, "w", zipfile.ZIP_DEFLATED) as z:
    for arq in raiz.rglob("*"):
        if arq.is_file() and arq.suffix != ".zip":
            z.write(arq, Path("acesso-remoto-pronto") / arq.relative_to(raiz))
print(completo)
PY

mkdir -p /opt/cursor/artifacts
cp dist/acesso-remoto-pronto.zip dist/pronto/01-servidor.zip dist/pronto/02-para-a-empresa.zip dist/pronto/03-para-o-cliente.zip /opt/cursor/artifacts/

# Copia visivel no GitHub, sem zip. O Windows bloqueia o zip na hora de baixar.
rm -rf pronto
mkdir -p pronto
python3 - <<'PY'
import zipfile
from pathlib import Path
origem = zipfile.ZipFile("dist/acesso-remoto-pronto.zip")
destino = Path("pronto")
for info in origem.infolist():
    nome = info.filename
    if nome.endswith("data/id_ed25519") or nome.endswith("data/id_ed25519.pub"):
        continue
    alvo = destino / nome
    if nome.endswith("/"):
        alvo.mkdir(parents=True, exist_ok=True)
        continue
    alvo.parent.mkdir(parents=True, exist_ok=True)
    dados = origem.read(info)
    if nome.endswith("servidor.conf"):
        texto = dados.decode("utf-8")
        linhas = []
        for linha in texto.splitlines():
            if linha.startswith("KEY="):
                linhas.append("KEY=COLE_A_CHAVE_PUBLICA")
            else:
                linhas.append(linha)
        dados = ("\n".join(linhas) + "\n").encode("utf-8")
    alvo.write_bytes(dados)
servidor_leia = destino / "acesso-remoto-pronto" / "01-servidor" / "LEIA-ME.txt"
servidor_leia.write_text(
    "\n".join([
        "Pasta do servidor. Fica no Linux com IP publico.",
        "",
        "chmod +x scripts/*.sh",
        "./scripts/portas.sh",
        "./scripts/subir.sh",
        "./scripts/backup-data.sh",
        "",
        "O subir.sh cria a pasta data e mostra a chave publica. Copie essa linha.",
        "Nas pastas 02 e 03, rode Definir-servidor.bat, digite o IP deste Linux e cole a chave.",
        "",
        "Libere no firewall e no painel da VPS: 21115/tcp, 21116/tcp, 21116/udp e 21117/tcp.",
        "Nao apague a pasta data depois disso. Ela e a identidade do servidor.",
        "",
    ]) + "\n",
    encoding="utf-8",
)
leia = destino / "acesso-remoto-pronto" / "LEIA-ME.txt"
leia.write_text(
    "\n".join([
        "Estas tres pastas ficam no projeto, em AcessoRemoto/pronto.",
        "",
        "01-servidor: copie para o Linux e rode ./scripts/portas.sh, ./scripts/subir.sh e ./scripts/backup-data.sh.",
        "O subir.sh mostra a chave publica. Copie essa linha.",
        "",
        "02-para-a-empresa e 03-para-o-cliente: rode Definir-servidor.bat, informe o IP do Linux e cole a chave publica.",
        "Depois copie 02 para cada tecnico e 03 para cada computador autorizado.",
        "",
        "Nao baixe um zip deste pacote. O Windows acusa virus porque o conteudo instala acesso remoto.",
        "Use as pastas desta pasta.",
        "",
    ]) + "\n",
    encoding="utf-8",
)
print("pasta publica", destino / "acesso-remoto-pronto")
PY
echo "Pronto em dist/pronto, em pronto/ e em /opt/cursor/artifacts"
