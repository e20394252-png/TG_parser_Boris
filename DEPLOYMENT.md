# 🚀 Инструкция по развертыванию

Пошаговое руководство по развертыванию Telegram Parser в production.

## 📋 Содержание

1. [Требования](#требования)
2. [Подготовка сервера](#подготовка-сервера)
3. [Установка зависимостей](#установка-зависимостей)
4. [Настройка проекта](#настройка-проекта)
5. [Запуск через Docker](#запуск-через-docker)
6. [Настройка HTTPS](#настройка-https)
7. [Мониторинг и логи](#мониторинг-и-логи)
8. [Обновление](#обновление)

## Требования

### Минимальные требования сервера

- **CPU:** 2 ядра
- **RAM:** 4 GB
- **Диск:** 20 GB SSD
- **ОС:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+

### Программное обеспечение

- Docker 20.10+
- Docker Compose 2.0+
- Git
- (Опционально) Nginx для reverse proxy

## Подготовка сервера

### 1. Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Установка Docker

```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER

# Перелогиньтесь для применения изменений
exit
```

### 3. Установка Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 4. Настройка firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable

# Firewalld (CentOS)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## Установка зависимостей

### 1. Клонирование репозитория

```bash
cd /opt
sudo git clone <repository-url> telegram-parser
cd telegram-parser
sudo chown -R $USER:$USER .
```

### 2. Получение Telegram API credentials

1. Перейдите на [my.telegram.org](https://my.telegram.org)
2. Войдите с вашим номером телефона
3. Перейдите в "API development tools"
4. Создайте новое приложение
5. Сохраните **api_id** и **api_hash**

### 3. Получение AI API ключей (опционально)

**OpenAI:**
1. Зарегистрируйтесь на [platform.openai.com](https://platform.openai.com)
2. Создайте API ключ в разделе API keys

**Anthropic:**
1. Зарегистрируйтесь на [console.anthropic.com](https://console.anthropic.com)
2. Создайте API ключ

**Google AI:**
1. Перейдите в [Google AI Studio](https://makersuite.google.com)
2. Создайте API ключ

## Настройка проекта

### 1. Создание .env файла

```bash
cp .env.example .env
nano .env
```

### 2. Заполнение переменных окружения

```env
# Database - ОБЯЗАТЕЛЬНО ИЗМЕНИТЕ!
DB_PASSWORD=ваш_очень_надежный_пароль_123

# Redis - ОБЯЗАТЕЛЬНО ИЗМЕНИТЕ!
REDIS_PASSWORD=ваш_redis_пароль_456

# Backend - ОБЯЗАТЕЛЬНО ИЗМЕНИТЕ!
SECRET_KEY=$(openssl rand -hex 32)

# Telegram API - ОБЯЗАТЕЛЬНО!
TELEGRAM_API_ID=ваш_api_id
TELEGRAM_API_HASH=ваш_api_hash

# AI Providers (опционально)
OPENAI_API_KEY=sk-ваш-openai-ключ
ANTHROPIC_API_KEY=sk-ant-ваш-anthropic-ключ
GOOGLE_AI_API_KEY=ваш-google-ai-ключ
```

**Генерация SECRET_KEY:**
```bash
openssl rand -hex 32
```

### 3. Настройка прав доступа

```bash
chmod 600 .env
```

## Запуск через Docker

### 1. Сборка и запуск контейнеров

```bash
docker-compose up -d --build
```

### 2. Проверка статуса

```bash
docker-compose ps
```

Все сервисы должны быть в статусе "Up":
- telegram_parser_db
- telegram_parser_redis
- telegram_parser_backend
- telegram_parser_frontend

### 3. Проверка логов

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f backend
```

### 4. Проверка работоспособности

```bash
# Backend health check
curl http://localhost:8000/health

# Frontend
curl http://localhost:3000
```

## Настройка HTTPS

### Вариант 1: Let's Encrypt с Certbot

#### 1. Установка Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

#### 2. Получение сертификата

```bash
sudo certbot --nginx -d ваш-домен.com
```

#### 3. Автообновление сертификата

```bash
sudo certbot renew --dry-run
```

### Вариант 2: Nginx Reverse Proxy

#### 1. Установка Nginx

```bash
sudo apt install nginx -y
```

#### 2. Создание конфигурации

```bash
sudo nano /etc/nginx/sites-available/telegram-parser
```

```nginx
server {
    listen 80;
    server_name ваш-домен.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 3. Активация конфигурации

```bash
sudo ln -s /etc/nginx/sites-available/telegram-parser /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 4. Настройка SSL

```bash
sudo certbot --nginx -d ваш-домен.com
```

## Мониторинг и логи

### Просмотр логов

```bash
# Все логи
docker-compose logs -f

# Backend
docker-compose logs -f backend

# Database
docker-compose logs -f postgres

# Последние 100 строк
docker-compose logs --tail=100 backend
```

### Мониторинг ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Использование диска
docker system df
```

### Backup базы данных

```bash
# Создание backup
docker-compose exec postgres pg_dump -U parser_user telegram_parser > backup_$(date +%Y%m%d).sql

# Восстановление
docker-compose exec -T postgres psql -U parser_user telegram_parser < backup_20240101.sql
```

## Обновление

### 1. Остановка сервисов

```bash
docker-compose down
```

### 2. Обновление кода

```bash
git pull origin main
```

### 3. Пересборка и запуск

```bash
docker-compose up -d --build
```

### 4. Проверка

```bash
docker-compose ps
docker-compose logs -f
```

## Автозапуск при перезагрузке

### Systemd service

```bash
sudo nano /etc/systemd/system/telegram-parser.service
```

```ini
[Unit]
Description=Telegram Parser
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/telegram-parser
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable telegram-parser
sudo systemctl start telegram-parser
```

## Troubleshooting

### Контейнер не запускается

```bash
# Проверка логов
docker-compose logs backend

# Пересоздание контейнера
docker-compose up -d --force-recreate backend
```

### Ошибка подключения к БД

```bash
# Проверка статуса PostgreSQL
docker-compose exec postgres pg_isready

# Перезапуск БД
docker-compose restart postgres
```

### Нехватка места на диске

```bash
# Очистка неиспользуемых образов
docker system prune -a

# Очистка volumes
docker volume prune
```

### Проблемы с производительностью

```bash
# Увеличение лимитов в docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

## Безопасность

### Рекомендации

1. ✅ Используйте сильные пароли (минимум 20 символов)
2. ✅ Включите HTTPS
3. ✅ Регулярно обновляйте систему и Docker
4. ✅ Настройте firewall
5. ✅ Делайте регулярные backup
6. ✅ Ограничьте доступ к серверу (SSH keys only)
7. ✅ Мониторьте логи на подозрительную активность

### Дополнительная защита

```bash
# Fail2ban для защиты от брутфорса
sudo apt install fail2ban -y

# Отключение root login по SSH
sudo nano /etc/ssh/sshd_config
# PermitRootLogin no
sudo systemctl restart sshd
```

## Поддержка

При возникновении проблем:
1. Проверьте логи: `docker-compose logs -f`
2. Проверьте статус: `docker-compose ps`
3. Создайте issue на GitHub
4. Обратитесь в Telegram: @your_username

---

**Успешного развертывания! 🚀**
