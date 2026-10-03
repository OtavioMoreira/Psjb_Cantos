# Conversão do banco legado: MySQL 5.7 → PostgreSQL 18

Origem: dump de produção (`db/psjb_cantos_producao.sql`, MySQL 5.7.44-48 Percona) carregado no container `psjb-mysql`.
Destino: container `psjb-postgres` (PostgreSQL 18.6, UTF8, ICU pt-BR).

É uma conversão **fiel**: as mesmas 10 tabelas, colunas e linhas. O redesenho do modelo fica para a Fase 2 (`planning.md`).

## Como reexecutar

```bash
docker compose up -d              # os dois containers saudáveis
python3 db/postgres/migrar.py     # gera 02-dados.sql, recria tudo no Postgres e confere
```

- `--so-gerar`: só regenera `02-dados.sql` a partir do MySQL, sem tocar no Postgres.
- `--so-conferir`: só roda a conferência origem × destino.
- Para carregar sem o script (com o `02-dados.sql` já gerado):
  ```bash
  docker exec -i psjb-postgres psql -U psjb -d psjb_cantos < db/postgres/01-schema.sql
  docker exec -i psjb-postgres psql -U psjb -d psjb_cantos < db/postgres/02-dados.sql
  ```

O script é idempotente: o `01-schema.sql` faz `DROP TABLE IF EXISTS ... CASCADE` e recria tudo. Ele só usa a biblioteca padrão do Python 3 e `docker exec`, e o MySQL é acessado **apenas para leitura**.

| Arquivo | Conteúdo | Versionado? |
|---|---|---|
| `01-schema.sql` | DDL escrita à mão: tabelas, identities, PK, FK, índice, colação, COMMENTs | Sim. Não tem dados; o `.gitignore` libera só ele com `!db/postgres/01-schema.sql`. |
| `02-dados.sql` | `COPY` de todas as tabelas + ajuste das sequences. **Gerado** pelo script. | **Não**, porque contém dados pessoais e hashes de senha. |
| `migrar.py` | Extração, conversão, carga e conferência | Sim |
| `VERIFICACAO.md` | Auditoria independente da conversão (veredito: aprovado com ressalvas, já tratadas aqui) | Sim |

## Método e por que foi escolhido

O schema foi **escrito à mão** e os dados são migrados por um **script Python próprio**. O pgloader foi descartado por estes motivos:

1. **Controle total do encoding.** O script lê toda coluna de texto como `HEX(col)` com `--default-character-set=binary`, ou seja, recebe os bytes crus gravados no MySQL, sem nenhuma conversão implícita do cliente. Depois decodifica cada coluna conforme o seu charset declarado: `utf8` é decodificado como UTF-8 estrito e `latin1` com a tabela do MySQL. Se aparecer um byte inválido, a carga falha em vez de gravar lixo.
2. **Tipos e nomes escolhidos com cuidado**, além de COMMENTs. O DDL do pgloader seria genérico (`bigint`, `timestamptz` em tudo, sem comentários).
3. **Sem dependência extra.** Não é preciso imagem do pgloader, driver MySQL nem psycopg.
4. **Conferência embutida, independente da conversão.** Para os textos, a conferência compara o resultado do próprio MySQL (`HEX(CONVERT(col USING utf8mb4))`) com o Postgres (`encode(convert_to(col,'UTF8'),'hex')`), linha a linha e coluna a coluna. Também confere números, booleanos, datas e o próximo id de cada sequence.

Os dados entram via `COPY ... FROM stdin` (formato texto, com `\t`, `\n`, `\r` e `\\` escapados), em uma única transação. As tabelas são carregadas na ordem da FK (`categorias` antes de `audios`), e no fim o script roda `ANALYZE`.

## Resultado da conferência

| Tabela | Motor/charset legado | Linhas MySQL | Linhas Postgres | Conteúdo | Próximo id (MySQL = PG) |
|---|---|---:|---:|---|---:|
| categorias | InnoDB / utf8 | 45 | 45 | idêntico | 48 |
| audios | InnoDB / utf8 | 623 | 623 | idêntico | 641 |
| usuarios | MyISAM / latin1 | 2 | 2 | idêntico | 10 |
| modulos | InnoDB / latin1 | 6 | 6 | idêntico | 56 |
| configuracoes | MyISAM / latin1 | 1 | 1 | idêntico | 2 |
| contato | InnoDB / latin1 | 1 | 1 | idêntico | 2 |
| mensagens_site | InnoDB / utf8 | 10 | 10 | idêntico | 89 |
| painel_administrativo | InnoDB / latin1 | 1 | 1 | idêntico | 2 |
| acessos | MyISAM / latin1 | 21 | 21 | idêntico | 38 |
| acessos_online | MyISAM / latin1 | 1 | 1 | idêntico | (sem chave) |

Verificações manuais também feitas:

- **Acentos:** saem corretos em `categorias.nome` ("Páscoa", "Apresentação"), `configuracoes.titulo` ("Paróquia Catedral São João Batista") e `modulos.nome` ("Configurações", "Usuários").
- **HTML de `audios.descricao`:** o maior registro tem 6.800 caracteres e 8.092 bytes. O HTML (`<p>`, `<strong>`, `<br />`) e as quebras CRLF ficaram íntegros.
- **Identity:** um `INSERT` sem id gera o próximo valor certo (testado em transação com rollback e depois recriado).

## Encoding: o que foi encontrado

Foi feita uma análise byte a byte de todas as colunas de texto (`HEX`), classificando cada valor em quatro grupos: ASCII puro, UTF-8 válido, UTF-8 duplamente codificado ou latin1 que não é UTF-8.

| Situação | Colunas | Tratamento |
|---|---|---|
| UTF-8 legítimo em colunas `utf8` | `audios.nome` (329 linhas com acento), `audios.descricao` (623), `categorias.nome` (27) | Decodificado como UTF-8 |
| **latin1 legítimo** (1 byte por acento, ex. `0xF3` = ó, `0xE7 0xF5` = çõ) | `configuracoes.titulo/descricao/palavras`, `modulos.nome` | Decodificado como latin1 do MySQL (cp1252) → UTF-8 |
| ASCII puro | todas as outras colunas latin1 (`usuarios`, `contato`, `painel_administrativo`, `acessos*`, demais de `modulos`) | Sem conversão |
| **Mojibake / dupla codificação** (`Ã§`, `Ã©`, `Â`, `â€œ`, `U+FFFD`) | **nenhuma** | Não foi preciso corrigir nada |

Conclusões:

- **Não há UTF-8 duplamente codificado.** Isso foi testado de duas formas: re-encodando cada texto UTF-8 em cp1252/latin1 e tentando decodificar de novo, e buscando os padrões `Ã[\x80-\xBF]`, `â€`, `ï¿½` e `U+FFFD`. As ocorrências de "Ã" e "Â" que existem são letras maiúsculas legítimas em títulos, como "LÂMPADA", "CÂNTICO", "INFÂNCIA" e "MÃE".
- O "latin1" do MySQL é na verdade **cp1252**. O script trata isso, inclusive os 5 bytes indefinidos (0x81, 0x8D, 0x8F, 0x90, 0x9D), embora nenhum byte 0x80–0x9F apareça nas colunas latin1 atuais.
- O dump foi gerado com `SET NAMES utf8mb4`. Nesse caminho o MySQL converte latin1 → utf8mb4 na saída e faz o inverso ao importar, o que é sem perda para latin1. Por isso os bytes do container local equivalem aos da produção.
- **`audios.descricao` usa caracteres fora do latin1**, como aspas tipográficas “ ” ‘ ’, reticências …, travessão – e U+2003. São válidos e foram preservados. Também tem **U+00A0 (NBSP) em todas as 623 linhas**, vindo de `<p>&nbsp;</p>` do editor (o HTML guarda o caractere, não a entidade), além de quebras **CRLF** (cerca de 30 mil `\r`). Tudo foi mantido byte a byte. Na Fase 2, a busca ou extração da letra precisa normalizar NBSP e `\r`.
- No MySQL `utf8` (3 bytes) não é possível ter emoji nem caracteres de 4 bytes, então não há nada a converter nesse ponto.

## Mapeamento de tipos (MySQL → PostgreSQL)

Regras gerais:

| MySQL | PostgreSQL | Observação |
|---|---|---|
| `int(1)`, `int(11)` + `AUTO_INCREMENT` (PK) | `integer GENERATED BY DEFAULT AS IDENTITY` | O número entre parênteses é só largura de exibição. Foi usado `BY DEFAULT` para permitir carregar os ids originais. O próximo valor é o `AUTO_INCREMENT` do MySQL, então ids apagados no legado não são reaproveitados. |
| `int(n)` comum | `integer` | Não há `unsigned` no schema. |
| `int` com 0/1 (`ativo`) | `boolean` | Melhoria segura: o script **aborta** se encontrar valor diferente de 0/1. |
| `varchar(n)` | `varchar(n)` | Nos dois bancos `n` conta caracteres. |
| `text`, `longtext` | `text` | |
| `datetime` | `timestamp(0) without time zone` | Hora local "de parede", sem fuso, igual ao legado. |
| `timestamp` | `timestamp(0) with time zone` | O MySQL grava TIMESTAMP em UTC. Os valores foram lidos com `time_zone='+00:00'`, então o instante exato é preservado. |
| `latin1_swedish_ci` / `utf8_general_ci` | colação padrão do banco (ICU pt-BR) | Exceto `usuarios.usuario` e `usuarios.email`: ver Decisões. |

Por coluna:

| Tabela.coluna | MySQL | PostgreSQL |
|---|---|---|
| **acessos**.id | int(1) NOT NULL AUTO_INCREMENT, PK | integer identity, PK |
| acessos.data | datetime NULL | timestamp(0) |
| acessos.ip | varchar(15) NOT NULL latin1 | varchar(15) NOT NULL |
| **acessos_online**.ip | varchar(20) NOT NULL latin1 | varchar(20) NOT NULL |
| acessos_online.time | int(20) NOT NULL (epoch) | **bigint** NOT NULL |
| **audios**.audios_id | int(11) AUTO_INCREMENT, PK | integer identity, PK |
| audios.nome | varchar(255) utf8 | varchar(255) |
| audios.usuario | varchar(255) utf8 | varchar(255) |
| audios.link | text utf8 | text |
| audios.descricao | text utf8 (HTML) | text |
| audios.audio_mp3 / cifra / partitura | varchar(255) utf8 | varchar(255) |
| audios.id_categoria | int(11) NULL, KEY + FK `categoria_aurio` | integer NULL, índice + FK `categoria_aurio` |
| audios.ativo | int(11) DEFAULT '1' NULL | **boolean** DEFAULT true NULL |
| **categorias**.categorias_id | int(11) AUTO_INCREMENT, PK | integer identity, PK |
| categorias.nome | varchar(255) utf8 | varchar(255) |
| categorias.ordem | int(11) | integer |
| **configuracoes**.id | int(1) AUTO_INCREMENT, PK | integer identity, PK |
| configuracoes.titulo / descricao / palavras | varchar(70/155/175) latin1 | varchar(70/155/175) |
| configuracoes.adwords / contato_cc | text latin1 | text |
| configuracoes.contato | varchar(255) latin1 | varchar(255) |
| **contato**.id | int(11) AUTO_INCREMENT, PK | integer identity, PK |
| contato.(titulo … longitude) | varchar(255) / text latin1 | varchar(255) / text (mesmos tipos) |
| **mensagens_site**.id | int(11) AUTO_INCREMENT, PK | integer identity, PK |
| mensagens_site.nome | varchar(255) NOT NULL utf8 | varchar(255) NOT NULL |
| mensagens_site.email / cidade | varchar(255) utf8 | varchar(255) |
| mensagens_site.telefone | varchar(100) DEFAULT 'Não informado' | varchar(100) DEFAULT 'Não informado' |
| mensagens_site.mensagem | text utf8 | text |
| mensagens_site.enviado_em | timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP | **timestamptz(0)** NOT NULL DEFAULT CURRENT_TIMESTAMP |
| **modulos**.id | int(11) AUTO_INCREMENT, PK | integer identity, PK |
| modulos.nome / _table | varchar(255) NOT NULL latin1 | varchar(255) NOT NULL |
| modulos.codigo | longtext NOT NULL latin1 (JSON) | text NOT NULL |
| modulos.icone | varchar(50) NOT NULL | varchar(50) NOT NULL |
| **painel_administrativo**.id | int(11) AUTO_INCREMENT, PK | integer identity, PK |
| painel_administrativo.(titulo … cor_secundaria) | varchar(255) latin1 | varchar(255) |
| **usuarios**.id | int(1) AUTO_INCREMENT, PK | integer identity, PK |
| usuarios.nome | varchar(255) latin1 | varchar(255) |
| usuarios.usuario | varchar(255) NOT NULL latin1_swedish_ci | varchar(255) NOT NULL **COLLATE pt_br_ci_ai** |
| usuarios.senha | varchar(255) NOT NULL DEFAULT '' | varchar(255) NOT NULL DEFAULT '' |
| usuarios.email | varchar(255) latin1_swedish_ci | varchar(255) **COLLATE pt_br_ci_ai** |
| usuarios.permissoes | varchar(255) NOT NULL | varchar(255) NOT NULL |
| usuarios.ultimo_acesso | datetime NULL | timestamp(0) |
| usuarios.ativo | int(1) NOT NULL | **boolean** NOT NULL |
| usuarios.tipo | int(11) NOT NULL DEFAULT '2' | integer NOT NULL DEFAULT 2 |
| usuarios.token | varchar(255) | varchar(255) |

## Decisões tomadas

1. **Mesmos nomes de tabelas, colunas e constraints**, inclusive `audios`, `_table`, `time` e `categoria_aurio` (sic). Todos são identificadores válidos em minúsculas e sem aspas no Postgres.
2. **`ativo` → `boolean`.** Só existem os valores 0/1 (hoje todos são 1), e o script garante essa condição.
3. **`acessos_online.time` → `bigint`.** É um epoch Unix em segundos, e `int` de 32 bits estoura em 2038. Foi mantido como número, sem converter para `timestamptz`, para não mudar o significado.
4. **Fuso das datas.**
   - Tipo das colunas: `datetime` virou `timestamp` sem fuso, porque o legado guarda hora local sem fuso e não convém inventar um. `TIMESTAMP` virou `timestamptz`, porque o MySQL guarda em UTC.
   - Evidência de que o horário local é o de Brasília: `acessos_online.time` = 1600722635 corresponde a 2020-09-21 18:10:35 em America/Sao_Paulo, exatamente o maior `acessos.data`. Ou seja, o PHP grava a hora local de Brasília.
   - Como o Postgres exibe: o container usa `TZ=America/Sao_Paulo`, então `enviado_em` aparece com `-03` (ex.: 16:40:19 UTC = 13:40:19-03).
5. **IPs mantidos como `varchar`.** Não são só IPv4: 15 das 21 linhas de `acessos` e a linha de `acessos_online` são `::1` (IPv6 de loopback). O `varchar(15)` do legado não comporta um IPv6 completo. Na Fase 2, usar `inet`.
6. **Colação sem caixa/acento só onde importa.** O MySQL compara sem diferenciar maiúsculas e acentos (`*_ci`). Foi criada a colação ICU não determinística `pt_br_ci_ai` (`pt-BR-u-ks-level1`) e aplicada a `usuarios.usuario` e `usuarios.email`, para o login continuar funcionando como antes. Nas demais colunas, a comparação no Postgres passa a diferenciar maiúsculas e acentos. Cuidados com essa colação:
   - **`ILIKE` dá erro** em `usuarios.usuario` e `usuarios.email` ("nondeterministic collations are not supported for ILIKE"). Nelas, use `=` ou `LIKE` (o PG 18 aceita `LIKE` com colação não determinística), ou `ILIKE` com `COLLATE "default"`.
   - **Espaço no fim deixa de ser ignorado.** No MySQL, `'admin' = 'admin '` é verdadeiro (PAD SPACE); no Postgres, não. Hoje nenhum login ou e-mail tem espaço sobrando, mas a API da Fase 2 deve aplicar `trim` na entrada.
   - **Busca de cantos:** as outras colunas diferenciam acento. Ex.: `LIKE '%sao%'` acha 10 cantos no MySQL e 0 no Postgres. Usar `unaccent` (disponível, mas a extensão **não está instalada**: `CREATE EXTENSION unaccent`) ou `COLLATE pt_br_ci_ai`.
7. **`acessos_online` continua sem chave primária**, igual ao legado.
8. **MyISAM → tabelas normais (transacionais).** Não muda nada nos dados.
9. **Sequences**: o próximo id de cada uma = `GREATEST(AUTO_INCREMENT do MySQL, MAX(id)+1)`.
10. **FK `categoria_aurio`: `ON DELETE/UPDATE RESTRICT` virou o padrão `NO ACTION`.** A diferença é só o momento da checagem (fim do comando em vez de imediata); na prática, apagar uma categoria com cantos continua sendo bloqueado.

## Problemas encontrados no legado

- **Senhas em MD5 sem salt** (`usuarios.senha`, 32 hex nas 2 linhas). É inseguro, porque pode ser quebrado por tabela pronta ou força bruta. Na Fase 2, **não reaproveitar**: o certo é forçar redefinição (fluxo de recuperação por e-mail) e usar Argon2id ou bcrypt. O mesmo cuidado vale para `usuarios.token` (32 hex), que deve ser tratado como segredo e invalidado.
- **Charset misto** (latin1 + utf8 de 3 bytes) e **motores mistos** (MyISAM sem transação nem FK, e InnoDB).
- **`sql_mode` sem STRICT.** O MySQL aceitaria datas `0000-00-00` e truncaria valores sem dar erro. Nos dados atuais **não há datas zeradas nem inválidas**, mas o script aborta se aparecer alguma.
- **`int(1)` usado como id** (`acessos`, `configuracoes`, `usuarios`). Não chega a ser um problema real, porque o `(1)` é só largura de exibição.
- **`acessos_online.time` como `int`** (limite de 2038). Corrigido com `bigint`.
- **Strings vazias no lugar de NULL**: `audios.usuario` (191 linhas) e `audios.link` (195), além de alguns campos de `modulos` (`_table`, `codigo`, `icone`), `mensagens_site` e `contato`. Todas foram preservadas como `''`.
- **Nomes de categoria com espaço duplo** ("Comunhão  - Advento" etc.). Foram preservados.
- **`usuarios.permissoes`** é uma lista de ids separados por vírgula, sem FK para `modulos`. **`modulos.codigo`** é JSON guardado como `longtext`. **`audios.usuario`** é texto livre, sem FK.
- **Tabelas do CMS genérico** (`modulos`, `painel_administrativo` com título "MW10", `acessos*`) que não têm a ver com o domínio. São candidatas a descarte na Fase 2.
- **Dados pessoais** em `usuarios`, `contato` e `mensagens_site` (nome, e-mail, telefone). Por isso `02-dados.sql` não pode ser versionado (o repositório é público).

## Pontos em aberto

- **`usuarios.tipo`:** o significado de 1/2 foi inferido (1 parece ser administrador). Confirmar no código PHP legado, se ele estiver disponível.
- **Fuso de `datetime`:** foi inferido como America/Sao_Paulo pela evidência acima. Se a Fase 2 quiser `timestamptz`, basta converter com `AT TIME ZONE 'America/Sao_Paulo'`.
- **Limites conhecidos do `migrar.py`** (não afetam a carga atual):
  - a checagem de data zerada só barra valores que começam com `0000-00-00`; uma data parcialmente zerada (ex.: `2020-00-15`) passaria;
  - o tratamento dos bytes 0x80–0x9F do cp1252 nunca foi exercitado com dados reais, porque eles não existem no banco.
