from pydantic import BaseModel, ConfigDict


class LocationTemplateTaskSummary(BaseModel):
    id: int
    name: str
    description: str | None = None
    default_price: float | None = None
    unit: str
    company_id: int

    model_config = ConfigDict(from_attributes=True)


class LocationTemplateBase(BaseModel):
    template_task_id: int
    custom_price: float | None = None
    custom_name: str | None = None
    custom_description: str | None = None
    custom_unit: str | None = None

    model_config = ConfigDict(from_attributes=True)


class LocationTemplateCreate(LocationTemplateBase):
    pass


class LocationTemplateUpdate(BaseModel):
    custom_price: float | None = None
    custom_name: str | None = None
    custom_description: str | None = None
    custom_unit: str | None = None


class LocationTemplateResponse(LocationTemplateBase):
    location_id: int
    template: LocationTemplateTaskSummary
