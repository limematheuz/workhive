from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    id: int
    company_id: int | None
    actor_user_id: int | None
    action: str
    entity_type: str
    entity_id: str | None
    request_id: str | None
    ip_address: str | None
    details: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
