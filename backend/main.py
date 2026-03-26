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
from routers import auth, monitoring, responses, ai, statistics, conversations, settings, mcp_status

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    # Startup
    logger.info("🚀 Starting Telegram Parser Backend...")
    await db.connect()
    yield
    # Shutdown
    logger.info("🛑 Shutting down...")
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

@app.get("/")
async def root():
    """Корневой endpoint"""
    return {
        "message": "🤖 Telegram Parser API",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs"
    }

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

