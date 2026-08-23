from pydantic import BaseModel, ConfigDict, Field


class LocationZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    zone_type: str = Field(default="other", min_length=1, max_length=50)


class LocationZoneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    zone_type: str | None = Field(default=None, min_length=1, max_length=50)
    sort_order: int | None = Field(default=None, ge=0)


class LocationZoneResponse(BaseModel):
    id: int
    name: str
    zone_type: str
    sort_order: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TaskZoneResponse(BaseModel):
    id: int
    name: str
    zone_type: str

    model_config = ConfigDict(from_attributes=True)
