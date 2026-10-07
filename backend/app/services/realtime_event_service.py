"""Tenant-scoped, low-payload real-time invalidation over PostgreSQL and SSE."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from psycopg import AsyncConnection
from sqlalchemy.engine import make_url

from app.core.config import settings


logger = logging.getLogger(__name__)

POSTGRES_CHANNEL = "workhive_realtime"
KEEPALIVE_SECONDS = 20
MAX_RECONNECT_DELAY_SECONDS = 30

REALTIME_TOPICS = frozenset(
    {
        "calendar",
        "clients",
        "collaborations",
        "dashboard",
        "live-work",
        "locations",
        "notifications",
        "privacy",
        "reservations",
        "sidebar",
        "tasks",
    }
)


@dataclass(frozen=True)
class RealtimeInvalidation:
    """An intentionally data-free signal to refresh one authorized view."""

    company_ids: frozenset[int]
    user_ids: frozenset[int]
    topics: frozenset[str]


@dataclass
class _Subscriber:
    user_id: int
    company_id: int | None
    pending_topics: set[str] = field(default_factory=set)
    pending_connection_state: bool | None = None
    changed: asyncio.Event = field(default_factory=asyncio.Event)


def _positive_ids(values: object) -> frozenset[int]:
    if not isinstance(values, list):
        return frozenset()
    return frozenset(
        value
        for value in values
        if isinstance(value, int) and not isinstance(value, bool) and value > 0
    )


def parse_invalidation(payload: str) -> RealtimeInvalidation | None:
    """Reject malformed broker messages before they can reach a browser stream."""

    try:
        parsed = json.loads(payload)
    except (TypeError, json.JSONDecodeError):
        return None
    if not isinstance(parsed, dict):
        return None

    raw_topics = parsed.get("topics")
    if not isinstance(raw_topics, list):
        return None
    topics = frozenset(
        topic for topic in raw_topics if isinstance(topic, str) and topic in REALTIME_TOPICS
    )
    company_ids = _positive_ids(parsed.get("company_ids"))
    user_ids = _positive_ids(parsed.get("user_ids"))
    if not topics or (not company_ids and not user_ids):
        return None
    return RealtimeInvalidation(
        company_ids=company_ids,
        user_ids=user_ids,
        topics=topics,
    )


def _postgres_dsn(database_url: str) -> str | None:
    parsed = make_url(database_url)
    if parsed.get_backend_name() != "postgresql":
        return None
    return parsed.set(drivername="postgresql").render_as_string(hide_password=False)


def _encode_sse(event_name: str, data: dict[str, object]) -> str:
    return f"event: {event_name}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


class RealtimeEventHub:
    """One PostgreSQL listener per API worker, fan-out scoped to local SSE clients."""

    def __init__(self, database_url: str) -> None:
        self._dsn = _postgres_dsn(database_url)
        self._subscribers: dict[int, _Subscriber] = {}
        self._next_subscriber_id = 0
        self._listener_task: asyncio.Task[None] | None = None
        self._stopped = asyncio.Event()
        self._listener_connected = False

    @property
    def uses_postgres(self) -> bool:
        return self._dsn is not None

    async def start(self) -> None:
        if not self._dsn or self._listener_task is not None:
            return
        self._stopped.clear()
        self._listener_task = asyncio.create_task(
            self._listen(), name="workhive-realtime-listener"
        )

    async def stop(self) -> None:
        self._stopped.set()
        self._set_listener_connected(False)
        task = self._listener_task
        self._listener_task = None
        if task is None:
            return
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    def publish(self, invalidation: RealtimeInvalidation) -> None:
        """Coalesce events per browser instead of building an unbounded queue."""

        for subscriber in self._subscribers.values():
            is_recipient = subscriber.user_id in invalidation.user_ids or (
                subscriber.company_id is not None
                and subscriber.company_id in invalidation.company_ids
            )
            if not is_recipient:
                continue
            subscriber.pending_topics.update(invalidation.topics)
            subscriber.changed.set()

    def _set_listener_connected(self, connected: bool) -> None:
        if self._listener_connected == connected:
            return
        self._listener_connected = connected
        for subscriber in self._subscribers.values():
            subscriber.pending_connection_state = connected
            subscriber.changed.set()

    async def stream_for_user(
        self,
        *,
        user_id: int,
        company_id: int | None,
    ) -> AsyncIterator[str]:
        self._next_subscriber_id += 1
        subscriber_id = self._next_subscriber_id
        subscriber = _Subscriber(user_id=user_id, company_id=company_id)
        self._subscribers[subscriber_id] = subscriber
        try:
            yield _encode_sse(
                "ready",
                {"transport": "sse", "realtime": self._listener_connected},
            )
            while True:
                try:
                    await asyncio.wait_for(subscriber.changed.wait(), KEEPALIVE_SECONDS)
                except TimeoutError:
                    yield ": keepalive\n\n"
                    continue

                topics = sorted(subscriber.pending_topics)
                subscriber.pending_topics.clear()
                connection_state = subscriber.pending_connection_state
                subscriber.pending_connection_state = None
                subscriber.changed.clear()
                if connection_state is not None:
                    yield _encode_sse("connection", {"realtime": connection_state})
                if topics:
                    yield _encode_sse("invalidate", {"topics": topics})
        finally:
            self._subscribers.pop(subscriber_id, None)

    async def _listen(self) -> None:
        assert self._dsn is not None
        retry_delay = 1
        while not self._stopped.is_set():
            try:
                async with await AsyncConnection.connect(self._dsn, autocommit=True) as connection:
                    await connection.execute(f"LISTEN {POSTGRES_CHANNEL}")
                    self._set_listener_connected(True)
                    retry_delay = 1
                    async for notification in connection.notifies():
                        invalidation = parse_invalidation(notification.payload)
                        if invalidation is not None:
                            self.publish(invalidation)
                        if self._stopped.is_set():
                            return
            except asyncio.CancelledError:
                raise
            except Exception:
                self._set_listener_connected(False)
                logger.warning("Real-time event listener disconnected; retrying", exc_info=True)

            try:
                await asyncio.wait_for(self._stopped.wait(), timeout=retry_delay)
            except TimeoutError:
                retry_delay = min(retry_delay * 2, MAX_RECONNECT_DELAY_SECONDS)


realtime_event_hub = RealtimeEventHub(settings.DATABASE_URL)


async def start_realtime_events() -> None:
    await realtime_event_hub.start()


async def stop_realtime_events() -> None:
    await realtime_event_hub.stop()


def stream_for_authenticated_user(
    *, user_id: int, company_id: int | None
) -> AsyncIterator[str]:
    return realtime_event_hub.stream_for_user(user_id=user_id, company_id=company_id)
