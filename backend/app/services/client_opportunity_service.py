from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.client_opportunity import ClientOpportunity, ClientOpportunityActivity
from app.models.user import User
from app.repositories import client_contact as client_contact_repo
from app.repositories import client_opportunity as opportunity_repo
from app.repositories import organization as organization_repo
from app.schemas.client_sales import (
    ClientOpportunityActivityCreate,
    ClientOpportunityActivityResponse,
    ClientOpportunityCreate,
    ClientOpportunityOwnerResponse,
    ClientOpportunityResponse,
    ClientOpportunityUpdate,
)
from app.services import client_service


def _client_or_404(db: Session, company_id: int | None, client_id: int):
    return client_service.get_client(db, company_id, client_id)


def _validate_contact(db: Session, *, client_id: int, contact_id: int | None) -> None:
    if contact_id is None:
        return
    contact = client_contact_repo.get_for_client(db, client_id, contact_id)
    if not contact or not contact.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Select an active contact from this client account",
        )


def _validate_owner(
    db: Session, *, company_id: int | None, owner_membership_id: int | None
) -> None:
    if owner_membership_id is None:
        return
    if company_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A company member is required to own an opportunity",
        )
    membership = organization_repo.get_company_membership(
        db, company_id=company_id, membership_id=owner_membership_id
    )
    if not membership or membership.status != "active" or not membership.user or not membership.user.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Select an active person from this company",
        )


def _validate_loss_state(stage: str, loss_reason: str | None) -> None:
    if stage == "lost" and not loss_reason:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A loss reason is required when an opportunity is lost",
        )


def _opportunity_or_404(db: Session, *, client_id: int, opportunity_id: int) -> ClientOpportunity:
    opportunity = opportunity_repo.get_for_client(
        db, client_id=client_id, opportunity_id=opportunity_id
    )
    if not opportunity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commercial opportunity not found",
        )
    return opportunity


def list_opportunities(
    db: Session, company_id: int | None, client_id: int
) -> list[ClientOpportunityResponse]:
    _client_or_404(db, company_id, client_id)
    return [
        ClientOpportunityResponse.model_validate(opportunity)
        for opportunity in opportunity_repo.list_for_client(db, client_id=client_id)
    ]


def list_owners(
    db: Session, company_id: int | None, client_id: int
) -> list[ClientOpportunityOwnerResponse]:
    _client_or_404(db, company_id, client_id)
    if company_id is None:
        return []
    return [
        ClientOpportunityOwnerResponse(
            membership_id=membership.id,
            user_id=membership.user_id,
            full_name=membership.user.full_name or membership.user.email,
            email=membership.user.email,
            access_class=membership.access_class,
        )
        for membership in organization_repo.list_company_memberships(db, company_id)
        if membership.status == "active" and membership.user and membership.user.is_active
    ]


def create_opportunity(
    db: Session,
    company_id: int | None,
    client_id: int,
    payload: ClientOpportunityCreate,
    current_user: User,
) -> ClientOpportunityResponse:
    _client_or_404(db, company_id, client_id)
    _validate_contact(db, client_id=client_id, contact_id=payload.contact_id)
    _validate_owner(
        db, company_id=company_id, owner_membership_id=payload.owner_membership_id
    )
    _validate_loss_state(payload.stage, payload.loss_reason)
    opportunity = ClientOpportunity(
        client_id=client_id,
        contact_id=payload.contact_id,
        owner_membership_id=payload.owner_membership_id,
        created_by_user_id=current_user.id,
        title=payload.title,
        stage=payload.stage,
        next_follow_up_at=payload.next_follow_up_at,
        loss_reason=payload.loss_reason if payload.stage == "lost" else None,
    )
    db.add(opportunity)
    db.commit()
    persisted = _opportunity_or_404(db, client_id=client_id, opportunity_id=opportunity.id)
    return ClientOpportunityResponse.model_validate(persisted)


def update_opportunity(
    db: Session,
    company_id: int | None,
    client_id: int,
    opportunity_id: int,
    payload: ClientOpportunityUpdate,
    current_user: User,
) -> ClientOpportunityResponse:
    _client_or_404(db, company_id, client_id)
    opportunity = _opportunity_or_404(
        db, client_id=client_id, opportunity_id=opportunity_id
    )
    updates = payload.model_dump(exclude_unset=True)
    next_stage = updates.get("stage", opportunity.stage)
    next_loss_reason = updates.get("loss_reason", opportunity.loss_reason)
    _validate_contact(
        db, client_id=client_id, contact_id=updates.get("contact_id", opportunity.contact_id)
    )
    _validate_owner(
        db,
        company_id=company_id,
        owner_membership_id=updates.get("owner_membership_id", opportunity.owner_membership_id),
    )
    _validate_loss_state(next_stage, next_loss_reason)
    previous_stage = opportunity.stage
    for field, value in updates.items():
        setattr(opportunity, field, value)
    if next_stage != "lost":
        opportunity.loss_reason = None
    if next_stage != previous_stage:
        db.add(
            ClientOpportunityActivity(
                opportunity=opportunity,
                created_by_user_id=current_user.id,
                activity_type="stage_change",
                stage_from=previous_stage,
                stage_to=next_stage,
            )
        )
    db.add(opportunity)
    db.commit()
    persisted = _opportunity_or_404(db, client_id=client_id, opportunity_id=opportunity.id)
    return ClientOpportunityResponse.model_validate(persisted)


def list_activities(
    db: Session, company_id: int | None, client_id: int, opportunity_id: int
) -> list[ClientOpportunityActivityResponse]:
    _client_or_404(db, company_id, client_id)
    _opportunity_or_404(db, client_id=client_id, opportunity_id=opportunity_id)
    return [
        ClientOpportunityActivityResponse.model_validate(activity)
        for activity in opportunity_repo.list_activities(db, opportunity_id=opportunity_id)
    ]


def create_activity(
    db: Session,
    company_id: int | None,
    client_id: int,
    opportunity_id: int,
    payload: ClientOpportunityActivityCreate,
    current_user: User,
) -> ClientOpportunityActivityResponse:
    _client_or_404(db, company_id, client_id)
    opportunity = _opportunity_or_404(
        db, client_id=client_id, opportunity_id=opportunity_id
    )
    activity = ClientOpportunityActivity(
        opportunity_id=opportunity.id,
        created_by_user_id=current_user.id,
        activity_type=payload.activity_type,
        body=payload.body,
        happened_at=payload.happened_at,
    )
    db.add(activity)
    db.commit()
    persisted = next(
        (
            item
            for item in opportunity_repo.list_activities(db, opportunity_id=opportunity.id)
            if item.id == activity.id
        ),
        None,
    )
    if not persisted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return ClientOpportunityActivityResponse.model_validate(persisted)
