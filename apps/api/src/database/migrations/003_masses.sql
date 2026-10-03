-- Missas montadas ("Monte sua Missa") e compartilhamento com a equipe.

CREATE TABLE masses (
    id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Vazio = a tela mostra "Missa de dd/mm".
    name              varchar(120)  NOT NULL DEFAULT '',
    -- Nulo na cópia de uma missa ("Duplicar" cria sem data).
    celebration_date  date,
    celebration_time  time(0),
    season            varchar(20)   CHECK (season IN ('advento', 'natal', 'quaresma', 'pascoa', 'tempo-comum')),
    liturgical_year   char(1)       CHECK (liturgical_year IN ('A', 'B', 'C')),
    -- Momentos em ordem, cada um com os cantos e o tom desta missa:
    -- [{ id, moment, label, items: [{ songId, transpose }] }]. É salvo inteiro pelo editor (autosave).
    slots             jsonb         NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(slots) = 'array'),
    updated_by        uuid          REFERENCES users (id) ON DELETE SET NULL,
    created_at        timestamptz   NOT NULL DEFAULT now(),
    updated_at        timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX masses_owner_id_idx ON masses (owner_id);
CREATE INDEX masses_celebration_date_idx ON masses (celebration_date);
COMMENT ON TABLE masses IS 'Só o dono exclui e compartilha. Quem recebeu vê, edita os cantos, abre no Modo Missa e baixa o PDF.';

CREATE TABLE mass_shares (
    mass_id    uuid         NOT NULL REFERENCES masses (id) ON DELETE CASCADE,
    user_id    uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    shared_at  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (mass_id, user_id)
);
CREATE INDEX mass_shares_user_id_idx ON mass_shares (user_id);
