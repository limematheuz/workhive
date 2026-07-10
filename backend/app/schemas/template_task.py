from pydantic import BaseModel, ConfigDict


class TemplateTaskBase(BaseModel):
    name: str
    description: str | None = None
    default_price: float | None = None
    unit: str
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class TemplateTaskCreate(TemplateTaskBase):
    pass


class TemplateTaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    default_price: float | None = None
    unit: str | None = None
    is_active: bool | None = None


class TemplateTaskResponse(TemplateTaskBase):
    id: int
    company_id: int
