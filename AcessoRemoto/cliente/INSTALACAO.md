# Instalação nos computadores

O caminho normal é o pacote, para o cliente não preencher IP nem chave na mão.

## Pacote

No Linux, com o servidor já no ar:

```sh
./scripts/preparar-cliente.sh suporte.suaempresa.com "Minha Informatica"
```

Envie `dist/para-o-cliente.zip`. No PC do cliente, a pessoa autorizada extrai e abre `Instalar-acesso.bat`. O arquivo `Acesso-remoto-desta-maquina.txt` na Área de Trabalho traz o ID e a senha daquela máquina. Guarde a senha no cofre e registre o ID em `caderneta.csv`.

No PC de quem atende, extraia `dist/para-a-empresa.zip`, rode `Instalar-tecnico.bat` uma vez e, em cada atendimento, `Conectar.bat`.

Os dois lados usam o mesmo servidor. O ID público do site do RustDesk fica de fora dessa configuração.

## Manual, se o pacote não rodar

Baixe o cliente em https://github.com/rustdesk/rustdesk/releases

1. Instale o RustDesk.
2. No menu ao lado do ID, abra Rede e desbloqueie.
3. Em Servidor de ID, coloque o IP ou o domínio do Linux.
4. Em Key, cole `data/id_ed25519.pub`.
5. Deixe Servidor de API em branco. O relay pode ficar em branco; o pacote preenche o mesmo host.
6. Em Segurança, defina uma senha permanente só desta máquina e marque o uso dessa senha.
7. Instale como serviço, com o ícone na bandeja.

Quem atende repete os passos 1 a 5, sem senha permanente, e digita o ID do cliente no RustDesk.

Se a chave do servidor mudar, gere os zips de novo e rode a instalação outra vez. O backup de `data` evita essa troca.
