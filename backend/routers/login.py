"""
Роутер для входа в сервис через Telegram Login Widget или Telegram Bot (deep link).
Документация виджета: https://core.telegram.org/widgets/login
"""
import hashlib
import hmac
import time
import os
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import jwt, JWTError

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)

# ──────────────── Конфигурация ────────────────

BOT_TOKEN        = os.getenv("TELEGRAM_BOT_TOKEN", "")
JWT_SECRET       = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM    = "HS256"
JWT_EXPIRE_DAYS  = 30

# Разрешённые Telegram ID (через запятую в env-переменной)
# Пример: ALLOWED_TELEGRAM_IDS=123456789,987654321
_raw_ids = os.getenv("ALLOWED_TELEGRAM_IDS", "")
ALLOWED_IDS: set[int] = {
    int(x.strip()) for x in _raw_ids.split(",") if x.strip().isdigit()
}

# ──────────────── Схемы ────────────────

class TelegramAuthData(BaseModel):
    """Данные, возвращаемые Telegram Login Widget"""
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


class LoginResponse(BaseModel):
    token: str
    user: dict


# ──────────────── Хелперы ────────────────

def verify_telegram_data(data: TelegramAuthData) -> bool:
    """
    Verifies the Telegram Login Widget signature.
    https://core.telegram.org/widgets/login#checking-authorization
    """
    if not BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN is not set!")
        return False

    # Проверяем свежесть данных (не старше 24 часов)
    if time.time() - data.auth_date > 86400:
        logger.warning(f"Telegram auth data is too old: {data.auth_date}")
        return False

    # Формируем строку для проверки (все поля кроме hash, отсортированные)
    fields = {
        "id": str(data.id),
        "auth_date": str(data.auth_date),
        "first_name": data.first_name,
    }
    if data.last_name:
        fields["last_name"] = data.last_name
    if data.username:
        fields["username"] = data.username
    if data.photo_url:
        fields["photo_url"] = data.photo_url

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))

    # secret_key = SHA256(bot_token) — важно: не HMAC, а просто SHA256
    secret_key = hashlib.sha256(BOT_TOKEN.encode()).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    return hmac.compare_digest(expected_hash, data.hash)


def create_jwt(user_id: int, username: Optional[str], first_name: str, role: str = "user") -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "first_name": first_name,
        "role": role,
        "exp": int(time.time()) + JWT_EXPIRE_DAYS * 86400,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# ──────────────── Dependency ────────────────

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """FastAPI dependency — проверяет JWT и возвращает данные пользователя."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Не авторизован")
    try:
        payload = decode_jwt(credentials.credentials)
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Токен недействителен")


# ──────────────── Endpoints ────────────────

class PasswordLoginRequest(BaseModel):
    username: str
    password: str


@router.post("/password", response_model=LoginResponse)
async def login_via_password(data: PasswordLoginRequest):
    """
    Вход по username + password.
    Пользователи создаются автоматически при старте (SeedUsers).
    """
    import bcrypt as _bcrypt
    from database.database import db

    user = await db.fetchrow(
        "SELECT id, username, password_hash, role FROM users WHERE username = $1",
        data.username
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Неверный логин или пароль"
        )

    pw_bytes   = data.password.encode("utf-8")
    hash_bytes = user["password_hash"].encode("utf-8")
    if not _bcrypt.checkpw(pw_bytes, hash_bytes):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Неверный логин или пароль"
        )

    # Обновляем last_login
    await db.execute(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
        user["id"]
    )

    role  = user.get("role") or "user"
    token = create_jwt(user["id"], data.username, data.username, role)
    user_info = {
        "id":         user["id"],
        "first_name": data.username,
        "last_name":  None,
        "username":   data.username,
        "photo_url":  None,
        "role":       role,
    }
    logger.info(f"✅ Login: {data.username} (id={user['id']}, role={role})")
    return LoginResponse(token=token, user=user_info)


@router.post("/telegram", response_model=LoginResponse)
async def login_via_telegram(data: TelegramAuthData):
    """
    Принимает данные от Telegram Login Widget, верифицирует подпись,
    проверяет whitelist и возвращает JWT-токен.
    """
    # 1. Проверяем подпись
    if not verify_telegram_data(data):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Данные авторизации Telegram недействительны или устарели"
        )

    # 2. Проверяем whitelist (если список задан — проверяем, иначе пропускаем)
    if ALLOWED_IDS and data.id not in ALLOWED_IDS:
        logger.warning(f"Unauthorized Telegram ID: {data.id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён. Ваш Telegram ID не в списке разрешённых."
        )

    # 3. Выдаём JWT
    token = create_jwt(data.id, data.username, data.first_name)

    user_info = {
        "id": data.id,
        "first_name": data.first_name,
        "last_name": data.last_name,
        "username": data.username,
        "photo_url": data.photo_url,
    }

    logger.info(f"✅ Login: @{data.username} (id={data.id})")
    return LoginResponse(token=token, user=user_info)


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Возвращает данные текущего пользователя из JWT."""
    return current_user


@router.get("/config")
async def get_login_config():
    """Возвращает публичную конфигурацию для фронтенда (имя бота)."""
    bot_name = os.getenv("TELEGRAM_BOT_NAME", "")
    return {
        "bot_name": bot_name,
        "auth_enabled": bool(BOT_TOKEN),
    }


# ──────────────── Setup & Password Management ────────────────

@router.get("/setup-needed")
async def setup_needed():
    """Проверяет, нужна ли первоначальная настройка (нет ни одного пользователя в БД)."""
    from database.database import db
    count = await db.fetchval("SELECT COUNT(*) FROM users")
    return {"needed": count == 0}


class SetupRequest(BaseModel):
    username: str
    password: str


@router.post("/setup", response_model=LoginResponse)
async def initial_setup(data: SetupRequest):
    """
    Создаёт первого admin-пользователя.
    Работает ТОЛЬКО если в БД нет ни одного пользователя.
    """
    from database.database import db
    import bcrypt as _bcrypt

    count = await db.fetchval("SELECT COUNT(*) FROM users")
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Система уже настроена. Используйте обычный вход."
        )

    if len(data.username.strip()) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Логин слишком короткий")
    if len(data.password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пароль должен быть не менее 8 символов")

    hashed = _bcrypt.hashpw(data.password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")
    user_id = await db.fetchval(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin') RETURNING id",
        data.username.strip(), hashed
    )

    token = create_jwt(user_id, data.username, data.username, "admin")
    user_info = {
        "id":         user_id,
        "first_name": data.username,
        "last_name":  None,
        "username":   data.username,
        "photo_url":  None,
        "role":       "admin",
    }
    logger.info(f"✅ Initial setup: created admin '{data.username}' (id={user_id})")
    return LoginResponse(token=token, user=user_info)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """Смена пароля для текущего авторизованного пользователя."""
    from database.database import db
    import bcrypt as _bcrypt

    user_id = int(current_user["sub"])
    row = await db.fetchrow("SELECT password_hash FROM users WHERE id = $1", user_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    if not _bcrypt.checkpw(data.current_password.encode("utf-8"), row["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Неверный текущий пароль")

    if len(data.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Новый пароль должен быть не менее 8 символов")

    new_hash = _bcrypt.hashpw(data.new_password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")
    await db.execute("UPDATE users SET password_hash = $1 WHERE id = $2", new_hash, user_id)

    logger.info(f"✅ Password changed for user_id={user_id}")
    return {"success": True, "message": "Пароль успешно изменён"}


# ──────────────── User Management ────────────────

@router.get("/users")
async def list_users(current_user: dict = Depends(get_current_user)):
    """Список всех пользователей — только для admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только для администратора")
    from database.database import db
    rows = await db.fetch(
        "SELECT id, username, role, last_login, created_at FROM users ORDER BY id"
    )
    return {"users": [dict(r) for r in rows]}


class CreateUserRequest(BaseModel):
    username: str
    password: str


@router.post("/users", status_code=201)
async def create_user(
    data: CreateUserRequest,
    current_user: dict = Depends(get_current_user),
):
    """Создать нового пользователя — только для admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только для администратора")
    from database.database import db
    import bcrypt as _bcrypt

    if len(data.username.strip()) < 2:
        raise HTTPException(status_code=400, detail="Логин слишком короткий")
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Пароль должен быть не менее 8 символов")

    hashed = _bcrypt.hashpw(data.password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")
    try:
        user_id = await db.fetchval(
            "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
            data.username.strip(), hashed
        )
    except Exception:
        raise HTTPException(status_code=409, detail="Пользователь с таким логином уже существует")

    logger.info(f"✅ Created user '{data.username}' (id={user_id}) by admin {current_user.get('username')}")
    return {"id": user_id, "username": data.username.strip()}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Удалить пользователя — только для admin. Нельзя удалить себя."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только для администратора")
    from database.database import db

    me = int(current_user["sub"])
    if user_id == me:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")

    result = await db.execute("DELETE FROM users WHERE id = $1", user_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    logger.info(f"🗑 Deleted user_id={user_id} by admin {current_user.get('username')}")
    return {"success": True}


# ──────────────── Telegram Bot Deep-Link Auth ────────────────

BOT_TOKEN = os.getenv("TELEGRAM_AUTH_BOT_TOKEN", "")
BOT_NAME = os.getenv("TELEGRAM_AUTH_BOT_NAME", "tg_parser_auth_bot")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://telegram-parser-frontend.onrender.com")


class BotInitResponse(BaseModel):
    state: str
    tg_url: str


@router.get("/bot/init", response_model=BotInitResponse)
async def bot_auth_init():
    """
    Генерирует одноразовый state-токен (UUID) и возвращает deep-link на бота.
    Frontend перенаправляет пользователя по этой ссылке, затем опрашивает /bot/check.
    """
    from database.database import db

    # Чистим устаревшие записи (старше 15 минут)
    await db.execute(
        "DELETE FROM tg_bot_auth_states WHERE expires_at < NOW()"
    )

    state = str(uuid.uuid4())
    await db.execute(
        """
        INSERT INTO tg_bot_auth_states (state)
        VALUES ($1::uuid)
        """,
        state,
    )

    tg_url = f"https://t.me/{BOT_NAME}?start={state}"
    logger.info(f"[BotAuth] Init: state={state}")
    return BotInitResponse(state=state, tg_url=tg_url)


class BotCheckResponse(BaseModel):
    status: str          # "pending" | "confirmed" | "expired" | "not_found"
    token: Optional[str] = None
    user: Optional[dict] = None


@router.get("/bot/check", response_model=BotCheckResponse)
async def bot_auth_check(state: str):
    """
    Проверяет статус state-токена.
    Если confirmed=true — выдаёт JWT и удаляет запись.
    """
    from database.database import db

    row = await db.fetchrow(
        """
        SELECT confirmed, tg_username, tg_user_id, expires_at
        FROM tg_bot_auth_states
        WHERE state = $1::uuid
        """,
        state,
    )

    if row is None:
        return BotCheckResponse(status="not_found")

    # Проверяем TTL
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    expires = row["expires_at"]
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if now > expires:
        await db.execute("DELETE FROM tg_bot_auth_states WHERE state = $1::uuid", state)
        return BotCheckResponse(status="expired")

    if not row["confirmed"]:
        return BotCheckResponse(status="pending")

    # ── Пользователь подтвердил ──
    tg_username = row["tg_username"] or f"id{row['tg_user_id']}"
    tg_user_id  = row["tg_user_id"]

    # Проверяем whitelist (если задан)
    if ALLOWED_IDS and tg_user_id not in ALLOWED_IDS:
        await db.execute("DELETE FROM tg_bot_auth_states WHERE state = $1::uuid", state)
        logger.warning(f"[BotAuth] Unauthorized TG ID: {tg_user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён. Ваш Telegram ID не в списке разрешённых."
        )

    # Уpsert-пользователь в таблицу users по tg_username
    # (чтобы работал require_user_id и другие зависимости)
    existing_user_id = await db.fetchval(
        "SELECT id FROM users WHERE username = $1", tg_username
    )
    if existing_user_id is None:
        existing_user_id = await db.fetchval(
            """
            INSERT INTO users (username, password_hash)
            VALUES ($1, 'tg_bot_no_password')
            RETURNING id
            """,
            tg_username,
        )
        logger.info(f"[BotAuth] Created new user '{tg_username}' (id={existing_user_id})")

    # Обновляем last_login
    await db.execute(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
        existing_user_id,
    )

    # Удаляем одноразовый state
    await db.execute("DELETE FROM tg_bot_auth_states WHERE state = $1::uuid", state)

    token = create_jwt(existing_user_id, tg_username, tg_username, "user")
    user_info = {
        "id":         existing_user_id,
        "first_name": tg_username,
        "last_name":  None,
        "username":   tg_username,
        "photo_url":  None,
        "role":       "user",
    }
    logger.info(f"[BotAuth] Confirmed: @{tg_username} (tg_id={tg_user_id})")
    return BotCheckResponse(status="confirmed", token=token, user=user_info)
