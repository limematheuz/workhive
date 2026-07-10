from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.company import CompanyPartnerResponse


class CollaborationResponse(BaseModel):
    id: int
    initiator_company_id: int
    partner_company_id: int
    status: str
    role_type: str
    created_at: datetime
    updated_at: datetime
    initiator: CompanyPartnerResponse
    partner: CompanyPartnerResponse

    model_config = ConfigDict(from_attributes=True)


class CollaborationRequestCreate(BaseModel):
    partner_code: str
    role_type: str = "service_provider"
