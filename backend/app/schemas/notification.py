from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    id: int
    event_type: str
    title: str
    message: str
    entity_type: str | None
    entity_id: int | None
    href: str
    metadata_json: dict
    read_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
