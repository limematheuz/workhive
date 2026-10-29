from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class QualityInspectionTemplateItemInput(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    guidance: str | None = Field(default=None, max_length=2_000)
    is_required: bool = True
    max_points: int = Field(default=1, ge=1, le=100)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("El punto de inspección no puede estar vacío")
        return normalized


class QualityInspectionTemplateCreate(BaseModel):
    location_id: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=5_000)
    items: list[QualityInspectionTemplateItemInput] = Field(min_length=1, max_length=100)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("El nombre no puede estar vacío")
        return normalized


class QualityInspectionTemplateUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=5_000)
    is_active: bool | None = None
    items: list[QualityInspectionTemplateItemInput] | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("title", "is_active", "items")
    @classmethod
    def reject_explicit_null(cls, value):
        if value is None:
            raise ValueError("Value cannot be null")
        return value

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("El nombre no puede estar vacío")
        return normalized


class QualityInspectionTemplateItemResponse(BaseModel):
    id: int
    position: int
    title: str
    guidance: str | None
    is_required: bool
    max_points: int

    model_config = ConfigDict(from_attributes=True)


class QualityInspectionTemplateResponse(BaseModel):
    id: int
    location_id: int | None
    title: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    items: list[QualityInspectionTemplateItemResponse]

    model_config = ConfigDict(from_attributes=True)
