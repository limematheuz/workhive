from app.core.security import get_password_hash
from app.models.user import User
from app.services import user_service
from credentials import TEST_NEW, TEST_OLD, TEST_SECRET, login_form, with_credential, with_new_credential, CREDENTIAL_FIELD



def _register_company(client, suffix: str) -> tuple[dict[str, str], int]:
    email = f"admin-{suffix}@workhive.com"
    password = TEST_SECRET
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            CREDENTIAL_FIELD: password,
            "full_name": f"Admin {suffix}",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    assert registration.status_code == 201, registration.text
    login = client.post(
        "/api/v1/auth/login",
        data=login_form(email, password),
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": f"Company {suffix}",
            "tax_id": f"TAX-{suffix}",
            "address": f"Address {suffix}",
            "phone": "600000000",
            "email": email,
        },
    )
    assert company.status_code == 201, company.text
    return headers, company.json()["id"]


def test_manager_cannot_create_privileged_users(client):
    admin_headers, _ = _register_company(client, "roles")
    manager = client.post(
        "/api/v1/users/",
        headers=admin_headers,
        json={
            "email": "manager@workhive.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Manager",
            "role_id": 2,
        },
    )
    assert manager.status_code == 201, manager.text

    login = client.post(
        "/api/v1/auth/login",
        data=login_form("manager@workhive.com", TEST_SECRET),
    )
    manager_headers = {
        "Authorization": f"Bearer {login.json()['access_token']}"
    }

    for role_id in (1, 2, 4):
        response = client.post(
            "/api/v1/users/",
            headers=manager_headers,
            json={
                "email": f"privileged-{role_id}@workhive.com",
                CREDENTIAL_FIELD: TEST_SECRET,
                "role_id": role_id,
            },
        )
        assert response.status_code == 403, response.text

    worker = client.post(
        "/api/v1/users/",
        headers=manager_headers,
        json={
            "email": "worker@workhive.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "role_id": 3,
        },
    )
    assert worker.status_code == 201, worker.text
    assert worker.json()["role"]["name"] == "viewer"


def test_platform_superadmin_stats_are_empty_without_company(db):
    superadmin = User(
        email="platform-admin@workhive.com",
        hashed_password=get_password_hash(TEST_SECRET),
        role_id=4,
        company_id=None,
        is_active=True,
    )
    db.add(superadmin)
    db.commit()
    db.refresh(superadmin)

    stats = user_service.get_user_stats(db, superadmin.id, superadmin)

    assert stats.total_tasks == 0
    assert stats.total_hours_worked == 0
    assert stats.locations_worked_count == 0


def test_company_admin_cannot_access_other_company_users_or_company(client):
    first_headers, first_company_id = _register_company(client, "tenant-a")
    second_headers, second_company_id = _register_company(client, "tenant-b")
    second_user = client.get("/api/v1/users/me", headers=second_headers)
    second_user_id = second_user.json()["id"]

    company_response = client.get(
        f"/api/v1/companies/{second_company_id}",
        headers=first_headers,
    )
    assert company_response.status_code == 403

    user_response = client.get(
        f"/api/v1/users/{second_user_id}",
        headers=first_headers,
    )
    assert user_response.status_code == 403

    update_response = client.patch(
        f"/api/v1/users/{second_user_id}",
        headers=first_headers,
        json={"full_name": "Cross-company update"},
    )
    assert update_response.status_code == 403

    own_company = client.get(
        f"/api/v1/companies/{first_company_id}",
        headers=first_headers,
    )
    assert own_company.status_code == 200
