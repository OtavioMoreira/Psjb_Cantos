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
  - A marcação veio do negrito do site antigo: 518 dos 623 cantos têm refrão marcado; os demais não tinham negrito na origem. Conta como refrão a linha de letra com **todas as letras e números** em negrito (a pontuação final às vezes ficava fora). O recuo fica antes dos `**`, para alinhar com os acordes.
  - Os marcadores `**` nunca aparecem na tela nem entram na busca.
- **Recursos ausentes:** a aba correspondente fica desabilitada ("Partitura ainda não disponível").
- **Repertório (14/10/2026):** `data/songs.json` traz **os 623 cantos do site antigo**, convertidos da tabela `audios` do banco legado por `db/postgres/importar_cantos.py`. As mídias apontam para os arquivos do site antigo (`https://cantos.psjb.org.br/uploads/...`).
  - Os 121 cantos extraídos antes (primeira página de 14 categorias) mantêm a classificação feita à mão; a letra passou a ser a do conversor, que corrige defeitos da extração antiga (cabeçalho dentro da letra, `<br>` virando linha em branco, linhas de acordes com `°` ou `7+` marcadas como refrão).
  - **Posição dos acordes (18/11/2026):** no site antigo e no Word a cifra foi digitada em **Times New Roman** (acordes em negrito), e os espaços alinhavam o acorde à sílaba *nessa* fonte; copiados como estavam para a cifra monoespaçada, os acordes "andavam". O conversor (`db/postgres/alinhar_acordes.py`) recalcula a coluna de cada acorde: **pelo PDF da cifra** quando o canto tem e a linha confere (3.247 das 3.545 linhas), senão **pela largura de cada caractere na Times** (Liberation Serif, mesmas métricas). Medido nos 13.780 acordes dos PDFs: antes, 8% na letra certa; pela fonte, 85% (93% com até 1 letra); pelo PDF, igual ao PDF. **O PDF da cifra é a referência** da posição dos acordes.
  - **Estrofes sem cifra (18/11/2026):** em 428 cantos só a 1ª estrofe tinha acordes. O conversor (`db/postgres/completar_estrofes.py`) copia a cifra da 1ª estrofe para as estrofes numeradas sem acordes, **sílaba a sílaba**: emparelha as sílabas cantadas (com sinalefa) casando tônica com tônica e fim de frase com fim de frase, e põe o acorde na vogal da sílaba. Só entra estrofe com o mesmo número de linhas da 1ª, e só se a 1ª estiver toda cifrada; a linha em branco no meio da estrofe (sobra do editor antigo) sai. **Não é perfeito**: a lista para a equipe revisar ouvindo está em `docs/REVISAO-CIFRAS.md`.
  - **Tom original:** só a tônica e o modo do primeiro acorde (`Bm7` → `Bm`, `C7` → `C`).
  - **Acordes reconhecidos** também incluem diminuto com `°`/`º` (`D#°`) e sétima maior `7+` (`G7+`), na tela, na transposição e no conversor.
- **Cantos no banco (API, 03/10/2026):** tabela `songs`, importada do `data/songs.json` por `npm run db:import-songs -w api`, **mantendo os ids** (as missas guardam `songId`). Com `API_URL`, o repertório público lê os cantos do banco (via API); sem ela (GitHub Pages), lê o JSON.
  - **Só admin** cria, edita e exclui (`/api/admin/songs`). Campos: número, título, autor, tom, letra com cifra, mídias e flags.
  - **Arquivos:** PDF da cifra, PDF da partitura e áudio (MP3, M4A ou OGG), **até 4 MB cada** (limite das Functions da Vercel). O tipo é conferido pelos bytes. Trocar o arquivo apaga o anterior. Também dá para usar links externos (Audiomack, site antigo).
  - **Arquivos do site antigo (14/10/2026):** a HostGator vai ser desligada, então os PDFs e MP3 de `cantos.psjb.org.br/uploads/...` são copiados para o storage da API por `npm run db:migrate-files -w api`, que troca os links em `songs`.
    - **Plano grátis da Vercel:** o Blob tem 1 GB de espaço e 10 GB de download por mês e trava por 30 dias se estourar. Por isso os **MP3 vão a 64 kbps mono** (17 h de áudio; os originais têm até 256 kbps): os 1.211 arquivos caem de 1,2 GB para **518 MB**. Se o MP3 convertido não ficar menor, fica o original.
    - **Erros de cadastro do site antigo** são corrigidos pelo tipo real do arquivo (bytes): WMA vira MP3; cifra em Word e partitura em imagem viram PDF; PDF no campo de áudio vai para a cifra (ou a partitura) ou é descartado se for cópia da cifra; MP3 no campo de cifra vai para o áudio.
    - **Nome no storage:** `songs/<id>/<tipo>-legado.<ext>`, fixo, para rodar de novo sobrescrevendo. Só os links que ainda apontam para o site antigo são processados.
    - **Backup:** os originais ficam em `db/arquivos-legado/originais/` (fora do git). Com `--origem <pasta>`, lê de um backup do cPanel em vez de baixar.
    - **Reimportar o `songs.json` não desfaz a migração:** se o banco já aponta para um arquivo nosso (`/songs/`), o link fica.
  - **Slug:** gerado na criação (`NNN-titulo` ou só o título) e **não muda ao trocar o título**, para os links continuarem valendo.
  - **Canto em uso não é excluído:** se estiver em alguma missa, a API recusa (409 `SONG_IN_USE`). Para tirar do repertório, **oculte** (`active: false`): some do público, mas o admin e as missas continuam vendo.
  - **Missas** só aceitam `songId` que exista no banco (400 com `unknownSongIds`).
  - As categorias **Velas** e **Preces** não existem no site antigo. Nos 121 cantos revisados à mão, alguns do Espírito Santo foram marcados como Velas e alguns de Paz como Preces (e alguns Marianos/Vocacionais como Saída). Nos 502 convertidos, só entra o que a categoria antiga diz. **A equipe de liturgia precisa revisar** esses momentos.

- **Salmos da Diocese de Montenegro (importação automática, 18/11/2026):** os salmos e aclamações da semana são lidos da página https://www.diocesemontenegro.org.br/salmos-e-aclamacoes (título, data, MP3 e PDF da partitura) pelo **Cron da Vercel, de segunda a quinta às 3h** (`0 6 * * 1-4` UTC; rota `GET /api/cron/import-psalms`, protegida pelo `CRON_SECRET`), ou pelo botão **"Buscar agora"** em Admin › Salmos da diocese. Cada execução pega os itens de hoje até 10 dias adiante.
  - **Sem duplicados, em 4 camadas:** (1) o item da fonte (código do arquivo + data) só é processado uma vez (o que falhou é tentado de novo); (2) um canto do repertório com a **mesma celebração, o mesmo tipo e o mesmo ano** é reconhecido ("4º Domingo do Advento, Ano B | Salmo 88" = "Advento 4º Dom - Salmo 088"), e os cantos genéricos (sem celebração no título) ficam de fora da comparação; (3) o **mesmo PDF** (SHA-256) para outro domingo vira o **mesmo canto criado pela rotina** (a diocese sobe a mesma aclamação do Advento com 4 códigos diferentes), que ganha o tempo e o ano que faltavam. A ordem importa: a aclamação do Natal serve do Natal ao Batismo, mas cada festa já tem a sua no repertório, então o "mesmo PDF" nunca liga a um canto do site antigo de outra celebração; (4) **na dúvida** (outro número de salmo, mais de um parecido, celebração desconhecida) o item vai para a **revisão**, onde o admin escolhe "É este", "É um canto novo" ou "Ignorar".
  - **Canto novo entra oculto** (aguardando aprovação), com o crédito "Fonte: Diocese de Montenegro" na página, o PDF como partitura e o MP3 como áudio (copiados para o Blob), tempo e ano pelo título (ou pela data) e o tom pelo 1º acorde. A **letra é reconstruída do PDF** (é uma partitura): sílabas juntadas ("I - lu-mi-nai" → "Iluminai", mantendo "convertei-nos"), refrão em negrito e as partes da melodia **intercaladas** (o PDF mostra a 1ª parte de todas as estrofes antes da 2ª). Na aclamação, o versículo de cada domingo ("1º Dom.: …"). Sem cifra sobre a letra: os acordes ficam na partitura. **Parte dos PDFs é escaneada** (imagem, sem texto; ex.: Cristo Rei): o canto entra sem letra e o item avisa "PDF escaneado: digite a letra no editor antes de aprovar".
  - O `robots.txt` do site bloqueia robôs de IA e libera os demais; a rotina se identifica como "CantosPSJB" e lê só uma página por execução.

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
- **Tema:** Espírito Santo, Marianos, Paz, Vocacionais e Missão, Crianças, Família, Meditação e Louvor, Movimentos, Palavra, Perdão, Santos, Exéquias, Semana Santa, **Creio** e **Sequências**.
  - Creio e Sequências seriam momentos, mas a lista de momentos é fechada no editor de missa e no Modo Missa; por isso ficaram como tema. Promover a momento é uma decisão para a equipe de liturgia.
- **Da categoria antiga para as flags** (conversor): "Abertura - Advento" → Entrada + Advento; "Apresentação das oferendas" → Ofertório; "Comunhão - X" → Comunhão + tempo; "Salmos/Aclamações - ANO B" → Salmo/Aclamação + Ano B, com o **tempo tirado do título** ("Quaresma 2º Dom. - Salmo 115" → Quaresma; Sagrada Família, Mãe de Deus, Epifania e Batismo → Natal; Ascensão e Pentecostes → Páscoa; Santíssima Trindade → Tempo Comum); "Cantos diversos - X" → tema X ("Cantos diversos - Natal" → tempo Natal); "Semana Santa" e "Tríduo Pascal" → Quaresma + tema Semana Santa.
- **Classificação revisada (18/11/2026):** +217 marcações em 154 cantos, só acrescentando (lista e critérios em `docs/REVISAO-CLASSIFICACAO.md`). Regras: **tempo só quando o canto é próprio do tempo** (canto sem tempo serve para todos; marcar Tempo Comum num canto do ano todo o tira das missas de Advento e Quaresma); **anos A, B e C** nos salmos e aclamações que o Lecionário repete nos três anos; marianos sem momento → Saída; Ramos → Entrada; invocações ao Espírito Santo → Velas. Faltam os **salmos do Ano A e do C** (o site antigo só tinha os do B e alguns do C): precisam ser cadastrados.
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
- **Ouvir e ver a cifra juntos (18/11/2026):** quando o canto tem MP3, a aba Letra e Cifra mostra um player compacto (com velocidade) **logo acima da barra de Tom**. A aba Áudio continua, com o player completo e o download.

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
- **Onde fica salvo:** com a API, no banco (`/api/masses`, ver `planning.md` §5.2), com cópia no `localStorage` (ver §15); na demonstração, só no `localStorage` do aparelho. Regras da API:
  - os momentos e cantos (`slots`) são salvos **inteiros** num campo JSON, porque o editor salva tudo a cada alteração;
  - `PUT` substitui a missa inteira e `PATCH` muda só os campos enviados;
  - o tom de cada canto vai de −6 a +5, e `songId` é o id do canto na tabela `songs` (os mesmos ids do `data/songs.json`);
  - a listagem filtra por `when=upcoming|past|all`, com "hoje" no fuso de Brasília; missa sem data conta como próxima;
  - **edição ao mesmo tempo (24/11/2026):** cada missa tem uma `version` que sobe a cada gravação (compartilhar não conta). O editor manda a versão que conhece (`If-Match`); se outra pessoa salvou antes, a API responde 409 `MASS_CONFLICT` com a missa atual e o front **junta as alterações** (`lib/massMerge.ts`): o que só um lado mudou (campo do cabeçalho, momento, tom) vale; se os dois mexeram no mesmo momento, fica a lista daqui mais os cantos que a outra pessoa acrescentou; momento novo de qualquer lado entra; momento removido só some se o outro lado não mexeu nele; a ordem é a de quem reordenou. Grava o resultado, o editor reabre com ele e avisa "{nome} alterou esta missa enquanto você editava. Juntamos as alterações de vocês." Sem `If-Match` (Postman, scripts), vale o último.
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
  - **Aviso por e-mail (24/11/2026):** quem **entra** na lista recebe "{dono} compartilhou uma missa com você", com nome, data por extenso e o link do editor. Quem já estava não recebe de novo; quem entra pelo link de convite não recebe (entrou sozinho). Falha no envio não desfaz o compartilhamento.

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
  - **Com a API (15/10/2026):** `POST /api/auth/forgot` responde sempre 202. **Só conta ativa** recebe o link (pendente e bloqueado não entrariam mesmo). Pedir de novo antes de **60 s** não manda outro e-mail (protege a cota do Resend), e falha no envio também não aparece na resposta.
  - `POST /api/auth/reset` troca a senha, **derruba todas as sessões** e tira a confiança dos aparelhos do 2FA. Depois, a tela de login já vem com o e-mail preenchido (`/entrar?email=`).
  - Pedir um link novo invalida o anterior: **só o último link vale**.
- **Validade dos tokens:**

  | Token | Validade |
  |---|---|
  | Confirmação de e-mail (troca de endereço) | 24 h |
  | Redefinição de senha | 1 h |
  | Convite | 7 dias |
  | Código 2FA | 10 min, máx. 5 tentativas |

  Todos são de **uso único** e ficam guardados **só como hash** (tabela `auth_tokens`; o código do 2FA com sal).
- **(futuro)** O cadastro também não revela se o e-mail já existe: a resposta é sempre "enviamos um link", e o e-mail enviado avisa "você já tem conta".
- **Demonstração (sem API):** sem serviço de e-mail, a tela mostra uma caixa "Demonstração" com o link que chegaria por e-mail. Com a API e sem `RESEND_API_KEY` (desenvolvimento), o e-mail aparece no terminal da API, com o link ou o código.
- **(futuro) Contas do site antigo:**
  - As senhas legadas estão em MD5 sem salt e **não são reaproveitadas**. Quem vier do site antigo define uma senha nova pelo fluxo de recuperação, e os tokens legados são invalidados.
  - O login compara usuário e e-mail sem diferenciar maiúsculas e acentos, como no site antigo, e a API aplica `trim` na entrada. Os detalhes estão em `db/postgres/CONVERSAO.md`.

## 11. Perfil (`/painel/perfil`)
- **Dados editáveis:** nome, e-mail, paróquia, movimento e instrumento/voz.
- **Trocar o e-mail (com a API, 15/10/2026):** botão "Trocar e-mail" abre um modal com o novo e-mail e a **senha atual** (`POST /api/me/email`). O link (24 h) vai para o **endereço novo**, e o e-mail só muda quando a pessoa confirma em `/confirmar-email?token=` (`POST /api/auth/confirm-email`, pública: pode abrir em outro aparelho). Até lá, **o antigo continua valendo**. Depois da troca, o endereço antigo recebe o aviso "Seu e-mail foi alterado".
  - Recusa o mesmo e-mail e um que já é de outra conta (inclusive se alguém pegar o endereço entre o pedido e a confirmação: 409). Um pedido por minuto (429 `TOO_SOON`); só o último link vale.
- **Troca de senha:** exige a senha atual, e a nova precisa ser diferente. Com a API (`POST /api/auth/password`, em `/auth` para receber o cookie), a sessão deste aparelho continua e **as dos outros aparelhos caem**.
- **Foto:** JPG, PNG ou WebP de até 2 MB (`PUT /api/me/photo`, campo `photo`). O tipo é conferido pelos bytes do arquivo, não pelo nome. Cada troca gera uma URL nova e apaga a foto anterior. No perfil, "Enviar foto" / "Trocar foto" (só com a API); a foto aparece no avatar do cabeçalho e do painel.
- **Com a API** (14/10/2026): nome, telefone, movimento, paróquia e instrumento salvam por `PATCH /api/me` (só os campos enviados; vazio limpa). O campo de e-mail fica só leitura; a troca é pelo botão "Trocar e-mail" (acima). O admin também pode trocar pelo admin de usuários, sem confirmação.
- **Senha temporária:** quem entra com a senha gerada pelo admin (`mustChangePassword`) é levado a Perfil › Segurança e não usa o resto do painel até criar a própria senha. A obrigação é conferida no front; a API zera a marca na troca.
- **Preferências:** tema (claro, escuro ou sistema) e sustenidos/bemóis.

## 12. Administração (só papel admin)
- **`/painel/admin`** reúne Usuários, Cantos, Flags e Movimentos. Cantos, flags e movimentos só existem com a API; na demonstração, a tela avisa "Disponível na versão com servidor".
- **Cantos:** o editor tem número, título, autor, tom, letra e cifra (com aba "Ver" para pré-visualizar acordes e refrão), flags por grupo, PDF da cifra, PDF da partitura, áudio (até 4 MB cada), Audiomack e "Visível no repertório".
  - Os arquivos só podem ser enviados **depois de criar o canto**.
  - Excluir um canto que está em missa é recusado: a tela mostra o motivo e sugere ocultar.
- **Publicar no site:** as páginas dos cantos são **estáticas** (rápidas e disponíveis no Modo Missa com internet ruim). Mudanças em cantos e flags só aparecem no site público depois de **"Publicar no site"**, que gera o site de novo em alguns minutos. A página de um canto já mostra o nome das flags novas; filtros e etiquetas das listas atualizam no build.
- **Flags:** o identificador é gerado a partir do nome (pode ser editado); cor e ordem são opcionais.
- **Movimentos:** criar e renomear (nome único); o botão de excluir fica desabilitado quando há pessoas.

### 12.1 Admin de usuários (`/painel/admin/usuarios`)
- **Com a API** (14/10/2026): listar, ativar, editar (nome, e-mail, movimento, papel), bloquear/liberar, senha temporária e excluir usam o servidor. **Convidar**, **enviar convite de novo** e **enviar link de redefinição** mandam e-mail de verdade (15/10/2026). "Reenviar confirmação" não aparece (a conta pendente espera um admin, não o e-mail).
  - **Ativar** uma conta pendente manda o aviso "Sua conta foi liberada" com o link para entrar. Falha no aviso não desfaz a ativação.
  - Nas ações do admin, se o e-mail não sair a tela avisa (502 `EMAIL_FAILED`), para tentar de novo ou usar a senha temporária.
  - Papel no front é um só: Administrador vira `roles: ["admin", "musico"]` e Músico, `["musico"]`. O papel só vai para a API quando muda.
- **Acesso:** o menu "Usuários" só aparece para admins. Outros papéis veem "Acesso restrito". A API também recusa com 403, porque esconder o menu não é segurança.
- **Visão geral:**
  - Resumo clicável: Total, Ativos, Aguardando e-mail e Bloqueados.
  - Busca por nome, e-mail ou movimento (sem acento), e filtro por papel.
  - **Com a API (24/11/2026):** busca, filtros e paginação são feitos no servidor, 50 por vez com "Mostrar mais"; o resumo conta todas as contas.
  - A lista mostra primeiro os pendentes, depois os bloqueados e por fim os ativos.
- **Ações:**
  - **Editar** nome, e-mail, movimento e papel.
  - **Bloquear** com motivo (opcional), com "Desfazer". Com a API, bloquear **derruba as sessões** da pessoa na hora e manda o e-mail "Seu acesso foi bloqueado" (com o motivo) para quem estava **ativo** (pendente nunca entrou, então não recebe). Falha no aviso não desfaz o bloqueio. **Liberar** volta para ativo (na demonstração: ativo se o e-mail já foi confirmado, senão pendente).
  - **Ativar sem confirmação** e **reenviar confirmação**: só para pendentes.
  - **Redefinir senha:** "Enviar link por e-mail" (recomendado; com a API, só para conta ativa: `POST /api/admin/users/:id/reset-link`) ou "Gerar senha temporária", exibida **uma única vez** (formato `abcd-23x4`, sem caracteres ambíguos). A senha temporária **derruba as sessões**, tira a confiança dos aparelhos do 2FA e **obriga a troca** no próximo acesso.
  - **Convidar:** nome, e-mail e papel (`POST /api/admin/users/invite`). O convidado nasce **pendente, sem senha utilizável**, e recebe um e-mail ("{admin} convidou você") com o link de 7 dias para **criar a senha** (`/redefinir-senha?token=…&convite=1`, com textos de boas-vindas). Ao criar a senha, a conta fica **ativa**, sem precisar de outra liberação.
  - **Enviar convite por e-mail** (menu de quem está pendente; `POST /api/admin/users/:id/invite`): manda um convite novo e o anterior deixa de valer. Também serve para a conta pendente que veio do cadastro: criar a senha pelo link equivale a liberar o acesso.
  - **Excluir:** pede confirmação, sugere bloquear como alternativa reversível e tem "Desfazer" (com a API, a exclusão só vai ao servidor depois dos 6,5 s). **As missas criadas pela pessoa são apagadas junto**; quem as recebeu perde o acesso. Missas de outras pessoas só perdem esse convidado. A foto sai do storage.
- **Proteções:**
  - O admin **não pode bloquear, excluir nem rebaixar a si mesmo** (403). Editar os próprios dados pode.
  - Precisa existir sempre **pelo menos 1 admin ativo** (409 `LAST_ADMIN`). Admin pendente ou bloqueado não conta.
- **(futuro)** Toda ação de admin gera um registro de auditoria (`AuditLog`).
- Mudar o papel de alguém só pesa no próximo refresh do token (até 15 min), porque os papéis vão no JWT.

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

**Dois fatores por e-mail (implementado em 15/10/2026)**
- **Quando vale:** ligado por padrão **só em produção** (`LOGIN_2FA`; `false` desliga, `true` liga fora de produção). Vale para todos os papéis.
1. `POST /api/auth/login` com e-mail e senha. Pendente recebe 403 `ACCOUNT_PENDING`, bloqueado recebe 403 `ACCOUNT_BLOCKED` (com o motivo), e credencial errada recebe uma mensagem genérica. **Nenhum código sai antes de a senha conferir e a conta estar ativa.**
2. Senha correta, aparelho não confiável: a API envia um **código de 6 dígitos por e-mail** (10 min, uso único, máx. 5 tentativas) e responde `{ twoFactor: true, challengeId, emailHint: "m***@gmail.com", expiresIn }`, sem sessão nem cookie.
3. O front mostra "Confirme que é você", com 6 campos (colar o código ou a sugestão do teclado do celular preenche todos), **envio automático ao completar**, "Reenviar código em N s" (60 s; o código novo substitui o anterior) e "← Voltar".
4. `POST /api/auth/login/verify` com o código correto emite a sessão igual ao login comum (access token em memória, refresh em cookie, "manter conectado" escolhido na primeira etapa). Código errado: 400 `INVALID_CODE` com as tentativas restantes; na 5ª, o desafio morre (`INVALID_TOKEN`) e é preciso entrar de novo com a senha. A conta é conferida de novo nessa etapa (bloqueada no meio do caminho não entra).
5. **"Confiar neste aparelho por 30 dias"** vem **marcado** (o tablet da paróquia e o celular de cada um só pedem o código no primeiro acesso, o que também poupa a cota de e-mails). Grava o cookie `psjb_device` (httpOnly, `path=/api/auth`, 30 dias; só o hash fica na tabela `trusted_devices`). O cookie só vale para a pessoa que o criou.
   - **Trocar a senha**, redefinir pelo link ou receber senha temporária do admin **tira a confiança de todos os aparelhos**.
- **Rate limit** por IP: verify 20 e resend 10 a cada 15 min, além das 5 tentativas por código.
- **Faxina diária (24/11/2026):** o Cron da Vercel chama `GET /api/cron/cleanup` todo dia às 4h (`0 7 * * *` UTC, mesmo `CRON_SECRET`) e apaga sessões, tokens de e-mail e aparelhos confiáveis **vencidos ou usados há mais de 7 dias**. Sessão revogada ainda no prazo fica, porque é ela que detecta o reuso de um refresh token.
- **reCAPTCHA:** v3 invisível ou v2 checkbox (Google) ou Cloudflare Turnstile. O token é **validado no servidor** com a chave secreta. Vale para cadastro, recuperação de senha e login depois de 3 falhas.
- **E-mail transacional (15/10/2026): Resend**, escolhido pelo plano grátis (3.000/mês, **100/dia**), pela integração com a Vercel (Marketplace, região `sa-east-1`) e pela API simples. Precisa de SPF/DKIM/DMARC em `psjb.org.br`.
  - Porta `EmailSender` na API: `ResendEmailSender` (com `RESEND_API_KEY`) ou `ConsoleEmailSender` (sem a chave: imprime no terminal). **Em produção a chave é obrigatória** (a API não sobe sem ela), a não ser com a trava ligada. Remetente em `EMAIL_FROM`; links montados com `APP_URL`.
  - **Trava do envio:** `EMAIL_ENABLED=false` não manda e-mail nenhum, nem com a chave (a API sobe sem `RESEND_API_KEY`), e o 2FA passa a vir desligado; em produção, `LOGIN_2FA=true` com o e-mail travado é recusado, e o log registra só destinatário e assunto (nunca link ou código). Usada nos testes de aprovação, antes de o domínio ser verificado: o login é só com senha, e para quem esqueceu vale a senha temporária do admin. (18/11/2026)
  - Modelos (`apps/api/src/emails/templates.ts`, HTML com estilos inline + texto puro, nome escapado): Redefinir senha · Você foi convidado · Confirme seu novo e-mail · Seu e-mail foi alterado · Seu código de acesso · Sua conta foi liberada · Seu acesso foi bloqueado · Compartilhou uma missa com você (24/11/2026).
  - Rotas que não podem revelar se a conta existe (`forgot`) engolem a falha de envio; nas outras, a falha vira 502 `EMAIL_FAILED`.
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
