import csv
from io import StringIO

from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.location_profile import LocationProfile
from app.schemas.location import LocationCreate
from app.schemas.location_workspace import (
    LocationBulkImportPreview,
    LocationBulkImportResult,
    LocationBulkImportRowResult,
    LocationProfileInput,
    LocationSpaceInput,
)
from app.services import location_catalog_service, location_service


REQUIRED_COLUMNS = {"name", "address", "city"}


def _read_rows(csv_content: str) -> list[dict[str, str]]:
    reader = csv.DictReader(StringIO(csv_content))
    if reader.fieldnames is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="CSV must include a header row")
    fieldnames = {field.strip() for field in reader.fieldnames if field}
    missing = REQUIRED_COLUMNS - fieldnames
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"CSV is missing required columns: {', '.join(sorted(missing))}",
        )
    rows = [
        {(key or "").strip(): (value or "").strip() for key, value in row.items()}
        for row in reader
    ]
    return [row for row in rows if any(row.values())]


def _client_ids(db: Session, company_id: int) -> tuple[dict[str, int], dict[str, int]]:
    clients = db.query(Client).filter(Client.company_id == company_id).all()
    return (
        {str(client.id): client.id for client in clients},
        {client.name.casefold(): client.id for client in clients},
    )


def _validation_messages(error: ValidationError) -> list[str]:
    return [
        f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}"
        for item in error.errors()
    ]


def _parse_rows(db: Session, company_id: int, csv_content: str):
    client_ids, client_names = _client_ids(db, company_id)
    existing_codes = {
        profile.internal_code.casefold()
        for profile in db.query(LocationProfile)
        .filter(
            LocationProfile.company_id == company_id,
            LocationProfile.internal_code.is_not(None),
        )
        .all()
        if profile.internal_code
    }
    seen_codes: set[str] = set()
    parsed: list[LocationCreate | None] = []
    results: list[LocationBulkImportRowResult] = []
    for index, row in enumerate(_read_rows(csv_content), start=2):
        errors: list[str] = []
        name = row.get("name") or None
        address = row.get("address") or None
        city = row.get("city") or None
        if not name:
            errors.append("name is required")
        if not address:
            errors.append("address is required")
        if not city:
            errors.append("city is required")
        site_type = row.get("site_type") or "other"
        internal_code = row.get("internal_code") or None
        if internal_code:
            normalized_code = internal_code.casefold()
            if normalized_code in seen_codes:
                errors.append("internal_code is duplicated in the import")
            seen_codes.add(normalized_code)
            if normalized_code in existing_codes:
                errors.append("internal_code already exists")
        client_id = None
        if row.get("client_id"):
            client_id = client_ids.get(row["client_id"])
            if client_id is None:
                errors.append("client_id is not available to this company")
        elif row.get("client_name"):
            client_id = client_names.get(row["client_name"].casefold())
            if client_id is None:
                errors.append("client_name is not available to this company")
        try:
            profile = LocationProfileInput(site_type=site_type, internal_code=internal_code)
            location_catalog_service.validate_profile(profile)
            spaces = [
                LocationSpaceInput(name=space_name.strip(), space_type="other")
                for space_name in row.get("spaces", "").split("|")
                if space_name.strip()
            ]
        except HTTPException:
            errors.append("site_type is not supported")
            profile = LocationProfileInput()
            spaces = []
        except ValidationError as error:
            errors.extend(_validation_messages(error))
            profile = LocationProfileInput()
            spaces = []
        results.append(LocationBulkImportRowResult(row_number=index, name=name, errors=errors))
        if errors:
            parsed.append(None)
            continue
        try:
            parsed.append(LocationCreate(
                name=name or "",
                address=address or "",
                city=city or "",
                postal_code=row.get("postal_code") or None,
                client_id=client_id,
                profile=profile,
                spaces=spaces,
            ))
        except ValidationError as error:
            results[-1].errors.extend(_validation_messages(error))
            parsed.append(None)
    return parsed, results


def preview_import(
    db: Session,
    company_id: int,
    csv_content: str,
) -> LocationBulkImportPreview:
    _, rows = _parse_rows(db, company_id, csv_content)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="CSV must contain at least one location row",
        )
    return LocationBulkImportPreview(valid=not any(row.errors for row in rows), rows=rows)


def import_locations(
    db: Session,
    company_id: int,
    csv_content: str,
) -> LocationBulkImportResult:
    parsed, rows = _parse_rows(db, company_id, csv_content)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="CSV must contain at least one location row",
        )
    if any(row.errors for row in rows):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Fix every import row before importing locations",
        )
    try:
        for location_data in parsed:
            if location_data is not None:
                location_service.create_location_in_transaction(db, company_id, location_data)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return LocationBulkImportResult(created_count=len(rows), rows=rows)
