from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings


engine_options: dict[str, object] = {"pool_pre_ping": True}
if settings.use_null_pool:
    engine_options["poolclass"] = NullPool
else:
    engine_options.update(
        {
            "pool_size": settings.DATABASE_POOL_SIZE,
            "max_overflow": settings.DATABASE_MAX_OVERFLOW,
            "pool_recycle": settings.DATABASE_POOL_RECYCLE_SECONDS,
        }
    )

async_engine = create_async_engine(
    settings.async_database_url,
    **engine_options,
)
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    autoflush=False,
    expire_on_commit=False,
)


@asynccontextmanager
async def async_session_scope(
    factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
) -> AsyncIterator[AsyncSession]:
    async with factory() as session:
        try:
            yield session
        except BaseException:
            await session.rollback()
            raise
