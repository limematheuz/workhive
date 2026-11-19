"""Invitation persistence, including company-local duplicate detection."""

from sqlalchemy.orm import Session

from app.models.external_access_grant import ExternalAccessGrant
from app.models.user_invitation import UserInvitation


def pending(db: Session, *, company_id: int, email: str) -> UserInvitation | None:
    return db.query(UserInvitation).filter(
        UserInvitation.company_id == company_id,
        UserInvitation.email == email,
        UserInvitation.status == "pending",
    ).with_for_update().first()


def by_token_hash(db: Session, token_hash: str) -> UserInvitation | None:
    return db.query(UserInvitation).filter(
        UserInvitation.token_hash == token_hash
    ).with_for_update().first()


def accountant_grant(db: Session, *, company_id: int, user_id: int) -> ExternalAccessGrant | None:
    return db.query(ExternalAccessGrant).filter(
        ExternalAccessGrant.company_id == company_id,
        ExternalAccessGrant.user_id == user_id,
        ExternalAccessGrant.access_type == "accountant",
    ).first()
