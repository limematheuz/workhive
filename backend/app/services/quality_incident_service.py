from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.quality_incident import QualityCorrectiveAction, QualityIncident
from app.models.user import User
from app.repositories import quality_incident as incident_repo
from app.repositories import quality_inspection as inspection_repo
from app.schemas.quality_incident import (
    QualityCorrectiveActionCreate,
    QualityCorrectiveActionUpdate,
    QualityIncidentCreate,
    QualityIncidentUpdate,
)
from app.services import location_access_service
from app.services.entitlement_service import require_company_feature
from app.services.organization_authorization_service import permitted_location_ids
from app.services.user_scope import require_company_context


READ_CAPABILITY = "quality.incidents.read"
MANAGE_CAPABILITY = "quality.incidents.manage"


def _require_quality(company_id: int, db: Session) -> None:
    require_company_feature(db, company_id=company_id, code="features.quality")


def _require_location_access(db: Session, current_user: User, location_id: int, capability: str) -> None:
    location_access_service.require_location_capability(
        db,
        current_user,
        location_id,
        "can_manage_tasks",
        permission_code=capability,
    )


def _get_incident(db: Session, company_id: int, incident_id: int, *, for_update: bool = False) -> QualityIncident:
    incident = incident_repo.get_incident(
        db, company_id=company_id, incident_id=incident_id, for_update=for_update
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incidencia de calidad no encontrada")
    return incident


def list_incidents(db: Session, current_user: User) -> list[QualityIncident]:
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    return incident_repo.list_incidents(
        db,
        company_id=company_id,
        location_ids=permitted_location_ids(db, current_user, READ_CAPABILITY),
    )


def get_incident(db: Session, current_user: User, incident_id: int) -> QualityIncident:
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    incident = _get_incident(db, company_id, incident_id)
    _require_location_access(db, current_user, incident.location_id, READ_CAPABILITY)
    return incident


def create_incident(
    db: Session,
    current_user: User,
    payload: QualityIncidentCreate,
) -> QualityIncident:
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    _require_location_access(db, current_user, payload.location_id, MANAGE_CAPABILITY)
    if payload.inspection_id is None and payload.inspection_item_id is not None:
        raise HTTPException(status_code=422, detail="El punto inspeccionado requiere una inspección")
    if payload.inspection_id is not None:
        inspection = inspection_repo.get_inspection(
            db, company_id=company_id, inspection_id=payload.inspection_id
        )
        if inspection is None or inspection.location_id != payload.location_id:
            raise HTTPException(status_code=422, detail="La inspección no corresponde a esta ubicación")
        if payload.inspection_item_id is not None and payload.inspection_item_id not in {item.id for item in inspection.items}:
            raise HTTPException(status_code=422, detail="El punto no pertenece a la inspección indicada")
    incident = QualityIncident(
        company_id=company_id,
        location_id=payload.location_id,
        inspection_id=payload.inspection_id,
        inspection_item_id=payload.inspection_item_id,
        title=payload.title,
        description=payload.description,
        severity=payload.severity,
        created_by_user_id=current_user.id,
    )
    db.add(incident)
    db.commit()
    return _get_incident(db, company_id, incident.id)


def update_incident(
    db: Session,
    current_user: User,
    incident_id: int,
    payload: QualityIncidentUpdate,
) -> QualityIncident:
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    incident = _get_incident(db, company_id, incident_id, for_update=True)
    _require_location_access(db, current_user, incident.location_id, MANAGE_CAPABILITY)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(incident, key, value)
    if incident.status in {"resolved", "closed"} and incident.resolved_at is None:
        incident.resolved_at = datetime.now(timezone.utc)
        incident.resolved_by_user_id = current_user.id
    if incident.status in {"open", "in_progress"}:
        incident.resolved_at = None
        incident.resolved_by_user_id = None
    db.commit()
    return _get_incident(db, company_id, incident.id)


def create_corrective_action(
    db: Session,
    current_user: User,
    incident_id: int,
    payload: QualityCorrectiveActionCreate,
) -> QualityCorrectiveAction:
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    incident = _get_incident(db, company_id, incident_id, for_update=True)
    _require_location_access(db, current_user, incident.location_id, MANAGE_CAPABILITY)
    action = QualityCorrectiveAction(
        incident_id=incident.id,
        title=payload.title,
        description=payload.description,
        due_at=payload.due_at,
        created_by_user_id=current_user.id,
    )
    db.add(action)
    db.commit()
    return next(item for item in _get_incident(db, company_id, incident.id).corrective_actions if item.id == action.id)


def update_corrective_action(
    db: Session,
    current_user: User,
    incident_id: int,
    action_id: int,
    payload: QualityCorrectiveActionUpdate,
) -> QualityCorrectiveAction:
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    incident = _get_incident(db, company_id, incident_id, for_update=True)
    _require_location_access(db, current_user, incident.location_id, MANAGE_CAPABILITY)
    action = next((item for item in incident.corrective_actions if item.id == action_id), None)
    if action is None:
        raise HTTPException(status_code=404, detail="Acción correctiva no encontrada")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(action, key, value)
    if action.status == "completed" and action.completed_at is None:
        action.completed_at = datetime.now(timezone.utc)
        action.completed_by_user_id = current_user.id
    if action.status != "completed":
        action.completed_at = None
        action.completed_by_user_id = None
    db.commit()
    return next(item for item in _get_incident(db, company_id, incident.id).corrective_actions if item.id == action.id)
