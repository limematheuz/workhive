from fastapi import APIRouter

from app.api.v1.api_access_keys import router as api_access_keys_router
from app.api.v1.public_api import router as public_api_router


def register_api_access_routes(api_router: APIRouter) -> None:
    """Register management and public integration endpoints."""
    api_router.include_router(
        api_access_keys_router,
        prefix="/api-access-keys",
        tags=["api-access-keys"],
    )
    api_router.include_router(
        public_api_router,
        prefix="/public",
        tags=["public-api"],
    )
