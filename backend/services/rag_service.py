"""
Сервис RAG (Retrieval-Augmented Generation)
"""
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Optional
import os

from database.database import db

class RAGService:
    def __init__(self):
        # Используем модель для создания embeddings
        model_name = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
        self.model = SentenceTransformer(model_name)
        self.chunk_size = 500  # Размер чанка текста
        self.chunk_overlap = 50  # Перекрытие между чанками
    
    def chunk_text(self, text: str) -> List[str]:
        """Разбиение текста на чанки"""
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + self.chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start = end - self.chunk_overlap
        
        return chunks
    
    async def index_document(self, document_id: int, content: str):
        """Индексация документа - создание embeddings"""
        try:
            # Разбиваем на чанки
            chunks = self.chunk_text(content)
            
            # Создаем embeddings для каждого чанка
            for idx, chunk in enumerate(chunks):
                embedding = self.model.encode(chunk).tolist()
                
                # Сохраняем в БД
                await db.execute(
                    """INSERT INTO rag_embeddings (document_id, chunk_text, chunk_index, embedding)
                       VALUES ($1, $2, $3, $4)""",
                    document_id, chunk, idx, embedding
                )
            
            print(f"✅ Документ {document_id} проиндексирован ({len(chunks)} чанков)")
        
        except Exception as e:
            print(f"❌ Ошибка при индексации документа: {str(e)}")
            raise
    
    async def get_relevant_context(self, query: str, session_id: int, top_k: int = 3) -> str:
        """Получение релевантного контекста для запроса"""
        try:
            # Создаем embedding для запроса
            query_embedding = self.model.encode(query).tolist()
            
            # Ищем наиболее похожие чанки через cosine similarity
            results = await db.fetch(
                """SELECT e.chunk_text, 
                          1 - (e.embedding <=> $1::vector) as similarity
                   FROM rag_embeddings e
                   JOIN rag_documents d ON e.document_id = d.id
                   WHERE d.session_id = $2
                   ORDER BY e.embedding <=> $1::vector
                   LIMIT $3""",
                query_embedding, session_id, top_k
            )
            
            if not results:
                return ""
            
            # Объединяем релевантные чанки
            context = "\n\n".join([r['chunk_text'] for r in results])
            
            return context
        
        except Exception as e:
            print(f"❌ Ошибка при поиске контекста: {str(e)}")
            return ""
    
    async def search_documents(self, query: str, session_id: int, limit: int = 5):
        """Поиск документов по запросу"""
        try:
            query_embedding = self.model.encode(query).tolist()
            
            results = await db.fetch(
                """SELECT DISTINCT d.id, d.title, d.document_type,
                          MAX(1 - (e.embedding <=> $1::vector)) as max_similarity
                   FROM rag_documents d
                   JOIN rag_embeddings e ON d.id = e.document_id
                   WHERE d.session_id = $2
                   GROUP BY d.id, d.title, d.document_type
                   ORDER BY max_similarity DESC
                   LIMIT $3""",
                query_embedding, session_id, limit
            )
            
            return results
        
        except Exception as e:
            print(f"❌ Ошибка при поиске документов: {str(e)}")
            return []
    
    async def index_conversation_message(self, message_id: int, session_id: int, context_size: int = 3):
        """Индексация сообщения из диалога с контекстным окном"""
        try:
            # Получаем сообщение
            message = await db.fetchrow(
                """SELECT id, chat_id, message_text, message_date, sender_username
                   FROM conversation_messages
                   WHERE id = $1""",
                message_id
            )
            
            if not message:
                return
            
            # Получаем контекстное окно (предыдущие и следующие сообщения)
            context_messages = await db.fetch(
                """SELECT message_text, sender_username, is_outgoing
                   FROM conversation_messages
                   WHERE chat_id = $1 
                   AND message_date <= $2
                   ORDER BY message_date DESC
                   LIMIT $3""",
                message['chat_id'], message['message_date'], context_size
            )
            
            # Формируем контекстное окно
            context_lines = []
            for msg in reversed(context_messages):
                sender = "Вы" if msg['is_outgoing'] else (msg['sender_username'] or "Собеседник")
                context_lines.append(f"[{sender}]: {msg['message_text']}")
            
            context_window = "\n".join(context_lines)
            
            # Создаем embedding для контекстного окна
            embedding = self.model.encode(context_window).tolist()
            
            # Проверяем, существует ли уже embedding для этого сообщения
            existing = await db.fetchval(
                "SELECT id FROM conversation_embeddings WHERE message_id = $1",
                message_id
            )
            
            if existing:
                # Обновляем существующий
                await db.execute(
                    """UPDATE conversation_embeddings 
                       SET embedding = $1, context_window = $2, context_size = $3
                       WHERE message_id = $4""",
                    embedding, context_window, context_size, message_id
                )
            else:
                # Создаем новый
                await db.execute(
                    """INSERT INTO conversation_embeddings 
                       (message_id, session_id, embedding, context_window, context_size)
                       VALUES ($1, $2, $3, $4, $5)""",
                    message_id, session_id, embedding, context_window, context_size
                )
            
            print(f"✅ Сообщение {message_id} проиндексировано")
        
        except Exception as e:
            print(f"❌ Ошибка при индексации сообщения: {str(e)}")
            raise
    
    async def search_conversations(self, query: str, session_id: int, 
                                   chat_id: Optional[int] = None, 
                                   limit: int = 10):
        """Семантический поиск по диалогам"""
        try:
            # Создаем embedding для запроса
            query_embedding = self.model.encode(query).tolist()
            
            # Базовый SQL запрос
            sql = """
                SELECT 
                    cm.id,
                    cm.chat_id,
                    cm.message_id,
                    cm.sender_username,
                    cm.message_text,
                    cm.message_date,
                    cm.is_outgoing,
                    ce.context_window,
                    1 - (ce.embedding <=> $1::vector) as similarity
                FROM conversation_embeddings ce
                JOIN conversation_messages cm ON ce.message_id = cm.id
                WHERE ce.session_id = $2
            """
            
            params = [query_embedding, session_id]
            param_idx = 3
            
            # Добавляем фильтр по чату если указан
            if chat_id:
                sql += f" AND cm.chat_id = ${param_idx}"
                params.append(chat_id)
                param_idx += 1
            
            sql += f" ORDER BY ce.embedding <=> $1::vector LIMIT ${param_idx}"
            params.append(limit)
            
            results = await db.fetch(sql, *params)
            
            return [{
                'id': r['id'],
                'chat_id': r['chat_id'],
                'message_id': r['message_id'],
                'sender': r['sender_username'] or 'Unknown',
                'message': r['message_text'],
                'date': r['message_date'],
                'is_outgoing': r['is_outgoing'],
                'context': r['context_window'],
                'similarity': float(r['similarity'])
            } for r in results]
        
        except Exception as e:
            print(f"❌ Ошибка при поиске по диалогам: {str(e)}")
            return []
    
    async def get_conversation_context(self, message_id: int, context_size: int = 5):
        """Получение контекста вокруг найденного сообщения"""
        try:
            # Получаем целевое сообщение
            message = await db.fetchrow(
                "SELECT chat_id, message_date FROM conversation_messages WHERE id = $1",
                message_id
            )
            
            if not message:
                return []
            
            # Получаем сообщения до и после
            messages = await db.fetch(
                """SELECT id, message_text, sender_username, message_date, is_outgoing
                   FROM conversation_messages
                   WHERE chat_id = $1 
                   AND message_date BETWEEN $2 - INTERVAL '1 hour' AND $2 + INTERVAL '1 hour'
                   ORDER BY message_date
                   LIMIT $3""",
                message['chat_id'], message['message_date'], context_size * 2 + 1
            )
            
            return [{
                'id': m['id'],
                'text': m['message_text'],
                'sender': m['sender_username'] or 'Unknown',
                'date': m['message_date'],
                'is_outgoing': m['is_outgoing']
            } for m in messages]
        
        except Exception as e:
            print(f"❌ Ошибка при получении контекста: {str(e)}")
            return []
