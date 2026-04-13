"""
Роутер для управления мониторингом чатов и фильтрами
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from database.database import db
from services.auth_deps import require_user_id, verify_session_owner
from services.telegram_client import TelegramClientManager

router = APIRouter()
_tg_manager = TelegramClientManager()

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
async def get_monitored_chats(
    session_id: Optional[int] = None,
    user_id: int = Depends(require_user_id)
):
    """Получение списка отслеживаемых чатов — только своих"""
    try:
        if session_id:
            await verify_session_owner(session_id, user_id)
            chats = await db.fetch(
                """SELECT id, session_id, chat_id, chat_title, chat_username, 
                          is_active, created_at
                   FROM monitored_chats 
                   WHERE session_id = $1
                   ORDER BY created_at DESC""",
                session_id
            )
        else:
            # Возвращаем чаты всех сессий пользователя
            chats = await db.fetch(
                """SELECT mc.id, mc.session_id, mc.chat_id, mc.chat_title,
                          mc.chat_username, mc.is_active, mc.created_at
                   FROM monitored_chats mc
                   JOIN telegram_sessions ts ON mc.session_id = ts.id
                   WHERE ts.user_id = $1
                   ORDER BY mc.created_at DESC""",
                user_id
            )
        
        return {"chats": chats, "total": len(chats)}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении чатов: {str(e)}"
        )

@router.post("/chats")
async def add_monitored_chat(
    chat: MonitoredChatCreate,
    user_id: int = Depends(require_user_id)
):
    """Добавление чата в мониторинг"""
    try:
        await verify_session_owner(chat.session_id, user_id)
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
async def remove_monitored_chat(
    chat_id: int,
    user_id: int = Depends(require_user_id)
):
    """Удаление чата из мониторинга"""
    try:
        # Проверяем владельца через JOIN
        row = await db.fetchrow(
            """SELECT ts.user_id FROM monitored_chats mc
               JOIN telegram_sessions ts ON mc.session_id = ts.id
               WHERE mc.id = $1""", chat_id
        )
        if not row or row["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Доступ запрещён")
        await db.execute("DELETE FROM monitored_chats WHERE id = $1", chat_id)
        return {"success": True, "message": "Чат удален из мониторинга"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при удалении чата: {str(e)}"
        )

@router.patch("/chats/{chat_id}/toggle")
async def toggle_chat_monitoring(
    chat_id: int,
    user_id: int = Depends(require_user_id)
):
    """Включение/выключение мониторинга чата"""
    try:
        row = await db.fetchrow(
            """SELECT mc.is_active, ts.user_id FROM monitored_chats mc
               JOIN telegram_sessions ts ON mc.session_id = ts.id
               WHERE mc.id = $1""", chat_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Чат не найден")
        if row["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Доступ запрещён")
        current = row["is_active"]
        
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
async def get_message_filters(
    session_id: Optional[int] = None,
    user_id: int = Depends(require_user_id)
):
    """Получение списка фильтров — только свои"""
    try:
        if session_id:
            await verify_session_owner(session_id, user_id)
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
                   JOIN telegram_sessions ts ON f.session_id = ts.id
                   LEFT JOIN filter_chat_mapping fcm ON f.id = fcm.filter_id
                   LEFT JOIN monitored_chats mc ON fcm.chat_id = mc.id
                   WHERE ts.user_id = $1
                   GROUP BY f.id
                   ORDER BY f.created_at DESC""",
                user_id
            )
        
        return {"filters": filters, "total": len(filters)}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении фильтров: {str(e)}"
        )

@router.post("/filters")
async def create_message_filter(
    filter_data: MessageFilterCreate,
    user_id: int = Depends(require_user_id)
):
    """Создание нового фильтра сообщений"""
    try:
        await verify_session_owner(filter_data.session_id, user_id)
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
async def delete_message_filter(
    filter_id: int,
    user_id: int = Depends(require_user_id)
):
    """Удаление фильтра"""
    try:
        row = await db.fetchrow(
            """SELECT ts.user_id FROM message_filters f
               JOIN telegram_sessions ts ON f.session_id = ts.id
               WHERE f.id = $1""", filter_id
        )
        if not row or row["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Доступ запрещён")
        await db.execute("DELETE FROM message_filters WHERE id = $1", filter_id)
        return {"success": True, "message": "Фильтр удален"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при удалении фильтра: {str(e)}"
        )

@router.patch("/filters/{filter_id}/toggle")
async def toggle_filter(
    filter_id: int,
    user_id: int = Depends(require_user_id)
):
    """Включение/выключение фильтра"""
    try:
        row = await db.fetchrow(
            """SELECT f.is_active, ts.user_id FROM message_filters f
               JOIN telegram_sessions ts ON f.session_id = ts.id
               WHERE f.id = $1""", filter_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Фильтр не найден")
        if row["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Доступ запрещён")
        current = row["is_active"]
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


# ── Резолвинг чата по ссылке / юзернейму ─────────────────────────────────────

class ResolveChatRequest(BaseModel):
    session_id: int
    query: str  # https://t.me/username | t.me/username | @username | username


def _parse_username(query: str) -> str:
    """Извлекает username из любого формата ввода."""
    q = query.strip()
    if "t.me/" in q:
        # https://t.me/sochiworld  или  t.me/sochiworld/123
        q = q.split("t.me/")[-1].split("/")[0].split("?")[0]
    if q.startswith("@"):
        q = q[1:]
    return q.strip()


@router.post("/resolve-chat")
async def resolve_chat(
    data: ResolveChatRequest,
    user_id: int = Depends(require_user_id),
):
    """
    Резолвит публичный чат по ссылке или @username через активную Telegram-сессию.
    Возвращает {chat_id, title, username} для подтверждения перед добавлением.
    """
    await verify_session_owner(data.session_id, user_id)

    session = await db.fetchrow(
        "SELECT api_id, api_hash, session_string FROM telegram_sessions WHERE id = $1",
        data.session_id,
    )
    if not session or not session["session_string"]:
        raise HTTPException(
            status_code=400,
            detail="Telegram-сессия не подключена. Сначала авторизуйтесь в разделе «Авторизация ТГ».",
        )

    username = _parse_username(data.query)
    if not username:
        raise HTTPException(status_code=400, detail="Не удалось распознать ссылку или username")

    try:
        client = await _tg_manager.get_client(
            data.session_id,
            int(session["api_id"]),
            session["api_hash"],
            session["session_string"],
        )
        entity = await client.get_entity(username)

        raw_id   = entity.id
        title    = getattr(entity, "title", None) or getattr(entity, "first_name", username)
        uname    = getattr(entity, "username", None)

        return {
            "chat_id":  raw_id,
            "title":    title,
            "username": f"@{uname}" if uname else None,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Не удалось найти чат: {str(e)}")
