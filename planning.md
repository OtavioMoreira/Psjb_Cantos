# Planejamento: novo site de cantos da Paróquia Catedral São João Batista

> Documento de produto e arquitetura (PO). **Versão 2.0, de 25/09/2026**, que reflete o que está implementado.
> Site antigo: https://cantos.psjb.org.br/ ("Livros de cantos Alegres Cantemos").
> Site novo (demonstração): https://otaviomoreira.github.io/Psjb_Cantos/
> Documentos relacionados: `ux.md` (design e layout), `CLAUDE.md` (contexto técnico) e `.claude/skills/psjb-regras-de-negocio/SKILL.md` (**regras de negócio**; em caso de dúvida, a skill prevalece).

**Legenda:** ✅ feito · 🟡 feito só no visual (depende de API ou banco) · 🔜 futuro

---

## 1. Visão do produto

**Visão:** ser o livro de cantos digital da Paróquia. Rápido, bonito e fiel à tradição católica, para que fiéis e ministérios de música encontrem, estudem e executem os cantos da liturgia **sem depender de livros e impressões**. O uso principal é em **celular e tablet**.

**Problemas do site antigo**
- Uma página PHP com uma lista enorme de cantos e carregamento pesado (embeds do Audiomack, jQuery, Bootstrap).
- Filtro por **uma única categoria** num dropdown que mistura momento, tempo e ano (ex.: "Comunhão - Quaresma").
- Cifra e partitura só abrem baixando o PDF, e a leitura no celular ou no tablet é ruim.
- Não é possível planejar a missa nem usar o site durante a celebração.

**Objetivos**
| # | Objetivo | Métrica | Situação |
|---|----------|---------|----------|
| O1 | Encontrar um canto rapidamente | ≤ 3 interações; busca instantânea | ✅ busca no cliente sem acento, com filtros |
| O2 | Performance | LCP < 2,0 s em 4G; CLS < 0,05; INP < 200 ms | ✅ páginas estáticas (SSG); 🔜 medir com Lighthouse CI |
| O3 | Ver cifra, partitura e áudio no site | mídia visualizável sem download | ✅ |
| O4 | Planejar a missa | missa completa em < 5 min | ✅ Monte sua Missa |
| O5 | Substituir o papel | Modo Missa no tablet e PDF para quem não tem | ✅ |

### 1.1 Personas
| Persona | Perfil | Necessidades principais |
|---------|--------|------------------------|
| **Fiel / visitante** | Celular, pouca familiaridade técnica | Achar a letra, ouvir o canto, fonte legível |
| **Músico** (ministério de música) | Violão ou teclado; celular e tablet | Cifra com transposição, partitura, áudio, Modo Missa, PDF |
| **Coordenador(a) de liturgia** | Planeja as celebrações da semana | Filtrar por momento, tempo e ano; montar e compartilhar a missa |
| **Administrador(a)** | Secretaria ou Pascom | Gerenciar usuários (bloquear, liberar, papéis); no futuro, cadastrar cantos |

---

## 2. Escopo

### 2.1 Fase 1: visual / mock (ATUAL, entregue)
- ✅ Monorepo com `apps/web` (Next.js 16), `apps/api` (Fastify, só com rotas de teste) e `data/` (JSONs).
- ✅ **121 cantos reais** extraídos do site antigo (primeira página de 14 categorias), com refrão marcado em 95 deles.
- ✅ Home, listagem com busca e filtros por 4 eixos, e detalhe do canto (cifra transponível, partitura, áudio).
- ✅ Monte sua Missa, Minhas Missas, **Modo Missa** (apresentação no tablet) e **PDF da missa**.
- 🟡 Acesso: entrar, criar conta (reCAPTCHA + confirmação de e-mail), recuperar senha, perfil.
- 🟡 **Admin de usuários:** bloquear, liberar, ativar, redefinir senha, papéis, convidar e excluir.
- ✅ Instalável na tela de início (manifest), com tema claro por padrão.
- ✅ Publicado no **GitHub Pages** (export estático) com deploy automático.
- ✅ Validado em 9 celulares e tablets.

**Fora da Fase 1:** banco de dados, API real, autenticação real, envio de e-mails, CRUD de cantos, upload, funcionamento offline por service worker e compartilhamento de missa entre aparelhos.

### 2.2 Fases futuras
| Fase | Entrega |
|------|---------|
| 2 | API real (Fastify) servindo cantos e categorias; `lib/data` passa a consumir a API; importação completa do acervo antigo |
| 3 | Banco (PostgreSQL + ORM), **autenticação JWT com 2FA por e-mail**, reCAPTCHA validado no servidor, serviço de e-mail, admin de usuários real + auditoria |
| 4 | Admin de cantos: CRUD, taxonomias, upload de PDF e MP3 (storage + CDN), marcação de refrão no editor |
| 5 | PWA offline (cantos das missas em cache), missas no servidor, compartilhar missa por link, sincronizar entre computador e tablet |
| 6 | Extras: favoritos, calendário litúrgico completo (solenidades e memórias), estatísticas de uso |

---

## 3. Modelo de dados

### 3.1 Taxonomia (4 eixos, vários valores por canto)
| Eixo | Campo | Valores atuais | Origem no site antigo |
|---|---|---|---|
| Momento da Missa | `moments` | velas, entrada, ato-penitencial, gloria, salmo, aclamacao, preces, ofertorio, santo, cordeiro, comunhao, saida | "Abertura", "Comunhão", "Santo"... |
| Tempo litúrgico | `seasons` | advento, natal, quaresma, pascoa, tempo-comum | sufixos "- Advento", "- Páscoa"... |
| Ano | `years` | A, B, C (só importa para Salmo e Aclamação) | "Salmos/Aclamações - ANO A/B/C" |
| Tema | `themes` | espirito-santo, mariano, paz, vocacional-missao (+ os demais "Cantos diversos" na migração) | "Cantos diversos - ..." |

"Comunhão - Quaresma" vira `moments: ["comunhao"]` + `seasons: ["quaresma"]`.

🔜 Para avaliar na migração: um eixo **celebração** (Domingo de Ramos, Tríduo, Exéquias) e momentos extras (Refrão orante, Creio, Sequência, Ação de graças).

### 3.2 Contratos TypeScript (`apps/web/src/lib/types.ts`)
```ts
type MomentId = 'velas' | 'entrada' | 'ato-penitencial' | 'gloria' | 'salmo' | 'aclamacao'
  | 'preces' | 'ofertorio' | 'santo' | 'cordeiro' | 'comunhao' | 'saida';
type SeasonId = 'advento' | 'natal' | 'quaresma' | 'pascoa' | 'tempo-comum';
type YearId = 'A' | 'B' | 'C';

interface Song {
  id: number;
  number: number | null;   // exibido como "Nº 001"; salmos e aclamações podem não ter
  slug: string;            // "001-a-feliz-espera" (ou só o título, sem número)
  title: string;
  composer: string | null;
  key: string | null;      // tom original (primeiro acorde)
  moments: MomentId[]; seasons: SeasonId[]; years: YearId[]; themes: string[];
  media: { audio: string | null; audiomack: string | null; cifraPdf: string | null; partituraPdf: string | null };
  lyrics: string;          // letra + cifra (formato em §3.3)
}

type UserRole = 'admin' | 'coordenador' | 'musico';
type UserStatus = 'pendente' | 'ativo' | 'bloqueado'; // pendente = e-mail ainda não confirmado

interface User {
  id: string; name: string;
  email: string;           // único, minúsculo; é o login
  role: UserRole; status: UserStatus;
  ministry: string; parish: string; instrument?: string;
  blockedReason?: string;  // mostrado ao usuário bloqueado quando ele tenta entrar
  createdAt: string; emailVerifiedAt: string | null; lastLoginAt: string | null;
  // Fase 3 (banco): passwordHash (argon2id), updatedAt
}

interface Mass {
  id: string;
  name: string;            // vazio → "Missa de dd/mm"
  date: string;            // yyyy-mm-dd
  time: string;            // HH:mm
  season: SeasonId | null; // sugerido pela data, editável
  year: YearId | null;     // sugerido pela data, editável
  slots: MassSlot[];
  updatedAt: string;
}
interface MassSlot { id: string; moment: MomentId | 'extra'; label: string; items: MassItem[] } // vários cantos por momento
interface MassItem { songId: number; transpose: number }  // tom só desta missa (semitons)
```

**Fase 3: tabelas de autenticação**
```ts
// Tokens de uso único. Guardar SÓ o hash (sha-256), nunca o valor.
interface AuthToken {
  id: string; userId: string;
  type: 'verify_email' | 'reset_password' | 'login_otp' | 'invite';
  tokenHash: string;
  expiresAt: string;       // verify_email 24 h · reset_password 1 h · login_otp 10 min · invite 7 dias
  attempts: number;        // login_otp: máx. 5
  usedAt: string | null; createdAt: string;
}
interface RefreshSession {
  id: string; userId: string; refreshTokenHash: string;
  userAgent: string; ip: string;
  expiresAt: string;       // 30 dias ("manter conectado") ou 1 dia
  revokedAt: string | null;
}
interface AuditLog {       // ações de admin
  id: string; actorId: string;
  action: string;          // 'user.block' | 'user.unblock' | 'user.role' | 'user.reset_password' | ...
  targetId: string; meta: Record<string, unknown>; createdAt: string;
}
```

### 3.3 Formato da letra e da cifra
- **Acordes na linha de cima**, como no site antigo; o site detecta as linhas de acordes.
- A letra é quebrada **por palavra**, cada acorde preso à sua sílaba, e a mesma regra serve para a tela e para o PDF (`lib/sheet.ts`).
- **Refrão:** a linha de letra fica entre `**…**` e é exibida em negrito. Veio do `<strong>` do site antigo (linhas com 80% ou mais do texto em negrito).
- Transposição por semitons; sustenidos ou bemóis seguem a preferência do perfil.
- 🔜 Na Fase 4, o editor de cantos terá uma pré-visualização e um botão "marcar como refrão". A adoção de ChordPro foi descartada por enquanto, porque o formato atual já atende e evita reconverter o acervo.

### 3.4 Arquivos em `data/`
```
data/
  songs.json        # Song[]: 121 cantos de exemplo
  categories.json   # { moments, seasons, years, themes }
  users.json        # usuários de demonstração: admin, coordenadores e músicos; ativos, pendentes e bloqueados
```
Estado do cliente em `localStorage`:

| Chave | Conteúdo |
|---|---|
| `psjb:session` | sessão |
| `psjb:users` | usuários |
| `psjb:masses` | missas |
| `psjb:prefs` | tema, tamanhos de letra, ♯/♭, paleta e cifra/só letra do Modo Missa |

---

## 4. Épicos e histórias de usuário

### E1. Listagem, busca e filtros ✅
- ✅ A busca ignora acentos e maiúsculas. Um número ("45" ou "045") leva o canto ao topo. A prioridade é número > título > compositor > letra.
- ✅ A busca na letra baixa o índice (`/dados/cantos.json`) só quando a pessoa digita 3 ou mais caracteres, e mostra um trecho com o termo destacado.
- ✅ Filtros por momento, tempo, ano, tema e recursos, combinados com OU dentro do mesmo eixo e E entre eixos; cada opção mostra a contagem.
- ✅ Chips removíveis, "Limpar tudo" e estado na URL (`?q=&momento=&tempo=&ano=&tema=&tem=&ordem=`).
- ✅ Barra lateral no desktop; no celular e no tablet, painel de filtros (drawer).
- ✅ Home com o tempo litúrgico atual, atalhos por momento e por tempo, e Salmos por ano.
- ✅ Cards com número, tom, título, autor, tempo, tags e ícones de cifra, partitura e áudio. Ordenação por número ou título.

### E2. Detalhe do canto ✅
- ✅ Abas Letra e Cifra / Partitura / Áudio (`?aba=`); aba sem conteúdo fica desabilitada.
- ✅ Transposição de −6 a +5 (`?tom=`), tom por extenso ("Ré (D)"), botão para voltar ao original, tamanho da letra de 12 a 40, **refrão em negrito** e modo "Só letra" com capitular.
- ✅ Partitura em visualizador embutido com carregamento sob demanda, e botões Baixar e Tela cheia.
- ✅ Áudio com velocidades 0,75×, 1× e 1,25× e download; Audiomack opcional.
- ✅ Tags com link para a listagem filtrada; "Adicionar à minha missa" com o momento sugerido.
- 🔜 Botões anterior/próximo pela numeração.

### E3. Acesso: entrar, criar conta, confirmar e-mail, recuperar senha 🟡
- ✅ `/entrar` com abas **Entrar** e **Criar conta**. As mensagens são distintas para credenciais inválidas, conta **pendente** (com reenvio da confirmação) e conta **bloqueada** (com o motivo).
- ✅ **Criar conta:**
  - campos: nome, e-mail, ministério (opcional), senha (8 ou mais caracteres, com letras e números, com medidor de força) e confirmação;
  - aceite dos termos (LGPD) e **reCAPTCHA** (visual);
  - a conta nasce **pendente**, com papel músico.
- ✅ **Confirmar e-mail:** tela "Confirme seu e-mail" com reenvio a cada 60 s. O link `/confirmar-email?token=` ativa a conta automaticamente.
- ✅ **Recuperar senha:** `/recuperar-senha` sempre dá a mesma resposta (não revela se o e-mail existe), e `/redefinir-senha?token=` define a nova senha.
- 🟡 Os e-mails são simulados por um link "Demonstração" na tela.
- 🔜 **Fase 3:**
  - envio real dos e-mails e tokens de uso único com validade (§6.6);
  - **2FA por código enviado ao e-mail** (§6.6);
  - o cadastro também não revela se o e-mail já existe.

### E4. Perfil 🟡
- ✅ Nome, e-mail, paróquia, ministério, instrumento, tema (claro/escuro/sistema) e sustenidos/bemóis.
- ✅ Troca de senha exigindo a atual, com a mesma regra de força do cadastro.
- 🔜 Trocar o e-mail vai exigir a confirmação do novo endereço.

### E5. Monte sua Missa ✅ (salva no aparelho)
- ✅ Os 10 momentos padrão, na ordem: Velas, Entrada, Ato Penitencial, Glória, Salmo, Aclamação, Preces da Comunidade, Ofertório, Comunhão e Saída.
  - Aceita momentos adicionais com nome livre e vários cantos por momento.
- ✅ Nome, data e horário; **tempo e ano sugeridos pela data** e editáveis.
- ✅ **Seletor de canto:**
  - vem filtrado pelo momento e pelo tempo (e pelo ano, em Salmo e Aclamação), com chips removíveis e a opção "Todos os momentos";
  - cantos sem tempo cadastrado servem para qualquer tempo;
  - pré-visualização da letra;
  - depois de escolher, pula para o próximo momento vazio.
- ✅ **Tom por canto** só nesta missa; reordenar momentos (↑↓ ou arrastar); remover com "Desfazer"; o nome do canto aparece inteiro, com o tom na linha de baixo.
- ✅ Salva sozinho 1 s depois de cada alteração.
- ✅ **Minhas Missas:**
  - filtros Próximas, Passadas e Todas, e busca;
  - duplicar ("Cópia de …"), excluir com "Desfazer";
  - progresso "X de Y momentos".
- ✅ **PDF da missa** ("Baixar PDF", no editor e nos cards):
  - opções "Letra e cifra" ou "Só a letra", tamanho P/M/G e um canto por página;
  - a capa traz o roteiro, com a página de cada canto;
  - os cantos saem com o tom da missa, o refrão em negrito e rodapé com a paginação;
  - é gerado no navegador (jsPDF sob demanda), com o nome `missa-<nome>-<data>.pdf`.
- 🔜 Missas salvas no servidor, compartilhamento por link com a equipe e sincronia entre aparelhos.

### E6. Modo Missa: apresentação no tablet ✅
- ✅ **Tela cheia automática** no primeiro toque. No iPhone, que não aceita tela cheia pelo navegador, o site é instalado na tela de início (manifest com `display: fullscreen` + `appleWebApp`).
- ✅ Visual objetivo:
  - **letra preta, fundo branco e refrão em negrito**;
  - título completo em destaque;
  - alternância **Cifra / Só letra**, lembrada no aparelho.
- ✅ Navegação:
  - swipe, setas, PageUp/PageDown (**pedal Bluetooth**), e espaço ou ↓ para rolar;
  - roteiro lateral (fixo em paisagem, gaveta em retrato) com os cantos já tocados marcados;
  - anterior/próximo pelo nome do momento, mais bolinhas.
- ✅ Tamanho da letra de 18 a 56; tom salvo na missa; paletas Dia, Noite e Sépia.
- ✅ Tela sempre acesa (Wake Lock), com um aviso que fecha com um toque quando o aparelho não suporta.
- ✅ Controles somem após 4 s; tela final "Missa concluída. Deus seja louvado!".
- 🔜 Offline por service worker e player de áudio do canto atual.

### E7. API stub ✅
- ✅ `apps/api` com Fastify + TypeScript, `GET /api/health` → `ok` e `GET /api/test` → string, `PORT` (3333) e CORS.
- 🔜 Teste automatizado com `fastify.inject`.

### E8. Administração de usuários (só papel **admin**) 🟡
- ✅ `/painel/admin/usuarios`: o menu "Usuários" só aparece para admins; os demais veem "Acesso restrito".
- ✅ Resumo clicável (Total, Ativos, Aguardando e-mail, Bloqueados), busca, filtro por papel, tabela no desktop e cards no celular e no tablet.
- ✅ **Ações:**
  - editar dados e papel;
  - **bloquear com motivo** e **liberar**;
  - ativar sem confirmação e reenviar a confirmação;
  - **redefinir senha** por link ou senha temporária exibida uma vez;
  - **convidar** e excluir (sugere bloquear).
- ✅ Proteções: o admin não pode bloquear, excluir nem rebaixar a si mesmo.
- 🔜 **Fase 3:**
  - `AuditLog` para as ações de admin;
  - bloquear ou redefinir senha revoga as sessões ativas;
  - a senha temporária obriga a troca no próximo login;
  - sempre haver pelo menos 1 admin ativo.

### E9. Responsividade (celular e tablet são o uso principal) ✅
- ✅ Auditoria automática em 9 aparelhos (Android 360px, iPhone SE, iPhone 14, Pixel 7, iPad Mini e iPad Pro 11" em retrato e paisagem, Galaxy Tab S4), cobrindo todas as páginas:
  - sem rolagem horizontal e sem erros de console;
  - alvos de toque ≥ 24 px (os principais ≥ 44 px) e textos ≥ 12 px.
- ✅ Ajustes específicos:
  - no Modo Missa em retrato, o tom vai para uma segunda linha;
  - a barra de ações do editor fica compacta no celular.
- 🔜 Levar essa auditoria (Playwright) para a CI.

---

## 5. Mapa de rotas

### 5.1 Front-end (`apps/web`)
As rotas com ID usam query string (`?id=`, `?token=`) porque o site é exportado como estático para o GitHub Pages.

| Rota | Descrição | Renderização |
|------|-----------|--------------|
| `/` | Home: busca, tempo litúrgico atual, atalhos | SSG (recalculada no deploy diário) |
| `/cantos` | Listagem com busca e filtros | SSG + ilha client |
| `/cantos/[slug]` | Detalhe do canto (`/cantos/001-a-feliz-espera`) | SSG (`generateStaticParams`) |
| `/entrar` · `/entrar?aba=criar` | Entrar / criar conta | Client |
| `/confirmar-email?token=` | Confirma o e-mail e ativa a conta | Client |
| `/recuperar-senha` · `/redefinir-senha?token=` | Recuperação de senha | Client |
| `/painel` | Visão geral | Client (protegida) |
| `/painel/perfil` | Meus dados, senha e preferências | Client (protegida) |
| `/painel/missas` | Minhas Missas | Client (protegida) |
| `/painel/missas/nova` · `/painel/missas/editar?id=` | Monte sua Missa | Client (protegida) |
| `/painel/admin/usuarios` | Admin de usuários | Client (só admin) |
| `/missa?id=` | Modo Missa | Client |
| `/sobre` | Sobre | SSG |
| `/dados/cantos.json` | Índice estático com as letras (busca, editor, Modo Missa, PDF) | Estático |
| `/manifest.webmanifest` | Instalação na tela de início | Estático |

### 5.2 API (`apps/api`)
| Método | Rota | Fase | Retorno |
|--------|------|------|---------|
| GET | `/api/health` | 1 ✅ | `ok` |
| GET | `/api/test` | 1 ✅ | string de teste |
| GET | `/api/songs`, `/api/songs/:slug` | 2 | JSON |
| GET | `/api/categories` | 2 | JSON |
| POST | `/api/auth/signup` | 3 | cria usuário **pendente** + e-mail de confirmação (exige reCAPTCHA) |
| POST | `/api/auth/verify-email` | 3 | `{ token }` → status **ativo** |
| POST | `/api/auth/resend-verification` | 3 | reenvio (rate limit) |
| POST | `/api/auth/login` | 3 | e-mail + senha (+ reCAPTCHA após falhas) → envia **código 2FA**; retorna `challengeId` |
| POST | `/api/auth/login/verify` | 3 | `{ challengeId, code }` → JWT de acesso + refresh token em cookie httpOnly |
| POST | `/api/auth/refresh` | 3 | rotaciona o refresh token e emite novo JWT |
| POST | `/api/auth/logout` | 3 | revoga o refresh token |
| POST | `/api/auth/forgot` · `/api/auth/reset` | 3 | recuperação de senha |
| GET/PATCH | `/api/me` · POST `/api/me/password` | 3 | perfil e troca de senha |
| GET | `/api/admin/users?status=&role=&q=&page=` | 3 | listagem paginada (admin) |
| PATCH | `/api/admin/users/:id` | 3 | nome, e-mail, ministério, papel |
| POST | `/api/admin/users/:id/block` · `/unblock` · `/activate` | 3 | controle de acesso (gera `AuditLog`) |
| POST | `/api/admin/users/:id/resend-verification` · `/reset-password` | 3 | e-mails de suporte |
| POST | `/api/admin/users/invite` · DELETE `/api/admin/users/:id` | 3 | convite e exclusão |
| POST/PUT/DELETE | `/api/songs[/:id]` | 4 | CRUD de cantos (admin) |
| POST | `/api/uploads` | 4 | URL assinada |
| CRUD | `/api/masses` · GET `/api/masses/share/:token` | 5 | missas e compartilhamento |

---

## 6. Arquitetura e boas práticas

### 6.1 Estrutura do monorepo (npm workspaces)
```
/
├─ package.json                 # workspaces: ["apps/*"]
├─ data/                        # songs.json, categories.json, users.json
├─ .github/workflows/           # deploy-pages.yml (GitHub Pages)
├─ .claude/skills/              # psjb-regras-de-negocio (regras de negócio)
├─ apps/
│  ├─ web/                      # Next.js 16 (App Router, TS strict, Tailwind 4)
│  │  └─ src/
│  │     ├─ app/(site)/         # páginas com header e footer
│  │     ├─ app/missa/          # Modo Missa (sem header)
│  │     ├─ app/dados/cantos.json/  # índice estático
│  │     ├─ app/manifest.ts     # instalação na tela de início
│  │     ├─ components/         # ui/, layout/, song/, mass/, auth/, admin/
│  │     └─ lib/
│  │        ├─ data/            # ÚNICA camada que lê data/ (server-only) → API na Fase 2
│  │        ├─ store.ts         # estado do cliente (localStorage) → API na Fase 3
│  │        ├─ chords.ts        # detecção de acordes, refrão, transposição
│  │        ├─ sheet.ts         # estrutura da cifra por palavra (tela e PDF)
│  │        ├─ massPdf.ts       # geração do PDF da missa (jsPDF sob demanda)
│  │        ├─ liturgy.ts       # calendário litúrgico, cores, datas
│  │        ├─ search.ts        # busca e filtros
│  │        └─ routes.ts        # BASE_PATH e URLs com ?id=
│  └─ api/                      # Fastify + TS
```
**Por que estas escolhas**
- **npm workspaces:** nativo, sem ferramenta extra.
- **Next.js App Router + Server Components:** pouco JS no cliente e HTML estático por canto.
- **Tailwind:** design tokens centralizados em `globals.css`.
- **Fastify:** rápido, com validação por schema e TypeScript de primeira classe.
- **`lib/data` e `lib/store.ts` isolados:** na troca por API, as telas não mudam.
- **Export estático (GitHub Pages):** hospedagem gratuita na Fase 1. Como consequência, não há `revalidate`, Server Actions nem rotas dinâmicas para dados do cliente.
  - Se precisar de SSR ou ISR, migrar para a Vercel, que não exige mudança de código além do `next.config`.

### 6.2 Performance
- ✅ SSG de todas as páginas públicas; `"use client"` só nas ilhas interativas.
- ✅ Busca no cliente sobre os resumos (título, número, tags, trecho). A letra completa é carregada sob demanda.
- ✅ **jsPDF** (PDF da missa) só é baixado ao clicar em "Gerar PDF".
- ✅ `next/font` (Cormorant Garamond, Inter, JetBrains Mono) e `next/image` para o logo.
- ✅ Partitura (iframe) e áudio (`preload="none"`) com carregamento sob demanda; Audiomack atrás de "Ouvir no Audiomack".
- 🔜 Lighthouse CI; metas p75 no mobile: LCP < 2,0 s, INP < 200 ms, CLS < 0,05.

### 6.3 Identidade visual
- Paleta marfim + **verde do logo `#1F3D2B`** + dourado sóbrio só em detalhes; cores dos tempos litúrgicos só como destaque.
- **Tema claro por padrão**, mesmo com o sistema em modo escuro; o escuro é opcional.
- Títulos em serifada clássica (Cormorant Garamond), interface em Inter e cifra em JetBrains Mono. Números dos cantos com algarismos de altura cheia.
- Detalhes completos em `ux.md`.

### 6.4 Acessibilidade (WCAG 2.2 AA)
- ✅ Contraste AA, foco visível (anel dourado), "Pular para o conteúdo", `aria-live` nas contagens, rótulos em todos os controles.
- ✅ Alvos de toque ≥ 44 px no site (mínimo de 24 px) e ≥ 56 px no Modo Missa; textos ≥ 12 px; `prefers-reduced-motion`.
- ✅ Acordes ocultos para o leitor de tela; abas com o padrão ARIA `tablist`.

### 6.5 SEO
- ✅ `generateMetadata` por canto; `lang="pt-BR"`; painel e Modo Missa com `noindex`.
- 🔜 `sitemap.xml`, `robots.txt`, JSON-LD `MusicComposition`, redirecionamentos 301 das URLs antigas e domínio próprio (`cantos.psjb.org.br`).

### 6.6 Segurança e autenticação (Fase 3)

**Senhas**
- Hash com **argon2id**. Política: 8 ou mais caracteres, com letras e números (a mesma da UI); se possível, checar contra listas de senhas vazadas.

**Login com JWT + dois fatores por e-mail**
1. `POST /api/auth/login` com e-mail e senha.
   - **Pendente** → 403 `EMAIL_NOT_VERIFIED`.
   - **Bloqueado** → 403 `ACCOUNT_BLOCKED`, com o motivo.
   - Credenciais erradas → mensagem genérica.
2. Senha correta → **código de 6 dígitos** aleatório. O servidor guarda só o hash (`AuthToken 'login_otp'`), com validade de **10 min** e no máximo **5 tentativas**, envia o código por e-mail e devolve o `challengeId`.
3. O front mostra "Digite o código enviado para m***@…": 6 campos, colar funciona, reenvio após 60 s.
4. `POST /api/auth/login/verify` → a API emite:
   - **JWT de acesso de 15 min** (`sub`, `role`, `exp`, `jti`), que fica **só em memória** no front, nunca em `localStorage`;
   - **refresh token** opaco em **cookie httpOnly + Secure + SameSite=Lax**, com 30 dias se "manter conectado" estiver marcado ou 1 dia se não, guardado como hash e **rotacionado** a cada uso. Reuso detectado → revoga toda a família de sessões.
5. "Confiar neste dispositivo por 30 dias" dispensa o código naquele aparelho, útil para o tablet da paróquia.
- Bloquear, redefinir senha ou trocar o e-mail **revoga todas as sessões**.
- A autorização por papel acontece **no servidor** (`requireRole('admin')`).

**reCAPTCHA**
- reCAPTCHA v3 (invisível) ou v2 (checkbox, que é o que o visual da Fase 1 imita), ou Cloudflare Turnstile.
- Usado no cadastro, na recuperação de senha e no login depois de 3 falhas.
- O token é validado **no servidor** (`siteverify`, com a chave secreta); score mínimo sugerido de 0,5.

**Outros**
- Rate limit (`@fastify/rate-limit`) em login, cadastro, reenvios e 2FA; `@fastify/helmet`; CORS restrito; validação de entrada por schema (Zod/TypeBox).
- Tokens de e-mail de **uso único**, guardados como hash: confirmação 24 h, redefinição 1 h, convite 7 dias.
- Respostas que não revelam se um e-mail está cadastrado.
- `AuditLog` das ações de admin. LGPD: consentimento no cadastro e exportação/exclusão dos dados a pedido.

### 6.7 Qualidade
- ✅ TypeScript `strict`, ESLint (config Next e React 19), `tsc` + `eslint` antes de cada entrega; build estático validado.
- ✅ Testes E2E manuais com Playwright nesta fase:
  - fluxos de cadastro e admin;
  - auditoria de responsividade;
  - geração do PDF.
- 🔜 Vitest (chords, sheet, search, liturgy, store), Playwright na CI, validação dos JSONs com Zod (`npm run validate:data`) e `fastify.inject` para a API.

### 6.8 Convenções
- Código e identificadores em inglês; textos da interface, commits e documentação em **pt-BR**.
- Componentes em `PascalCase.tsx`; um componente por arquivo; comentários curtos explicando o porquê.
- Cores só pelos tokens de `globals.css`; nada de hex solto na UI (exceto as paletas próprias do Modo Missa).
- Chaves de `localStorage` com o prefixo `psjb:`; preferências novas precisam de valor padrão ao ler dados antigos.
- IDs de taxonomia em kebab-case, sem acentos.
- Regra nova de negócio → atualizar a **skill** `psjb-regras-de-negocio` (e este documento, se mudar escopo ou API).

### 6.9 Serviços externos (Fase 3)
| Serviço | Uso | Opções |
|---|---|---|
| Banco de dados | usuários, tokens, sessões, missas, cantos, auditoria | PostgreSQL (Neon, Supabase, RDS) + Prisma/Drizzle |
| E-mail transacional | confirmação, código 2FA, redefinição de senha, convite, bloqueio | Resend, Amazon SES, Postmark, Brevo (SPF, DKIM e DMARC em `psjb.org.br`) |
| reCAPTCHA | cadastro, recuperação, login após falhas | Google reCAPTCHA v3/v2 ou Cloudflare Turnstile |
| Hospedagem da API | Node/Fastify | Render, Railway, Fly.io, VPS |
| Hospedagem do front | Next.js | GitHub Pages (atual, estático) ou Vercel |

Modelos de e-mail (pt-BR, com o logo):
- Confirme seu e-mail
- Seu código de acesso (6 dígitos, 10 min)
- Redefinir senha
- Você foi convidado
- Seu acesso foi bloqueado/liberado
- Seu e-mail foi alterado

---

## 7. Roadmap

### Fase 0: Fundação ✅
- ✅ Monorepo, `apps/web`, `apps/api` (`/api/health` e `/api/test`), TS strict e ESLint.
- ✅ Dados de exemplo extraídos do site antigo (121 cantos, refrões marcados), `categories.json` e `users.json`.
- ✅ Deploy automático no GitHub Pages (a cada push na `main` e diariamente).
- 🔜 `.nvmrc`, Prettier, Husky, CI com lint, typecheck e testes.

### Fase 1: Visual / mock ✅
- ✅ Design system (tokens, temas, componentes), header e footer, home, listagem e detalhe.
- ✅ Monte sua Missa, Minhas Missas, Modo Missa (apresentação) e PDF da missa.
- ✅ Acesso (entrar, criar conta, confirmar e-mail, recuperar senha), perfil e admin de usuários (visuais).
- ✅ Instalação na tela de início e auditoria em celulares e tablets.
- 🔜 SEO (sitemap, JSON-LD), Lighthouse ≥ 95 e **homologação com os músicos em tablet real**.

### Fase 2: API e migração de dados
- [ ] Script de migração do acervo completo (todas as páginas e categorias → eixos; mídias; refrão pelo negrito).
- [ ] Revisão das categorias pela equipe de liturgia, incluindo Velas, Preces e os refrões que faltam.
- [ ] Endpoints de leitura; `lib/data` passa a consumir a API.

### Fase 3: Banco e autenticação real
- [ ] PostgreSQL + ORM, migrações e seeds a partir dos JSONs.
- [ ] argon2id, **JWT (15 min) + refresh rotativo em cookie httpOnly**, **2FA por código no e-mail** e papéis.
- [ ] Cadastro com **reCAPTCHA no servidor** + **confirmação de e-mail** (pendente → ativo); recuperação de senha; convites.
- [ ] Serviço de e-mail + modelos (§6.9).
- [ ] Endpoints de admin de usuários + `AuditLog` (§5.2).
- [ ] Trocar o `lib/store.ts` (localStorage) pelas chamadas à API, mantendo as telas.

### Fase 4: Admin de cantos
- [ ] CRUD de cantos e taxonomias, com editor de cifra, pré-visualização e marcação de refrão.
- [ ] Upload de PDF e MP3 para storage + CDN.

### Fase 5: Offline e compartilhamento
- [ ] Service worker: cantos das missas em cache para o Modo Missa sem internet (hoje, o PDF cobre o uso offline).
- [ ] Missas no servidor; compartilhar por link (somente leitura); sincronizar computador e tablet.

---

## 8. Riscos e dúvidas em aberto

### 8.1 Riscos
| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Direitos autorais** de letras, cifras, partituras e áudios, agravado pelo **repositório público** no GitHub | Alto (jurídico) | Levantar as licenças; mostrar os créditos; ocultar mídia por canto; canal de remoção; avaliar repositório privado + Vercel |
| Migração trabalhosa: cifras em texto livre, categorias inconsistentes, refrão ausente em parte dos cantos | Alto (prazo) | Script + revisão humana por lotes; marcação de refrão no editor (Fase 4) |
| Dependência do Audiomack | Médio | Priorizar MP3 próprio; Audiomack opcional |
| Wake Lock e tela cheia sem suporte (iPhone, iOS antigo) | Médio | Instalação na tela de início; aviso; PDF como alternativa |
| Login ilustrativo confundido com segurança real | Médio | Avisos "Demonstração" na interface; auth real na Fase 3 |
| Missas em `localStorage` se perdem ao trocar de aparelho ou limpar o navegador | Médio | PDF da missa; missas no servidor (Fase 5) |
| PDFs grandes em conexões lentas | Baixo | Carregamento sob demanda; compressão; CDN |

### 8.2 Dúvidas para o cliente
1. **Direitos autorais:** a paróquia tem autorização para publicar letras, cifras, partituras e áudios? Algum conteúdo deve ficar restrito a usuários logados?
2. **Migração:** existe um banco de origem (MySQL) do site antigo? Quantos cantos existem? Onde ficam os PDFs e os MP3?
3. **Numeração:** a numeração do "Alegres Cantemos" é o identificador oficial?
4. **Hospedagem e domínio:** continuar no GitHub Pages ou ir para a Vercel ou uma VPS? Manter `cantos.psjb.org.br`? Quem administra o DNS?
5. **Identidade visual:** logo em SVG e cores oficiais?
6. **Taxonomia:** confirmar os momentos (Velas e Preces foram mapeados de forma ilustrativa); faltam momentos como Ação de Graças, Aspersão ou Pai-Nosso? Criar o eixo "celebração"?
7. **Usuários:** quem administra? As missas devem ser privadas, públicas ou compartilháveis com a equipe?
8. **Áudio:** manter o Audiomack ou migrar para MP3 próprio?
9. **Modo Missa:** quais tablets o ministério usa (iPad, Android)? Usam pedal Bluetooth?
10. **Prazos:** existe uma data-alvo (ex.: início do Advento)?
11. **LGPD:** texto dos termos de uso e da política de privacidade (o cadastro já pede o aceite).
