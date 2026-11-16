from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event

from app.core.security import create_access_token
from app.models.company_collaboration import CompanyCollaboration
from app.models.location import Location
from app.models.reservation import Reservation
from app.models.role import Role
from app.models.task_item import TaskItem
from app.models.user import User
from app.services.organization_bootstrap_service import ensure_user_membership


def manager_actor(db, qa):
    user = User(
        email="reservation-manager@example.com",
        full_name="QA scoped manager",
        hashed_password="unused",
        company_id=qa.company.id,
        role_id=db.query(Role.id).filter_by(name="manager").scalar(),
        is_active=True,
    )
    db.add(user)
    db.flush()
    membership = ensure_user_membership(db, user)
    db.commit()
    return membership.id, {
        "Authorization": "Bearer "
        + create_access_token({"sub": user.email, "ver": user.session_version})
    }


def test_legacy_viewer_location_list_keeps_only_assigned_sites(client, api_workspace):
    qa = api_workspace
    second = client.post(
        "/api/v1/locations/",
        headers=qa.headers["admin"],
        json={"name": "Unassigned site", "address": "QA street", "city": "Madrid"},
    )
    assert second.status_code == 201, second.text
    response = client.get("/api/v1/locations/", headers=qa.headers["worker"])
    assert response.status_code == 200, response.text
    assert [row["id"] for row in response.json()] == [qa.location.id]
    assert response.json()[0]["can_manage_reservations"] is False
    assert (
        client.get(
            f"/api/v1/locations/{second.json()['id']}", headers=qa.headers["worker"]
        ).status_code
        == 403
    )


def test_reservation_management_scope_queries_do_not_grow_per_location(
    client, db, api_workspace
):
    qa = api_workspace
    membership_id, headers = manager_actor(db, qa)
    profile = client.post(
        "/api/v1/organization/permission-profiles",
        headers=qa.headers["admin"],
        json={
            "name": "QA batched planning",
            "permission_codes": ["locations.read", "work.manage"],
        },
    )
    assert profile.status_code == 201, profile.text
    assigned = client.put(
        f"/api/v1/organization/members/{membership_id}/profile-assignments",
        headers=qa.headers["admin"],
        json={
            "assignments": [
                {
                    "permission_profile_id": profile.json()["id"],
                    "scopes": [{"scope_type": "company", "scope_id": qa.company.id}],
                }
            ]
        },
    )
    assert assigned.status_code == 200, assigned.text

    def measure(expected_count):
        statements = []

        def record(_connection, _cursor, _statement, parameters, _context, _many):
            if "work.manage" in repr(parameters):
                statements.append(_statement)

        event.listen(db.bind, "before_cursor_execute", record)
        try:
            response = client.get("/api/v1/locations/", headers=headers)
        finally:
            event.remove(db.bind, "before_cursor_execute", record)
        assert response.status_code == 200 and len(response.json()) == expected_count, (
            response.text
        )
        assert all(row["can_manage_reservations"] is True for row in response.json())
        return len(statements)

    one_site = measure(1)
    assert one_site > 0
    db.add_all(
        Location(
            name=f"QA scale {index}",
            address="QA street",
            city="Madrid",
            owner_company_id=qa.company.id,
            managing_company_id=qa.company.id,
        )
        for index in range(20)
    )
    db.commit()
    assert measure(21) <= one_site


@pytest.mark.parametrize("operation", ["create", "update", "delete", "dispatch"])
def test_empty_manager_profiles_cannot_mutate_reservations(
    client, db, api_workspace, operation
):
    qa = api_workspace
    membership_id, headers = manager_actor(db, qa)
    replaced = client.put(
        f"/api/v1/organization/members/{membership_id}/profile-assignments",
        headers=qa.headers["admin"],
        json={"assignments": []},
    )
    assert replaced.status_code == 200, replaced.text
    db.add(
        CompanyCollaboration(
            initiator_company_id=qa.company.id,
            partner_company_id=qa.other.id,
            status="accepted",
        )
    )
    now = datetime.now(timezone.utc)
    stay = Reservation(
        location_id=qa.location.id,
        owner_company_id=qa.company.id,
        assigned_company_id=qa.other.id,
        check_in_at=now + timedelta(days=1),
        check_out_at=now + timedelta(days=2),
        cleaning_required=True,
        status="confirmed",
    )
    db.add(stay)
    db.commit()
    before = db.query(TaskItem).count()
    path = f"/api/v1/reservations/{stay.id}"
    if operation == "create":
        response = client.post(
            "/api/v1/reservations/",
            headers=headers,
            json={
                "location_id": qa.location.id,
                "check_in_at": (now + timedelta(days=3)).isoformat(),
                "check_out_at": (now + timedelta(days=4)).isoformat(),
                "cleaning_required": False,
            },
        )
    elif operation == "update":
        response = client.patch(
            path, headers=headers, json={"notes": "Unauthorized change"}
        )
    elif operation == "delete":
        response = client.delete(path, headers=headers)
    else:
        response = client.post(path + "/dispatch-cleaning", headers=headers)
    assert response.status_code == 403, response.text
    db.refresh(stay)
    assert (
        stay.status == "confirmed"
        and stay.notes is None
        and stay.service_request_sent_at is None
    )
    assert db.query(Reservation).count() == 1 and db.query(TaskItem).count() == before


def test_manager_reservation_permission_respects_location_scope_and_revocation(
    client, db, api_workspace
):
    qa = api_workspace
    membership_id, headers = manager_actor(db, qa)
    admin = qa.headers["admin"]
    second = client.post(
        "/api/v1/locations/",
        headers=admin,
        json={
            "name": "Outside manager scope",
            "address": "QA street",
            "city": "Madrid",
        },
    )
    assert second.status_code == 201, second.text
    profiles = []
    for name, codes, scope_type, scope_id in [
        ("QA read sites", ["locations.read"], "company", qa.company.id),
        ("QA plan one site", ["work.manage"], "location", qa.location.id),
    ]:
        profile = client.post(
            "/api/v1/organization/permission-profiles",
            headers=admin,
            json={"name": name, "permission_codes": codes},
        )
        assert profile.status_code == 201, profile.text
        profiles.append(
            {
                "permission_profile_id": profile.json()["id"],
                "scopes": [{"scope_type": scope_type, "scope_id": scope_id}],
            }
        )
    assignments = f"/api/v1/organization/members/{membership_id}/profile-assignments"
    assert (
        client.put(
            assignments, headers=admin, json={"assignments": profiles}
        ).status_code
        == 200
    )
    now = datetime.now(timezone.utc)
    payload = {
        "location_id": qa.location.id,
        "check_in_at": (now + timedelta(days=3)).isoformat(),
        "check_out_at": (now + timedelta(days=4)).isoformat(),
        "cleaning_required": False,
    }
    allowed = client.post("/api/v1/reservations/", headers=headers, json=payload)
    assert allowed.status_code == 201, allowed.text
    denied = client.post(
        "/api/v1/reservations/",
        headers=headers,
        json={**payload, "location_id": second.json()["id"]},
    )
    assert denied.status_code == 403, denied.text
    locations = client.get("/api/v1/locations/", headers=headers)
    assert locations.status_code == 200, locations.text
    flags = {row["id"]: row["can_manage_reservations"] for row in locations.json()}
    assert flags == {qa.location.id: True, second.json()["id"]: False}
    assert {row["id"]: row["can_manage_tasks"] for row in locations.json()} == flags
    assert (
        client.put(
            assignments, headers=admin, json={"assignments": profiles[:1]}
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/api/v1/reservations/{allowed.json()['id']}",
            headers=headers,
            json={"notes": "Revoked"},
        ).status_code
        == 403
    )
    assert all(
        row["can_manage_reservations"] is False
        for row in client.get("/api/v1/locations/", headers=headers).json()
    )
