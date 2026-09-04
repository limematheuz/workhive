from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class PartnerPortalGrantCreate(BaseModel):
    user_id: int


class PartnerPortalGrantResponse(BaseModel):
    id: int
    host_company_id: int
    partner_company_id: int
    collaboration_id: int
    user_id: int
    status: str
    expires_at: datetime | None
    created_at: datetime
    revoked_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class PartnerPortalCandidateResponse(BaseModel):
    id: int
    full_name: str | None
    email: EmailStr
    role_name: str
    eligible: bool
    ineligible_reason: str | None = None


class PartnerPortalOverviewResponse(BaseModel):
    host_company_id: int
    host_company_name: str
    partner_company_id: int
    partner_company_name: str
    location_count: int
    upcoming_reservation_count: int
    pending_cleaning_count: int
