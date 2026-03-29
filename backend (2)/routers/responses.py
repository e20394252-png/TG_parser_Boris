"""
Роутер для управления автоответами
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from database.database import db

router = APIRouter()

class AutoResponseCreate(BaseModel):
    session_id: int
    name: str
    response_type: str  # 'template', 'ai_generated', 'rag'
    template_text: Optional[str] = None
    use_ai: bool = False
    ai_provider_id: Optional[int] = None
    use_rag: bool = False
    filter_ids: List[int] = []

@router.get("/templates")
async def get_response_templates(session_id: Optional[int] = None):
    """Получение списка шаблонов ответов"""
    try:
        if session_id:
            templates = await db.fetch(
                """SELECT r.id, r.session_id, r.name, r.response_type, r.template_text,
                          r.use_ai, r.ai_provider_id, r.use_rag, r.is_active, r.created_at,
                          COALESCE(
                              json_agg(
                                  json_build_object('id', f.id, 'name', f.name)
                              ) FILTER (WHERE f.id IS NOT NULL),
                              '[]'
                          ) as filters
                   FROM auto_responses r
                   LEFT JOIN filter_response_mapping frm ON r.id = frm.response_id
                   LEFT JOIN message_filters f ON frm.filter_id = f.id
                   WHERE r.session_id = $1
                   GROUP BY r.id
                   ORDER BY r.created_at DESC""",
                session_id
            )
        else:
            templates = await db.fetch(
                """SELECT r.id, r.session_id, r.name, r.response_type, r.template_text,
                          r.use_ai, r.ai_provider_id, r.use_rag, r.is_active, r.created_at,
                          COALESCE(
                              json_agg(
                                  json_build_object('id', f.id, 'name', f.name)
                              ) FILTER (WHERE f.id IS NOT NULL),
                              '[]'
                          ) as filters
                   FROM auto_responses r
                   LEFT JOIN filter_response_mapping frm ON r.id = frm.response_id
                   LEFT JOIN message_filters f ON frm.filter_id = f.id
                   GROUP BY r.id
                   ORDER BY r.created_at DESC"""
            )
        
        return {"templates": templates, "total": len(templates)}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении шаблонов: {str(e)}"
        )

@router.post("/templates")
async def create_response_template(response: AutoResponseCreate):
    """Создание нового шаблона ответа"""
    try:
        async with db.transaction() as conn:
            # Создаем шаблон
            response_id = await conn.fetchval(
                """INSERT INTO auto_responses 
                   (session_id, name, response_type, template_text, use_ai, 
                    ai_provider_id, use_rag, is_active)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                   RETURNING id""",
                response.session_id, response.name, response.response_type,
                response.template_text, response.use_ai, response.ai_provider_id,
                response.use_rag
            )
            
            # Связываем с фильтрами
            if response.filter_ids:
                for filter_id in response.filter_ids:
                    await conn.execute(
                        """INSERT INTO filter_response_mapping (filter_id, response_id)
                           VALUES ($1, $2)
                           ON CONFLICT DO NOTHING""",
                        filter_id, response_id
                    )
        
        return {
            "success": True,
            "message": "Шаблон ответа создан",
            "response_id": response_id
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании шаблона: {str(e)}"
        )

@router.delete("/templates/{response_id}")
async def delete_response_template(response_id: int):
    """Удаление шаблона ответа"""
    try:
        await db.execute("DELETE FROM auto_responses WHERE id = $1", response_id)
        return {"success": True, "message": "Шаблон удален"}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при удалении шаблона: {str(e)}"
        )

@router.get("/history")
async def get_response_history(
    session_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0
):
    """Получение истории отправленных ответов"""
    try:
        if session_id:
            history = await db.fetch(
                """SELECT sr.id, sr.recipient_id, sr.response_text, sr.sent_at,
                          sr.success, sr.error_message,
                          mh.message_text as original_message,
                          mh.sender_username,
                          ar.name as response_template_name
                   FROM sent_responses sr
                   LEFT JOIN message_history mh ON sr.message_history_id = mh.id
                   LEFT JOIN auto_responses ar ON sr.response_id = ar.id
                   WHERE mh.session_id = $1
                   ORDER BY sr.sent_at DESC
                   LIMIT $2 OFFSET $3""",
                session_id, limit, offset
            )
            
            total = await db.fetchval(
                """SELECT COUNT(*) FROM sent_responses sr
                   LEFT JOIN message_history mh ON sr.message_history_id = mh.id
                   WHERE mh.session_id = $1""",
                session_id
            )
        else:
            history = await db.fetch(
                """SELECT sr.id, sr.recipient_id, sr.response_text, sr.sent_at,
                          sr.success, sr.error_message,
                          mh.message_text as original_message,
                          mh.sender_username,
                          ar.name as response_template_name
                   FROM sent_responses sr
                   LEFT JOIN message_history mh ON sr.message_history_id = mh.id
                   LEFT JOIN auto_responses ar ON sr.response_id = ar.id
                   ORDER BY sr.sent_at DESC
                   LIMIT $1 OFFSET $2""",
                limit, offset
            )
            
            total = await db.fetchval("SELECT COUNT(*) FROM sent_responses")
        
        return {
            "history": history,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении истории: {str(e)}"
        )
