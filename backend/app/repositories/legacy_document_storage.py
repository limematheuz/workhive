"""Query the remaining database rows that still reference legacy files."""

from sqlalchemy.orm import Session

from app.models.company_fiscal_settings import CompanyFiscalSettings
from app.models.invoice import Invoice


def _company_scope(query, company_ids: set[int] | None):
    if company_ids:
        return query.filter(Invoice.company_id.in_(company_ids))
    return query


def list_legacy_invoice_pdf_ids(
    db: Session, *, company_ids: set[int] | None = None
) -> list[int]:
    query = _company_scope(
        db.query(Invoice.id).filter(
            Invoice.pdf_storage_key.is_(None), Invoice.pdf_path.isnot(None)
        ),
        company_ids,
    )
    return [row[0] for row in query.order_by(Invoice.id).all()]


def list_legacy_facturae_ids(
    db: Session, *, company_ids: set[int] | None = None
) -> list[int]:
    query = _company_scope(
        db.query(Invoice.id).filter(
            Invoice.facturae_storage_key.is_(None), Invoice.facturae_path.isnot(None)
        ),
        company_ids,
    )
    return [row[0] for row in query.order_by(Invoice.id).all()]


def list_legacy_fiscal_settings_ids(
    db: Session, *, company_ids: set[int] | None = None
) -> list[int]:
    query = db.query(CompanyFiscalSettings.id).filter(
        CompanyFiscalSettings.certificate_storage_key.is_(None),
        CompanyFiscalSettings.certificate_path.isnot(None),
    )
    if company_ids:
        query = query.filter(CompanyFiscalSettings.company_id.in_(company_ids))
    return [row[0] for row in query.order_by(CompanyFiscalSettings.id).all()]


def lock_invoice(db: Session, *, invoice_id: int) -> Invoice | None:
    return (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .with_for_update()
        .one_or_none()
    )


def lock_fiscal_settings(
    db: Session, *, fiscal_settings_id: int
) -> CompanyFiscalSettings | None:
    return (
        db.query(CompanyFiscalSettings)
        .filter(CompanyFiscalSettings.id == fiscal_settings_id)
        .with_for_update()
        .one_or_none()
    )
