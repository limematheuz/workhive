from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from app.models.location import Location
from app.models.company_collaboration import CompanyCollaboration
from app.models.location_company_access import LocationCompanyAccess
from app.models.user import User
from app.schemas.location import LocationCreate, LocationUpdate
from app.repositories import location as location_repo
from app.repositories import client as client_repo
from app.repositories import company as company_repo
from fastapi import HTTPException, status
from app.services import location_access_service
from app.services import location_workspace_service


def _validate_default_service_provider(
    db: Session,
    owner_company_id: int | None,
    provider_company_id: int,
) -> None:
    if owner_company_id is None or provider_company_id == owner_company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select a different company as the service provider",
        )
    if not company_repo.get_company_by_id(db, provider_company_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    collaboration = (
        db.query(CompanyCollaboration)
        .filter(
            CompanyCollaboration.status == "accepted",
            or_(
                and_(
                    CompanyCollaboration.initiator_company_id == owner_company_id,
                    CompanyCollaboration.partner_company_id == provider_company_id,
                ),
                and_(
                    CompanyCollaboration.initiator_company_id == provider_company_id,
                    CompanyCollaboration.partner_company_id == owner_company_id,
                ),
            ),
        )
        .first()
    )
    if not collaboration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected company is not an active collaborator",
        )


def _sync_default_service_provider_access(
    db: Session,
    location: Location,
    previous_provider_id: int | None,
) -> None:
    provider_id = location.default_service_provider_id
    if previous_provider_id and previous_provider_id != provider_id:
        previous_access = (
            db.query(LocationCompanyAccess)
            .filter(
                LocationCompanyAccess.location_id == location.id,
                LocationCompanyAccess.company_id == previous_provider_id,
                LocationCompanyAccess.relationship_type == "default_service_provider",
            )
            .first()
        )
        if previous_access:
            previous_access.relationship_type = "service_provider"

    if provider_id is not None:
        access = (
            db.query(LocationCompanyAccess)
            .filter(
                LocationCompanyAccess.location_id == location.id,
                LocationCompanyAccess.company_id == provider_id,
            )
            .first()
        )
        if access:
            access.relationship_type = "default_service_provider"
            access.can_manage_tasks = True
        else:
            db.add(
                LocationCompanyAccess(
                    location_id=location.id,
                    company_id=provider_id,
                    relationship_type="default_service_provider",
                    can_manage_reservations=False,
                    can_manage_tasks=True,
                    can_view_sensitive=False,
                )
            )


def get_locations(
    db: Session,
    company_id: int | None,
    client_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Location]:
    return location_repo.get_locations_by_client(db, company_id, client_id, skip, limit)


def get_location(db: Session, location_id: int, company_id: int | None) -> Location:
    location = location_repo.get_location_by_id(db, location_id, company_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )
    return location


def get_location_service_providers(
    db: Session,
    current_user: User,
    location_id: int,
):
    location_access_service.require_accessible_location(
        db,
        current_user,
        location_id,
    )
    accesses = (
        db.query(LocationCompanyAccess)
        .filter(
            LocationCompanyAccess.location_id == location_id,
            LocationCompanyAccess.relationship_type.in_(
                ("service_provider", "default_service_provider")
            ),
            LocationCompanyAccess.company_id != current_user.company_id,
        )
        .all()
    )
    providers = [
        access.company
        for access in accesses
        if access.company and access.company.is_active
    ]
    provider_ids = {company.id for company in providers}
    collaborations = (
        db.query(CompanyCollaboration)
        .filter(
            (
                (CompanyCollaboration.initiator_company_id == current_user.company_id)
                | (CompanyCollaboration.partner_company_id == current_user.company_id)
            )
            & (CompanyCollaboration.status == "accepted")
        )
        .all()
    )
    for collaboration in collaborations:
        provider = None
        if (
            collaboration.initiator_company_id == current_user.company_id
            and collaboration.role_type == "service_provider"
        ):
            provider = collaboration.partner
        elif (
            collaboration.partner_company_id == current_user.company_id
            and collaboration.role_type == "property_manager"
        ):
            provider = collaboration.initiator
        if (
            provider
            and provider.is_active
            and provider.id != current_user.company_id
            and provider.id not in provider_ids
        ):
            providers.append(provider)
            provider_ids.add(provider.id)
    return providers


def create_location_in_transaction(
    db: Session, company_id: int | None, location_data: LocationCreate
) -> Location:
    if location_data.client_id is not None:
        client = client_repo.get_client_by_id(
            db, location_data.client_id, company_id
        )
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found or you don't have access",
            )
    location_data.owner_company_id = company_id
    location_data.managing_company_id = company_id

    if location_data.rooms is not None:
        location_data.max_capacity = sum(
            r.double_beds * 2 + r.single_beds * 1 + r.bunk_beds * 2
            for r in location_data.rooms
        )
    else:
        location_data.max_capacity = 0

    provider_id = location_data.default_service_provider_id
    if provider_id is not None:
        _validate_default_service_provider(db, company_id, provider_id)

    location = location_repo.create_location(db, location_data)
    if provider_id is not None:
        db.add(
            LocationCompanyAccess(
                location_id=location.id,
                company_id=provider_id,
                relationship_type="default_service_provider",
                can_manage_reservations=False,
                can_manage_tasks=True,
                can_view_sensitive=False,
            )
        )
    if company_id is not None:
        location_workspace_service.sync_profile(
            db,
            location,
            company_id,
            location_data.profile,
        )
    location_workspace_service.sync_access_profile(
        db,
        location,
        location_data.access,
    )
    location_workspace_service.create_spaces(db, location.id, location_data.spaces)
    return location


def create_location(
    db: Session, company_id: int | None, location_data: LocationCreate
) -> Location:
    try:
        location = create_location_in_transaction(db, company_id, location_data)
        db.commit()
        db.refresh(location)
        return location
    except Exception:
        db.rollback()
        raise


def update_location(
    db: Session, location_id: int, location_update: LocationUpdate, company_id: int | None
) -> Location:
    db_location = location_repo.get_location_by_id(db, location_id, company_id)
    if not db_location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )
    if "client_id" in location_update.model_fields_set and location_update.client_id is not None:
        client = client_repo.get_client_by_id(
            db, location_update.client_id, company_id)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
            )

    if db_location.owner_company_id is None and company_id is not None:
        db_location.owner_company_id = company_id

    if db_location.managing_company_id is None and company_id is not None:
        db_location.managing_company_id = company_id

    previous_provider_id = db_location.default_service_provider_id
    if (
        "default_service_provider_id" in location_update.model_fields_set
        and location_update.default_service_provider_id is not None
    ):
        _validate_default_service_provider(
            db,
            db_location.owner_company_id or company_id,
            location_update.default_service_provider_id,
        )

    if location_update.rooms is not None:
        location_update.max_capacity = sum(
            r.double_beds * 2 + r.single_beds * 1 + r.bunk_beds * 2
            for r in location_update.rooms
        )
        
    try:
        location = location_repo.update_location(db, db_location, location_update)
        if company_id is not None:
            location_workspace_service.sync_profile(
                db,
                location,
                company_id,
                location_update.profile,
            )
        location_workspace_service.sync_access_profile(
            db,
            location,
            location_update.access,
        )
        if "default_service_provider_id" in location_update.model_fields_set:
            _sync_default_service_provider_access(db, location, previous_provider_id)
        db.commit()
        db.refresh(location)
        return location
    except Exception:
        db.rollback()
        raise


def delete_location(db: Session, location_id: int, company_id: int | None) -> Location:
    db_location = location_repo.get_location_by_id(db, location_id, company_id)
    if not db_location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Location not found"
        )
    return location_repo.delete_location(db, db_location)
