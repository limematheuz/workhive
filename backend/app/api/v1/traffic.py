from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
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
    enforce_rate_limit(
        request,
        "page-view",
        max(settings.CONTACT_RATE_LIMIT, 60),
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=payload.visitor_id,
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
            # Anonymous page views stay useful for acquisition reporting, but
            # should not trigger third-party IP geolocation or feed the map of
            # authenticated WorkHive users.
            **get_request_location_details(request, include_geolocation=False),
        },
    )
    return {"status": "accepted"}
