from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CalendarOwnershipRequestResponse(BaseModel):
    id: int
    requester_user_id: int
    requester_name: str | None = None
    requester_email: str
    status: str
    created_at: datetime


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
    owner_user_id: int
    owner_name: str | None = None
    owner_email: str | None = None
    is_owner: bool
    can_connect: bool
    can_disconnect: bool
    can_sync: bool
    can_request_ownership: bool
    ownership_request_status: str | None = None
    pending_ownership_requests: list[CalendarOwnershipRequestResponse] = Field(
        default_factory=list
    )


class PlatformCalendarStatus(BaseModel):
    environment_enabled: bool
    google_cloud_configured: bool
    company_connections_enabled: bool
    available: bool
    redirect_uri: str
    timezone: str
    background_sync_enabled: bool
    connected_companies: int
    pending_ownership_requests: int


class PlatformCalendarUpdate(BaseModel):
    company_connections_enabled: bool


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
