import pytest

from app.models.audit_log import AuditLog
from tests.test_user_access_sessions import _accounts
from tests.test_organization_api import _headers


def _events(db, user):
    return (
        db.query(AuditLog)
        .filter_by(action="user.updated", entity_type="user", entity_id=str(user.id))
        .all()
    )


def test_worker_profile_edit_persists_and_audits_without_revoking_session(client, db):
    _, worker = _accounts(db)
    headers = _headers(worker)
    before = (
        worker.company_id,
        worker.role_id,
        worker.is_active,
        worker.session_version,
    )
    response = client.patch(
        f"/api/v1/users/{worker.id}",
        headers=headers,
        json={"full_name": "QA profile revised"},
    )
    assert response.status_code == 200, response.text
    db.refresh(worker)
    assert worker.full_name == "QA profile revised"
    assert (
        worker.company_id,
        worker.role_id,
        worker.is_active,
        worker.session_version,
    ) == before
    read = client.get("/api/v1/users/me", headers=headers)
    assert read.status_code == 200
    assert read.json()["full_name"] == worker.full_name
    events = _events(db, worker)
    assert len(events) == 1
    event = events[0]
    assert event.actor_user_id == worker.id
    assert event.company_id == worker.company_id
    assert event.details == {"changed_fields": ["full_name"]}


@pytest.mark.parametrize(
    "administrative",
    [
        {"role_id": 1},
        {"company_id": None},
        {"is_active": False},
    ],
)
def test_profile_edit_with_administrative_fields_is_atomic_and_not_audited(
    client, db, administrative
):
    _, worker = _accounts(db)
    headers = _headers(worker)
    before = (
        worker.full_name,
        worker.company_id,
        worker.role_id,
        worker.is_active,
        worker.session_version,
    )
    response = client.patch(
        f"/api/v1/users/{worker.id}",
        headers=headers,
        json={"full_name": "Must not persist", **administrative},
    )
    assert response.status_code == 403, response.text
    db.refresh(worker)
    assert (
        worker.full_name,
        worker.company_id,
        worker.role_id,
        worker.is_active,
        worker.session_version,
    ) == before
    assert _events(db, worker) == []
    assert client.get("/api/v1/users/me", headers=headers).status_code == 200
