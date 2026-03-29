"""
Роутер для проверки статуса MCP (Model Context Protocol) сервера
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime
import httpx
import asyncio

router = APIRouter(prefix="/mcp", tags=["MCP Status"])

class MCPStatus(BaseModel):
    status: str  # "online", "offline", "degraded"
    timestamp: str
    server_url: Optional[str] = None
    latency_ms: Optional[float] = None
    error: Optional[str] = None

class MCPHealthDetail(BaseModel):
    status: str
    timestamp: str
    server_url: str
    latency_ms: Optional[float] = None
    available_tools: List[str] = []
    available_resources: List[str] = []
    last_check: str
    error: Optional[str] = None

# Конфигурация MCP сервера (можно вынести в .env)
MCP_SERVER_URL = "http://localhost:8000"  # URL вашего MCP сервера
MCP_TIMEOUT = 5.0  # Таймаут в секундах

async def check_mcp_connection() -> Dict:
    """Проверка подключения к MCP серверу"""
    start_time = asyncio.get_event_loop().time()
    
    try:
        async with httpx.AsyncClient(timeout=MCP_TIMEOUT) as client:
            # Проверяем базовый health endpoint
            response = await client.get(f"{MCP_SERVER_URL}/health")
            
            end_time = asyncio.get_event_loop().time()
            latency_ms = (end_time - start_time) * 1000
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "status": "online",
                    "latency_ms": round(latency_ms, 2),
                    "server_url": MCP_SERVER_URL,
                    "server_data": data
                }
            else:
                return {
                    "status": "degraded",
                    "latency_ms": round(latency_ms, 2),
                    "server_url": MCP_SERVER_URL,
                    "error": f"HTTP {response.status_code}"
                }
                
    except httpx.TimeoutException:
        return {
            "status": "offline",
            "server_url": MCP_SERVER_URL,
            "error": "Connection timeout"
        }
    except httpx.ConnectError:
        return {
            "status": "offline",
            "server_url": MCP_SERVER_URL,
            "error": "Connection refused - server may be down"
        }
    except Exception as e:
        return {
            "status": "offline",
            "server_url": MCP_SERVER_URL,
            "error": str(e)
        }

@router.get("/status", response_model=MCPStatus)
async def get_mcp_status():
    """
    Быстрая проверка статуса MCP сервера
    
    Возвращает:
    - status: "online", "offline", или "degraded"
    - timestamp: время проверки
    - latency_ms: задержка соединения в миллисекундах
    - error: описание ошибки (если есть)
    """
    result = await check_mcp_connection()
    
    return MCPStatus(
        status=result["status"],
        timestamp=datetime.now().isoformat(),
        server_url=result.get("server_url"),
        latency_ms=result.get("latency_ms"),
        error=result.get("error")
    )

@router.get("/health", response_model=MCPHealthDetail)
async def get_mcp_health():
    """
    Детальная информация о здоровье MCP сервера
    
    Возвращает:
    - Статус подключения
    - Доступные инструменты (tools)
    - Доступные ресурсы (resources)
    - Задержку соединения
    - Время последней проверки
    """
    result = await check_mcp_connection()
    
    # Извлекаем информацию о доступных инструментах и ресурсах
    available_tools = []
    available_resources = []
    
    if result["status"] == "online" and "server_data" in result:
        server_data = result["server_data"]
        # Здесь можно добавить логику извлечения списка tools и resources
        # из ответа MCP сервера, если он их предоставляет
        available_tools = ["search_conversations", "get_messages", "index_chat", "get_stats", "get_context"]
        available_resources = ["telegram://conversations", "telegram://embeddings"]
    
    return MCPHealthDetail(
        status=result["status"],
        timestamp=datetime.now().isoformat(),
        server_url=result.get("server_url", MCP_SERVER_URL),
        latency_ms=result.get("latency_ms"),
        available_tools=available_tools,
        available_resources=available_resources,
        last_check=datetime.now().isoformat(),
        error=result.get("error")
    )

@router.get("/tools")
async def get_mcp_tools():
    """
    Получить список доступных MCP инструментов
    
    Возвращает список инструментов, определенных в mcp.json
    """
    # В реальной реализации это должно читаться из mcp.json или MCP сервера
    tools = [
        {
            "name": "search_conversations",
            "description": "Семантический поиск по диалогам Telegram с использованием RAG"
        },
        {
            "name": "get_messages",
            "description": "Получение сообщений из конкретного чата"
        },
        {
            "name": "index_chat",
            "description": "Индексация сообщений чата для семантического поиска"
        },
        {
            "name": "get_stats",
            "description": "Получение статистики по диалогам и индексации"
        },
        {
            "name": "get_context",
            "description": "Получение контекста вокруг конкретного сообщения"
        }
    ]
    
    return {
        "success": True,
        "tools": tools,
        "total": len(tools)
    }

@router.get("/resources")
async def get_mcp_resources():
    """
    Получить список доступных MCP ресурсов
    
    Возвращает список ресурсов, определенных в mcp.json
    """
    resources = [
        {
            "uri": "telegram://conversations",
            "name": "Диалоги Telegram",
            "description": "Доступ к диалогам и сообщениям из Telegram",
            "mimeType": "application/json"
        },
        {
            "uri": "telegram://embeddings",
            "name": "Векторные эмбеддинги",
            "description": "Векторные представления сообщений для семантического поиска",
            "mimeType": "application/json"
        }
    ]
    
    return {
        "success": True,
        "resources": resources,
        "total": len(resources)
    }
