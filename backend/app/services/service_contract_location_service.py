"""Coverage and activation rules for service contracts."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import location as location_repo
from app.repositories import location_workspace as location_workspace_repo
from app.repositories import service_contract as service_contract_repo
from app.services.service_contract_service import get_contract_or_404
from app.services.quote_policy_service import require_quotes_feature


def get_contract_location_candidates(
    db: Session,
    company_id: int,
    contract_id: int,
):
    """Return only locations that the contract may legally cover."""

    require_quotes_feature(db, company_id)
    contract = get_contract_or_404(db, company_id, contract_id)
    if contract.client_id is None:
        return []
    return location_repo.get_locations_by_client(
        db,
        company_id,
        client_id=contract.client_id,
    )


def add_contract_locations(
    db: Session,
    company_id: int,
    contract_id: int,
    location_ids: list[int],
):
    require_quotes_feature(db, company_id)
    contract = get_contract_or_404(db, company_id, contract_id, for_update=True)
    if contract.client_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Assign a registered client before covering locations in a contract",
        )

    unique_location_ids = list(dict.fromkeys(location_ids))
    locations = []
    for location_id in unique_location_ids:
        location = location_repo.get_location_by_id(db, location_id, company_id)
        if location is None or not location.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Location not found",
            )
        if location.client_id != contract.client_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Every covered location must belong to the contract client",
            )
        locations.append(location)

    try:
        for location in locations:
            existing = service_contract_repo.get_contract_location(
                db,
                contract.id,
                location.id,
            )
            if existing is None:
                service_contract_repo.create_contract_location(
                    db,
                    contract_id=contract.id,
                    location_id=location.id,
                )
            elif not existing.is_active:
                service_contract_repo.update_contract(
                    db,
                    existing,
                    is_active=True,
                    covered_until=None,
                )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return service_contract_repo.get_contract(db, company_id, contract_id)


def remove_contract_location(
    db: Session,
    company_id: int,
    contract_id: int,
    location_id: int,
):
    require_quotes_feature(db, company_id)
    contract = get_contract_or_404(db, company_id, contract_id, for_update=True)
    link = service_contract_repo.get_contract_location(db, contract.id, location_id)
    if link is None or not link.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Covered location not found",
        )
    try:
        service_contract_repo.update_contract(
            db,
            link,
            is_active=False,
            covered_until=datetime.now(timezone.utc),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return service_contract_repo.get_contract(db, company_id, contract_id)


def get_contract_location_zone_candidates(
    db: Session,
    company_id: int,
    contract_id: int,
    location_id: int,
):
    require_quotes_feature(db, company_id)
    contract = get_contract_or_404(db, company_id, contract_id)
    link = service_contract_repo.get_contract_location(db, contract.id, location_id)
    if link is None or not link.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Covered location not found",
        )
    return location_workspace_repo.list_spaces(db, location_id)


def replace_contract_location_zones(
    db: Session,
    company_id: int,
    contract_id: int,
    location_id: int,
    zone_ids: list[int],
):
    """Restrict one covered location to its selected active spaces.

    An empty list deliberately means the whole location remains covered.
    """
    require_quotes_feature(db, company_id)
    contract = get_contract_or_404(db, company_id, contract_id, for_update=True)
    link = service_contract_repo.get_contract_location(db, contract.id, location_id)
    if link is None or not link.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Covered location not found",
        )

    requested_zone_ids = list(dict.fromkeys(zone_ids))
    active_zones = {
        zone.id: zone
        for zone in location_workspace_repo.list_spaces(db, location_id)
    }
    if not set(requested_zone_ids).issubset(active_zones):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Every covered space must be active and belong to this location",
        )

    existing = {covered.zone_id: covered for covered in link.covered_zones}
    try:
        for zone_id in requested_zone_ids:
            if zone_id not in existing:
                service_contract_repo.create_contract_location_zone(
                    db,
                    contract_location_id=link.id,
                    zone_id=zone_id,
                )
        for zone_id, covered in existing.items():
            if zone_id not in requested_zone_ids:
                db.delete(covered)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return service_contract_repo.get_contract(db, company_id, contract_id)


def activate_contract(
    db: Session,
    company_id: int,
    contract_id: int,
):
    require_quotes_feature(db, company_id)
    contract = get_contract_or_404(db, company_id, contract_id, for_update=True)
    if contract.status == "active":
        return contract
    if contract.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft contracts can be activated",
        )
    if contract.client_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Assign a registered client before activating a contract",
        )
    if not any(link.is_active for link in contract.covered_locations):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Add at least one covered location before activating a contract",
        )
    try:
        service_contract_repo.update_contract(
            db,
            contract,
            status="active",
            starts_at=contract.starts_at or datetime.now(timezone.utc),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return service_contract_repo.get_contract(db, company_id, contract_id)
