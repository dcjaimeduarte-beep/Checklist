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

## Pacote do cliente e pacote da empresa

Com o servidor no ar e o backup feito, monte os dois pacotes. Troque o exemplo pelo IP ou domínio público deste Linux e pelo nome que o cliente reconhece:

```sh
./scripts/preparar-cliente.sh suporte.suaempresa.com "Minha Informatica"
```

Isso gera:

- `dist/para-o-cliente.zip` — envie ao cliente. Ele extrai e abre `Instalar-acesso.bat`. O RustDesk instala já no servidor da empresa, com senha só daquela máquina e o ícone visível. Na Área de Trabalho fica `Acesso-remoto-desta-maquina.txt`, com o ID e a senha. O cliente devolve esse arquivo.
- `dist/para-a-empresa.zip` — no computador de quem atende, extraia e rode `Instalar-tecnico.bat` uma vez. Depois, `Conectar.bat` pede o ID e a senha e abre a tela.

Anote na [cliente/caderneta.csv](cliente/caderneta.csv) o nome, o computador, o ID e onde a senha ficou. A senha em si fica no cofre, uma por máquina. Para trocar a senha de um PC que já tinha o programa, rode de novo com `-NovaSenha` no PowerShell do cliente.

O zip leva a chave pública. A chave privada continua em `data/`. `dist/` e os `servidor.conf` preenchidos ficam fora do Git.

O roteiro manual, se o pacote não puder ser usado, está em [cliente/INSTALACAO.md](cliente/INSTALACAO.md).

## Uso

- Instale com autorização do cliente. O ícone do RustDesk permanece visível.
- Senha permanente diferente em cada PC.
- Guarde o backup de `data` fora do servidor logo depois do primeiro start.
