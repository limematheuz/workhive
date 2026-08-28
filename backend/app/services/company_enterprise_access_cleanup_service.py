from sqlalchemy.orm import Session

from app.models.company_membership import (
    CompanyMembership,
    Department,
    DepartmentMembership,
    Team,
    TeamMembership,
)
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
    PermissionProfile,
    PermissionProfilePermission,
)


def delete_company_enterprise_access_data(db: Session, company_id: int) -> None:
    """Remove derived internal-access records before a trial company is deleted."""

    membership_ids = [
        membership_id
        for (membership_id,) in db.query(CompanyMembership.id)
        .filter(CompanyMembership.company_id == company_id)
        .all()
    ]
    if membership_ids:
        profile_assignment_ids = [
            assignment_id
            for (assignment_id,) in db.query(MembershipPermissionProfileAssignment.id)
            .filter(
                MembershipPermissionProfileAssignment.company_membership_id.in_(membership_ids)
            )
            .all()
        ]
        if profile_assignment_ids:
            db.query(MembershipPermissionProfileScope).filter(
                MembershipPermissionProfileScope.profile_assignment_id.in_(
                    profile_assignment_ids
                )
            ).delete(synchronize_session=False)
            db.query(MembershipPermissionProfileAssignment).filter(
                MembershipPermissionProfileAssignment.id.in_(profile_assignment_ids)
            ).delete(synchronize_session=False)
        db.query(DepartmentMembership).filter(
            DepartmentMembership.company_membership_id.in_(membership_ids)
        ).delete(synchronize_session=False)
        db.query(TeamMembership).filter(
            TeamMembership.company_membership_id.in_(membership_ids)
        ).delete(synchronize_session=False)
        db.query(CompanyMembership).filter(
            CompanyMembership.id.in_(membership_ids)
        ).delete(synchronize_session=False)

    profile_ids = [
        profile_id
        for (profile_id,) in db.query(PermissionProfile.id)
        .filter(PermissionProfile.company_id == company_id)
        .all()
    ]
    if profile_ids:
        db.query(PermissionProfilePermission).filter(
            PermissionProfilePermission.permission_profile_id.in_(profile_ids)
        ).delete(synchronize_session=False)
        db.query(PermissionProfile).filter(PermissionProfile.id.in_(profile_ids)).delete(
            synchronize_session=False
        )
    db.query(Team).filter(Team.company_id == company_id).delete(
        synchronize_session=False
    )
    db.query(Department).filter(Department.company_id == company_id).delete(
        synchronize_session=False
    )
