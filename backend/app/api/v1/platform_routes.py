from fastapi import APIRouter

from app.api.v1.platform_team import router as team_router


router = APIRouter()
router.include_router(team_router, prefix="/platform-team", tags=["platform-team"])
