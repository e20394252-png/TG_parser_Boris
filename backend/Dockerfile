FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей (включая Qt5 для opentele/PyQt5)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    libqt5core5a \
    libqt5gui5 \
    libqt5network5 \
    libqt5widgets5 \
    && rm -rf /var/lib/apt/lists/*

# Qt headless mode (без дисплея)
ENV QT_QPA_PLATFORM=offscreen

# Копирование зависимостей
COPY requirements.txt .

# Установка Python зависимостей
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода приложения
COPY . .

# Создание директории для сессий
RUN mkdir -p /app/sessions

# Открытие порта
EXPOSE 8000

# Запуск приложения (shell-форма для поддержки $PORT от Render)
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
