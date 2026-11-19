"""Apply current operational recipient eligibility before inbox pagination."""

from sqlalchemy import and_, false, func, or_, select

from app.models.notification import Notification
from app.models.task_item import TaskItem
from app.models.task_report import TaskReport
from app.models.user import User
from app.repositories.async_task_report import report_company_condition
from app.repositories.operational_recipients import eligible_user_ids, legacy_viewer_ids
from app.repositories.task_assignment_scope import assigned_task_condition
from app.repositories.task_company_scope import company_task_condition


def operational_visibility(
    company_id: int,
    user_id: int,
    legacy_roles: tuple[str, ...],
    management_roles: tuple[str, ...],
    work_available,
):
    readers = eligible_user_ids(
        company_id=company_id,
        capabilities=("work.read",),
        legacy_roles=legacy_roles,
        location_id=TaskItem.location_id,
    )
    company_readers = eligible_user_ids(
        company_id=company_id,
        capabilities=("work.read",),
        legacy_roles=tuple(role for role in legacy_roles if role != "viewer"),
        company_scope_only=True,
    )
    legacy_viewers = legacy_viewer_ids(company_id)
    access_conditions = (
        readers.where(User.id == user_id).exists(),
        or_(
            ~legacy_viewers.where(User.id == user_id).exists(),
            assigned_task_condition(user_id),
        ),
    )
    task_conditions = (company_task_condition(company_id), *access_conditions)
    task_visible = (
        select(TaskItem.id)
        .where(
            TaskItem.id == Notification.entity_id,
            *task_conditions,
        )
        .exists()
    )
    report_visible = (
        select(TaskReport.id)
        .join(
            TaskItem,
            TaskItem.id == TaskReport.task_item_id,
        )
        .where(
            TaskReport.id == Notification.entity_id,
            report_company_condition(company_id),
            *access_conditions,
        )
        .exists()
    )
    foreign_task = (
        select(TaskItem.id)
        .where(
            TaskItem.id == Notification.entity_id,
            ~company_task_condition(company_id),
        )
        .exists()
    )
    foreign_report = (
        select(TaskReport.id)
        .where(
            TaskReport.id == Notification.entity_id,
            ~func.coalesce(report_company_condition(company_id), false()),
        )
        .exists()
    )
    company_visible = and_(
        company_readers.where(User.id == user_id).exists(),
        ~or_(
            and_(Notification.entity_type == "task_item", foreign_task),
            and_(Notification.entity_type == "task_report", foreign_report),
        ),
    )
    operational = and_(
        Notification.event_type.startswith("task."),
        Notification.entity_type.in_(("task_item", "task_report")),
    )
    managers = eligible_user_ids(
        company_id=company_id,
        capabilities=("work.manage",),
        legacy_roles=management_roles,
        location_id=TaskItem.location_id,
    )
    request_visible = (
        select(TaskItem.id)
        .where(
            TaskItem.id == Notification.entity_id,
            *task_conditions,
            managers.where(User.id == user_id).exists(),
        )
        .exists()
    )
    is_request = and_(
        Notification.entity_type == "task_item",
        Notification.event_type == "task.requested",
    )
    return and_(
        or_(~operational, work_available),
        or_(
            ~operational,
            company_visible,
            and_(Notification.entity_type == "task_item", task_visible),
            and_(Notification.entity_type == "task_report", report_visible),
        ),
        or_(~is_request, request_visible),
    )
