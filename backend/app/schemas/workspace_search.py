"""Small search projections; individual records retain their own detail policies."""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel

SearchType = Literal["clients", "locations", "tasks", "invoices", "quotes", "staff", "reports", "time", "incidents"]
ResultType = Literal["clients", "locations", "tasks", "invoices", "quotes", "staff", "reports", "time", "incidents", "navigation"]


class SearchItem(BaseModel):
    key: str
    type: ResultType
    id: int | None
    title: str
    context: str
    status: str | None = None
    reference: str | None = None
    href: str
    occurred_at: datetime | None = None


class SearchGroup(BaseModel):
    type: SearchType
    label: str
    items: list[SearchItem]
    has_more: bool


class WorkspaceSearch(BaseModel):
    query: str
    company_id: int
    context_key: str
    available_types: list[SearchType]
    groups: list[SearchGroup]
    navigation: list[SearchItem]
