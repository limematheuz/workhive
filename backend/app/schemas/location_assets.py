from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


EquipmentStatus = Literal["active", "maintenance", "retired"]


class LocationDocumentResponse(BaseModel):
    id: int
    name: str
    document_type: str
    content_type: str
    size_bytes: int
    sha256: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LocationDocumentLibraryItem(LocationDocumentResponse):
    location_id: int
    location_name: str


class LocationEquipmentInput(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(default="other", min_length=1, max_length=60)
    serial_number: str | None = Field(default=None, max_length=120)
    quantity: int = Field(default=1, ge=1, le=10_000)
    status: EquipmentStatus = "active"
    next_service_at: date | None = None
    notes: str | None = Field(default=None, max_length=4_000)

    @field_validator("name", "category", "serial_number", "notes")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized and value is not None:
            raise ValueError("Value cannot be blank")
        return normalized


class LocationEquipmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    category: str | None = Field(default=None, min_length=1, max_length=60)
    serial_number: str | None = Field(default=None, max_length=120)
    quantity: int | None = Field(default=None, ge=1, le=10_000)
    status: EquipmentStatus | None = None
    next_service_at: date | None = None
    notes: str | None = Field(default=None, max_length=4_000)

    @field_validator("name", "category", "serial_number", "notes")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        return LocationEquipmentInput.trim_text(value)


class LocationEquipmentResponse(LocationEquipmentInput):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LocationEquipmentLibraryItem(LocationEquipmentResponse):
    location_id: int
    location_name: str
