from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.company_membership import Department, Team
from app.models.user import User
from app.repositories import organization as organization_repo
from app.repositories import organization_department as department_repo
from app.schemas.organization import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    DepartmentUsage,
    TeamCreate,
    TeamMembersUpdate,
    TeamResponse,
    TeamUpdate,
    TeamUsage,
)
from app.services import organization_department_policy as department_policy
from app.services.entitlement_service import (
    require_department_capacity,
    require_team_capacity,
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
from app.services.organization_team_membership_service import replace_team_members


def department_response(db: Session, department: Department) -> DepartmentResponse:
    usage = department_repo.get_department_usage(
        db, company_id=department.company_id, department_id=department.id
    )
    return DepartmentResponse(
        id=department.id,
        name=department.name,
        code=department.code,
        parent_department_id=department.parent_department_id,
        is_active=department.is_active,
        usage=DepartmentUsage(**usage, can_delete=not any(usage.values())),
    )


def department_in_use(usage: dict[str, int]) -> None:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "DEPARTMENT_HAS_RELATED_DATA",
            "message": "Resolve the department's linked records before deleting it",
            "dependencies": usage,
        },
    )


def team_response(db: Session, team: Team) -> TeamResponse:
    usage = organization_repo.get_team_usage(
        db, company_id=team.company_id, team_id=team.id
    )
    return TeamResponse(
        id=team.id,
        name=team.name,
        code=team.code,
        department_id=team.department_id,
        is_active=team.is_active,
        usage=TeamUsage(
            **usage,
            can_deactivate=(
                usage["active_member_assignments"] == 0
                and usage["active_profile_scopes"] == 0
            ),
            can_delete=(
                usage["member_assignments"] == 0 and usage["profile_scopes"] == 0
            ),
        ),
    )


def team_in_use(usage: dict[str, int], *, action: str) -> None:
    if action == "deactivate":
        dependencies = {
            "member_assignments": usage["active_member_assignments"],
            "profile_scopes": usage["active_profile_scopes"],
        }
        message = (
            "Remove the active members and permission scopes before deactivating it"
        )
    else:
        dependencies = {
            "member_assignments": usage["member_assignments"],
            "profile_scopes": usage["profile_scopes"],
        }
        message = "Resolve the team's linked records before deleting it"
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "TEAM_HAS_RELATED_DATA",
            "message": message,
            "dependencies": dependencies,
        },
    )


def list_departments(db: Session, current_user: User) -> list[DepartmentResponse]:
    company_id = require_capability(db, current_user, CAPABILITY_DEPARTMENTS_READ)
    return [
        department_response(db, department)
        for department in department_repo.list_departments(db, company_id)
    ]


def create_department(
    db: Session, payload: DepartmentCreate, current_user: User
) -> DepartmentResponse:
    company_id = require_capability(db, current_user, CAPABILITY_DEPARTMENTS_MANAGE)
    require_department_capacity(db, company_id=company_id)
    department_policy.validate_department_parent(
        db,
        company_id=company_id,
        department_id=None,
        parent_department_id=payload.parent_department_id,
    )
    normalized_name = department_policy.normalize_department_name(payload.name)
    department_policy.require_unique_department_name(
        db, company_id=company_id, normalized_name=normalized_name
    )
    department = Department(
        company_id=company_id, normalized_name=normalized_name, **payload.model_dump()
    )
    db.add(department)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        conflict("A department with this name or code already exists")
    db.refresh(department)
    return department_response(db, department)


def update_department(
    db: Session, department_id: int, payload: DepartmentUpdate, current_user: User
) -> DepartmentResponse:
    company_id = require_capability(db, current_user, CAPABILITY_DEPARTMENTS_MANAGE)
    department = department_repo.get_department(
        db, company_id=company_id, department_id=department_id
    )
    if not department:
        not_found("Department")
    updates = payload.model_dump(exclude_unset=True)
    if "parent_department_id" in updates:
        department_policy.validate_department_parent(
            db,
            company_id=company_id,
            department_id=department.id,
            parent_department_id=updates["parent_department_id"],
            existing_parent_department_id=department.parent_department_id,
        )
    if "name" in updates:
        normalized_name = department_policy.normalize_department_name(updates["name"])
        department_policy.require_unique_department_name(
            db,
            company_id=company_id,
            normalized_name=normalized_name,
            excluding_department_id=department.id,
        )
        updates["normalized_name"] = normalized_name
    for field, value in updates.items():
        setattr(department, field, value)
    db.add(department)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        conflict("A department with this name or code already exists")
    db.refresh(department)
    return department_response(db, department)


def delete_department(db: Session, department_id: int, current_user: User) -> None:
    company_id = require_capability(db, current_user, CAPABILITY_DEPARTMENTS_MANAGE)
    department = department_repo.get_department(
        db, company_id=company_id, department_id=department_id
    )
    if not department:
        not_found("Department")
    usage = department_repo.get_department_usage(
        db, company_id=company_id, department_id=department.id
    )
    if any(usage.values()):
        department_in_use(usage)
    db.delete(department)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        department_in_use(
            department_repo.get_department_usage(
                db, company_id=company_id, department_id=department_id
            )
        )


def list_teams(db: Session, current_user: User) -> list[TeamResponse]:
    company_id = require_capability(db, current_user, CAPABILITY_TEAMS_READ)
    return [
        team_response(db, team) for team in organization_repo.list_teams(db, company_id)
    ]


def create_team(db: Session, payload: TeamCreate, current_user: User) -> TeamResponse:
    company_id = require_capability(db, current_user, CAPABILITY_TEAMS_MANAGE)
    require_team_capacity(db, company_id=company_id)
    if payload.department_id is not None:
        department_policy.require_department_relationship_allowed(
            db, company_id=company_id, department_id=payload.department_id
        )
    team = Team(company_id=company_id, **payload.model_dump())
    db.add(team)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        conflict("A team with this code already exists")
    db.refresh(team)
    return team_response(db, team)


def update_team(
    db: Session, team_id: int, payload: TeamUpdate, current_user: User
) -> TeamResponse:
    company_id = require_capability(db, current_user, CAPABILITY_TEAMS_MANAGE)
    team = organization_repo.get_team(db, company_id=company_id, team_id=team_id)
    if not team:
        not_found("Team")
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("is_active") is False and team.is_active:
        usage = organization_repo.get_team_usage(
            db, company_id=company_id, team_id=team.id
        )
        if usage["active_member_assignments"] or usage["active_profile_scopes"]:
            team_in_use(usage, action="deactivate")
    if "department_id" in updates and updates["department_id"] is not None:
        department_policy.require_department_relationship_allowed(
            db,
            company_id=company_id,
            department_id=updates["department_id"],
            existing_department_id=team.department_id,
        )
    for field, value in updates.items():
        setattr(team, field, value)
    db.add(team)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        conflict("A team with this code already exists")
    db.refresh(team)
    return team_response(db, team)


def replace_team_members_for_team(
    db: Session, team_id: int, payload: TeamMembersUpdate, current_user: User
) -> TeamResponse:
    company_id = require_capability(db, current_user, CAPABILITY_TEAMS_MANAGE)
    team = organization_repo.get_team(db, company_id=company_id, team_id=team_id)
    if not team:
        not_found("Team")
    if not team.is_active:
        conflict("Inactive teams cannot receive new members")
    replace_team_members(
        db,
        company_id=company_id,
        team_id=team.id,
        membership_ids=payload.membership_ids,
    )
    db.commit()
    db.refresh(team)
    return team_response(db, team)


def delete_team(db: Session, team_id: int, current_user: User) -> None:
    company_id = require_capability(db, current_user, CAPABILITY_TEAMS_MANAGE)
    team = organization_repo.get_team(db, company_id=company_id, team_id=team_id)
    if not team:
        not_found("Team")
    usage = organization_repo.get_team_usage(db, company_id=company_id, team_id=team.id)
    if usage["member_assignments"] or usage["profile_scopes"]:
        team_in_use(usage, action="delete")
    db.delete(team)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        team_in_use(
            organization_repo.get_team_usage(
                db, company_id=company_id, team_id=team_id
            ),
            action="delete",
        )
