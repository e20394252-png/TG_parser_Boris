"""
Роутер для статистики
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

from database.database import db

router = APIRouter()

@router.get("/overview")
async def get_statistics_overview(session_id: Optional[int] = None):
    """Получение общей статистики"""
    try:
        # Статистика за сегодня
        today = datetime.now().date()
        
        if session_id:
            today_stats = await db.fetchrow(
                """SELECT 
                       COALESCE(SUM(messages_monitored), 0) as messages_monitored,
                       COALESCE(SUM(messages_matched), 0) as messages_matched,
                       COALESCE(SUM(responses_sent), 0) as responses_sent,
                       COALESCE(SUM(responses_failed), 0) as responses_failed
                   FROM statistics
                   WHERE session_id = $1 AND date = $2""",
                session_id, today
            )
            
            # Общая статистика
            total_stats = await db.fetchrow(
                """SELECT 
                       COALESCE(SUM(messages_monitored), 0) as total_messages,
                       COALESCE(SUM(messages_matched), 0) as total_matched,
                       COALESCE(SUM(responses_sent), 0) as total_responses,
                       COALESCE(SUM(responses_failed), 0) as total_failed
                   FROM statistics
                   WHERE session_id = $1""",
                session_id
            )
            
            # Количество активных чатов и фильтров
            active_chats = await db.fetchval(
                "SELECT COUNT(*) FROM monitored_chats WHERE session_id = $1 AND is_active = true",
                session_id
            )
            
            active_filters = await db.fetchval(
                "SELECT COUNT(*) FROM message_filters WHERE session_id = $1 AND is_active = true",
                session_id
            )
        else:
            today_stats = await db.fetchrow(
                """SELECT 
                       COALESCE(SUM(messages_monitored), 0) as messages_monitored,
                       COALESCE(SUM(messages_matched), 0) as messages_matched,
                       COALESCE(SUM(responses_sent), 0) as responses_sent,
                       COALESCE(SUM(responses_failed), 0) as responses_failed
                   FROM statistics
                   WHERE date = $1""",
                today
            )
            
            total_stats = await db.fetchrow(
                """SELECT 
                       COALESCE(SUM(messages_monitored), 0) as total_messages,
                       COALESCE(SUM(messages_matched), 0) as total_matched,
                       COALESCE(SUM(responses_sent), 0) as total_responses,
                       COALESCE(SUM(responses_failed), 0) as total_failed
                   FROM statistics"""
            )
            
            active_chats = await db.fetchval(
                "SELECT COUNT(*) FROM monitored_chats WHERE is_active = true"
            )
            
            active_filters = await db.fetchval(
                "SELECT COUNT(*) FROM message_filters WHERE is_active = true"
            )
        
        return {
            "today": dict(today_stats) if today_stats else {},
            "total": dict(total_stats) if total_stats else {},
            "active_chats": active_chats,
            "active_filters": active_filters
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении статистики: {str(e)}"
        )

@router.get("/messages")
async def get_message_statistics(
    session_id: Optional[int] = None,
    days: int = 7
):
    """Получение статистики сообщений за период"""
    try:
        start_date = datetime.now().date() - timedelta(days=days)
        
        if session_id:
            stats = await db.fetch(
                """SELECT date, messages_monitored, messages_matched
                   FROM statistics
                   WHERE session_id = $1 AND date >= $2
                   ORDER BY date ASC""",
                session_id, start_date
            )
        else:
            stats = await db.fetch(
                """SELECT date, 
                          SUM(messages_monitored) as messages_monitored,
                          SUM(messages_matched) as messages_matched
                   FROM statistics
                   WHERE date >= $1
                   GROUP BY date
                   ORDER BY date ASC""",
                start_date
            )
        
        return {
            "period_days": days,
            "data": stats
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении статистики сообщений: {str(e)}"
        )

@router.get("/responses")
async def get_response_statistics(
    session_id: Optional[int] = None,
    days: int = 7
):
    """Получение статистики ответов за период"""
    try:
        start_date = datetime.now().date() - timedelta(days=days)
        
        if session_id:
            stats = await db.fetch(
                """SELECT date, responses_sent, responses_failed
                   FROM statistics
                   WHERE session_id = $1 AND date >= $2
                   ORDER BY date ASC""",
                session_id, start_date
            )
        else:
            stats = await db.fetch(
                """SELECT date,
                          SUM(responses_sent) as responses_sent,
                          SUM(responses_failed) as responses_failed
                   FROM statistics
                   WHERE date >= $1
                   GROUP BY date
                   ORDER BY date ASC""",
                start_date
            )
        
        return {
            "period_days": days,
            "data": stats
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении статистики ответов: {str(e)}"
        )

@router.get("/top-filters")
async def get_top_filters(session_id: Optional[int] = None, limit: int = 10):
    """Получение топ фильтров по количеству совпадений"""
    try:
        if session_id:
            top_filters = await db.fetch(
                """SELECT f.id, f.name, f.filter_type, COUNT(mh.id) as match_count
                   FROM message_filters f
                   LEFT JOIN message_history mh ON f.id = mh.matched_filter_id
                   WHERE f.session_id = $1
                   GROUP BY f.id, f.name, f.filter_type
                   ORDER BY match_count DESC
                   LIMIT $2""",
                session_id, limit
            )
        else:
            top_filters = await db.fetch(
                """SELECT f.id, f.name, f.filter_type, COUNT(mh.id) as match_count
                   FROM message_filters f
                   LEFT JOIN message_history mh ON f.id = mh.matched_filter_id
                   GROUP BY f.id, f.name, f.filter_type
                   ORDER BY match_count DESC
                   LIMIT $1""",
                limit
            )
        
        return {"top_filters": top_filters}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении топ фильтров: {str(e)}"
        )
