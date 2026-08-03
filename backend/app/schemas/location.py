from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator


ALLOWED_MAP_URL_HOSTS = {
    "google.com",
    "www.google.com",
    "maps.google.com",
    "maps.app.goo.gl",
    "waze.com",
    "www.waze.com",
}


def validate_map_url(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    parsed = urlparse(normalized)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_MAP_URL_HOSTS:
        raise ValueError("Map URL must be an HTTPS Google Maps or Waze URL")
    return normalized


class RoomSchema(BaseModel):
    id: str | int | None = None
    name: str
    double_beds: int = 0
    single_beds: int = 0
    bunk_beds: int = 0


class LocationBase(BaseModel):
    name: str
    address: str
    city: str
    postal_code: str | None = None
    photo_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    map_url: str | None = Field(default=None, max_length=2048)
    location_type: str | None = "private"
    num_bathrooms: int | None = 0
    has_garage: bool | None = False
    has_kitchen: bool | None = False
    has_terrace: bool | None = False
    rooms: list[RoomSchema] | None = None
    checkout_checklist: list[str] | None = None
    max_capacity: int | None = 0
    is_active: bool = True
    client_id: int | None = None
    managing_company_id: int | None = None
    owner_company_id: int | None = None
    default_service_provider_id: int | None = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("map_url")
    @classmethod
    def validate_map_url_value(cls, value: str | None) -> str | None:
        return validate_map_url(value)


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    city: str | None = None
    postal_code: str | None = None
    photo_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    map_url: str | None = Field(default=None, max_length=2048)
    location_type: str | None = None
    num_bathrooms: int | None = None
    has_garage: bool | None = None
    has_kitchen: bool | None = None
    has_terrace: bool | None = None
    rooms: list[RoomSchema] | None = None
    checkout_checklist: list[str] | None = None
    max_capacity: int | None = None
    is_active: bool | None = None
    client_id: int | None = None
    default_service_provider_id: int | None = None

    @field_validator("map_url")
    @classmethod
    def validate_map_url_value(cls, value: str | None) -> str | None:
        return validate_map_url(value)


class LocationResponse(LocationBase):
    id: int
    can_manage_reservations: bool | None = None
    can_manage_tasks: bool | None = None
    shared_companies: list[int] = []
