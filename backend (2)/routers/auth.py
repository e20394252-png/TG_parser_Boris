"""
Роутер для аутентификации Telegram
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import asyncio

from database.database import db
from services.telegram_client import TelegramClientManager

router = APIRouter()
telegram_manager = TelegramClientManager()

class TelegramAuthStart(BaseModel):
    phone_number: str
    api_id: str
    api_hash: str

class TelegramAuthCode(BaseModel):
    phone_number: str
    code: str
    password: Optional[str] = None

class AuthResponse(BaseModel):
    success: bool
    message: str
    session_id: Optional[int] = None

@router.post("/telegram/start", response_model=AuthResponse)
async def start_telegram_auth(data: TelegramAuthStart):
    """
    Начало авторизации в Telegram
    Отправляет код подтверждения на телефон
    """
    try:
        # Проверяем, существует ли уже сессия
        existing = await db.fetchrow(
            "SELECT id FROM telegram_sessions WHERE phone_number = $1",
            data.phone_number
        )
        
        if existing:
            session_id = existing['id']
            # Обновляем API credentials
            await db.execute(
                "UPDATE telegram_sessions SET api_id = $1, api_hash = $2 WHERE id = $3",
                data.api_id, data.api_hash, session_id
            )
        else:
            # Создаем новую сессию (предполагаем user_id = 1 для демо)
            session_id = await db.fetchval(
                """INSERT INTO telegram_sessions (user_id, phone_number, api_id, api_hash) 
                   VALUES (1, $1, $2, $3) RETURNING id""",
                data.phone_number, data.api_id, data.api_hash
            )
        
        # Инициализируем Telegram клиент и отправляем код
        await telegram_manager.start_auth(
            session_id=session_id,
            phone_number=data.phone_number,
            api_id=int(data.api_id),
            api_hash=data.api_hash
        )
        
        return AuthResponse(
            success=True,
            message="Код подтверждения отправлен на ваш Telegram",
            session_id=session_id
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка при отправке кода: {str(e)}"
        )

@router.post("/telegram/code", response_model=AuthResponse)
async def submit_telegram_code(data: TelegramAuthCode):
    """
    Подтверждение кода авторизации Telegram
    """
    try:
        # Получаем session_id
        session = await db.fetchrow(
            "SELECT id, api_id, api_hash FROM telegram_sessions WHERE phone_number = $1",
            data.phone_number
        )
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Сессия не найдена. Начните авторизацию заново."
            )
        
        # Подтверждаем код
        session_string = await telegram_manager.verify_code(
            session_id=session['id'],
            phone_number=data.phone_number,
            code=data.code,
            password=data.password
        )
        
        # Сохраняем session string и активируем сессию
        await db.execute(
            """UPDATE telegram_sessions 
               SET session_string = $1, is_active = true, updated_at = CURRENT_TIMESTAMP
               WHERE id = $2""",
            session_string, session['id']
        )
        
        return AuthResponse(
            success=True,
            message="Авторизация успешна!",
            session_id=session['id']
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка при подтверждении кода: {str(e)}"
        )

@router.get("/status")
async def get_auth_status():
    """
    Получение статуса авторизации
    """
    try:
        sessions = await db.fetch(
            """SELECT id, phone_number, is_active, created_at, updated_at
               FROM telegram_sessions
               ORDER BY created_at DESC"""
        )
        
        return {
            "sessions": sessions,
            "active_count": sum(1 for s in sessions if s['is_active'])
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении статуса: {str(e)}"
        )

@router.delete("/telegram/{session_id}")
async def logout_telegram(session_id: int):
    """
    Выход из Telegram аккаунта
    """
    try:
        # Деактивируем сессию
        await db.execute(
            "UPDATE telegram_sessions SET is_active = false WHERE id = $1",
            session_id
        )
        
        # Останавливаем клиент
        await telegram_manager.stop_client(session_id)
        
        return {"success": True, "message": "Выход выполнен"}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка при выходе: {str(e)}"
        )
