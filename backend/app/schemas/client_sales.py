from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


OpportunityStage = Literal[
    "new",
    "qualified",
    "proposal",
    "negotiation",
    "won",
    "lost",
]
OpportunityActivityType = Literal["note", "call", "email", "meeting"]
OpportunityActivityResponseType = Literal[
    "note",
    "call",
    "email",
    "meeting",
    "stage_change",
]


class ClientOpportunityBase(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    contact_id: int | None = Field(default=None, gt=0)
    owner_membership_id: int | None = Field(default=None, gt=0)
    stage: OpportunityStage = "new"
    next_follow_up_at: datetime | None = None
    loss_reason: str | None = Field(default=None, max_length=500)

    @field_validator("title", "loss_reason")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank")
        return normalized


class ClientOpportunityCreate(ClientOpportunityBase):
    pass


class ClientOpportunityUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    contact_id: int | None = Field(default=None, gt=0)
    owner_membership_id: int | None = Field(default=None, gt=0)
    stage: OpportunityStage | None = None
    next_follow_up_at: datetime | None = None
    loss_reason: str | None = Field(default=None, max_length=500)

    @field_validator("title", "loss_reason")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank")
        return normalized


class ClientOpportunityResponse(ClientOpportunityBase):
    id: int
    client_id: int
    owner_name: str | None = None
    created_by_user_id: int | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientOpportunityOwnerResponse(BaseModel):
    membership_id: int
    user_id: int
    full_name: str
    email: str
    access_class: Literal["admin", "responsible", "worker"]


class ClientOpportunityActivityCreate(BaseModel):
    activity_type: OpportunityActivityType
    body: str = Field(min_length=1, max_length=2000)
    happened_at: datetime | None = None

    @field_validator("body")
    @classmethod
    def normalize_body(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank")
        return normalized


class ClientOpportunityActivityResponse(BaseModel):
    id: int
    opportunity_id: int
    created_by_user_id: int | None = None
    actor_name: str | None = None
    activity_type: OpportunityActivityResponseType
    body: str | None = None
    stage_from: OpportunityStage | None = None
    stage_to: OpportunityStage | None = None
    happened_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
