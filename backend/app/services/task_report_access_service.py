from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_report import TaskReport
from app.models.user import User
from app.services.user_scope import role_name
from app.services.organization_authorization_service import (
    permitted_location_ids,
    require_capability,
)


async def permitted_report_location_ids(
    db: AsyncSession, current_user: User
) -> set[int] | None:
    return await db.run_sync(
        lambda sync_db: permitted_location_ids(sync_db, current_user, "work.read")
    )


async def require_report_read(
    db: AsyncSession, current_user: User, location_id: int
) -> None:
    await db.run_sync(
        lambda sync_db: require_capability(
            sync_db,
            current_user,
            "work.read",
            scope_type="location",
            scope_id=location_id,
        )
    )


async def require_report_management(
    db: AsyncSession, current_user: User, report: TaskReport
) -> None:
    await db.run_sync(
        lambda sync_db: require_capability(
            sync_db,
            current_user,
            "work.manage",
            scope_type="location",
            scope_id=report.task_item.location_id,
        )
    )


def assigned_report_user_id(current_user: User) -> int | None:
    """Worker report access also requires a current task assignment."""
    return current_user.id if role_name(current_user) == "viewer" else None
