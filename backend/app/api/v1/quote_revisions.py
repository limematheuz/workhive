from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import (
    ActiveFinanceManager,
    AsyncActiveFinancialReader,
    get_async_db,
    get_db,
)
from app.models.user import User
from app.schemas.quote import (
    QuoteRevisionCreate,
    QuoteRevisionResponse,
    QuoteResponse,
)
from app.services import quote_revision_service


router = APIRouter()


@router.get("/{quote_id}/revisions", response_model=list[QuoteRevisionResponse])
async def read_quote_revisions(
    quote_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: quote_revision_service.get_quote_revisions(
            sync_db,
            current_user.company_id,
            quote_id,
        )
    )


@router.post("/{quote_id}/revisions", response_model=QuoteResponse)
def create_quote_revision(
    quote_id: int,
    revision_data: QuoteRevisionCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    return quote_revision_service.create_quote_revision(
        db,
        current_user.company_id,
        quote_id,
        revision_data,
        actor_user_id=current_user.id,
    )
