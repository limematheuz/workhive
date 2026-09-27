"""Create the fictional Enterprise company and its internal identities."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.role import Role
from app.models.user import User
from app.services import company_entitlement_service, organization_bootstrap_service
from app.services.entitlement_catalog import seed_default_plan_catalog

DEMO_COMPANY_NAME = "WorkHive Enterprise Demo"
DEMO_COMPANY_TAX_ID = "DEMO-ENTERPRISE-001"


@dataclass(frozen=True)
class DemoMembers:
    company: Company
    administrator: User
    operations_lead: User
    commercial_user: User
    finance_user: User
    field_user: User
    administrator_membership: CompanyMembership
    operations_membership: CompanyMembership
    commercial_membership: CompanyMembership
    finance_membership: CompanyMembership
    field_membership: CompanyMembership


def _role(db: Session, *, name: str, description: str) -> Role:
    role = db.query(Role).filter(Role.name == name).one_or_none()
    if role is None:
        role = Role(name=name, description=description, is_active=True)
        db.add(role)
        db.flush()
    return role


def _demo_user(
    *,
    email: str,
    full_name: str,
    role_id: int,
    company_id: int,
    password: str,
    now: datetime,
) -> User:
    return User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        role_id=role_id,
        company_id=company_id,
        is_active=True,
        email_verified_at=now,
    )


def create_demo_members(db: Session, *, password: str) -> DemoMembers:
    """Create an active Enterprise subscription and fictional internal users."""
    now = datetime.now(timezone.utc)
    seed_default_plan_catalog(db)
    roles = {
        "admin": _role(
            db,
            name="admin",
            description="Local demo company administrator",
        ),
        "manager": _role(
            db,
            name="manager",
            description="Local demo company manager",
        ),
        "worker": _role(
            db,
            name="viewer",
            description="Local demo company worker",
        ),
    }
    company = Company(
        name=DEMO_COMPANY_NAME,
        tax_id=DEMO_COMPANY_TAX_ID,
        address="Calle de Ejemplo 1",
        postal_code="00000",
        city="Ciudad de Ejemplo",
        province="Provincia de Ejemplo",
        phone="000000000",
        email="administracion@enterprise-demo.invalid",
        operating_model="service_provider",
        onboarding_completed=True,
        subscription_plan="mega",
        subscription_status="active",
    )
    db.add(company)
    db.flush()
    users = {
        "administrator": _demo_user(
            email="administrador@enterprise-demo.invalid",
            full_name="Administrador de demostración",
            role_id=roles["admin"].id,
            company_id=company.id,
            password=password,
            now=now,
        ),
        "operations": _demo_user(
            email="operaciones@enterprise-demo.invalid",
            full_name="Responsable de operaciones",
            role_id=roles["manager"].id,
            company_id=company.id,
            password=password,
            now=now,
        ),
        "commercial": _demo_user(
            email="comercial@enterprise-demo.invalid",
            full_name="Comercial de demostración",
            role_id=roles["worker"].id,
            company_id=company.id,
            password=password,
            now=now,
        ),
        "finance": _demo_user(
            email="finanzas@enterprise-demo.invalid",
            full_name="Finanzas de demostración",
            role_id=roles["worker"].id,
            company_id=company.id,
            password=password,
            now=now,
        ),
        "field": _demo_user(
            email="campo@enterprise-demo.invalid",
            full_name="Equipo de campo",
            role_id=roles["worker"].id,
            company_id=company.id,
            password=password,
            now=now,
        ),
    }
    db.add_all(users.values())
    db.flush()
    company_entitlement_service.synchronize_company_subscription(
        db,
        company,
        reason="demo.enterprise_seeded",
        actor_user_id=users["administrator"].id,
        now=now,
        commercial_terms=company_entitlement_service.CommercialSubscriptionTerms(
            billing_interval="monthly",
            amount_cents=24900,
            currency="EUR",
            tax_behavior="exclusive",
            effective_at=now,
        ),
    )
    memberships = {
        key: organization_bootstrap_service.ensure_user_membership(db, user)
        for key, user in users.items()
    }
    if any(membership is None for membership in memberships.values()):
        raise RuntimeError("Demo users must have company memberships")
    return DemoMembers(
        company=company,
        administrator=users["administrator"],
        operations_lead=users["operations"],
        commercial_user=users["commercial"],
        finance_user=users["finance"],
        field_user=users["field"],
        administrator_membership=memberships["administrator"],
        operations_membership=memberships["operations"],
        commercial_membership=memberships["commercial"],
        finance_membership=memberships["finance"],
        field_membership=memberships["field"],
    )
