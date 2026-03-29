"""
Модуль для работы с базой данных PostgreSQL через asyncpg
"""
import asyncpg
import os
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

class Database:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.database_url = os.getenv('DATABASE_URL', 
            'postgresql://parser_user:secure_password_change_me@localhost:5432/telegram_parser')
    
    async def connect(self):
        """Создание пула соединений"""
        if not self.pool:
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=5,
                max_size=20,
                command_timeout=60
            )
            print("✅ Database pool created")
    
    async def disconnect(self):
        """Закрытие пула соединений"""
        if self.pool:
            await self.pool.close()
            print("❌ Database pool closed")
    
    @asynccontextmanager
    async def acquire(self):
        """Контекстный менеджер для получения соединения"""
        async with self.pool.acquire() as connection:
            yield connection
    
    async def fetch(self, query: str, *args) -> List[Dict[str, Any]]:
        """Выполнение SELECT запроса"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(row) for row in rows]
    
    async def fetchrow(self, query: str, *args) -> Optional[Dict[str, Any]]:
        """Выполнение SELECT запроса с одной строкой"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None
    
    async def fetchval(self, query: str, *args) -> Any:
        """Выполнение SELECT запроса с одним значением"""
        async with self.pool.acquire() as conn:
            return await conn.fetchval(query, *args)
    
    async def execute(self, query: str, *args) -> str:
        """Выполнение INSERT/UPDATE/DELETE запроса"""
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)
    
    async def executemany(self, query: str, args: List[tuple]) -> None:
        """Выполнение множественных INSERT/UPDATE запросов"""
        async with self.pool.acquire() as conn:
            await conn.executemany(query, args)
    
    @asynccontextmanager
    async def transaction(self):
        """Контекстный менеджер для транзакций"""
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                yield conn

# Глобальный экземпляр базы данных
db = Database()

# Вспомогательные функции для построения SQL запросов
def build_insert_query(table: str, data: Dict[str, Any]) -> tuple:
    """Построение INSERT запроса"""
    columns = ', '.join(data.keys())
    placeholders = ', '.join(f'${i+1}' for i in range(len(data)))
    query = f"INSERT INTO {table} ({columns}) VALUES ({placeholders}) RETURNING id"
    values = tuple(data.values())
    return query, values

def build_update_query(table: str, data: Dict[str, Any], where: Dict[str, Any]) -> tuple:
    """Построение UPDATE запроса"""
    set_clause = ', '.join(f"{k} = ${i+1}" for i, k in enumerate(data.keys()))
    where_clause = ' AND '.join(f"{k} = ${i+len(data)+1}" for i, k in enumerate(where.keys()))
    query = f"UPDATE {table} SET {set_clause} WHERE {where_clause}"
    values = tuple(list(data.values()) + list(where.values()))
    return query, values

def build_select_query(table: str, columns: List[str] = None, where: Dict[str, Any] = None, 
                       order_by: str = None, limit: int = None) -> tuple:
    """Построение SELECT запроса"""
    cols = ', '.join(columns) if columns else '*'
    query = f"SELECT {cols} FROM {table}"
    values = []
    
    if where:
        where_clause = ' AND '.join(f"{k} = ${i+1}" for i, k in enumerate(where.keys()))
        query += f" WHERE {where_clause}"
        values = list(where.values())
    
    if order_by:
        query += f" ORDER BY {order_by}"
    
    if limit:
        query += f" LIMIT {limit}"
    
    return query, tuple(values)
