"""
Realinha as linhas de acordes do site antigo para a cifra monoespaçada do site novo.

No site antigo (e no Word de onde os cantos foram copiados), a cifra era digitada em **Times New Roman**,
com os acordes em negrito: os espaços alinhavam cada acorde à sílaba *nessa* fonte. Na fonte monoespaçada,
cada caractere tem a mesma largura e os acordes "andavam" (em média várias letras, às vezes palavras).

Para cada linha de acordes seguida de uma linha de letra, a coluna de cada acorde é recalculada assim:
1. **PDF da cifra** (quando o canto tem e a linha confere, mesma letra e mesmos acordes): a posição vem
   direto do PDF, que é a referência da equipe.
2. **Senão, pela largura da fonte:** mede onde o acorde começa na Times New Roman (negrito/itálico de cada
   caractere, como no HTML) e põe o acorde sobre a letra da letra que começa mais perto desse ponto.

Larguras: Liberation Serif, que tem as mesmas métricas da Times New Roman (pacote fonts-liberation).
Posições do PDF: `pdftotext -bbox` (poppler-utils). Medido contra os 13.780 acordes dos PDFs de cifra:
o alinhamento antigo acertava a letra exata em 8%; pela largura da fonte, 85% (93% com até 1 letra).
"""

import html
import re
import subprocess
import unicodedata
from functools import lru_cache
from pathlib import Path

FONTES_DIR = Path("/usr/share/fonts/truetype/liberation")
ESTILOS = {(False, False): "Regular", (True, False): "Bold", (False, True): "Italic", (True, True): "BoldItalic"}
# Acima do fim da letra, cada coluna da cifra vale uma "letra média" da Times (~0,5 em).
LETRA_MEDIA_EM = 0.5


@lru_cache(maxsize=None)
def _fonte(negrito: bool, italico: bool):
    from PIL import ImageFont  # Pillow só é preciso para converter

    return ImageFont.truetype(str(FONTES_DIR / f"LiberationSerif-{ESTILOS[(negrito, italico)]}.ttf"), 1000)


@lru_cache(maxsize=None)
def largura(ch: str, negrito: bool, italico: bool) -> float:
    """Largura do caractere em em (1 em = corpo da fonte)."""
    return _fonte(negrito, italico).getlength(ch) / 1000


def posicoes(chars):
    """chars = [(ch, negrito, itálico)] → (início x de cada caractere, fim da linha), em em."""
    x, pos = 0.0, []
    for ch, b, i in chars:
        pos.append(x)
        x += largura(ch, b, i)
    return pos, x


def tokens(texto: str):
    return [(m.start(), m.group()) for m in re.finditer(r"\S+", texto)]


def _montar(colunas_tokens):
    """[(coluna desejada, acorde)] → linha, com pelo menos um espaço entre acordes."""
    linha, minimo = "", 0
    for col, tok in colunas_tokens:
        col = max(col, minimo)
        linha = linha.ljust(col) + tok
        minimo = col + len(tok) + 1
    return linha


def por_fonte(acordes_chars, letra_chars) -> str:
    """Realinha pela largura da Times New Roman."""
    texto = "".join(c for c, _, _ in acordes_chars)
    pa, _ = posicoes(acordes_chars)
    pl, fim = posicoes(letra_chars)
    n = len("".join(c for c, _, _ in letra_chars).rstrip())
    saida = []
    for ini, tok in tokens(texto):
        x0 = pa[ini]
        if n == 0 or x0 >= fim:
            col = n + max(1, round((x0 - fim) / LETRA_MEDIA_EM)) if n else round(x0 / LETRA_MEDIA_EM)
        else:
            col = min(range(n), key=lambda k: abs(pl[k] - x0))
        saida.append((col, tok))
    return _montar(saida)


# ---------- PDF da cifra ----------

def _norm(palavra: str) -> str:
    return unicodedata.normalize("NFC", palavra).strip(".,;:!?/()\"'“”").lower()


def linhas_pdf(caminho: Path):
    """Palavras do PDF agrupadas por linha: [[(x0, x1, palavra)]]."""
    try:
        out = subprocess.run(["pdftotext", "-bbox", str(caminho), "-"], capture_output=True, text=True, timeout=60).stdout
    except (OSError, subprocess.SubprocessError):
        return []
    palavras = []
    # Cada página recomeça o y: a ordem do arquivo (página a página) é mantida.
    for pagina, conteudo in enumerate(re.split(r"<page\b", out)):
        for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="[\d.]+">(.*?)</word>', conteudo):
            palavras.append((pagina, float(m.group(2)), float(m.group(1)), float(m.group(3)), html.unescape(m.group(4))))
    linhas = []
    for pagina, y, x0, x1, w in sorted(palavras):
        if linhas and linhas[-1][0] == pagina and abs(linhas[-1][1] - y) < 2:
            linhas[-1][2].append((x0, x1, w))
        else:
            linhas.append((pagina, y, [(x0, x1, w)]))
    return [sorted(ws) for _, _, ws in linhas]


def pares_pdf(caminho: Path, eh_acorde, eh_linha_de_acordes):
    """Pares (linha de acordes, linha de letra) do PDF, na ordem."""
    linhas = linhas_pdf(caminho)
    pares = []
    for k in range(len(linhas) - 1):
        if eh_linha_de_acordes(" ".join(w for _, _, w in linhas[k])) and not eh_linha_de_acordes(" ".join(w for _, _, w in linhas[k + 1])):
            pares.append((linhas[k], linhas[k + 1]))
    return pares


def por_pdf(par, acordes_texto: str, letra_texto: str):
    """Realinha pelo PDF, se a linha conferir (mesmos acordes e mesma letra). Senão, None."""
    acs, let = par
    if [w for _, _, w in acs] != [t for _, t in tokens(acordes_texto)]:
        return None
    toks = tokens(letra_texto)
    if [_norm(w) for _, _, w in let] != [_norm(t) for _, t in toks]:
        return None
    # Início de cada letra no PDF: a caixa da palavra repartida pelas larguras da Times.
    letras = []
    for wi, (x0, x1, w) in enumerate(let):
        larg = [largura(c, False, False) for c in w]
        total = sum(larg) or 1
        x = x0
        for k, c in enumerate(w):
            letras.append((x, toks[wi][0] + k))
            x += larg[k] / total * (x1 - x0)
    fim_x = let[-1][1]
    n = len(letra_texto.rstrip())
    media = (fim_x - let[0][0]) / max(1, len(" ".join(w for _, _, w in let)))
    saida = []
    for x0, _, tok in acs:
        if x0 >= fim_x:
            col = n + max(1, round((x0 - fim_x) / media))
        else:
            col = min(letras, key=lambda e: abs(e[0] - x0))[1]
        saida.append((col, tok))
    return _montar(saida)


def _chave(texto: str):
    return [_norm(t) for t in texto.split()]


def realinhar(linhas, eh_acorde, eh_linha_de_acordes, pdf: Path | None = None):
    """
    linhas = [(texto, chars)] na ordem da letra (chars = [(ch, negrito, itálico)]; None em linha vazia).
    Devolve os textos, com cada linha de acordes seguida de letra realinhada, e quantas vieram do PDF.
    """
    pares = pares_pdf(pdf, eh_acorde, eh_linha_de_acordes) if pdf and pdf.exists() else []
    proximo_par = 0
    saida, do_pdf = [], 0
    for k, (texto, chars) in enumerate(linhas):
        if not (chars and eh_linha_de_acordes(texto) and k + 1 < len(linhas)):
            saida.append(texto)
            continue
        letra_texto, letra_chars = linhas[k + 1]
        if not letra_chars or not letra_texto.strip() or eh_linha_de_acordes(letra_texto):
            saida.append(texto)
            continue
        novo = None
        # Procura no PDF, a partir do último par usado, a mesma letra (linhas iguais são consumidas na ordem).
        for j in range(proximo_par, len(pares)):
            if [_norm(w) for _, _, w in pares[j][1]] == _chave(letra_texto):
                novo = por_pdf(pares[j], texto, letra_texto)
                if novo is not None:
                    proximo_par = j + 1
                    do_pdf += 1
                break
        saida.append(novo if novo is not None else por_fonte(chars, letra_chars))
    return saida, do_pdf
