from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


Weekday = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _trim_optional(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip() or None


class LocationAccessInput(BaseModel):
    permitted_days: list[Weekday] = Field(default_factory=list, max_length=7)
    permitted_from: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    permitted_until: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    requires_outside_hours_authorization: bool | None = None
    access_method: str | None = Field(default=None, max_length=50)
    keys_available: bool | None = None
    keys_location: str | None = Field(default=None, max_length=160)
    key_custodian: str | None = Field(default=None, max_length=120)
    instructions: str | None = Field(default=None, max_length=4000)
    access_code: str | None = Field(default=None, max_length=500)
    clear_access_code: bool = False

    _trim_strings = field_validator(
        "permitted_from",
        "permitted_until",
        "access_method",
        "keys_location",
        "key_custodian",
        "instructions",
        "access_code",
    )(_trim_optional)

    @field_validator("permitted_days")
    @classmethod
    def validate_days(cls, value: list[Weekday]) -> list[Weekday]:
        if len(value) != len(set(value)):
            raise ValueError("permitted_days must not contain duplicates")
        return value

    @model_validator(mode="after")
    def validate_code_clear_action(self):
        if self.clear_access_code and self.access_code:
            raise ValueError("Provide access_code or clear_access_code, not both")
        return self


class LocationAccessResponse(BaseModel):
    location_id: int
    permitted_days: list[Weekday] = Field(default_factory=list)
    permitted_from: str | None = None
    permitted_until: str | None = None
    requires_outside_hours_authorization: bool = False
    access_method: str | None = None
    keys_available: bool | None = None
    keys_location: str | None = None
    key_custodian: str | None = None
    instructions: str | None = None
    has_access_code: bool = False

    model_config = ConfigDict(from_attributes=True)
