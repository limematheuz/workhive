"""Regression tests for quota enforcement on reactivation, role promotion, and expired grant renewal."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.company_collaboration import CompanyCollaboration
from app.models.company_membership import CompanyMembership
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.role import Role
from app.models.user import User
from app.schemas.organization import (
    DepartmentCreate,
    DepartmentUpdate,
    TeamCreate,
    TeamUpdate,
)
from app.schemas.user import UserUpdate
from app.services import (
    organization_bootstrap_service,
    organization_structure_service,
    partner_portal_management_service,
    user_service,
)
from test_entitlement_service import make_company


def _make_user(db, *, company_id: int, role_name: str, email: str, is_active: bool = True) -> User:
    role = db.query(Role).filter_by(name=role_name).one()
    user = User(
        email=email,
        full_name=email.split("@")[0],
        hashed_password="unused",
        role_id=role.id,
        company_id=company_id,
        is_active=is_active,
    )
    db.add(user)
    db.flush()
    if role_name in {"admin", "manager", "viewer"}:
        membership = organization_bootstrap_service.ensure_user_membership(db, user)
        if membership and not is_active:
            membership.status = "suspended"
            db.add(membership)
            db.flush()
    return user


def test_reactivating_department_enforces_quota_and_allows_after_slot_release(db):
    company = make_company(db, suffix="dept-react", plan="basic", status="active")
    admin = _make_user(db, company_id=company.id, role_name="admin", email="dept-admin@example.test")
    db.commit()

    dept_a = organization_structure_service.create_department(
        db, DepartmentCreate(name="Operaciones A", code="OPA"), admin
    )
    organization_structure_service.update_department(
        db, dept_a.id, DepartmentUpdate(is_active=False), admin
    )
    dept_b = organization_structure_service.create_department(
        db, DepartmentCreate(name="Operaciones B", code="OPB"), admin
    )

    with pytest.raises(HTTPException) as exc:
        organization_structure_service.update_department(
            db, dept_a.id, DepartmentUpdate(is_active=True), admin
        )
    assert exc.value.status_code == 409
    assert exc.value.headers["X-WorkHive-Error-Code"] == "entitlement.quota_reached"

    organization_structure_service.update_department(
        db, dept_b.id, DepartmentUpdate(is_active=False), admin
    )
    reactivated = organization_structure_service.update_department(
        db, dept_a.id, DepartmentUpdate(is_active=True), admin
    )
    assert reactivated.is_active is True


def test_reactivating_team_enforces_quota_and_allows_after_slot_release(db):
    company = make_company(db, suffix="team-react", plan="basic", status="active")
    admin = _make_user(db, company_id=company.id, role_name="admin", email="team-admin@example.test")
    db.commit()

    team_1 = organization_structure_service.create_team(
        db, TeamCreate(name="Equipo 1", code="EQ1"), admin
    )
    team_2 = organization_structure_service.create_team(
        db, TeamCreate(name="Equipo 2", code="EQ2"), admin
    )
    organization_structure_service.update_team(
        db, team_1.id, TeamUpdate(is_active=False), admin
    )
    organization_structure_service.create_team(
        db, TeamCreate(name="Equipo 3", code="EQ3"), admin
    )

    with pytest.raises(HTTPException) as exc:
        organization_structure_service.update_team(
            db, team_1.id, TeamUpdate(is_active=True), admin
        )
    assert exc.value.status_code == 409
    assert exc.value.headers["X-WorkHive-Error-Code"] == "entitlement.quota_reached"

    organization_structure_service.update_team(
        db, team_2.id, TeamUpdate(is_active=False), admin
    )
    reactivated = organization_structure_service.update_team(
        db, team_1.id, TeamUpdate(is_active=True), admin
    )
    assert reactivated.is_active is True


def test_promoting_active_or_suspended_user_role_via_update_user_enforces_seat_quota(db):
    company = make_company(db, suffix="user-role-quota", plan="basic", status="active")
    admin = _make_user(db, company_id=company.id, role_name="admin", email="seat-admin@example.test")
    worker = _make_user(db, company_id=company.id, role_name="viewer", email="seat-worker@example.test")
    suspended = _make_user(
        db,
        company_id=company.id,
        role_name="viewer",
        email="seat-suspended@example.test",
        is_active=False,
    )
    db.commit()

    admin_role = db.query(Role).filter_by(name="admin").one()
    manager_role = db.query(Role).filter_by(name="manager").one()

    # Non-seat profile update stays allowed when admin quota (1/1) is already full.
    renamed = user_service.update_user(db, worker.id, UserUpdate(full_name="Worker Uno"), admin)
    assert renamed.full_name == "Worker Uno"

    # Promoting an active worker to admin must be rejected when admin quota (1/1) is full.
    with pytest.raises(HTTPException) as exc:
        user_service.update_user(db, worker.id, UserUpdate(role_id=admin_role.id), admin)
    assert exc.value.status_code == 409
    assert exc.value.headers["X-WorkHive-Error-Code"] == "entitlement.quota_reached"

    # Simultaneously reactivating and promoting a suspended worker to admin must check admin quota, not worker quota.
    with pytest.raises(HTTPException) as exc_react:
        user_service.update_user(
            db,
            suspended.id,
            UserUpdate(is_active=True, role_id=admin_role.id),
            admin,
        )
    assert exc_react.value.status_code == 409
    assert exc_react.value.headers["X-WorkHive-Error-Code"] == "entitlement.quota_reached"

    # Promoting to responsible (0/2 -> 1/2) remains allowed.
    promoted = user_service.update_user(db, worker.id, UserUpdate(role_id=manager_role.id), admin)
    assert promoted.role_id == manager_role.id
    membership = (
        db.query(CompanyMembership)
        .filter_by(company_id=company.id, user_id=worker.id)
        .one()
    )
    assert membership.access_class == "responsible"


def test_renewing_expired_partner_portal_grant_enforces_quota(db):
    host = make_company(db, suffix="partner-host-quota", plan="top", status="active")
    host_admin = _make_user(db, company_id=host.id, role_name="admin", email="host-admin@example.test")
    partner_company = make_company(db, suffix="partner-guest", plan="none", status="inactive")
    collaboration = CompanyCollaboration(
        initiator_company_id=host.id,
        partner_company_id=partner_company.id,
        status="accepted",
        role_type="property_manager",
    )
    db.add(collaboration)
    db.flush()

    p1 = _make_user(db, company_id=partner_company.id, role_name="partner_portal", email="p1@example.test")
    p2 = _make_user(db, company_id=partner_company.id, role_name="partner_portal", email="p2@example.test")
    p3 = _make_user(db, company_id=partner_company.id, role_name="partner_portal", email="p3@example.test")

    g1 = PartnerPortalGrant(
        host_company_id=host.id,
        partner_company_id=partner_company.id,
        collaboration_id=collaboration.id,
        user_id=p1.id,
        status="active",
    )
    g2 = PartnerPortalGrant(
        host_company_id=host.id,
        partner_company_id=partner_company.id,
        collaboration_id=collaboration.id,
        user_id=p2.id,
        status="active",
    )
    g3_expired = PartnerPortalGrant(
        host_company_id=host.id,
        partner_company_id=partner_company.id,
        collaboration_id=collaboration.id,
        user_id=p3.id,
        status="active",
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add_all([g1, g2, g3_expired])
    db.commit()

    # Top plan allows 2 active partner portals (g1 + g2 fill quota); renewing expired g3 must fail with 409.
    with pytest.raises(HTTPException) as exc:
        partner_portal_management_service.grant_portal_access(
            db,
            host_user=host_admin,
            collaboration_id=collaboration.id,
            partner_user_id=p3.id,
        )
    assert exc.value.status_code == 409
    assert exc.value.headers["X-WorkHive-Error-Code"] == "entitlement.quota_reached"

    # Revoking g1 frees one slot; renewing g3 now succeeds.
    partner_portal_management_service.revoke_portal_access(
        db,
        host_user=host_admin,
        collaboration_id=collaboration.id,
        grant_id=g1.id,
    )
    renewed = partner_portal_management_service.grant_portal_access(
        db,
        host_user=host_admin,
        collaboration_id=collaboration.id,
        partner_user_id=p3.id,
    )
    assert renewed.status == "active"
    assert renewed.expires_at is None
