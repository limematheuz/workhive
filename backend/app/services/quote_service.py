import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.repositories import quote as quote_repo
from app.repositories import quote_item as quote_item_repo
from app.repositories import client as client_repo
from app.schemas.quote import (
    QuoteAcceptRequest,
    QuoteCreate,
    QuoteEmailRequest,
    QuoteUpdate,
)
from app.schemas.quote_item import QuoteItemCreate
from app.services import (
    email_service,
    invoice_email_contact_service,
    service_contract_service,
)
from app.services.quote_policy_service import (
    assert_quote_content_editable,
    get_quote_or_404,
    require_quotes_feature,
)
from app.services.quote_pdf import generate_quote_email_pdf
from app.services import quote_revision_service

VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["sent", "rejected", "expired"],
    "sent": ["rejected", "expired"],
    "accepted": [],
    "rejected": [],
    "expired": [],
}
logger = logging.getLogger(__name__)


def _validate_client(db: Session, company_id: int, client_id: int) -> None:
    if not client_repo.get_client_by_id(db, client_id, company_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )


def get_quotes(
    db: Session,
    company_id: int,
    client_id: int | None = None,
    quote_status: str | None = None,
    skip: int = 0,
    limit: int = 100,
):
    require_quotes_feature(db, company_id)
    return quote_repo.get_quotes(db, company_id, client_id, quote_status, skip, limit)


def get_quote(db: Session, company_id: int, quote_id: int):
    require_quotes_feature(db, company_id)
    return get_quote_or_404(db, company_id, quote_id)


def get_quote_pdf(
    db: Session,
    company_id: int,
    quote_id: int,
):
    require_quotes_feature(db, company_id)
    quote = get_quote_or_404(db, company_id, quote_id)
    if not quote.items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A quote must contain at least one item before it can be downloaded",
        )
    return quote, generate_quote_email_pdf(quote)


def _quote_recipient_name(quote) -> str:
    if quote.client and quote.client.name:
        return quote.client.name.strip()
    if quote.custom_recipient_info:
        first_line = quote.custom_recipient_info.strip().split("\n", 1)[0].strip()
        if first_line:
            return first_line
    return "cliente"


def _quote_recipient_emails(quote, data: QuoteEmailRequest) -> list[str]:
    emails = [str(email).strip() for email in data.recipient_emails or []]
    if data.recipient_email:
        emails.append(str(data.recipient_email).strip())
    if not emails and quote.client and quote.client.email:
        emails.append(quote.client.email.strip())
    return list(dict.fromkeys(email.lower() for email in emails if email))


def email_quote(
    db: Session,
    company_id: int,
    quote_id: int,
    data: QuoteEmailRequest,
    *,
    sender_email: str | None = None,
    actor_user_id: int | None = None,
):
    require_quotes_feature(db, company_id)
    quote = quote_repo.get_quote_for_update(db, company_id, quote_id)
    if quote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found",
        )
    if quote.status not in {"draft", "sent"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft or sent quotes can be emailed",
        )
    if not quote.items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A quote must contain at least one item before it can be emailed",
        )

    recipient_emails = _quote_recipient_emails(quote, data)
    if not recipient_emails:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The quote recipient does not have an email address",
        )
    if (
        data.save_recipient_to_client_id is not None
        and data.save_recipient_to_client_id != quote.client_id
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The email can only be saved to this quote's client",
        )
    if data.save_recipient_to_client_id is not None and len(recipient_emails) != 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Select exactly one recipient before saving it to a client",
        )

    pdf_path = generate_quote_email_pdf(quote)
    try:
        sent = email_service.send_invoice_email(
            recipient_email=recipient_emails,
            recipient_name=_quote_recipient_name(quote),
            issuer_name=(quote.company.name if quote.company else "WorkHive"),
            invoice_number=quote.quote_number,
            pdf_path=pdf_path,
            subject=data.subject,
            custom_message=data.message,
            sender_copy_email=sender_email if data.send_copy else None,
            copy_emails=[str(email) for email in data.copy_emails or []],
            document_label="Presupuesto",
            locale=data.locale,
        )
    except Exception:
        logger.exception("Quote email delivery failed")
        sent = False
    finally:
        pdf_path.unlink(missing_ok=True)

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Quote email delivery is not configured or unavailable",
        )

    try:
        if quote.status == "draft":
            quote.status = "sent"
        quote_revision_service.get_or_create_current_quote_revision(
            db,
            quote,
            actor_user_id=actor_user_id,
        )
        db.add(quote)
        db.commit()
        if data.save_recipient_to_client_id is not None:
            invoice_email_contact_service.save_email_to_client(
                db,
                company_id,
                data.save_recipient_to_client_id,
                recipient_emails,
            )
        if data.save_recipients:
            invoice_email_contact_service.remember_document_recipients(
                db,
                company_id,
                recipient_emails,
            )
    except Exception:
        db.rollback()
        raise
    return quote, ", ".join(recipient_emails)


def create_quote(db: Session, company_id: int, data: QuoteCreate):
    require_quotes_feature(db, company_id)
    if data.client_id is not None:
        _validate_client(db, company_id, data.client_id)
    try:
        quote = quote_repo.create_quote(
            db,
            company_id=company_id,
            client_id=data.client_id,
            title=data.title,
            valid_until=data.valid_until,
            notes=data.notes,
            tax_rate=data.tax_rate,
            discount=data.discount,
            equivalence_surcharge=data.equivalence_surcharge,
            retention=data.retention,
            terms=data.terms,
            shipping_address=data.shipping_address,
            custom_issuer_info=data.custom_issuer_info,
            custom_recipient_info=data.custom_recipient_info,
            signature_url=data.signature_url,
        )
        for item in data.items:
            quote_item_repo.create_quote_item(
                db,
                quote=quote,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
        quote_repo.recalculate_totals(db, quote)
        db.commit()
        return quote_repo.get_quote(db, company_id, quote.id)
    except Exception:
        db.rollback()
        raise


def _validate_quote_update(
    db: Session,
    company_id: int,
    quote,
    data: QuoteUpdate,
) -> None:
    if "client_id" in data.model_fields_set and data.client_id is not None:
        _validate_client(db, company_id, data.client_id)
    if data.status == "accepted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use the quote acceptance operation",
        )
    if data.status and data.status != quote.status:
        allowed = VALID_TRANSITIONS.get(quote.status, [])
        if data.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition quote from '{quote.status}' to '{data.status}'",
            )

    content_fields = data.model_fields_set - {"status"}
    if content_fields:
        assert_quote_content_editable(quote)


def _replace_quote_items(db: Session, quote, items: list[QuoteItemCreate]) -> None:
    for existing_item in list(quote.items):
        quote_item_repo.delete_quote_item(db, existing_item)
    for item in items:
        quote_item_repo.create_quote_item(
            db,
            quote=quote,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
        )
    db.expire(quote, ["items"])


def update_quote(
    db: Session,
    company_id: int,
    quote_id: int,
    data: QuoteUpdate,
    *,
    actor_user_id: int | None = None,
):
    require_quotes_feature(db, company_id)
    quote = quote_repo.get_quote_for_update(db, company_id, quote_id)
    if quote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found",
        )
    _validate_quote_update(db, company_id, quote, data)

    try:
        update_data = data.model_dump(exclude_unset=True, exclude={"items"})
        updated_quote = quote_repo.update_quote(db, quote, **update_data)
        if data.items is not None:
            _replace_quote_items(db, updated_quote, data.items)
        quote_repo.recalculate_totals(db, updated_quote)
        if data.status == "sent":
            quote_revision_service.get_or_create_current_quote_revision(
                db,
                updated_quote,
                actor_user_id=actor_user_id,
            )
        db.commit()
        return quote_repo.get_quote(db, company_id, quote_id)
    except Exception:
        db.rollback()
        raise


def accept_quote(
    db: Session,
    company_id: int,
    quote_id: int,
    data: QuoteAcceptRequest,
    *,
    actor_user_id: int | None = None,
):
    require_quotes_feature(db, company_id)
    quote = quote_repo.get_quote_for_update(db, company_id, quote_id)
    if quote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found",
        )
    if quote.status != "sent":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only sent quotes can be accepted",
        )
    if not quote.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A quote must contain at least one item",
        )

    accepted_revision = quote_revision_service.get_or_create_current_quote_revision(
        db,
        quote,
        actor_user_id=actor_user_id,
    )

    if data.register_client:
        if quote.client_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quote already has a registered client",
            )
        client_data = data.client.model_copy(
            update={"company_id": company_id, "is_active": True}
        )
        if client_data.legal_number and client_repo.get_client_by_legal_number(
            db,
            company_id,
            client_data.legal_number,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Legal Number already exists",
            )
        registered_client = client_repo.stage_client(db, client_data)
        quote.client_id = registered_client.id

    accepted_revision.accepted_at = datetime.now(timezone.utc)
    quote.accepted_revision_id = accepted_revision.id
    quote.status = "accepted"
    db.add(quote)
    try:
        # Acceptance creates the agreement record, never an operational task.
        # The contract remains a draft until its locations and operating terms
        # are explicitly confirmed.
        service_contract_service.ensure_contract_from_accepted_quote(
            db,
            quote,
            actor_user_id=actor_user_id,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Client or quote data conflicts with an existing record",
        ) from exc
    return quote_repo.get_quote(db, company_id, quote_id)


def delete_quote(db: Session, company_id: int, quote_id: int) -> None:
    require_quotes_feature(db, company_id)
    quote = get_quote_or_404(db, company_id, quote_id)
    if quote.status not in ("draft",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft quotes can be deleted",
        )
    try:
        quote_repo.delete_quote(db, quote)
        db.commit()
    except Exception:
        db.rollback()
        raise
