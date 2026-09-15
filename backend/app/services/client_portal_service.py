"""Scoped serializers for the narrow, authenticated customer workspace."""

from app.models.client_portal_grant import ClientPortalGrant
from app.models.invoice import Invoice
from app.models.quote import Quote
from app.models.service_contract import ServiceContract
from app.repositories import client_portal as client_portal_repo
from app.services import quality_client_acceptance_service, quality_complaint_service


def _line(*, description: str, quantity: float, unit_price: float, subtotal: float, tax_rate: float | None = None, total: float | None = None) -> dict:
    return {
        "description": description,
        "quantity": float(quantity),
        "unit_price": float(unit_price),
        "subtotal": float(subtotal),
        "tax_rate": float(tax_rate) if tax_rate is not None else None,
        "total": float(total) if total is not None else None,
    }


def serialize_workspace(grant: ClientPortalGrant) -> dict:
    return {
        "id": grant.id,
        "company_name": grant.company.name,
        "client_name": grant.client.name,
        "status": grant.status,
        "expires_at": grant.expires_at,
    }


def serialize_invoice(invoice: Invoice) -> dict:
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "issue_date": invoice.issue_date,
        "due_date": invoice.due_date,
        "status": invoice.status,
        "base_amount": float(invoice.base_amount),
        "tax_amount": float(invoice.tax_amount),
        "total_amount": float(invoice.total_amount),
        "is_rectification": invoice.is_rectification,
        "original_invoice_id": invoice.original_invoice_id,
        "payment_method": invoice.payment_method,
        "paid_at": invoice.paid_at,
        "lines": [
            _line(
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.subtotal,
                tax_rate=item.tax_rate,
                total=item.total,
            )
            for item in invoice.items
        ],
    }


def serialize_quote(quote: Quote) -> dict:
    return {
        "id": quote.id,
        "quote_number": quote.quote_number,
        "title": quote.title,
        "status": quote.status,
        "valid_until": quote.valid_until,
        "base_amount": float(quote.base_amount),
        "tax_amount": float(quote.tax_amount),
        "total_amount": float(quote.total_amount),
        "terms": quote.terms,
        "revision_number": quote.revision_number,
        "lines": [
            _line(
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.subtotal,
            )
            for item in quote.items
        ],
    }


def serialize_contract(contract: ServiceContract) -> dict:
    return {
        "id": contract.id,
        "contract_number": contract.contract_number,
        "title": contract.title,
        "status": contract.status,
        "starts_at": contract.starts_at,
        "ends_at": contract.ends_at,
        "renewal_mode": contract.renewal_mode,
        "renewal_notice_days": contract.renewal_notice_days,
        "response_time_hours": contract.response_time_hours,
        "resolution_time_hours": contract.resolution_time_hours,
        "service_window": contract.service_window,
        "lines": [
            _line(
                description=line.description,
                quantity=line.quantity,
                unit_price=line.unit_price,
                subtotal=line.subtotal,
            )
            for line in contract.service_lines
        ],
        "covered_locations": [
            {
                "location_name": link.location.name if link.location else None,
                "covered_from": link.covered_from,
                "covered_until": link.covered_until,
                "zone_names": [
                    zone_link.zone.name
                    for zone_link in link.covered_zones
                    if zone_link.zone is not None
                ],
            }
            for link in contract.covered_locations
        ],
    }


def overview(db, *, grant: ClientPortalGrant) -> dict:
    return {
        "workspace": serialize_workspace(grant),
        "invoices": [serialize_invoice(invoice) for invoice in client_portal_repo.list_invoices(db, grant=grant)],
        "quotes": [serialize_quote(quote) for quote in client_portal_repo.list_quotes(db, grant=grant)],
        "contracts": [serialize_contract(contract) for contract in client_portal_repo.list_contracts(db, grant=grant)],
        "inspections": quality_client_acceptance_service.list_client_portal_inspections(
            db, grant=grant
        ),
        "complaint_locations": quality_complaint_service.list_client_portal_locations(
            db, grant=grant
        ),
        "complaints": quality_complaint_service.list_client_portal_complaints(
            db, grant=grant
        ),
    }
