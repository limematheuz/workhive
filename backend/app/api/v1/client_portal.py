"""Transport for the authenticated customer workspace and its acceptance flow."""

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveClientPortal, ActiveClientPortalUser, ClientPortalPrincipal, get_db
from app.models.user import User
from app.schemas.client_portal import (
    ClientPortalInspectionAcceptanceCreate,
    ClientPortalInspectionResponse,
    ClientPortalOverviewResponse,
    ClientPortalWorkspaceResponse,
)
from app.services import (
    audit_service,
    client_portal_policy,
    client_portal_service,
    invoice_service,
    quality_client_acceptance_service,
)


router = APIRouter()


@router.get("/workspaces", response_model=list[ClientPortalWorkspaceResponse])
def read_client_portal_workspaces(
    db: Session = Depends(get_db),
    current_user: User = ActiveClientPortalUser,
):
    grants = client_portal_policy.list_active_client_portal_grants(db, current_user=current_user)
    return [client_portal_service.serialize_workspace(grant) for grant in grants]


@router.get("/workspaces/{grant_id}/overview", response_model=ClientPortalOverviewResponse)
def read_client_portal_overview(
    db: Session = Depends(get_db),
    principal: ClientPortalPrincipal = ActiveClientPortal,
):
    return client_portal_service.overview(db, grant=principal.grant)


@router.post(
    "/workspaces/{grant_id}/inspections/{inspection_id}/acceptance",
    response_model=ClientPortalInspectionResponse,
)
def accept_client_portal_inspection(
    inspection_id: int,
    payload: ClientPortalInspectionAcceptanceCreate,
    request: Request,
    db: Session = Depends(get_db),
    principal: ClientPortalPrincipal = ActiveClientPortal,
):
    inspection = quality_client_acceptance_service.accept_client_portal_inspection(
        db,
        grant=principal.grant,
        current_user=principal.user,
        inspection_id=inspection_id,
        payload=payload,
    )
    audit_service.record_event(
        db,
        actor=principal.user,
        company_id=principal.grant.company_id,
        action="quality_inspection.client_accepted",
        entity_type="quality_inspection",
        entity_id=inspection.id,
        request=request,
        details={
            "client_id": principal.grant.client_id,
            "statement_version": (
                inspection.acceptance.statement_version if inspection.acceptance else None
            ),
        },
    )
    return inspection


@router.get("/workspaces/{grant_id}/invoices/{invoice_id}/pdf", response_class=Response)
def download_client_portal_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    principal: ClientPortalPrincipal = ActiveClientPortal,
):
    # Scope the invoice to the caller's grant before resolving any stored bytes.
    from app.repositories import client_portal as client_portal_repo

    scoped_invoice = client_portal_repo.get_invoice(
        db,
        grant=principal.grant,
        invoice_id=invoice_id,
    )
    if scoped_invoice is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    invoice, document = invoice_service.get_invoice_pdf(
        db,
        principal.grant.company_id,
        scoped_invoice.id,
    )
    return Response(
        content=document.contents,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{invoice.invoice_number}.pdf"'},
    )
