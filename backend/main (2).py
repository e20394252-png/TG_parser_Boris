"""
Telegram Parser Backend - FastAPI приложение
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
from routers import auth, monitoring, responses, statistics, conversations, settings, mcp_status, ai

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

app = FastAPI(
    title="Telegram Parser API",
    description="API для мониторинга Telegram чатов и автоматических ответов с AI",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - настроен для Render
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
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database": "connected" if db.pool else "disconnected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
