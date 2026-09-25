# Cantos PSJB

Novo site de cantos da Paróquia Catedral São João Batista. É um monorepo com npm workspaces.

```
data/          JSONs de exemplo (songs, categories, user). É a fonte de dados da Fase 1.
apps/web/      Next.js 16 (App Router, TypeScript, Tailwind 4)
apps/api/      API Node (Fastify). Por enquanto só tem as rotas de teste.
planning.md    Planejamento de produto (PO)
ux.md          Especificação de UX e layout
```

**Site publicado:** https://otaviomoreira.github.io/Psjb_Cantos/

O deploy é feito pelo GitHub Actions (`.github/workflows/deploy-pages.yml`) a cada push na `main` e também uma vez por dia. No GitHub Pages o site é um export estático, então a API não fica disponível lá.

## Rodando

```bash
npm install
npm run dev:web   # http://localhost:3000
npm run dev:api   # http://localhost:3333/api/test
```

Contas de demonstração: admin `admin@psjb.org.br` / `admin123` e músico `musica@psjb.org.br` / `cantos123`. Os dados estão em `data/users.json`.

## Onde trocar os JSONs pela API

- `apps/web/src/lib/data/index.ts` é o único ponto que lê `data/`. As assinaturas continuam as mesmas; basta trocar o `import` por `fetch`.
- `apps/web/src/lib/store.ts` guarda a sessão, o perfil e as missas em localStorage. Na Fase 3 isso passa a chamar `/api/auth`, `/api/me` e `/api/masses`.
- `apps/api/src/app.ts` é onde as novas rotas são registradas.

## Build estático (como no GitHub Pages)

```bash
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH=/Psjb_Cantos npm run build -w web   # gera apps/web/out
```
