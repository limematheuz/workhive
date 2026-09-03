"""Business rules for the commercial owner of a client account."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.client_account_assignment import ClientAccountAssignment
from app.models.user import User
from app.repositories import client_account_assignment as assignment_repo
from app.repositories import organization as organization_repo
from app.schemas.client import (
    ClientAccountAssignmentResponse,
    ClientAccountAssignmentUpdate,
    ClientPortfolioItemResponse,
    ClientResponse,
)
from app.services import client_service


def get_current_assignment(
    db: Session,
    *,
    company_id: int,
    client_id: int,
) -> ClientAccountAssignmentResponse:
    client_service.get_client(db, company_id, client_id)
    assignment = assignment_repo.get_current_for_client(
        db,
        company_id=company_id,
        client_id=client_id,
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commercial owner is not assigned",
        )
    return ClientAccountAssignmentResponse.model_validate(assignment)


def replace_assignment(
    db: Session,
    *,
    company_id: int,
    client_id: int,
    payload: ClientAccountAssignmentUpdate,
    current_user: User,
) -> ClientAccountAssignmentResponse | None:
    client_service.get_client(db, company_id, client_id)
    locked_client = assignment_repo.get_client_for_update(
        db,
        company_id=company_id,
        client_id=client_id,
    )
    if not locked_client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    current_assignment = assignment_repo.get_current_for_client(
        db,
        company_id=company_id,
        client_id=client_id,
    )
    if payload.membership_id is None:
        if current_assignment:
            current_assignment.ended_at = datetime.now(timezone.utc)
            db.add(current_assignment)
            db.commit()
        return None

    membership = organization_repo.get_company_membership(
        db,
        company_id=company_id,
        membership_id=payload.membership_id,
    )
    if (
        not membership
        or membership.status != "active"
        or not membership.user
        or not membership.user.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Select an active person from this company",
        )

    if current_assignment and current_assignment.company_membership_id == membership.id:
        return ClientAccountAssignmentResponse.model_validate(current_assignment)
    if current_assignment:
        current_assignment.ended_at = datetime.now(timezone.utc)
        db.add(current_assignment)

    assignment = ClientAccountAssignment(
        company_id=company_id,
        client_id=locked_client.id,
        company_membership_id=membership.id,
        assigned_by_user_id=current_user.id,
    )
    db.add(assignment)
    db.commit()
    persisted = assignment_repo.get_current_for_client(
        db,
        company_id=company_id,
        client_id=client_id,
    )
    if not persisted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return ClientAccountAssignmentResponse.model_validate(persisted)


def list_current_user_portfolio(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
) -> list[ClientPortfolioItemResponse]:
    assignments = assignment_repo.list_current_for_membership(
        db,
        company_id=company_id,
        membership_id=membership_id,
    )
    return [
        ClientPortfolioItemResponse(
            client=ClientResponse.model_validate(assignment.client),
            assignment=ClientAccountAssignmentResponse.model_validate(assignment),
        )
        for assignment in assignments
        if assignment.client is not None and assignment.client.is_active
    ]
