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
| **Coordenador(a) de liturgia** | Planeja as celebrações da semana (no sistema, tem o papel **músico** ou **admin**; não há papel próprio) | Filtrar por momento, tempo e ano; montar e compartilhar a missa |
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

type UserRole = 'admin' | 'musico';                   // na API: tabelas roles + user_roles (N:N)
type UserStatus = 'pendente' | 'ativo' | 'bloqueado'; // pendente = aguardando um admin ativar

interface User {
  id: string; name: string;
  email: string;           // único, minúsculo; é o login
  role: UserRole; status: UserStatus;
  movement: string; movementId: number | null; parish: string; instrument?: string;  // movimento: tabela movements
  blockedReason?: string;  // mostrado ao usuário bloqueado quando ele tenta entrar
  createdAt: string; emailVerifiedAt: string | null; lastLoginAt: string | null;
  phone?: string | null; photoUrl?: string | null;
  // No banco (apps/api, tabela users): password_hash (argon2id), updated_at
}

interface Mass {
  id: string;
  name: string;            // vazio → "Missa de dd/mm"
  date: string;            // yyyy-mm-dd
  time: string;            // HH:mm
  season: SeasonId | null; // sugerido pela data, editável
  year: YearId | null;     // sugerido pela data, editável
  slots: MassSlot[];
  ownerId?: string;     // quem criou (só o dono exclui e compartilha)
  sharedWith?: string[]; // IDs dos usuários com acesso (editam os cantos)
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
  users.json        # usuários de demonstração (modo sem API): admin e músicos; ativos, pendentes e bloqueados
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
- ✅ `/entrar` com abas **Entrar** e **Criar conta**. As mensagens são distintas para credenciais inválidas, conta **pendente** e conta **bloqueada** (com o motivo).
- ✅ **Com a API** (`API_URL` no build): login e cadastro chamam `POST /api/auth/login` e `POST /api/users`. O cadastro mostra "Conta criada!" e a conta espera um admin ativar. Sem a API (GitHub Pages), tudo continua no modo demonstração.
- ✅ **Criar conta:**
  - campos: nome, e-mail, telefone (opcional), movimento (opcional, da lista), senha (8 ou mais caracteres, com letras e números, com medidor de força) e confirmação;
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
- ✅ Nome, e-mail, paróquia, movimento, instrumento, tema (claro/escuro/sistema) e sustenidos/bemóis.
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
- 🟡 **Compartilhar missa com a equipe** (qualquer papel, só o dono):
  - modal com seleção múltipla e busca de pessoas ativas;
  - quem recebe vê a missa em "Minhas Missas", edita os cantos, abre no Modo Missa e baixa o PDF, e pode "Sair desta missa";
  - só o dono exclui ou muda o compartilhamento.
  - Fase 1: salvo na missa (`ownerId`, `sharedWith`) no `localStorage`, então só funciona no mesmo aparelho.
  - ✅ **Com a API:** a busca de pessoas vai ao servidor e o compartilhamento vale em qualquer aparelho. 🔜 E-mail de aviso.
- ✅ **Link de convite** (com a API): o dono gera, copia ou envia pelo celular (`navigator.share`) e pode desativar. Quem abre `/convite?token=` entra (ou é levado ao login e volta) e vira convidado automaticamente, caindo direto no editor.
- ✅ **Missas salvas no servidor** (com a API), com o `localStorage` como cache e uma fila de envio por missa. "Salvo só neste aparelho" quando o envio falha.

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

### E7. API: usuários, papéis e autenticação JWT 🟡
- ✅ `apps/api` com Fastify + TypeScript em **arquitetura hexagonal** (§6.1).
- ✅ Banco: tabelas `users`, `roles` (admin, musico), `user_roles` e `sessions`, com migrations em SQL (`npm run db:migrate -w api`) e seed do superadmin (`npm run db:seed -w api`).
- ✅ Cadastro público (`POST /api/users`), que cria a conta **pendente**; login, refresh rotativo e logout; `GET /api/me`; foto do perfil (`PUT /api/me/photo`).
- ✅ Gestão só para admin: `GET /api/admin/users` e `PATCH /api/admin/users/:id/activate`, protegidos pelo middleware `requireRole("admin")`.
- ✅ **Movimentos** (tabela `movements`, um por pessoa em `users.movement_id`) no lugar do "ministério": lista pública e gestão pelo admin. O front usa um seletor no cadastro, no perfil e no admin.
- ✅ **Missas** (tabelas `masses` e `mass_shares`): todas as rotas de §5.2. Com `API_URL`, o front salva e sincroniza pela API.
- ✅ **Link de convite** (`masses.share_token`): gerar, desativar e entrar (`POST /api/masses/join`).
- ✅ **Cantos e flags** (tabelas `songs`, `flags`, `song_flags`): repertório público, CRUD de cantos e flags pelo admin, envio de PDF e áudio (Vercel Blob) e importação do `data/songs.json` (`npm run db:import-songs -w api`).
- ✅ Coleção do **Postman** em `docs/postman/` (com ambientes local e produção). O teste `postman.test.ts` falha se uma rota não estiver na coleção.
- ✅ Testes com `fastify.inject` e adaptadores em memória (`npm test -w api`).
- 🔜 Tela de admin de usuários e perfil lendo da API; demais ações de admin (bloquear, editar, papel, excluir); troca de senha e recuperação; e-mail e 2FA.

### E8. Administração (só papel **admin**) 🟡
- ✅ **`/painel/admin`**: painel com atalhos e contagens para Usuários, Cantos, Flags e Movimentos. Na barra lateral, as quatro seções aparecem abaixo de "Administração".
- ✅ **Com a API:**
  - **Usuários:** a lista vem do servidor e "Ativar acesso" usa a API. Editar, bloquear, senha, convite e exclusão ficam desabilitados até existirem no backend (ver `docs/ESTADO-DO-PROJETO.md` §4).
  - **Cantos** (`/painel/admin/cantos` e `/editar?id=`): busca; editor com letra e pré-visualização, flags agrupadas, PDFs, áudio, Audiomack, visibilidade e exclusão.
  - **Flags** (`/painel/admin/flags`) e **Movimentos** (`/painel/admin/movimentos`).
  - **"Publicar no site"** (`POST /api/admin/site/publish` → Deploy Hook da Vercel): gera as páginas estáticas de novo.
- ✅ `/painel/admin/usuarios`: o menu só aparece para admins; os demais veem "Acesso restrito".
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
| `/convite?token=` | Link de convite de uma missa: entra (ou vai ao login) e vira convidado | Client (só com a API) |
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
| POST | `/api/users` | ✅ | cadastro público `{ name, email, password, phone?, movementId? }` → 201 com a conta **pendente** e papel músico; 409 `EMAIL_TAKEN`; 400 com os campos inválidos |
| POST | `/api/auth/login` | ✅ | `{ email, password, remember }` → `{ accessToken, expiresIn, user }` + cookie `psjb_refresh`. 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_PENDING` ou `ACCOUNT_BLOCKED` (com `details.reason`) |
| POST | `/api/auth/refresh` | ✅ | cookie → novo access token e refresh **rotacionado**; reuso revoga a família |
| POST | `/api/auth/logout` | ✅ | revoga a sessão e apaga o cookie (204) |
| GET | `/api/me` | ✅ | `Authorization: Bearer` → `{ user }` |
| PUT | `/api/me/photo` | ✅ | multipart, campo `photo` (JPG/PNG/WebP, até 2 MB) → `{ user }` com a nova `photoUrl` |
| GET | `/api/admin/users?status=&role=&q=` | ✅ | listagem (admin): pendentes, depois bloqueados e ativos. 🔜 paginação |
| PATCH | `/api/admin/users/:id/activate` | ✅ | admin ativa (ou desbloqueia) a conta |
| GET | `/api/movements` | ✅ | lista pública de movimentos `{ id, name, members }` |
| POST · PATCH · DELETE | `/api/admin/movements[/:id]` | ✅ | admin cria, renomeia ou exclui `{ name }`. 409 `MOVEMENT_TAKEN` (nome repetido) e `MOVEMENT_IN_USE` (há pessoas no movimento) |
| GET | `/api/users/search?q=&limit=` | ✅ | logado: pessoas **ativas** para compartilhar (nome, e-mail, movimento), sem a própria pessoa |
| GET | `/api/masses?when=upcoming\|past\|all&q=` | ✅ | missas que criei ou que foram compartilhadas comigo; `access` = `owner` ou `shared` |
| POST | `/api/masses` | ✅ | cria `{ name, date, time, season, year, slots }` (tudo opcional) → 201 |
| GET | `/api/masses/:id` | ✅ | dono ou convidado; 403 para os outros; 404 se não existe |
| PUT | `/api/masses/:id` | ✅ | substitui a missa inteira (dono ou convidado) |
| PATCH | `/api/masses/:id` | ✅ | muda só os campos enviados (dono ou convidado) |
| DELETE | `/api/masses/:id` | ✅ | só o dono → 204 |
| POST | `/api/masses/:id/duplicate` | ✅ | cópia de quem duplicou: "Cópia de …", sem data e sem compartilhamento → 201 |
| PUT | `/api/masses/:id/shares` | ✅ | só o dono: `{ userIds }` substitui a lista; só contas ativas (400 `invalidUserIds`) |
| DELETE | `/api/masses/:id/shares/me` | ✅ | quem recebeu sai da missa → 204 |
| POST | `/api/masses/:id/share-link` | ✅ | só o dono: gera (ou devolve o mesmo) link de convite → `{ token, path }` |
| DELETE | `/api/masses/:id/share-link` | ✅ | só o dono: desativa o link (quem entrou continua) → 204 |
| POST | `/api/masses/join` | ✅ | logado: `{ token }` → vira convidado (ou só recebe a missa, se já tinha acesso). 404 se o link foi desativado |
| GET | `/api/songs?q=&flags=&page=&pageSize=` | ✅ | público: cantos ativos, sem a letra. `flags` = ids (OU no grupo, E entre grupos); `q` sem acento |
| GET | `/api/songs/:ref` | ✅ | público: canto por id ou slug, com letra e flags |
| GET | `/api/flags` | ✅ | público: flags em ordem de grupo (momento, tempo, ano, tema, outro) |
| GET | `/api/admin/songs` · `/api/admin/songs/:id` | ✅ | admin: inclui cantos ocultos |
| POST · PUT · PATCH · DELETE | `/api/admin/songs[/:id]` | ✅ | admin: CRUD. `flagIds` (várias), `media` (links), `active`. 409 `SONG_TAKEN` (número ou slug) e `SONG_IN_USE` (está em missa) |
| PUT · DELETE | `/api/admin/songs/:id/files/:kind` | ✅ | admin: `kind` = `cifra-pdf`, `partitura-pdf` ou `audio`. multipart, campo `file`, até 4 MB |
| POST · PUT · DELETE | `/api/admin/flags[/:id]` | ✅ | admin: `{ group, slug, name, color?, position? }`. 409 `FLAG_TAKEN` |
| POST | `/api/admin/site/publish` | ✅ | admin: pede um novo build do site (Deploy Hook em `SITE_DEPLOY_HOOK_URL`) → 202; sem hook → 501 `NOT_CONFIGURED` |
| POST | `/api/auth/login/verify` | 3 | 2FA: `{ challengeId, code }` → só então emite os tokens |
| POST | `/api/auth/verify-email` · `/resend-verification` | 3 | quando houver serviço de e-mail |
| POST | `/api/auth/forgot` · `/api/auth/reset` | 3 | recuperação de senha |
| PATCH | `/api/me` · POST `/api/me/password` | 3 | editar perfil e trocar senha |
| PATCH | `/api/admin/users/:id` | 3 | nome, e-mail, movimento, papel |
| POST | `/api/admin/users/:id/block` · `/unblock` | 3 | controle de acesso (gera `AuditLog`) |
| POST | `/api/admin/users/:id/resend-verification` · `/reset-password` | 3 | e-mails de suporte |
| POST | `/api/admin/users/invite` · DELETE `/api/admin/users/:id` | 3 | convite e exclusão |
| POST | `/api/uploads` | 4 | token de upload direto para o Vercel Blob (arquivos acima de 4 MB) |

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
│  └─ api/                      # Fastify + TS, arquitetura hexagonal
│     ├─ src/
│     │  ├─ domain/             # entidades e regras puras (User, Role, AppError)
│     │  ├─ dtos/               # schemas Zod de entrada + formato de saída (UserDTO)
│     │  ├─ interfaces/         # portas: UserRepository, SessionRepository, PasswordHasher, TokenService, FileStorage
│     │  ├─ actions/            # casos de uso: auth/ (login, refresh, logout), users/, admin/
│     │  ├─ repositories/       # adaptadores Postgres (pg)
│     │  ├─ services/           # adaptadores: argon2id, JWT (jose), Vercel Blob, disco local
│     │  ├─ controllers/        # HTTP → action → resposta (cookies, status)
│     │  ├─ middlewares/        # authenticate, requireRole("admin")
│     │  ├─ routes/             # mapa de rotas + rate limit
│     │  ├─ database/           # pool, migrations/*.sql, migrate.ts, seed.ts
│     │  ├─ container.ts        # monta as actions com os adaptadores (injeção de dependência)
│     │  └─ server.ts           # entrada local e na Vercel
│     └─ test/                  # fastify.inject + adaptadores em memória
```
**Por que estas escolhas**
- **npm workspaces:** nativo, sem ferramenta extra.
- **Next.js App Router + Server Components:** pouco JS no cliente e HTML estático por canto.
- **Tailwind:** design tokens centralizados em `globals.css`.
- **Fastify:** rápido, com validação por schema e TypeScript de primeira classe. Roda na Vercel sem configuração (detecta `src/server.ts`).
- **Hexagonal na API:** as actions dependem só das interfaces; trocar Postgres local por Neon, disco por Vercel Blob ou o banco por memória nos testes não mexe nas regras.
- **`pg` + SQL puro** em vez de ORM: poucas tabelas, consultas explícitas e migrations versionadas em `.sql`. Dá para adotar Drizzle depois sem mudar as actions.
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

### 6.6 Segurança e autenticação

**Já implementado:** argon2id; login → access JWT de 15 min + refresh rotativo em cookie httpOnly (sem o 2FA ainda); detecção de reuso; papéis no JWT e `requireRole` no servidor; rate limit em login, cadastro e refresh; `@fastify/helmet`; CORS restrito; validação com Zod; respostas de erro no formato `{ error: { code, message, details } }`. O resto desta seção continua planejado para a Fase 3.

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
- ✅ **Testes automatizados (Vitest)**, rodando no GitHub Actions (`.github/workflows/tests.yml`) a cada push e PR:

  | Camada | Onde | O que cobre |
  |---|---|---|
  | Unitários da API | `apps/api/test/unit` | domínio (slug, acesso à missa, códigos de erro); JWT (vencido, adulterado, `alg: none`, outro segredo, papéis desconhecidos); argon2id; schemas dos DTOs (senha, tom de −6 a +5, datas, mass assignment, URLs só http/https); storage local (path traversal); identificação de arquivos pelos bytes |
  | Rotas com adaptadores em memória | `apps/api/test/http` | regras das actions e controllers. **Matriz de autorização automática:** toda rota fora da lista pública dá 401 sem token e toda rota `/admin` dá 403 para músico. Também: tokens forjados, conta bloqueada depois do login, sem vazamento de hash, erro 500 sem detalhes, helmet, CORS, cookie Secure e limite de tentativas em produção, cobertura da coleção do Postman |
  | Integração (Postgres real) | `apps/api/test/integration` | cada método dos repositórios (SQL, CHECK, UNIQUE, CASCADE, fuso das datas, busca sem acento, filtro por flags, `%`/`_`/aspas como texto) e fluxos HTTP completos com o banco. Banco separado `psjb_cantos_test`; a configuração se recusa a rodar em banco que não termine com `_test` |
  | Regras do front | `apps/web/test` | calendário litúrgico (tempos, ano A/B/C, Páscoa), acordes e transposição, refrão, busca e filtros na URL |
  | Postman | `docs/postman` + newman | a coleção inteira contra a API rodando, no CI |

- 🔜 Playwright na CI (fluxos de tela: login, editor, convite, Modo Missa) e validação dos JSONs com Zod (`npm run validate:data`).

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
| Banco de dados | usuários, tokens, sessões, missas, cantos, auditoria | **PostgreSQL no Neon** (escolhido). Use a string "pooled" (`-pooler`) com `sslmode=require` |
| Arquivos | fotos de perfil; depois PDFs e MP3 | **Vercel Blob** (escolhido), via `FileStorage`. Limite de 4,5 MB por requisição nas Functions: arquivos grandes (PDF, MP3) devem ir por upload direto do navegador com token do Blob |
| E-mail transacional | confirmação, código 2FA, redefinição de senha, convite, bloqueio | Resend, Amazon SES, Postmark, Brevo (SPF, DKIM e DMARC em `psjb.org.br`) |
| reCAPTCHA | cadastro, recuperação, login após falhas | Google reCAPTCHA v3/v2 ou Cloudflare Turnstile |
| Hospedagem da API | Node/Fastify | **Vercel** (escolhido): projeto com raiz `apps/api`, vira uma Function (Fluid compute) |
| Hospedagem do front | Next.js | **Vercel** (escolhido), com `API_URL` apontando para a API; o GitHub Pages continua como demonstração estática |

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
- ✅ Banco legado (MySQL 5.7.44) copiado para MySQL local em Docker e convertido de forma fiel para **PostgreSQL 18** (`db/postgres/`): 10 tabelas, 623 cantos, 45 categorias. Conferência célula a célula e auditoria independente aprovadas (`CONVERSAO.md`, `VERIFICACAO.md`).
- [ ] Redesenhar o modelo a partir do banco convertido (descartar as tabelas do CMS genérico: `modulos`, `painel_administrativo`, `acessos*`).
- [ ] Busca sem acento no Postgres: `CREATE EXTENSION unaccent` (ou colação `pt_br_ci_ai`); normalizar NBSP e `\r` do HTML de `audios.descricao`. Hoje `LIKE '%sao%'` não acha "São".
- [ ] Login na API: `trim` no usuário e no e-mail (o Postgres não ignora espaço no fim como o MySQL) e não usar `ILIKE` nas colunas com `pt_br_ci_ai` (dá erro).
- [ ] Senhas legadas em **MD5 sem salt**: não reaproveitar; forçar redefinição por e-mail (argon2id) e invalidar `usuarios.token`.
- [ ] IPs (`acessos`) como `inet`: há IPv6 (`::1`), que não cabe no `varchar(15)` legado.
- [ ] Script de migração do acervo completo (todas as páginas e categorias → eixos; mídias; refrão pelo negrito).
- [ ] Revisão das categorias pela equipe de liturgia, incluindo Velas, Preces e os refrões que faltam.
- [ ] Endpoints de leitura; `lib/data` passa a consumir a API.

### Fase 3: Banco e autenticação real
- ✅ PostgreSQL com migrations em SQL e seed do superadmin. 🔜 Cantos e missas no banco.
- ✅ argon2id, **JWT (15 min) + refresh rotativo em cookie httpOnly** e papéis (admin, musico) com `requireRole`.
- [ ] **2FA por código no e-mail**.
- [ ] Deploy: projetos `apps/web` e `apps/api` na Vercel, banco no Neon (rodar `db:migrate` no deploy) e Blob ligado à API.
- [ ] Cadastro com **reCAPTCHA no servidor** + **confirmação de e-mail** (pendente → ativo); recuperação de senha; convites.
- [ ] Serviço de e-mail + modelos (§6.9).
- [ ] Endpoints de admin de usuários + `AuditLog` (§5.2).
- [ ] Trocar o `lib/store.ts` (localStorage) pelas chamadas à API, mantendo as telas.

### Fase 4: Admin de cantos
- ✅ API: CRUD de cantos e de flags (taxonomia), envio de PDF e áudio para o storage (Vercel Blob) e importação do repertório de exemplo.
- ✅ Telas de admin de cantos, flags e movimentos, com pré-visualização da cifra e marcação de refrão.
- ✅ Site público lendo os cantos e as flags da API no build (`lib/data` e `next.config`) quando há `API_URL`; "Publicar no site" gera de novo.
- [ ] Aviso de "alterações não publicadas" no admin.
- [ ] Arquivos acima de 4 MB: upload direto do navegador para o Blob (token do cliente), sem passar pela Function.
- [ ] Migrar os 623 cantos do banco legado (`audios`) para `songs`.

### Fase 5: Offline e compartilhamento
- [ ] Service worker: cantos das missas em cache para o Modo Missa sem internet (hoje, o PDF cobre o uso offline).
- ✅ API de missas: CRUD, duplicar, compartilhar, sair e busca de pessoas, com permissão no servidor.
- [ ] Telas de missa (editor, Minhas Missas, Modo Missa, compartilhar) lendo e salvando pela API; sincronizar computador e tablet.
- [ ] E-mail "Uma missa foi compartilhada com você".
- [ ] Controle de concorrência na edição (dois convidados salvando ao mesmo tempo: hoje vale o último).

---

## 8. Riscos e dúvidas em aberto

### 8.1 Riscos
| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Direitos autorais** de letras, cifras, partituras e áudios, agravado pelo **repositório público** no GitHub | Alto (jurídico) | Levantar as licenças; mostrar os créditos; ocultar mídia por canto; canal de remoção; avaliar repositório privado + Vercel |
| Migração trabalhosa: cifras em texto livre, categorias inconsistentes, refrão ausente em parte dos cantos | Alto (prazo) | Script + revisão humana por lotes; marcação de refrão no editor (Fase 4) |
| **Dados pessoais e hashes MD5** no banco legado, com repositório público | Alto (LGPD/segurança) | `*.sql` com dados fora do git (só o `01-schema.sql` é versionado); senhas legadas descartadas e redefinidas por e-mail |
| Dependência do Audiomack | Médio | Priorizar MP3 próprio; Audiomack opcional |
| Wake Lock e tela cheia sem suporte (iPhone, iOS antigo) | Médio | Instalação na tela de início; aviso; PDF como alternativa |
| Login ilustrativo confundido com segurança real | Médio | Avisos "Demonstração" na interface; auth real na Fase 3 |
| Missas em `localStorage` se perdem ao trocar de aparelho ou limpar o navegador | Médio | PDF da missa; missas no servidor (Fase 5) |
| PDFs grandes em conexões lentas | Baixo | Carregamento sob demanda; compressão; CDN |

### 8.2 Dúvidas para o cliente
1. **Direitos autorais:** a paróquia tem autorização para publicar letras, cifras, partituras e áudios? Algum conteúdo deve ficar restrito a usuários logados?
2. **Migração:** ✅ o banco de origem existe (MySQL 5.7, 623 cantos em 45 categorias) e já foi convertido para PostgreSQL. Falta saber onde ficam os PDFs e os MP3 e o que significa `usuarios.tipo` (1 parece ser administrador).
3. **Numeração:** a numeração do "Alegres Cantemos" é o identificador oficial?
4. **Hospedagem e domínio:** continuar no GitHub Pages ou ir para a Vercel ou uma VPS? Manter `cantos.psjb.org.br`? Quem administra o DNS?
5. **Identidade visual:** logo em SVG e cores oficiais?
6. **Taxonomia:** confirmar os momentos (Velas e Preces foram mapeados de forma ilustrativa); faltam momentos como Ação de Graças, Aspersão ou Pai-Nosso? Criar o eixo "celebração"?
7. **Usuários:** quem administra? As missas devem ser privadas, públicas ou compartilháveis com a equipe?
8. **Áudio:** manter o Audiomack ou migrar para MP3 próprio?
9. **Modo Missa:** quais tablets o ministério usa (iPad, Android)? Usam pedal Bluetooth?
10. **Prazos:** existe uma data-alvo (ex.: início do Advento)?
11. **LGPD:** texto dos termos de uso e da política de privacidade (o cadastro já pede o aceite).
