from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from app.models.user import User
from app.schemas.user import UserStatsResponse, UserUpdate
from app.repositories import user as user_repo
from app.repositories import role as role_repo
from app.repositories import organization as organization_repo
from app.services.company_member_user_views import views as member_user_views
from app.core.security import get_password_hash, verify_password
from app.services import organization_bootstrap_service
from app.services.external_access_policy import EXTERNAL_PORTAL_ROLE_NAME
from app.services.user_access_update_policy import (
    enforce_internal_membership_update,
    sync_external_portal_grant_activation,
)
from app.services.user_scope import is_superadmin
from app.services.user_scope import is_platform_superadmin, require_company_context
from app.services.organization_authorization_service import require_capability
from app.services.user_stats_service import get_user_stats as _get_user_stats
from app.services.user_assignable_policy import list_assignable_users as get_assignable_users  # noqa: F401
from app.services.user_session_policy import requires_session_revocation


USER_DELETE_RELATED_DATA_ERROR = {
    "code": "USER_HAS_RELATED_DATA",
    "message": (
        "This user keeps operational history or controls an integration. "
        "Deactivate the user to preserve company records."
    ),
}


def _raise_user_delete_conflict() -> None:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=USER_DELETE_RELATED_DATA_ERROR,
    )


def get_users(
    db: Session, current_user: User, skip: int = 0, limit: int = 100
) -> list[User]:
    if is_platform_superadmin(current_user):
        return user_repo.get_all_users(db, None, skip, limit)
    require_capability(db, current_user, "access.members.read")
    company=require_company_context(current_user)
    return member_user_views(db,user_repo.get_all_users(db,company,skip,limit),company)


def get_user(db: Session, user_id: int, current_user: User) -> User:
    existing_user = user_repo.get_user_by_id(db, user_id)
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    if existing_user.id == current_user.id or is_platform_superadmin(current_user):
        return existing_user
    require_capability(db, current_user, "access.members.read")
    if existing_user.company_id != require_company_context(current_user) and not user_repo.is_active_company_member(db,current_user.company_id,existing_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to access this user",
        )
    return existing_user


def get_user_view(db,user_id,current_user):
    person=get_user(db,user_id,current_user)
    if person.id==current_user.id:return current_user
    return member_user_views(db,[person],current_user.company_id)[0] if not is_platform_superadmin(current_user) else person


def require_primary_identity_management(current_user,person):
    if current_user.id!=person.id and not is_platform_superadmin(current_user) and person.company_id!=current_user.company_id:
        raise HTTPException(403,"Gestiona el acceso de esta persona desde su membresía de empresa. Su identidad pertenece a otra sociedad.")


def update_user(
    db: Session, user_id: int, user_data: UserUpdate, current_user: User
) -> User:
    db_user = get_user(db, user_id, current_user)
    is_own_profile = current_user.id == user_id

    administrative_fields = {"is_active", "role_id", "company_id"}
    requested_administrative_fields = administrative_fields & user_data.model_fields_set
    if is_own_profile and requested_administrative_fields:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative account fields cannot be changed from your profile",
        )

    if "company_id" in user_data.model_fields_set:
        if user_data.company_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="A user company cannot be cleared through this endpoint",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Company membership must be changed through organization workflows",
        )

    if not is_own_profile and not is_platform_superadmin(current_user):
        require_capability(db, current_user, "access.members.manage")
        if db_user.company_id != require_company_context(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to manage this user",
            )

    if not is_own_profile and not is_platform_superadmin(current_user) and db_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform identities can only be managed by platform superadmins",
        )

    if not is_own_profile and current_user.role.name not in {
        "superadmin",
        "admin",
        "manager",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to manage another user",
        )

    if (
        not is_own_profile
        and db_user.role.name == EXTERNAL_PORTAL_ROLE_NAME
        and current_user.role.name not in {"superadmin", "admin"}
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to manage an external portal user",
        )

    if (
        user_data.is_active is not None
        and user_data.is_active != db_user.is_active
        and current_user.role.name not in {"superadmin", "admin", "manager"}
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to change user activation",
        )

    is_external_portal_user = bool(
        db_user.role and db_user.role.name == EXTERNAL_PORTAL_ROLE_NAME
    )
    if is_external_portal_user and user_data.is_active is not None:
        sync_external_portal_grant_activation(
            db,
            db_user=db_user,
            is_active=user_data.is_active,
            actor_user_id=current_user.id,
        )

    if user_data.password is not None:
        if not is_own_profile:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the profile owner can change their password",
            )
        if not user_data.old_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required",
            )
        if len(user_data.password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must contain at least 8 characters",
            )
        if not verify_password(user_data.old_password, db_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        db_user.hashed_password = get_password_hash(user_data.password)

    membership = None
    if db_user.company_id is not None and not is_external_portal_user:
        membership = organization_repo.get_user_membership(
            db,
            company_id=db_user.company_id,
            user_id=db_user.id,
        )
        if membership is None:
            membership = organization_bootstrap_service.ensure_user_membership(
                db, db_user
            )
    if user_data.role_id is not None and user_data.role_id != db_user.role_id:
        if current_user.role.name not in ["superadmin", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to change user roles",
            )
        target_role = role_repo.get_role(db, user_data.role_id)
        if not target_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target role not found",
            )
        if (
            (db_user.role and db_user.role.name == EXTERNAL_PORTAL_ROLE_NAME)
            != (target_role.name == EXTERNAL_PORTAL_ROLE_NAME)
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "External portal access cannot be converted into an internal "
                    "membership. Revoke it and issue the appropriate invitation."
                ),
            )
        if not is_superadmin(current_user):
            if target_role.name == "superadmin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only superadmins can assign the superadmin role",
                )
    target_role_name = (
        target_role.name
        if user_data.role_id is not None and user_data.role_id != db_user.role_id
        else (db_user.role.name if db_user.role else None)
    )
    next_access_class = {
        "admin": "admin",
        "manager": "responsible",
        "viewer": "worker",
    }.get(target_role_name)
    if membership:
        enforce_internal_membership_update(
            db,
            db_user=db_user,
            membership=membership,
            user_data=user_data,
            next_access_class=next_access_class,
        )
    if requires_session_revocation(db_user, user_data):
        db_user.session_version += 1
    updated_user = user_repo.update_user(db, db_user, user_data)
    if membership:
        if user_data.is_active is not None:
            membership.status = "active" if user_data.is_active else "suspended"
            membership.ended_at = None
        if next_access_class is not None:
            membership.access_class = next_access_class
        db.add(membership)
        db.commit()
        db.refresh(updated_user)
    return updated_user


def get_user_stats(
    db: Session, user_id: int, current_user: User, time_range: str | None = None
) -> UserStatsResponse:
    return _get_user_stats(db, user_id, current_user, time_range)


def delete_user_permanently(db: Session, user_id: int, current_user: User) -> None:
    db_user = get_user(db, user_id, current_user)
    if db_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot permanently delete your own user",
        )
    if not is_superadmin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform administrators can permanently delete users",
        )

    if user_repo.has_protected_user_data(db, db_user.id):
        _raise_user_delete_conflict()

    try:
        user_repo.delete_user_access_configuration(db, db_user.id)
        user_repo.delete_user(db, db_user)
    except IntegrityError:
        _raise_user_delete_conflict()
