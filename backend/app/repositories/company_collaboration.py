from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.company import Company
from app.models.company_collaboration import CompanyCollaboration


def get_collaboration_by_id(db: Session, collab_id: int) -> CompanyCollaboration | None:
    return db.query(CompanyCollaboration).filter(CompanyCollaboration.id == collab_id).first()


def get_collaboration(db: Session, company_a_id: int, company_b_id: int) -> CompanyCollaboration | None:
    return (
        db.query(CompanyCollaboration)
        .filter(
            or_(
                (CompanyCollaboration.initiator_company_id == company_a_id)
                & (CompanyCollaboration.partner_company_id == company_b_id),
                (CompanyCollaboration.initiator_company_id == company_b_id)
                & (CompanyCollaboration.partner_company_id == company_a_id),
            )
        )
        .first()
    )


def list_collaborations(db: Session, company_id: int, status: str = "accepted") -> list[CompanyCollaboration]:
    return (
        db.query(CompanyCollaboration)
        .filter(
            CompanyCollaboration.status == status,
            or_(
                and_(
                    CompanyCollaboration.initiator_company_id == company_id,
                    CompanyCollaboration.partner.has(Company.is_active.is_(True)),
                ),
                and_(
                    CompanyCollaboration.partner_company_id == company_id,
                    CompanyCollaboration.initiator.has(Company.is_active.is_(True)),
                ),
            ),
        )
        .all()
    )


def list_partner_companies(db: Session, company_id: int) -> list[Company]:
    collaborations = list_collaborations(db, company_id)
    partners: dict[int, Company] = {}
    for collaboration in collaborations:
        partner = (
            collaboration.partner
            if collaboration.initiator_company_id == company_id
            else collaboration.initiator
        )
        if partner.is_active:
            partners[partner.id] = partner
    return sorted(partners.values(), key=lambda company: company.name.casefold())


def list_pending_requests(db: Session, company_id: int) -> list[CompanyCollaboration]:
    # Pending requests RECEIVED by this company (so we are the partner_company_id)
    return (
        db.query(CompanyCollaboration)
        .filter(
            CompanyCollaboration.partner_company_id == company_id,
            CompanyCollaboration.status == "pending",
            CompanyCollaboration.initiator.has(Company.is_active.is_(True)),
        )
        .all()
    )


def list_sent_requests(db: Session, company_id: int) -> list[CompanyCollaboration]:
    # Pending requests SENT by this company (so we are the initiator_company_id)
    return (
        db.query(CompanyCollaboration)
        .filter(
            CompanyCollaboration.initiator_company_id == company_id,
            CompanyCollaboration.status == "pending",
            CompanyCollaboration.partner.has(Company.is_active.is_(True)),
        )
        .all()
    )


def create_collaboration(
    db: Session, initiator_id: int, partner_id: int, role_type: str = "service_provider", status: str = "pending", token: str | None = None
) -> CompanyCollaboration:
    db_collab = CompanyCollaboration(
        initiator_company_id=initiator_id,
        partner_company_id=partner_id,
        status=status,
        role_type=role_type,
        token=token
    )
    db.add(db_collab)
    db.commit()
    db.refresh(db_collab)
    return db_collab


def update_status(db: Session, collab: CompanyCollaboration, status: str) -> CompanyCollaboration:
    collab.status = status
    db.add(collab)
    db.commit()
    db.refresh(collab)
    return collab


def delete_collaboration(db: Session, collab: CompanyCollaboration) -> None:
    db.delete(collab)
