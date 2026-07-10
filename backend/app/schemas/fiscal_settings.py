from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CompanyFiscalSettingsUpdate(BaseModel):
    enabled: bool | None = None
    environment: Literal["test", "production"] | None = None


class CompanyFiscalSettingsResponse(BaseModel):
    enabled: bool
    global_enabled: bool
    company_enabled: bool
    environment: Literal["test", "production"]
    certificate_configured: bool
    certificate_uploaded_at: datetime | None = None
    producer_configured: bool
    official_schemas_available: bool
    submission_available: bool
    endpoint: str
    missing_fields: list[str]
