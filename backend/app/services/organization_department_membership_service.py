from sqlalchemy.orm import Session

from app.models.company_membership import DepartmentMembership
from app.repositories import organization as organization_repo
from app.repositories import organization_department as department_repo
from app.services.organization_department_policy import (
    require_departments_accept_new_memberships,
)
from app.services.organization_service_shared import not_found


def replace_department_memberships(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
    department_ids: list[int],
) -> None:
    departments = {
        department.id: department
        for department in department_repo.list_departments(db, company_id)
        if department.id in department_ids
    }
    if len(departments) != len(department_ids):
        not_found("Department")
    existing = {
        assignment.department_id: assignment
        for assignment in organization_repo.list_department_memberships(
            db, company_id=company_id, membership_id=membership_id
        )
    }
    require_departments_accept_new_memberships(
        departments.values(), existing_department_ids=set(existing)
    )
    for department_id, assignment in existing.items():
        if department_id not in department_ids:
            assignment.is_active = False
            assignment.is_primary = False
            db.add(assignment)
    for position, department_id in enumerate(department_ids):
        assignment = existing.get(department_id)
        if assignment:
            assignment.is_active = True
            assignment.is_primary = position == 0
            db.add(assignment)
        else:
            db.add(
                DepartmentMembership(
                    company_id=company_id,
                    department_id=department_id,
                    company_membership_id=membership_id,
                    is_primary=position == 0,
                    is_active=True,
                )
            )
