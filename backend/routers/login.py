"""
Роутер для входа в сервис через Telegram Login Widget.
Документация виджета: https://core.telegram.org/widgets/login
"""
import hashlib
import hmac
import time
import os
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


def create_jwt(telegram_id: int, username: Optional[str], first_name: str) -> str:
    payload = {
        "sub": str(telegram_id),
        "username": username,
        "first_name": first_name,
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
    password: str


@router.post("/password", response_model=LoginResponse)
async def login_via_password(data: PasswordLoginRequest):
    """
    Резервный вход по паролю администратора.
    Пароль задаётся через env-переменную ADMIN_PASSWORD.
    """
    admin_password = os.getenv("ADMIN_PASSWORD", "")
    if not admin_password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Вход по паролю не настроен (ADMIN_PASSWORD не задан)"
        )
    if data.password != admin_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Неверный пароль"
        )
    token = create_jwt(0, "admin", "Administrator")
    user_info = {"id": 0, "first_name": "Administrator", "last_name": None, "username": "admin", "photo_url": None}
    logger.info("✅ Login via password (admin)")
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
