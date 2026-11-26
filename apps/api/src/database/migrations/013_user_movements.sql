-- Uma pessoa pode participar de vários movimentos (antes era no máximo um, em users.movement_id).
-- Só acréscimos: a coluna antiga fica, sem uso, para o código anterior continuar rodando até o deploy.

CREATE TABLE user_movements (
    user_id      uuid     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    movement_id  integer  NOT NULL REFERENCES movements (id) ON DELETE RESTRICT,
    PRIMARY KEY (user_id, movement_id)
);
CREATE INDEX user_movements_movement_id_idx ON user_movements (movement_id);
COMMENT ON TABLE user_movements IS 'Movimentos de cada pessoa (vários). Excluir um movimento com pessoas é bloqueado.';

INSERT INTO user_movements (user_id, movement_id)
SELECT id, movement_id FROM users WHERE movement_id IS NOT NULL;

COMMENT ON TABLE movements IS 'Movimentos e pastorais. Uma pessoa pode participar de vários (user_movements).';
COMMENT ON COLUMN users.movement_id IS 'OBSOLETA desde a 013 (substituída por user_movements); será removida.';
