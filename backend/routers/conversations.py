"""
Роутер для работы с диалогами и текстовым поиском по сообщениям
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional
import logging

from database.database import db
from services.auth_deps import require_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/conversations", tags=["conversations"])


class SearchRequest(BaseModel):
    query: str
    chat_id: Optional[int] = None
    limit: int = 20


class IndexRequest(BaseModel):
    chat_id: int
    limit: int = 100


async def _get_user_session_id(user_id: int) -> Optional[int]:
    """Возвращает session_id активной сессии пользователя."""
    row = await db.fetchrow(
        """SELECT id FROM telegram_sessions
           WHERE user_id = $1 AND is_active = true
           ORDER BY updated_at DESC LIMIT 1""",
        user_id
    )
    return row["id"] if row else None


@router.post("/search")
async def search_conversations(
    request: SearchRequest,
    user_id: int = Depends(require_user_id)
):
    """Полнотекстовый поиск по диалогам текущего пользователя."""
    if not request.query.strip():
        return {"success": True, "results": [], "total": 0}

    session_id = await _get_user_session_id(user_id)
    if not session_id:
        return {"success": True, "results": [], "total": 0,
                "hint": "Нет активной Telegram-сессии"}

    pattern = f"%{request.query.strip()}%"

    query_sql = """
        SELECT id, message_id, sender_username, message_text,
               message_date, is_outgoing, chat_id
        FROM conversation_messages
        WHERE session_id = $1
          AND message_text ILIKE $2
          {chat_filter}
        ORDER BY message_date DESC
        LIMIT $3
    """

    if request.chat_id:
        query_sql = query_sql.format(chat_filter="AND chat_id = $4")
        messages = await db.fetch(
            query_sql, session_id, pattern, request.limit, request.chat_id
        )
    else:
        query_sql = query_sql.format(chat_filter="")
        messages = await db.fetch(query_sql, session_id, pattern, request.limit)

    results = [
        {
            "id":         m["id"],
            "message_id": m["message_id"],
            "sender":     m["sender_username"] or "Unknown",
            "message":    m["message_text"],
            "date":       m["message_date"].isoformat() if m["message_date"] else None,
            "is_outgoing": m["is_outgoing"],
            "chat_id":    m["chat_id"],
            "similarity": 1.0,   # для совместимости с UI
        }
        for m in messages
    ]

    return {"success": True, "results": results, "total": len(results)}


@router.get("/messages")
async def get_messages(
    chat_id: int,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user_id: int = Depends(require_user_id)
):
    """Получение сообщений из чата."""
    session_id = await _get_user_session_id(user_id)
    if not session_id:
        return {"success": True, "messages": [], "total": 0}

    messages = await db.fetch(
        """SELECT id, message_id, sender_username, message_text,
                  message_date, is_outgoing
           FROM conversation_messages
           WHERE session_id = $1 AND chat_id = $2
           ORDER BY message_date DESC
           LIMIT $3 OFFSET $4""",
        session_id, chat_id, limit, offset
    )
    total = await db.fetchval(
        "SELECT COUNT(*) FROM conversation_messages WHERE session_id=$1 AND chat_id=$2",
        session_id, chat_id
    )
    return {
        "success": True,
        "messages": [
            {
                "id":         m["id"],
                "message_id": m["message_id"],
                "sender":     m["sender_username"] or "Unknown",
                "text":       m["message_text"],
                "date":       m["message_date"].isoformat() if m["message_date"] else None,
                "is_outgoing": m["is_outgoing"],
            }
            for m in messages
        ],
        "total": total,
    }


@router.get("/stats")
async def get_stats(user_id: int = Depends(require_user_id)):
    """Статистика по диалогам текущего пользователя."""
    session_id = await _get_user_session_id(user_id)
    if not session_id:
        return {"success": True, "stats": {
            "total_messages": 0, "total_indexed": 0,
            "chats_count": 0, "index_coverage": 0
        }}

    total_messages = await db.fetchval(
        "SELECT COUNT(*) FROM conversation_messages WHERE session_id=$1", session_id
    )
    total_indexed = await db.fetchval(
        "SELECT COUNT(*) FROM conversation_embeddings WHERE session_id=$1", session_id
    ) if await _table_exists("conversation_embeddings") else 0

    chats_count = await db.fetchval(
        "SELECT COUNT(DISTINCT chat_id) FROM conversation_messages WHERE session_id=$1",
        session_id
    )
    coverage = round(total_indexed / total_messages * 100, 1) if total_messages else 0

    return {
        "success": True,
        "stats": {
            "total_messages": total_messages,
            "total_indexed":  total_indexed,
            "chats_count":    chats_count,
            "index_coverage": coverage,
        }
    }


@router.get("/context/{message_id}")
async def get_context(
    message_id: int,
    context_size: int = Query(5, le=20),
    user_id: int = Depends(require_user_id)
):
    """Контекст вокруг сообщения (соседние сообщения)."""
    # Получаем целевое сообщение
    msg = await db.fetchrow(
        """SELECT session_id, chat_id, message_date
           FROM conversation_messages WHERE id=$1""",
        message_id
    )
    if not msg:
        return {"success": True, "context": []}

    session_id = await _get_user_session_id(user_id)
    if not session_id or msg["session_id"] != session_id:
        return {"success": True, "context": []}

    context = await db.fetch(
        """SELECT id, sender_username, message_text, message_date, is_outgoing
           FROM conversation_messages
           WHERE session_id=$1 AND chat_id=$2
             AND message_date BETWEEN $3 - INTERVAL '1 hour' AND $3 + INTERVAL '1 hour'
           ORDER BY message_date
           LIMIT $4""",
        session_id, msg["chat_id"], msg["message_date"], context_size * 2 + 1
    )

    return {
        "success": True,
        "context": [
            {
                "id":         c["id"],
                "sender":     c["sender_username"] or "Unknown",
                "text":       c["message_text"],
                "date":       c["message_date"].isoformat() if c["message_date"] else None,
                "is_outgoing": c["is_outgoing"],
            }
            for c in context
        ]
    }


async def _table_exists(table_name: str) -> bool:
    """Проверяет что таблица существует в БД."""
    try:
        result = await db.fetchval(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name=$1)",
            table_name
        )
        return bool(result)
    except Exception:
        return False
