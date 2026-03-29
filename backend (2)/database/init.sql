-- Включаем расширение pgvector для работы с векторными embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Таблица пользователей системы
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Таблица Telegram сессий
CREATE TABLE telegram_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    session_string TEXT,
    api_id VARCHAR(50),
    api_hash VARCHAR(100),
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица отслеживаемых чатов
CREATE TABLE monitored_chats (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES telegram_sessions(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    chat_title VARCHAR(255),
    chat_username VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, chat_id)
);

-- Таблица фильтров сообщений
CREATE TABLE message_filters (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES telegram_sessions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    filter_type VARCHAR(50) NOT NULL, -- 'keyword', 'regex', 'ai'
    pattern TEXT NOT NULL,
    case_sensitive BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица связи фильтров и чатов
CREATE TABLE filter_chat_mapping (
    filter_id INTEGER REFERENCES message_filters(id) ON DELETE CASCADE,
    chat_id INTEGER REFERENCES monitored_chats(id) ON DELETE CASCADE,
    PRIMARY KEY (filter_id, chat_id)
);

-- Таблица шаблонов автоответов
CREATE TABLE auto_responses (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES telegram_sessions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    response_type VARCHAR(50) NOT NULL, -- 'template', 'ai_generated', 'rag'
    template_text TEXT,
    use_ai BOOLEAN DEFAULT false,
    ai_provider_id INTEGER,
    use_rag BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица связи фильтров и автоответов
CREATE TABLE filter_response_mapping (
    filter_id INTEGER REFERENCES message_filters(id) ON DELETE CASCADE,
    response_id INTEGER REFERENCES auto_responses(id) ON DELETE CASCADE,
    PRIMARY KEY (filter_id, response_id)
);

-- Таблица истории сообщений
CREATE TABLE message_history (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES telegram_sessions(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    sender_id BIGINT,
    sender_username VARCHAR(255),
    message_text TEXT,
    matched_filter_id INTEGER REFERENCES message_filters(id) ON DELETE SET NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP
);

-- Таблица отправленных ответов
CREATE TABLE sent_responses (
    id SERIAL PRIMARY KEY,
    message_history_id INTEGER REFERENCES message_history(id) ON DELETE CASCADE,
    response_id INTEGER REFERENCES auto_responses(id) ON DELETE SET NULL,
    recipient_id BIGINT NOT NULL,
    response_text TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

-- Таблица статистики
CREATE TABLE statistics (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES telegram_sessions(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    messages_monitored INTEGER DEFAULT 0,
    messages_matched INTEGER DEFAULT 0,
    responses_sent INTEGER DEFAULT 0,
    responses_failed INTEGER DEFAULT 0,
    UNIQUE(session_id, date)
);

-- Таблица AI провайдеров (MTP)
CREATE TABLE ai_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    provider_type VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'google', 'local'
    api_key TEXT,
    api_endpoint TEXT,
    model_name VARCHAR(100),
    max_tokens INTEGER DEFAULT 1000,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- для fallback
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица документов для RAG
CREATE TABLE rag_documents (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES telegram_sessions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    file_path VARCHAR(500),
    document_type VARCHAR(50), -- 'text', 'pdf', 'url'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица векторных embeddings для RAG
CREATE TABLE rag_embeddings (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES rag_documents(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding vector(384), -- sentence-transformers all-MiniLM-L6-v2
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица всех сообщений из диалогов (для семантического поиска)
CREATE TABLE conversation_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES telegram_sessions(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    sender_id BIGINT,
    sender_username TEXT,
    message_text TEXT NOT NULL,
    message_date TIMESTAMP NOT NULL,
    is_outgoing BOOLEAN DEFAULT FALSE,
    reply_to_message_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, message_id)
);

-- Таблица embeddings для диалогов (RAG поиск по смыслам)
CREATE TABLE conversation_embeddings (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES conversation_messages(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES telegram_sessions(id) ON DELETE CASCADE,
    embedding vector(384), -- sentence-transformers all-MiniLM-L6-v2
    context_window TEXT, -- контекст из нескольких сообщений
    context_size INTEGER DEFAULT 3, -- количество сообщений в контексте
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица настроек пользователя
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES telegram_sessions(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, setting_key)
);


-- Индексы для оптимизации
CREATE INDEX idx_telegram_sessions_user ON telegram_sessions(user_id);
CREATE INDEX idx_monitored_chats_session ON monitored_chats(session_id);
CREATE INDEX idx_message_filters_session ON message_filters(session_id);
CREATE INDEX idx_message_history_session ON message_history(session_id);
CREATE INDEX idx_message_history_chat ON message_history(chat_id);
CREATE INDEX idx_sent_responses_message ON sent_responses(message_history_id);
CREATE INDEX idx_statistics_session_date ON statistics(session_id, date);
CREATE INDEX idx_rag_embeddings_document ON rag_embeddings(document_id);
CREATE INDEX idx_conversation_messages_chat ON conversation_messages(chat_id, message_date DESC);
CREATE INDEX idx_conversation_messages_session ON conversation_messages(session_id);
CREATE INDEX idx_conversation_messages_sender ON conversation_messages(sender_id);
CREATE INDEX idx_conversation_embeddings_session ON conversation_embeddings(session_id);
CREATE INDEX idx_conversation_embeddings_message ON conversation_embeddings(message_id);
CREATE INDEX idx_user_settings_session ON user_settings(session_id);

-- Индекс для векторного поиска (cosine similarity)
CREATE INDEX idx_rag_embeddings_vector ON rag_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_conversation_embeddings_vector ON conversation_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);


-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_telegram_sessions_updated_at BEFORE UPDATE ON telegram_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rag_documents_updated_at BEFORE UPDATE ON rag_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Вставка дефолтного пользователя (admin/admin - ИЗМЕНИТЬ В ПРОДАКШЕНЕ!)
INSERT INTO users (username, password_hash) 
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqVr/qvIuW'); -- пароль: admin

-- Вставка примера AI провайдера
INSERT INTO ai_providers (name, provider_type, model_name, is_active, priority)
VALUES ('OpenAI GPT-4', 'openai', 'gpt-4-turbo-preview', true, 1);
