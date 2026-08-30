"""Safely remove an empty trial company and its derived operational records."""

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.calendar_governance import (
    CalendarOwnershipRequest,
    CompanyCalendarSettings,
    PlatformCalendarConfig,
)
from app.models.calendar_sync_job import CalendarSyncJob
from app.models.client import Client
from app.models.company_collaboration import CompanyCollaboration
from app.models.data_subject_request import DataSubjectRequest
from app.models.fiscal_invoice_record import FiscalInvoiceRecord
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.models.invoice import Invoice
from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.models.location_template import LocationTemplate
from app.models.privacy_consent import PrivacyConsent
from app.models.quote import Quote
from app.models.reservation import Reservation
from app.models.task_calendar_event import TaskCalendarEvent
from app.models.task_item import TaskItem
from app.models.template_task import TemplateTask
from app.models.trial_request import TrialRequest
from app.models.user import User
from app.models.work_session import WorkSession
from app.repositories import company as company_repo
from app.services import (
    company_entitlement_service,
    company_enterprise_access_cleanup_service,
)


def delete_empty_company_permanently(db: Session, *, company_id: int) -> None:
    """Delete only a company without operational or fiscal history.

    Companies with completed work, reservations, quotes or fiscal records must
    be deactivated instead. This preserves the legal and operational history.
    """
    company = company_repo.get_company_by_id(db, company_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    company_users = db.query(User).filter(User.company_id == company_id).all()
    company_user_ids = [user.id for user in company_users]
    location_ids = [
        location_id
        for (location_id,) in db.query(Location.id)
        .filter(
            (Location.owner_company_id == company_id)
            | (Location.managing_company_id == company_id)
            | (Location.default_service_provider_id == company_id)
        )
        .all()
    ]
    work_session_count = (
        db.query(WorkSession)
        .filter(
            (WorkSession.user_id.in_(company_user_ids))
            | (WorkSession.location_id.in_(location_ids))
        )
        .count()
        if company_user_ids or location_ids
        else 0
    )
    protected_count = (
        db.query(Invoice).filter(Invoice.company_id == company_id).count()
        + db.query(Quote).filter(Quote.company_id == company_id).count()
        + db.query(FiscalInvoiceRecord)
        .filter(FiscalInvoiceRecord.company_id == company_id)
        .count()
        + db.query(Reservation)
        .filter(
            (Reservation.owner_company_id == company_id)
            | (Reservation.assigned_company_id == company_id)
            | (Reservation.location_id.in_(location_ids))
        )
        .count()
        + db.query(TaskItem)
        .filter(
            (TaskItem.company_id == company_id)
            | (TaskItem.location_id.in_(location_ids))
        )
        .count()
        + work_session_count
    )
    if protected_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Company has tasks, reservations, quotes, invoices or fiscal records. "
                "Deactivate it instead to preserve legal history."
            ),
        )

    try:
        _remove_user_references(db, company_user_ids)
        _remove_company_references(db, company_id)
        _remove_locations_and_templates(db, company_id, location_ids)
        company_entitlement_service.delete_company_entitlement_data(
            db,
            company_id=company_id,
        )
        company_enterprise_access_cleanup_service.delete_company_enterprise_access_data(
            db,
            company_id,
        )
        for user in company_users:
            db.delete(user)
        db.delete(company)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Company still has related records. Deactivate it instead.",
        )


def _remove_user_references(db: Session, company_user_ids: list[int]) -> None:
    if not company_user_ids:
        return
    db.query(PlatformCalendarConfig).filter(
        PlatformCalendarConfig.updated_by_user_id.in_(company_user_ids)
    ).update(
        {PlatformCalendarConfig.updated_by_user_id: None}, synchronize_session=False
    )
    db.query(CalendarOwnershipRequest).filter(
        (CalendarOwnershipRequest.requester_user_id.in_(company_user_ids))
        | (CalendarOwnershipRequest.reviewed_by_user_id.in_(company_user_ids))
    ).delete(synchronize_session=False)
    db.query(CompanyCalendarSettings).filter(
        CompanyCalendarSettings.owner_user_id.in_(company_user_ids)
    ).delete(synchronize_session=False)
    db.query(TrialRequest).filter(
        TrialRequest.approved_by_user_id.in_(company_user_ids)
    ).update({TrialRequest.approved_by_user_id: None}, synchronize_session=False)
    db.query(TrialRequest).filter(
        TrialRequest.created_user_id.in_(company_user_ids)
    ).update({TrialRequest.created_user_id: None}, synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.actor_user_id.in_(company_user_ids)).update(
        {AuditLog.actor_user_id: None}, synchronize_session=False
    )
    db.query(DataSubjectRequest).filter(
        DataSubjectRequest.requested_by_user_id.in_(company_user_ids)
    ).update({DataSubjectRequest.requested_by_user_id: None}, synchronize_session=False)
    db.query(DataSubjectRequest).filter(
        DataSubjectRequest.resolved_by_user_id.in_(company_user_ids)
    ).update({DataSubjectRequest.resolved_by_user_id: None}, synchronize_session=False)
    db.query(PrivacyConsent).filter(
        PrivacyConsent.user_id.in_(company_user_ids)
    ).delete(synchronize_session=False)
    db.query(CalendarSyncJob).filter(
        CalendarSyncJob.user_id.in_(company_user_ids)
    ).delete(synchronize_session=False)
    db.query(TaskCalendarEvent).filter(
        TaskCalendarEvent.user_id.in_(company_user_ids)
    ).delete(synchronize_session=False)
    db.query(GoogleCalendarConnection).filter(
        (GoogleCalendarConnection.connected_by_user_id.in_(company_user_ids))
        | (GoogleCalendarConnection.owner_user_id.in_(company_user_ids))
    ).delete(synchronize_session=False)


def _remove_company_references(db: Session, company_id: int) -> None:
    db.query(TrialRequest).filter(TrialRequest.created_company_id == company_id).update(
        {TrialRequest.created_company_id: None}, synchronize_session=False
    )
    db.query(AuditLog).filter(AuditLog.company_id == company_id).update(
        {AuditLog.company_id: None}, synchronize_session=False
    )
    db.query(DataSubjectRequest).filter(
        DataSubjectRequest.company_id == company_id
    ).update({DataSubjectRequest.company_id: None}, synchronize_session=False)
    db.query(PrivacyConsent).filter(PrivacyConsent.company_id == company_id).update(
        {PrivacyConsent.company_id: None}, synchronize_session=False
    )
    db.query(CompanyCollaboration).filter(
        (CompanyCollaboration.initiator_company_id == company_id)
        | (CompanyCollaboration.partner_company_id == company_id)
    ).delete(synchronize_session=False)
    db.query(LocationCompanyAccess).filter(
        LocationCompanyAccess.company_id == company_id
    ).delete(synchronize_session=False)
    db.query(CalendarSyncJob).filter(CalendarSyncJob.company_id == company_id).delete(
        synchronize_session=False
    )
    db.query(TaskCalendarEvent).filter(
        TaskCalendarEvent.company_id == company_id
    ).delete(synchronize_session=False)
    db.query(GoogleCalendarConnection).filter(
        GoogleCalendarConnection.company_id == company_id
    ).delete(synchronize_session=False)
    db.query(CalendarOwnershipRequest).filter(
        CalendarOwnershipRequest.company_id == company_id
    ).delete(synchronize_session=False)
    db.query(CompanyCalendarSettings).filter(
        CompanyCalendarSettings.company_id == company_id
    ).delete(synchronize_session=False)


def _remove_locations_and_templates(
    db: Session, company_id: int, location_ids: list[int]
) -> None:
    template_ids = [
        template_id
        for (template_id,) in db.query(TemplateTask.id)
        .filter(TemplateTask.company_id == company_id)
        .all()
    ]
    if template_ids:
        db.query(LocationTemplate).filter(
            LocationTemplate.template_task_id.in_(template_ids)
        ).delete(synchronize_session=False)
    if location_ids:
        db.query(LocationCompanyAccess).filter(
            LocationCompanyAccess.location_id.in_(location_ids)
        ).delete(synchronize_session=False)
        db.query(LocationTemplate).filter(
            LocationTemplate.location_id.in_(location_ids)
        ).delete(synchronize_session=False)
        db.query(Location).filter(Location.id.in_(location_ids)).delete(
            synchronize_session=False
        )
    db.query(TemplateTask).filter(TemplateTask.company_id == company_id).delete(
        synchronize_session=False
    )
    db.query(Client).filter(Client.company_id == company_id).delete(
        synchronize_session=False
    )
