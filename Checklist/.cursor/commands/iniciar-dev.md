# /iniciar-dev

Arranque do ambiente local: **`npm install` só se ainda não existir** → **`npm run dev`** → **mostrar as URLs**.

## Ordem obrigatória (fazer nesta sequência)

### 1) `npm install` — só quando ainda não foi feito

Na **raiz** do monorepo (`seven-reforma-tributaria-monorepo`, onde está o `package.json` da raiz):

- Se **não** existir a pasta **`node_modules/`** → correr **`npm install`** na raiz e **esperar** que termine com sucesso **antes** de qualquer `npm run dev`.
- Se **`node_modules/`** já existir → **não** voltar a correr `npm install` (a menos que o utilizador peça explicitamente reinstalar).

Critério simples: **`node_modules` em falta na raiz ⇒ `npm install`. Presente ⇒ saltar.**

### 2) Verificar se o dev já está a correr

```bash
lsof -iTCP:8080 -sTCP:LISTEN
lsof -iTCP:3000 -sTCP:LISTEN
```

- Se **8080** e **3000** já tiverem listeners → **não** executar outro `npm run dev` (evitar portas duplicadas). Ir direto ao passo **4**.

### 3) `npm run dev`

Se **faltar** pelo menos um dos dois serviços acima, na **raiz** do monorepo:

```bash
npm run dev
```

Lança **backend** (`npm run dev:backend`) e **frontend** (`npm run dev:frontend`) em paralelo via **`node scripts/dev.cjs`** (script na raiz, **sem** `concurrently` nem dependências extra — evita `y18n`/`rxjs` partidos no `node_modules`). Executar em **background** quando a ferramenta permitir; permissões **rede + sistema completo** (`all`) se houver erros de sandbox (`ENFILE`, etc.).

### 4) Mostrar sempre ao utilizador estas URLs

Copiar este bloco (ajustar só o texto de estado no primeiro bullet):

- **Estado:** (ex.: instalei dependências / já tinha `node_modules` / dev já corria / acabei de subir `npm run dev`.)
- **App (abrir no browser):** **http://localhost:8080**
- **API:** **http://localhost:3000**
- **Teste rápido da API:** **http://localhost:3000/api/health**

`PORT` ou `.env` no backend podem mudar a porta da API — se souberes, indica a porta real.

### 5) Validação opcional (quando possível)

Após subir o dev, após alguns segundos: `curl -sS "http://localhost:3000/api/health"` e, se fizer sentido, pedido HTTP à raiz do Vite em **8080**.

## Resumo uma linha

**Sem `node_modules` na raiz ⇒ `npm install` →** (se portas livres) **`npm run dev` →** responder com **http://localhost:8080** e **http://localhost:3000** (+ `/api/health`).

## Se algo falhar

- Portas ocupadas: **`/fechar-dev`** ou terminar processos com cuidado, depois repetir a partir do passo **2**.
- Erros estranhos no agente: sugerir o mesmo fluxo no **terminal local** do utilizador na raiz: `npm install` (se preciso) e `npm run dev`.

### “Too many open files” / `os error 23` / Fish a abortar no `npm run dev`

O limite de **ficheiros abertos por processo** (ou do sistema) ficou baixo ou há **muitos processos `node`** antigos (várias tentativas de dev).

1. **Fechar** instâncias antigas de dev e processos órfãos: **`/fechar-dev`** ou `pkill -f "nest start"` / `pkill -f vite` com cuidado (ou reiniciar o terminal).
2. **Subir o limite na sessão atual** (macOS / Fish ou bash), **antes** de `npm run dev`:
   - Ver o atual: `ulimit -n`
   - Aumentar (ex.: 65536): `ulimit -n 65536`  
     Se o shell disser “invalid”, experimentar `ulimit -n 10240` ou o máximo que aceitar.
3. **Persistente no macOS** (requer reinício de sessão em alguns casos): criar ou editar `~/Library/LaunchAgents/limit.maxfiles.plist` com `launchctl` para `maxfiles`, ou pedir ao utilizador a documentação Apple para `launchctl limit` — o essencial é **não** dezenas de `npm run dev` em paralelo.

Depois: na raiz, `npm run dev` outra vez.
