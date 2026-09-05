"""Storage queries for host-sponsored property-manager invitations."""

from sqlalchemy.orm import Session

from app.models.sponsored_partner_invitation import SponsoredPartnerInvitation


def find_by_token_hash(
    db: Session,
    *,
    token_hash: str,
) -> SponsoredPartnerInvitation | None:
    return (
        db.query(SponsoredPartnerInvitation)
        .filter(SponsoredPartnerInvitation.token_hash == token_hash)
        .first()
    )


def find_pending_by_host_email(
    db: Session,
    *,
    host_company_id: int,
    email: str,
) -> SponsoredPartnerInvitation | None:
    return (
        db.query(SponsoredPartnerInvitation)
        .filter(
            SponsoredPartnerInvitation.host_company_id == host_company_id,
            SponsoredPartnerInvitation.email == email,
            SponsoredPartnerInvitation.status == "pending",
        )
        .first()
    )


def find_pending_by_email(
    db: Session,
    *,
    email: str,
) -> SponsoredPartnerInvitation | None:
    return (
        db.query(SponsoredPartnerInvitation)
        .filter(
            SponsoredPartnerInvitation.email == email,
            SponsoredPartnerInvitation.status == "pending",
        )
        .first()
    )


def list_sent(
    db: Session,
    *,
    host_company_id: int,
) -> list[SponsoredPartnerInvitation]:
    return (
        db.query(SponsoredPartnerInvitation)
        .filter(SponsoredPartnerInvitation.host_company_id == host_company_id)
        .order_by(
            SponsoredPartnerInvitation.created_at.desc(),
            SponsoredPartnerInvitation.id.desc(),
        )
        .all()
    )


def find_sent_by_id(
    db: Session,
    *,
    host_company_id: int,
    invitation_id: int,
) -> SponsoredPartnerInvitation | None:
    return (
        db.query(SponsoredPartnerInvitation)
        .filter(
            SponsoredPartnerInvitation.id == invitation_id,
            SponsoredPartnerInvitation.host_company_id == host_company_id,
        )
        .first()
    )
