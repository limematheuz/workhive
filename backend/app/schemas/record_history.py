from datetime import datetime
from typing import Literal
from pydantic import BaseModel

RecordEntity = Literal["client", "location", "staff_employee", "quote", "service_contract", "work_order", "task_item", "invoice", "expense", "company_membership", "permission_profile"]


class RecordChange(BaseModel):
    field: str
    label: str
    before: str | None
    after: str | None
    before_known: bool


class RecordEvent(BaseModel):
    id: int
    occurred_at: datetime
    actor_name: str
    action: str
    changes: list[RecordChange]
    fields: list[str]


class RecordHistoryResponse(BaseModel):
    items: list[RecordEvent]
    has_more: bool
