from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TemplateTaskBase(BaseModel):
    name: str
    description: str | None = None
    default_price: float | None = None
    unit: str
    pricing_mode: Literal["fixed", "hourly"] = "fixed"
    estimated_duration_minutes: int | None = Field(default=None, gt=0)
    requirements: str | None = Field(default=None, max_length=2000)
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class TemplateTaskCreate(TemplateTaskBase):
    pass


class TemplateTaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    default_price: float | None = None
    unit: str | None = None
    pricing_mode: Literal["fixed", "hourly"] | None = None
    estimated_duration_minutes: int | None = Field(default=None, gt=0)
    requirements: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


class TemplateTaskResponse(TemplateTaskBase):
    id: int
    company_id: int
    catalog_version: int


class ServiceCatalogVersionResponse(BaseModel):
    id: int
    template_task_id: int
    version: int
    name: str
    description: str | None = None
    default_price: float | None = None
    unit: str
    pricing_mode: Literal["fixed", "hourly"]
    estimated_duration_minutes: int | None = None
    requirements: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
