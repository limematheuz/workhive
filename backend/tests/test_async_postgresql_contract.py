import os
from uuid import uuid4

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.database_url import to_async_database_url
from app.models.company import Company
from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User
from app.repositories import async_user as async_user_repo
from app.services import notification_service


@pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL async vertical contract runs in CI",
)
@pytest.mark.asyncio
async def test_async_notification_vertical_is_tenant_and_user_scoped():
    engine = create_async_engine(
        to_async_database_url(os.environ["MIGRATION_TEST_DATABASE_URL"]),
        poolclass=NullPool,
    )
    factory = async_sessionmaker(engine, expire_on_commit=False)
    suffix = uuid4().hex[:12]
    company_ids: list[int] = []
    user_ids: list[int] = []
    notification_ids: list[int] = []
    try:
        async with factory() as session:
            viewer_role_id = await session.scalar(
                select(Role.id).where(Role.name == "viewer")
            )
            assert viewer_role_id is not None

            own_company = Company(
                name=f"Async Own {suffix}",
                tax_id=f"AO-{suffix}",
                address="Async Street 1",
                phone="600000001",
                email=f"own-company-{suffix}@example.test",
            )
            foreign_company = Company(
                name=f"Async Foreign {suffix}",
                tax_id=f"AF-{suffix}",
                address="Async Street 2",
                phone="600000002",
                email=f"foreign-company-{suffix}@example.test",
            )
            session.add_all([own_company, foreign_company])
            await session.flush()
            company_ids.extend([own_company.id, foreign_company.id])

            own_user = User(
                email=f"own-user-{suffix}@example.test",
                hashed_password="unused",
                full_name="Async Owner",
                role_id=viewer_role_id,
                company_id=own_company.id,
                is_active=True,
            )
            foreign_user = User(
                email=f"foreign-user-{suffix}@example.test",
                hashed_password="unused",
                full_name="Async Foreign",
                role_id=viewer_role_id,
                company_id=foreign_company.id,
                is_active=True,
            )
            session.add_all([own_user, foreign_user])
            await session.flush()
            user_ids.extend([own_user.id, foreign_user.id])

            own_notification = Notification(
                user_id=own_user.id,
                company_id=own_company.id,
                event_type="task.assigned",
                title="Own task",
                message="Visible",
                entity_type="task_item",
                entity_id=1,
                href="/dashboard?taskId=1",
            )
            foreign_notification = Notification(
                user_id=foreign_user.id,
                company_id=foreign_company.id,
                event_type="task.assigned",
                title="Foreign task",
                message="Hidden",
                entity_type="task_item",
                entity_id=2,
                href="/dashboard?taskId=2",
            )
            session.add_all([own_notification, foreign_notification])
            await session.commit()
            notification_ids.extend([own_notification.id, foreign_notification.id])

            loaded_user = await async_user_repo.get_user_by_email(
                session, own_user.email
            )
            assert loaded_user is not None
            assert loaded_user.role.name == "viewer"
            assert loaded_user.company.id == own_company.id

            listed = await notification_service.list_notifications_async(
                session,
                loaded_user,
                unread_only=True,
                limit=100,
            )
            assert [item.id for item in listed] == [own_notification.id]
            assert await notification_service.mark_read_async(
                session,
                loaded_user,
                foreign_notification.id,
            ) is None

            await notification_service.mark_all_read_async(session, loaded_user)
            await session.refresh(foreign_notification)
            assert foreign_notification.read_at is None
    finally:
        async with factory() as cleanup:
            if notification_ids:
                await cleanup.execute(
                    delete(Notification).where(Notification.id.in_(notification_ids))
                )
            if user_ids:
                await cleanup.execute(delete(User).where(User.id.in_(user_ids)))
            if company_ids:
                await cleanup.execute(
                    delete(Company).where(Company.id.in_(company_ids))
                )
            await cleanup.commit()
        await engine.dispose()
