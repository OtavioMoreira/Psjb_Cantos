-- Roteiro da celebração (o folheto de 1 página da equipe de liturgia), montado pelo admin na missa sugerida.
-- { title, notes, items: [{ id, title, kind: "texto" | "cantos", slotIds, text, boxed }] }. Nulo = sem roteiro.
-- Só acréscimo: o código anterior continua funcionando.

ALTER TABLE masses ADD COLUMN script jsonb CHECK (script IS NULL OR jsonb_typeof(script) = 'object');
COMMENT ON COLUMN masses.script IS 'Roteiro da celebração (PDF de 1 página). Os itens "cantos" puxam os números dos momentos (slotIds).';
