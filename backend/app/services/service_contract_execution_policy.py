"""Validate an occurrence against the contract's persisted validity period."""

from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.models.service_contract import ServiceContract


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def require_occurrence_within_contract(contract: ServiceContract, occurrence_at: datetime) -> None:
    occurrence = _utc(occurrence_at)
    if (
        contract.starts_at is not None and occurrence < _utc(contract.starts_at)
    ) or (
        contract.ends_at is not None and occurrence > _utc(contract.ends_at)
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La ejecución está fuera de la vigencia del contrato",
        )
