import asyncio
from urllib.parse import quote_plus

import boto3
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel

from app.config import settings
from app.infrastructure.models import UserTable, SessionTable


async def clean_database():
    if settings.db_use_iam_auth:
        client = boto3.client("rds", region_name=settings.db_region)
        token = client.generate_db_auth_token(
            DBHostname=settings.db_host,
            Port=settings.db_port,
            DBUsername=settings.db_user,
            Region=settings.db_region,
        )
        encoded_token = quote_plus(token)
        dsn = f"postgresql+asyncpg://{settings.db_user}:{encoded_token}@{settings.db_host}:{settings.db_port}/{settings.db_name}"
    else:
        dsn = f"postgresql+asyncpg://{settings.db_user}@{settings.db_host}:{settings.db_port}/{settings.db_name}"

    engine = create_async_engine(
        dsn,
        echo=True,
        connect_args={"ssl": "require"} if settings.db_use_iam_auth else {},
    )

    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS sessions CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
        print("Dropped all tables")

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        print("Recreated all tables")

    await engine.dispose()
    print("Database cleaned successfully!")


if __name__ == "__main__":
    asyncio.run(clean_database())
