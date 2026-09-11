from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.quality_incident import (
    QualityCorrectiveActionCreate,
    QualityCorrectiveActionResponse,
    QualityCorrectiveActionUpdate,
    QualityIncidentCreate,
    QualityIncidentResponse,
    QualityIncidentUpdate,
)
from app.services import audit_service, quality_incident_service


router = APIRouter()


@router.get("/", response_model=list[QualityIncidentResponse])
def read_quality_incidents(db: Session = Depends(get_db), current_user: User = ActiveUser):
    return quality_incident_service.list_incidents(db, current_user)


@router.get("/{incident_id}", response_model=QualityIncidentResponse)
def read_quality_incident(incident_id: int, db: Session = Depends(get_db), current_user: User = ActiveUser):
    return quality_incident_service.get_incident(db, current_user, incident_id)


@router.post("/", response_model=QualityIncidentResponse, status_code=status.HTTP_201_CREATED)
def create_quality_incident(payload: QualityIncidentCreate, request: Request, db: Session = Depends(get_db), current_user: User = ActiveUser):
    incident = quality_incident_service.create_incident(db, current_user, payload)
    audit_service.record_event(db, actor=current_user, company_id=incident.company_id, action="quality_incident.created", entity_type="quality_incident", entity_id=incident.id, request=request, details={"location_id": incident.location_id, "inspection_id": incident.inspection_id})
    return incident


@router.patch("/{incident_id}", response_model=QualityIncidentResponse)
def update_quality_incident(incident_id: int, payload: QualityIncidentUpdate, request: Request, db: Session = Depends(get_db), current_user: User = ActiveUser):
    incident = quality_incident_service.update_incident(db, current_user, incident_id, payload)
    audit_service.record_event(db, actor=current_user, company_id=incident.company_id, action="quality_incident.updated", entity_type="quality_incident", entity_id=incident.id, request=request, details={"location_id": incident.location_id, "status": incident.status})
    return incident


@router.post("/{incident_id}/actions", response_model=QualityCorrectiveActionResponse, status_code=status.HTTP_201_CREATED)
def create_quality_corrective_action(incident_id: int, payload: QualityCorrectiveActionCreate, request: Request, db: Session = Depends(get_db), current_user: User = ActiveUser):
    action = quality_incident_service.create_corrective_action(db, current_user, incident_id, payload)
    audit_service.record_event(db, actor=current_user, company_id=current_user.company_id, action="quality_corrective_action.created", entity_type="quality_corrective_action", entity_id=action.id, request=request, details={"incident_id": incident_id})
    return action


@router.patch("/{incident_id}/actions/{action_id}", response_model=QualityCorrectiveActionResponse)
def update_quality_corrective_action(incident_id: int, action_id: int, payload: QualityCorrectiveActionUpdate, request: Request, db: Session = Depends(get_db), current_user: User = ActiveUser):
    action = quality_incident_service.update_corrective_action(db, current_user, incident_id, action_id, payload)
    audit_service.record_event(db, actor=current_user, company_id=current_user.company_id, action="quality_corrective_action.updated", entity_type="quality_corrective_action", entity_id=action.id, request=request, details={"incident_id": incident_id, "status": action.status})
    return action
