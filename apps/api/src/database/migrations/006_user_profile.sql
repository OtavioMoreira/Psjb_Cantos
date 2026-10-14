-- Perfil completo e senha temporária definida pelo admin.

ALTER TABLE users
    ADD COLUMN parish varchar(120),
    ADD COLUMN instrument varchar(60),
    ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN users.parish IS 'Paróquia que a pessoa informou no perfil (opcional).';
COMMENT ON COLUMN users.instrument IS 'Instrumento ou voz (opcional, texto livre curto).';
COMMENT ON COLUMN users.must_change_password IS 'true depois que um admin gera senha temporária; volta a false quando a pessoa troca a senha.';
