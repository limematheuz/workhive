from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.core.rate_limit import rate_limit_key, rate_limiter
from app.schemas.traffic import PageViewCreate
from app.services import audit_service
from app.services.request_context import get_request_location_details


router = APIRouter()


@router.post("/page-view", status_code=status.HTTP_202_ACCEPTED)
def record_page_view(
    payload: PageViewCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    rate_limiter.enforce(
        rate_limit_key(request, "page-view", payload.visitor_id),
        max(settings.CONTACT_RATE_LIMIT, 60),
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    )
    audit_service.record_public_event(
        db,
        action="public.page_view",
        entity_type="page_view",
        entity_id=payload.visitor_id,
        request=request,
        details={
            "visitor_id": payload.visitor_id,
            "path": payload.path,
            "referrer": payload.referrer,
            "title": payload.title,
            "screen": payload.screen,
            "timezone": payload.timezone,
            "language": payload.language,
            **get_request_location_details(request),
        },
    )
    return {"status": "accepted"}
