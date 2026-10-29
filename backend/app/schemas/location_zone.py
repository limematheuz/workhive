from pydantic import BaseModel, ConfigDict, Field, field_validator


class LocationZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    zone_type: str = Field(default="other", min_length=1, max_length=50)


class LocationZoneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    zone_type: str | None = Field(default=None, min_length=1, max_length=50)
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name", "zone_type", "sort_order")
    @classmethod
    def reject_explicit_null(cls, value):
        if value is None:
            raise ValueError("Value cannot be null")
        return value


class LocationZoneResponse(BaseModel):
    id: int
    name: str
    zone_type: str
    sort_order: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TaskZoneResponse(BaseModel):
    id: int
    space_id: int
    name: str
    zone_type: str

    model_config = ConfigDict(from_attributes=True)
