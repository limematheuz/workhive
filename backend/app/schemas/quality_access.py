from typing import Literal

from pydantic import BaseModel


QualitySection = Literal["templates", "inspections", "incidents", "complaints"]


class QualitySectionAccess(BaseModel):
    can_read: bool
    can_manage: bool
    read_locations: list[int] | None
    manage_locations: list[int] | None


class QualityWorkspaceAccess(BaseModel):
    sections: dict[QualitySection, QualitySectionAccess]
    can_read_locations: bool
