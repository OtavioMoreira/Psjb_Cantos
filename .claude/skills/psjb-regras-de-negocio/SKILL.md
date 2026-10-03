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
- **Cantos no banco (API, 03/10/2026):** tabela `songs`, importada do `data/songs.json` por `npm run db:import-songs -w api`, **mantendo os ids** (as missas guardam `songId`). O site público ainda lê o JSON; a API já é a base para o admin de cantos.
  - **Só admin** cria, edita e exclui (`/api/admin/songs`). Campos: número, título, autor, tom, letra com cifra, mídias e flags.
  - **Arquivos:** PDF da cifra, PDF da partitura e áudio (MP3, M4A ou OGG), **até 4 MB cada** (limite das Functions da Vercel). O tipo é conferido pelos bytes. Trocar o arquivo apaga o anterior. Também dá para usar links externos (Audiomack, site antigo).
  - **Slug:** gerado na criação (`NNN-titulo` ou só o título) e **não muda ao trocar o título**, para os links continuarem valendo.
  - **Canto em uso não é excluído:** se estiver em alguma missa, a API recusa (409 `SONG_IN_USE`). Para tirar do repertório, **oculte** (`active: false`): some do público, mas o admin e as missas continuam vendo.
  - **Missas** só aceitam `songId` que exista no banco (400 com `unknownSongIds`).
  - As categorias **Velas** e **Preces** não existem no site antigo. Para ilustrar, os cantos do Espírito Santo foram marcados como Velas e os de Paz como Preces. Revisar na migração real.

## 3. Categorias (taxonomia)
A categoria única do site antigo virou **4 eixos independentes**, e um canto pode ter **vários valores em cada eixo**.

**Flags (API):** cada valor de eixo é uma **flag** (tabela `flags`) de um **grupo**: `momento`, `tempo`, `ano`, `tema` ou `outro`. Um canto pode ter **várias flags, inclusive várias do mesmo grupo** (ex.: Ano A e Ano B; Advento e Natal).
- **Gestão:** só admin cria, edita ou exclui (`/api/admin/flags`), por exemplo "Ano A" no grupo `ano`. O `slug` é único dentro do grupo e a cor é opcional (#RRGGBB).
- **Excluir uma flag** tira a etiqueta dos cantos, sem apagar os cantos.
- **Origem:** a importação cria as flags a partir do `data/categories.json` (24 flags).
- **Filtro** `GET /api/songs?flags=1,2,3`: mesma regra do site, OU dentro do grupo e E entre grupos. A busca `q` ignora acento (`unaccent`) e, se for só número, procura pelo número do canto.

Os eixos:
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
  - Controle −/+ em cada canto do editor, de **−6 a +5** (passando do limite, dá a volta), com "↺ Original (tom)" quando mudou.
  - O 👁 abre a cifra **já no tom desta missa**, com o mesmo controle de tom no topo. Pelo seletor (canto ainda fora da missa), a pré-visualização mostra o tom original.
  - O nome do tom segue a preferência de sustenidos/bemóis, igual à cifra. O mesmo tom vale no Modo Missa e no PDF.
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
- **Onde fica salvo:** no front, ainda no `localStorage` do aparelho. **A API já tem as rotas** (`/api/masses`, ver `planning.md` §5.2), mas as telas ainda não usam:
  - os momentos e cantos (`slots`) são salvos **inteiros** num campo JSON, porque o editor salva tudo a cada alteração;
  - `PUT` substitui a missa inteira e `PATCH` muda só os campos enviados;
  - o tom de cada canto vai de −6 a +5, e `songId` é o id do canto em `data/songs.json` (os cantos ainda não estão no banco);
  - a listagem filtra por `when=upcoming|past|all`, com "hoje" no fuso de Brasília; missa sem data conta como próxima.
- **Compartilhar com a equipe:**
  - **Quem compartilha:** o **dono** da missa (quem a criou), **qualquer que seja o papel** (Administrador ou Músico).
  - **Como:** o botão "Compartilhar" fica no editor (na barra de baixo, só o ícone no celular) e no card de "Minhas Missas". Ele abre um modal com **seleção múltipla e busca sem acento** por nome, e-mail, movimento ou papel. As pessoas escolhidas aparecem como chips removíveis ("Com acesso (N)"), e o botão salva com "Compartilhar com N pessoas".
  - **Quem aparece na lista:** só contas **ativas**, sem o próprio dono. Pendentes e bloqueados não aparecem.
  - **O que a pessoa pode fazer:** vê a missa em "Minhas Missas", **edita os cantos**, abre no Modo Missa e baixa o PDF. **Só o dono** exclui a missa e muda o compartilhamento.
  - **Aviso na tela:** o card e o editor mostram "Compartilhada com N pessoas" (com as iniciais) para o dono e "Compartilhada por {nome}" para quem recebeu.
  - **Sair:** quem recebeu pode escolher "Sair desta missa" (no menu ⋯, com "Desfazer"). A missa continua existindo para o dono.
  - **Duplicar:** a cópia é de quem duplicou e começa **sem compartilhamento**.
  - **Link de convite** (com a API): é a opção automática, além de escolher as pessoas na lista.
    - O dono clica em **"Gerar link de convite"** no modal Compartilhar. Aparecem **Copiar link** e, no celular, **Enviar** (abre o compartilhamento do aparelho, como o WhatsApp). O link é `/convite?token=…`.
    - **Quem abre o link:** se não estiver logado, vai para o login (com o aviso "Você recebeu o convite de uma missa") e volta sozinho. **Já logado, vira convidado na hora** e cai direto no editor da missa.
    - Quem já era convidado, ou o próprio dono, só é levado à missa.
    - **O link é sempre o mesmo** até o dono clicar em **"Desativar link"**. Desativado, ele para de funcionar, mas quem já entrou continua convidado. Gerar de novo cria outro link.
    - **Só o dono** gera ou desativa o link. O token tem 192 bits e fica guardado em texto (não só o hash) para o dono poder copiar de novo; ele só dá acesso a esta missa.
    - **Conta pendente** não consegue entrar, então precisa abrir o link de novo depois que for ativada.
  - **Missas antigas sem dono** (criadas antes da regra) valem como da pessoa que está usando o aparelho.
  - **Fase 1:** a lista de pessoas fica salva na própria missa, no `localStorage` (`ownerId` e `sharedWith`), então o compartilhamento só aparece para quem entra **no mesmo aparelho**.
  - **Na API (já implementado):**
    - a permissão é conferida no servidor: 403 para quem não é dono nem convidado (**inclusive admin**, porque a missa é pessoal) e 404 se a missa não existe;
    - `PUT /api/masses/:id/shares { userIds }` substitui a lista, recusa contas não ativas (400 com `invalidUserIds`) e ignora o próprio dono;
    - quem recebeu sai com `DELETE /api/masses/:id/shares/me`; o dono recebe 403 nessa rota.
  - **(futuro)** Avisar por e-mail quem recebeu a missa.

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
- **Papéis:** só dois (o papel Coordenador foi removido em 03/10/2026). Ficam na tabela `roles` e se ligam ao usuário por `user_roles`, então uma pessoa pode ter mais de um.
  - **Administrador** (`admin`): gerencia usuários e usa tudo. Só ele acessa as seções internas de gestão de usuários.
  - **Músico** (`musico`): usa o repertório, monta e compartilha as próprias missas. É o papel padrão no cadastro.
- **Autorização no servidor:** as rotas de gestão (`/api/admin/*`) passam pelos middlewares `authenticate` + `requireRole("admin")`. Músico recebe **403**, sem login **401**. Esconder o menu no front é só conforto, não segurança.
- **Status** (na API: `pending`, `active`, `blocked`):
  - **pendente**: criou a conta e **aguarda um admin ativar** ("Aguardando ativação"). **Não consegue entrar.** No modo demonstração (sem API), pendente ainda significa "aguardando confirmar o e-mail".
  - **ativo:** consegue entrar.
  - **bloqueado:** não consegue entrar. Na tentativa de login, vê o **motivo** definido pelo admin e a orientação "Procure a coordenação da paróquia".
- **Contas de demonstração** (modo sem API): admin `admin@psjb.org.br` / `admin123` e músico `musica@psjb.org.br` / `cantos123`.
- **Conta de teste da API:** `superadmin@psjb.org.br` / `123456`, papéis admin + músico, criada pelo seed (`npm run db:seed -w api`). A senha fura a regra de 8+ caracteres de propósito; em produção o seed exige `SEED_ADMIN_PASSWORD`.
- **Dados do usuário:** nome, e-mail (é o login), senha, telefone (opcional), foto (opcional) e movimento (opcional).
- **Movimentos** (substituíram o texto livre "ministério" em 03/10/2026): ficam na tabela `movements` e cada pessoa participa de **no máximo um** (`users.movement_id`).
  - A lista é pública (`GET /api/movements`) e aparece como seletor no cadastro, no perfil e no admin.
  - Só admin cria, renomeia ou exclui (`/api/admin/movements`). Os nomes são únicos sem diferenciar maiúsculas.
  - **Excluir um movimento com pessoas é bloqueado** (409 `MOVEMENT_IN_USE`): primeiro troque o movimento delas.
  - O seed cria uma lista inicial (Ministério de Música, RCC, Pastoral da Juventude...) que a coordenação deve revisar.

## 10. Login, cadastro, confirmação e recuperação
- **`/entrar`:** abas **Entrar** e **Criar conta** (`?aba=criar`).
- **Mensagens de erro no login:**
  - Credenciais inválidas: genérica ("E-mail ou senha não conferem").
  - Conta pendente: com a API, "Sua conta ainda não foi ativada. Assim que a coordenação liberar, você consegue entrar." (403 `ACCOUNT_PENDING`). No modo demonstração, oferece "Reenviar e-mail de confirmação".
  - O status só é revelado para quem acertou a senha.
  - Conta bloqueada: mostra o motivo.
- **Cadastro:**
  - Nome (3+ caracteres), e-mail válido, telefone/WhatsApp (opcional, 8–20 dígitos e símbolos), movimento (opcional, da lista), senha e confirmação.
  - A senha precisa de **8 ou mais caracteres, com letras e números**, e há medidor de força.
  - Aceite dos termos e da privacidade (LGPD) é obrigatório.
  - **reCAPTCHA** obrigatório.
  - A conta nasce **pendente**, com papel músico, e **um admin ativa depois** (`PATCH /api/admin/users/:id/activate`). Por enquanto não há e-mail de confirmação.
  - Depois de enviar, a tela mostra "Conta criada!" explicando que a coordenação vai liberar o acesso.
  - E-mail já cadastrado: 409 "Já existe uma conta com este e-mail". **(futuro)** Com o serviço de e-mail, a resposta passa a ser sempre a mesma.
- **Confirmação de e-mail** (modo demonstração; volta com o serviço de e-mail):
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
- **(futuro) Contas do site antigo:**
  - As senhas legadas estão em MD5 sem salt e **não são reaproveitadas**. Quem vier do site antigo define uma senha nova pelo fluxo de recuperação, e os tokens legados são invalidados.
  - O login compara usuário e e-mail sem diferenciar maiúsculas e acentos, como no site antigo, e a API aplica `trim` na entrada. Os detalhes estão em `db/postgres/CONVERSAO.md`.

## 11. Perfil (`/painel/perfil`)
- **Dados editáveis:** nome, e-mail, paróquia, movimento e instrumento/voz.
- **Troca de senha:** exige a senha atual.
- **Foto:** JPG, PNG ou WebP de até 2 MB (`PUT /api/me/photo`, campo `photo`). O tipo é conferido pelos bytes do arquivo, não pelo nome. Cada troca gera uma URL nova e apaga a foto anterior. No perfil, "Enviar foto" / "Trocar foto" (só com a API); a foto aparece no avatar do cabeçalho e do painel.
- **Com a API**, nome, e-mail, movimento e senha ficam **só leitura** (com aviso) até existirem `PATCH /api/me` e `POST /api/me/password`.
- **Preferências:** tema (claro, escuro ou sistema) e sustenidos/bemóis.
- **(futuro)** Trocar o e-mail exige confirmar o novo endereço, e o antigo continua valendo até lá.

## 12. Administração (só papel admin)
- **`/painel/admin`** reúne Usuários, Cantos, Flags e Movimentos. Cantos, flags e movimentos só existem com a API; na demonstração, a tela avisa "Disponível na versão com servidor".
- **Cantos:** o editor tem número, título, autor, tom, letra e cifra (com aba "Ver" para pré-visualizar acordes e refrão), flags por grupo, PDF da cifra, PDF da partitura, áudio (até 4 MB cada), Audiomack e "Visível no repertório".
  - Os arquivos só podem ser enviados **depois de criar o canto**.
  - Excluir um canto que está em missa é recusado: a tela mostra o motivo e sugere ocultar.
- **Publicar no site:** as páginas dos cantos são **estáticas** (rápidas e disponíveis no Modo Missa com internet ruim). Mudanças em cantos e flags só aparecem no site público depois de **"Publicar no site"**, que gera o site de novo em alguns minutos. A página de um canto já mostra o nome das flags novas; filtros e etiquetas das listas atualizam no build.
- **Flags:** o identificador é gerado a partir do nome (pode ser editado); cor e ordem são opcionais.
- **Movimentos:** criar e renomear (nome único); o botão de excluir fica desabilitado quando há pessoas.

### 12.1 Admin de usuários (`/painel/admin/usuarios`)
- **Com a API:** a lista vem do servidor e "Ativar acesso" libera contas pendentes. As demais ações ficam desabilitadas até existirem no backend.
- **Acesso:** o menu "Usuários" só aparece para admins. Outros papéis veem "Acesso restrito". **(futuro)** A API também recusa com 403, porque esconder o menu não é segurança.
- **Visão geral:**
  - Resumo clicável: Total, Ativos, Aguardando e-mail e Bloqueados.
  - Busca por nome, e-mail ou movimento, e filtro por papel.
  - A lista mostra primeiro os pendentes, depois os bloqueados e por fim os ativos.
- **Ações:**
  - **Editar** nome, e-mail, movimento e papel.
  - **Bloquear** com motivo, com "Desfazer". **Liberar** volta para ativo se o e-mail já foi confirmado, senão para pendente.
  - **Ativar sem confirmação** e **reenviar confirmação**: só para pendentes.
  - **Redefinir senha:** "Enviar link por e-mail" (recomendado) ou "Gerar senha temporária", exibida **uma única vez**. **(futuro)** A senha temporária obriga a troca no próximo login.
  - **Convidar:** nome, e-mail e papel. O convidado nasce pendente e recebe um e-mail para criar a senha.
  - **Excluir:** pede confirmação, sugere bloquear como alternativa reversível e tem "Desfazer".
- **Proteções:**
  - O admin **não pode bloquear, excluir nem rebaixar a si mesmo**.
  - **(futuro)** Precisa existir sempre pelo menos 1 admin ativo.
- **(futuro)** Toda ação de admin gera um registro de auditoria (`AuditLog`), e bloquear ou redefinir senha **revoga as sessões ativas** da pessoa.

## 13. Autenticação JWT
**Já implementado** (`apps/api`, 03/10/2026):
- `POST /api/auth/login` com e-mail, senha e "manter conectado". Devolve o **access token JWT de 15 min** (HS256, com `sub` e `roles`) e grava o **refresh token** opaco em cookie `psjb_refresh` **httpOnly + SameSite=Lax** (Secure em produção), com `path=/api/auth`.
  - "Manter conectado": o cookie vale 30 dias. Sem marcar: cookie de sessão do navegador e 1 dia no servidor.
- `POST /api/auth/refresh` **rotaciona** o refresh (o antigo deixa de valer). **Reuso** de um token já trocado revoga a família inteira de sessões. A validade é absoluta: rotacionar não estende os 30 dias.
- `POST /api/auth/logout` revoga a sessão e apaga o cookie.
- `GET /api/me` devolve os dados da pessoa. Conta bloqueada ou removida depois do login recebe 401.
- O front guarda o access token **só em memória** e renova pelo cookie quando precisa. O front e a API ficam no mesmo site, porque o Next repassa `/api/*` para a API.
- Os papéis vão no JWT. Mudar o papel de alguém só passa a valer no próximo refresh (até 15 min).
- **Senhas:** argon2id. **Rate limit** por IP: login 10, cadastro 5 e refresh 60 a cada 15 min.

**(futuro, Fase 3): dois fatores por e-mail**
1. `POST /api/auth/login` com e-mail e senha. Pendente recebe 403 `EMAIL_NOT_VERIFIED`, bloqueado recebe 403 `ACCOUNT_BLOCKED` (com o motivo), e credencial errada recebe uma mensagem genérica.
2. Senha correta: a API envia um **código de 6 dígitos por e-mail** (10 min, uso único, máx. 5 tentativas) e devolve um `challengeId`.
3. O front mostra "Digite o código enviado para m***@…", com 6 campos, colar funcionando e reenvio após 60 s.
4. `POST /api/auth/login/verify` com o código correto emite:
   - **access token JWT de 15 min**, que fica **só em memória** no front e nunca em `localStorage`;
   - **refresh token** opaco em **cookie httpOnly + Secure + SameSite=Lax**, **rotacionado** a cada uso, com validade de 30 dias se "manter conectado" estiver marcado, senão 1 dia. Reuso detectado revoga todas as sessões daquele login.
5. "Confiar neste dispositivo por 30 dias" dispensa o código naquele aparelho, útil para o tablet da paróquia.
- **Rate limit** também nos reenvios e no 2FA.
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
- **API:** Node + Fastify em `apps/api`, com **arquitetura hexagonal**: `routes → controllers → actions → interfaces ← repositories/services`. As actions (casos de uso) só conhecem as interfaces, então banco, hash, JWT e storage podem ser trocados (nos testes, por versões em memória). As rotas estão em `planning.md` §5.2.
- **Hospedagem:** front e API na **Vercel** (a API vira uma Function), banco **PostgreSQL no Neon** e arquivos no **Vercel Blob**. Localmente: Postgres do `docker-compose` e fotos em `apps/api/uploads/`.
- **Modo demonstração × API:** sem `API_URL` no build do front (caso do GitHub Pages), tudo continua no `localStorage`. Com `API_URL`:
  - **login, cadastro e missas usam a API**; perfil e admin ainda leem o `store.ts`, que espelha o usuário vindo da API;
  - **as missas ficam no `localStorage` como cache:** a tela responde na hora e o Modo Missa abre mesmo com internet ruim. Cada alteração vai para a API numa fila por missa. Se falhar, o editor mostra "Salvo só neste aparelho" e tenta de novo na próxima alteração;
  - **ao abrir o painel**, as missas são trazidas do servidor e o editor reabre com os dados novos;
  - **compartilhar é uma ação separada** do salvamento dos cantos (`setMassShares`): uma cópia antiga no editor nunca desfaz o convite de alguém;
  - **excluir e "Sair desta missa"** só vão para a API depois dos 6,5 s do "Desfazer";
  - **ao sair da conta**, o cache de missas é apagado, porque o tablet da paróquia é compartilhado.
- **Cifra na tela e no PDF:** as duas usam a mesma estrutura (`lib/sheet.ts`), então uma mudança na regra de quebra ou do refrão vale para as duas.
- **Bibliotecas pesadas** (jsPDF) são carregadas sob demanda.

## 16. Documentação
- Esta skill é a **fonte das regras de negócio**. `planning.md` traz o produto, o roadmap e a API (com status ✅/🟡/🔜), `ux.md` traz as telas e os componentes, e `README.md` a visão geral e as contas de demonstração.
- Ao combinar uma regra nova ou mudar uma existente, atualize esta skill e, conforme o caso, o `planning.md` (escopo, rotas, API) e o `ux.md` (telas).
