from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    statement = (
        select(User)
        .options(
            selectinload(User.role),
            selectinload(User.company),
        )
        .where(func.lower(User.email) == email.strip().lower())
    )
    return await db.scalar(statement)
