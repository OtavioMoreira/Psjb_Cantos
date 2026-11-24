-- Controle de concorrência na edição da missa: cada gravação soma 1. O editor manda a versão que
-- conhece (If-Match); se outra pessoa salvou antes, a API responde 409 e o front junta as alterações.
ALTER TABLE masses ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
COMMENT ON COLUMN masses.version IS 'Sobe a cada alteração do conteúdo (PUT/PATCH). Compartilhar não muda.';
