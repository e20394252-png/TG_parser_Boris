# Управление паролями пользователей

## Где задаются пароли

**Единственное место** — переменная окружения `SEED_USERS` в Render Dashboard:

```
Render → backend сервис → Environment Variables → SEED_USERS
```

### Формат

```
логин:пароль:роль,логин:пароль:роль,...
```

### Пример

```
admin:МойПароль:admin,user1:ПарольUser1:user,user2:ПарольUser2:user
```

Доступные роли: `admin`, `user`

---

## Как хранятся пароли

При каждом старте backend-а сервис `backend/services/user_seed.py`:
1. Читает переменную `SEED_USERS`
2. Генерирует **bcrypt-хэш** для каждого пароля
3. Записывает (или обновляет) хэш в таблицу `users` PostgreSQL

```sql
-- Таблица users в PostgreSQL
id | username | password_hash
1  | admin    | $2b$12$... (bcrypt-хэш)
2  | user1    | $2b$12$...
```

**Пароли в открытом виде нигде не хранятся** — только bcrypt-хэши.

---

## Как работает вход

```
Браузер
  └─► POST /api/login/password  { username, password }
        └─► login.py
              └─► SELECT password_hash FROM users WHERE username = ?
              └─► bcrypt.checkpw(введённый_пароль, hash)
              └─► Если совпало → выдать JWT токен
              └─► Если нет    → 403 Неверный логин или пароль
```

JWT токен содержит `user_id` и хранится в `localStorage` браузера.

---

## Как сменить пароль

1. Открыть **Render Dashboard → backend → Environment Variables**
2. Найти `SEED_USERS` и изменить нужный пароль
3. Нажать **"Save Changes"**
4. Backend перезапустится автоматически
5. При старте `user_seed.py` обновит хэши в БД

> ⚠️ **Важно**: пароли обновляются только при рестарте backend-а.
> Render автоматически перезапускает сервис после сохранения переменных окружения.

---

## Добавление нового пользователя

Дописать в `SEED_USERS`:

```
...существующие...,newuser:пароль:user
```

После рестарта пользователь появится в БД.

---

## Файлы, связанные с аутентификацией

| Файл | Назначение |
|------|-----------|
| `backend/services/user_seed.py` | Создаёт/обновляет пользователей при старте |
| `backend/routers/login.py` | Эндпоинты входа (пароль + Telegram) |
| `backend/services/auth_deps.py` | JWT-зависимость для защиты роутеров |
| `render.yaml` | Описание сервисов (переменная `SEED_USERS` с дефолтом) |

---

## Текущие пользователи по умолчанию

Задаются в `render.yaml` (значение по умолчанию):

```
admin:admin:admin
user1:user1:user
user2:user2:user
```

> ⚠️ **Смените пароль `admin` перед продакшн-использованием!**
