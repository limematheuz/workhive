from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.company_membership import Department, DepartmentMembership, Team
from app.models.permission_profile import MembershipPermissionProfileScope


def list_departments(db: Session, company_id: int) -> list[Department]:
    return (
        db.query(Department)
        .filter(Department.company_id == company_id)
        .order_by(
            Department.is_active.desc(), Department.name.asc(), Department.id.asc()
        )
        .all()
    )


def get_department(
    db: Session, *, company_id: int, department_id: int
) -> Department | None:
    return (
        db.query(Department)
        .filter(Department.company_id == company_id, Department.id == department_id)
        .first()
    )


def get_department_by_normalized_name(
    db: Session, *, company_id: int, normalized_name: str
) -> Department | None:
    return (
        db.query(Department)
        .filter(
            Department.company_id == company_id,
            Department.normalized_name == normalized_name,
        )
        .first()
    )


def get_department_usage(
    db: Session, *, company_id: int, department_id: int
) -> dict[str, int]:
    """Relationships that must be resolved before deleting a department."""

    child_departments = (
        db.query(func.count(Department.id))
        .filter(
            Department.company_id == company_id,
            Department.parent_department_id == department_id,
        )
        .scalar()
        or 0
    )
    teams = (
        db.query(func.count(Team.id))
        .filter(Team.company_id == company_id, Team.department_id == department_id)
        .scalar()
        or 0
    )
    member_assignments = (
        db.query(func.count(DepartmentMembership.id))
        .filter(
            DepartmentMembership.company_id == company_id,
            DepartmentMembership.department_id == department_id,
        )
        .scalar()
        or 0
    )
    profile_scopes = (
        db.query(func.count(MembershipPermissionProfileScope.id))
        .filter(
            MembershipPermissionProfileScope.company_id == company_id,
            MembershipPermissionProfileScope.scope_type == "department",
            MembershipPermissionProfileScope.scope_id == department_id,
        )
        .scalar()
        or 0
    )
    return {
        "child_departments": int(child_departments),
        "teams": int(teams),
        "member_assignments": int(member_assignments),
        "profile_scopes": int(profile_scopes),
    }
