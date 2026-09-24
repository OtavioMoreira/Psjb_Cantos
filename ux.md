# Cantos PSJB: especificação de UX e layout

> Paróquia Catedral São João Batista, repertório litúrgico.
> Stack alvo: Next.js (App Router) + Tailwind. Este documento traz só a especificação de UX. Não contém código do app.

---

## 1. Princípios e público

**Público**
- **Músicos e cantores dos ministérios** (violão, teclado, coral): precisam de cifra legível, transposição e um fluxo rápido no domingo. Usam celular e tablet, muitas vezes com as mãos ocupadas.
- **Coordenadores de liturgia**: montam a missa da semana e compartilham com a equipe. Usam desktop ou notebook.
- **Fiéis**: buscam a letra ou o áudio para ensaiar. Usam celular.

**Princípios**
1. **Encontrar em 5 segundos.** A busca fica sempre à vista e responde enquanto a pessoa digita. Os filtros falam a língua da liturgia (momento, tempo, ano) e não a do banco de dados.
2. **Sagrado sem ser pesado.** Fundo marfim, verde do logo, dourado só como filete e detalhe. Ornamentos entram com parcimônia: no máximo 1 por tela.
3. **Mãos no instrumento.** No Modo Missa, alvos de toque ≥ 56px e ações com 1 toque. Não usar gestos finos.
4. **Legibilidade antes de tudo.** O corpo do texto nunca fica abaixo de 16px, e a cifra usa fonte monoespaçada para alinhar os acordes.
5. **Tudo tem link.** Filtros, aba ativa e tom transposto vão para a URL, para compartilhar no grupo do ministério.

---

## 2. Design tokens

### 2.1 Paleta (tokens CSS em `:root` / `.dark`, mapeados no `tailwind.config`)

| Token | Light | Dark | Uso |
|---|---|---|---|
| `bg` | `#FAF6EE` (marfim) | `#121613` | fundo da página |
| `surface` | `#FFFDF8` | `#1A201C` | cards, modais |
| `surface-2` | `#F3ECDD` (pergaminho) | `#222A25` | faixas, header de seção, inputs |
| `border` | `#E4DAC6` | `#2F3A33` | bordas 1px |
| `ink` | `#1E2420` | `#EDE6D6` | texto principal |
| `ink-muted` | `#5B6159` | `#A9B0A6` | metadados, legendas |
| `primary` | `#1F3D2B` (verde do logo) | `#8FC4A0` | títulos, links, ícones ativos |
| `primary-solid` | `#1F3D2B` | `#3E7552` | fundo dos botões primários (texto `#FFFDF8`) |
| `primary-hover` | `#2A5239` | `#4A8661` | hover dos botões |
| `primary-soft` | `#E3ECE5` | `#1F2E25` | chip selecionado, destaque de linha |
| `gold` | `#B08D3E` | `#D4B36A` | filetes, ícones decorativos, foco |
| `gold-ink` | `#7A5E22` | `#E0C07A` | texto dourado (contraste AA) |
| `gold-soft` | `#F1E6CC` | `#2E2818` | badge "Novo", fundo de destaque |
| `danger` | `#B3261E` | `#F2A09A` | erros, remover |
| `success` | `#2E7D4F` | `#8FD1A6` | confirmações |
| `focus` | `#B08D3E` com anel de 2px e offset de 2px | `#D4B36A` | foco visível |

**Cores dos tempos litúrgicos** (acentos: faixa lateral de 4px, bolinha, borda de chip. Nunca como fundo de área grande.)

| Tempo | Cor | Soft (fundo do chip) |
|---|---|---|
| Advento / Quaresma | `#5B2C83` roxo | `#EEE6F4` |
| Gaudete / Laetare | `#C06C8A` rosa | `#F7E6ED` |
| Natal / Páscoa | `#C9A24A` dourado (com borda `#B08D3E` para o "branco") | `#FBF4E2` |
| Tempo Comum | `#2E7D4F` verde | `#E2F0E7` |
| Pentecostes / Mártires / Semana Santa | `#A4262C` vermelho | `#F6E3E3` |

**Paletas do Modo Missa** (alto contraste, próprias)

| Modo | Fundo | Letra | Acordes | Barra/UI |
|---|---|---|---|---|
| Dia | `#FFFFFF` | `#000000` | `#1F3D2B` negrito | `#F3ECDD` |
| Noite | `#000000` | `#F2E9D8` | `#F2B84B` negrito | `#141414` |
| Sépia (opcional) | `#F4ECD8` | `#2B2118` | `#7A1F1F` | `#E8DCC0` |

### 2.2 Tipografia (via `next/font/google`)

| Papel | Fonte | Pesos | Variável |
|---|---|---|---|
| Títulos / display | **Cormorant Garamond** | 500, 600, 700 (+ itálico 500) | `--font-serif` |
| Capitular e rótulos em versalete | **Cormorant SC** | 600 | `--font-sc` |
| UI e corpo | **Inter** | 400, 500, 600 | `--font-sans` |
| Cifra (letra + acordes) | **JetBrains Mono** | 400, 700 | `--font-mono` |

Escala (mobile → desktop):

| Token | Tamanho / altura de linha | Fonte |
|---|---|---|
| `display` | 40/44 → 56/60 | Serif 600 |
| `h1` | 32/38 → 40/48 | Serif 600 |
| `h2` | 24/30 → 28/34 | Serif 600 |
| `h3` | 20/26 | Serif 600 |
| `body` | 16/26 | Inter 400 |
| `small` | 14/20 | Inter 400 |
| `caption` | 12/16, tracking +0.08em, caixa-alta | Inter 600 |
| `chord` | 16/24 padrão, ajustável de 12 a 40 (no Modo Missa, 18 a 56) | Mono |

Número do canto: Cormorant, algarismos old-style (`font-variant-numeric: oldstyle-nums`), cor `gold-ink`, exibido como "Nº 001".

### 2.3 Espaçamento, raios e sombras
- Escala de espaçamento em base 4: `4, 8, 12, 16, 24, 32, 48, 64, 96`. Gutter lateral: 16 no mobile, 24 no tablet, 32 no desktop. Largura máxima do conteúdo: 1200px; texto corrido: 72ch.
- Raios: `sm 6px` (inputs, chips internos), `md 10px` (botões, cards), `lg 16px` (modais, drawers), `full` (chips e avatares).
- Sombras em tom quente, nunca cinza puro:
  - `shadow-1`: `0 1px 2px rgba(31,61,43,.06), 0 1px 1px rgba(31,61,43,.04)` (cards)
  - `shadow-2`: `0 6px 20px -6px rgba(31,61,43,.18)` (hover, dropdown)
  - `shadow-3`: `0 20px 48px -12px rgba(31,61,43,.28)` (modal, drawer)
  - No dark, as sombras são trocadas por borda `border` com 1px mais clara.

### 2.4 Ornamentos (sutis, em SVG inline e em `currentColor`)
- **Filete dourado**: linha de 1px em `gold` com um losango ou uma pequena cruz de 8px no centro (`──── ✣ ────`). Aparece sob o H1 das páginas e como separador de seções da home.
- **Cruz discreta**: cruz grega de 12px em `gold`, usada no footer, no estado vazio e no loader.
- **Capitular**: primeira letra da letra do canto (só na visualização "Letra", sem cifra) em Cormorant SC, 3 linhas de altura, cor `primary`.
- **Textura de pergaminho**: ruído SVG com 3% de opacidade, apenas no hero da home e no fundo do login. No dark, desativada.
- **Cantos de moldura**: cantoneiras de 16px em `gold` apenas no card "Missa de domingo" da home.

### 2.5 Movimento
- Durações: `fast 120ms`, `base 200ms`, `slow 320ms`. Easing: `cubic-bezier(.2,.8,.2,1)`.
- Com `prefers-reduced-motion` ativo, só fades de no máximo 100ms.

---

## 3. Arquitetura de informação e navegação

```
/                         Home
/cantos                   Listagem + busca + filtros (estado todo no URL)
/cantos/[numero]-[slug]   Detalhe (?aba=cifra|partitura|audio&tom=+2)
/entrar                   Login  (/cadastro opcional, ilustrativo)
/painel                   Visão geral
/painel/perfil            Meu perfil
/painel/missas            Minhas Missas
/painel/missas/nova       Montar Missa (editor)
/painel/missas/[id]       Editor da missa salva
/missa/[id]               Modo Missa (tela cheia, sem header)
```

Taxonomia de filtros (um canto pode ter N valores em cada eixo):
- **Momento da Missa**: Refrão orante, Velas, Entrada, Ato penitencial, Glória, Salmo, Aclamação, Creio, Preces, Ofertório, Santo, Cordeiro, Comunhão, Pós-comunhão/Louvor, Saída.
- **Tempo Litúrgico**: Advento, Natal, Quaresma, Semana Santa, Tríduo Pascal, Páscoa, Pentecostes, Tempo Comum.
- **Ano**: A, B, C (vale só para Salmos e Aclamações).
- **Tema**: Crianças, Espírito Santo, Família, Marianos, Meditação e Louvor, Movimentos, Palavra, Paz, Perdão, Santos, Vocacionais e Missão, Exéquias, Sequências.
- **Recursos**: Cifra, Partitura, Áudio.

### Header (desktop ≥ 1024px), 72px de altura, fundo `bg`, filete dourado de 1px embaixo
```
┌──────────────────────────────────────────────────────────────────────────┐
│ [LOGO 140×67]   Cantos   Monte sua Missa   Sobre    [🔍 Buscar canto… ⌘K] (Entrar) │
└──────────────────────────────────────────────────────────────────────────┘
```
- Logo em `h-12` no desktop e `h-9` no mobile, com link para `/`. No dark, aplicar `filter: brightness(0) invert(.92) sepia(.2)` ou usar uma versão clara do SVG.
- A busca do header abre um **Command Palette** (modal) com resultados instantâneos. `Enter` leva a `/cantos?q=`.
- Logado, o botão "Entrar" vira um avatar com as iniciais e um menu: Painel, Minhas Missas, Perfil, Sair.
- O item ativo recebe sublinhado dourado de 2px, deslocado 6px.

### Header mobile (< 768px), 56px, sticky
```
┌────────────────────────────────────┐
│ ☰   [LOGO]                   🔍  👤 │
└────────────────────────────────────┘
```
- ☰ abre um drawer à esquerda (largura de 85vw, máx. 360px) com os links grandes (48px), a seção "Tempos" (atalhos coloridos) e um toggle de tema (Claro/Escuro/Sistema).
- 🔍 expande a busca em tela cheia.
- Barra inferior fixa **só no painel**: Início · Missas · Nova · Perfil.

### Footer
```
────────────── ✣ ──────────────
[logo pequeno]   Paróquia Catedral São João Batista
                 Endereço · Horários de missa · Instagram
Cantos · Monte sua Missa · Sobre · Contato
"Quem canta reza duas vezes." (Sto. Agostinho)       © 2026
```
Fundo `surface-2`, texto `ink-muted`, 14px.

---

## 4. Telas

### 4.1 Home
```
┌──────────────────────────── HEADER ─────────────────────────────┐
│  (textura pergaminho)                                            │
│           Cantos para a Liturgia                    (display)    │
│        ──────────── ✣ ────────────                               │
│   O repertório da Catedral, com letra, cifra, partitura e áudio. │
│   ┌──────────────────────────────────────────────┐              │
│   │ 🔍  Busque por título, número ou trecho…     │  (56px)      │
│   └──────────────────────────────────────────────┘              │
│   Momentos: [Entrada][Glória][Salmo][Ofertório][Comunhão][+]     │
├──────────────────────────────────────────────────────────────────┤
│ ▌TEMPO ATUAL: Tempo Comum · 25º Domingo · Ano B   (faixa verde)  │
│  [card][card][card][card]   Ver cantos do tempo →                │
├──────────────────────────────────────────────────────────────────┤
│ Navegue por tempo                                                │
│ [● Advento][● Natal][● Quaresma][● Páscoa][● Pentecostes][● Comum]│
├──────────────────────────────────────────────────────────────────┤
│ ┌── Monte sua Missa ────────────┐ ┌── Salmos e Aclamações ─────┐ │
│ │ Escolha um canto por momento  │ │ Ano A · Ano B · Ano C      │ │
│ │ e cante com o Modo Missa.     │ │                            │ │
│ │ [Começar agora]               │ │                            │ │
│ └───────────────────────────────┘ └────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│ Adicionados recentemente   [SongCard ×6 em grid]                 │
└──────────────────────────── FOOTER ─────────────────────────────┘
```
- O "Tempo atual" é calculado pela data (o cálculo do calendário litúrgico pode ser mock). A cor da faixa segue o tempo.
- Os chips de momento levam a `/cantos?momento=entrada`.
- Os cards de tempo têm 120×88, com bolinha de cor de 12px e nome em serifada.

### 4.2 Listagem e busca (`/cantos`)
**Desktop**: sidebar de filtros com 280px, sticky, à esquerda. Resultados à direita.
```
┌─────────────────────────────── HEADER ───────────────────────────────┐
│ Cantos                                                    (h1)       │
│ ┌────────────────────────────────────────────────────┐ Ordenar: [Nº ▾]│
│ │ 🔍  "senhor"                                   ✕   │ [≣ lista|▦ grade]│
│ └────────────────────────────────────────────────────┘               │
│ 48 cantos · [Comunhão ✕] [Páscoa ✕] [Com cifra ✕]   Limpar tudo      │
├───────────────┬──────────────────────────────────────────────────────┤
│ MOMENTO       │ ┌──────────────────────────────────────────────────┐ │
│ ☐ Entrada  32 │ │▌Nº 045  Eu sou o Pão da Vida                      │ │
│ ☑ Comunhão 88 │ │ Comunhão · Páscoa                                 │ │
│ ☐ Ofertório 41│ │ "…quem comer deste pão, o SENHOR ressuscitará…"   │ │
│ [ver todos]   │ │ [♪ Cifra] [𝄞 Partitura] [▶ Áudio]      [▶] [+Missa]│ │
│ TEMPO         │ └──────────────────────────────────────────────────┘ │
│ ● Advento     │ ┌──────────────────────────────────────────────────┐ │
│ ● Páscoa  ☑   │ │▌Nº 046  …                                         │ │
│ ANO           │ └──────────────────────────────────────────────────┘ │
│ (A)(B)(C)     │                                                      │
│ TEMA  [▾]     │           [Carregar mais]  (ou scroll infinito)      │
│ RECURSOS      │                                                      │
│ ☑ Cifra ☐ Part│                                                      │
│ ☐ Áudio       │                                                      │
└───────────────┴──────────────────────────────────────────────────────┘
```
**Mobile**
```
┌────────────────────────────────┐
│ 🔍 Buscar…                  ✕  │ sticky abaixo do header
│ [⚙ Filtros (3)] [Ordenar ▾]    │
│ [Comunhão ✕][Páscoa ✕][Cifra ✕]→ scroll horizontal
│ 48 cantos                       │
│ ┌────────────────────────────┐ │
│ │▌Nº 045 Eu sou o Pão da Vida│ │
│ │ Comunhão · Páscoa          │ │
│ │ ♪ 𝄞 ▶            [+] [⋯]   │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```
Comportamento:
- **Busca instantânea** com debounce de 150ms, feita no cliente sobre um índice pré-carregado (sugestão: MiniSearch ou Fuse, com fuzzy e sem acento: "sao" encontra "São"). Campos e pesos: número (exato, peso 10), título (5), letra (1). Um número digitado ("45" ou "045") coloca o canto no topo.
- O termo encontrado aparece em `<mark>` com fundo `gold-soft`. Se o match foi na letra, o card mostra um trecho de cerca de 80 caracteres com o termo.
- **Filtros**: OR dentro do mesmo eixo, AND entre eixos. Cada opção mostra a contagem ao vivo, e opções com contagem 0 ficam em `ink-muted` (continuam clicáveis).
- **URL**: `?q=senhor&momento=comunhao&tempo=pascoa&ano=b&tema=marianos&tem=cifra,audio&ordem=numero`. Usar `router.replace` sem scroll. Voltar do detalhe restaura a posição da lista.
- **Chips** aparecem acima dos resultados; ✕ remove o filtro. "Limpar tudo" só aparece com 2 ou mais chips.
- A faixa ▌ de 4px à esquerda do card usa a cor do tempo litúrgico principal do canto (neutro `border` se ele não tiver tempo).
- O ▶ do card toca uma prévia no **mini-player** global (barra fixa no rodapé, 64px).
- Ordenação: Número · Título A–Z · Recentes.
- Sem resultados: estado vazio (ver 5.3) com sugestões "Remover filtro X".

### 4.3 Detalhe do canto (`/cantos/045-eu-sou-o-pao-da-vida`)
```
┌──────────────────────────────── HEADER ───────────────────────────────┐
│ ← Voltar aos resultados                                               │
│ Nº 045                                                  (gold-ink)   │
│ Eu sou o Pão da Vida                                     (h1 serif)   │
│ [Comunhão] [● Páscoa] [Tempo Comum]                (chips com link)   │
│ ──────────── ✣ ────────────                                           │
│ [+ Adicionar à minha missa]  [⬇ Baixar ▾]  [⤢ Modo Missa]  [↗ Compartilhar]│
├───────────────────────────────────────────────────────────────────────┤
│  Letra e Cifra  │  Partitura  │  Áudio        (tabs, sublinhado dourado)│
├───────────────────────────────────────────────────────────────────────┤
│ Tom: [ − ] Ré (D) [ + ]  ↺ original   │ Aa [−][+] │ [Cifra ◉ | Só letra ○]│
│                                                                       │
│      D            A/C#     Bm                                         │
│   Eu sou o pão da vida, quem vem a mim                                │
│      G          A        D                                            │
│   jamais terá fome…                                                   │
│                                                                       │
│   REFRÃO (rótulo caption, recuo e barra dourada à esquerda)           │
│   …                                                                   │
├──────────────────────── desktop: coluna lateral 320px ────────────────┤
│  ▶ ━━━━━━━○──────  1:12 / 3:40   (player compacto sempre visível)     │
│  Downloads: Cifra (PDF) · Partitura (PDF) · Áudio (MP3)               │
│  Também em: Missa "25º Dom. TC" (se logado)                           │
└───────────────────────────────────────────────────────────────────────┘
```
- **Abas**: ficam em `?aba=`. Uma aba sem recurso aparece desabilitada, com tooltip "Partitura ainda não disponível". A aba padrão é a primeira disponível.
- **Letra e Cifra**: fonte mono, os acordes em `primary` 700 na linha de cima. Os acordes são parseados para `<span>` e posicionados pelos espaços originais. Linhas longas quebram mantendo cada acorde junto com sua sílaba (nunca scroll horizontal).
- **Transposição**: −/+ em semitons, o tom atual é mostrado por extenso ("Ré (D)"), e o ↺ só aparece se o tom foi alterado. Toggle ♯/♭ no menu ⋯. O valor fica em `?tom=+2` e no localStorage por canto.
- **Tamanho da fonte**: de 12 a 40px, em passos de 2, com valor global no localStorage.
- **Só letra**: esconde os acordes e ativa a capitular no primeiro verso.
- **Partitura**: PdfViewer (ver 5.1), com altura de `calc(100vh − 200px)`.
- **Áudio**: player grande com velocidade (0,75× / 1× / 1,25×) e loop A–B (útil para ensaio).
- **Adicionar à minha missa**: popover com a lista de missas do usuário e o momento sugerido (pré-selecionado pela categoria), mais "Nova missa…". Sem login, o botão leva a `/entrar?volta=…`.
- Mobile: o bloco de ações vira uma barra fixa inferior (Missa · Baixar · Modo Missa) e os controles de tom e fonte viram uma barra compacta sticky abaixo das abas.

### 4.4 Login (`/entrar`)
```
┌───────────────────────────────────────────┐
│        (fundo pergaminho + cantoneiras)   │
│              [LOGO grande]                │
│         ───────── ✣ ─────────             │
│   Entrar                         (h2)     │
│   E-mail   [______________________]       │
│   Senha    [__________________ 👁]        │
│   [✓] Manter conectado  Esqueci a senha   │
│   [          Entrar            ] (48px)   │
│   Ainda não tem conta? Criar conta        │
│   ⓘ Área de demonstração: qualquer        │
│     e-mail e senha funcionam.             │
└───────────────────────────────────────────┘
```
- Card de 400px centralizado. No mobile, ocupa a tela toda com padding de 24.
- Validação ao sair do campo (blur): e-mail em formato válido e senha com 6 ou mais caracteres. O erro aparece abaixo do campo em `danger`, com ícone.
- Ao enviar: o botão mostra um spinner e o texto "Entrando…" (600ms simulados), depois redireciona para `?volta=` ou `/painel`. A sessão é mock, guardada em localStorage.

### 4.5 Painel: visão geral (`/painel`)
```
┌─ sidebar 240px ─┬──────────────────────────────────────────────────┐
│ [avatar] Ana    │ A paz, Ana!                               (h1)   │
│ Min. de Música  │ ──── ✣ ────                                      │
│ ─────────────── │ ┌ Próxima missa ─────────────────────────────┐   │
│ ⌂ Visão geral   │ │ 25º Domingo do TC · dom 28/09 · 10h         │   │
│ ♫ Minhas Missas │ │ 9 de 10 momentos preenchidos ▓▓▓▓▓▓▓▓▓░     │   │
│ + Nova missa    │ │ [Continuar editando]  [⤢ Abrir Modo Missa]  │   │
│ 👤 Meu perfil   │ └─────────────────────────────────────────────┘   │
│ ─────────────── │ Missas recentes  [card][card][card]  Ver todas → │
│ ↪ Sair          │ Cantos que você mais usa  [lista 5 itens]        │
└─────────────────┴──────────────────────────────────────────────────┘
```
No mobile, a sidebar vira a barra inferior de 4 itens (ver seção 3).

### 4.6 Meu perfil (`/painel/perfil`)
Seções em cards empilhados, com largura máxima de 640px:
```
┌ Dados pessoais ─────────────────────────────┐
│ [avatar 72px] Alterar foto                   │
│ Nome     [Ana Souza                    ]     │
│ E-mail   [ana@exemplo.com              ]     │
│                          [Salvar alterações] │
├ Paróquia e ministério ───────────────────────┤
│ Paróquia   [Catedral São João Batista ▾]     │
│ Ministério [Música ▾]  Função [Violão ▾]     │
│ Instrumento/voz padrão → usado no Modo Missa │
├ Segurança ───────────────────────────────────┤
│ Senha atual [____] Nova [____] Confirmar [__]│
│ (medidor de força)            [Alterar senha]│
├ Preferências ────────────────────────────────┤
│ Tema: (Claro)(Escuro)(Sistema)               │
│ Notação: (C D E)(Dó Ré Mi)   ♯/♭ padrão      │
└──────────────────────────────────────────────┘
```
- Cada card tem seu próprio botão "Salvar", que fica desabilitado até haver mudança. Ao salvar, um toast diz "Perfil atualizado".
- Ao tentar sair com alterações não salvas, um diálogo de confirmação aparece.

### 4.7 Minhas Missas (`/painel/missas`)
```
Minhas Missas                         [+ Nova missa]
[🔍 Buscar missa]  [Próximas | Passadas | Todas]
┌───────────────────────────────────────────────────┐
│▌ 25º Domingo do Tempo Comum        dom, 28 set    │
│  10 cantos · Ano B · editada há 2 h               │
│  [⤢ Modo Missa] [✎ Editar] [⋯ Duplicar/Compartilhar/Excluir]│
└───────────────────────────────────────────────────┘
```
- A faixa ▌ usa a cor do tempo litúrgico da data.
- Excluir pede confirmação e oferece "Desfazer" no toast por 6s.
- Duplicar cria "Cópia de …" com a data vazia e abre o editor.

### 4.8 Montar Missa: editor (`/painel/missas/nova`)
**Desktop**: coluna de momentos à esquerda (cerca de 60%) e painel seletor à direita (cerca de 40%, sticky).
```
┌──────────────────────────────────────────────────────────────────────┐
│ Nome [25º Domingo do Tempo Comum_______]  Data [28/09/2026 📅] [10:00]│
│ Tempo: ● Comum (auto pela data, editável)  Ano: B      Salvo ✓ há 5s │
├───────────────────────────────────────┬──────────────────────────────┤
│ ⠿ 1 VELAS           [+ Escolher canto]│ Escolher para: ENTRADA       │
│ ⠿ 2 ENTRADA  ◀ ativo                  │ 🔍 [Buscar em Entrada…]      │
│    Nº 012 Vós sois o sal da terra     │ [Entrada ✕][● Comum ✕]       │
│    Tom D → E (+2)   [👁][⇄ trocar][✕] │ ☐ mostrar todos os momentos  │
│ ⠿ 3 ATO PENITENCIAL [+ Escolher canto]│ ┌──────────────────────────┐ │
│ ⠿ 4 GLÓRIA          Nº 201 Glória a…  │ │ Nº 012 Vós sois o sal… ✓ │ │
│ ⠿ 5 SALMO    (sugestão: Salmos Ano B) │ │ Nº 017 Senhor, eis aqui  │ │
│ ⠿ 6 ACLAMAÇÃO                         │ │ [▶ ouvir] [👁 ver letra] │ │
│ ⠿ 7 PRECES DA COMUNIDADE              │ │          [Escolher]      │ │
│ ⠿ 8 OFERTÓRIO                         │ └──────────────────────────┘ │
│ ⠿ 9 COMUNHÃO    [+ 2º canto]          │                              │
│ ⠿10 SAÍDA                             │                              │
│ ── Cantos adicionais ──               │                              │
│ [+ Adicionar momento/canto extra]     │                              │
├───────────────────────────────────────┴──────────────────────────────┤
│ [Pré-visualizar]     [Compartilhar]      [⤢ Abrir no Modo Missa]     │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobile**: lista de momentos em tela cheia. Tocar em "+ Escolher canto" abre o **SlotPicker** como bottom sheet a 90% da altura.

Comportamento:
- Os 10 momentos padrão já vêm listados. Vazios aparecem com borda tracejada `border` e o texto "+ Escolher canto".
- **SlotPicker**: pré-filtrado pelo momento do slot e pelo tempo da data (chips removíveis). Para Salmo e Aclamação, filtra também pelo Ano. A busca é a mesma da listagem. "Mostrar todos os momentos" remove o filtro de momento.
- Escolher um canto preenche o slot e avança o foco para o próximo slot vazio (o picker continua aberto no desktop, fecha no mobile).
- Cada slot aceita vários cantos (ex.: 2 de Comunhão). Rótulos de momento extra podem ser editados ("Ação de graças", "Aspersão", "Coroação de Nossa Senhora").
- **Reordenar**: arrastar pela alça ⠿ (dnd-kit), por teclado (foco na alça, espaço, ↑/↓, espaço) ou pelo menu ⋯ (Mover para cima/baixo). O que se move é o slot inteiro; um canto pode ser arrastado entre slots.
- **Tom por missa**: transposição salva no item, sem alterar o canto original.
- Autosave com debounce de 1s e indicador "Salvando… / Salvo ✓". O nome é obrigatório; se vazio, usa "Missa de dd/mm".
- Remover um canto mostra toast com "Desfazer".

### 4.9 Modo Missa (`/missa/[id]`), foco em tablet
Tela cheia (Fullscreen API ao entrar), sem header do site, Wake Lock ativo, paleta do Modo Missa.

**Paisagem (≥ 1024×768)**
```
┌───────────────┬──────────────────────────────────────────────────────┐
│ ROTEIRO       │ ENTRADA · 2/10                     ☾  Aa−  Aa+  ✕    │
│ 1 Velas     ✓ │ Vós sois o sal da terra                 Tom: E [−][+]│
│▶2 Entrada     │──────────────────────────────────────────────────────│
│ 3 Ato Pen.    │   E              B        C#m                        │
│ 4 Glória      │ Vós sois o sal da terra, vós sois                    │
│ 5 Salmo       │   A          B7        E                             │
│ 6 Aclamação   │ a luz do mundo…                                      │
│ 7 Preces      │                         (rolagem vertical)           │
│ 8 Ofertório   │                                                      │
│ 9 Comunhão    │                                                      │
│10 Saída       │                                                      │
│ [◀ recolher]  │                                                      │
├───────────────┴──────────────────────────────────────────────────────┤
│ [ ◀  Ato Penitencial ]   ●●◉○○○○○○○   [  Glória  ▶ ]  (72px)         │
└──────────────────────────────────────────────────────────────────────┘
```
**Retrato (768×1024)**
```
┌──────────────────────────────────────┐
│ ☰  ENTRADA · 2/10      ☾  Aa  Tom ✕  │ 64px
│ Vós sois o sal da terra              │
├──────────────────────────────────────┤
│   E              B        C#m        │
│ Vós sois o sal da terra, vós sois    │
│   …                                  │
│                                      │
├──────────────────────────────────────┤
│ [◀ Ato Pen.]  ●●◉○○○○○○○ [Glória ▶] │ 72px
└──────────────────────────────────────┘
```
- **Navegação**: swipe horizontal (limiar de 60px e velocidade mínima; nunca dispara durante a rolagem vertical), setas ←/→, PageUp/PageDown e **pedal Bluetooth** (que envia essas teclas). Em ↓ e espaço, a letra rola uma tela.
- Toques nos 15% laterais da área da letra também navegam (configurável; desligado por padrão para evitar toques acidentais).
- **Lista lateral**: fixa em paisagem (240px, pode ser recolhida), drawer via ☰ em retrato. O item atual tem fundo `primary-soft` e ▶, os já tocados recebem ✓. Um toque vai direto ao canto.
- **Indicador do momento**: caption grande "ENTRADA · 2/10" no topo e dots embaixo. Os botões ◀/▶ mostram o nome do momento vizinho.
- **Aa−/Aa+**: passos de 2px, de 18 a 56px, com valor persistido por dispositivo. **Tom**: popover com −/+ grandes (64px), que salva na missa.
- **☾ Noturno**: alterna Dia → Noite → Sépia. O padrão segue `prefers-color-scheme`.
- **Autoajuste**: se o canto couber em 1 tela com fonte ≥ 22px, não há rolagem. Em paisagem, se sobrar largura, a letra é dividida em 2 colunas (toggle "2 colunas").
- **Tela sempre acesa**: Wake Lock API. Se não houver suporte, mostrar aviso discreto "Desative o bloqueio automático do tablet".
- **Controles**: somem após 4s sem interação (sobra só a barra inferior em 40% de opacidade); um toque os traz de volta.
- ✕ sai com confirmação apenas se a missa não terminou.
- **Offline**: ao abrir, todos os cantos da missa ficam em cache (Service Worker). Sem conexão, aparece o selo "Disponível offline ✓".
- Todos os alvos têm no mínimo 56×56px e espaçamento mínimo de 12px entre eles.

---

## 5. Componentes

| Componente | Anatomia e especificação |
|---|---|
| **SongCard** | Faixa de tempo de 4px, "Nº 045" (serif, gold-ink), título (serif 20px), linha de chips (momentos/tempos, até 3 + "+2"), trecho da letra quando o match foi na letra, ícones de recursos (♪ 𝄞 ▶, esmaecidos quando ausentes, com `aria-label`), ações ▶ prévia e + Missa. O card todo é um link. Hover: `shadow-2` e sobe 1px. Variantes: `list` (linha densa, 64px) e `grid`. |
| **SearchInput** | 48px (56px no hero), ícone à esquerda, ✕ para limpar, atalho `/` ou `⌘K` para focar, `role="search"`. |
| **FilterBar** (desktop) / **FilterDrawer** (mobile) | Grupos colapsáveis com título em caption. Checkbox + contagem, toggles de ano como segmented control, Tema como lista com busca interna. O drawer é um bottom sheet a 90% da altura, com rodapé fixo "Limpar" e "Ver 48 cantos" (a contagem atualiza ao vivo). |
| **Chip** | Altura de 32px (40px no touch), raio full, padding de 12px. Variantes: `filter` (removível, ✕ com alvo de 24px e `aria-label="Remover filtro Páscoa"`), `tag` (link), `season` (bolinha colorida + borda na cor do tempo, fundo soft), `toggle` (selecionado: fundo `primary-soft`, borda `primary`, ✓). |
| **ChordSheet** | Recebe texto com acordes. Parse em linhas `chord` e `lyric` agrupadas por par. Props: `transpose`, `fontSize`, `showChords`, `notation`, `twoColumns`. Rótulos de seção (Refrão/Estrofe) detectados e estilizados. Os acordes não são lidos pelo leitor de tela, que recebe só a letra (acordes com `aria-hidden` e versão alternativa "Ler cifra" disponível). |
| **Transposer** | `[−] Ré (D) [+]` + ↺. Botões de 40px (64px no Modo Missa). Anuncia "Tom: Mi" via `aria-live="polite"`. Tooltip com o intervalo "+2 semitons". |
| **FontSizer** | `Aa− / Aa+` com valor numérico em tooltip. Mesmos tamanhos de alvo do Transposer. |
| **PdfViewer** | `react-pdf` ou `<iframe>` nativo como fallback. Toolbar: página x/y, zoom −/+/ajustar à largura, tela cheia, baixar. Carregamento com skeleton da página (proporção A4). Em caso de erro: "Não foi possível exibir a partitura" + [Baixar PDF]. |
| **AudioPlayer** | Compacto (barra de 64px: ▶, título, progresso, tempo) e completo (+ velocidade, loop A–B, volume). Um único áudio global: iniciar outro pausa o anterior. Media Session API para controles na tela de bloqueio. |
| **MiniPlayer** | Barra fixa inferior, acima da barra mobile, com ✕ para fechar. Persiste entre páginas. |
| **AddToMassPopover** | Lista de missas (próximas primeiro), seletor de momento (sugerido pela categoria) e "Nova missa…". Feedback: toast "Adicionado a 25º Dom. TC · Comunhão" com [Abrir]. |
| **MassSlot** | Alça ⠿, número, rótulo do momento (caption), cantos (título + tom), ações. Vazio: tracejado + CTA. Ativo: borda `gold` de 2px. |
| **SlotPicker** | Painel/sheet com cabeçalho "Escolher para: X", busca, chips pré-aplicados, lista de SongCards `list` com [▶][👁][Escolher]. Um canto já escolhido aparece com ✓ e o botão vira "Escolhido". |
| **MassModeNav** | Barra inferior (◀ anterior com nome, dots clicáveis, próximo ▶) + lista lateral + gestos. |
| **MassModeToolbar** | Momento/índice, título, Tom, Aa, ☾, ✕. Some automaticamente. |
| **Toast** | Canto inferior central (mobile) ou inferior direito (desktop), 4s (6s quando há "Desfazer"), `role="status"`. |
| **Ornament** | `<Divider variant="cross|diamond" />`, `<DropCap />`, `<CornerFrame />`. |
| **EmptyState / ErrorState / Skeleton** | Ver 5.3. |

### 5.1 Botões
- **Primário**: fundo `primary-solid`, texto `#FFFDF8`, altura de 44px (48px no mobile), raio md, Inter 600 15px.
- **Secundário**: borda `primary` de 1px, texto `primary`, fundo transparente. Hover: `primary-soft`.
- **Ghost**: só texto e ícone. **Perigo**: texto `danger` ou fundo `danger` em confirmações.
- Ícones: Lucide, com traço de 1.75 e tamanho de 20px (24px no Modo Missa).

### 5.2 Formulários
Label acima do campo (14px, 500), input de 44px com fundo `surface`, borda `border` e raio sm. Foco: borda `primary` + anel `gold`. Erro: borda `danger` + mensagem com ícone. O placeholder nunca substitui o label.

### 5.3 Estados
| Estado | Tratamento |
|---|---|
| **Carregando lista** | 6 skeletons de SongCard (blocos `surface-2` com shimmer suave). Não usar spinner de página. |
| **Carregando detalhe** | Skeleton do título + 12 linhas alternando curta/longa, simulando cifra. |
| **Busca vazia** | Cruz ✣ em `gold` + "Nenhum canto encontrado para "xyz"." + sugestões: "Tente sem acentos", "Remover filtro Páscoa" (botões), [Limpar filtros]. |
| **Missas vazias** | Ilustração de linha (cálice/partitura) + "Você ainda não montou nenhuma missa." + [Montar minha primeira missa]. |
| **Slot vazio** | Tracejado + "+ Escolher canto" (não é erro). |
| **Recurso ausente** | Aba desabilitada + texto "Partitura ainda não disponível para este canto." |
| **Erro de rede** | Banner `danger` suave no topo: "Não conseguimos carregar. Verifique sua conexão." [Tentar de novo]. |
| **404 canto** | "Este canto não foi encontrado." + busca + link para Cantos. |
| **Offline** | Selo discreto no header: "Sem conexão, mostrando cantos salvos". |

---

## 6. Responsividade e acessibilidade

### Breakpoints (Tailwind)
| Faixa | Layout |
|---|---|
| `< 640` (mobile) | 1 coluna, filtros em drawer, ações do detalhe em barra inferior, SlotPicker em bottom sheet, painel com tab bar inferior. |
| `640–1023` (tablet) | Listagem em 2 colunas (grade) ou lista, filtros em drawer lateral de 360px, detalhe com player abaixo das abas. **Modo Missa em retrato como alvo principal.** |
| `≥ 1024` (desktop) | Sidebar de filtros de 280px, detalhe com coluna lateral de 320px, editor em 2 painéis. Modo Missa em paisagem. |
| `≥ 1440` | Conteúdo limitado a 1200px, centralizado. |

### Acessibilidade (meta: WCAG 2.2 AA)
- Contraste: `ink` sobre `bg` 14:1, `primary` sobre `bg` 11:1. `gold` é usado **só em decoração**; texto dourado usa `gold-ink` (≥ 4.5:1).
- Foco visível em tudo (anel dourado de 2px). Ordem de tab lógica e "Pular para o conteúdo" como primeiro link.
- Alvos: ≥ 44×44 no site e ≥ 56×56 no Modo Missa.
- Não usar cor como único sinal: os tempos litúrgicos sempre têm texto junto da bolinha.
- As abas usam o padrão ARIA `tablist` (setas navegam). Drawers e modais prendem o foco e fecham com `Esc`.
- A contagem de resultados é anunciada via `aria-live="polite"` ("48 cantos encontrados").
- Drag-and-drop tem alternativa por teclado e por menu.
- `lang="pt-BR"`. Os acordes ficam ocultos para leitor de tela por padrão.
- Suporte a zoom de 200% sem perda e a `prefers-reduced-motion` e `prefers-color-scheme`.

---

## 7. Microinterações e tom de voz

### Microinterações
- **Chip adicionado**: entra com scale 0.9→1 e fade em 120ms. **Removido**: colapsa a largura em 120ms.
- **Contagem de resultados**: o número faz crossfade (sem contador rolando).
- **Transposição**: os acordes piscam em `gold-soft` por 200ms ao mudar de tom.
- **Adicionar à missa**: o ícone + vira ✓ por 1.2s e o toast aparece.
- **Slot preenchido**: o slot recebe realce `primary-soft` que desaparece em 600ms, e o foco passa ao próximo slot vazio.
- **Arrastar**: o item levantado ganha `shadow-3` e rotação de 1°, e o espaço de destino abre com animação.
- **Modo Missa**: a transição entre cantos é um slide horizontal de 200ms (fade com reduced motion). No último canto, o ▶ vira "Fim ✣" e leva a uma tela final ("Missa concluída. Deus seja louvado!" + [Voltar ao painel]).
- **Autosave**: "Salvando…" com pontinhos, depois "Salvo ✓" em `success`, que esmaece para `ink-muted` após 2s.
- **Tema**: troca com transição de 200ms em `background-color` e `color`.

### Tom de voz
- Acolhedor, simples e respeitoso. Trata a pessoa por "você", sem jargão técnico e sem excesso de exclamações. Termos litúrgicos corretos, com maiúsculas: Tempo Comum, Ato Penitencial, Santo, Cordeiro.
- Saudação no painel: "A paz, {nome}!" (manhã/tarde/noite não é necessário).

| Situação | Texto |
|---|---|
| Placeholder da busca | "Busque por título, número ou trecho da letra" |
| Resultado | "48 cantos" / "1 canto" / "Nenhum canto encontrado" |
| CTA da home | "Monte sua Missa" · "Começar agora" |
| Adicionado | "Adicionado à missa de domingo · Comunhão" |
| Removido | "Canto removido. [Desfazer]" |
| Login (erro) | "E-mail ou senha não conferem. Tente de novo." |
| Senha fraca | "Use pelo menos 6 caracteres." |
| Perfil salvo | "Tudo certo, seu perfil foi atualizado." |
| Excluir missa | "Excluir "25º Domingo do Tempo Comum"? Você poderá desfazer logo em seguida." [Excluir] [Cancelar] |
| Wake Lock indisponível | "Seu aparelho pode apagar a tela. Desative o bloqueio automático nas configurações." |
| Fim do Modo Missa | "Missa concluída. Deus seja louvado!" |
| Rodapé | "Quem canta reza duas vezes." |

Formatos: datas em "dom, 28 set" (curto) e "domingo, 28 de setembro de 2026" (longo). Hora em "10h" ou "19h30". Número do canto sempre com 3 dígitos ("Nº 007").
