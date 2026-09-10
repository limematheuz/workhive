import pytest
from fastapi import HTTPException

from app.models.permission_profile import PermissionProfilePermission, PermissionDefinition
from app.repositories import organization as organization_repo
from app.services import organization_authorization_service as authorization
from app.services.organization_bootstrap_service import ensure_user_membership
from app.services.organization_permission_policy import SYSTEM_ONLY_PERMISSION_CODES
from test_organization_api import _bootstrap_admin, _company, _headers, _user


def _setup(db, client, role_id=2):
    company = _company(db, "revocation")
    admin = _bootstrap_admin(db, company, "owner")
    user = _user(db, company, "limited", role_id=role_id)
    member = ensure_user_membership(db, user)
    db.commit()
    profiles = organization_repo.list_permission_profiles(db, company.id)
    profile = next(item for item in profiles if item.name == "Comercial")
    path = f"/api/v1/organization/members/{member.id}/profile-assignments"
    response = client.put(path, headers=_headers(admin), json={"assignments": [{
        "permission_profile_id": profile.id,
        "scopes": [{"scope_type": "company", "scope_id": company.id}],
    }]})
    assert response.status_code == 200, response.text
    return company, admin, user, member, profile, path


@pytest.mark.parametrize("role_id", [2, 3])
def test_removing_last_profile_never_restores_legacy_permissions(client, db, role_id):
    company, admin, user, member, profile, path = _setup(db, client, role_id)
    assert client.get("/api/v1/clients/", headers=_headers(user)).status_code == 200
    removed = client.put(path, headers=_headers(admin), json={"assignments": []})
    assert removed.status_code == 200, removed.text
    for endpoint in ("locations/", "task-items/", "clients/", "quotes/"):
        response = client.get(f"/api/v1/{endpoint}", headers=_headers(user))
        assert response.status_code == 403, (endpoint, response.text)
    assert authorization.uses_legacy_role_authorization(db, user, "work.read") is False
    # A later membership sync must not silently undo an explicit revocation.
    ensure_user_membership(db, user)
    db.commit()
    with pytest.raises(HTTPException) as denied:
        authorization.permitted_location_ids(db, user, "work.read")
    assert denied.value.status_code == 403


@pytest.mark.parametrize("permission", sorted(SYSTEM_ONLY_PERMISSION_CODES))
def test_reserved_permission_on_old_default_profile_does_not_make_recipient_admin(client, db, permission):
    company, admin, user, member, profile, path = _setup(db, client)
    definition = db.query(PermissionDefinition).filter_by(code=permission).one()
    # Simulate a historical grant, not an authorized way to create new grants.
    db.add(PermissionProfilePermission(permission_profile_id=profile.id, permission_definition_id=definition.id))
    db.commit()
    with pytest.raises(HTTPException) as denied:
        authorization.require_capability(db, user, permission)
    assert denied.value.status_code == 403
    authorization.require_capability(db, admin, permission)


def test_combined_member_save_rejects_invalid_scope_without_partial_role_change(client, db):
    company, admin, user, member, profile, path = _setup(db, client)
    other_company = _company(db, "foreign")
    db.commit()
    response = client.patch(
        f"/api/v1/organization/members/{member.id}", headers=_headers(admin),
        json={"access_class": "admin", "profile_assignments": {"assignments": [{
            "permission_profile_id": profile.id,
            "scopes": [{"scope_type": "company", "scope_id": other_company.id}],
        }]}},
    )
    assert response.status_code == 409, response.text
    db.refresh(member)
    db.refresh(user)
    assert member.access_class == "responsible"
    assert user.role.name == "manager"
    assignments = organization_repo.list_profile_assignments(db, company_id=company.id, membership_id=member.id)
    assert [item.permission_profile_id for item in assignments] == [profile.id]


def test_inactive_profile_assignment_can_be_preserved_but_not_expanded(client, db):
    company, admin, user, member, profile, path = _setup(db, client)
    profile.is_active = False
    db.commit()
    payload = {"assignments": [{"permission_profile_id": profile.id, "scopes": [
        {"scope_type": "company", "scope_id": company.id},
    ]}]}
    response = client.put(path, headers=_headers(admin), json=payload)
    assert response.status_code == 200, response.text
    assert client.get("/api/v1/clients/", headers=_headers(user)).status_code == 403
    new_user = _user(db, company, "new-member", role_id=3)
    new_member = ensure_user_membership(db, new_user)
    db.commit()
    response = client.put(f"/api/v1/organization/members/{new_member.id}/profile-assignments", headers=_headers(admin), json=payload)
    assert response.status_code == 409, response.text


def test_explicit_empty_assignment_disables_legacy_access_even_on_first_configuration(client, db):
    company = _company(db, "first-empty")
    admin = _bootstrap_admin(db, company, "owner")
    user = _user(db, company, "legacy-manager", 2)
    member = ensure_user_membership(db, user)
    db.commit()
    response = client.put(f"/api/v1/organization/members/{member.id}/profile-assignments", headers=_headers(admin), json={"assignments": []})
    assert response.status_code == 200, response.text
    assert client.get("/api/v1/locations/", headers=_headers(user)).status_code == 403


def test_suspended_session_does_not_return_when_membership_is_reactivated(client, db):
    company, admin, user, member, profile, path = _setup(db, client)
    old_session = _headers(user)
    for status in ("suspended", "active"):
        response = client.patch(f"/api/v1/organization/members/{member.id}", headers=_headers(admin), json={"status": status})
        assert response.status_code == 200, response.text
    assert client.get("/api/v1/clients/", headers=old_session).status_code == 401
    assert client.get("/api/v1/clients/", headers=_headers(user)).status_code == 200
