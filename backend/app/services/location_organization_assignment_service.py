from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import organization as organization_repo


def resolve_organization_assignment(
    db: Session,
    *,
    company_id: int | None,
    department_id: int | None,
    team_id: int | None,
) -> tuple[int | None, int | None]:
    """Return a valid department/team pair for an owned location.

    A team always determines the department. Both records must be active and
    belong to the location owner's company.
    """

    if department_id is None and team_id is None:
        return None, None
    if company_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organization is required to assign a location",
        )

    department = None
    if department_id is not None:
        department = organization_repo.get_department(
            db,
            company_id=company_id,
            department_id=department_id,
        )
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found",
            )
        if not department.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inactive departments cannot be assigned to locations",
            )

    if team_id is None:
        return department_id, None

    team = organization_repo.get_team(db, company_id=company_id, team_id=team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    if not team.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inactive teams cannot be assigned to locations",
        )
    if team.department_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team must belong to a department before it can manage locations",
        )
    if department is not None and department.id != team.department_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The selected team belongs to a different department",
        )
    return team.department_id, team.id
