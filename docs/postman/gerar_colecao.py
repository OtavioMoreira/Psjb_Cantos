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

def req(name, method, path, body=None, desc="", auth=None, tests=None, prereq=None, query=None, formdata=None, status=None):
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
    # status: resposta esperada quando a requisição de exemplo não tem como dar certo sozinha (ex.: token que só chega por e-mail).
    if isinstance(status, tuple):
        check = f"pm.test('status {' ou '.join(map(str, status))}', () => pm.expect(pm.response.code).to.be.oneOf({list(status)}));"
    elif status:
        check = f"pm.test('status {status}', () => pm.expect(pm.response.code).to.equal({status}));"
    else:
        check = "pm.test('status ' + pm.response.code, () => pm.expect(pm.response.code).to.be.below(400));"
    item["event"] += ex([check] + (tests or []))
    return item

def folder(name, desc, items): return {"name": name, "description": desc, "item": items}

SAVE_TOKEN = lambda var: [
    "const j = pm.response.json();",
    f"if (j.accessToken) pm.collectionVariables.set('{var}', j.accessToken);",
    "// Com o 2FA ligado (produção), vem o desafio: copie o código do e-mail em loginCode e rode **Login: confirmar código**.",
    "if (j.challengeId) pm.collectionVariables.set('challengeId', j.challengeId);",
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
            desc="Devolve `accessToken` (15 min) e grava o cookie `psjb_refresh`. Erros: 401 INVALID_CREDENTIALS, 403 ACCOUNT_PENDING, 403 ACCOUNT_BLOCKED.\n\n**Com o 2FA ligado** (`LOGIN_2FA=true`, padrão em produção) e sem o cookie `psjb_device`, a resposta é `{ twoFactor: true, challengeId, emailHint, expiresIn }` e o código de 6 dígitos vai por e-mail: continue em **Login: confirmar código**. 502 EMAIL_FAILED se o código não saiu.",
            tests=SAVE_TOKEN("accessToken")),
        req("Login: confirmar código (2FA)", "POST", "/auth/login/verify", {"challengeId": "{{challengeId}}", "code": "{{loginCode}}", "trustDevice": True}, auth="none", status=400,
            desc="Segunda etapa do login. `code`: os 6 dígitos do e-mail (10 min; 5 tentativas). `trustDevice: true` grava o cookie `psjb_device` (30 dias) e os próximos logins deste aparelho não pedem código. Resposta igual à do login. 400 INVALID_CODE (com `attemptsLeft`) ou INVALID_TOKEN (vencido, usado ou tentativas esgotadas). Localmente o 2FA vem desligado, então esta requisição de exemplo espera 400.",
            tests=SAVE_TOKEN("accessToken")),
        req("Login: reenviar código (2FA)", "POST", "/auth/login/resend", {"challengeId": "{{challengeId}}"}, auth="none", status=400,
            desc="Manda um código novo (o anterior deixa de valer) e devolve um `challengeId` novo. Só 60 s depois do último (429 TOO_SOON, com `retryAfter`). Localmente o 2FA vem desligado, então esta requisição de exemplo espera 400.",
            tests=["const j = pm.response.json(); if (j.challengeId) pm.collectionVariables.set('challengeId', j.challengeId);"]),
        req("Refresh", "POST", "/auth/refresh", auth="none",
            desc="Troca o cookie por um access token novo e **rotaciona** o cookie. Reusar um cookie antigo derruba todas as sessões daquele login.",
            tests=SAVE_TOKEN("accessToken")),
        req("Logout", "POST", "/auth/logout", auth="none", desc="Revoga a sessão do cookie e apaga o cookie. 204."),
        req("Esqueci a senha", "POST", "/auth/forgot", {"email": "{{adminEmail}}"}, auth="none",
            desc="Sempre 202 `{ ok: true }`, exista ou não a conta (não revela quais e-mails estão cadastrados). Só conta **ativa** recebe o link, que vale 1 h; pedir de novo antes de 60 s não envia outro. Sem `RESEND_API_KEY`, o e-mail aparece no terminal da API."),
        req("Redefinir a senha (token do e-mail)", "POST", "/auth/reset", {"token": "{{resetToken}}", "password": "novaSenha123"}, auth="none", status=400,
            desc="Cole em `resetToken` o token do link recebido (`/redefinir-senha?token=…`). Também serve para o link de **convite** (ativa a conta pendente). Uso único; derruba as sessões abertas. Resposta: `{ email }`. Sem um token válido, 400 INVALID_TOKEN (é o que esta requisição de exemplo espera)."),
        req("Confirmar troca de e-mail", "POST", "/auth/confirm-email", {"token": "{{resetToken}}"}, auth="none", status=400,
            desc="Token do link `/confirmar-email?token=…` enviado ao novo endereço. Pública: o link pode ser aberto em outro aparelho. Resposta: `{ email }` (o novo). 409 EMAIL_TAKEN se outra conta pegou o endereço nesse meio-tempo. Sem um token válido, 400 INVALID_TOKEN (é o que esta requisição de exemplo espera)."),
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
        req("Editar meu perfil", "PATCH", "/me", {"parish": "Paróquia Catedral São João Batista", "instrument": "Violão"},
            desc="Só os campos enviados mudam: `name`, `phone`, `movementId`, `parish`, `instrument` (vazio ou null limpa). E-mail, papel e status não são aceitos aqui (400)."),
        req("Trocar meu e-mail", "POST", "/me/email", {"email": "novo+{{$timestamp}}@exemplo.com", "password": "{{adminPassword}}"},
            status=(202, 429),
            desc="Exige a senha. Manda um link (24 h) para o **novo** endereço; o e-mail só muda depois de confirmar (**Autenticação › Confirmar troca de e-mail**), e o antigo recebe um aviso. 400 com `fields.password` ou `fields.email`; 429 TOO_SOON se pediu há menos de 60 s; 502 EMAIL_FAILED se o e-mail não saiu. 202."),
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
        req("Convidar", "POST", "/admin/users/invite", {"name": "Convidado de Teste", "email": "{{inviteEmail}}", "roles": ["musico"], "movementId": None},
            desc="Cria a conta **pendente** e manda o convite por e-mail: link de 7 dias para criar a senha (`/redefinir-senha?token=…&convite=1`). Ao criar a senha (**Autenticação › Redefinir a senha**), a conta fica ativa. `roles` padrão: `[\"musico\"]`. 409 EMAIL_TAKEN; 502 EMAIL_FAILED se o e-mail não saiu (a conta fica criada; use **Reenviar convite**).",
            prereq=["pm.collectionVariables.set('inviteEmail', `convidado+${Date.now()}@exemplo.com`);"],
            tests=["pm.collectionVariables.set('invitedUserId', pm.response.json().user.id);"]),
        req("Reenviar convite", "POST", "/admin/users/{{invitedUserId}}/invite",
            desc="Manda um convite novo; o link anterior deixa de valer. Só para conta pendente (400 nas outras). 202."),
        req("Ativar usuário", "PATCH", "/admin/users/{{userId}}/activate", desc="Libera a conta pendente (ou desbloqueia). `userId` vem do **Cadastro**."),
        req("Login como a pessoa ativada", "POST", "/auth/login", {"email": "{{newUserEmail}}", "password": "{{newUserPassword}}", "remember": False}, auth="none",
            desc="Entra com a conta criada em **Usuários › Cadastro**, já ativada no passo anterior. Guarda o token em `memberToken`, usado nas requisições de convidado.",
            tests=SAVE_TOKEN("memberToken")),
        req("Enviar link de redefinição", "POST", "/admin/users/{{userId}}/reset-link",
            desc="Manda à pessoa o link para criar uma senha nova (1 h). Só conta ativa (400 nas outras). 202; 502 EMAIL_FAILED se o e-mail não saiu (alternativa: senha temporária)."),
        req("Editar usuário", "PATCH", "/admin/users/{{userId}}", {"name": "Músico de Teste (editado)", "movementId": "{{movementId}}", "roles": ["musico"]},
            desc="Só os campos enviados mudam: `name`, `email`, `phone`, `movementId`, `roles` (substitui a lista). O admin não tira o próprio papel de admin (403) e sempre sobra um admin ativo (409 LAST_ADMIN). 409 EMAIL_TAKEN se o e-mail é de outra conta."),
        req("Trocar a própria senha (pessoa ativada)", "POST", "/auth/password", {"currentPassword": "{{newUserPassword}}", "newPassword": "outraSenha123"}, auth="{{memberToken}}",
            desc="Exige a senha atual. Fica em `/auth` para receber o cookie: a sessão deste aparelho continua e as dos outros aparelhos caem. 400 com `fields.currentPassword` se a senha atual não confere.",
            tests=["pm.collectionVariables.set('newUserPassword', 'outraSenha123');"]),
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
    folder("Admin › Usuários (bloquear, senha e excluir)", "Ficam no fim porque derrubam as sessões da pessoa cadastrada. O admin não bloqueia nem exclui a si mesmo (403), e sempre sobra pelo menos um admin ativo (409 LAST_ADMIN).", [
        req("Bloquear usuário", "POST", "/admin/users/{{userId}}/block", {"reason": "Cadastro duplicado."},
            desc="`reason` é opcional e aparece para a pessoa ao tentar entrar. As sessões dela caem na hora."),
        req("Liberar usuário", "POST", "/admin/users/{{userId}}/unblock", desc="Volta para ativo. Se a conta não estava bloqueada, nada muda."),
        req("Gerar senha temporária", "POST", "/admin/users/{{userId}}/reset-password",
            desc="Devolve `{ user, temporaryPassword }`. A senha aparece **só nesta resposta**; as sessões da pessoa caem e `mustChangePassword` fica `true` até ela trocar.",
            tests=["pm.test('senha temporária', () => pm.expect(pm.response.json().temporaryPassword).to.match(/^[a-z]{4}-/));"]),
        req("Excluir usuário", "DELETE", "/admin/users/{{userId}}",
            desc="204. As missas da pessoa são apagadas junto, e os convidados perdem o acesso a elas. Para só impedir o acesso, prefira **Bloquear**."),
        req("Excluir o convidado", "DELETE", "/admin/users/{{invitedUserId}}",
            desc="Limpa a conta criada em **Admin › Usuários › Convidar**, para a coleção não deixar contas de teste no banco."),
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
        {"key": "challengeId", "value": ""},
        {"key": "loginCode", "value": "", "description": "Código de 6 dígitos recebido por e-mail (2FA)"},
        {"key": "inviteEmail", "value": ""},
        {"key": "invitedUserId", "value": ""},
        {"key": "resetToken", "value": "", "description": "Token do link recebido por e-mail (redefinição ou convite)"},
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
def write(name, data):
    with open(out + name, "w") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
write("psjb-cantos.postman_collection.json", collection)
write("psjb-local.postman_environment.json", env("PSJB — Local", "http://localhost:3333/api", "superadmin@psjb.org.br", "123456"))
write("psjb-producao.postman_environment.json", env("PSJB — Produção", "https://SEU-PROJETO-API.vercel.app/api", "superadmin@psjb.org.br", ""))
print(sum(len(f["item"]) for f in items), "requisições")
