from datetime import datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import (
    ActiveUser,
    AsyncActiveManagerOrAdmin,
    AsyncActiveUser,
    get_async_db,
    get_db,
)
from app.models.user import User
from app.schemas.reservation import (
    ReservationCreate,
    ReservationOperationalResponse,
    ReservationResponse,
    ReservationUpdate,
)
from app.services import reservation_query_service, reservation_service


router = APIRouter()


@router.get("/", response_model=list[ReservationResponse])
async def read_reservations(
    location_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveManagerOrAdmin,
):
    def operation(sync_db: Session):
        reservations = reservation_query_service.list_reservations(
            sync_db,
            current_user,
            location_id,
            date_from,
            date_to,
        )
        return [
            reservation_query_service.build_reservation_response(
                sync_db,
                reservation,
                current_user,
            )
            for reservation in reservations
        ]

    return await db.run_sync(operation)


@router.get("/upcoming/arrivals", response_model=list[ReservationOperationalResponse])
async def read_upcoming_arrivals(
    days: int = 3,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveManagerOrAdmin,
):
    return await db.run_sync(
        lambda sync_db: reservation_query_service.list_upcoming_arrivals(
            sync_db,
            current_user,
            days,
        )
    )


@router.get("/{reservation_id}", response_model=ReservationResponse)
async def read_reservation(
    reservation_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    def operation(sync_db: Session):
        reservation = reservation_query_service.get_reservation(
            sync_db,
            current_user,
            reservation_id,
        )
        return reservation_query_service.build_reservation_response(
            sync_db,
            reservation,
            current_user,
        )

    return await db.run_sync(operation)


@router.post(
    "/", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED
)
def create_reservation(
    reservation_data: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    reservation = reservation_service.create_reservation(db, current_user, reservation_data)
    return reservation_query_service.build_reservation_response(
        db, reservation, current_user
    )


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
    return reservation_query_service.build_reservation_response(
        db, reservation, current_user
    )


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
    return reservation_query_service.build_reservation_response(
        db, reservation, current_user
    )


@router.delete("/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    reservation_service.delete_reservation(db, current_user, reservation_id)
