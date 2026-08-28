from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


AccessClass = Literal["admin", "responsible", "worker"]
MembershipStatus = Literal["active", "suspended", "archived"]
ScopeType = Literal["company", "department", "team", "location"]


class OrganizationMemberProfileScopeInput(BaseModel):
    scope_type: ScopeType
    scope_id: int = Field(gt=0)


class OrganizationMemberProfileAssignmentInput(BaseModel):
    permission_profile_id: int = Field(gt=0)
    scopes: list[OrganizationMemberProfileScopeInput] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def reject_duplicate_scopes(self) -> "OrganizationMemberProfileAssignmentInput":
        keys = {(scope.scope_type, scope.scope_id) for scope in self.scopes}
        if len(keys) != len(self.scopes):
            raise ValueError("A permission profile cannot repeat the same scope")
        return self


class OrganizationMemberProfileScopeResponse(OrganizationMemberProfileScopeInput):
    id: int

    model_config = ConfigDict(from_attributes=True)


class OrganizationMemberProfileAssignmentResponse(BaseModel):
    id: int
    permission_profile_id: int
    permission_profile_name: str
    scopes: list[OrganizationMemberProfileScopeResponse]

    model_config = ConfigDict(from_attributes=True)


class OrganizationMemberResponse(BaseModel):
    id: int
    user_id: int
    full_name: str | None
    email: str
    access_class: AccessClass
    status: MembershipStatus
    legacy_role_name: str | None
    department_ids: list[int]
    team_ids: list[int]
    profile_assignments: list[OrganizationMemberProfileAssignmentResponse]


class OrganizationMemberUpdate(BaseModel):
    access_class: AccessClass | None = None
    status: MembershipStatus | None = None
    department_ids: list[int] | None = Field(default=None, max_length=100)
    team_ids: list[int] | None = Field(default=None, max_length=100)

    @field_validator("department_ids", "team_ids")
    @classmethod
    def reject_duplicate_ids(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return value
        if any(identifier <= 0 for identifier in value):
            raise ValueError("Identifiers must be positive")
        if len(set(value)) != len(value):
            raise ValueError("Identifiers cannot be duplicated")
        return value


class OrganizationMemberProfileAssignmentsUpdate(BaseModel):
    assignments: list[OrganizationMemberProfileAssignmentInput] = Field(max_length=50)

    @field_validator("assignments")
    @classmethod
    def reject_duplicate_profiles(
        cls,
        value: list[OrganizationMemberProfileAssignmentInput],
    ) -> list[OrganizationMemberProfileAssignmentInput]:
        profile_ids = [assignment.permission_profile_id for assignment in value]
        if len(set(profile_ids)) != len(profile_ids):
            raise ValueError("A member cannot receive the same permission profile twice")
        return value


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=50)
    parent_department_id: int | None = Field(default=None, gt=0)

    @field_validator("name", "code")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=50)
    parent_department_id: int | None = Field(default=None, gt=0)
    is_active: bool | None = None

    @field_validator("name", "code")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class DepartmentResponse(BaseModel):
    id: int
    name: str
    code: str | None
    parent_department_id: int | None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=50)
    department_id: int | None = Field(default=None, gt=0)

    @field_validator("name", "code")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class TeamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=50)
    department_id: int | None = Field(default=None, gt=0)
    is_active: bool | None = None

    @field_validator("name", "code")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class TeamResponse(BaseModel):
    id: int
    name: str
    code: str | None
    department_id: int | None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class PermissionDefinitionResponse(BaseModel):
    id: int
    code: str
    category: str
    description: str

    model_config = ConfigDict(from_attributes=True)


class PermissionProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2_000)
    permission_codes: list[str] = Field(min_length=1, max_length=100)

    @field_validator("name", "description")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("permission_codes")
    @classmethod
    def normalize_permission_codes(cls, value: list[str]) -> list[str]:
        normalized = [code.strip() for code in value]
        if any(not code for code in normalized) or len(set(normalized)) != len(normalized):
            raise ValueError("Permission codes must be unique and non-empty")
        return normalized


class PermissionProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2_000)
    permission_codes: list[str] | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None

    @field_validator("name", "description")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("permission_codes")
    @classmethod
    def normalize_permission_codes(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        normalized = [code.strip() for code in value]
        if any(not code for code in normalized) or len(set(normalized)) != len(normalized):
            raise ValueError("Permission codes must be unique and non-empty")
        return normalized


class PermissionProfileResponse(BaseModel):
    id: int
    name: str
    description: str | None
    is_system: bool
    is_active: bool
    permission_codes: list[str]
    created_at: datetime
    updated_at: datetime
