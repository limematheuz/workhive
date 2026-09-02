import unicodedata
from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models.company_membership import Department
from app.repositories import organization_department as department_repo
from app.services.organization_service_shared import conflict, not_found


def normalize_department_name(name: str) -> str:
    collapsed = " ".join(name.split())
    decomposed = unicodedata.normalize("NFKD", collapsed)
    without_accents = "".join(
        character for character in decomposed if unicodedata.category(character) != "Mn"
    )
    return without_accents.casefold()


def require_unique_department_name(
    db: Session,
    *,
    company_id: int,
    normalized_name: str,
    excluding_department_id: int | None = None,
) -> None:
    existing = department_repo.get_department_by_normalized_name(
        db, company_id=company_id, normalized_name=normalized_name
    )
    if existing and existing.id != excluding_department_id:
        conflict("A department with this name already exists")


def require_department_relationship_allowed(
    db: Session,
    *,
    company_id: int,
    department_id: int,
    existing_department_id: int | None = None,
) -> Department:
    department = department_repo.get_department(
        db, company_id=company_id, department_id=department_id
    )
    if not department:
        not_found("Department")
    if not department.is_active and department.id != existing_department_id:
        conflict("Inactive departments cannot receive new relationships")
    return department


def validate_department_parent(
    db: Session,
    *,
    company_id: int,
    department_id: int | None,
    parent_department_id: int | None,
    existing_parent_department_id: int | None = None,
) -> None:
    if parent_department_id is None:
        return
    parent = require_department_relationship_allowed(
        db,
        company_id=company_id,
        department_id=parent_department_id,
        existing_department_id=existing_parent_department_id,
    )
    visited_ids: set[int] = set()
    parent_id: int | None = parent.id
    while department_id is not None and parent_id is not None:
        if parent_id == department_id or parent_id in visited_ids:
            conflict("A department cannot be its own ancestor")
        visited_ids.add(parent_id)
        ancestor = department_repo.get_department(
            db, company_id=company_id, department_id=parent_id
        )
        parent_id = ancestor.parent_department_id if ancestor else None


def require_departments_accept_new_memberships(
    departments: Iterable[Department], *, existing_department_ids: set[int]
) -> None:
    for department in departments:
        if not department.is_active and department.id not in existing_department_ids:
            conflict("Inactive departments cannot receive new relationships")
