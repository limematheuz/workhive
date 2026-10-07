from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.api.deps import AsyncActiveUser
from app.models.user import User
from app.services import realtime_event_service


router = APIRouter()


@router.get("/events")
async def stream_realtime_events(
    current_user: User = AsyncActiveUser,
) -> StreamingResponse:
    """Send only scoped invalidation topics; normal read APIs remain authoritative."""

    return StreamingResponse(
        realtime_event_service.stream_for_authenticated_user(
            user_id=current_user.id,
            company_id=current_user.company_id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
