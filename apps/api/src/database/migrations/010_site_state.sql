-- "Há alterações não publicadas": quando o conteúdo do site estático (cantos e flags) mudou e quando
-- foi o último "Publicar no site". Uma linha só. Os gatilhos marcam a mudança venha de onde vier
-- (admin, importação dos salmos, scripts de conversão), sem cada caso de uso precisar lembrar.
-- Por linha (não por comando): um UPDATE que não acha nada não conta como mudança.

CREATE TABLE site_state (
    id                  boolean       PRIMARY KEY DEFAULT true CHECK (id),
    content_changed_at  timestamptz   NOT NULL DEFAULT now(),
    published_at        timestamptz,
    -- Sem chave estrangeira de propósito: o registro continua mesmo se a conta for excluída.
    published_by_name   varchar(120)
);
-- O site no ar já foi gerado com o conteúdo atual.
INSERT INTO site_state (content_changed_at, published_at) VALUES (now(), now());

CREATE FUNCTION touch_site_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO site_state (id, content_changed_at) VALUES (true, clock_timestamp())
    ON CONFLICT (id) DO UPDATE SET content_changed_at = EXCLUDED.content_changed_at;
    RETURN NULL;
END $$;

CREATE TRIGGER songs_touch_site AFTER INSERT OR UPDATE OR DELETE ON songs
    FOR EACH ROW EXECUTE FUNCTION touch_site_content();
CREATE TRIGGER flags_touch_site AFTER INSERT OR UPDATE OR DELETE ON flags
    FOR EACH ROW EXECUTE FUNCTION touch_site_content();
CREATE TRIGGER song_flags_touch_site AFTER INSERT OR UPDATE OR DELETE ON song_flags
    FOR EACH ROW EXECUTE FUNCTION touch_site_content();
