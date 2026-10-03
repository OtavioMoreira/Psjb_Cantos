#!/usr/bin/env python3
"""Migra o banco legado (MySQL 5.7, container psjb-mysql) para o PostgreSQL 18 (psjb-postgres).

Uso (na raiz do projeto ou em qualquer lugar):
    python3 db/postgres/migrar.py            # gera 02-dados.sql, recria tudo no Postgres e confere
    python3 db/postgres/migrar.py --so-gerar # só gera 02-dados.sql (não toca no Postgres)
    python3 db/postgres/migrar.py --so-conferir

Só usa a biblioteca padrão do Python e `docker exec`. O MySQL é acessado apenas para LEITURA.
Os textos são lidos em HEX (bytes crus) e decodificados aqui conforme o charset de cada coluna,
para não depender de nenhuma conversão implícita do cliente mysql. Ver CONVERSAO.md.
"""
import argparse
import pathlib
import subprocess
import sys

AQUI = pathlib.Path(__file__).resolve().parent
SCHEMA = AQUI / "01-schema.sql"
DADOS = AQUI / "02-dados.sql"

MYSQL = ["docker", "exec", "psjb-mysql", "mysql", "-uroot", "-proot",
         "--default-character-set=binary", "-N", "-B", "psjb_cantos"]
PSQL = ["docker", "exec", "-i", "psjb-postgres", "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1",
        "-U", "psjb", "-d", "psjb_cantos"]

# Ordem de carga: categorias antes de audios (FK).
TABELAS = ["categorias", "audios", "usuarios", "modulos", "configuracoes", "contato",
           "mensagens_site", "painel_administrativo", "acessos", "acessos_online"]

# Colunas int 0/1 que viram boolean no Postgres (a carga falha se aparecer outro valor).
BOOLEANAS = {("audios", "ativo"), ("usuarios", "ativo")}

# Coluna identity de cada tabela (None = sem chave no legado).
IDENTITY = {"categorias": "categorias_id", "audios": "audios_id", "usuarios": "id", "modulos": "id",
            "configuracoes": "id", "contato": "id", "mensagens_site": "id",
            "painel_administrativo": "id", "acessos": "id", "acessos_online": None}

TIPOS_TEXTO = {"varchar", "char", "text", "tinytext", "mediumtext", "longtext", "enum", "set"}


def mysql(sql: str) -> list[list[bytes]]:
    # time_zone +00:00: colunas TIMESTAMP saem em UTC (como estão gravadas), DATETIME não muda.
    r = subprocess.run(MYSQL + ["-e", "SET time_zone='+00:00'; " + sql], capture_output=True)
    if r.returncode:
        sys.exit("Erro no MySQL: " + r.stderr.decode(errors="replace"))
    return [linha.split(b"\t") for linha in r.stdout.split(b"\n") if linha]


def psql(sql: str | None = None, arquivo: pathlib.Path | None = None, saida=False) -> str:
    args = PSQL + (["-A", "-t", "-F", "\t"] if saida else [])
    entrada = arquivo.read_bytes() if arquivo else sql.encode()
    r = subprocess.run(args, input=entrada, capture_output=True)
    if r.returncode:
        sys.exit("Erro no Postgres: " + r.stderr.decode(errors="replace"))
    return r.stdout.decode()


def decodifica_latin1_mysql(b: bytes) -> str:
    """O 'latin1' do MySQL é o cp1252, exceto 0x81, 0x8D, 0x8F, 0x90 e 0x9D (viram U+0081 etc.)."""
    return "".join(bytes([x]).decode("cp1252", errors="ignore") or chr(x) for x in b) \
        if any(0x80 <= x <= 0x9F for x in b) else b.decode("latin1")


def colunas(tabela: str) -> list[tuple[str, str, str | None]]:
    linhas = mysql(f"SELECT column_name, data_type, character_set_name FROM information_schema.columns "
                   f"WHERE table_schema='psjb_cantos' AND table_name='{tabela}' ORDER BY ordinal_position")
    return [(c.decode(), t.decode(), None if cs == b"NULL" else cs.decode()) for c, t, cs in linhas]


def ordem(tabela: str, cols) -> str:
    pk = IDENTITY[tabela]
    return f"`{pk}`" if pk else ", ".join(f"`{c}`" for c, _, _ in cols)


def escapa_copy(s: str) -> str:
    return s.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")


def le_tabela(tabela: str):
    cols = colunas(tabela)
    sel = ", ".join(f"HEX(`{c}`)" if t in TIPOS_TEXTO else f"`{c}`" for c, t, _ in cols)
    linhas = mysql(f"SELECT {sel} FROM `{tabela}` ORDER BY {ordem(tabela, cols)}")
    resultado = []
    for bruta in linhas:
        valores = []
        for (c, t, cs), v in zip(cols, bruta):
            if v == b"NULL":  # HEX de texto nunca é 'NULL'; para os demais tipos é o NULL do cliente
                valores.append(None)
            elif t in TIPOS_TEXTO:
                b = bytes.fromhex(v.decode())
                if cs in ("utf8", "utf8mb4"):
                    valores.append(b.decode("utf-8"))  # estrito: falha se houver byte inválido
                elif cs == "latin1":
                    valores.append(decodifica_latin1_mysql(b))
                else:
                    sys.exit(f"Charset não tratado: {tabela}.{c} = {cs}")
            elif (tabela, c) in BOOLEANAS:
                if v not in (b"0", b"1"):
                    sys.exit(f"{tabela}.{c} tem valor fora de 0/1: {v!r}")
                valores.append("t" if v == b"1" else "f")
            elif t == "timestamp":
                valores.append(v.decode() + "+00")
            elif t in ("datetime", "date") and v.decode().startswith("0000-00-00"):
                sys.exit(f"Data zerada em {tabela}.{c}: decidir o tratamento antes de migrar")
            else:
                valores.append(v.decode())
        resultado.append(valores)
    return cols, resultado


def gera_dados() -> dict:
    autoinc = {t.decode(): (None if a == b"NULL" else int(a)) for t, a in mysql(
        "SELECT table_name, auto_increment FROM information_schema.tables WHERE table_schema='psjb_cantos'")}
    partes = [
        "-- Dados do banco legado convertidos para PostgreSQL 18. GERADO por migrar.py: não editar.",
        "-- CONTÉM DADOS REAIS (pessoais e hashes de senha): não versionar (coberto por db/**/*.sql).",
        "\\set ON_ERROR_STOP on",
        "SET client_encoding = 'UTF8';",
        "BEGIN;",
        "TRUNCATE " + ", ".join(TABELAS) + " RESTART IDENTITY;",
    ]
    contagens = {}
    for tabela in TABELAS:
        cols, linhas = le_tabela(tabela)
        contagens[tabela] = len(linhas)
        partes.append(f"\n-- {tabela}: {len(linhas)} linhas")
        partes.append(f"COPY {tabela} ({', '.join(c for c, _, _ in cols)}) FROM stdin;")
        for valores in linhas:
            partes.append("\t".join("\\N" if v is None else escapa_copy(v) for v in valores))
        partes.append("\\.")
    partes.append("\n-- Próximo id = AUTO_INCREMENT do MySQL (não reaproveita ids já apagados no legado)")
    for tabela in TABELAS:
        pk = IDENTITY[tabela]
        if pk:
            proximo = autoinc[tabela] or 1
            partes.append(f"SELECT setval(pg_get_serial_sequence('{tabela}', '{pk}'), "
                          f"GREATEST({proximo}, (SELECT COALESCE(MAX({pk}), 0) + 1 FROM {tabela})), false);")
    partes += ["COMMIT;", "ANALYZE;", ""]
    DADOS.write_text("\n".join(partes), encoding="utf-8")
    print(f"Gerado {DADOS} ({DADOS.stat().st_size} bytes)")
    return contagens


def confere() -> bool:
    """Compara origem x destino coluna a coluna, linha a linha (textos via CONVERT do próprio MySQL)."""
    ok = True
    print(f"\n{'tabela':<24}{'MySQL':>8}{'Postgres':>10}  conteúdo")
    for tabela in TABELAS:
        cols = colunas(tabela)
        my_sel, pg_sel = [], []
        for c, t, cs in cols:
            if t in TIPOS_TEXTO:
                my_sel.append(f"HEX(CONVERT(`{c}` USING utf8mb4))")
                pg_sel.append(f"upper(encode(convert_to({c}, 'UTF8'), 'hex'))")
            elif (tabela, c) in BOOLEANAS:
                my_sel.append(f"`{c}`")
                pg_sel.append(f"{c}::int")
            elif t == "timestamp":
                my_sel.append(f"DATE_FORMAT(`{c}`, '%Y-%m-%d %H:%i:%s')")
                pg_sel.append(f"to_char({c} AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')")
            elif t == "datetime":
                my_sel.append(f"DATE_FORMAT(`{c}`, '%Y-%m-%d %H:%i:%s')")
                pg_sel.append(f"to_char({c}, 'YYYY-MM-DD HH24:MI:SS')")
            else:
                my_sel.append(f"`{c}`")
                pg_sel.append(c)
        pk = IDENTITY[tabela]
        pg_ordem = pk if pk else ", ".join(c for c, _, _ in cols)
        origem = [[v.decode() for v in l] for l in
                  mysql(f"SELECT {', '.join(my_sel)} FROM `{tabela}` ORDER BY {ordem(tabela, cols)}")]
        # NULL do psql vem como string vazia; marca explicitamente para distinguir de ''
        pg_sel = [f"COALESCE(({e})::text, 'NULL')" for e in pg_sel]
        destino = [l.split("\t") for l in psql(
            f"SELECT {', '.join(pg_sel)} FROM {tabela} ORDER BY {pg_ordem}", saida=True).splitlines()]
        # Strings vazias: MySQL HEX('') = '' e Postgres encode('') = ''
        igual = origem == destino
        ok &= igual and len(origem) == len(destino)
        print(f"{tabela:<24}{len(origem):>8}{len(destino):>10}  {'idêntico' if igual else 'DIFERENTE'}")
    autoinc = {t.decode(): a.decode() for t, a in mysql(
        "SELECT table_name, auto_increment FROM information_schema.tables WHERE table_schema='psjb_cantos'")}
    print(f"\n{'próximo id':<24}{'MySQL':>8}{'Postgres':>10}")
    for tabela in TABELAS:
        pk = IDENTITY[tabela]
        if not pk:
            continue
        seq = psql(f"SELECT pg_get_serial_sequence('{tabela}', '{pk}')", saida=True).strip()
        prox = psql(f"SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM {seq}",
                    saida=True).strip()
        ok &= prox == autoinc[tabela]
        print(f"{tabela:<24}{autoinc[tabela]:>8}{prox:>10}  {'ok' if prox == autoinc[tabela] else 'DIFERENTE'}")
    print("\nCONFERÊNCIA OK" if ok else "\nCONFERÊNCIA FALHOU")
    return ok


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--so-gerar", action="store_true")
    ap.add_argument("--so-conferir", action="store_true")
    a = ap.parse_args()
    if not a.so_conferir:
        gera_dados()
        if a.so_gerar:
            return
        print("Aplicando 01-schema.sql e 02-dados.sql no psjb-postgres...")
        psql(arquivo=SCHEMA)
        psql(arquivo=DADOS)
    sys.exit(0 if confere() else 1)


if __name__ == "__main__":
    main()
