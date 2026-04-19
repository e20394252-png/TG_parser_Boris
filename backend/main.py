"""
Главный файл FastAPI приложения
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import logging

# Настройка логирования для Render
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from database.database import db
from routers import auth, monitoring, responses, statistics, conversations, settings, mcp_status, ai, broadcast, login

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    # Startup
    logger.info("🚀 Starting Telegram Parser Backend...")
    await db.connect()
    # Создаём пользователей по умолчанию
    from services.user_seed import seed_users
    await seed_users()

    # Авто-миграция: создаём таблицу для Bot Auth (если ещё нет)
    try:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS tg_bot_auth_states (
                id          SERIAL PRIMARY KEY,
                state       UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
                tg_username TEXT,
                tg_user_id  BIGINT,
                confirmed   BOOLEAN DEFAULT false,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at  TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes')
            )
        """)
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_tg_bot_auth_states_state ON tg_bot_auth_states(state)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_tg_bot_auth_states_expires ON tg_bot_auth_states(expires_at)"
        )
        logger.info("✅ tg_bot_auth_states table ready")
    except Exception as e:
        logger.error(f"Ошибка авто-миграции tg_bot_auth_states: {e}")

    # Запускаем Telegram Auth Bot (long-polling)
    from services.auth_bot import start_bot
    import asyncio
    bot_task = asyncio.create_task(start_bot())
    logger.info("🤖 Auth Bot task scheduled")
    
    # Запускаем мониторинг для активных сессий
    try:
        from services.message_monitor import monitor_service
        active_sessions = await db.fetch("SELECT id, api_id, api_hash, session_string FROM telegram_sessions WHERE session_string IS NOT NULL")
        for session in active_sessions:
            try:
                await monitor_service.start_monitoring(
                    session_id=session['id'],
                    api_id=int(session['api_id']),
                    api_hash=session['api_hash'],
                    session_string=session['session_string']
                )
            except Exception as e:
                logger.error(f"Не удалось запустить мониторинг для сессии {session['id']}: {e}")
    except Exception as e:
        logger.error(f"Ошибка при инициализации мониторинга: {e}")
        
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down...")
    # Останавливаем Auth Bot
    try:
        bot_task.cancel()
        await asyncio.gather(bot_task, return_exceptions=True)
        logger.info("🤖 Auth Bot stopped")
    except Exception as e:
        logger.error(f"Ошибка при остановке бота: {e}")

    try:
        from services.message_monitor import monitor_service
        for session_id in list(monitor_service.active_monitors.keys()):
            if monitor_service.active_monitors[session_id]:
                await monitor_service.stop_monitoring(session_id)
    except Exception as e:
         logger.error(f"Ошибка при остановке сессий: {e}")
         
    await db.disconnect()

# Создание FastAPI приложения
app = FastAPI(
    title="Telegram Parser API",
    description="API для мониторинга Telegram чатов и автоматических ответов с AI",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - настролен для Render
allowed_origins = ["*"]
if os.getenv("ENVIRONMENT") == "production":
    allowed_origins = [
        f"https://{os.getenv('FRONTEND_HOST', 'localhost')}",
        f"https://{os.getenv('FRONTEND_HOST', 'localhost')}.onrender.com"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(monitoring.router, prefix="/api/monitoring", tags=["Monitoring"])
app.include_router(responses.router, prefix="/api/responses", tags=["Responses"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI & RAG"])
app.include_router(statistics.router, prefix="/api/statistics", tags=["Statistics"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["Conversations"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(mcp_status.router, prefix="/api", tags=["MCP Status"])
app.include_router(broadcast.router, prefix="/api/broadcast", tags=["Broadcast"])
app.include_router(login.router, prefix="/api/login", tags=["Login"])

@app.get("/")
async def root():
    """Корневой endpoint"""
    return {
        "message": "🤖 Telegram Parser API",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/debug/routes")
async def debug_routes():
    """Список всех зарегистрированных маршрутов — для диагностики"""
    routes = []
    for route in app.routes:
        if hasattr(route, "methods"):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": route.name,
            })
    return {"total": len(routes), "routes": sorted(routes, key=lambda r: r["path"])}


@app.get("/debug/db")
async def debug_db():
    """Диагностика БД: список таблиц и содержимое user_preferences"""
    try:
        tables = await db.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        )
        table_names = [t["tablename"] for t in tables]

        prefs = []
        if "user_preferences" in table_names:
            rows = await db.fetch("SELECT user_id, setting_key, setting_value FROM user_preferences LIMIT 50")
            prefs = [dict(r) for r in rows]

        return {
            "tables": table_names,
            "user_preferences_exists": "user_preferences" in table_names,
            "user_preferences_rows": prefs,
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    try:
        # Проверка подключения к БД
        await db.fetchval("SELECT 1")
        
        # Проверка MCP статуса
        mcp_status_result = "unknown"
        try:
            from routers.mcp_status import check_mcp_connection
            mcp_check = await check_mcp_connection()
            mcp_status_result = mcp_check.get("status", "unknown")
        except Exception:
            mcp_status_result = "unavailable"
        
        return {
            "status": "healthy",
            "database": "connected",
            "mcp": mcp_status_result,
            "timestamp": "2026-02-15T13:49:14+07:00"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "mcp": "unknown"
        }

