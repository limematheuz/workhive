import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.user import User
from app.models.company import Company
from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.repositories import company_collaboration as collab_repo
from app.models.company_collaboration import CompanyCollaboration
from app.services.company_client_service import ensure_collaboration_clients


def get_or_generate_partner_code(db: Session, company_id: int) -> str:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if not company.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inactive companies cannot use partner codes",
        )
    
    if company.partner_code:
        normalized_code = company.partner_code.strip().upper()
        if normalized_code != company.partner_code:
            company.partner_code = normalized_code
            db.add(company)
            db.commit()
            db.refresh(company)
        return normalized_code
        
    # Generate a unique partner code
    clean_name = "".join(c for c in company.name if c.isalnum()).upper()[:4] or "COMP"
    random_part = uuid.uuid4().hex[:6].upper()
    code = f"WH-{clean_name}-{random_part}"
    
    # Ensure uniqueness
    while db.query(Company).filter(Company.partner_code == code).first() is not None:
        random_part = uuid.uuid4().hex[:6].upper()
        code = f"WH-{clean_name}-{random_part}"
        
    company.partner_code = code
    db.add(company)
    db.commit()
    db.refresh(company)
    return code


def send_collaboration_request(
    db: Session, current_user: User, partner_code: str, role_type: str = "service_provider"
) -> CompanyCollaboration:
    if current_user.role.name not in {"admin", "manager"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators or managers can initiate collaborations",
        )
        
    normalized_code = partner_code.strip().upper()
    if not normalized_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Partner code is required",
        )

    # Partner codes are case-insensitive and ignore surrounding whitespace.
    partner_company = db.query(Company).filter(
        Company.partner_code == normalized_code,
        Company.is_active.is_(True),
    ).first()
    if not partner_company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No company found with the provided partner code",
        )
    own_company = db.query(Company).filter(
        Company.id == current_user.company_id,
        Company.is_active.is_(True),
    ).first()
    if not own_company:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your company is inactive or unavailable",
        )
        
    if partner_company.id == current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot collaborate with your own company",
        )
        
    # Check if a collaboration already exists
    existing = collab_repo.get_collaboration(db, current_user.company_id, partner_company.id)
    if existing:
        if existing.status == "accepted":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You are already collaborating with this company",
            )
        elif existing.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A collaboration request is already pending between your companies",
            )
        else:
            # If rejected, allow re-requesting by resetting status
            existing.status = "pending"
            existing.initiator_company_id = current_user.company_id
            existing.partner_company_id = partner_company.id
            existing.role_type = role_type
            db.add(existing)
            db.commit()
            db.refresh(existing)
            return existing
            
    return collab_repo.create_collaboration(
        db, current_user.company_id, partner_company.id, role_type=role_type, status="pending"
    )


def accept_collaboration_request(db: Session, current_user: User, request_id: int) -> CompanyCollaboration:
    if current_user.role.name not in {"admin", "manager"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators or managers can accept collaboration requests",
        )
        
    collab = collab_repo.get_collaboration_by_id(db, request_id)
    if not collab or collab.partner_company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaboration request not found",
        )
        
    if collab.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This request is no longer pending",
        )
        
    collab.status = "accepted"
    ensure_collaboration_clients(db, collab.initiator, collab.partner)
    db.add(collab)
    db.commit()
    db.refresh(collab)
    return collab


def reject_collaboration_request(db: Session, current_user: User, request_id: int) -> CompanyCollaboration:
    if current_user.role.name not in {"admin", "manager"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators or managers can reject collaboration requests",
        )
        
    collab = collab_repo.get_collaboration_by_id(db, request_id)
    if not collab or collab.partner_company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaboration request not found",
        )
        
    if collab.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This request is no longer pending",
        )
        
    return collab_repo.update_status(db, collab, "rejected")


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
