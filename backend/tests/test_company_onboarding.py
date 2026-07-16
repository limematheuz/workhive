from app.core.security import create_access_token
from app.models.company import Company
from app.models.location import Location
from app.models.location_template import LocationTemplate
from app.models.template_task import TemplateTask
from app.models.user import User


def _company(db, name: str) -> Company:
    company = Company(
        name=name,
        tax_id=f"{name.upper()}-ONB",
        address="Calle Inicio 1",
        phone="600000000",
        email=f"{name.lower()}@onboarding.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _user(db, company: Company, role_id: int, label: str) -> User:
    user = User(
        email=f"{label}@{company.name.lower()}.test",
        hashed_password="unused",
        full_name=label,
        role_id=role_id,
        company_id=company.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return {"Authorization": f"Bearer {token}"}


def _payload() -> dict:
    return {
        "operating_model": "property_manager",
        "location": {
            "name": "Apartamento Marina",
            "address": "Carrer Mar 2",
            "city": "L'Escala",
            "postal_code": "17130",
            "location_type": "real_estate",
        },
    }


def test_admin_onboarding_creates_tenant_scoped_operating_base(client, db):
    company = _company(db, "Costa")
    admin = _user(db, company, 1, "admin")

    response = client.post(
        f"/api/v1/companies/{company.id}/onboarding/complete",
        headers=_headers(admin),
        json=_payload(),
    )

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["onboarding_completed"] is True
    assert result["created"] is True
    assert result["operating_model"] == "property_manager"
    assert result["template_name"] == "Limpieza de salida"

    db.refresh(company)
    assert company.onboarding_completed is True
    assert company.operating_model == "property_manager"

    location = db.query(Location).filter(Location.id == result["location_id"]).one()
    assert location.owner_company_id == company.id
    assert location.managing_company_id == company.id
    assert location.client_id is None

    template = (
        db.query(TemplateTask)
        .filter(TemplateTask.id == result["template_task_id"])
        .one()
    )
    assert template.company_id == company.id
    assert "- [ ] Cambiar ropa de cama y toallas" in template.description
    assert (
        db.query(LocationTemplate)
        .filter(
            LocationTemplate.location_id == location.id,
            LocationTemplate.template_task_id == template.id,
        )
        .count()
        == 1
    )


def test_company_onboarding_is_idempotent(client, db):
    company = _company(db, "Repeat")
    admin = _user(db, company, 1, "admin")
    headers = _headers(admin)

    first = client.post(
        f"/api/v1/companies/{company.id}/onboarding/complete",
        headers=headers,
        json=_payload(),
    )
    second = client.post(
        f"/api/v1/companies/{company.id}/onboarding/complete",
        headers=headers,
        json={
            **_payload(),
            "location": {**_payload()["location"], "name": "Duplicada"},
        },
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["created"] is False
    assert second.json()["location_id"] == first.json()["location_id"]
    assert second.json()["location_name"] == "Apartamento Marina"
    assert db.query(Location).filter(Location.owner_company_id == company.id).count() == 1
    assert db.query(TemplateTask).filter(TemplateTask.company_id == company.id).count() == 1


def test_onboarding_rejects_cross_tenant_and_non_admin_access(client, db):
    company = _company(db, "Owner")
    other_company = _company(db, "Other")
    admin = _user(db, company, 1, "admin")
    manager = _user(db, company, 2, "manager")

    cross_tenant = client.post(
        f"/api/v1/companies/{other_company.id}/onboarding/complete",
        headers=_headers(admin),
        json=_payload(),
    )
    non_admin = client.post(
        f"/api/v1/companies/{company.id}/onboarding/complete",
        headers=_headers(manager),
        json=_payload(),
    )

    assert cross_tenant.status_code == 403
    assert non_admin.status_code == 403
    assert db.query(Location).count() == 0
    assert db.query(TemplateTask).count() == 0


def test_onboarding_rejects_client_supplied_tenant_fields(client, db):
    company = _company(db, "Strict")
    admin = _user(db, company, 1, "admin")
    payload = _payload()
    payload["location"]["owner_company_id"] = 999

    response = client.post(
        f"/api/v1/companies/{company.id}/onboarding/complete",
        headers=_headers(admin),
        json=payload,
    )

    assert response.status_code == 422
    assert db.query(Location).count() == 0


def test_onboarding_can_be_completed_without_creating_sample_data(client, db):
    company = _company(db, "Later")
    admin = _user(db, company, 1, "admin")

    response = client.post(
        f"/api/v1/companies/{company.id}/onboarding/complete",
        headers=_headers(admin),
        json={"operating_model": "service_provider"},
    )

    assert response.status_code == 200
    assert response.json()["created"] is False
    assert response.json()["location_id"] is None
    db.refresh(company)
    assert company.onboarding_completed is True
    assert company.operating_model == "service_provider"
    assert db.query(Location).count() == 0
    assert db.query(TemplateTask).count() == 0

    resumed = client.post(
        f"/api/v1/companies/{company.id}/onboarding/complete",
        headers=_headers(admin),
        json=_payload(),
    )
    assert resumed.status_code == 200
    assert resumed.json()["created"] is True
    assert db.query(Location).filter(Location.owner_company_id == company.id).count() == 1
