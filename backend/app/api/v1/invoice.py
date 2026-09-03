from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import FileResponse
from app.api.deps import ActiveFinanceManager, ActiveFinanceReader
from app.api.deps import AsyncActiveFinancialReader, get_async_db, get_db
from app.api.pagination import PaginationLimit, PaginationOffset
from app.models.user import User
from app.schemas.invoice import (
    FacturaeGenerateRequest,
    FiscalCancellationRequest,
    FiscalInvoiceRecordResponse,
    InvoiceCreate,
    InvoiceDraftCreate,
    InvoiceEmailRequest,
    InvoiceResponse,
    InvoiceUpdate,
    RectificationCreate,
)
from app.schemas.task_item import InvoiceableTaskResponse
from app.schemas.invoice_item import (
    InvoiceItemCreate,
    InvoiceItemUpdate,
    InvoiceItemResponse,
)
from app.services import invoice_fiscal_record_service, invoice_service
from app.services import invoice_item_service
from app.services import audit_service
from app.services import facturae_service
from app.services import company_fiscal_settings_service
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit


router = APIRouter()


@router.get("/", response_model=list[InvoiceResponse])
async def read_invoices(
    client_id: int | None = None,
    invoice_status: str | None = None,
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: invoice_service.get_invoices(
            sync_db,
            current_user.company_id,
            client_id,
            invoice_status,
            skip,
            limit,
        )
    )


@router.get("/completed-jobs", response_model=list[InvoiceableTaskResponse])
async def read_completed_jobs_for_invoicing(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: invoice_service.get_invoiceable_completed_tasks(
            sync_db, current_user.company_id
        )
    )


@router.get("/fiscal/readiness")
async def read_fiscal_readiness(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: company_fiscal_settings_service.get_readiness(
            sync_db,
            current_user.company_id,
        )
    )


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def read_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: invoice_service.get_invoice(
            sync_db, current_user.company_id, invoice_id
        )
    )


@router.post("/", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    invoice_data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    return invoice_service.create_invoice(db, current_user.company_id, invoice_data)
@router.post(
    "/drafts",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice_draft(
    invoice_data: InvoiceDraftCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    return invoice_service.create_invoice_draft(
        db, current_user.company_id, invoice_data
    )


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_data: InvoiceUpdate,
    invoice_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    invoice = invoice_service.update_invoice(
        db, current_user.company_id, invoice_id, invoice_data
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=invoice.company_id,
        action="invoice.updated",
        entity_type="invoice",
        entity_id=invoice.id,
        request=request,
        details={
            "changed_fields": sorted(invoice_data.model_fields_set),
            "status": invoice.status,
        },
    )
    return invoice


@router.post("/{invoice_id}/issue", response_model=InvoiceResponse)
def issue_invoice(
    invoice_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    invoice = invoice_service.issue_invoice(
        db, current_user.company_id, invoice_id
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=invoice.company_id,
        action="invoice.issued",
        entity_type="invoice",
        entity_id=invoice.id,
        request=request,
        details={
            "invoice_number": invoice.invoice_number,
            "fiscal_submission_status": invoice.fiscal_submission_status,
            "pdf_sha256": invoice.pdf_sha256,
            "record_hash": invoice.invoice_hash,
        },
    )
    return invoice


@router.get("/{invoice_id}/pdf", response_class=FileResponse)
def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceReader,
):
    invoice, path = invoice_service.get_invoice_pdf(
        db, current_user.company_id, invoice_id
    )
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"{invoice.invoice_number}.pdf",
    )


@router.post("/{invoice_id}/send-email")
def send_invoice_email(
    invoice_id: int,
    data: InvoiceEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    enforce_rate_limit(
        request,
        "invoice-email",
        settings.INVOICE_EMAIL_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=f"{current_user.id}:{invoice_id}",
    )
    invoice, recipient_email = invoice_service.email_invoice(
        db,
        current_user.company_id,
        invoice_id,
        data,
        sender_email=current_user.email,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=invoice.company_id,
        action="invoice.emailed",
        entity_type="invoice",
        entity_id=invoice.id,
        request=request,
        details={
            "invoice_number": invoice.invoice_number,
            "recipient_source": (
                "override" if data.recipient_email else "invoice_snapshot"
            ),
        },
    )
    return {"status": "sent", "recipient_email": recipient_email}


@router.get(
    "/{invoice_id}/fiscal-record",
    response_model=FiscalInvoiceRecordResponse,
)
async def read_invoice_fiscal_record(
    invoice_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: invoice_fiscal_record_service.get_fiscal_record(
            sync_db, current_user.company_id, invoice_id
        )
    )


@router.get("/{invoice_id}/fiscal-record/xml")
def download_invoice_fiscal_xml(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceReader,
):
    record = invoice_fiscal_record_service.get_fiscal_record(
        db,
        current_user.company_id,
        invoice_id,
    )
    if not record.request_xml:
        return Response(
            status_code=status.HTTP_404_NOT_FOUND,
            content="The fiscal record has no AEAT XML",
            media_type="text/plain",
        )
    return Response(
        content=record.request_xml,
        media_type="application/xml",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{record.record_type}-'
                f'{invoice_id}-{record.id}.xml"'
            )
        },
    )


@router.post(
    "/{invoice_id}/fiscal-record/submit",
    response_model=FiscalInvoiceRecordResponse,
)
def submit_invoice_fiscal_record(
    invoice_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    record = invoice_fiscal_record_service.submit_fiscal_record(
        db,
        current_user.company_id,
        invoice_id,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="invoice.fiscal_submitted",
        entity_type="fiscal_invoice_record",
        entity_id=record.id,
        request=request,
        details={
            "invoice_id": invoice_id,
            "status": record.submission_status,
            "attempt_count": record.attempt_count,
            "aeat_csv": record.aeat_csv,
        },
    )
    return record


@router.post(
    "/{invoice_id}/fiscal-record/cancel",
    response_model=FiscalInvoiceRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
def cancel_invoice_fiscal_record(
    invoice_id: int,
    data: FiscalCancellationRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    record = invoice_fiscal_record_service.cancel_fiscal_invoice(
        db,
        current_user.company_id,
        invoice_id,
        data,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="invoice.fiscal_cancelled",
        entity_type="fiscal_invoice_record",
        entity_id=record.id,
        request=request,
        details={
            "invoice_id": invoice_id,
            "status": record.submission_status,
            "record_hash": record.record_hash,
        },
    )
    return record


@router.get("/{invoice_id}/facturae/readiness")
async def read_facturae_readiness(
    invoice_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: facturae_service.facturae_readiness(
            invoice_service.get_invoice(
                sync_db,
                current_user.company_id,
                invoice_id,
            )
        )
    )


@router.post("/{invoice_id}/facturae")
def generate_invoice_facturae(
    invoice_id: int,
    data: FacturaeGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    invoice, path = facturae_service.generate_facturae(
        db,
        current_user.company_id,
        invoice_id,
        sign=data.sign,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="invoice.facturae_generated",
        entity_type="invoice",
        entity_id=invoice.id,
        request=request,
        details={
            "signed": data.sign,
            "sha256": invoice.facturae_sha256,
        },
    )
    return {
        "status": invoice.facturae_signature_status,
        "sha256": invoice.facturae_sha256,
        "filename": path.name,
    }


@router.get("/{invoice_id}/facturae", response_class=FileResponse)
def download_invoice_facturae(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceReader,
):
    invoice, path = facturae_service.resolve_facturae(
        db,
        current_user.company_id,
        invoice_id,
    )
    media_type = (
        "application/xml"
        if invoice.facturae_signature_status == "unsigned"
        else "application/octet-stream"
    )
    return FileResponse(
        path,
        media_type=media_type,
        filename=path.name,
    )


@router.get("/{invoice_id}/items", response_model=list[InvoiceItemResponse])
async def read_invoice_items(
    invoice_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: invoice_item_service.get_invoice_items(
            sync_db, current_user.company_id, invoice_id
        )
    )


@router.post(
    "/{invoice_id}/rectify",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def rectify_invoice(
    invoice_id: int,
    data: RectificationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    rectification = invoice_service.create_rectification_invoice(
        db, current_user.company_id, invoice_id, data
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=rectification.company_id,
        action="invoice.rectified",
        entity_type="invoice",
        entity_id=rectification.id,
        request=request,
        details={
            "original_invoice_id": invoice_id,
            "invoice_number": rectification.invoice_number,
            "record_hash": rectification.invoice_hash,
        },
    )
    return rectification



@router.post(
    "/{invoice_id}/items",
    response_model=InvoiceItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice_item(
    invoice_item_data: InvoiceItemCreate,
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    return invoice_item_service.create_invoice_item(
        db, current_user.company_id, invoice_id, invoice_item_data
    )


@router.patch(
    "/{invoice_id}/items/{item_id}",
    response_model=InvoiceItemResponse,
)
def update_invoice_item(
    invoice_id: int,
    item_id: int,
    item_data: InvoiceItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    return invoice_item_service.update_invoice_item(
        db, current_user.company_id, invoice_id, item_id, item_data
    )


@router.delete("/{invoice_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice_item(
    invoice_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager
):
    invoice_item_service.delete_invoice_item(
        db, current_user.company_id, invoice_id, item_id
    )
