from sqlalchemy.orm import Session, joinedload

from app.models.company_membership import CompanyMembership
from app.models.client_opportunity import ClientOpportunity, ClientOpportunityActivity


def _opportunity_load_options():
    return (
        joinedload(ClientOpportunity.contact),
        joinedload(ClientOpportunity.owner_membership).joinedload(CompanyMembership.user),
        joinedload(ClientOpportunity.created_by),
    )


def get_for_client(
    db: Session, *, client_id: int, opportunity_id: int
) -> ClientOpportunity | None:
    return (
        db.query(ClientOpportunity)
        .options(*_opportunity_load_options())
        .filter(
            ClientOpportunity.id == opportunity_id,
            ClientOpportunity.client_id == client_id,
        )
        .first()
    )


def list_for_client(db: Session, *, client_id: int) -> list[ClientOpportunity]:
    return (
        db.query(ClientOpportunity)
        .options(*_opportunity_load_options())
        .filter(ClientOpportunity.client_id == client_id)
        .order_by(
            ClientOpportunity.is_active.desc(),
            ClientOpportunity.updated_at.desc(),
            ClientOpportunity.id.desc(),
        )
        .all()
    )


def list_activities(
    db: Session, *, opportunity_id: int
) -> list[ClientOpportunityActivity]:
    return (
        db.query(ClientOpportunityActivity)
        .options(joinedload(ClientOpportunityActivity.created_by))
        .filter(ClientOpportunityActivity.opportunity_id == opportunity_id)
        .order_by(
            ClientOpportunityActivity.happened_at.desc(),
            ClientOpportunityActivity.id.desc(),
        )
        .all()
    )
