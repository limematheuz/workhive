from pydantic import BaseModel, ConfigDict


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
    map_url: str | None = None
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
    map_url: str | None = None
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


class LocationResponse(LocationBase):
    id: int
    can_manage_reservations: bool | None = None
    can_manage_tasks: bool | None = None
    shared_companies: list[int] = []
