# Acesso remoto

Projeto separado para o suporte da empresa conectar nos computadores dos clientes. O acesso é o [RustDesk](https://rustdesk.com/) de código aberto, com o servidor OSS (`hbbs` e `hbbr`) neste Linux. A licença do programa permite o uso na empresa. O console web e o cadastro centralizado ficam na versão paga; a tela remota, a senha permanente e a cópia de arquivos ficam nesta versão.

A versão gratuita do TeamViewer e a do AnyDesk valem para uso pessoal. Suporte a cliente é uso profissional e, nesses dois, pede licença paga. Por isso o atendimento da empresa passa por este servidor.

O programa de controle da tela é o cliente oficial do RustDesk. Este repositório só sobe o servidor e descreve a instalação nos PCs. AnaliseSped, Checklist, PedidosWeb, Enviardocs e Contrato ficam de fora.

## O que você precisa

- Um Linux com IP público: uma VPS pequena ou um PC da empresa com as portas encaminhadas no roteador.
- Docker e o plugin Compose.
- Autorização de quem responde por cada computador em que o RustDesk for instalado.

O software é gratuito. A VPS, se for alugada, é o custo à parte.

## Subir o servidor

Na pasta `AcessoRemoto`, no Linux:

```sh
chmod +x scripts/*.sh
./scripts/portas.sh
./scripts/subir.sh
./scripts/backup-data.sh
```

O `subir.sh` imprime a chave pública. Ela vai no campo **Key** de cada RustDesk. A chave privada `data/id_ed25519` permanece neste servidor.

`./scripts/portas.sh --aplicar` grava as regras no ufw somente quando o ufw já está ligado. O script deixa o ufw desligado como está, para o SSH continuar aberto. No painel da VPS, libere as mesmas portas:

| Porta | Uso |
| --- | --- |
| 21115/tcp | teste de NAT |
| 21116/tcp e 21116/udp | registro do ID e conexão |
| 21117/tcp | relay, quando a ligação direta não passa |

As portas 21118 e 21119 ficam fechadas. Elas servem o cliente pelo navegador e aceitam cabeçalho de IP sem conferir. A porta 21114 é da versão paga.

Para ver o estado: `docker compose ps` e `docker compose logs hbbs`. Para parar sem apagar as chaves: `./scripts/parar.sh`.

O Compose usa a rede do host, que é o modo indicado no Linux. O arquivo segue o exemplo oficial: [Docker – RustDesk](https://rustdesk.com/docs/en/self-host/rustdesk-server-oss/docker/).

## Backup

A pasta `data` é a identidade do servidor. Sem ela, o próximo start gera outra chave e os clientes deixam de aceitar o servidor até alguém atualizar o campo Key.

`./scripts/backup-data.sh` gera `backups/rustdesk-data-AAAAMMDD-HHMMSS.tar.gz`. Copie esse arquivo para um disco ou cofre fora do servidor. `data/` e `backups/` estão fora do Git.

## Pastas prontas

`scripts/gerar-pronto.sh` monta tres pastas com a mesma chave do servidor:

- `01-servidor` vai para o Linux, com a pasta `data` já criada
- `02-para-a-empresa` vai para quem atende
- `03-para-o-cliente` vai para cada computador autorizado

Em `02` e em `03`, `Definir-servidor.bat` grava o IP do Linux uma vez. Depois a pasta pode ser copiada para cada computador. Os `.bat` rodam no Windows 7, 8, 10 e 11, em 32 bits, 64 bits ou ARM: no Windows 7 e 8 entra o instalador legado; no Windows 10 e 11 entra o instalador do processador. Se o download nao passar num Windows antigo, coloque o instalador na pasta com o nome `rustdesk-instalador.exe` e rode de novo.

## Pacote do cliente e pacote da empresa

Com o servidor no ar e o backup feito, monte os dois pacotes. Troque o exemplo pelo IP ou domínio público deste Linux e pelo nome que o cliente reconhece:

```sh
./scripts/preparar-cliente.sh suporte.suaempresa.com "Minha Informatica"
```

Isso gera:

- `dist/para-o-cliente.zip` — envie ao cliente. Ele extrai e abre `Instalar-acesso.bat`. O RustDesk instala já no servidor da empresa, com senha só daquela máquina e o ícone visível. Na Área de Trabalho fica `Acesso-remoto-desta-maquina.txt`, com o ID e a senha. O cliente devolve esse arquivo.
- `dist/para-a-empresa.zip` — cada pessoa que atende extrai no próprio computador e roda `Instalar-tecnico.bat` uma vez. O servidor é o mesmo para toda a equipe. `Registrar.bat` inclui o cliente e o computador na lista. `Conectar.bat` mostra todos e deixa escolher pelo número, pelo nome do cliente ou pelo ID.

A lista é o `cadastro.csv`. Vários técnicos e vários clientes cabem nela: o mesmo cliente pode ter caixa, escritório e notebook, cada um com ID e senha próprios. Para todo mundo ver a mesma lista, coloque o arquivo numa pasta de rede e aponte `CADASTRO` em `cadastro.conf` para esse caminho, igual em cada computador da equipe. O modelo está em [empresa/cadastro.csv.example](empresa/cadastro.csv.example). A senha fica nessa lista, só para o suporte; o arquivo não entra no Git nem no zip do cliente.

Para trocar a senha de um PC que já tinha o programa, rode de novo no cliente com `-NovaSenha` e registre de novo.

O zip leva a chave pública. A chave privada continua em `data/`. `dist/` e os `servidor.conf` preenchidos ficam fora do Git.

O roteiro manual, se o pacote não puder ser usado, está em [cliente/INSTALACAO.md](cliente/INSTALACAO.md).

## Uso

- Instale com autorização do cliente. O ícone do RustDesk permanece visível.
- Senha permanente diferente em cada PC.
- Guarde o backup de `data` fora do servidor logo depois do primeiro start.
