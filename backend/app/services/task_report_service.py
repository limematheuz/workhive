import asyncio
import logging

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.role import Role
from app.models.task_report import TaskReport
from app.models.user import User
from app.repositories import async_task_item as async_task_item_repo
from app.repositories import async_task_report as task_report_repo
from app.schemas.task_report import (
    TaskReportBulkDelete,
    TaskReportCreate,
    TaskReportResponse,
    TaskReportUpdate,
)
from app.services import notification_service, task_assignment_service
from app.services.task_report_serializer import serialize_task_report as _response
from app.services.task_report_access_service import (
    assigned_report_user_id,
    permitted_report_location_ids,
    require_report_management,
    require_report_read,
)
from app.services.task_report_media_service import copy_report_media
from app.services.storage_service import ObjectNotFoundError, get_object_storage
from app.services.user_scope import require_company_context, role_name


logger = logging.getLogger(__name__)

REPORT_EVENT_TYPE = "task.reported"
REPORT_HREF = "/dashboard/task-reports?reportId={report_id}"
EDITABLE_FIELDS_BY_TYPE = {
    "issue": {"title", "description", "issue_type", "element"},
    "note": {"description"},
    "checklist_note": {"description"},
}


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


def _sync_checklist_note_evidence(report: TaskReport) -> None:
    if report.report_type != "checklist_note" or report.checklist_item_id is None:
        return
    task = report.task_item
    evidence = dict(task.checklist_evidence or {})
    key = f"item_{report.checklist_item_id}"
    item_evidence = dict(evidence.get(key) or {})
    item_evidence["note"] = report.description
    evidence[key] = item_evidence
    task.checklist_evidence = evidence


def _clear_checklist_evidence(report: TaskReport) -> None:
    if report.checklist_item_id is None:
        return
    task = report.task_item
    evidence = dict(task.checklist_evidence or {})
    key = f"item_{report.checklist_item_id}"
    item_evidence = dict(evidence.get(key) or {})
    if report.report_type == "checklist_note":
        item_evidence.pop("note", None)
    elif report.report_type == "checklist_photo":
        item_evidence.pop("photoUrl", None)
        item_evidence.pop("photoName", None)
    else:
        return
    if item_evidence:
        evidence[key] = item_evidence
    else:
        evidence.pop(key, None)
    task.checklist_evidence = evidence


def _apply_update(report: TaskReport, payload: TaskReportUpdate) -> None:
    allowed = EDITABLE_FIELDS_BY_TYPE.get(report.report_type)
    if allowed is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Photo reports cannot be edited",
        )
    requested = set(payload.model_fields_set)
    unsupported = requested - allowed
    if unsupported:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Unsupported fields for {report.report_type}: {', '.join(sorted(unsupported))}",
        )

    values = payload.model_dump(exclude_unset=True)
    if report.report_type == "issue":
        if "title" in values:
            title = values["title"]
            if not title:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Issue reports require a title",
                )
            report.title = title
        if "description" in values:
            report.description = values["description"] or None
        if "issue_type" in values:
            report.issue_type = values["issue_type"] or None
        if "element" in values:
            report.element = values["element"] or None
        return

    description = values.get("description")
    if not description:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Note reports require a description",
        )
    report.description = description
    _sync_checklist_note_evidence(report)


async def _delete_report_notifications(db: AsyncSession, report_ids: list[int]) -> None:
    if not report_ids:
        return
    await db.execute(
        delete(Notification).where(
            Notification.entity_type == "task_report",
            Notification.entity_id.in_(report_ids),
        )
    )


def _delete_media_keys(media_keys: list[str]) -> None:
    storage = get_object_storage()
    for key in media_keys:
        try:
            storage.delete(key)
        except Exception:  # pragma: no cover - best-effort cleanup
            logger.exception("Failed to delete task report media %s", key)


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
            select(User).where(
                User.id == emitter_user_id,
                User.company_id == requesting_company_id,
                User.is_active.is_(True),
            )
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
        return _response(await get_report(db, current_user, existing.id))

    task = await async_task_item_repo.get_task_item(
        db,
        company_id,
        payload.task_item_id,
    )
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    if task.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    if task.status in {"requested", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reports require an accepted task",
        )
    await require_report_read(db, current_user, task.location_id)
    if role_name(current_user) == "viewer" and (
        not task_assignment_service.can_viewer_access_task(task, current_user.id)
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    checklist_item = _checklist_item(task, payload)
    media_key = copy_report_media(payload.media_url, company_id)
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
            return _response(await get_report(db, current_user, duplicate.id))
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
    location_ids = await permitted_report_location_ids(db, current_user)
    reports = await task_report_repo.list_for_company(
        db,
        current_user.company_id,
        skip=skip,
        limit=limit,
        location_ids=location_ids,
        assigned_user_id=assigned_report_user_id(current_user),
    )
    return [_response(report) for report in reports]


async def get_report(
    db: AsyncSession,
    current_user: User,
    report_id: int,
) -> TaskReport:
    company_id = require_company_context(current_user)
    report = await task_report_repo.get_for_company(
        db, company_id, report_id, assigned_user_id=assigned_report_user_id(current_user)
    )
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task report not found",
        )
    await require_report_read(db, current_user, report.task_item.location_id)
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Media not found"
        )
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


async def update_report(
    db: AsyncSession,
    current_user: User,
    report_id: int,
    payload: TaskReportUpdate,
) -> TaskReportResponse:
    report = await get_report(db, current_user, report_id)
    await require_report_management(db, current_user, report)
    _apply_update(report, payload)
    await db.commit()
    loaded = await task_report_repo.get_for_company(
        db,
        require_company_context(current_user),
        report_id,
    )
    if loaded is None:  # pragma: no cover - transaction invariant
        raise RuntimeError("Updated task report could not be reloaded")
    return _response(loaded)


async def delete_report(
    db: AsyncSession,
    current_user: User,
    report_id: int,
) -> None:
    report = await get_report(db, current_user, report_id)
    await require_report_management(db, current_user, report)
    media_key = report.media_key
    _clear_checklist_evidence(report)
    await _delete_report_notifications(db, [report_id])
    await db.run_sync(lambda sync_db: sync_db.delete(report))
    await db.commit()
    if media_key:
        await asyncio.to_thread(_delete_media_keys, [media_key])


async def bulk_delete_reports(
    db: AsyncSession,
    current_user: User,
    payload: TaskReportBulkDelete,
) -> None:
    company_id = require_company_context(current_user)
    reports = await task_report_repo.list_by_ids_for_company(
        db,
        company_id,
        payload.ids,
        assigned_user_id=assigned_report_user_id(current_user),
    )
    if len(reports) != len(payload.ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more task reports were not found",
        )
    for report in reports:
        await require_report_management(db, current_user, report)

    media_keys = [report.media_key for report in reports if report.media_key]
    report_ids = [report.id for report in reports]
    for report in reports:
        _clear_checklist_evidence(report)
        await db.run_sync(lambda sync_db, item=report: sync_db.delete(item))
    await _delete_report_notifications(db, report_ids)
    await db.commit()
    if media_keys:
        await asyncio.to_thread(_delete_media_keys, media_keys)
