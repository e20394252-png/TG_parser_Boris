# 🤖 Telegram Parser - Киберпанк Edition

Мощный веб-сервис для мониторинга Telegram чатов, автоматических ответов и интеграции с AI системами (RAG + MTP).

![Cyberpunk Style](https://img.shields.io/badge/style-cyberpunk-ff00ff?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## ✨ Возможности

### 🔍 Мониторинг Telegram
- **User Account** - работа от имени вашего аккаунта (не бот)
- **Множественные чаты** - отслеживание неограниченного количества чатов
- **Умные фильтры** - ключевые слова, регулярные выражения, AI анализ
- **Реальное время** - мгновенная обработка новых сообщений

### 🤖 AI Интеграция
- **RAG (Retrieval-Augmented Generation)** - контекстные ответы на основе вашей базы знаний
- **MTP (Multi-Provider)** - поддержка OpenAI, Anthropic, Google AI, локальных моделей
- **Fallback механизм** - автоматическое переключение между провайдерами
- **Векторный поиск** - семантический поиск через pgvector

### 📊 Статистика и аналитика
- **Дашборд в реальном времени** - графики активности
- **Детальная история** - все обработанные сообщения и ответы
- **Топ фильтры** - анализ эффективности
- **Экспорт данных** - выгрузка статистики

### 🎨 Киберпанк интерфейс
- **Неоновый дизайн** - cyan, magenta, purple палитра
- **Глитч эффекты** - анимации и микроинтеракции
- **Адаптивность** - работает на всех устройствах
- **Темная тема** - комфортная работа 24/7

## 🚀 Быстрый старт

### Предварительные требования

- Docker и Docker Compose
- Telegram API credentials (получить на [my.telegram.org](https://my.telegram.org))
- (Опционально) API ключи для AI провайдеров

### Установка

1. **Клонируйте репозиторий**
```bash
git clone <repository-url>
cd telegram-parser
```

2. **Настройте переменные окружения**
```bash
cp .env.example .env
```

Отредактируйте `.env`:
```env
# Database
DB_PASSWORD=ваш_надежный_пароль

# Telegram API (получить на https://my.telegram.org)
TELEGRAM_API_ID=ваш_api_id
TELEGRAM_API_HASH=ваш_api_hash

# AI Providers (опционально)
OPENAI_API_KEY=sk-ваш-ключ
ANTHROPIC_API_KEY=sk-ant-ваш-ключ
GOOGLE_AI_API_KEY=ваш-ключ
```

3. **Запустите Docker Compose**
```bash
docker-compose up -d
```

4. **Откройте браузер**
```
http://localhost:3000
```

## 📖 Использование

### 1. Авторизация Telegram

1. Перейдите на страницу **Telegram**
2. Введите номер телефона, API ID и API Hash
3. Подтвердите код из Telegram
4. (Если включена 2FA) Введите пароль

### 2. Настройка мониторинга

1. Перейдите на страницу **Мониторинг**
2. Добавьте чаты для отслеживания (ID чата можно получить через @userinfobot)
3. Создайте фильтры:
   - **Ключевое слово** - простой поиск текста
   - **Regex** - регулярные выражения для сложных паттернов
4. Создайте шаблоны автоответов

### 3. Настройка AI

1. Перейдите на страницу **AI & RAG**
2. Добавьте AI провайдеры:
   - OpenAI (GPT-4, GPT-3.5)
   - Anthropic (Claude)
   - Google AI (Gemini)
3. Загрузите документы для RAG (текстовые файлы)
4. Система автоматически создаст векторные embeddings

### 4. Просмотр статистики

- **Дашборд** - общая статистика и графики
- **История** - детальный лог всех сообщений и ответов

## 🏗️ Архитектура

```
telegram-parser/
├── backend/                 # FastAPI приложение
│   ├── database/           # SQL схема и модуль БД
│   ├── routers/            # API endpoints
│   ├── services/           # Бизнес-логика
│   │   ├── telegram_client.py    # Telethon интеграция
│   │   ├── message_monitor.py    # Мониторинг сообщений
│   │   ├── auto_responder.py     # Автоответчик
│   │   ├── rag_service.py        # RAG система
│   │   └── mtp_service.py        # Multi-provider AI
│   └── main.py             # Точка входа
├── frontend/               # React приложение
│   ├── src/
│   │   ├── pages/          # Страницы приложения
│   │   ├── components/     # Переиспользуемые компоненты
│   │   └── utils/          # API клиент
│   └── Dockerfile
└── docker-compose.yml      # Оркестрация сервисов
```

### Технологический стек

**Backend:**
- FastAPI - современный веб-фреймворк
- PostgreSQL + pgvector - база данных с векторным поиском
- Telethon - работа с Telegram User API
- asyncpg - асинхронный драйвер PostgreSQL
- sentence-transformers - создание embeddings

**Frontend:**
- React 18 - UI библиотека
- Vite - сборщик
- Framer Motion - анимации
- Recharts - графики
- Axios - HTTP клиент

**Infrastructure:**
- Docker Compose - контейнеризация
- Nginx - reverse proxy
- Redis - кэширование и очереди

## 🔧 Разработка

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API документация: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dev сервер: `http://localhost:5173`

## 📝 API Endpoints

### Authentication
- `POST /api/auth/telegram/start` - начало авторизации
- `POST /api/auth/telegram/code` - подтверждение кода
- `GET /api/auth/status` - статус сессий

### Monitoring
- `GET /api/monitoring/chats` - список чатов
- `POST /api/monitoring/chats` - добавить чат
- `GET /api/monitoring/filters` - список фильтров
- `POST /api/monitoring/filters` - создать фильтр

### AI & RAG
- `GET /api/ai/providers` - AI провайдеры
- `POST /api/ai/providers` - добавить провайдер
- `POST /api/ai/rag/upload` - загрузить документ
- `POST /api/ai/generate` - генерация ответа

### Statistics
- `GET /api/statistics/overview` - общая статистика
- `GET /api/statistics/messages` - статистика сообщений
- `GET /api/statistics/responses` - статистика ответов

Полная документация: `http://localhost:8000/docs`

## 🔒 Безопасность

- ⚠️ **Важно:** Измените все пароли в `.env` перед развертыванием
- 🔐 Telegram session хранится зашифрованным
- 🛡️ API ключи не логируются
- 🔒 HTTPS обязателен для production

## 🐛 Troubleshooting

### Ошибка подключения к Telegram
- Проверьте API ID и Hash на [my.telegram.org](https://my.telegram.org)
- Убедитесь, что номер телефона введен с кодом страны (+7...)

### Ошибка векторного поиска
- Убедитесь, что pgvector расширение установлено
- Проверьте размерность embeddings (должна быть 1536 для OpenAI)

### Frontend не подключается к backend
- Проверьте `VITE_API_URL` в `.env`
- Убедитесь, что backend запущен на порту 8000

## 📄 Лицензия

MIT License - свободное использование

## 🤝 Вклад

Pull requests приветствуются! Для крупных изменений сначала откройте issue.

## 📧 Контакты

- GitHub Issues для багов и предложений
- Telegram: @your_username

---

**Сделано с 💜 в киберпанк стиле**
