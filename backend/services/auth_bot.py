"""
Telegram Bot для авторизации пользователей.

Поток:
  1. Frontend вызывает GET /api/login/bot/init → получает deep link вида
     https://t.me/BOT_NAME?start=<UUID>
  2. Пользователь переходит по ссылке и нажимает Start в боте
  3. Бот получает /start <UUID>, обновляет запись в БД (confirmed=true, tg_username=...)
  4. Frontend, опрашивая GET /api/login/bot/check?state=<UUID>, видит confirmed=true
     и получает JWT
"""

import asyncio
import logging
import os

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart, CommandObject

logger = logging.getLogger(__name__)

BOT_TOKEN   = os.getenv("TELEGRAM_BOT_TOKEN", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://telegram-parser-frontend.onrender.com")

# Глобальный объект бота — используется и в роутере для проверки
_bot: Bot | None = None
_polling_task: asyncio.Task | None = None


async def _handle_start(message: types.Message, command: CommandObject):
    """Обработчик команды /start [state]"""
    state_str = (command.args or "").strip()

    if not state_str:
        await message.answer(
            "👋 Привет! Этот бот используется для авторизации в Telegram Parser.\n"
            "Перейдите на сайт и нажмите «Войти через Telegram»."
        )
        return

    # Lazy-import чтобы не было circular dependency при старте
    from database.database import db

    try:
        # Ищем state в БД
        row = await db.fetchrow(
            """
            SELECT id, confirmed, expires_at
            FROM tg_bot_auth_states
            WHERE state = $1::uuid
            """,
            state_str,
        )
    except Exception as e:
        logger.error(f"[AuthBot] DB error on /start: {e}")
        await message.answer("⚠️ Внутренняя ошибка сервера. Попробуйте ещё раз.")
        return

    if row is None:
        await message.answer(
            "❌ Ссылка недействительна или устарела.\n"
            "Вернитесь на сайт и запросите новую ссылку."
        )
        return

    if row["confirmed"]:
        await message.answer("✅ Вы уже вошли в систему. Вернитесь на сайт.")
        return

    # Проверяем TTL (дополнительная проверка на уровне кода)
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    expires = row["expires_at"]
    # asyncpg может вернуть naive datetime — делаем aware
    if expires.tzinfo is None:
        from datetime import timezone as tz
        expires = expires.replace(tzinfo=tz.utc)
    if now > expires:
        await message.answer(
            "⏰ Ссылка истекла (срок действия 10 минут).\n"
            "Вернитесь на сайт и запросите новую ссылку."
        )
        return

    # Обновляем запись
    user = message.from_user
    tg_username = user.username or f"id{user.id}"

    await db.execute(
        """
        UPDATE tg_bot_auth_states
        SET confirmed   = true,
            tg_username = $1,
            tg_user_id  = $2
        WHERE id = $3
        """,
        tg_username,
        user.id,
        row["id"],
    )

    logger.info(f"[AuthBot] Authorized: @{tg_username} (tg_id={user.id}), state={state_str}")

    # Красивое приветственное сообщение
    first_name = user.first_name or tg_username
    await message.answer(
        f"✅ <b>Вход выполнен!</b>\n\n"
        f"Добро пожаловать, <b>{first_name}</b>!\n"
        f"Вернитесь в браузер — страница обновится автоматически.\n\n"
        f"<a href='{FRONTEND_URL}'>🔗 Открыть Telegram Parser</a>",
        parse_mode="HTML",
        disable_web_page_preview=True,
    )


async def start_bot():
    """
    Запускает бот в режиме long-polling.
    Вызывается из lifespan FastAPI как asyncio.create_task(start_bot()).
    """
    global _bot, _polling_task

    if not BOT_TOKEN:
        logger.warning("[AuthBot] TELEGRAM_BOT_TOKEN не задан — бот авторизации не запущен")
        return

    _bot = Bot(token=BOT_TOKEN)
    dp  = Dispatcher()

    dp.message.register(_handle_start, CommandStart(deep_link=True))
    dp.message.register(_handle_start, CommandStart())

    logger.info("[AuthBot] Starting long-polling...")
    try:
        await dp.start_polling(_bot, allowed_updates=["message"])
    except asyncio.CancelledError:
        logger.info("[AuthBot] Polling cancelled — shutting down")
    except Exception as e:
        logger.error(f"[AuthBot] Polling error: {e}")
    finally:
        if _bot:
            await _bot.session.close()


async def stop_bot():
    """Останавливает polling task."""
    global _polling_task
    if _polling_task and not _polling_task.done():
        _polling_task.cancel()
        try:
            await _polling_task
        except asyncio.CancelledError:
            pass
    logger.info("[AuthBot] Bot stopped")
