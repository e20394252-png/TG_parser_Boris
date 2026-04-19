"""
Роутер для статистики (с фильтрацией по user_id из JWT)
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional
from datetime import datetime, timedelta

from database.database import db
from services.auth_deps import require_user_id

router = APIRouter()


@router.get("/overview")
async def get_statistics_overview(
    session_id: Optional[int] = None,
    user_id: int = Depends(require_user_id),
):
    """Общая статистика — только по сессиям текущего пользователя"""
    try:
        today = datetime.now().date()

        if session_id:
            owner = await db.fetchval(
                "SELECT user_id FROM telegram_sessions WHERE id = $1", session_id
            )
            if owner != user_id:
                raise HTTPException(status_code=403, detail="Доступ запрещён")

            today_stats = await db.fetchrow(
                """SELECT
                       COALESCE(SUM(messages_monitored), 0) as messages_monitored,
                       COALESCE(SUM(messages_matched), 0) as messages_matched,
                       COALESCE(SUM(responses_sent), 0) as responses_sent,
                       COALESCE(SUM(responses_failed), 0) as responses_failed
                   FROM statistics
                   WHERE session_id = $1 AND date = $2""",
                session_id, today,
            )
            total_stats = await db.fetchrow(
                """SELECT
                       COALESCE(SUM(messages_monitored), 0) as total_messages,
                       COALESCE(SUM(messages_matched), 0) as total_matched,
                       COALESCE(SUM(responses_sent), 0) as total_responses,
                       COALESCE(SUM(responses_failed), 0) as total_failed
                   FROM statistics
                   WHERE session_id = $1""",
                session_id,
            )
            active_chats = await db.fetchval(
                "SELECT COUNT(*) FROM monitored_chats WHERE session_id = $1 AND is_active = true",
                session_id,
            )
            active_filters = await db.fetchval(
                "SELECT COUNT(*) FROM message_filters WHERE session_id = $1 AND is_active = true",
                session_id,
            )
        else:
            # Только сессии текущего пользователя
            today_stats = await db.fetchrow(
                """SELECT
                       COALESCE(SUM(s.messages_monitored), 0) as messages_monitored,
                       COALESCE(SUM(s.messages_matched), 0) as messages_matched,
                       COALESCE(SUM(s.responses_sent), 0) as responses_sent,
                       COALESCE(SUM(s.responses_failed), 0) as responses_failed
                   FROM statistics s
                   JOIN telegram_sessions ts ON ts.id = s.session_id
                   WHERE ts.user_id = $1 AND s.date = $2""",
                user_id, today,
            )
            total_stats = await db.fetchrow(
                """SELECT
                       COALESCE(SUM(s.messages_monitored), 0) as total_messages,
                       COALESCE(SUM(s.messages_matched), 0) as total_matched,
                       COALESCE(SUM(s.responses_sent), 0) as total_responses,
                       COALESCE(SUM(s.responses_failed), 0) as total_failed
                   FROM statistics s
                   JOIN telegram_sessions ts ON ts.id = s.session_id
                   WHERE ts.user_id = $1""",
                user_id,
            )
            active_chats = await db.fetchval(
                """SELECT COUNT(*) FROM monitored_chats mc
                   JOIN telegram_sessions ts ON ts.id = mc.session_id
                   WHERE ts.user_id = $1 AND mc.is_active = true""",
                user_id,
            )
            active_filters = await db.fetchval(
                """SELECT COUNT(*) FROM message_filters mf
                   JOIN telegram_sessions ts ON ts.id = mf.session_id
                   WHERE ts.user_id = $1 AND mf.is_active = true""",
                user_id,
            )

        return {
            "today": dict(today_stats) if today_stats else {},
            "total": dict(total_stats) if total_stats else {},
            "active_chats": active_chats,
            "active_filters": active_filters,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении статистики: {str(e)}",
        )


@router.get("/messages")
async def get_message_statistics(
    session_id: Optional[int] = None,
    days: int = 7,
    user_id: int = Depends(require_user_id),
):
    """Статистика сообщений за период — только по сессиям текущего пользователя"""
    try:
        start_date = datetime.now().date() - timedelta(days=days)

        if session_id:
            owner = await db.fetchval(
                "SELECT user_id FROM telegram_sessions WHERE id = $1", session_id
            )
            if owner != user_id:
                raise HTTPException(status_code=403, detail="Доступ запрещён")

            stats = await db.fetch(
                """SELECT date, messages_monitored, messages_matched
                   FROM statistics
                   WHERE session_id = $1 AND date >= $2
                   ORDER BY date ASC""",
                session_id, start_date,
            )
        else:
            stats = await db.fetch(
                """SELECT s.date,
                          SUM(s.messages_monitored) as messages_monitored,
                          SUM(s.messages_matched) as messages_matched
                   FROM statistics s
                   JOIN telegram_sessions ts ON ts.id = s.session_id
                   WHERE ts.user_id = $1 AND s.date >= $2
                   GROUP BY s.date
                   ORDER BY s.date ASC""",
                user_id, start_date,
            )

        return {"period_days": days, "data": stats}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении статистики сообщений: {str(e)}",
        )


@router.get("/responses")
async def get_response_statistics(
    session_id: Optional[int] = None,
    days: int = 7,
    user_id: int = Depends(require_user_id),
):
    """Статистика ответов за период — только по сессиям текущего пользователя"""
    try:
        start_date = datetime.now().date() - timedelta(days=days)

        if session_id:
            owner = await db.fetchval(
                "SELECT user_id FROM telegram_sessions WHERE id = $1", session_id
            )
            if owner != user_id:
                raise HTTPException(status_code=403, detail="Доступ запрещён")

            stats = await db.fetch(
                """SELECT date, responses_sent, responses_failed
                   FROM statistics
                   WHERE session_id = $1 AND date >= $2
                   ORDER BY date ASC""",
                session_id, start_date,
            )
        else:
            stats = await db.fetch(
                """SELECT s.date,
                          SUM(s.responses_sent) as responses_sent,
                          SUM(s.responses_failed) as responses_failed
                   FROM statistics s
                   JOIN telegram_sessions ts ON ts.id = s.session_id
                   WHERE ts.user_id = $1 AND s.date >= $2
                   GROUP BY s.date
                   ORDER BY s.date ASC""",
                user_id, start_date,
            )

        return {"period_days": days, "data": stats}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении статистики ответов: {str(e)}",
        )


@router.get("/top-filters")
async def get_top_filters(
    session_id: Optional[int] = None,
    limit: int = 10,
    user_id: int = Depends(require_user_id),
):
    """Топ фильтров — только по сессиям текущего пользователя"""
    try:
        if session_id:
            owner = await db.fetchval(
                "SELECT user_id FROM telegram_sessions WHERE id = $1", session_id
            )
            if owner != user_id:
                raise HTTPException(status_code=403, detail="Доступ запрещён")

            top_filters = await db.fetch(
                """SELECT f.id, f.name, f.filter_type, COUNT(mh.id) as match_count
                   FROM message_filters f
                   LEFT JOIN message_history mh ON f.id = mh.matched_filter_id
                   WHERE f.session_id = $1
                   GROUP BY f.id, f.name, f.filter_type
                   ORDER BY match_count DESC
                   LIMIT $2""",
                session_id, limit,
            )
        else:
            top_filters = await db.fetch(
                """SELECT f.id, f.name, f.filter_type, COUNT(mh.id) as match_count
                   FROM message_filters f
                   JOIN telegram_sessions ts ON ts.id = f.session_id
                   LEFT JOIN message_history mh ON f.id = mh.matched_filter_id
                   WHERE ts.user_id = $1
                   GROUP BY f.id, f.name, f.filter_type
                   ORDER BY match_count DESC
                   LIMIT $2""",
                user_id, limit,
            )

        return {"top_filters": top_filters}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении топ фильтров: {str(e)}",
        )
