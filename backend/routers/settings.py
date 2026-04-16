"""
Роутер для управления настройками пользователя
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json

from database.database import db
from services.auth_deps import require_user_id

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingUpdate(BaseModel):
    key: str
    value: Dict[str, Any]


class SettingsExport(BaseModel):
    settings: Dict[str, Any]


# ── Дефолтные настройки ──────────────────────────────────────────────────────
DEFAULT_SETTINGS = {
    'general': {
        'language': 'ru',
        'theme': 'dark',
        'notifications': True,
    },
    'telegram': {
        'connection_timeout': 30,
        'retry_attempts': 3,
        'auto_reconnect': True,
        'tdata_enabled': False,
    },
    'ai': {
        'default_provider': 'openai',
        'max_tokens': 1000,
        'temperature': 0.7,
    },
    'rag': {
        'context_size': 3,
        'chunk_size': 500,
        'chunk_overlap': 50,
        'embedding_model': 'all-MiniLM-L6-v2',
    },
    'monitoring': {
        'check_interval': 5,
        'max_messages_per_hour': 100,
    },
}


# ── Вспомогательные функции ──────────────────────────────────────────────────

async def _fetch_settings(user_id: int) -> Dict[str, Any]:
    """Читаем настройки из user_preferences (привязка к users.id)."""
    rows = await db.fetch(
        "SELECT setting_key, setting_value FROM user_preferences WHERE user_id = $1",
        user_id,
    )
    result: Dict[str, Any] = {}
    for row in rows:
        val = row['setting_value']
        # asyncpg с JSONB возвращает уже распарсенный dict/list/bool/...
        # но на всякий случай парсим строку если пришла строка
        if isinstance(val, str):
            try:
                val = json.loads(val)
            except Exception:
                pass
        result[row['setting_key']] = val
    return result


async def _upsert_setting(user_id: int, key: str, value: Any) -> None:
    """Сохраняем / обновляем одну настройку."""
    await db.execute(
        """INSERT INTO user_preferences (user_id, setting_key, setting_value)
           VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (user_id, setting_key)
           DO UPDATE SET setting_value = EXCLUDED.setting_value,
                         updated_at    = CURRENT_TIMESTAMP""",
        user_id,
        key,
        json.dumps(value),
    )


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
async def get_settings(user_id: int = Depends(require_user_id)):
    """Получение настроек текущего пользователя."""
    try:
        stored = await _fetch_settings(user_id)

        # Глубоко мержим дефолтные настройки с сохранёнными
        merged: Dict[str, Any] = {}
        all_keys = set(DEFAULT_SETTINGS) | set(stored)
        for key in all_keys:
            default_val = DEFAULT_SETTINGS.get(key, {})
            stored_val  = stored.get(key)
            if isinstance(default_val, dict) and isinstance(stored_val, dict):
                merged[key] = {**default_val, **stored_val}
            elif stored_val is not None:
                merged[key] = stored_val
            else:
                merged[key] = default_val

        return {"success": True, "settings": merged}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("")
async def update_settings(
    update: SettingUpdate,
    user_id: int = Depends(require_user_id),
):
    """Обновление одной настройки."""
    try:
        await _upsert_setting(user_id, update.key, update.value)
        return {"success": True, "message": f"Настройка '{update.key}' обновлена"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export")
async def export_settings(user_id: int = Depends(require_user_id)):
    """Экспорт настроек."""
    try:
        stored = await _fetch_settings(user_id)
        return {"success": True, "export": stored}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import")
async def import_settings(
    data: SettingsExport,
    user_id: int = Depends(require_user_id),
):
    """Импорт настроек."""
    try:
        imported_count = 0
        for key, value in data.settings.items():
            await _upsert_setting(user_id, key, value)
            imported_count += 1
        return {"success": True, "imported": imported_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{key}")
async def delete_setting(
    key: str,
    user_id: int = Depends(require_user_id),
):
    """Удаление настройки."""
    try:
        await db.execute(
            "DELETE FROM user_preferences WHERE user_id = $1 AND setting_key = $2",
            user_id, key,
        )
        return {"success": True, "message": f"Настройка '{key}' удалена"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
