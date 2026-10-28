import os
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.database_url import to_sync_database_url
from app.models.company import Company
from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User
from app.services.notification_service import notify_users_once


@pytest.fixture(params=["sqlite", "postgresql"])
def delivery_db(request, db):
    if request.param == "sqlite":
        yield db
        return
    url = os.getenv("MIGRATION_TEST_DATABASE_URL")
    if not url:
        pytest.skip("PostgreSQL integration database is not configured")
    engine = create_engine(to_sync_database_url(url))
    with Session(engine) as session:
        try:
            yield session
        finally:
            session.rollback()
    engine.dispose()


def test_notification_delivery_count_is_exact_and_retries_are_idempotent(delivery_db):
    db = delivery_db
    suffix = uuid4().hex[:12]
    role = db.scalar(select(Role).where(Role.name == "viewer"))
    assert role is not None
    company = Company(
        name=f"QA delivery {suffix}",
        tax_id=f"QA-N-{suffix}",
        address="QA",
        phone="600000000",
        email=f"{suffix}@example.test",
    )
    db.add(company)
    db.flush()
    recipients = [
        User(
            company_id=company.id,
            role_id=role.id,
            full_name="QA notification delivery",
            email=f"{suffix}-{index}@example.test",
            hashed_password="unused",
            is_active=index < 2,
        )
        for index in range(3)
    ]
    db.add_all(recipients)
    db.flush()
    payload = dict(
        users=[*recipients, recipients[0]],
        event_type="qa.delivery",
        title="QA delivery",
        message="Rollback-only integration test",
        entity_type="qa_review",
        entity_id=company.id,
        href="/dashboard",
        commit=False,
    )
    assert notify_users_once(db, **payload, dedupe_key="first") == 2
    assert notify_users_once(db, **payload, dedupe_key="first") == 0
    assert notify_users_once(db, **payload, dedupe_key="second") == 2
    rows = db.scalars(
        select(Notification).where(Notification.company_id == company.id)
    ).all()
    assert len(rows) == 4
    assert {row.user_id for row in rows} == {
        recipient.id for recipient in recipients[:2]
    }
    assert {row.metadata_json["dedupe_key"] for row in rows} == {"first", "second"}
    assert all(row.read_at is None for row in rows)
