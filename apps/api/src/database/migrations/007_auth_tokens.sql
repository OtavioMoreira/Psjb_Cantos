-- Tokens de uso único enviados por e-mail: redefinição de senha, convite, troca de e-mail e código do 2FA.
-- Só o hash (SHA-256) fica no banco; o token em si só existe no link ou no e-mail.

CREATE TYPE auth_token_purpose AS ENUM ('password_reset', 'invite', 'email_change', 'login_code');

CREATE TABLE auth_tokens (
    id          uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid                NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose     auth_token_purpose  NOT NULL,
    token_hash  char(64)            NOT NULL UNIQUE,
    -- Dados extras do fluxo, como o novo e-mail na troca de endereço.
    data        jsonb               NOT NULL DEFAULT '{}',
    -- Tentativas erradas (código do 2FA): passou do limite, o token não vale mais.
    attempts    smallint            NOT NULL DEFAULT 0,
    expires_at  timestamptz         NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz         NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_purpose_idx ON auth_tokens (user_id, purpose);
COMMENT ON TABLE auth_tokens IS 'Tokens de uso único (link ou código por e-mail). Linhas vencidas podem ser apagadas por rotina de limpeza.';

-- "Confiar neste aparelho por 30 dias": dispensa o código do 2FA. O token fica num cookie httpOnly.
CREATE TABLE trusted_devices (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  char(64)      NOT NULL UNIQUE,
    user_agent  varchar(300),
    expires_at  timestamptz   NOT NULL,
    created_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX trusted_devices_user_id_idx ON trusted_devices (user_id);
