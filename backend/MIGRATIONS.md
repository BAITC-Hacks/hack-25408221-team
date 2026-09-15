# Database Migrations Guide

## Overview

This project uses **Alembic** for database migrations with PostgreSQL. Tables are also auto-created on startup via `SQLModel.metadata.create_all()`, but for production you should use migrations.

## Prerequisites

```bash
# Install dependencies
.venv/bin/pip install -r requirements.txt

# psycopg2 is needed for alembic (sync, migrations only)
.venv/bin/pip install psycopg2-binary
```

## Setup

### 1. Configure `.env`

Make sure your `.env` has these values:

```env
DB_HOST=database-1.cluster-cehoeeceo4yq.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=postgres
DB_NAME=postgres
DB_USE_IAM_AUTH=true
AWS_REGION=us-east-1
AWS_S3_BUCKET=invision-046573763502-eu-west-1-an
GEMINI_API_KEY=your-key
```

### 2. Update `alembic.ini`

The `alembic.ini` needs a sync database URL for migrations. Add this to the bottom:

```ini
# Use sync psycopg2 for migrations (asyncpg doesn't work with alembic offline mode)
sqlalchemy.url = postgresql://postgres@database-1.cluster-cehoeeceo4yq.us-east-1.rds.amazonaws.com:5432/postgres
```

**For IAM auth**, you'll need to generate a token and use a script (see Advanced section below).

## Common Commands

### Generate initial migration

```bash
.venv/bin/alembic revision --autogenerate -m "initial_tables"
```

This compares your models (`UserTable`, `SessionTable`) with the database and generates a migration file.

### Apply migrations

```bash
.venv/bin/alembic upgrade head
```

### Check current migration state

```bash
.venv/bin/alembic current
```

### Check pending migrations

```bash
.venv/bin/alembic heads
```

### Rollback one migration

```bash
.venv/bin/alembic downgrade -1
```

### Rollback all migrations

```bash
.venv/bin/alembic downgrade base
```

## Quick Start (First Time)

```bash
# 1. Install psycopg2 for alembic
.venv/bin/pip install psycopg2-binary

# 2. Generate migration
.venv/bin/alembic revision --autogenerate -m "initial_tables"

# 3. Apply migration
.venv/bin/alembic upgrade head

# 4. Verify tables
.venv/bin/python -c "
import asyncio, asyncpg, boto3
from app.config import settings

client = boto3.client('rds', region_name=settings.aws_region)
token = client.generate_db_auth_token(
    DBHostname=settings.db_host, Port=settings.db_port,
    DBUsername=settings.db_user, Region=settings.aws_region,
)

async def check():
    conn = await asyncpg.connect(
        host=settings.db_host, port=settings.db_port,
        user=settings.db_user, database=settings.db_name,
        password=token, ssl='require',
    )
    tables = await conn.fetch(\"SELECT tablename FROM pg_tables WHERE schemaname='public'\")
    await conn.close()
    for t in tables:
        print(f'  - {t[0]}')

asyncio.run(check())
"
```

## When to Run Migrations

| Scenario | Command |
|----------|---------|
| First deployment | `alembic upgrade head` |
| Added new model field | `alembic revision --autogenerate -m "description"` then `alembic upgrade head` |
| Rollback bad migration | `alembic downgrade -1` |
| Check status | `alembic current` |

## Advanced: IAM Auth with Alembic

Since Alembic uses sync connections and IAM tokens expire every 15 minutes, create a custom `env.py` that generates tokens:

```python
# alembic/env.py
import boto3
from app.config import settings

def get_rds_url():
    if settings.db_use_iam_auth:
        client = boto3.client("rds", region_name=settings.aws_region)
        token = client.generate_db_auth_token(
            DBHostname=settings.db_host,
            Port=settings.db_port,
            DBUsername=settings.db_user,
            Region=settings.aws_region,
        )
        return f"postgresql://{settings.db_user}:{token}@{settings.db_host}:{settings.db_port}/{settings.db_name}?sslmode=require"
    return f"postgresql://{settings.db_user}@{settings.db_host}:{settings.db_port}/{settings.db_name}"

# In run_migrations_online():
config.set_main_option("sqlalchemy.url", get_rds_url())
```

## Production Deployment

```bash
# In your CI/CD or deployment script:
.venv/bin/pip install -r requirements.txt
.venv/bin/pip install psycopg2-binary
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Disabling Auto-Creation on Startup

For production, disable `SQLModel.metadata.create_all()` in `app/infrastructure/database.py`:

```python
async def init_db():
    # Remove or comment out this line in production:
    # async with _engine.begin() as conn:
    #     await conn.run_sync(SQLModel.metadata.create_all)
    logger.info("Database initialized (migrations managed by alembic)")
```
