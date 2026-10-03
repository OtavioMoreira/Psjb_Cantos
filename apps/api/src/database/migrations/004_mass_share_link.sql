-- Link de convite da missa: quem abre o link (logado) vira convidado automaticamente.
-- O token fica em texto puro (e não só o hash) porque o dono precisa ver e copiar o link de novo;
-- ele só dá acesso a esta missa e pode ser desativado (o link antigo para de funcionar).

ALTER TABLE masses
    ADD COLUMN share_token varchar(64) UNIQUE,
    ADD COLUMN share_token_created_at timestamptz;

COMMENT ON COLUMN masses.share_token IS 'Token do link de convite. NULL = sem link ativo.';
