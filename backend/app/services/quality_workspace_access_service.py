"""Presentation of quality scopes using the operation authorization resolver."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.quality_access import QualitySectionAccess, QualityWorkspaceAccess
from app.services.organization_authorization_service import (
    permitted_location_ids,
    resolve_location_capabilities,
)


SECTIONS = ("templates", "inspections", "incidents", "complaints")


def _has_locations(scope: set[int] | None) -> bool:
    return scope is None or bool(scope)


def _visible_management(
    read: set[int] | None, manage: set[int] | None
) -> set[int] | None:
    if read is None:
        return manage
    if manage is None:
        return read
    return read & manage


def quality_workspace_access(db: Session, current_user: User) -> QualityWorkspaceAccess:
    sections = {}
    for section in SECTIONS:
        try:
            read, manage, _ = resolve_location_capabilities(
                db,
                current_user,
                read_capability=f"quality.{section}.read",
                manage_capability=f"quality.{section}.manage",
            )
        except HTTPException as error:
            if error.status_code not in {403, 404}:
                raise
            read, manage = set(), set()
        manage = _visible_management(read, manage)
        sections[section] = QualitySectionAccess(
            can_read=_has_locations(read),
            can_manage=_has_locations(manage),
            read_locations=None if read is None else sorted(read),
            manage_locations=None if manage is None else sorted(manage),
        )
    try:
        can_read_locations = _has_locations(
            permitted_location_ids(db, current_user, "locations.read")
        )
    except HTTPException as error:
        if error.status_code not in {403, 404}:
            raise
        can_read_locations = False
    return QualityWorkspaceAccess(
        sections=sections, can_read_locations=can_read_locations
    )
