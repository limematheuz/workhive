from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.company_membership import Department, Team
from app.models.user import User
from app.repositories import organization as organization_repo
from app.schemas.organization import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    TeamCreate,
    TeamResponse,
    TeamUpdate,
)
from app.services.organization_service_shared import (
    CAPABILITY_DEPARTMENTS_MANAGE,
    CAPABILITY_DEPARTMENTS_READ,
    CAPABILITY_TEAMS_MANAGE,
    CAPABILITY_TEAMS_READ,
    conflict,
    not_found,
    require_capability,
)


def list_departments(db: Session, current_user: User) -> list[DepartmentResponse]:
    company_id = require_capability(db, current_user, CAPABILITY_DEPARTMENTS_READ)
    return [
        DepartmentResponse.model_validate(department)
        for department in organization_repo.list_departments(db, company_id)
    ]


def validate_department_parent(
    db: Session,
    *,
    company_id: int,
    department_id: int | None,
    parent_department_id: int | None,
) -> None:
    if parent_department_id is None:
        return
    parent = organization_repo.get_department(
        db, company_id=company_id, department_id=parent_department_id
    )
    if not parent:
        not_found("Parent department")
    parent_id = parent.id
    while department_id is not None and parent_id is not None:
        if parent_id == department_id:
            conflict("A department cannot be its own ancestor")
        ancestor = organization_repo.get_department(
            db, company_id=company_id, department_id=parent_id
        )
        parent_id = ancestor.parent_department_id if ancestor else None


def create_department(
    db: Session, payload: DepartmentCreate, current_user: User
) -> DepartmentResponse:
    company_id = require_capability(db, current_user, CAPABILITY_DEPARTMENTS_MANAGE)
    validate_department_parent(
        db,
        company_id=company_id,
        department_id=None,
        parent_department_id=payload.parent_department_id,
    )
    department = Department(company_id=company_id, **payload.model_dump())
    db.add(department)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        conflict("A department with this code already exists")
    db.refresh(department)
    return DepartmentResponse.model_validate(department)


def update_department(
    db: Session,
    department_id: int,
    payload: DepartmentUpdate,
    current_user: User,
) -> DepartmentResponse:
    company_id = require_capability(db, current_user, CAPABILITY_DEPARTMENTS_MANAGE)
    department = organization_repo.get_department(
        db, company_id=company_id, department_id=department_id
    )
    if not department:
        not_found("Department")
    updates = payload.model_dump(exclude_unset=True)
    if "parent_department_id" in updates:
        validate_department_parent(
            db,
            company_id=company_id,
            department_id=department.id,
            parent_department_id=updates["parent_department_id"],
        )
    for field, value in updates.items():
        setattr(department, field, value)
    db.add(department)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        conflict("A department with this code already exists")
    db.refresh(department)
    return DepartmentResponse.model_validate(department)


def list_teams(db: Session, current_user: User) -> list[TeamResponse]:
    company_id = require_capability(db, current_user, CAPABILITY_TEAMS_READ)
    return [
        TeamResponse.model_validate(team)
        for team in organization_repo.list_teams(db, company_id)
    ]


def validate_team_department(db: Session, company_id: int, department_id: int | None) -> None:
    if department_id is not None and not organization_repo.get_department(
        db, company_id=company_id, department_id=department_id
    ):
        not_found("Department")


def create_team(db: Session, payload: TeamCreate, current_user: User) -> TeamResponse:
    company_id = require_capability(db, current_user, CAPABILITY_TEAMS_MANAGE)
    validate_team_department(db, company_id, payload.department_id)
    team = Team(company_id=company_id, **payload.model_dump())
    db.add(team)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        conflict("A team with this code already exists")
    db.refresh(team)
    return TeamResponse.model_validate(team)


def update_team(
    db: Session,
    team_id: int,
    payload: TeamUpdate,
    current_user: User,
) -> TeamResponse:
    company_id = require_capability(db, current_user, CAPABILITY_TEAMS_MANAGE)
    team = organization_repo.get_team(db, company_id=company_id, team_id=team_id)
    if not team:
        not_found("Team")
    updates = payload.model_dump(exclude_unset=True)
    if "department_id" in updates:
        validate_team_department(db, company_id, updates["department_id"])
    for field, value in updates.items():
        setattr(team, field, value)
    db.add(team)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        conflict("A team with this code already exists")
    db.refresh(team)
    return TeamResponse.model_validate(team)
