from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.location_risk import LocationRisk
from app.repositories import location_workspace as workspace_repo
from app.schemas.location_workspace import LocationRiskInput


def sync_risks(
    db: Session,
    location: Location,
    risks: list[LocationRiskInput] | None,
) -> None:
    """Replace explicit location risks without affecting another location."""
    if risks is None:
        return
    if len(risks) > 100:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A location can contain at most 100 operational risks",
        )

    existing_risks = {risk.id: risk for risk in workspace_repo.list_risks(db, location.id)}
    requested_ids = {risk.id for risk in risks if risk.id is not None}
    if not requested_ids.issubset(existing_risks):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location risk not found",
        )

    for risk in risks:
        values = risk.model_dump(exclude={"id"})
        if risk.id is None:
            db.add(LocationRisk(location_id=location.id, **values))
            continue
        persisted = existing_risks[risk.id]
        for field, value in values.items():
            setattr(persisted, field, value)
        db.add(persisted)

    for risk_id, persisted in existing_risks.items():
        if risk_id not in requested_ids:
            db.delete(persisted)
    db.flush()
