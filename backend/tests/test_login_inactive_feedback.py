import pytest

from app.core.security import get_password_hash
from app.models.company import Company
from app.models.user import User
from credentials import TEST_SECRET, login_form


@pytest.mark.parametrize("inactive", ["user", "company"])
@pytest.mark.parametrize("valid_password", [True, False])
def test_inactive_login_feedback_requires_valid_credentials(
    client, db, inactive, valid_password
):
    company = Company(
        name="Inactive login",
        tax_id="LOGIN-INACTIVE",
        address="Test address",
        phone="600000000",
        email="inactive-company@example.com",
        is_active=inactive != "company",
        subscription_plan="mega",
        subscription_status="active",
    )
    db.add(company)
    db.flush()
    user = User(
        email="inactive-login@example.com",
        hashed_password=get_password_hash(TEST_SECRET),
        role_id=1,
        company_id=company.id,
        is_active=inactive != "user",
    )
    db.add(user)
    db.commit()
    response = client.post(
        "/api/v1/auth/login",
        data=login_form(user.email, TEST_SECRET if valid_password else "wrong-password"),
    )
    if valid_password:
        assert response.status_code == (400 if inactive == "user" else 403)
        assert response.headers["X-WorkHive-Error-Code"] == f"auth.{inactive}_inactive"
    else:
        assert response.status_code == 401
        assert "X-WorkHive-Error-Code" not in response.headers
        assert response.json()["detail"] == "Incorrect email or password"
    assert "auth_token" not in response.cookies
