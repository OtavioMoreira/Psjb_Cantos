#!/usr/bin/env python3
"""
Converte os 623 cantos do banco legado (tabela `audios`, já no Postgres local) para o formato de
`data/songs.json` e grava o arquivo com o repertório inteiro.

    python3 db/postgres/importar_cantos.py            # converte e grava data/songs.json
    python3 db/postgres/importar_cantos.py --conferir # só compara o conversor com os cantos já revisados

- Os cantos que já estão no `data/songs.json` (revisados à mão) não mudam: só entram os que faltam.
- O id do canto é o `audios_id` do legado (as missas guardam songId).
- A letra vem do HTML do editor do site antigo: cada <p> é uma linha, o negrito de uma linha de letra
  inteira vira refrão (**…**), as linhas de acordes mantêm o alinhamento, e o cabeçalho
  (título sublinhado + " - Compositor") vira o campo composer.
- As flags saem da categoria do legado (ex.: "Comunhão - Advento" → momento comunhao + tempo advento).
  Salmos e aclamações pegam o tempo pelo título ("Quaresma 2º Dom. - Salmo 115" → quaresma).

Depois de gravar, carregue no banco com: npm run db:import-songs -w api
Só usa a biblioteca padrão e `docker exec` no container psjb-postgres (somente leitura).
"""

import argparse
import html
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SONGS = RAIZ / "data" / "songs.json"
CATEGORIES = RAIZ / "data" / "categories.json"
SITE_ANTIGO = "https://cantos.psjb.org.br/"

# Temas novos, vindos de categorias do site antigo que não cabiam nos eixos atuais. Creio e Sequências
# seriam momentos, mas a lista de momentos é fechada no editor de missa: ficam como tema por enquanto.
TEMAS_NOVOS = [
    ("creio", "Creio"),
    ("sequencia", "Sequências"),
    ("semana-santa", "Semana Santa"),
    ("criancas", "Crianças"),
    ("familia", "Família"),
    ("meditacao-louvor", "Meditação e Louvor"),
    ("movimentos", "Movimentos"),
    ("palavra", "Palavra"),
    ("perdao", "Perdão"),
    ("santos", "Santos"),
    ("exequias", "Exéquias"),
]

MOMENTOS = {
    "Abertura": "entrada",
    "Ato penitencial": "ato-penitencial",
    "Glória": "gloria",
    "Apresentação das oferendas": "ofertorio",
    "Santo": "santo",
    "Cordeiro": "cordeiro",
    "Comunhão": "comunhao",
    "Salmos": "salmo",
    "Aclamações": "aclamacao",
}
TEMPOS = {"Advento": "advento", "Natal": "natal", "Quaresma": "quaresma", "Páscoa": "pascoa", "Tempo Comum": "tempo-comum"}
DIVERSOS = {
    "Crianças": "criancas",
    "Espírito Santo": "espirito-santo",
    "Família": "familia",
    "Marianos": "mariano",
    "Meditação e Louvor": "meditacao-louvor",
    "Movimentos": "movimentos",
    "Palavra": "palavra",
    "Paz": "paz",
    "Perdão": "perdao",
    "Santos": "santos",
    "Vocacionais e Missão": "vocacional-missao",
}
# Tempo pelo título (salmos e aclamações), na ordem de teste.
TEMPO_NO_TITULO = [
    (r"advento", "advento"),
    (r"natal|sagrada fam|m[ãa]e de deus|epifania|batismo do senhor", "natal"),
    (r"quaresma|cinzas|ramos|quinta-feira santa|sexta-feira santa", "quaresma"),
    (r"p[áa]scoa|pascal|ascens[ãa]o|pentecostes", "pascoa"),
    (r"tempo comum|sant[íi]ssima trindade", "tempo-comum"),
]


def flags_da_categoria(categoria: str, titulo: str):
    moments, seasons, years, themes = [], [], [], []
    cat = re.sub(r"\s+", " ", categoria).strip()
    base, _, resto = cat.partition(" - ")
    if base in MOMENTOS:
        moments.append(MOMENTOS[base])
        if resto in TEMPOS:
            seasons.append(TEMPOS[resto])
        m = re.match(r"ANO ([ABC])$", resto)
        if m:
            years.append(m.group(1))
    elif base == "Cantos diversos":
        if resto == "Natal":
            seasons.append("natal")
        else:
            themes.append(DIVERSOS[resto])
    elif base == "Creio":
        themes.append("creio")
    elif base == "Sequências":
        themes.append("sequencia")
    elif base in ("Semana Santa", "Tríduo Pascal"):
        seasons.append("quaresma")
        themes.append("semana-santa")
    elif base == "Exéquias":
        themes.append("exequias")
    else:
        raise ValueError(f"categoria sem regra: {categoria!r}")

    if not seasons and moments and moments[0] in ("salmo", "aclamacao"):
        t = titulo.lower()
        for padrao, tempo in TEMPO_NO_TITULO:
            if re.search(padrao, t):
                seasons.append(tempo)
                break
    return moments, seasons, years, themes


# Mesma regra de lib/chords.ts (isChordLine), para a letra ser lida do mesmo jeito no site.
CHORD_RE = re.compile(r"^\(?[A-G](#|b)?(m|maj|min|dim|aug|sus|add|M)?[°º]?[0-9]*\+?(\([^)]*\))?([#b+-]?[0-9]+)*(M|maj)?[0-9]*(/[A-G](#|b)?)?\)?$")


def acorde(token: str) -> bool:
    return bool(CHORD_RE.match(re.sub(r"[,;.]$", "", token)))


def linha_de_acordes(texto: str) -> bool:
    tokens = texto.split()
    if not tokens:
        return False
    return all(acorde(t) or re.fullmatch(r"[|/\-–x2()]+", t) for t in tokens) and any(acorde(t) for t in tokens)


def texto_puro(fragmento: str) -> str:
    sem_tags = re.sub(r"<br\s*/?>", " ", fragmento, flags=re.I)
    sem_tags = re.sub(r"<[^>]+>", "", sem_tags)
    return limpar(html.unescape(sem_tags))


def limpar(texto: str) -> str:
    return texto.replace("\xa0", " ").replace("\u2003", " ").replace("\r", "").replace("\n", "").replace("\t", "    ")


def sublinhas(paragrafo: str):
    """Quebra o <p> nos <br>. Devolve [(texto, negrito de cada letra ou número)]."""
    linhas, atual, negrito = [], [], 0
    for parte in re.split(r"(<[^>]+>)", paragrafo):
        if not parte:
            continue
        if parte.startswith("<"):
            tag = re.match(r"<\s*(/?)\s*(\w+)", parte)
            if not tag:
                continue
            fecha, nome = tag.group(1) == "/", tag.group(2).lower()
            if nome == "br":
                linhas.append(atual)
                atual = []
            elif nome in ("strong", "b"):
                negrito = max(0, negrito - 1) if fecha else negrito + 1
            continue
        for ch in limpar(html.unescape(parte)):
            atual.append((ch, negrito > 0))
    linhas.append(atual)
    # Só letras e números contam: a pontuação final às vezes fica fora do negrito ("…nós</strong>.").
    return [("".join(c for c, _ in l), [b for c, b in l if c.isalnum()]) for l in linhas]


def cabecalho_compositor(p: str):
    """Cabeçalho "<u><strong>34 A MESSE</strong></u> - Aimé Durval": devolve o compositor (ou None)."""
    fora = re.sub(r"<(u|strong|b)\b[^>]*>.*?</\1>", "", p, flags=re.I | re.S)
    fora = re.sub(r"<(u|strong|b)\b[^>]*>.*?</\1>", "", fora, flags=re.I | re.S).strip()
    m = re.search(r"(?:^|\s)[-–]\s*(.+)$", texto_puro(fora).strip())
    return m.group(1).strip() if m else None


def eh_cabecalho(p: str, texto: str) -> bool:
    if linha_de_acordes(texto):
        return False
    return bool(re.search(r"<u\b", p, re.I)) or bool(re.match(r"\s*(<[^>]+>\s*)*(<strong|<b\b)", p, re.I))


def converter_letra(descricao: str):
    """Devolve (compositor, letra) a partir do HTML do editor."""
    paragrafos = re.findall(r"<p\b[^>]*>(.*?)</p>", descricao or "", flags=re.I | re.S)
    compositor = None
    linhas = []
    cabecalho = True
    for p in paragrafos:
        texto = texto_puro(p)
        if cabecalho:
            if not texto.strip():
                continue
            # 1ª linha com texto: "<u><strong>34 A MESSE</strong></u> - Aimé Durval" ou "Salmo 97 (Natal/dia)".
            cabecalho = False
            if eh_cabecalho(p, texto):
                compositor = cabecalho_compositor(p)
                continue
        for texto, negritos in sublinhas(p):
            if not texto.strip():
                linhas.append("")
            elif linha_de_acordes(texto):
                linhas.append(texto.rstrip())
            elif negritos and all(negritos) and not re.fullmatch(r"\s*\d+\.\s*", texto):
                # Linha de letra toda em negrito = refrão. O recuo fica fora dos ** (alinha com os acordes).
                recuo = texto[: len(texto) - len(texto.lstrip())]
                linhas.append(f"{recuo}**{texto.strip()}**")
            else:
                linhas.append(texto.rstrip())
    # Uma linha em branco no máximo entre blocos, sem brancos nas pontas.
    letra = re.sub(r"\n{3,}", "\n\n", "\n".join(linhas)).strip("\n")
    return compositor or None, letra


def tom(letra: str):
    for linha in letra.split("\n"):
        if linha_de_acordes(linha):
            # Só a tônica e o modo: "Bm7" → "Bm", "C7" → "C", "E7+" → "E", "A/C#" → "A".
            m = re.match(r"([A-G](#|b)?)(m(?!aj))?", linha.split()[0].strip("()"))
            return m.group(1) + ("m" if m.group(3) else "")
    return None


def slugify(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def url(caminho):
    caminho = (caminho or "").strip()
    return SITE_ANTIGO + caminho if caminho else None


def converter(a):
    nome = re.sub(r"\s+", " ", a["nome"]).strip()
    m = re.match(r"^(\d+)\s*(?:[-–]\s*)?(.+)$", nome)
    numero, titulo = (int(m.group(1)), m.group(2).strip()) if m else (None, nome)
    compositor, letra = converter_letra(a["descricao"])
    moments, seasons, years, themes = flags_da_categoria(a["categoria"], titulo)
    usuario, link = (a["usuario"] or "").strip(), (a["link"] or "").strip()
    return {
        "id": a["audios_id"],
        "number": numero,
        "slug": f"{numero:03d}-{slugify(titulo)}" if numero else slugify(titulo),
        "title": titulo,
        "composer": compositor,
        "moments": moments,
        "seasons": seasons,
        "years": years,
        "themes": themes,
        "media": {
            "audiomack": f"https://audiomack.com/embed/song/{usuario or 'hinariopsjb'}/{link}" if link else None,
            "audio": url(a["audio_mp3"]),
            "cifraPdf": url(a["cifra"]),
            "partituraPdf": url(a["partitura"]),
        },
        "key": tom(letra),
        "lyrics": letra,
        "active": a["ativo"],
    }


def legado():
    sql = (
        "SELECT json_agg(row_to_json(x) ORDER BY audios_id) FROM "
        "(SELECT a.*, c.nome AS categoria FROM audios a LEFT JOIN categorias c ON c.categorias_id = a.id_categoria) x"
    )
    out = subprocess.run(
        ["docker", "exec", "psjb-postgres", "psql", "-U", "psjb", "-d", "psjb_cantos", "-Atc", sql],
        check=True, capture_output=True, text=True,
    ).stdout
    return json.loads(out)


def conferir(convertidos, revisados):
    """Compara o conversor com os cantos revisados à mão: mede se a regra está certa."""
    campos = ["number", "slug", "title", "composer", "key", "lyrics", "media"]
    iguais = {c: 0 for c in campos}
    diferentes = {c: [] for c in campos}
    for s in revisados:
        c = convertidos[s["id"]]
        for campo in campos:
            if c[campo] == s[campo]:
                iguais[campo] += 1
            else:
                diferentes[campo].append(s["id"])
    print(f"Conversor × {len(revisados)} cantos revisados:")
    for campo in campos:
        print(f"  {campo:10} {iguais[campo]:4} iguais   diferentes: {diferentes[campo][:12]}")
    return diferentes


def ordem(s):
    # Mesma ordem do arquivo: numerados pelo número, depois os sem número (salmos e aclamações) pelo título.
    return (s["number"] is None, s["number"] or 0, slugify(s["title"]))


def dump_categorias(cats) -> str:
    grupos = []
    for nome, itens in cats.items():
        linhas = ",\n".join("    { " + json.dumps(i, ensure_ascii=False)[1:-1] + " }" for i in itens)
        grupos.append(f'  "{nome}": [\n{linhas}\n  ]')
    return "{\n" + ",\n".join(grupos) + "\n}\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--conferir", action="store_true", help="só compara com os cantos já revisados")
    args = ap.parse_args()

    convertidos = {c["id"]: c for c in map(converter, legado())}
    revisados = json.loads(SONGS.read_text(encoding="utf8"))
    conferir(convertidos, revisados)
    if args.conferir:
        return

    # Revisados: a classificação (flags), o título, o slug e os links ficam. A letra passa a ser a do
    # conversor, que corrige defeitos da extração antiga (cabeçalho dentro da letra, <br> virando linha
    # em branco, acordes com ° ou 7+ marcados como refrão); o tom acompanha a letra.
    for s in revisados:
        c = convertidos[s["id"]]
        s["lyrics"], s["key"] = c["lyrics"], c["key"] or s["key"]
        s["composer"] = s["composer"] or c["composer"]

    ja = {s["id"] for s in revisados}
    novos = [c for i, c in convertidos.items() if i not in ja]
    for c in novos:
        if not c.pop("active"):
            print(f"  aviso: canto {c['id']} está inativo no legado", file=sys.stderr)
    todos = sorted(revisados + novos, key=ordem)

    # Número e slug são únicos no banco.
    for campo in ("number", "slug"):
        vistos = {}
        for s in todos:
            if s[campo] is not None and s[campo] in vistos:
                raise SystemExit(f"{campo} repetido: {s[campo]} (cantos {vistos[s[campo]]} e {s['id']})")
            vistos[s[campo]] = s["id"]

    cats = json.loads(CATEGORIES.read_text(encoding="utf8"))
    existentes = {t["id"] for t in cats["themes"]}
    cats["themes"] += [{"id": i, "label": l} for i, l in TEMAS_NOVOS if i not in existentes]
    usados = {t for s in todos for t in s["themes"]}
    faltando = usados - {t["id"] for t in cats["themes"]}
    if faltando:
        raise SystemExit(f"temas sem categoria: {faltando}")

    SONGS.write_text(json.dumps(todos, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    CATEGORIES.write_text(dump_categorias(cats), encoding="utf8")
    sem_letra = [s["id"] for s in novos if not s["lyrics"].strip()]
    sem_tom = [s["id"] for s in novos if not s["key"]]
    print(f"✔ {len(novos)} cantos novos ({len(todos)} no total) gravados em {SONGS.relative_to(RAIZ)}")
    print(f"  sem letra: {len(sem_letra)} {sem_letra[:20]}")
    print(f"  sem tom (letra sem acordes): {len(sem_tom)} {sem_tom[:20]}")


if __name__ == "__main__":
    main()
