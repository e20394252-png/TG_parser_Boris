# MCP (Model Context Protocol) - Руководство по настройке

## Что такое MCP?

Model Context Protocol (MCP) - это открытый протокол, который позволяет AI-ассистентам (таким как Claude, ChatGPT и др.) взаимодействовать с внешними сервисами, базами данных и инструментами.

## Файлы конфигурации

- **mcp.json** - основной конфигурационный файл MCP для вашего проекта

## Структура конфигурации

### 1. MCP Серверы (`mcpServers`)

Определяет доступные сервисы:

- **telegram-rag-service** - основной FastAPI сервер
- **database-service** - PostgreSQL с pgvector
- **redis-service** - Redis для кэширования

### 2. Инструменты (`tools`)

Доступные функции для AI-ассистента:

- `search_conversations` - семантический поиск по диалогам
- `get_messages` - получение сообщений из чата
- `index_chat` - индексация чата для поиска
- `get_stats` - статистика по диалогам
- `get_context` - контекст вокруг сообщения

### 3. Ресурсы (`resources`)

Доступные источники данных:

- `telegram://conversations` - диалоги Telegram
- `telegram://embeddings` - векторные эмбеддинги

### 4. Промпты (`prompts`)

Готовые шаблоны для анализа:

- `analyze_conversation` - анализ диалога по теме
- `summarize_chat` - резюмирование чата

## Настройка для Claude Desktop

1. Найдите файл конфигурации Claude:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Добавьте конфигурацию:

```json
{
  "mcpServers": {
    "telegram-rag": {
      "command": "python",
      "args": ["-m", "uvicorn", "backend.main:app", "--host", "localhost", "--port", "8000"],
      "cwd": "c:\\Projects\\test26",
      "env": {
        "PYTHONPATH": "c:\\Projects\\test26"
      }
    }
  }
}
```

3. Перезапустите Claude Desktop

## Настройка для других AI-ассистентов

### ChatGPT (через API)

Используйте OpenAPI спецификацию:

```bash
# Запустите сервер
cd c:\Projects\test26
docker-compose up -d

# OpenAPI спецификация доступна по адресу:
# http://localhost:8000/openapi.json
```

### Cursor / VS Code

1. Установите расширение MCP
2. Добавьте конфигурацию в `.vscode/settings.json`:

```json
{
  "mcp.servers": {
    "telegram-rag": {
      "url": "http://localhost:8000",
      "config": "./mcp.json"
    }
  }
}
```

## Использование

### Запуск сервисов

```bash
# Запустите все сервисы через Docker
docker-compose up -d

# Или запустите backend отдельно
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Проверка работы

```bash
# Проверьте API документацию
# Откройте в браузере: http://localhost:8000/docs

# Проверьте здоровье сервиса
curl http://localhost:8000/health
```

### Примеры использования через AI-ассистента

После настройки MCP, вы можете использовать естественный язык:

**Поиск в диалогах:**
```
"Найди все упоминания о встрече в моих диалогах"
```

**Получение сообщений:**
```
"Покажи последние 20 сообщений из чата с ID 12345"
```

**Индексация:**
```
"Проиндексируй последние 100 сообщений из чата 12345"
```

**Статистика:**
```
"Покажи статистику по моим диалогам"
```

**Анализ контекста:**
```
"Покажи контекст вокруг сообщения с ID 67890"
```

## Переменные окружения

Убедитесь, что настроены следующие переменные в `.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=telegram_db
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Telegram API
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash

# AI Providers (для RAG)
OPENAI_API_KEY=sk-your-openai-key
```

## Безопасность

⚠️ **Важно:**

1. Не публикуйте `mcp.json` с реальными ключами API
2. Используйте переменные окружения для чувствительных данных
3. Ограничьте доступ к API через firewall
4. Используйте HTTPS в продакшене

## Расширение функциональности

Чтобы добавить новый инструмент в MCP:

1. Создайте новый endpoint в FastAPI
2. Добавьте описание в `mcp.json` в секцию `tools`
3. Обновите `capabilities` для соответствующего сервера
4. Перезапустите AI-ассистента

## Отладка

### Логи сервера

```bash
# Просмотр логов Docker
docker-compose logs -f backend

# Просмотр логов напрямую
tail -f backend/logs/app.log
```

### Тестирование endpoints

```bash
# Тест поиска
curl -X POST http://localhost:8000/conversations/search \
  -H "Content-Type: application/json" \
  -d '{"query": "встреча", "limit": 5}'

# Тест получения сообщений
curl "http://localhost:8000/conversations/messages?chat_id=12345&limit=10"

# Тест статистики
curl "http://localhost:8000/conversations/stats?session_id=1"
```

## Поддержка

Для получения помощи:

1. Проверьте документацию API: http://localhost:8000/docs
2. Изучите логи сервера
3. Убедитесь, что все сервисы запущены: `docker-compose ps`

## Ссылки

- [MCP Specification](https://modelcontextprotocol.io/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Claude Desktop](https://claude.ai/download)
