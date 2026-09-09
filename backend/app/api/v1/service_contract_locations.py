"""Location and zone coverage routes for service contracts."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import ActiveFinanceManager, get_db
from app.models.user import User
from app.schemas.location import LocationResponse
from app.schemas.location_workspace import LocationSpaceResponse
from app.schemas.service_contract import (
    ServiceContractLocationsUpdate,
    ServiceContractLocationZonesUpdate,
    ServiceContractResponse,
)
from app.services import audit_service, service_contract_location_service


router = APIRouter()


@router.get("/location-candidates", response_model=list[LocationResponse])
def read_contract_location_candidates(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    return service_contract_location_service.get_contract_location_candidates(
        db,
        current_user.company_id,
        contract_id,
    )


@router.post("/locations", response_model=ServiceContractResponse)
def add_contract_locations(
    contract_id: int,
    payload: ServiceContractLocationsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    contract = service_contract_location_service.add_contract_locations(
        db,
        current_user.company_id,
        contract_id,
        payload.location_ids,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="service_contract.locations_added",
        entity_type="service_contract",
        entity_id=contract.id,
        request=request,
        details={"location_ids": sorted(set(payload.location_ids))},
    )
    return contract


@router.delete("/locations/{location_id}", response_model=ServiceContractResponse)
def remove_contract_location(
    contract_id: int,
    location_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    contract = service_contract_location_service.remove_contract_location(
        db,
        current_user.company_id,
        contract_id,
        location_id,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="service_contract.location_removed",
        entity_type="service_contract",
        entity_id=contract.id,
        request=request,
        details={"location_id": location_id},
    )
    return contract


@router.get(
    "/locations/{location_id}/zone-candidates",
    response_model=list[LocationSpaceResponse],
)
def read_contract_location_zone_candidates(
    contract_id: int,
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    return service_contract_location_service.get_contract_location_zone_candidates(
        db,
        current_user.company_id,
        contract_id,
        location_id,
    )


@router.put("/locations/{location_id}/zones", response_model=ServiceContractResponse)
def replace_contract_location_zones(
    contract_id: int,
    location_id: int,
    payload: ServiceContractLocationZonesUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    contract = service_contract_location_service.replace_contract_location_zones(
        db,
        current_user.company_id,
        contract_id,
        location_id,
        payload.zone_ids,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="service_contract.location_zones_updated",
        entity_type="service_contract",
        entity_id=contract.id,
        request=request,
        details={"location_id": location_id, "zone_ids": sorted(set(payload.zone_ids))},
    )
    return contract
