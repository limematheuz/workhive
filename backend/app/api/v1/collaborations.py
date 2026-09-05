from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import ActiveManagerOrAdmin, AsyncActiveUser, get_async_db, get_db
from app.api.v1.company_collaboration_invitations import router as invitations_router
from app.api.v1.sponsored_partner_invitations import router as sponsored_invitations_router
from app.models.user import User
from app.repositories import company_collaboration as collab_repo
from app.schemas.collaboration import CollaborationResponse
from app.schemas.company import CompanyPartnerResponse
from app.services import collaboration_service


router = APIRouter()
router.include_router(invitations_router, prefix="/invitations")
router.include_router(sponsored_invitations_router, prefix="/sponsored-invitations")


@router.get("/", response_model=list[CollaborationResponse])
async def read_collaborations(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    if current_user.company_id is None:
        return []
    return await db.run_sync(
        lambda sync_db: collab_repo.list_collaborations(sync_db, current_user.company_id)
    )


@router.get("/service-providers", response_model=list[CompanyPartnerResponse])
async def read_service_providers(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    if current_user.company_id is None:
        return []
    return await db.run_sync(
        lambda sync_db: collab_repo.list_partner_companies(sync_db, current_user.company_id)
    )


@router.delete("/{collab_id:int}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collaboration(
    collab_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    collaboration_service.unlink_collaboration(db, current_user, collab_id)
