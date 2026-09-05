from fastapi import HTTPException, status
from sqlalchemy import and_, or_
from app.models.company_collaboration import CompanyCollaboration
from app.repositories import company as company_repo
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess


def sync_default_service_provider_access(
    db: Session,
    location: Location,
    previous_provider_id: int | None,
) -> None:
    """Keep the managed-company access record aligned with the default provider."""

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

    if provider_id is None:
        return
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
        return
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


def validate_default_service_provider(
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
