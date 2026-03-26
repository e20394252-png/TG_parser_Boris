"""
Роутер для работы с диалогами и семантическим поиском
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from database.database import db
from services.rag_service import RAGService

router = APIRouter(prefix="/conversations", tags=["conversations"])
rag_service = RAGService()

class SearchRequest(BaseModel):
    query: str
    chat_id: Optional[int] = None
    limit: int = 10

class IndexRequest(BaseModel):
    chat_id: int
    limit: int = 100

@router.post("/search")
async def search_conversations(request: SearchRequest, session_id: Optional[int] = Query(None)):
    """Семантический поиск по диалогам"""
    try:
        if not session_id:
            session_id = 1  # TODO: получать из контекста авторизации
        
        results = await rag_service.search_conversations(
            query=request.query,
            session_id=session_id,
            chat_id=request.chat_id,
            limit=request.limit
        )
        
        return {
            "success": True,
            "results": results,
            "total": len(results)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/messages")
async def get_messages(
    chat_id: int,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    session_id: Optional[int] = Query(None)
):
    """Получение сообщений из чата"""
    try:
        if not session_id:
            session_id = 1
        
        messages = await db.fetch(
            """SELECT id, message_id, sender_id, sender_username, message_text, 
                      message_date, is_outgoing
               FROM conversation_messages
               WHERE session_id = $1 AND chat_id = $2
               ORDER BY message_date DESC
               LIMIT $3 OFFSET $4""",
            session_id, chat_id, limit, offset
        )
        
        total = await db.fetchval(
            "SELECT COUNT(*) FROM conversation_messages WHERE session_id = $1 AND chat_id = $2",
            session_id, chat_id
        )
        
        return {
            "success": True,
            "messages": [{
                'id': m['id'],
                'message_id': m['message_id'],
                'sender_id': m['sender_id'],
                'sender': m['sender_username'] or 'Unknown',
                'text': m['message_text'],
                'date': m['message_date'],
                'is_outgoing': m['is_outgoing']
            } for m in messages],
            "total": total
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/index")
async def index_chat(request: IndexRequest, session_id: Optional[int] = Query(None)):
    """Ручная индексация сообщений чата в RAG"""
    try:
        if not session_id:
            session_id = 1
        
        # Получаем последние сообщения из чата
        messages = await db.fetch(
            """SELECT id FROM conversation_messages
               WHERE session_id = $1 AND chat_id = $2
               ORDER BY message_date DESC
               LIMIT $3""",
            session_id, request.chat_id, request.limit
        )
        
        indexed_count = 0
        for msg in messages:
            try:
                await rag_service.index_conversation_message(msg['id'], session_id)
                indexed_count += 1
            except Exception as e:
                print(f"⚠️ Ошибка индексации сообщения {msg['id']}: {str(e)}")
        
        return {
            "success": True,
            "indexed": indexed_count,
            "total": len(messages)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_stats(session_id: Optional[int] = Query(None)):
    """Статистика по диалогам"""
    try:
        if not session_id:
            session_id = 1
        
        total_messages = await db.fetchval(
            "SELECT COUNT(*) FROM conversation_messages WHERE session_id = $1",
            session_id
        )
        
        total_indexed = await db.fetchval(
            "SELECT COUNT(*) FROM conversation_embeddings WHERE session_id = $1",
            session_id
        )
        
        chats_count = await db.fetchval(
            "SELECT COUNT(DISTINCT chat_id) FROM conversation_messages WHERE session_id = $1",
            session_id
        )
        
        return {
            "success": True,
            "stats": {
                "total_messages": total_messages,
                "total_indexed": total_indexed,
                "chats_count": chats_count,
                "index_coverage": round(total_indexed / total_messages * 100, 2) if total_messages > 0 else 0
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/context/{message_id}")
async def get_context(message_id: int, context_size: int = Query(5, le=20)):
    """Получение контекста вокруг сообщения"""
    try:
        context = await rag_service.get_conversation_context(message_id, context_size)
        
        return {
            "success": True,
            "context": context
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
