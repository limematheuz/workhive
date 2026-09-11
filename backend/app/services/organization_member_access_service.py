"""Save a person's membership and permission assignments atomically."""

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.organization import OrganizationMemberAccessUpdate, OrganizationMemberResponse
from app.services import organization_member_service, organization_profile_assignment_service


def update_member(
    db: Session,
    membership_id: int,
    payload: OrganizationMemberAccessUpdate,
    current_user: User,
) -> OrganizationMemberResponse:
    try:
        member = organization_member_service.update_member(
            db, membership_id, payload, current_user, commit=False
        )
        if payload.profile_assignments is not None:
            member = organization_profile_assignment_service.replace_member_profile_assignments(
                db, membership_id, payload.profile_assignments, current_user, commit=False
            )
        db.commit()
        return member
    except Exception:
        db.rollback()
        raise
