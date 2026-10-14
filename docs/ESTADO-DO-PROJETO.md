# Estado do projeto: Cantos PSJB

> Atualizado em **14/10/2026**. Resumo do que já existe e do que falta, para retomar o trabalho.
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
| Monte sua Missa, Minhas Missas | Editor por momentos, tom por missa, salvamento automático, duplicar, excluir com "Desfazer" | ✅ Salva no servidor, com cache local e fila de envio por missa |
| Compartilhar missa | Escolher pessoas (busca no servidor) **e link de convite** (`/convite?token=`): quem abre entra e vira convidado | ✅ |
| Modo Missa e PDF | Apresentação em tela cheia no tablet, pedal Bluetooth, tela acesa; PDF com roteiro | ✅ (lê o cache das missas) |
| Entrar e Criar conta | Login, "manter conectado", cadastro com telefone e movimento, conta aguardando ativação | ✅ |
| Perfil | Foto, nome, paróquia, movimento, instrumento, **trocar senha** (derruba os outros aparelhos), tema, sustenidos/bemóis | ✅ O e-mail fica só leitura até existir o serviço de e-mail |
| Senha temporária (**novo**) | Quem entra com a senha gerada pelo admin vai direto para Perfil › Segurança e só usa o painel depois de criar a própria | ✅ |
| Admin › Painel (`/painel/admin`) | Atalhos com contagens (contas aguardando ativação, cantos, flags, movimentos) | ✅ |
| Admin › Usuários | Lista, filtros, ativar, **editar dados e papel, bloquear/liberar, senha temporária, excluir** (com "Desfazer") | 🟡 Tudo pela API, menos convidar e enviar link de senha (dependem do e-mail) |
| Admin › Cantos (**novo**) | Lista com busca e "Mostrar mais"; editor com número, título, autor, tom, letra com pré-visualização, flags agrupadas, PDF da cifra, PDF da partitura, áudio, Audiomack, "Visível no repertório", excluir | ✅ |
| Admin › Flags (**novo**) | Flags por grupo (momento, tempo, ano, tema, outras), criar, editar (nome, identificador, cor, ordem), excluir | ✅ |
| Admin › Movimentos (**novo**) | Criar, renomear, excluir (bloqueado se houver pessoas) | ✅ |
| Publicar no site (**novo**) | Botão nos admins de cantos e flags: gera o site de novo (Deploy Hook da Vercel) | ✅ |

### 2.2 API (`apps/api`)
Fastify + TypeScript em **arquitetura hexagonal**: `routes → controllers → actions → interfaces ← repositories/services`.

| Recurso | Rotas | Observações |
|---|---|---|
| Saúde | `GET /api/health`, `/api/test` | |
| Sessão | `POST /api/auth/login`, `/refresh`, `/logout` | JWT de 15 min + refresh rotativo em cookie httpOnly; reuso derruba a família; argon2id; limite de tentativas |
| Contas | `POST /api/users` (cadastro), `GET/PATCH /api/me`, `PUT /api/me/photo`, `POST /api/auth/password` | Cadastro nasce **pendente**; foto JPG/PNG/WebP até 2 MB; trocar a senha derruba os outros aparelhos |
| Admin de usuários | `GET /api/admin/users`, `PATCH .../:id/activate`, `PATCH .../:id`, `POST .../:id/block` · `/unblock` · `/reset-password`, `DELETE .../:id` | Só admin (`requireRole`). Não age sobre si mesmo; sempre sobra 1 admin ativo (`LAST_ADMIN`); bloquear e senha temporária derrubam as sessões |
| Movimentos | `GET /api/movements`; admin: `POST/PATCH/DELETE /api/admin/movements` | Um por pessoa; excluir em uso → 409 |
| Missas | `GET/POST /api/masses`, `GET/PUT/PATCH/DELETE /api/masses/:id`, `duplicate`, `shares`, `shares/me`, `share-link`, `POST /api/masses/join` | Dono × convidado; 403 para os demais (inclusive admin) |
| Cantos | `GET /api/songs` (`?q=&flags=&full=1`), `GET /api/songs/:ref`; admin: CRUD + `PUT/DELETE /api/admin/songs/:id/files/:kind` | Busca sem acento; filtro OU no grupo e E entre grupos; canto em missa não é excluído |
| Flags | `GET /api/flags`; admin: `POST/PUT/DELETE /api/admin/flags` | Grupos: momento, tempo, ano, tema, outro |
| Publicar | `POST /api/admin/site/publish` | Chama `SITE_DEPLOY_HOOK_URL`; sem ele → 501 |

**Banco:** `users`, `roles`, `user_roles`, `sessions`, `movements`, `masses`, `mass_shares`, `songs`, `flags`, `song_flags` (6 migrations em SQL; a 006 trouxe `parish`, `instrument` e `must_change_password` em `users`). Também há a cópia fiel do banco legado (MySQL → PostgreSQL) em `db/postgres/`, com auditoria independente.

**Postman:** `docs/postman/` traz 55 requisições e os ambientes local e produção. A coleção é gerada por `docs/postman/gerar_colecao.py`.

### 2.3 Qualidade e segurança
**323 testes automatizados (Vitest), todos passando**, rodando no GitHub Actions a cada push e PR:

| Camada | Testes | O que cobre |
|---|---:|---|
| **Unitários da API** (`apps/api/test/unit`) | **77** | domínio (slug, acesso à missa, erros), JWT (vencido, adulterado, `alg: none`, outro segredo), argon2id, schemas (senha, tom, datas, mass assignment, URLs só http/https), storage (path traversal), arquivos identificados pelos bytes, migração dos arquivos do site antigo |
| **Unitários do front** (`apps/web/test`) | **70** | calendário litúrgico, acordes e transposição, refrão, busca e filtros, conversão API → site, slug |
| **Rotas com adaptadores em memória** (`apps/api/test/http`) | **130** | regras das actions e controllers; **matriz de autorização** de todas as rotas (401 sem token, 403 de músico no admin); tokens forjados, conta bloqueada, sem vazamento de hash, erro 500 sem detalhes, helmet, CORS, cookie e limite de tentativas em produção; cobertura do Postman |
| **Integração com Postgres real** (`apps/api/test/integration`) | **46** | todos os métodos dos repositórios (SQL, CHECK, UNIQUE, CASCADE, fuso, busca sem acento, filtros) e fluxos HTTP completos. Banco `psjb_cantos_test`, com trava para nunca rodar em outro |
| **Postman no CI** | 55 req. | a coleção inteira contra a API rodando |

Ou seja: **147 testes unitários puros** (77 da API + 70 do front), 130 de rotas e 46 de integração.

**Bugs encontrados pelos testes e já corrigidos:**
- link de mídia aceitava `javascript:` (risco de XSS);
- calendário litúrgico errado em Pentecostes e no Batismo do Senhor;
- query do link de convite com tipo de parâmetro errado;
- filtro por flags que não filtrava;
- 500 ao excluir movimento em uso.

## 3. O que falta implementar no front

### 3.1 Telas que já existem, mas ainda dependem do serviço de e-mail (§4, item 9)
| Tela | O que falta | Backend necessário |
|---|---|---|
| Perfil › Dados pessoais | Trocar o próprio e-mail | `PATCH /api/me` com `email` + confirmação do novo endereço |
| Recuperar senha (`/recuperar-senha`, `/redefinir-senha`) | Fluxo real por e-mail | `POST /api/auth/forgot` e `/reset` + serviço de e-mail |
| Admin › Usuários | Convidar e "Enviar link por e-mail" na redefinição de senha | convite e link por e-mail |

### 3.2 Funcionalidades novas no front
| Item | Prioridade | Observação |
|---|---|---|
| **Deploy na Vercel** (front + API) com Neon e Blob | Alta | Configuração descrita no README; criar o Deploy Hook do front e pôr em `SITE_DEPLOY_HOOK_URL` |
| **Login em duas etapas (2FA)**: tela do código de 6 dígitos | Alta | Depende de `/api/auth/login/verify` e do e-mail |
| **reCAPTCHA real** (Google ou Turnstile) no cadastro | Alta | Hoje é só visual; precisa da validação no servidor |
| Aviso "há alterações não publicadas" no admin de cantos e flags | Média | Precisa de um registro da última publicação (API) |
| Upload de arquivos **acima de 4 MB** direto para o Blob | Média | MP3 longo passa de 4 MB; depende do token de upload (API) |
| Admin › Usuários: paginação no servidor | Média | Hoje carrega tudo (ok para poucas centenas) |
| Telas de **termos de uso e privacidade** (LGPD) | Média | O cadastro já pede o aceite |
| **Modo offline (PWA)**: missas do dia em cache para o Modo Missa | Média | Hoje o PDF cobre o uso sem internet |
| Player de áudio no Modo Missa | Baixa | |
| Admin › Auditoria (quem fez o quê) | Baixa | Depende do `AuditLog` |
| SEO: `sitemap.xml`, JSON-LD, redirecionamentos das URLs antigas | Baixa | |
| **Testes de tela (Playwright) no CI**: login, editor, convite, admin | Média | Hoje os testes de tela são manuais (scripts locais) |

## 4. O que falta no backend (olhando para o front)

Já feitos em 14/10/2026: os 623 cantos do legado migrados para `songs` (antigo item 20); a migração dos PDFs e MP3 do site antigo para o storage (`npm run db:migrate-files -w api`, MP3 a 64 kbps mono, 518 MB no total, com os erros de cadastro do site antigo corrigidos); perfil (`PATCH /api/me`), troca de senha, editar, bloquear/liberar, excluir e senha temporária no admin de usuários (antigos itens 1, 2 e 4 a 7).

| # | Rota ou recurso | Para qual tela | Detalhes |
|---|---|---|---|
| 3 | `POST /api/auth/forgot` · `/api/auth/reset` | Recuperar senha | resposta sempre igual (não revela o e-mail); token de uso único, 1 h, guardado como hash |
| 8 | `POST /api/admin/users/invite` | Admin › Usuários › Convidar | e-mail com link para criar a senha (7 dias) |
| 9 | **Serviço de e-mail** (Resend, SES ou Postmark) | recuperação, convite, 2FA, aviso de compartilhamento | SPF/DKIM/DMARC em `psjb.org.br` |
| 10 | **2FA por e-mail**: `/api/auth/login` → `challengeId`, `/api/auth/login/verify` | Entrar | código de 6 dígitos, 10 min, 5 tentativas; "confiar neste aparelho" |
| 11 | **reCAPTCHA** validado no servidor | Criar conta | também na recuperação e no login depois de 3 falhas |
| 12 | `AuditLog` + `GET /api/admin/audit` | Admin | registrar as ações de admin |
| 13 | Token de **upload direto para o Blob** (`POST /api/uploads`) | Admin › Cantos | arquivos acima de 4 MB |
| 14 | Registro da última publicação (`GET /api/admin/site/status`) | Admin › Cantos | mostrar "alterações não publicadas" |
| 15 | Paginação em `GET /api/admin/users` | Admin › Usuários | `?page=&pageSize=` |
| 16 | **Concorrência na edição de missa** (versão / `If-Match`) | Editor de missa | hoje, com dois convidados salvando juntos, vale o último |
| 17 | E-mail "Uma missa foi compartilhada com você" | Compartilhar | depende do item 9 |
| 18 | Limite de tentativas **compartilhado entre instâncias** (ex.: Upstash Redis) | Segurança em produção | na Vercel cada instância tem o seu contador |
| 19 | Limpeza periódica de sessões vencidas (cron) | — | tabela `sessions` cresce com o tempo |

## 5. Próximos passos sugeridos
1. **Deploy na Vercel + Neon + Blob**, com o Deploy Hook ligado ao "Publicar no site". Antes de desligar a HostGator, rodar `npm run db:migrate-files -w api` contra o Neon e o Blob (README, Deploy, passo 4).
2. **Serviço de e-mail + recuperação de senha + convite + 2FA** (itens 3, 8, 9 e 10), e a troca do próprio e-mail.
3. **Revisão das flags dos 623 cantos** com a equipe de liturgia (momentos de Velas/Preces/Saída, Creio e Sequências como momento?).
4. **Testes de tela com Playwright no CI.**

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
