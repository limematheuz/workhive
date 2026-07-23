from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.company import Company
from app.repositories import client as client_repo


def find_company_client(
    db: Session,
    *,
    owner_company_id: int,
    partner_company: Company,
) -> Client | None:
    client = client_repo.get_client_by_legal_number(
        db,
        owner_company_id,
        partner_company.tax_id,
    )
    if client is not None:
        return client
    return (
        db.query(Client)
        .filter(
            Client.company_id == owner_company_id,
            Client.name == partner_company.name,
        )
        .first()
    )


def ensure_company_as_client(
    db: Session,
    *,
    owner_company_id: int,
    partner_company: Company,
) -> Client:
    client = find_company_client(
        db,
        owner_company_id=owner_company_id,
        partner_company=partner_company,
    )
    if client is None:
        client = Client(
            company_id=owner_company_id,
            name=partner_company.name,
            client_type="company",
            legal_number=partner_company.tax_id,
            address=partner_company.address or "Address pending",
            city=partner_company.city or "",
            province=partner_company.province,
            postal_code=partner_company.postal_code or "",
            country="Spain",
            phone=partner_company.phone,
            email=partner_company.contact_email or partner_company.email,
            is_active=True,
        )
        db.add(client)
        db.flush()
        return client

    client.name = partner_company.name
    client.client_type = "company"
    client.legal_number = partner_company.tax_id
    client.address = partner_company.address or client.address
    client.city = partner_company.city or client.city
    client.province = partner_company.province or client.province
    client.postal_code = partner_company.postal_code or client.postal_code
    client.phone = partner_company.phone or client.phone
    client.email = partner_company.contact_email or partner_company.email or client.email
    client.is_active = True
    db.add(client)
    db.flush()
    return client


def ensure_collaboration_clients(
    db: Session,
    company_a: Company,
    company_b: Company,
) -> None:
    ensure_company_as_client(
        db,
        owner_company_id=company_a.id,
        partner_company=company_b,
    )
    ensure_company_as_client(
        db,
        owner_company_id=company_b.id,
        partner_company=company_a,
    )
