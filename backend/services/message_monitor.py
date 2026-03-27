"""
Сервис для мониторинга сообщений в Telegram чатах
"""
from telethon import events
import re
from typing import List, Dict
from datetime import datetime

from database.database import db
from services.telegram_client import TelegramClientManager
from services.auto_responder import AutoResponder
# Временно отключаем RAG сервис
# from services.rag_service import RAGService

class MessageMonitor:
    def __init__(self):
        self.telegram_manager = TelegramClientManager()
        self.auto_responder = AutoResponder()
        # Временно отключаем RAG сервис
        # self.rag_service = RAGService()
        self.active_monitors: Dict[int, bool] = {}
    
    async def start_monitoring(self, session_id: int, api_id: int, api_hash: str, session_string: str):
        """Запуск мониторинга для сессии"""
        try:
            client = await self.telegram_manager.get_client(session_id, api_id, api_hash, session_string)
            
            # Получаем список отслеживаемых чатов
            monitored_chats = await db.fetch(
                "SELECT chat_id FROM monitored_chats WHERE session_id = $1 AND is_active = true",
                session_id
            )
            
            chat_ids = [chat['chat_id'] for chat in monitored_chats]
            
            # Регистрируем обработчик новых сообщений
            @client.on(events.NewMessage(chats=chat_ids))
            async def handler(event):
                await self.process_message(session_id, event)
            
            self.active_monitors[session_id] = True
            print(f"✅ Мониторинг запущен для сессии {session_id}")
        
        except Exception as e:
            print(f"❌ Ошибка при запуске мониторинга: {str(e)}")
            raise
    
    async def process_message(self, session_id: int, event):
        """Обработка нового сообщения"""
        try:
            message = event.message
            chat_id = event.chat_id
            sender = await event.get_sender()
            
            # Сохраняем сообщение в историю (для фильтров)
            message_history_id = await db.fetchval(
                """INSERT INTO message_history 
                   (session_id, chat_id, message_id, sender_id, sender_username, message_text, received_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   RETURNING id""",
                session_id, chat_id, message.id, sender.id,
                getattr(sender, 'username', None), message.text, datetime.now()
            )
            
            # Сохраняем сообщение в диалоги (для RAG поиска)
            conversation_message_id = await db.fetchval(
                """INSERT INTO conversation_messages 
                   (session_id, chat_id, message_id, sender_id, sender_username, message_text, message_date, is_outgoing)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                   ON CONFLICT (chat_id, message_id) DO UPDATE 
                   SET message_text = EXCLUDED.message_text
                   RETURNING id""",
                session_id, chat_id, message.id, sender.id,
                getattr(sender, 'username', None), message.text, message.date, False
            )
            
            # Индексируем сообщение в RAG (асинхронно, не блокируем обработку)
            try:
                # Временно отключено
                # await self.rag_service.index_conversation_message(conversation_message_id, session_id)
                pass
            except Exception as e:
                print(f"⚠️ Ошибка индексации сообщения в RAG: {str(e)}")
            
            # Обновляем статистику
            await self.update_statistics(session_id, 'messages_monitored')
            
            # Проверяем фильтры
            matched_filter = await self.check_filters(session_id, chat_id, message.text)
            
            if matched_filter:
                # Обновляем сообщение с matched_filter_id
                await db.execute(
                    "UPDATE message_history SET matched_filter_id = $1, processed = true, processed_at = $2 WHERE id = $3",
                    matched_filter['id'], datetime.now(), message_history_id
                )
                
                # Обновляем статистику
                await self.update_statistics(session_id, 'messages_matched')
                
                # Получаем автоответ для этого фильтра
                response = await self.get_response_for_filter(matched_filter['id'])
                
                if response:
                    # Отправляем автоответ
                    await self.auto_responder.send_response(
                        session_id=session_id,
                        message_history_id=message_history_id,
                        response=response,
                        recipient_id=sender.id
                    )
        
        except Exception as e:
            print(f"❌ Ошибка при обработке сообщения: {str(e)}")
    
    async def check_filters(self, session_id: int, chat_id: int, message_text: str) -> Dict:
        """Проверка сообщения на соответствие фильтрам"""
        try:
            # Получаем активные фильтры для этого чата
            filters = await db.fetch(
                """SELECT f.id, f.filter_type, f.pattern, f.case_sensitive
                   FROM message_filters f
                   JOIN filter_chat_mapping fcm ON f.id = fcm.filter_id
                   JOIN monitored_chats mc ON fcm.chat_id = mc.id
                   WHERE f.session_id = $1 AND mc.chat_id = $2 AND f.is_active = true""",
                session_id, chat_id
            )
            
            for filter_data in filters:
                if self.match_filter(message_text, filter_data):
                    return filter_data
            
            return None
        
        except Exception as e:
            print(f"❌ Ошибка при проверке фильтров: {str(e)}")
            return None
    
    def match_filter(self, text: str, filter_data: Dict) -> bool:
        """Проверка текста на соответствие фильтру"""
        pattern = filter_data['pattern']
        filter_type = filter_data['filter_type']
        case_sensitive = filter_data['case_sensitive']
        
        if filter_type == 'keyword':
            if case_sensitive:
                return pattern in text
            else:
                return pattern.lower() in text.lower()
        
        elif filter_type == 'regex':
            flags = 0 if case_sensitive else re.IGNORECASE
            return bool(re.search(pattern, text, flags))
        
        # AI фильтр можно реализовать позже
        return False
    
    async def get_response_for_filter(self, filter_id: int):
        """Получение автоответа для фильтра"""
        try:
            response = await db.fetchrow(
                """SELECT r.* FROM auto_responses r
                   JOIN filter_response_mapping frm ON r.id = frm.response_id
                   WHERE frm.filter_id = $1 AND r.is_active = true
                   LIMIT 1""",
                filter_id
            )
            
            return response
        
        except Exception as e:
            print(f"❌ Ошибка при получении ответа: {str(e)}")
            return None
    
    async def update_statistics(self, session_id: int, field: str):
        """Обновление статистики"""
        try:
            today = datetime.now().date()
            
            await db.execute(
                f"""INSERT INTO statistics (session_id, date, {field})
                    VALUES ($1, $2, 1)
                    ON CONFLICT (session_id, date)
                    DO UPDATE SET {field} = statistics.{field} + 1""",
                session_id, today
            )
        
        except Exception as e:
            print(f"❌ Ошибка при обновлении статистики: {str(e)}")
    
    async def stop_monitoring(self, session_id: int):
        """Остановка мониторинга"""
        self.active_monitors[session_id] = False
        await self.telegram_manager.stop_client(session_id)
        print(f"🛑 Мониторинг остановлен для сессии {session_id}")
