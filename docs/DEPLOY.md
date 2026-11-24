# Deploy em produção: Vercel + Neon + Blob + Resend

Roteiro para tirar o site do GitHub Pages (demonstração) e publicá-lo com a API, o banco e os e-mails de verdade. Este documento registra **o que vamos fazer, em que ordem e quem faz cada passo**. Marque cada item quando ele for concluído.

> **Regra de ouro:** nenhuma chave, senha ou token passa pelo chat nem entra no git. As chaves do Neon, do Blob e do Resend entram sozinhas nos projetos pela integração da Vercel. As senhas que só a pessoa deve saber (como a do superadmin) são digitadas por ela no terminal.

## 1. Visão geral

```
            cantos.psjb.org.br  (DNS no Cloudflare)
                    │  CNAME
                    ▼
   ┌───────────────────────────────┐  /api/* (rewrite)   ┌──────────────────────────────┐
   │ Vercel · projeto "web"        │ ──────────────────▶ │ Vercel · projeto "api"       │
   │ raiz apps/web (Next.js 16)    │                     │ raiz apps/api (Fastify)      │
   │ API_URL = URL da API          │ ◀── Deploy Hook ─── │ "Publicar no site"           │
   └───────────────────────────────┘                     └──────┬─────────┬─────────┬───┘
                                                                │         │         │
                                                         Neon (Postgres) Blob   Resend (e-mail)
                                                         DATABASE_URL    BLOB_  RESEND_API_KEY
                                                                         READ_WRITE_TOKEN
```

- **Front e API em projetos separados**, no mesmo repositório (`OtavioMoreira/Psjb_Cantos`), cada um com sua pasta raiz. O front repassa `/api/*` para a API, então o cookie de sessão fica no domínio do site.
- **O GitHub Pages continua** como demonstração (sem API) até o domínio ser trocado. Depois, dá para desligar o workflow `deploy-pages.yml` ou mantê-lo como vitrine.
- **Custo:** tudo no plano grátis. Limites que importam: Blob com 1 GB de espaço e 10 GB de download por mês (os arquivos migrados somam ~518 MB); Resend com 3.000 e-mails por mês e 100 por dia; Neon com 0,5 GB de banco.
- **Termos do plano Hobby da Vercel:** é para uso não comercial. Um site paroquial sem venda se encaixa; se um dia tiver doações ou loja, reavaliar o plano Pro.

## 2. Quem faz o quê

| Passo | Quem | Precisa de |
|---|---|---|
| Criar a conta na Vercel (Hobby, "Continue with GitHub") | Otavio | conta do GitHub dona do repositório |
| Login da CLI nesta sessão (`! npx vercel login`) | Otavio | confirmar no navegador |
| Criar os projetos, instalar Neon, Blob e Resend, configurar variáveis | Claude (pela CLI) | o login acima |
| Digitar a senha do superadmin no seed | Otavio | uma senha forte, guardada no gerenciador de senhas |
| Rodar migrations, importar cantos, migrar arquivos | Claude | Neon e Blob prontos |
| Cadastrar no Cloudflare os registros do Resend e o CNAME do site | quem tem acesso ao Cloudflare do `psjb.org.br` | a lista exata (seção 6) |
| Aprovar o site na URL `*.vercel.app` antes da troca do domínio | Otavio e a coordenação | — |
| Confirmar se a paróquia usa e-mail `@psjb.org.br` antes de cancelar a HostGator | Otavio | falar com a secretaria |

## 3. Pré-requisitos

- [x] Conta na Vercel criada com o GitHub do repositório (plano Hobby).
- [x] CLI logada nesta máquina: `! npx vercel login` (a sessão do Claude passa a enxergar a conta).
- [ ] Descobrir **quem tem acesso à conta do Cloudflare** do `psjb.org.br` (o DNS está lá, não na HostGator).
- [x] Confirmar que o domínio `psjb.org.br` está **pago no registro.br** (RDAP em 18/11/2026: vence em 29/06/2031; DNS no Cloudflare desde 30/06/2021, então o editor de DNS do cPanel da HostGator não vale) (é isso que mantém o DNS no ar depois de cancelar a HostGator).

## 4. Passo a passo

### 4.1 Projeto da API (`apps/api`)
- [x] `vercel link` em `apps/api` criando o projeto **psjb-cantos-api** (raiz `apps/api`, framework Fastify, Node 24). As funções rodam em São Paulo (`apps/api/vercel.json`, `regions: ["gru1"]`), junto do banco.
- [x] Ligar o projeto ao GitHub (reconectado pelo painel, Settings › Git, depois de um "Bad credentials" na CLI).
- [x] **Neon** pelo Marketplace (`vercel integration add neon`), região São Paulo (`gru1`, plano `free_v3`), ligado ao projeto da API. Cria o `DATABASE_URL`; usar a string *pooled* (host com `-pooler`, `sslmode=require`).
- [x] **Blob store** `psjb-cantos-arquivos` (público, `gru1`) ligado ao projeto da API. Cria o `BLOB_READ_WRITE_TOKEN`.
- [x] **Resend** pelo Marketplace (plano `free`, domínio `psjb.org.br`) (`vercel integration add resend`), região `sa-east-1`. Cria a `RESEND_API_KEY`. Sem ela a API não sobe em produção.
- [x] Variáveis de produção (menos `SITE_DEPLOY_HOOK_URL`, que vem no passo 4.3) (sem segredo no chat; o `JWT_SECRET` é gerado direto no terminal com `openssl rand -base64 48 | vercel env add JWT_SECRET production`):

  | Variável | Valor |
  |---|---|
  | `NODE_ENV` | `production` |
  | `JWT_SECRET` | gerado (48 bytes aleatórios) |
  | `WEB_ORIGIN` | URL do front (`https://psjb-cantos.vercel.app`; depois, também `https://cantos.psjb.org.br`) |
  | `PUBLIC_URL` | URL da API (`https://psjb-cantos-api.vercel.app`) |
  | `APP_URL` | URL do front (usada nos links dos e-mails) |
  | `EMAIL_FROM` | `Cantos PSJB <onboarding@resend.dev>` até o domínio ser verificado; depois `Cantos PSJB <nao-responda@psjb.org.br>` |
  | `EMAIL_ENABLED` | `false` durante a aprovação (trava todo envio e desliga o 2FA); **apagar** depois do passo 4.5 |
  | `LOGIN_2FA` | não definir (ligado em produção quando o e-mail está ativo). Ver a observação abaixo |
  | `SITE_DEPLOY_HOOK_URL` | Deploy Hook do front (passo 4.3) |
  | `CRON_SECRET` | gerado no terminal (`openssl rand -hex 32`); a Vercel o manda no cron dos salmos (`apps/api/vercel.json`, seg–qui 3h) |

- [x] Primeiro deploy da API e teste de `GET /api/health` (18/11/2026). Três ajustes para a Vercel:
  - a Vercel procura a entrada em `app.ts`, `index.ts` e `server.ts`, nessa ordem, e só aceita um arquivo com `from "fastify"` no texto: a montagem virou `src/buildApp.ts`, e o `src/server.ts` importa o tipo `FastifyInstance`;
  - o `@fastify/static` (pasta `uploads/` local) só é importado em desenvolvimento, porque a dependência `content-disposition` 3 é ESM e o runtime da Vercel recusa o `require()`;
  - o `engines` `>=20.6` faz a Vercel usar o Node 26 em vez do 24 das configurações (só um aviso, funciona).

> **Observação sobre o 2FA antes do domínio verificado:** com o remetente de teste (`onboarding@resend.dev`), o Resend só entrega para o e-mail dono da conta do Resend. Até o `psjb.org.br` ser verificado, as outras pessoas não receberiam o código do login. Por isso a aprovação roda com **`EMAIL_ENABLED=false`** (18/11/2026): nenhum e-mail sai, o login é só com senha e, para quem esqueceu, vale a senha temporária do admin. Depois de verificar o domínio (4.5), apagar a variável e fazer redeploy: o envio e o 2FA voltam sozinhos.

### 4.2 Banco de produção (Neon)
Rodado desta máquina, com a `DATABASE_URL_UNPOOLED` do `apps/api/.env.local` (gerado pelo `vercel link`/`env pull`, fora do git) passada na linha de comando, para não usar o `.env` local:
- [x] `npm run db:migrate -w api` (cria as tabelas, migrations 001 a 007).
- [x] `npm run db:seed -w api` com `SEED_ADMIN_PASSWORD` **digitada pelo Otavio** num terminal separado (`read -s`) e `SEED_ADMIN_EMAIL` com o e-mail dele (depois trocado no banco para `contato.otavio.moreira@gmail.com`, a pedido) (o código do 2FA e o remetente de teste do Resend só chegam no e-mail real do dono da conta). Cria o superadmin e os 8 movimentos iniciais.
- [x] `npm run db:import-songs -w api` (623 cantos e 35 flags, mantendo os ids).
- [x] `npm run db:migrate-files -w api` com o `BLOB_READ_WRITE_TOKEN` de produção: copia os 1.211 PDFs e MP3 do site antigo para o Blob (MP3 a 64 kbps mono, ~518 MB) e troca os links no banco. Usa o backup local `db/arquivos-legado/originais/` (`--origem`) para não baixar de novo da HostGator. **É este passo que libera o desligamento da HostGator.**
- [x] Conferir: nenhum link em `songs` apontando para `cantos.psjb.org.br` (0 de 623).

### 4.3 Projeto do front (`apps/web`)
- [x] `vercel link` em `apps/web` criando o projeto **psjb-cantos** (raiz `apps/web`, Next.js, ligado ao GitHub).
- [x] Variável `API_URL=https://psjb-cantos-api.vercel.app` (Production e Preview). No build, os cantos e as flags vêm da API, então **a API e o banco precisam estar prontos antes**.
- [x] Primeiro deploy do front: **https://psjb-cantos.vercel.app** (18/11/2026).
- [x] Criar o **Deploy Hook** (`publicar-no-site`) (Settings › Git › Deploy Hooks, branch `main`) e colocar a URL em `SITE_DEPLOY_HOOK_URL` no projeto da API; redeploy da API.

### 4.4 Testes na URL `*.vercel.app`
- [ ] Repertório: lista, busca, filtros, detalhe com cifra, PDF e áudio vindos do Blob.
- [ ] Login do superadmin com o código do 2FA chegando no e-mail.
- [ ] Recuperação de senha e troca de e-mail (links apontando para `APP_URL`).
- [ ] Convite de um usuário de teste e ativação.
- [ ] Missas: criar, compartilhar, link de convite, Modo Missa, PDF.
- [ ] Admin: editar um canto, enviar arquivo, "Publicar no site" gerando um novo build.
- [ ] Celular e tablet (o uso principal).
- [ ] Rodar a coleção do Postman com o ambiente `psjb-producao` (sem criar lixo no banco, ou apagando depois).

### 4.5 E-mail com o domínio da paróquia
- [ ] No painel do Resend, adicionar o domínio `psjb.org.br` (região `sa-east-1`). Ele mostra os registros da seção 6.
- [ ] Cadastrar os registros no Cloudflare (**sem proxy**, nuvem cinza).
- [ ] Verificar no Resend e trocar `EMAIL_FROM` para `Cantos PSJB <nao-responda@psjb.org.br>`; redeploy da API.
- [ ] Testar um e-mail para Gmail e outro para Outlook/Hotmail (caixa de entrada, não spam).

### 4.6 Domínio `cantos.psjb.org.br`
Só depois da aprovação do site na URL `*.vercel.app`, porque hoje esse endereço ainda serve o site antigo da HostGator.
- [ ] Adicionar `cantos.psjb.org.br` no projeto do front (Settings › Domains).
- [ ] No Cloudflare, trocar o registro de `cantos` por `CNAME cantos → cname.vercel-dns.com`, **sem proxy** (a Vercel emite o certificado).
- [ ] Atualizar `APP_URL` e `WEB_ORIGIN` na API para `https://cantos.psjb.org.br`; redeploy.
- [ ] Conferir HTTPS, login (cookie no domínio novo) e links dos e-mails.

### 4.7 Desligar a HostGator
- [ ] Confirmar que nenhum canto aponta para `cantos.psjb.org.br/uploads` (passo 4.2).
- [ ] **Confirmar com a secretaria se existem caixas `@psjb.org.br`** (ver seção 5). Se existirem, migrar antes.
- [ ] Guardar um backup completo do cPanel (arquivos e banco MySQL) fora da HostGator.
- [ ] Remover do SPF o `include:websitewelcome.com` quando o e-mail não passar mais pela HostGator.
- [ ] Cancelar a hospedagem.

## 5. Atenção: e-mail da paróquia na HostGator

O DNS do `psjb.org.br` (consultado em 15/10/2026) mostra:

| Registro | Valor | O que significa |
|---|---|---|
| NS | `wanda.ns.cloudflare.com`, `zahir.ns.cloudflare.com` | o DNS está no Cloudflare: cancelar a HostGator **não derruba o domínio** |
| MX | `mail.psjb.org.br` → `192.185.214.85` (HostGator) | os e-mails `@psjb.org.br` são recebidos pela HostGator |
| TXT (SPF) | `v=spf1 a mx include:websitewelcome.com ~all` | autoriza a HostGator a enviar pelo domínio |
| `_dmarc` | (não existe) | sem política DMARC |

Se a paróquia usa caixas como `secretaria@psjb.org.br`, **cancelar a HostGator acaba com elas**. Antes de cancelar, migrar para outro serviço (Google Workspace for Nonprofits, Zoho Mail grátis ou Microsoft 365 para organizações sem fins lucrativos) e trocar o MX. O Resend não conflita com isso: ele envia por um subdomínio próprio (`send.psjb.org.br`) e não recebe e-mail.

## 6. Registros DNS no Cloudflare

Os valores exatos (principalmente a chave DKIM) aparecem no painel do Resend. Em 18/11/2026 o Resend passou a pedir CNAMEs no lugar do MX e do TXT de `send`:

| Tipo | Nome | Valor | Para quê |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0...` (chave pública do Resend, exata no painel) | DKIM: assina os e-mails |
| CNAME | `send` | `send.forge.rmta.net` | SPF e retorno de devoluções do subdomínio de envio |
| CNAME | `rsend` | `rsend-sae1.forge.rmta.net` | SPF da região `sa-east-1` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<e-mail da paróquia>` | DMARC: começa só monitorando |
| CNAME | `cantos` | `cname.vercel-dns.com` | site novo (só no passo 4.6) |

- Todos com o **proxy do Cloudflare desligado** (nuvem cinza).
- O SPF da raiz (`psjb.org.br`) **não muda**, porque o Resend usa o subdomínio `send`.
- Depois de algumas semanas sem problemas, o DMARC pode subir para `p=quarantine`.

## 7. Depois do deploy

- Atualizar `docs/ESTADO-DO-PROJETO.md`, `planning.md` (Fase 3, deploy ✅), o README (URL de produção) e o `CLAUDE.md` (fase atual e deploy).
- Ambiente `psjb-producao` do Postman apontando para a URL real.
- Pendências: ver `docs/ESTADO-DO-PROJETO.md` §3 e §5. Limite de tentativas compartilhado, faxina por cron e desafio no servidor já estão prontos (24/11/2026).

## 8. Atualização de 24/11/2026 (antes do push na `main`)

A API nova lê colunas e tabelas que ainda não existem no Neon. **Rodar as migrations antes do push**, senão as missas e o login quebram em produção.

- [ ] `npm run db:migrate -w api` com o `DATABASE_URL` de produção (migrations 009 a 012: versão da missa, `site_state` com gatilhos, `audit_log` e `rate_limits`). São só acréscimos (`ADD COLUMN` com padrão, tabelas novas); o código antigo continua funcionando com elas.
- [ ] Push na `main` (a Vercel publica a API e o front; o Pages publica a demonstração).
- [ ] Conferir em **Settings › Cron Jobs** do projeto da API os dois crons: salmos (seg–qui 3h) e **faxina (todo dia às 4h)**. Os dois usam o mesmo `CRON_SECRET`.
- [ ] Testar: editar a mesma missa em dois aparelhos ao mesmo tempo (as alterações se juntam); "Há alterações não publicadas" no admin de cantos; Admin › Auditoria; enviar um MP3 acima de 4 MB (vai direto ao Blob); abrir uma missa no Modo Missa, desligar a internet e recarregar.
- [ ] **Desafio "não sou um robô"** (depois do acesso ao Cloudflare): criar um widget do **Turnstile** para `cantos.psjb.org.br` (e `psjb-cantos.vercel.app`), pôr `CAPTCHA_SECRET` no projeto da API e `NEXT_PUBLIC_CAPTCHA_SITE_KEY` no projeto do front, e fazer redeploy dos dois. Sem as chaves, o desafio fica desligado.
- [ ] Opcional: `SITE_URL` no projeto do front enquanto o domínio for `psjb-cantos.vercel.app` (o padrão do sitemap e do canonical é `https://cantos.psjb.org.br`).
