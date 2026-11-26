-- Missa sugerida (a "missa do padre"): um admin marca uma missa dele como sugestão para todos.
-- Na semana da data, ela aparece em "Sugestões da semana" e cada pessoa cria a sua com base nela.
-- Só acréscimos: o código anterior continua funcionando (a coluna nasce false).

ALTER TABLE masses ADD COLUMN suggested boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN masses.suggested IS 'Sugerida por um admin para todos. Aparece de hoje até o domingo seguinte (fuso de Brasília). Exige data.';
CREATE INDEX masses_suggested_date_idx ON masses (celebration_date) WHERE suggested;
ALTER TABLE masses ADD CONSTRAINT masses_suggested_has_date CHECK (NOT suggested OR celebration_date IS NOT NULL);
