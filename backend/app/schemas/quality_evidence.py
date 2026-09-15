from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class QualityEvidenceCreate(BaseModel):
    file_name: str | None = Field(default=None, max_length=255)
    caption: str | None = Field(default=None, max_length=1_000)

    model_config = ConfigDict(extra="forbid")

    @field_validator("file_name", "caption")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class QualityEvidenceResponse(BaseModel):
    id: int
    file_name: str | None
    caption: str | None
    media_url: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
