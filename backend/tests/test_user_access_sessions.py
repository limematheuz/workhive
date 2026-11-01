from tests.test_organization_api import _bootstrap_admin, _company, _headers, _user


def _accounts(db):
    company = _company(db, "account-sessions")
    owner = _bootstrap_admin(db, company, "account-session-owner")
    worker = _user(db, company, "account-session-worker", 3)
    worker.email = "account-session-worker@example.com"
    db.commit()
    return owner, worker


def test_deactivation_and_reactivation_never_revive_an_old_session(client, db):
    owner, worker = _accounts(db)
    old_headers = _headers(worker)
    assert client.get("/api/v1/users/me", headers=old_headers).status_code == 200
    for active in [False, True]:
        updated = client.patch(
            f"/api/v1/users/{worker.id}",
            headers=_headers(owner),
            json={"is_active": active},
        )
        assert updated.status_code == 200, updated.text
    assert client.get("/api/v1/users/me", headers=old_headers).status_code == 401
    db.refresh(worker)
    assert client.get("/api/v1/users/me", headers=_headers(worker)).status_code == 200


def test_role_change_invalidates_existing_sessions(client, db):
    owner, worker = _accounts(db)
    old_headers = _headers(worker)
    changed = client.patch(
        f"/api/v1/users/{worker.id}", headers=_headers(owner), json={"role_id": 2}
    )
    assert changed.status_code == 200, changed.text
    assert client.get("/api/v1/users/me", headers=old_headers).status_code == 401
    db.refresh(worker)
    assert client.get("/api/v1/users/me", headers=_headers(worker)).status_code == 200


def test_no_op_administrative_update_preserves_current_sessions(client, db):
    owner, worker = _accounts(db)
    old_headers = _headers(worker)
    changed = client.patch(
        f"/api/v1/users/{worker.id}",
        headers=_headers(owner),
        json={"is_active": True, "role_id": 3},
    )
    assert changed.status_code == 200, changed.text
    assert client.get("/api/v1/users/me", headers=old_headers).status_code == 200


def test_denied_self_administration_does_not_revoke_session(client, db):
    _, worker = _accounts(db)
    headers = _headers(worker)
    before = worker.session_version
    denied = client.patch(
        f"/api/v1/users/{worker.id}", headers=headers, json={"is_active": False}
    )
    assert denied.status_code == 403, denied.text
    db.refresh(worker)
    assert worker.session_version == before
    assert client.get("/api/v1/users/me", headers=headers).status_code == 200
