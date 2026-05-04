# Identidade Visual — Seven Sistemas de Automação

> **LEITURA OBRIGATÓRIA** antes de criar ou alterar qualquer componente, tela ou estilo.
> Este documento define a linguagem visual da marca. Qualquer desvio deve ser aprovado pelo usuário.

---

## Logo

- Elemento gráfico: numeral **7** em branco sobre dois quadrados (navy + teal)
- Nome: **SEVEN** — maiúsculas, espaçamento largo
- Subtítulo: **SISTEMAS DE AUTOMAÇÃO** — maiúsculas, menor, cinza

---

## Paleta de Cores Oficiais

```
Navy (primária)   #0D2235   ████  Fundos, header, textos principais
Teal (destaque)   #1B7A8C   ████  Botões, bordas ativas, links, ícones
Branco            #FFFFFF   ████  Fundo de cards, texto sobre escuro
Cinza suave       #8B9EB0   ████  Subtítulos, labels, placeholders
Navy claro        #1A3548   ████  Hover navy, sidebar, elementos secundários
Teal escuro       #155F6E   ████  Hover teal, estados pressionados
Background        #F0F4F7   ████  Fundo geral da aplicação
```

**Nunca usar outras cores primárias.** Variações são apenas para hover/focus/disabled.

---

## Tipografia

| Uso                  | Fonte          | Peso   | Transform    | Letter-spacing |
|----------------------|----------------|--------|--------------|----------------|
| Logotipo "SEVEN"     | Inter          | 700    | uppercase    | 0.15em         |
| Subtítulo marca      | Inter          | 400    | uppercase    | 0.2em          |
| Títulos de página    | Inter          | 600    | —            | —              |
| Corpo / labels       | Inter          | 400    | —            | —              |
| Botões               | Inter          | 500    | uppercase    | 0.05em         |

Import no HTML:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## Componentes Base

### Botão Primário
- Fundo: `#1B7A8C` (teal)
- Texto: `#FFFFFF`
- Hover: `#155F6E`
- Border-radius: `6px`
- Padding: `10px 24px`

### Botão Secundário
- Fundo: transparente
- Borda: `1.5px solid #0D2235`
- Texto: `#0D2235`
- Hover fundo: `#0D2235`, texto: `#FFFFFF`

### Input / Select
- Borda normal: `1.5px solid #CBD5E0`
- Borda focus: `1.5px solid #1B7A8C`
- Outline: `none` (usar borda colorida em vez de outline padrão)
- Border-radius: `6px`
- Padding: `10px 14px`

### Header
- Fundo: `#0D2235` (navy)
- Texto e ícones: `#FFFFFF`
- Altura: `64px`
- Logo sempre à esquerda

### Cards / Painéis
- Fundo: `#FFFFFF`
- Borda: `1px solid #CBD5E0`
- Box-shadow: `0 1px 4px rgba(13,34,53,0.08)`
- Border-radius: `8px`
- Padding: `24px`

### Mensagem de Sucesso
- Fundo: `#E8F5F7` (teal bem claro)
- Borda esquerda: `4px solid #1B7A8C`
- Texto: `#0D2235`

### Mensagem de Erro
- Fundo: `#FEF2F2`
- Borda esquerda: `4px solid #DC2626`
- Texto: `#991B1B`

---

## Tom e estilo visual

- **Sóbrio, industrial, tecnológico** — sem gradientes chamativos
- Cores sólidas, contrastes definidos
- Espaçamento generoso (sem elementos comprimidos)
- Ícones: estilo outline, tamanho uniforme
- Animações apenas onde necessário e sutis (transition: 0.2s ease)

---

## Arquivo de tokens CSS

Localização: `frontend/src/styles/brand.css`
Sempre importar este arquivo antes de qualquer outro estilo.

---

## Regras de ouro (não negociáveis)

1. Navy `#0D2235` e Teal `#1B7A8C` são as únicas cores primárias
2. Header sempre navy escuro
3. Botões de ação sempre teal
4. Fonte sempre Inter
5. Nunca usar cores aleatórias "que ficam bonitas" — usar a paleta
6. Antes de qualquer mudança visual, reler este documento
