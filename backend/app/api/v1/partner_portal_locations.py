"""Location transport endpoints exposed by the sponsored partner portal."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import ActivePartnerPortal, PartnerPortalPrincipal, get_db
from app.schemas.location import LocationResponse
from app.schemas.location_workspace import (
    LocationCatalogSuggestionRequest,
    LocationCatalogSuggestionResponse,
)
from app.schemas.partner_portal import (
    PartnerPortalLocationCreate,
    PartnerPortalLocationUpdate,
)
from app.services import partner_portal_location_service


router = APIRouter()


@router.get("/locations", response_model=list[LocationResponse])
def read_portal_locations(
    db: Session = Depends(get_db),
    principal: PartnerPortalPrincipal = ActivePartnerPortal,
):
    return partner_portal_location_service.list_locations(db, grant=principal.grant)


@router.get("/location-catalog")
def read_portal_location_catalog(
    principal: PartnerPortalPrincipal = ActivePartnerPortal,
):
    del principal
    return partner_portal_location_service.location_catalog()


@router.post("/location-space-suggestions", response_model=LocationCatalogSuggestionResponse)
def read_portal_location_space_suggestions(
    payload: LocationCatalogSuggestionRequest,
    principal: PartnerPortalPrincipal = ActivePartnerPortal,
):
    del principal
    return partner_portal_location_service.suggest_location_spaces(
        payload.site_type,
        payload.attributes,
    )


@router.post(
    "/locations",
    response_model=LocationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_portal_location(
    payload: PartnerPortalLocationCreate,
    db: Session = Depends(get_db),
    principal: PartnerPortalPrincipal = ActivePartnerPortal,
):
    return partner_portal_location_service.create_location(
        db,
        grant=principal.grant,
        data=payload,
    )


@router.patch("/locations/{location_id}", response_model=LocationResponse)
def update_portal_location(
    location_id: int,
    payload: PartnerPortalLocationUpdate,
    db: Session = Depends(get_db),
    principal: PartnerPortalPrincipal = ActivePartnerPortal,
):
    return partner_portal_location_service.update_location(
        db,
        grant=principal.grant,
        location_id=location_id,
        data=payload,
    )


@router.delete("/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portal_location(
    location_id: int,
    db: Session = Depends(get_db),
    principal: PartnerPortalPrincipal = ActivePartnerPortal,
) -> None:
    partner_portal_location_service.delete_location(
        db,
        grant=principal.grant,
        location_id=location_id,
    )
