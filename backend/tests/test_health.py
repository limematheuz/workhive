import uuid

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.services.health_service import required_schema_is_ready


def test_health_and_readiness_include_request_id(client):
    health = client.get("/health", headers={"X-Request-ID": "health-check-1"})
    assert health.status_code == 200
    assert health.headers["X-Request-ID"] == "health-check-1"
    assert health.json()["status"] == "ok"
    assert health.json()["build"] == {
        "version": "1.2.8",
        "revision": "unknown",
    }

    readiness = client.get("/health/ready")
    assert readiness.status_code == 200
    assert readiness.json() == {
        "status": "ok",
        "checks": {
                "database": {"status": "ok"},
                "schema": {"status": "ok"},
                "invoice_storage": {"status": "ok"},
                "media_storage": {"status": "ok"},
            },
        }
    uuid.UUID(readiness.headers["X-Request-ID"])


def test_readiness_detects_database_without_required_migrations():
    engine = create_engine("sqlite://")
    try:
        with Session(engine) as session:
            assert required_schema_is_ready(session) is False
    finally:
        engine.dispose()


def test_readiness_rejects_previous_company_schema_without_operating_model():
    engine = create_engine("sqlite://")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE companies (id INTEGER PRIMARY KEY)"))
            for table in (
                "task_assignments",
                "task_checklist_items",
                "task_checklist_assignments",
            ):
                connection.execute(
                    text(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY)")
                )

        with Session(engine) as session:
            assert required_schema_is_ready(session) is False
    finally:
        engine.dispose()


def test_unsafe_request_id_is_replaced(client):
    response = client.get("/health", headers={"X-Request-ID": "x" * 65})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] != "x" * 65
    uuid.UUID(response.headers["X-Request-ID"])


def test_csrf_rejection_is_traced(client):
    client.cookies.set("auth_token", "invalid-session")
    response = client.post(
        "/api/v1/auth/logout",
        headers={"X-Request-ID": "csrf-rejection"},
    )
    assert response.status_code == 403
    assert response.headers["X-Request-ID"] == "csrf-rejection"
