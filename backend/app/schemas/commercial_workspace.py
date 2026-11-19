"""Company-wide CRM projections; writes use the canonical client sales schemas."""
from typing import Literal
from pydantic import BaseModel
from app.schemas.client_sales import ClientOpportunityResponse

class CommercialAccount(BaseModel):
    id: int
    name: str
    relationship_status: Literal['lead', 'client']

class CommercialQuoteLink(BaseModel):
    id: int
    number: str
    status: str

class CommercialOpportunity(ClientOpportunityResponse):
    client_name: str
    relationship_status: Literal['lead', 'client']
    linked_quotes: list[CommercialQuoteLink]

class CommercialSummary(BaseModel):
    stages: dict[str, int]
    overdue: int
    unscheduled: int
    leads: int
    win_rate: float | None

class CommercialAccess(BaseModel):
    can_manage: bool
    can_create_account: bool
    can_view_quotes: bool
    can_calculate: bool

class CommercialWorkspace(BaseModel):
    timezone: str
    items: list[CommercialOpportunity]
    has_more: bool
    summary: CommercialSummary
    access: CommercialAccess
