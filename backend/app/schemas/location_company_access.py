from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LocationCompanyAccessBase(BaseModel):
    company_id: int
    relationship_type: str = "service_provider"
    can_manage_reservations: bool = False
    can_manage_tasks: bool = False
    can_view_sensitive: bool = False

    model_config = ConfigDict(from_attributes=True)


class LocationCompanyAccessCreate(LocationCompanyAccessBase):
    pass


class LocationCompanyAccessUpdate(BaseModel):
    relationship_type: str | None = None
    can_manage_reservations: bool | None = None
    can_manage_tasks: bool | None = None
    can_view_sensitive: bool | None = None


class LocationCompanyAccessResponse(LocationCompanyAccessBase):
    location_id: int
    created_at: datetime
    updated_at: datetime
