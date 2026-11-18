"""Administrative portal projections exclude invitation tokens and document bodies."""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel

class PortalAccess(BaseModel):
    id: int
    email: str
    name: str | None
    status: Literal['active', 'revoked', 'suspended', 'expired']
    expires_at: datetime | None

class PortalPendingInvitation(BaseModel):
    id: int
    email: str
    status: Literal['pending', 'expired']
    expires_at: datetime

class PortalClient(BaseModel):
    id: int
    name: str
    grants: list[PortalAccess]
    invitations: list[PortalPendingInvitation]

class PortalAdviser(PortalAccess):
    accounting: bool
    payroll: bool

class PortalSummary(BaseModel):
    active_client_accesses: int
    pending_invitations: int

class PortalModules(BaseModel):
    client_portal: bool
    advisory: bool
    worker_app: bool = False

class PortalWorkspace(BaseModel):
    clients: list[PortalClient]
    has_more: bool
    advisers: list[PortalAdviser]
    summary: PortalSummary
    modules: PortalModules
    invitation_delivery_configured: bool
    can_manage_client_invitations: bool
