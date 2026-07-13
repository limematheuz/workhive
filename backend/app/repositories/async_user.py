from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.user import user_response_load_options


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    statement = (
        select(User)
        .options(*user_response_load_options())
        .where(func.lower(User.email) == email.strip().lower())
    )
    return await db.scalar(statement)
