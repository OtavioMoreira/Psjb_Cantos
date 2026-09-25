---
name: psjb-regras-de-negocio
description: Regras de negócio do site Cantos PSJB (Paróquia Catedral São João Batista). Carregue antes de criar ou alterar qualquer coisa ligada a cantos, categorias e filtros, busca, cifra e transposição, calendário litúrgico, Monte sua Missa, Modo Missa (tablet), usuários, papéis e status, login, cadastro com confirmação de e-mail, reCAPTCHA, recuperação de senha, admin de usuários, autenticação JWT com 2FA por e-mail, ou ao planejar a API e o banco de dados.
---

# Regras de negócio do Cantos PSJB

Estas são as regras combinadas com o cliente. As marcadas **(futuro)** dependem de API, banco ou serviço de e-mail e ainda não existem. Na Fase 1 elas aparecem só no visual, e o plano está em `planning.md`. Se uma mudança conflitar com uma regra daqui, pergunte ao usuário antes. Quando uma regra nova for combinada, atualize este arquivo.

## 1. Produto
- O site substitui https://cantos.psjb.org.br/. O objetivo é **evitar livros e impressões na missa**: consultar cantos (letra, cifra, partitura, áudio), montar a missa e tocar pelo tablet.
- O uso principal é em **celular e tablet**, e tudo precisa funcionar bem nos dois. O desktop é secundário, mas também é suportado.
- O visual é moderno sem perder a tradição católica: marfim, verde do logo `#1F3D2B`, dourado sóbrio só em detalhes e títulos em serifada clássica.
- O **tema padrão é claro**, mesmo com o sistema em modo escuro. O escuro é opcional, escolhido pelo botão do header ou no perfil.
- Textos em pt-BR, acolhedores, tratando a pessoa por "você". Termos litúrgicos com maiúscula (Tempo Comum, Ato Penitencial).

## 2. Cantos
- **Campos:** número, título, compositor, tom original, letra com cifra, momentos, tempos, anos, temas e mídias (PDF da cifra, PDF da partitura, MP3, embed do Audiomack).
- **Número:** sempre com 3 dígitos, no formato **"Nº 001"**. Alguns cantos não têm número (salmos e aclamações).
- **Slug:** `NNN-titulo` quando há número (`001-a-feliz-espera`); sem número, só o título (`natal-dia-salmo-097`).
- **Letra e cifra:** formato "acordes na linha de cima". O tom original é o primeiro acorde da primeira linha de acordes.
- **Refrão:** a linha de letra do refrão é marcada como `**texto**` no `songs.json` e sempre aparece **em negrito**, tanto na cifra quanto no "Só letra".
  - A marcação veio do negrito do site antigo: 95 dos 121 cantos têm refrão marcado; os demais não tinham negrito na origem.
  - Os marcadores `**` nunca aparecem na tela nem entram na busca.
- **Recursos ausentes:** a aba correspondente fica desabilitada ("Partitura ainda não disponível").
- **Dados de exemplo:** os 121 cantos reais em `data/songs.json` foram extraídos da primeira página de 14 categorias do site antigo, e as mídias apontam para os arquivos de lá.
  - As categorias **Velas** e **Preces** não existem no site antigo. Para ilustrar, os cantos do Espírito Santo foram marcados como Velas e os de Paz como Preces. Revisar na migração real.

## 3. Categorias (taxonomia)
A categoria única do site antigo virou **4 eixos independentes**, e um canto pode ter **vários valores em cada eixo**:
- **Momento da Missa:** Velas, Entrada, Ato Penitencial, Glória, Salmo, Aclamação, Preces da Comunidade, Ofertório, Santo, Cordeiro, Comunhão, Saída.
- **Tempo litúrgico** (cada um com sua cor):

  | Tempo | Cor |
  |---|---|
  | Advento | roxo `#5B2C83` |
  | Natal | dourado `#C9A24A` |
  | Quaresma | roxo |
  | Páscoa | dourado |
  | Tempo Comum | verde `#2E7D4F` |

  A cor aparece só como destaque: faixa de 4 px no card, bolinha ou borda do chip.
- **Ano litúrgico:** A, B e C. Só importa para Salmos e Aclamações.
- **Tema:** Espírito Santo, Marianos, Paz, Vocacionais e Missão, e outros vindos do site antigo (Crianças, Família, Santos...).
- **Recursos:** o filtro "tem" aceita cifra, partitura e áudio.

## 4. Busca e filtros (`/cantos`)
- **Busca instantânea e sem acento** ("sao" encontra "São"). Todos os termos digitados precisam aparecer no canto.
- **Prioridade dos resultados:** número exato (digitar "45" ou "045" põe o canto no topo) > título (começo do título vale mais) > compositor > letra.
- **Busca na letra:** o índice completo (`/dados/cantos.json`) só é baixado quando a pessoa digita 3 ou mais caracteres não numéricos. Se o termo foi achado na letra, o card mostra um trecho com o termo destacado.
- **Combinação dos filtros:** OU dentro do mesmo eixo, E entre eixos diferentes. Cada opção mostra a contagem ao vivo, e opções com zero resultados continuam clicáveis.
- **URL:** o estado vai inteiro para a URL, para poder compartilhar: `?q=&momento=&tempo=&ano=&tema=&tem=&ordem=`, com valores separados por vírgula.
- **Ordenação:** por número (padrão) ou por título A–Z. Com busca ativa, ordena por relevância.
- **Chips:** são removíveis, e "Limpar tudo" só aparece com 2 ou mais filtros.
- **Nenhum resultado:** sugere remover cada filtro ativo.

## 5. Detalhe do canto, cifra e transposição
- **Abas:** Letra e Cifra, Partitura e Áudio. A aba padrão é a primeira disponível, e a aba ativa vai para `?aba=`.
- **Transposição:**
  - Em semitons de **−6 a +5**, na URL como `?tom=+2`, com o tom mostrado por extenso ("Ré (D)") e o botão ↺ para voltar ao original.
  - Sustenidos ou bemóis seguem a preferência do perfil.
- **Tamanho da letra:** de 12 a 40 px, em passos de 2. É uma preferência global.
- **"Só letra":** esconde os acordes e mostra uma capitular na primeira linha.
- **Quebra de linha da cifra:**
  - Acontece **só entre palavras**; cada acorde fica preso à sua sílaba e nunca há rolagem horizontal.
  - Acordes que passam do fim da letra se juntam à última palavra.
  - Números de estrofe ("1.") aparecem em destaque.
- **"Adicionar à minha missa":**
  - Abre um popover com o momento sugerido (vem da categoria do canto) e a lista de missas, mais a opção "Nova missa…".
  - Sem login, leva a `/entrar?volta=<página>`.
- **Áudio:** um só por vez. Tem velocidades de 0,75×, 1× e 1,25× e download.

## 6. Calendário litúrgico
- **Tempo pela data:**

  | Tempo | Período |
  |---|---|
  | Advento | do 1º Domingo do Advento até 24/12 |
  | Natal | de 25/12 até o Batismo do Senhor |
  | Quaresma | da Quarta-feira de Cinzas até a véspera da Páscoa |
  | Páscoa | da Páscoa até Pentecostes |
  | Tempo Comum | o restante |

- **Ano A/B/C:** o ano litúrgico começa no Advento. Com Y = ano civil em que ele termina: `Y % 3 == 1` é Ano A, `2` é Ano B e `0` é Ano C (2025-26 é Ano A).
- **Home:** mostra o "Tempo atual · Ano X", recalculado a cada build (o deploy roda diariamente).

## 7. Monte sua Missa
- **Momentos padrão, nesta ordem:** Velas, Entrada, Ato Penitencial, Glória, Salmo, Aclamação, Preces da Comunidade, Ofertório, Comunhão, Saída.
- **Cantos adicionais:** momentos extras com nome livre (ex.: "Ação de graças", "Coroação de Nossa Senhora").
- **Mais de um canto por momento:** permitido (ex.: 2 de Comunhão).
- **Cabeçalho da missa:**
  - Nome, data e horário. Sem nome, a missa se chama "Missa de dd/mm".
  - **Tempo e ano são sugeridos pela data** e podem ser editados.
- **Seletor de canto:**
  - Já vem filtrado pelo momento do slot e pelo tempo da missa; para Salmo e Aclamação, também pelo ano.
  - Os filtros aparecem como chips removíveis, e há a opção "Todos os momentos".
  - Cantos **sem tempo ou ano cadastrado servem para qualquer tempo ou ano**.
  - Cantos do tempo da missa aparecem primeiro.
- **Depois de escolher:** no desktop, o seletor pula para o próximo momento vazio; no celular, fecha.
- **Tom por missa:** a transposição é salva no item da missa e não altera o canto original.
- **Edição:**
  - Reordenar momentos com ↑/↓ ou arrastando no desktop.
  - Remover canto mostra "Desfazer".
  - O nome do canto sempre aparece inteiro, em linha própria; o tom fica numa linha abaixo.
- **Salvamento:** automático, 1 s depois da última alteração ("Salvando… / Salvo"). Uma missa nova ganha ID e URL (`/painel/missas/editar?id=`) no primeiro salvamento.
- **Minhas Missas:**
  - Filtros Próximas, Passadas e Todas, e busca.
  - **Duplicar** cria "Cópia de …" sem data. **Excluir** tem "Desfazer".
  - O card mostra o progresso: "X de Y momentos".
- **"Abrir no Modo Missa":** fica desabilitado se a missa não tem nenhum canto.
- **PDF da missa:** para quem não tem tablet imprimir, ou para ter tudo na ordem sem internet.
  - O botão **"Baixar PDF"** fica no editor e nos cards de "Minhas Missas", e fica desabilitado se a missa não tem cantos.
  - **Gerado no navegador** com jsPDF, carregado só ao clicar, porque o site é estático e não tem servidor.
  - **Opções:** "Letra e cifra" ou "Só a letra"; tamanho Pequena, Média (padrão) ou Grande; "Cada canto começa em uma página nova" (ligado por padrão).
  - **Página 1:** nome da paróquia, nome da missa, data por extenso, horário, tempo e ano, e o **roteiro** com número, momento, canto (com o Nº) e a página de cada um.
  - **Cantos:** na ordem da missa, cada um com momento e posição ("ENTRADA · 2/9"), título, Nº, autor e tom.
    - Na versão com cifra, o tom é o **transposto nesta missa**, indicando o original quando muda.
    - O **refrão sai em negrito**.
    - A cifra usa fonte monoespaçada, com a mesma regra de quebra da tela, e acorde e letra nunca ficam em páginas diferentes.
  - **Rodapé em todas as páginas:** nome da missa, data e "página X / N".
  - **Arquivo:** `missa-<nome>-<aaaa-mm-dd>.pdf`, formato A4.
- **Onde fica salvo:** Fase 1 no `localStorage` do aparelho. **(futuro)** Na API, com compartilhamento por link para a equipe e sincronia entre computador e tablet.

## 8. Modo Missa (`/missa?id=`): modo de apresentação na missa
- **Objetivo:** tela cheia e visual objetivo, com **letra preta, fundo branco e refrão em negrito**. Não tem capitular nem cores de destaque na letra; o número da estrofe é só negrito.
- **Tela cheia:** entra sozinho no primeiro toque ou tecla, porque o navegador exige um gesto. Se a pessoa sair da tela cheia, não é forçado de novo.
  - **iPhone não suporta tela cheia pelo navegador.** Nele (e como reforço no iPad), o site deve ser **instalado na tela de início** e aí abre sem as barras do navegador. Isso é garantido pelo `manifest` com `display: fullscreen` e pelo `appleWebApp`.
- **Cifra ou Só letra:** um botão alterna entre os dois; "Só letra" é para quem só canta. A escolha fica lembrada no aparelho, e o controle de tom só aparece no modo Cifra.
- **Título:** o título completo do canto aparece em destaque no topo da letra (o do cabeçalho pode ser cortado em telas estreitas).
- **Sequência:** os cantos de todos os momentos em ordem, pulando os vazios. O cabeçalho mostra "ENTRADA · 2/9" e o título.
- **Navegação:**
  - Swipe horizontal: mais de 60 px, movimento predominantemente horizontal e rápido; nunca dispara durante a rolagem vertical.
  - Setas ←/→ e PageUp/PageDown, que é o que o **pedal Bluetooth** envia. Espaço e ↓ rolam a letra.
  - O roteiro lateral fica fixo em paisagem e vira drawer em retrato; ele marca os cantos já tocados com ✓.
  - Barra inferior com anterior e próximo pelo nome do momento, mais bolinhas clicáveis.
- **Paletas:**

  | Paleta | Fundo | Acordes |
  |---|---|---|
  | Dia (padrão) | branco | verde |
  | Noite | preto | âmbar |
  | Sépia | sépia | — |

- **Letra e tom:** fonte de 18 a 56 px, lembrada por aparelho. O tom (−/+) **é salvo na missa**.
- **Tela sempre acesa (Wake Lock):** se o aparelho não suportar, mostra um aviso que fecha com um toque. Também há botão de tela cheia.
- **Controles:** somem após 4 s sem toque e voltam com um toque.
- **Tablet em retrato e celular:** o tom fica numa segunda linha, para o título não ser cortado.
- **Fim:** tela "Missa concluída. Deus seja louvado!", com Recomeçar e Voltar ao painel.
- **Alvos de toque:** ≥ 56 px.
- **(futuro)** Funcionar offline (PWA) e mostrar o player de áudio do canto atual.

## 9. Usuários: papéis e status
- **Papéis:**
  - **Administrador:** gerencia usuários e usa tudo.
  - **Coordenador:** monta e compartilha missas.
  - **Músico:** usa o repertório e monta missas. É o papel padrão no cadastro.
- **Status:**
  - **pendente** (aparece como "Aguardando e-mail"): criou conta ou foi convidado e ainda não confirmou o e-mail. **Não consegue entrar.**
  - **ativo:** consegue entrar.
  - **bloqueado:** não consegue entrar. Na tentativa de login, vê o **motivo** definido pelo admin e a orientação "Procure a coordenação da paróquia".
- **Contas de demonstração:** admin `admin@psjb.org.br` / `admin123` e músico `musica@psjb.org.br` / `cantos123`.

## 10. Login, cadastro, confirmação e recuperação
- **`/entrar`:** abas **Entrar** e **Criar conta** (`?aba=criar`).
- **Mensagens de erro no login:**
  - Credenciais inválidas: genérica ("E-mail ou senha não conferem").
  - Conta pendente: oferece "Reenviar e-mail de confirmação".
  - Conta bloqueada: mostra o motivo.
- **Cadastro:**
  - Nome (3+ caracteres), e-mail válido, ministério (opcional), senha e confirmação.
  - A senha precisa de **8 ou mais caracteres, com letras e números**, e há medidor de força.
  - Aceite dos termos e da privacidade (LGPD) é obrigatório.
  - **reCAPTCHA** obrigatório.
  - A conta nasce **pendente**, com papel músico.
- **Confirmação de e-mail:**
  - Tela "Confirme seu e-mail" com reenvio limitado a **1 a cada 60 s**.
  - O link `/confirmar-email?token=` **ativa a conta automaticamente** (pendente → ativo).
  - Token inválido ou usado mostra "Link inválido ou expirado".
- **Recuperar senha:**
  - `/recuperar-senha` responde **sempre a mesma mensagem** e **nunca revela se o e-mail está cadastrado**.
  - `/redefinir-senha?token=` define a nova senha, com a mesma regra de força.
- **Validade dos tokens (futuro):**

  | Token | Validade |
  |---|---|
  | Confirmação de e-mail | 24 h |
  | Redefinição de senha | 1 h |
  | Convite | 7 dias |
  | Código 2FA | 10 min, máx. 5 tentativas |

  Todos são de **uso único** e ficam guardados **só como hash**.
- **(futuro)** O cadastro também não revela se o e-mail já existe: a resposta é sempre "enviamos um link", e o e-mail enviado avisa "você já tem conta".
- **Fase 1:** sem serviço de e-mail, a tela mostra uma caixa "Demonstração" com o link que chegaria por e-mail.

## 11. Perfil (`/painel/perfil`)
- **Dados editáveis:** nome, e-mail, paróquia, ministério e instrumento/voz.
- **Troca de senha:** exige a senha atual.
- **Preferências:** tema (claro, escuro ou sistema) e sustenidos/bemóis.
- **(futuro)** Trocar o e-mail exige confirmar o novo endereço, e o antigo continua valendo até lá.

## 12. Admin de usuários (`/painel/admin/usuarios`, só papel admin)
- **Acesso:** o menu "Usuários" só aparece para admins. Outros papéis veem "Acesso restrito". **(futuro)** A API também recusa com 403, porque esconder o menu não é segurança.
- **Visão geral:**
  - Resumo clicável: Total, Ativos, Aguardando e-mail e Bloqueados.
  - Busca por nome, e-mail ou ministério, e filtro por papel.
  - A lista mostra primeiro os pendentes, depois os bloqueados e por fim os ativos.
- **Ações:**
  - **Editar** nome, e-mail, ministério e papel.
  - **Bloquear** com motivo, com "Desfazer". **Liberar** volta para ativo se o e-mail já foi confirmado, senão para pendente.
  - **Ativar sem confirmação** e **reenviar confirmação**: só para pendentes.
  - **Redefinir senha:** "Enviar link por e-mail" (recomendado) ou "Gerar senha temporária", exibida **uma única vez**. **(futuro)** A senha temporária obriga a troca no próximo login.
  - **Convidar:** nome, e-mail e papel. O convidado nasce pendente e recebe um e-mail para criar a senha.
  - **Excluir:** pede confirmação, sugere bloquear como alternativa reversível e tem "Desfazer".
- **Proteções:**
  - O admin **não pode bloquear, excluir nem rebaixar a si mesmo**.
  - **(futuro)** Precisa existir sempre pelo menos 1 admin ativo.
- **(futuro)** Toda ação de admin gera um registro de auditoria (`AuditLog`), e bloquear ou redefinir senha **revoga as sessões ativas** da pessoa.

## 13. Autenticação real (futuro, Fase 3): JWT + dois fatores por e-mail
1. `POST /api/auth/login` com e-mail e senha. Pendente recebe 403 `EMAIL_NOT_VERIFIED`, bloqueado recebe 403 `ACCOUNT_BLOCKED` (com o motivo), e credencial errada recebe uma mensagem genérica.
2. Senha correta: a API envia um **código de 6 dígitos por e-mail** (10 min, uso único, máx. 5 tentativas) e devolve um `challengeId`.
3. O front mostra "Digite o código enviado para m***@…", com 6 campos, colar funcionando e reenvio após 60 s.
4. `POST /api/auth/login/verify` com o código correto emite:
   - **access token JWT de 15 min**, que fica **só em memória** no front e nunca em `localStorage`;
   - **refresh token** opaco em **cookie httpOnly + Secure + SameSite=Lax**, **rotacionado** a cada uso, com validade de 30 dias se "manter conectado" estiver marcado, senão 1 dia. Reuso detectado revoga todas as sessões daquele login.
5. "Confiar neste dispositivo por 30 dias" dispensa o código naquele aparelho, útil para o tablet da paróquia.
- **Senhas:** hash com **argon2id**.
- **Rate limit:** no login, no cadastro, nos reenvios e no 2FA.
- **Autorização por papel no servidor:** `requireRole('admin')`.
- **reCAPTCHA:** v3 invisível ou v2 checkbox (Google) ou Cloudflare Turnstile. O token é **validado no servidor** com a chave secreta. Vale para cadastro, recuperação de senha e login depois de 3 falhas.
- **E-mail transacional:** Resend, SES ou Postmark, com SPF/DKIM/DMARC em `psjb.org.br`. Modelos:
  - Confirme seu e-mail
  - Seu código de acesso
  - Redefinir senha
  - Você foi convidado
  - Acesso bloqueado ou liberado
  - E-mail alterado
- **LGPD:** consentimento no cadastro e exportação ou exclusão dos dados a pedido.

## 14. Regras de UX e acessibilidade
- **Celular e tablet primeiro:** validar sempre em 360–430 px e em tablet de 768–1194 px, em retrato e paisagem.
- **Sem rolagem horizontal.**
- **Alvos de toque:** ≥ 44 px no site (mínimo absoluto 24 px) e ≥ 56 px no Modo Missa. **Texto ≥ 12 px.**
- **Contraste e foco:** WCAG 2.2 AA e foco visível com anel dourado. O dourado de texto usa `gold-ink`.
- **Números de canto:** algarismos de altura cheia (lining), em destaque.
- **Largura:** conteúdo com no máximo 1440 px e margens laterais moderadas; nada encostado na borda.
- **Tudo tem link:** filtros, aba e tom ficam na URL.
- **Desfazer:** toda ação destrutiva oferece "Desfazer" ou pede confirmação.
- **Frases fixas:** a saudação do painel é "A paz, {nome}!" e o rodapé traz "Quem canta reza duas vezes." (Sto. Agostinho).
- **Datas:** "dom, 28 set" ou "domingo, 28 de setembro de 2026"; horários como "19h".

## 15. Arquitetura (regras técnicas que viram negócio)
- **Dados:** só `apps/web/src/lib/data/` lê os dados. Na Fase 2 ele passa a fazer `fetch` à API **sem mudar as telas**.
- **Estado do cliente:** o que é por usuário (sessão, missas, preferências) passa pelo `lib/store.ts`. Na Fase 3, essas funções viram chamadas à API com as mesmas assinaturas.
- **Deploy:** GitHub Pages (export estático). Por isso as rotas com ID usam `?id=`/`?token=`, e todo caminho interno fora do `next/link` usa `BASE_PATH`.
- **API:** Node + Fastify em `apps/api`. As rotas planejadas estão em `planning.md` §5.2.
- **Cifra na tela e no PDF:** as duas usam a mesma estrutura (`lib/sheet.ts`), então uma mudança na regra de quebra ou do refrão vale para as duas.
- **Bibliotecas pesadas** (jsPDF) são carregadas sob demanda.

## 16. Documentação
- Esta skill é a **fonte das regras de negócio**. `planning.md` traz o produto, o roadmap e a API (com status ✅/🟡/🔜), `ux.md` traz as telas e os componentes, e `README.md` a visão geral e as contas de demonstração.
- Ao combinar uma regra nova ou mudar uma existente, atualize esta skill e, conforme o caso, o `planning.md` (escopo, rotas, API) e o `ux.md` (telas).
