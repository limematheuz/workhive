"""Scoped persistence queries for the customer portal."""

from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.models.client_portal_grant import ClientPortalGrant
from app.models.invoice import Invoice
from app.models.quote import Quote
from app.models.service_contract import ServiceContract, ServiceContractLocation, ServiceContractLocationZone


def _active_grant_filters(now: datetime):
    return (
        ClientPortalGrant.status == "active",
        or_(ClientPortalGrant.expires_at.is_(None), ClientPortalGrant.expires_at > now),
    )


def list_active_grants_for_user(db: Session, *, user_id: int, now: datetime) -> list[ClientPortalGrant]:
    return (
        db.query(ClientPortalGrant)
        .options(
            selectinload(ClientPortalGrant.company),
            selectinload(ClientPortalGrant.client),
        )
        .filter(ClientPortalGrant.user_id == user_id, *_active_grant_filters(now))
        .order_by(ClientPortalGrant.company_id.asc(), ClientPortalGrant.client_id.asc(), ClientPortalGrant.id.asc())
        .all()
    )


def get_active_grant_for_user(
    db: Session,
    *,
    grant_id: int,
    user_id: int,
    now: datetime,
) -> ClientPortalGrant | None:
    return (
        db.query(ClientPortalGrant)
        .options(
            selectinload(ClientPortalGrant.company),
            selectinload(ClientPortalGrant.client),
        )
        .filter(
            ClientPortalGrant.id == grant_id,
            ClientPortalGrant.user_id == user_id,
            *_active_grant_filters(now),
        )
        .one_or_none()
    )


def get_grant_for_client_user(
    db: Session,
    *,
    company_id: int,
    client_id: int,
    user_id: int,
) -> ClientPortalGrant | None:
    return (
        db.query(ClientPortalGrant)
        .filter(
            ClientPortalGrant.company_id == company_id,
            ClientPortalGrant.client_id == client_id,
            ClientPortalGrant.user_id == user_id,
        )
        .one_or_none()
    )


def list_grants_for_client(
    db: Session,
    *,
    company_id: int,
    client_id: int,
) -> list[ClientPortalGrant]:
    return (
        db.query(ClientPortalGrant)
        .options(selectinload(ClientPortalGrant.user))
        .filter(
            ClientPortalGrant.company_id == company_id,
            ClientPortalGrant.client_id == client_id,
        )
        .order_by(ClientPortalGrant.created_at.desc(), ClientPortalGrant.id.desc())
        .all()
    )


def get_grant_for_client(
    db: Session,
    *,
    company_id: int,
    client_id: int,
    grant_id: int,
) -> ClientPortalGrant | None:
    return (
        db.query(ClientPortalGrant)
        .filter(
            ClientPortalGrant.id == grant_id,
            ClientPortalGrant.company_id == company_id,
            ClientPortalGrant.client_id == client_id,
        )
        .one_or_none()
    )


def list_invoices(db: Session, *, grant: ClientPortalGrant) -> list[Invoice]:
    return (
        db.query(Invoice)
        .options(selectinload(Invoice.items))
        .filter(
            Invoice.company_id == grant.company_id,
            Invoice.client_id == grant.client_id,
            Invoice.status.in_(("issued", "paid", "overdue", "cancelled")),
            Invoice.is_active.is_(True),
        )
        .order_by(Invoice.issue_date.desc(), Invoice.id.desc())
        .all()
    )


def get_invoice(db: Session, *, grant: ClientPortalGrant, invoice_id: int) -> Invoice | None:
    return (
        db.query(Invoice)
        .options(selectinload(Invoice.items))
        .filter(
            Invoice.id == invoice_id,
            Invoice.company_id == grant.company_id,
            Invoice.client_id == grant.client_id,
            Invoice.status.in_(("issued", "paid", "overdue", "cancelled")),
            Invoice.is_active.is_(True),
        )
        .one_or_none()
    )


def list_quotes(db: Session, *, grant: ClientPortalGrant) -> list[Quote]:
    return (
        db.query(Quote)
        .options(selectinload(Quote.items))
        .filter(
            Quote.company_id == grant.company_id,
            Quote.client_id == grant.client_id,
            Quote.status.in_(("sent", "accepted", "rejected", "expired")),
            Quote.is_active.is_(True),
        )
        .order_by(Quote.created_at.desc(), Quote.id.desc())
        .all()
    )


def list_contracts(db: Session, *, grant: ClientPortalGrant) -> list[ServiceContract]:
    return (
        db.query(ServiceContract)
        .options(
            selectinload(ServiceContract.service_lines),
            selectinload(ServiceContract.covered_locations).selectinload(ServiceContractLocation.location),
            selectinload(ServiceContract.covered_locations)
            .selectinload(ServiceContractLocation.covered_zones)
            .selectinload(ServiceContractLocationZone.zone),
        )
        .filter(
            ServiceContract.company_id == grant.company_id,
            ServiceContract.client_id == grant.client_id,
            ServiceContract.status.in_(("active", "terminated")),
        )
        .order_by(ServiceContract.created_at.desc(), ServiceContract.id.desc())
        .all()
    )
