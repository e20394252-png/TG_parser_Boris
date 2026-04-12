"""
Общие зависимости авторизации для всех роутеров.
Импортировать: from services.auth_deps import require_user_id, verify_session_owner
"""
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import os

from database.database import db

JWT_SECRET    = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)


def require_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> int:
    """
    FastAPI dependency — извлекает user_id из JWT.
    Все защищённые эндпоинты должны использовать: user_id: int = Depends(require_user_id)
    """
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Не авторизован")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        uid = payload.get("sub")
        if uid is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный токен")
        return int(uid)
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Токен недействителен или истёк")


async def verify_session_owner(session_id: int, user_id: int) -> None:
    """
    Проверяет что сессия принадлежит пользователю.
    Бросает 404 если сессия не найдена, 403 если владелец другой.
    """
    row = await db.fetchrow(
        "SELECT user_id FROM telegram_sessions WHERE id = $1", session_id
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сессия не найдена")
    if row["user_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")


async def get_user_session_ids(user_id: int) -> list[int]:
    """Возвращает список ID сессий, принадлежащих пользователю."""
    rows = await db.fetch(
        "SELECT id FROM telegram_sessions WHERE user_id = $1", user_id
    )
    return [r["id"] for r in rows]
