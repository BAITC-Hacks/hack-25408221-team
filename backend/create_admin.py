
import asyncio
import uuid
from datetime import datetime

import asyncpg
import boto3

from app.config import settings
from app.core.security import hash_password


def get_rds_token() -> str:
    client = boto3.client("rds", region_name=settings.db_region)
    return client.generate_db_auth_token(
        DBHostname=settings.db_host,
        Port=settings.db_port,
        DBUsername=settings.db_user,
        Region=settings.db_region,
    )


async def create_admin(name: str, email: str, password: str):
    token = get_rds_token()
    conn = await asyncpg.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        database=settings.db_name,
        password=token,
        ssl="require",
    )

    existing = await conn.fetchrow(
        "SELECT id FROM users WHERE email = $1", email.lower()
    )
    if existing:
        print(f"Error: Email {email} already exists")
        await conn.close()
        return

    user_id = str(uuid.uuid4())
    await conn.execute(
        """
        INSERT INTO users (id, name, email, password, role, created_at)
        VALUES ($1, $2, $3, $4, 'admin', $5)
        """,
        user_id,
        name,
        email.lower(),
        hash_password(password),
        datetime.utcnow(),
    )

    await conn.close()
    print(f"Admin account created successfully!")
    print(f"  User ID: {user_id}")
    print(f"  Name: {name}")
    print(f"  Email: {email}")
    print(f"  Role: admin")


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 4:
        print("Usage: python create_admin.py <name> <email> <password>")
        print("Example: python create_admin.py Admin admin@invision.com admin123")
        sys.exit(1)

    name, email, password = sys.argv[1], sys.argv[2], sys.argv[3]
    asyncio.run(create_admin(name, email, password))
