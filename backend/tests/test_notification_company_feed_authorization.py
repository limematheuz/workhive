from datetime import datetime, timedelta, timezone

import pytest

from app.models.data_subject_request import DataSubjectRequest
from app.models.reservation import Reservation
from test_task_security_delivery import _company, _headers, _location, _user


@pytest.mark.parametrize(
    "route",
    ["privacy/requests", "reservations/", "reservations/upcoming/arrivals?days=3"],
)
@pytest.mark.parametrize("actor", ["admin", "manager", "worker", "foreign_admin"])
def test_feed_context_header_never_grants_role_or_company_access(
    client, db, route, actor
):
    company = _company(db, "NotificationCompany")
    foreign_company = _company(db, "ForeignNotificationCompany")
    users = {
        "admin": _user(db, company, "admin@notification-company.test", 1),
        "manager": _user(db, company, "manager@notification-company.test", 2),
        "worker": _user(db, company, "worker@notification-company.test", 3),
        "foreign_admin": _user(
            db, foreign_company, "admin@foreign-notification.test", 1
        ),
    }
    records = {}
    now = datetime.now(timezone.utc)
    for key, tenant in [("own", company), ("foreign", foreign_company)]:
        location = _location(db, tenant)
        privacy = DataSubjectRequest(
            company_id=tenant.id,
            requested_by_user_id=users["admin" if key == "own" else "foreign_admin"].id,
            request_type="erasure",
            status="pending",
        )
        reservation = Reservation(
            owner_company_id=tenant.id,
            location_id=location.id,
            check_in_at=now + timedelta(hours=1),
            check_out_at=now + timedelta(days=1),
            guest_count=2,
            status="confirmed",
            source="manual",
            cleaning_required=True,
        )
        db.add_all([privacy, reservation])
        db.flush()
        records[key] = privacy.id if route.startswith("privacy") else reservation.id
    db.commit()
    claimed = users["admin"] if actor == "foreign_admin" else users["foreign_admin"]
    headers = {
        **_headers(users[actor]),
        "X-Notification-Context": f"notification-company:{claimed.id}:{claimed.company_id}:admin:9",
    }
    response = client.get(f"/api/v1/{route}", headers=headers)
    if actor == "worker" or (actor == "manager" and route.startswith("privacy")):
        assert response.status_code == 403, response.text
    else:
        assert response.status_code == 200, response.text
        assert [item["id"] for item in response.json()] == [
            records["foreign" if actor == "foreign_admin" else "own"]
        ]
    assert db.query(DataSubjectRequest).filter_by(status="pending").count() == 2
    assert db.query(Reservation).filter_by(status="confirmed").count() == 2


@pytest.mark.parametrize(
    "route",
    ["privacy/requests", "reservations/", "reservations/upcoming/arrivals?days=3"],
)
def test_feed_context_without_session_is_denied(client, route):
    response = client.get(
        f"/api/v1/{route}",
        headers={"X-Notification-Context": "notification-company:1:1:admin:9"},
    )
    assert response.status_code == 401
