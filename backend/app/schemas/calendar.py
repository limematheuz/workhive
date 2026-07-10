from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CalendarConnectedUser(BaseModel):
    user_id: int
    google_account_email: str | None = None
    calendar_name: str | None = None
    status: str
    last_sync_at: datetime | None = None


class CalendarConnectionStatus(BaseModel):
    enabled: bool
    configured: bool
    connected: bool
    status: str
    user_id: int
    google_account_email: str | None = None
    calendar_name: str | None = None
    last_sync_at: datetime | None = None
    last_error: str | None = None
    pending_jobs: int = 0
    connected_users: list[CalendarConnectedUser] = []


class CalendarOAuthStartResponse(BaseModel):
    authorization_url: str


class CalendarSyncResponse(BaseModel):
    imported: int
    exported: int
    deleted: int
    failed: int
    last_sync_at: datetime


class CalendarEventLinkResponse(BaseModel):
    task_id: int
    external_event_id: str
    external_html_link: str | None = None
    status: str

    model_config = ConfigDict(from_attributes=True)
