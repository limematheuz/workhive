from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.client import Client
from app.models.client_account_assignment import ClientAccountAssignment
from app.models.company_membership import CompanyMembership
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
    PermissionDefinition,
    PermissionProfile,
    PermissionProfilePermission,
)
from app.models.user import User


def _assignment_load_options():
    return (
        joinedload(ClientAccountAssignment.company_membership).joinedload(
            CompanyMembership.user
        ),
        joinedload(ClientAccountAssignment.assigned_by),
    )


def get_current_for_client(
    db: Session,
    *,
    company_id: int,
    client_id: int,
) -> ClientAccountAssignment | None:
    return (
        db.query(ClientAccountAssignment)
        .options(*_assignment_load_options())
        .filter(
            ClientAccountAssignment.company_id == company_id,
            ClientAccountAssignment.client_id == client_id,
            ClientAccountAssignment.ended_at.is_(None),
        )
        .first()
    )


def get_client_for_update(
    db: Session,
    *,
    company_id: int,
    client_id: int,
) -> Client | None:
    return (
        db.query(Client)
        .filter(Client.company_id == company_id, Client.id == client_id)
        .with_for_update()
        .first()
    )


def list_current_for_membership(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
) -> list[ClientAccountAssignment]:
    return (
        db.query(ClientAccountAssignment)
        .options(
            joinedload(ClientAccountAssignment.client),
            *_assignment_load_options(),
        )
        .filter(
            ClientAccountAssignment.company_id == company_id,
            ClientAccountAssignment.company_membership_id == membership_id,
            ClientAccountAssignment.ended_at.is_(None),
        )
        .order_by(
            ClientAccountAssignment.started_at.desc(),
            ClientAccountAssignment.id.desc(),
        )
        .all()
    )


def list_commercial_owner_candidates(
    db: Session,
    *,
    company_id: int,
    permission_code: str,
) -> list[CompanyMembership]:
    """Return internal members with the company-wide commercial permission.

    Assignment eligibility is deliberately permission-based, rather than based
    on a display role.  That keeps a custom commercial profile eligible while
    excluding a person who merely belongs to the company.
    """
    return (
        db.query(CompanyMembership)
        .join(User, User.id == CompanyMembership.user_id)
        .join(
            MembershipPermissionProfileAssignment,
            MembershipPermissionProfileAssignment.company_membership_id
            == CompanyMembership.id,
        )
        .join(
            PermissionProfile,
            PermissionProfile.id
            == MembershipPermissionProfileAssignment.permission_profile_id,
        )
        .join(
            PermissionProfilePermission,
            PermissionProfilePermission.permission_profile_id == PermissionProfile.id,
        )
        .join(
            PermissionDefinition,
            PermissionDefinition.id
            == PermissionProfilePermission.permission_definition_id,
        )
        .join(
            MembershipPermissionProfileScope,
            MembershipPermissionProfileScope.profile_assignment_id
            == MembershipPermissionProfileAssignment.id,
        )
        .options(
            joinedload(CompanyMembership.user),
            selectinload(CompanyMembership.profile_assignments).joinedload(
                MembershipPermissionProfileAssignment.permission_profile
            ),
        )
        .filter(
            CompanyMembership.company_id == company_id,
            CompanyMembership.status == "active",
            User.is_active.is_(True),
            MembershipPermissionProfileAssignment.company_id == company_id,
            MembershipPermissionProfileAssignment.is_active.is_(True),
            PermissionProfile.company_id == company_id,
            PermissionProfile.is_active.is_(True),
            PermissionDefinition.code == permission_code,
            PermissionDefinition.is_active.is_(True),
            MembershipPermissionProfileScope.company_id == company_id,
            MembershipPermissionProfileScope.scope_type == "company",
            MembershipPermissionProfileScope.scope_id == company_id,
        )
        .order_by(User.full_name.asc(), User.email.asc(), CompanyMembership.id.asc())
        .distinct()
        .all()
    )


def get_commercial_owner_candidate(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
    permission_code: str,
) -> CompanyMembership | None:
    return next(
        (
            membership
            for membership in list_commercial_owner_candidates(
                db,
                company_id=company_id,
                permission_code=permission_code,
            )
            if membership.id == membership_id
        ),
        None,
    )
