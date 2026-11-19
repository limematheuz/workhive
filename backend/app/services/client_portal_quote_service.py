"""Customer consent reuses commercial acceptance without granting finance access."""
from datetime import datetime, timezone
from types import SimpleNamespace
from fastapi import HTTPException
from app.models.audit_log import AuditLog
from app.repositories import client_portal_quote as repo, quote_revision as revisions
from app.schemas.quote import QuoteAcceptRequest
from app.services import client_portal_policy, client_portal_service, quote_service, quote_revision_service
from app.services.quote_pdf import generate_quote_email_pdf
from app.services.request_context import get_client_ip


def _quote(db, grant, quote_id, *, lock=False):
    row = repo.quote(db, grant, quote_id, for_update=lock)
    if row is None:
        raise HTTPException(404, "Presupuesto no encontrado en este portal.")
    return row


def accept(db, principal, quote_id, payload, request):
    try:
        # The same row lock serializes acceptance with grant revocation.
        if repo.lock_grant(db, principal.grant.id, principal.user.id) is None:
            raise HTTPException(403, "El acceso al portal ya no está disponible.")
        grant = client_portal_policy.require_active_client_portal(db, current_user=principal.user, grant_id=principal.grant.id)
        quote = _quote(db, grant, quote_id, lock=True)
        if quote.revision_number != payload.expected_revision:
            raise HTTPException(409, "El presupuesto ha cambiado. Actualiza los documentos y revisa la nueva versión antes de aceptar.")
        if quote.status != "sent":
            raise HTTPException(409, "Este presupuesto ya no está pendiente de aceptación.")
        until = quote.valid_until
        if until is not None and (until.astimezone(timezone.utc) if until.tzinfo else until.replace(tzinfo=timezone.utc)) <= datetime.now(timezone.utc):
            raise HTTPException(409, "El presupuesto ha vencido. Solicita una revisión al proveedor.")
        revision = revisions.get_revision_for_quote(db, quote, quote.revision_number)
        if not quote_revision_service.matches_published_revision(quote, revision):
            raise HTTPException(409, "No se puede verificar la revisión enviada. Pide al proveedor que vuelva a publicarla.")
        db.add(AuditLog(company_id=grant.company_id, actor_user_id=principal.user.id, action="quote.client_accepted",
            entity_type="quote", entity_id=str(quote.id), request_id=getattr(request.state, "request_id", None),
            ip_address=get_client_ip(request), details={"grant_id": grant.id, "client_id": grant.client_id,
                "revision_id": revision.id, "revision": revision.version, "total_amount": quote.total_amount, "confirmed": True}))
        # This commits the consent log and the canonical immutable acceptance /
        # draft contract in one transaction. It never sends a message or invoice.
        accepted = quote_service.accept_quote(db, grant.company_id, quote.id, QuoteAcceptRequest(register_client=False), actor_user_id=principal.user.id)
        return client_portal_service.serialize_quote(accepted)
    except Exception:
        db.rollback()
        raise


def pdf(db, principal, quote_id):
    quote = _quote(db, principal.grant, quote_id)
    if not quote.items:
        raise HTTPException(422, "El presupuesto no tiene líneas para generar su PDF.")
    # The mail PDF template also prints internal notes/custom text. A detached
    # public view keeps this download consistent with the portal serializer.
    fields = ("id", "quote_number", "title", "valid_until", "created_at", "company", "client", "items",
        "tax_rate", "discount", "equivalence_surcharge", "retention", "base_amount", "tax_amount", "total_amount", "terms")
    public = SimpleNamespace(**{field: getattr(quote, field) for field in fields}, notes=None, custom_issuer_info=None, custom_recipient_info=None)
    path = generate_quote_email_pdf(public)
    try:
        return path.read_bytes()
    finally:
        path.unlink(missing_ok=True)
