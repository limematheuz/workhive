from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.permission_profile import PermissionProfile, PermissionProfilePermission
from app.models.user import User
from app.repositories import organization as organization_repo
from app.schemas.organization import (
    PermissionDefinitionResponse,
    PermissionProfileCreate,
    PermissionProfileResponse,
    PermissionProfileUpdate,
)
from app.services.organization_service_shared import (
    CAPABILITY_PROFILES_MANAGE,
    CAPABILITY_PROFILES_READ,
    conflict,
    not_found,
    require_capability,
)
from app.services.organization_permission_policy import (
    is_system_only_permission,
    recommended_audiences,
    require_custom_profile_permissions_assignable,
)


def profile_response(
    db: Session, profile: PermissionProfile
) -> PermissionProfileResponse:
    usage = organization_repo.get_permission_profile_usage(
        db=db, company_id=profile.company_id, profile_id=profile.id
    )
    return PermissionProfileResponse(
        id=profile.id,
        name=profile.name,
        description=profile.description,
        is_system=profile.is_system,
        is_active=profile.is_active,
        permission_codes=sorted(
            permission.permission_definition.code
            for permission in profile.permissions
            if permission.permission_definition is not None
        ),
        usage={
            "assignments": usage["assignments"],
            "can_delete": not profile.is_system and usage["assignments"] == 0,
        },
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


def list_permission_definitions(
    db: Session, current_user: User
) -> list[PermissionDefinitionResponse]:
    require_capability(db, current_user, CAPABILITY_PROFILES_READ)
    return [
        PermissionDefinitionResponse(
            id=definition.id,
            code=definition.code,
            category=definition.category,
            description=definition.description,
            is_system_only=is_system_only_permission(definition.code),
            recommended_for=list(recommended_audiences(definition.code)),
        )
        for definition in organization_repo.list_permission_definitions(db)
    ]


def list_permission_profiles(
    db: Session, current_user: User
) -> list[PermissionProfileResponse]:
    company_id = require_capability(db, current_user, CAPABILITY_PROFILES_READ)
    return [
        profile_response(db, profile)
        for profile in organization_repo.list_permission_profiles(db, company_id)
    ]


def permission_definitions_for_codes(db: Session, codes: list[str]):
    require_custom_profile_permissions_assignable(codes)
    definitions = organization_repo.get_permission_definitions_by_codes(db, codes)
    if {definition.code for definition in definitions} != set(codes):
        conflict("One or more permission codes are unavailable")
    return definitions


def create_permission_profile(
    db: Session,
    payload: PermissionProfileCreate,
    current_user: User,
) -> PermissionProfileResponse:
    company_id = require_capability(db, current_user, CAPABILITY_PROFILES_MANAGE)
    definitions = permission_definitions_for_codes(db, payload.permission_codes)
    profile = PermissionProfile(
        company_id=company_id,
        name=payload.name,
        description=payload.description,
        is_system=False,
        is_active=True,
    )
    db.add(profile)
    db.flush()
    for definition in definitions:
        db.add(
            PermissionProfilePermission(
                permission_profile_id=profile.id,
                permission_definition_id=definition.id,
            )
        )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        conflict("A permission profile with this name already exists")
    persisted = organization_repo.get_permission_profile(
        db, company_id=company_id, profile_id=profile.id
    )
    if not persisted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return profile_response(db, persisted)


def update_permission_profile(
    db: Session,
    profile_id: int,
    payload: PermissionProfileUpdate,
    current_user: User,
) -> PermissionProfileResponse:
    company_id = require_capability(db, current_user, CAPABILITY_PROFILES_MANAGE)
    profile = organization_repo.get_permission_profile(
        db, company_id=company_id, profile_id=profile_id
    )
    if not profile:
        not_found("Permission profile")
    if profile.is_system:
        conflict("System permission profiles are managed by WorkHive")
    updates = payload.model_dump(exclude_unset=True)
    permission_codes = updates.pop("permission_codes", None)
    for field, value in updates.items():
        setattr(profile, field, value)
    if permission_codes is not None:
        definitions = permission_definitions_for_codes(db, permission_codes)
        profile.permissions.clear()
        db.flush()
        for definition in definitions:
            profile.permissions.append(
                PermissionProfilePermission(permission_definition_id=definition.id)
            )
    db.add(profile)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        conflict("A permission profile with this name already exists")
    refreshed = organization_repo.get_permission_profile(
        db, company_id=company_id, profile_id=profile_id
    )
    if not refreshed:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return profile_response(db, refreshed)


def delete_permission_profile(
    db: Session,
    profile_id: int,
    current_user: User,
) -> None:
    company_id = require_capability(db, current_user, CAPABILITY_PROFILES_MANAGE)
    profile = organization_repo.get_permission_profile(
        db, company_id=company_id, profile_id=profile_id
    )
    if not profile:
        not_found("Permission profile")
    if profile.is_system:
        conflict("System permission profiles are managed by WorkHive")
    usage = organization_repo.get_permission_profile_usage(
        db, company_id=company_id, profile_id=profile_id
    )
    if usage["assignments"]:
        conflict("This permission profile is still assigned to one or more people")
    db.delete(profile)
    db.commit()
