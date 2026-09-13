"""Persistence queries for customer portal invitations."""

from sqlalchemy.orm import Session

from app.models.client_portal_invitation import ClientPortalInvitation


def find_by_token_hash(db: Session, *, token_hash: str) -> ClientPortalInvitation | None:
    return db.query(ClientPortalInvitation).filter(ClientPortalInvitation.token_hash == token_hash).one_or_none()


def find_pending_for_client_email(
    db: Session,
    *,
    company_id: int,
    client_id: int,
    email: str,
) -> ClientPortalInvitation | None:
    return (
        db.query(ClientPortalInvitation)
        .filter(
            ClientPortalInvitation.company_id == company_id,
            ClientPortalInvitation.client_id == client_id,
            ClientPortalInvitation.email == email,
            ClientPortalInvitation.status == "pending",
        )
        .one_or_none()
    )


def list_for_client(db: Session, *, company_id: int, client_id: int) -> list[ClientPortalInvitation]:
    return (
        db.query(ClientPortalInvitation)
        .filter(
            ClientPortalInvitation.company_id == company_id,
            ClientPortalInvitation.client_id == client_id,
        )
        .order_by(ClientPortalInvitation.created_at.desc(), ClientPortalInvitation.id.desc())
        .all()
    )


def find_for_client(
    db: Session,
    *,
    company_id: int,
    client_id: int,
    invitation_id: int,
) -> ClientPortalInvitation | None:
    return (
        db.query(ClientPortalInvitation)
        .filter(
            ClientPortalInvitation.id == invitation_id,
            ClientPortalInvitation.company_id == company_id,
            ClientPortalInvitation.client_id == client_id,
        )
        .one_or_none()
    )
