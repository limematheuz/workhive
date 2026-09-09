"""Contract lifecycle built from immutable accepted quote revisions."""

from copy import deepcopy
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.service_contract import ServiceContract
from app.repositories import quote as quote_repo
from app.repositories import quote_revision as quote_revision_repo
from app.repositories import service_contract as service_contract_repo
from app.schemas.service_contract import ServiceContractTermsUpdate
from app.services import quote_revision_service
from app.services.quote_policy_service import require_quotes_feature


def get_contract_or_404(
    db: Session,
    company_id: int,
    contract_id: int,
    *,
    for_update: bool = False,
) -> ServiceContract:
    getter = (
        service_contract_repo.get_contract_for_update
        if for_update
        else service_contract_repo.get_contract
    )
    contract = getter(db, company_id, contract_id)
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )
    return contract


def _accepted_quote_revision(db: Session, quote, *, actor_user_id: int | None):
    if quote.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only accepted quotes can create a contract",
        )
    if quote.accepted_revision_id is not None:
        revision = quote_revision_repo.get_quote_revision(
            db,
            quote.company_id,
            quote.accepted_revision_id,
        )
        if revision is None or revision.quote_id != quote.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The accepted quote version is unavailable",
            )
        return revision

    # Quotes accepted before revisions existed are converted once, using the
    # then-current locked commercial content. The original quote is never
    # overwritten and this fallback is deliberately limited to legacy records.
    revision = quote_revision_service.get_or_create_current_quote_revision(
        db,
        quote,
        actor_user_id=actor_user_id,
    )
    revision.accepted_at = quote.updated_at or datetime.now(timezone.utc)
    quote.accepted_revision_id = revision.id
    db.add(quote)
    return revision


def ensure_contract_from_accepted_quote(
    db: Session,
    quote,
    *,
    actor_user_id: int | None,
):
    """Create exactly one draft contract from an accepted quote, if needed.

    This function deliberately has no work-order dependency. A contract is the
    intermediate agreement between commercial acceptance and future operation.
    """

    existing = service_contract_repo.get_contract_by_source_quote(
        db,
        quote.company_id,
        quote.id,
    )
    if existing is not None:
        return existing, False

    accepted_revision = _accepted_quote_revision(
        db,
        quote,
        actor_user_id=actor_user_id,
    )
    snapshot = deepcopy(accepted_revision.snapshot)
    line_items = snapshot.get("items")
    if not isinstance(line_items, list) or not line_items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The accepted quote version has no service lines",
        )

    title = snapshot.get("title")
    if not isinstance(title, str) or not title.strip():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The accepted quote version has no contract title",
        )

    contract = service_contract_repo.create_contract(
        db,
        company_id=quote.company_id,
        client_id=quote.client_id,
        source_quote_id=quote.id,
        source_quote_revision_id=accepted_revision.id,
        title=title.strip(),
        quote_snapshot=snapshot,
        created_by_user_id=actor_user_id,
    )
    for position, line in enumerate(line_items, start=1):
        try:
            description = str(line["description"]).strip()
            quantity = float(line["quantity"])
            unit_price = float(line["unit_price"])
            subtotal = float(line["subtotal"])
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The accepted quote version has an invalid service line",
            ) from exc
        if not description:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The accepted quote version has an invalid service line",
            )
        service_contract_repo.create_contract_line(
            db,
            contract_id=contract.id,
            position=position,
            description=description,
            quantity=quantity,
            unit_price=unit_price,
            subtotal=subtotal,
        )
    return contract, True


def create_contract_from_accepted_quote(
    db: Session,
    company_id: int,
    quote_id: int,
    *,
    actor_user_id: int | None,
):
    """Backfill a contract for an accepted legacy quote without duplicating it."""

    require_quotes_feature(db, company_id)
    quote = quote_repo.get_quote_for_update(db, company_id, quote_id)
    if quote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found",
        )
    try:
        contract, _ = ensure_contract_from_accepted_quote(
            db,
            quote,
            actor_user_id=actor_user_id,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        contract = service_contract_repo.get_contract_by_source_quote(
            db,
            company_id,
            quote_id,
        )
        if contract is None:
            raise
    except Exception:
        db.rollback()
        raise
    return service_contract_repo.get_contract(db, company_id, contract.id)


def get_contracts(
    db: Session,
    company_id: int,
    *,
    contract_status: str | None = None,
    skip: int = 0,
    limit: int = 100,
):
    require_quotes_feature(db, company_id)
    return service_contract_repo.get_contracts(
        db,
        company_id,
        status=contract_status,
        skip=skip,
        limit=limit,
    )


def get_contract(db: Session, company_id: int, contract_id: int):
    require_quotes_feature(db, company_id)
    return get_contract_or_404(db, company_id, contract_id)


def update_contract_terms(
    db: Session,
    company_id: int,
    contract_id: int,
    data: ServiceContractTermsUpdate,
):
    require_quotes_feature(db, company_id)
    contract = get_contract_or_404(db, company_id, contract_id, for_update=True)
    updates = data.model_dump(exclude_unset=True)
    starts_at = updates.get("starts_at", contract.starts_at)
    ends_at = updates.get("ends_at", contract.ends_at)
    if starts_at is not None and ends_at is not None and ends_at < starts_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Contract end date cannot be before its start date",
        )
    try:
        service_contract_repo.update_contract(db, contract, **updates)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return service_contract_repo.get_contract(db, company_id, contract_id)
