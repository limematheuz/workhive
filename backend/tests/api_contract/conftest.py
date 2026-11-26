from types import SimpleNamespace

import pytest

from app.core.security import create_access_token
from app.services.company_session_service import token_claims
from app.models.client import Client
from app.models.company import Company
from app.models.location import Location
from app.models.role import Role
from app.models.task_item import TaskItem
from app.models.user import User
from app.services.organization_bootstrap_service import ensure_user_membership


@pytest.fixture
def api_workspace(db):
    def company(suffix):
        result = Company(
            name=f"API contract {suffix}",
            tax_id=f"B1234567{suffix}",
            address="Calle QA 1",
            city="Madrid",
            province="Madrid",
            postal_code="28001",
            phone="000000000",
            email=f"api-{suffix}@example.com",
            subscription_plan="mega",
            subscription_status="active",
            onboarding_completed=True,
        )
        db.add(result)
        db.flush()
        return result

    own, other = company("1"), company("2")

    def user(label, role_name, tenant):
        role_id = db.query(Role.id).filter(Role.name == role_name).scalar()
        assert role_id is not None
        result = User(
            email=f"{label}@api-contract.example.com",
            full_name=f"QA {label}",
            hashed_password="test-only-not-used-for-login",
            role_id=role_id,
            company_id=tenant.id if tenant else None,
            is_active=True,
        )
        db.add(result)
        db.flush()
        ensure_user_membership(db, result)
        return result

    admin, worker, outsider, platform = (
        user("admin", "admin", own),
        user("worker", "viewer", own),
        user("outsider", "admin", other),
        user("platform", "superadmin", None),
    )
    customer = Client(
        company_id=own.id,
        name="API recipient SL",
        client_type="company",
        legal_number="B87654321",
        address="Calle QA 2",
        city="Madrid",
        postal_code="28001",
        province="Madrid",
        country="Spain",
        email="recipient@api-contract.example.com",
    )
    db.add(customer)
    db.flush()
    location = Location(
        name="API QA site",
        address="Calle QA 3",
        city="Madrid",
        postal_code="28001",
        client_id=customer.id,
        owner_company_id=own.id,
        managing_company_id=own.id,
    )
    db.add(location)
    db.flush()
    task = TaskItem(
        company_id=own.id,
        location_id=location.id,
        user_id=worker.id,
        title="API QA shift",
        status="accepted",
        description="",
        unit="hour",
        price=10,
        quantity=1,
        pricing_mode="hourly",
    )
    db.add(task)
    db.commit()
    actors = {
        name: actor
        for name, actor in [
            ("admin", admin),
            ("worker", worker),
            ("outsider", outsider),
            ("platform", platform),
        ]
    }
    headers = {
        name: {
            "Authorization": "Bearer "
            + create_access_token(token_claims(actor))
        }
        for name, actor in actors.items()
    }
    return SimpleNamespace(
        company=own,
        other=other,
        admin=admin,
        worker=worker,
        outsider=outsider,
        platform=platform,
        client=customer,
        location=location,
        task=task,
        headers=headers,
    )
