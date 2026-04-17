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

    async def import_from_tdata(self, tdata_path: str) -> tuple:
        """
        Конвертирует TData папку в Telethon StringSession.

        Использует opentele ТОЛЬКО для чтения бинарных файлов TData.
        StringSession создаётся вручную (обход сломанного opentele.FromTDesktop).
        Возвращает (session_string, api_id, api_hash).
        """
        try:
            from opentele.td import TDesktop
            from telethon.crypto import AuthKey as TelethonAuthKey

            # Telegram production DC IPs (официальные, стабильные)
            TELEGRAM_DC_IPS = {
                1: '149.154.175.53',
                2: '149.154.167.51',
                3: '149.154.175.100',
                4: '149.154.167.91',
                5: '91.108.56.130',
            }

            logger.info(f"[TData] Загрузка из: {tdata_path}")
            tdesk = TDesktop(tdata_path)

            if not tdesk.isLoaded():
                raise Exception(
                    "TData не удалось загрузить. "
                    "Убедитесь что архив содержит корректную папку tdata."
                )

            account = tdesk.mainAccount
            api_id: int  = account.api.api_id
            api_hash: str = account.api.api_hash
            dc_id: int   = int(account.MainDcId)

            if account.authKey is None:
                raise Exception("authKey не найден в TData — сессия не авторизована.")

            auth_key_bytes = account.authKey.key   # 256 bytes

            logger.info(f"[TData] Извлечены данные: api_id={api_id}, dc_id={dc_id}")

            # Пытаемся прочитать реальный IP из конфига TData
            dc_ip   = TELEGRAM_DC_IPS.get(dc_id, '149.154.167.51')
            dc_port = 443
            try:
                from opentele.td import shared as td_shared
                endpoints = account._local.config.endpoints(account.MainDcId)
                addr_ipv4 = td_shared.MTP.DcOptions.Address.IPv4
                proto_tcp = td_shared.MTP.DcOptions.Protocol.Tcp
                eps = (endpoints.get(addr_ipv4) or {}).get(proto_tcp) or []
                if eps:
                    dc_ip   = eps[0].ip
                    dc_port = eps[0].port
                    logger.info(f"[TData] DC endpoint из TData: {dc_ip}:{dc_port}")
            except Exception as ep_err:
                logger.warning(f"[TData] Не удалось прочитать endpoints из TData, используем стандартные ({dc_ip}): {ep_err}")

            # Собираем Telethon StringSession вручную — без opentele.ToTelethon()
            session = StringSession()
            session.set_dc(dc_id, dc_ip, dc_port)
            session.auth_key = TelethonAuthKey(auth_key_bytes)

            logger.info(f"[TData] Подключение к Telegram (DC{dc_id})...")
            client = TelegramClient(session, api_id, api_hash)
            await client.connect()

            session_string = client.session.save()

            # get_me() делает прямой API-вызов и возвращает пользователя
            # (is_user_authorized может ошибаться для вручную собранных сессий)
            try:
                me = await client.get_me()
            except Exception as me_err:
                await client.disconnect()
                raise Exception(f"Ошибка проверки сессии TData: {me_err}")

            if me is None:
                await client.disconnect()
                raise Exception(
                    "Сессия из TData недействительна или истекла. "
                    "Убедитесь что аккаунт не был разлогинен."
                )

            phone = me.phone or str(me.id)
            await client.disconnect()
            logger.info(f"[TData] Конвертация успешна, аккаунт: +{phone}")
            return session_string, api_id, api_hash, phone

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
