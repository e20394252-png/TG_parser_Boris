"""
Сервис для работы с Telegram через Telethon
"""
from telethon import TelegramClient
from telethon.sessions import StringSession
from typing import Dict, Optional
import os
import logging

logger = logging.getLogger(__name__)


class TelegramClientManager:
    def __init__(self):
        self.clients: Dict[int, TelegramClient] = {}

    # ─────────────────────────────────────────────────────────────
    # TData import
    # ─────────────────────────────────────────────────────────────

    async def import_from_tdata(self, tdata_path: str, api_id: int, api_hash: str) -> str:
        """
        Конвертирует TData папку в Telethon StringSession.
        Возвращает session_string для сохранения в БД.
        """
        try:
            from opentele.td import TDesktop
            from opentele.api import UseCurrentSession

            logger.info(f"[TData] Загрузка из: {tdata_path}")
            tdesk = TDesktop(tdata_path)

            if not tdesk.isLoaded():
                raise Exception(
                    "TData не удалось загрузить. "
                    "Убедитесь что архив содержит корректную папку tdata."
                )

            logger.info("[TData] Конвертация в Telethon клиент...")
            client = await tdesk.ToTelethon(
                session=StringSession(),
                flag=UseCurrentSession,
                api_id=api_id,
                api_hash=api_hash,
            )

            await client.connect()
            if not await client.is_user_authorized():
                await client.disconnect()
                raise Exception("Сессия из TData недействительна или истекла.")

            session_string = client.session.save()
            await client.disconnect()
            logger.info("[TData] Конвертация успешна")
            return session_string

        except ImportError as e:
            logger.error(f"[TData] ImportError при импорте opentele: {e}")
            raise Exception(
                f"Ошибка импорта opentele: {e}. "
                "Убедитесь что opentele==1.15.1 установлен и совместим с текущей версией telethon."
            )
        except Exception as e:
            logger.error(f"[TData] Ошибка: {e}")
            raise

    # ─────────────────────────────────────────────────────────────
    # SMS / code flow
    # ─────────────────────────────────────────────────────────────

    async def start_auth(self, session_id: int, phone_number: str, api_id: int, api_hash: str):
        """Начало авторизации - отправка кода"""
        try:
            client = TelegramClient(
                StringSession(),
                api_id,
                api_hash
            )

            await client.connect()
            await client.send_code_request(phone_number)
            self.clients[session_id] = client
            return True

        except Exception as e:
            raise Exception(f"Ошибка при отправке кода: {str(e)}")

    async def verify_code(self, session_id: int, phone_number: str, code: str, password: Optional[str] = None):
        """Подтверждение кода и получение session string"""
        try:
            client = self.clients.get(session_id)

            if not client:
                raise Exception("Клиент не найден. Начните авторизацию заново.")

            try:
                await client.sign_in(phone_number, code)
            except Exception as e:
                if password:
                    await client.sign_in(password=password)
                else:
                    raise Exception("Требуется пароль двухфакторной аутентификации")

            session_string = client.session.save()
            return session_string

        except Exception as e:
            raise Exception(f"Ошибка при подтверждении кода: {str(e)}")

    async def get_client(self, session_id: int, api_id: int, api_hash: str, session_string: str) -> TelegramClient:
        """Получение или создание клиента из сохраненной сессии"""
        if session_id in self.clients:
            return self.clients[session_id]

        try:
            client = TelegramClient(
                StringSession(session_string),
                api_id,
                api_hash
            )

            await client.connect()

            if not await client.is_user_authorized():
                raise Exception("Сессия недействительна. Требуется повторная авторизация.")

            self.clients[session_id] = client
            return client

        except Exception as e:
            raise Exception(f"Ошибка при подключении клиента: {str(e)}")

    async def stop_client(self, session_id: int):
        """Остановка клиента"""
        if session_id in self.clients:
            client = self.clients[session_id]
            await client.disconnect()
            del self.clients[session_id]

    async def get_dialogs(self, session_id: int, api_id: int, api_hash: str, session_string: str):
        """Получение списка диалогов (чатов)"""
        try:
            client = await self.get_client(session_id, api_id, api_hash, session_string)

            dialogs = []
            async for dialog in client.iter_dialogs():
                dialogs.append({
                    'id': dialog.id,
                    'title': dialog.title,
                    'username': getattr(dialog.entity, 'username', None),
                    'is_group': dialog.is_group,
                    'is_channel': dialog.is_channel
                })

            return dialogs

        except Exception as e:
            raise Exception(f"Ошибка при получении диалогов: {str(e)}")

    async def send_message(self, session_id: int, api_id: int, api_hash: str,
                          session_string: str, entity, message: str):
        """Отправка личного сообщения"""
        try:
            client = await self.get_client(session_id, api_id, api_hash, session_string)
            await client.send_message(entity, message)
            return True

        except Exception as e:
            raise Exception(f"Ошибка при отправке сообщения: {str(e)}")
