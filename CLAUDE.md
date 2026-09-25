# Cantos PSJB: contexto do projeto

Site de cantos litúrgicos da **Paróquia Catedral São João Batista**, que substitui o antigo https://cantos.psjb.org.br/. O público é o ministério de música, os coordenadores de liturgia e os fiéis, e o uso principal é em **celular e tablet** (inclusive durante a missa).

- **Idioma:** o usuário conversa em português (pt-BR). Textos de UI, commits e documentação também são em pt-BR.
- **Regras de negócio:** estão todas na skill `.claude/skills/psjb-regras-de-negocio/SKILL.md`. Carregue-a antes de mexer em cantos, filtros, missas, Modo Missa, usuários, login ou admin.
- **Documentos de referência:** `planning.md` (produto, histórias com status, rotas, API futura, segurança, roadmap), `ux.md` (design tokens, wireframes de todas as telas, componentes) e `README.md` (visão geral, contas de demonstração, URLs).
- **Manter a documentação em dia:** ao combinar ou mudar uma regra, atualize a skill. Se a mudança afetar escopo, rotas ou API, atualize também o `planning.md`; se afetar telas ou layout, o `ux.md`.

## Fase atual
**Fase 1: somente visual.** Não há banco nem API real.
- **Dados:** JSONs em `data/` (`songs.json`, `categories.json`, `users.json`).
- **Estado do cliente** (sessão, perfil, usuários, missas, preferências): fica em `localStorage`, via `apps/web/src/lib/store.ts`.
- **E-mails:** são simulados por links na própria tela, como "Abrir link de confirmação".
- **Fases seguintes:** API e banco, autenticação JWT com 2FA por e-mail, reCAPTCHA no servidor e serviço de e-mail. O plano está em `planning.md` §5.2, §6.6 e §6.9.

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
apps/api/             Fastify + TS. Só GET /api/health e GET /api/test por enquanto.
.github/workflows/deploy-pages.yml   deploy no GitHub Pages
```

## Comandos
```bash
npm install
npm run dev:web     # http://localhost:3000
npm run dev:api     # http://localhost:3333/api/test
cd apps/web && npx tsc --noEmit && npx eslint src      # rodar sempre antes de concluir
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
