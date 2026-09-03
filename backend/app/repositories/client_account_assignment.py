from sqlalchemy.orm import Session, joinedload

from app.models.client import Client
from app.models.client_account_assignment import ClientAccountAssignment
from app.models.company_membership import CompanyMembership


def _assignment_load_options():
    return (
        joinedload(ClientAccountAssignment.company_membership).joinedload(
            CompanyMembership.user
        ),
        joinedload(ClientAccountAssignment.assigned_by),
    )


def get_current_for_client(
    db: Session,
    *,
    company_id: int,
    client_id: int,
) -> ClientAccountAssignment | None:
    return (
        db.query(ClientAccountAssignment)
        .options(*_assignment_load_options())
        .filter(
            ClientAccountAssignment.company_id == company_id,
            ClientAccountAssignment.client_id == client_id,
            ClientAccountAssignment.ended_at.is_(None),
        )
        .first()
    )


def get_client_for_update(
    db: Session,
    *,
    company_id: int,
    client_id: int,
) -> Client | None:
    return (
        db.query(Client)
        .filter(Client.company_id == company_id, Client.id == client_id)
        .with_for_update()
        .first()
    )


def list_current_for_membership(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
) -> list[ClientAccountAssignment]:
    return (
        db.query(ClientAccountAssignment)
        .options(
            joinedload(ClientAccountAssignment.client),
            *_assignment_load_options(),
        )
        .filter(
            ClientAccountAssignment.company_id == company_id,
            ClientAccountAssignment.company_membership_id == membership_id,
            ClientAccountAssignment.ended_at.is_(None),
        )
        .order_by(
            ClientAccountAssignment.started_at.desc(),
            ClientAccountAssignment.id.desc(),
        )
        .all()
    )
