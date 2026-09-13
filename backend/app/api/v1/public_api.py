"""The first deliberately small, API-key authenticated public surface."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.schemas.public_api import PublicWorkOrderResponse
from app.services import api_access_key_service, audit_service, public_api_service
from app.services.api_access_key_service import ApiAccessPrincipal, WORK_ORDERS_READ_SCOPE


router = APIRouter()


def require_api_scope(scope: str):
    def authenticate(
        request: Request,
        x_workhive_api_key: Annotated[str | None, Header(alias="X-WorkHive-API-Key")] = None,
        db: Session = Depends(get_db),
    ) -> ApiAccessPrincipal:
        enforce_rate_limit(
            request,
            "public-api",
            settings.PUBLIC_API_RATE_LIMIT,
            settings.PUBLIC_API_RATE_LIMIT_WINDOW_SECONDS,
            identity=x_workhive_api_key or "",
        )
        principal = api_access_key_service.authenticate_key(
            db,
            raw_key=x_workhive_api_key,
            required_scope=scope,
        )
        principal.key.last_used_at = api_access_key_service.utcnow()
        audit_service.record_api_key_event(
            db,
            company_id=principal.company_id,
            api_key_id=principal.key.id,
            api_key_prefix=principal.key.key_prefix,
            scope=scope,
            request=request,
        )
        return principal

    return authenticate


PublicWorkOrdersReader = Depends(require_api_scope(WORK_ORDERS_READ_SCOPE))


@router.get("/work-orders", response_model=list[PublicWorkOrderResponse])
def read_public_work_orders(
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    principal: ApiAccessPrincipal = PublicWorkOrdersReader,
):
    if skip < 0 or limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Pagination must use skip >= 0 and limit between 1 and 100",
        )
    return public_api_service.list_work_orders(
        db,
        company_id=principal.company_id,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )


@router.get("/work-orders/{work_order_id}", response_model=PublicWorkOrderResponse)
def read_public_work_order(
    work_order_id: int,
    db: Session = Depends(get_db),
    principal: ApiAccessPrincipal = PublicWorkOrdersReader,
):
    work_order = public_api_service.get_work_order(
        db,
        company_id=principal.company_id,
        work_order_id=work_order_id,
    )
    if work_order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")
    return work_order
