from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CompanyFiscalSettingsUpdate(BaseModel):
    enabled: bool | None = None
    environment: Literal["test", "production"] | None = None
    quarterly_vat_enabled: bool | None = None
    quarterly_withholding_enabled: bool | None = None
    fiscal_reminder_days: int | None = Field(default=None, ge=1, le=30)


class CompanyFiscalSettingsResponse(BaseModel):
    enabled: bool
    global_enabled: bool
    company_enabled: bool
    environment: Literal["test", "production"]
    quarterly_vat_enabled: bool
    quarterly_withholding_enabled: bool
    fiscal_reminder_days: int
    certificate_configured: bool
    certificate_uploaded_at: datetime | None = None
    producer_configured: bool
    official_schemas_available: bool
    submission_available: bool
    endpoint: str
    missing_fields: list[str]
