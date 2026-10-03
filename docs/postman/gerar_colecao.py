# Gera a coleção do Postman (psjb-cantos.postman_collection.json) e os ambientes.
# Para mudar a coleção, edite este arquivo e rode: python3 docs/postman/gerar_colecao.py
# O teste apps/api/test/http/postman.test.ts falha se alguma rota da API não estiver aqui.

import json, uuid

def ex(lines): return [{"listen": "test", "script": {"type": "text/javascript", "exec": lines}}]
def pre(lines): return [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": lines}}]

SONG_BODY = """{
  "number": null,
  "title": "Canto de teste {{$timestamp}}",
  "composer": "Autor de Exemplo",
  "key": "D",
  "lyrics": "D          A\\nSenhor, tende piedade\\n**Cristo, tende piedade**",
  "flagIds": [{{flagId}}],
  "media": { "audiomack": null, "audio": null, "cifraPdf": null, "partituraPdf": null },
  "active": true
}"""
SONG_BODY_PUT = """{
  "title": "Canto de teste (editado)",
  "composer": "Autor de Exemplo",
  "key": "E",
  "lyrics": "E          B\\nSenhor, tende piedade",
  "flagIds": [{{flagId}}]
}"""
RAW_BODIES = {"SONG_BODY": SONG_BODY, "SONG_BODY_PUT": SONG_BODY_PUT}

def req(name, method, path, body=None, desc="", auth=None, tests=None, prereq=None, query=None, formdata=None):
    segs = [p for p in path.strip("/").split("/")]
    url = {"raw": "{{baseUrl}}/" + "/".join(segs) + ("?" + "&".join(f"{k}={v}" for k, v, *_ in query) if query else ""),
           "host": ["{{baseUrl}}"], "path": segs}
    if query:
        url["query"] = [{"key": k, "value": v, "description": d[0] if d else "", **({"disabled": True} if len(d) > 1 and d[1] else {})} for k, v, *d in query]
    r = {"method": method, "header": [], "url": url, "description": desc}
    if body is not None:
        raw = RAW_BODIES[body] if isinstance(body, str) else json.dumps(body, ensure_ascii=False, indent=2)
        r["body"] = {"mode": "raw", "raw": raw, "options": {"raw": {"language": "json"}}}
    if formdata:
        r["body"] = {"mode": "formdata", "formdata": formdata}
    if auth == "none": r["auth"] = {"type": "noauth"}
    elif auth: r["auth"] = {"type": "bearer", "bearer": [{"key": "token", "value": auth, "type": "string"}]}
    item = {"name": name, "request": r, "event": []}
    if prereq: item["event"] += pre(prereq)
    item["event"] += ex(["pm.test('status ' + pm.response.code, () => pm.expect(pm.response.code).to.be.below(400));"] + (tests or []))
    return item

def folder(name, desc, items): return {"name": name, "description": desc, "item": items}

SAVE_TOKEN = lambda var: [
    "const j = pm.response.json();",
    f"if (j.accessToken) pm.collectionVariables.set('{var}', j.accessToken);",
]

MASS_BODY = {
    "name": "Domingo — Missa das 19h", "date": "2026-10-11", "time": "19:00", "season": "tempo-comum", "year": "A",
    "slots": [
        {"id": "s1", "moment": "entrada", "label": "Entrada", "items": [{"songId": 77, "transpose": 0}]},
        {"id": "s2", "moment": "ato-penitencial", "label": "Ato Penitencial", "items": [{"songId": 141, "transpose": 0}]},
        {"id": "s3", "moment": "salmo", "label": "Salmo", "items": [{"songId": 214, "transpose": 0}]},
        {"id": "s4", "moment": "comunhao", "label": "Comunhão", "items": [{"songId": 382, "transpose": -2}]},
        {"id": "s5", "moment": "extra", "label": "Ação de graças", "items": []},
    ],
}

items = [  # na ordem em que faz sentido rodar
    folder("Saúde", "Conferir se a API está no ar.", [
        req("Health", "GET", "/health", auth="none", desc="Responde `ok`."),
        req("Teste", "GET", "/test", auth="none", desc="Rota de teste: responde uma frase."),
    ]),
    folder("Autenticação", "Rode **Login (superadmin)** primeiro: ele guarda o `accessToken` na coleção, e as outras requisições usam esse token. O refresh token fica no cookie `psjb_refresh` (o Postman guarda sozinho).", [
        req("Login (superadmin)", "POST", "/auth/login", {"email": "{{adminEmail}}", "password": "{{adminPassword}}", "remember": True}, auth="none",
            desc="Devolve `accessToken` (15 min) e grava o cookie `psjb_refresh`. Erros: 401 INVALID_CREDENTIALS, 403 ACCOUNT_PENDING, 403 ACCOUNT_BLOCKED.",
            tests=SAVE_TOKEN("accessToken")),
        req("Refresh", "POST", "/auth/refresh", auth="none",
            desc="Troca o cookie por um access token novo e **rotaciona** o cookie. Reusar um cookie antigo derruba todas as sessões daquele login.",
            tests=SAVE_TOKEN("accessToken")),
        req("Logout", "POST", "/auth/logout", auth="none", desc="Revoga a sessão do cookie e apaga o cookie. 204."),
    ]),
    folder("Movimentos", "Movimentos e pastorais. Cada pessoa participa de no máximo um.", [
        req("Listar (público)", "GET", "/movements", auth="none", desc="Usado no cadastro. Guarda o primeiro id em `movementId`.",
            tests=["const m = pm.response.json().movements; if (m.length) pm.collectionVariables.set('movementId', m[0].id);"]),
        req("Criar (admin)", "POST", "/admin/movements", {"name": "Pastoral do Batismo {{$timestamp}}"},
            desc="Só admin. 409 MOVEMENT_TAKEN se o nome já existe (sem diferenciar maiúsculas).",
            tests=["pm.collectionVariables.set('newMovementId', pm.response.json().movement.id);"]),
        req("Renomear (admin)", "PATCH", "/admin/movements/{{newMovementId}}", {"name": "Pastoral do Batismo e Crisma {{$timestamp}}"}, desc="Só admin."),
        req("Excluir (admin)", "DELETE", "/admin/movements/{{newMovementId}}",
            desc="Só admin. 409 MOVEMENT_IN_USE se houver pessoas no movimento."),
    ]),
    folder("Usuários", "Cadastro público e dados da própria conta.", [
        req("Cadastro", "POST", "/users",
            {"name": "Músico de Teste", "email": "{{newUserEmail}}", "password": "{{newUserPassword}}", "phone": "(31) 99999-0000", "movementId": "{{movementId}}"},
            auth="none",
            desc="Cria a conta **pendente**, com papel músico. Ela só entra depois que um admin ativar. `phone` e `movementId` são opcionais (use **Movimentos › Listar** para ver os ids). 409 EMAIL_TAKEN se o e-mail já existe.",
            prereq=[
                "// E-mail novo a cada execução, para não bater no 409.",
                "pm.collectionVariables.set('newUserEmail', `musico+${Date.now()}@exemplo.com`);",
            ],
            tests=["pm.collectionVariables.set('userId', pm.response.json().user.id);"]),
        req("Eu (/me)", "GET", "/me", desc="Dados da pessoa logada."),
        req("Trocar foto", "PUT", "/me/photo",
            formdata=[{"key": "photo", "type": "file", "src": "foto-exemplo.png", "description": "JPG, PNG ou WebP de até 2 MB"}],
            desc="multipart/form-data com o campo `photo`. Já aponta para `foto-exemplo.png` (nesta pasta); no Postman, escolha o arquivo de novo na aba Body se ele não achar. Em produção vai para o Vercel Blob; local, para `apps/api/uploads/`."),
        req("Buscar pessoas (para compartilhar)", "GET", "/users/search",
            query=[("q", "", "Nome, e-mail ou movimento. Vazio = todas"), ("limit", "20", "1 a 50")],
            desc="Só contas ativas e sem a própria pessoa. Use os ids em **Missas › Compartilhar**."),
    ]),
    folder("Admin › Usuários", "Só o papel **admin** (músico recebe 403).", [
        req("Listar usuários", "GET", "/admin/users",
            query=[("status", "pending", "pending | active | blocked", True), ("role", "musico", "admin | musico", True), ("q", "", "nome, e-mail ou movimento", True)],
            desc="Pendentes primeiro, depois bloqueados e ativos."),
        req("Ativar usuário", "PATCH", "/admin/users/{{userId}}/activate", desc="Libera a conta pendente (ou desbloqueia). `userId` vem do **Cadastro**."),
        req("Login como a pessoa ativada", "POST", "/auth/login", {"email": "{{newUserEmail}}", "password": "{{newUserPassword}}", "remember": False}, auth="none",
            desc="Entra com a conta criada em **Usuários › Cadastro**, já ativada no passo anterior. Guarda o token em `memberToken`, usado nas requisições de convidado.",
            tests=SAVE_TOKEN("memberToken")),
    ]),
    folder("Repertório (público)", "Cantos ativos e flags, sem login.", [
        req("Listar cantos", "GET", "/songs", auth="none",
            query=[("q", "", "título, autor, letra ou número (sem acento)"),
                   ("flags", "", "ids de flags separados por vírgula: OU no mesmo grupo, E entre grupos", True),
                   ("page", "1", ""), ("pageSize", "50", "1 a 200"), ("full", "1", "1 = traz a letra (usado pelo build do site)", True)],
            desc="Resposta: `{ songs, total, page, pageSize }`. A letra não vem na listagem."),
        req("Ver canto (por slug ou id)", "GET", "/songs/001-a-feliz-espera", auth="none",
            desc="Aceita o slug (`001-a-feliz-espera`) ou o id (`39`). Traz a letra com cifra e as flags."),
        req("Listar flags", "GET", "/flags", auth="none",
            desc="Em ordem: momento, tempo, ano, tema, outro. Guarda o primeiro id em `flagId` (usado ao criar o canto).",
            tests=["const f = pm.response.json().flags; if (f.length) pm.collectionVariables.set('flagId', f[0].id);"]),
    ]),
    folder("Admin › Flags", "Etiquetas dos cantos (só admin). Grupos: `momento`, `tempo`, `ano`, `tema`, `outro`. Um canto pode ter várias flags, inclusive do mesmo grupo.", [
        req("Criar flag", "POST", "/admin/flags", {"group": "outro", "slug": "teste-{{$timestamp}}", "name": "Flag de teste", "color": None, "position": 99},
            desc="`slug` é o identificador (letras, números e hífens; único dentro do grupo). `color` em #RRGGBB, opcional. 409 FLAG_TAKEN se repetir.",
            tests=["pm.collectionVariables.set('newFlagId', pm.response.json().flag.id);"]),
        req("Editar flag", "PUT", "/admin/flags/{{newFlagId}}", {"group": "outro", "slug": "teste-editada-{{$timestamp}}", "name": "Flag de teste (editada)", "color": "#2E7D4F", "position": 99},
            desc="Manda a flag inteira."),
        req("Excluir flag", "DELETE", "/admin/flags/{{newFlagId}}", desc="Tira a etiqueta dos cantos (os cantos continuam). 204."),
    ]),
    folder("Admin › Cantos", "CRUD de cantos (só admin). Arquivos: PDF da cifra, PDF da partitura e áudio, até 4 MB cada (limite das Functions da Vercel).", [
        req("Listar cantos (inclui ocultos)", "GET", "/admin/songs", query=[("q", "", ""), ("page", "1", ""), ("pageSize", "50", "")]),
        req("Criar canto", "POST", "/admin/songs", "SONG_BODY",
            desc="Só `title` é obrigatório. Sem `slug`, ele é gerado do número + título (`012-...`). `flagIds`: várias flags. `media` aceita links externos (Audiomack, site antigo). O refrão vai entre `**…**`.",
            tests=["pm.collectionVariables.set('songId', pm.response.json().song.id);"]),
        req("Ver canto", "GET", "/admin/songs/{{songId}}", desc="Também mostra cantos ocultos."),
        req("Editar canto (PUT, substitui tudo)", "PUT", "/admin/songs/{{songId}}", "SONG_BODY_PUT",
            desc="O que não vier volta ao padrão (sem flags, sem mídia...). O slug fica o mesmo se não for enviado."),
        req("Atualizar canto (PATCH)", "PATCH", "/admin/songs/{{songId}}", {"key": "A", "media": {"audiomack": "https://audiomack.com/embed/song/hinariopsjb/exemplo"}},
            desc="Só os campos enviados mudam; `media` pode vir parcial. Use `{ \"active\": false }` para ocultar do repertório."),
        req("Enviar PDF da cifra", "PUT", "/admin/songs/{{songId}}/files/cifra-pdf",
            formdata=[{"key": "file", "type": "file", "src": "cifra-exemplo.pdf"}],
            desc="multipart, campo `file`. O tipo é conferido pelos bytes (precisa ser PDF). Troca e apaga o arquivo anterior."),
        req("Enviar PDF da partitura", "PUT", "/admin/songs/{{songId}}/files/partitura-pdf",
            formdata=[{"key": "file", "type": "file", "src": "cifra-exemplo.pdf"}]),
        req("Enviar áudio", "PUT", "/admin/songs/{{songId}}/files/audio",
            formdata=[{"key": "file", "type": "file", "src": "audio-exemplo.mp3"}], desc="MP3, M4A ou OGG."),
        req("Remover áudio", "DELETE", "/admin/songs/{{songId}}/files/audio", desc="`kind`: cifra-pdf, partitura-pdf ou audio."),
        req("Publicar no site", "POST", "/admin/site/publish",
            desc="Pede um novo build do site (Deploy Hook da Vercel em SITE_DEPLOY_HOOK_URL) para cantos e flags alterados aparecerem nas páginas. 202 = pedido aceito; 501 NOT_CONFIGURED se o hook não estiver configurado (normal no ambiente local).",
            tests=["pm.test('202 ou 501 (sem hook local)', () => pm.expect([202, 501]).to.include(pm.response.code));"]),
        req("Excluir canto", "DELETE", "/admin/songs/{{songId}}",
            desc="409 SONG_IN_USE se o canto estiver em alguma missa: nesse caso, oculte com `active: false`."),
    ]),
    folder("Missas", "Monte sua Missa. Dono e convidados veem e editam; **só o dono** exclui e compartilha. Quem não é dono nem convidado recebe 403.", [
        req("Listar minhas missas", "GET", "/masses",
            query=[("when", "upcoming", "upcoming | past | all (padrão)"), ("q", "", "busca no nome", True)],
            desc="Missas criadas por mim ou compartilhadas comigo. `access` diz se sou `owner` ou `shared`."),
        req("Criar missa", "POST", "/masses", MASS_BODY,
            desc="Todos os campos são opcionais. `slots` são os momentos em ordem; `moment: \"extra\"` é canto adicional com nome livre. `transpose` vai de −6 a +5. `songId` é o id do canto em `data/songs.json`.",
            tests=["pm.collectionVariables.set('massId', pm.response.json().mass.id);"]),
        req("Ver missa", "GET", "/masses/{{massId}}"),
        req("Editar missa (PUT, substitui tudo)", "PUT", "/masses/{{massId}}", {**MASS_BODY, "name": "Domingo — Missa das 19h (revisada)"},
            desc="Manda a missa inteira. O que não vier volta ao padrão (`slots: []`, `date: null`...). É o que o editor usa no salvamento automático."),
        req("Atualizar missa (PATCH, só o que mudou)", "PATCH", "/masses/{{massId}}", {"time": "18:00", "slots": MASS_BODY["slots"][:2]},
            desc="Só os campos enviados mudam. Precisa de pelo menos um campo."),
        req("Duplicar missa", "POST", "/masses/{{massId}}/duplicate",
            desc="A cópia é de quem duplicou: \"Cópia de …\", sem data e sem compartilhamento.",
            tests=["pm.collectionVariables.set('copyMassId', pm.response.json().mass.id);"]),
        req("Compartilhar missa", "PUT", "/masses/{{massId}}/shares", {"userIds": ["{{userId}}"]},
            desc="Substitui a lista de convidados (mande `[]` para tirar todos). Só o dono. Só contas **ativas** (400 com `invalidUserIds`); o próprio dono é ignorado."),
        req("Convidado: ver missa", "GET", "/masses/{{massId}}", auth="{{memberToken}}",
            desc="Com o token de **Login (pessoa cadastrada)**. `access` = `shared`."),
        req("Convidado: tentar excluir (403)", "DELETE", "/masses/{{massId}}", auth="{{memberToken}}",
            desc="Convidado não exclui: deve dar 403.",
            tests=["pm.test('convidado não exclui', () => pm.response.to.have.status(403));"]),
        req("Convidado: sair da missa", "DELETE", "/masses/{{massId}}/shares/me", auth="{{memberToken}}",
            desc="Quem recebeu sai; a missa continua para o dono. O dono recebe 403 aqui."),
        req("Gerar link de convite", "POST", "/masses/{{massId}}/share-link",
            desc="Só o dono. Devolve `{ token, path }`; o link completo é o domínio do site + `path` (ex.: `https://…/convite?token=…`). Chamar de novo devolve o **mesmo** link.",
            tests=["pm.collectionVariables.set('shareToken', pm.response.json().token);"]),
        req("Convidado: entrar pelo link", "POST", "/masses/join", {"token": "{{shareToken}}"}, auth="{{memberToken}}",
            desc="O que o site faz quando alguém abre o link já logado: a pessoa vira convidada. Se já era (ou é a dona), só devolve a missa. 404 se o link foi desativado."),
        req("Desativar link de convite", "DELETE", "/masses/{{massId}}/share-link",
            desc="Só o dono. O link para de funcionar; quem já entrou continua convidado. Gerar de novo cria outro token."),
        req("Excluir missa", "DELETE", "/masses/{{massId}}", desc="Só o dono. 204."),
        req("Excluir cópia", "DELETE", "/masses/{{copyMassId}}", desc="Limpa a cópia criada em **Duplicar missa**."),
    ]),
]

# O teste genérico de status não vale para quem espera 403.
for f in items:
    for it in f["item"]:
        if "(403)" in it["name"] or it["name"] == "Publicar no site":
            it["event"][-1]["script"]["exec"] = it["event"][-1]["script"]["exec"][1:]

collection = {
    "info": {
        "_postman_id": str(uuid.uuid5(uuid.NAMESPACE_URL, "psjb-cantos-api")),
        "name": "Cantos PSJB — API",
        "description": "API do site de cantos da Paróquia Catedral São João Batista (`apps/api`).\n\n"
                       "**Como usar:** importe também `psjb-local.postman_environment.json`, rode **Autenticação › Login (superadmin)** e siga as pastas na ordem "
                       "(ou rode a coleção inteira no Runner). Pela linha de comando: `npx newman run docs/postman/psjb-cantos.postman_collection.json -e docs/postman/psjb-local.postman_environment.json --working-dir docs/postman`. "
                       "Erros vêm sempre como `{ error: { code, message, details } }`.\n\n"
                       "**Manter atualizado:** toda rota nova da API entra aqui. O teste `apps/api/test/postman.test.ts` falha se faltar alguma.",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    "auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{accessToken}}", "type": "string"}]},
    "item": items,
    "variable": [
        {"key": "accessToken", "value": ""},
        {"key": "memberToken", "value": ""},
        {"key": "userId", "value": ""},
        {"key": "movementId", "value": ""},
        {"key": "newMovementId", "value": ""},
        {"key": "massId", "value": ""},
        {"key": "copyMassId", "value": ""},
        {"key": "shareToken", "value": ""},
        {"key": "flagId", "value": ""},
        {"key": "newFlagId", "value": ""},
        {"key": "songId", "value": ""},
        {"key": "newUserEmail", "value": ""},
        {"key": "newUserPassword", "value": "senha1234"},
    ],
}

env = lambda name, base, email, pwd: {
    "id": str(uuid.uuid5(uuid.NAMESPACE_URL, name)), "name": name,
    "values": [
        {"key": "baseUrl", "value": base, "type": "default", "enabled": True},
        {"key": "adminEmail", "value": email, "type": "default", "enabled": True},
        {"key": "adminPassword", "value": pwd, "type": "secret", "enabled": True},
    ],
    "_postman_variable_scope": "environment",
}

import os
out = os.path.dirname(os.path.abspath(__file__)) + "/"
json.dump(collection, open(out + "psjb-cantos.postman_collection.json", "w"), ensure_ascii=False, indent=2)
json.dump(env("PSJB — Local", "http://localhost:3333/api", "superadmin@psjb.org.br", "123456"), open(out + "psjb-local.postman_environment.json", "w"), ensure_ascii=False, indent=2)
json.dump(env("PSJB — Produção", "https://SEU-PROJETO-API.vercel.app/api", "superadmin@psjb.org.br", ""), open(out + "psjb-producao.postman_environment.json", "w"), ensure_ascii=False, indent=2)
print(sum(len(f["item"]) for f in items), "requisições")
