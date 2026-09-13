"""API-key reservation commands constrained to one company and one location."""

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.reservation import Reservation
from app.repositories import reservation as reservation_repo
from app.schemas.public_api import PublicReservationUpsert
from app.schemas.reservation import ReservationCreate, ReservationUpdate
from app.services import reservation_service
from app.services.entitlement_service import require_company_feature
from app.services.reservation_mutation_access import ReservationMutationAccess


PLANNING_FEATURE_CODE = "features.planning"


@dataclass(frozen=True)
class IntegrationReservationActor:
    """Minimal actor used only after API-key authentication has resolved a company."""

    company_id: int
    id: int | None = None


def _access(company_id: int) -> ReservationMutationAccess:
    return ReservationMutationAccess(
        planning_company_id=company_id,
        allow_integration_company=True,
    )


def _response(reservation: Reservation) -> dict:
    return {
        "id": reservation.id,
        "location_id": reservation.location_id,
        "check_in_at": reservation.check_in_at,
        "check_out_at": reservation.check_out_at,
        "guest_count": reservation.guest_count,
        "stay_type": reservation.stay_type,
        "status": reservation.status,
        "source": reservation.source,
        "external_reference": reservation.external_reference,
        "cleaning_required": reservation.cleaning_required,
        "cleaning_scheduled_at": reservation.cleaning_scheduled_at,
        "updated_at": reservation.updated_at,
    }


def _create_payload(
    payload: PublicReservationUpsert, *, source: str, external_reference: str
) -> ReservationCreate:
    return ReservationCreate(
        **payload.model_dump(),
        source=source,
        external_reference=external_reference,
    )


def _update_payload(payload: PublicReservationUpsert) -> ReservationUpdate:
    return ReservationUpdate(**payload.model_dump())


def upsert_reservation(
    db: Session,
    *,
    company_id: int,
    source: str,
    external_reference: str,
    payload: PublicReservationUpsert,
) -> tuple[dict, bool]:
    """Create or replace one external reservation by its stable source reference."""

    require_company_feature(db, company_id=company_id, code=PLANNING_FEATURE_CODE)
    actor = IntegrationReservationActor(company_id=company_id)
    access = _access(company_id)
    existing = reservation_repo.get_by_external_reference(
        db,
        owner_company_id=company_id,
        source=source,
        external_reference=external_reference,
    )
    if existing is not None:
        if existing.location_id != payload.location_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An external reservation reference cannot move locations",
            )
        reservation = reservation_service.update_reservation(
            db,
            actor,
            existing.id,
            _update_payload(payload),
            access=access,
        )
        return _response(reservation), False
    if payload.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cannot cancel an unknown external reservation",
        )
    try:
        reservation = reservation_service.create_reservation(
            db,
            actor,
            _create_payload(payload, source=source, external_reference=external_reference),
            access=access,
        )
    except IntegrityError:
        # The uniqueness constraint makes a concurrent retry converge on the
        # reservation already created by the other request.
        existing = reservation_repo.get_by_external_reference(
            db,
            owner_company_id=company_id,
            source=source,
            external_reference=external_reference,
        )
        if existing is None:
            raise
        reservation = reservation_service.update_reservation(
            db, actor, existing.id, _update_payload(payload), access=access
        )
        return _response(reservation), False
    return _response(reservation), True
