# Planejamento — Novo Site de Cantos da Paróquia Catedral São João Batista

> Documento de produto e arquitetura (PO). Versão 1.0 — 24/09/2026.
> Site atual: https://cantos.psjb.org.br/ ("Livros de cantos Alegres Cantemos").

---

## 1. Visão do produto

**Visão:** ser o livro de cantos digital da Paróquia. Rápido, bonito e fiel à tradição católica, para que fiéis e ministérios de música encontrem, estudem e executem os cantos da liturgia sem depender de papel.

**Problemas do site atual**
- Página PHP única com uma lista enorme de cantos e carregamento pesado (embeds Audiomack, jQuery, Bootstrap).
- Filtro por **uma única categoria** num dropdown que mistura momento, tempo e ano litúrgico (ex.: "Comunhão - Quaresma").
- Cifra e partitura só abrem via download de PDF; a leitura no celular ou tablet é ruim.
- Não é possível planejar a missa nem usar o site durante a celebração.

**Objetivos (mensuráveis)**
| # | Objetivo | Métrica |
|---|----------|---------|
| O1 | Encontrar um canto rapidamente | ≤ 3 interações até abrir o canto; busca com resposta < 100 ms |
| O2 | Performance excelente | LCP < 2,0 s em 4G; CLS < 0,05; INP < 200 ms; Lighthouse ≥ 95 |
| O3 | Ver cifra, partitura e áudio no próprio site | 100% dos cantos com mídia visualizável sem download |
| O4 | Planejar a missa | Montar uma missa completa em < 5 min |
| O5 | Substituir papel na celebração | Modo Missa usável em tablet, com a tela sempre acesa |

### 1.1 Personas
| Persona | Perfil | Necessidades principais |
|---------|--------|------------------------|
| **Fiel / visitante** | Celular, pouca familiaridade técnica | Achar a letra, ouvir o canto, fonte legível |
| **Músico (ministério de música)** | Violão, teclado; celular e tablet | Cifra com transposição, partitura, áudio de referência, Modo Missa |
| **Coordenador(a) de liturgia** | Planeja as celebrações da semana | Filtrar por tempo, momento e ano (A/B/C); montar e compartilhar a missa |
| **Administrador(a)** | Secretaria ou Pascom | Hoje: login ilustrativo e perfil. Futuro: CRUD de cantos e uploads |

---

## 2. Escopo

### 2.1 Fase 1: visual / mock (ESTA FASE)
**Inclui**
- Monorepo com `apps/web` (Next.js), `apps/api` (Fastify stub) e `data/` (JSONs).
- Home, listagem com busca e filtros multidimensionais, e detalhe do canto (letra+cifra, partitura, áudio).
- Login ilustrativo (sem API) e tela de perfil para alterar os dados do usuário padrão (a alteração persiste no navegador).
- "Monte sua Missa" com persistência em `localStorage`.
- Modo Missa: tela cheia, fonte ajustável, transposição, swipe/setas, Wake Lock, tema claro/escuro.
- API com uma rota de teste que retorna uma string.
- Uma amostra de dados (cerca de 20–40 cantos) migrada manualmente para `data/songs.json`, cobrindo todas as dimensões.

**Não inclui:** banco de dados, autenticação real, CRUD, upload, PWA offline, compartilhamento por link.

### 2.2 Fases futuras
| Fase | Entrega |
|------|---------|
| 2 | API real (Fastify) servindo os dados; `lib/data` passa a consumir a API; importação completa dos cantos antigos |
| 3 | Banco de dados (PostgreSQL + ORM, ex.: Prisma/Drizzle) e autenticação real (hash + cookie httpOnly) |
| 4 | Painel admin: CRUD de cantos e taxonomias; upload de PDFs e áudios (storage S3-compatível) |
| 5 | PWA offline (cache de cantos e missas salvas), compartilhar missa por link, missas salvas no servidor |
| 6 | Extras: calendário litúrgico automático (sugerir tempo e ano do domingo), favoritos, impressão/PDF da missa |

---

## 3. Modelo de dados

### 3.1 Taxonomia multidimensional
A categoria única atual se divide em **dimensões independentes**. Um canto pode ter vários valores em cada uma.

| Dimensão (`type`) | Valores (exemplos) | Origem no site atual |
|---|---|---|
| `momento` | refrao-orante, velas, entrada, ato-penitencial, gloria, salmo, aclamacao, preces, ofertorio, santo, cordeiro, comunhao, saida, sequencia, creio | "Abertura", "Comunhão", "Santo"... |
| `tempo` | advento, natal, quaresma, semana-santa, triduo-pascal, pascoa, tempo-comum | sufixos "- Advento", "- Páscoa"... |
| `ano` | A, B, C | "Salmos/Aclamações - ANO A/B/C" |
| `celebracao` | domingo-de-ramos, quinta-feira-santa, sexta-feira-santa, vigilia-pascal, exequias | "Semana Santa", "Tríduo", "Exéquias" |
| `tema` | criancas, espirito-santo, familia, marianos, meditacao-louvor, movimentos, palavra, paz, perdao, santos, vocacionais-missao | "Cantos diversos - ..." |

**Exemplo de mapeamento:** "Comunhão - Quaresma" passa a ser `momento: comunhao` + `tempo: quaresma`.

### 3.2 TypeScript (contratos compartilhados)
```ts
type TaxonomyType = 'momento' | 'tempo' | 'ano' | 'celebracao' | 'tema';

interface Category {
  id: string;            // "comunhao"
  type: TaxonomyType;
  label: string;         // "Comunhão"
  order: number;         // ordem de exibição
  description?: string;
}

interface Song {
  id: string;            // "001"
  number: number;        // 1
  slug: string;          // "001-a-feliz-espera"
  title: string;         // "A feliz espera"
  subtitle?: string;     // referência bíblica (salmos) ou autor
  authors?: string[];
  key?: string;          // tom original, ex.: "D"
  categories: Record<TaxonomyType, string[]>; // ids por dimensão
  lyricsChords: string;  // ChordPro (fonte única de letra + cifra)
  media: {
    audioUrl?: string;       // mp3
    audiomackUrl?: string;   // embed legado (opcional)
    chordsPdfUrl?: string;   // PDF da cifra
    scorePdfUrl?: string;    // PDF da partitura
  };
  createdAt: string;     // ISO
  updatedAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  password: string;      // Fase 1: texto puro, apenas ilustrativo. Fase 3: passwordHash (argon2/bcrypt)
  role: 'admin' | 'musico' | 'coordenador';
  avatarUrl?: string;
}

type MassSlotKey = 'velas' | 'entrada' | 'ato-penitencial' | 'gloria' | 'salmo'
  | 'aclamacao' | 'preces' | 'ofertorio' | 'comunhao' | 'saida' | 'adicional';

interface MassSlot {
  key: MassSlotKey;
  label: string;         // "Entrada" (editável para os adicionais)
  songId: string | null;
  transpose?: number;    // semitons (-6..+6), salvo por canto na missa
  notes?: string;        // ex.: "cantar só 2 estrofes"
  order: number;
}

interface Mass {
  id: string;            // uuid
  title: string;         // "Missa 3º Domingo do Advento — 10h"
  date?: string;         // ISO
  tempo?: string;        // id de Category (tempo)
  ano?: 'A' | 'B' | 'C';
  slots: MassSlot[];
  createdAt: string;
  updatedAt: string;
}
```

### 3.3 Formato de letra e cifra
- **Padrão ChordPro** (`[D]A feliz es[A]pera`): permite transposição, renderizar os acordes acima da sílaba, ocultar a cifra (modo "só letra") e buscar pelo texto.
- A migração converte a cifra "acordes acima da linha" do site atual em ChordPro com um script (Fase 2), com revisão manual.

### 3.4 Arquivos em `data/`
```
data/
  songs.json        # Song[]
  categories.json   # Category[]
  user.json         # User (usuário padrão ilustrativo)
  media/            # (opcional, Fase 1) PDFs/mp3 de amostra; em produção vão para storage/CDN
```
Exemplo `songs.json` (trecho):
```json
[{
  "id": "001", "number": 1, "slug": "001-a-feliz-espera",
  "title": "A feliz espera", "key": "D",
  "categories": { "momento": ["entrada"], "tempo": ["advento"], "ano": [], "celebracao": [], "tema": [] },
  "lyricsChords": "{title: A feliz espera}\n[D]A feliz es[A]pera...",
  "media": { "audioUrl": "/media/001.mp3", "chordsPdfUrl": "/media/001-cifra.pdf", "scorePdfUrl": "/media/001-partitura.pdf" },
  "createdAt": "2026-09-24T00:00:00Z", "updatedAt": "2026-09-24T00:00:00Z"
}]
```

---

## 4. Épicos e histórias de usuário

### E1. Listagem, busca e filtros
**US1.1:** Como fiel, quero buscar pelo número, título ou trecho da letra para achar o canto rapidamente.
- [ ] A busca ignora acentos e maiúsculas ("gloria" encontra "Glória").
- [ ] Um número ("12" ou "012") leva ao canto correspondente no topo.
- [ ] Os resultados atualizam enquanto digito (debounce ≤ 150 ms), sem recarregar a página.

**US1.2:** Como coordenador, quero combinar filtros de momento, tempo, ano, celebração e tema.
- [ ] Filtros multisseleção por dimensão: E entre dimensões, OU dentro da mesma dimensão.
- [ ] Os filtros ativos aparecem como "chips" removíveis, com um botão "Limpar filtros".
- [ ] O estado fica refletido na URL (`/cantos?momento=comunhao&tempo=quaresma`), para compartilhar e usar o voltar do navegador.
- [ ] Cada opção mostra a contagem de cantos.
- [ ] No mobile, os filtros abrem num painel (drawer); no desktop, numa barra lateral.

**US1.3:** Como usuário, quero navegar por atalhos (ex.: "Cantos da Quaresma", "Salmos Ano B") na home.
- [ ] A home tem cartões de acesso rápido por tempo litúrgico e por momento.

**US1.4:** Como usuário, quero ver na lista os indicadores de mídia (áudio, cifra, partitura).
- [ ] Cada item mostra número, título, as tags principais e ícones das mídias disponíveis.
- [ ] Ordenar por número (padrão) ou por título.

### E2. Detalhe do canto
**US2.1:** Como músico, quero ver a letra com a cifra no site, com a opção de transpor o tom.
- [ ] Os acordes aparecem alinhados acima da sílaba, em fonte monoespaçada ou com posicionamento preciso.
- [ ] Botões −/+ para transpor em semitons, com exibição do tom atual e "voltar ao original".
- [ ] Alternar entre "Letra + cifra" e "Só letra".
- [ ] Ajuste do tamanho da fonte.

**US2.2:** Como músico, quero visualizar a partitura e a cifra em PDF sem baixar.
- [ ] Visualizador embutido com carregamento lazy (só ao abrir a aba).
- [ ] Um botão "Baixar" continua disponível.

**US2.3:** Como fiel, quero ouvir o áudio no próprio site.
- [ ] Player nativo `<audio preload="none">` com controles acessíveis.
- [ ] O embed do Audiomack, se mantido, só carrega após clique (facade).

**US2.4:** Como usuário, quero ver as categorias do canto e navegar para cantos relacionados.
- [ ] As tags levam à listagem já filtrada.
- [ ] Botões "anterior/próximo" pela numeração.
- [ ] Botão "Adicionar à minha missa" (escolher o momento).

### E3. Login ilustrativo
**US3.1:** Como admin, quero entrar com usuário e senha para acessar o painel.
- [ ] O formulário valida no cliente contra `data/user.json` (ou contra a versão alterada no `localStorage`).
- [ ] Credenciais inválidas mostram uma mensagem clara; as válidas redirecionam para `/painel`.
- [ ] A sessão fake fica em `localStorage` + cookie não sensível (`psjb_session=1`) para o middleware redirecionar.
- [ ] Um aviso visível diz: "Ambiente de demonstração, login ilustrativo".
- [ ] Botão "Sair" limpa a sessão.

### E4. Perfil
**US4.1:** Como admin, quero alterar nome, e-mail, usuário e senha do usuário padrão.
- [ ] O formulário tem validação (e-mail válido; senha ≥ 8 caracteres; confirmação de senha).
- [ ] Os dados alterados são salvos em `localStorage` e passam a valer no login seguinte.
- [ ] Opção "Restaurar padrão" (volta ao `user.json`).

### E5. Monte sua Missa
**US5.1:** Como coordenador ou músico, quero criar uma missa e escolher um canto para cada momento.
- [ ] Momentos padrão, nesta ordem: Velas, Entrada, Ato Penitencial, Glória, Salmo, Aclamação ao Evangelho, Preces da Comunidade, Ofertório, Comunhão, Saída.
- [ ] Ao escolher o canto de um momento, abre um seletor com busca, já pré-filtrado pelo momento (e pelo tempo e ano da missa, se definidos).
- [ ] Posso adicionar "cantos adicionais" com rótulo livre (ex.: "Ação de graças").
- [ ] Posso reordenar (arrastar ou botões ↑↓), remover e trocar cantos.
- [ ] Posso definir título, data, tempo e ano da missa.

**US5.2:** Como usuário, quero salvar e gerenciar várias missas.
- [ ] Lista "Minhas missas" com editar, duplicar e excluir (com confirmação).
- [ ] Persistência em `localStorage` (chave versionada `psjb:masses:v1`).
- [ ] Botão "Iniciar Modo Missa".

### E6. Modo Missa (tablet)
**US6.1:** Como músico, quero usar o tablet durante a missa em vez do livro.
- [ ] Tela cheia (Fullscreen API) com interface mínima; o cabeçalho indica o momento ("Entrada · 2/11").
- [ ] Navegação por swipe, setas do teclado e pedal Bluetooth (que envia setas ou PageUp/PageDown).
- [ ] Fonte ajustável (A−/A+), lembrada entre sessões.
- [ ] Transposição por canto, salva na missa.
- [ ] Tela sempre acesa com a Wake Lock API, com fallback silencioso e um aviso quando o navegador não suporta.
- [ ] Tema claro/escuro (o escuro é útil em igrejas com pouca luz).
- [ ] Player de áudio acessível no canto atual.
- [ ] Um índice lateral permite pular para qualquer momento.
- [ ] Alvos de toque ≥ 48×48 px.

**US6.2 (futuro):** funcionar offline como PWA.

### E7. API stub
**US7.1:** Como dev, quero um projeto de API pronto para evoluir.
- [ ] `apps/api` em Fastify + TypeScript, com `npm run dev -w apps/api`.
- [ ] `GET /api/health` retorna `ok` e `GET /api/test` retorna `"API Cantos PSJB funcionando"` (text/plain).
- [ ] Porta configurável via `PORT` (padrão 3333); CORS configurado para a origem do web.
- [ ] Um teste automatizado da rota (via `fastify.inject`).

---

## 5. Mapa de rotas

### 5.1 Front-end (`apps/web`)
| Rota | Descrição | Renderização |
|------|-----------|--------------|
| `/` | Home: busca, atalhos por tempo e momento, destaques | SSG |
| `/cantos` | Listagem com busca e filtros (query params) | SSG + ilha client |
| `/cantos/[slug]` | Detalhe do canto (ex.: `/cantos/001-a-feliz-espera`) | SSG (`generateStaticParams`) |
| `/categorias/[tipo]/[id]` | Página indexável por categoria (ex.: `/categorias/tempo/quaresma`) | SSG |
| `/missa` | Minhas missas (lista) | Client |
| `/missa/nova` | Montar uma nova missa | Client |
| `/missa/[id]` | Editar a missa | Client |
| `/missa/[id]/apresentar` | Modo Missa (tela cheia) | Client |
| `/login` | Login ilustrativo | Client |
| `/painel` | Painel (protegido pela sessão fake) | Client |
| `/painel/perfil` | Alterar os dados do usuário padrão | Client |
| `/sobre` | Sobre o projeto e créditos | SSG |

### 5.2 API (`apps/api`)
| Método | Rota | Fase | Retorno |
|--------|------|------|---------|
| GET | `/api/health` | 1 | `ok` |
| GET | `/api/test` | 1 | string de teste |
| GET | `/api/songs`, `/api/songs/:slug` | 2 | JSON |
| GET | `/api/categories` | 2 | JSON |
| POST | `/api/auth/login`, `/api/auth/logout` | 3 | cookie httpOnly |
| GET/PUT | `/api/me` | 3 | usuário |
| POST/PUT/DELETE | `/api/songs[/:id]` | 4 | CRUD (admin) |
| POST | `/api/uploads` | 4 | URL assinada |
| CRUD | `/api/masses`, `GET /api/masses/share/:token` | 5 | missas e compartilhamento |

---

## 6. Arquitetura e boas práticas

### 6.1 Estrutura do monorepo (npm workspaces)
```
/
├─ package.json          # workspaces: ["apps/*", "packages/*"]
├─ data/                 # songs.json, categories.json, user.json
├─ apps/
│  ├─ web/               # Next.js (App Router, TS, Tailwind)
│  │  ├─ app/            # rotas
│  │  ├─ components/     # ui/ (primitivos), song/, mass/, layout/
│  │  ├─ lib/data/       # camada de acesso a dados (única que lê data/)
│  │  ├─ lib/chords/     # parser ChordPro + transposição
│  │  └─ lib/storage/    # wrappers de localStorage versionados
│  └─ api/               # Fastify + TS
└─ packages/
   └─ types/             # (opcional) tipos compartilhados Song/Category/Mass
```
**Por que estas escolhas:**
- **npm workspaces:** é nativo (sem ferramenta extra), permite compartilhar tipos e rodar scripts por app. Turborepo pode entrar depois, se o build crescer.
- **Next.js App Router + Server Components:** envia pouco JS ao cliente e dá SSG por canto (HTML pronto e cacheável em CDN), o que atende diretamente o requisito de rapidez.
- **Tailwind CSS:** CSS enxuto (purge automático), design tokens centralizados e produtividade.
- **Fastify:** o framework Node mais rápido e maduro, com validação por JSON Schema e TS de primeira classe. Fica preparado para a Fase 2.
- **`lib/data` isolada:** as telas chamam `getSongs()`, `getSongBySlug()` e `getCategories()`. Hoje essas funções leem os JSONs (via `fs`/`import` no servidor); amanhã farão `fetch` na API. **Nenhuma tela muda.**

### 6.2 Performance
- **SSG** de todas as páginas públicas; `generateStaticParams` para `/cantos/[slug]`. Quando houver API: **ISR** (`revalidate`) ou revalidação sob demanda após o CRUD.
- **Server Components por padrão;** `"use client"` apenas nas ilhas interativas (busca, filtros, transposição, player, Modo Missa).
- **Busca client-side com índice leve:** gerar no build um `search-index.json` com id, número, título, tags e as primeiras linhas da letra sem acentos (alvo < 150 KB gzip). Filtragem própria ou com MiniSearch/FlexSearch, carregada sob demanda.
- **next/font** (auto-hospedada, `display: swap`, subset latin) e **next/image** (logo e imagens com dimensões, AVIF/WebP).
- **Lazy load** de PDF (visualizador com `dynamic(() => import(...), { ssr: false })`, só ao abrir a aba) e de áudio (`preload="none"`); embeds de terceiros apenas via facade.
- Sem jQuery e sem bibliotecas pesadas; orçamento de **JS inicial ≤ 100 KB gzip** por rota pública.
- **Metas de Core Web Vitals (p75, mobile):** LCP < 2,0 s · INP < 200 ms · CLS < 0,05 · TTFB < 400 ms (CDN).
- Monitorar com Lighthouse CI no PR e `@vercel/speed-insights` ou web-vitals em produção.

### 6.3 Identidade visual (tradição + modernidade)
- **Paleta:** verde escuro do logo como cor primária, dourado discreto (litúrgico) como acento, fundo marfim/pergaminho no tema claro e grafite no escuro. As **cores litúrgicas** (roxo, branco, verde, vermelho, rosa) servem de marcador do tempo nas tags.
- **Tipografia:** serifada clássica nos títulos (ex.: Cormorant Garamond ou EB Garamond) e sans legível no corpo e na cifra (ex.: Inter; cifra em mono, como JetBrains Mono).
- Ornamentos sutis (filetes, capitular opcional); nada que prejudique a legibilidade.

### 6.4 Acessibilidade (WCAG 2.2 AA)
- Contraste ≥ 4.5:1 (texto) e ≥ 3:1 (componentes), validado nos dois temas.
- Navegação completa por teclado, foco visível e "pular para o conteúdo".
- HTML semântico, landmarks, `aria-live` na contagem de resultados e labels em todos os controles.
- Alvos de toque ≥ 48 px no Modo Missa (≥ 44 px no restante); respeitar `prefers-reduced-motion` e `prefers-color-scheme`.
- Zoom até 200% sem quebra; fonte base ≥ 16 px.

### 6.5 SEO
- `generateMetadata` por canto (título "001 – A feliz espera | Cantos PSJB", descrição com o início da letra, Open Graph e Twitter).
- `sitemap.xml` e `robots.txt` gerados pelo App Router; URLs canônicas; `lang="pt-BR"`.
- JSON-LD `MusicComposition` nos cantos; páginas de categoria indexáveis.
- Rotas `/painel`, `/login` e `/missa/*` com `noindex`.
- **Redirecionamentos 301** das URLs antigas relevantes, se existirem.

### 6.6 Segurança (preparação para auth real — Fase 3)
- A Fase 1 é **explicitamente insegura** (senha em JSON, validação no cliente): só para demonstração, sem dados reais.
- Fase 3: senhas com **argon2id** (ou bcrypt custo ≥ 12); sessão em **cookie httpOnly + Secure + SameSite=Lax** com JWT de curta duração + refresh rotativo (ou sessão no servidor); proteção contra CSRF; rate limit no login (`@fastify/rate-limit`); `@fastify/helmet`; validação de entrada com schema (Zod/TypeBox); upload com checagem de MIME e tamanho, e URLs assinadas.
- Segredos só via variáveis de ambiente (`.env` fora do git; `.env.example` versionado).
- Headers no Next: CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

### 6.7 Qualidade
- **TypeScript `strict`** (+ `noUncheckedIndexedAccess`) em todos os apps.
- **ESLint** (config Next + typescript-eslint) e **Prettier**; **Husky + lint-staged** no pre-commit.
- **Testes:** Vitest para as unidades (parser ChordPro, transposição, filtros, `lib/data`, storage); Testing Library para os componentes; **Playwright** para o E2E (busca → detalhe; montar missa → Modo Missa; login fake); `fastify.inject` para a API.
- **Validação dos JSONs** de `data/` com schema (Zod) num script `npm run validate:data`, rodado na CI.
- **CI (GitHub Actions):** lint, typecheck, testes, build e Lighthouse CI.

### 6.8 Convenções de código
- Código e identificadores em inglês; textos da interface em pt-BR (centralizados para uma eventual i18n).
- Componentes em `PascalCase.tsx`, hooks `useXxx.ts`, utilitários em `camelCase.ts`; um componente por arquivo.
- Commits no padrão **Conventional Commits** (`feat:`, `fix:`, `docs:`...); branches `feat/...`, `fix/...`; PR com revisão.
- Chaves de `localStorage` prefixadas e versionadas (`psjb:<nome>:v1`), com migração se o schema mudar.
- IDs de taxonomia em kebab-case, sem acentos.

---

## 7. Roadmap e checklist

### Fase 0: Fundação (≈ 1 semana)
- [ ] Criar o monorepo (npm workspaces), `.editorconfig`, `.nvmrc` (Node LTS), Prettier, ESLint e TS strict.
- [ ] Scaffold de `apps/web` (Next.js + Tailwind) e `apps/api` (Fastify + TS).
- [ ] API: `GET /api/health` e `GET /api/test` + teste.
- [ ] Definir os tipos e os schemas Zod; criar `data/categories.json` com todas as dimensões.
- [ ] Migrar manualmente 20–40 cantos de amostra para `data/songs.json` (ChordPro) e criar `user.json`.
- [ ] Configurar a CI.

### Fase 1: Visual / mock (≈ 3–4 semanas)
- [ ] Design system: tokens (cores, tipografia), temas claro/escuro, componentes base (Button, Chip, Input, Tabs, Drawer).
- [ ] Layout: header com logo, navegação e rodapé.
- [ ] `lib/data` + índice de busca gerado no build.
- [ ] Home e listagem com busca, filtros, chips e estado na URL.
- [ ] Detalhe do canto: renderizador ChordPro, transposição, só letra, fonte, PDF viewer lazy, player de áudio.
- [ ] Login ilustrativo, middleware de rota, painel e perfil.
- [ ] Monte sua Missa: CRUD local, seletor de canto filtrado, reordenação.
- [ ] Modo Missa: fullscreen, swipe/teclado, Wake Lock, fonte, transposição, tema.
- [ ] SEO (metadata, sitemap, JSON-LD), auditoria de acessibilidade e Lighthouse ≥ 95.
- [ ] Testes E2E dos fluxos principais; homologação com o cliente (músicos em tablet real).

### Fase 2: API e migração de dados
- [ ] Script de scraping e conversão do site atual (título, número, categorias → dimensões, cifra → ChordPro, links de mídia).
- [ ] Revisão manual das categorias pela equipe de liturgia.
- [ ] Endpoints de leitura na API; `lib/data` passa a consumir a API; ISR.

### Fase 3: Banco e auth real
- [ ] PostgreSQL + ORM, migrações e seeds a partir dos JSONs.
- [ ] Autenticação real (argon2 + cookie httpOnly) e perfis de acesso.

### Fase 4: Admin
- [ ] CRUD de cantos e taxonomias, editor ChordPro com pré-visualização.
- [ ] Upload de PDF/mp3 para storage + CDN.

### Fase 5: PWA e compartilhamento
- [ ] Service worker (ex.: Serwist): cache dos cantos e das missas para uso offline no Modo Missa.
- [ ] Missas no servidor; compartilhar por link (token), somente leitura.
- [ ] Opcional: calendário litúrgico automático.

---

## 8. Riscos e dúvidas em aberto

### 8.1 Riscos
| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Direitos autorais** de letras, cifras, partituras e áudios (editoras como Paulus e Paulinas, autores de movimentos) | Alto (jurídico) | Levantar as licenças; exibir os créditos; permitir ocultar a mídia por canto; ter um canal de remoção |
| Migração trabalhosa: cifras em texto livre, com categorias inconsistentes | Alto (prazo) | Script de conversão + revisão humana; migrar por lotes |
| Dependência do Audiomack (embed pesado, disponibilidade) | Médio | Priorizar mp3 próprio com `<audio>`; Audiomack como opcional via facade |
| Wake Lock/Fullscreen sem suporte (iOS antigo) | Médio | Detecção de recursos com fallback e instruções ("desative o bloqueio automático") |
| Login ilustrativo confundido com segurança real | Médio | Aviso explícito na interface; nenhum dado sensível; auth real na Fase 3 |
| Missas em `localStorage` se perdem ao limpar o navegador ou trocar de aparelho | Médio | Exportar/importar a missa em JSON na Fase 1; salvar no servidor na Fase 5 |
| PDFs grandes em conexões lentas | Baixo/Médio | Lazy load, compressão dos PDFs, CDN |

### 8.2 Dúvidas para o cliente
1. **Direitos autorais:** a paróquia tem autorização para publicar as letras, cifras, partituras e áudios? Algum conteúdo deve ficar restrito a usuários logados (ministério)?
2. **Migração:** existe um banco ou arquivo de origem do site atual (MySQL, planilha)? Quantos cantos existem hoje? Os PDFs e mp3 ficam em qual servidor?
3. **Numeração:** manter a numeração do livro "Alegres Cantemos" como identificador oficial? Há um livro impresso vinculado a ela?
4. **Hospedagem e domínio:** onde hospedar (Vercel, VPS da paróquia, outro)? Manter `cantos.psjb.org.br`? Quem administra o DNS?
5. **Identidade visual:** podemos receber o logo em vetor (SVG) e o manual de marca ou as cores oficiais?
6. **Taxonomia:** a divisão em momento, tempo, ano, celebração e tema está correta? Faltam momentos (ex.: Ação de Graças, Pai-Nosso, Aspersão)? A lista de momentos do "Monte sua Missa" é a mesma para todas as celebrações?
7. **Usuários:** quem vai usar o painel no futuro (quantas pessoas, quais perfis)? Missas montadas devem ser públicas, privadas ou compartilháveis?
8. **Áudio:** manter o Audiomack ou migrar tudo para mp3 próprio?
9. **Modo Missa:** quais tablets e navegadores o ministério usa (iPad, Android)? Usam pedal Bluetooth?
10. **Prazos e orçamento:** existe uma data-alvo (ex.: início do Advento) para o lançamento?
11. **LGPD:** haverá coleta de dados pessoais (cadastro de músicos)? É preciso política de privacidade e consentimento?
