"""
Completa a cifra das estrofes que vieram sem acordes do site antigo.

Em muitos cantos só a 1ª estrofe (e o refrão) tem cifra; as outras estrofes repetem a mesma melodia.
Aqui os acordes da 1ª estrofe são copiados, linha a linha, para as estrofes numeradas sem cifra:

1. cada linha é dividida em sílabas cantadas (heurística do português, com sinalefa: "mou a" vira uma sílaba);
2. as sílabas da linha modelo e da linha da estrofe são emparelhadas por programação dinâmica, casando
   **tônica com tônica** e **fim de frase com fim de frase** (antes de vírgula, ponto...), com sílabas
   sobrando onde as estrofes têm tamanhos diferentes;
3. cada acorde vai para a sílaba emparelhada, sobre a vogal (como na 1ª estrofe).

Só entra a estrofe que tem o mesmo número de linhas de letra da 1ª, e só se a 1ª estiver toda cifrada.
Não fica perfeito (a melodia real não está no texto): os cantos completados assim estão listados em
docs/REVISAO-CIFRAS.md para a equipe conferir ouvindo.
"""

import re

import alinhar_acordes

VOG = "aeiouáéíóúâêôãõàüy"
# Encontros que ficam juntos no começo da sílaba (pra-ti-car, fi-lho, a-qui).
GRUPOS = {"bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "vr", "ch", "lh", "nh", "qu", "gu"}
# Monossílabos e palavras que, na frase cantada, não levam acento.
ATONAS = {"o", "a", "os", "as", "e", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "me", "te", "se",
          "lhe", "vos", "que", "um", "uma", "por", "com", "sem", "pra", "pro", "ao", "à", "mas", "nem", "ou", "meu",
          "teu", "seu", "minha", "tua", "sua", "num", "numa", "pelo", "pela", "para", "lo", "la", "mais"}


def silabas_palavra(w: str):
    """Índice (dentro da palavra) do início de cada sílaba."""
    lw = w.lower()
    nucleos, k = [], 0
    while k < len(lw):
        if lw[k] in VOG:
            ini = k
            while k < len(lw) and lw[k] in VOG:
                k += 1
            nucleos.append([ini, k])
        else:
            k += 1
    # "qu"/"gu" + vogal: o u faz parte da consoante.
    for n in nucleos:
        if n[0] > 0 and lw[n[0]] == "u" and lw[n[0] - 1] in "qg" and n[1] - n[0] > 1:
            n[0] += 1
    # Hiato (vogal acentuada, "ae"/"eo"..., "ia"/"ua" no fim): separa o grupo vocálico.
    partes = []
    for ini, fim in nucleos:
        seg = lw[ini:fim]
        cortes = [ini]
        for j in range(1, len(seg)):
            a, b = seg[j - 1], seg[j]
            if b in "áéíóúâêô" or (a in "aeo" and b in "aeo") or (a in "iu" and b in "aeoáéó" and j == len(seg) - 1 and fim == len(lw)):
                cortes.append(ini + j)
        cortes.append(fim)
        partes += [[cortes[j], cortes[j + 1]] for j in range(len(cortes) - 1)]
    if not partes:
        return [0]
    inicios = [0]
    for (_, a1), (b0, _) in zip(partes, partes[1:]):
        meio = lw[a1:b0]
        if len(meio) <= 1:
            inicios.append(a1)
        elif meio[-2:] in GRUPOS:
            inicios.append(b0 - 2)
        else:
            inicios.append(b0 - 1)
    return inicios


def tonica_palavra(w: str):
    """Índice da sílaba tônica da palavra (None se for átona na frase)."""
    lw = w.lower()
    if lw in ATONAS:
        return None
    ini = silabas_palavra(w)
    n = len(ini)
    for j in range(n):
        fim = ini[j + 1] if j + 1 < n else len(lw)
        if re.search(r"[áéíóúâêôãõ]", lw[ini[j]:fim]):
            return j
    if n == 1:
        return 0
    # Paroxítonas: terminadas em a, e, o (com ou sem s), em, ens, am. O resto é oxítona.
    if re.search(r"([aeo]s?|em|ens|am)$", lw):
        return n - 2
    return n - 1


def silabas(texto: str):
    """Sílabas cantadas da linha: coluna, texto, se é tônica e se fecha uma frase."""
    sil = []
    for m in re.finditer(r"[A-Za-zÀ-ÿ]+", texto):
        w = m.group()
        ini = silabas_palavra(w)
        t = tonica_palavra(w)
        for j, i in enumerate(ini):
            fim = ini[j + 1] if j + 1 < len(ini) else len(w)
            sil.append({"col": m.start() + i, "txt": w[i:fim].lower(), "inicio_palavra": j == 0, "tonica": j == t})
    # Sinalefa: palavra que termina em vogal + palavra que começa por vogal = uma sílaba cantada.
    juntas = []
    for s in sil:
        if juntas and s["inicio_palavra"] and s["txt"][0] in VOG and juntas[-1]["txt"][-1] in VOG:
            juntas[-1] = {**juntas[-1], "txt": juntas[-1]["txt"] + "_" + s["txt"], "tonica": juntas[-1]["tonica"] or s["tonica"]}
            continue
        juntas.append(s)
    for j, s in enumerate(juntas):
        prox = juntas[j + 1]["col"] if j + 1 < len(juntas) else len(texto)
        s["fim_frase"] = bool(re.search(r"[,;.!?:]", texto[s["col"]:prox]))
    return juntas


def emparelhar(msil, tsil):
    """Emparelha as sílabas do modelo com as da estrofe: {índice no modelo: índice na estrofe}."""
    nm, nt = len(msil), len(tsil)
    inf = float("inf")
    custo = [[inf] * (nt + 1) for _ in range(nm + 1)]
    volta = [[None] * (nt + 1) for _ in range(nm + 1)]
    custo[0][0] = 0
    for i in range(nm + 1):
        for j in range(nt + 1):
            c = custo[i][j]
            if c == inf:
                continue
            if i < nm and j < nt:
                a, b = msil[i], tsil[j]
                d = (0 if a["tonica"] == b["tonica"] else 1) + (0 if a["fim_frase"] == b["fim_frase"] else 0.6)
                if c + d < custo[i + 1][j + 1]:
                    custo[i + 1][j + 1], volta[i + 1][j + 1] = c + d, (i, j, True)
            # Sílaba sobrando (no modelo ou na estrofe): mais barata se for átona.
            if i < nm and c + (1.2 if msil[i]["tonica"] else 0.8) < custo[i + 1][j]:
                custo[i + 1][j], volta[i + 1][j] = c + (1.2 if msil[i]["tonica"] else 0.8), (i, j, False)
            if j < nt and c + (1.2 if tsil[j]["tonica"] else 0.8) < custo[i][j + 1]:
                custo[i][j + 1], volta[i][j + 1] = c + (1.2 if tsil[j]["tonica"] else 0.8), (i, j, False)
    par, i, j = {}, nm, nt
    while volta[i][j]:
        pi, pj, casou = volta[i][j]
        if casou:
            par[pi] = pj
        i, j = pi, pj
    return par


def cifrar_linha(acordes_modelo: str, letra_modelo: str, letra: str) -> str:
    """Linha de acordes para `letra`, copiada da linha `letra_modelo` (com os acordes `acordes_modelo`)."""
    msil, tsil = silabas(letra_modelo), silabas(letra)
    par = emparelhar(msil, tsil)
    fim_modelo = len(letra_modelo.rstrip())
    saida = []
    for ini, tok in alinhar_acordes.tokens(acordes_modelo):
        if ini >= fim_modelo or not tsil:
            saida.append((len(letra.rstrip()) + max(0, ini - fim_modelo), tok))
            continue
        k = max([j for j, s in enumerate(msil) if s["col"] <= ini] or [0])
        while k < len(msil) and k not in par:  # sílaba do modelo sem par: usa a próxima que tem
            k += 1
        j = par.get(k, len(tsil) - 1)
        vogal = next((q for q, ch in enumerate(tsil[j]["txt"]) if ch in VOG), 0)
        saida.append((tsil[j]["col"] + vogal, tok))
    return alinhar_acordes._montar(saida)


def completar(letra: str, eh_linha_de_acordes):
    """Copia a cifra da 1ª estrofe para as estrofes numeradas sem acordes. Devolve (letra, linhas cifradas)."""
    L = letra.split("\n")

    def acordes(t):
        return bool(t.strip()) and eh_linha_de_acordes(t)

    # Estrofe: começa em "N." e vai até a próxima estrofe, o refrão (**) ou o fim.
    estrofes, atual = [], None
    for i, t in enumerate(L):
        if re.match(r"\s*\d+\.\s", t):
            atual = {"linhas": []}
            estrofes.append(atual)
        elif t.strip().startswith("**") or (acordes(t) and i + 1 < len(L) and L[i + 1].strip().startswith("**")):
            atual = None
        if atual is not None and t.strip() and not acordes(t):
            atual["linhas"].append(i)
    if len(estrofes) < 2:
        return letra, 0
    pares = [(L[i - 1], L[i]) for i in estrofes[0]["linhas"] if i > 0 and acordes(L[i - 1])]
    if not pares or len(pares) != len(estrofes[0]["linhas"]):
        return letra, 0  # a 1ª estrofe não está toda cifrada
    novas, brancas = {}, set()
    for e in estrofes[1:]:
        if any(i > 0 and acordes(L[i - 1]) for i in e["linhas"]) or len(e["linhas"]) != len(pares):
            continue
        for (ac, le), i in zip(pares, e["linhas"]):
            novas[i] = cifrar_linha(ac, le, L[i])
        # Linha em branco no meio da estrofe (sobra do editor antigo): sai, para ficar igual à 1ª.
        brancas.update(i for i in range(e["linhas"][0] + 1, e["linhas"][-1]) if not L[i].strip())
    out = []
    for i, t in enumerate(L):
        if i in brancas:
            continue
        if i in novas:
            out.append(novas[i])
        out.append(t)
    return "\n".join(out), len(novas)
