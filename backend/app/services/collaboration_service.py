from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.user import User
from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.repositories import company_collaboration as collab_repo


def unlink_collaboration(db: Session, current_user: User, collab_id: int) -> None:
    if current_user.role.name not in {"admin", "manager"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators or managers can unlink collaborations",
        )
        
    collab = collab_repo.get_collaboration_by_id(db, collab_id)
    if not collab or current_user.company_id not in {collab.initiator_company_id, collab.partner_company_id}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaboration not found",
        )
        
    company_a_id = collab.initiator_company_id
    company_b_id = collab.partner_company_id

    locations_with_default = db.query(Location).filter(
        or_(
            (Location.owner_company_id == company_a_id)
            & (Location.default_service_provider_id == company_b_id),
            (Location.owner_company_id == company_b_id)
            & (Location.default_service_provider_id == company_a_id),
        )
    ).all()
    for location in locations_with_default:
        location.default_service_provider_id = None

    access_to_delete = db.query(LocationCompanyAccess).join(Location).filter(
        or_(
            (LocationCompanyAccess.company_id == company_b_id) & (Location.owner_company_id == company_a_id),
            (LocationCompanyAccess.company_id == company_a_id) & (Location.owner_company_id == company_b_id)
        )
    ).all()
    
    for access in access_to_delete:
        db.delete(access)
        
    collab_repo.delete_collaboration(db, collab)
    db.commit()
