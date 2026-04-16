# Checklist Seven — Guia de Instalação no Cliente

> **Sistema:** Checklist de entrada/saída de veículos conectado ao banco Firebird (AML_AUTO.FDB)
> **Acesso:** Qualquer dispositivo na rede local — computador, celular, tablet

---

## Visão Geral da Arquitetura

```
SERVIDOR DO CLIENTE
├── Node.js rodando na porta 3000
│   ├── Serve o sistema (http://IP_SERVIDOR:3000)
│   └── Conecta ao banco Firebird local
└── Firebird — AML_AUTO.FDB

OUTROS DISPOSITIVOS (mesma rede Wi-Fi / LAN)
└── Abrem o navegador em http://IP_SERVIDOR:3000
    (PC, celular, tablet — sem instalar nada)
```

---

## Pré-requisitos (instalar no SERVIDOR)

### 1. Node.js LTS

- Acesse: https://nodejs.org
- Baixe a versão **LTS** (Long Term Support)
- Instale com as opções padrão
- Verifique a instalação abrindo o Prompt de Comando:
  ```
  node --version
  npm --version
  ```

### 2. Firebird (já deve estar instalado junto com o sistema da Seven)

- Verifique se o serviço está rodando em `Serviços do Windows`
- O banco deve estar acessível em `D:\Seven\Solutio Server\Dados\AML_AUTO.FDB`
  (ou no caminho configurado na instalação)

---

## Passo a Passo de Instalação

### Passo 1 — Copiar os arquivos para o servidor

Copie a pasta `Checklist` para o servidor. Sugestão de destino:

```
C:\Seven\Checklist\
```

A estrutura deve ficar assim:
```
C:\Seven\Checklist\
├── backend\
│   ├── src\
│   ├── public\        ← frontend buildado (gerado automaticamente)
│   ├── package.json
│   ├── ecosystem.config.js
│   └── .env           ← você vai criar este arquivo no Passo 2
├── deploy.bat
├── start.bat
└── pm2-startup.bat
```

> **Atenção:** a pasta `backend\node_modules\` pode ser excluída antes de copiar
> (o deploy.bat reinstala tudo automaticamente).

---

### Passo 2 — Configurar o arquivo `.env`

Dentro da pasta `backend\`, crie um arquivo chamado `.env`
(baseado no `.env.example` que já está na pasta).

Abra o Bloco de Notas e salve como `backend\.env` com o seguinte conteúdo:

```env
PORT=3000

FB_HOST=127.0.0.1
FB_PORT=3050
FB_DATABASE=D:\Seven\Solutio Server\Dados\AML_AUTO.FDB
FB_USER=SYSDBA
FB_PASSWORD=masterkey
```

**Ajuste `FB_DATABASE`** para o caminho exato do arquivo `.fdb` no servidor do cliente.

---

### Passo 3 — Executar o deploy

Abra a pasta `Checklist\` no Windows Explorer.

Clique com o botão direito em **`deploy.bat`** → **Executar como administrador**.

O script vai:
1. Instalar as dependências do Node.js automaticamente
2. Instalar o PM2 (gerenciador de processos) globalmente
3. Iniciar o servidor com PM2

Aguarde até aparecer a mensagem:
```
Deploy concluido!
Acesse: http://localhost:3000
```

---

### Passo 4 — Configurar início automático com o Windows (recomendado)

Para o sistema iniciar automaticamente quando o servidor ligar:

1. Clique com o botão direito em **`pm2-startup.bat`** → **Executar como administrador**
2. Aguarde a mensagem de confirmação

Pronto! O servidor vai iniciar sozinho sempre que o Windows ligar.

---

### Passo 5 — Testar o acesso

**No próprio servidor:**
- Abra o navegador e acesse: `http://localhost:3000`

**Nos outros dispositivos (celular, tablet, outro PC):**
1. Descubra o IP do servidor:
   - Abra o Prompt de Comando no servidor
   - Digite: `ipconfig`
   - Anote o **Endereço IPv4** (ex: `192.168.1.100`)
2. No dispositivo, abra o navegador e acesse:
   ```
   http://192.168.1.100:3000
   ```

> Todos os dispositivos precisam estar na **mesma rede Wi-Fi ou cabo (LAN)**.

---

## Comandos úteis (Prompt de Comando no servidor)

| Ação | Comando |
|---|---|
| Ver status do servidor | `pm2 status` |
| Ver logs em tempo real | `pm2 logs checklist-seven` |
| Reiniciar o servidor | `pm2 restart checklist-seven` |
| Parar o servidor | `pm2 stop checklist-seven` |
| Iniciar manualmente (sem PM2) | Executar `start.bat` |

---

## Atualizar o sistema (nova versão)

Quando houver atualização do sistema:

1. Substitua os arquivos da pasta `Checklist\` pelos novos
2. Mantenha o arquivo `backend\.env` (não sobrescrever)
3. Execute `deploy.bat` como administrador novamente

---

## Liberar a porta 3000 no Firewall do Windows (se necessário)

Caso outros dispositivos não consigam acessar o sistema, pode ser necessário liberar a porta no Firewall:

1. Abra o **Painel de Controle** → **Firewall do Windows Defender**
2. Clique em **Configurações avançadas**
3. **Regras de Entrada** → **Nova Regra**
4. Tipo: **Porta** → **TCP** → Porta específica: `3000`
5. Ação: **Permitir a conexão**
6. Aplique para Domínio, Privado e Público
7. Nome: `Checklist Seven`

Ou execute o comando abaixo no Prompt como **Administrador**:
```
netsh advfirewall firewall add rule name="Checklist Seven" dir=in action=allow protocol=TCP localport=3000
```

---

## Solução de Problemas

| Problema | Solução |
|---|---|
| Página não abre no servidor | Verificar se `pm2 status` mostra `online`. Se não, rodar `deploy.bat` novamente. |
| Celular/tablet não acessa | Verificar se está na mesma rede. Liberar porta 3000 no Firewall. |
| Erro ao conectar banco Firebird | Verificar se o serviço Firebird está rodando. Conferir o caminho no `.env`. |
| Servidor reiniciou e o sistema não subiu | Rodar `pm2-startup.bat` como administrador para configurar o auto-start. |
| Porta 3000 em uso | Editar `.env` e mudar `PORT=3001`. Acessar pelo novo número de porta. |

---

## Informações Técnicas

- **Porta padrão:** 3000
- **Banco de dados:** Firebird (node-firebird)
- **Runtime:** Node.js LTS
- **Gerenciador de processos:** PM2
- **Compatibilidade:** Windows 10/11, qualquer navegador moderno (Chrome, Firefox, Safari, Edge)
- **Dispositivos:** Computador, smartphone, tablet (interface responsiva)

