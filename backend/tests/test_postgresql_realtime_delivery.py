import asyncio
import json
import os
from uuid import uuid4

import pytest
from psycopg import AsyncConnection
from sqlalchemy.engine import make_url

from app.services.realtime_event_service import POSTGRES_CHANNEL, RealtimeEventHub


@pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL integration database is not configured",
)
@pytest.mark.asyncio
async def test_postgresql_signals_reach_only_scoped_streams_and_listener_can_restart():
    url = os.environ["MIGRATION_TEST_DATABASE_URL"]
    dsn = (
        make_url(url).set(drivername="postgresql").render_as_string(hide_password=False)
    )
    hub = RealtimeEventHub(url)
    # Synthetic IDs target only the streams in this test, never real users.
    company_id = 1_000_000_000 + int(uuid4().hex[:6], 16)
    user_id = company_id + 1
    streams = []

    async def connected():
        async with asyncio.timeout(5):
            while not hub._listener_connected:
                await asyncio.sleep(0.02)

    async def next_invalidation(stream):
        async with asyncio.timeout(5):
            while True:
                message = await anext(stream)
                if "event: invalidate" in message:
                    return message

    async def publish(connection, *, companies=(), users=(), topics=()):
        await connection.execute(
            "SELECT pg_notify(%s, %s)",
            (
                POSTGRES_CHANNEL,
                json.dumps(
                    {
                        "company_ids": list(companies),
                        "user_ids": list(users),
                        "topics": list(topics),
                    }
                ),
            ),
        )

    try:
        await hub.start()
        await connected()
        for recipient, company in [
            (user_id, company_id),
            (user_id + 1, company_id),
            (user_id + 2, company_id + 10),
        ]:
            stream = hub.stream_for_user(user_id=recipient, company_id=company)
            assert '"realtime":true' in await anext(stream)
            streams.append(stream)
        async with await AsyncConnection.connect(dsn, autocommit=True) as connection:
            await publish(connection, companies=[company_id], topics=["clients"])
            for stream in streams[:2]:
                assert '"topics":["clients"]' in await next_invalidation(stream)
            foreign = next(
                subscriber
                for subscriber in hub._subscribers.values()
                if subscriber.company_id != company_id
            )
            assert foreign.pending_topics == set()
            await publish(connection, users=[user_id], topics=["notifications"])
            message = await next_invalidation(streams[0])
            assert '"topics":["notifications"]' in message
            assert "company_ids" not in message and "user_ids" not in message
            assert all(
                not subscriber.pending_topics
                for subscriber in hub._subscribers.values()
            )
            for stream in streams:
                await stream.aclose()
            streams.clear()
            await hub.stop()
            assert not hub._subscribers
            await hub.start()
            await connected()
            stream = hub.stream_for_user(user_id=user_id, company_id=company_id)
            streams.append(stream)
            assert '"realtime":true' in await anext(stream)
            await publish(connection, companies=[company_id], topics=["clients"])
            assert '"topics":["clients"]' in await next_invalidation(stream)
    finally:
        for stream in streams:
            await stream.aclose()
        await hub.stop()
