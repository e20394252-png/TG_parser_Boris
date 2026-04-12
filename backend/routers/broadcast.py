"""
Роутер для рассылки сообщений через Telegram
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, status, Depends
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import re
import logging

from database.database import db
from services.telegram_client import TelegramClientManager
from services.auth_deps import require_user_id, verify_session_owner

logger = logging.getLogger(__name__)
router = APIRouter()
telegram_manager = TelegramClientManager()

# ──────────────── Схемы ────────────────

class BroadcastRequest(BaseModel):
    text: str
    recipients: List[str]           # @username / t.me/username / https://t.me/username
    delay_seconds: float = 3.0      # пауза между отправками (защита от спама)


class RecipientResult(BaseModel):
    recipient: str
    success: bool
    error: Optional[str] = None


class BroadcastResponse(BaseModel):
    task_id: int
    total: int
    message: str


class BroadcastStatus(BaseModel):
    task_id: int
    status: str          # pending / running / done / failed
    total: int
    sent: int
    failed: int
    results: List[RecipientResult]

# ──────────────── Хелперы ────────────────

def normalize_recipient(raw: str) -> str:
    """Извлекает username из разных форматов"""
    raw = raw.strip()
    # https://t.me/username  или  t.me/username
    match = re.search(r"t\.me/([A-Za-z0-9_]{5,})", raw)
    if match:
        return match.group(1)
    # @username
    if raw.startswith("@"):
        return raw[1:]
    return raw


# ──────────────── Фоновая задача ────────────────

async def run_broadcast(task_id: int, session_id: int, api_id: int,
                        api_hash: str, session_string: str,
                        text: str, recipients: List[str], delay: float):
    """Отправляет сообщения и обновляет статус в БД"""
    for raw in recipients:
        username = normalize_recipient(raw)
        try:
            client = await telegram_manager.get_client(
                session_id, api_id, api_hash, session_string
            )
            await client.send_message(username, text)

            await db.execute(
                """INSERT INTO broadcast_results (task_id, recipient, success)
                   VALUES ($1, $2, true)""",
                task_id, raw
            )
            logger.info(f"[broadcast:{task_id}] ✅ Sent to {username}")

        except Exception as e:
            err = str(e)
            await db.execute(
                """INSERT INTO broadcast_results (task_id, recipient, success, error)
                   VALUES ($1, $2, false, $3)""",
                task_id, raw, err
            )
            logger.warning(f"[broadcast:{task_id}] ❌ Failed {username}: {err}")

        await asyncio.sleep(delay)

    await db.execute(
        "UPDATE broadcast_tasks SET status = 'done' WHERE id = $1",
        task_id
    )
    logger.info(f"[broadcast:{task_id}] Broadcast finished")


# ──────────────── Endpoints ────────────────

@router.get("/ping")
async def broadcast_ping():
    """Диагностический эндпоинт — проверяет что роутер зарегистрирован"""
    return {"ok": True, "router": "broadcast", "routes": ["/ping", "/send", "/status/{task_id}", "/history"]}


@router.post("/send", response_model=BroadcastResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_broadcast(
    data: BroadcastRequest,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(require_user_id)
):
    """
    Запустить рассылку. Использует сессию текущего пользователя.
    """
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Текст сообщения не может быть пустым")
    if not data.recipients:
        raise HTTPException(status_code=400, detail="Список получателей пуст")

    # Берём первую активную сессию текущего пользователя
    session = await db.fetchrow(
        """SELECT id, api_id, api_hash, session_string
           FROM telegram_sessions
           WHERE user_id = $1 AND is_active = true AND session_string IS NOT NULL
           ORDER BY updated_at DESC
           LIMIT 1""",
        user_id
    )
    if not session:
        raise HTTPException(
            status_code=400,
            detail="Нет активной Telegram-сессии. Сначала авторизуйтесь на вкладке Telegram."
        )

    task_id = await db.fetchval(
        """INSERT INTO broadcast_tasks (session_id, message_text, total_count, status)
           VALUES ($1, $2, $3, 'running') RETURNING id""",
        session["id"], data.text, len(data.recipients)
    )

    background_tasks.add_task(
        run_broadcast, task_id, session["id"],
        int(session["api_id"]), session["api_hash"],
        session["session_string"], data.text,
        data.recipients, data.delay_seconds,
    )

    return BroadcastResponse(
        task_id=task_id,
        total=len(data.recipients),
        message=f"Рассылка запущена. Будет отправлено {len(data.recipients)} сообщений."
    )


@router.get("/status/{task_id}", response_model=BroadcastStatus)
async def get_broadcast_status(
    task_id: int,
    user_id: int = Depends(require_user_id)
):
    """Статус задачи рассылки (только свои)"""
    task = await db.fetchrow(
        """SELECT bt.id, bt.status, bt.total_count FROM broadcast_tasks bt
           JOIN telegram_sessions ts ON bt.session_id = ts.id
           WHERE bt.id = $1 AND ts.user_id = $2""",
        task_id, user_id
    )
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    results = await db.fetch(
        "SELECT recipient, success, error FROM broadcast_results WHERE task_id = $1",
        task_id
    )
    sent   = sum(1 for r in results if r["success"])
    failed = sum(1 for r in results if not r["success"])
    return BroadcastStatus(
        task_id=task_id, status=task["status"], total=task["total_count"],
        sent=sent, failed=failed,
        results=[RecipientResult(**dict(r)) for r in results]
    )


@router.get("/history")
async def get_broadcast_history(user_id: int = Depends(require_user_id)):
    """История задач рассылки — только свои"""
    tasks = await db.fetch(
        """SELECT bt.id, bt.message_text, bt.total_count, bt.status, bt.created_at,
                  COUNT(br.id) FILTER (WHERE br.success) AS sent_count,
                  COUNT(br.id) FILTER (WHERE NOT br.success) AS failed_count
           FROM broadcast_tasks bt
           JOIN telegram_sessions ts ON bt.session_id = ts.id
           LEFT JOIN broadcast_results br ON br.task_id = bt.id
           WHERE ts.user_id = $1
           GROUP BY bt.id
           ORDER BY bt.created_at DESC
           LIMIT 50""",
        user_id
    )
    return {"tasks": [dict(t) for t in tasks]}


@router.get("/today")
async def get_today_broadcast_stats(user_id: int = Depends(require_user_id)):
    """Статистика рассылок за сегодня для дашборда"""
    result = await db.fetchrow(
        """SELECT
               COUNT(DISTINCT bt.id)                            AS tasks_today,
               COALESCE(SUM(bt.total_count), 0)                AS messages_planned,
               COUNT(br.id) FILTER (WHERE br.success)          AS messages_sent
           FROM broadcast_tasks bt
           JOIN telegram_sessions ts ON bt.session_id = ts.id
           LEFT JOIN broadcast_results br ON br.task_id = bt.id
           WHERE ts.user_id = $1
             AND bt.created_at >= CURRENT_DATE""",
        user_id
    )
    return {
        "tasks_today":       int(result["tasks_today"]       or 0),
        "messages_sent":     int(result["messages_sent"]     or 0),
        "messages_planned":  int(result["messages_planned"]  or 0),
    }


@router.delete("/history")
async def clear_broadcast_history(user_id: int = Depends(require_user_id)):
    """Удалить всю историю рассылок текущего пользователя"""
    tasks = await db.fetch(
        """SELECT bt.id FROM broadcast_tasks bt
           JOIN telegram_sessions ts ON bt.session_id = ts.id
           WHERE ts.user_id = $1""",
        user_id
    )
    task_ids = [t["id"] for t in tasks]
    if task_ids:
        await db.execute(
            "DELETE FROM broadcast_results WHERE task_id = ANY($1::int[])", task_ids
        )
        await db.execute(
            """DELETE FROM broadcast_tasks bt
               USING telegram_sessions ts
               WHERE bt.session_id = ts.id AND ts.user_id = $1""",
            user_id
        )
    return {"success": True, "deleted": len(task_ids)}


@router.delete("/{task_id}")
async def delete_broadcast_task(
    task_id: int,
    user_id: int = Depends(require_user_id)
):
    """Удалить одну задачу рассылки"""
    row = await db.fetchrow(
        """SELECT bt.id FROM broadcast_tasks bt
           JOIN telegram_sessions ts ON bt.session_id = ts.id
           WHERE bt.id = $1 AND ts.user_id = $2""",
        task_id, user_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")
    await db.execute("DELETE FROM broadcast_results WHERE task_id = $1", task_id)
    await db.execute("DELETE FROM broadcast_tasks WHERE id = $1", task_id)
    return {"success": True}

