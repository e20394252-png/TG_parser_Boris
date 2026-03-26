# 🚀 Развертывание TG Parser на Render

## 📋 Предварительные требования

1. **Аккаунт Render** с подключенным GitHub
2. **Репозиторий** TG_parser_Boris на GitHub
3. **API ключи** для Telegram и AI сервисов

## 🎯 Шаги развертывания

### 1. Создание Workspace в Render

1. Перейдите на [render.com](https://render.com)
2. Войдите через GitHub (используйте ваш ключ)
3. Создайте новый Workspace: `telegram-parser`

### 2. Настройка PostgreSQL

**Создание базы данных:**
1. В Dashboard нажмите "New+" → "PostgreSQL"
2. Настройте параметры:
   - **Name**: `telegram-parser-db`
   - **Database Name**: `telegram_parser`
   - **User**: `parser_user`
   - **Plan**: Starter ($7/месяц)
   - **Version**: PostgreSQL 15

**Включение pgvector:**
После создания базы данных:
1. Перейдите в Database → "Shell"
2. Выполните команду:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Импорт схемы:**
```bash
# Подключитесь к базе данных через psql
psql $DATABASE_URL -f backend/database/init.sql
```

### 3. Настройка Redis

**Создание Redis:**
1. Dashboard → "New+" → "Redis"
2. Настройте параметры:
   - **Name**: `telegram-parser-redis`
   - **Plan**: Starter ($7/месяц)
   - **Version**: Redis 7

### 4. Деплой Backend

**Создание Web Service:**
1. Dashboard → "New+" → "Web Service"
2. Подключите репозиторий TG_parser_Boris
3. Настройте параметры:
   - **Name**: `telegram-parser-backend`
   - **Environment**: Python 3
   - **Plan**: Starter (бесплатно с ограничениями)
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`

**Environment Variables:**
```
DATABASE_URL=postgresql://parser_user:PASSWORD@HOST:5432/telegram_parser
REDIS_URL=redis://:PASSWORD@HOST:6379/0
SECRET_KEY=GENERATE_NEW_KEY
ENVIRONMENT=production
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
OPENAI_API_KEY=sk-your-key (опционально)
ANTHROPIC_API_KEY=sk-ant-your-key (опционально)
GOOGLE_AI_API_KEY=your-key (опционально)
```

### 5. Деплой Frontend

**Создание Static Site:**
1. Dashboard → "New+" → "Static Site"
2. Подключите тот же репозиторий
3. Настройте параметры:
   - **Name**: `telegram-parser-frontend`
   - **Plan**: Free
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

**Environment Variables:**
```
VITE_API_URL=https://telegram-parser-backend.onrender.com
```

**Custom Routes (для API):**
```
Source: /api/*
Destination: https://telegram-parser-backend.onrender.com/api/*
Type: Rewrite
```

### 6. Настройка интеграции сервисов

**Связь между сервисами:**
1. Перейдите в backend service → "Environment"
2. Добавьте переменные:
```
FRONTEND_HOST=telegram-parser-frontend.onrender.com
```

**Health Checks:**
- Backend: `/health`
- Frontend: `/` (автоматически)

## 🔧 Конфигурация после деплоя

### 1. Проверка работоспособности

**Backend:**
```bash
curl https://telegram-parser-backend.onrender.com/health
```

**Frontend:**
Откройте https://telegram-parser-frontend.onrender.com

### 2. Настройка Telegram

1. Откройте frontend в браузере
2. Перейдите на страницу "Telegram"
3. Введите ваши API credentials с my.telegram.org
4. Подтвердите авторизацию

### 3. Мониторинг логов

**В Render Dashboard:**
1. Выберите сервис
2. Перейдите в "Logs"
3. Следите за ошибками и статусом

## 📊 Стоимость

**Ежемесячные затраты:**
- PostgreSQL: $7
- Redis: $7
- Backend: $0 (starter plan)
- Frontend: $0 (static site)
- **Итого**: ~$14/месяц

## 🚨 Возможные проблемы

### 1. pgvector не установлен
**Решение:**
```sql
-- В PostgreSQL shell
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Timeout при деплое
**Решение:**
- Увеличьте timeout в настройках сервиса
- Оптимизируйте build process

### 3. CORS ошибки
**Решение:**
- Проверьте CORS настройки в backend
- Убедитесь, что frontend URL добавлен в allowed origins

### 4. Telegram сессии теряются
**Решение:**
- Сессии хранятся в PostgreSQL (таблица telegram_sessions)
- Проверьте connection string

## 🔄 Обновления

**Автоматические обновления:**
- Render автоматически деплоит изменения из GitHub
- Push в main ветку → автоматический деплой

**Ручные обновления:**
1. Push изменений в GitHub
2. Render автоматически запустит деплой
3. Следите за логами

## 📞 Поддержка

**Полезные ссылки:**
- [Render Docs](https://render.com/docs)
- [FastAPI на Render](https://render.com/articles/fastapi-deployment-options)
- [React на Render](https://render.com/docs/static-sites)

**Логи и мониторинг:**
- Render Dashboard → Logs
- Health checks: `/health`
- Telegram API status в frontend

---

**Готово!** Ваш Telegram Parser теперь работает на Render 🎉
