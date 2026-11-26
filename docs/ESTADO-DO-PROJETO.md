# Estado do projeto: Cantos PSJB

> Atualizado em **24/11/2026**. Resumo do que já existe e do que falta, para retomar o trabalho.
> As regras de negócio estão na skill `.claude/skills/psjb-regras-de-negocio/SKILL.md`, o produto e o roadmap no `planning.md` e as telas no `ux.md`.

## 1. Visão geral

O site substitui o antigo https://cantos.psjb.org.br/. Reúne letra com cifra transponível, partitura e áudio, permite montar a missa e usar no tablet (Modo Missa) ou em PDF. O uso principal é em **celular e tablet**.

O projeto roda de dois jeitos:

| Modo | Onde | Dados | Para quê |
|---|---|---|---|
| **Demonstração** | GitHub Pages (https://otaviomoreira.github.io/Psjb_Cantos/) | JSONs em `data/` + `localStorage` | Ver o visual e os fluxos sem servidor |
| **Com API** | local (`API_URL=http://localhost:3333`) e, no futuro, Vercel + Neon | API Fastify + PostgreSQL | Uso real: contas, missas no servidor, admin |

```
apps/web  (Next.js 16)  ── /api/* (rewrite, mesmo domínio) ──▶  apps/api (Fastify)  ──▶  PostgreSQL (Neon)
                                                                        └──▶  Vercel Blob (fotos, PDFs, áudios)
```

## 2. O que já foi feito

### 2.1 Front (`apps/web`)
| Área | O que tem | Usa a API? |
|---|---|---|
| Repertório (`/`, `/cantos`, `/cantos/[slug]`): **os 623 cantos do site antigo** | Busca sem acento, filtros por momento, tempo, ano, tema e recursos (estado na URL), cifra com transposição, "Só letra", refrão em negrito, partitura, áudio | ✅ **No build**: com `API_URL`, os cantos e as flags vêm da API; sem ela, do JSON |
| Monte sua Missa, Minhas Missas | Editor por momentos, tom por missa, salvamento automático, duplicar, excluir com "Desfazer" | ✅ Salva no servidor, com cache local e fila de envio por missa; **duas pessoas editando ao mesmo tempo têm as alterações juntadas** (versão + `If-Match`, 24/11) |
| Compartilhar missa | Escolher pessoas (busca no servidor) **e link de convite** (`/convite?token=`): quem abre entra e vira convidado | ✅ |
| Modo Missa e PDF | Apresentação em tela cheia no tablet, pedal Bluetooth, tela acesa; PDF com roteiro; **player de áudio** e **funciona sem internet** depois de aberto uma vez (service worker) (24/11) | ✅ (lê o cache das missas) |
| Entrar e Criar conta | Login, "manter conectado", cadastro com telefone e movimentos, conta aguardando ativação; **etapa do código (2FA)** com 6 campos, colar, envio automático, reenvio em 60 s e "confiar neste aparelho" (**novo**) | ✅ |
| Recuperar senha e convite (**novo**) | `/recuperar-senha` e `/redefinir-senha?token=` reais; o link do convite usa a mesma tela com boas-vindas (`&convite=1`) | ✅ |
| Perfil | Foto, nome, paróquia, movimentos (vários), instrumento, **trocar senha** (derruba os outros aparelhos), tema, sustenidos/bemóis | ✅ **Trocar e-mail** com senha + link de confirmação no endereço novo (`/confirmar-email?token=`) (**novo**) |
| Senha temporária (**novo**) | Quem entra com a senha gerada pelo admin vai direto para Perfil › Segurança e só usa o painel depois de criar a própria | ✅ |
| Admin › Painel (`/painel/admin`) | Atalhos com contagens (contas aguardando ativação, cantos, flags, movimentos) | ✅ |
| Admin › Usuários | Lista, filtros, ativar, **editar dados e papel, bloquear/liberar, senha temporária, excluir** (com "Desfazer") | ✅ Tudo pela API, inclusive convidar (**também várias pessoas de uma vez**, 26/11); **movimentos marcados direto na lista** (vários por pessoa, cada clique salva; 26/11); o convidado também marca os seus ao criar a senha, reenviar convite e enviar link de redefinição; **busca, filtros e paginação no servidor** (24/11) |
| Admin › Auditoria (24/11) | Quem fez o quê na administração, filtro por tipo, 50 por vez | ✅ |
| Termos e privacidade (24/11) | `/termos` e `/privacidade`, ligados no cadastro e no rodapé | — (páginas estáticas) |
| Desafio "não sou um robô" (24/11) | Turnstile ou reCAPTCHA de verdade no cadastro, na recuperação e no login depois de 3 senhas erradas | ✅ **ligado em produção** (26/11/2026) |
| Admin › Cantos (**novo**) | Lista com busca e "Mostrar mais"; editor com número, título, autor, tom, letra com pré-visualização, flags agrupadas, PDF da cifra, PDF da partitura, áudio, Audiomack, "Visível no repertório", excluir | ✅ |
| Admin › Flags (**novo**) | Flags por grupo (momento, tempo, ano, tema, outras), criar, editar (nome, identificador, cor, ordem), excluir | ✅ |
| Admin › Movimentos (**novo**) | Criar, renomear, excluir (bloqueado se houver pessoas) | ✅ |
| Publicar no site | Botão nos admins de cantos e flags: gera o site de novo (Deploy Hook da Vercel); **destaque e "Há alterações não publicadas"** quando cantos ou flags mudaram (24/11) | ✅ |

### 2.2 API (`apps/api`)
Fastify + TypeScript em **arquitetura hexagonal**: `routes → controllers → actions → interfaces ← repositories/services`.

| Recurso | Rotas | Observações |
|---|---|---|
| Saúde | `GET /api/health`, `/api/test` | |
| Sessão | `POST /api/auth/login`, `/login/verify`, `/login/resend`, `/refresh`, `/logout` | JWT de 15 min + refresh rotativo em cookie httpOnly; reuso derruba a família; argon2id; limite de tentativas; **2FA por e-mail** (ligado por padrão em produção, `LOGIN_2FA`) com aparelho confiável por 30 dias (cookie `psjb_device`) |
| E-mail (**novo**) | `POST /api/auth/forgot` · `/reset` · `/confirm-email`, `POST /api/me/email` | Porta `EmailSender`: Resend (`RESEND_API_KEY`, obrigatória em produção) ou console; `EMAIL_ENABLED=false` trava todo envio (e desliga o 2FA) para os testes antes do domínio verificado. Tokens de uso único só como hash (`auth_tokens`); 1 envio por minuto por pessoa e tipo |
| Contas | `POST /api/users` (cadastro), `GET/PATCH /api/me`, `PUT /api/me/photo`, `POST /api/auth/password` | Cadastro nasce **pendente**; foto JPG/PNG/WebP até 2 MB; trocar a senha derruba os outros aparelhos |
| Admin de usuários | `GET /api/admin/users`, `PATCH .../:id/activate`, `PATCH .../:id`, `POST .../:id/block` · `/unblock` · `/reset-password` · `/reset-link` · `/invite`, `POST /api/admin/users/invite`, `DELETE .../:id` | Só admin (`requireRole`). Não age sobre si mesmo; sempre sobra 1 admin ativo (`LAST_ADMIN`); bloquear e senha temporária derrubam as sessões; ativar manda "Sua conta foi liberada"; convite cria a conta pendente com link de 7 dias para criar a senha |
| Movimentos | `GET /api/movements`; admin: `POST/PATCH/DELETE /api/admin/movements` | Vários por pessoa (`user_movements`, `movementIds`); excluir em uso → 409 |
| Missas | `GET/POST /api/masses`, `GET/PUT/PATCH/DELETE /api/masses/:id`, `duplicate`, `shares`, `shares/me`, `share-link`, `POST /api/masses/join` | Dono × convidado; 403 para os demais (inclusive admin) |
| Cantos | `GET /api/songs` (`?q=&flags=&full=1`), `GET /api/songs/:ref`; admin: CRUD + `PUT/DELETE /api/admin/songs/:id/files/:kind` | Busca sem acento; filtro OU no grupo e E entre grupos; canto em missa não é excluído |
| Flags | `GET /api/flags`; admin: `POST/PUT/DELETE /api/admin/flags` | Grupos: momento, tempo, ano, tema, outro |
| Publicar | `POST /api/admin/site/publish`, `GET /api/admin/site/status` | Chama `SITE_DEPLOY_HOOK_URL`; sem ele → 501. O status diz se há alterações não publicadas (gatilhos do banco) |
| Auditoria (24/11) | `GET /api/admin/audit` | Hook em toda alteração de admin que deu certo; nunca guarda senha nem letra; 2 anos |
| Envio direto ao Blob (24/11) | `POST /api/admin/songs/:id/files/:kind/upload`, `PUT .../blob` | Arquivos de 4 a 25 MB: token de uso único; a API confere store, caminho e bytes |
| Faxina (24/11) | `GET /api/cron/cleanup` | Cron diário às 4h: sessões, tokens e aparelhos vencidos, auditoria antiga e contadores de tentativas |
| Salmos da diocese (**novo**) | `GET /api/cron/import-psalms`, `GET /api/admin/imports`, `POST /api/admin/imports/run`, `PATCH /api/admin/imports/:id` | Cron da Vercel seg–qui 3h (`CRON_SECRET`); 4 camadas contra duplicados; canto novo oculto com letra do PDF, partitura e áudio no Blob; revisão em Admin › Salmos da diocese |

**Banco:** `users`, `roles`, `user_roles`, `sessions`, `movements`, `masses`, `mass_shares`, `songs`, `flags`, `song_flags`, `auth_tokens`, `trusted_devices`, `import_items`, `import_runs`, `site_state`, `audit_log`, `rate_limits` (12 migrations em SQL; a 006 trouxe `parish`, `instrument` e `must_change_password` em `users`; a 007, os tokens de e-mail e os aparelhos confiáveis do 2FA; a 008, a importação dos salmos; de 24/11: a 009 a versão da missa, a 010 o estado da publicação com gatilhos, a 011 a auditoria e a 012 o limite de tentativas compartilhado). Também há a cópia fiel do banco legado (MySQL → PostgreSQL) em `db/postgres/`, com auditoria independente.

**Postman:** `docs/postman/` traz 74 requisições e os ambientes local e produção. A coleção é gerada por `docs/postman/gerar_colecao.py`.

### 2.3 Qualidade e segurança
**491 testes automatizados (Vitest), todos passando** (24/11/2026), rodando no GitHub Actions a cada push e PR:

| Camada | Testes | O que cobre |
|---|---:|---|
| **Unitários da API** (`apps/api/test/unit`) | **115** | modelos de e-mail (nome escapado no HTML) e adaptador do Resend; domínio (slug, acesso à missa, erros), JWT (vencido, adulterado, `alg: none`, outro segredo), argon2id, schemas (senha, tom, datas, mass assignment, URLs só http/https), storage (path traversal), arquivos identificados pelos bytes, migração dos arquivos do site antigo |
| **Unitários do front** (`apps/web/test`) | **81** | calendário litúrgico, acordes e transposição, refrão, busca e filtros, conversão API → site, slug, junção de alterações simultâneas na missa, textos da auditoria |
| **Rotas com adaptadores em memória** (`apps/api/test/http`) | **230** | regras das actions e controllers, inclusive recuperação de senha, convite, troca de e-mail e 2FA (tentativas, reenvio, aparelho confiável); **matriz de autorização** de todas as rotas (401 sem token, 403 de músico no admin); tokens forjados, conta bloqueada, sem vazamento de hash, erro 500 sem detalhes, helmet, CORS, cookie e limite de tentativas em produção; cobertura do Postman |
| **Integração com Postgres real** (`apps/api/test/integration`) | **65** | todos os métodos dos repositórios (SQL, CHECK, UNIQUE, CASCADE, fuso, busca sem acento, filtros) e fluxos HTTP completos. Banco `psjb_cantos_test`, com trava para nunca rodar em outro |
| **Postman no CI** | 74 req. | a coleção inteira contra a API rodando |

Ou seja: **196 testes unitários puros** (115 da API + 81 do front), 230 de rotas e 65 de integração.

**Bugs encontrados pelos testes e já corrigidos:**
- link de mídia aceitava `javascript:` (risco de XSS);
- calendário litúrgico errado em Pentecostes e no Batismo do Senhor;
- query do link de convite com tipo de parâmetro errado;
- filtro por flags que não filtrava;
- 500 ao excluir movimento em uso.

## 3. O que falta implementar no front

### 3.1 Telas que dependiam do serviço de e-mail
Todas ficaram prontas em 15/10/2026: trocar o próprio e-mail, recuperar senha, convite e link de redefinição no admin, e a etapa do código (2FA) no login.

### 3.2 Funcionalidades novas no front
| Item | Prioridade | Observação |
|---|---|---|
| **Deploy na Vercel** (front + API) com Neon, Blob e **Resend** | Alta | Configuração descrita no README; criar o Deploy Hook do front e pôr em `SITE_DEPLOY_HOOK_URL`; instalar o Resend pelo Marketplace e configurar SPF/DKIM/DMARC no DNS do `psjb.org.br` |
| **Chaves do desafio "não sou um robô"** (Cloudflare Turnstile) | Alta | ✅ **Feito em 26/11/2026:** `CAPTCHA_SECRET` na API e `NEXT_PUBLIC_CAPTCHA_SITE_KEY` no front (depende de uma conta Cloudflare) |
| **Revisar** os termos de uso e a política de privacidade com a paróquia | Média | Páginas `/termos` e `/privacidade` prontas (24/11/2026), escritas a partir do que o sistema faz de fato; precisam do aval da paróquia (contato usado: secretaria@psjb.org.br) |
| SEO: redirecionamentos das URLs antigas | Baixa | `sitemap.xml`, `robots.txt`, canonical e JSON-LD prontos (24/11/2026). Falta saber o formato das URLs do site antigo (o banco legado não registra; o servidor antigo recusa leitura automática) |
| **Testes de tela (Playwright) no CI**: login, editor, convite, admin | Média | Hoje os testes de tela são manuais (scripts locais) |

## 4. O que falta no backend (olhando para o front)

**Entregue em 24/11/2026** (sem depender de acessos): e-mails "compartilhou uma missa com você" e "seu acesso foi bloqueado"; paginação do admin de usuários; concorrência na edição da missa (versão + `If-Match`, com junção automática); faxina diária por cron; status "alterações não publicadas"; auditoria; limite de tentativas compartilhado entre instâncias (no Postgres, sem Upstash); desafio Turnstile/reCAPTCHA no servidor; envio direto ao Blob de arquivos até 25 MB; player de áudio e modo sem internet no Modo Missa; SEO (sitemap, robots, JSON-LD); termos e privacidade. **Antes do próximo deploy da API, rodar as migrations 009 a 012 no Neon** (ver `docs/DEPLOY.md` §8).

Já feitos em 15/10/2026: **serviço de e-mail (Resend)**, recuperação de senha, convite, troca do próprio e-mail, link de redefinição pelo admin, aviso de conta liberada e **2FA por e-mail** com aparelho confiável (antigos itens 3, 8, 9 e 10).

Feito em 18/11/2026: **importação automática dos salmos da Diocese de Montenegro** (rotina de segunda a quinta, sem duplicados; ver a skill §2). Também em 18/11/2026: **classificação dos cantos revisada** (+217 marcações em 154 cantos, só acrescentando; salmos e aclamações com Ano A/B/C conferidos no Lecionário), lista para a liturgia revisar em [`docs/REVISAO-CLASSIFICACAO.md`](REVISAO-CLASSIFICACAO.md). Também em 18/11/2026: **cifra completada nas estrofes de 428 cantos** (2.439 linhas de acordes novas), copiada da 1ª estrofe sílaba a sílaba (`db/postgres/completar_estrofes.py`); a equipe revisa ouvindo pela lista em [`docs/REVISAO-CIFRAS.md`](REVISAO-CIFRAS.md). Também em 18/11/2026: **acordes realinhados nos 623 cantos** (3.514 linhas mudaram). A cifra do site antigo foi digitada em Times New Roman e os acordes "andavam" na fonte monoespaçada; agora a posição vem do PDF da cifra (3.247 linhas) ou da largura de cada letra na Times (`db/postgres/alinhar_acordes.py`). Aplicado no `data/songs.json` e no banco de produção (só a letra, e só nos cantos não editados pelo admin).

Já feitos em 14/10/2026: os 623 cantos do legado migrados para `songs` (antigo item 20); a migração dos PDFs e MP3 do site antigo para o storage (`npm run db:migrate-files -w api`, MP3 a 64 kbps mono, 518 MB no total, com os erros de cadastro do site antigo corrigidos); perfil (`PATCH /api/me`), troca de senha, editar, bloquear/liberar, excluir e senha temporária no admin de usuários (antigos itens 1, 2 e 4 a 7).

**Nada de código pendente no backend.** O que resta depende de acessos ou de decisões: as chaves do Turnstile, o domínio de e-mail e o formato das URLs antigas (§3.2 e §5).

## 5. Próximos passos sugeridos
1. **Migrations 009 a 012 no Neon e deploy** das entregas de 24/11 (`docs/DEPLOY.md` §8). Depois, os testes do §4.4, incluindo envio de um MP3 acima de 4 MB e o Modo Missa sem internet.
2. ✅ **Cloudflare (26/11/2026):** e-mail com o domínio da paróquia (Resend verificado, remetente `nao-responda@psjb.org.br`, 2FA ligado) e Turnstile ligado. O e-mail da paróquia continua na HostGator. Falta a troca do `cantos.psjb.org.br` (§4.6 do DEPLOY), quando decidirem lançar.
3. **Revisões com a paróquia:** termos de uso e política de privacidade; classificação dos cantos e cifras completadas (`docs/REVISAO-*.md`); flags em aberto (Velas, Preces, Saída, Creio e Sequências como momento?).
4. **Testes de tela com Playwright no CI** (precisa instalar o `@playwright/test`).
5. **Redirecionamento das URLs antigas**: falta saber o formato dos endereços do site antigo.

## 6. Como rodar
```bash
docker compose up -d                          # MySQL legado + PostgreSQL
npm install
npm run db:migrate -w api && npm run db:seed -w api && npm run db:import-songs -w api
npm run dev:api                               # http://localhost:3333/api/health
API_URL=http://localhost:3333 npm run dev:web # http://localhost:3000 (sem API_URL = demonstração)
npm test                                      # API (unitários + integração) e front
```
Conta de teste: `superadmin@psjb.org.br` / `123456` (admin + músico).
