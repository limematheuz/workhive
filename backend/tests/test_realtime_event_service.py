import asyncio
import json

from app.core.security import create_access_token
from app.models.user import User
from app.services.realtime_event_service import (
    RealtimeEventHub,
    RealtimeInvalidation,
    parse_invalidation,
)


def test_parse_invalidation_accepts_only_scoped_known_topics():
    parsed = parse_invalidation(
        json.dumps(
            {
                "company_ids": [7, 7, 0, "8"],
                "user_ids": [12, True, -2],
                "topics": ["tasks", "not-a-topic", 1],
            }
        )
    )

    assert parsed == RealtimeInvalidation(
        company_ids=frozenset({7}),
        user_ids=frozenset({12}),
        topics=frozenset({"tasks"}),
    )


def test_parse_invalidation_rejects_an_unscoped_or_empty_signal():
    assert parse_invalidation('{"topics":["tasks"]}') is None
    assert parse_invalidation('{"company_ids":[1],"topics":["unknown"]}') is None
    assert parse_invalidation("not-json") is None


def test_event_hub_delivers_only_the_matching_company_topics():
    async def scenario() -> tuple[str, bool]:
        hub = RealtimeEventHub("sqlite://")
        matching_stream = hub.stream_for_user(user_id=10, company_id=7)
        other_stream = hub.stream_for_user(user_id=20, company_id=9)
        await anext(matching_stream)
        await anext(other_stream)

        hub.publish(
            RealtimeInvalidation(
                company_ids=frozenset({7}),
                user_ids=frozenset(),
                topics=frozenset({"notifications", "tasks"}),
            )
        )
        matching_message = await anext(matching_stream)
        other_has_pending_topics = any(
            subscriber.pending_topics
            for subscriber in hub._subscribers.values()  # noqa: SLF001 - scoped delivery contract
            if subscriber.user_id == 20
        )
        await matching_stream.aclose()
        await other_stream.aclose()
        return matching_message, other_has_pending_topics

    matching_message, other_has_pending_topics = asyncio.run(scenario())

    assert 'event: invalidate' in matching_message
    assert '"notifications","tasks"' in matching_message
    assert other_has_pending_topics is False


def test_event_hub_delivers_a_user_notification_without_company_membership():
    async def scenario() -> str:
        hub = RealtimeEventHub("sqlite://")
        stream = hub.stream_for_user(user_id=10, company_id=None)
        await anext(stream)
        hub.publish(
            RealtimeInvalidation(
                company_ids=frozenset(),
                user_ids=frozenset({10}),
                topics=frozenset({"notifications"}),
            )
        )
        message = await anext(stream)
        await stream.aclose()
        return message

    assert '"notifications"' in asyncio.run(scenario())


def test_event_hub_closes_streams_when_the_application_stops():
    async def scenario() -> bool:
        hub = RealtimeEventHub("sqlite://")
        stream = hub.stream_for_user(user_id=10, company_id=7)
        await anext(stream)
        await hub.stop()
        try:
            await anext(stream)
        except StopAsyncIteration:
            return True
        return False

    assert asyncio.run(scenario())


def test_realtime_stream_requires_authentication_and_keeps_its_payload_scoped(
    client, db, monkeypatch
):
    user = User(
        email="realtime-user@example.test",
        hashed_password="unused-in-token-test",
        full_name="Realtime User",
        role_id=1,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    requested_scope = {}

    async def finite_event_stream():
        yield 'event: ready\ndata: {"transport":"sse"}\n\n'

    def stream_for_authenticated_user(*, user_id: int, company_id: int | None):
        requested_scope.update(user_id=user_id, company_id=company_id)
        return finite_event_stream()

    monkeypatch.setattr(
        "app.api.v1.realtime.realtime_event_service.stream_for_authenticated_user",
        stream_for_authenticated_user,
    )

    assert client.get("/api/v1/realtime/events").status_code == 401

    token = create_access_token({"sub": user.email, "ver": user.session_version})
    response = client.get(
        "/api/v1/realtime/events",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.text == 'event: ready\ndata: {"transport":"sse"}\n\n'
    assert requested_scope == {"user_id": user.id, "company_id": None}
