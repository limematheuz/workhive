import os

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, StaticPool

from app.core.database_url import to_async_database_url
from app.db.async_session import async_session_scope


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("sqlite:///./workhive.db", "sqlite+aiosqlite:///./workhive.db"),
        ("sqlite+aiosqlite:///./workhive.db", "sqlite+aiosqlite:///./workhive.db"),
        (
            "postgresql://user:password@db:5432/workhive",
            "postgresql+psycopg://user:password@db:5432/workhive",
        ),
        (
            "postgresql+psycopg2://user:password@db:5432/workhive",
            "postgresql+psycopg://user:password@db:5432/workhive",
        ),
        (
            "postgresql+psycopg://user:password@db:5432/workhive",
            "postgresql+psycopg://user:password@db:5432/workhive",
        ),
    ],
)
def test_async_database_url_uses_non_blocking_drivers(source, expected):
    assert to_async_database_url(source) == expected


def test_async_database_url_rejects_unsupported_schemes_without_leaking_credentials():
    source = "mysql://admin:super-secret@db/workhive"

    with pytest.raises(ValueError, match="Unsupported database scheme") as error:
        to_async_database_url(source)

    assert "super-secret" not in str(error.value)


@pytest.mark.asyncio
async def test_async_session_scope_rolls_back_failed_transactions():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
    )
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with engine.begin() as connection:
            await connection.execute(text("CREATE TABLE events (id INTEGER PRIMARY KEY)"))

        with pytest.raises(RuntimeError, match="stop transaction"):
            async with async_session_scope(factory) as session:
                await session.execute(text("INSERT INTO events (id) VALUES (1)"))
                raise RuntimeError("stop transaction")

        async with factory() as session:
            count = await session.scalar(text("SELECT COUNT(*) FROM events"))
        assert count == 0
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_async_session_scope_keeps_explicit_commits():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
    )
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with engine.begin() as connection:
            await connection.execute(text("CREATE TABLE events (id INTEGER PRIMARY KEY)"))

        async with async_session_scope(factory) as session:
            await session.execute(text("INSERT INTO events (id) VALUES (1)"))
            await session.commit()

        async with factory() as session:
            count = await session.scalar(text("SELECT COUNT(*) FROM events"))
        assert count == 1
    finally:
        await engine.dispose()


@pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL async driver contract runs in CI",
)
@pytest.mark.asyncio
async def test_psycopg_async_driver_connects_to_postgresql():
    engine = create_async_engine(
        to_async_database_url(os.environ["MIGRATION_TEST_DATABASE_URL"]),
        poolclass=NullPool,
    )
    try:
        async with engine.connect() as connection:
            assert await connection.scalar(text("SELECT 1")) == 1
    finally:
        await engine.dispose()
