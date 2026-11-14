from app.models.location import Location
from app.models.task_item import TaskItem
from app.models.user import User
from test_client_permission_authorization import _assign_company_profile
from test_organization_api import _bootstrap_admin, _company, _headers, _user


def test_platform_superadmin_cannot_create_task_in_customer_company(client, db):
    company = _company(db, "superadmin-boundary")
    admin = _bootstrap_admin(db, company, "owner")
    location = Location(
        name="Tenant Location",
        address="Calle QA 10",
        city="Girona",
        postal_code="17001",
        managing_company_id=company.id,
        owner_company_id=company.id,
        is_active=True,
    )
    db.add(location)
    db.flush()

    superadmin = User(
        email="platform-superadmin-boundary@example.test",
        full_name="Platform Superadmin",
        hashed_password=admin.hashed_password,
        role_id=4,
        company_id=None,
        is_active=True,
    )
    db.add(superadmin)
    db.commit()

    response = client.post(
        "/api/v1/task-items/",
        headers=_headers(superadmin),
        json={
            "title": "Should not insert null company_id",
            "location_id": location.id,
            "unit": "unit",
            "quantity": 1,
        },
    )

    assert response.status_code == 403, response.text
    assert response.json()["detail"] == "Platform administrators must not use a customer company context"
    assert db.query(TaskItem).count() == 0


def test_scoped_worker_and_cross_tenant_cannot_create_tasks(client, db):
    company_a = _company(db, "scope-a")
    admin_a = _bootstrap_admin(db, company_a, "owner-a")
    loc_allowed = Location(
        name="Allowed Loc",
        address="Calle 1",
        city="Girona",
        postal_code="17001",
        managing_company_id=company_a.id,
        owner_company_id=company_a.id,
        is_active=True,
    )
    loc_forbidden = Location(
        name="Other Loc",
        address="Calle 2",
        city="Girona",
        postal_code="17001",
        managing_company_id=company_a.id,
        owner_company_id=company_a.id,
        is_active=True,
    )
    db.add_all([loc_allowed, loc_forbidden])
    db.flush()

    worker = _user(db, company_a, "scoped-viewer", 3)
    _assign_company_profile(
        db,
        company=company_a,
        admin=admin_a,
        user=worker,
        name="Consulta loc",
        permission_codes={"locations.read", "work.read"},
        scope_type="location",
        scope_id=loc_allowed.id,
    )

    company_b = _company(db, "scope-b")
    admin_b = _bootstrap_admin(db, company_b, "owner-b")

    assert client.post(
        "/api/v1/task-items/",
        headers=_headers(worker),
        json={"title": "Denied manage", "location_id": loc_allowed.id, "unit": "unit", "quantity": 1},
    ).status_code == 403
    assert client.get(f"/api/v1/locations/{loc_forbidden.id}", headers=_headers(worker)).status_code == 403
    assert client.post(
        "/api/v1/task-items/",
        headers=_headers(admin_b),
        json={"title": "Cross tenant", "location_id": loc_allowed.id, "unit": "unit", "quantity": 1},
    ).status_code == 404
    assert db.query(TaskItem).count() == 0
