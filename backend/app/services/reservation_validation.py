from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.datetime import as_utc
from app.models.company_collaboration import CompanyCollaboration
from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.models.reservation import Reservation
from app.models.user import User
from app.repositories import reservation as reservation_repo
from app.services.user_scope import is_superadmin


def validate_no_overlap(
    db: Session,
    location_id: int,
    check_in_at: datetime,
    check_out_at: datetime,
    exclude_reservation_id: int | None = None,
) -> None:
    if reservation_repo.find_overlaps(
        db,
        location_id,
        check_in_at,
        check_out_at,
        exclude_reservation_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This reservation overlaps another active reservation at the location",
        )


def validate_cleaning_schedule(
    db: Session,
    location_id: int,
    check_out_at: datetime,
    cleaning_scheduled_at: datetime | None,
    exclude_reservation_id: int | None = None,
) -> None:
    if cleaning_scheduled_at is None:
        return
    cleaning_scheduled_at = as_utc(cleaning_scheduled_at)
    check_out_at = as_utc(check_out_at)
    if cleaning_scheduled_at < check_out_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Cleaning cannot be scheduled before the current checkout date.",
        )

    next_query = db.query(Reservation).filter(
        Reservation.location_id == location_id,
        Reservation.status != "cancelled",
        Reservation.check_in_at >= check_out_at,
    )
    if exclude_reservation_id is not None:
        next_query = next_query.filter(Reservation.id != exclude_reservation_id)
    next_reservation = next_query.order_by(Reservation.check_in_at.asc()).first()
    if next_reservation and cleaning_scheduled_at > as_utc(next_reservation.check_in_at):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Cleaning must be performed before the next check-in.",
        )


def validate_service_provider(
    db: Session,
    location_id: int,
    owner_company_id: int,
    target_company_id: int,
) -> None:
    if target_company_id == owner_company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "To manage cleaning internally, leave the partner "
                "company unselected."
            ),
        )

    direct_access = (
        db.query(LocationCompanyAccess)
        .filter(
            LocationCompanyAccess.location_id == location_id,
            LocationCompanyAccess.company_id == target_company_id,
            LocationCompanyAccess.relationship_type.in_(
                ("service_provider", "default_service_provider")
            ),
        )
        .first()
    )
    if direct_access:
        return

    accepted_provider = (
        db.query(CompanyCollaboration.id)
        .filter(
            CompanyCollaboration.status == "accepted",
            (
                (
                    CompanyCollaboration.initiator_company_id == owner_company_id
                )
                & (
                    CompanyCollaboration.partner_company_id == target_company_id
                )
                & (CompanyCollaboration.role_type == "service_provider")
            )
            | (
                (
                    CompanyCollaboration.partner_company_id == owner_company_id
                )
                & (
                    CompanyCollaboration.initiator_company_id == target_company_id
                )
                & (CompanyCollaboration.role_type == "property_manager")
            ),
        )
        .first()
    )
    if not accepted_provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected company is not a valid service provider.",
        )


def get_location(db: Session, location_id: int) -> Location:
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )
    return location


def get_owner_company_id(current_user: User, location: Location) -> int:
    owner_company_id = (
        current_user.company_id
        or location.owner_company_id
        or location.managing_company_id
        or (location.client.company_id if location.client else None)
    )
    if owner_company_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A reservation must belong to a company",
        )
    return owner_company_id


def require_reservation_owner(current_user: User, owner_company_id: int) -> None:
    if (
        not is_superadmin(current_user)
        and current_user.company_id != owner_company_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company that owns the reservation can modify it",
        )


def validate_guest_capacity(location: Location, guest_count: int) -> None:
    if (
        location.max_capacity is not None
        and location.max_capacity > 0
        and guest_count > location.max_capacity
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"The number of guests ({guest_count}) exceeds the maximum capacity "
                f"of the property ({location.max_capacity})."
            ),
        )
