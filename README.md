# Cantos PSJB

Novo site de cantos litúrgicos da **Paróquia Catedral São João Batista**, que substitui o antigo https://cantos.psjb.org.br/. Ele reúne letra, cifra transponível, partitura e áudio, e permite montar a missa para usar no tablet ou em PDF. O foco é o uso em **celular e tablet**.

**Site publicado (demonstração):** https://otaviomoreira.github.io/Psjb_Cantos/

> **Fase 1 (atual): só o visual.** Os dados vêm de JSONs de exemplo e o estado do usuário fica no navegador (`localStorage`). Login, cadastro, e-mails e admin são ilustrativos. API, banco e autenticação real (JWT + 2FA por e-mail) estão planejados em [`planning.md`](planning.md).

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

## Contas de demonstração
| Papel | E-mail | Senha |
|---|---|---|
| Administrador | `admin@psjb.org.br` | `admin123` |
| Músico | `musica@psjb.org.br` | `cantos123` |

A tela de login tem um botão "Usar" que preenche os dados. Os usuários de exemplo estão em `data/users.json`.

## Estrutura
```
data/                    JSONs de exemplo: songs.json (121 cantos), categories.json, users.json
apps/web/                Next.js 16 (App Router, TypeScript, Tailwind 4)
apps/api/                API Node (Fastify); por enquanto só GET /api/health e GET /api/test
db/                      Dump do banco de produção (*.sql fora do git, pois tem dados reais)
db/postgres/             Conversão do banco legado para PostgreSQL 18 (script, schema e relatórios)
docker-compose.yml       MySQL 5.7 local com o dump de produção + PostgreSQL 18
planning.md              Produto: escopo, modelo de dados, histórias, rotas, API futura, segurança, roadmap
ux.md                    Design: tokens, wireframes, componentes, responsividade, tom de voz
CLAUDE.md                Contexto técnico para o Claude Code
.claude/skills/psjb-regras-de-negocio/SKILL.md   Todas as regras de negócio combinadas
.github/workflows/deploy-pages.yml                Deploy automático no GitHub Pages
```

## Rodando localmente
Requer Node 20 ou superior (testado no 24).
```bash
npm install
npm run dev:web     # http://localhost:3000
npm run dev:api     # http://localhost:3333/api/test
```

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
