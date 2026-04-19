-- Миграция: добавить таблицу для Telegram Bot Auth
-- Выполнить один раз в psql или Render Shell (psql $DATABASE_URL)

CREATE TABLE IF NOT EXISTS tg_bot_auth_states (
    id          SERIAL PRIMARY KEY,
    state       UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    tg_username TEXT,
    tg_user_id  BIGINT,
    confirmed   BOOLEAN DEFAULT false,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at  TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_tg_bot_auth_states_state   ON tg_bot_auth_states(state);
CREATE INDEX IF NOT EXISTS idx_tg_bot_auth_states_expires ON tg_bot_auth_states(expires_at);
