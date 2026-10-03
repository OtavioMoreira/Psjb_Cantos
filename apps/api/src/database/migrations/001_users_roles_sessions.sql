-- Usuários, papéis e sessões (refresh tokens).
-- Tabelas novas, em inglês; as do site antigo (usuarios, audios...) continuam intocadas.

CREATE TYPE user_status AS ENUM ('pending', 'active', 'blocked');

CREATE TABLE roles (
    id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        varchar(30)  NOT NULL UNIQUE,
    label       varchar(60)  NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE roles IS 'Papéis do sistema. admin gerencia usuários; musico usa o repertório e as missas.';

INSERT INTO roles (name, label) VALUES
    ('admin', 'Administrador'),
    ('musico', 'Músico');

CREATE TABLE users (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(120)  NOT NULL,
    -- Sempre gravado com trim + minúsculas (normalizeEmail), então o UNIQUE basta.
    email           varchar(254)  NOT NULL,
    password_hash   text          NOT NULL,
    phone           varchar(20),
    photo_url       text,
    ministry        varchar(120),
    status          user_status   NOT NULL DEFAULT 'pending',
    blocked_reason  text,
    last_login_at   timestamptz,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_email_lower CHECK (email = lower(btrim(email)))
);
COMMENT ON COLUMN users.status IS 'pending: criou a conta e aguarda um admin ativar. Só active consegue entrar.';
COMMENT ON COLUMN users.password_hash IS 'argon2id (formato PHC). Nunca sai da API.';
COMMENT ON COLUMN users.photo_url IS 'URL pública da foto (Vercel Blob em produção, /uploads em desenvolvimento).';

CREATE TABLE user_roles (
    user_id     uuid      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_id     smallint  NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);
CREATE INDEX user_roles_role_id_idx ON user_roles (role_id);

CREATE TABLE sessions (
    id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Todas as rotações de um mesmo login. Reuso de token revoga a família inteira.
    family_id    uuid         NOT NULL,
    -- SHA-256 do refresh token; o token em si só existe no cookie.
    token_hash   char(64)     NOT NULL UNIQUE,
    remember     boolean      NOT NULL DEFAULT false,
    user_agent   varchar(300),
    expires_at   timestamptz  NOT NULL,
    revoked_at   timestamptz,
    replaced_by  uuid         REFERENCES sessions (id) ON DELETE SET NULL,
    created_at   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_family_id_idx ON sessions (family_id);
COMMENT ON TABLE sessions IS 'Refresh tokens com rotação. Linhas expiradas podem ser apagadas por rotina de limpeza.';
