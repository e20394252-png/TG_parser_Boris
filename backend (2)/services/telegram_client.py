"""
Сервис для работы с Telegram через Telethon
"""
from telethon import TelegramClient
from telethon.sessions import StringSession
from typing import Dict, Optional
import os

class TelegramClientManager:
    def __init__(self):
        self.clients: Dict[int, TelegramClient] = {}
    
    async def start_auth(self, session_id: int, phone_number: str, api_id: int, api_hash: str):
        """Начало авторизации - отправка кода"""
        try:
            # Создаем клиент с пустой сессией
            client = TelegramClient(
                StringSession(),
                api_id,
                api_hash
            )
            
            await client.connect()
            
            # Отправляем код
            await client.send_code_request(phone_number)
            
            # Сохраняем клиент временно
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
            
            # Авторизуемся с кодом
            try:
                await client.sign_in(phone_number, code)
            except Exception as e:
                # Если требуется 2FA пароль
                if password:
                    await client.sign_in(password=password)
                else:
                    raise Exception("Требуется пароль двухфакторной аутентификации")
            
            # Получаем session string
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
                          session_string: str, user_id: int, message: str):
        """Отправка личного сообщения"""
        try:
            client = await self.get_client(session_id, api_id, api_hash, session_string)
            
            await client.send_message(user_id, message)
            
            return True
        
        except Exception as e:
            raise Exception(f"Ошибка при отправке сообщения: {str(e)}")
