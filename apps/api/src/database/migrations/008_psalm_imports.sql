-- Importação automática dos salmos e aclamações de uma fonte externa (site da Diocese de Montenegro).
-- A rotina roda de segunda a quinta de madrugada e só pega os itens da semana; nada é duplicado.

-- Crédito da fonte, mostrado na página do canto ("Fonte: Diocese de Montenegro").
ALTER TABLE songs ADD COLUMN source_name varchar(120);
ALTER TABLE songs ADD COLUMN source_url  text;

CREATE TYPE import_status AS ENUM ('created', 'linked', 'review', 'ignored', 'failed');

-- Cada item da fonte (um salmo ou uma aclamação de uma data) vira uma linha, criada uma vez só:
-- rodar a rotina de novo encontra a linha e não faz nada (é a 1ª proteção contra duplicados).
CREATE TABLE import_items (
    id                 integer        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source             varchar(40)    NOT NULL,
    -- Identificador do item na fonte (código do arquivo + data).
    external_id        varchar(200)   NOT NULL,
    title              varchar(300)   NOT NULL,
    kind               varchar(20)    NOT NULL CHECK (kind IN ('salmo', 'aclamacao')),
    celebration_date   date           NOT NULL,
    pdf_url            text,
    audio_url          text,
    -- SHA-256 do PDF: a fonte sobe o mesmo arquivo de novo para outros domingos (2ª proteção).
    pdf_hash           char(64),
    status             import_status  NOT NULL,
    -- Canto criado ou reconhecido (no repertório antigo ou por um PDF igual).
    song_id            integer        REFERENCES songs (id) ON DELETE SET NULL,
    -- Na revisão: os cantos parecidos que o admin pode escolher.
    candidate_song_ids integer[]      NOT NULL DEFAULT '{}',
    message            text,
    created_at         timestamptz    NOT NULL DEFAULT now(),
    updated_at         timestamptz    NOT NULL DEFAULT now(),
    CONSTRAINT import_items_source_external_key UNIQUE (source, external_id)
);
CREATE INDEX import_items_hash_idx ON import_items (source, pdf_hash) WHERE pdf_hash IS NOT NULL;
CREATE INDEX import_items_status_idx ON import_items (status, celebration_date DESC);
COMMENT ON TABLE import_items IS 'Itens lidos da fonte externa de salmos e o que foi feito com cada um (criado, reconhecido, a revisar...).';

-- Histórico das execuções (cron ou botão "Buscar agora" no admin).
CREATE TABLE import_runs (
    id           integer       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source       varchar(40)   NOT NULL,
    trigger      varchar(10)   NOT NULL CHECK (trigger IN ('cron', 'manual')),
    started_at   timestamptz   NOT NULL DEFAULT now(),
    finished_at  timestamptz,
    -- Contagem por resultado: {"created": 1, "linked": 3, "skipped": 2, ...}
    summary      jsonb         NOT NULL DEFAULT '{}',
    error        text
);
CREATE INDEX import_runs_started_idx ON import_runs (started_at DESC);
