from datetime import datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, ActiveManagerOrAdmin, get_db
from app.models.user import User
from app.schemas.reservation import (
    ReservationCreate,
    ReservationOperationalResponse,
    ReservationResponse,
    ReservationUpdate,
)
from app.services import reservation_service


router = APIRouter()


@router.get("/", response_model=list[ReservationResponse])
def read_reservations(
    location_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    reservations = reservation_service.list_reservations(
        db, current_user, location_id, date_from, date_to
    )
    return [
        reservation_service.build_reservation_response(db, reservation, current_user)
        for reservation in reservations
    ]


@router.get("/upcoming/arrivals", response_model=list[ReservationOperationalResponse])
def read_upcoming_arrivals(
    days: int = 3,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    return reservation_service.list_upcoming_arrivals(db, current_user, days)


@router.get("/{reservation_id}", response_model=ReservationResponse)
def read_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    reservation = reservation_service.get_reservation(db, current_user, reservation_id)
    return reservation_service.build_reservation_response(db, reservation, current_user)


@router.post(
    "/", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED
)
def create_reservation(
    reservation_data: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    reservation = reservation_service.create_reservation(db, current_user, reservation_data)
    return reservation_service.build_reservation_response(db, reservation, current_user)


@router.patch("/{reservation_id}", response_model=ReservationResponse)
def update_reservation(
    reservation_id: int,
    reservation_data: ReservationUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    reservation = reservation_service.update_reservation(
        db, current_user, reservation_id, reservation_data
    )
    return reservation_service.build_reservation_response(db, reservation, current_user)


@router.post(
    "/{reservation_id}/dispatch-cleaning",
    response_model=ReservationResponse,
)
def dispatch_cleaning_request(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    reservation = reservation_service.dispatch_cleaning_request(
        db, current_user, reservation_id
    )
    return reservation_service.build_reservation_response(db, reservation, current_user)


@router.delete("/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    reservation_service.delete_reservation(db, current_user, reservation_id)
