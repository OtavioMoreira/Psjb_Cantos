# Verificação independente da conversão MySQL 5.7 → PostgreSQL 18

Auditoria feita em 2026-10-03 sobre o resultado de `db/postgres/migrar.py` (`01-schema.sql` + `02-dados.sql`), descrito em `CONVERSAO.md`.

## Veredito: **APROVADO COM RESSALVAS**

- **Dados:** a migração está correta. As 6.584 células das 10 tabelas são iguais byte a byte (UTF-8) às do MySQL **e** às do dump de produção. Não há mojibake, truncamento, troca de NULL por `''` nem deslocamento de fuso.
- **Esquema, sequences e integridade:** estão equivalentes.
- **Ressalvas:** nenhuma afeta os dados migrados. São uma afirmação falsa no `CONVERSAO.md` (IPs "todos IPv4") e duas diferenças de comportamento da colação `pt_br_ci_ai` que a documentação não cita: `ILIKE` dá erro, e o espaço no fim do texto passa a contar. Detalhes em §3.

---

## 1. Método

Todo o acesso foi **somente leitura**: apenas `SELECT`, `information_schema`, `pg_catalog` e leitura do arquivo de dump. Não usei `nextval`, `INSERT`, nem o `migrar.py`. A lógica de conferência do `migrar.py` **não foi reaproveitada**. Os scripts próprios estão no scratchpad da sessão, fora do repositório: `audit.py`, `enc.py` e `dump.py`.

Fiz três comparações independentes:

| # | Origem | Destino | Como |
|---|---|---|---|
| A | MySQL (`psjb-mysql`), bytes crus `HEX(col)` decodificados **por mim** (utf8 → UTF-8 estrito; latin1 → tabela cp1252 do MySQL, com 0x81/8D/8F/90/9D → U+0081…) | Postgres `encode(convert_to(col,'UTF8'),'hex')` | célula a célula, casando pela PK |
| A′ | MySQL `HEX(CONVERT(col USING utf8mb4))` (a conversão feita pelo próprio servidor) | o resultado do método A | confirma a minha decodificação latin1/utf8 |
| B | **Arquivo do dump de produção** `db/psjb_cantos_producao.sql`, interpretado por um parser próprio de `INSERT` (escapes `\'`, `\\`, `\r`, `\n`, `\0`...) | Postgres (texto, inteiros, booleanos 0/1, `timestamp` formatado, `timestamptz` em UTC) | célula a célula |

A comparação B é independente do container MySQL: ela pega um eventual erro na importação do dump.

Regras usadas na comparação de outros tipos:

| Tipo | Como foi comparado |
|---|---|
| Inteiros | `CAST(col AS CHAR)` = `col::text` |
| `ativo` | `0/1` = `false/true` |
| `datetime` | `DATE_FORMAT(...,'%Y-%m-%d %H:%i:%s')` = `to_char(..., 'YYYY-MM-DD HH24:MI:SS')`, sem conversão de fuso |
| `timestamp` | `UNIX_TIMESTAMP()` (sessão em `+00:00`) = `extract(epoch ...)` |
| NULL | marcado como `N`, separado do texto vazio `H` + hex vazio, então NULL × `''` também entrou na comparação |

**Observação sobre o método:** duas divergências apareceram durante a auditoria e as duas eram **bugs dos meus scripts**, não da migração. Ambas foram corrigidas e as comparações foram refeitas.
1. No Postgres, a coluna de saída de um `CASE` herda o nome da coluna, então o `ORDER BY` ordenava o texto. Resolvido qualificando a coluna com o alias da tabela.
2. `"timestamp without time zone".startswith("timestamp with")` é verdadeiro, o que gerou um falso "−3 h". Conferindo direto, os valores eram iguais nos três lugares: `acessos.id=17` vale `2020-07-07 14:57:11` no dump, no MySQL e no PG.

## 2. Resultados por dimensão

### 2.1 Contagem de linhas e conteúdo (comparações A, A′ e B)

| Tabela | Motor / charset | MySQL | Dump | PG | Células | Divergências A | Divergências A′ | Divergências B |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| acessos | MyISAM / latin1 | 21 | 21 | 21 | 63 | 0 | 0 | 0 |
| acessos_online | MyISAM / latin1 | 1 | 1 | 1 | 2 | 0 | 0 | 0 |
| audios | InnoDB / utf8 | 623 | 623 | 623 | 6.230 | 0 | 0 | 0 |
| categorias | InnoDB / utf8 | 45 | 45 | 45 | 135 | 0 | 0 | 0 |
| configuracoes | MyISAM / latin1 | 1 | 1 | 1 | 7 | 0 | 0 | 0 |
| contato | InnoDB / latin1 | 1 | 1 | 1 | 20 | 0 | 0 | 0 |
| mensagens_site | InnoDB / utf8 | 10 | 10 | 10 | 70 | 0 | 0 | 0 |
| modulos | InnoDB / latin1 | 6 | 6 | 6 | 30 | 0 | 0 | 0 |
| painel_administrativo | InnoDB / latin1 | 1 | 1 | 1 | 7 | 0 | 0 | 0 |
| usuarios | MyISAM / latin1 | 2 | 2 | 2 | 20 | 0 | 0 | 0 |
| **Total** | | **711** | **711** | **711** | **6.584** | **0** | **0** | **0** |

Saída final do `dump.py`: `TOTAL celulas 6584 divergentes 0`. Saída final do `audit.py`: `DIVERGENCIAS: [] 0`.

### 2.2 Encoding: varredura do texto no PG e dos bytes no MySQL

`enc.py` passou por todas as 44 colunas de texto. Em todas, deu **0** nestes testes:
- **mojibake:** padrões `Ã[\x80-\xBF]`, `Â[\x80-\xBF]`, `â€`, `ï¿½` e U+FFFD;
- **caracteres de controle**, exceto `\t`, `\n` e `\r`;
- **`?` no lugar de acento**, buscado como letra`?`letra;
- **dupla codificação**, testada assim: `encode('cp1252')` seguido de `decode('utf-8')` devolve um texto diferente do original.

Nas colunas **latin1** do MySQL, procurei pares de bytes no formato UTF-8 (`C2/C3/E2` + `80–BF`), que indicariam UTF-8 gravado em latin1. Resultado: **0** em todas.

Colunas com algum caractere fora do ASCII:

| Coluna | Charset | Linhas não ASCII | Caracteres encontrados |
|---|---|---:|---|
| audios.descricao | utf8 | 623 / 623 | NBSP, `ª°º`, maiúsculas e minúsculas acentuadas, U+2003, `– ‘ ’ “ ” …` |
| audios.nome | utf8 | 329 / 623 | `ºÀÉÊÓàáâãçéêíóôú` |
| categorias.nome | utf8 | 27 / 45 | `áãçéêíóõ` |
| configuracoes.titulo / descricao / palavras | latin1 | 1 / 1 cada | `ã ó` (1 byte por acento no MySQL) |
| modulos.nome | latin1 | 2 / 6 | `á ç õ` |

Mais estas verificações:
- **Faixa 0x80–0x9F:** nenhum byte nessa faixa nas colunas latin1. Com isso, a diferença entre o latin1 do MySQL e o cp1252 não chegou a ser testada pelos dados reais.
- **`?` legítimos:** os 4 `?` em `audios.nome` são pontos de interrogação de verdade (ex.: `…tua vitória?`, hex `…3F`), e há 74 `?` em `descricao` nos dois bancos.
- **`descricao` em números:** NBSP em 623/623 linhas, 29.959 `\r` (igual nos dois), máximo de 6.800 caracteres e 8.092 bytes (igual nos dois) e nenhum `\t`.
- **mensagens_site:** é 100 % ASCII nas colunas de texto (0 linhas acentuadas em nome, cidade e mensagem).

### 2.3 Números, booleanos, datas, NULL × vazio

- **Booleanos:** `audios.ativo` tem 623 linhas com valor 1 no MySQL e 623 `t` no PG. `usuarios.ativo` tem 2 com 1 e 2 `t`. Não há outros valores.
- **Datas zeradas:** nenhuma. `acessos.data` e `usuarios.ultimo_acesso` têm 0 NULL e 0 `0000-00-00`, e `mensagens_site.enviado_em` também não tem `0000…`.
- **Fuso:**
  - `datetime` → `timestamp`: o valor de parede é idêntico, conferido também contra o dump.
  - `timestamp` → `timestamptz`: o instante é idêntico. Exemplo: o menor `enviado_em` vale `13:40:19` no MySQL (fuso do sistema −03) e `13:40:19-03` no PG, ou seja, `16:40:19` UTC. No dump (gravado com `TIME_ZONE='+00:00'`) ele também aparece como `16:40:19`.
  - A afirmação do CONVERSAO.md de que `acessos_online.time` = 1600722635 corresponde a 18:10:35 em America/Sao_Paulo e coincide com o maior `acessos.data`: **confere**.
- **NULL × `''`:** foi preservado em todas as células (comparação A). Os números batem com o CONVERSAO.md:

  | Coluna | Contagem |
  |---|---|
  | `audios.usuario` | 191 `''` |
  | `audios.link` | 195 `''` |
  | `audios.audio_mp3` | 201 NULL |
  | `audios.partitura` | 457 NULL |

  Há ainda alguns `''` não citados no doc: `modulos._table` (3), `modulos.codigo` (4), `modulos.icone` (6), `mensagens_site.cidade`/`telefone` (2), `contato.subtitulo`/`desctitulo` (1). Todos foram preservados.

### 2.4 Esquema

Comparei `information_schema.COLUMNS`, `STATISTICS` e `REFERENTIAL_CONSTRAINTS` (MySQL) com `information_schema.columns`, `pg_constraint` e `pg_indexes` (PG). O estado real do banco é igual ao `01-schema.sql`.

| Item | Resultado |
|---|---|
| Colunas | 74/74 presentes, com mesmo nome e mesma ordem |
| `varchar(n)` | Mesmo `n` em todas as colunas (15, 20, 50, 70, 100, 155, 175, 255). O maior valor real cabe com folga (ex.: `audios.audio_mp3` máx. 125, `configuracoes.titulo` 34/70). Não há truncamento (a comparação A acusaria). |
| `text` / `longtext` | `text` |
| Inteiros | `int(n)` → `integer`. `acessos_online.time int(20)` → `bigint`, que é só um alargamento seguro. Não há `unsigned`. |
| NOT NULL | Os mesmos 14 NOT NULL dos dois lados, contando as PKs |
| Defaults | `audios.ativo` 1 → `true`; `usuarios.tipo` 2 → 2; `usuarios.senha` `''` → `''`; `mensagens_site.telefone` `'Não informado'` com bytes `4EC3A36F…` idênticos; `enviado_em` `CURRENT_TIMESTAMP` → `CURRENT_TIMESTAMP` |
| PKs | 9 PKs iguais. `acessos_online` não tem PK nos dois lados. |
| Índices | O `KEY categoria_aurio (id_categoria)` virou o índice btree `categoria_aurio`. Não há UNIQUE além das PKs nos dois lados. |
| FK | Os dois lados têm `categoria_aurio`: `audios.id_categoria → categorias.categorias_id`. No MySQL é `ON DELETE/UPDATE RESTRICT`; no PG é o padrão `NO ACTION`, que é equivalente na prática, pois só difere com constraint `DEFERRABLE`. O doc não menciona essa diferença. |
| Triggers, views, rotinas | Não há em nenhum dos dois lados |
| Banco PG | UTF8 com ICU `pt-BR`. A colação `pt_br_ci_ai` (ICU, `pt-BR-u-ks-level1`, não determinística) existe e é usada só em `usuarios.usuario` e `usuarios.email`. Há 34 COMMENTs. |

### 2.5 Sequences / identity

A leitura foi feita direto da relação de cada sequence (`SELECT last_value, is_called`, sem `nextval`):

| Sequence | last_value | is_called | Próximo | MAX(id) PG | MAX(id) MySQL | AUTO_INCREMENT |
|---|---:|---|---:|---:|---:|---:|
| acessos_id_seq | 38 | f | 38 | 37 | 37 | 38 |
| audios_audios_id_seq | 641 | f | 641 | 640 | 640 | 641 |
| categorias_categorias_id_seq | 48 | f | 48 | 47 | 47 | 48 |
| configuracoes_id_seq | 2 | f | 2 | 1 | 1 | 2 |
| contato_id_seq | 2 | f | 2 | 1 | 1 | 2 |
| mensagens_site_id_seq | 89 | f | 89 | 88 | 88 | 89 |
| modulos_id_seq | 56 | f | 56 | 55 | 55 | 56 |
| painel_administrativo_id_seq | 2 | f | 2 | 1 | 1 | 2 |
| usuarios_id_seq | 10 | f | 10 | 9 | 9 | 10 |

Todas são `GENERATED BY DEFAULT AS IDENTITY` do tipo `integer`. Em todas, o próximo valor é igual ao AUTO_INCREMENT e é ≥ MAX+1.

### 2.6 Integridade referencial

| Verificação | MySQL | PG |
|---|---:|---:|
| `audios` órfãos (categoria inexistente) | 0 | 0 |
| `audios.id_categoria IS NULL` | 0 | 0 |
| Categorias sem nenhum canto | 3 | 3 |

As relações sem FK no legado também foram verificadas: `usuarios.permissoes` aponta para ids de `modulos`, e `audios.usuario` é texto livre. Os dados delas são idênticos (comparação A).

### 2.7 Colação e comportamento de busca

| Teste | MySQL | PG |
|---|---|---|
| Login igual ignorando caixa (`usuario = UPPER(usuario)`) | 2/2 | 2/2 ✔ |
| E-mail igual ignorando caixa | 2/2 | 2/2 ✔ |
| Acento no login (`'e' = 'é'`, `'a' = 'ã'`, `'c' = 'ç'`… em `latin1_swedish_ci`) | iguais | iguais com `pt_br_ci_ai` ✔ |
| `LIKE` em `usuario` com colação não determinística | funciona | funciona (PG 18) ✔ |
| **`ILIKE` em `usuario`/`email`** | — | **`ERROR: nondeterministic collations are not supported for ILIKE`** ✘ (ver R2) |
| **Espaço no fim** (`'admin' = 'admin '`) | **igual** (PAD SPACE) | **diferente** ✘ (ver R3) |
| `audios.nome LIKE '%sao%'` | 10 | 0 (colação padrão diferencia acento); 10 com `COLLATE pt_br_ci_ai` ou `ILIKE '%são%'` (documentado) |
| `ORDER BY nome` em `audios` e `categorias` | — | mesma ordem nos dois (0 linhas diferentes no `diff`) |

## 3. Divergências e ressalvas (com evidência)

### R1. Afirmação falsa no CONVERSAO.md: "todos os valores são IPv4 válidos" (Decisão 5)

O mesmo erro aparece no COMMENT da tabela `acessos` ("só IPv4"). Os dados foram migrados corretamente; o que está errado é o texto.

```sql
-- PG
select family(ip::inet), length(ip), count(*), bool_or(ip='::1') from acessos group by 1,2;
--  4 | 9 |  6 | f
--  6 | 3 | 15 | t        -- 15 das 21 linhas são o loopback IPv6 "::1"
select family(ip::inet) from acessos_online;   -- 6  ("::1")
```

Risco: `acessos.ip varchar(15)` não comporta IPv6 real. No legado, com `sql_mode` não estrito, um IPv6 seria truncado em silêncio. Se a Fase 2 mantiver o log, use `inet`.

### R2. `ILIKE` falha em `usuarios.usuario` e `usuarios.email`

O CONVERSAO.md (Decisão 6) recomenda "use `ILIKE`/`unaccent` ou `COLLATE pt_br_ci_ai`" sem avisar que o `ILIKE` **dá erro** nessas duas colunas:

```sql
select count(*) from usuarios where usuario ilike '%a%';
-- ERROR:  nondeterministic collations are not supported for ILIKE
select count(*) from usuarios where usuario collate "default" ilike '%a%';   -- funciona
```

Também vale saber que a busca por igualdade em colação não determinística não usa índice btree comum (hoje não há índice em `usuario`).

### R3. Espaço no fim do texto deixou de ser ignorado

O MySQL 5.7 (PAD SPACE) considera `'admin' = 'admin '`. A colação `pt_br_ci_ai` não faz isso:

```sql
-- MySQL: SELECT CONVERT('Admin' USING latin1) = CONVERT('admin ' USING latin1) COLLATE latin1_swedish_ci;  → 1
-- PG:    SELECT 'abc' = 'abc ' COLLATE pt_br_ci_ai;                                                     → f
```

Hoje nenhum login nem e-mail tem espaço sobrando: `sum(usuario<>trim(usuario))` = 0 e o mesmo para `email`. O impacto aparece em comparações vindas da aplicação, então a API da Fase 2 deve aplicar `trim` na entrada. O doc afirma que "o login continua funcionando como antes", e isso é verdade **exceto** neste caso.

### R4. Omissões menores no CONVERSAO.md (sem impacto nos dados)

- **FK:** `RESTRICT` (MySQL) virou `NO ACTION` (PG). É equivalente sem `DEFERRABLE`.
- **Strings vazias:** além de `audios.usuario`/`link`, há `''` em `modulos` (`_table`, `codigo`, `icone`), `mensagens_site` e `contato`. Todos foram preservados.
- **Busca na Fase 2:** o doc diz que a colação padrão "diferencia maiúsculas e acentos" e sugere `unaccent`, mas a extensão `unaccent` não está instalada no banco. Na Fase 2 será preciso rodar `CREATE EXTENSION unaccent`.

### R5. Pontos fracos latentes no `migrar.py`

Nenhum deles afeta a carga atual.

- A checagem de data zerada só pega valores que começam com `0000-00-00`. Datas parcialmente zeradas, como `2020-00-10`, não seriam barradas. Hoje há 0 casos.
- O caminho de decodificação cp1252 para os bytes 0x80–0x9F nunca foi exercitado pelos dados reais (§2.2).

### Afirmações do CONVERSAO.md que **conferem**

- Contagens e próximo id da tabela de resultado.
- 329/623/27 linhas acentuadas.
- Nenhum mojibake (os "Ã" e "Â" que existem são maiúsculas legítimas).
- NBSP em 623 linhas e cerca de 30 mil `\r` (são exatamente 29.959).
- Maior `descricao` com 6.800 caracteres e 8.092 bytes.
- Ausência de bytes 0x80–0x9F no latin1.
- Mapeamento de tipos coluna a coluna.
- Datas sem zero.
- Conversão `ativo` → boolean.
- MD5 de 32 hex nas 2 senhas e token de 32 hex.
- `.gitignore` cobrindo `01-schema.sql` e `02-dados.sql` (`git check-ignore`: regra `db/**/*.sql`).

## 4. Riscos para a Fase 2 (apenas apontados)

1. **Senhas MD5 sem salt:** 2/2 linhas no formato `^[0-9a-f]{32}$`. Os tokens estão no mesmo formato. Não reaproveitar: forçar redefinição de senha, usar Argon2id ou bcrypt e invalidar os tokens.
2. **Dados pessoais:** `mensagens_site` (8 e-mails e 8 telefones preenchidos), `usuarios` (nome e e-mail) e `contato`. O `02-dados.sql` e o volume do Postgres contêm esses dados, então nunca devem ser versionados ou publicados (o repositório é público).
3. **`01-schema.sql` fica fora do git** por causa da regra `db/**/*.sql`, ou seja, o DDL não está versionado.
4. **IPs:** ver R1. Usar `inet` e decidir se o log `acessos*` deve ser descartado, pois tem dados de visitantes.
5. **Busca e login:** ver R2 e R3, mais a normalização de NBSP e `\r` em `audios.descricao`.
6. **Colação sem acento só em `usuario`/`email`:** a busca de cantos precisa de `unaccent` ou de `COLLATE pt_br_ci_ai` explícito. Hoje `LIKE '%sao%'` devolve 0 linhas no PG e 10 no MySQL.
7. **`usuarios.tipo` e `usuarios.permissoes`:** a semântica não foi confirmada, e `permissoes` é uma lista CSV sem FK.
