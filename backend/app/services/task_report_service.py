import asyncio

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.role import Role
from app.models.task_report import TaskReport
from app.models.user import User
from app.repositories import async_task_item as async_task_item_repo
from app.repositories import async_task_report as task_report_repo
from app.schemas.task_report import TaskReportCreate, TaskReportResponse
from app.services import notification_service, task_assignment_service
from app.services.storage_service import (
    ObjectNotFoundError,
    get_object_storage,
    media_key_from_url,
)
from app.services.user_scope import require_company_context, role_name


REPORT_EVENT_TYPE = "task.reported"
REPORT_HREF = "/dashboard/task-reports?reportId={report_id}"


def _response(report: TaskReport) -> TaskReportResponse:
    task = report.task_item
    return TaskReportResponse(
        id=report.id,
        task_item_id=report.task_item_id,
        reporter_user_id=report.reporter_user_id,
        reporter_company_id=report.reporter_company_id,
        requesting_company_id=report.requesting_company_id,
        report_type=report.report_type,
        title=report.title,
        description=report.description,
        issue_type=report.issue_type,
        element=report.element,
        file_name=report.file_name,
        checklist_item_id=report.checklist_item_id,
        checklist_item_label=report.checklist_item_label,
        reporter_name=report.reporter_name,
        reporter_company_name=report.reporter_company.name,
        requesting_company_name=(
            report.requesting_company.name if report.requesting_company else None
        ),
        task_title=task.title,
        location_name=task.location.name,
        media_url=(
            f"/api/v1/task-reports/{report.id}/media" if report.media_key else None
        ),
        created_at=report.created_at,
    )


def _media_key(payload: TaskReportCreate, company_id: int) -> str | None:
    if not payload.media_url:
        return None
    try:
        key = media_key_from_url(payload.media_url)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Invalid uploaded media",
        ) from error
    if key is None or not key.startswith(f"company/{company_id}/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Media must be uploaded by the reporting company",
        )
    return key


def _checklist_item(task, payload: TaskReportCreate):
    if payload.checklist_item_id is None:
        return None
    item = next(
        (item for item in task.checklist_items if item.id == payload.checklist_item_id),
        None,
    )
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Checklist item does not belong to this task",
        )
    return item


def _apply_checklist_evidence(task, payload: TaskReportCreate, checklist_item) -> None:
    if checklist_item is None:
        return
    evidence = dict(task.checklist_evidence or {})
    key = f"item_{checklist_item.id}"
    item_evidence = dict(evidence.get(key) or {})
    if payload.report_type == "checklist_note":
        item_evidence["note"] = payload.description
    elif payload.report_type == "checklist_photo":
        item_evidence["photoUrl"] = payload.media_url
        item_evidence["photoName"] = payload.file_name
    evidence[key] = item_evidence
    task.checklist_evidence = evidence


async def _notification_recipients(db: AsyncSession, task) -> list[User]:
    company_ids = {task.company_id}
    requesting_company_id = None
    emitter_user_id = None
    if task.checkout_reservation:
        requesting_company_id = task.checkout_reservation.owner_company_id
        emitter_user_id = task.checkout_reservation.created_by_user_id
        company_ids.add(requesting_company_id)

    statement = (
        select(User)
        .join(Role, User.role_id == Role.id)
        .where(
            User.company_id.in_(company_ids),
            User.is_active.is_(True),
            Role.name == "admin",
        )
    )
    recipients = list((await db.scalars(statement)).all())
    if emitter_user_id:
        emitter = await db.scalar(
            select(User).where(User.id == emitter_user_id, User.is_active.is_(True))
        )
        if emitter:
            recipients.append(emitter)
    return list({user.id: user for user in recipients}.values())


async def create_report(
    db: AsyncSession,
    current_user: User,
    payload: TaskReportCreate,
) -> TaskReportResponse:
    company_id = require_company_context(current_user)
    event_id = str(payload.client_event_id)
    existing = await task_report_repo.get_by_user_event(db, current_user.id, event_id)
    if existing:
        return _response(existing)

    task = await async_task_item_repo.get_task_item(
        db,
        company_id,
        payload.task_item_id,
    )
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.status in {"requested", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reports require an accepted task",
        )
    if role_name(current_user) == "viewer" and (
        not task_assignment_service.can_viewer_access_task(task, current_user.id)
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    media_key = _media_key(payload, company_id)
    checklist_item = _checklist_item(task, payload)
    requesting_company_id = (
        task.checkout_reservation.owner_company_id
        if task.checkout_reservation
        else None
    )
    report = TaskReport(
        task_item_id=task.id,
        reporter_user_id=current_user.id,
        reporter_company_id=company_id,
        requesting_company_id=requesting_company_id,
        checklist_item_id=checklist_item.id if checklist_item else None,
        client_event_id=event_id,
        report_type=payload.report_type,
        title=payload.title,
        description=payload.description,
        issue_type=payload.issue_type,
        element=payload.element,
        media_key=media_key,
        file_name=payload.file_name,
        reporter_name=current_user.full_name or current_user.email,
        checklist_item_label=checklist_item.text if checklist_item else None,
    )
    _apply_checklist_evidence(task, payload, checklist_item)
    await db.run_sync(lambda sync_db: sync_db.add(report))
    await db.run_sync(lambda sync_db: sync_db.flush())

    recipients = await _notification_recipients(db, task)
    notifications = [
        Notification(
            user_id=user.id,
            company_id=user.company_id,
            event_type=REPORT_EVENT_TYPE,
            title="Nuevo reporte de campo",
            message=f"Hay un nuevo reporte en {task.location.name}",
            entity_type="task_report",
            entity_id=report.id,
            href=REPORT_HREF.format(report_id=report.id),
            metadata_json={"task_item_id": task.id, "report_type": payload.report_type},
        )
        for user in recipients
    ]
    await db.run_sync(lambda sync_db: sync_db.add_all(notifications))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        duplicate = await task_report_repo.get_by_user_event(
            db, current_user.id, event_id
        )
        if duplicate:
            return _response(duplicate)
        raise

    loaded = await task_report_repo.get_for_company(db, company_id, report.id)
    if loaded is None:  # pragma: no cover - transaction invariant
        raise RuntimeError("Created task report could not be reloaded")
    return _response(loaded)


async def list_reports(
    db: AsyncSession,
    current_user: User,
    *,
    skip: int,
    limit: int,
) -> list[TaskReportResponse]:
    if current_user.company_id is None:
        return []
    reports = await task_report_repo.list_for_company(
        db,
        current_user.company_id,
        skip=skip,
        limit=limit,
    )
    return [_response(report) for report in reports]


async def get_report(
    db: AsyncSession,
    current_user: User,
    report_id: int,
) -> TaskReport:
    company_id = require_company_context(current_user)
    report = await task_report_repo.get_for_company(db, company_id, report_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task report not found",
        )
    return report


async def get_report_response(
    db: AsyncSession,
    current_user: User,
    report_id: int,
) -> TaskReportResponse:
    return _response(await get_report(db, current_user, report_id))


async def get_report_media(db: AsyncSession, current_user: User, report_id: int):
    report = await get_report(db, current_user, report_id)
    if not report.media_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    try:
        return await asyncio.to_thread(get_object_storage().get, report.media_key)
    except ObjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found",
        ) from None


async def mark_report_notifications_read(
    db: AsyncSession,
    current_user: User,
) -> None:
    await notification_service.mark_event_read_async(
        db,
        current_user,
        event_type=REPORT_EVENT_TYPE,
    )
