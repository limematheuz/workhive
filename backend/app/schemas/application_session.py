"""Public shape of server-enumerated application contexts."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

ApplicationKind = Literal["internal", "worker", "client", "adviser"]


class ApplicationChoice(BaseModel):
    key: str
    kind: ApplicationKind
    label: str
    description: str
    company_id: int | None
    company_name: str | None
    href: str


class ApplicationOptions(BaseModel):
    current_application: ApplicationKind
    current_key: str | None
    applications: list[ApplicationChoice]


class ApplicationSwitch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str = Field(min_length=1, max_length=120)


class ApplicationSwitched(BaseModel):
    access_token: str
    token_type: Literal["bearer"]
    application: ApplicationChoice
    target_path: str
    csrf_token: str
