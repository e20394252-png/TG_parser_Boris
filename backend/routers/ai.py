"""
Роутер для работы с AI и RAG
"""
from fastapi import APIRouter, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
import aiofiles

from database.database import db
# Временно отключаем RAG сервис
# from services.rag_service import RAGService
from services.mtp_service import MTPService

router = APIRouter()
# rag_service = RAGService()  # Временно отключено
mtp_service = MTPService()

class AIProviderCreate(BaseModel):
    name: str
    provider_type: str  # 'openai', 'anthropic', 'google', 'local'
    api_key: Optional[str] = None
    api_endpoint: Optional[str] = None
    model_name: str
    max_tokens: int = 1000
    temperature: float = 0.7
    priority: int = 0

class GenerateRequest(BaseModel):
    prompt: str
    provider_id: Optional[int] = None
    use_rag: bool = False
    session_id: Optional[int] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None

@router.get("/providers")
async def get_ai_providers():
    """Получение списка AI провайдеров"""
    try:
        providers = await db.fetch(
            """SELECT id, name, provider_type, model_name, max_tokens, 
                      temperature, is_active, priority, created_at
               FROM ai_providers
               ORDER BY priority DESC, created_at DESC"""
        )
        
        return {"providers": providers, "total": len(providers)}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении провайдеров: {str(e)}"
        )

@router.post("/providers")
async def create_ai_provider(provider: AIProviderCreate):
    """Добавление нового AI провайдера"""
    try:
        provider_id = await db.fetchval(
            """INSERT INTO ai_providers 
               (name, provider_type, api_key, api_endpoint, model_name, 
                max_tokens, temperature, is_active, priority)
               VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
               RETURNING id""",
            provider.name, provider.provider_type, provider.api_key,
            provider.api_endpoint, provider.model_name, provider.max_tokens,
            provider.temperature, provider.priority
        )
        
        return {
            "success": True,
            "message": "AI провайдер добавлен",
            "provider_id": provider_id
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при добавлении провайдера: {str(e)}"
        )

@router.delete("/providers/{provider_id}")
async def delete_ai_provider(provider_id: int):
    """Удаление AI провайдера"""
    try:
        await db.execute("DELETE FROM ai_providers WHERE id = $1", provider_id)
        return {"success": True, "message": "Провайдер удален"}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при удалении провайдера: {str(e)}"
        )

@router.post("/rag/upload")
async def upload_rag_document(
    session_id: int,
    title: str,
    file: UploadFile = File(...)
):
    """Загрузка документа для RAG"""
    try:
        # Читаем содержимое файла
        content = await file.read()
        text_content = content.decode('utf-8')
        
        # Сохраняем документ в БД
        document_id = await db.fetchval(
            """INSERT INTO rag_documents 
               (session_id, title, content, file_path, document_type)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id""",
            session_id, title, text_content, file.filename, 'text'
        )
        
        # Временно отключено - индексация документа
        # await rag_service.index_document(document_id, text_content)
        
        return {
            "success": True,
            "message": "Документ загружен и проиндексирован",
            "document_id": document_id
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при загрузке документа: {str(e)}"
        )

@router.get("/rag/documents")
async def get_rag_documents(session_id: Optional[int] = None):
    """Получение списка документов RAG"""
    try:
        if session_id:
            documents = await db.fetch(
                """SELECT id, title, document_type, created_at, updated_at,
                          LENGTH(content) as content_length
                   FROM rag_documents
                   WHERE session_id = $1
                   ORDER BY created_at DESC""",
                session_id
            )
        else:
            documents = await db.fetch(
                """SELECT id, title, document_type, created_at, updated_at,
                          LENGTH(content) as content_length
                   FROM rag_documents
                   ORDER BY created_at DESC"""
            )
        
        return {"documents": documents, "total": len(documents)}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении документов: {str(e)}"
        )

@router.delete("/rag/documents/{document_id}")
async def delete_rag_document(document_id: int):
    """Удаление документа RAG"""
    try:
        await db.execute("DELETE FROM rag_documents WHERE id = $1", document_id)
        return {"success": True, "message": "Документ удален"}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при удалении документа: {str(e)}"
        )

@router.post("/generate")
async def generate_response(request: GenerateRequest):
    """Генерация ответа с помощью AI"""
    try:
        context = ""
        
        # Временно отключено - получение контекста
        context = ""
        if request.use_rag and request.session_id:
            # context = await rag_service.get_relevant_context(
            #     request.prompt,
            #     request.session_id
            # )
            pass  # Временно отключено
        
        # Генерируем ответ через MTP
        response_text = await mtp_service.generate(
            prompt=request.prompt,
            context=context,
            provider_id=request.provider_id,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )
        
        return {
            "success": True,
            "response": response_text,
            "used_rag": request.use_rag,
            "context_used": bool(context)
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при генерации ответа: {str(e)}"
        )
