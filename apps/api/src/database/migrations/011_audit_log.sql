-- Auditoria: quem fez o quê na área de administração. Gravada por um hook nas rotas /api/admin
-- (só alterações que deram certo). Os nomes ficam copiados: o registro continua legível mesmo se
-- a pessoa ou o canto forem excluídos. A faxina diária apaga o que tem mais de 2 anos.

CREATE TABLE audit_log (
    id            bigserial     PRIMARY KEY,
    actor_id      uuid          REFERENCES users (id) ON DELETE SET NULL,
    actor_name    varchar(120)  NOT NULL,
    action        varchar(40)   NOT NULL,
    target_type   varchar(20)   NOT NULL CHECK (target_type IN ('user', 'movement', 'song', 'flag', 'site', 'import')),
    target_id     varchar(64),
    target_label  varchar(200),
    -- Só o que ajuda a entender a ação (motivo do bloqueio, campos alterados). Nunca senha ou letra.
    details       jsonb         NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
    created_at    timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_at_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_target_idx ON audit_log (target_type, target_id);
