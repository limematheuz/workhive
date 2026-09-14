from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.quality_evidence import QualityEvidenceResponse


InspectionStatus = Literal["draft", "completed"]
InspectionItemStatus = Literal["not_assessed", "passed", "failed"]


class QualityInspectionCreate(BaseModel):
    template_id: int = Field(gt=0)
    location_id: int = Field(gt=0)
    notes: str | None = Field(default=None, max_length=5_000)


class QualityInspectionItemUpdate(BaseModel):
    id: int = Field(gt=0)
    status: InspectionItemStatus
    points_awarded: int = Field(ge=0, le=100)
    notes: str | None = Field(default=None, max_length=2_000)

    @model_validator(mode="after")
    def validate_assessment(self):
        if self.status == "not_assessed" and self.points_awarded != 0:
            raise ValueError("Un punto pendiente no puede tener puntuación")
        return self


class QualityInspectionReview(BaseModel):
    notes: str | None = Field(default=None, max_length=5_000)
    items: list[QualityInspectionItemUpdate] = Field(min_length=1, max_length=100)

    @field_validator("items")
    @classmethod
    def reject_duplicate_items(cls, value: list[QualityInspectionItemUpdate]):
        identifiers = [item.id for item in value]
        if len(set(identifiers)) != len(identifiers):
            raise ValueError("Los puntos de inspección no se pueden repetir")
        return value


class QualityInspectionConformityCreate(BaseModel):
    confirmed: bool


class QualityInspectionConformityResponse(BaseModel):
    signer_name: str
    statement_version: str
    signed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QualityInspectionClientAcceptanceResponse(BaseModel):
    signer_name: str
    signer_email: str
    statement_version: str
    signed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QualityInspectionItemResponse(BaseModel):
    id: int
    position: int
    title: str
    guidance: str | None
    is_required: bool
    max_points: int
    status: InspectionItemStatus
    points_awarded: int
    notes: str | None

    model_config = ConfigDict(from_attributes=True)


class QualityInspectionResponse(BaseModel):
    id: int
    location_id: int
    template_id: int | None
    template_title: str
    status: InspectionStatus
    notes: str | None
    created_at: datetime
    completed_at: datetime | None
    score: int
    max_score: int
    conformity: QualityInspectionConformityResponse | None
    client_acceptance: QualityInspectionClientAcceptanceResponse | None
    items: list[QualityInspectionItemResponse]
    evidence: list[QualityEvidenceResponse]

    model_config = ConfigDict(from_attributes=True)
