"""
Роутер для управления мониторингом чатов и фильтрами
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from database.database import db

router = APIRouter()

class MonitoredChatCreate(BaseModel):
    session_id: int
    chat_id: int
    chat_title: Optional[str] = None
    chat_username: Optional[str] = None

class MessageFilterCreate(BaseModel):
    session_id: int
    name: str
    filter_type: str  # 'keyword', 'regex', 'ai'
    pattern: str
    case_sensitive: bool = False
    chat_ids: List[int] = []

@router.get("/chats")
async def get_monitored_chats(session_id: Optional[int] = None):
    """Получение списка отслеживаемых чатов"""
    try:
        if session_id:
            chats = await db.fetch(
                """SELECT id, session_id, chat_id, chat_title, chat_username, 
                          is_active, created_at
                   FROM monitored_chats 
                   WHERE session_id = $1
                   ORDER BY created_at DESC""",
                session_id
            )
        else:
            chats = await db.fetch(
                """SELECT id, session_id, chat_id, chat_title, chat_username, 
                          is_active, created_at
                   FROM monitored_chats 
                   ORDER BY created_at DESC"""
            )
        
        return {"chats": chats, "total": len(chats)}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении чатов: {str(e)}"
        )

@router.post("/chats")
async def add_monitored_chat(chat: MonitoredChatCreate):
    """Добавление чата в мониторинг"""
    try:
        # Проверяем, не добавлен ли уже этот чат
        existing = await db.fetchrow(
            "SELECT id FROM monitored_chats WHERE session_id = $1 AND chat_id = $2",
            chat.session_id, chat.chat_id
        )
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Этот чат уже добавлен в мониторинг"
            )
        
        chat_id = await db.fetchval(
            """INSERT INTO monitored_chats 
               (session_id, chat_id, chat_title, chat_username, is_active)
               VALUES ($1, $2, $3, $4, true)
               RETURNING id""",
            chat.session_id, chat.chat_id, chat.chat_title, chat.chat_username
        )
        
        return {
            "success": True,
            "message": "Чат добавлен в мониторинг",
            "chat_id": chat_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при добавлении чата: {str(e)}"
        )

@router.delete("/chats/{chat_id}")
async def remove_monitored_chat(chat_id: int):
    """Удаление чата из мониторинга"""
    try:
        await db.execute("DELETE FROM monitored_chats WHERE id = $1", chat_id)
        return {"success": True, "message": "Чат удален из мониторинга"}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при удалении чата: {str(e)}"
        )

@router.patch("/chats/{chat_id}/toggle")
async def toggle_chat_monitoring(chat_id: int):
    """Включение/выключение мониторинга чата"""
    try:
        current = await db.fetchval(
            "SELECT is_active FROM monitored_chats WHERE id = $1",
            chat_id
        )
        
        if current is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Чат не найден"
            )
        
        await db.execute(
            "UPDATE monitored_chats SET is_active = $1 WHERE id = $2",
            not current, chat_id
        )
        
        return {
            "success": True,
            "is_active": not current,
            "message": f"Мониторинг {'включен' if not current else 'выключен'}"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при переключении мониторинга: {str(e)}"
        )

@router.get("/filters")
async def get_message_filters(session_id: Optional[int] = None):
    """Получение списка фильтров сообщений"""
    try:
        if session_id:
            filters = await db.fetch(
                """SELECT f.id, f.session_id, f.name, f.filter_type, f.pattern,
                          f.case_sensitive, f.is_active, f.created_at,
                          COALESCE(
                              json_agg(
                                  json_build_object('id', mc.id, 'chat_title', mc.chat_title)
                              ) FILTER (WHERE mc.id IS NOT NULL),
                              '[]'
                          ) as chats
                   FROM message_filters f
                   LEFT JOIN filter_chat_mapping fcm ON f.id = fcm.filter_id
                   LEFT JOIN monitored_chats mc ON fcm.chat_id = mc.id
                   WHERE f.session_id = $1
                   GROUP BY f.id
                   ORDER BY f.created_at DESC""",
                session_id
            )
        else:
            filters = await db.fetch(
                """SELECT f.id, f.session_id, f.name, f.filter_type, f.pattern,
                          f.case_sensitive, f.is_active, f.created_at,
                          COALESCE(
                              json_agg(
                                  json_build_object('id', mc.id, 'chat_title', mc.chat_title)
                              ) FILTER (WHERE mc.id IS NOT NULL),
                              '[]'
                          ) as chats
                   FROM message_filters f
                   LEFT JOIN filter_chat_mapping fcm ON f.id = fcm.filter_id
                   LEFT JOIN monitored_chats mc ON fcm.chat_id = mc.id
                   GROUP BY f.id
                   ORDER BY f.created_at DESC"""
            )
        
        return {"filters": filters, "total": len(filters)}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении фильтров: {str(e)}"
        )

@router.post("/filters")
async def create_message_filter(filter_data: MessageFilterCreate):
    """Создание нового фильтра сообщений"""
    try:
        async with db.transaction() as conn:
            # Создаем фильтр
            filter_id = await conn.fetchval(
                """INSERT INTO message_filters 
                   (session_id, name, filter_type, pattern, case_sensitive, is_active)
                   VALUES ($1, $2, $3, $4, $5, true)
                   RETURNING id""",
                filter_data.session_id, filter_data.name, filter_data.filter_type,
                filter_data.pattern, filter_data.case_sensitive
            )
            
            # Связываем с чатами
            if filter_data.chat_ids:
                for chat_id in filter_data.chat_ids:
                    await conn.execute(
                        """INSERT INTO filter_chat_mapping (filter_id, chat_id)
                           VALUES ($1, $2)
                           ON CONFLICT DO NOTHING""",
                        filter_id, chat_id
                    )
        
        return {
            "success": True,
            "message": "Фильтр создан",
            "filter_id": filter_id
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании фильтра: {str(e)}"
        )

@router.delete("/filters/{filter_id}")
async def delete_message_filter(filter_id: int):
    """Удаление фильтра"""
    try:
        await db.execute("DELETE FROM message_filters WHERE id = $1", filter_id)
        return {"success": True, "message": "Фильтр удален"}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при удалении фильтра: {str(e)}"
        )

@router.patch("/filters/{filter_id}/toggle")
async def toggle_filter(filter_id: int):
    """Включение/выключение фильтра"""
    try:
        current = await db.fetchval(
            "SELECT is_active FROM message_filters WHERE id = $1",
            filter_id
        )
        
        if current is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Фильтр не найден"
            )
        
        await db.execute(
            "UPDATE message_filters SET is_active = $1 WHERE id = $2",
            not current, filter_id
        )
        
        return {
            "success": True,
            "is_active": not current,
            "message": f"Фильтр {'включен' if not current else 'выключен'}"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при переключении фильтра: {str(e)}"
        )
