from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.schemas.location_access import Weekday


ScalarAttribute = bool | int | float | str


def _trim_optional(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


class LocationProfileInput(BaseModel):
    site_type: str = Field(default="other", min_length=1, max_length=50)
    internal_code: str | None = Field(default=None, max_length=80)
    site_reference: str | None = Field(default=None, max_length=120)
    contact_name: str | None = Field(default=None, max_length=120)
    contact_phone: str | None = Field(default=None, max_length=40)
    contact_email: str | None = Field(default=None, max_length=254)
    service_notes: str | None = Field(default=None, max_length=4000)
    attributes: dict[str, ScalarAttribute] = Field(default_factory=dict)

    _trim_strings = field_validator(
        "internal_code",
        "site_reference",
        "contact_name",
        "contact_phone",
        "contact_email",
        "service_notes",
    )(_trim_optional)


class LocationProfileResponse(LocationProfileInput):
    location_id: int

    model_config = ConfigDict(from_attributes=True)


LocationContactRole = Literal[
    "operations",
    "access",
    "emergency",
    "quality",
    "general",
]


class LocationContactInput(BaseModel):
    id: int | None = Field(default=None, gt=0)
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    role: LocationContactRole = "general"
    is_primary: bool = False
    is_active: bool = True

    @field_validator("full_name", "phone")
    @classmethod
    def normalize_contact_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank")
        return normalized

    @model_validator(mode="after")
    def require_a_contact_method(self):
        if not self.phone and not self.email:
            raise ValueError("A location contact needs an email or phone number")
        if self.is_primary and not self.is_active:
            raise ValueError("An inactive location contact cannot be primary")
        return self


class LocationContactResponse(LocationContactInput):
    id: int
    location_id: int

    model_config = ConfigDict(from_attributes=True)


LocationRiskSeverity = Literal["low", "medium", "high", "critical"]
LocationRiskStatus = Literal["open", "mitigated"]


class LocationRiskInput(BaseModel):
    id: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    severity: LocationRiskSeverity = "medium"
    status: LocationRiskStatus = "open"
    mitigation_notes: str | None = Field(default=None, max_length=2000)

    _trim_strings = field_validator(
        "title", "description", "mitigation_notes"
    )(_trim_optional)


class LocationRiskResponse(LocationRiskInput):
    id: int
    location_id: int

    model_config = ConfigDict(from_attributes=True)


class LocationServiceWindowInput(BaseModel):
    id: int | None = Field(default=None, gt=0)
    label: str | None = Field(default=None, max_length=120)
    days: list[Weekday] = Field(min_length=1, max_length=7)
    starts_at: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    ends_at: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    notes: str | None = Field(default=None, max_length=2000)
    is_active: bool = True

    _trim_strings = field_validator("label", "notes")(_trim_optional)

    @field_validator("days")
    @classmethod
    def unique_days(cls, value: list[Weekday]) -> list[Weekday]:
        if len(value) != len(set(value)):
            raise ValueError("days must not contain duplicates")
        return value

    @model_validator(mode="after")
    def end_must_follow_start(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("A service window must end after it starts")
        return self


class LocationServiceWindowResponse(LocationServiceWindowInput):
    id: int
    location_id: int

    model_config = ConfigDict(from_attributes=True)


class LocationSpaceTaskTemplateInput(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    category: str = Field(default="cleaning", min_length=1, max_length=50)
    frequency: str | None = Field(default=None, max_length=30)
    estimated_minutes: int | None = Field(default=None, ge=1, le=1440)

    _trim_strings = field_validator("title", "category", "frequency")(_trim_optional)


class LocationSpaceTaskTemplateResponse(LocationSpaceTaskTemplateInput):
    id: int
    sort_order: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class LocationSpaceTaskTemplateUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    category: str | None = Field(default=None, min_length=1, max_length=50)
    frequency: str | None = Field(default=None, max_length=30)
    estimated_minutes: int | None = Field(default=None, ge=1, le=1440)
    is_active: bool | None = None

    _trim_strings = field_validator("title", "category", "frequency")(_trim_optional)


class LocationSpaceInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    space_type: str = Field(default="other", min_length=1, max_length=50)
    parent_id: int | None = Field(default=None, gt=0)
    attributes: dict[str, ScalarAttribute] = Field(default_factory=dict)
    tasks: list[LocationSpaceTaskTemplateInput] = Field(default_factory=list, max_length=100)

    _trim_strings = field_validator("name", "space_type")(_trim_optional)


class LocationSpaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    space_type: str | None = Field(default=None, min_length=1, max_length=50)
    parent_id: int | None = Field(default=None, gt=0)
    attributes: dict[str, ScalarAttribute] | None = None
    is_active: bool | None = None

    _trim_strings = field_validator("name", "space_type")(_trim_optional)


class LocationSpaceReorderRequest(BaseModel):
    space_ids: list[int] = Field(min_length=1, max_length=500)

    @field_validator("space_ids")
    @classmethod
    def space_ids_must_be_unique(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("space_ids must not contain duplicates")
        return value


class LocationSpaceResponse(BaseModel):
    id: int
    location_id: int
    parent_id: int | None
    name: str
    space_type: str
    attributes: dict[str, ScalarAttribute] = Field(default_factory=dict)
    sort_order: int
    is_active: bool
    tasks: list[LocationSpaceTaskTemplateResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class LocationCatalogSuggestionRequest(BaseModel):
    site_type: str = Field(min_length=1, max_length=50)
    attributes: dict[str, ScalarAttribute] = Field(default_factory=dict)


class LocationCatalogSpaceSuggestion(LocationSpaceInput):
    pass


class LocationCatalogSuggestionResponse(BaseModel):
    spaces: list[LocationCatalogSpaceSuggestion]


class LocationBulkImportRequest(BaseModel):
    csv_content: str = Field(min_length=1, max_length=1_000_000)


class LocationBulkImportRowResult(BaseModel):
    row_number: int
    name: str | None = None
    errors: list[str] = Field(default_factory=list)


class LocationBulkImportPreview(BaseModel):
    valid: bool
    rows: list[LocationBulkImportRowResult]


class LocationBulkImportResult(BaseModel):
    created_count: int
    rows: list[LocationBulkImportRowResult]


LocationTaskCategory = Literal[
    "cleaning",
    "disinfection",
    "restocking",
    "maintenance",
    "other",
]
