from datetime import datetime, timezone

from credentials import TEST_SECRET_B

from app.core.security import create_access_token, get_password_hash
from app.models.api_access_key import ApiAccessKey
from app.models.audit_log import AuditLog
from app.models.company import Company
from app.models.location import Location
from app.models.reservation import Reservation
from app.models.role import Role
from app.models.user import User
from app.models.work_order import WorkOrder
from app.services.api_access_key_service import hash_api_key


def _company(db, suffix: str, *, plan: str = "mega") -> Company:
    company = Company(
        name=f"API company {suffix}",
        tax_id=f"PUBLIC-API-{suffix}",
        address="API Street 1",
        phone="600000000",
        email=f"api-{suffix}@example.test",
        subscription_plan=plan,
        subscription_status="active",
    )
    db.add(company)
    db.flush()
    return company


def _user(db, *, company: Company, role_name: str, suffix: str) -> tuple[User, dict[str, str]]:
    role = db.query(Role).filter(Role.name == role_name).one()
    user = User(
        email=f"{role_name}-{suffix}@example.test",
        hashed_password=get_password_hash(TEST_SECRET_B),
        full_name=f"{role_name} {suffix}",
        role_id=role.id,
        company_id=company.id,
    )
    db.add(user)
    db.flush()
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return user, {"Authorization": f"Bearer {token}"}


def _work_order(db, *, company: Company, suffix: str) -> WorkOrder:
    location = Location(
        name=f"Location {suffix}",
        address="Work street 1",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add(location)
    db.flush()
    order = WorkOrder(
        company_id=company.id,
        location_id=location.id,
        created_by_user_id=None,
        title=f"Recurring work {suffix}",
        description="Private operational notes and contact details",
        status="active",
        order_type="recurring",
        scheduled_start_at=datetime(2026, 10, 1, tzinfo=timezone.utc),
        next_occurrence_at=datetime(2026, 10, 8, tzinfo=timezone.utc),
        recurrence_unit="weekly",
        recurrence_interval=1,
        estimated_people=2,
        estimated_minutes=120,
    )
    db.add(order)
    db.flush()
    return order


def test_public_api_key_is_company_scoped_minimized_audited_and_revocable(client, db):
    company = _company(db, "OWN")
    _, admin_headers = _user(db, company=company, role_name="admin", suffix="OWN")
    own_order = _work_order(db, company=company, suffix="OWN")
    other_company = _company(db, "OTHER")
    other_order = _work_order(db, company=other_company, suffix="OTHER")
    db.commit()

    created = client.post(
        "/api/v1/api-access-keys/",
        headers=admin_headers,
        json={"name": "Calendar mirror", "scopes": ["work_orders.read"]},
    )
    assert created.status_code == 201, created.text
    created_body = created.json()
    assert created_body["api_key"].startswith("whk_")
    assert created_body["key_prefix"] in created_body["api_key"]

    keys = client.get("/api/v1/api-access-keys/", headers=admin_headers)
    assert keys.status_code == 200, keys.text
    assert keys.json()[0]["id"] == created_body["id"]
    assert "api_key" not in keys.json()[0]

    public_headers = {"X-WorkHive-API-Key": created_body["api_key"]}
    response = client.get("/api/v1/public/work-orders", headers=public_headers)
    assert response.status_code == 200, response.text
    assert [item["id"] for item in response.json()] == [own_order.id]
    assert response.json()[0]["location_id"] == own_order.location_id
    assert "description" not in response.json()[0]
    assert "company_id" not in response.json()[0]
    assert client.get(
        f"/api/v1/public/work-orders/{other_order.id}",
        headers=public_headers,
    ).status_code == 404

    db.expire_all()
    key = db.get(ApiAccessKey, created_body["id"])
    assert key is not None and key.last_used_at is not None
    usage_events = (
        db.query(AuditLog)
        .filter(AuditLog.action == "api_access_key.used")
        .order_by(AuditLog.id.asc())
        .all()
    )
    assert len(usage_events) == 2
    usage = usage_events[0]
    assert usage.company_id == company.id
    assert usage.details["api_key_prefix"] == created_body["key_prefix"]
    assert created_body["api_key"] not in str(usage.details)

    revoked = client.post(
        f"/api/v1/api-access-keys/{created_body['id']}/revoke",
        headers=admin_headers,
    )
    assert revoked.status_code == 200, revoked.text
    assert client.get("/api/v1/public/work-orders", headers=public_headers).status_code == 401


def test_public_api_fails_closed_for_missing_scope_plan_and_non_admin(client, db):
    company = _company(db, "SCOPE")
    _, admin_headers = _user(db, company=company, role_name="admin", suffix="SCOPE")
    _, viewer_headers = _user(db, company=company, role_name="viewer", suffix="SCOPE")
    key_secret = "whk_scope_test_secret"
    no_scope_key = ApiAccessKey(
        company_id=company.id,
        name="No scope",
        key_prefix="whk_scope_test",
        key_hash=hash_api_key(key_secret),
        scopes=[],
        status="active",
    )
    db.add(no_scope_key)
    db.commit()

    assert client.post(
        "/api/v1/api-access-keys/",
        headers=viewer_headers,
        json={"name": "Blocked", "scopes": ["work_orders.read"]},
    ).status_code == 403
    assert client.get(
        "/api/v1/public/work-orders",
        headers={"X-WorkHive-API-Key": key_secret},
    ).status_code == 403
    assert client.get("/api/v1/public/work-orders").status_code == 401

    company.subscription_plan = "top"
    db.commit()
    assert client.get("/api/v1/api-access-keys/", headers=admin_headers).status_code == 403


def test_public_reservation_upsert_is_idempotent_and_company_scoped(client, db):
    company = _company(db, "RESERVATIONS")
    _, admin_headers = _user(db, company=company, role_name="admin", suffix="RESERVATIONS")
    order = _work_order(db, company=company, suffix="RESERVATIONS")
    second_order = _work_order(db, company=company, suffix="RESERVATIONS-SECOND")
    other_company = _company(db, "RESERVATIONS-OTHER")
    other_order = _work_order(db, company=other_company, suffix="RESERVATIONS-OTHER")
    db.commit()

    created_key = client.post(
        "/api/v1/api-access-keys/",
        headers=admin_headers,
        json={"name": "PMS", "scopes": ["reservations.write"]},
    )
    assert created_key.status_code == 201, created_key.text
    headers = {"X-WorkHive-API-Key": created_key.json()["api_key"]}
    payload = {
        "location_id": order.location_id,
        "check_in_at": "2026-11-01T16:00:00Z",
        "check_out_at": "2026-11-04T11:00:00Z",
        "guest_count": 2,
        "cleaning_required": True,
    }
    first = client.put("/api/v1/public/reservations/pms/stay-42", headers=headers, json=payload)
    assert first.status_code == 200, first.text
    assert first.json()["source"] == "pms"
    assert first.json()["external_reference"] == "stay-42"

    retry = client.put(
        "/api/v1/public/reservations/pms/stay-42",
        headers=headers,
        json={**payload, "guest_count": 3},
    )
    assert retry.status_code == 200, retry.text
    assert retry.json()["id"] == first.json()["id"]
    assert retry.json()["guest_count"] == 3
    assert db.query(Reservation).filter(Reservation.owner_company_id == company.id).count() == 1

    moved = client.put(
        "/api/v1/public/reservations/pms/stay-42",
        headers=headers,
        json={**payload, "location_id": second_order.location_id},
    )
    assert moved.status_code == 409

    unknown_cancellation = client.put(
        "/api/v1/public/reservations/pms/cancelled-before-create",
        headers=headers,
        json={**payload, "status": "cancelled"},
    )
    assert unknown_cancellation.status_code == 404

    cross_tenant = client.put(
        "/api/v1/public/reservations/pms/other-company",
        headers=headers,
        json={**payload, "location_id": other_order.location_id},
    )
    assert cross_tenant.status_code == 404

    read_only_key = client.post(
        "/api/v1/api-access-keys/",
        headers=admin_headers,
        json={"name": "Read only", "scopes": ["work_orders.read"]},
    )
    assert read_only_key.status_code == 201, read_only_key.text
    denied = client.put(
        "/api/v1/public/reservations/pms/blocked",
        headers={"X-WorkHive-API-Key": read_only_key.json()["api_key"]},
        json=payload,
    )
    assert denied.status_code == 403
