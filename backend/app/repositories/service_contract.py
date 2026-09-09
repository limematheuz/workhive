from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session, selectinload

from app.models.service_contract import (
    ServiceContract,
    ServiceContractLine,
    ServiceContractLocation,
    ServiceContractLocationZone,
)


def _lock_numbering(db: Session, company_id: int, year: int) -> None:
    if db.bind and db.bind.dialect.name == "postgresql":
        db.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
            {"lock_key": f"service-contract:{company_id}:{year}"},
        )


def _generate_contract_number(db: Session, company_id: int) -> str:
    year = datetime.now(timezone.utc).year
    _lock_numbering(db, company_id, year)
    prefix = f"CON-{year}-"
    numbers = (
        db.query(ServiceContract.contract_number)
        .filter(
            ServiceContract.company_id == company_id,
            ServiceContract.contract_number.like(f"{prefix}%"),
        )
        .all()
    )
    last_sequence = 0
    for (number,) in numbers:
        try:
            last_sequence = max(last_sequence, int(number.removeprefix(prefix)))
        except ValueError:
            continue
    return f"{prefix}{last_sequence + 1:04d}"


def _contract_options():
    return (
        selectinload(ServiceContract.service_lines),
        selectinload(ServiceContract.covered_locations).selectinload(
            ServiceContractLocation.location
        ),
        selectinload(ServiceContract.covered_locations)
        .selectinload(ServiceContractLocation.covered_zones)
        .selectinload(ServiceContractLocationZone.zone),
    )


def get_contracts(
    db: Session,
    company_id: int,
    *,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[ServiceContract]:
    query = db.query(ServiceContract).options(*_contract_options()).filter(
        ServiceContract.company_id == company_id
    )
    if status is not None:
        query = query.filter(ServiceContract.status == status)
    return (
        query.order_by(ServiceContract.created_at.desc(), ServiceContract.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_contract(
    db: Session,
    company_id: int,
    contract_id: int,
) -> ServiceContract | None:
    return (
        db.query(ServiceContract)
        .options(*_contract_options())
        .filter(
            ServiceContract.id == contract_id,
            ServiceContract.company_id == company_id,
        )
        .one_or_none()
    )


def get_contract_for_update(
    db: Session,
    company_id: int,
    contract_id: int,
) -> ServiceContract | None:
    query = (
        db.query(ServiceContract)
        .options(*_contract_options())
        .filter(
            ServiceContract.id == contract_id,
            ServiceContract.company_id == company_id,
        )
    )
    if db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()


def get_contract_by_source_quote(
    db: Session,
    company_id: int,
    quote_id: int,
) -> ServiceContract | None:
    return (
        db.query(ServiceContract)
        .options(*_contract_options())
        .filter(
            ServiceContract.company_id == company_id,
            ServiceContract.source_quote_id == quote_id,
        )
        .one_or_none()
    )


def create_contract(
    db: Session,
    *,
    company_id: int,
    client_id: int | None,
    source_quote_id: int,
    source_quote_revision_id: int,
    title: str,
    quote_snapshot: dict,
    created_by_user_id: int | None,
) -> ServiceContract:
    contract = ServiceContract(
        company_id=company_id,
        client_id=client_id,
        source_quote_id=source_quote_id,
        source_quote_revision_id=source_quote_revision_id,
        contract_number=_generate_contract_number(db, company_id),
        title=title,
        quote_snapshot=quote_snapshot,
        created_by_user_id=created_by_user_id,
    )
    db.add(contract)
    db.flush()
    return contract


def create_contract_line(
    db: Session,
    *,
    contract_id: int,
    position: int,
    description: str,
    quantity: float,
    unit_price: float,
    subtotal: float,
) -> ServiceContractLine:
    line = ServiceContractLine(
        contract_id=contract_id,
        position=position,
        description=description,
        quantity=quantity,
        unit_price=unit_price,
        subtotal=subtotal,
    )
    db.add(line)
    db.flush()
    return line


def update_contract(
    db: Session,
    contract: ServiceContract,
    **values,
) -> ServiceContract:
    for key, value in values.items():
        setattr(contract, key, value)
    db.add(contract)
    db.flush()
    return contract


def get_contract_location(
    db: Session,
    contract_id: int,
    location_id: int,
) -> ServiceContractLocation | None:
    return (
        db.query(ServiceContractLocation)
        .filter(
            ServiceContractLocation.contract_id == contract_id,
            ServiceContractLocation.location_id == location_id,
        )
        .one_or_none()
    )


def create_contract_location(
    db: Session,
    *,
    contract_id: int,
    location_id: int,
) -> ServiceContractLocation:
    link = ServiceContractLocation(contract_id=contract_id, location_id=location_id)
    db.add(link)
    db.flush()
    return link


def create_contract_location_zone(
    db: Session,
    *,
    contract_location_id: int,
    zone_id: int,
) -> ServiceContractLocationZone:
    link = ServiceContractLocationZone(
        contract_location_id=contract_location_id,
        zone_id=zone_id,
    )
    db.add(link)
    db.flush()
    return link
