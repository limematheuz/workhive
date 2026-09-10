from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.work_session_correction import WorkSessionCorrection
from app.repositories import task_item as task_item_repo
from app.repositories import work_session as work_session_repo
from app.repositories import work_session_correction as correction_repo
from app.schemas.work_session_correction import (
    WorkSessionCorrectionCreate,
    WorkSessionCorrectionReview,
)
from app.services import task_billing_service
from app.services.entitlement_service import require_company_feature
from app.services.organization_authorization_service import (
    permitted_location_ids,
    require_capability,
)


def _require_time_tracking(db: Session, current_user: User) -> int:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere una empresa activa",
        )
    require_company_feature(
        db,
        company_id=current_user.company_id,
        code="features.time_tracking",
    )
    return current_user.company_id


def _get_own_closed_session(
    db: Session,
    current_user: User,
    work_session_id: int,
):
    work_session = work_session_repo.get_work_session_by_id(
        db,
        work_session_id,
        current_user.id,
        for_update=True,
    )
    if work_session is None:
        raise HTTPException(status_code=404, detail="Fichaje no encontrado")
    if work_session.end_time is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se pueden corregir fichajes finalizados",
        )
    require_capability(
        db,
        current_user,
        "time.manage",
        scope_type="location",
        scope_id=work_session.location_id,
    )
    return work_session


def _ensure_not_invoiced(
    db: Session,
    company_id: int,
    work_session,
):
    if work_session.task_item_id is None:
        return None
    task = task_item_repo.get_task_item(
        db,
        company_id,
        work_session.task_item_id,
    )
    if task and task.is_invoiced:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede corregir un fichaje que ya afecta a una factura",
        )
    return task


def request_correction(
    db: Session,
    current_user: User,
    work_session_id: int,
    correction_data: WorkSessionCorrectionCreate,
) -> WorkSessionCorrection:
    company_id = _require_time_tracking(db, current_user)
    work_session = _get_own_closed_session(db, current_user, work_session_id)
    _ensure_not_invoiced(db, company_id, work_session)
    if correction_repo.has_pending_correction(db, work_session_id=work_session.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una corrección pendiente para este fichaje",
        )

    correction = WorkSessionCorrection(
        company_id=company_id,
        work_session_id=work_session.id,
        requested_by_user_id=current_user.id,
        original_start_time=work_session.start_time,
        original_end_time=work_session.end_time,
        requested_start_time=correction_data.requested_start_time,
        requested_end_time=correction_data.requested_end_time,
        reason=correction_data.reason.strip(),
    )
    db.add(correction)
    db.commit()
    db.refresh(correction)
    return correction


def list_corrections(
    db: Session,
    current_user: User,
    *,
    review_queue: bool = False,
) -> list[WorkSessionCorrection]:
    company_id = _require_time_tracking(db, current_user)
    if not review_queue:
        return correction_repo.list_own_corrections(
            db,
            company_id=company_id,
            user_id=current_user.id,
        )

    location_ids = permitted_location_ids(db, current_user, "time.approve")
    return correction_repo.list_reviewable_corrections(
        db,
        company_id=company_id,
        location_ids=location_ids,
    )


def review_correction(
    db: Session,
    current_user: User,
    correction_id: int,
    review: WorkSessionCorrectionReview,
) -> WorkSessionCorrection:
    company_id = _require_time_tracking(db, current_user)
    correction = correction_repo.get_correction(
        db,
        company_id=company_id,
        correction_id=correction_id,
        for_update=True,
    )
    if correction is None or correction.work_session is None:
        raise HTTPException(status_code=404, detail="Corrección no encontrada")
    if correction.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta corrección ya ha sido revisada",
        )
    if correction.requested_by_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes aprobar tu propia corrección",
        )

    work_session = correction.work_session
    require_capability(
        db,
        current_user,
        "time.approve",
        scope_type="location",
        scope_id=work_session.location_id,
    )
    task = _ensure_not_invoiced(db, company_id, work_session)
    reviewed_at = datetime.now(timezone.utc)
    correction.status = review.decision
    correction.reviewed_by_user_id = current_user.id
    correction.reviewed_at = reviewed_at
    correction.review_note = review.note.strip() if review.note else None
    if review.decision == "approved":
        work_session.start_time = correction.requested_start_time
        work_session.end_time = correction.requested_end_time
        correction.applied_at = reviewed_at
        if task and task.status == "completed":
            task_billing_service.capture_completed_work_snapshot(
                db,
                task,
                completed_at=task.date_done or reviewed_at,
            )
            db.add(task)
        db.add(work_session)
    db.add(correction)
    db.commit()
    db.refresh(correction)
    return correction
