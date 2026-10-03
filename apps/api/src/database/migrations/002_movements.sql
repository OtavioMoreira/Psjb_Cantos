-- Movimentos/pastorais da paróquia (RCC, Pastoral da Juventude...). Substituem o texto livre "ministério".

CREATE TABLE movements (
    id          integer       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        varchar(120)  NOT NULL,
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now()
);
-- Único sem diferenciar maiúsculas: "RCC" e "rcc" são o mesmo movimento.
CREATE UNIQUE INDEX movements_name_key ON movements (lower(name));
COMMENT ON TABLE movements IS 'Movimentos e pastorais. Cada usuário participa de no máximo um (users.movement_id).';

ALTER TABLE users
    ADD COLUMN movement_id integer REFERENCES movements (id) ON DELETE RESTRICT,
    DROP COLUMN ministry;
CREATE INDEX users_movement_id_idx ON users (movement_id);
COMMENT ON COLUMN users.movement_id IS 'Movimento da pessoa (opcional). Excluir um movimento em uso é bloqueado.';
