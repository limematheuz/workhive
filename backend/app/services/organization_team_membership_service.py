from sqlalchemy.orm import Session

from app.models.company_membership import TeamMembership
from app.repositories import organization as organization_repo
from app.services.organization_service_shared import conflict, not_found


def replace_team_memberships(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
    team_ids: list[int],
) -> None:
    """Replace one person's active team assignments without losing history."""

    teams = {
        team.id: team
        for team in organization_repo.list_teams(db, company_id)
        if team.id in team_ids
    }
    if len(teams) != len(team_ids):
        not_found("Team")
    existing = {
        assignment.team_id: assignment
        for assignment in organization_repo.list_team_memberships(
            db, company_id=company_id, membership_id=membership_id
        )
    }
    if any(not team.is_active and team.id not in existing for team in teams.values()):
        conflict("Inactive teams cannot receive new members")

    for team_id, assignment in existing.items():
        if team_id not in team_ids:
            assignment.is_active = False
            db.add(assignment)
    for team_id in team_ids:
        assignment = existing.get(team_id)
        if assignment:
            assignment.is_active = True
            db.add(assignment)
        else:
            db.add(
                TeamMembership(
                    company_id=company_id,
                    team_id=team_id,
                    company_membership_id=membership_id,
                    is_active=True,
                )
            )


def replace_team_members(
    db: Session,
    *,
    company_id: int,
    team_id: int,
    membership_ids: list[int],
) -> None:
    """Replace a team's active roster in a single transaction."""

    memberships = {
        membership.id: membership
        for membership in organization_repo.list_company_memberships(db, company_id)
        if membership.id in membership_ids
    }
    if len(memberships) != len(membership_ids):
        not_found("Company member")
    existing = {
        assignment.company_membership_id: assignment
        for assignment in organization_repo.list_team_member_assignments(
            db, company_id=company_id, team_id=team_id
        )
    }
    if any(
        membership.status != "active" and membership.id not in existing
        for membership in memberships.values()
    ):
        conflict("Inactive people cannot receive new team memberships")

    for membership_id, assignment in existing.items():
        if membership_id not in membership_ids:
            assignment.is_active = False
            db.add(assignment)
    for membership_id in membership_ids:
        assignment = existing.get(membership_id)
        if assignment:
            assignment.is_active = True
            db.add(assignment)
        else:
            db.add(
                TeamMembership(
                    company_id=company_id,
                    team_id=team_id,
                    company_membership_id=membership_id,
                    is_active=True,
                )
            )
