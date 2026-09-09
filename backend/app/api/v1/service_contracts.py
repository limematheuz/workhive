"""Transport endpoints for agreements derived from accepted quotes."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import (
    ActiveFinanceManager,
    AsyncActiveFinancialReader,
    get_async_db,
    get_db,
)
from app.api.pagination import PaginationLimit, PaginationOffset
from app.api.v1 import service_contract_locations
from app.models.user import User
from app.schemas.service_contract import (
    ServiceContractResponse,
    ServiceContractTermsUpdate,
)
from app.services import (
    audit_service,
    service_contract_location_service,
    service_contract_service,
)


router = APIRouter()
router.include_router(service_contract_locations.router, prefix="/{contract_id}")


@router.post(
    "/from-quote/{quote_id}",
    response_model=ServiceContractResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_contract_from_quote(
    quote_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    contract = service_contract_service.create_contract_from_accepted_quote(
        db,
        current_user.company_id,
        quote_id,
        actor_user_id=current_user.id,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="service_contract.created_from_quote",
        entity_type="service_contract",
        entity_id=contract.id,
        request=request,
        details={"source_quote_id": quote_id},
    )
    return contract


@router.get("/", response_model=list[ServiceContractResponse])
async def read_contracts(
    contract_status: str | None = None,
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: service_contract_service.get_contracts(
            sync_db,
            current_user.company_id,
            contract_status=contract_status,
            skip=skip,
            limit=limit,
        )
    )


@router.get("/{contract_id}", response_model=ServiceContractResponse)
async def read_contract(
    contract_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: service_contract_service.get_contract(
            sync_db,
            current_user.company_id,
            contract_id,
        )
    )


@router.patch("/{contract_id}", response_model=ServiceContractResponse)
def update_contract_terms(
    contract_id: int,
    payload: ServiceContractTermsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    contract = service_contract_service.update_contract_terms(
        db,
        current_user.company_id,
        contract_id,
        payload,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="service_contract.terms_updated",
        entity_type="service_contract",
        entity_id=contract.id,
        request=request,
        details={"changed_fields": sorted(payload.model_fields_set)},
    )
    return contract


@router.post("/{contract_id}/activate", response_model=ServiceContractResponse)
def activate_contract(
    contract_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    contract = service_contract_location_service.activate_contract(
        db,
        current_user.company_id,
        contract_id,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="service_contract.activated",
        entity_type="service_contract",
        entity_id=contract.id,
        request=request,
    )
    return contract
