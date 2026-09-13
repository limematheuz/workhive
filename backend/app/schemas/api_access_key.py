"""Contracts for managing a public read-only API credential."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


ApiAccessScope = Literal["work_orders.read", "reservations.write"]


class ApiAccessKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    scopes: list[ApiAccessScope] = Field(min_length=1, max_length=8)
    expires_at: datetime | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("scopes")
    @classmethod
    def scopes_are_unique(cls, value: list[ApiAccessScope]) -> list[ApiAccessScope]:
        if len(value) != len(set(value)):
            raise ValueError("API key scopes must be unique")
        return value


class ApiAccessKeyResponse(BaseModel):
    id: int
    name: str
    key_prefix: str
    scopes: list[ApiAccessScope]
    status: Literal["active", "revoked"]
    expires_at: datetime | None
    last_used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiAccessKeyCreated(ApiAccessKeyResponse):
    api_key: str
