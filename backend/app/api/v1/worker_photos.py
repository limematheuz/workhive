from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, UploadFile, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import AsyncActiveUser, get_async_db
from app.schemas.task_report import TaskReportResponse
from app.services import worker_photo_service
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/worker-workspace")


@router.post("/photos", response_model=TaskReportResponse, status_code=201)
async def synchronize_photo(request: Request, task_id: Annotated[int, Form(gt=0)], expected_user_id: Annotated[int, Form(gt=0)],
    client_event_id: Annotated[UUID, Form()], file: Annotated[UploadFile, File()],
    expected_company_id: Annotated[int | None, Form(gt=0)] = None,
    db: AsyncSession = Depends(get_async_db), user=AsyncActiveUser):
    enforce_rate_limit(request, "media-upload", settings.MEDIA_UPLOAD_RATE_LIMIT, settings.AUTH_RATE_LIMIT_WINDOW_SECONDS, identity=str(user.id))
    return await worker_photo_service.synchronize(db, user, task_id, expected_user_id, client_event_id, file, expected_company_id)
