from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError

from app.core.security import create_access_token
from app.models.calendar_governance import CompanyCalendarSettings
from app.models.company import Company
from app.models.expense import Expense
from app.models.user import User
from app.repositories import user as user_repo


def _company(db, suffix: str) -> Company:
    company = Company(
        name=f"Delete {suffix}",
        tax_id=f"DEL-{suffix}",
        address=f"Delete Street {suffix}",
        phone="600000000",
        email=f"delete-{suffix}@example.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _user(db, email: str, role_id: int, company_id: int | None) -> User:
    user = User(
        email=email,
        hashed_password="unused",
        full_name=email.split("@", 1)[0],
        role_id=role_id,
        company_id=company_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return {"Authorization": f"Bearer {token}"}


def test_admin_can_delete_unreferenced_company_user(client, db):
    company = _company(db, "empty")
    admin = _user(db, "admin-delete@example.test", 1, company.id)
    worker = _user(db, "worker-delete@example.test", 3, company.id)

    response = client.delete(
        f"/api/v1/users/{worker.id}",
        headers=_headers(admin),
    )

    assert response.status_code == 204
    assert db.get(User, worker.id) is None


def test_user_with_operational_history_returns_actionable_conflict(client, db):
    company = _company(db, "history")
    admin = _user(db, "admin-history@example.test", 1, company.id)
    worker = _user(db, "worker-history@example.test", 3, company.id)
    db.add(
        Expense(
            company_id=company.id,
            created_by_user_id=worker.id,
            expense_date=datetime.now(timezone.utc),
            category="supplies",
            description="Protected history",
            total_amount=10,
        )
    )
    db.commit()

    response = client.delete(
        f"/api/v1/users/{worker.id}",
        headers=_headers(admin),
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "USER_HAS_RELATED_DATA"
    assert "Deactivate" in response.json()["detail"]["message"]
    assert db.get(User, worker.id) is not None


def test_calendar_owner_must_transfer_control_before_deletion(client, db):
    company = _company(db, "calendar-owner")
    owner = _user(db, "calendar-owner@example.test", 1, company.id)
    superadmin = _user(db, "delete-superadmin@example.test", 4, None)
    db.add(CompanyCalendarSettings(company_id=company.id, owner_user_id=owner.id))
    db.commit()

    response = client.delete(
        f"/api/v1/users/{owner.id}",
        headers=_headers(superadmin),
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "USER_HAS_RELATED_DATA"
    assert db.get(User, owner.id) is not None


def test_user_deletion_is_tenant_scoped_and_role_protected(client, db):
    first = _company(db, "tenant-a")
    second = _company(db, "tenant-b")
    first_admin = _user(db, "first-admin@example.test", 1, first.id)
    first_manager = _user(db, "first-manager@example.test", 2, first.id)
    second_worker = _user(db, "second-worker@example.test", 3, second.id)

    cross_tenant = client.delete(
        f"/api/v1/users/{second_worker.id}",
        headers=_headers(first_admin),
    )
    role_denied = client.delete(
        f"/api/v1/users/{second_worker.id}",
        headers=_headers(first_manager),
    )

    assert cross_tenant.status_code == 403
    assert role_denied.status_code == 403
    assert db.get(User, second_worker.id) is not None


def test_integrity_details_never_leak_when_a_new_reference_blocks_deletion(
    client,
    db,
    monkeypatch,
):
    company = _company(db, "race")
    admin = _user(db, "admin-race@example.test", 1, company.id)
    worker = _user(db, "worker-race@example.test", 3, company.id)

    def fail_delete(*_args, **_kwargs):
        raise IntegrityError(
            "DELETE FROM users",
            {},
            RuntimeError("private_constraint_and_customer_data"),
        )

    monkeypatch.setattr(user_repo, "delete_user", fail_delete)

    response = client.delete(
        f"/api/v1/users/{worker.id}",
        headers=_headers(admin),
    )

    assert response.status_code == 409
    serialized = response.text.lower()
    assert "private_constraint" not in serialized
    assert "delete from users" not in serialized
    assert response.json()["detail"]["code"] == "USER_HAS_RELATED_DATA"
