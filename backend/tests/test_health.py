import uuid


def test_health_and_readiness_include_request_id(client):
    health = client.get("/health", headers={"X-Request-ID": "health-check-1"})
    assert health.status_code == 200
    assert health.headers["X-Request-ID"] == "health-check-1"
    assert health.json()["status"] == "ok"

    readiness = client.get("/health/ready")
    assert readiness.status_code == 200
    assert readiness.json() == {
        "status": "ok",
        "checks": {
                "database": {"status": "ok"},
                "invoice_storage": {"status": "ok"},
                "media_storage": {"status": "ok"},
            },
        }
    uuid.UUID(readiness.headers["X-Request-ID"])


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
