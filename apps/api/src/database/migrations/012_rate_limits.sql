-- Limite de tentativas por IP (login, cadastro, 2FA...) compartilhado entre as instâncias da Vercel.
-- Cada instância tinha o seu contador em memória, então o limite real era "N por instância".
-- Uma linha por chave (rota + IP), com janela fixa. A faxina diária apaga as janelas vencidas.

CREATE UNLOGGED TABLE rate_limits (
    key           varchar(200)  PRIMARY KEY,
    hits          integer       NOT NULL,
    window_start  timestamptz   NOT NULL
);
COMMENT ON TABLE rate_limits IS 'UNLOGGED: contador descartável (perder num restart do banco só zera os limites).';
