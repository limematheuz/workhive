from fastapi import Depends, APIRouter, status, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, ActiveUser, ActiveAdmin, ActiveManagerOrAdmin
from app.schemas.location import LocationCreate, LocationUpdate, LocationResponse
from app.schemas.company import CompanyPartnerResponse
from app.schemas.user import UserResponse
from app.services import location_service
from app.models.user import User
from app.services import location_access_service
from app.services.user_scope import is_platform_superadmin, scoped_company_id

router = APIRouter()


@router.get("/", response_model=list[LocationResponse])
def read_locations(
    client_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    if is_platform_superadmin(current_user):
        return []
    company_id = scoped_company_id(current_user)
    locations = location_service.get_locations(
        db, company_id, client_id, skip, limit
    )
    res = []
    for loc in locations:
        resp = LocationResponse.model_validate(loc)
        resp.can_manage_reservations = location_access_service.has_location_capability(
            db, current_user, loc, "can_manage_reservations"
        )
        resp.can_manage_tasks = location_access_service.has_location_capability(
            db, current_user, loc, "can_manage_tasks"
        )
        resp.shared_companies = [access.company_id for access in loc.company_access]
        res.append(resp)
    return res


@router.get("/{location_id}", response_model=LocationResponse)
def read_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    company_id = scoped_company_id(current_user)
    loc = location_service.get_location(db, location_id, company_id)
    resp = LocationResponse.model_validate(loc)
    resp.can_manage_reservations = location_access_service.has_location_capability(
        db, current_user, loc, "can_manage_reservations"
    )
    resp.can_manage_tasks = location_access_service.has_location_capability(
        db, current_user, loc, "can_manage_tasks"
    )
    resp.shared_companies = [access.company_id for access in loc.company_access]
    return resp


@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(
    location_data: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    company_id = scoped_company_id(current_user)
    return location_service.create_location(db, company_id, location_data)


@router.patch("/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int,
    location_update: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    company_id = scoped_company_id(current_user)
    return location_service.update_location(
        db, location_id, location_update, company_id
    )


@router.delete("/{location_id}", response_model=LocationResponse)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin
):
    location_access_service.require_location_owner(db, current_user, location_id)
    company_id = scoped_company_id(current_user)
    return location_service.delete_location(db, location_id, company_id)


@router.get("/{location_id}/users", response_model=list[UserResponse])
def read_location_users(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    location_access_service.require_accessible_location(db, current_user, location_id)
    
    from app.models.location import Location
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
        
    company_id = current_user.company_id
    if not company_id:
        return []
        
    from app.models.user import User as DBUser
    users = db.query(DBUser).filter(
        DBUser.company_id == company_id,
        DBUser.is_active.is_(True)
    ).all()
    
    return users


@router.get(
    "/{location_id}/service-providers",
    response_model=list[CompanyPartnerResponse],
)
def read_location_service_providers(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    from app.models.location_company_access import LocationCompanyAccess
    from app.models.company_collaboration import CompanyCollaboration
    location_access_service.require_accessible_location(db, current_user, location_id)

    accesses = db.query(LocationCompanyAccess).filter(
        LocationCompanyAccess.location_id == location_id,
        LocationCompanyAccess.relationship_type.in_(
            ("service_provider", "default_service_provider")
        ),
        LocationCompanyAccess.company_id != current_user.company_id,
    ).all()

    provider_companies = [
        access.company
        for access in accesses
        if access.company and access.company.is_active
    ]
    provider_company_ids = {c.id for c in provider_companies}

    collabs = db.query(CompanyCollaboration).filter(
        (
            (CompanyCollaboration.initiator_company_id == current_user.company_id)
            | (CompanyCollaboration.partner_company_id == current_user.company_id)
        )
        & (CompanyCollaboration.status == "accepted")
    ).all()

    for collab in collabs:
        provider_company = None
        if (
            collab.initiator_company_id == current_user.company_id
            and collab.role_type == "service_provider"
        ):
            provider_company = collab.partner
        elif (
            collab.partner_company_id == current_user.company_id
            and collab.role_type == "property_manager"
        ):
            provider_company = collab.initiator

        if (
            provider_company
            and provider_company.is_active
            and provider_company.id != current_user.company_id
            and provider_company.id not in provider_company_ids
        ):
            provider_companies.append(provider_company)
            provider_company_ids.add(provider_company.id)

    return provider_companies
