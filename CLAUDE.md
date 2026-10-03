# Cantos PSJB: contexto do projeto

Site de cantos litúrgicos da **Paróquia Catedral São João Batista**, que substitui o antigo https://cantos.psjb.org.br/. O público é o ministério de música, os coordenadores de liturgia e os fiéis, e o uso principal é em **celular e tablet** (inclusive durante a missa).

- **Idioma:** o usuário conversa em português (pt-BR). Textos de UI, commits e documentação também são em pt-BR.
- **Regras de negócio:** estão todas na skill `.claude/skills/psjb-regras-de-negocio/SKILL.md`. Carregue-a antes de mexer em cantos, filtros, missas, Modo Missa, usuários, login ou admin.
- **Documentos de referência:** `planning.md` (produto, histórias com status, rotas, API futura, segurança, roadmap), `ux.md` (design tokens, wireframes de todas as telas, componentes) e `README.md` (visão geral, contas de demonstração, URLs).
- **Manter a documentação em dia:** ao combinar ou mudar uma regra, atualize a skill. Se a mudança afetar escopo, rotas ou API, atualize também o `planning.md`; se afetar telas ou layout, o `ux.md`.

## Fase atual
**Transição da Fase 1 (visual) para a API.** O site publicado no GitHub Pages é a demonstração (sem banco); a API e o banco já existem e são usados quando o front tem `API_URL`.
- **Dados da demonstração:** JSONs em `data/` (`songs.json`, `categories.json`, `users.json`).
- **Já com API:** usuários, login, missas (com link de convite), cantos e flags (`apps/api` + Postgres).
  - O front só usa a API quando o build tem `API_URL`; sem ela (GitHub Pages), continua no modo demonstração.
  - Com a API, o `store.ts` espelha o usuário (`syncApiUser`) e usa o `localStorage` como cache das missas, enviando cada alteração numa fila por missa.
  - Compartilhar é `setMassShares`, separado de `saveMass`.
  - O site público ainda lê os cantos do `data/songs.json`.
- **Estado do cliente** (sessão, perfil, usuários, missas, preferências): fica em `localStorage`, via `apps/web/src/lib/store.ts`.
- **E-mails:** são simulados por links na própria tela, como "Abrir link de confirmação".
- **Hospedagem futura:** Vercel (front e API), Neon (Postgres) e Vercel Blob (arquivos).
- **Fases seguintes:** cantos e missas na API, 2FA por e-mail, reCAPTCHA no servidor e serviço de e-mail. O plano está em `planning.md` §5.2, §6.6 e §6.9.

## Stack e estrutura (npm workspaces)
```
data/                 JSONs de exemplo (fonte de dados da Fase 1)
apps/web/             Next.js 16 (App Router, TS strict, Tailwind 4, lucide-react)
  src/app/(site)/     páginas com header/footer (home, cantos, entrar, painel...)
  src/app/missa/      Modo Missa (tela cheia, sem header)
  src/app/dados/cantos.json/route.ts   índice estático com letras (force-static)
  src/app/manifest.ts app instalável na tela de início (display fullscreen; usado no iPhone)
  src/lib/data/       ÚNICO ponto que lê data/ (server-only). Na Fase 2, trocar por fetch à API.
  src/lib/store.ts    estado do cliente em localStorage (sessão, usuários, missas, preferências)
  src/lib/chords.ts   detecção de acordes, refrão (**…**), transposição
  src/lib/sheet.ts    estrutura da cifra por palavra: MESMA regra de quebra na tela e no PDF
  src/lib/massPdf.ts  PDF da missa (jsPDF, import dinâmico: só carrega ao gerar)
  src/lib/liturgy.ts  calendário litúrgico (tempo e ano A/B/C), formatação de datas e números
  src/lib/search.ts   busca sem acento + filtros (estado na URL)
  src/lib/routes.ts   BASE_PATH e URLs com ?id=
  src/components/     ui/ (Button, Field, Modal, Chip, Toast, Ornament), layout/, song/, mass/, auth/, admin/
apps/api/             Fastify + TS, arquitetura hexagonal (detalhes em planning.md §6.1):
  src/domain/         entidades e erros (User, Role, AppError), sem dependências
  src/dtos/           schemas Zod de entrada + formato de saída
  src/interfaces/     portas (repositórios, hasher, tokens, storage); actions só dependem delas
  src/actions/        casos de uso (auth/, users/, admin/)
  src/repositories/   Postgres (pg + SQL puro)   src/services/  argon2, jose (JWT), Vercel Blob, disco
  src/controllers/ · src/routes/ · src/middlewares/ (authenticate, requireRole)
  src/database/       migrations/*.sql, migrate.ts, seed.ts (superadmin)
  src/container.ts    liga actions e adaptadores
  test/               unit/ (regras puras) · http/ (rotas com adaptadores em memória + segurança)
                      · integration/ (Postgres real, banco *_test) · support/ (fakes e helpers)
docs/postman/         coleção do Postman da API + ambientes (local, produção) e foto de exemplo
db/                   dump de produção (*.sql no .gitignore: dados reais, repositório público)
  postgres/           conversão fiel MySQL → PostgreSQL 18: migrar.py, 01-schema.sql (versionado),
                      02-dados.sql (gerado, fora do git), CONVERSAO.md e VERIFICACAO.md (auditoria)
docker-compose.yml    MySQL 5.7 local (igual à produção 5.7.44, importa o dump na 1ª subida) + PostgreSQL 18
.github/workflows/deploy-pages.yml   deploy no GitHub Pages
.github/workflows/tests.yml          testes a cada push/PR (API com Postgres de serviço, Postman via newman, front)
```

## Comandos
```bash
npm install
npm run dev:web     # http://localhost:3000
npm run dev:api     # http://localhost:3333/api/health
npm run db:migrate -w api && npm run db:seed -w api   # tabelas + superadmin@psjb.org.br / 123456
npm run db:import-songs -w api                        # cantos e flags de data/ para o banco (mantém os ids)
npm test                     # tudo: API (unitários + integração com Postgres) e regras do front
npm run test:unit -w api     # só os rápidos, sem banco (bom no modo watch: npm run test:watch -w api)
npm run test:integration -w api   # repositórios e fluxos contra o Postgres (banco psjb_cantos_test, criado sozinho)
npm run typecheck -w api
API_URL=http://localhost:3333 npm run dev:web         # front usando a API (sem API_URL = modo demonstração)
docker compose up -d   # MySQL 5.7 (localhost:3306) e PostgreSQL 18 (localhost:5432): psjb_cantos, psjb/psjb
python3 db/postgres/migrar.py   # recria o Postgres a partir do MySQL e confere célula a célula
cd apps/web && npx tsc --noEmit && npx eslint src test && npm test   # rodar sempre antes de concluir
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH=/Psjb_Cantos npx next build   # simula o build do Pages (gera out/)
```
Se `tsc` reclamar de `PageProps`/`LayoutProps`, rode `npx next typegen` em `apps/web`.

## Deploy
- **URL pública:** https://otaviomoreira.github.io/Psjb_Cantos/ (o repositório `OtavioMoreira/Psjb_Cantos` é público).
- **Quando publica:** o GitHub Actions faz o deploy a cada push na `main` e também uma vez por dia, porque o "tempo litúrgico atual" da home é calculado no build.
- **Export estático:** o Pages usa `output: "export"` + `basePath`, então:
  - **Rotas com ID** usam query string: `/missa?id=`, `/painel/missas/editar?id=`, `/confirmar-email?token=`. Não criar rotas dinâmicas `[id]` para dados do cliente.
  - **Caminhos fora do next/link:** todo `fetch` ou `<form action>` para caminho interno precisa de `BASE_PATH` (`lib/routes.ts`). `next/link`, `router.push` e o `import` de imagem já tratam isso.
  - **Recursos proibidos:** nada de `revalidate`, Server Actions, route handlers dinâmicos ou otimizador de imagem (`images.unoptimized` no Pages).
- Publicar ou fazer push só quando o usuário pedir.

## Convenções
- **Next.js 16** tem mudanças de API: consulte `apps/web/node_modules/next/dist/docs/` antes de usar algo novo.
  - `params` e `searchParams` são Promises e usam os helpers globais `PageProps<'/rota'>` e `LayoutProps`.
  - `useSearchParams` precisa estar dentro de `<Suspense>`.
- **Estado do localStorage:** use os hooks do `store.ts` (`useSyncExternalStore`). Para evitar divergência de hidratação, use `useHydrated()` antes de renderizar algo que dependa da sessão.
  - As chaves têm o prefixo `psjb:` (`session`, `users`, `masses`, `prefs`).
  - Todo campo novo em `Prefs` precisa de fallback ao ler, porque navegadores com dados antigos não têm o campo (ex.: `prefs.massShowChords ?? true`).
- **Dados de cantos:** o refrão é a linha de letra entre `**…**` no `songs.json`. Nunca exibir os `**` e removê-los da busca (use `lyricsOnly`).
- **Bibliotecas pesadas** (como o jsPDF): sempre com `import()` dinâmico, para não pesar no carregamento inicial.
- **Cores:** use os tokens de `globals.css` (`bg`, `surface`, `surface-2`, `border`, `ink`, `ink-muted`, `primary`, `gold`, `gold-ink`...) e nunca hex solto na UI. A exceção é o Modo Missa, que tem paletas próprias.
- **Fontes:** Cormorant Garamond nos títulos, Inter na UI e JetBrains Mono na cifra. Números de canto usam `[font-variant-numeric:lining-nums]`.
- **Lint do React 19:** proíbe `setState` síncrono dentro de `useEffect` e acesso a `ref` durante o render.
- **Responsividade:** validar em celular (360–430 px) e tablet (768–1194 px, retrato e paisagem). Sem rolagem horizontal, alvos de toque ≥ 44 px (mínimo 24 px), texto ≥ 12 px. Grids de uma coluna precisam de `grid-cols-1` para não estourar a largura.
- **Comentários:** curtos, em português, só quando explicam o porquê.
- **Testes:** Vitest (não Jest, que exige configuração extra para ESM + TS). Rodam no GitHub Actions (`tests.yml`) a cada push e PR.
  - **Regra nova** → teste na camada certa:
    - unitário (`test/unit`) para função pura ou schema;
    - rota com adaptadores em memória (`test/http`) para action ou controller;
    - integração (`test/integration`) para qualquer SQL novo em `repositories/`.
  - **Rota nova:** se for pública, precisa entrar na lista `PUBLIC` de `test/http/security.test.ts`. Senão, a matriz de autorização exige 401 sem token e 403 de músico em `/admin`.
- **API:**
  - **Rota nova ou alterada** → atualize a coleção `docs/postman/psjb-cantos.postman_collection.json`. O teste `apps/api/test/postman.test.ts` falha se faltar alguma rota. Depois, rode a coleção com o newman contra a API local.
  - **Regra de permissão** (dono, convidado, papel) fica na **action**, não na rota.
