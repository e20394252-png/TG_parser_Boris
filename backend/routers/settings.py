"""
Роутер для управления настройками пользователя
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json

from database.database import db

router = APIRouter(prefix="/settings", tags=["settings"])

class SettingUpdate(BaseModel):
    key: str
    value: Dict[str, Any]

class SettingsExport(BaseModel):
    settings: Dict[str, Any]

@router.get("")
async def get_settings(session_id: Optional[int] = Query(None)):
    """Получение всех настроек пользователя"""
    try:
        if not session_id:
            session_id = 1  # TODO: получать из контекста авторизации
        
        settings = await db.fetch(
            "SELECT setting_key, setting_value FROM user_settings WHERE session_id = $1",
            session_id
        )
        
        # Преобразуем в словарь
        settings_dict = {s['setting_key']: s['setting_value'] for s in settings}
        
        # Добавляем дефолтные настройки если их нет
        default_settings = {
            'general': {
                'language': 'ru',
                'theme': 'dark',
                'notifications': True
            },
            'telegram': {
                'connection_timeout': 30,
                'retry_attempts': 3,
                'auto_reconnect': True
            },
            'ai': {
                'default_provider': 'openai',
                'max_tokens': 1000,
                'temperature': 0.7
            },
            'rag': {
                'context_size': 3,
                'chunk_size': 500,
                'chunk_overlap': 50,
                'embedding_model': 'all-MiniLM-L6-v2'
            },
            'monitoring': {
                'check_interval': 5,
                'max_messages_per_hour': 100
            }
        }
        
        # Объединяем с дефолтными
        for key, value in default_settings.items():
            if key not in settings_dict:
                settings_dict[key] = value
        
        return {
            "success": True,
            "settings": settings_dict
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("")
async def update_settings(update: SettingUpdate, session_id: Optional[int] = Query(None)):
    """Обновление настройки"""
    try:
        if not session_id:
            session_id = 1
        
        await db.execute(
            """INSERT INTO user_settings (session_id, setting_key, setting_value)
               VALUES ($1, $2, $3)
               ON CONFLICT (session_id, setting_key)
               DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP""",
            session_id, update.key, json.dumps(update.value)
        )
        
        return {
            "success": True,
            "message": f"Настройка '{update.key}' обновлена"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export")
async def export_settings(session_id: Optional[int] = Query(None)):
    """Экспорт всех настроек"""
    try:
        if not session_id:
            session_id = 1
        
        settings = await db.fetch(
            "SELECT setting_key, setting_value FROM user_settings WHERE session_id = $1",
            session_id
        )
        
        settings_dict = {s['setting_key']: s['setting_value'] for s in settings}
        
        return {
            "success": True,
            "export": settings_dict
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/import")
async def import_settings(data: SettingsExport, session_id: Optional[int] = Query(None)):
    """Импорт настроек"""
    try:
        if not session_id:
            session_id = 1
        
        imported_count = 0
        for key, value in data.settings.items():
            await db.execute(
                """INSERT INTO user_settings (session_id, setting_key, setting_value)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (session_id, setting_key)
                   DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP""",
                session_id, key, json.dumps(value)
            )
            imported_count += 1
        
        return {
            "success": True,
            "imported": imported_count
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{key}")
async def delete_setting(key: str, session_id: Optional[int] = Query(None)):
    """Удаление настройки"""
    try:
        if not session_id:
            session_id = 1
        
        await db.execute(
            "DELETE FROM user_settings WHERE session_id = $1 AND setting_key = $2",
            session_id, key
        )
        
        return {
            "success": True,
            "message": f"Настройка '{key}' удалена"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
