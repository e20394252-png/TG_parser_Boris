"""
Роутер для аутентификации Telegram
"""
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import asyncio
import os
import uuid
import zipfile
import shutil
import logging
import aiofiles

from database.database import db
from services.telegram_client import TelegramClientManager
from services.auth_deps import require_user_id

logger = logging.getLogger(__name__)


router = APIRouter()
telegram_manager = TelegramClientManager()

class TelegramAuthStart(BaseModel):
    phone_number: str
    api_id: str
    api_hash: str

class TelegramAuthCode(BaseModel):
    phone_number: str
    code: str
    password: Optional[str] = None

class AuthResponse(BaseModel):
    success: bool
    message: str
    session_id: Optional[int] = None

@router.post("/telegram/start", response_model=AuthResponse)
async def start_telegram_auth(
    data: TelegramAuthStart,
    user_id: int = Depends(require_user_id)
):
    """
    Начало авторизации в Telegram
    Отправляет код подтверждения на телефон
    """
    try:
        # Проверяем, существует ли уже сессия
        existing = await db.fetchrow(
            "SELECT id FROM telegram_sessions WHERE phone_number = $1",
            data.phone_number
        )
        
        if existing:
            session_id = existing['id']
            # Обновляем API credentials
            await db.execute(
                "UPDATE telegram_sessions SET api_id = $1, api_hash = $2 WHERE id = $3",
                data.api_id, data.api_hash, session_id
            )
        else:
            # Создаем новую сессию для текущего пользователя
            session_id = await db.fetchval(
                """INSERT INTO telegram_sessions (user_id, phone_number, api_id, api_hash) 
                   VALUES ($1, $2, $3, $4) RETURNING id""",
                user_id, data.phone_number, data.api_id, data.api_hash
            )
        
        # Инициализируем Telegram клиент и отправляем код
        await telegram_manager.start_auth(
            session_id=session_id,
            phone_number=data.phone_number,
            api_id=int(data.api_id),
            api_hash=data.api_hash
        )
        
        return AuthResponse(
            success=True,
            message="Код подтверждения отправлен на ваш Telegram",
            session_id=session_id
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка при отправке кода: {str(e)}"
        )

@router.post("/telegram/code", response_model=AuthResponse)
async def submit_telegram_code(
    data: TelegramAuthCode,
    user_id: int = Depends(require_user_id)
):
    """
    Подтверждение кода авторизации Telegram
    """
    try:
        # Получаем session_id
        session = await db.fetchrow(
            "SELECT id, api_id, api_hash FROM telegram_sessions WHERE phone_number = $1",
            data.phone_number
        )
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Сессия не найдена. Начните авторизацию заново."
            )
        
        # Подтверждаем код
        session_string = await telegram_manager.verify_code(
            session_id=session['id'],
            phone_number=data.phone_number,
            code=data.code,
            password=data.password
        )
        
        # Сохраняем session string и активируем сессию
        await db.execute(
            """UPDATE telegram_sessions 
               SET session_string = $1, is_active = true, updated_at = CURRENT_TIMESTAMP
               WHERE id = $2""",
            session_string, session['id']
        )
        
        # Автоматический запуск мониторинга для новой сессии
        try:
            from services.message_monitor import monitor_service
            await monitor_service.start_monitoring(
                session_id=session['id'],
                api_id=int(session['api_id']),
                api_hash=session['api_hash'],
                session_string=session_string
            )
        except Exception as e:
            print(f"Ошибка запуска мониторинга при авторизации: {e}")
        
        return AuthResponse(
            success=True,
            message="Авторизация успешна!",
            session_id=session['id']
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка при подтверждении кода: {str(e)}"
        )

@router.get("/status")
async def get_auth_status(user_id: int = Depends(require_user_id)):
    """
    Получение статуса авторизации — только сессии текущего пользователя
    """
    try:
        sessions = await db.fetch(
            """SELECT id, phone_number, is_active, created_at, updated_at
               FROM telegram_sessions
               WHERE user_id = $1
               ORDER BY created_at DESC""",
            user_id
        )
        
        return {
            "sessions": sessions,
            "active_count": sum(1 for s in sessions if s['is_active'])
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении статуса: {str(e)}"
        )

@router.delete("/telegram/{session_id}")
async def logout_telegram(
    session_id: int,
    user_id: int = Depends(require_user_id)
):
    """
    Выход из Telegram аккаунта (только своя сессия)
    """
    try:
        # Проверяем владельца сессии
        owner = await db.fetchval(
            "SELECT user_id FROM telegram_sessions WHERE id = $1", session_id
        )
        if owner is None:
            raise HTTPException(status_code=404, detail="Сессия не найдена")
        if owner != user_id:
            raise HTTPException(status_code=403, detail="Доступ запрещён")

        await db.execute(
            "UPDATE telegram_sessions SET is_active = false WHERE id = $1",
            session_id
        )
        
        try:
            from services.message_monitor import monitor_service
            await monitor_service.stop_monitoring(session_id)
        except Exception:
            pass
            
        await telegram_manager.stop_client(session_id)
        return {"success": True, "message": "Выход выполнен"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка при выходе: {str(e)}"
        )


# ──────────────── TData Import ────────────────

MAX_TDATA_ZIP_SIZE = 100 * 1024 * 1024  # 100 MB


@router.post("/telegram/tdata", response_model=AuthResponse)
async def import_tdata(
    file: UploadFile = File(..., description="ZIP-архив с папкой tdata"),
    user_id: int = Depends(require_user_id),
):
    """
    Импорт Telegram-сессии из TData (Telegram Desktop).
    
    Принимает ZIP-архив с папкой tdata, конвертирует в StringSession
    и сохраняет как обычную сессию. API ID/Hash берутся из env-переменных.
    """
    # Берём API креденшиалы с сервера
    api_id_str = os.environ.get("TELEGRAM_API_ID", "")
    api_hash = os.environ.get("TELEGRAM_API_HASH", "")
    if not api_id_str or not api_hash:
        raise HTTPException(
            status_code=500,
            detail="TELEGRAM_API_ID / TELEGRAM_API_HASH не сконфигурированы на сервере"
        )
    api_id = int(api_id_str)
    # Проверка типа файла
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Файл должен быть .zip архивом")

    tmp_dir = None
    try:
        # Создаём уникальную временную директорию
        tmp_dir = os.path.join("/tmp", f"tdata_{uuid.uuid4().hex}")
        os.makedirs(tmp_dir, exist_ok=True)
        zip_path = os.path.join(tmp_dir, "tdata.zip")

        # Сохраняем загруженный файл
        size = 0
        async with aiofiles.open(zip_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):  # читаем по 1 MB
                size += len(chunk)
                if size > MAX_TDATA_ZIP_SIZE:
                    raise HTTPException(status_code=413, detail="Файл слишком большой (максимум 100 MB)")
                await f.write(chunk)

        # Распаковываем с защитой от path traversal
        extract_dir = os.path.join(tmp_dir, "extracted")
        os.makedirs(extract_dir, exist_ok=True)

        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.namelist():
                # Защита от path traversal (zip slip)
                member_path = os.path.realpath(os.path.join(extract_dir, member))
                if not member_path.startswith(os.path.realpath(extract_dir)):
                    raise HTTPException(status_code=400, detail="Подозрительный ZIP-архив (path traversal)")
            zf.extractall(extract_dir)

        # Ищем папку tdata внутри архива
        tdata_path = _find_tdata_folder(extract_dir)
        if not tdata_path:
            raise HTTPException(
                status_code=400,
                detail="Папка tdata не найдена в архиве. Убедитесь что архив содержит папку tdata/ с файлами key_datas, D877F783D5D3EF8C и т.д."
            )

        logger.info(f"[TData] Найдена папка: {tdata_path}")

        # Конвертируем в StringSession
        session_string = await telegram_manager.import_from_tdata(
            tdata_path=tdata_path,
            api_id=api_id,
            api_hash=api_hash,
        )

        # Получаем информацию об аккаунте для phone_number
        from telethon import TelegramClient
        from telethon.sessions import StringSession as SS
        tmp_client = TelegramClient(SS(session_string), int(api_id), api_hash)
        await tmp_client.connect()
        me = await tmp_client.get_me()
        await tmp_client.disconnect()

        phone = me.phone or f"tdata_{me.id}"
        display_phone = f"+{phone}" if not phone.startswith("+") else phone

        # Сохраняем сессию в БД (upsert по phone_number)
        existing = await db.fetchrow(
            "SELECT id FROM telegram_sessions WHERE phone_number = $1",
            display_phone
        )

        if existing:
            session_id = existing["id"]
            await db.execute(
                """UPDATE telegram_sessions
                   SET session_string = $1, api_id = $2, api_hash = $3,
                       is_active = true, updated_at = CURRENT_TIMESTAMP
                   WHERE id = $4""",
                session_string, str(api_id), api_hash, session_id
            )
        else:
            session_id = await db.fetchval(
                """INSERT INTO telegram_sessions (user_id, phone_number, api_id, api_hash, session_string, is_active)
                   VALUES ($1, $2, $3, $4, $5, true) RETURNING id""",
                user_id, display_phone, str(api_id), api_hash, session_string
            )

        # Запускаем мониторинг
        try:
            from services.message_monitor import monitor_service
            await monitor_service.start_monitoring(
                session_id=session_id,
                api_id=int(api_id),
                api_hash=api_hash,
                session_string=session_string,
            )
        except Exception as e:
            logger.warning(f"[TData] Мониторинг не запущен: {e}")

        logger.info(f"[TData] Сессия сохранена: {display_phone} (id={session_id})")
        return AuthResponse(
            success=True,
            message=f"Аккаунт {display_phone} успешно импортирован из TData",
            session_id=session_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[TData] Критическая ошибка: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    finally:
        # Всегда чистим временные файлы
        if tmp_dir and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)


def _find_tdata_folder(root: str) -> Optional[str]:
    """
    Ищет папку tdata внутри распакованного архива.
    Признак tdata: наличие файла 'key_datas' в папке.
    """
    # 1. Сам корень
    if os.path.isfile(os.path.join(root, "key_datas")):
        return root

    # 2. Папка tdata/ в корне
    tdata_candidate = os.path.join(root, "tdata")
    if os.path.isdir(tdata_candidate) and os.path.isfile(os.path.join(tdata_candidate, "key_datas")):
        return tdata_candidate

    # 3. Глубже (на случай вложенных архивов)
    for dirpath, dirnames, filenames in os.walk(root):
        if "key_datas" in filenames:
            return dirpath

    return None
