import uuid
from datetime import datetime, timedelta, timezone

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
from app.models.company import Company
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
from app.schemas.company import (
    CompanyCreate,
    CompanyMemberResponse,
    CompanyProvisionCreate,
    CompanyUpdate,
)
from app.repositories import company as company_repo
from app.repositories import user as user_repo
from app.repositories import role as role_repo
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.security import get_password_hash
from app.schemas.company import CompanyExpenseResponse
from app.services.user_scope import (
    is_platform_superadmin,
    require_platform_superadmin,
)
from app.services import company_update_policy_service


def get_companies(db: Session, current_user: User, skip: int = 0, limit: int = 100) -> list[Company]:
    if is_platform_superadmin(current_user):
        return company_repo.get_all_companies(db, skip, limit)
    if not current_user.company_id:
        return []
    my_company = company_repo.get_company_by_id(db, current_user.company_id)
    return [my_company] if my_company else []


def get_company(db: Session, company_id: int, current_user: User) -> Company:
    company_update_policy_service.require_company_access(
        current_user,
        company_id,
        action="access",
    )
    existing_company = company_repo.get_company_by_id(db, company_id)
    if not existing_company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
        )

    # Ensure partner_code is generated if not present
    if not existing_company.partner_code:
        from app.services import collaboration_service
        collaboration_service.get_or_generate_partner_code(db, existing_company.id)
        existing_company = company_repo.get_company_by_id(db, company_id)
        if not existing_company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found",
            )

    return existing_company


def get_company_members(
    db: Session,
    company_id: int,
    current_user: User,
) -> list[CompanyMemberResponse]:
    require_platform_superadmin(current_user)
    if not company_repo.get_company_by_id(db, company_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
    return [
        CompanyMemberResponse(
            id=member.id,
            full_name=member.full_name,
            email=member.email,
            role=member.role.name,
            is_active=member.is_active,
        )
        for member in user_repo.get_company_members(db, company_id)
    ]


def create_company(
    db: Session, company_data: CompanyCreate, creator: User
) -> Company:
    if not settings.ALLOW_PUBLIC_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-service company creation is disabled",
        )
    if creator.company_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already belongs to a company",
        )
    existing = company_repo.get_company_by_tax_id(db, company_data.tax_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tax ID already exists",
        )

    now = datetime.now(timezone.utc)
    new_company = company_repo.create_company(db, company_data)
    new_company.subscription_plan = "trial"
    new_company.subscription_status = "trialing"
    new_company.trial_started_at = now
    new_company.trial_ends_at = now + timedelta(days=14)
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    
    # Generate partner code immediately
    from app.services import collaboration_service
    collaboration_service.get_or_generate_partner_code(db, new_company.id)
    
    admin_role = role_repo.get_role_by_name(db, "admin")
    if not admin_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Role 'admin' not configured in database",
        )
    creator.role = admin_role
    creator.company = new_company
    db.commit()
    db.refresh(creator)
    db.expire(creator, ["role", "company"])

    return new_company


def provision_company(
    db: Session,
    provision_data: CompanyProvisionCreate,
    current_user: User,
) -> Company:
    require_platform_superadmin(current_user)
    if company_repo.get_company_by_tax_id(db, provision_data.tax_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tax ID already exists",
        )
    if user_repo.get_user_by_email(db, provision_data.owner_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Owner email already registered",
        )

    admin_role = role_repo.get_role_by_name(db, "admin")
    if not admin_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Role 'admin' not configured in database",
        )

    clean_name = (
        "".join(char for char in provision_data.name if char.isalnum()).upper()[:4]
        or "COMP"
    )
    partner_code = f"WH-{clean_name}-{uuid.uuid4().hex[:6].upper()}"
    while db.query(Company).filter(Company.partner_code == partner_code).first():
        partner_code = f"WH-{clean_name}-{uuid.uuid4().hex[:6].upper()}"

    now = datetime.now(timezone.utc)
    trial_days = provision_data.trial_days or 14
    is_trial = provision_data.subscription_plan == "trial"
    company = Company(
        name=provision_data.name,
        tax_id=provision_data.tax_id,
        address=provision_data.address,
        phone=provision_data.phone,
        email=provision_data.email,
        partner_code=partner_code,
        is_active=True,
        onboarding_completed=False,
        subscription_plan=provision_data.subscription_plan,
        subscription_status="trialing" if is_trial else "active",
        trial_started_at=now if is_trial else None,
        trial_ends_at=now + timedelta(days=trial_days) if is_trial else None,
    )
    try:
        db.add(company)
        db.flush()
        owner = User(
            email=provision_data.owner_email,
            hashed_password=get_password_hash(provision_data.owner_password),
            full_name=provision_data.owner_full_name,
            is_active=True,
            email_verified_at=datetime.now(timezone.utc),
            role_id=admin_role.id,
            company_id=company.id,
        )
        db.add(owner)
        db.commit()
        db.refresh(company)
        return company
    except Exception:
        db.rollback()
        raise


def update_company(
    db: Session, company_id: int, company_update: CompanyUpdate, current_user: User
) -> Company:
    company_update_policy_service.require_company_access(
        current_user,
        company_id,
        action="update",
    )
    db_company = company_repo.get_company_by_id(db, company_id)
    if not db_company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
        )
    company_update_policy_service.require_company_update_permissions(
        current_user,
        company_update.model_fields_set,
    )
    if company_update.tax_id is not None:
        existing_tax_id_in_company = company_repo.get_company_by_tax_id(
            db, tax_id=company_update.tax_id
        )
        if existing_tax_id_in_company and existing_tax_id_in_company.id != company_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tax ID already exists in another company",
            )

    update_payload = company_update.model_dump(exclude_unset=True)
    update_payload = company_update_policy_service.normalize_platform_subscription_update(
        update_payload,
        platform_superadmin=is_platform_superadmin(current_user),
    )
    should_revoke_company_sessions = (
        company_update_policy_service.requires_session_revocation(
            company_update.model_fields_set
        )
    )

    normalized_update = CompanyUpdate.model_validate(update_payload)
    updated_company = company_repo.update_company(db, db_company, normalized_update)
    if should_revoke_company_sessions:
        (
            db.query(User)
            .filter(User.company_id == company_id)
            .update(
                {User.session_version: User.session_version + 1},
                synchronize_session=False,
            )
        )
        db.commit()
        db.refresh(updated_company)
    return updated_company


def delete_company_permanently(
    db: Session,
    company_id: int,
    current_user: User,
) -> None:
    require_platform_superadmin(current_user)
    db_company = company_repo.get_company_by_id(db, company_id)
    if not db_company:
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
        if company_user_ids:
            db.query(PlatformCalendarConfig).filter(
                PlatformCalendarConfig.updated_by_user_id.in_(company_user_ids)
            ).update(
                {PlatformCalendarConfig.updated_by_user_id: None},
                synchronize_session=False,
            )
            db.query(CalendarOwnershipRequest).filter(
                (
                    CalendarOwnershipRequest.requester_user_id.in_(
                        company_user_ids
                    )
                )
                | (
                    CalendarOwnershipRequest.reviewed_by_user_id.in_(
                        company_user_ids
                    )
                )
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
            db.query(AuditLog).filter(
                AuditLog.actor_user_id.in_(company_user_ids)
            ).update({AuditLog.actor_user_id: None}, synchronize_session=False)
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

        db.query(TrialRequest).filter(
            TrialRequest.created_company_id == company_id
        ).update({TrialRequest.created_company_id: None}, synchronize_session=False)
        db.query(AuditLog).filter(AuditLog.company_id == company_id).update(
            {AuditLog.company_id: None}, synchronize_session=False
        )
        db.query(DataSubjectRequest).filter(
            DataSubjectRequest.company_id == company_id
        ).update({DataSubjectRequest.company_id: None}, synchronize_session=False)
        db.query(PrivacyConsent).filter(
            PrivacyConsent.company_id == company_id
        ).update({PrivacyConsent.company_id: None}, synchronize_session=False)
        db.query(CompanyCollaboration).filter(
            (CompanyCollaboration.initiator_company_id == company_id)
            | (CompanyCollaboration.partner_company_id == company_id)
        ).delete(synchronize_session=False)
        db.query(LocationCompanyAccess).filter(
            LocationCompanyAccess.company_id == company_id
        ).delete(synchronize_session=False)
        db.query(CalendarSyncJob).filter(
            CalendarSyncJob.company_id == company_id
        ).delete(synchronize_session=False)
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
        for user in company_users:
            db.delete(user)
        db.delete(db_company)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Company still has related records. Deactivate it instead.",
        )


def get_company_expenses(
    db: Session,
    company_id: int,
    current_user: User,
) -> list[CompanyExpenseResponse]:
    get_company(db, company_id, current_user)
    rows = (
        db.query(TaskItem)
        .join(
            Reservation,
            TaskItem.checkout_reservation_id == Reservation.id,
        )
        .filter(
            Reservation.owner_company_id == company_id,
            TaskItem.company_id != company_id,
            TaskItem.status == "completed",
        )
        .order_by(TaskItem.date_done.asc(), TaskItem.created_at.asc())
        .all()
    )
    return [
        CompanyExpenseResponse(
            task_id=task.id,
            occurred_at=task.date_done or task.created_at,
            amount=float(task.price or 0) * float(task.quantity or 1),
            provider_company_id=task.company_id,
            provider_company_name=(
                task.company.name if task.company else f"Company {task.company_id}"
            ),
        )
        for task in rows
    ]
