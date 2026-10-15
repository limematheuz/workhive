from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.work_session import WorkSession
from app.models.work_session_correction import WorkSessionCorrection


def get_correction(
    db: Session,
    *,
    company_id: int,
    correction_id: int,
    for_update: bool = False,
) -> WorkSessionCorrection | None:
    relationship_loaders = (
        (
            selectinload(WorkSessionCorrection.requested_by),
            selectinload(WorkSessionCorrection.work_session).selectinload(
                WorkSession.location
            ),
        )
        if for_update
        else (
            joinedload(WorkSessionCorrection.requested_by),
            joinedload(WorkSessionCorrection.work_session).joinedload(
                WorkSession.location
            ),
        )
    )
    query = (
        db.query(WorkSessionCorrection)
        # PostgreSQL cannot lock the nullable sides of the outer joins emitted
        # by joinedload().  Review mutates only the correction and session, so
        # lock the correction row and load presentation relationships separately.
        .options(*relationship_loaders)
        .filter(
            WorkSessionCorrection.company_id == company_id,
            WorkSessionCorrection.id == correction_id,
        )
    )
    if for_update:
        query = query.with_for_update()
    return query.first()


def has_pending_correction(
    db: Session,
    *,
    work_session_id: int,
) -> bool:
    return (
        db.query(WorkSessionCorrection.id)
        .filter(
            WorkSessionCorrection.work_session_id == work_session_id,
            WorkSessionCorrection.status == "pending",
        )
        .first()
        is not None
    )


def list_own_corrections(
    db: Session,
    *,
    company_id: int,
    user_id: int,
) -> list[WorkSessionCorrection]:
    return (
        db.query(WorkSessionCorrection)
        .options(
            joinedload(WorkSessionCorrection.requested_by),
            joinedload(WorkSessionCorrection.work_session).joinedload(WorkSession.location),
        )
        .filter(
            WorkSessionCorrection.company_id == company_id,
            WorkSessionCorrection.requested_by_user_id == user_id,
        )
        .order_by(WorkSessionCorrection.created_at.desc(), WorkSessionCorrection.id.desc())
        .all()
    )


def list_reviewable_corrections(
    db: Session,
    *,
    company_id: int,
    location_ids: set[int] | None,
) -> list[WorkSessionCorrection]:
    query = (
        db.query(WorkSessionCorrection)
        .options(
            joinedload(WorkSessionCorrection.requested_by),
            joinedload(WorkSessionCorrection.work_session).joinedload(WorkSession.location),
        )
        .filter(WorkSessionCorrection.company_id == company_id)
    )
    if location_ids is not None:
        query = query.filter(
            WorkSessionCorrection.work_session.has(
                WorkSession.location_id.in_(location_ids)
            )
        )
    return query.order_by(
        WorkSessionCorrection.created_at.desc(), WorkSessionCorrection.id.desc()
    ).all()
