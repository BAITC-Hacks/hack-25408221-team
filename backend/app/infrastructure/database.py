import logging

import boto3
from botocore.config import Config
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlmodel import SQLModel

from app.config import settings

logger = logging.getLogger(__name__)

_engine = None


def _generate_rds_iam_token() -> str:
    client = boto3.client(
        "rds",
        region_name=settings.db_region,
        config=Config(retries={"max_attempts": 3, "mode": "standard"}),
    )
    return client.generate_db_auth_token(
        DBHostname=settings.db_host,
        Port=settings.db_port,
        DBUsername=settings.db_user,
        Region=settings.db_region,
    )


async def init_db():
    global _engine

    dsn = f"postgresql+asyncpg://{settings.db_user}@{settings.db_host}:{settings.db_port}/{settings.db_name}"
    connect_args = {"ssl": "require"} if settings.db_use_iam_auth else {}

    _engine = create_async_engine(
        dsn,
        echo=False,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True,
        connect_args=connect_args,
    )

    if settings.db_use_iam_auth:
        @event.listens_for(_engine.sync_engine, "do_connect")
        def provide_token(dialect, conn_rec, cargs, cparams):
            cparams["password"] = _generate_rds_iam_token()

    async with _engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    logger.info("Database initialized")


async def get_session():
    if not _engine:
        await init_db()
    async with AsyncSession(_engine) as session:
        yield session
