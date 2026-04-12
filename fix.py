import re

def main():
    with open('backend/database/init.sql', 'r', encoding='utf-8') as f:
        sql = f.read()

    sql = sql.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ')
    sql = sql.replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ')

    trigger_pattern_sessions = """CREATE TRIGGER update_telegram_sessions_updated_at BEFORE UPDATE ON telegram_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();"""

    trigger_pattern_rag = """CREATE TRIGGER update_rag_documents_updated_at BEFORE UPDATE ON rag_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();"""

    new_trigger_sessions = """DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_telegram_sessions_updated_at') THEN
        CREATE TRIGGER update_telegram_sessions_updated_at BEFORE UPDATE ON telegram_sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;"""

    new_trigger_rag = """DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_rag_documents_updated_at') THEN
        CREATE TRIGGER update_rag_documents_updated_at BEFORE UPDATE ON rag_documents
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;"""

    sql = sql.replace(trigger_pattern_sessions, new_trigger_sessions)
    sql = sql.replace(trigger_pattern_rag, new_trigger_rag)

    admin_insert = """-- Вставка дефолтного пользователя (admin/admin - ИЗМЕНИТЬ В ПРОДАКШЕНЕ!)
INSERT INTO users (username, password_hash) 
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqVr/qvIuW'); -- пароль: admin"""

    admin_insert_new = """-- Вставка дефолтного пользователя (admin/admin - ИЗМЕНИТЬ В ПРОДАКШЕНЕ!)
INSERT INTO users (username, password_hash) 
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqVr/qvIuW') 
ON CONFLICT (username) DO NOTHING; -- пароль: admin"""

    sql = sql.replace(admin_insert, admin_insert_new)

    ai_insert = """-- Вставка примера AI провайдера
INSERT INTO ai_providers (name, provider_type, model_name, is_active, priority)
VALUES ('OpenAI GPT-4', 'openai', 'gpt-4-turbo-preview', true, 1);"""

    ai_insert_new = """-- Вставка примера AI провайдера
INSERT INTO ai_providers (name, provider_type, model_name, is_active, priority)
SELECT 'OpenAI GPT-4', 'openai', 'gpt-4-turbo-preview', true, 1
WHERE NOT EXISTS (SELECT 1 FROM ai_providers WHERE name = 'OpenAI GPT-4');"""

    sql = sql.replace(ai_insert, ai_insert_new)

    with open('backend/database/init.sql', 'w', encoding='utf-8') as f:
        f.write(sql)
    print('Successfully fixed init.sql')

if __name__ == '__main__':
    main()
