from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.client import (
    ClientAccountAssignmentResponse,
    ClientAccountAssignmentUpdate,
)
from app.services import (
    audit_service,
    client_account_assignment_service,
    client_authorization_service,
)


router = APIRouter()


@router.get(
    "/account-assignment",
    response_model=ClientAccountAssignmentResponse,
)
def read_client_account_assignment(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return client_account_assignment_service.get_current_assignment(
        db,
        company_id=client_authorization_service.require_client_capability(
            db,
            current_user,
            client_authorization_service.CAPABILITY_CLIENTS_READ,
        ),
        client_id=client_id,
    )


@router.put(
    "/account-assignment",
    response_model=ClientAccountAssignmentResponse,
    responses={204: {"description": "Commercial owner cleared"}},
)
def replace_client_account_assignment(
    client_id: int,
    payload: ClientAccountAssignmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    company_id = client_authorization_service.require_client_capability(
        db,
        current_user,
        client_authorization_service.CAPABILITY_CLIENTS_MANAGE,
    )
    assignment = client_account_assignment_service.replace_assignment(
        db,
        company_id=company_id,
        client_id=client_id,
        payload=payload,
        current_user=current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=company_id,
        action=(
            "client.account_manager_cleared"
            if assignment is None
            else "client.account_manager_assigned"
        ),
        entity_type="client",
        entity_id=client_id,
        request=request,
        details={"membership_id": payload.membership_id},
    )
    if assignment is None:
        return Response(status_code=204)
    return assignment
