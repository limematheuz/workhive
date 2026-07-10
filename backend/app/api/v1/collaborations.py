from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, ActiveUser, ActiveManagerOrAdmin
from app.models.user import User
from app.schemas.collaboration import CollaborationResponse, CollaborationRequestCreate
from app.schemas.company import CompanyPartnerResponse
from app.services import collaboration_service
from app.repositories import company_collaboration as collab_repo

router = APIRouter()


@router.get("/code", response_model=dict[str, str])
def read_partner_code(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A platform superadmin does not have a company partner code",
        )
    code = collaboration_service.get_or_generate_partner_code(db, current_user.company_id)
    return {"partner_code": code}


@router.get("/", response_model=list[CollaborationResponse])
def read_collaborations(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    if current_user.company_id is None:
        return []
    return collab_repo.list_collaborations(db, current_user.company_id)


@router.get("/service-providers", response_model=list[CompanyPartnerResponse])
def read_service_providers(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    if current_user.company_id is None:
        return []
    return collab_repo.list_partner_companies(db, current_user.company_id)


@router.get("/requests/pending", response_model=list[CollaborationResponse])
def read_pending_requests(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    if current_user.company_id is None:
        return []
    return collab_repo.list_pending_requests(db, current_user.company_id)


@router.get("/requests/sent", response_model=list[CollaborationResponse])
def read_sent_requests(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    if current_user.company_id is None:
        return []
    return collab_repo.list_sent_requests(db, current_user.company_id)


@router.post("/requests", response_model=CollaborationResponse, status_code=status.HTTP_201_CREATED)
def create_collaboration_request(
    data: CollaborationRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    return collaboration_service.send_collaboration_request(
        db, current_user, data.partner_code, data.role_type
    )


@router.post("/requests/{request_id}/accept", response_model=CollaborationResponse)
def accept_collaboration(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    return collaboration_service.accept_collaboration_request(db, current_user, request_id)


@router.post("/requests/{request_id}/reject", response_model=CollaborationResponse)
def reject_collaboration(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    return collaboration_service.reject_collaboration_request(db, current_user, request_id)


@router.delete("/{collab_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collaboration(
    collab_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    collaboration_service.unlink_collaboration(db, current_user, collab_id)
