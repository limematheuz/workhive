from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models.company import Company
from app.models.location import Location
from app.models.user import User
from app.services import organization_bootstrap_service, organization_service
from app.services.organization_authorization_service import has_capability
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


def test_scoped_work_manager_sees_only_scoped_candidates_and_time_only_is_denied(
    client: TestClient,
    db: Session,
):
    company = _company(db, "scoped-dir")
    other_company = _company(db, "scoped-other")

    admin = _user(db, company, "admin-scoped@example.com", role_id=1, full_name="Scoped Admin")
    scoped_mgr = _user(db, company, "mgr-loc1@client-permissions.test", role_id=2, full_name="Manager Loc 1")
    worker_loc1 = _user(db, company, "worker-loc1@example.com", role_id=3, full_name="Worker Loc 1")
    worker_loc2 = _user(db, company, "worker-loc2@example.com", role_id=3, full_name="Worker Loc 2")
    unscoped_worker = _user(db, company, "worker-unscoped@example.com", role_id=3, full_name="Unscoped Worker")
    time_approver = _user(db, company, "time-only@example.com", role_id=2, full_name="Time Approver Only")

    loc1 = Location(
        name="Allowed Site 1",
        address="Calle 1",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
        is_active=True,
    )
    loc2 = Location(
        name="Forbidden Site 2",
        address="Calle 2",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
        is_active=True,
    )
    foreign_loc = Location(
        name="Foreign Site",
        address="Calle 3",
        city="Barcelona",
        owner_company_id=other_company.id,
        managing_company_id=other_company.id,
        is_active=True,
    )
    db.add_all([loc1, loc2, foreign_loc])
    db.commit()

    for member in (admin, scoped_mgr, worker_loc1, worker_loc2, unscoped_worker, time_approver):
        organization_bootstrap_service.ensure_user_membership(db, member)
    db.commit()

    work_manage_profile = organization_service.create_permission_profile(
        db,
        PermissionProfileCreate(
            name="Scoped Work Manager",
            description="work.manage on a location",
            permission_codes=["work.manage"],
        ),
        admin,
    )
    work_read_profile = organization_service.create_permission_profile(
        db,
        PermissionProfileCreate(
            name="Scoped Work Reader",
            description="work.read on a location",
            permission_codes=["work.read"],
        ),
        admin,
    )
    time_only_profile = organization_service.create_permission_profile(
        db,
        PermissionProfileCreate(
            name="Time Only Profile",
            description="time.read and time.approve without work.manage",
            permission_codes=["time.read", "time.approve"],
        ),
        admin,
    )

    members = {m.user_id: m for m in organization_service.list_members(db, admin)}

    organization_service.replace_member_profile_assignments(
        db,
        members[scoped_mgr.id].id,
        OrganizationMemberProfileAssignmentsUpdate(
            assignments=[
                OrganizationMemberProfileAssignmentInput(
                    permission_profile_id=work_manage_profile.id,
                    scopes=[OrganizationMemberProfileScopeInput(scope_type="location", scope_id=loc1.id)],
                )
            ]
        ),
        admin,
    )
    organization_service.replace_member_profile_assignments(
        db,
        members[worker_loc1.id].id,
        OrganizationMemberProfileAssignmentsUpdate(
            assignments=[
                OrganizationMemberProfileAssignmentInput(
                    permission_profile_id=work_read_profile.id,
                    scopes=[OrganizationMemberProfileScopeInput(scope_type="location", scope_id=loc1.id)],
                )
            ]
        ),
        admin,
    )
    organization_service.replace_member_profile_assignments(
        db,
        members[worker_loc2.id].id,
        OrganizationMemberProfileAssignmentsUpdate(
            assignments=[
                OrganizationMemberProfileAssignmentInput(
                    permission_profile_id=work_read_profile.id,
                    scopes=[OrganizationMemberProfileScopeInput(scope_type="location", scope_id=loc2.id)],
                )
            ]
        ),
        admin,
    )
    organization_service.replace_member_profile_assignments(
        db,
        members[time_approver.id].id,
        OrganizationMemberProfileAssignmentsUpdate(
            assignments=[
                OrganizationMemberProfileAssignmentInput(
                    permission_profile_id=time_only_profile.id,
                    scopes=[OrganizationMemberProfileScopeInput(scope_type="company", scope_id=company.id)],
                )
            ]
        ),
        admin,
    )

    assert has_capability(db, scoped_mgr, "work.manage", scope_type="location", scope_id=loc1.id)
    assert not has_capability(db, scoped_mgr, "work.manage", scope_type="location", scope_id=loc2.id)

    # Scoped manager can query assignable users (default and explicit allowed location),
    # receiving ONLY candidates from loc1 scope, never the full company directory.
    for path in ("/api/v1/users/assignable", f"/api/v1/users/assignable?location_id={loc1.id}"):
        res = client.get(path, headers=_headers(scoped_mgr))
        assert res.status_code == 200, res.text
        returned_ids = {row["id"] for row in res.json()}
        assert returned_ids == {scoped_mgr.id, worker_loc1.id}
        assert worker_loc2.id not in returned_ids
        assert unscoped_worker.id not in returned_ids
        assert admin.id not in returned_ids

    # Scoped manager is denied when requesting an unauthorized location or foreign location.
    assert (
        client.get(f"/api/v1/users/assignable?location_id={loc2.id}", headers=_headers(scoped_mgr)).status_code
        == 403
    )
    assert (
        client.get(f"/api/v1/users/assignable?location_id={foreign_loc.id}", headers=_headers(admin)).status_code
        == 403
    )

    # Time-only capabilities (time.read / time.approve) do not grant task assignee directory access.
    assert client.get("/api/v1/users/assignable", headers=_headers(time_approver)).status_code == 403


def test_assignable_users_pagination_over_200_candidates(
    client: TestClient,
    db: Session,
):
    company = _company(db, "paginated-dir")
    admin = _user(db, company, "admin-page@example.com", role_id=1, full_name="Admin Paginated")
    for idx in range(205):
        _user(
            db,
            company,
            f"worker-{idx:03d}@example.com",
            role_id=3,
            full_name=f"Worker {idx:03d}",
        )
    db.commit()
    organization_bootstrap_service.ensure_user_membership(db, admin)
    db.commit()

    page1 = client.get("/api/v1/users/assignable?skip=0&limit=200", headers=_headers(admin))
    page2 = client.get("/api/v1/users/assignable?skip=200&limit=200", headers=_headers(admin))
    assert page1.status_code == 200
    assert page2.status_code == 200
    items1 = page1.json()
    items2 = page2.json()
    assert len(items1) == 200
    assert len(items2) == 6
    combined_ids = {row["id"] for row in items1} | {row["id"] for row in items2}
    assert len(combined_ids) == 206
