"""Create the scoped departments, teams, and profiles for the demo tenant."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.company_membership import DepartmentMembership, TeamMembership
from app.models.permission_profile import PermissionProfile
from app.schemas.organization import (
    DepartmentCreate,
    OrganizationMemberProfileAssignmentInput,
    OrganizationMemberProfileAssignmentsUpdate,
    OrganizationMemberProfileScopeInput,
    TeamCreate,
)
from app.services import (
    organization_profile_assignment_service,
    organization_structure_service,
)
from app.services.organization_base_profile_service import (
    COMMERCIAL_PROFILE_NAME,
    CONSULTATION_PROFILE_NAME,
    FINANCE_PROFILE_NAME,
    OPERATIONS_PROFILE_NAME,
)
from scripts.demo_enterprise_identity import DemoMembers


@dataclass(frozen=True)
class DemoOrganization:
    operations_department_id: int
    commercial_department_id: int
    finance_department_id: int
    north_team_id: int
    south_team_id: int
    commercial_team_id: int


def _profile_ids(db: Session, *, company_id: int) -> dict[str, int]:
    profiles = (
        db.query(PermissionProfile)
        .filter(PermissionProfile.company_id == company_id)
        .all()
    )
    return {profile.name: profile.id for profile in profiles}


def _assign_profile(
    db: Session,
    *,
    membership_id: int,
    profile_id: int,
    scope_type: str,
    scope_id: int,
    members: DemoMembers,
) -> None:
    organization_profile_assignment_service.replace_member_profile_assignments(
        db,
        membership_id,
        OrganizationMemberProfileAssignmentsUpdate(
            assignments=[
                OrganizationMemberProfileAssignmentInput(
                    permission_profile_id=profile_id,
                    scopes=[
                        OrganizationMemberProfileScopeInput(
                            scope_type=scope_type,
                            scope_id=scope_id,
                        )
                    ],
                )
            ]
        ),
        members.administrator,
    )


def _add_memberships(
    db: Session,
    *,
    members: DemoMembers,
    organization: DemoOrganization,
) -> None:
    company_id = members.company.id
    db.add_all(
        [
            DepartmentMembership(
                company_id=company_id,
                department_id=organization.operations_department_id,
                company_membership_id=members.operations_membership.id,
                is_primary=True,
                is_lead=True,
                is_active=True,
            ),
            DepartmentMembership(
                company_id=company_id,
                department_id=organization.operations_department_id,
                company_membership_id=members.field_membership.id,
                is_primary=True,
                is_lead=False,
                is_active=True,
            ),
            DepartmentMembership(
                company_id=company_id,
                department_id=organization.commercial_department_id,
                company_membership_id=members.commercial_membership.id,
                is_primary=True,
                is_lead=True,
                is_active=True,
            ),
            DepartmentMembership(
                company_id=company_id,
                department_id=organization.finance_department_id,
                company_membership_id=members.finance_membership.id,
                is_primary=True,
                is_lead=True,
                is_active=True,
            ),
            TeamMembership(
                company_id=company_id,
                team_id=organization.north_team_id,
                company_membership_id=members.operations_membership.id,
                is_lead=True,
                is_active=True,
            ),
            TeamMembership(
                company_id=company_id,
                team_id=organization.south_team_id,
                company_membership_id=members.field_membership.id,
                is_lead=False,
                is_active=True,
            ),
            TeamMembership(
                company_id=company_id,
                team_id=organization.commercial_team_id,
                company_membership_id=members.commercial_membership.id,
                is_lead=True,
                is_active=True,
            ),
        ]
    )
    db.commit()


def create_demo_organization(db: Session, *, members: DemoMembers) -> DemoOrganization:
    """Use the normal organization services to create scoped demo structure."""
    administrator = members.administrator
    operations = organization_structure_service.create_department(
        db,
        DepartmentCreate(name="Operaciones", code="OPS"),
        administrator,
    )
    commercial = organization_structure_service.create_department(
        db,
        DepartmentCreate(name="Comercial", code="COM"),
        administrator,
    )
    finance = organization_structure_service.create_department(
        db,
        DepartmentCreate(name="Finanzas", code="FIN"),
        administrator,
    )
    north_team = organization_structure_service.create_team(
        db,
        TeamCreate(
            name="Equipo Norte",
            code="NORTE",
            department_id=operations.id,
        ),
        administrator,
    )
    south_team = organization_structure_service.create_team(
        db,
        TeamCreate(
            name="Equipo Sur",
            code="SUR",
            department_id=operations.id,
        ),
        administrator,
    )
    commercial_team = organization_structure_service.create_team(
        db,
        TeamCreate(
            name="Cuentas Enterprise",
            code="CUENTAS",
            department_id=commercial.id,
        ),
        administrator,
    )
    organization = DemoOrganization(
        operations_department_id=operations.id,
        commercial_department_id=commercial.id,
        finance_department_id=finance.id,
        north_team_id=north_team.id,
        south_team_id=south_team.id,
        commercial_team_id=commercial_team.id,
    )
    _add_memberships(db, members=members, organization=organization)

    profile_ids = _profile_ids(db, company_id=members.company.id)
    _assign_profile(
        db,
        membership_id=members.operations_membership.id,
        profile_id=profile_ids[OPERATIONS_PROFILE_NAME],
        scope_type="department",
        scope_id=organization.operations_department_id,
        members=members,
    )
    _assign_profile(
        db,
        membership_id=members.field_membership.id,
        profile_id=profile_ids[CONSULTATION_PROFILE_NAME],
        scope_type="team",
        scope_id=organization.south_team_id,
        members=members,
    )
    _assign_profile(
        db,
        membership_id=members.commercial_membership.id,
        profile_id=profile_ids[COMMERCIAL_PROFILE_NAME],
        scope_type="department",
        scope_id=organization.commercial_department_id,
        members=members,
    )
    _assign_profile(
        db,
        membership_id=members.finance_membership.id,
        profile_id=profile_ids[FINANCE_PROFILE_NAME],
        scope_type="department",
        scope_id=organization.finance_department_id,
        members=members,
    )
    return organization
