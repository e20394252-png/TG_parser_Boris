"""
Автоматическое создание начальных пользователей при старте.
Пользователи создаются только если их нет в БД.
"""
import os
import logging

from database.database import db

logger = logging.getLogger(__name__)


async def seed_users():
    """
    Сидирует пользователей из env-переменной SEED_USERS.
    Формат: username:password:role,username:password:role,...
    Пример: admin:admin:admin,user1:user1:user,user2:user2:user

    Если SEED_USERS не задан — используем дефолтный список.
    """
    import bcrypt as _bcrypt

    raw = os.getenv("SEED_USERS", "admin:admin:admin,user1:user1:user,user2:user2:user")

    entries = []
    for entry in raw.split(","):
        parts = entry.strip().split(":")
        if len(parts) >= 2:
            username = parts[0].strip()
            password = parts[1].strip()
            role     = parts[2].strip() if len(parts) >= 3 else "user"
            entries.append((username, password, role))

    if not entries:
        return

    for username, password, role in entries:
        try:
            existing = await db.fetchrow(
                "SELECT id FROM users WHERE username = $1", username
            )
            if existing:
                logger.info(f"[seed] User '{username}' already exists — skip")
                continue

            hashed = _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")
            await db.execute(
                "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
                username, hashed
            )
            logger.info(f"[seed] ✅ Created user '{username}' (role={role})")

        except Exception as e:
            logger.error(f"[seed] ❌ Failed to create user '{username}': {e}")
