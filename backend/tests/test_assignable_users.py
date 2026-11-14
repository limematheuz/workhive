from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models.company import Company
from app.models.user import User
from app.services import organization_bootstrap_service, organization_service
from app.schemas.organization import (
    OrganizationMemberProfileAssignmentInput,
    OrganizationMemberProfileAssignmentsUpdate,
    OrganizationMemberProfileScopeInput,
    PermissionProfileCreate,
)
from app.services.organization_base_profile_service import (
    CONSULTATION_PROFILE_NAME,
    FINANCE_PROFILE_NAME,
    OPERATIONS_PROFILE_NAME,
)


def _company(db: Session, suffix: str) -> Company:
    company = Company(
        name=f"Assignable {suffix}",
        tax_id=f"ASG-{suffix}",
        address="Calle Test 1",
        phone="600000000",
        email=f"{suffix}@example.com",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.flush()
    return company


def _user(
    db: Session,
    company: Company | None,
    email: str,
    role_id: int,
    *,
    full_name: str,
    is_active: bool = True,
) -> User:
    user = User(
        email=email,
        hashed_password="unused",
        full_name=full_name,
        role_id=role_id,
        company_id=company.id if company else None,
        is_active=is_active,
    )
    db.add(user)
    db.flush()
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return {"Authorization": f"Bearer {token}"}


def _assign_profile(
    db: Session,
    *,
    company: Company,
    admin: User,
    target_user: User,
    profile_name: str,
) -> None:
    profiles = organization_service.list_permission_profiles(db, admin)
    profile = next(p for p in profiles if p.name == profile_name)
    members = organization_service.list_members(db, admin)
    membership = next(m for m in members if m.user_id == target_user.id)
    organization_service.replace_member_profile_assignments(
        db,
        membership.id,
        OrganizationMemberProfileAssignmentsUpdate(
            assignments=[
                OrganizationMemberProfileAssignmentInput(
                    permission_profile_id=profile.id,
                    scopes=[
                        OrganizationMemberProfileScopeInput(
                            scope_type="company",
                            scope_id=company.id,
                        )
                    ],
                )
            ]
        ),
        admin,
    )


def test_assignable_users_allows_operations_and_blocks_narrow_roles(
    client: TestClient,
    db: Session,
):
    company = _company(db, "primary")
    other_company = _company(db, "other")

    admin = _user(db, company, "admin@example.com", role_id=1, full_name="Admin Co")
    ops = _user(db, company, "ops@example.com", role_id=2, full_name="Ops Manager")
    worker = _user(db, company, "worker@example.com", role_id=3, full_name="Active Worker")
    inactive_worker = _user(
        db,
        company,
        "inactive@example.com",
        role_id=3,
        full_name="Inactive Worker",
        is_active=False,
    )
    finance = _user(db, company, "finance@example.com", role_id=3, full_name="Finance Reader")
    foreign = _user(
        db,
        other_company,
        "foreign@example.com",
        role_id=3,
        full_name="Foreign Worker",
    )
    platform = _user(
        db,
        None,
        "platform@example.com",
        role_id=4,
        full_name="Platform Root",
    )
    db.commit()

    for member in (admin, ops, worker, finance):
        organization_bootstrap_service.ensure_user_membership(db, member)
    db.commit()
    _assign_profile(
        db,
        company=company,
        admin=admin,
        target_user=ops,
        profile_name=OPERATIONS_PROFILE_NAME,
    )
    _assign_profile(
        db,
        company=company,
        admin=admin,
        target_user=worker,
        profile_name=CONSULTATION_PROFILE_NAME,
    )
    _assign_profile(
        db,
        company=company,
        admin=admin,
        target_user=finance,
        profile_name=FINANCE_PROFILE_NAME,
    )

    # Operations manager still cannot inspect the full member directory (/users/),
    # preserving access.members.read privacy boundaries.
    assert client.get("/api/v1/users/", headers=_headers(ops)).status_code == 403

    # Anonymous, platform superadmin, finance, and worker/consultation must be denied.
    assert client.get("/api/v1/users/assignable").status_code == 401
    assert client.get("/api/v1/users/assignable", headers=_headers(platform)).status_code == 403
    assert client.get("/api/v1/users/assignable", headers=_headers(finance)).status_code == 403
    assert client.get("/api/v1/users/assignable", headers=_headers(worker)).status_code == 403

    # Operations manager (work.manage) and Admin (access.members.read) receive active same-company assignees only.
    for actor in (ops, admin):
        resp = client.get("/api/v1/users/assignable", headers=_headers(actor))
        assert resp.status_code == 200, resp.text
        ids = {row["id"] for row in resp.json()}
        assert {admin.id, ops.id, worker.id}.issubset(ids)
        assert inactive_worker.id not in ids
        assert foreign.id not in ids
        assert platform.id not in ids

    # Narrow permission profile without work.manage/time.read/time.approve is denied too.
    narrow_user = _user(db, company, "narrow@example.com", role_id=2, full_name="Narrow Ops")
    db.flush()
    organization_bootstrap_service.ensure_user_membership(db, narrow_user)
    db.commit()
    work_read_only = organization_service.create_permission_profile(
        db,
        PermissionProfileCreate(
            name="Work Read Only",
            description="Only work.read",
            permission_codes=["work.read"],
        ),
        admin,
    )
    members = organization_service.list_members(db, admin)
    narrow_membership = next(m for m in members if m.user_id == narrow_user.id)
    organization_service.replace_member_profile_assignments(
        db,
        narrow_membership.id,
        OrganizationMemberProfileAssignmentsUpdate(
            assignments=[
                OrganizationMemberProfileAssignmentInput(
                    permission_profile_id=work_read_only.id,
                    scopes=[
                        OrganizationMemberProfileScopeInput(
                            scope_type="company",
                            scope_id=company.id,
                        )
                    ],
                )
            ]
        ),
        admin,
    )
    assert client.get("/api/v1/users/assignable", headers=_headers(narrow_user)).status_code == 403
