from datetime import datetime, timedelta, timezone

from app.models.company_membership import CompanyMembership
from app.models.reservation import Reservation
from app.models.role import Role
from app.models.task_item import TaskItem
from app.models.user import User
from app.services.organization_base_profile_service import (
    ensure_company_permission_profiles,
)
from app.services.organization_profile_assignment_service import (
    replace_member_profile_assignments,
)
from app.schemas.organization import OrganizationMemberProfileAssignmentsUpdate
from tests.test_task_security_delivery import _company, _headers, _location


def _role_id(db, name: str) -> int:
    return db.query(Role).filter(Role.name == name).one().id


def _create_member(
    db,
    company,
    admin: User,
    *,
    email: str,
    profile_name: str,
    scope_type: str = "company",
    scope_id: int | None = None,
) -> User:
    user = User(
        company_id=company.id,
        email=email,
        hashed_password="unused",
        full_name=email.partition("@")[0],
        role_id=_role_id(db, "viewer"),
        is_active=True,
    )
    db.add(user)
    db.flush()
    membership = CompanyMembership(
        company_id=company.id,
        user_id=user.id,
        access_class="worker",
        status="active",
        permissions_configured=True,
    )
    db.add(membership)
    db.flush()
    ensure_company_permission_profiles(db, company.id)
    from app.repositories import organization as organization_repo

    profiles = organization_repo.list_permission_profiles(db, company.id)
    profile = next(p for p in profiles if p.name == profile_name)
    replace_member_profile_assignments(
        db,
        membership.id,
        OrganizationMemberProfileAssignmentsUpdate.model_validate(
            {
                "assignments": [
                    {
                        "permission_profile_id": profile.id,
                        "scopes": [
                            {
                                "scope_type": scope_type,
                                "scope_id": scope_id if scope_id is not None else company.id,
                            }
                        ],
                    }
                ]
            }
        ),
        admin,
    )
    db.commit()
    return user


def test_operations_profile_on_worker_class_can_open_reservation_detail_within_scope(
    client, db
):
    company = _company(db, "ResOpsAccess")
    company.subscription_plan = "mega"
    admin = User(
        company_id=company.id,
        email="res-ops-admin@example.test",
        hashed_password="unused",
        full_name="Admin",
        role_id=_role_id(db, "admin"),
        is_active=True,
    )
    db.add(admin)
    db.flush()
    admin_membership = CompanyMembership(
        company_id=company.id,
        user_id=admin.id,
        access_class="admin",
        status="active",
        permissions_configured=True,
    )
    db.add(admin_membership)
    db.flush()
    from app.services.organization_membership_lifecycle import sync_administrator_profile

    sync_administrator_profile(db, admin_membership, actor_id=admin.id)

    loc_a = _location(db, company, "Loc A")
    loc_b = _location(db, company, "Loc B")

    ops_company = _create_member(
        db,
        company,
        admin,
        email="res-ops-company@example.test",
        profile_name="Operaciones",
        scope_type="company",
        scope_id=company.id,
    )
    ops_loc_b = _create_member(
        db,
        company,
        admin,
        email="res-ops-locb@example.test",
        profile_name="Operaciones",
        scope_type="location",
        scope_id=loc_b.id,
    )
    consulta = _create_member(
        db,
        company,
        admin,
        email="res-consulta@example.test",
        profile_name="Consulta",
        scope_type="company",
        scope_id=company.id,
    )

    now = datetime.now(timezone.utc)
    reservation = Reservation(
        location_id=loc_a.id,
        owner_company_id=company.id,
        created_by_user_id=admin.id,
        check_in_at=now + timedelta(hours=12),
        check_out_at=now + timedelta(hours=36),
        guest_count=2,
        stay_type="guest",
        status="confirmed",
        cleaning_required=False,
    )
    db.add(reservation)
    db.commit()

    # Operaciones (worker access class + work.manage/locations.read on company) can list and open detail
    assert client.get("/api/v1/reservations/upcoming/arrivals?days=3", headers=_headers(ops_company)).status_code == 200
    detail = client.get(f"/api/v1/reservations/{reservation.id}", headers=_headers(ops_company))
    assert detail.status_code == 200, detail.text
    assert detail.json()["id"] == reservation.id

    # Operaciones scoped only to Location B stays denied on Location A
    assert client.get(f"/api/v1/reservations/{reservation.id}", headers=_headers(ops_loc_b)).status_code == 403

    # Consulta (no work.manage) stays denied on unassigned reservation detail
    assert client.get(f"/api/v1/reservations/{reservation.id}", headers=_headers(consulta)).status_code == 404

    # Consulta assigned to a task linked to the reservation can read its detail
    task = TaskItem(
        company_id=company.id,
        location_id=loc_a.id,
        user_id=consulta.id,
        checkout_reservation_id=reservation.id,
        title="Assigned checkout",
        unit="service",
        status="accepted",
    )
    db.add(task)
    db.commit()
    assert client.get(f"/api/v1/reservations/{reservation.id}", headers=_headers(consulta)).status_code == 200
