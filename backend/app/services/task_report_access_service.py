from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_report import TaskReport
from app.models.user import User
from app.services.user_scope import role_name
from app.services.organization_authorization_service import (
    resolve_location_read_scope,
    require_capability,
)


async def report_read_scope(
    db: AsyncSession, current_user: User
) -> tuple[set[int] | None, int | None]:
    locations, legacy = await db.run_sync(
        lambda sync_db: resolve_location_read_scope(sync_db, current_user, "work.read")
    )
    assigned_user_id = current_user.id if legacy and role_name(current_user) == "viewer" else None
    return locations, assigned_user_id


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
