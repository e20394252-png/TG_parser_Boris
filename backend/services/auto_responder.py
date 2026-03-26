"""
Сервис для автоматических ответов
"""
from datetime import datetime
from typing import Dict

from database.database import db
from services.telegram_client import TelegramClientManager
from services.mtp_service import MTPService
from services.rag_service import RAGService

class AutoResponder:
    def __init__(self):
        self.telegram_manager = TelegramClientManager()
        self.mtp_service = MTPService()
        self.rag_service = RAGService()
    
    async def send_response(self, session_id: int, message_history_id: int, 
                           response: Dict, recipient_id: int):
        """Отправка автоответа пользователю"""
        try:
            # Получаем данные сессии
            session = await db.fetchrow(
                "SELECT api_id, api_hash, session_string FROM telegram_sessions WHERE id = $1",
                session_id
            )
            
            if not session:
                raise Exception("Сессия не найдена")
            
            # Генерируем текст ответа
            response_text = await self.generate_response_text(
                session_id=session_id,
                response=response,
                message_history_id=message_history_id
            )
            
            # Отправляем сообщение
            try:
                await self.telegram_manager.send_message(
                    session_id=session_id,
                    api_id=int(session['api_id']),
                    api_hash=session['api_hash'],
                    session_string=session['session_string'],
                    user_id=recipient_id,
                    message=response_text
                )
                
                # Сохраняем в историю отправленных ответов
                await db.execute(
                    """INSERT INTO sent_responses 
                       (message_history_id, response_id, recipient_id, response_text, sent_at, success)
                       VALUES ($1, $2, $3, $4, $5, true)""",
                    message_history_id, response['id'], recipient_id, response_text, datetime.now()
                )
                
                # Обновляем статистику
                await self.update_statistics(session_id, 'responses_sent')
                
                print(f"✅ Ответ отправлен пользователю {recipient_id}")
            
            except Exception as e:
                # Сохраняем ошибку
                await db.execute(
                    """INSERT INTO sent_responses 
                       (message_history_id, response_id, recipient_id, response_text, sent_at, success, error_message)
                       VALUES ($1, $2, $3, $4, $5, false, $6)""",
                    message_history_id, response['id'], recipient_id, response_text, datetime.now(), str(e)
                )
                
                # Обновляем статистику
                await self.update_statistics(session_id, 'responses_failed')
                
                raise
        
        except Exception as e:
            print(f"❌ Ошибка при отправке ответа: {str(e)}")
            raise
    
    async def generate_response_text(self, session_id: int, response: Dict, message_history_id: int) -> str:
        """Генерация текста ответа"""
        try:
            response_type = response['response_type']
            
            # Простой шаблон
            if response_type == 'template' and not response['use_ai']:
                return response['template_text']
            
            # AI генерация
            if response['use_ai']:
                # Получаем оригинальное сообщение для контекста
                original_message = await db.fetchval(
                    "SELECT message_text FROM message_history WHERE id = $1",
                    message_history_id
                )
                
                prompt = response['template_text'] or f"Ответь на сообщение: {original_message}"
                
                # Если используется RAG, получаем контекст
                context = ""
                if response['use_rag']:
                    context = await self.rag_service.get_relevant_context(
                        original_message,
                        session_id
                    )
                
                # Генерируем через MTP
                generated_text = await self.mtp_service.generate(
                    prompt=prompt,
                    context=context,
                    provider_id=response['ai_provider_id']
                )
                
                return generated_text
            
            return response['template_text']
        
        except Exception as e:
            print(f"❌ Ошибка при генерации текста: {str(e)}")
            # Fallback на шаблон
            return response.get('template_text', 'Спасибо за сообщение!')
    
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
