"""Assemble the fictional Enterprise tenant used by local product demos."""

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.company import Company
from app.models.location import Location
from scripts.demo_enterprise_identity import create_demo_members
from scripts.demo_enterprise_organization import create_demo_organization


def _create_demo_locations(
    db: Session,
    *,
    company: Company,
    operations_department_id: int,
    north_team_id: int,
    south_team_id: int,
) -> None:
    client = Client(
        company_id=company.id,
        name="Cliente ficticio del Norte, S.L.",
        client_type="company",
        legal_number="DEMO-CLIENTE-001",
        address="Avenida de Ejemplo 10",
        city="Ciudad de Ejemplo",
        postal_code="00001",
        country="España",
        email="cliente@enterprise-demo.invalid",
    )
    db.add(client)
    db.flush()
    db.add_all(
        [
            Location(
                name="Sede ficticia Norte",
                address="Avenida de Ejemplo 12",
                city="Ciudad de Ejemplo",
                postal_code="00001",
                client_id=client.id,
                owner_company_id=company.id,
                managing_company_id=company.id,
                department_id=operations_department_id,
                team_id=north_team_id,
            ),
            Location(
                name="Sede ficticia Sur",
                address="Calle de Ejemplo 20",
                city="Ciudad de Ejemplo",
                postal_code="00002",
                client_id=client.id,
                owner_company_id=company.id,
                managing_company_id=company.id,
                department_id=operations_department_id,
                team_id=south_team_id,
            ),
        ]
    )
    db.commit()


def seed_demo_enterprise(db: Session, *, password: str) -> Company:
    """Populate an empty local database with anonymous, coherent demo data."""
    members = create_demo_members(db, password=password)
    organization = create_demo_organization(db, members=members)
    _create_demo_locations(
        db,
        company=members.company,
        operations_department_id=organization.operations_department_id,
        north_team_id=organization.north_team_id,
        south_team_id=organization.south_team_id,
    )
    db.refresh(members.company)
    return members.company
