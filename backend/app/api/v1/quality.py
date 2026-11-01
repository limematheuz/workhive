"""Register the independent quality transport modules."""

from fastapi import APIRouter
from app.api.v1.quality_access import router as quality_access_router

from app.api.v1.quality_complaints import router as quality_complaints_router
from app.api.v1.quality_incidents import router as quality_incidents_router
from app.api.v1.quality_inspections import router as quality_inspections_router
from app.api.v1.quality_templates import router as quality_templates_router


def register_quality_routes(api_router: APIRouter) -> None:
    api_router.include_router(quality_access_router, prefix="/quality/access", tags=["quality-access"])
    api_router.include_router(
        quality_templates_router,
        prefix="/quality/templates",
        tags=["quality-templates"],
    )
    api_router.include_router(
        quality_inspections_router,
        prefix="/quality/inspections",
        tags=["quality-inspections"],
    )
    api_router.include_router(
        quality_incidents_router,
        prefix="/quality/incidents",
        tags=["quality-incidents"],
    )
    api_router.include_router(
        quality_complaints_router,
        prefix="/quality/complaints",
        tags=["quality-complaints"],
    )
