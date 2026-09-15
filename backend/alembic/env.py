import sys
import os
import boto3
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from app.infrastructure.models import UserTable, SessionTable
from sqlmodel import SQLModel

target_metadata = SQLModel.metadata


def get_rds_url() -> str:
    from app.config import settings

    if settings.db_use_iam_auth:
        client = boto3.client("rds", region_name=settings.db_region)
        token = client.generate_db_auth_token(
            DBHostname=settings.db_host,
            Port=settings.db_port,
            DBUsername=settings.db_user,
            Region=settings.db_region,
        )
        return f"postgresql://{settings.db_user}:{token}@{settings.db_host}:{settings.db_port}/{settings.db_name}?sslmode=require"
    return f"postgresql://{settings.db_user}@{settings.db_host}:{settings.db_port}/{settings.db_name}"


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    from sqlalchemy import create_engine

    url = get_rds_url()

    connectable = create_engine(
        url,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
