from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class InvoiceEmailContactCreate(BaseModel):
    email: EmailStr
    name: str | None = Field(default=None, max_length=120)


class InvoiceEmailContactResponse(BaseModel):
    id: int
    company_id: int
    name: str | None
    email: EmailStr
    source: str
    use_count: int
    last_used_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
