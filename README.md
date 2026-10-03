# Cantos PSJB

Novo site de cantos litúrgicos da **Paróquia Catedral São João Batista**, que substitui o antigo https://cantos.psjb.org.br/. Ele reúne letra, cifra transponível, partitura e áudio, e permite montar a missa para usar no tablet ou em PDF. O foco é o uso em **celular e tablet**.

**Site publicado (demonstração):** https://otaviomoreira.github.io/Psjb_Cantos/

> **Duas formas de rodar.**
> - **Demonstração** (o site publicado no GitHub Pages): dados de exemplo em JSON e estado no navegador (`localStorage`). Login, cadastro, e-mails e admin são ilustrativos.
> - **Com a API** (`apps/api` + PostgreSQL), quando o front tem `API_URL`:
>   - usuários com papéis (admin e músico) e autenticação JWT com refresh em cookie;
>   - cadastro que aguarda ativação pelo admin;
>   - missas salvas no servidor, com compartilhamento e link de convite;
>   - cantos e flags com envio de PDF e áudio.
>
> Ainda faltam o 2FA por e-mail, o serviço de e-mail e as telas de admin de cantos. O plano está em [`planning.md`](planning.md).

## O que já existe
| Área | Destaques |
|---|---|
| **Cantos** | Busca instantânea (número, título, trecho da letra) e filtros combináveis por momento, tempo litúrgico, ano A/B/C, tema e recursos, com o estado na URL |
| **Canto** | Cifra com transposição, "Só letra", **refrão em negrito**, partitura embutida, áudio com controle de velocidade, "Adicionar à minha missa" |
| **Monte sua Missa** | Velas → Saída + cantos adicionais; seletor filtrado pelo momento e pelo tempo; tom por missa; salvamento automático |
| **Modo Missa** | Apresentação em tela cheia no tablet: letra preta, fundo branco, refrão em negrito, Cifra ou Só letra, swipe, setas ou pedal Bluetooth, tela sempre acesa |
| **PDF da missa** | Capa com roteiro e páginas, cantos na ordem com o tom da missa; para imprimir ou usar sem internet |
| **Acesso** | Entrar, criar conta (reCAPTCHA + confirmação de e-mail), recuperar senha, perfil |
| **Admin** | Usuários: bloquear/liberar com motivo, ativar, redefinir senha, papéis, convidar, excluir |
| **App** | Instalável na tela de início (abre sem as barras do navegador), tema claro/escuro |
| **Administração** (com a API) | Painel com Usuários (ativar contas), **Cantos** (editor com letra, flags, PDF e áudio), **Flags**, **Movimentos** e "Publicar no site" |
| **API** | Fastify + PostgreSQL: login JWT, papéis, movimentos, missas com link de convite, cantos com PDF e áudio, flags; coleção do Postman e 265 testes automatizados |

O estado completo do projeto (o que está pronto e o que falta no front e no backend) está em [`docs/ESTADO-DO-PROJETO.md`](docs/ESTADO-DO-PROJETO.md).

## Contas de demonstração
| Papel | E-mail | Senha |
|---|---|---|
| Administrador | `admin@psjb.org.br` | `admin123` |
| Músico | `musica@psjb.org.br` | `cantos123` |

A tela de login tem um botão "Usar" que preenche os dados. Os usuários de exemplo estão em `data/users.json`.

Essas contas valem no **modo demonstração** (GitHub Pages ou sem `API_URL`). Com a API, a conta de teste é `superadmin@psjb.org.br` / `123456`, criada pelo seed. Os papéis são só dois: **Administrador** e **Músico**.

## Estrutura
```
data/                    JSONs de exemplo: songs.json (121 cantos), categories.json, users.json
apps/web/                Next.js 16 (App Router, TypeScript, Tailwind 4)
apps/api/                API Node (Fastify, arquitetura hexagonal): usuários, JWT, missas, cantos e flags; testes em test/
db/                      Dump do banco de produção (*.sql fora do git, pois tem dados reais)
db/postgres/             Conversão do banco legado para PostgreSQL 18 (script, schema e relatórios)
docker-compose.yml       MySQL 5.7 local com o dump de produção + PostgreSQL 18
planning.md              Produto: escopo, modelo de dados, histórias, rotas, API futura, segurança, roadmap
ux.md                    Design: tokens, wireframes, componentes, responsividade, tom de voz
CLAUDE.md                Contexto técnico para o Claude Code
.claude/skills/psjb-regras-de-negocio/SKILL.md   Todas as regras de negócio combinadas
docs/postman/            Coleção do Postman da API + ambientes (local e produção)
.github/workflows/deploy-pages.yml                Deploy automático no GitHub Pages
.github/workflows/tests.yml                       Testes (API + Postgres, Postman e front) a cada push e PR
```

## Rodando localmente
Requer Node 20 ou superior (testado no 24).
```bash
npm install
npm run dev:web     # http://localhost:3000
npm run dev:api     # http://localhost:3333/api/health
```

### API (usuários, papéis e login)
A API (`apps/api`) usa o PostgreSQL do `docker-compose` (seção abaixo). As tabelas novas (`users`, `roles`, `user_roles`, `sessions`) convivem com as do legado.
```bash
docker compose up -d
cp apps/api/.env.example apps/api/.env      # opcional: os padrões já apontam para o docker-compose
npm run db:migrate -w api                   # cria as tabelas (só aplica o que falta)
npm run db:seed -w api                      # superadmin@psjb.org.br / 123456 (admin + músico) + movimentos iniciais
npm run db:import-songs -w api              # 121 cantos de data/songs.json + 24 flags de data/categories.json
npm run dev:api
npm test -w api                             # testes com fastify.inject e adaptadores em memória

# Front usando a API (sem API_URL, o site roda no modo demonstração, como no GitHub Pages)
API_URL=http://localhost:3333 npm run dev:web
```

| Método | Rota | Acesso |
|---|---|---|
| POST | `/api/users` | público: cadastro, a conta nasce **pendente** |
| POST | `/api/auth/login` · `/refresh` · `/logout` | público (refresh e logout usam o cookie) |
| GET | `/api/me` · PUT `/api/me/photo` | logado (`Authorization: Bearer`) |
| GET | `/api/movements` | público: lista de movimentos (cadastro) |
| GET | `/api/users/search` | logado: pessoas ativas para compartilhar missa |
| GET · POST | `/api/masses` | logado: minhas missas (criadas ou compartilhadas comigo) e criar |
| GET · PUT · PATCH · DELETE | `/api/masses/:id` | dono ou convidado; **excluir só o dono** |
| POST | `/api/masses/:id/duplicate` | dono ou convidado |
| PUT · DELETE | `/api/masses/:id/shares` · `/api/masses/:id/shares/me` | compartilhar (só o dono) · sair (convidado) |
| POST · DELETE | `/api/masses/:id/share-link` | link de convite: gerar · desativar (só o dono) |
| POST | `/api/masses/join` | logado: entrar pelo link de convite |
| GET | `/api/songs` · `/api/songs/:ref` · `/api/flags` | público: repertório (cantos ativos) e flags |
| CRUD | `/api/admin/songs[/:id]` · PUT/DELETE `/api/admin/songs/:id/files/:kind` | só **admin**: cantos, PDF e áudio |
| CRUD | `/api/admin/flags[/:id]` | só **admin**: flags (Ano A, Advento, Entrada…) |
| GET | `/api/admin/users` · PATCH `/api/admin/users/:id/activate` | só papel **admin** |
| POST · PATCH · DELETE | `/api/admin/movements[/:id]` | só papel **admin** |

**Postman:** importe `docs/postman/psjb-cantos.postman_collection.json` e o ambiente `psjb-local.postman_environment.json` (ou `psjb-producao`). Rode **Autenticação › Login (superadmin)** e siga as pastas na ordem, ou rode tudo no Runner. Pela linha de comando:
```bash
npx newman run docs/postman/psjb-cantos.postman_collection.json -e docs/postman/psjb-local.postman_environment.json --working-dir docs/postman
```

**Deploy (Vercel + Neon + Blob):**
1. **Banco:** crie o banco no Neon e copie a string *pooled* (host com `-pooler`, `?sslmode=require`). Rode `DATABASE_URL=... npm run db:migrate -w api` e, uma vez, `DATABASE_URL=... SEED_ADMIN_PASSWORD=... npm run db:seed -w api`.
2. **API:** crie um projeto na Vercel com raiz `apps/api`. A Vercel detecta o Fastify por `src/server.ts`. Variáveis: `DATABASE_URL`, `JWT_SECRET` (`openssl rand -base64 48`), `NODE_ENV=production`, `WEB_ORIGIN` e `PUBLIC_URL`. Em Storage, ligue um **Blob store**, que cria o `BLOB_READ_WRITE_TOKEN`.
3. **Front:** crie outro projeto com raiz `apps/web` e a variável `API_URL=https://<api>.vercel.app`. O Next repassa `/api/*` para a API, então o cookie de sessão fica no mesmo domínio do site. No build, os cantos e as flags vêm da API.
4. **Publicar no site:** no projeto do front, crie um **Deploy Hook** (Settings › Git) e coloque a URL em `SITE_DEPLOY_HOOK_URL` no projeto da API. O botão "Publicar no site" do admin passa a gerar o site de novo.

### Banco local (MySQL 5.7)
Espelha a produção (MySQL 5.7.44, com o mesmo `sql_mode` e charset) e serve de base para a Fase 2. Na primeira subida, importa `db/psjb_cantos_producao.sql`. Esse arquivo não fica no repositório: peça o dump a quem administra o banco.
```bash
docker compose up -d          # localhost:3306, banco psjb_cantos, usuário psjb / senha psjb (root / root)
docker compose down -v        # apaga o volume; na próxima subida o dump é reimportado
MYSQL_PORT=3308 docker compose up -d   # se a 3306 estiver ocupada
```
Pontos de atenção do banco legado: há tabelas em `latin1` e em `utf8` (3 bytes), tabelas MyISAM (`usuarios`, `acessos`, `configuracoes`) e `sql_mode` sem STRICT.

### Banco convertido (PostgreSQL 18)
O mesmo `docker compose up -d` sobe um PostgreSQL 18 (`localhost:5432`, banco `psjb_cantos`, `psjb` / `psjb`, ICU pt-BR). Ele recebe uma cópia **fiel** do legado (mesmas tabelas, colunas e linhas), base para o redesenho da Fase 2.
```bash
python3 db/postgres/migrar.py                 # recria o Postgres a partir do MySQL e confere tudo
python3 db/postgres/migrar.py --so-conferir   # só a conferência origem × destino
```
- `db/postgres/CONVERSAO.md`: método, mapeamento de tipos, decisões e problemas do legado.
- `db/postgres/VERIFICACAO.md`: auditoria independente (aprovado com ressalvas; as ressalvas já estão no `CONVERSAO.md`).
- Só o `01-schema.sql` é versionado. O `02-dados.sql` é gerado pelo script e tem dados pessoais e hashes de senha, então fica fora do git.

### Testes automatizados
```bash
docker compose up -d postgres     # os testes de integração usam o banco psjb_cantos_test (criado sozinho)
npm test                          # API (unitários + integração) e regras do front
npm run test:unit -w api          # só os rápidos, sem banco
```
São 265 testes: regras, segurança (matriz de autorização, JWT, cabeçalhos, limite de tentativas), repositórios contra o Postgres real e as regras do front (calendário, cifra, busca). Sem Postgres, os testes de integração são pulados com um aviso. O GitHub Actions (`.github/workflows/tests.yml`) roda tudo, mais a coleção do Postman, a cada push e PR.

### Páginas para testar
| URL | O que é |
|---|---|
| `/` | Início |
| `/cantos` | Busca e filtros |
| `/cantos/001-a-feliz-espera` | Página de um canto |
| `/entrar` · `/entrar?aba=criar` | Entrar / criar conta |
| `/painel` | Painel (depois de entrar) |
| `/painel/missas/nova` | Monte sua Missa |
| `/painel/missas/editar?id=exemplo` | Missa de exemplo (com "Baixar PDF") |
| `/missa?id=exemplo` | Modo Missa |
| `/painel/admin/usuarios` | Admin de usuários (conta admin) |

### Qualidade
```bash
cd apps/web
npx tsc --noEmit && npx eslint src
```

## Deploy (GitHub Pages)
O GitHub Actions (`.github/workflows/deploy-pages.yml`) publica o site **a cada push na `main`** e também **uma vez por dia**, porque o "tempo litúrgico atual" da home é calculado no build. O site é gerado como export estático:
```bash
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH=/Psjb_Cantos npm run build -w web   # gera apps/web/out
```
No GitHub Pages a API não fica disponível.

## Onde trocar os dados de exemplo pela API
- `apps/web/src/lib/data/index.ts` é o único ponto que lê `data/`. Na Fase 2 ele passa a usar `fetch` à API, mantendo as mesmas assinaturas.
- `apps/web/src/lib/store.ts` guarda sessão, usuários, missas e preferências no `localStorage`. Na Fase 3 isso vira chamadas a `/api/auth`, `/api/me`, `/api/admin/users` e `/api/masses`.
- `apps/api/src/app.ts` é onde as novas rotas da API são registradas. O mapa completo está em `planning.md` §5.2.
