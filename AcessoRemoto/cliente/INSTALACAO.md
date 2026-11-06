# RustDesk no PC da empresa e no PC do cliente

O mesmo programa entra nos dois lados. Quem atende e quem é atendido apontam para o servidor da empresa. O ID público do RustDesk não conversa com o servidor de vocês.

Instale só com autorização de quem responde pelo computador. O ícone do RustDesk fica visível. A senha permanente é uma por máquina e fica no cofre de senhas da empresa. Nesta caderneta entra o lugar da senha, o ID e quem autorizou.

Baixe o cliente na página de versões do projeto: https://github.com/rustdesk/rustdesk/releases

## 1. Servidor no ar

No Linux, a partir da pasta `AcessoRemoto`:

```sh
./scripts/portas.sh
./scripts/subir.sh
./scripts/backup-data.sh
```

Anote o IP ou o domínio desse Linux e a chave pública que o `subir.sh` imprime (`data/id_ed25519.pub`).

## 2. No seu PC e em cada PC autorizado

1. Instale o RustDesk e abra o programa.
2. No menu ao lado do ID, abra **Rede** e desbloqueie a rede (o Windows pede permissão de administrador).
3. Em **Servidor de ID**, coloque o IP ou o domínio do Linux. Exemplo: `suporte.suaempresa.com`
4. Em **Key**, cole a chave pública inteira, uma linha.
5. Deixe **Servidor de relay** e **Servidor de API** em branco. O relay é deduzido sozinho. A API é da versão paga.
6. Aplique.

Para repetir a mesma rede nos outros PCs: em **Rede**, use **Exportar configuração do servidor**, guarde o texto e, no próximo PC, use **Importar configuração do servidor** e aplique. Os dois lados precisam dessa configuração.

## 3. Senha permanente e serviço

No PC do cliente, ainda com a pessoa presente ou com a autorização já combinada:

1. Em **Segurança**, defina a senha permanente daquela máquina.
2. Guarde a senha no cofre. Na `caderneta.csv`, preencha o nome, o computador, o ID que aparece na tela, o lugar da senha, a data e quem autorizou.
3. Na janela principal, instale o RustDesk como serviço para o acesso continuar depois do reinício, com o ícone na bandeja.

A caderneta do próprio RustDesk (ícone de agenda) também guarda o ID. A planilha `caderneta.csv` é a lista da empresa.

## 4. Conectar

No seu PC, digite o ID do cliente e a senha daquela máquina. A sessão abre a tela e permite copiar arquivos.

Se a chave do servidor mudar, o cliente recusa a conexão até você colar a chave nova no campo Key. Por isso o backup da pasta `data` fica fora do servidor.
