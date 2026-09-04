"""Transport routes for a sponsored property-manager portal."""

from datetime import datetime

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveAdmin, ActivePartnerPortal, PartnerPortalPrincipal, get_db
from app.models.user import User
from app.schemas.location import LocationResponse
from app.schemas.partner_portal import (
    PartnerPortalCandidateResponse,
    PartnerPortalGrantCreate,
    PartnerPortalGrantResponse,
    PartnerPortalOverviewResponse,
)
from app.schemas.reservation import ReservationCreate, ReservationResponse, ReservationUpdate
from app.services import audit_service, partner_portal_management_service, partner_portal_service


router = APIRouter()


@router.get("/overview", response_model=PartnerPortalOverviewResponse)
def read_portal_overview(
    db: Session = Depends(get_db),
    principal: PartnerPortalPrincipal = ActivePartnerPortal,
):
    return partner_portal_service.overview(db, grant=principal.grant)


@router.get("/locations", response_model=list[LocationResponse])
def read_portal_locations(
    db: Session = Depends(get_db),
    principal: PartnerPortalPrincipal = ActivePartnerPortal,
):
    return partner_portal_service.list_locations(db, grant=principal.grant)


@router.get("/reservations", response_model=list[ReservationResponse])
def read_portal_reservations(
    location_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
    principal: PartnerPortalPrincipal = ActivePartnerPortal,
):
    return partner_portal_service.list_reservations(
        db,
        grant=principal.grant,
        current_user=principal.user,
        location_id=location_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.post(
    "/reservations",
    response_model=ReservationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_portal_reservation(
    payload: ReservationCreate,
    db: Session = Depends(get_db),
    principal: PartnerPortalPrincipal = ActivePartnerPortal,
):
    return partner_portal_service.create_reservation(
        db,
        grant=principal.grant,
        current_user=principal.user,
        data=payload,
    )


@router.patch("/reservations/{reservation_id}", response_model=ReservationResponse)
def update_portal_reservation(
    reservation_id: int,
    payload: ReservationUpdate,
    db: Session = Depends(get_db),
    principal: PartnerPortalPrincipal = ActivePartnerPortal,
):
    return partner_portal_service.update_reservation(
        db,
        grant=principal.grant,
        current_user=principal.user,
        reservation_id=reservation_id,
        data=payload,
    )


@router.delete(
    "/reservations/{reservation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_portal_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    principal: PartnerPortalPrincipal = ActivePartnerPortal,
) -> None:
    partner_portal_service.delete_reservation(
        db,
        grant=principal.grant,
        current_user=principal.user,
        reservation_id=reservation_id,
    )


@router.get(
    "/collaborations/{collaboration_id}/candidates",
    response_model=list[PartnerPortalCandidateResponse],
)
def read_portal_candidates(
    collaboration_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return partner_portal_management_service.list_portal_candidates(
        db,
        host_user=current_user,
        collaboration_id=collaboration_id,
    )


@router.post(
    "/collaborations/{collaboration_id}/grants",
    response_model=PartnerPortalGrantResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_portal_grant(
    collaboration_id: int,
    payload: PartnerPortalGrantCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    grant = partner_portal_management_service.grant_portal_access(
        db,
        host_user=current_user,
        collaboration_id=collaboration_id,
        partner_user_id=payload.user_id,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="partner_portal.granted",
        entity_type="partner_portal_grant",
        entity_id=grant.id,
        request=request,
        details={"collaboration_id": collaboration_id, "partner_user_id": grant.user_id},
    )
    return grant


@router.delete(
    "/collaborations/{collaboration_id}/grants/{grant_id}",
    response_model=PartnerPortalGrantResponse,
)
def revoke_portal_grant(
    collaboration_id: int,
    grant_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    grant = partner_portal_management_service.revoke_portal_access(
        db,
        host_user=current_user,
        collaboration_id=collaboration_id,
        grant_id=grant_id,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="partner_portal.revoked",
        entity_type="partner_portal_grant",
        entity_id=grant.id,
        request=request,
        details={"collaboration_id": collaboration_id, "partner_user_id": grant.user_id},
    )
    return grant
